import Foundation
import UIKit

/// Mux direct-upload + live stream client for the iOS clone.
///
/// Mirrors the Expo `lib/muxUpload.ts` and `lib/streaming/muxLive.ts`:
///  - `createUploadUrl()`  → calls the `create-upload-url` edge fn to mint a
///                           signed PUT URL + insert a placeholder episode row.
///  - `uploadFile()`       → PUTs the file to Mux with real byte progress via
///                           URLSessionDelegate progress.
///  - `awaitAssetReady()`  → polls the `episodes` row until Mux finishes
///                           transcoding.
///  - `createLiveStream()` → calls the `create-live-stream` edge fn.
///  - `getStreamHealth()`  → polls the `stream-health` edge fn.
///  - `endLiveStream()`    → calls the `end-live-stream` edge fn.
///
/// No secrets in the app — the edge fns hold the Mux token.
@MainActor
final class MuxClient {
    static let shared = MuxClient()

    private let edge = EdgeClient.shared
    private let supabaseURL: String
    private let supabaseAnonKey: String
    private let session: URLSession

    private init() {
        self.supabaseURL = Config.EXPO_PUBLIC_SUPABASE_URL
        self.supabaseAnonKey = Config.EXPO_PUBLIC_SUPABASE_ANON_KEY
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = 300 // uploads can be large
        cfg.waitsForConnectivity = true
        self.session = URLSession(configuration: cfg)
    }

    // MARK: - Types

    struct UploadUrlResult: Decodable {
        let uploadUrl: String
        let uploadId: String
        let episodeId: String
    }

    struct EpisodeRow: Decodable {
        let id: String
        let status: String
        let video_url: String?
        let thumb_url: String?
    }

    struct CreatedLiveStream: Decodable {
        let streamId: String
        let muxLiveStreamId: String
        let rtmpIngestUrl: String
        let rtmpStreamKey: String?
        let hlsPlaybackUrl: String?
        let muxPlaybackId: String?
        let creatorHandle: String?
        let creatorName: String?
        let isCoStream: Bool
    }

    struct StreamHealth: Decodable {
        let status: String
        let muxStatus: String?
        let concurrentViewers: Int
        let maxViewers: Int
        let elapsedSec: Int
        let peakBitrateKbps: Int
        let droppedFramesPct: Double
        let latencyMode: String
        let reconnectWindow: Int?
        let activeAssetId: String?
    }

    struct EndLiveStreamResult: Decodable {
        let ok: Bool
        let replayEpisodeId: String?
        let replayReady: Bool
    }

    enum MuxError: LocalizedError {
        case noToken
        case uploadFailed(String)
        case invalidResponse
        case timeout

        var errorDescription: String? {
            switch self {
            case .noToken: return "Not signed in"
            case .uploadFailed(let m): return m
            case .invalidResponse: return "Invalid response from server"
            case .timeout: return "The upload timed out. Try a shorter clip."
            }
        }
    }

    // MARK: - Direct upload

    /// Ask the backend to create a Mux direct upload + placeholder episode row.
    func createUploadUrl(title: String, category: String, chapter: String?, thumbUrl: String?) async throws -> UploadUrlResult {
        var body: [String: Any] = ["title": title, "category": category]
        if let chapter { body["chapter"] = chapter }
        if let thumbUrl { body["thumbUrl"] = thumbUrl }
        return try await edge.call("create-upload-url", body: body, as: UploadUrlResult.self)
    }

    /// Upload a file (by URL) to the Mux direct-upload URL. Reports real byte
    /// progress via onProgress(0..1).
    func uploadFile(
        fileURL: URL,
        uploadUrl: String,
        onProgress: @escaping (Double) -> Void
    ) async throws {
        guard let url = URL(string: uploadUrl) else { throw MuxError.invalidResponse }
        var req = URLRequest(url: url)
        req.httpMethod = "PUT"
        req.setValue("video/mp4", forHTTPHeaderField: "Content-Type")

        // Use an upload task with a progress handler for real byte progress.
        let (data, response) = try await uploadWithProgress(
            request: req,
            fileURL: fileURL,
            onProgress: onProgress
        )

        guard let http = response as? HTTPURLResponse else { throw MuxError.invalidResponse }
        if !(200..<300).contains(http.statusCode) {
            throw MuxError.uploadFailed("The upload was rejected by the video provider (\(http.statusCode)).")
        }
        _ = data
        onProgress(1.0)
    }

    /// Poll the episodes row until Mux finishes transcoding.
    func awaitAssetReady(episodeId: String, timeoutSec: TimeInterval = 180) async throws -> EpisodeRow? {
        let deadline = Date().addingTimeInterval(timeoutSec)
        var lastRow: EpisodeRow?

        while Date() < deadline {
            guard let uid = edge.userId else { throw MuxError.noToken }
            guard let url = URL(string: "\(supabaseURL)/rest/v1/episodes?select=id,status,video_url,thumb_url&id=eq.\(episodeId)") else {
                throw MuxError.invalidResponse
            }
            var req = URLRequest(url: url)
            req.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
            if let token = authToken { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }

            do {
                let (data, response) = try await URLSession.shared.data(for: req)
                if let http = response as? HTTPURLResponse, http.statusCode == 200 {
                    let rows = try JSONDecoder().decode([EpisodeRow].self, from: data)
                    if let row = rows.first {
                        lastRow = row
                        let isProcessing = row.status == "uploading" || row.status == "transcoding"
                        if !isProcessing || (row.video_url != nil && row.status != "uploading") {
                            return row
                        }
                    }
                }
            } catch {
                // Keep polling — transient errors
            }

            try await Task.sleep(for: .seconds(3))
        }
        return lastRow
    }

    // MARK: - Live stream

    /// Create a real Mux Live Stream + DB row. Host-only.
    func createLiveStream(
        title: String,
        category: String,
        access: String,
        ppvPrice: Double?,
        streamSource: String,
        replayEnabled: Bool,
        slowMode: Bool,
        subOnlyChat: Bool
    ) async throws -> CreatedLiveStream {
        var body: [String: Any] = [
            "title": title,
            "category": category,
            "access": access,
            "streamSource": streamSource,
            "replayEnabled": replayEnabled,
            "slowMode": slowMode,
            "subOnlyChat": subOnlyChat,
            "latencyMode": "low",
        ]
        if let ppvPrice { body["ppvPrice"] = ppvPrice }
        return try await edge.call("create-live-stream", body: body, as: CreatedLiveStream.self)
    }

    /// Poll real Mux health metrics for the host dashboard.
    func getStreamHealth(streamId: String) async throws -> StreamHealth {
        try await edge.call("stream-health", body: ["streamId": streamId], as: StreamHealth.self)
    }

    /// End the stream. Triggers Mux `complete` + replay VOD creation.
    func endLiveStream(streamId: String, replayTitle: String?) async throws -> EndLiveStreamResult {
        var body: [String: Any] = ["streamId": streamId]
        if let replayTitle { body["replayTitle"] = replayTitle }
        return try await edge.call("end-live-stream", body: body, as: EndLiveStreamResult.self)
    }

    // MARK: - Private helpers

    private var authToken: String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: "access_token",
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    /// URLSession upload with a progress handler.
    private func uploadWithProgress(
        request: URLRequest,
        fileURL: URL,
        onProgress: @escaping (Double) -> Void
    ) async throws -> (Data, URLResponse) {
        return try await withCheckedThrowingContinuation { continuation in
            let task = self.session.uploadTask(with: request, fromFile: fileURL) { data, response, error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: (data ?? Data(), response!))
                }
            }

            // Observe progress — kept alive by the ProgressObserver wrapper.
            let observer = ProgressObserver(task: task) { fraction in
                Task { @MainActor in
                    onProgress(min(0.99, fraction))
                }
            }
            objc_setAssociatedObject(task, &Self.observationKey, observer, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)

            task.resume()
        }
    }

    private static var observationKey: Int = 0
}

/// Wraps a URLSession upload task's Progress KVO observation so it lives as
/// long as the task itself (attached via associated object).
private final class ProgressObserver: NSObject {
    private let task: URLSessionUploadTask
    private let handler: (Double) -> Void
    private var observation: NSKeyValueObservation?

    init(task: URLSessionUploadTask, handler: @escaping (Double) -> Void) {
        self.task = task
        self.handler = handler
        super.init()
        self.observation = task.progress.observe(\.fractionCompleted, options: [.new]) { [weak self] progress, _ in
            self?.handler(progress.fractionCompleted)
        }
    }

    deinit {
        observation?.invalidate()
    }
}

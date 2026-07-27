import Foundation

/// Minimal edge-function client for the iOS clone.
///
/// Mirrors the Expo `lib/edge.ts` `callEdge` helper: posts JSON to a Supabase
/// Edge Function with the Rork Auth JWT from the keychain. The JWT is stored
/// by the sign-in flow under `access_token` in the keychain.
@MainActor
final class EdgeClient {
    static let shared = EdgeClient()

    private let functionsURL: String
    private let session: URLSession

    private init() {
        // Config values are injected at build time; fall back to the public
        // functions URL if the dedicated one is empty.
        let url = Config.EXPO_PUBLIC_RORK_FUNCTIONS_URL.isEmpty
            ? "\(Config.EXPO_PUBLIC_SUPABASE_URL)/functions/v1"
            : Config.EXPO_PUBLIC_RORK_FUNCTIONS_URL
        self.functionsURL = url
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = 30
        cfg.waitsForConnectivity = true
        self.session = URLSession(configuration: cfg)
    }

    /// The stored Rork Auth JWT (sub claim = user id).
    private var authToken: String? {
        // Read from keychain — the sign-in flow stores it under this account.
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

    /// The current user's id parsed from the JWT sub claim.
    var userId: String? {
        guard let token = authToken else { return nil }
        let parts = token.split(separator: ".")
        guard parts.count == 3 else { return nil }
        var base64 = String(parts[1])
        base64 = base64.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        let pad = base64.count % 4
        if pad > 0 { base64.append(String(repeating: "=", count: 4 - pad)) }
        guard let data = Data(base64Encoded: base64),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        return json["sub"] as? String
    }

    /// POST JSON to an edge function and decode the response.
    func call<T: Decodable>(
        _ slug: String,
        body: [String: Any]? = nil,
        as type: T.Type
    ) async throws -> T {
        guard let url = URL(string: "\(functionsURL)/\(slug)") else {
            throw EdgeError.invalidURL
        }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = authToken {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body = body {
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        let (data, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw EdgeError.noResponse }
        if http.statusCode >= 400 {
            let err = try? JSONDecoder().decode(EdgeErrorBody.self, from: data)
            throw EdgeError.server(err?.error ?? "Request failed (\(http.statusCode))")
        }
        return try JSONDecoder().decode(T.self, from: data)
    }
}

enum EdgeError: LocalizedError {
    case invalidURL
    case noResponse
    case server(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid URL"
        case .noResponse: return "No response from server"
        case .server(let msg): return msg
        }
    }
}

private struct EdgeErrorBody: Decodable {
    let error: String?
}

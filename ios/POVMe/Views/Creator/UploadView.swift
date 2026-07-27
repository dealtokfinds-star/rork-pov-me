import SwiftUI
import PhotosUI
import UniformTypeIdentifiers

/// Upload modal — real Mux direct-upload pipeline.
///
/// Mirrors the Expo `app/upload.tsx`:
///  1. Choose: PhotosPicker for library video, UIImagePickerController for camera.
///  2. Uploading: real byte progress via URLSession upload task.
///  3. Transcoding: waiting for Mux `video.asset.ready` webhook.
///  4. Publish: publish now / schedule / save draft → updates the real episodes row.
struct UploadView: View {
    @Environment(AppState.self) private var app
    @Environment(Router.self) private var router
    @State private var title = ""
    @State private var description = ""
    @State private var category: PovCategory = .founder
    @State private var chapter = "Work"
    @State private var access: AccessLevel = .subscribers
    @State private var ppvPrice = "9.99"
    @State private var status: StudioEpisode.StudioStatus = .published
    @State private var thumbUrl: String? = nil
    @State private var published = false

    // Upload state
    @State private var phase: UploadPhase = .choose
    @State private var progress: Double = 0
    @State private var videoLabel = ""
    @State private var episodeId: String? = nil
    @State private var error: String? = nil
    @State private var submitting = false
    @State private var showPhotoPicker = false
    @State private var showCamera = false
    @State private var photoItem: PhotosPickerItem? = nil
    @State private var cameraImage: UIImage? = nil

    private let chapters = ["Morning", "Work", "Gym", "Night out", "Travel day", "Debrief"]
    private let ppvPrices = ["4.99", "6.99", "9.99", "12.99", "14.99", "19.99"]

    enum UploadPhase { case choose, uploading, transcoding, ready, error }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                if published {
                    publishedView
                } else {
                    form
                }
            }
            .padding(.horizontal, 22)
            .padding(.bottom, 40)
            .padding(.top, 20)
        }
        .background(Theme.bg.ignoresSafeArea())
        .navigationTitle("New episode")
        .navigationBarTitleDisplayMode(.inline)
        .photosPicker(isPresented: $showPhotoPicker, selection: $photoItem, matching: .videos)
        .sheet(isPresented: $showCamera) {
            CameraRecorder { result in
                showCamera = false
                switch result {
                case .success(let url):
                    startUpload(url: url, label: "camera_take.mp4")
                case .failure(let err):
                    error = err.localizedDescription
                    phase = .error
                }
            }
        }
        .onChange(of: photoItem) { _, item in
            guard let item else { return }
            Task {
                if let url = await loadVideo(from: item) {
                    startUpload(url: url, label: "library_clip.mp4")
                }
            }
        }
    }

    // MARK: - Form

    private var form: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("New POV episode").microLabel(Theme.lime, size: 11)

            // Upload zone
            uploadZone

            // Title
            VStack(alignment: .leading, spacing: 8) {
                Text("Title").microLabel(Theme.textDim, size: 10)
                TextField("4:00 AM: you wake up as…", text: $title)
                    .font(.system(size: 16, weight: .bold)).foregroundStyle(Theme.text)
                    .padding(.horizontal, 14).frame(height: 52)
                    .background(Theme.surface)
                    .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
                    .clipShape(.rect(cornerRadius: Theme.rMd))
            }

            // Description
            VStack(alignment: .leading, spacing: 8) {
                Text("Description").microLabel(Theme.textDim, size: 10)
                TextField("What happens, what they'll feel…", text: $description, axis: .vertical)
                    .font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.text)
                    .lineLimit(3...6)
                    .padding(.horizontal, 14).padding(.vertical, 12)
                    .background(Theme.surface)
                    .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
                    .clipShape(.rect(cornerRadius: Theme.rMd))
            }

            // Category
            VStack(alignment: .leading, spacing: 8) {
                Text("Identity tag").microLabel(Theme.textDim, size: 10)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(Category.all) { c in
                            Chip(label: c.label, active: category == c.id, accent: c.accent, emoji: c.emoji) {
                                category = c.id
                            }
                        }
                    }
                }
            }

            // Access
            VStack(alignment: .leading, spacing: 8) {
                Text("Access").microLabel(Theme.textDim, size: 10)
                VStack(spacing: 8) {
                    accessRow("person.3.fill", "Free", "Public teaser", .free, Theme.lime)
                    accessRow("person.2.fill", "Subscribers", "Included in monthly feed", .subscribers, Theme.lime)
                    accessRow("lock.fill", "Pay-per-view", "One-time unlock", .ppv, Theme.cyan)
                }
            }

            // PPV price
            if access == .ppv {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Unlock price").microLabel(Theme.cyan, size: 10)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(ppvPrices, id: \.self) { p in
                                Chip(label: "$\(p)", active: ppvPrice == p, accent: Theme.cyan) {
                                    ppvPrice = p
                                }
                            }
                        }
                    }
                }
            }

            // Status
            VStack(alignment: .leading, spacing: 8) {
                Text("When to publish").microLabel(Theme.textDim, size: 10)
                VStack(spacing: 8) {
                    statusChip("Publish now", .published, "paperplane.fill")
                    statusChip("Schedule for later", .scheduled, "calendar")
                    statusChip("Save as draft", .draft, "tray.fill")
                }
            }

            Spacer(minLength: 20)
            AppButton(
                label: submitLabel,
                disabled: !canPublish || submitting
            ) {
                publish()
            }
        }
    }

    private var submitLabel: String {
        if submitting { return "Publishing…" }
        if phase == .transcoding { return "Processing video…" }
        if phase == .uploading { return "Uploading…" }
        if phase == .ready { return "Publish episode" }
        return "Pick a video first"
    }

    private var canPublish: Bool { phase == .ready }

    // MARK: - Upload zone

    @ViewBuilder private var uploadZone: some View {
        switch phase {
        case .choose:
            VStack(spacing: 14) {
                ZStack {
                    Circle().fill(Theme.lime).frame(width: 46, height: 46)
                    Image(systemName: "film.stack.fill").font(.system(size: 20, weight: .bold)).foregroundStyle(Theme.ink)
                }
                Text("Upload your POV footage").font(.system(size: 16, weight: .heavy)).foregroundStyle(Theme.text)
                Text("MP4 or MOV · up to 4K · chest rig, glasses, helmet")
                    .font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.textDim)
                    .multilineTextAlignment(.center)
                HStack(spacing: 10) {
                    AppButton(label: "Pick from library", full: false, small: true) {
                        showPhotoPicker = true
                    }
                    AppButton(label: "Record", variant: .dark, full: false, small: true) {
                        showCamera = true
                    }
                }
            }
            .padding(24)
            .background(
                RoundedRectangle(cornerRadius: Theme.rLg)
                    .stroke(Theme.borderHi, style: StrokeStyle(lineWidth: 1.5, dash: [8, 6]))
            )

        case .uploading:
            VStack(spacing: 12) {
                ZStack {
                    Circle().fill(Theme.lime).frame(width: 46, height: 46)
                    Image(systemName: "arrow.up.circle.fill").font(.system(size: 20, weight: .bold)).foregroundStyle(Theme.ink)
                }
                Text("Uploading… \(Int(progress * 100))%").font(.system(size: 16, weight: .heavy)).foregroundStyle(Theme.text)
                ProgressBar(progress: progress)
                Text("\(videoLabel) · keep this screen open")
                    .font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.textDim)
            }
            .padding(24)
            .background(Theme.surface)
            .clipShape(.rect(cornerRadius: Theme.rLg))

        case .transcoding:
            VStack(spacing: 12) {
                ZStack {
                    Circle().fill(Theme.cyan).frame(width: 46, height: 46)
                    ProgressView().tint(Theme.ink)
                }
                Text("Transcoding…").font(.system(size: 16, weight: .heavy)).foregroundStyle(Theme.text)
                Text("Mux is processing your video into 4K, 1080p and 720p. This usually takes a minute.")
                    .font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.textDim)
                    .multilineTextAlignment(.center)
            }
            .padding(24)
            .background(Theme.surface)
            .clipShape(.rect(cornerRadius: Theme.rLg))

        case .ready:
            VStack(spacing: 12) {
                ZStack {
                    Circle().fill(Theme.lime).frame(width: 46, height: 46)
                    Image(systemName: "checkmark.circle.fill").font(.system(size: 20, weight: .bold)).foregroundStyle(Theme.ink)
                }
                Text("Video ready").font(.system(size: 16, weight: .heavy)).foregroundStyle(Theme.text)
                Text("\(videoLabel) · processed and ready to publish")
                    .font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.textDim)
                AppButton(label: "Replace video", variant: .ghost, full: false, small: true) {
                    resetUpload()
                }
            }
            .padding(24)
            .background(
                RoundedRectangle(cornerRadius: Theme.rLg)
                    .fill(Color(Theme.lime).opacity(0.06))
                    .overlay(RoundedRectangle(cornerRadius: Theme.rLg).stroke(Theme.lime, lineWidth: 1.5))
            )

        case .error:
            VStack(spacing: 12) {
                ZStack {
                    Circle().fill(Theme.danger).frame(width: 46, height: 46)
                    Image(systemName: "exclamationmark.triangle.fill").font(.system(size: 20, weight: .bold)).foregroundStyle(.white)
                }
                Text("Upload failed").font(.system(size: 16, weight: .heavy)).foregroundStyle(Theme.text)
                Text(error ?? "Something went wrong.")
                    .font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.textDim)
                    .multilineTextAlignment(.center)
                HStack(spacing: 10) {
                    AppButton(label: "Retry", full: false, small: true) {
                        if !videoLabel.isEmpty { retryUpload() } else { resetUpload() }
                    }
                    AppButton(label: "Cancel", variant: .ghost, full: false, small: true) {
                        resetUpload()
                    }
                }
            }
            .padding(24)
            .background(
                RoundedRectangle(cornerRadius: Theme.rLg)
                    .fill(Color(Theme.danger).opacity(0.06))
                    .overlay(RoundedRectangle(cornerRadius: Theme.rLg).stroke(Theme.danger, lineWidth: 1.5))
            )
        }
    }

    // MARK: - Helpers

    private func accessRow(_ icon: String, _ title: String, _ body: String, _ level: AccessLevel, _ color: Color) -> some View {
        PressableButton(scaleTo: 0.97) { access = level } label: {
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(access == level ? color : Theme.surfaceHi).frame(width: 36, height: 36)
                    Image(systemName: icon).font(.system(size: 15, weight: .medium))
                        .foregroundStyle(access == level ? Theme.ink : Theme.textMid)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.system(size: 14, weight: .heavy)).foregroundStyle(Theme.text)
                    Text(body).font(.system(size: 11.5, weight: .semibold)).foregroundStyle(Theme.textDim)
                }
                Spacer()
                if access == level {
                    Image(systemName: "checkmark").font(.system(size: 14, weight: .bold)).foregroundStyle(color)
                }
            }
            .padding(.horizontal, 14).frame(height: 56)
            .background(access == level ? color.opacity(0.12) : Theme.surface)
            .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(access == level ? color : Theme.border, lineWidth: 1))
            .clipShape(.rect(cornerRadius: Theme.rMd))
        }
        .buttonStyle(.plain)
    }

    private func statusChip(_ label: String, _ st: StudioEpisode.StudioStatus, _ icon: String) -> some View {
        PressableButton(scaleTo: 0.97) { status = st } label: {
            HStack(spacing: 8) {
                Image(systemName: icon).font(.system(size: 14, weight: .medium))
                    .foregroundStyle(status == st ? Theme.ink : Theme.textMid)
                Text(label).font(.system(size: 14, weight: .heavy))
                    .foregroundStyle(status == st ? Theme.ink : Theme.textMid)
                Spacer()
                if status == st {
                    Image(systemName: "checkmark").font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.ink)
                }
            }
            .padding(.horizontal, 14).frame(height: 48)
            .background(status == st ? Theme.lime : Theme.surface)
            .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(status == st ? Theme.lime : Theme.border, lineWidth: 1))
            .clipShape(.rect(cornerRadius: Theme.rMd))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Upload pipeline

    private func loadVideo(from item: PhotosPickerItem) async -> URL? {
        guard let data = try? await item.loadTransferable(type: Data.self) else { return nil }
        let tmp = FileManager.default.temporaryDirectory.appendingPathComponent("povme_upload_\(UUID().uuidString).mp4")
        do {
            try data.write(to: tmp)
            return tmp
        } catch {
            return nil
        }
    }

    private func startUpload(url: URL, label: String) {
        videoLabel = label
        phase = .uploading
        progress = 0
        error = nil
        Hap.medium()

        Task { @MainActor in
            do {
                let result = try await MuxClient.shared.createUploadUrl(
                    title: title.isEmpty ? "Untitled POV episode" : title,
                    category: category.rawValue,
                    chapter: chapter,
                    thumbUrl: thumbUrl
                )
                episodeId = result.episodeId

                try await MuxClient.shared.uploadFile(
                    fileURL: url,
                    uploadUrl: result.uploadUrl
                ) { frac in
                    Task { @MainActor in
                        progress = frac
                    }
                }

                progress = 1
                phase = .transcoding
                Hap.success()

                let finalized = try await MuxClient.shared.awaitAssetReady(episodeId: result.episodeId)
                phase = .ready
                Hap.success()
            } catch {
                self.error = error.localizedDescription
                phase = .error
                Hap.heavy()
            }
        }
    }

    private func retryUpload() {
        phase = .choose
        error = nil
        progress = 0
        episodeId = nil
    }

    private func resetUpload() {
        phase = .choose
        error = nil
        progress = 0
        videoLabel = ""
        episodeId = nil
    }

    private func publish() {
        guard canPublish else { return }
        submitting = true
        Hap.success()

        Task { @MainActor in
            do {
                // Update the real episodes row with the publish metadata.
                if let episodeId {
                    try await updateEpisodePublish(episodeId: episodeId)
                }
                // Also update the local studio list for immediate UI feedback.
                let p: Double? = access == .ppv ? Double(ppvPrice) : nil
                app.publishEpisode(.init(
                    title: title, thumb: thumbUrl ?? "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=600&q=80",
                    access: access, ppvPrice: p, category: category, status: status
                ))
                published = true
            } catch {
                self.error = error.localizedDescription
                phase = .error
            }
            submitting = false
        }
    }

    /// Update the episodes row with the publish metadata via Supabase REST.
    private func updateEpisodePublish(episodeId: String) async throws {
        guard let uid = EdgeClient.shared.userId else { throw MuxClient.MuxError.noToken }
        guard let url = URL(string: "\(Config.EXPO_PUBLIC_SUPABASE_URL)/rest/v1/episodes?id=eq.\(episodeId)") else {
            throw MuxClient.MuxError.invalidResponse
        }
        var req = URLRequest(url: url)
        req.httpMethod = "PATCH"
        req.setValue(Config.EXPO_PUBLIC_SUPABASE_ANON_KEY, forHTTPHeaderField: "apikey")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        if let token = keychainToken { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }

        var body: [String: Any] = [
            "status": status.rawValue,
            "access": access.rawValue,
            "category": category.rawValue,
        ]
        if access == .ppv { body["ppv_price"] = Double(ppvPrice) }
        if status == .published { body["posted_at"] = ISO8601DateFormatter().string(from: Date()) }
        req.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (_, response) = try await URLSession.shared.data(for: req)
        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            throw MuxClient.MuxError.uploadFailed("Could not update the episode (\(http.statusCode)).")
        }
        _ = uid
    }

    private var keychainToken: String? {
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

    private var publishedView: some View {
        VStack(spacing: 16) {
            Spacer()
            ZStack {
                Circle().fill(Theme.lime.opacity(0.12)).frame(width: 80, height: 80)
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 32, weight: .bold)).foregroundStyle(Theme.lime)
            }
            .overlay(Circle().stroke(Theme.lime.opacity(0.3), lineWidth: 1).frame(width: 80, height: 80))
            Text(status == .published ? "Episode published" : status == .scheduled ? "Episode scheduled" : "Draft saved")
                .font(.system(size: 24, weight: .heavy)).foregroundStyle(Theme.text)
            Text("\"\(title)\" is now in your studio vault.")
                .font(.system(size: 14, weight: .medium)).foregroundStyle(Theme.textMid)
                .multilineTextAlignment(.center)
            VStack(spacing: 10) {
                AppButton(label: "Go to studio") { router.popToRoot(); router.selectedTab = .studio }
                AppButton(label: "Upload another", variant: .dark, full: true) {
                    title = ""; description = ""; published = false; resetUpload()
                }
            }
            .padding(.top, 12)
            Spacer()
        }
    }
}

// MARK: - Camera recorder (UIImagePickerController wrapper)

struct CameraRecorder: UIViewControllerRepresentable {
    let onComplete: (Result<URL, Error>) -> Void

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = UIImagePickerController.isSourceTypeAvailable(.camera) ? .camera : .photoLibrary
        picker.mediaTypes = [UTType.movie.identifier]
        picker.videoQuality = .typeHigh
        picker.allowsEditing = true
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(onComplete: onComplete) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let onComplete: (Result<URL, Error>) -> Void
        init(onComplete: @escaping (Result<URL, Error>) -> Void) { self.onComplete = onComplete }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            picker.dismiss(animated: true)
            if let url = info[.mediaURL] as? URL {
                onComplete(.success(url))
            } else {
                onComplete(.failure(MuxClient.MuxError.invalidResponse))
            }
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            picker.dismiss(animated: true)
            onComplete(.failure(MuxClient.MuxError.uploadFailed("Camera cancelled")))
        }
    }
}

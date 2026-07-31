import SwiftUI
import UIKit

/// Go Live modal — real Mux Live Stream pipeline.
///
/// Mirrors the Expo `app/golive.tsx`:
///  - Set up stream config (title, category, access, PPV).
///  - Tap "Go live" → calls `create-live-stream` edge fn (real Mux).
///  - Host view: RTMP encoder-connect card with copyable stream key,
///    real health panel polling `stream-health` every 5s, end-stream.
struct GoLiveView: View {
    @Environment(AppState.self) private var app
    @Environment(Router.self) private var router
    @State private var title = ""
    @State private var category: PovCategory = .founder
    @State private var access: StreamAccess = .public
    @State private var ppvPrice = "4.99"
    @State private var source: StreamSource = .chest
    @State private var slowMode = true
    @State private var replay = true
    @State private var subOnlyChat = false
    @State private var coHost = false
    @State private var showConsent = false
    private let consentKey = "golive_consent_v1"

    // Provisioning state
    @State private var provisioning = false
    @State private var provisionError: String? = nil

    // Live state
    @State private var live = false
    @State private var stream: MuxClient.CreatedLiveStream? = nil
    @State private var health: MuxClient.StreamHealth? = nil
    @State private var ending = false
    @State private var endError: String? = nil
    @State private var ended = false
    @State private var copiedKey = false
    @State private var copiedUrl = false

    enum StreamSource: String, CaseIterable { case chest, phone, desktop }

    private let ppvPrices = ["3.99", "6.99", "9.99", "14.99"]

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                if live {
                    liveView
                } else if !app.isVerified {
                    kycGate
                } else {
                    setupForm
                }
            }
            .padding(.horizontal, 22)
            .padding(.bottom, 40)
            .padding(.top, 20)
        }
        .background(Theme.bg.ignoresSafeArea())
        .navigationTitle("Go live")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showConsent) {
            consentSheet
                .presentationDetents([.medium])
                .presentationDragIndicator(.visible)
        }
        .task {
            // Start health polling when live
        }
    }

    // MARK: - KYC Gate

    private var kycGate: some View {
        VStack(spacing: 16) {
            Spacer()
            ZStack {
                Circle()
                    .fill(Theme.lime.opacity(0.12))
                    .frame(width: 66, height: 66)
                    .overlay(Circle().stroke(Theme.lime.opacity(0.3), lineWidth: 1.5))
                Image(systemName: "checkmark.shield.fill")
                    .font(.system(size: 28))
                    .foregroundStyle(Theme.lime)
            }
            Text("Verify your identity to go live")
                .font(.system(size: 22, weight: .heavy))
                .tracking(-0.8)
                .foregroundStyle(Theme.text)
                .multilineTextAlignment(.center)
            Text(app.kycStatus == "pending"
                 ? "Your verification is under review. You'll be able to go live once it's approved."
                 : app.kycStatus == "rejected"
                     ? "Your verification was rejected. Please resubmit from the creator setup."
                     : "Complete identity verification to start broadcasting live POV streams.")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Theme.textMid)
                .multilineTextAlignment(.center)
                .lineSpacing(5)
            AppButton(label: app.kycStatus == "pending" ? "View status" : "Go to verification") {
                router.push(.becomeCreator)
            }
            .frame(width: 240)
            .padding(.top, 8)
            AppButton(label: "Back", variant: .ghost, full: false) { router.pop() }
                .frame(width: 120)
            Spacer()
        }
        .padding(.horizontal, 30)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Setup form

    private var setupForm: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("Set up your live POV").microLabel(Theme.magenta, size: 11)

            // Title
            VStack(alignment: .leading, spacing: 8) {
                Text("Stream title").microLabel(Theme.textDim, size: 10)
                TextField("LIVE: closing the round, ride with me", text: $title)
                    .font(.system(size: 16, weight: .bold)).foregroundStyle(Theme.text)
                    .padding(.horizontal, 14).frame(height: 52)
                    .background(Theme.surface)
                    .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
                    .clipShape(.rect(cornerRadius: Theme.rMd))
            }

            // Camera source
            VStack(alignment: .leading, spacing: 8) {
                Text("Camera source").microLabel(Theme.textDim, size: 10)
                VStack(spacing: 8) {
                    sourceRow("camera.viewfinder", "Chest rig / action cam", "RTMP key — GoPro, Insta360, glasses cam", .chest, Theme.magenta)
                    sourceRow("iphone", "This phone (monitor + encoder)", "RTMP key shown · phone is your monitor", .phone, Theme.magenta)
                    sourceRow("desktopcomputer", "Desktop encoder", "OBS / Streamlabs with overlays", .desktop, Theme.magenta)
                }
            }

            // Category
            VStack(alignment: .leading, spacing: 8) {
                Text("Category").microLabel(Theme.textDim, size: 10)
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
                Text("Who can watch").microLabel(Theme.textDim, size: 10)
                VStack(spacing: 8) {
                    accessRow("person.3.fill", "Public", "Anyone can watch, chat, clip and share", .public, Theme.lime)
                    accessRow("person.2.fill", "Subscribers only", "Your active subs get in free", .subscribers, Theme.lime)
                    accessRow("lock.fill", "Pay-per-view event", "One-time ticket for a special POV", .ppv, Theme.cyan)
                }
            }

            // PPV price
            if access == .ppv {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Ticket price").microLabel(Theme.cyan, size: 10)
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

            // Chat & replay toggles
            VStack(alignment: .leading, spacing: 8) {
                Text("Chat & replay").microLabel(Theme.textDim, size: 10)
                VStack(spacing: 0) {
                    toggleRow("timer", "Slow mode (10s)", slowMode) { slowMode.toggle() }
                    AppDivider()
                    toggleRow("lock", "Subscriber-only chat", subOnlyChat) { subOnlyChat.toggle() }
                    AppDivider()
                    toggleRow("person.2.badge.gearshape", "Allow co-host (dual POV)", coHost) { coHost.toggle() }
                    AppDivider()
                    toggleRow("arrow.uturn.backward.circle", "Save paid replay after stream", replay) { replay.toggle() }
                }
                .background(Theme.surface)
                .clipShape(.rect(cornerRadius: Theme.rMd))
                .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
            }

            // Error
            if let provisionError {
                Text(provisionError)
                    .font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.danger)
                    .padding(14)
                    .background(Color(Theme.danger).opacity(0.1))
                    .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Color(Theme.danger).opacity(0.3), lineWidth: 1))
                    .clipShape(.rect(cornerRadius: Theme.rMd))
            }

            Spacer(minLength: 20)
            AppButton(
                label: provisioning ? "Starting stream…" : "Go live now",
                variant: .live,
                icon: provisioning ? AnyView(ProgressView().tint(.white)) : AnyView(Image(systemName: "dot.radiowaves.left.and.right").font(.system(size: 16, weight: .bold)).foregroundStyle(.white)),
                disabled: provisioning || title.isEmpty
            ) {
                gateGoLive()
            }
            Text("Streams are monitored for guideline violations. Everyone appearing on camera must be 18+ and have consented to being filmed and broadcast.")
                .font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.textDim)
                .lineSpacing(4)
        }
    }

    // MARK: - Live view (host)

    private var liveView: some View {
        VStack(spacing: 20) {
            // On-air header
            onAirCard

            if ended {
                endedCard
            } else {
                // Encoder connect card
                encoderCard

                // Health panel
                healthPanel

                if let endError {
                    Text(endError)
                        .font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.danger)
                        .padding(14)
                        .background(Color(Theme.danger).opacity(0.1))
                        .clipShape(.rect(cornerRadius: Theme.rMd))
                }

                AppButton(
                    label: ending ? "Ending…" : "End stream",
                    variant: .live,
                    icon: ending ? AnyView(ProgressView().tint(.white)) : AnyView(Image(systemName: "stop.circle.fill").font(.system(size: 16, weight: .bold)).foregroundStyle(.white)),
                    disabled: ending
                ) {
                    endStream()
                }
                Text(health?.status == "live"
                    ? "Ending the stream finalizes the Mux asset and auto-publishes a replay to your feed."
                    : "Tap end stream to finalize the broadcast and create the replay.")
                    .font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.textDim)
                    .lineSpacing(4)
            }
        }
        .task(id: stream?.streamId) {
            await startHealthPolling()
        }
    }

    private var onAirCard: some View {
        let status = health?.status ?? "connecting"
        let isLive = status == "live"
        return VStack(spacing: 10) {
            HStack {
                HStack(spacing: 5) {
                    LiveDot()
                    Text(isLive ? "ON AIR" : status.uppercased())
                        .font(.system(size: 10, weight: .heavy)).tracking(1.4).foregroundStyle(.white)
                }
                .padding(.horizontal, 9).padding(.vertical, 5)
                .background(Theme.magenta)
                .clipShape(.rect(cornerRadius: 7))

                HStack(spacing: 4) {
                    Image(systemName: "eye.fill").font(.system(size: 11, weight: .bold)).foregroundStyle(.white.opacity(0.85))
                    Text("\(health?.concurrentViewers ?? 0)")
                        .font(.system(size: 11, weight: .heavy)).foregroundStyle(.white)
                }
                .padding(.horizontal, 9).frame(height: 26)
                .background(Color.black.opacity(0.55))
                .clipShape(.rect(cornerRadius: Theme.rPill))

                Spacer()
            }
            Text(title.isEmpty ? "Untitled POV stream" : title)
                .font(.system(size: 19, weight: .heavy)).foregroundStyle(Theme.text)
                .frame(maxWidth: .infinity, alignment: .leading)
            HStack(spacing: 6) {
                Tag(label: access == .public ? "OPEN" : access == .subscribers ? "SUBS" : "PPV \(ppvPrice)",
                    color: Theme.ink, bg: access == .ppv ? Theme.cyan : Theme.lime)
                Tag(label: category.rawValue.uppercased(), color: Theme.text, bg: Color.black.opacity(0.55))
                Tag(label: source.rawValue.uppercased(), color: Theme.text, bg: Color.black.opacity(0.55))
            }
        }
        .padding(18)
        .background(
            RoundedRectangle(cornerRadius: Theme.rLg)
                .fill(Theme.surface)
                .overlay(RoundedRectangle(cornerRadius: Theme.rLg).stroke(Color(Theme.magenta).opacity(0.35), lineWidth: 1))
        )
    }

    private var encoderCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 7) {
                Image(systemName: "server.rack").font(.system(size: 15, weight: .bold)).foregroundStyle(Theme.lime)
                Text("Connect your encoder").font(.system(size: 15, weight: .heavy)).foregroundStyle(Theme.text)
            }
            Text(source == .phone
                ? "Expo Go can't push RTMP — use this key in OBS / Streamlabs / your chest rig. This phone is your monitor."
                : "Paste these into OBS, Streamlabs, or your chest rig's RTMP settings.")
                .font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.textDim)
                .lineSpacing(3)

            // RTMP URL
            VStack(alignment: .leading, spacing: 6) {
                Text("RTMP URL").microLabel(Theme.textDim, size: 9.5)
                HStack {
                    Text(stream?.rtmpIngestUrl ?? "—")
                        .font(.system(size: 12.5, weight: .bold)).foregroundStyle(Theme.text)
                        .lineLimit(1).truncationMode(.middle)
                    Spacer(minLength: 8)
                    Button {
                        copy(stream?.rtmpIngestUrl ?? "")
                    } label: {
                        Image(systemName: copiedUrl ? "checkmark" : "doc.on.doc")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(copiedUrl ? Theme.lime : Theme.text)
                    }
                }
                .padding(.horizontal, 12).padding(.vertical, 11)
                .background(Theme.bg)
                .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
                .clipShape(.rect(cornerRadius: Theme.rMd))
            }

            // Stream key
            VStack(alignment: .leading, spacing: 6) {
                Text("Stream key").microLabel(Theme.textDim, size: 9.5)
                HStack {
                    Text(stream?.rtmpStreamKey.map { String($0.prefix(8)) + "••••••••" } ?? "—")
                        .font(.system(size: 12.5, weight: .bold)).foregroundStyle(Theme.text)
                        .lineLimit(1).truncationMode(.middle)
                    Spacer(minLength: 8)
                    Button {
                        copy(stream?.rtmpStreamKey ?? "")
                    } label: {
                        Image(systemName: copiedKey ? "checkmark" : "doc.on.doc")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(copiedKey ? Theme.lime : Theme.text)
                    }
                }
                .padding(.horizontal, 12).padding(.vertical, 11)
                .background(Theme.bg)
                .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
                .clipShape(.rect(cornerRadius: Theme.rMd))
            }
            Text("Tap the copy icon to copy")
                .font(.system(size: 10.5, weight: .semibold)).foregroundStyle(Theme.textDim)
        }
        .padding(18)
        .background(Theme.surface)
        .overlay(RoundedRectangle(cornerRadius: Theme.rLg).stroke(Theme.border, lineWidth: 1))
        .clipShape(.rect(cornerRadius: Theme.rLg))
    }

    private var healthPanel: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Stream health").microLabel(Theme.lime, size: 10).padding(.leading, 14).padding(.top, 14).padding(.bottom, 8)
            healthRow("Status", health?.status == "live" ? "Live" : "Connecting", health?.status == "live")
            AppDivider()
            healthRow("Viewers", "\(health?.concurrentViewers ?? 0)", true)
            AppDivider()
            healthRow("Peak viewers", "\(health?.maxViewers ?? 0)", true)
            AppDivider()
            healthRow("Bitrate", (health?.peakBitrateKbps ?? 0) > 0 ? String(format: "%.1f mbps", Double(health?.peakBitrateKbps ?? 0) / 1000) : "—", (health?.peakBitrateKbps ?? 0) > 0)
            AppDivider()
            let elapsed = health?.elapsedSec ?? 0
            let mins = elapsed / 60, secs = elapsed % 60
            healthRow("Duration", String(format: "%02d:%02d", mins, secs), true)
            AppDivider()
            healthRow("Latency mode", health?.latencyMode ?? "low", true)
            AppDivider()
            healthRow("Dropped frames", String(format: "%.1f%%", health?.droppedFramesPct ?? 0), (health?.droppedFramesPct ?? 0) < 2)
        }
        .background(Theme.surface)
        .clipShape(.rect(cornerRadius: Theme.rMd))
        .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
    }

    private var endedCard: some View {
        VStack(spacing: 14) {
            ZStack {
                Circle().fill(Theme.lime.opacity(0.18)).frame(width: 60, height: 60)
                Image(systemName: "checkmark.circle.fill").font(.system(size: 28, weight: .bold)).foregroundStyle(Theme.lime)
            }
            .overlay(Circle().stroke(Theme.lime.opacity(0.4), lineWidth: 1).frame(width: 60, height: 60))
            Text("Stream ended").font(.system(size: 24, weight: .heavy)).foregroundStyle(Theme.text)
            Text(health?.activeAssetId != nil
                ? "Your replay is being processed and will publish to your feed shortly."
                : "The stream has ended. Your replay will publish once Mux finalizes it.")
                .font(.system(size: 14, weight: .medium)).foregroundStyle(Theme.textMid)
                .multilineTextAlignment(.center)
            HStack(spacing: 12) {
                endedStat("Peak viewers", "\(health?.maxViewers ?? 0)")
                endedStat("Duration", "\(health?.elapsedSec ?? 0)s")
            }
            AppButton(label: "Back to Studio") {
                router.popToRoot(); router.selectedTab = .studio
            }
            .padding(.top, 8)
        }
        .padding(24)
        .background(Theme.surface)
        .overlay(RoundedRectangle(cornerRadius: Theme.rLg).stroke(Theme.border, lineWidth: 1))
        .clipShape(.rect(cornerRadius: Theme.rLg))
    }

    // MARK: - Health polling

    @State private var pollTask: Task<Void, Never>?

    private func startHealthPolling() {
        pollTask?.cancel()
        guard let streamId = stream?.streamId, !ended else { return }
        pollTask = Task { @MainActor in
            while !Task.isCancelled && !ended {
                do {
                    let h = try await MuxClient.shared.getStreamHealth(streamId: streamId)
                    if !Task.isCancelled { health = h }
                } catch {
                    // Keep polling — transient errors
                }
                try? await Task.sleep(for: .seconds(5))
            }
        }
    }

    // MARK: - Actions

    private func gateGoLive() {
        if UserDefaults.standard.bool(forKey: consentKey) {
            startStream()
        } else {
            showConsent = true
        }
    }

    private func startStream() {
        provisioning = true
        provisionError = nil
        Hap.heavy()

        Task { @MainActor in
            do {
                let result = try await MuxClient.shared.createLiveStream(
                    title: title.isEmpty ? "Untitled POV stream" : title,
                    category: category.rawValue,
                    access: access.rawValue,
                    ppvPrice: access == .ppv ? Double(ppvPrice) : nil,
                    streamSource: source.rawValue,
                    replayEnabled: replay,
                    slowMode: slowMode,
                    subOnlyChat: subOnlyChat
                )
                stream = result
                live = true
                Hap.success()
            } catch {
                provisionError = error.localizedDescription
                Hap.heavy()
            }
            provisioning = false
        }
    }

    private func endStream() {
        guard let streamId = stream?.streamId else { return }
        ending = true
        endError = nil
        Hap.heavy()

        Task { @MainActor in
            do {
                _ = try await MuxClient.shared.endLiveStream(
                    streamId: streamId,
                    replayTitle: "Replay: \(title.isEmpty ? "Untitled POV stream" : title)"
                )
                pollTask?.cancel()
                ended = true
                Hap.success()
            } catch {
                endError = error.localizedDescription
            }
            ending = false
        }
    }

    private func copy(_ value: String) {
        UIPasteboard.general.string = value
        Hap.success()
    }

    // MARK: - Consent sheet

    private var consentSheet: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                ZStack {
                    Circle().fill(Theme.lime).frame(width: 48, height: 48)
                    Image(systemName: "checkmark.shield.fill")
                        .font(.system(size: 22, weight: .bold))
                        .foregroundStyle(Theme.ink)
                }
                Spacer()
            }
            Text("Before you go live")
                .font(.system(size: 22, weight: .heavy))
                .tracking(-0.6)
                .foregroundStyle(Theme.text)
            Text("Everyone appearing on camera must be 18+ and must have consented to being filmed and broadcast. POVMe is an 18+ platform. You're responsible for confirming everyone on your stream has agreed.")
                .font(.system(size: 13.5, weight: .medium))
                .foregroundStyle(Theme.textMid)
                .lineSpacing(6)
            Spacer(minLength: 0)
            AppButton(label: "I understand — start stream") {
                UserDefaults.standard.set(true, forKey: consentKey)
                Hap.success()
                showConsent = false
                startStream()
            }
            AppButton(label: "Cancel", variant: .dark) {
                showConsent = false
            }
        }
        .padding(24)
        .background(Theme.surface.ignoresSafeArea())
    }

    // MARK: - Row helpers

    private func sourceRow(_ icon: String, _ title: String, _ body: String, _ src: StreamSource, _ color: Color) -> some View {
        PressableButton(scaleTo: 0.97) { source = src } label: {
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(source == src ? color : Theme.surfaceHi).frame(width: 36, height: 36)
                    Image(systemName: icon).font(.system(size: 15, weight: .medium))
                        .foregroundStyle(source == src ? Theme.ink : Theme.textMid)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.system(size: 14, weight: .heavy)).foregroundStyle(Theme.text)
                    Text(body).font(.system(size: 11.5, weight: .semibold)).foregroundStyle(Theme.textDim)
                }
                Spacer()
                if source == src {
                    Image(systemName: "checkmark").font(.system(size: 14, weight: .bold)).foregroundStyle(color)
                }
            }
            .padding(.horizontal, 14).frame(height: 56)
            .background(source == src ? color.opacity(0.12) : Theme.surface)
            .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(source == src ? color : Theme.border, lineWidth: 1))
            .clipShape(.rect(cornerRadius: Theme.rMd))
        }
        .buttonStyle(.plain)
    }

    private func accessRow(_ icon: String, _ title: String, _ body: String, _ level: StreamAccess, _ color: Color) -> some View {
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

    private func toggleRow(_ icon: String, _ label: String, _ value: Bool, _ onChange: @escaping () -> Void) -> some View {
        Button(action: onChange) {
            HStack(spacing: 11) {
                Image(systemName: icon).font(.system(size: 16, weight: .medium)).foregroundStyle(Theme.lime)
                Text(label).font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.text)
                Spacer()
                Toggle("", isOn: Binding(get: { value }, set: { _ in onChange() }))
                    .labelsHidden()
                    .tint(Theme.lime)
            }
            .padding(.horizontal, 14).frame(height: 44)
        }
        .buttonStyle(.plain)
    }

    private func healthRow(_ label: String, _ value: String, _ ok: Bool) -> some View {
        HStack(spacing: 11) {
            Circle().fill(ok ? Theme.lime : Theme.danger).frame(width: 8, height: 8)
            Text(label).font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.text)
            Spacer()
            Text(value).font(.system(size: 12.5, weight: .heavy)).foregroundStyle(Theme.textMid)
        }
        .padding(.horizontal, 14).frame(height: 44)
    }

    private func endedStat(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(label).microLabel(Theme.textDim, size: 9.5)
            Text(value).font(.system(size: 19, weight: .heavy)).foregroundStyle(Theme.text)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Theme.bg)
        .clipShape(.rect(cornerRadius: Theme.rMd))
        .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
    }
}

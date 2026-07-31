import SwiftUI
import AVKit
import Combine

/// Server-enforced access check for a VOD episode (mirrors Expo useEpisodeAccess).
/// Calls the `episode-access` edge function which returns the video URL only if allowed.
struct EpisodeAccessResponse: Decodable {
    let allowed: Bool
    let reason: String?
    let videoUrl: String?
    let price: Double?
    let creatorId: String?
}

@MainActor
final class EpisodeAccessManager: ObservableObject {
    @Published var result: EpisodeAccessResponse?
    @Published var isLoading: Bool = false
    @Published var error: String?

    func check(episodeId: String) async {
        isLoading = true
        error = nil
        do {
            let response: EpisodeAccessResponse = try await EdgeClient.shared.call(
                "episode-access",
                body: ["episodeId": episodeId],
                as: EpisodeAccessResponse.self
            )
            result = response
        } catch {
            self.error = error.localizedDescription
            result = EpisodeAccessResponse(allowed: false, reason: "not_found", videoUrl: nil, price: nil, creatorId: nil)
        }
        isLoading = false
    }
}

/// Episode detail — video player (when server grants access) or paywall, metadata, actions, related.
struct EpisodeView: View {
    let episodeId: String
    @Environment(AppState.self) private var app
    @Environment(Router.self) private var router
    @State private var player: AVPlayer?
    @StateObject private var access = EpisodeAccessManager()

    private var episode: Episode? { Mock.episode(episodeId) }
    private var creator: Creator? { episode.flatMap { Mock.creator($0.creatorId) } }
    private var unlocked: Bool { access.result?.allowed ?? false }
    private var cat: Category { Category.by(episode?.category ?? .trader) }
    private var saved: Bool { app.savedEpisodes.contains(episodeId) }
    private var liked: Bool { app.likedEpisodes.contains(episodeId) }

    private var related: [Episode] {
        Mock.episodes.filter { $0.id != episodeId && $0.category == episode?.category }.prefix(6).map { $0 }
    }

    var body: some View {
        if let episode, let creator {
            ScrollView {
                VStack(spacing: 0) {
                    stage(episode, creator)
                    body(episode, creator)
                    if !related.isEmpty {
                        SectionHeader(kicker: "More of this life", title: "\(cat.label) POVs")
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 12) {
                                ForEach(related) { e in EpisodeTile(episode: e, width: 175) }
                            }
                            .padding(.horizontal, 18)
                        }
                    }
                }
                .padding(.bottom, 40)
            }
            .background(Theme.bg.ignoresSafeArea())
            .ignoresSafeArea(edges: .top)
            .task { await access.check(episodeId: episodeId) }
            .onChange(of: unlocked) { _, isUnlocked in
                if isUnlocked, let videoUrl = access.result?.videoUrl, !videoUrl.isEmpty {
                    setupPlayer(videoUrl)
                }
            }
            .onDisappear { player?.pause(); player = nil }
        } else {
            notFound
        }
    }

    private func stage(_ episode: Episode, _ creator: Creator) -> some View {
        ZStack {
            Color.black.frame(height: 460)
            if access.isLoading {
                ProgressView().tint(Theme.lime)
            } else if unlocked {
                if let player {
                    VideoPlayer(player: player)
                        .frame(height: 460)
                        .ignoresSafeArea()
                } else {
                    ProgressView().tint(Theme.lime)
                }
            } else {
                ZStack {
                    AsyncImage(url: URL(string: episode.thumb)) { phase in
                        switch phase {
                        case .success(let img): img.resizable().scaledToFill()
                        default: Color(Theme.surface)
                        }
                    }
                    .frame(height: 460)
                    .blur(radius: 30)
                    .overlay(
                        LinearGradient(colors: [Theme.ink.opacity(0.6), Theme.ink.opacity(0.9)], startPoint: .top, endPoint: .bottom)
                    )
                    VStack(spacing: 16) {
                        ZStack {
                            Circle().fill(Theme.lime).frame(width: 52, height: 52)
                            Image(systemName: "lock.fill")
                                .font(.system(size: 22, weight: .bold)).foregroundStyle(Theme.ink)
                        }
                        Text(episode.access == .ppv ? "Premium POV experience" : "Subscribers only")
                            .font(.system(size: 20, weight: .heavy)).tracking(-0.6).foregroundStyle(Theme.text)
                        Text(episode.access == .ppv
                             ? "Unlock this episode once for \(Fmt.moneyComma(episode.ppvPrice ?? 0)) and keep it forever."
                             : "Subscribe to @\(creator.handle) for \(Fmt.moneyComma(creator.subPrice))/mo to watch every episode.")
                            .font(.system(size: 13.5, weight: .medium))
                            .foregroundStyle(Theme.textMid)
                            .multilineTextAlignment(.center)
                            .lineSpacing(5)
                        AppButton(
                            label: episode.access == .ppv ? "Unlock for \(Fmt.moneyComma(episode.ppvPrice ?? 0))" : "Subscribe · \(Fmt.moneyComma(creator.subPrice))/mo",
                            variant: episode.access == .ppv ? .ppv : .primary
                        ) {
                            router.push(episode.access == .ppv ? .unlock(episode.id) : .subscribe(creator.id))
                        }
                        .frame(width: 280)
                        .padding(.top, 4)
                    }
                    .padding(.horizontal, 32)
                }
            }

            VStack {
                HStack {
                    PressableButton(scaleTo: 0.9) { router.pop() } label: {
                        ZStack {
                            Circle().fill(Color.black.opacity(0.55)).frame(width: 38, height: 38)
                            Image(systemName: "chevron.left")
                                .font(.system(size: 20, weight: .medium)).foregroundStyle(Theme.text)
                        }
                    }
                    .buttonStyle(.plain)
                    Spacer()
                    VStack(alignment: .trailing, spacing: 6) {
                        Tag(label: cat.label, color: Theme.ink, bg: cat.accent)
                        Tag(label: episode.chapter, color: Theme.text, bg: Color.black.opacity(0.55))
                        Tag(label: Fmt.duration(episode.durationSec), color: Theme.text, bg: Color.black.opacity(0.55))
                    }
                }
                .padding(.horizontal, 14)
                .padding(.top, 54)
                Spacer()
            }
        }
        .frame(height: 460)
    }

    private func body(_ episode: Episode, _ creator: Creator) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(episode.title)
                .font(.system(size: 23, weight: .heavy))
                .tracking(-0.8)
                .foregroundStyle(Theme.text)
                .lineSpacing(5)
            HStack(spacing: 7) {
                HStack(spacing: 4) {
                    Image(systemName: "eye").font(.system(size: 12)).foregroundStyle(Theme.textDim)
                    Text("\(Fmt.count(episode.views)) views").font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.textDim)
                }
                Text("·").font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.textDim)
                Text("\(episode.postedAt) ago").font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.textDim)
                Text("·").font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.textDim)
                Text("\(Fmt.moneyComma(episode.tips)) tipped")
                    .font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.gold)
            }
            .padding(.top, 10)

            HStack(spacing: 8) {
                actionPill("heart\(liked ? ".fill" : "")", liked ? Theme.magenta : Theme.textMid, "\(Fmt.count(episode.likes + (liked ? 1 : 0)))") {
                    app.toggleLiked(episode.id)
                }
                actionPill("bookmark\(saved ? ".fill" : "")", saved ? Theme.lime : Theme.textMid, saved ? "Saved" : "Save") {
                    app.toggleSaved(episode.id)
                }
                actionPill("sparkles", Theme.gold, "Tip") { router.push(.tip(creator.id)) }
                actionPill("square.and.arrow.up", Theme.textMid, "Share") {}
            }
            .padding(.top, 18)

            creatorCard(creator)
            Text("The episode").microLabel(Theme.lime, size: 10).padding(.top, 24)
            Text(episode.description)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Theme.textMid)
                .lineSpacing(7)
                .padding(.top, 10)

            VStack(alignment: .leading, spacing: 7) {
                Text("Identity immersion").microLabel(Theme.cyan, size: 10)
                Text("You are \(creator.name.split(separator: " ").first.map(String.init) ?? creator.name) — \(creator.identity.lowercased()) in \(creator.location). Headphones on, phone in landscape. This is your day now.")
                    .font(.system(size: 13.5, weight: .semibold))
                    .foregroundStyle(Theme.text)
                    .lineSpacing(5)
            }
            .padding(16)
            .background(Theme.cyan.opacity(0.06))
            .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.cyan.opacity(0.18), lineWidth: 1))
            .clipShape(.rect(cornerRadius: Theme.rMd))
            .padding(.top, 18)

            HStack(spacing: 10) {
                Avatar(uri: app.currentUser?.picture ?? "", size: 32)
                Text("Say something to \(creator.name.split(separator: " ").first.map(String.init) ?? creator.name)…")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.textDim)
                Spacer()
                ZStack {
                    Circle().fill(Theme.lime).frame(width: 32, height: 32)
                    Image(systemName: "paperplane.fill")
                        .font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.ink)
                }
            }
            .padding(10)
            .background(Theme.surface)
            .overlay(RoundedRectangle(cornerRadius: Theme.rPill).stroke(Theme.border, lineWidth: 1))
            .clipShape(.rect(cornerRadius: Theme.rPill))
            .padding(.top, 18)
        }
        .padding(.horizontal, 18)
        .padding(.top, 18)
    }

    private func actionPill(_ icon: String, _ color: Color, _ label: String, action: @escaping () -> Void) -> some View {
        PressableButton(scaleTo: 0.93, action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon).font(.system(size: 16, weight: .medium)).foregroundStyle(color)
                Text(label).font(.system(size: 12, weight: .heavy)).foregroundStyle(Theme.textMid)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 46)
            .background(Theme.surface)
            .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
            .clipShape(.rect(cornerRadius: Theme.rMd))
        }
        .buttonStyle(.plain)
    }

    private func creatorCard(_ creator: Creator) -> some View {
        HStack(spacing: 12) {
            PressableButton(scaleTo: 0.95) { router.push(.creator(creator.id)) } label: {
                HStack(spacing: 11) {
                    Avatar(uri: creator.avatar, size: 44, ring: true, live: creator.isLive)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(creator.name).font(.system(size: 15, weight: .heavy)).foregroundStyle(Theme.text)
                        Text("\(creator.identity) · \(Fmt.count(creator.subscribers)) living it")
                            .font(.system(size: 11.5, weight: .semibold)).foregroundStyle(Theme.textDim)
                    }
                }
            }
            .buttonStyle(.plain)
            Spacer()
            if app.isSubscribed(creator.id) {
                PressableButton(scaleTo: 0.9) { router.push(.messages) } label: {
                    ZStack {
                        Circle().fill(Theme.lime.opacity(0.12)).frame(width: 40, height: 40)
                        Image(systemName: "message.fill").font(.system(size: 15, weight: .medium)).foregroundStyle(Theme.lime)
                    }
                    .overlay(Circle().stroke(Theme.lime.opacity(0.3), lineWidth: 1))
                }
                .buttonStyle(.plain)
            } else {
                AppButton(label: "Subscribe", full: false, small: true) {
                    router.push(.subscribe(creator.id))
                }
                .frame(width: 120)
            }
        }
        .padding(14)
        .background(Theme.surface)
        .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
        .clipShape(.rect(cornerRadius: Theme.rMd))
        .padding(.top, 18)
    }

    private var notFound: some View {
        VStack(spacing: 12) {
            Text("Episode unavailable").font(.system(size: 20, weight: .heavy)).foregroundStyle(Theme.text)
            Text("This POV was removed or is under review.").font(.system(size: 14, weight: .medium)).foregroundStyle(Theme.textDim)
            AppButton(label: "Back to feed") { router.popToRoot(); router.selectedTab = .feed }
                .frame(width: 200).padding(.top, 8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.bg.ignoresSafeArea())
        .padding(.top, 100)
    }

    private func setupPlayer(_ url: String) {
        guard let u = URL(string: url) else { return }
        let p = AVPlayer(url: u)
        p.isMuted = false
        p.actionAtItemEnd = .none
        p.play()
        player = p
    }
}

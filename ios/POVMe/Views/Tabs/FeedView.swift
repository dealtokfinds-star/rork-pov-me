import SwiftUI

/// Feed tab — the home timeline. Following / Discover modes, live rail, category chips, episode feed.
struct FeedView: View {
    @Environment(AppState.self) private var app
    @Environment(Router.self) private var router
    @State private var mode: FeedMode = .discover
    @State private var category: PovCategory? = nil

    enum FeedMode { case following, discover }

    private var liveNow: [LiveStream] { Mock.streams.filter { $0.viewers > 0 } }

    private var episodes: [Episode] {
        let subIds = Set(app.activeSubs.map { $0.creatorId })
        var list: [Episode]
        if mode == .following {
            list = Mock.episodes.filter { subIds.contains($0.creatorId) }
        } else {
            list = Mock.episodes
            if !app.interests.isEmpty {
                list.sort { a, b in
                    let aMatch = app.interests.contains(a.category)
                    let bMatch = app.interests.contains(b.category)
                    return aMatch && !bMatch
                }
            }
        }
        if let category { list = list.filter { $0.category == category } }
        return list
    }

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()
            if !app.onboarded {
                Color(Theme.bg).ignoresSafeArea()
            } else {
                ScrollView {
                    VStack(spacing: 0) {
                        header
                        modeRow
                        if !liveNow.isEmpty {
                            SectionHeader(kicker: "Happening now", title: "Live POVs", action: "All live") {
                                router.selectedTab = .live
                            }
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 12) {
                                    ForEach(liveNow) { s in LiveStreamCard(stream: s) }
                                }
                                .padding(.horizontal, 14)
                            }
                        }
                        categoryRail
                        SectionHeader(
                            kicker: mode == .following ? "From your subscriptions" : "Fresh drops",
                            title: mode == .following ? "Your timeline" : "New POV episodes"
                        )
                        if episodes.isEmpty {
                            emptyState
                        } else {
                            ForEach(episodes) { e in EpisodeCard(episode: e) }
                            promoCard
                        }
                    }
                    .padding(.bottom, 110)
                }
            }
        }
    }

    private var header: some View {
        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                Wordmark(size: 24)
                Text("Today you can be anyone, \(app.displayName).")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.textDim)
            }
            Spacer()
            PressableButton(scaleTo: 0.92) { router.push(.wallet) } label: {
                HStack(spacing: 6) {
                    Image(systemName: "wallet.pass.fill").font(.system(size: 13)).foregroundStyle(Theme.lime)
                    Text(Fmt.moneyComma(app.balance))
                        .font(.system(size: 12.5, weight: .heavy))
                        .foregroundStyle(Theme.lime)
                }
                .padding(.horizontal, 12)
                .frame(height: 34)
                .background(Theme.lime.opacity(0.1))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.rPill)
                        .stroke(Theme.lime.opacity(0.28), lineWidth: 1)
                )
                .clipShape(.rect(cornerRadius: Theme.rPill))
            }
            .buttonStyle(.plain)
            iconCircle("tray.fill") { router.push(.messages) }
            iconCircle("bell.fill", hasDot: true) { router.push(.notifications) }
        }
        .padding(.horizontal, 18)
        .padding(.top, 10)
        .padding(.bottom, 14)
    }

    private func iconCircle(_ icon: String, hasDot: Bool = false, action: @escaping () -> Void) -> some View {
        PressableButton(scaleTo: 0.9, action: action) {
            ZStack {
                Image(systemName: icon)
                    .font(.system(size: 17, weight: .medium))
                    .foregroundStyle(Theme.textMid)
                if hasDot {
                    Circle()
                        .fill(Theme.magenta)
                        .frame(width: 7, height: 7)
                        .overlay(Circle().stroke(Theme.bg, lineWidth: 1.5))
                        .offset(x: 8, y: -7)
                }
            }
            .frame(width: 34, height: 34)
            .background(Theme.surface)
            .overlay(
                RoundedRectangle(cornerRadius: 17).stroke(Theme.border, lineWidth: 1)
            )
            .clipShape(.rect(cornerRadius: 17))
        }
        .buttonStyle(.plain)
    }

    private var modeRow: some View {
        HStack(spacing: 8) {
            modeTab(label: "Following", active: mode == .following, count: app.activeSubs.count) {
                mode = .following
            }
            modeTab(label: "Discover", active: mode == .discover, count: nil) {
                mode = .discover
            }
        }
        .padding(.horizontal, 18)
    }

    private func modeTab(label: String, active: Bool, count: Int?, action: @escaping () -> Void) -> some View {
        PressableButton(scaleTo: 0.95, action: action) {
            HStack(spacing: 7) {
                Text(label)
                    .font(.system(size: 14, weight: .heavy))
                    .foregroundStyle(active ? Theme.ink : Theme.textMid)
                if let count, count > 0 {
                    Text("\(count)")
                        .font(.system(size: 11, weight: .heavy))
                        .foregroundStyle(active ? Theme.ink : Theme.textMid)
                        .padding(.horizontal, 5)
                        .frame(height: 20)
                        .background(active ? Color.black.opacity(0.15) : Color.white.opacity(0.1))
                        .clipShape(.rect(cornerRadius: 10))
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 42)
            .background(active ? Theme.lime : Theme.surface)
            .overlay(
                RoundedRectangle(cornerRadius: Theme.rPill)
                    .stroke(active ? Theme.lime : Theme.border, lineWidth: 1)
            )
            .clipShape(.rect(cornerRadius: Theme.rPill))
        }
        .buttonStyle(.plain)
    }

    private var categoryRail: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                Chip(label: "All POVs", active: category == nil) { category = nil }
                ForEach(Category.all) { c in
                    Chip(label: c.label, active: category == c.id, accent: c.accent, emoji: c.emoji) {
                        category = c.id
                    }
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 22)
        }
    }

    private var emptyState: some View {
        VStack(spacing: 0) {
            EmptyState(
                title: "Your timeline is empty",
                message: "Subscribe to a creator and their POV episodes land here the moment they drop.",
                iconName: "bolt.fill",
                iconColor: Theme.lime,
                action: "Find creators"
            ) {
                router.selectedTab = .explore
            }
            SectionHeader(kicker: "Start here", title: "Most-watched lives")
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(Array(Mock.creators.prefix(6))) { c in CreatorCard(creator: c) }
                }
                .padding(.horizontal, 18)
            }
        }
    }

    private var promoCard: some View {
        let cover = Mock.creators[safe: 3]?.cover ?? ""
        return PressableButton(scaleTo: 0.98) { router.selectedTab = .explore } label: {
            ZStack(alignment: .bottomLeading) {
                Color(Theme.surface)
                    .frame(minHeight: 190)
                AsyncImage(url: URL(string: cover)) { phase in
                    switch phase {
                    case .success(let img): img.resizable().scaledToFill()
                    default: Color(Theme.surface)
                    }
                }
                .frame(minHeight: 190)
                .overlay(
                    LinearGradient(colors: [Theme.ink.opacity(0.35), Theme.ink.opacity(0.95)], startPoint: .top, endPoint: .bottom)
                )
                VStack(alignment: .leading, spacing: 8) {
                    Text("Keep going").microLabel(Theme.lime, size: 10)
                    Text("You've seen the day. Now live somebody else's.")
                        .font(.system(size: 22, weight: .heavy))
                        .tracking(-0.6)
                        .foregroundStyle(Theme.text)
                        .lineSpacing(5)
                    AppButton(label: "Explore creators", full: false, small: true) {
                        router.selectedTab = .explore
                    }
                    .frame(width: 180)
                    .padding(.top, 6)
                }
                .padding(22)
            }
            .clipShape(.rect(cornerRadius: Theme.rLg))
            .padding(14)
        }
        .buttonStyle(.plain)
    }
}

extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

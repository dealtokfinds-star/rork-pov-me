import SwiftUI

/// Creator profile — cover, avatar, bio, subscribe/tip CTAs, episodes/premium/about tabs.
struct CreatorView: View {
    let creatorId: String
    @Environment(AppState.self) private var app
    @Environment(Router.self) private var router
    @State private var tab: Tab = .episodes

    enum Tab: String, CaseIterable { case episodes, premium, about }

    private var creator: Creator? { Mock.creator(creatorId) }
    private var episodes: [Episode] { Mock.episodesByCreator(creatorId) }
    private var stream: LiveStream? { Mock.streamByCreator(creatorId) }
    private var premium: [Episode] { episodes.filter { $0.access == .ppv } }
    private var free: [Episode] { episodes.filter { $0.access == .free } }
    private var subbed: Bool { app.isSubscribed(creatorId) }
    private var tipped: Double { 0 }

    var body: some View {
        if let creator {
            ScrollView {
                VStack(spacing: 0) {
                    cover(creator)
                    headerBody(creator)
                    if creator.isLive, let stream {
                        SectionHeader(kicker: "Streaming now", title: "Live POV")
                        LiveStreamCard(stream: stream, wide: true).padding(.horizontal, 14)
                    }
                    tabRow
                    tabContent(creator)
                }
                .padding(.bottom, 40)
            }
            .background(Theme.bg.ignoresSafeArea())
            .ignoresSafeArea(edges: .top)
        } else {
            notFound
        }
    }

    private func cover(_ c: Creator) -> some View {
        ZStack(alignment: .top) {
            Color(Theme.surface).frame(height: 250)
            AsyncImage(url: URL(string: c.cover)) { phase in
                switch phase {
                case .success(let img): img.resizable().scaledToFill()
                default: Color(Theme.surface)
                }
            }
            .frame(height: 250)
            .overlay(
                LinearGradient(colors: [Theme.ink.opacity(0.45), Theme.ink.opacity(0.55), Theme.bg], startPoint: .top, endPoint: .bottom)
            )
            VStack {
                HStack {
                    PressableButton(scaleTo: 0.9) { router.pop() } label: {
                        ZStack {
                            Circle().fill(Color.black.opacity(0.5)).frame(width: 38, height: 38)
                            Image(systemName: "chevron.left").font(.system(size: 20, weight: .medium)).foregroundStyle(Theme.text)
                        }
                    }
                    .buttonStyle(.plain)
                    Spacer()
                    if c.isLive, let stream {
                        PressableButton(scaleTo: 0.9) { router.push(.live(stream.id)) } label: {
                            HStack(spacing: 6) {
                                Image(systemName: "dot.radiowaves.left.and.right").font(.system(size: 12, weight: .bold)).foregroundStyle(.white)
                                Text("WATCH LIVE").font(.system(size: 10, weight: .heavy)).tracking(1.4).foregroundStyle(.white)
                            }
                            .padding(.horizontal, 12).frame(height: 34)
                            .background(Theme.magenta)
                            .clipShape(.rect(cornerRadius: Theme.rPill))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 14)
                .padding(.top, 54)
                Spacer()
            }
        }
        .frame(height: 250)
    }

    private func headerBody(_ c: Creator) -> some View {
        VStack(spacing: 0) {
            Avatar(uri: c.avatar, size: 80, ring: true, live: c.isLive)
                .padding(.top, -46)
            HStack(spacing: 7) {
                Text(c.name)
                    .font(.system(size: 25, weight: .heavy))
                    .tracking(-0.9)
                    .foregroundStyle(Theme.text)
                if c.verified {
                    Image(systemName: "checkmark.seal.fill")
                        .font(.system(size: 19, weight: .medium))
                        .foregroundStyle(Theme.lime)
                }
            }
            .padding(.top, 12)
            Text("@\(c.handle)")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Theme.textDim)
                .padding(.top, 3)
            HStack(spacing: 6) {
                ForEach(c.categories, id: \.self) { cat in
                    let c = Category.by(cat)
                    Tag(label: "\(c.emoji) \(c.label)", color: Theme.text, bg: Color.white.opacity(0.08))
                }
            }
            .padding(.top, 12)
            Text(c.bio)
                .font(.system(size: 13.5, weight: .medium))
                .foregroundStyle(Theme.textMid)
                .multilineTextAlignment(.center)
                .lineSpacing(5)
                .padding(.top, 14)
                .padding(.horizontal, 20)
            HStack(spacing: 18) {
                metaItem("person.2.fill", "\(Fmt.count(c.subscribers)) subs")
                metaItem("mappin.and.ellipse", c.location)
                HStack(spacing: 5) {
                    Image(systemName: "star.fill").font(.system(size: 13)).foregroundStyle(Theme.gold)
                    Text(String(format: "%.1f", c.rating)).font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.textDim)
                }
            }
            .padding(.top, 14)

            if subbed {
                HStack(spacing: 10) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text("You are living this life").microLabel(Theme.lime, size: 10)
                        Text("Full feed unlocked · \(Fmt.moneyComma(c.subPrice))/mo\(tipped > 0 ? " · \(Fmt.moneyComma(tipped)) tipped" : "")")
                            .font(.system(size: 12.5, weight: .bold)).foregroundStyle(Theme.text)
                    }
                    Spacer()
                    PressableButton(scaleTo: 0.9) { router.push(.messages) } label: {
                        ZStack {
                            Circle().fill(Theme.lime.opacity(0.12)).frame(width: 42, height: 42)
                            Image(systemName: "message.fill").font(.system(size: 17, weight: .medium)).foregroundStyle(Theme.lime)
                        }
                        .overlay(Circle().stroke(Theme.lime.opacity(0.3), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    PressableButton(scaleTo: 0.9) { router.push(.tip(c.id)) } label: {
                        ZStack {
                            Circle().fill(Theme.gold.opacity(0.12)).frame(width: 42, height: 42)
                            Image(systemName: "sparkles").font(.system(size: 17, weight: .medium)).foregroundStyle(Theme.gold)
                        }
                        .overlay(Circle().stroke(Theme.gold.opacity(0.3), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
                .padding(15)
                .background(Theme.lime.opacity(0.07))
                .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.lime.opacity(0.25), lineWidth: 1))
                .clipShape(.rect(cornerRadius: Theme.rMd))
                .padding(.top, 20)
            } else {
                VStack(spacing: 10) {
                    AppButton(label: "Subscribe to live as them · \(Fmt.moneyComma(c.subPrice))/mo") {
                        router.push(.subscribe(c.id))
                    }
                    HStack(spacing: 10) {
                        AppButton(label: "Send a tip", variant: .dark, small: true) {
                            router.push(.tip(c.id))
                        }
                        AppButton(label: "\(free.count) free POVs", variant: .ghost, small: true) {
                            tab = .episodes
                        }
                    }
                }
                .padding(.top, 20)
            }
        }
    }

    private func metaItem(_ icon: String, _ text: String) -> some View {
        HStack(spacing: 5) {
            Image(systemName: icon).font(.system(size: 13)).foregroundStyle(Theme.textDim)
            Text(text).font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.textDim)
        }
    }

    private var tabRow: some View {
        HStack(spacing: 8) {
            Chip(label: "Episodes \(episodes.count)", active: tab == .episodes) { tab = .episodes }
            Chip(label: "Premium \(premium.count)", active: tab == .premium, accent: Theme.cyan) { tab = .premium }
            Chip(label: "About", active: tab == .about) { tab = .about }
        }
        .padding(.horizontal, 18)
        .padding(.top, 26)
    }

    @ViewBuilder private func tabContent(_ c: Creator) -> some View {
        switch tab {
        case .episodes:
            VStack(spacing: 30) {
                ForEach(episodes) { e in EpisodeCard(episode: e) }
            }
            .padding(.top, 20)
        case .premium:
            VStack(alignment: .leading, spacing: 0) {
                Text("One-time unlocks. Yours forever, no subscription needed.")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.textMid)
                    .lineSpacing(4)
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 168), spacing: 12)], spacing: 12) {
                    ForEach(premium) { e in EpisodeTile(episode: e, width: 168) }
                }
                .padding(.top, 16)
            }
            .padding(.horizontal, 18)
            .padding(.top, 18)
        case .about:
            VStack(alignment: .leading, spacing: 8) {
                Text("Identity").microLabel(Theme.lime, size: 10).padding(.top, 14)
                Text("\(c.identity) based in \(c.location). \(episodes.count) POV episodes filmed on chest rig and glasses cam.")
                    .font(.system(size: 13.5, weight: .medium)).foregroundStyle(Theme.textMid).lineSpacing(7)
                Text("What you get").microLabel(Theme.lime, size: 10).padding(.top, 14)
                Text("• Full POV feed, new episodes weekly\n• Chapters: work, gym, night out, travel\n• Direct messages with \(c.name.split(separator: " ").first.map(String.init) ?? c.name)\n• Early access to live streams and paid replays")
                    .font(.system(size: 13.5, weight: .medium)).foregroundStyle(Theme.textMid).lineSpacing(7)
                Text("Pricing").microLabel(Theme.lime, size: 10).padding(.top, 14)
                Text("\(Fmt.moneyComma(c.subPrice))/mo · cancel anytime · premium POVs sold separately. Creator keeps 80%.")
                    .font(.system(size: 13.5, weight: .medium)).foregroundStyle(Theme.textMid).lineSpacing(7)
                PressableButton(scaleTo: 0.98) { router.push(.guidelines) } label: {
                    Text("Report this creator or content")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Theme.textDim)
                        .underline()
                }
                .buttonStyle(.plain)
                .padding(.top, 26)
            }
            .padding(.horizontal, 20)
            .padding(.top, 22)
        }
    }

    private var notFound: some View {
        VStack(spacing: 12) {
            Text("Creator not found").font(.system(size: 22, weight: .heavy)).foregroundStyle(Theme.text)
            AppButton(label: "Back", full: false) { router.pop() }.frame(width: 120).padding(.top, 8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.bg.ignoresSafeArea())
        .padding(.top, 80)
    }
}

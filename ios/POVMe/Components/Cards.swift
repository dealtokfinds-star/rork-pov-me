import SwiftUI

// MARK: - AccessTag

struct AccessTag: View {
    let episode: Episode
    var body: some View {
        switch episode.access {
        case .free:
            Tag(label: "Free", color: Theme.ink, bg: Theme.lime)
        case .subscribers:
            Tag(label: "Subs only", color: Theme.text, bg: Color.white.opacity(0.14))
        case .ppv:
            Tag(label: "PPV \(Fmt.moneyComma(episode.ppvPrice ?? 0))", color: Theme.ink, bg: Theme.cyan)
        }
    }
}

// MARK: - EpisodeCard (large cinematic feed card)

struct EpisodeCard: View {
    let episode: Episode
    @Environment(AppState.self) private var app
    @Environment(Router.self) private var router

    private var creator: Creator? { Mock.creator(episode.creatorId) }
    private var cat: Category { Category.by(episode.category) }
    private var locked: Bool { !app.canWatch(episode) }
    private var saved: Bool { app.savedEpisodes.contains(episode.id) }
    private var liked: Bool { app.likedEpisodes.contains(episode.id) }

    var body: some View {
        VStack(spacing: 0) {
            thumbnail
            metaRow
            statsRow
        }
        .padding(.bottom, 30)
    }

    private var thumbnail: some View {
        PressableButton(scaleTo: 0.985, haptic: Hap.medium) {
            router.push(.episode(episode.id))
        } label: {
            ZStack {
                Color(Theme.surface)
                    .frame(height: 400)
                AsyncImage(url: URL(string: episode.thumb)) { phase in
                    switch phase {
                    case .success(let img): img.resizable().scaledToFill()
                    default: Color(Theme.surface)
                    }
                }
                .frame(height: 400)
                .blur(radius: locked ? 22 : 0)
                .overlay(
                    LinearGradient(
                        colors: [Theme.ink.opacity(0.55), .clear, Theme.ink.opacity(0.92)],
                        startPoint: .top, endPoint: .bottom
                    )
                )

                VStack {
                    HStack {
                        HStack(spacing: 6) {
                            Tag(label: cat.label, color: Theme.ink, bg: cat.accent)
                            Tag(label: episode.chapter, color: Theme.text, bg: Color.black.opacity(0.5))
                        }
                        Spacer()
                        Tag(label: Fmt.duration(episode.durationSec), color: Theme.text, bg: Color.black.opacity(0.55))
                    }
                    .padding(.horizontal, 14)
                    .padding(.top, 14)
                    Spacer()
                    if locked {
                        VStack(spacing: 10) {
                            HStack(spacing: 7) {
                                Image(systemName: "lock.fill")
                                    .font(.system(size: 13, weight: .bold))
                                    .foregroundStyle(Theme.ink)
                                Text(episode.access == .ppv ? "Unlock \(Fmt.moneyComma(episode.ppvPrice ?? 0))" : "Subscribers only")
                                    .font(.system(size: 14, weight: .heavy))
                                    .foregroundStyle(Theme.ink)
                            }
                            .padding(.horizontal, 16)
                            .frame(height: 40)
                            .background(Theme.lime)
                            .clipShape(.rect(cornerRadius: Theme.rPill))
                            Text("Step into this POV")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(.white.opacity(0.7))
                        }
                    } else {
                        ZStack {
                            Circle().fill(Theme.lime).frame(width: 58, height: 58)
                            Image(systemName: "play.fill")
                                .font(.system(size: 20, weight: .bold))
                                .foregroundStyle(Theme.ink)
                        }
                    }
                    Spacer()
                    HStack {
                        Text(episode.title)
                            .font(.system(size: 20, weight: .heavy))
                            .foregroundStyle(Theme.text)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                        Spacer()
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 16)
                }
            }
            .frame(height: 400)
            .clipShape(.rect(cornerRadius: Theme.rLg))
            .padding(.horizontal, 14)
        }
    }

    private var metaRow: some View {
        HStack(spacing: 10) {
            PressableButton(scaleTo: 0.95) {
                router.push(.creator(episode.creatorId))
            } label: {
                HStack(spacing: 10) {
                    Avatar(uri: creator?.avatar ?? "", size: 34, ring: true, live: creator?.isLive ?? false)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(creator?.name ?? "")
                            .font(.system(size: 14.5, weight: .heavy))
                            .foregroundStyle(Theme.text)
                            .lineLimit(1)
                        Text("\(creator?.identity ?? "") · \(episode.postedAt)")
                            .font(.system(size: 11.5, weight: .semibold))
                            .foregroundStyle(Theme.textDim)
                            .lineLimit(1)
                    }
                }
            }
            .buttonStyle(.plain)
            Spacer()
            HStack(spacing: 8) {
                actionBtn(icon: "heart\(liked ? ".fill" : "")", color: liked ? Theme.magenta : Theme.textMid) {
                    app.toggleLiked(episode.id)
                }
                actionBtn(icon: "bookmark\(saved ? ".fill" : "")", color: saved ? Theme.lime : Theme.textMid) {
                    app.toggleSaved(episode.id)
                }
                actionBtn(icon: "sparkles", color: Theme.gold, bg: Theme.gold.opacity(0.14)) {
                    router.push(.tip(episode.creatorId))
                }
            }
        }
        .padding(.horizontal, 18)
        .padding(.top, 13)
    }

    private func actionBtn(icon: String, color: Color, bg: Color = Theme.surface, action: @escaping () -> Void = {}) -> some View {
        PressableButton(scaleTo: 0.85, action: action) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(color)
                .frame(width: 34, height: 34)
                .background(bg)
                .overlay(RoundedRectangle(cornerRadius: 17).stroke(Theme.border, lineWidth: 1))
                .clipShape(.rect(cornerRadius: 17))
        }
        .buttonStyle(.plain)
    }

    private var statsRow: some View {
        HStack {
            AccessTag(episode: episode)
            Spacer()
            HStack(spacing: 12) {
                statPair("eye", Fmt.count(episode.views))
                statPair("heart", Fmt.count(episode.likes))
                statPair("sparkles", Fmt.moneyComma(episode.tips), color: Theme.gold)
            }
        }
        .padding(.horizontal, 18)
        .padding(.top, 11)
    }

    private func statPair(_ icon: String, _ text: String, color: Color = Theme.textDim) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon).font(.system(size: 12)).foregroundStyle(color)
            Text(text).font(.system(size: 11.5, weight: .bold)).foregroundStyle(Theme.textDim)
        }
    }
}

// MARK: - EpisodeTile (compact rail tile)

struct EpisodeTile: View {
    let episode: Episode
    var width: CGFloat = 190
    @Environment(AppState.self) private var app
    @Environment(Router.self) private var router

    private var creator: Creator? { Mock.creator(episode.creatorId) }
    private var locked: Bool { !app.canWatch(episode) }

    var body: some View {
        PressableButton(scaleTo: 0.96) {
            router.push(.episode(episode.id))
        } label: {
            VStack(alignment: .leading, spacing: 0) {
                ZStack(alignment: .topLeading) {
                    Color(Theme.surface)
                        .frame(width: width, height: 240)
                    AsyncImage(url: URL(string: episode.thumb)) { phase in
                        switch phase {
                        case .success(let img): img.resizable().scaledToFill()
                        default: Color(Theme.surface)
                        }
                    }
                    .frame(width: width, height: 240)
                    .blur(radius: locked ? 14 : 0)
                    .overlay(
                        LinearGradient(
                            colors: [.clear, Theme.ink.opacity(0.85)],
                            startPoint: .top, endPoint: .bottom
                        )
                    )
                    if locked {
                        if episode.access == .ppv {
                            Tag(label: Fmt.moneyComma(episode.ppvPrice ?? 0), color: Theme.ink, bg: Theme.cyan)
                                .padding(10)
                        } else {
                            ZStack {
                                Circle().fill(Color.black.opacity(0.6)).frame(width: 24, height: 24)
                                Image(systemName: "lock.fill")
                                    .font(.system(size: 11))
                                    .foregroundStyle(Theme.text)
                            }
                            .padding(10)
                        }
                    } else {
                        Tag(label: Fmt.duration(episode.durationSec), color: Theme.text, bg: Color.black.opacity(0.6))
                            .padding(10)
                    }
                }
                .frame(width: width, height: 240)
                .clipShape(.rect(cornerRadius: Theme.rMd))

                Text(episode.title)
                    .font(.system(size: 13.5, weight: .heavy))
                    .foregroundStyle(Theme.text)
                    .lineLimit(2)
                    .padding(.top, 9)
                Text("@\(creator?.handle ?? "") · \(Fmt.count(episode.views)) views")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.textDim)
                    .padding(.top, 3)
            }
            .frame(width: width, alignment: .leading)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - LiveStreamCard

struct LiveStreamCard: View {
    let stream: LiveStream
    var wide: Bool = false
    @Environment(Router.self) private var router

    private var creator: Creator? { Mock.creator(stream.creatorId) }
    private var cat: Category { Category.by(stream.category) }

    private var accessLabel: String {
        switch stream.access {
        case .public: return "Open"
        case .subscribers: return "Subs only"
        case .ppv: return "PPV \(Fmt.moneyComma(stream.ppvPrice ?? 0))"
        }
    }

    var body: some View {
        PressableButton(scaleTo: 0.97) {
            router.push(.live(stream.id))
        } label: {
            ZStack {
                Color(Theme.surface)
                    .frame(width: wide ? nil : 260, height: 330)
                AsyncImage(url: URL(string: stream.thumb)) { phase in
                    switch phase {
                    case .success(let img): img.resizable().scaledToFill()
                    default: Color(Theme.surface)
                    }
                }
                .frame(width: wide ? nil : 260, height: 330)
                .overlay(
                    LinearGradient(
                        colors: [Theme.magenta.opacity(0.18), .clear, Theme.ink.opacity(0.95)],
                        startPoint: .top, endPoint: .bottom
                    )
                )

                VStack {
                    HStack {
                        LiveBadge(viewers: stream.viewers)
                        Spacer()
                        Tag(
                            label: accessLabel,
                            color: stream.access == .ppv ? Theme.ink : Theme.text,
                            bg: stream.access == .ppv ? Theme.cyan : Color.black.opacity(0.55)
                        )
                    }
                    .padding(.horizontal, 12)
                    .padding(.top, 12)
                    Spacer()
                    VStack(alignment: .leading, spacing: 7) {
                        HStack(spacing: 8) {
                            Avatar(uri: creator?.avatar ?? "", size: 28, ring: true, live: true)
                            Text("@\(creator?.handle ?? "")")
                                .font(.system(size: 12.5, weight: .heavy))
                                .foregroundStyle(Theme.text)
                            Text(cat.emoji)
                        }
                        Text(stream.title)
                            .font(.system(size: 16, weight: .heavy))
                            .foregroundStyle(Theme.text)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                        Text("\(stream.startedMinutesAgo)m ago · \(Fmt.count(stream.viewers)) inside")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(.white.opacity(0.6))
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 14)
                    .padding(.bottom, 14)
                }
            }
            .frame(width: wide ? nil : 260, height: 330)
            .clipShape(.rect(cornerRadius: Theme.rLg))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.rLg)
                    .stroke(Theme.magenta.opacity(0.25), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - CreatorCard

struct CreatorCard: View {
    let creator: Creator
    @Environment(AppState.self) private var app
    @Environment(Router.self) private var router

    private var subbed: Bool { app.isSubscribed(creator.id) }
    private var cat: Category { Category.by(creator.categories.first ?? .trader) }

    var body: some View {
        PressableButton(scaleTo: 0.97) {
            router.push(.creator(creator.id))
        } label: {
            ZStack {
                Color(Theme.surface)
                    .frame(width: 168, height: 226)
                AsyncImage(url: URL(string: creator.cover)) { phase in
                    switch phase {
                    case .success(let img): img.resizable().scaledToFill().frame(height: 110)
                    default: Color(Theme.surface).frame(height: 110)
                    }
                }
                .frame(width: 168, height: 110)
                .clipped()
                .overlay(
                    LinearGradient(
                        colors: [.clear, Theme.surface.opacity(0.9), Theme.surface],
                        startPoint: .top, endPoint: .bottom
                    )
                )

                VStack(alignment: .leading, spacing: 3) {
                    if creator.isLive {
                        LiveBadge()
                            .padding(.top, 10)
                            .padding(.leading, 10)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    Spacer()
                    HStack(spacing: 8) {
                        Avatar(uri: creator.avatar, size: 46, ring: true, live: creator.isLive)
                        Spacer()
                    }
                    Text(creator.name)
                        .font(.system(size: 14.5, weight: .heavy))
                        .foregroundStyle(Theme.text)
                        .lineLimit(1)
                        .padding(.top, 8)
                    Text("\(cat.emoji) \(creator.identity)")
                        .font(.system(size: 11.5, weight: .semibold))
                        .foregroundStyle(Theme.textMid)
                        .lineLimit(1)
                    HStack {
                        HStack(spacing: 4) {
                            Image(systemName: "person.2.fill").font(.system(size: 11)).foregroundStyle(Theme.textDim)
                            Text(Fmt.count(creator.subscribers))
                                .font(.system(size: 11.5, weight: .bold))
                                .foregroundStyle(Theme.textDim)
                        }
                        Spacer()
                        Text(subbed ? "Subscribed" : "\(Fmt.moneyComma(creator.subPrice))/mo")
                            .font(.system(size: 11.5, weight: .heavy))
                            .foregroundStyle(subbed ? Theme.lime : Theme.textMid)
                    }
                    .padding(.top, 8)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .padding(12)
            }
            .frame(width: 168, height: 226)
            .clipShape(.rect(cornerRadius: Theme.rMd))
            .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - CreatorRow (horizontal list row)

struct CreatorRow: View {
    let creator: Creator
    var rightText: String? = nil
    var rightView: AnyView? = nil
    @Environment(Router.self) private var router

    var body: some View {
        PressableButton(scaleTo: 0.98) {
            router.push(.creator(creator.id))
        } label: {
            HStack(spacing: 12) {
                Avatar(uri: creator.avatar, size: 48, ring: true, live: creator.isLive)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(creator.name)
                            .font(.system(size: 15, weight: .heavy))
                            .foregroundStyle(Theme.text)
                            .lineLimit(1)
                        if creator.isLive {
                            Image(systemName: "dot.radiowaves.left.and.right")
                                .font(.system(size: 12))
                                .foregroundStyle(Theme.magenta)
                        }
                    }
                    Text("@\(creator.handle) · \(creator.location)")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.textDim)
                        .lineLimit(1)
                }
                Spacer()
                if let rightView { rightView }
                else if let rightText {
                    Text(rightText)
                        .font(.system(size: 12.5, weight: .heavy))
                        .foregroundStyle(Theme.lime)
                }
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 11)
        }
        .buttonStyle(.plain)
    }
}

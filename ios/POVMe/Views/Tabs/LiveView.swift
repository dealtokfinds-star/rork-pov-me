import SwiftUI

/// Live tab — featured live stream, channels grid, top clips, scheduled POVs, creator promo.
struct LiveView: View {
    @Environment(AppState.self) private var app
    @Environment(Router.self) private var router
    @State private var category: PovCategory? = nil

    private var streams: [LiveStream] {
        category == nil ? Mock.streams : Mock.streams.filter { $0.category == category }
    }
    private var featured: LiveStream? { streams.first }
    private var totalViewers: Int { Mock.streams.reduce(0) { $0 + $1.viewers } }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                header
                if let featured { featuredCard(featured) }
                categoryRail
                SectionHeader(kicker: "Browse live", title: "All channels")
                VStack(spacing: 14) {
                    ForEach(streams) { s in LiveStreamCard(stream: s, wide: true) }
                }
                .padding(.horizontal, 14)

                SectionHeader(kicker: "Fan-made", title: "Top clips", action: "Clip guide") {
                    router.push(.guidelines)
                }
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(Mock.clips) { clip in
                            if let c = Mock.creator(clip.creatorId) {
                                clipCard(clip, c)
                            }
                        }
                    }
                    .padding(.horizontal, 18)
                }

                SectionHeader(kicker: "Set a reminder", title: "Scheduled POVs")
                VStack(spacing: 0) {
                    ForEach(Mock.scheduled) { item in
                        if let c = Mock.creator(item.creatorId) {
                            PressableButton(scaleTo: 0.98) { router.push(.creator(item.creatorId)) } label: {
                                HStack(spacing: 12) {
                                    HStack(spacing: 5) {
                                        Image(systemName: "calendar").font(.system(size: 13)).foregroundStyle(Theme.lime)
                                        Text(item.when)
                                            .font(.system(size: 11.5, weight: .heavy))
                                            .foregroundStyle(Theme.lime)
                                    }
                                    .padding(.horizontal, 9).padding(.vertical, 6)
                                    .background(Theme.lime.opacity(0.1))
                                    .clipShape(.rect(cornerRadius: 8))
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(item.title)
                                            .font(.system(size: 13.5, weight: .heavy))
                                            .foregroundStyle(Theme.text)
                                            .lineLimit(1)
                                        Text("@\(c.handle) · \(item.access)")
                                            .font(.system(size: 11.5, weight: .semibold))
                                            .foregroundStyle(Theme.textDim)
                                    }
                                    Spacer()
                                }
                                .padding(14)
                            }
                            .buttonStyle(.plain)
                            AppDivider().padding(.leading, 14)
                        }
                    }
                }
                .padding(.horizontal, 18)
                .background(Theme.surface)
                .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
                .clipShape(.rect(cornerRadius: Theme.rMd))
                .padding(.horizontal, 18)

                creatorPromo
            }
            .padding(.bottom, 110)
        }
        .background(Theme.bg.ignoresSafeArea())
    }

    private var header: some View {
        HStack(alignment: .bottom, spacing: 12) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 9) {
                    LiveBadge()
                    Text("\(Fmt.count(totalViewers)) watching now")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Theme.textMid)
                }
                Text("Live right now")
                    .font(.system(size: 30, weight: .heavy))
                    .tracking(-1)
                    .foregroundStyle(Theme.text)
            }
            Spacer()
            PressableButton(scaleTo: 0.94) {
                router.push(app.isCreator ? .golive : .becomeCreator)
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "dot.radiowaves.left.and.right").font(.system(size: 14)).foregroundStyle(.white)
                    Text("Go live").font(.system(size: 13.5, weight: .heavy)).foregroundStyle(.white)
                }
                .padding(.horizontal, 15).frame(height: 40)
                .background(Theme.magenta)
                .clipShape(.rect(cornerRadius: Theme.rPill))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 18)
        .padding(.top, 12)
        .padding(.bottom, 16)
    }

    private func featuredCard(_ s: LiveStream) -> some View {
        let creator = Mock.creator(s.creatorId)
        let cat = Category.by(s.category)
        return PressableButton(scaleTo: 0.985) { router.push(.live(s.id)) } label: {
            ZStack(alignment: .bottom) {
                Color(Theme.surface).frame(height: 430)
                AsyncImage(url: URL(string: s.thumb)) { phase in
                    switch phase {
                    case .success(let img): img.resizable().scaledToFill()
                    default: Color(Theme.surface)
                    }
                }
                .frame(height: 430)
                .overlay(
                    LinearGradient(
                        colors: [Theme.magenta.opacity(0.25), Theme.ink.opacity(0.35), Theme.ink.opacity(0.96)],
                        startPoint: .top, endPoint: .bottom
                    )
                )
                VStack {
                    HStack {
                        LiveBadge(viewers: s.viewers)
                        Spacer()
                        Tag(
                            label: s.access == .ppv ? "PPV \(Fmt.moneyComma(s.ppvPrice ?? 0))" : s.access == .subscribers ? "Subs only" : "Open to all",
                            color: s.access == .ppv ? Theme.ink : Theme.text,
                            bg: s.access == .ppv ? Theme.cyan : Color.black.opacity(0.55)
                        )
                    }
                    .padding(.horizontal, 14).padding(.top, 14)
                    Spacer()
                    VStack(alignment: .leading, spacing: 10) {
                        HStack(spacing: 10) {
                            Avatar(uri: creator?.avatar ?? "", size: 38, ring: true, live: true)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(creator?.name ?? "")
                                    .font(.system(size: 15, weight: .heavy)).foregroundStyle(Theme.text)
                                Text("\(cat.emoji) \(creator?.identity ?? "")")
                                    .font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.textMid)
                            }
                        }
                        Text(s.title)
                            .font(.system(size: 22, weight: .heavy))
                            .tracking(-0.7)
                            .foregroundStyle(Theme.text)
                            .lineSpacing(5)
                        AppButton(label: "Enter the POV", variant: .live) {
                            router.push(.live(s.id))
                        }
                        .padding(.top, 2)
                    }
                    .padding(18)
                }
            }
            .frame(height: 430)
            .clipShape(.rect(cornerRadius: Theme.rLg))
            .padding(.horizontal, 14)
        }
        .buttonStyle(.plain)
    }

    private var categoryRail: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                Chip(label: "All", active: category == nil) { category = nil }
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

    private func clipCard(_ clip: Mock.Clip, _ c: Creator) -> some View {
        PressableButton(scaleTo: 0.96) { router.push(.creator(c.id)) } label: {
            ZStack(alignment: .bottom) {
                Color(Theme.surface)
                    .frame(width: 140, height: 210)
                AsyncImage(url: URL(string: c.cover)) { phase in
                    switch phase {
                    case .success(let img): img.resizable().scaledToFill()
                    default: Color(Theme.surface)
                    }
                }
                .frame(width: 140, height: 210)
                .overlay(
                    LinearGradient(colors: [.clear, Theme.ink.opacity(0.95)], startPoint: .top, endPoint: .bottom)
                )
                VStack(alignment: .leading, spacing: 5) {
                    Text(clip.label)
                        .font(.system(size: 12.5, weight: .heavy))
                        .foregroundStyle(Theme.text)
                        .lineLimit(2)
                        .lineSpacing(4)
                    HStack(spacing: 4) {
                        Image(systemName: "person.2.fill").font(.system(size: 10)).foregroundStyle(Theme.textDim)
                        Text(Fmt.count(clip.views))
                            .font(.system(size: 10.5, weight: .bold))
                            .foregroundStyle(Theme.textDim)
                    }
                }
                .padding(11)
            }
            .frame(width: 140, height: 210)
            .clipShape(.rect(cornerRadius: Theme.rMd))
        }
        .buttonStyle(.plain)
    }

    private var creatorPromo: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("For creators").microLabel(Theme.magenta, size: 10)
            Text("Stream from a chest rig, phone, or desktop.")
                .font(.system(size: 20, weight: .heavy))
                .tracking(-0.6)
                .foregroundStyle(Theme.text)
                .lineSpacing(5)
            Text("Choose public, subscriber-only, or pay-per-view before you go live. Chat moderation, slow mode, co-hosts, paid replays, and live earnings — all built in. You keep 80%.")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Theme.textMid)
                .lineSpacing(6)
            AppButton(label: app.isCreator ? "Open the live console" : "Start earning on povme") {
                router.push(app.isCreator ? .golive : .becomeCreator)
            }
            .padding(.top, 7)
            HStack {
                Text("\(Mock.creators.count) creators live weekly").microLabel(Theme.textDim, size: 9.5)
                Spacer()
                Text("80/20 split").microLabel(Theme.textDim, size: 9.5)
            }
            .padding(.top, 5)
        }
        .padding(22)
        .background(Theme.surface)
        .overlay(RoundedRectangle(cornerRadius: Theme.rLg).stroke(Theme.magenta.opacity(0.28), lineWidth: 1))
        .clipShape(.rect(cornerRadius: Theme.rLg))
        .padding(18)
        .padding(.top, 10)
    }
}

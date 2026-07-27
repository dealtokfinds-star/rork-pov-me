import SwiftUI

/// Studio tab — creator dashboard with balance, stats, quick actions, episode vault.
/// Shows a pitch hero for non-creators.
struct StudioView: View {
    @Environment(AppState.self) private var app
    @Environment(Router.self) private var router
    @State private var filter: StudioEpisode.StudioStatus? = nil

    private var list: [StudioEpisode] {
        filter == nil ? app.studio : app.studio.filter { $0.status == filter }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                if !app.isCreator {
                    pitchHero
                    SectionHeader(kicker: "What you get", title: "Everything to run the business")
                    featureGrid
                    splitCard
                } else {
                    creatorDashboard
                }
            }
            .padding(.bottom, 110)
        }
        .background(Theme.bg.ignoresSafeArea())
    }

    // MARK: - Pitch (non-creator)

    private var pitchHero: some View {
        ZStack(alignment: .bottomLeading) {
            Color(Theme.bg)
                .frame(minHeight: 480)
            AsyncImage(url: URL(string: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=900&q=80")) { phase in
                switch phase {
                case .success(let img): img.resizable().scaledToFill()
                default: Color(Theme.surface)
                }
            }
            .frame(minHeight: 480)
            .overlay(
                LinearGradient(
                    colors: [Theme.ink.opacity(0.45), Theme.ink.opacity(0.9), Theme.bg],
                    startPoint: .top, endPoint: .bottom
                )
            )
            VStack(alignment: .leading, spacing: 0) {
                Text("Creator studio").microLabel(Theme.lime, size: 11).padding(.bottom, 10)
                Text("Turn your day into a series people pay to live.")
                    .font(.system(size: 32, weight: .heavy))
                    .tracking(-1.2)
                    .foregroundStyle(Theme.text)
                    .lineSpacing(5)
                Text("Strap on a chest rig. Upload the raw day. Set your price. Keep 80% of every subscription, tip, PPV unlock, and live gift.")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Theme.textMid)
                    .lineSpacing(7)
                    .padding(.top, 12)
                AppButton(label: "Become a creator") {
                    router.push(.becomeCreator)
                }
                .padding(.top, 20)
            }
            .padding(.horizontal, 22)
            .padding(.bottom, 32)
        }
        .padding(.top, 40)
    }

    private var featureGrid: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 168), spacing: 10)], spacing: 10) {
            ForEach(features, id: \.title) { f in
                VStack(alignment: .leading, spacing: 7) {
                    Image(systemName: f.icon)
                        .font(.system(size: 18, weight: .medium))
                        .foregroundStyle(f.color)
                    Text(f.title)
                        .font(.system(size: 14, weight: .heavy))
                        .foregroundStyle(Theme.text)
                    Text(f.body)
                        .font(.system(size: 11.5, weight: .semibold))
                        .foregroundStyle(Theme.textDim)
                        .lineSpacing(4)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(15)
                .background(Theme.surface)
                .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
                .clipShape(.rect(cornerRadius: Theme.rMd))
            }
        }
        .padding(.horizontal, 18)
    }

    private var features: [(icon: String, color: Color, title: String, body: String)] {
        [
            ("dollarsign.circle.fill", Theme.lime, "Subscriptions", "$4.99–$49.99/mo, you set it"),
            ("lock.fill", Theme.cyan, "PPV episodes", "One-time unlocks & bundles"),
            ("dot.radiowaves.left.and.right", Theme.magenta, "Live POV", "Public, subs-only, or paid"),
            ("sparkles", Theme.gold, "Tips & gifts", "On posts, DMs, and live"),
            ("chart.bar.fill", Theme.lime, "Analytics", "Retention, LTV, top episodes"),
            ("banknote.fill", Theme.success, "Fast payouts", "Weekly, KYC verified"),
        ]
    }

    private var splitCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("The split").microLabel(Theme.lime, size: 10)
            HStack(alignment: .bottom, spacing: 8) {
                Text("80%").font(.system(size: 44, weight: .heavy)).tracking(-2).foregroundStyle(Theme.text)
                Text("you keep")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.textMid)
                    .padding(.bottom, 8)
            }
            ProgressBar(progress: 0.8)
            Text("povme takes 20% to cover hosting, video processing, payments, moderation, and support. No upload fees, no minimums.")
                .font(.system(size: 12.5, weight: .medium))
                .foregroundStyle(Theme.textDim)
                .lineSpacing(6)
        }
        .padding(20)
        .background(Theme.surface)
        .overlay(RoundedRectangle(cornerRadius: Theme.rLg).stroke(Theme.border, lineWidth: 1))
        .clipShape(.rect(cornerRadius: Theme.rLg))
        .padding(18)
    }

    // MARK: - Dashboard (creator)

    private var creatorDashboard: some View {
        VStack(spacing: 0) {
            HStack(alignment: .bottom) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Creator studio").microLabel(Theme.lime, size: 10)
                    Text("@\(app.handle)")
                        .font(.system(size: 28, weight: .heavy))
                        .tracking(-1)
                        .foregroundStyle(Theme.text)
                }
                Spacer()
                PressableButton(scaleTo: 0.93) { router.push(.upload) } label: {
                    ZStack {
                        Circle().fill(Theme.lime).frame(width: 44, height: 44)
                        Image(systemName: "plus")
                            .font(.system(size: 20, weight: .bold))
                            .foregroundStyle(Theme.ink)
                    }
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 18)
            .padding(.top, 12)
            .padding(.bottom, 16)

            balanceCard
            HStack(spacing: 10) {
                StatTile(label: "Subscribers", value: Fmt.count(app.creatorStats.subs), sub: "+42 this week")
                StatTile(label: "PPV unlocks", value: "\(app.creatorStats.ppvUnlocks)", sub: "last 30 days", accent: Theme.cyan)
            }
            .padding(.horizontal, 18)
            .padding(.top, 10)
            HStack(spacing: 10) {
                StatTile(label: "Tips", value: Fmt.moneyComma(app.creatorStats.tips), sub: "this month", accent: Theme.gold)
                StatTile(label: "Retention", value: "\(Int(app.creatorStats.retention * 100))%", sub: "30-day", accent: Theme.magenta)
            }
            .padding(.horizontal, 18)
            .padding(.top, 10)

            HStack(spacing: 8) {
                quickAction("dot.radiowaves.left.and.right", Theme.magenta, "Go live") { router.push(.golive) }
                quickAction("plus", Theme.lime, "Upload") { router.push(.upload) }
                quickAction("banknote.fill", Theme.success, "Payouts") { router.push(.earnings) }
                quickAction("shield.fill", Theme.cyan, "Safety") { router.push(.admin) }
            }
            .padding(.horizontal, 18)
            .padding(.top, 14)

            HStack {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Your subscription price").microLabel(Theme.textDim, size: 10)
                    Text("\(Fmt.moneyComma(app.creatorPrice))/mo")
                        .font(.system(size: 20, weight: .heavy))
                        .foregroundStyle(Theme.text)
                    Text("Sweet spot for your niche: $9.99–$14.99")
                        .font(.system(size: 11.5, weight: .semibold))
                        .foregroundStyle(Theme.textDim)
                }
                Spacer()
                AppButton(label: "Edit", variant: .dark, full: false, small: true) {
                    router.push(.settings)
                }
                .frame(width: 80)
            }
            .padding(16)
            .background(Theme.surface)
            .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
            .clipShape(.rect(cornerRadius: Theme.rMd))
            .padding(.horizontal, 18)
            .padding(.top, 14)

            SectionHeader(kicker: "My episodes", title: "\(app.studio.count) in the vault")
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    filterChip("All", active: filter == nil) { filter = nil }
                    ForEach(StudioEpisode.StudioStatus.allCases, id: \.self) { st in
                        filterChip(st.rawValue.capitalized, active: filter == st) { filter = st }
                    }
                }
                .padding(.horizontal, 18)
                .padding(.bottom, 6)
            }

            if list.isEmpty {
                EmptyState(
                    title: "Nothing here yet",
                    message: "Upload a POV episode or schedule one for later — your vault keeps everything.",
                    iconName: "square.and.pencil",
                    action: "New episode"
                ) { router.push(.upload) }
            } else {
                VStack(spacing: 10) {
                    ForEach(list) { ep in studioRow(ep) }
                }
                .padding(.horizontal, 18)
                .padding(.top, 14)
            }

            PressableButton(scaleTo: 0.98) { router.push(.guidelines) } label: {
                HStack(spacing: 10) {
                    Image(systemName: "shield.fill").font(.system(size: 16)).foregroundStyle(Theme.cyan)
                    Text("Content guidelines & payout compliance")
                        .font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.text)
                    Spacer()
                    Image(systemName: "chevron.right").font(.system(size: 14)).foregroundStyle(Theme.textDim)
                }
                .padding(15)
                .background(Theme.cyan.opacity(0.07))
                .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.cyan.opacity(0.2), lineWidth: 1))
                .clipShape(.rect(cornerRadius: Theme.rMd))
            }
            .buttonStyle(.plain)
            .padding(18)
        }
    }

    private var balanceCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Available to withdraw").microLabel(Theme.lime, size: 10)
            Text(Fmt.moneyComma(app.creatorStats.net))
                .font(.system(size: 40, weight: .heavy))
                .tracking(-1.8)
                .foregroundStyle(Theme.text)
                .padding(.top, 8)
            HStack(spacing: 4) {
                Image(systemName: "arrow.trending.up").font(.system(size: 12)).foregroundStyle(Theme.lime)
                Text("\(Fmt.moneyComma(app.creatorStats.gross)) gross · 80% share")
                    .font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.textMid)
            }
            .padding(.top, 6)
            HStack(spacing: 10) {
                AppButton(label: "Withdraw", full: false, small: true) { router.push(.earnings) }
                    .frame(width: 130)
                AppButton(label: "Analytics", variant: .dark, full: false, small: true) { router.push(.analytics) }
                    .frame(width: 130)
            }
            .padding(.top, 18)
        }
        .padding(20)
        .background(
            ZStack {
                LinearGradient(colors: [Theme.lime.opacity(0.16), Theme.surface.opacity(0.2)], startPoint: .topLeading, endPoint: .bottomTrailing)
                Theme.surface
            }
        )
        .overlay(RoundedRectangle(cornerRadius: Theme.rLg).stroke(Theme.lime.opacity(0.24), lineWidth: 1))
        .clipShape(.rect(cornerRadius: Theme.rLg))
        .padding(.horizontal, 18)
    }

    private func quickAction(_ icon: String, _ color: Color, _ label: String, action: @escaping () -> Void) -> some View {
        PressableButton(scaleTo: 0.94, action: action) {
            VStack(spacing: 7) {
                Image(systemName: icon).font(.system(size: 17, weight: .medium)).foregroundStyle(color)
                Text(label).font(.system(size: 11.5, weight: .heavy)).foregroundStyle(Theme.textMid)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 74)
            .background(Theme.surface)
            .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
            .clipShape(.rect(cornerRadius: Theme.rMd))
        }
        .buttonStyle(.plain)
    }

    private func filterChip(_ label: String, active: Bool, action: @escaping () -> Void) -> some View {
        Chip(label: label, active: active, action: action)
    }

    private func studioRow(_ ep: StudioEpisode) -> some View {
        HStack(spacing: 12) {
            AsyncImage(url: URL(string: ep.thumb)) { phase in
                switch phase {
                case .success(let img): img.resizable().scaledToFill()
                default: Color(Theme.surfaceHi)
                }
            }
            .frame(width: 74, height: 74)
            .clipShape(.rect(cornerRadius: 12))

            VStack(alignment: .leading, spacing: 7) {
                Text(ep.title)
                    .font(.system(size: 13.5, weight: .heavy))
                    .foregroundStyle(Theme.text)
                    .lineLimit(2)
                    .lineSpacing(4)
                HStack(spacing: 6) {
                    if ep.status == .published {
                        Tag(label: "Published", color: Theme.ink, bg: Theme.lime)
                    } else if ep.status == .scheduled {
                        Tag(label: "Scheduled · \(ep.postedAt)", color: Theme.ink, bg: Theme.gold)
                    } else {
                        Tag(label: "Draft", color: Theme.textMid, bg: Color.white.opacity(0.1))
                    }
                    Tag(
                        label: ep.access == .ppv ? "PPV \(Fmt.moneyComma(ep.ppvPrice ?? 0))" : ep.access == .free ? "Free" : "Subs",
                        color: ep.access == .ppv ? Theme.ink : Theme.textMid,
                        bg: ep.access == .ppv ? Theme.cyan : Color.white.opacity(0.07)
                    )
                }
                HStack(spacing: 12) {
                    HStack(spacing: 4) {
                        Image(systemName: "person.2.fill").font(.system(size: 11)).foregroundStyle(Theme.textDim)
                        Text(Fmt.count(ep.views)).font(.system(size: 11.5, weight: .heavy)).foregroundStyle(Theme.textDim)
                    }
                    Text(Fmt.moneyComma(ep.earned))
                        .font(.system(size: 11.5, weight: .heavy)).foregroundStyle(Theme.lime)
                }
            }
            Spacer()
            PressableButton(scaleTo: 0.85) { app.deleteStudioEpisode(ep.id) } label: {
                ZStack {
                    Image(systemName: "trash")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(Theme.textDim)
                }
                .frame(width: 32, height: 32)
                .background(Theme.surfaceHi)
                .clipShape(.rect(cornerRadius: 16))
            }
            .buttonStyle(.plain)
        }
        .padding(12)
        .background(Theme.surface)
        .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
        .clipShape(.rect(cornerRadius: Theme.rMd))
    }
}

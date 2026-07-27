import SwiftUI

/// Profile tab — user's cover, wallet card, stats, subscriptions rail, saved, settings menu, sign out.
struct ProfileView: View {
    @Environment(AppState.self) private var app
    @Environment(Router.self) private var router

    private var profileName: String { app.currentUser?.name ?? app.displayName }
    private var profileHandle: String { app.currentUser?.email.split(separator: "@").first.map(String.init) ?? app.handle }
    private var profileAvatar: String { app.currentUser?.picture ?? "https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?auto=format&fit=crop&w=300&q=80" }

    private var saved: [Episode] { Mock.episodes.filter { app.savedEpisodes.contains($0.id) } }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                cover
                walletCard
                HStack(spacing: 10) {
                    StatTile(label: "Subscribed", value: "\(app.activeSubs.count)", sub: "active creators")
                    StatTile(label: "Saved", value: "\(app.savedEpisodes.count)", sub: "POV episodes", accent: Theme.cyan)
                    StatTile(label: "Liked", value: "\(app.likedEpisodes.count)", sub: "all time", accent: Theme.magenta)
                }
                .padding(.horizontal, 18)
                .padding(.top, 12)

                SectionHeader(kicker: "Your lives", title: "Subscriptions", action: "Manage") {
                    router.push(.subscriptions)
                }
                if app.activeSubs.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("You're not living anyone else's life yet. Subscribe to start.")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Theme.textDim)
                            .lineSpacing(4)
                        AppButton(label: "Explore creators", full: false, small: true) {
                            router.selectedTab = .explore
                        }
                        .frame(width: 180)
                    }
                    .padding(.horizontal, 18)
                } else {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 12) {
                            ForEach(app.activeSubs) { sub in
                                if let c = Mock.creator(sub.creatorId) {
                                    subCard(sub, c)
                                }
                            }
                        }
                        .padding(.horizontal, 18)
                    }
                }

                if !saved.isEmpty {
                    SectionHeader(kicker: "Watch later", title: "Saved POVs", action: "See all") {
                        router.push(.saved)
                    }
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 12) {
                            ForEach(saved) { e in EpisodeTile(episode: e, width: 170) }
                        }
                        .padding(.horizontal, 18)
                    }
                }

                SectionHeader(kicker: "Account", title: "Settings")
                VStack(spacing: 0) {
                    menuRow("wallet.pass.fill", Theme.lime, "Wallet & payment methods") { router.push(.wallet) }
                    AppDivider().padding(.leading, 58)
                    menuRow("creditcard.fill", Theme.textMid, "Subscriptions & billing") { router.push(.subscriptions) }
                    AppDivider().padding(.leading, 58)
                    menuRow("bookmark.fill", Theme.textMid, "Saved POVs") { router.push(.saved) }
                    AppDivider().padding(.leading, 58)
                    menuRow("tray.fill", Theme.textMid, "Messages") { router.push(.messages) }
                    AppDivider().padding(.leading, 58)
                    menuRow("bell.fill", Theme.textMid, "Notifications") { router.push(.notifications) }
                    AppDivider().padding(.leading, 58)
                    menuRow("shield.fill", Theme.cyan, "Content guidelines") { router.push(.guidelines) }
                    AppDivider().padding(.leading, 58)
                    menuRow("person.2.fill", Theme.textMid, "Trust & safety center") { router.push(.admin) }
                    AppDivider().padding(.leading, 58)
                    menuRow("sparkles", Theme.gold, "Preferences") { router.push(.settings) }
                }
                .padding(.horizontal, 18)
                .background(Theme.surface)
                .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
                .clipShape(.rect(cornerRadius: Theme.rMd))
                .padding(.horizontal, 18)

                if !app.isCreator {
                    PressableButton(scaleTo: 0.99) { router.push(.becomeCreator) } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "dot.radiowaves.left.and.right")
                                .font(.system(size: 18, weight: .medium)).foregroundStyle(Theme.magenta)
                            VStack(alignment: .leading, spacing: 3) {
                                Text("Film your life instead")
                                    .font(.system(size: 14.5, weight: .heavy)).foregroundStyle(Theme.text)
                                Text("Keep 80% of subs, tips, PPV, and live gifts.")
                                    .font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.textMid)
                            }
                            Spacer()
                            Image(systemName: "chevron.right").font(.system(size: 18)).foregroundStyle(Theme.textDim)
                        }
                        .padding(16)
                        .background(Theme.magenta.opacity(0.08))
                        .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.magenta.opacity(0.25), lineWidth: 1))
                        .clipShape(.rect(cornerRadius: Theme.rMd))
                    }
                    .buttonStyle(.plain)
                    .padding(18)
                }

                PressableButton(scaleTo: 0.99, haptic: Hap.medium) { app.signOut() } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "arrow.right.square.fill")
                            .font(.system(size: 16, weight: .medium)).foregroundStyle(Theme.danger)
                        Text("Sign out")
                            .font(.system(size: 13.5, weight: .heavy)).foregroundStyle(Theme.danger)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 15)
                    .background(Color.clear)
                    .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.danger.opacity(0.25), lineWidth: 1))
                    .clipShape(.rect(cornerRadius: Theme.rMd))
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 18)

                Text("povme · \(Mock.creators.count) verified creators · 18+ platform · 80/20 creator split")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.textDim)
                    .multilineTextAlignment(.center)
                    .lineSpacing(5)
                    .padding(.top, 22)
                    .padding(.horizontal, 40)
            }
            .padding(.bottom, 110)
        }
        .background(Theme.bg.ignoresSafeArea())
    }

    private var cover: some View {
        ZStack(alignment: .bottom) {
            Color(Theme.surface).frame(height: 300)
            AsyncImage(url: URL(string: "https://images.unsplash.com/photo-1505761671935-60b3a7427bad?auto=format&fit=crop&w=900&q=80")) { phase in
                switch phase {
                case .success(let img): img.resizable().scaledToFill()
                default: Color(Theme.surface)
                }
            }
            .frame(height: 300)
            .overlay(
                LinearGradient(colors: [Theme.ink.opacity(0.5), Theme.ink.opacity(0.85), Theme.bg], startPoint: .top, endPoint: .bottom)
            )
            VStack(spacing: 0) {
                Avatar(uri: profileAvatar, size: 74, ring: true)
                Text(profileName)
                    .font(.system(size: 24, weight: .heavy))
                    .tracking(-0.8)
                    .foregroundStyle(Theme.text)
                    .padding(.top, 12)
                Text("@\(profileHandle)")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.textDim)
                    .padding(.top, 3)
                HStack(spacing: 6) {
                    if app.isCreator { Tag(label: "Creator", color: Theme.ink, bg: Theme.lime) }
                    Tag(label: "\(app.activeSubs.count) lives subscribed", color: Theme.text, bg: Color.white.opacity(0.1))
                    Tag(label: "\(app.unlockedEpisodes.count) POVs unlocked", color: Theme.cyan, bg: Theme.cyan.opacity(0.12))
                }
                .padding(.top, 14)
            }
            .padding(.bottom, 22)
        }
        .frame(height: 300)
    }

    private var walletCard: some View {
        HStack {
            VStack(alignment: .leading, spacing: 0) {
                Text("povme wallet").microLabel(Theme.lime, size: 10)
                Text(Fmt.moneyComma(app.balance))
                    .font(.system(size: 28, weight: .heavy))
                    .tracking(-1.2)
                    .foregroundStyle(Theme.text)
                    .padding(.top, 6)
                Text("\(Fmt.moneyComma(app.monthlySpend))/mo in subs · \(Fmt.moneyComma(app.totalSpent)) lifetime")
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(Theme.textDim)
                    .padding(.top, 4)
            }
            Spacer()
            AppButton(label: "Top up", full: false, small: true) { router.push(.wallet) }
                .frame(width: 100)
        }
        .padding(18)
        .background(Theme.surface)
        .overlay(RoundedRectangle(cornerRadius: Theme.rLg).stroke(Theme.lime.opacity(0.2), lineWidth: 1))
        .clipShape(.rect(cornerRadius: Theme.rLg))
        .padding(.horizontal, 18)
    }

    private func subCard(_ sub: Subscription, _ c: Creator) -> some View {
        PressableButton(scaleTo: 0.95) { router.push(.creator(c.id)) } label: {
            VStack(spacing: 3) {
                Avatar(uri: c.avatar, size: 52, ring: true, live: c.isLive)
                Text(c.name)
                    .font(.system(size: 13, weight: .heavy)).foregroundStyle(Theme.text)
                    .lineLimit(1).padding(.top, 8)
                Text("\(Fmt.moneyComma(sub.price))/mo")
                    .font(.system(size: 12, weight: .heavy)).foregroundStyle(Theme.lime)
                Text("Renews \(sub.renewsAt.formatted(.dateTime.month(.abbreviated).day()))")
                    .font(.system(size: 10.5, weight: .semibold)).foregroundStyle(Theme.textDim)
            }
            .frame(width: 128)
            .padding(14)
            .background(Theme.surface)
            .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
            .clipShape(.rect(cornerRadius: Theme.rMd))
        }
        .buttonStyle(.plain)
    }

    private func menuRow(_ icon: String, _ color: Color, _ label: String, action: @escaping () -> Void) -> some View {
        PressableButton(scaleTo: 0.99, action: action) {
            HStack(spacing: 12) {
                ZStack {
                    Image(systemName: icon)
                        .font(.system(size: 17, weight: .medium))
                        .foregroundStyle(color)
                }
                .frame(width: 32, height: 32)
                .background(Theme.surfaceHi)
                .clipShape(.rect(cornerRadius: 16))
                Text(label)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.text)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 17, weight: .medium))
                    .foregroundStyle(Theme.textDim)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 14)
        }
        .buttonStyle(.plain)
    }
}

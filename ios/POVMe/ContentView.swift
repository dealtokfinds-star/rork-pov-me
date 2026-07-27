import SwiftUI

/// Root content view — auth gate + main tab navigation.
/// Replaces the placeholder ContentView that ships with new Swift apps.
struct ContentView: View {
    @Environment(AppState.self) private var app
    @State private var router = Router()

    var body: some View {
        @Bindable var app = app
        Group {
            if app.authLoading {
                splashScreen
            } else if !app.signedIn {
                SignInView()
            } else if !app.onboarded {
                OnboardingView()
            } else {
                mainApp
            }
        }
        .environment(router)
        .preferredColorScheme(.dark)
    }

    private var splashScreen: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()
            VStack(spacing: 8) {
                Wordmark(size: 32)
                Text("Loading…")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.textDim)
            }
        }
    }

    @ViewBuilder private var mainApp: some View {
        @Bindable var router = router
        TabView(selection: $router.selectedTab) {
            NavigationStack(path: $router.path) {
                FeedView()
                    .navigationDestination(for: Router.Route.self) { route in
                        destinationView(route)
                    }
            }
            .tabItem {
                Label("Feed", systemImage: "house.fill")
            }
            .tag(Router.Tab.feed)

            NavigationStack {
                ExploreView()
                    .navigationDestination(for: Router.Route.self) { route in
                        destinationView(route)
                    }
            }
            .tabItem {
                Label("Explore", systemImage: "safari.fill")
            }
            .tag(Router.Tab.explore)

            NavigationStack {
                LiveView()
                    .navigationDestination(for: Router.Route.self) { route in
                        destinationView(route)
                    }
            }
            .tabItem {
                Label("Live", systemImage: "dot.radiowaves.left.and.right")
            }
            .tag(Router.Tab.live)

            NavigationStack {
                StudioView()
                    .navigationDestination(for: Router.Route.self) { route in
                        destinationView(route)
                    }
            }
            .tabItem {
                Label("Studio", systemImage: "video.fill")
            }
            .tag(Router.Tab.studio)

            NavigationStack {
                ProfileView()
                    .navigationDestination(for: Router.Route.self) { route in
                        destinationView(route)
                    }
            }
            .tabItem {
                Label("You", systemImage: "person.fill")
            }
            .tag(Router.Tab.profile)
        }
        .tint(Theme.lime)
        .onAppear {
            configureTabBar()
        }
    }

    /// Routes navigation destinations to their views. Pushes use the shared router path
    /// on the Feed tab's NavigationStack, so every push lands on the same stack.
    @ViewBuilder
    private func destinationView(_ route: Router.Route) -> some View {
        switch route {
        case .episode(let id): EpisodeView(episodeId: id)
        case .live(let id): LiveViewScreen(streamId: id)
        case .creator(let id): CreatorView(creatorId: id)
        case .subscribe(let id): SubscribeView(creatorId: id)
        case .unlock(let id): UnlockView(episodeId: id)
        case .tip(let id): TipView(creatorId: id)
        case .wallet: WalletView()
        case .upload: UploadView()
        case .golive: GoLiveView()
        case .becomeCreator: BecomeCreatorView()
        case .subscriptions: SubscriptionsView()
        case .earnings: EarningsView()
        case .analytics: AnalyticsView()
        case .notifications: NotificationsView()
        case .saved: SavedView()
        case .settings: SettingsView()
        case .guidelines: GuidelinesView()
        case .admin: AdminView()
        case .messages: MessagesView()
        case .messageThread(let id): MessageThreadView(threadId: id)
        case .legalTerms: LegalTermsView()
        case .legalPrivacy: LegalPrivacyView()
        case .legal2257: Legal2257View()
        }
    }

    private func configureTabBar() {
        let appearance = UITabBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = UIColor(Theme.bg.opacity(0.97))
        appearance.shadowColor = UIColor(Theme.border)
        appearance.shadowImage = nil
        let itemAppearance = appearance.stackedLayoutAppearance
        itemAppearance.normal.iconColor = UIColor(Theme.textDim)
        itemAppearance.normal.titleTextAttributes = [.foregroundColor: UIColor(Theme.textDim)]
        itemAppearance.selected.iconColor = UIColor(Theme.lime)
        itemAppearance.selected.titleTextAttributes = [.foregroundColor: UIColor(Theme.lime)]
        UITabBar.appearance().standardAppearance = appearance
        UITabBar.appearance().scrollEdgeAppearance = appearance
    }
}

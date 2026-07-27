import SwiftUI

/// Type-safe navigation router. Mirrors the Expo Stack routes.
@Observable
final class Router {
    var path = NavigationPath()
    var selectedTab: Tab = .feed

    enum Tab: Hashable { case feed, explore, live, studio, profile }

    enum Route: Hashable {
        case episode(String)
        case live(String)
        case creator(String)
        case subscribe(String)
        case unlock(String)
        case tip(String)
        case wallet
        case upload
        case golive
        case becomeCreator
        case subscriptions
        case earnings
        case analytics
        case notifications
        case saved
        case settings
        case guidelines
        case admin
        case messages
        case messageThread(String)
        case legalTerms
        case legalPrivacy
        case legal2257
    }

    func push(_ route: Route) {
        path.append(route)
    }

    func pop() {
        if !path.isEmpty { path.removeLast() }
    }

    func popToRoot() {
        path = NavigationPath()
    }
}

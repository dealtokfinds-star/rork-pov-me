import SwiftUI
import Observation

/// Central app state — mirrors the Expo AppProvider.
/// Persisted to UserDefaults so wallet, subs, unlocks, and onboarding survive relaunch.
@Observable
final class AppState {
    // Persisted
    var onboarded: Bool = false
    var isCreator: Bool = false
    var displayName: String = "Brian"
    var handle: String = "brian"
    var balance: Double = 120
    var subscriptions: [Subscription] = []
    var unlockedEpisodes: [String] = []
    var unlockedStreams: [String] = []
    var savedEpisodes: [String] = []
    var likedEpisodes: [String] = []
    var followedCreators: [String] = []
    var transactions: [Transaction] = []
    var tipTotals: [String: Double] = [:]
    var studio: [StudioEpisode] = Mock.studioEpisodes
    var interests: [PovCategory] = []
    var creatorPrice: Double = 12.99
    var payoutConnected: Bool = false
    var totalSpent: Double = 0

    // Transient
    var hydrated: Bool = false
    var signedIn: Bool = false
    var authLoading: Bool = true
    var currentUser: UserRef?

    struct UserRef: Hashable {
        let id: String
        let name: String
        let email: String
        let picture: String?
    }

    init() {
        loadPersisted()
    }

    // MARK: - Persistence

    private static let storageKey = "povme.state.v1"

    private func loadPersisted() {
        guard let data = UserDefaults.standard.data(forKey: AppState.storageKey),
              let decoded = try? JSONDecoder().decode(PersistedState.self, from: data) else {
            hydrated = true
            return
        }
        onboarded = decoded.onboarded
        isCreator = decoded.isCreator
        displayName = decoded.displayName
        handle = decoded.handle
        balance = decoded.balance
        subscriptions = decoded.subscriptions
        unlockedEpisodes = decoded.unlockedEpisodes
        unlockedStreams = decoded.unlockedStreams
        savedEpisodes = decoded.savedEpisodes
        likedEpisodes = decoded.likedEpisodes
        followedCreators = decoded.followedCreators
        transactions = decoded.transactions
        tipTotals = decoded.tipTotals
        studio = decoded.studio
        interests = decoded.interests
        creatorPrice = decoded.creatorPrice
        payoutConnected = decoded.payoutConnected
        totalSpent = decoded.totalSpent
        hydrated = true
    }

    private func persist() {
        let state = PersistedState(
            onboarded: onboarded, isCreator: isCreator, displayName: displayName, handle: handle,
            balance: balance, subscriptions: subscriptions, unlockedEpisodes: unlockedEpisodes,
            unlockedStreams: unlockedStreams, savedEpisodes: savedEpisodes, likedEpisodes: likedEpisodes,
            followedCreators: followedCreators, transactions: transactions, tipTotals: tipTotals,
            studio: studio, interests: interests, creatorPrice: creatorPrice,
            payoutConnected: payoutConnected, totalSpent: totalSpent
        )
        if let data = try? JSONEncoder().encode(state) {
            UserDefaults.standard.set(data, forKey: AppState.storageKey)
        }
    }

    private struct PersistedState: Codable {
        var onboarded: Bool
        var isCreator: Bool
        var displayName: String
        var handle: String
        var balance: Double
        var subscriptions: [Subscription]
        var unlockedEpisodes: [String]
        var unlockedStreams: [String]
        var savedEpisodes: [String]
        var likedEpisodes: [String]
        var followedCreators: [String]
        var transactions: [Transaction]
        var tipTotals: [String: Double]
        var studio: [StudioEpisode]
        var interests: [PovCategory]
        var creatorPrice: Double
        var payoutConnected: Bool
        var totalSpent: Double
    }

    // MARK: - Derived

    var activeSubs: [Subscription] { subscriptions.filter { $0.active } }
    var monthlySpend: Double { activeSubs.reduce(0) { $0 + $1.price } }

    var creatorStats: CreatorStats {
        let published = studio.filter { $0.status == .published }
        let gross = published.reduce(0.0) { $0 + $1.earned } + 2840.5
        let views = published.reduce(0) { $0 + $1.views } + 41200
        return CreatorStats(
            gross: gross, net: gross * 0.8, views: views,
            subs: 1284, tips: 962.4, ppvUnlocks: 318, retention: 0.71
        )
    }

    struct CreatorStats {
        let gross: Double; let net: Double; let views: Int
        let subs: Int; let tips: Double; let ppvUnlocks: Int; let retention: Double
    }

    // MARK: - Helpers

    func isSubscribed(_ creatorId: String) -> Bool {
        subscriptions.contains { $0.creatorId == creatorId && $0.active }
    }

    func hasUnlocked(episodeId: String) -> Bool {
        unlockedEpisodes.contains(episodeId)
    }

    func hasStreamAccess(_ streamId: String) -> Bool {
        unlockedStreams.contains(streamId)
    }

    func canWatch(_ episode: Episode) -> Bool {
        switch episode.access {
        case .free: return true
        case .subscribers: return isSubscribed(episode.creatorId)
        case .ppv: return hasUnlocked(episodeId: episode.id)
        }
    }

    // MARK: - Mutations

    private func uid(_ p: String) -> String { "\(p)_\(Int(Date().timeIntervalSince1970))" }

    private func pushTx(_ kind: Transaction.TxKind, label: String, amount: Double, creatorId: String?) {
        transactions.insert(.init(id: uid("tx"), kind: kind, label: label, amount: amount, creatorId: creatorId, at: Date()), at: 0)
        if transactions.count > 60 { transactions = Array(transactions.prefix(60)) }
    }

    @discardableResult
    func charge(_ amount: Double) -> Bool {
        guard balance >= amount else { return false }
        balance = round((balance - amount) * 100) / 100
        totalSpent = round((totalSpent + amount) * 100) / 100
        persist()
        return true
    }

    @discardableResult
    func subscribe(_ creatorId: String, price: Double) -> Bool {
        guard balance >= price else { return false }
        charge(price)
        subscriptions.removeAll { $0.creatorId == creatorId }
        subscriptions.append(.init(creatorId: creatorId, price: price, startedAt: Date(), renewsAt: Date().addingTimeInterval(30 * 86400), active: true))
        let handle = Mock.creator(creatorId)?.handle ?? "creator"
        pushTx(.sub, label: "Subscription · @\(handle)", amount: price, creatorId: creatorId)
        persist()
        return true
    }

    func cancelSubscription(_ creatorId: String) {
        for i in subscriptions.indices where subscriptions[i].creatorId == creatorId {
            subscriptions[i].active = false
        }
        persist()
    }

    func resumeSubscription(_ creatorId: String) {
        for i in subscriptions.indices where subscriptions[i].creatorId == creatorId {
            subscriptions[i].active = true
            subscriptions[i].renewsAt = Date().addingTimeInterval(30 * 86400)
        }
        persist()
    }

    @discardableResult
    func unlockEpisode(_ episodeId: String, price: Double) -> Bool {
        guard balance >= price else { return false }
        charge(price)
        if !unlockedEpisodes.contains(episodeId) { unlockedEpisodes.append(episodeId) }
        let ep = Mock.episode(episodeId)
        pushTx(.ppv, label: "Unlocked · \(ep?.title ?? "POV episode")", amount: price, creatorId: ep?.creatorId)
        persist()
        return true
    }

    @discardableResult
    func unlockStream(_ streamId: String, price: Double, creatorId: String) -> Bool {
        guard balance >= price else { return false }
        charge(price)
        if !unlockedStreams.contains(streamId) { unlockedStreams.append(streamId) }
        pushTx(.ppv, label: "Unlocked live event", amount: price, creatorId: creatorId)
        persist()
        return true
    }

    @discardableResult
    func tip(_ creatorId: String, amount: Double, label: String? = nil) -> Bool {
        guard balance >= amount else { return false }
        charge(amount)
        let prev = tipTotals[creatorId] ?? 0
        tipTotals[creatorId] = round((prev + amount) * 100) / 100
        let h = Mock.creator(creatorId)?.handle ?? "creator"
        pushTx(label != nil ? .gift : .tip, label: label != nil ? "\(label!) · @\(h)" : "Tip · @\(h)", amount: amount, creatorId: creatorId)
        persist()
        return true
    }

    func topUp(_ amount: Double) {
        balance = round((balance + amount) * 100) / 100
        pushTx(.topup, label: "Added to wallet", amount: amount, creatorId: nil)
        persist()
    }

    func toggleSaved(_ episodeId: String) {
        if savedEpisodes.contains(episodeId) { savedEpisodes.removeAll { $0 == episodeId } }
        else { savedEpisodes.append(episodeId) }
        persist()
    }

    func toggleLiked(_ episodeId: String) {
        if likedEpisodes.contains(episodeId) { likedEpisodes.removeAll { $0 == episodeId } }
        else { likedEpisodes.append(episodeId) }
        persist()
    }

    func toggleFollow(_ creatorId: String) {
        if followedCreators.contains(creatorId) { followedCreators.removeAll { $0 == creatorId } }
        else { followedCreators.append(creatorId) }
        persist()
    }

    func completeOnboarding(name: String, interests: [PovCategory], followed: [String] = []) {
        onboarded = true
        if !name.trimmingCharacters(in: .whitespaces).isEmpty {
            displayName = name.trimmingCharacters(in: .whitespaces)
            handle = displayName.lowercased().replacingOccurrences(of: " ", with: "")
        }
        self.interests = interests
        followedCreators = followed
        persist()
    }

    func becomeCreator(price: Double) {
        isCreator = true
        creatorPrice = price
        payoutConnected = true
        persist()
    }

    func setCreatorPrice(_ price: Double) {
        creatorPrice = price
        persist()
    }

    func publishEpisode(_ input: PublishInput) {
        studio.insert(.init(
            id: uid("s"), title: input.title, thumb: input.thumb, access: input.access,
            ppvPrice: input.ppvPrice, status: input.status, views: 0, earned: 0,
            category: input.category, postedAt: input.status == .published ? "now" : input.status == .scheduled ? "queued" : "—"
        ), at: 0)
        persist()
    }

    struct PublishInput {
        let title: String; let thumb: String; let access: AccessLevel
        let ppvPrice: Double?; let category: PovCategory
        let status: StudioEpisode.StudioStatus
    }

    func deleteStudioEpisode(_ id: String) {
        studio.removeAll { $0.id == id }
        persist()
    }

    func resetAccount() {
        onboarded = true
        isCreator = false
        displayName = "Brian"; handle = "brian"
        balance = 120
        subscriptions = []; unlockedEpisodes = []; unlockedStreams = []
        savedEpisodes = []; likedEpisodes = []; followedCreators = []
        transactions = []; tipTotals = [:]
        studio = Mock.studioEpisodes
        interests = []; creatorPrice = 12.99; payoutConnected = false; totalSpent = 0
        persist()
    }

    // MARK: - Auth (simulated for native build)

    func signIn(provider: String) {
        authLoading = false
        signedIn = true
        currentUser = .init(
            id: "local-\(provider)",
            name: displayName == "Brian" ? "Brian K" : displayName,
            email: "brian@example.com",
            picture: "https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?auto=format&fit=crop&w=300&q=80"
        )
    }

    func signOut() {
        signedIn = false
        currentUser = nil
        resetAccount()
        onboarded = false
        persist()
    }
}

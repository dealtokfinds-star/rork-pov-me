import SwiftUI
import Observation

/// Central app state — mirrors the Expo AppProvider.
///
/// Persisted state is now a CACHE ONLY. The source of truth is the server
/// `profiles` row. UserDefaults holds the last-known values so the UI can
/// render instantly before the network resolves, but every field is
/// overwritten by the server hydration on sign-in.
@Observable
final class AppState {
    // Persisted (cache only — server is source of truth)
    var onboarded: Bool = false
    var isCreator: Bool = false
    var displayName: String = ""
    var handle: String = ""
    var balance: Double = 0
    var interests: [PovCategory] = []
    var creatorPrice: Double = 12.99
    var totalSpent: Double = 0

    // KYC status (from profiles.kyc_status)
    var kycStatus: String = "unverified"
    var kycLastReason: String?

    // Transient
    var hydrated: Bool = false
    var signedIn: Bool = false
    var authLoading: Bool = true
    var currentUser: UserRef?

    // Server-hydrated subscriptions
    var subscriptions: [Subscription] = []
    var savedEpisodes: Set<String> = []
    var likedEpisodes: Set<String> = []

    struct UserRef: Hashable {
        let id: String
        let name: String
        let email: String
        let picture: String?
    }

    init() {
        loadPersisted()
    }

    // MARK: - Persistence (cache)

    private static let storageKey = "povme.state.v2"

    private struct PersistedState: Codable {
        var onboarded: Bool
        var isCreator: Bool
        var displayName: String
        var handle: String
        var balance: Double
        var interests: [PovCategory]
        var creatorPrice: Double
        var totalSpent: Double
        var kycStatus: String
    }

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
        interests = decoded.interests
        creatorPrice = decoded.creatorPrice
        totalSpent = decoded.totalSpent
        kycStatus = decoded.kycStatus
        hydrated = true
    }

    private func persist() {
        let state = PersistedState(
            onboarded: onboarded, isCreator: isCreator, displayName: displayName, handle: handle,
            balance: balance, interests: interests, creatorPrice: creatorPrice,
            totalSpent: totalSpent, kycStatus: kycStatus
        )
        if let data = try? JSONEncoder().encode(state) {
            UserDefaults.standard.set(data, forKey: AppState.storageKey)
        }
    }

    // MARK: - Derived

    var activeSubs: [Subscription] { subscriptions.filter { $0.active } }
    var monthlySpend: Double { activeSubs.reduce(0) { $0 + $1.price } }
    var isVerified: Bool { kycStatus == "verified" }

    func isSubscribed(_ creatorId: String) -> Bool {
        subscriptions.contains { $0.creatorId == creatorId && $0.active }
    }

    // Placeholder creator stats — real data comes from the creator-stats edge function.
    // The iOS app reads these from the server; this is a fallback for UI rendering.
    var creatorStats: CreatorStats {
        CreatorStats(gross: 0, net: 0, views: 0, subs: 0, tips: 0, ppvUnlocks: 0, retention: 0)
    }

    struct CreatorStats {
        let gross: Double; let net: Double; let views: Int
        let subs: Int; let tips: Double; let ppvUnlocks: Int; let retention: Double
    }

    var payoutConnected: Bool { isCreator && isVerified }

    // MARK: - Server Hydration

    /// Hydrate from the server profiles row after sign-in.
    @MainActor
    func hydrateFromServer() async {
        guard let userId = EdgeClient.shared.userId else { return }
        do {
            let rows: [ProfileRow] = try await SupabaseClient.shared.fetch(
                "profiles?id=eq.\(userId)&select=name,handle,wallet_balance,total_spent,onboarded,is_creator,interests,sub_price,kyc_status,kyc_last_reason"
            )
            if let first = rows.first {
                displayName = first.name ?? displayName
                handle = first.handle ?? handle
                balance = first.wallet_balance ?? 0
                totalSpent = first.total_spent ?? 0
                onboarded = first.onboarded ?? false
                isCreator = first.is_creator ?? false
                interests = first.interests ?? []
                creatorPrice = first.sub_price ?? creatorPrice
                kycStatus = first.kyc_status ?? "unverified"
                kycLastReason = first.kyc_last_reason
                persist()
            }
        } catch {
            print("[povme] profile hydration failed: \(error)")
        }
    }

    /// Refresh wallet balance from server.
    @MainActor
    func refreshWallet() async {
        do {
            let rows: [WalletRow] = try await SupabaseClient.shared.fetch(
                "profiles?select=wallet_balance,total_spent"
            )
            if let first = rows.first {
                balance = first.wallet_balance ?? 0
                totalSpent = first.total_spent ?? 0
                persist()
            }
        } catch {
            print("[povme] refreshWallet failed: \(error)")
        }
    }

    // MARK: - Local mutations (optimistic only)

    func completeOnboarding(name: String, interests: [PovCategory]) {
        onboarded = true
        if !name.trimmingCharacters(in: .whitespaces).isEmpty {
            displayName = name.trimmingCharacters(in: .whitespaces)
            handle = displayName.lowercased().replacingOccurrences(of: " ", with: "")
        }
        self.interests = interests
        persist()
    }

    func becomeCreator(price: Double) {
        isCreator = true
        creatorPrice = price
        persist()
    }

    func setCreatorPrice(_ price: Double) {
        creatorPrice = price
        persist()
    }

    func toggleSaved(_ episodeId: String) {
        if savedEpisodes.contains(episodeId) { savedEpisodes.remove(episodeId) }
        else { savedEpisodes.insert(episodeId) }
    }

    func toggleLiked(_ episodeId: String) {
        if likedEpisodes.contains(episodeId) { likedEpisodes.remove(episodeId) }
        else { likedEpisodes.insert(episodeId) }
    }

    func resetAccount() {
        onboarded = false
        isCreator = false
        displayName = ""; handle = ""
        balance = 0
        subscriptions = []; savedEpisodes = []; likedEpisodes = []
        interests = []; creatorPrice = 12.99; totalSpent = 0
        kycStatus = "unverified"; kycLastReason = nil
        persist()
    }

    // MARK: - Auth

    func signOut() {
        signedIn = false
        currentUser = nil
        resetAccount()
    }
}

// MARK: - Response types

private struct ProfileRow: Decodable {
    let name: String?
    let handle: String?
    let wallet_balance: Double?
    let total_spent: Double?
    let onboarded: Bool?
    let is_creator: Bool?
    let interests: [PovCategory]?
    let sub_price: Double?
    let kyc_status: String?
    let kyc_last_reason: String?
}

private struct WalletRow: Decodable {
    let wallet_balance: Double?
    let total_spent: Double?
}

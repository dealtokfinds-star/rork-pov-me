import Foundation
import SwiftUI
import UIKit

/// Stripe/LemonSqueezy checkout client for iOS.
///
/// Calls the `create-checkout` edge function to get a hosted checkout URL,
/// then opens it in Safari. On redirect back to the app, the webhook has
/// already processed the payment server-side.
@MainActor
final class CheckoutClient {
    static let shared = CheckoutClient()

    private init() {}

    enum CheckoutType: String {
        case topup, sub, ppv, tip
    }

    struct CheckoutResult {
        let success: Bool
        let error: String?
        let checkoutURL: URL?
    }

    /// Create a checkout session and open it in the system browser.
    func openCheckout(
        type: CheckoutType,
        amount: Double? = nil,
        creatorId: String? = nil,
        episodeId: String? = nil,
        streamId: String? = nil,
        message: String? = nil
    ) async -> CheckoutResult {
        var body: [String: Any] = ["type": type.rawValue]
        if let amount = amount { body["amount"] = amount }
        if let creatorId = creatorId { body["creator_id"] = creatorId }
        if let episodeId = episodeId { body["episode_id"] = episodeId }
        if let streamId = streamId { body["stream_id"] = streamId }
        if let message = message { body["message"] = message }

        do {
            let response: CheckoutResponse = try await EdgeClient.shared.call(
                "create-checkout",
                body: body,
                as: CheckoutResponse.self
            )
            guard let urlString = response.checkout_url, let url = URL(string: urlString) else {
                return CheckoutResult(success: false, error: "No checkout URL returned", checkoutURL: nil)
            }
            // Open in Safari — the redirect will return to the app via deep link
            await MainActor.run {
                UIApplication.shared.open(url)
            }
            return CheckoutResult(success: true, error: nil, checkoutURL: url)
        } catch {
            return CheckoutResult(success: false, error: error.localizedDescription, checkoutURL: nil)
        }
    }

    /// Cancel a subscription via the cancel-subscription edge function.
    func cancelSubscription(creatorId: String) async -> CheckoutResult {
        do {
            let _: CancelResponse = try await EdgeClient.shared.call(
                "cancel-subscription",
                body: ["creator_id": creatorId],
                as: CancelResponse.self
            )
            return CheckoutResult(success: true, error: nil, checkoutURL: nil)
        } catch {
            return CheckoutResult(success: false, error: error.localizedDescription, checkoutURL: nil)
        }
    }
}

private struct CheckoutResponse: Decodable {
    let checkout_url: String?
    let error: String?
}

private struct CancelResponse: Decodable {
    let ok: Bool?
    let error: String?
}

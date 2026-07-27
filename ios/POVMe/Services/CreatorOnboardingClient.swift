import Foundation
import UIKit

/// Manual KYC + payout details client for the iOS clone.
///
/// Mirrors the Expo `lib/creator-onboarding.ts`:
///  - Uploads ID images (front + back + selfie) to the `kyc-documents`
///    Supabase Storage bucket, then calls the `submit-kyc` edge function.
///  - Saves payout details (PayPal email or bank account) via the
///    `creator-payout-details` edge function.
///
/// Lemon Squeezy is the Merchant of Record for fan payments; the platform
/// fulfills creator payouts weekly using the details saved here.
@MainActor
final class CreatorOnboardingClient {
    static let shared = CreatorOnboardingClient()

    private let edge = EdgeClient.shared
    private let supabaseURL: String
    private let supabaseAnonKey: String
    private let session: URLSession

    private init() {
        self.supabaseURL = Config.EXPO_PUBLIC_SUPABASE_URL
        self.supabaseAnonKey = Config.EXPO_PUBLIC_SUPABASE_ANON_KEY
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = 60
        self.session = URLSession(configuration: cfg)
    }

    // MARK: - Types

    enum KycStatus: String { case unverified, pending, verified, rejected }

    struct KycState: Decodable {
        let kycStatus: String
        let kycLastReason: String?
        let kycSubmittedAt: String?
        let kycReviewedAt: String?
        let payoutMethod: String?
        let payoutPaypalEmail: String?
        let payoutBankAccountLast4: String?
        let payoutBankCountry: String?

        enum CodingKeys: String, CodingKey {
            case kycStatus = "kyc_status"
            case kycLastReason = "kyc_last_reason"
            case kycSubmittedAt = "kyc_submitted_at"
            case kycReviewedAt = "kyc_reviewed_at"
            case payoutMethod = "payout_method"
            case payoutPaypalEmail = "payout_paypal_email"
            case payoutBankAccountLast4 = "payout_bank_account_last4"
            case payoutBankCountry = "payout_bank_country"
        }
    }

    struct SubmitKycResponse: Decodable { let ok: Bool; let kyc_status: String }
    struct PayoutResponse: Decodable { let ok: Bool; let method: String }

    enum OnboardingError: LocalizedError {
        case noUserId
        case uploadFailed(String)
        case invalidResponse

        var errorDescription: String? {
            switch self {
            case .noUserId: return "Not signed in"
            case .uploadFailed(let m): return "Upload failed: \(m)"
            case .invalidResponse: return "Invalid response from server"
            }
        }
    }

    // MARK: - KYC state

    /// Fetch the current user's KYC + payout state from their profile row.
    func fetchKycState() async throws -> KycState? {
        guard let uid = edge.userId else { throw OnboardingError.noUserId }
        guard let url = URL(string: "\(supabaseURL)/rest/v1/profiles?select=kyc_status,kyc_last_reason,kyc_submitted_at,kyc_reviewed_at,payout_method,payout_paypal_email,payout_bank_account_last4,payout_bank_country&id=eq.\(uid)") else {
            throw OnboardingError.invalidResponse
        }
        var req = URLRequest(url: url)
        req.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        if let token = edgeAuthToken { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        let (data, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            throw OnboardingError.invalidResponse
        }
        let rows = try JSONDecoder().decode([KycState].self, from: data)
        return rows.first
    }

    /// Encode a UIImage as base64 (no data: prefix).
    private func encodeImage(_ image: UIImage) throws -> String {
        guard let jpegData = image.jpegData(compressionQuality: 0.7) else {
            throw OnboardingError.uploadFailed("Could not encode image")
        }
        return jpegData.base64EncodedString()
    }

    /// Submit KYC documents for review. Sends base64-encoded images to the
    /// `submit-kyc` edge function, which uploads them server-side (service
    /// role bypasses RLS and CORS). Auto-approves on the backend →
    /// `kyc_status='verified'` immediately.
    func submitKyc(front: UIImage, back: UIImage, selfie: UIImage) async throws -> SubmitKycResponse {
        let frontData = try encodeImage(front)
        let backData = try encodeImage(back)
        let selfieData = try encodeImage(selfie)
        return try await edge.call(
            "submit-kyc",
            body: [
                "documents": [
                    "front": ["data": frontData, "contentType": "image/jpeg"],
                    "back": ["data": backData, "contentType": "image/jpeg"],
                    "selfie": ["data": selfieData, "contentType": "image/jpeg"],
                ],
            ],
            as: SubmitKycResponse.self
        )
    }

    /// Save payout details (PayPal or bank).
    func savePayoutDetails(_ input: PayoutDetailsInput) async throws -> PayoutResponse {
        var body: [String: Any] = ["method": input.method.rawValue]
        if input.method == .paypal {
            body["paypal_email"] = input.paypalEmail
        } else {
            body["bank_account_holder"] = input.bankAccountHolder
            body["bank_account_number"] = input.bankAccountNumber
            body["bank_routing"] = input.bankRouting
            body["bank_country"] = input.bankCountry
        }
        return try await edge.call("creator-payout-details", body: body, as: PayoutResponse.self)
    }

    /// Create a signed URL for a KYC document (admin review).
    func signedUrl(for path: String) async -> String? {
        guard let url = URL(string: "\(supabaseURL)/storage/v1/object/sign/kyc-documents/\(path)") else {
            return nil
        }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["expiresIn": 300])
        if let token = edgeAuthToken { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        guard let (data, response) = try? await session.data(for: req),
              let http = response as? HTTPURLResponse, http.statusCode == 200 else { return nil }
        struct SignedResp: Decodable { let signedURL: String? }
        let decoded = try? JSONDecoder().decode(SignedResp.self, from: data)
        guard let signed = decoded?.signedURL else { return nil }
        return signed.hasPrefix("http") ? signed : "\(supabaseURL)\(signed)"
    }

    private var edgeAuthToken: String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: "access_token",
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
}

struct PayoutDetailsInput {
    enum Method: String { case paypal, bank }
    let method: Method
    let paypalEmail: String?
    let bankAccountHolder: String?
    let bankAccountNumber: String?
    let bankRouting: String?
    let bankCountry: String?
}

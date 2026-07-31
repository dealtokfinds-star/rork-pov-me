import Foundation

/// Lightweight Supabase REST API client for the iOS app.
///
/// Uses the Rork Auth JWT from the keychain (same as EdgeClient) to make
/// authenticated requests to the Supabase PostgREST API. RLS policies
/// apply based on the JWT's sub claim.
@MainActor
final class SupabaseClient {
    static let shared = SupabaseClient()

    private let baseURL: String
    private let anonKey: String
    private let session: URLSession

    private init() {
        let url = Config.EXPO_PUBLIC_SUPABASE_URL.isEmpty
            ? "https://placeholder.supabase.co"
            : Config.EXPO_PUBLIC_SUPABASE_URL
        self.baseURL = "\(url)/rest/v1"
        self.anonKey = Config.EXPO_PUBLIC_SUPABASE_ANON_KEY
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = 30
        cfg.waitsForConnectivity = true
        self.session = URLSession(configuration: cfg)
    }

    /// The stored Rork Auth JWT (sub claim = user id).
    private var authToken: String? {
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

    /// Fetch rows from a Supabase table (PostgREST GET).
    func fetch<T: Decodable>(_ path: String) async throws -> [T] {
        guard let url = URL(string: "\(baseURL)/\(path)") else {
            throw SupabaseError.invalidURL
        }
        var req = URLRequest(url: url)
        req.httpMethod = "GET"
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token = authToken {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw SupabaseError.noResponse }
        if http.statusCode >= 400 {
            let msg = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw SupabaseError.server("Request failed (\(http.statusCode)): \(msg)")
        }
        return try JSONDecoder().decode([T].self, from: data)
    }

    /// Fetch a single row (first result) from a Supabase table.
    func fetchOne<T: Decodable>(_ path: String) async throws -> T? {
        let rows: [T] = try await fetch(path)
        return rows.first
    }
}

enum SupabaseError: LocalizedError {
    case invalidURL
    case noResponse
    case server(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid URL"
        case .noResponse: return "No response from server"
        case .server(let msg): return msg
        }
    }
}

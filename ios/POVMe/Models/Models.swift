import Foundation
import SwiftUI

enum AccessLevel: String, Codable, CaseIterable {
    case free, subscribers, ppv
}

enum PovCategory: String, Codable, CaseIterable {
    case trader, bettor, founder, luxury, nightlife, travel, athlete, global
}

enum StreamAccess: String, Codable, CaseIterable {
    case `public`, subscribers, ppv
}

struct Category: Identifiable, Hashable {
    let id: PovCategory
    let label: String
    let tagline: String
    let emoji: String
    let accent: Color

    static let all: [Category] = [
        .init(id: .trader, label: "Trader", tagline: "Charts, scalps, PnL", emoji: "📈", accent: Theme.lime),
        .init(id: .bettor, label: "Bettor", tagline: "Models & live sweats", emoji: "🎲", accent: Theme.gold),
        .init(id: .founder, label: "Founder", tagline: "Pitch days & builds", emoji: "🚀", accent: Theme.cyan),
        .init(id: .luxury, label: "Luxury", tagline: "Supercars, yachts", emoji: "🏎️", accent: Theme.gold),
        .init(id: .nightlife, label: "Nightlife", tagline: "Tables & afterhours", emoji: "🌃", accent: Theme.magenta),
        .init(id: .travel, label: "Travel", tagline: "Cities, nomad life", emoji: "🌍", accent: Theme.cyan),
        .init(id: .athlete, label: "Athlete", tagline: "Training & fight night", emoji: "🥊", accent: Theme.magenta),
        .init(id: .global, label: "Global", tagline: "Be someone elsewhere", emoji: "🛰️", accent: Theme.lime),
    ]

    static func by(_ id: PovCategory) -> Category {
        all.first { $0.id == id } ?? all[0]
    }
}

struct Creator: Identifiable, Hashable {
    let id: String
    let handle: String
    let name: String
    let avatar: String
    let cover: String
    let bio: String
    let identity: String
    let location: String
    let categories: [PovCategory]
    let subPrice: Double
    let subscribers: Int
    let episodes: Int
    let verified: Bool
    let isLive: Bool
    let rating: Double
}

struct Episode: Identifiable, Hashable {
    let id: String
    let creatorId: String
    let title: String
    let description: String
    let thumb: String
    let video: String
    let durationSec: Int
    let access: AccessLevel
    let ppvPrice: Double?
    let category: PovCategory
    let chapter: String
    let views: Int
    let likes: Int
    let tips: Double
    let postedAt: String
}

struct LiveStream: Identifiable, Hashable {
    let id: String
    let creatorId: String
    let title: String
    let thumb: String
    let video: String
    let category: PovCategory
    let access: StreamAccess
    let ppvPrice: Double?
    let viewers: Int
    let startedMinutesAgo: Int
    let replayEnabled: Bool
}

struct Gift: Identifiable, Hashable {
    let id: String
    let name: String
    let emoji: String
    let price: Double
}

struct ChatMessage: Identifiable, Hashable {
    let id: String
    let user: String
    let color: Color
    let text: String
    let badge: ChatBadge?
    let kind: ChatKind
    let amount: Double?

    enum ChatBadge: String { case sub, top, mod }
    enum ChatKind: String { case chat, tip, join, gift }
}

struct Transaction: Identifiable, Hashable, Codable {
    let id: String
    let kind: TxKind
    let label: String
    let amount: Double
    let creatorId: String?
    let at: Date

    enum TxKind: String, Codable { case sub, tip, ppv, topup, payout, gift }
}

struct Subscription: Identifiable, Hashable, Codable {
    let creatorId: String
    let price: Double
    let startedAt: Date
    var renewsAt: Date
    var active: Bool

    var id: String { creatorId }
}

struct DmThread: Identifiable, Hashable {
    let id: String
    let creatorId: String
    var messages: [DmMessage]
}

struct DmMessage: Identifiable, Hashable {
    let id: String
    let fromMe: Bool
    let text: String
    let at: Date
    let locked: Bool
    let price: Double?
}

struct StudioEpisode: Identifiable, Hashable, Codable {
    let id: String
    let title: String
    let thumb: String
    let access: AccessLevel
    let ppvPrice: Double?
    let status: StudioStatus
    let views: Int
    let earned: Double
    let category: PovCategory
    let postedAt: String

    enum StudioStatus: String, Codable, CaseIterable { case published, scheduled, draft }
}

struct NotificationItem: Identifiable, Hashable {
    let id: String
    let kind: NotifKind
    let title: String
    let body: String
    let at: Date
    let creatorId: String?
    let unread: Bool

    enum NotifKind: String { case live, episode, tip, sub, dm, system }
}

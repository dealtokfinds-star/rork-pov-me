import Foundation
import SwiftUI

/// Mock data mirror of the Expo app's constants/mock-data.ts.
/// In production these would come from Supabase; here they seed the local app.
enum Mock {
    // MARK: - Image / video helpers

    private static func img(_ id: String, _ w: Int = 900) -> String {
        "https://images.unsplash.com/\(id)?auto=format&fit=crop&w=\(w)&q=80"
    }

    private static func vid(_ name: String) -> String {
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/\(name).mp4"
    }

    // MARK: - Creators

    static let creators: [Creator] = [
        Creator(id: "c1", handle: "milesscalps", name: "Miles Renner",
                avatar: img("photo-1500648767791-00dcc994a43e", 300),
                cover: img("photo-1611974789855-9c2a0a7236a3"),
                bio: "Futures scalper in Miami. 4:00am chart prep, live entries, real PnL. You sit in my chair.",
                identity: "Prop futures trader", location: "Miami, FL",
                categories: [.trader, .founder], subPrice: 14.99, subscribers: 18420, episodes: 214,
                verified: true, isLive: true, rating: 4.9),
        Creator(id: "c2", handle: "nocturna", name: "Yuki Ando",
                avatar: img("photo-1494790108377-be9c29b29330", 300),
                cover: img("photo-1514933651103-005eec06c04b"),
                bio: "Tokyo nightlife from the inside. Door, booth, back rooms, 5am ramen. Strictly first-person.",
                identity: "Club promoter", location: "Tokyo, JP",
                categories: [.nightlife, .travel], subPrice: 19.99, subscribers: 42980, episodes: 168,
                verified: true, isLive: true, rating: 4.8),
        Creator(id: "c3", handle: "sharpdesk", name: "Andre Beaumont",
                avatar: img("photo-1507003211169-0a1dd7228f2d", 300),
                cover: img("photo-1567427017947-545c5f8d16ad"),
                bio: "Pro sports bettor. Model building, line shopping, and the sweat. 6-figure tickets on camera.",
                identity: "Pro bettor", location: "Las Vegas, NV",
                categories: [.bettor, .trader], subPrice: 24.99, subscribers: 9310, episodes: 97,
                verified: true, isLive: false, rating: 4.7),
        Creator(id: "c4", handle: "velvetgarage", name: "Sofia Marchetti",
                avatar: img("photo-1524504388940-b1c1722653e1", 300),
                cover: img("photo-1503376780353-7e6692767b70"),
                bio: "Supercar collector. Cockpit POV, canyon runs, auction floors. Hands on the wheel are yours.",
                identity: "Collector & driver", location: "Monaco",
                categories: [.luxury, .travel], subPrice: 29.99, subscribers: 61240, episodes: 143,
                verified: true, isLive: true, rating: 5.0),
        Creator(id: "c5", handle: "buildinpublic", name: "Deshawn Poole",
                avatar: img("photo-1519085360753-af0119f7cbe7", 300),
                cover: img("photo-1522071820081-009f0129c71c"),
                bio: "Seed-stage founder. Sales calls, investor rooms, 2am deploys. Raw startup grind POV.",
                identity: "Founder / CEO", location: "Austin, TX",
                categories: [.founder], subPrice: 9.99, subscribers: 12760, episodes: 189,
                verified: true, isLive: false, rating: 4.8),
        Creator(id: "c6", handle: "ringside", name: "Kofi Mensah",
                avatar: img("photo-1531891437562-4301cf35b7e4", 300),
                cover: img("photo-1544367567-0f2fcb009e0b"),
                bio: "Pro middleweight. Camp, weigh-in, walkout, and the first bell — strapped to my chest.",
                identity: "Pro fighter", location: "London, UK",
                categories: [.athlete], subPrice: 12.99, subscribers: 27400, episodes: 76,
                verified: true, isLive: false, rating: 4.9),
        Creator(id: "c7", handle: "portauprince", name: "Naïka Étienne",
                avatar: img("photo-1534528741775-53994a69daeb", 300),
                cover: img("photo-1502920917128-1aa500764cbd"),
                bio: "Daily life in Port-au-Prince. Markets, moto rides, family kitchens. Real, unfiltered, human.",
                identity: "Documentarian", location: "Port-au-Prince, HT",
                categories: [.global, .travel], subPrice: 4.99, subscribers: 8140, episodes: 121,
                verified: false, isLive: false, rating: 4.9),
        Creator(id: "c8", handle: "roamerrr", name: "Elias Vogt",
                avatar: img("photo-1492562080023-ab3db95bfbce", 300),
                cover: img("photo-1533105079780-92b9be482077"),
                bio: "36 countries on one chest rig. Night trains, street food, border crossings.",
                identity: "Nomad", location: "Lisbon, PT",
                categories: [.travel, .global], subPrice: 7.99, subscribers: 33150, episodes: 231,
                verified: true, isLive: false, rating: 4.6),
    ]

    static func creator(_ id: String) -> Creator? {
        creators.first { $0.id == id }
    }

    // MARK: - Episodes

    static let episodes: [Episode] = [
        Episode(id: "e1", creatorId: "c1", title: "4:00 AM: you wake up as a Miami futures trader",
                description: "Alarm, cold plunge, pre-market levels on the whiteboard, then 42 minutes of live NQ scalping. Full PnL reveal at the end. No cuts.",
                thumb: img("photo-1611974789855-9c2a0a7236a3"), video: vid("ForBiggerBlazes"),
                durationSec: 2820, access: .subscribers, ppvPrice: nil, category: .trader,
                chapter: "Work", views: 84200, likes: 12400, tips: 3120, postedAt: "3h"),
        Episode(id: "e2", creatorId: "c4", title: "Cockpit POV: night run through Monaco tunnels",
                description: "Straight-piped V12, 11pm, empty streets. You are behind the wheel — mirrors, gauges, downshifts, all of it.",
                thumb: img("photo-1503376780353-7e6692767b70"), video: vid("WeAreGoingOnBullrun"),
                durationSec: 1140, access: .ppv, ppvPrice: 11.99, category: .luxury,
                chapter: "Night out", views: 231000, likes: 41200, tips: 18900, postedAt: "6h"),
        Episode(id: "e3", creatorId: "c2", title: "Door to booth: Shibuya on a Saturday",
                description: "Guest list chaos, DJ handoff, table service, and the 5am walk to ramen. Wear my eyes for a night.",
                thumb: img("photo-1514933651103-005eec06c04b"), video: vid("ForBiggerEscapes"),
                durationSec: 3300, access: .subscribers, ppvPrice: nil, category: .nightlife,
                chapter: "Night out", views: 154000, likes: 28800, tips: 9400, postedAt: "9h"),
        Episode(id: "e4", creatorId: "c5", title: "Pitch day: three VCs, one term sheet",
                description: "Back-to-back partner meetings, the hallway debrief, and the call that changed the quarter.",
                thumb: img("photo-1522071820081-009f0129c71c"), video: vid("ForBiggerMeltdowns"),
                durationSec: 2400, access: .free, ppvPrice: nil, category: .founder,
                chapter: "Work", views: 62300, likes: 8100, tips: 1240, postedAt: "12h"),
        Episode(id: "e5", creatorId: "c3", title: "Sunday sweat: $40k across seven games",
                description: "Model outputs at 9am, line shopping, then eight hours of pure sweat. Every ticket on screen.",
                thumb: img("photo-1567427017947-545c5f8d16ad"), video: vid("ForBiggerJoyrides"),
                durationSec: 4500, access: .ppv, ppvPrice: 14.99, category: .bettor,
                chapter: "Work", views: 44100, likes: 6900, tips: 7300, postedAt: "1d"),
        Episode(id: "e6", creatorId: "c6", title: "Walkout: the 90 seconds before the first bell",
                description: "Wraps, pads, tunnel, crowd. Chest cam stays on through round one. The loudest POV on povme.",
                thumb: img("photo-1544367567-0f2fcb009e0b"), video: vid("ForBiggerFun"),
                durationSec: 960, access: .ppv, ppvPrice: 9.99, category: .athlete,
                chapter: "Fight night", views: 388000, likes: 71000, tips: 26500, postedAt: "1d"),
        Episode(id: "e7", creatorId: "c7", title: "Market morning in Port-au-Prince",
                description: "Moto through traffic, buying plantain and pikliz, then breakfast with my grandmother. Subtitled.",
                thumb: img("photo-1502920917128-1aa500764cbd"), video: vid("ElephantsDream"),
                durationSec: 1680, access: .free, ppvPrice: nil, category: .global,
                chapter: "Morning", views: 29400, likes: 5200, tips: 2100, postedAt: "2d"),
        Episode(id: "e8", creatorId: "c8", title: "Night train, Lisbon → Madrid, no sleep",
                description: "Boarding at 22:40, dining car, corridor conversations, and sunrise over Extremadura.",
                thumb: img("photo-1533105079780-92b9be482077"), video: vid("Sintel"),
                durationSec: 2100, access: .subscribers, ppvPrice: nil, category: .travel,
                chapter: "Travel day", views: 71200, likes: 9900, tips: 1800, postedAt: "2d"),
        Episode(id: "e9", creatorId: "c1", title: "The stop-out that cost me $18,400",
                description: "Full transparency episode. Bad thesis, worse sizing, and the debrief I recorded 20 minutes later.",
                thumb: img("photo-1590283603385-17ffb3a7f29f"), video: vid("VolkswagenGTIReview"),
                durationSec: 1500, access: .subscribers, ppvPrice: nil, category: .trader,
                chapter: "Debrief", views: 51300, likes: 11200, tips: 4400, postedAt: "3d"),
        Episode(id: "e10", creatorId: "c2", title: "Chapter: gym at 3pm after a 6am close",
                description: "How I reset. Sauna, lifts, and the honest conversation about burnout.",
                thumb: img("photo-1534438327276-14e5300c3a48"), video: vid("SubaruOutbackOnStreetAndDirt"),
                durationSec: 780, access: .free, ppvPrice: nil, category: .nightlife,
                chapter: "Gym", views: 38100, likes: 4400, tips: 620, postedAt: "4d"),
        Episode(id: "e11", creatorId: "c4", title: "Auction floor: bidding on a 1994 supercar",
                description: "Paddle in hand, heart rate on screen. You feel the hammer drop from inside my chest.",
                thumb: img("photo-1552519507-da3b142c6e3d"), video: vid("WhatCarCanYouGetForAGrand"),
                durationSec: 1980, access: .subscribers, ppvPrice: nil, category: .luxury,
                chapter: "Work", views: 96700, likes: 15400, tips: 8800, postedAt: "5d"),
        Episode(id: "e12", creatorId: "c6", title: "Camp week 3: 6am roadwork in the rain",
                description: "Nobody films this part. 12km, hill sprints, and breakfast at 8:15.",
                thumb: img("photo-1552674605-db6ffd4facb5"), video: vid("TearsOfSteel"),
                durationSec: 1320, access: .free, ppvPrice: nil, category: .athlete,
                chapter: "Training", views: 42900, likes: 7100, tips: 940, postedAt: "6d"),
    ]

    static func episode(_ id: String) -> Episode? {
        episodes.first { $0.id == id }
    }

    static func episodesByCreator(_ id: String) -> [Episode] {
        episodes.filter { $0.creatorId == id }
    }

    // MARK: - Live streams

    static let streams: [LiveStream] = [
        LiveStream(id: "l1", creatorId: "c1", title: "LIVE: NY open, sizing up on NQ",
                   thumb: img("photo-1590283603385-17ffb3a7f29f"), video: vid("ForBiggerBlazes"),
                   category: .trader, access: .public, ppvPrice: nil, viewers: 4820,
                   startedMinutesAgo: 38, replayEnabled: true),
        LiveStream(id: "l2", creatorId: "c4", title: "Coast run — passenger seat is yours",
                   thumb: img("photo-1492144534655-ae79c964c9d7"), video: vid("WeAreGoingOnBullrun"),
                   category: .luxury, access: .subscribers, ppvPrice: nil, viewers: 11240,
                   startedMinutesAgo: 74, replayEnabled: true),
        LiveStream(id: "l3", creatorId: "c2", title: "Roppongi rooftop, 2AM Tokyo",
                   thumb: img("photo-1519677100203-a0e668c92439"), video: vid("ForBiggerEscapes"),
                   category: .nightlife, access: .ppv, ppvPrice: 6.99, viewers: 20310,
                   startedMinutesAgo: 21, replayEnabled: false),
        LiveStream(id: "l4", creatorId: "c8", title: "Border crossing into Morocco",
                   thumb: img("photo-1539650116574-75c0c6d73f6e"), video: vid("Sintel"),
                   category: .travel, access: .public, ppvPrice: nil, viewers: 2140,
                   startedMinutesAgo: 12, replayEnabled: true),
    ]

    static func stream(_ id: String) -> LiveStream? {
        streams.first { $0.id == id }
    }

    static func streamByCreator(_ id: String) -> LiveStream? {
        streams.first { $0.creatorId == id }
    }

    // MARK: - Gifts

    static let gifts: [Gift] = [
        .init(id: "g1", name: "Chest Cam", emoji: "🎥", price: 1.99),
        .init(id: "g2", name: "Energy", emoji: "⚡️", price: 4.99),
        .init(id: "g3", name: "Ice", emoji: "🧊", price: 9.99),
        .init(id: "g4", name: "Keys", emoji: "🔑", price: 24.99),
        .init(id: "g5", name: "Jet", emoji: "✈️", price: 49.99),
        .init(id: "g6", name: "Crown", emoji: "👑", price: 99.99),
    ]

    // MARK: - Studio episodes (current user's vault)

    static let studioEpisodes: [StudioEpisode] = [
        .init(id: "s1", title: "Morning routine: 5am to first coffee",
              thumb: img("photo-1495474472287-4d71bcdd2085", 500),
              access: .free, ppvPrice: nil, status: .published, views: 18400, earned: 122.4,
              category: .founder, postedAt: "2d"),
        .init(id: "s2", title: "Full day POV: desk to dinner",
              thumb: img("photo-1497366216548-37526070297c", 500),
              access: .subscribers, ppvPrice: nil, status: .published, views: 9120, earned: 1840.5,
              category: .founder, postedAt: "5d"),
        .init(id: "s3", title: "PPV: closing a $250k deal live",
              thumb: img("photo-1521737604893-d14cc237f11d", 500),
              access: .ppv, ppvPrice: 12.99, status: .published, views: 3410, earned: 4204.9,
              category: .founder, postedAt: "1w"),
        .init(id: "s4", title: "Weekend chapter: Miami boat day",
              thumb: img("photo-1544551763-46a013bb70d5", 500),
              access: .subscribers, ppvPrice: nil, status: .scheduled, views: 0, earned: 0,
              category: .luxury, postedAt: "Fri 18:00"),
        .init(id: "s5", title: "Untitled — gym chapter raw",
              thumb: img("photo-1534438327276-14e5300c3a48", 500),
              access: .subscribers, ppvPrice: nil, status: .draft, views: 0, earned: 0,
              category: .athlete, postedAt: "—"),
    ]

    // MARK: - DM threads

    static let dmThreads: [DmThread] = [
        DmThread(id: "t1", creatorId: "c1", messages: [
            .init(id: "d1", fromMe: false, text: "welcome in 🙏 what POV do you want next week?", at: Date().addingTimeInterval(-86400), locked: false, price: nil),
            .init(id: "d2", fromMe: true, text: "the full 4am routine but unedited", at: Date().addingTimeInterval(-82000), locked: false, price: nil),
            .init(id: "d3", fromMe: false, text: "already filming it. dropping Thursday.", at: Date().addingTimeInterval(-8000), locked: false, price: nil),
            .init(id: "d4", fromMe: false, text: "Custom POV: your ticker on my screens for a full session", at: Date().addingTimeInterval(-400), locked: true, price: 29.99),
        ]),
        DmThread(id: "t2", creatorId: "c4", messages: [
            .init(id: "d5", fromMe: false, text: "garage tour drops tonight, you're on the early list", at: Date().addingTimeInterval(-3600), locked: false, price: nil),
            .init(id: "d6", fromMe: true, text: "which car?", at: Date().addingTimeInterval(-3000), locked: false, price: nil),
            .init(id: "d7", fromMe: false, text: "the yellow one 😈", at: Date().addingTimeInterval(-2400), locked: false, price: nil),
        ]),
        DmThread(id: "t3", creatorId: "c2", messages: [
            .init(id: "d8", fromMe: false, text: "tokyo stream in 2h. bring headphones.", at: Date().addingTimeInterval(-7200), locked: false, price: nil),
        ]),
    ]

    // MARK: - Chat simulation

    private static let chatNames = [
        "zaydraws", "kilo_9", "mari.fps", "tapedelay", "nine_lives", "oscarr",
        "vibecheck", "hexed", "lunaa", "grindset_ty", "porschekid", "bankrolljay",
    ]
    private static let chatLines = [
        "this angle is insane", "bro the hands are shaking 😭", "how much are you risking rn",
        "watching from Lagos 🇳🇬", "chest rig audio is so clean", "I feel like I'm in the car",
        "day 14 of asking for a gym chapter", "explain the entry pls", "the ambience >>>",
        "third stream I've caught today", "this is better than tv fr", "sub renewed, worth every cent",
        "put the cam lower next time", "mans is built different",
    ]
    private static let chatColors: [Color] = [
        Theme.lime, Theme.cyan, Theme.magenta, Theme.gold, Color(hex: 0x9F8BFF), Color(hex: 0x7DFFB2),
    ]

    private static var chatSeed = 0

    static func nextChat() -> ChatMessage {
        chatSeed += 1
        let roll = (chatSeed * 37) % 100
        let name = chatNames[(chatSeed * 7) % chatNames.count]
        let color = chatColors[(chatSeed * 3) % chatColors.count]
        if roll > 88 {
            let amount: Double = [2, 5, 10, 20, 50][(chatSeed * 5) % 5]
            return ChatMessage(id: "m\(chatSeed)", user: name, color: color, text: "keep going 🔥", badge: .top, kind: .tip, amount: amount)
        }
        if roll > 82 {
            return ChatMessage(id: "m\(chatSeed)", user: name, color: color, text: "joined the POV", badge: nil, kind: .join, amount: nil)
        }
        return ChatMessage(id: "m\(chatSeed)", user: name, color: color, text: chatLines[(chatSeed * 11) % chatLines.count], badge: roll > 55 ? .sub : nil, kind: .chat, amount: nil)
    }

    // MARK: - Scheduled + clips (Live tab)

    struct ScheduledPOV: Identifiable {
        let id: String
        let creatorId: String
        let title: String
        let when: String
        let access: String
    }

    static let scheduled: [ScheduledPOV] = [
        .init(id: "sc1", creatorId: "c3", title: "Sunday slate: model reveal + live sweat", when: "Sun 12:00", access: "Subs only"),
        .init(id: "sc2", creatorId: "c6", title: "Fight week: open workout POV", when: "Wed 19:30", access: "PPV $7.99"),
        .init(id: "sc3", creatorId: "c5", title: "Demo day rehearsal, unfiltered", when: "Thu 09:00", access: "Open"),
    ]

    struct Clip: Identifiable {
        let id: String
        let creatorId: String
        let label: String
        let views: Int
    }

    static let clips: [Clip] = [
        .init(id: "cl1", creatorId: "c4", label: "Tunnel pull at 240", views: 412000),
        .init(id: "cl2", creatorId: "c1", label: "+$8,200 in 90 seconds", views: 288000),
        .init(id: "cl3", creatorId: "c2", label: "Booth handoff at 3AM", views: 197000),
        .init(id: "cl4", creatorId: "c6", label: "Walkout reaction", views: 733000),
    ]

    // MARK: - Notifications

    static let notifications: [NotificationItem] = [
        .init(id: "n1", kind: .live, title: "Miles Renner went live", body: "LIVE: NY open, sizing up on NQ", at: Date().addingTimeInterval(-600), creatorId: "c1", unread: true),
        .init(id: "n2", kind: .episode, title: "New POV from Sofia Marchetti", body: "Cockpit POV: night run through Monaco tunnels", at: Date().addingTimeInterval(-7200), creatorId: "c4", unread: true),
        .init(id: "n3", kind: .tip, title: "Yuki Ando sent you a tip", body: "Thanks for the custom POV request 💸", at: Date().addingTimeInterval(-18000), creatorId: "c2", unread: false),
        .init(id: "n4", kind: .sub, title: "New subscriber", body: "@grindset_ty subscribed to your channel", at: Date().addingTimeInterval(-86400), creatorId: nil, unread: false),
        .init(id: "n5", kind: .dm, title: "New message from Andre Beaumont", body: "Sunday slate is confirmed 👀", at: Date().addingTimeInterval(-172800), creatorId: "c3", unread: false),
        .init(id: "n6", kind: .system, title: "Payout processed", body: "$1,840.50 sent to your bank account", at: Date().addingTimeInterval(-259200), creatorId: nil, unread: false),
    ]
}

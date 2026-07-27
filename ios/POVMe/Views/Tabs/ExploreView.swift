import SwiftUI

/// Explore tab — search, ranked creators, hero, premium tiles, rising, categories.
struct ExploreView: View {
    @Environment(AppState.self) private var app
    @Environment(Router.self) private var router
    @State private var query = ""
    @State private var category: PovCategory? = nil
    @State private var sort: SortKey = .trending

    enum SortKey: String, CaseIterable {
        case trending, rising, new, cheap, top
        var label: String {
            switch self {
            case .trending: return "Trending"
            case .rising: return "Rising"
            case .new: return "Newest"
            case .cheap: return "Under $10"
            case .top: return "Most subs"
            }
        }
    }

    private var q: String { query.trimmingCharacters(in: .whitespaces) }
    private var searching: Bool { !q.isEmpty }

    private var creators: [Creator] {
        if searching {
            let ql = q.lowercased()
            return Mock.creators.filter { c in
                c.name.lowercased().contains(ql) || c.handle.lowercased().contains(ql) ||
                c.location.lowercased().contains(ql) || c.identity.lowercased().contains(ql) ||
                c.categories.contains { $0.rawValue.contains(ql) }
            }
        }
        var list = Mock.creators
        if let category { list = list.filter { $0.categories.contains(category) } }
        switch sort {
        case .top: list.sort { $0.subscribers > $1.subscribers }
        case .cheap: list.sort { $0.subPrice < $1.subPrice }
        case .new: list.sort { $0.episodes < $1.episodes }
        default: break
        }
        return list
    }

    private var episodes: [Episode] {
        let list: [Episode]
        if let category { list = Mock.episodes.filter { $0.category == category } }
        else { list = Mock.episodes }
        let ql = q.lowercased()
        return ql.isEmpty ? list : list.filter { $0.title.lowercased().contains(ql) }
    }

    private var hero: Creator { creators.first ?? Mock.creators[0] }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                header
                searchRow
                categoryRail
                sortRail

                if creators.isEmpty {
                    EmptyState(
                        title: "No creators found",
                        message: "Nothing matches \"\(query)\". Try a city, a lifestyle, or clear your filters.",
                        iconName: "magnifyingglass",
                        action: "Clear search"
                    ) {
                        query = ""; category = nil
                    }
                } else {
                    if !searching {
                        heroCard
                        SectionHeader(kicker: "Handpicked", title: "POV identities")
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 12) {
                                ForEach(creators) { c in CreatorCard(creator: c) }
                            }
                            .padding(.horizontal, 18)
                        }
                    } else {
                        SectionHeader(kicker: "Search results", title: "\(creators.count) creators")
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 12) {
                                ForEach(creators) { c in CreatorCard(creator: c) }
                            }
                            .padding(.horizontal, 18)
                        }
                    }

                    if !episodes.isEmpty {
                        SectionHeader(kicker: "Unlockable", title: "Premium POV experiences", action: "See all") {
                            sort = .trending
                        }
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 12) {
                                let ppv = episodes.filter { $0.access == .ppv }
                                let rest = episodes.filter { $0.access != .ppv }
                                ForEach(ppv + rest.prefix(8)) { e in EpisodeTile(episode: e) }
                            }
                            .padding(.horizontal, 18)
                        }
                    }

                    if !searching && sort == .trending {
                        SectionHeader(kicker: "Climbing fast", title: "Rising this week")
                        VStack(spacing: 0) {
                            ForEach(Array(creators.prefix(5).enumerated()), id: \.element.id) { idx, c in
                                CreatorRow(creator: c, rightView: AnyView(
                                    HStack(spacing: 4) {
                                        Image(systemName: "arrow.trending.up").font(.system(size: 13)).foregroundStyle(Theme.lime)
                                        Text("+\(18 + idx * 7)%")
                                            .font(.system(size: 12.5, weight: .heavy))
                                            .foregroundStyle(Theme.lime)
                                    }
                                ))
                                if idx < min(4, creators.count - 1) { AppDivider().padding(.leading, 18) }
                            }
                        }
                        .padding(.horizontal, 18)
                        .background(Theme.surface)
                        .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
                        .clipShape(.rect(cornerRadius: Theme.rMd))
                        .padding(.horizontal, 18)
                    }

                    SectionHeader(kicker: "Browse by life", title: "Categories")
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 168), spacing: 10)], spacing: 10) {
                        ForEach(Category.all) { c in
                            PressableButton(scaleTo: 0.96) { category = c.id } label: {
                                VStack(alignment: .leading, spacing: 0) {
                                    Text(c.emoji).font(.system(size: 20)).padding(.bottom, 8)
                                    Text("\(c.label) POV")
                                        .font(.system(size: 14, weight: .heavy))
                                        .foregroundStyle(Theme.text)
                                    Text(c.tagline)
                                        .font(.system(size: 11.5, weight: .semibold))
                                        .foregroundStyle(Theme.textDim)
                                        .padding(.top, 3)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(14)
                                .background(Theme.surface)
                                .overlay(
                                    RoundedRectangle(cornerRadius: Theme.rMd)
                                        .stroke(c.accent.opacity(0.2), lineWidth: 1)
                                )
                                .clipShape(.rect(cornerRadius: Theme.rMd))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 18)
                }
            }
            .padding(.bottom, 110)
        }
        .background(Theme.bg.ignoresSafeArea())
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Explore lives")
                .font(.system(size: 30, weight: .heavy))
                .tracking(-1)
                .foregroundStyle(Theme.text)
            Text("\(Mock.creators.count) creators · \(Mock.episodes.count) POV episodes")
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(Theme.textDim)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 18)
        .padding(.top, 12)
        .padding(.bottom, 16)
    }

    private var searchRow: some View {
        HStack(spacing: 10) {
            HStack(spacing: 9) {
                Image(systemName: "magnifyingglass").font(.system(size: 16)).foregroundStyle(Theme.textDim)
                TextField("Search creators, cities, lifestyles", text: $query)
                    .font(.system(size: 14.5, weight: .semibold))
                    .foregroundStyle(Theme.text)
                    .autocorrectionDisabled()
                if searching {
                    PressableButton(scaleTo: 0.85) { query = "" } label: {
                        Image(systemName: "xmark").font(.system(size: 16)).foregroundStyle(Theme.textMid)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 14)
            .frame(height: 46)
            .background(Theme.surface)
            .overlay(RoundedRectangle(cornerRadius: Theme.rPill).stroke(Theme.border, lineWidth: 1))
            .clipShape(.rect(cornerRadius: Theme.rPill))

            ZStack {
                Image(systemName: "slider.horizontal.3")
                    .font(.system(size: 17, weight: .medium))
                    .foregroundStyle(Theme.lime)
            }
            .frame(width: 46, height: 46)
            .background(Theme.lime.opacity(0.1))
            .overlay(
                RoundedRectangle(cornerRadius: 23).stroke(Theme.lime.opacity(0.3), lineWidth: 1)
            )
            .clipShape(.rect(cornerRadius: 23))
        }
        .padding(.horizontal, 18)
    }

    private var categoryRail: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                Chip(label: "All", active: category == nil) { category = nil }
                ForEach(Category.all) { c in
                    Chip(label: c.label, active: category == c.id, accent: c.accent, emoji: c.emoji) {
                        category = c.id
                    }
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 14)
        }
    }

    private var sortRail: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 18) {
                ForEach(SortKey.allCases, id: \.self) { s in
                    PressableButton(scaleTo: 0.94) { sort = s } label: {
                        Text(s.label)
                            .font(.system(size: 11, weight: .heavy))
                            .tracking(1.4)
                            .textCase(.uppercase)
                            .foregroundStyle(sort == s ? Theme.text : Theme.textDim)
                            .underline(sort == s)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 16)
        }
    }

    private var heroCard: some View {
        let h = hero
        return PressableButton(scaleTo: 0.98) { router.push(.creator(h.id)) } label: {
            ZStack(alignment: .bottomLeading) {
                Color(Theme.surface).frame(height: 330)
                AsyncImage(url: URL(string: h.cover)) { phase in
                    switch phase {
                    case .success(let img): img.resizable().scaledToFill()
                    default: Color(Theme.surface)
                    }
                }
                .frame(height: 330)
                .overlay(
                    LinearGradient(
                        colors: [Theme.ink.opacity(0.2), Theme.ink.opacity(0.75), Theme.bg],
                        startPoint: .top, endPoint: .bottom
                    )
                )
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 6) {
                        Tag(label: "Editor's pick", color: Theme.ink, bg: Theme.lime)
                        Tag(label: "\(Fmt.count(h.subscribers)) living this life", color: Theme.text, bg: Color.black.opacity(0.5))
                    }
                    Text("Today, you wake up as \(h.name.split(separator: " ").first.map(String.init) ?? h.name).")
                        .font(.system(size: 25, weight: .heavy))
                        .tracking(-0.8)
                        .foregroundStyle(Theme.text)
                        .lineSpacing(5)
                    Text(h.bio)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(Theme.textMid)
                        .lineLimit(2)
                        .lineSpacing(4)
                    HStack {
                        Text("\(Fmt.moneyComma(h.subPrice))/mo")
                            .font(.system(size: 15, weight: .heavy))
                            .foregroundStyle(Theme.text)
                        Spacer()
                        Text("Live as them →")
                            .font(.system(size: 13.5, weight: .heavy))
                            .foregroundStyle(Theme.lime)
                    }
                    .padding(.top, 6)
                }
                .padding(20)
            }
            .frame(height: 330)
            .clipShape(.rect(cornerRadius: Theme.rLg))
            .padding(.horizontal, 18)
        }
        .buttonStyle(.plain)
    }
}

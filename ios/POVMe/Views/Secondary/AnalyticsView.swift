import SwiftUI

/// Analytics screen — creator stats: views, retention, top episodes, geo breakdown.
struct AnalyticsView: View {
    @Environment(AppState.self) private var app

    private var published: [StudioEpisode] { [] }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                headerStats
                SectionHeader(kicker: "Audience", title: "Reach & retention")
                reachCard
                SectionHeader(kicker: "Top performing", title: "Best episodes")
                topEpisodesList
                SectionHeader(kicker: "Where they watch", title: "Geography")
                geoCard
                SectionHeader(kicker: "Revenue mix", title: "Earnings breakdown")
                revenueMixCard
            }
            .padding(.bottom, 40)
        }
        .background(Theme.bg.ignoresSafeArea())
        .navigationTitle("Analytics")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var headerStats: some View {
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                StatTile(label: "Views", value: Fmt.count(app.creatorStats.views), sub: "all time", accent: Theme.lime)
                StatTile(label: "Subscribers", value: Fmt.count(app.creatorStats.subs), sub: "+42 this week")
            }
            HStack(spacing: 10) {
                StatTile(label: "PPV unlocks", value: "\(app.creatorStats.ppvUnlocks)", sub: "last 30 days", accent: Theme.cyan)
                StatTile(label: "Tips", value: Fmt.moneyComma(app.creatorStats.tips), sub: "this month", accent: Theme.gold)
            }
        }
        .padding(.horizontal, 18)
        .padding(.top, 16)
    }

    private var reachCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            retentionRow("Day 1", 1.0)
            retentionRow("Day 7", 0.71)
            retentionRow("Day 30", 0.43)
            HStack {
                Text("30-day retention").font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.textDim)
                Spacer()
                Text("\(Int(app.creatorStats.retention * 100))%").font(.system(size: 14, weight: .heavy)).foregroundStyle(Theme.magenta)
            }
            .padding(.top, 4)
        }
        .padding(18)
        .background(Theme.surface)
        .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
        .clipShape(.rect(cornerRadius: Theme.rMd))
        .padding(.horizontal, 18)
    }

    private func retentionRow(_ label: String, _ value: Double) -> some View {
        VStack(spacing: 6) {
            HStack {
                Text(label).font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.textDim)
                Spacer()
                Text("\(Int(value * 100))%").font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.text)
            }
            ProgressBar(progress: value, color: value > 0.6 ? Theme.lime : value > 0.4 ? Theme.gold : Theme.magenta)
        }
    }

    private var topEpisodesList: some View {
        VStack(spacing: 12) {
            ForEach(Array(published.sorted { $0.views > $1.views }.prefix(5).enumerated()), id: \.element.id) { idx, ep in
                HStack(spacing: 12) {
                    Text("\(idx + 1)")
                        .font(.system(size: 17, weight: .heavy))
                        .foregroundStyle(Theme.lime)
                        .frame(width: 24)
                    AsyncImage(url: URL(string: ep.thumb)) { phase in
                        switch phase {
                        case .success(let img): img.resizable().scaledToFill()
                        default: Color(Theme.surfaceHi)
                        }
                    }
                    .frame(width: 54, height: 54)
                    .clipShape(.rect(cornerRadius: 10))
                    VStack(alignment: .leading, spacing: 3) {
                        Text(ep.title)
                            .font(.system(size: 13, weight: .heavy)).foregroundStyle(Theme.text)
                            .lineLimit(1)
                        HStack(spacing: 10) {
                            Text("\(Fmt.count(ep.views)) views").font(.system(size: 11, weight: .bold)).foregroundStyle(Theme.textDim)
                            Text(Fmt.moneyComma(ep.earned)).font(.system(size: 11, weight: .bold)).foregroundStyle(Theme.lime)
                        }
                    }
                    Spacer()
                }
            }
        }
        .padding(.horizontal, 18)
    }

    private var geoCard: some View {
        let geo: [(flag: String, country: String, pct: Double)] = [
            ("🇺🇸", "United States", 0.42),
            ("🇬🇧", "United Kingdom", 0.18),
            ("🇯🇵", "Japan", 0.12),
            ("🇩🇪", "Germany", 0.09),
            ("🇧🇷", "Brazil", 0.07),
        ]
        return VStack(spacing: 10) {
            ForEach(Array(geo.enumerated()), id: \.offset) { _, g in
                VStack(spacing: 5) {
                    HStack {
                        Text(g.flag).font(.system(size: 16))
                        Text(g.country).font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.text)
                        Spacer()
                        Text("\(Int(g.pct * 100))%").font(.system(size: 13, weight: .heavy)).foregroundStyle(Theme.textMid)
                    }
                    ProgressBar(progress: g.pct, color: Theme.cyan)
                }
            }
        }
        .padding(18)
        .background(Theme.surface)
        .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
        .clipShape(.rect(cornerRadius: Theme.rMd))
        .padding(.horizontal, 18)
    }

    private var revenueMixCard: some View {
        let mix: [(label: String, value: Double, color: Color)] = [
            ("Subscriptions", app.creatorStats.net * 0.55, Theme.lime),
            ("PPV unlocks", app.creatorStats.net * 0.28, Theme.cyan),
            ("Tips & gifts", app.creatorStats.net * 0.17, Theme.gold),
        ]
        return VStack(alignment: .leading, spacing: 12) {
            ForEach(Array(mix.enumerated()), id: \.offset) { _, m in
                HStack {
                    Circle().fill(m.color).frame(width: 10, height: 10)
                    Text(m.label).font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.text)
                    Spacer()
                    Text(Fmt.moneyComma(m.value)).font(.system(size: 13, weight: .heavy)).foregroundStyle(m.color)
                }
            }
            AppDivider().padding(.vertical, 4)
            HStack {
                Text("Total net").font(.system(size: 14, weight: .heavy)).foregroundStyle(Theme.text)
                Spacer()
                Text(Fmt.moneyComma(app.creatorStats.net)).font(.system(size: 16, weight: .heavy)).foregroundStyle(Theme.lime)
            }
        }
        .padding(18)
        .background(Theme.surface)
        .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
        .clipShape(.rect(cornerRadius: Theme.rMd))
        .padding(.horizontal, 18)
    }
}

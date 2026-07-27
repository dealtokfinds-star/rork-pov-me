import SwiftUI

/// Admin / Trust & Safety center — moderation queue, reports, platform stats, user actions.
struct AdminView: View {
    @Environment(AppState.self) private var app
    @Environment(Router.self) private var router
    @State private var tab: AdminTab = .reports

    enum AdminTab: String, CaseIterable { case reports = "Reports", creators = "Creators", platform = "Platform" }

    private let mockReports: [(id: String, target: String, kind: String, reason: String, severity: String, date: String)] = [
        ("r1", "Episode e6", "Content", "Graphic violence in fight POV", "Medium", "2h ago"),
        ("r2", "@nocturna", "Harassment", "Alleged doxxing in chat", "High", "5h ago"),
        ("r3", "Stream l3", "Access", "PPV bypass attempt", "Low", "8h ago"),
        ("r4", "@portauprince", "Copyright", "Music in market footage", "Low", "1d ago"),
        ("r5", "Episode e2", "Safety", "Reckless driving POV", "Medium", "2d ago"),
    ]

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                header
                tabRow
                switch tab {
                case .reports: reportsTab
                case .creators: creatorsTab
                case .platform: platformTab
                }
            }
            .padding(.bottom, 40)
        }
        .background(Theme.bg.ignoresSafeArea())
        .navigationTitle("Trust & safety")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Trust & Safety Center").microLabel(Theme.cyan, size: 11)
            Text("Moderation, reports, and platform health")
                .font(.system(size: 22, weight: .heavy))
                .tracking(-0.8)
                .foregroundStyle(Theme.text)
            Text("Admin tools for keeping POVMe safe. Access requires an admin role.")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Theme.textMid)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 18)
        .padding(.top, 16)
        .padding(.bottom, 16)
    }

    private var tabRow: some View {
        HStack(spacing: 8) {
            ForEach(AdminTab.allCases, id: \.self) { t in
                Chip(label: t.rawValue, active: tab == t, accent: Theme.cyan) { tab = t }
            }
        }
        .padding(.horizontal, 18)
        .padding(.bottom, 16)
    }

    private var reportsTab: some View {
        VStack(spacing: 12) {
            VStack(spacing: 0) {
                ForEach(Array(mockReports.enumerated()), id: \.element.id) { idx, r in
                    reportRow(r)
                    if idx < mockReports.count - 1 { AppDivider().padding(.leading, 14) }
                }
            }
            .background(Theme.surface)
            .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
            .clipShape(.rect(cornerRadius: Theme.rMd))
            .padding(.horizontal, 18)

            HStack(spacing: 10) {
                StatTile(label: "Open", value: "5", sub: "awaiting review", accent: Theme.gold)
                StatTile(label: "Avg time", value: "3.2h", sub: "to resolution", accent: Theme.lime)
            }
            .padding(.horizontal, 18)
        }
    }

    private func reportRow(_ r: (id: String, target: String, kind: String, reason: String, severity: String, date: String)) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(r.target).font(.system(size: 14, weight: .heavy)).foregroundStyle(Theme.text)
                Spacer()
                Tag(label: r.severity, color: r.severity == "High" ? Theme.danger : r.severity == "Medium" ? Theme.gold : Theme.textMid,
                    bg: r.severity == "High" ? Theme.danger.opacity(0.15) : r.severity == "Medium" ? Theme.gold.opacity(0.15) : Color.white.opacity(0.07))
            }
            Text(r.reason).font(.system(size: 12.5, weight: .semibold)).foregroundStyle(Theme.textMid)
            HStack {
                Text(r.kind).font(.system(size: 11, weight: .bold)).foregroundStyle(Theme.textDim)
                Spacer()
                Text(r.date).font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.textDim)
            }
            HStack(spacing: 8) {
                AppButton(label: "Review", variant: .dark, full: false, small: true) {}
                    .frame(width: 90)
                AppButton(label: "Dismiss", variant: .ghost, full: false, small: true) {}
                    .frame(width: 90)
                AppButton(label: "Remove", full: false, small: true) {}
                    .frame(width: 90)
            }
        }
        .padding(14)
    }

    private var creatorsTab: some View {
        VStack(spacing: 12) {
            VStack(spacing: 0) {
                ForEach(Array(Mock.creators.enumerated()), id: \.element.id) { idx, c in
                    HStack(spacing: 12) {
                        Avatar(uri: c.avatar, size: 40, ring: true, live: c.isLive)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(c.name).font(.system(size: 14, weight: .heavy)).foregroundStyle(Theme.text)
                            Text("@\(c.handle) · \(Fmt.count(c.subscribers)) subs")
                                .font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.textDim)
                        }
                        Spacer()
                        if c.verified {
                            Tag(label: "Verified", color: Theme.ink, bg: Theme.lime)
                        }
                        AppButton(label: "Suspend", variant: .ghost, full: false, small: true) {}
                            .frame(width: 90)
                    }
                    .padding(.horizontal, 14).padding(.vertical, 12)
                    if idx < Mock.creators.count - 1 { AppDivider().padding(.leading, 66) }
                }
            }
            .background(Theme.surface)
            .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
            .clipShape(.rect(cornerRadius: Theme.rMd))
            .padding(.horizontal, 18)
        }
    }

    private var platformTab: some View {
        VStack(spacing: 16) {
            HStack(spacing: 10) {
                StatTile(label: "GMV", value: "$48.2K", sub: "this month", accent: Theme.lime)
                StatTile(label: "Platform cut", value: "$9.6K", sub: "20% take rate", accent: Theme.gold)
            }
            .padding(.horizontal, 18)
            HStack(spacing: 10) {
                StatTile(label: "Creators", value: "\(Mock.creators.count)", sub: "verified", accent: Theme.cyan)
                StatTile(label: "Payouts", value: "$38.6K", sub: "this month", accent: Theme.success)
            }
            .padding(.horizontal, 18)

            VStack(alignment: .leading, spacing: 12) {
                Text("Content moderation").microLabel(Theme.cyan, size: 10)
                moderationRow("eye.fill", Theme.lime, "CSAM scanning", "Enabled — every upload scanned pre-publish")
                moderationRow("shield.fill", Theme.cyan, "Vision API", "AWS Rekognition + Google Vision pipeline")
                moderationRow("person.2.fill", Theme.gold, "Manual review", "24h SLA on all flagged content")
            }
            .padding(18)
            .background(Theme.surface)
            .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
            .clipShape(.rect(cornerRadius: Theme.rMd))
            .padding(.horizontal, 18)
        }
    }

    private func moderationRow(_ icon: String, _ color: Color, _ title: String, _ body: String) -> some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(color.opacity(0.14)).frame(width: 36, height: 36)
                Image(systemName: icon).font(.system(size: 15, weight: .medium)).foregroundStyle(color)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.system(size: 14, weight: .heavy)).foregroundStyle(Theme.text)
                Text(body).font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.textDim)
            }
            Spacer()
            Image(systemName: "checkmark.circle.fill").font(.system(size: 16)).foregroundStyle(Theme.success)
        }
    }
}

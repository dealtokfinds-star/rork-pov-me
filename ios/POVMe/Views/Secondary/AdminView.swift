import SwiftUI

/// Admin / Trust & Safety center — moderation queue, creator applications,
/// platform stats. Mirrors the Expo admin screen.
struct AdminView: View {
    @Environment(AppState.self) private var app
    @Environment(Router.self) private var router
    @State private var tab: AdminTab = .applications

    enum AdminTab: String, CaseIterable {
        case applications = "Applications"
        case reports = "Reports"
        case creators = "Creators"
        case platform = "Platform"
    }

    // Applications
    @State private var applications: [PendingApp] = []
    @State private var loadingApps = true
    @State private var reviewing: PendingApp?
    @State private var rejecting: PendingApp?
    @State private var rejectReason = ""
    @State private var reviewBusy = false

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                header
                tabRow
                switch tab {
                case .applications: applicationsTab
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
        .task { await loadApplications() }
        .sheet(item: $reviewing) { app in reviewSheet(app) }
        .sheet(item: $rejecting) { app in rejectSheet(app) }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Trust & Safety Center").microLabel(Theme.cyan, size: 11)
            Text("Moderation, applications & platform health")
                .font(.system(size: 22, weight: .heavy))
                .tracking(-0.8)
                .foregroundStyle(Theme.text)
            Text("Admin tools for keeping POVMe safe. Review creator applications, handle reports, and monitor platform health.")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Theme.textMid)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 18)
        .padding(.top, 16)
        .padding(.bottom, 16)
    }

    private var tabRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(AdminTab.allCases, id: \.self) { t in
                    Chip(label: t.rawValue, active: tab == t, accent: Theme.cyan) { tab = t }
                }
            }
            .padding(.horizontal, 18)
        }
        .padding(.bottom, 16)
    }

    // MARK: - Applications tab

    private var applicationsTab: some View {
        VStack(spacing: 12) {
            HStack(spacing: 10) {
                StatTile(label: "Pending", value: "\(applications.count)", sub: "awaiting review", accent: Theme.gold)
                StatTile(label: "Avg time", value: "3.2h", sub: "to resolution", accent: Theme.lime)
            }
            .padding(.horizontal, 18)

            if loadingApps {
                ProgressView().tint(Theme.lime).padding(.top, 20)
            } else if applications.isEmpty {
                Text("No pending applications. 🎉")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.textDim)
                    .padding(.top, 20)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(applications.enumerated()), id: \.element.id) { idx, app in
                        applicationRow(app)
                        if idx < applications.count - 1 { AppDivider().padding(.leading, 14) }
                    }
                }
                .background(Theme.surface)
                .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
                .clipShape(.rect(cornerRadius: Theme.rMd))
                .padding(.horizontal, 18)
            }
        }
    }

    private func applicationRow(_ app: PendingApp) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                Avatar(uri: app.avatarURL ?? "", size: 44, ring: true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(app.name ?? app.handle ?? "Unknown")
                        .font(.system(size: 14, weight: .heavy))
                        .foregroundStyle(Theme.text)
                    Text(app.email ?? "")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Theme.textDim)
                    if let identity = app.identity {
                        Text(identity).font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.textMid)
                    }
                }
                Spacer()
                Tag(label: "PENDING", color: Theme.ink, bg: Theme.gold)
            }

            HStack(spacing: 8) {
                AppButton(label: "Review", variant: .dark, full: false, small: true) { reviewing = app }
                    .frame(width: 90)
                AppButton(label: "Approve", variant: .primary, full: false, small: true) {
                    Task { await approve(app) }
                }
                .frame(width: 90)
                AppButton(label: "Reject", variant: .ghost, full: false, small: true) {
                    rejecting = app
                    rejectReason = ""
                }
                .frame(width: 90)
            }
        }
        .padding(14)
    }

    private func reviewSheet(_ app: PendingApp) -> some View {
        VStack(spacing: 16) {
            HStack {
                Text("Review application").font(.system(size: 18, weight: .heavy)).foregroundStyle(Theme.text)
                Spacer()
                Button { reviewing = nil } label: {
                    Image(systemName: "xmark").font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.textMid)
                }
            }

            HStack(spacing: 12) {
                Avatar(uri: app.avatarURL ?? "", size: 48, ring: true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(app.name ?? app.handle ?? "Unknown").font(.system(size: 15, weight: .heavy)).foregroundStyle(Theme.text)
                    Text("@\(app.handle ?? "—") · \(app.email ?? "")").font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.textDim)
                    if let identity = app.identity {
                        Text(identity).font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.lime)
                    }
                }
                Spacer()
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    if let docs = app.documents {
                        kycImage("ID front", docs.front)
                        kycImage("ID back", docs.back)
                        kycImage("Selfie", docs.selfie)
                    }
                }
            }

            HStack(spacing: 10) {
                AppButton(label: "Cancel", variant: .ghost, full: true) { reviewing = nil }
                AppButton(label: reviewBusy ? "Approving…" : "Approve", variant: .primary, full: true) {
                    Task { await approve(app); reviewing = nil }
                }
            }
        }
        .padding(20)
        .background(Theme.surface)
    }

    private func rejectSheet(_ app: PendingApp) -> some View {
        VStack(spacing: 16) {
            HStack {
                Text("Reject application").font(.system(size: 18, weight: .heavy)).foregroundStyle(Theme.text)
                Spacer()
                Button { rejecting = nil } label: {
                    Image(systemName: "xmark").font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.textMid)
                }
            }
            Text("Rejecting \(app.name ?? app.handle ?? "this creator"). They will be emailed and can resubmit.")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.textMid)

            TextEditor(text: $rejectReason)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Theme.text)
                .frame(height: 90)
                .padding(8)
                .background(Theme.bg)
                .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
                .clipShape(.rect(cornerRadius: Theme.rMd))
                .overlay(alignment: .topLeading) {
                    if rejectReason.isEmpty {
                        Text("e.g. ID photo too blurry — retake in good light")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(Theme.textDim)
                            .padding(.leading, 12).padding(.top, 12)
                            .allowsHitTesting(false)
                    }
                }

            HStack(spacing: 10) {
                AppButton(label: "Cancel", variant: .ghost, full: true) { rejecting = nil }
                AppButton(label: reviewBusy ? "Rejecting…" : "Reject", variant: .live, full: true) {
                    Task { await reject(app); rejecting = nil }
                }
            }
        }
        .padding(20)
        .background(Theme.surface)
    }

    @State private var docImageCache: [String: UIImage] = [:]

    private func kycImage(_ label: String, _ path: String) -> some View {
        VStack(spacing: 6) {
            Text(label).font(.system(size: 10.5, weight: .heavy)).tracking(0.5).textCase(.uppercase).foregroundStyle(Theme.textDim)
            ZStack {
                Color(Theme.bg).frame(width: 100, height: 140)
                if let img = docImageCache[path] {
                    Image(uiImage: img).resizable().scaledToFill().frame(width: 100, height: 140).clipped().allowsHitTesting(false)
                } else {
                    ProgressView().tint(Theme.lime).scaleEffect(0.8)
                }
            }
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.border, lineWidth: 1))
            .clipShape(.rect(cornerRadius: 10))
        }
        .task {
            if docImageCache[path] == nil {
                if let urlStr = await CreatorOnboardingClient.shared.signedUrl(for: path),
                   let url = URL(string: urlStr),
                   let (data, _) = try? await URLSession.shared.data(from: url),
                   let img = UIImage(data: data) {
                    docImageCache[path] = img
                }
            }
        }
    }

    // MARK: - Reports tab

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
        }
        .padding(14)
    }

    // MARK: - Creators tab

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
                        if c.verified { Tag(label: "Verified", color: Theme.ink, bg: Theme.lime) }
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

    // MARK: - Platform tab

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

    // MARK: - Actions

    private func loadApplications() async {
        loadingApps = true
        // In production this would call the admin-actions edge function or a
        // dedicated query. For the clone we keep the mock data so the UI is
        // fully functional for preview.
        applications = mockApplications
        loadingApps = false
    }

    private func approve(_ app: PendingApp) async {
        reviewBusy = true
        // Production: call admin-actions with approve_creator
        applications.removeAll { $0.id == app.id }
        Hap.success()
        reviewBusy = false
    }

    private func reject(_ app: PendingApp) async {
        reviewBusy = true
        // Production: call admin-actions with reject_creator + reason
        applications.removeAll { $0.id == app.id }
        Hap.heavy()
        reviewBusy = false
    }

    // MARK: - Mock data

    private let mockReports: [(id: String, target: String, kind: String, reason: String, severity: String, date: String)] = [
        ("r1", "Episode e6", "Content", "Graphic violence in fight POV", "Medium", "2h ago"),
        ("r2", "@nocturna", "Harassment", "Alleged doxxing in chat", "High", "5h ago"),
        ("r3", "Stream l3", "Access", "PPV bypass attempt", "Low", "8h ago"),
    ]

    private let mockApplications: [PendingApp] = [
        PendingApp(
            id: "a1", name: "Maya Torres", handle: "mayatorres", email: "maya@example.com",
            avatarURL: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80",
            identity: "Salsa dancer in Havana", price: 12.99, location: "Havana, CU",
            documents: .init(front: "placeholder/front.jpg", back: "placeholder/back.jpg", selfie: "placeholder/selfie.jpg")
        ),
        PendingApp(
            id: "a2", name: "Kenji Watanabe", handle: "kenjiw", email: "kenji@example.com",
            avatarURL: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
            identity: "Sushi chef in Tokyo", price: 14.99, location: "Tokyo, JP",
            documents: .init(front: "placeholder/front2.jpg", back: "placeholder/back2.jpg", selfie: "placeholder/selfie2.jpg")
        ),
    ]
}

// MARK: - Models

struct PendingApp: Identifiable {
    let id: String
    let name: String?
    let handle: String?
    let email: String?
    let avatarURL: String?
    let identity: String?
    let price: Double
    let location: String?
    let documents: KycDocs?

    struct KycDocs { let front: String; let back: String; let selfie: String }
}

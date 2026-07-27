import SwiftUI

/// Content guidelines screen — static policy text.
struct GuidelinesView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                introCard
                guidelineSection("What POVMe allows",
                    icon: "checkmark.circle.fill", color: Theme.success,
                    items: [
                        "First-person POV footage filmed on chest rigs, glasses, helmet cams, or phones",
                        "Everyday life across work, sport, travel, nightlife, and culture",
                        "Live streams from body cams with real-time chat",
                        "Consensual documentary-style content of the creator's own life",
                    ])
                guidelineSection("What POVMe does NOT allow",
                    icon: "xmark.circle.fill", color: Theme.danger,
                    items: [
                        "Sexually explicit content or nudity",
                        "Content filmed without the subject's knowledge or consent",
                        "Minors in any non-family-context footage",
                        "Dangerous or illegal acts, violence, or weapons promotion",
                        "Hate speech, harassment, or doxxing",
                        "Filming in private spaces where others have a reasonable expectation of privacy",
                    ])
                guidelineSection("Body cam & POV rules",
                    icon: "video.fill", color: Theme.lime,
                    items: [
                        "Chest rigs and helmet cams must capture the creator's own POV, not bystanders'",
                        "Audio recording is subject to local two-party consent laws — know your jurisdiction",
                        "Private conversations captured incidentally must be edited out before publishing",
                        "Gym, club, and venue footage requires the venue's filming permission",
                    ])
                guidelineSection("Payout & compliance",
                    icon: "banknote.fill", color: Theme.gold,
                    items: [
                        "Creators must be 18+ and pass Stripe Identity KYC before payouts",
                        "Tax forms (W-9 / W-8BEN) are required and collected via Stripe Connect",
                        "1099-K forms are generated automatically at year end when thresholds are met",
                        "Payouts are held during content review or disputed charge investigations",
                        "Creators keep 80% of net revenue; povme takes a 20% platform fee",
                    ])
                guidelineSection("Reporting & enforcement",
                    icon: "shield.fill", color: Theme.cyan,
                    items: [
                        "Report any episode or stream from its detail page or the Trust & Safety center",
                        "Reviewed within 24 hours; strikes issued for violations",
                        "Three strikes result in permanent account suspension",
                        "Appeals can be submitted via support@povme.app",
                        "CSAM scanning runs on every upload via automated moderation before publish",
                    ])
            }
            .padding(.horizontal, 18)
            .padding(.top, 16)
            .padding(.bottom, 40)
        }
        .background(Theme.bg.ignoresSafeArea())
        .navigationTitle("Content guidelines")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var introCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("The POVMe promise").microLabel(Theme.lime, size: 11)
            Text("POVMe is a first-person life streaming platform. We exist to let people step inside someone else's day — safely, consensually, and with respect for everyone on camera.")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Theme.textMid)
                .lineSpacing(7)
            Text("These guidelines apply to every creator and viewer. Breaking them risks your account, your payouts, and legal action.")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.text)
                .lineSpacing(5)
        }
        .padding(18)
        .background(Theme.surface)
        .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
        .clipShape(.rect(cornerRadius: Theme.rMd))
    }

    private func guidelineSection(_ title: String, icon: String, color: Color, items: [String]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Image(systemName: icon).font(.system(size: 18, weight: .medium)).foregroundStyle(color)
                Text(title).font(.system(size: 17, weight: .heavy)).foregroundStyle(Theme.text)
            }
            VStack(alignment: .leading, spacing: 8) {
                ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                    HStack(alignment: .top, spacing: 8) {
                        Circle().fill(color).frame(width: 5, height: 5).padding(.top, 7)
                        Text(item)
                            .font(.system(size: 13.5, weight: .medium))
                            .foregroundStyle(Theme.textMid)
                            .lineSpacing(5)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
        .padding(18)
        .background(Theme.surface)
        .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
        .clipShape(.rect(cornerRadius: Theme.rMd))
    }
}

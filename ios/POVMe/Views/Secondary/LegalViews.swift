import SwiftUI

/// Legal pages — Terms, Privacy, 2257. Static policy text matching the Expo app.
struct LegalTermsView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                legalHeader("Terms of Use", kicker: "Last updated: July 2026", icon: "doc.text.fill")
                section("1. Acceptance of Terms",
                    "By creating a POVMe account, you agree to these Terms and our Content Guidelines. If you're under 18, you may not use POVMe. If you're a creator, you additionally agree to the Creator Agreement and Stripe Connect terms.")
                section("2. What POVMe Is",
                    "POVMe is a first-person life streaming platform. Creators upload POV footage filmed on body cams, glasses, or phones. Subscribers pay to access that feed. POVMe is not a pornographic platform — sexually explicit content is prohibited.")
                section("3. Accounts",
                    "You must sign in with Google or Apple. You're responsible for keeping your account secure and for all activity under it. One person, one account. No bots, no shared logins.")
                section("4. Subscriptions & Payments",
                    "Subscriptions renew monthly until cancelled. You can cancel anytime from Settings. PPV unlocks are one-time and non-refundable once the content is viewed. Tips are final. Wallet top-ups are processed via Stripe.")
                section("5. Creator Revenue",
                    "Creators keep 80% of net revenue (subscriptions + PPV + tips + live gifts). POVMe takes a 20% platform fee covering hosting, video processing, payments, moderation, and support. Payouts are weekly via Stripe Connect after KYC.")
                section("6. Content Rules",
                    "All content must follow our Content Guidelines. You must have the right to film and publish everything you upload. POVMe reserves the right to remove any content and suspend any account without notice.")
                section("7. Prohibited Conduct",
                    "No sexually explicit content. No filming without consent. No minors in non-family contexts. No dangerous or illegal acts. No hate speech, harassment, or doxxing. No filming in private spaces where others expect privacy.")
                section("8. Termination",
                    "We can suspend or terminate your account for violations. You can delete your account anytime from Settings — all your data is removed within 30 days (GDPR-compliant).")
                section("9. Disclaimers",
                    "POVMe is provided 'as is.' We don't guarantee uptime, revenue, or that any content will remain available. Creators are independent contractors, not employees.")
                section("10. Changes",
                    "We can update these Terms anytime. Material changes get 30 days notice via email or in-app. Continued use after changes means you accept them.")
            }
            .padding(.horizontal, 18)
            .padding(.top, 16)
            .padding(.bottom, 40)
        }
        .background(Theme.bg.ignoresSafeArea())
        .navigationTitle("Terms of Use")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func legalHeader(_ title: String, kicker: String, icon: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            ZStack {
                Circle().fill(Theme.lime.opacity(0.14)).frame(width: 48, height: 48)
                Image(systemName: icon).font(.system(size: 22, weight: .medium)).foregroundStyle(Theme.lime)
            }
            Text(kicker).microLabel(Theme.textDim, size: 10)
            Text(title).font(.system(size: 28, weight: .heavy)).tracking(-1).foregroundStyle(Theme.text)
        }
    }

    private func section(_ title: String, _ body: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.system(size: 16, weight: .heavy)).foregroundStyle(Theme.text)
            Text(body).font(.system(size: 13.5, weight: .medium)).foregroundStyle(Theme.textMid).lineSpacing(7)
        }
        .padding(18)
        .background(Theme.surface)
        .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
        .clipShape(.rect(cornerRadius: Theme.rMd))
    }
}

struct LegalPrivacyView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                legalHeader("Privacy Policy", kicker: "Last updated: July 2026", icon: "lock.shield.fill")
                section("1. What We Collect",
                    "Your Google/Apple sign-in identity (name, email, profile picture). Your wallet balance, subscriptions, and transaction history. Your onboarding preferences. If you're a creator: your Stripe Connect KYC data, payout details, and uploaded content.")
                section("2. How We Use It",
                    "To authenticate you, process payments, deliver subscriptions, personalize your feed, send notifications, and comply with legal obligations. We never sell your data to third parties.")
                section("3. Storage",
                    "Identity and app data live in Supabase (encrypted at rest). Payment data is handled by Stripe — we never see your card numbers. Video content is stored and delivered via Mux. Messages are end-to-end private between you and the creator.")
                section("4. Your Rights (GDPR / CCPA)",
                    "You can export all your data from Settings → Export. You can delete your account and all associated data from Settings → Reset account. Deletion completes within 30 days. Contact privacy@povme.app for any data request.")
                section("5. Cookies & Tracking",
                    "We use minimal analytics to understand app usage. No third-party advertising trackers. No cross-app tracking. Push notifications require your explicit opt-in.")
                section("6. Children",
                    "POVMe is 18+ only. We don't knowingly collect data from minors. Creators pass Stripe Identity age verification. If you believe a minor is on POVMe, report via the Trust & Safety center.")
                section("7. Security",
                    "Row-level security on every database table. Stripe handles payment security (PCI-DSS). Mux handles video DRM. We run automated CSAM scanning on every upload. All traffic is HTTPS/TLS.")
                section("8. Changes",
                    "We'll notify you of material privacy changes 30 days before they take effect. Check back here for the latest version.")
            }
            .padding(.horizontal, 18)
            .padding(.top, 16)
            .padding(.bottom, 40)
        }
        .background(Theme.bg.ignoresSafeArea())
        .navigationTitle("Privacy Policy")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func legalHeader(_ title: String, kicker: String, icon: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            ZStack {
                Circle().fill(Theme.cyan.opacity(0.14)).frame(width: 48, height: 48)
                Image(systemName: icon).font(.system(size: 22, weight: .medium)).foregroundStyle(Theme.cyan)
            }
            Text(kicker).microLabel(Theme.textDim, size: 10)
            Text(title).font(.system(size: 28, weight: .heavy)).tracking(-1).foregroundStyle(Theme.text)
        }
    }

    private func section(_ title: String, _ body: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.system(size: 16, weight: .heavy)).foregroundStyle(Theme.text)
            Text(body).font(.system(size: 13.5, weight: .medium)).foregroundStyle(Theme.textMid).lineSpacing(7)
        }
        .padding(18)
        .background(Theme.surface)
        .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
        .clipShape(.rect(cornerRadius: Theme.rMd))
    }
}

struct Legal2257View: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                legalHeader("2257 Compliance", kicker: "Record-keeping statement", icon: "checkmark.shield.fill")
                section("18 U.S.C. § 2257 Statement",
                    "POVMe is not a producer of sexually explicit content — such content is prohibited on the platform. However, POVMe complies with 18 U.S.C. § 2257 record-keeping requirements for all creator-generated content depicting individuals.")
                section("Creator Responsibility",
                    "All creators must verify they are 18+ via Stripe Identity KYC before publishing. Creators are responsible for maintaining records of consent and age for every identifiable person in their footage, as required by law.")
                section("Custodian of Records",
                    "POVMe Inc. acts as custodian of records for creator identity verification. Records are stored securely and accessible only to authorized compliance personnel and law enforcement upon valid request.")
                section("Content Review",
                    "Every upload is scanned by automated CSAM detection (AWS Rekognition + Google Vision) before publication. Flagged content is held for manual review within 24 hours. Confirmed violations result in immediate removal and account suspension.")
                section("Reporting",
                    "To report content that may violate § 2257 or depict a minor, use the Report button on any episode/stream or contact compliance@povme.app. We respond within 24 hours and cooperate fully with law enforcement.")
                section("Location of Records",
                    "POVMe Inc., 1234 Market St, San Francisco, CA 94103. Records available during business hours with valid legal process.")
            }
            .padding(.horizontal, 18)
            .padding(.top, 16)
            .padding(.bottom, 40)
        }
        .background(Theme.bg.ignoresSafeArea())
        .navigationTitle("2257 Compliance")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func legalHeader(_ title: String, kicker: String, icon: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            ZStack {
                Circle().fill(Theme.gold.opacity(0.14)).frame(width: 48, height: 48)
                Image(systemName: icon).font(.system(size: 22, weight: .medium)).foregroundStyle(Theme.gold)
            }
            Text(kicker).microLabel(Theme.textDim, size: 10)
            Text(title).font(.system(size: 28, weight: .heavy)).tracking(-1).foregroundStyle(Theme.text)
        }
    }

    private func section(_ title: String, _ body: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.system(size: 16, weight: .heavy)).foregroundStyle(Theme.text)
            Text(body).font(.system(size: 13.5, weight: .medium)).foregroundStyle(Theme.textMid).lineSpacing(7)
        }
        .padding(18)
        .background(Theme.surface)
        .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
        .clipShape(.rect(cornerRadius: Theme.rMd))
    }
}

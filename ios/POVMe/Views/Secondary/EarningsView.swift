import SwiftUI

/// Earnings & payouts screen — creator balance, payout history, request payout.
struct EarningsView: View {
    @Environment(AppState.self) private var app
    @Environment(Router.self) private var router
    @State private var showRequestPayout = false
    @State private var payoutAmount = ""
    @State private var processing = false
    @State private var success = false

    private let mockPayouts: [(date: String, amount: Double, status: String)] = [
        ("Jul 22, 2026", 1840.50, "Paid"),
        ("Jul 15, 2026", 2204.90, "Paid"),
        ("Jul 8, 2026", 122.40, "Paid"),
        ("Jul 1, 2026", 612.30, "Paid"),
    ]

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                if !app.isVerified {
                    kycGate
                } else {
                    balanceCard
                    statsRow
                    SectionHeader(kicker: "Money out", title: "Request a payout")
                    payoutCard
                    SectionHeader(kicker: "History", title: "Recent payouts")
                    payoutsList
                    SectionHeader(kicker: "Compliance", title: "Payout settings")
                    complianceCard
                }
            }
            .padding(.bottom, 40)
        }
        .background(Theme.bg.ignoresSafeArea())
        .navigationTitle("Earnings & payouts")
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - KYC Gate

    private var kycGate: some View {
        VStack(spacing: 16) {
            Spacer()
            ZStack {
                Circle()
                    .fill(Theme.lime.opacity(0.12))
                    .frame(width: 66, height: 66)
                    .overlay(Circle().stroke(Theme.lime.opacity(0.3), lineWidth: 1.5))
                Image(systemName: "checkmark.shield.fill")
                    .font(.system(size: 28))
                    .foregroundStyle(Theme.lime)
            }
            Text("Verify your identity to withdraw")
                .font(.system(size: 22, weight: .heavy))
                .tracking(-0.8)
                .foregroundStyle(Theme.text)
                .multilineTextAlignment(.center)
            Text("Complete identity verification to request payouts and withdraw your earnings.")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Theme.textMid)
                .multilineTextAlignment(.center)
                .lineSpacing(5)
            AppButton(label: "Go to verification") {
                router.push(.becomeCreator)
            }
            .frame(width: 240)
            .padding(.top, 8)
            Spacer()
        }
        .padding(.horizontal, 30)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var balanceCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Available to withdraw").microLabel(Theme.lime, size: 10)
            Text(Fmt.moneyComma(app.creatorStats.net))
                .font(.system(size: 48, weight: .heavy))
                .tracking(-2)
                .foregroundStyle(Theme.text)
                .padding(.top, 8)
            HStack(spacing: 16) {
                HStack(spacing: 4) {
                    Image(systemName: "arrow.trending.up").font(.system(size: 12)).foregroundStyle(Theme.lime)
                    Text("\(Fmt.moneyComma(app.creatorStats.gross)) gross")
                        .font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.textMid)
                }
                HStack(spacing: 4) {
                    Image(systemName: "percent").font(.system(size: 12)).foregroundStyle(Theme.lime)
                    Text("80% share")
                        .font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.textMid)
                }
            }
            .padding(.top, 6)
            AppButton(label: processing ? "Processing…" : "Withdraw \(Fmt.moneyComma(app.creatorStats.net))", disabled: processing) {
                processPayout()
            }
            .padding(.top, 18)
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient(colors: [Theme.lime.opacity(0.16), Theme.surface.opacity(0.2)], startPoint: .topLeading, endPoint: .bottomTrailing)
        )
        .overlay(RoundedRectangle(cornerRadius: Theme.rLg).stroke(Theme.lime.opacity(0.24), lineWidth: 1))
        .clipShape(.rect(cornerRadius: Theme.rLg))
        .padding(.horizontal, 18)
        .padding(.top, 16)
    }

    private var statsRow: some View {
        HStack(spacing: 10) {
            StatTile(label: "This month", value: Fmt.moneyComma(app.creatorStats.net), sub: "net earnings", accent: Theme.lime)
            StatTile(label: "Tips", value: Fmt.moneyComma(app.creatorStats.tips), sub: "this month", accent: Theme.gold)
        }
        .padding(.horizontal, 18)
        .padding(.top, 10)
    }

    private var payoutCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            if success {
                HStack(spacing: 10) {
                    Image(systemName: "checkmark.circle.fill").font(.system(size: 16)).foregroundStyle(Theme.success)
                    Text("Payout requested! Funds arrive in 1-3 business days.").font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.success)
                    Spacer()
                }
                .padding(.horizontal, 14).padding(.vertical, 12)
                .background(Theme.success.opacity(0.12))
                .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.success.opacity(0.35), lineWidth: 1))
                .clipShape(.rect(cornerRadius: Theme.rMd))
            }
            HStack {
                Text("Payout method").font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.textDim)
                Spacer()
                Text(app.payoutConnected ? "PayPal / Bank · via Lemon Squeezy" : "Add payout details in Become a Creator")
                    .font(.system(size: 13, weight: .heavy))
                    .foregroundStyle(app.payoutConnected ? Theme.lime : Theme.danger)
                    .multilineTextAlignment(.trailing)
            }
            HStack {
                Text("Minimum payout").font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.textDim)
                Spacer()
                Text("$1.00").font(.system(size: 14, weight: .heavy)).foregroundStyle(Theme.text)
            }
            HStack {
                Text("Payout schedule").font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.textDim)
                Spacer()
                Text("Weekly · PayPal or bank").font(.system(size: 14, weight: .heavy)).foregroundStyle(Theme.text)
            }
        }
        .padding(18)
        .background(Theme.surface)
        .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
        .clipShape(.rect(cornerRadius: Theme.rMd))
        .padding(.horizontal, 18)
    }

    private var payoutsList: some View {
        VStack(spacing: 0) {
            ForEach(Array(mockPayouts.enumerated()), id: \.offset) { idx, p in
                HStack(spacing: 12) {
                    ZStack {
                        Circle().fill(Theme.success.opacity(0.14)).frame(width: 38, height: 38)
                        Image(systemName: "banknote.fill").font(.system(size: 16, weight: .medium)).foregroundStyle(Theme.success)
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Payout to bank account")
                            .font(.system(size: 13.5, weight: .heavy)).foregroundStyle(Theme.text)
                        Text(p.date).font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.textDim)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("+\(Fmt.moneyComma(p.amount))")
                            .font(.system(size: 14, weight: .heavy)).foregroundStyle(Theme.lime)
                        Text(p.status).font(.system(size: 10, weight: .heavy)).tracking(0.8).textCase(.uppercase).foregroundStyle(Theme.success)
                    }
                }
                .padding(.horizontal, 14).padding(.vertical, 12)
                if idx < mockPayouts.count - 1 { AppDivider().padding(.leading, 58) }
            }
        }
        .padding(.horizontal, 18)
        .background(Theme.surface)
        .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
        .clipShape(.rect(cornerRadius: Theme.rMd))
        .padding(.horizontal, 18)
    }

    private var complianceCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            complianceRow("checkmark.shield.fill", Theme.lime, "Payouts via Lemon Squeezy", "MoR handles tax remittance on fan payments")
            complianceRow("percent", Theme.cyan, "Platform fee", "povme keeps 20% of gross")
            complianceRow("banknote.fill", Theme.gold, "Weekly payouts", "To your saved PayPal or bank account")
        }
        .padding(18)
        .background(Theme.surface)
        .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
        .clipShape(.rect(cornerRadius: Theme.rMd))
        .padding(.horizontal, 18)
    }

    private func complianceRow(_ icon: String, _ color: Color, _ title: String, _ body: String) -> some View {
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
            Image(systemName: "checkmark.circle.fill").font(.system(size: 18)).foregroundStyle(Theme.success)
        }
    }

    private func processPayout() {
        guard app.creatorStats.net >= 1 else { return }
        processing = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            processing = false
            success = true
        }
    }
}

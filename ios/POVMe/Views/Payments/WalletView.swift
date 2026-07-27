import SwiftUI

/// Wallet modal — balance, top-up, payment methods, transaction history.
struct WalletView: View {
    @Environment(AppState.self) private var app
    @Environment(Router.self) private var router
    @State private var showTopUp = false
    @State private var topUpAmount: Double = 20
    @State private var processing = false

    private let topUpOptions: [Double] = [10, 20, 50, 100, 250]

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                balanceCard
                statsRow
                SectionHeader(kicker: "Add funds", title: "Top up wallet")
                topUpGrid
                SectionHeader(kicker: "Activity", title: "Transactions")
                transactionsList
            }
            .padding(.bottom, 40)
        }
        .background(Theme.bg.ignoresSafeArea())
        .navigationTitle("Wallet")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var balanceCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Available balance").microLabel(Theme.lime, size: 10)
            Text(Fmt.moneyComma(app.balance))
                .font(.system(size: 48, weight: .heavy))
                .tracking(-2)
                .foregroundStyle(Theme.text)
                .padding(.top, 8)
            HStack(spacing: 16) {
                HStack(spacing: 4) {
                    Image(systemName: "arrow.trending.down").font(.system(size: 12)).foregroundStyle(Theme.textDim)
                    Text("\(Fmt.moneyComma(app.totalSpent)) spent")
                        .font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.textDim)
                }
                HStack(spacing: 4) {
                    Image(systemName: "creditcard.fill").font(.system(size: 12)).foregroundStyle(Theme.textDim)
                    Text("\(Fmt.moneyComma(app.monthlySpend))/mo subs")
                        .font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.textDim)
                }
            }
            .padding(.top, 6)
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
            StatTile(label: "Subscriptions", value: "\(app.activeSubs.count)", sub: "active", accent: Theme.lime)
            StatTile(label: "Unlocked", value: "\(app.unlockedEpisodes.count)", sub: "POV episodes", accent: Theme.cyan)
        }
        .padding(.horizontal, 18)
        .padding(.top, 10)
    }

    private var topUpGrid: some View {
        VStack(spacing: 0) {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 100), spacing: 10)], spacing: 10) {
                ForEach(topUpOptions, id: \.self) { amt in
                    PressableButton(scaleTo: 0.94, haptic: Hap.medium) {
                        processTopUp(amt)
                    } label: {
                        VStack(spacing: 4) {
                            Text("+\(Fmt.moneyComma(amt))")
                                .font(.system(size: 17, weight: .heavy))
                                .foregroundStyle(Theme.lime)
                            Text(processing && topUpAmount == amt ? "Processing…" : "Add to wallet")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundStyle(Theme.textDim)
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 64)
                        .background(Theme.surface)
                        .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.lime.opacity(0.25), lineWidth: 1))
                        .clipShape(.rect(cornerRadius: Theme.rMd))
                    }
                    .buttonStyle(.plain)
                    .disabled(processing)
                }
            }
            Text("Demo mode — funds added instantly. Real payments use Stripe Checkout in the Expo app.")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.textDim)
                .multilineTextAlignment(.center)
                .lineSpacing(4)
                .padding(.top, 14)
        }
        .padding(.horizontal, 18)
    }

    private var transactionsList: some View {
        VStack(spacing: 0) {
            if app.transactions.isEmpty {
                EmptyState(
                    title: "No transactions yet",
                    message: "Your subscriptions, unlocks, tips, and top-ups will show here.",
                    iconName: "doc.text.magnifyingglass"
                )
            } else {
                ForEach(Array(app.transactions.enumerated()), id: \.element.id) { idx, tx in
                    transactionRow(tx)
                    if idx < app.transactions.count - 1 {
                        AppDivider().padding(.leading, 58)
                    }
                }
            }
        }
        .padding(.horizontal, 18)
        .background(Theme.surface)
        .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
        .clipShape(.rect(cornerRadius: Theme.rMd))
        .padding(.horizontal, 18)
    }

    private func transactionRow(_ tx: Transaction) -> some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(Theme.surfaceHi).frame(width: 38, height: 38)
                Image(systemName: txIcon(tx.kind))
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(txColor(tx.kind))
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(tx.label)
                    .font(.system(size: 13.5, weight: .heavy))
                    .foregroundStyle(Theme.text)
                    .lineLimit(1)
                Text(tx.at.formatted(.dateTime.month(.abbreviated).day().hour().minute()))
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.textDim)
            }
            Spacer()
            Text(txAmountText(tx))
                .font(.system(size: 14, weight: .heavy))
                .foregroundStyle(tx.kind == .topup || tx.kind == .payout ? Theme.lime : Theme.text)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
    }

    private func txIcon(_ kind: Transaction.TxKind) -> String {
        switch kind {
        case .sub: return "person.2.fill"
        case .tip, .gift: return "sparkles"
        case .ppv: return "lock.fill"
        case .topup: return "plus.circle.fill"
        case .payout: return "banknote.fill"
        }
    }

    private func txColor(_ kind: Transaction.TxKind) -> Color {
        switch kind {
        case .sub: return Theme.lime
        case .tip, .gift: return Theme.gold
        case .ppv: return Theme.cyan
        case .topup: return Theme.lime
        case .payout: return Theme.success
        }
    }

    private func txAmountText(_ tx: Transaction) -> String {
        let prefix = tx.kind == .topup || tx.kind == .payout ? "+" : "-"
        return "\(prefix)\(Fmt.moneyComma(tx.amount))"
    }

    private func processTopUp(_ amount: Double) {
        processing = true
        topUpAmount = amount
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
            app.topUp(amount)
            processing = false
        }
    }
}

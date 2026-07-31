import SwiftUI

/// Wallet modal — balance, top-up via Stripe, transaction history from Supabase.
struct WalletView: View {
    @Environment(AppState.self) private var app
    @Environment(Router.self) private var router
    @State private var processing: Double?
    @State private var payError: String?

    private let topUpOptions: [Double] = [10, 20, 50, 100, 250]

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                balanceCard
                statsRow
                SectionHeader(kicker: "Stripe Checkout", title: "Add funds")
                if let payError {
                    errorBanner
                }
                topUpGrid
                SectionHeader(kicker: "Activity", title: "Transactions")
                transactionsPlaceholder
            }
            .padding(.bottom, 40)
        }
        .background(Theme.bg.ignoresSafeArea())
        .navigationTitle("Wallet")
        .navigationBarTitleDisplayMode(.inline)
        .task { await app.refreshWallet() }
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
            StatTile(label: "Saved", value: "\(app.savedEpisodes.count)", sub: "POV episodes", accent: Theme.cyan)
        }
        .padding(.horizontal, 18)
        .padding(.top, 10)
    }

    private var errorBanner: some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill").font(.system(size: 14)).foregroundStyle(Theme.danger)
            Text(payError!).font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.danger)
            Spacer()
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
        .background(Theme.danger.opacity(0.1))
        .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.danger.opacity(0.3), lineWidth: 1))
        .clipShape(.rect(cornerRadius: Theme.rMd))
        .padding(.horizontal, 18)
        .padding(.bottom, 8)
    }

    private var topUpGrid: some View {
        VStack(spacing: 0) {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 100), spacing: 10)], spacing: 10) {
                ForEach(topUpOptions, id: \.self) { amt in
                    PressableButton(scaleTo: 0.94, haptic: Hap.medium) {
                        Task { await processTopUp(amt) }
                    } label: {
                        VStack(spacing: 4) {
                            if processing == amt {
                                ProgressView().tint(Theme.lime)
                            } else {
                                Text("+\(Fmt.moneyComma(amt))")
                                    .font(.system(size: 17, weight: .heavy))
                                    .foregroundStyle(Theme.lime)
                            }
                            Text("Add to wallet")
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
                    .disabled(processing != nil)
                }
            }
            Text("Secure checkout via Stripe. Your wallet updates once payment is confirmed.")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.textDim)
                .multilineTextAlignment(.center)
                .lineSpacing(4)
                .padding(.top, 14)
        }
        .padding(.horizontal, 18)
    }

    private var transactionsPlaceholder: some View {
        EmptyState(
            title: "No transactions yet",
            message: "Your subscriptions, unlocks, tips, and top-ups will show here once you make your first payment.",
            iconName: "doc.text.magnifyingglass"
        )
        .padding(.horizontal, 18)
    }

    private func processTopUp(_ amount: Double) async {
        payError = nil
        processing = amount
        let result = await CheckoutClient.shared.openCheckout(type: .topup, amount: amount)
        processing = nil
        if result.success {
            Hap.success()
            // Refresh wallet after a delay to let the webhook process
            Task {
                try? await Task.sleep(for: .seconds(3))
                await app.refreshWallet()
            }
        } else {
            payError = result.error ?? "Payment failed. Please try again."
        }
    }
}

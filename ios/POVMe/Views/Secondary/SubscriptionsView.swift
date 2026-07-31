import SwiftUI

/// Subscriptions screen — manage active/paused creator subscriptions.
/// Cancellation goes through the cancel-subscription edge function (Stripe).
struct SubscriptionsView: View {
    @Environment(AppState.self) private var app
    @Environment(Router.self) private var router
    @State private var cancelling: String?
    @State private var cancelError: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                summaryCard
                SectionHeader(kicker: "Your lives", title: "Active subscriptions")
                if app.activeSubs.isEmpty {
                    EmptyState(
                        title: "No active subscriptions",
                        message: "Subscribe to a creator to start living their POV. Cancel anytime.",
                        iconName: "person.2.slash",
                        action: "Explore creators"
                    ) {
                        router.selectedTab = .explore
                    }
                } else {
                    VStack(spacing: 12) {
                        ForEach(app.activeSubs) { sub in
                            if let c = Mock.creator(sub.creatorId) {
                                subCard(sub, c)
                            }
                        }
                    }
                    .padding(.horizontal, 18)
                }
                SectionHeader(kicker: "Billing", title: "Monthly spend")
                billingCard
            }
            .padding(.bottom, 40)
        }
        .background(Theme.bg.ignoresSafeArea())
        .navigationTitle("Subscriptions")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var summaryCard: some View {
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Monthly spend").microLabel(Theme.lime, size: 10)
                Text(Fmt.moneyComma(app.monthlySpend))
                    .font(.system(size: 32, weight: .heavy))
                    .tracking(-1.2)
                    .foregroundStyle(Theme.text)
                Text("\(app.activeSubs.count) active creators")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.textDim)
            }
            Spacer()
            AppButton(label: "Top up wallet", full: false, small: true) {
                router.push(.wallet)
            }
            .frame(width: 160)
        }
        .padding(18)
        .background(Theme.surface)
        .overlay(RoundedRectangle(cornerRadius: Theme.rLg).stroke(Theme.lime.opacity(0.2), lineWidth: 1))
        .clipShape(.rect(cornerRadius: Theme.rLg))
        .padding(.horizontal, 18)
        .padding(.top, 16)
    }

    private func subCard(_ sub: Subscription, _ c: Creator) -> some View {
        HStack(spacing: 12) {
            Avatar(uri: c.avatar, size: 52, ring: true, live: c.isLive)
            VStack(alignment: .leading, spacing: 3) {
                Text(c.name).font(.system(size: 15, weight: .heavy)).foregroundStyle(Theme.text)
                Text("@\(c.handle) · \(Fmt.moneyComma(sub.price))/mo")
                    .font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.textDim)
                Text("Renews \(sub.renewsAt.formatted(.dateTime.month(.abbreviated).day()))")
                    .font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.lime)
            }
            Spacer()
            PressableButton(scaleTo: 0.94) { router.push(.creator(c.id)) } label: {
                Text("View")
                    .font(.system(size: 12, weight: .heavy)).foregroundStyle(Theme.textMid)
                    .padding(.horizontal, 14).frame(height: 34)
                    .background(Theme.surfaceHi)
                    .clipShape(.rect(cornerRadius: Theme.rPill))
            }
            .buttonStyle(.plain)
            PressableButton(scaleTo: 0.94, haptic: Hap.medium) {
                Task { await cancelSub(c.id) }
            } label: {
                Text(cancelling == c.id ? "Cancelling…" : "Cancel")
                    .font(.system(size: 12, weight: .heavy)).foregroundStyle(Theme.danger)
                    .padding(.horizontal, 14).frame(height: 34)
                    .background(Theme.danger.opacity(0.08))
                    .overlay(RoundedRectangle(cornerRadius: Theme.rPill).stroke(Theme.danger.opacity(0.25), lineWidth: 1))
                    .clipShape(.rect(cornerRadius: Theme.rPill))
            }
            .buttonStyle(.plain)
            .disabled(cancelling != nil)
        }
        .padding(14)
        .background(Theme.surface)
        .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
        .clipShape(.rect(cornerRadius: Theme.rMd))
    }

    private func cancelSub(_ creatorId: String) async {
        cancelling = creatorId
        cancelError = nil
        let result = await CheckoutClient.shared.cancelSubscription(creatorId: creatorId)
        cancelling = nil
        if !result.success {
            cancelError = result.error ?? "Cancel failed"
            Hap.heavy()
        } else {
            Hap.medium()
        }
    }

    private var billingCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Wallet balance").font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.textDim)
                Spacer()
                Text(Fmt.moneyComma(app.balance)).font(.system(size: 14, weight: .heavy)).foregroundStyle(Theme.lime)
            }
            HStack {
                Text("Monthly subscriptions").font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.textDim)
                Spacer()
                Text(Fmt.moneyComma(app.monthlySpend)).font(.system(size: 14, weight: .heavy)).foregroundStyle(Theme.text)
            }
            HStack {
                Text("Lifetime spend").font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.textDim)
                Spacer()
                Text(Fmt.moneyComma(app.totalSpent)).font(.system(size: 14, weight: .heavy)).foregroundStyle(Theme.text)
            }
        }
        .padding(18)
        .background(Theme.surface)
        .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
        .clipShape(.rect(cornerRadius: Theme.rMd))
        .padding(.horizontal, 18)
    }
}

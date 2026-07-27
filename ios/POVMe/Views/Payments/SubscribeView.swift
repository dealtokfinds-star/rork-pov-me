import SwiftUI

/// Subscribe modal — monthly subscription to a creator via wallet or Stripe.
struct SubscribeView: View {
    let creatorId: String
    @Environment(AppState.self) private var app
    @Environment(Router.self) private var router
    @State private var processing = false
    @State private var error: String?
    @State private var success = false

    private var creator: Creator? { Mock.creator(creatorId) }

    var body: some View {
        if let creator {
            ScrollView {
                VStack(spacing: 0) {
                    hero(creator)
                    benefits
                    Divider().padding(.vertical, 20)
                    priceRow(creator)
                    Spacer(minLength: 20)
                    actions(creator)
                }
                .padding(.horizontal, 22)
                .padding(.bottom, 40)
            }
            .background(Theme.bg.ignoresSafeArea())
            .navigationTitle("Subscribe")
            .navigationBarTitleDisplayMode(.inline)
        } else {
            notFound
        }
    }

    private func hero(_ c: Creator) -> some View {
        VStack(spacing: 12) {
            Avatar(uri: c.avatar, size: 72, ring: true, live: c.isLive)
            Text(c.name).font(.system(size: 22, weight: .heavy)).foregroundStyle(Theme.text)
            Text("@\(c.handle)").font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.textDim)
            Text(c.bio)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Theme.textMid)
                .multilineTextAlignment(.center)
                .lineSpacing(5)
                .padding(.horizontal, 10)
        }
        .padding(.top, 20)
    }

    private var benefits: some View {
        VStack(alignment: .leading, spacing: 14) {
            benefit("play.rectangle.fill", Theme.lime, "Full POV feed", "Every episode, ad-free, the moment it drops")
            benefit("dot.radiowaves.left.and.right", Theme.magenta, "Live POV access", "Join their body-cam streams in real time")
            benefit("message.fill", Theme.cyan, "Direct messages", "Chat privately and request custom POVs")
            benefit("sparkles", Theme.gold, "Early access", "Premium replays before anyone else")
        }
        .padding(.top, 24)
    }

    private func benefit(_ icon: String, _ color: Color, _ title: String, _ body: String) -> some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(color.opacity(0.14)).frame(width: 40, height: 40)
                Image(systemName: icon).font(.system(size: 17, weight: .medium)).foregroundStyle(color)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.system(size: 14, weight: .heavy)).foregroundStyle(Theme.text)
                Text(body).font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.textDim)
            }
            Spacer()
        }
    }

    private func priceRow(_ c: Creator) -> some View {
        HStack(alignment: .bottom) {
            Text(Fmt.moneyComma(c.subPrice))
                .font(.system(size: 40, weight: .heavy))
                .tracking(-1.8)
                .foregroundStyle(Theme.text)
            Text("/month")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Theme.textMid)
                .padding(.bottom, 8)
            Spacer()
            Text("Cancel anytime")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Theme.textDim)
        }
        .padding(.vertical, 14)
    }

    private func actions(_ c: Creator) -> some View {
        VStack(spacing: 10) {
            if let error {
                HStack(spacing: 10) {
                    Image(systemName: "exclamationmark.triangle.fill").font(.system(size: 16)).foregroundStyle(Theme.danger)
                    Text(error).font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.danger)
                    Spacer()
                }
                .padding(.horizontal, 14).padding(.vertical, 12)
                .background(Theme.danger.opacity(0.12))
                .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.danger.opacity(0.35), lineWidth: 1))
                .clipShape(.rect(cornerRadius: Theme.rMd))
            }
            if success {
                HStack(spacing: 10) {
                    Image(systemName: "checkmark.circle.fill").font(.system(size: 16)).foregroundStyle(Theme.success)
                    Text("You're now living as \(c.name.split(separator: " ").first.map(String.init) ?? c.name).").font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.success)
                    Spacer()
                }
                .padding(.horizontal, 14).padding(.vertical, 12)
                .background(Theme.success.opacity(0.12))
                .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.success.opacity(0.35), lineWidth: 1))
                .clipShape(.rect(cornerRadius: Theme.rMd))
            }
            AppButton(label: processing ? "Processing…" : "Subscribe · \(Fmt.moneyComma(c.subPrice))/mo", disabled: processing) {
                payWithWallet(c)
            }
            Text("Charged to your POVMe wallet (\(Fmt.moneyComma(app.balance))) · cancel anytime in Settings")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.textDim)
                .multilineTextAlignment(.center)
                .lineSpacing(4)
        }
    }

    private func payWithWallet(_ c: Creator) {
        processing = true; error = nil; success = false
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            if app.subscribe(c.id, price: c.subPrice) {
                success = true
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
                    processing = false
                    router.pop()
                }
            } else {
                processing = false
                error = "Insufficient wallet balance. Top up first."
            }
        }
    }

    private var notFound: some View {
        VStack(spacing: 12) {
            Text("Creator not found").font(.system(size: 20, weight: .heavy)).foregroundStyle(Theme.text)
            AppButton(label: "Back", full: false) { router.pop() }.frame(width: 120).padding(.top, 8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.bg.ignoresSafeArea())
    }
}

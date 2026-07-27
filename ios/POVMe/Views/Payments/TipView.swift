import SwiftUI

/// Tip modal — send a one-time tip or gift to a creator via wallet.
struct TipView: View {
    let creatorId: String
    @Environment(AppState.self) private var app
    @Environment(Router.self) private var router
    @State private var customAmount = ""
    @State private var processing = false
    @State private var error: String?
    @State private var success = false

    private var creator: Creator? { Mock.creator(creatorId) }
    private let quickAmounts: [Double] = [2, 5, 10, 20, 50]
    @State private var selectedAmount: Double = 5

    var body: some View {
        if let creator {
            ScrollView {
                VStack(spacing: 0) {
                    header(creator)
                    quickAmountGrid
                    customAmountField
                    giftGrid(creator)
                    Spacer(minLength: 20)
                    actions(creator)
                }
                .padding(.horizontal, 22)
                .padding(.bottom, 40)
            }
            .background(Theme.bg.ignoresSafeArea())
            .navigationTitle("Send a tip")
            .navigationBarTitleDisplayMode(.inline)
        } else {
            VStack(spacing: 12) {
                Text("Creator not found").font(.system(size: 20, weight: .heavy)).foregroundStyle(Theme.text)
                AppButton(label: "Back", full: false) { router.pop() }.frame(width: 120).padding(.top, 8)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.bg.ignoresSafeArea())
        }
    }

    private func header(_ c: Creator) -> some View {
        VStack(spacing: 10) {
            Avatar(uri: c.avatar, size: 64, ring: true, live: c.isLive)
            Text(c.name).font(.system(size: 20, weight: .heavy)).foregroundStyle(Theme.text)
            Text("@\(c.handle)").font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.textDim)
            Text("Show your appreciation for their POV. Every tip keeps them filming.")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Theme.textMid)
                .multilineTextAlignment(.center)
                .lineSpacing(5)
                .padding(.horizontal, 10)
        }
        .padding(.top, 20)
    }

    private var quickAmountGrid: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Quick tip").microLabel(Theme.lime, size: 10)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 90), spacing: 10)], spacing: 10) {
                ForEach(quickAmounts, id: \.self) { amt in
                    PressableButton(scaleTo: 0.94, haptic: Hap.medium) {
                        selectedAmount = amt
                        customAmount = ""
                    } label: {
                        Text(Fmt.moneyComma(amt))
                            .font(.system(size: 17, weight: .heavy))
                            .foregroundStyle(selectedAmount == amt && customAmount.isEmpty ? Theme.ink : Theme.text)
                            .frame(maxWidth: .infinity)
                            .frame(height: 54)
                            .background(selectedAmount == amt && customAmount.isEmpty ? Theme.lime : Theme.surface)
                            .overlay(
                                RoundedRectangle(cornerRadius: Theme.rMd)
                                    .stroke(selectedAmount == amt && customAmount.isEmpty ? Theme.lime : Theme.border, lineWidth: 1)
                            )
                            .clipShape(.rect(cornerRadius: Theme.rMd))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.top, 24)
    }

    private var customAmountField: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Custom amount").microLabel(Theme.textDim, size: 10)
            HStack(spacing: 8) {
                Text("$").font(.system(size: 20, weight: .heavy)).foregroundStyle(Theme.textDim)
                TextField("0.00", text: $customAmount)
                    .font(.system(size: 20, weight: .heavy))
                    .foregroundStyle(Theme.text)
                    .keyboardType(.decimalPad)
            }
            .padding(.horizontal, 14)
            .frame(height: 54)
            .background(Theme.surface)
            .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
            .clipShape(.rect(cornerRadius: Theme.rMd))
        }
        .padding(.top, 20)
    }

    private func giftGrid(_ c: Creator) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Or send a gift").microLabel(Theme.gold, size: 10)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 100), spacing: 10)], spacing: 10) {
                ForEach(Mock.gifts) { g in
                    PressableButton(scaleTo: 0.94, haptic: Hap.medium) {
                        sendGift(c, gift: g)
                    } label: {
                        VStack(spacing: 5) {
                            Text(g.emoji).font(.system(size: 24))
                            Text(g.name).font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.text)
                            Text(Fmt.moneyComma(g.price)).font(.system(size: 11, weight: .heavy)).foregroundStyle(Theme.gold)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(Theme.surface)
                        .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
                        .clipShape(.rect(cornerRadius: Theme.rMd))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.top, 24)
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
                    Text("Tip sent! \(c.name.split(separator: " ").first.map(String.init) ?? c.name) appreciates you 💚").font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.success)
                    Spacer()
                }
                .padding(.horizontal, 14).padding(.vertical, 12)
                .background(Theme.success.opacity(0.12))
                .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.success.opacity(0.35), lineWidth: 1))
                .clipShape(.rect(cornerRadius: Theme.rMd))
            }
            let amount = customAmount.isEmpty ? selectedAmount : (Double(customAmount) ?? 0)
            AppButton(label: processing ? "Sending…" : "Send \(Fmt.moneyComma(amount)) tip", disabled: processing || amount <= 0) {
                sendTip(c, amount: amount)
            }
            Text("Wallet balance: \(Fmt.moneyComma(app.balance))")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.textDim)
        }
    }

    private func sendTip(_ c: Creator, amount: Double) {
        processing = true; error = nil; success = false
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            if app.tip(c.id, amount: amount) {
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

    private func sendGift(_ c: Creator, gift: Gift) {
        if app.tip(c.id, amount: gift.price, label: gift.name) {
            success = true
            error = nil
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
                router.pop()
            }
        } else {
            error = "Insufficient wallet balance. Top up first."
            success = false
        }
    }
}

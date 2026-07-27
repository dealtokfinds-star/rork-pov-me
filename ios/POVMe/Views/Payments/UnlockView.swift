import SwiftUI

/// Unlock modal — one-time PPV unlock for an episode via wallet.
struct UnlockView: View {
    let episodeId: String
    @Environment(AppState.self) private var app
    @Environment(Router.self) private var router
    @State private var processing = false
    @State private var error: String?
    @State private var success = false

    private var episode: Episode? { Mock.episode(episodeId) }
    private var creator: Creator? { episode.flatMap { Mock.creator($0.creatorId) } }
    private var price: Double { episode?.ppvPrice ?? 0 }

    var body: some View {
        if let episode, let creator {
            ScrollView {
                VStack(spacing: 0) {
                    ZStack {
                        AsyncImage(url: URL(string: episode.thumb)) { phase in
                            switch phase {
                            case .success(let img): img.resizable().scaledToFill()
                            default: Color(Theme.surface)
                            }
                        }
                        .frame(height: 220)
                        .blur(radius: 14)
                        .overlay(
                            LinearGradient(colors: [Theme.ink.opacity(0.6), Theme.ink.opacity(0.9)], startPoint: .top, endPoint: .bottom)
                        )
                        VStack(spacing: 12) {
                            ZStack {
                                Circle().fill(Theme.cyan).frame(width: 52, height: 52)
                                Image(systemName: "lock.fill").font(.system(size: 22, weight: .bold)).foregroundStyle(Theme.ink)
                            }
                            Text("Premium POV Experience")
                                .font(.system(size: 20, weight: .heavy))
                                .foregroundStyle(Theme.text)
                            Text("Unlock once. Yours forever.")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Theme.textMid)
                        }
                    }
                    .frame(height: 220)
                    .clipShape(.rect(cornerRadius: Theme.rLg))
                    .padding(.horizontal, 22)
                    .padding(.top, 20)

                    VStack(alignment: .leading, spacing: 6) {
                        Text(episode.title)
                            .font(.system(size: 19, weight: .heavy))
                            .foregroundStyle(Theme.text)
                            .lineSpacing(4)
                        Text("by \(creator.name) · \(Fmt.duration(episode.durationSec))")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Theme.textDim)
                    }
                    .padding(.horizontal, 22)
                    .padding(.top, 18)

                    VStack(alignment: .leading, spacing: 12) {
                        unlockBenefit("infinity", Theme.lime, "Yours forever", "Watch anytime, no expiration")
                        unlockBenefit("eye.fill", Theme.cyan, "Full POV episode", "Unedited, first-person, ad-free")
                        unlockBenefit("arrow.down.circle.fill", Theme.gold, "Download offline", "Save to your device")
                    }
                    .padding(.horizontal, 22)
                    .padding(.top, 20)

                    HStack(alignment: .bottom) {
                        Text(Fmt.moneyComma(price))
                            .font(.system(size: 40, weight: .heavy))
                            .tracking(-1.8)
                            .foregroundStyle(Theme.cyan)
                        Text("one-time")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(Theme.textMid)
                            .padding(.bottom, 8)
                        Spacer()
                    }
                    .padding(.horizontal, 22)
                    .padding(.top, 24)
                    .padding(.bottom, 14)

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
                                Text("Unlocked! Enjoy the POV.").font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.success)
                                Spacer()
                            }
                            .padding(.horizontal, 14).padding(.vertical, 12)
                            .background(Theme.success.opacity(0.12))
                            .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.success.opacity(0.35), lineWidth: 1))
                            .clipShape(.rect(cornerRadius: Theme.rMd))
                        }
                        AppButton(label: processing ? "Processing…" : "Unlock for \(Fmt.moneyComma(price))", variant: .ppv, disabled: processing) {
                            payWithWallet()
                        }
                        Text("Charged to your POVMe wallet (\(Fmt.moneyComma(app.balance)))")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Theme.textDim)
                    }
                    .padding(.horizontal, 22)
                }
                .padding(.bottom, 40)
            }
            .background(Theme.bg.ignoresSafeArea())
            .navigationTitle("Unlock POV")
            .navigationBarTitleDisplayMode(.inline)
        } else {
            VStack(spacing: 12) {
                Text("Episode not found").font(.system(size: 20, weight: .heavy)).foregroundStyle(Theme.text)
                AppButton(label: "Back", full: false) { router.pop() }.frame(width: 120).padding(.top, 8)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.bg.ignoresSafeArea())
        }
    }

    private func unlockBenefit(_ icon: String, _ color: Color, _ title: String, _ body: String) -> some View {
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
        }
    }

    private func payWithWallet() {
        processing = true; error = nil; success = false
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            if app.unlockEpisode(episodeId, price: price) {
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
}

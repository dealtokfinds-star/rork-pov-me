import SwiftUI

/// Become a creator modal — KYC, pricing, payout setup, agreement.
struct BecomeCreatorView: View {
    @Environment(AppState.self) private var app
    @Environment(Router.self) private var router
    @State private var price = "12.99"
    @State private var step = 0
    @State private var agreed = false
    @State private var processing = false
    @State private var success = false

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                if success {
                    successView
                } else {
                    stepContent
                }
            }
            .padding(.horizontal, 22)
            .padding(.bottom, 40)
            .padding(.top, 20)
        }
        .background(Theme.bg.ignoresSafeArea())
        .navigationTitle("Become a creator")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var stepContent: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Progress
            ProgressBar(progress: Double(step + 1) / 4.0)
                .padding(.bottom, 24)

            if step == 0 {
                introStep
            } else if step == 1 {
                identityStep
            } else if step == 2 {
                pricingStep
            } else {
                agreementStep
            }
        }
    }

    private var introStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Why creators love POVMe").microLabel(Theme.lime, size: 11)
            Text("Turn your day into a series people pay to live.")
                .font(.system(size: 28, weight: .heavy))
                .tracking(-1.1)
                .foregroundStyle(Theme.text)
                .lineSpacing(5)
            Text("Strap on a chest rig. Film your day, first-person. Set your price. Keep 80% of every subscription, tip, PPV unlock, and live gift.")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Theme.textMid)
                .lineSpacing(7)

            VStack(alignment: .leading, spacing: 12) {
                benefit("play.rectangle.fill", Theme.lime, "Subscriptions", "Set your monthly price from $4.99–$49.99")
                benefit("lock.fill", Theme.cyan, "PPV episodes", "One-time unlocks for premium adventures")
                benefit("dot.radiowaves.left.and.right", Theme.magenta, "Live POV", "Stream from your body cam in real time")
                benefit("banknote.fill", Theme.success, "Weekly payouts", "Stripe Connect, KYC verified, 80% share")
            }
            .padding(.top, 8)

            Spacer(minLength: 20)
            AppButton(label: "Get started") { step = 1 }
        }
    }

    private var identityStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Step 2 of 3").microLabel(Theme.lime, size: 11)
            Text("Verify your identity")
                .font(.system(size: 28, weight: .heavy))
                .tracking(-1.1)
                .foregroundStyle(Theme.text)
            Text("We partner with Stripe Identity to verify you're 18+ and real. This protects the community and unlocks payouts.")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Theme.textMid)
                .lineSpacing(7)

            VStack(alignment: .leading, spacing: 14) {
                kycRow("doc.fill", Theme.lime, "Government ID", "Driver's license, passport, or national ID")
                kycRow("faceid", Theme.cyan, "Selfie verification", "A quick liveness check to match your ID")
                kycRow("checkmark.shield.fill", Theme.gold, "18+ confirmation", "Required for every creator on POVMe")
            }
            .padding(18)
            .background(Theme.surface)
            .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
            .clipShape(.rect(cornerRadius: Theme.rMd))

            Spacer(minLength: 20)
            AppButton(label: "I'm verified — continue", disabled: processing) {
                processing = true
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
                    processing = false
                    step = 2
                }
            }
            PressableButton(scaleTo: 0.98) { step = 0 } label: {
                Text("Back").font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.textDim)
            }
            .buttonStyle(.plain)
            .frame(maxWidth: .infinity)
            .padding(.top, 8)
        }
    }

    private var pricingStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Step 3 of 3").microLabel(Theme.lime, size: 11)
            Text("Set your price")
                .font(.system(size: 28, weight: .heavy))
                .tracking(-1.1)
                .foregroundStyle(Theme.text)
            Text("Your monthly subscription price. The sweet spot for most niches is $9.99–$14.99. You keep 80%.")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Theme.textMid)
                .lineSpacing(7)

            HStack(spacing: 8) {
                Text("$").font(.system(size: 28, weight: .heavy)).foregroundStyle(Theme.lime)
                TextField("12.99", text: $price)
                    .font(.system(size: 28, weight: .heavy))
                    .foregroundStyle(Theme.text)
                    .keyboardType(.decimalPad)
            }
            .padding(.horizontal, 18)
            .frame(height: 68)
            .background(Theme.surface)
            .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.lime.opacity(0.25), lineWidth: 1))
            .clipShape(.rect(cornerRadius: Theme.rMd))

            let p = Double(price) ?? 0
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("You keep (80%)").font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.textDim)
                    Spacer()
                    Text(Fmt.moneyComma(p * 0.8)).font(.system(size: 14, weight: .heavy)).foregroundStyle(Theme.lime)
                }
                HStack {
                    Text("Platform fee (20%)").font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.textDim)
                    Spacer()
                    Text(Fmt.moneyComma(p * 0.2)).font(.system(size: 14, weight: .heavy)).foregroundStyle(Theme.text)
                }
                HStack {
                    Text("Per subscriber / month").font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.textDim)
                    Spacer()
                    Text(Fmt.moneyComma(p)).font(.system(size: 14, weight: .heavy)).foregroundStyle(Theme.text)
                }
            }
            .padding(18)
            .background(Theme.surface)
            .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
            .clipShape(.rect(cornerRadius: Theme.rMd))

            Spacer(minLength: 20)
            AppButton(label: "Continue") { step = 3 }
            PressableButton(scaleTo: 0.98) { step = 1 } label: {
                Text("Back").font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.textDim)
            }
            .buttonStyle(.plain)
            .frame(maxWidth: .infinity)
            .padding(.top, 8)
        }
    }

    private var agreementStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Final step").microLabel(Theme.lime, size: 11)
            Text("Creator agreement")
                .font(.system(size: 28, weight: .heavy))
                .tracking(-1.1)
                .foregroundStyle(Theme.text)
            Text("Review and accept the terms to start publishing POV episodes and going live.")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Theme.textMid)
                .lineSpacing(7)

            VStack(alignment: .leading, spacing: 12) {
                agreementItem("I am 18 years or older", agreed)
                agreementItem("I will follow the Content Guidelines", agreed)
                agreementItem("I consent to Stripe Connect KYC and payout terms", agreed)
                agreementItem("I understand povme takes a 20% platform fee", agreed)
                agreementItem("I have the right to film the content I upload", agreed)
            }
            .padding(18)
            .background(Theme.surface)
            .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
            .clipShape(.rect(cornerRadius: Theme.rMd))

            PressableButton(scaleTo: 0.98, haptic: Hap.medium) { agreed.toggle() } label: {
                HStack(spacing: 10) {
                    Image(systemName: agreed ? "checkmark.square.fill" : "square")
                        .font(.system(size: 18, weight: .medium))
                        .foregroundStyle(agreed ? Theme.lime : Theme.textDim)
                    Text("I agree to all of the above")
                        .font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.text)
                    Spacer()
                }
                .padding(14)
                .background(agreed ? Theme.lime.opacity(0.08) : Theme.surface)
                .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(agreed ? Theme.lime.opacity(0.3) : Theme.border, lineWidth: 1))
                .clipShape(.rect(cornerRadius: Theme.rMd))
            }
            .buttonStyle(.plain)

            Spacer(minLength: 20)
            AppButton(label: processing ? "Setting up…" : "Start creating", disabled: !agreed || processing) {
                finish()
            }
            PressableButton(scaleTo: 0.98) { step = 2 } label: {
                Text("Back").font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.textDim)
            }
            .buttonStyle(.plain)
            .frame(maxWidth: .infinity)
            .padding(.top, 8)
        }
    }

    private var successView: some View {
        VStack(spacing: 16) {
            Spacer()
            ZStack {
                Circle().fill(Theme.lime.opacity(0.12)).frame(width: 80, height: 80)
                Image(systemName: "party.popper.fill")
                    .font(.system(size: 32, weight: .bold))
                    .foregroundStyle(Theme.lime)
            }
            .overlay(Circle().stroke(Theme.lime.opacity(0.3), lineWidth: 1).frame(width: 80, height: 80))

            Text("You're a creator").microLabel(Theme.lime, size: 12)
            Text("Welcome to the studio, @\(app.handle).")
                .font(.system(size: 26, weight: .heavy))
                .tracking(-1)
                .foregroundStyle(Theme.text)
                .multilineTextAlignment(.center)
            Text("Your channel is live. Upload your first POV episode or go live from a body cam right now.")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Theme.textMid)
                .multilineTextAlignment(.center)
                .lineSpacing(5)

            VStack(spacing: 10) {
                AppButton(label: "Upload first episode") { router.push(.upload) }
                AppButton(label: "Go live now", variant: .live, full: true) { router.push(.golive) }
            }
            .padding(.top, 12)
            Spacer()
        }
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

    private func kycRow(_ icon: String, _ color: Color, _ title: String, _ body: String) -> some View {
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

    private func agreementItem(_ text: String, _ checked: Bool) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: checked ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(checked ? Theme.lime : Theme.textDim)
            Text(text)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.text)
                .lineSpacing(4)
        }
    }

    private func finish() {
        processing = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            let p = Double(price) ?? 12.99
            app.becomeCreator(price: p)
            processing = false
            success = true
        }
    }
}

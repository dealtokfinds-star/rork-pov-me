import SwiftUI
import PhotosUI

/// Become a creator — manual KYC (ID upload + admin review) + payout details.
///
/// Mirrors the Expo `app/become-creator.tsx` 4-step flow:
///  1. Identity tag + categories
///  2. Price
///  3. Verify & payouts: upload ID front/back/selfie → submit for review →
///     save payout details (PayPal or bank) → publish profile.
///  4. Done.
///
/// Replaces the old Stripe Identity + Stripe Connect onboarding. Lemon
/// Squeezy is the Merchant of Record for fan payments; the platform pays
/// creators weekly via PayPal or bank transfer using the details saved here.
struct BecomeCreatorView: View {
    @Environment(AppState.self) private var app
    @Environment(Router.self) private var router
    @State private var price = "12.99"
    @State private var step = 0
    @State private var agreed = false
    @State private var processing = false
    @State private var success = false
    @State private var error: String?

    // Step 0: identity tag + categories
    @State private var identity = ""
    @State private var pickedCategories: Set<PovCategory> = []

    // Step 3: KYC documents + payout details
    @State private var frontItem: PhotosPickerItem?
    @State private var backItem: PhotosPickerItem?
    @State private var selfieItem: PhotosPickerItem?
    @State private var frontImage: UIImage?
    @State private var backImage: UIImage?
    @State private var selfieImage: UIImage?
    @State private var kycStage: KycStage = .identity
    @State private var kycState: CreatorOnboardingClient.KycState?
    @State private var payoutMethod: PayoutDetailsInput.Method?
    @State private var paypalEmail = ""
    @State private var bankHolder = ""
    @State private var bankAccount = ""
    @State private var bankRouting = ""
    @State private var bankCountry = ""

    enum KycStage { case identity, review, payout, profile }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                if success {
                    successView
                } else if step == 3 {
                    verifyStep
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
        .task { await loadKycState() }
    }

    // MARK: - Steps 0-2

    private var stepContent: some View {
        VStack(alignment: .leading, spacing: 0) {
            ProgressBar(progress: Double(step + 1) / 4.0)
                .padding(.bottom, 24)

            if step == 0 { identityStep }
            else if step == 1 { categoriesStep }
            else if step == 2 { pricingStep }
        }
    }

    private var identityStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Step 1 of 4").microLabel(Theme.lime, size: 11)
            Text("What life are people stepping into?")
                .font(.system(size: 28, weight: .heavy))
                .tracking(-1.1)
                .foregroundStyle(Theme.text)
            Text("Your identity tag is the promise. \"Prop futures trader\", \"club promoter\", \"pro fighter\" — be specific.")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Theme.textMid)
                .lineSpacing(7)

            TextField("e.g. Algo trader in Miami", text: $identity)
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(Theme.text)
                .padding(.horizontal, 16)
                .frame(height: 54)
                .background(Theme.surface)
                .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
                .clipShape(.rect(cornerRadius: Theme.rMd))

            Spacer(minLength: 20)
            AppButton(label: "Continue") { step = 1 }
        }
    }

    private var categoriesStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Step 2 of 4").microLabel(Theme.lime, size: 11)
            Text("Pick your POV categories")
                .font(.system(size: 28, weight: .heavy))
                .tracking(-1.1)
                .foregroundStyle(Theme.text)
            Text("Fans find you through these. Pick the lifestyles your feed actually shows.")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Theme.textMid)
                .lineSpacing(7)

            let categories: [PovCategory] = PovCategory.allCases
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 120), spacing: 8)], spacing: 8) {
                ForEach(categories, id: \.self) { (cat: PovCategory) in
                    let active = pickedCategories.contains(cat)
                    let meta = Category.by(cat)
                    PressableButton(scaleTo: 0.95) {
                        if active { pickedCategories.remove(cat) } else { pickedCategories.insert(cat) }
                    } label: {
                        HStack(spacing: 6) {
                            Text(meta.emoji).font(.system(size: 14))
                            Text(meta.label).font(.system(size: 12.5, weight: .bold))
                        }
                        .padding(.horizontal, 12).frame(height: 38)
                        .frame(maxWidth: .infinity)
                        .background(active ? Theme.lime : Theme.surface)
                        .foregroundStyle(active ? Theme.ink : Theme.text)
                        .overlay(RoundedRectangle(cornerRadius: Theme.rPill).stroke(active ? Theme.lime : Theme.border, lineWidth: 1))
                        .clipShape(.rect(cornerRadius: Theme.rPill))
                    }
                    .buttonStyle(.plain)
                }
            }

            Spacer(minLength: 20)
            AppButton(label: "Continue") { step = 2 }
            backButton(to: 0)
        }
    }

    private var pricingStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Step 3 of 4").microLabel(Theme.lime, size: 11)
            Text("Set your monthly price")
                .font(.system(size: 28, weight: .heavy))
                .tracking(-1.1)
                .foregroundStyle(Theme.text)
            Text("Between $4.99 and $49.99. For lifestyle POV feeds, $9.99–$14.99 converts best. You keep 80%.")
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
                splitRow("You keep (80%)", Fmt.moneyComma(p * 0.8), Theme.lime)
                splitRow("Platform fee (20%)", Fmt.moneyComma(p * 0.2), Theme.text)
                splitRow("Per subscriber / month", Fmt.moneyComma(p), Theme.text)
            }
            .padding(18)
            .background(Theme.surface)
            .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
            .clipShape(.rect(cornerRadius: Theme.rMd))

            Spacer(minLength: 20)
            AppButton(label: "Continue to verification") { step = 3 }
            backButton(to: 1)
        }
    }

    // MARK: - Step 3: verify & payouts

    private var verifyStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            ProgressBar(progress: progressFor(kycStage))
                .padding(.bottom, 8)
            Text(stageLabel(kycStage)).microLabel(Theme.lime, size: 11)
            Text("Verify & set up payouts")
                .font(.system(size: 28, weight: .heavy))
                .tracking(-1.1)
                .foregroundStyle(Theme.text)
            Text("Upload a government ID and a selfie so we can confirm you're 18+. Then add your payout details — povme pays you weekly via PayPal or bank transfer. Your documents are stored privately and reviewed by a human within 24 hours.")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Theme.textMid)
                .lineSpacing(7)

            if let error {
                HStack(spacing: 10) {
                    Image(systemName: "exclamationmark.triangle.fill").font(.system(size: 14)).foregroundStyle(Theme.danger)
                    Text(error).font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.danger)
                }
                .padding(12)
                .background(Theme.danger.opacity(0.12))
                .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.danger.opacity(0.35), lineWidth: 1))
                .clipShape(.rect(cornerRadius: Theme.rMd))
            }

            switch kycStage {
            case .identity: identityUpload
            case .review: reviewState
            case .payout: payoutForm
            case .profile: publishState
            }

            Text("By continuing you accept the povme creator terms, the content guidelines, and confirm every person appearing in your POV content is 18+ and has consented to being filmed.")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.textDim)
                .lineSpacing(5)
                .padding(.top, 8)
        }
    }

    private var identityUpload: some View {
        VStack(alignment: .leading, spacing: 14) {
            docPicker(label: "Front of ID", sub: "Driver's license, passport, or national ID", icon: "doc.fill", item: $frontItem, image: $frontImage)
            docPicker(label: "Back of ID", sub: "If your ID has a back side", icon: "creditcard.fill", item: $backItem, image: $backImage)
            docPicker(label: "Selfie holding ID", sub: "Hold your ID next to your face", icon: "faceid", item: $selfieItem, image: $selfieImage)

            AppButton(label: processing ? "Submitting…" : "Submit for review", disabled: processing || frontImage == nil || backImage == nil || selfieImage == nil) {
                Task { await submitKyc() }
            }
        }
    }

    private var reviewState: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(spacing: 10) {
                ProgressView().tint(Theme.lime).scaleEffect(1.2)
                Text("Under review").font(.system(size: 18, weight: .heavy)).foregroundStyle(Theme.text)
                Text("Your documents were submitted. A human reviews every application — usually within 24 hours. You'll get an email when you're approved.")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Theme.textMid)
                    .multilineTextAlignment(.center)
                    .lineSpacing(5)
            }
            .padding(20)
            .background(Theme.lime.opacity(0.06))
            .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.lime.opacity(0.22), lineWidth: 1))
            .clipShape(.rect(cornerRadius: Theme.rMd))

            PressableButton(scaleTo: 0.97) {
                Task { await loadKycState() }
            } label: {
                HStack(spacing: 7) {
                    Image(systemName: "arrow.clockwise").font(.system(size: 13))
                    Text("Re-check status").font(.system(size: 12, weight: .bold))
                }
                .foregroundStyle(Theme.textDim)
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.plain)

            if kycState?.kycStatus == "verified" {
                AppButton(label: "Continue to payouts") { kycStage = .payout }
            }
        }
    }

    private var payoutForm: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("How do you want to get paid?")
                .font(.system(size: 15, weight: .heavy))
                .foregroundStyle(Theme.text)

            HStack(spacing: 10) {
                methodOption(.paypal, "PayPal", "Fastest — funds arrive instantly", "wallet.pass.fill")
                methodOption(.bank, "Bank transfer", "1–3 business days", "building.columns.fill")
            }

            if payoutMethod == .paypal {
                fieldLabel("PayPal email")
                TextField("you@example.com", text: $paypalEmail)
                    .font(.system(size: 15, weight: .bold)).foregroundStyle(Theme.text)
                    .keyboardType(.emailAddress).textInputAutocapitalization(.never)
                    .padding(.horizontal, 16).frame(height: 54)
                    .background(Theme.surface)
                    .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
                    .clipShape(.rect(cornerRadius: Theme.rMd))
            }

            if payoutMethod == .bank {
                fieldLabel("Account holder name")
                TextField("Jane Doe", text: $bankHolder)
                    .styledInput()
                fieldLabel("Account number")
                TextField("000123456789", text: $bankAccount)
                    .styledInput().keyboardType(.numberPad)
                fieldLabel("Routing number")
                TextField("021000021", text: $bankRouting)
                    .styledInput().keyboardType(.numberPad)
                fieldLabel("Country (2-letter code)")
                TextField("US", text: $bankCountry)
                    .styledInput().textInputAutocapitalization(.characters)
                Text("Only the last 4 digits of your account number are stored.")
                    .font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.textDim)
            }

            AppButton(label: processing ? "Saving…" : "Save payout details", disabled: processing || payoutMethod == nil) {
                Task { await savePayout() }
            }
        }
    }

    private var publishState: some View {
        VStack(alignment: .leading, spacing: 14) {
            doneRow("Identity verified")
            doneRow("Payouts via \(payoutMethod == .paypal ? "PayPal" : "bank transfer") · weekly")
            AppButton(label: processing ? "Publishing…" : "Finish & open studio", disabled: processing) {
                Task { await publishProfile() }
            }
        }
    }

    // MARK: - Success

    private var successView: some View {
        VStack(spacing: 16) {
            Spacer()
            ZStack {
                Circle().fill(Theme.lime.opacity(0.12)).frame(width: 80, height: 80)
                Image(systemName: "checkmark.seal.fill")
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
            Text("Your channel is live. Upload your first POV episode or go live from a body cam right now. Payouts run weekly to your \(payoutMethod == .paypal ? "PayPal" : "bank account").")
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

    // MARK: - Actions

    private func loadKycState() async {
        do {
            if let state = try await CreatorOnboardingClient.shared.fetchKycState() {
                kycState = state
                if state.kycStatus == "verified" {
                    kycStage = state.payoutMethod != nil ? .profile : .payout
                    if let m = state.payoutMethod { payoutMethod = PayoutDetailsInput.Method(rawValue: m) }
                } else if state.kycStatus == "pending" {
                    kycStage = .review
                } else if state.kycStatus == "rejected" {
                    kycStage = .identity
                    error = state.kycLastReason ?? "Please resubmit your ID photos"
                }
            }
        } catch {
            // Silent — first-time creators have no state yet
        }
    }

    private func submitKyc() async {
        guard let frontImage, let backImage, let selfieImage else {
            error = "Capture all three photos to continue."
            return
        }
        processing = true
        error = nil
        do {
            _ = try await CreatorOnboardingClient.shared.submitKyc(front: frontImage, back: backImage, selfie: selfieImage)
            Hap.success()
            kycStage = .review
            await loadKycState()
        } catch {
            self.error = error.localizedDescription
        }
        processing = false
    }

    private func savePayout() async {
        guard let payoutMethod else { error = "Pick a payout method."; return }
        processing = true
        error = nil
        let input = PayoutDetailsInput(
            method: payoutMethod,
            paypalEmail: payoutMethod == .paypal ? paypalEmail.trimmingCharacters(in: .whitespaces) : nil,
            bankAccountHolder: payoutMethod == .bank ? bankHolder.trimmingCharacters(in: .whitespaces) : nil,
            bankAccountNumber: payoutMethod == .bank ? bankAccount.trimmingCharacters(in: .whitespaces) : nil,
            bankRouting: payoutMethod == .bank ? bankRouting.trimmingCharacters(in: .whitespaces) : nil,
            bankCountry: payoutMethod == .bank ? bankCountry.trimmingCharacters(in: .whitespaces).uppercased() : nil
        )
        do {
            _ = try await CreatorOnboardingClient.shared.savePayoutDetails(input)
            Hap.success()
            kycStage = .profile
        } catch {
            self.error = error.localizedDescription
        }
        processing = false
    }

    private func publishProfile() async {
        guard !identity.trimmingCharacters(in: .whitespaces).isEmpty else {
            error = "Add your identity tag first."; return
        }
        guard !pickedCategories.isEmpty else {
            error = "Pick at least one POV category."; return
        }
        processing = true
        error = nil
        let p = Double(price) ?? 12.99
        app.becomeCreator(price: p)
        Hap.success()
        processing = false
        success = true
    }

    // MARK: - Helpers

    private func progressFor(_ stage: KycStage) -> Double {
        switch stage {
        case .identity: return 0.55
        case .review: return 0.7
        case .payout: return 0.85
        case .profile: return 0.95
        }
    }

    private func stageLabel(_ stage: KycStage) -> String {
        switch stage {
        case .identity: return "UPLOAD ID"
        case .review: return "UNDER REVIEW"
        case .payout: return "PAYOUT DETAILS"
        case .profile: return "PUBLISH PROFILE"
        }
    }

    private func backButton(to s: Int) -> some View {
        PressableButton(scaleTo: 0.98) { step = s } label: {
            Text("Back").font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.textDim)
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity)
        .padding(.top, 8)
    }

    private func splitRow(_ label: String, _ value: String, _ color: Color) -> some View {
        HStack {
            Text(label).font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.textDim)
            Spacer()
            Text(value).font(.system(size: 14, weight: .heavy)).foregroundStyle(color)
        }
    }

    private func methodOption(_ method: PayoutDetailsInput.Method, _ title: String, _ sub: String, _ icon: String) -> some View {
        let active = payoutMethod == method
        return PressableButton(scaleTo: 0.97) { payoutMethod = method } label: {
            VStack(alignment: .leading, spacing: 6) {
                ZStack {
                    Circle().fill(Theme.surfaceHi).frame(width: 34, height: 34)
                    Image(systemName: icon).font(.system(size: 15, weight: .medium)).foregroundStyle(active ? Theme.ink : Theme.lime)
                }
                Text(title).font(.system(size: 14, weight: .heavy)).foregroundStyle(active ? Theme.ink : Theme.text)
                Text(sub).font(.system(size: 11, weight: .semibold)).foregroundStyle(active ? Theme.ink : Theme.textDim)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(active ? Theme.lime : Theme.surface)
            .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(active ? Theme.lime : Theme.border, lineWidth: 1))
            .clipShape(.rect(cornerRadius: Theme.rMd))
        }
        .buttonStyle(.plain)
    }

    private func fieldLabel(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 11, weight: .heavy))
            .tracking(0.6)
            .textCase(.uppercase)
            .foregroundStyle(Theme.textDim)
            .padding(.top, 4)
    }

    private func doneRow(_ text: String) -> some View {
        HStack(spacing: 7) {
            Image(systemName: "checkmark.circle.fill").font(.system(size: 14)).foregroundStyle(Theme.success)
            Text(text).font(.system(size: 12.5, weight: .bold)).foregroundStyle(Theme.success)
        }
    }

    private func docPicker(label: String, sub: String, icon: String, item: Binding<PhotosPickerItem?>, image: Binding<UIImage?>) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            PhotosPicker(selection: item, matching: .images) {
                HStack(spacing: 12) {
                    if let img = image.wrappedValue {
                        Image(uiImage: img)
                            .resizable()
                            .scaledToFill()
                            .frame(width: 64, height: 80)
                            .clipShape(.rect(cornerRadius: 8))
                            .allowsHitTesting(false)
                    } else {
                        ZStack {
                            Color(Theme.surfaceHi)
                            VStack(spacing: 6) {
                                Image(systemName: icon).font(.system(size: 16)).foregroundStyle(Theme.lime)
                                Image(systemName: "camera.fill").font(.system(size: 20)).foregroundStyle(Theme.textDim)
                            }
                        }
                        .frame(width: 64, height: 80)
                        .clipShape(.rect(cornerRadius: 8))
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text(label).font(.system(size: 14, weight: .heavy)).foregroundStyle(Theme.text)
                        Text(sub).font(.system(size: 11.5, weight: .semibold)).foregroundStyle(Theme.textDim)
                        Text(image.wrappedValue == nil ? "Tap to choose" : "Tap to change")
                            .font(.system(size: 11, weight: .bold)).foregroundStyle(Theme.lime)
                    }
                    Spacer()
                    if image.wrappedValue != nil {
                        Image(systemName: "checkmark.circle.fill").font(.system(size: 16)).foregroundStyle(Theme.lime)
                    }
                }
                .padding(12)
                .background(Theme.surface)
                .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
                .clipShape(.rect(cornerRadius: Theme.rMd))
            }
            .buttonStyle(.plain)
        }
        .onChange(of: item.wrappedValue) { _, newValue in
            Task {
                if let data = try? await newValue?.loadTransferable(type: Data.self),
                   let uiImage = UIImage(data: data) {
                    image.wrappedValue = uiImage
                }
            }
        }
    }
}

private extension TextField {
    func styledInput() -> some View {
        self
            .font(.system(size: 15, weight: .bold))
            .foregroundStyle(Theme.text)
            .padding(.horizontal, 16)
            .frame(height: 54)
            .background(Theme.surface)
            .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
            .clipShape(.rect(cornerRadius: Theme.rMd))
            .padding(.bottom, 6)
    }
}

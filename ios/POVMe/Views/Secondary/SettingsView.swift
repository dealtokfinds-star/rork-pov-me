import SwiftUI

/// Settings screen — profile editing, creator price, preferences, legal links.
struct SettingsView: View {
    @Environment(AppState.self) private var app
    @Environment(Router.self) private var router
    @State private var name = ""
    @State private var handle = ""
    @State private var creatorPrice = ""
    @State private var saved = false

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                profileSection
                SectionHeader(kicker: "Creator", title: "Studio settings")
                creatorSection
                SectionHeader(kicker: "App", title: "Preferences")
                preferencesSection
                SectionHeader(kicker: "Legal", title: "Documents")
                legalSection
                SectionHeader(kicker: "Account", title: "Data & privacy")
                dataSection
            }
            .padding(.bottom, 40)
        }
        .background(Theme.bg.ignoresSafeArea())
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            name = app.displayName
            handle = app.handle
            creatorPrice = String(format: "%.2f", app.creatorPrice)
        }
    }

    private var profileSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 14) {
                Avatar(uri: app.currentUser?.picture ?? "", size: 56, ring: true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(app.currentUser?.name ?? app.displayName)
                        .font(.system(size: 16, weight: .heavy)).foregroundStyle(Theme.text)
                    Text(app.currentUser?.email ?? "").font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.textDim)
                }
                Spacer()
            }
            VStack(alignment: .leading, spacing: 8) {
                Text("Display name").microLabel(Theme.textDim, size: 10)
                TextField("Your name", text: $name)
                    .font(.system(size: 15, weight: .bold)).foregroundStyle(Theme.text)
                    .padding(.horizontal, 14).frame(height: 48)
                    .background(Theme.surface)
                    .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
                    .clipShape(.rect(cornerRadius: Theme.rMd))
            }
            VStack(alignment: .leading, spacing: 8) {
                Text("Handle").microLabel(Theme.textDim, size: 10)
                TextField("handle", text: $handle)
                    .font(.system(size: 15, weight: .bold)).foregroundStyle(Theme.text)
                    .padding(.horizontal, 14).frame(height: 48)
                    .background(Theme.surface)
                    .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
                    .clipShape(.rect(cornerRadius: Theme.rMd))
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.none)
            }
            if saved {
                HStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill").font(.system(size: 14)).foregroundStyle(Theme.success)
                    Text("Profile saved").font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.success)
                }
            }
            AppButton(label: "Save profile") {
                app.completeOnboarding(name: name, interests: app.interests)
                saved = true
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { saved = false }
            }
        }
        .padding(18)
        .background(Theme.surface)
        .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
        .clipShape(.rect(cornerRadius: Theme.rMd))
        .padding(.horizontal, 18)
        .padding(.top, 16)
    }

    private var creatorSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 8) {
                Text("Subscription price ($/mo)").microLabel(Theme.textDim, size: 10)
                TextField("12.99", text: $creatorPrice)
                    .font(.system(size: 15, weight: .bold)).foregroundStyle(Theme.text)
                    .padding(.horizontal, 14).frame(height: 48)
                    .background(Theme.surface)
                    .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
                    .clipShape(.rect(cornerRadius: Theme.rMd))
                    .keyboardType(.decimalPad)
            }
            HStack {
                Text("Creator status").font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.textDim)
                Spacer()
                Text(app.isCreator ? "Active" : "Not a creator")
                    .font(.system(size: 13, weight: .heavy)).foregroundStyle(app.isCreator ? Theme.lime : Theme.textMid)
            }
            HStack {
                Text("Payout account").font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.textDim)
                Spacer()
                Text(app.payoutConnected ? "Connected" : "Not connected")
                    .font(.system(size: 13, weight: .heavy)).foregroundStyle(app.payoutConnected ? Theme.lime : Theme.danger)
            }
            AppButton(label: "Save price") {
                if let p = Double(creatorPrice) { app.setCreatorPrice(p) }
            }
        }
        .padding(18)
        .background(Theme.surface)
        .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
        .clipShape(.rect(cornerRadius: Theme.rMd))
        .padding(.horizontal, 18)
    }

    private var preferencesSection: some View {
        VStack(spacing: 0) {
            preferenceRow("bell.fill", "Push notifications", true)
            AppDivider().padding(.leading, 58)
            preferenceRow("envelope.fill", "Email digests", true)
            AppDivider().padding(.leading, 58)
            preferenceRow("dot.radiowaves.left.and.right", "Live alerts", true)
            AppDivider().padding(.leading, 58)
            preferenceRow("moon.fill", "Dark mode", true)
        }
        .padding(.horizontal, 18)
        .background(Theme.surface)
        .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
        .clipShape(.rect(cornerRadius: Theme.rMd))
        .padding(.horizontal, 18)
    }

    private func preferenceRow(_ icon: String, _ label: String, _ on: Bool) -> some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(Theme.surfaceHi).frame(width: 32, height: 32)
                Image(systemName: icon).font(.system(size: 15, weight: .medium)).foregroundStyle(Theme.textMid)
            }
            Text(label).font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.text)
            Spacer()
            Toggle("", isOn: .constant(on)).tint(Theme.lime).labelsHidden()
        }
        .padding(.horizontal, 14).padding(.vertical, 14)
    }

    private var legalSection: some View {
        VStack(spacing: 0) {
            legalRow("doc.text.fill", "Terms of Use") { router.push(.legalTerms) }
            AppDivider().padding(.leading, 58)
            legalRow("lock.shield.fill", "Privacy Policy") { router.push(.legalPrivacy) }
            AppDivider().padding(.leading, 58)
            legalRow("checkmark.shield.fill", "2257 Compliance") { router.push(.legal2257) }
            AppDivider().padding(.leading, 58)
            legalRow("shield.fill", "Content guidelines") { router.push(.guidelines) }
        }
        .padding(.horizontal, 18)
        .background(Theme.surface)
        .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
        .clipShape(.rect(cornerRadius: Theme.rMd))
        .padding(.horizontal, 18)
    }

    private func legalRow(_ icon: String, _ label: String, action: @escaping () -> Void) -> some View {
        PressableButton(scaleTo: 0.99, action: action) {
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(Theme.surfaceHi).frame(width: 32, height: 32)
                    Image(systemName: icon).font(.system(size: 15, weight: .medium)).foregroundStyle(Theme.textMid)
                }
                Text(label).font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.text)
                Spacer()
                Image(systemName: "chevron.right").font(.system(size: 14, weight: .medium)).foregroundStyle(Theme.textDim)
            }
            .padding(.horizontal, 14).padding(.vertical, 14)
        }
        .buttonStyle(.plain)
    }

    private var dataSection: some View {
        VStack(spacing: 0) {
            PressableButton(scaleTo: 0.99) {} label: {
                HStack(spacing: 12) {
                    ZStack {
                        Circle().fill(Theme.surfaceHi).frame(width: 32, height: 32)
                        Image(systemName: "square.and.arrow.up").font(.system(size: 15, weight: .medium)).foregroundStyle(Theme.cyan)
                    }
                    Text("Export my data").font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.text)
                    Spacer()
                    Image(systemName: "chevron.right").font(.system(size: 14, weight: .medium)).foregroundStyle(Theme.textDim)
                }
                .padding(.horizontal, 14).padding(.vertical, 14)
            }
            .buttonStyle(.plain)
            AppDivider().padding(.leading, 58)
            PressableButton(scaleTo: 0.99, haptic: Hap.medium) { app.resetAccount() } label: {
                HStack(spacing: 12) {
                    ZStack {
                        Circle().fill(Theme.danger.opacity(0.14)).frame(width: 32, height: 32)
                        Image(systemName: "trash.fill").font(.system(size: 15, weight: .medium)).foregroundStyle(Theme.danger)
                    }
                    Text("Reset account").font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.danger)
                    Spacer()
                }
                .padding(.horizontal, 14).padding(.vertical, 14)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 18)
        .background(Theme.surface)
        .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
        .clipShape(.rect(cornerRadius: Theme.rMd))
        .padding(.horizontal, 18)
    }
}

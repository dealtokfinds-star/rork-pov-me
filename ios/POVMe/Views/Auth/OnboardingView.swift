import SwiftUI

/// POVMe onboarding — the "first episode" of the user's POVMe life.
/// Slides → Identity → Taste → Follow creators → Ready.
struct OnboardingView: View {
    @Environment(AppState.self) private var app
    @Environment(Router.self) private var router
    @State private var step = 0
    @State private var name = ""
    @State private var picked: [PovCategory] = []
    @State private var followed: [String] = []
    @State private var finishing = false
    @State private var fade = true

    private let slides: [Slide] = [
        .init(kicker: "Welcome to POVMe",
              title: "Stop watching highlight reels.\nStep inside the life.",
              body: "Every episode is filmed first-person — chest rigs, glasses, helmet cams. You don't watch their day. You wear it.",
              image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80",
              icon: "eye.fill"),
        .init(kicker: "How POVMe works",
              title: "Subscribe to a life.\nUnlock the big days.",
              body: "A monthly sub gets you a creator's full POV feed. Premium adventures — ringside, cockpit, pitch day — unlock one at a time.",
              image: "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=1200&q=80",
              icon: "sparkles"),
        .init(kicker: "Live POV",
              title: "Be there\nwhile it happens.",
              body: "Creators go live from a body cam. Chat, tip, send gifts, and stay for the paid replay — like you were on their shoulder.",
              image: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1200&q=80",
              icon: "dot.radiowaves.left.and.right"),
    ]

    private var slideCount: Int { slides.count }
    private var identityStep: Int { slideCount }
    private var tasteStep: Int { slideCount + 1 }
    private var followStep: Int { slideCount + 2 }
    private var readyStep: Int { slideCount + 3 }
    private var totalSteps: Int { readyStep + 1 }

    struct Slide: Identifiable {
        let id = UUID()
        let kicker: String; let title: String; let body: String
        let image: String; let icon: String
    }

    var body: some View {
        ZStack {
            Color(Theme.ink).ignoresSafeArea()
            if step < slideCount {
                slideView(slides[step])
            } else {
                formStep
            }
        }
    }

    // MARK: - Slide

    private func slideView(_ slide: Slide) -> some View {
        ZStack {
            AsyncImage(url: URL(string: slide.image)) { phase in
                switch phase {
                case .success(let img): img.resizable().scaledToFill()
                default: Color(Theme.ink)
                }
            }
            .ignoresSafeArea()
            .overlay(
                LinearGradient(
                    colors: [Theme.ink.opacity(0.5), Theme.ink.opacity(0.82), Theme.ink],
                    startPoint: .top, endPoint: .bottom
                )
                .ignoresSafeArea()
            )

            VStack(spacing: 0) {
                HStack {
                    Wordmark(size: 20)
                    Spacer()
                    PressableButton(scaleTo: 0.94) { go(to: identityStep) } label: {
                        Text("Skip intro")
                            .font(.system(size: 13.5, weight: .bold))
                            .foregroundStyle(Theme.textMid)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.top, 24)

                Spacer()

                VStack(alignment: .leading, spacing: 14) {
                    ZStack {
                        Circle().fill(Theme.lime).frame(width: 44, height: 44)
                        Image(systemName: slide.icon)
                            .font(.system(size: 22, weight: .bold))
                            .foregroundStyle(Theme.ink)
                    }
                    Text(slide.kicker).microLabel(Theme.lime, size: 11)
                    Text(slide.title)
                        .font(.system(size: 34, weight: .heavy))
                        .tracking(-1.4)
                        .foregroundStyle(Theme.text)
                        .lineSpacing(5)
                    Text(slide.body)
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(Theme.textMid)
                        .lineSpacing(7)

                    ProgressBar(progress: Double(step + 1) / Double(totalSteps))
                        .padding(.top, 14)

                    HStack {
                        if step > 0 {
                            PressableButton(scaleTo: 0.94) { go(to: step - 1) } label: {
                                Text("Back")
                                    .font(.system(size: 13.5, weight: .bold))
                                    .foregroundStyle(Theme.textMid)
                            }
                            .buttonStyle(.plain)
                        }
                        Spacer()
                        AppButton(
                            label: step == slideCount - 1 ? "Set up my feed" : "Next",
                            full: false
                        ) { go(to: step + 1) }
                            .frame(width: 200)
                    }
                    .padding(.top, 16)
                }
                .padding(.bottom, 26)
            }
            .padding(.horizontal, 22)
            .opacity(fade ? 1 : 0)
        }
    }

    // MARK: - Form steps

    private var formStep: some View {
        ScrollView {
            VStack(spacing: 0) {
                HStack {
                    PressableButton(scaleTo: 0.94) { go(to: max(0, step - 1)) } label: {
                        Text("Back").font(.system(size: 13.5, weight: .bold)).foregroundStyle(Theme.textMid)
                    }
                    .buttonStyle(.plain)
                    Spacer()
                    Text("Step \(step - slideCount + 1) of 4")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Theme.textDim)
                    Spacer()
                    if step < readyStep {
                        PressableButton(scaleTo: 0.94) { go(to: step + 1) } label: {
                            Text("Skip").font(.system(size: 13.5, weight: .bold)).foregroundStyle(Theme.textMid)
                        }
                        .buttonStyle(.plain)
                    } else { Spacer().frame(width: 40) }
                }
                ProgressBar(progress: Double(step + 1) / Double(totalSteps))
                    .padding(.top, 14)

                switch step {
                case identityStep: identityStepView
                case tasteStep: tasteStepView
                case followStep: followStepView
                case readyStep: readyStepView
                default: EmptyView()
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, 28)
            .padding(.bottom, 40)
            .opacity(fade ? 1 : 0)
        }
        .background(Theme.ink.ignoresSafeArea())
        .scrollBounceBehavior(.basedOnSize)
    }

    // MARK: Identity

    @ViewBuilder private var identityStepView: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Your POVMe identity").microLabel(Theme.lime, size: 11)
            Text("What should creators call you?")
                .font(.system(size: 29, weight: .heavy))
                .tracking(-1.1)
                .foregroundStyle(Theme.text)
                .padding(.top, 10)
            Text("This is the name that shows in live chat, tips, and DMs. You can change it anytime in Settings.")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Theme.textMid)
                .lineSpacing(7)
                .padding(.top, 10)

            TextField("Your name or handle", text: $name)
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(Theme.text)
                .padding(.horizontal, 18)
                .frame(height: 58)
                .background(Theme.surface)
                .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
                .clipShape(.rect(cornerRadius: Theme.rMd))
                .padding(.top, 22)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.none)

            HStack(alignment: .top, spacing: 9) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.lime)
                Text("I confirm I'm 18+ and I accept POVMe's terms and content guidelines.")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.textDim)
                    .lineSpacing(6)
            }
            .padding(.top, 18)

            Spacer()
            AppButton(label: name.trimmingCharacters(in: .whitespaces).isEmpty ? "Continue as guest" : "Continue") {
                go(to: tasteStep)
            }
            .padding(.top, 20)
        }
    }

    // MARK: Taste

    @ViewBuilder private var tasteStepView: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Your taste").microLabel(Theme.lime, size: 11)
            Text("Whose life do you want to live?")
                .font(.system(size: 29, weight: .heavy))
                .tracking(-1.1)
                .foregroundStyle(Theme.text)
                .padding(.top, 10)
            Text("Pick a few. We'll shape your Discover feed around them — change it anytime.")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Theme.textMid)
                .lineSpacing(7)
                .padding(.top, 10)

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 100), spacing: 9)], spacing: 9) {
                ForEach(Category.all) { c in
                    Chip(label: c.label, active: picked.contains(c.id), accent: c.accent, emoji: c.emoji) {
                        if picked.contains(c.id) { picked.removeAll { $0 == c.id } }
                        else { picked.append(c.id) }
                    }
                }
            }
            .padding(.top, 24)

            Spacer()
            AppButton(label: picked.isEmpty ? "Continue" : "Continue · \(picked.count) selected") {
                go(to: followStep)
            }
            .padding(.top, 20)
        }
    }

    // MARK: Follow

    @ViewBuilder private var followStepView: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Seed your feed").microLabel(Theme.lime, size: 11)
            Text("Follow a few creators.")
                .font(.system(size: 29, weight: .heavy))
                .tracking(-1.1)
                .foregroundStyle(Theme.text)
                .padding(.top, 10)
            Text("Their new POV episodes and live streams land in your Following tab. You can unfollow anytime.")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Theme.textMid)
                .lineSpacing(7)
                .padding(.top, 10)

            ScrollView {
                VStack(spacing: 10) {
                    ForEach(recommendedCreators) { c in
                        followRow(c)
                    }
                }
                .padding(.bottom, 16)
            }
            .padding(.top, 18)

            AppButton(label: followed.isEmpty ? "Continue" : "Continue · following \(followed.count)") {
                go(to: readyStep)
            }
            .padding(.top, 20)
        }
    }

    private var recommendedCreators: [Creator] {
        picked.isEmpty ? Mock.creators : Mock.creators.filter { c in c.categories.contains { picked.contains($0) } }
    }

    private func followRow(_ c: Creator) -> some View {
        let isFollowed = followed.contains(c.id)
        return PressableButton(scaleTo: 0.98, haptic: Hap.light) {
            if isFollowed { followed.removeAll { $0 == c.id } }
            else { followed.append(c.id) }
        } label: {
            HStack(spacing: 12) {
                Avatar(uri: c.avatar, size: 46, ring: isFollowed)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 4) {
                        Text(c.name).font(.system(size: 15, weight: .heavy)).foregroundStyle(Theme.text).lineLimit(1)
                        if c.verified {
                            Image(systemName: "checkmark.seal.fill").font(.system(size: 14)).foregroundStyle(Theme.cyan)
                        }
                    }
                    Text("@\(c.handle) · \(c.location)")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.textDim)
                        .lineLimit(1)
                }
                Spacer()
                HStack(spacing: 5) {
                    Image(systemName: isFollowed ? "checkmark" : "person.crop.circle.badge.plus")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(isFollowed ? Theme.ink : Theme.text)
                    Text(isFollowed ? "Following" : "Follow")
                        .font(.system(size: 12.5, weight: .heavy))
                        .foregroundStyle(isFollowed ? Theme.ink : Theme.text)
                }
                .padding(.horizontal, 12)
                .frame(height: 32)
                .background(isFollowed ? Theme.lime : Theme.surfaceHi)
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.rPill)
                        .stroke(isFollowed ? Theme.lime : Theme.borderHi, lineWidth: 1)
                )
                .clipShape(.rect(cornerRadius: Theme.rPill))
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(isFollowed ? Theme.lime.opacity(0.06) : Theme.surface)
            .overlay(
                RoundedRectangle(cornerRadius: Theme.rMd)
                    .stroke(isFollowed ? Theme.lime : Theme.border, lineWidth: 1)
            )
            .clipShape(.rect(cornerRadius: Theme.rMd))
        }
        .buttonStyle(.plain)
    }

    // MARK: Ready

    @ViewBuilder private var readyStepView: some View {
        VStack(spacing: 0) {
            ZStack {
                Circle().fill(Theme.lime.opacity(0.12)).frame(width: 64, height: 64)
                Image(systemName: "party.popper.fill")
                    .font(.system(size: 26, weight: .bold))
                    .foregroundStyle(Theme.lime)
            }
            .overlay(Circle().stroke(Theme.lime.opacity(0.3), lineWidth: 1).frame(width: 64, height: 64))
            .padding(.bottom, 18)

            Text("'Bout time").microLabel(Theme.lime, size: 11)
            Text(name.trimmingCharacters(in: .whitespaces).isEmpty ? "Let's go." : "Let's go, \(name.trimmingCharacters(in: .whitespaces)).")
                .font(.system(size: 30, weight: .heavy))
                .tracking(-1.2)
                .foregroundStyle(Theme.text)
                .multilineTextAlignment(.center)
                .padding(.top, 6)
            Text("\"Your feed is ready.\"")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Theme.textMid)

            VStack(spacing: 14) {
                summaryRow(label: "Taste", value: picked.isEmpty ? "All" : "\(picked.count) categories")
                summaryRow(label: "Following", value: followed.isEmpty ? "Explore later" : "\(followed.count) creators")
                summaryRow(label: "Wallet", value: "$120 demo credit", accent: Theme.lime)
            }
            .padding(18)
            .background(Theme.surface)
            .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
            .clipShape(.rect(cornerRadius: Theme.rMd))
            .padding(.top, 28)

            Text("We've dropped $120 in demo credit into your wallet so you can subscribe, unlock, and tip right away. No card needed to explore.")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.textDim)
                .multilineTextAlignment(.center)
                .lineSpacing(6)
                .padding(.top, 18)
                .padding(.horizontal, 12)

            Spacer()
            AppButton(label: finishing ? "Saving…" : "Enter POVMe", disabled: finishing) {
                finish()
            }
            .padding(.top, 20)
        }
    }

    private func summaryRow(label: String, value: String, accent: Color = Theme.text) -> some View {
        HStack {
            Text(label).font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.textDim)
            Spacer()
            Text(value).font(.system(size: 14, weight: .heavy)).foregroundStyle(accent)
        }
    }

    // MARK: - Actions

    private func go(to next: Int) {
        let clamped = max(0, min(readyStep, next))
        withAnimation(.easeOut(duration: 0.13)) { fade = false }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.13) {
            step = clamped
            withAnimation(.easeIn(duration: 0.24)) { fade = true }
        }
    }

    private func finish() {
        finishing = true
        app.completeOnboarding(name: name, interests: picked)
        finishing = false
        router.popToRoot()
        router.selectedTab = .feed
    }
}

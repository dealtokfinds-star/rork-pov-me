import SwiftUI

/// POVMe sign-in — cinematic launch screen with Google + Apple CTAs.
/// Mirrors the Expo sign-in.tsx design language.
struct SignInView: View {
    @Environment(AppState.self) private var app
    @State private var fade = false

    var body: some View {
        ZStack {
            Color(Theme.ink).ignoresSafeArea()

            // Atmospheric hero image
            AsyncImage(url: URL(string: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80")) { phase in
                switch phase {
                case .success(let img): img.resizable().scaledToFill().blur(radius: 8)
                default: Color(Theme.ink)
                }
            }
            .ignoresSafeArea()
            .overlay(
                LinearGradient(
                    colors: [Theme.ink.opacity(0.45), Theme.ink.opacity(0.78), Theme.ink],
                    startPoint: .top, endPoint: .bottom
                )
                .ignoresSafeArea()
            )

            // Ambient glow
            Circle()
                .fill(Theme.lime.opacity(0.08))
                .frame(width: 600, height: 600)
                .offset(y: -300)
                .allowsHitTesting(false)

            ScrollView {
                VStack(spacing: 0) {
                    Spacer().frame(height: 48)

                    VStack(alignment: .leading, spacing: 0) {
                        // Icon badge
                        ZStack {
                            Circle().fill(Theme.lime).frame(width: 48, height: 48)
                            Image(systemName: "eye.fill")
                                .font(.system(size: 24, weight: .bold))
                                .foregroundStyle(Theme.ink)
                        }
                        .shadow(color: Theme.lime.opacity(0.35), radius: 16, y: 6)
                        .padding(.bottom, 22)

                        Wordmark(size: 42)
                            .padding(.bottom, 12)

                        Text("Step inside someone else's life")
                            .microLabel(Theme.lime, size: 11)
                            .padding(.bottom, 18)

                        Text("Don't watch their day.\nWear it.")
                            .font(.system(size: 32, weight: .heavy))
                            .tracking(-1.2)
                            .foregroundStyle(Theme.text)
                            .lineSpacing(38)
                            .kerning(-1.2)
                            .padding(.bottom, 16)

                        Text("Subscribe to creators, unlock POV episodes, tip in live chats, and broadcast your own life from a body cam.")
                            .font(.system(size: 15, weight: .medium))
                            .foregroundStyle(Theme.textMid)
                            .lineSpacing(7)

                        // Trust strip
                        HStack(spacing: 8) {
                            trustChip(icon: "eye.fill", color: Theme.lime, label: "First-person")
                            trustChip(icon: "shield.fill", color: Theme.cyan, label: "18+ only")
                            trustChip(icon: "chevron.right", color: Theme.magenta, label: "Cancel anytime")
                        }
                        .padding(.top, 22)
                    }

                    Spacer()

                    VStack(spacing: 14) {
                        if app.authLoading == false && !app.signedIn {
                            // Google button
                            AppButton(label: "Continue with Google", variant: .dark, full: true) {
                                app.authLoading = false
                                app.signedIn = true
                                Task { await app.hydrateFromServer() }
                            }

                            // Apple button
                            AppButton(label: "Continue with Apple", variant: .ghost, full: true) {
                                app.authLoading = false
                                app.signedIn = true
                                Task { await app.hydrateFromServer() }
                            }
                            .background(Color.black.clipShape(.rect(cornerRadius: Theme.rPill)))
                            .overlay(
                                RoundedRectangle(cornerRadius: Theme.rPill)
                                    .stroke(Color.white.opacity(0.18), lineWidth: 1)
                            )

                            Text("By continuing you confirm you're 18+ and accept POVMe's Terms, Privacy Policy, and Content Guidelines.")
                                .font(.system(size: 11.5, weight: .semibold))
                                .foregroundStyle(Theme.textDim)
                                .multilineTextAlignment(.center)
                                .lineSpacing(5)
                                .padding(.top, 8)
                        }
                    }
                    .padding(.bottom, 28)
                }
                .padding(.horizontal, 22)
                .frame(minHeight: 0)
                .opacity(fade ? 1 : 0)
                .offset(y: fade ? 0 : 18)
            }
            .ignoresSafeArea(edges: [.top, .bottom])
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.7)) { fade = true }
            // Simulate auth resolution
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                app.authLoading = false
            }
        }
    }

    private func trustChip(icon: String, color: Color, label: String) -> some View {
        HStack(spacing: 5) {
            Image(systemName: icon).font(.system(size: 12, weight: .medium)).foregroundStyle(color)
            Text(label).font(.system(size: 11, weight: .bold)).foregroundStyle(Theme.textMid)
        }
        .padding(.horizontal, 10)
        .frame(height: 28)
        .background(Color.white.opacity(0.06))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.rPill)
                .stroke(Color.white.opacity(0.1), lineWidth: 1)
        )
        .clipShape(.rect(cornerRadius: Theme.rPill))
    }
}

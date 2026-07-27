import SwiftUI

/// Go Live modal — set up a live stream (title, category, access, PPV price), then start broadcasting.
/// Note: Real RTMP streaming requires a native encoder. This screen sets up the stream config.
struct GoLiveView: View {
    @Environment(AppState.self) private var app
    @Environment(Router.self) private var router
    @State private var title = ""
    @State private var category: PovCategory = .founder
    @State private var access: StreamAccess = .public
    @State private var ppvPrice = "4.99"
    @State private var live = false

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                if live {
                    liveView
                } else {
                    setupForm
                }
            }
            .padding(.horizontal, 22)
            .padding(.bottom, 40)
            .padding(.top, 20)
        }
        .background(Theme.bg.ignoresSafeArea())
        .navigationTitle("Go live")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var setupForm: some View {
        VStack(alignment: .leading, spacing: 20) {
            // Preview card
            ZStack(alignment: .bottomLeading) {
                Color(Theme.surface).frame(height: 180)
                AsyncImage(url: URL(string: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=600&q=80")) { phase in
                    switch phase {
                    case .success(let img): img.resizable().scaledToFill()
                    default: Color(Theme.surface)
                    }
                }
                .frame(height: 180)
                .overlay(
                    LinearGradient(colors: [Theme.magenta.opacity(0.18), .clear, Theme.ink.opacity(0.9)], startPoint: .top, endPoint: .bottom)
                )
                VStack(alignment: .leading, spacing: 6) {
                    LiveBadge()
                    Text(title.isEmpty ? "Your stream title" : title)
                        .font(.system(size: 18, weight: .heavy)).foregroundStyle(Theme.text)
                        .lineLimit(2)
                }
                .padding(14)
            }
            .frame(height: 180)
            .clipShape(.rect(cornerRadius: Theme.rLg))
            .overlay(RoundedRectangle(cornerRadius: Theme.rLg).stroke(Theme.magenta.opacity(0.25), lineWidth: 1))

            // Title
            VStack(alignment: .leading, spacing: 8) {
                Text("Stream title").microLabel(Theme.magenta, size: 10)
                TextField("LIVE: what are you doing right now?", text: $title)
                    .font(.system(size: 16, weight: .bold)).foregroundStyle(Theme.text)
                    .padding(.horizontal, 14).frame(height: 52)
                    .background(Theme.surface)
                    .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
                    .clipShape(.rect(cornerRadius: Theme.rMd))
            }

            // Category
            VStack(alignment: .leading, spacing: 8) {
                Text("Category").microLabel(Theme.magenta, size: 10)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(Category.all) { c in
                            Chip(label: c.label, active: category == c.id, accent: c.accent, emoji: c.emoji) {
                                category = c.id
                            }
                        }
                    }
                }
            }

            // Access
            VStack(alignment: .leading, spacing: 8) {
                Text("Who can watch").microLabel(Theme.magenta, size: 10)
                VStack(spacing: 8) {
                    accessRow("person.3.fill", "Public", "Anyone on POVMe", .public)
                    accessRow("person.2.fill", "Subscribers only", "Your active subs", .subscribers)
                    accessRow("lock.fill", "PPV", "One-time unlock fee", .ppv)
                }
            }

            // PPV price
            if access == .ppv {
                VStack(alignment: .leading, spacing: 8) {
                    Text("PPV unlock price").microLabel(Theme.cyan, size: 10)
                    HStack(spacing: 8) {
                        Text("$").font(.system(size: 20, weight: .heavy)).foregroundStyle(Theme.cyan)
                        TextField("4.99", text: $ppvPrice)
                            .font(.system(size: 20, weight: .heavy)).foregroundStyle(Theme.text)
                            .keyboardType(.decimalPad)
                    }
                    .padding(.horizontal, 14).frame(height: 52)
                    .background(Theme.surface)
                    .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
                    .clipShape(.rect(cornerRadius: Theme.rMd))
                }
            }

            // Info card
            VStack(alignment: .leading, spacing: 10) {
                infoRow("video.fill", "Streaming via Mux Live — RTMP ingest from your encoder")
                infoRow("chat.fill", "Real-time chat with moderation, slow mode, gifts")
                infoRow("banknote.fill", "You keep 80% of all tips and PPV fees during the stream")
            }
            .padding(14)
            .background(Theme.surface)
            .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
            .clipShape(.rect(cornerRadius: Theme.rMd))

            Spacer(minLength: 20)
            AppButton(label: title.isEmpty ? "Add a title first" : "Go live now", variant: .live, disabled: title.isEmpty) {
                live = true
            }
        }
    }

    private func accessRow(_ icon: String, _ title: String, _ body: String, _ level: StreamAccess) -> some View {
        PressableButton(scaleTo: 0.97) { access = level } label: {
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(Theme.surfaceHi).frame(width: 36, height: 36)
                    Image(systemName: icon).font(.system(size: 15, weight: .medium))
                        .foregroundStyle(access == level ? Theme.magenta : Theme.textMid)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.system(size: 14, weight: .heavy))
                        .foregroundStyle(access == level ? Theme.text : Theme.textMid)
                    Text(body).font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.textDim)
                }
                Spacer()
                if access == level {
                    Circle().fill(Theme.magenta).frame(width: 10, height: 10)
                }
            }
            .padding(.horizontal, 14).frame(height: 56)
            .background(access == level ? Theme.magenta.opacity(0.08) : Theme.surface)
            .overlay(
                RoundedRectangle(cornerRadius: Theme.rMd)
                    .stroke(access == level ? Theme.magenta.opacity(0.3) : Theme.border, lineWidth: 1)
            )
            .clipShape(.rect(cornerRadius: Theme.rMd))
        }
        .buttonStyle(.plain)
    }

    private func infoRow(_ icon: String, _ text: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon).font(.system(size: 13, weight: .medium)).foregroundStyle(Theme.lime)
            Text(text).font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.textMid)
        }
    }

    private var liveView: some View {
        VStack(spacing: 20) {
            ZStack {
                RoundedRectangle(cornerRadius: Theme.rLg)
                    .fill(Theme.surface)
                    .frame(height: 240)
                VStack(spacing: 12) {
                    LiveBadge(viewers: 0)
                    Text(title)
                        .font(.system(size: 20, weight: .heavy)).foregroundStyle(Theme.text)
                        .multilineTextAlignment(.center)
                    Text("Stream is being set up…")
                        .font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.textDim)
                    Image(systemName: "dot.radiowaves.left.and.right")
                        .font(.system(size: 40, weight: .bold))
                        .foregroundStyle(Theme.magenta)
                        .symbolEffect(.variableColor.iterative)
                }
            }
            .frame(height: 240)

            VStack(alignment: .leading, spacing: 12) {
                Text("Stream details").microLabel(Theme.magenta, size: 10)
                detailRow("Status", "Connecting to Mux Live", Theme.gold)
                detailRow("Access", access == .public ? "Public" : access == .subscribers ? "Subscribers" : "PPV \(Fmt.moneyComma(Double(ppvPrice) ?? 0))", Theme.text)
                detailRow("Category", Category.by(category).label, Theme.text)
                detailRow("Chat", "Enabled — slow mode off", Theme.lime)
                detailRow("Recording", "Auto-saving replay to vault", Theme.cyan)
            }
            .padding(18)
            .background(Theme.surface)
            .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
            .clipShape(.rect(cornerRadius: Theme.rMd))

            Text("Demo mode: Real RTMP streaming requires an external encoder (OBS, chest rig) pushing to Mux Live. The Expo app handles the full pipeline.")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.textDim)
                .multilineTextAlignment(.center)
                .lineSpacing(4)

            Spacer(minLength: 10)
            AppButton(label: "End stream", variant: .dark, full: true) {
                live = false
                router.pop()
            }
        }
    }

    private func detailRow(_ label: String, _ value: String, _ color: Color) -> some View {
        HStack {
            Text(label).font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.textDim)
            Spacer()
            Text(value).font(.system(size: 13, weight: .heavy)).foregroundStyle(color)
        }
    }
}

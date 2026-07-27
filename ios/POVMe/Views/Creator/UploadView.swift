import SwiftUI

/// Upload modal — publish a new POV episode (title, thumbnail, access, price, category, status).
struct UploadView: View {
    @Environment(AppState.self) private var app
    @Environment(Router.self) private var router
    @State private var title = ""
    @State private var category: PovCategory = .founder
    @State private var access: AccessLevel = .subscribers
    @State private var ppvPrice = "9.99"
    @State private var status: StudioEpisode.StudioStatus = .published
    @State private var thumbUrl = "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=500&q=80"
    @State private var published = false

    private let thumbOptions = [
        "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=500&q=80",
        "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=500&q=80",
        "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=500&q=80",
        "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=500&q=80",
    ]

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                if published {
                    publishedView
                } else {
                    form
                }
            }
            .padding(.horizontal, 22)
            .padding(.bottom, 40)
            .padding(.top, 20)
        }
        .background(Theme.bg.ignoresSafeArea())
        .navigationTitle("New episode")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var form: some View {
        VStack(alignment: .leading, spacing: 20) {
            // Title
            VStack(alignment: .leading, spacing: 8) {
                Text("Episode title").microLabel(Theme.lime, size: 10)
                TextField("4:00 AM: you wake up as…", text: $title)
                    .font(.system(size: 16, weight: .bold)).foregroundStyle(Theme.text)
                    .padding(.horizontal, 14).frame(height: 52)
                    .background(Theme.surface)
                    .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
                    .clipShape(.rect(cornerRadius: Theme.rMd))
            }

            // Thumbnail
            VStack(alignment: .leading, spacing: 8) {
                Text("Thumbnail").microLabel(Theme.lime, size: 10)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(thumbOptions, id: \.self) { url in
                            PressableButton(scaleTo: 0.95) { thumbUrl = url } label: {
                                AsyncImage(url: URL(string: url)) { phase in
                                    switch phase {
                                    case .success(let img): img.resizable().scaledToFill()
                                    default: Color(Theme.surface)
                                    }
                                }
                                .frame(width: 110, height: 70)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10)
                                        .stroke(thumbUrl == url ? Theme.lime : Theme.border, lineWidth: thumbUrl == url ? 2 : 1)
                                )
                                .clipShape(.rect(cornerRadius: 10))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }

            // Category
            VStack(alignment: .leading, spacing: 8) {
                Text("Category").microLabel(Theme.lime, size: 10)
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
                Text("Access").microLabel(Theme.lime, size: 10)
                HStack(spacing: 8) {
                    accessChip("Free", .free, Theme.lime)
                    accessChip("Subs", .subscribers, Theme.textMid)
                    accessChip("PPV", .ppv, Theme.cyan)
                }
            }

            // PPV price
            if access == .ppv {
                VStack(alignment: .leading, spacing: 8) {
                    Text("PPV unlock price").microLabel(Theme.cyan, size: 10)
                    HStack(spacing: 8) {
                        Text("$").font(.system(size: 20, weight: .heavy)).foregroundStyle(Theme.cyan)
                        TextField("9.99", text: $ppvPrice)
                            .font(.system(size: 20, weight: .heavy)).foregroundStyle(Theme.text)
                            .keyboardType(.decimalPad)
                    }
                    .padding(.horizontal, 14).frame(height: 52)
                    .background(Theme.surface)
                    .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
                    .clipShape(.rect(cornerRadius: Theme.rMd))
                }
            }

            // Status
            VStack(alignment: .leading, spacing: 8) {
                Text("When to publish").microLabel(Theme.lime, size: 10)
                VStack(spacing: 8) {
                    statusChip("Publish now", .published, "paperplane.fill")
                    statusChip("Schedule for later", .scheduled, "calendar")
                    statusChip("Save as draft", .draft, "tray.fill")
                }
            }

            Spacer(minLength: 20)
            AppButton(label: title.isEmpty ? "Add a title first" : "Publish episode", disabled: title.isEmpty) {
                publish()
            }
        }
    }

    private func accessChip(_ label: String, _ level: AccessLevel, _ color: Color) -> some View {
        Chip(label: label, active: access == level, accent: color) { access = level }
    }

    private func statusChip(_ label: String, _ st: StudioEpisode.StudioStatus, _ icon: String) -> some View {
        PressableButton(scaleTo: 0.97) { status = st } label: {
            HStack(spacing: 8) {
                Image(systemName: icon).font(.system(size: 14, weight: .medium))
                    .foregroundStyle(status == st ? Theme.ink : Theme.textMid)
                Text(label).font(.system(size: 14, weight: .heavy))
                    .foregroundStyle(status == st ? Theme.ink : Theme.textMid)
                Spacer()
                if status == st {
                    Image(systemName: "checkmark").font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.ink)
                }
            }
            .padding(.horizontal, 14).frame(height: 48)
            .background(status == st ? Theme.lime : Theme.surface)
            .overlay(
                RoundedRectangle(cornerRadius: Theme.rMd)
                    .stroke(status == st ? Theme.lime : Theme.border, lineWidth: 1)
            )
            .clipShape(.rect(cornerRadius: Theme.rMd))
        }
        .buttonStyle(.plain)
    }

    private var publishedView: some View {
        VStack(spacing: 16) {
            Spacer()
            ZStack {
                Circle().fill(Theme.lime.opacity(0.12)).frame(width: 80, height: 80)
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 32, weight: .bold)).foregroundStyle(Theme.lime)
            }
            .overlay(Circle().stroke(Theme.lime.opacity(0.3), lineWidth: 1).frame(width: 80, height: 80))
            Text(status == .published ? "Episode published" : status == .scheduled ? "Episode scheduled" : "Draft saved")
                .font(.system(size: 24, weight: .heavy)).foregroundStyle(Theme.text)
            Text("\"\(title)\" is now in your studio vault.")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Theme.textMid)
                .multilineTextAlignment(.center)
            VStack(spacing: 10) {
                AppButton(label: "Go to studio") { router.popToRoot(); router.selectedTab = .studio }
                AppButton(label: "Upload another", variant: .dark, full: true) {
                    title = ""; published = false
                }
            }
            .padding(.top, 12)
            Spacer()
        }
    }

    private func publish() {
        let p: Double? = access == .ppv ? Double(ppvPrice) : nil
        app.publishEpisode(.init(
            title: title, thumb: thumbUrl, access: access,
            ppvPrice: p, category: category, status: status
        ))
        published = true
    }
}

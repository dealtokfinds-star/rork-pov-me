import SwiftUI
import AVKit

/// Live viewer — video stream, live chat overlay, viewer count, tip/gift actions.
struct LiveViewScreen: View {
    let streamId: String
    @Environment(AppState.self) private var app
    @Environment(Router.self) private var router
    @State private var player: AVPlayer?
    @State private var chat: [ChatMessage] = []
    @State private var chatTimer: Timer?
    @State private var newMessage = ""
    @State private var showGifts = false

    private var stream: LiveStream? { Mock.stream(streamId) }
    private var creator: Creator? { stream.flatMap { Mock.creator($0.creatorId) } }
    private var cat: Category { Category.by(stream?.category ?? .trader) }
    private var hasAccess: Bool {
        guard let s = stream else { return false }
        switch s.access {
        case .public: return true
        case .subscribers: return app.isSubscribed(s.creatorId)
        case .ppv: return app.hasStreamAccess(s.id)
        }
    }

    var body: some View {
        if let stream, let creator {
            ZStack {
                Color.black.ignoresSafeArea()

                if hasAccess {
                    if let player {
                        VideoPlayer(player: player)
                            .ignoresSafeArea()
                    } else {
                        ProgressView().tint(Theme.lime)
                    }
                } else {
                    paywall(stream, creator)
                }

                // Overlay UI
                VStack {
                    topBar(stream, creator)
                    Spacer()
                    if hasAccess {
                        chatOverlay
                    }
                }

                if showGifts {
                    giftSheet(creator)
                }
            }
            .onAppear {
                if hasAccess { setupPlayer(stream); startChat() }
            }
            .onDisappear { chatTimer?.invalidate(); player?.pause() }
        } else {
            notFound
        }
    }

    private func setupPlayer(_ s: LiveStream) {
        guard let url = URL(string: s.video) else { return }
        let p = AVPlayer(url: url)
        p.isMuted = false
        p.play()
        player = p
    }

    private func startChat() {
        // Seed a few messages
        chat = (0..<6).map { _ in Mock.nextChat() }
        chatTimer = Timer.scheduledTimer(withTimeInterval: 2.2, repeats: true) { _ in
            chat.append(Mock.nextChat())
            if chat.count > 40 { chat.removeFirst(chat.count - 40) }
        }
    }

    private func topBar(_ s: LiveStream, _ c: Creator) -> some View {
        HStack(spacing: 10) {
            PressableButton(scaleTo: 0.9) { router.pop() } label: {
                ZStack {
                    Circle().fill(Color.black.opacity(0.55)).frame(width: 38, height: 38)
                    Image(systemName: "chevron.left").font(.system(size: 20, weight: .medium)).foregroundStyle(Theme.text)
                }
            }
            .buttonStyle(.plain)
            LiveBadge(viewers: s.viewers)
            Spacer()
            HStack(spacing: 8) {
                Avatar(uri: c.avatar, size: 32, ring: true, live: true)
                Text(c.name)
                    .font(.system(size: 14, weight: .heavy))
                    .foregroundStyle(.white)
            }
        }
        .padding(.horizontal, 14)
        .padding(.top, 54)
    }

    private var chatOverlay: some View {
        VStack(spacing: 0) {
            // Chat messages
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(chat) { msg in
                            chatRow(msg).id(msg.id)
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                }
                .onChange(of: chat.count) { _, _ in
                    if let last = chat.last {
                        withAnimation(.easeOut(duration: 0.2)) {
                            proxy.scrollTo(last.id, anchor: .bottom)
                        }
                    }
                }
            }
            .frame(maxHeight: 240)
            .background(Color.black.opacity(0.3))

            // Input bar
            HStack(spacing: 8) {
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass").font(.system(size: 14)).foregroundStyle(Theme.textDim)
                    TextField("Say something…", text: $newMessage)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.text)
                }
                .padding(.horizontal, 12)
                .frame(height: 38)
                .background(Color.black.opacity(0.4))
                .overlay(RoundedRectangle(cornerRadius: Theme.rPill).stroke(Theme.border, lineWidth: 1))
                .clipShape(.rect(cornerRadius: Theme.rPill))

                PressableButton(scaleTo: 0.9) { showGifts.toggle() } label: {
                    ZStack {
                        Circle().fill(Theme.gold.opacity(0.2)).frame(width: 38, height: 38)
                        Image(systemName: "gift.fill").font(.system(size: 16, weight: .medium)).foregroundStyle(Theme.gold)
                    }
                    .overlay(Circle().stroke(Theme.gold.opacity(0.4), lineWidth: 1))
                }
                .buttonStyle(.plain)

                PressableButton(scaleTo: 0.9) {
                    if !newMessage.trimmingCharacters(in: .whitespaces).isEmpty {
                        chat.append(.init(id: "me\(chat.count)", user: app.handle, color: Theme.lime, text: newMessage, badge: .sub, kind: .chat, amount: nil))
                        newMessage = ""
                    }
                } label: {
                    ZStack {
                        Circle().fill(Theme.lime).frame(width: 38, height: 38)
                        Image(systemName: "paperplane.fill").font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.ink)
                    }
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 12)
            .padding(.bottom, 28)
            .background(Color.black.opacity(0.4))
        }
    }

    private func chatRow(_ msg: ChatMessage) -> some View {
        HStack(alignment: .top, spacing: 6) {
            if msg.kind == .tip {
                HStack(spacing: 4) {
                    Image(systemName: "sparkles").font(.system(size: 10)).foregroundStyle(Theme.gold)
                    Text("\(msg.user) tipped \(Fmt.moneyComma(msg.amount ?? 0))")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Theme.gold)
                }
                .padding(.horizontal, 8).padding(.vertical, 3)
                .background(Theme.gold.opacity(0.15))
                .clipShape(.rect(cornerRadius: 6))
            } else if msg.kind == .join {
                Text("\(msg.user) joined the POV")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.textDim)
            } else {
                HStack(spacing: 5) {
                    if msg.badge == .sub {
                        Text("SUB").font(.system(size: 8, weight: .heavy)).tracking(0.8).foregroundStyle(Theme.ink)
                            .padding(.horizontal, 4).padding(.vertical, 2)
                            .background(Theme.lime).clipShape(.rect(cornerRadius: 3))
                    }
                    Text(msg.user).font(.system(size: 12, weight: .bold)).foregroundStyle(msg.color)
                    Text(msg.text).font(.system(size: 12, weight: .medium)).foregroundStyle(Theme.text)
                }
            }
            Spacer()
        }
    }

    private func paywall(_ s: LiveStream, _ c: Creator) -> some View {
        ZStack {
            AsyncImage(url: URL(string: s.thumb)) { phase in
                switch phase {
                case .success(let img): img.resizable().scaledToFill()
                default: Color(Theme.surface)
                }
            }
            .ignoresSafeArea()
            .blur(radius: 20)
            .overlay(Color.black.opacity(0.6).ignoresSafeArea())

            VStack(spacing: 16) {
                ZStack {
                    Circle().fill(Theme.cyan).frame(width: 52, height: 52)
                    Image(systemName: "lock.fill").font(.system(size: 22, weight: .bold)).foregroundStyle(Theme.ink)
                }
                Text(s.access == .ppv ? "PPV Live Event" : "Subscribers Only")
                    .font(.system(size: 20, weight: .heavy)).foregroundStyle(Theme.text)
                Text(s.access == .ppv
                     ? "Unlock this live stream for \(Fmt.moneyComma(s.ppvPrice ?? 0))."
                     : "Subscribe to @\(c.handle) for \(Fmt.moneyComma(c.subPrice))/mo to join the live.")
                    .font(.system(size: 13.5, weight: .medium))
                    .foregroundStyle(Theme.textMid)
                    .multilineTextAlignment(.center)
                    .lineSpacing(5)
                AppButton(
                    label: s.access == .ppv ? "Unlock for \(Fmt.moneyComma(s.ppvPrice ?? 0))" : "Subscribe · \(Fmt.moneyComma(c.subPrice))/mo",
                    variant: s.access == .ppv ? .ppv : .primary
                ) {
                    router.push(s.access == .ppv ? .unlock(s.id) : .subscribe(c.id))
                }
                .frame(width: 280)
            }
            .padding(.horizontal, 32)
        }
    }

    private func giftSheet(_ c: Creator) -> some View {
        VStack {
            Spacer()
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("Send a gift").font(.system(size: 17, weight: .heavy)).foregroundStyle(Theme.text)
                    Spacer()
                    PressableButton(scaleTo: 0.9) { showGifts = false } label: {
                        Image(systemName: "xmark.circle.fill").font(.system(size: 22)).foregroundStyle(Theme.textDim)
                    }
                    .buttonStyle(.plain)
                }
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 100), spacing: 10)], spacing: 10) {
                    ForEach(Mock.gifts) { g in
                        PressableButton(scaleTo: 0.94, haptic: Hap.medium) {
                            if app.tip(c.id, amount: g.price, label: g.name) {
                                chat.append(.init(id: "gift\(chat.count)", user: app.handle, color: Theme.lime, text: "sent \(g.emoji) \(g.name)", badge: .top, kind: .gift, amount: g.price))
                                showGifts = false
                            }
                        } label: {
                            VStack(spacing: 6) {
                                Text(g.emoji).font(.system(size: 28))
                                Text(g.name).font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.text)
                                Text(Fmt.moneyComma(g.price)).font(.system(size: 11, weight: .heavy)).foregroundStyle(Theme.gold)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(Theme.surface)
                            .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
                            .clipShape(.rect(cornerRadius: Theme.rMd))
                        }
                        .buttonStyle(.plain)
                    }
                }
                Text("Balance: \(Fmt.moneyComma(app.balance))")
                    .font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.textDim)
            }
            .padding(18)
            .background(Theme.bg)
            .overlay(RoundedRectangle(cornerRadius: Theme.rLg).stroke(Theme.border, lineWidth: 1))
            .clipShape(.rect(cornerRadius: Theme.rLg))
            .padding(18)
            .padding(.bottom, 20)
        }
        .transition(.move(edge: .bottom))
    }

    private var notFound: some View {
        VStack(spacing: 12) {
            Text("Stream unavailable").font(.system(size: 20, weight: .heavy)).foregroundStyle(Theme.text)
            AppButton(label: "Back", full: false) { router.pop() }.frame(width: 120).padding(.top, 8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black.ignoresSafeArea())
        .padding(.top, 100)
    }
}

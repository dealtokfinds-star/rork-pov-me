import SwiftUI

/// Messages list screen — DM threads with creators.
struct MessagesView: View {
    @Environment(AppState.self) private var app
    @Environment(Router.self) private var router

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                ForEach(Array(Mock.dmThreads.enumerated()), id: \.element.id) { idx, thread in
                    if let c = Mock.creator(thread.creatorId) {
                        threadRow(thread, c)
                        if idx < Mock.dmThreads.count - 1 {
                            AppDivider().padding(.leading, 72)
                        }
                    }
                }
            }
            .padding(.horizontal, 18)
            .background(Theme.surface)
            .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1))
            .clipShape(.rect(cornerRadius: Theme.rMd))
            .padding(.horizontal, 18)
            .padding(.top, 16)
        }
        .background(Theme.bg.ignoresSafeArea())
        .navigationTitle("Messages")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func threadRow(_ thread: DmThread, _ c: Creator) -> some View {
        let lastMsg = thread.messages.last
        let hasUnread = thread.messages.contains { $0.locked }
        return PressableButton(scaleTo: 0.99) { router.push(.messageThread(thread.id)) } label: {
            HStack(spacing: 12) {
                Avatar(uri: c.avatar, size: 48, ring: true, live: c.isLive)
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(c.name).font(.system(size: 15, weight: .heavy)).foregroundStyle(Theme.text).lineLimit(1)
                        if c.verified {
                            Image(systemName: "checkmark.seal.fill").font(.system(size: 13)).foregroundStyle(Theme.lime)
                        }
                        Spacer()
                        Text(lastMsg?.at.formatted(.relative(presentation: .named)) ?? "")
                            .font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.textDim)
                    }
                    if let lastMsg {
                        if lastMsg.locked {
                            HStack(spacing: 5) {
                                Image(systemName: "lock.fill").font(.system(size: 11)).foregroundStyle(Theme.cyan)
                                Text("Locked message · \(Fmt.moneyComma(lastMsg.price ?? 0))")
                                    .font(.system(size: 12.5, weight: .semibold)).foregroundStyle(Theme.cyan)
                            }
                        } else {
                            Text(lastMsg.text)
                                .font(.system(size: 12.5, weight: .semibold))
                                .foregroundStyle(Theme.textDim)
                                .lineLimit(1)
                        }
                    }
                }
                if hasUnread {
                    Circle().fill(Theme.cyan).frame(width: 8, height: 8)
                }
            }
            .padding(.horizontal, 14).padding(.vertical, 12)
        }
        .buttonStyle(.plain)
    }
}

/// Message thread screen — conversation with a creator, with paid DM support.
struct MessageThreadView: View {
    let threadId: String
    @Environment(AppState.self) private var app
    @Environment(Router.self) private var router
    @State private var newMessage = ""
    @State private var messages: [DmMessage] = []

    private var thread: DmThread? { Mock.dmThreads.first { $0.id == threadId } }
    private var creator: Creator? { thread.flatMap { Mock.creator($0.creatorId) } }

    var body: some View {
        if let thread, let creator {
            VStack(spacing: 0) {
                ScrollViewReader { proxy in
                    ScrollView {
                        VStack(spacing: 12) {
                            ForEach(messages) { msg in
                                messageBubble(msg, creator)
                                    .id(msg.id)
                            }
                        }
                        .padding(.horizontal, 18)
                        .padding(.vertical, 16)
                    }
                    .onChange(of: messages.count) { _, _ in
                        if let last = messages.last {
                            withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                        }
                    }
                }
                inputBar(creator)
            }
            .background(Theme.bg.ignoresSafeArea())
            .navigationTitle(creator.name)
            .navigationBarTitleDisplayMode(.inline)
            .onAppear { messages = thread.messages }
        } else {
            VStack(spacing: 12) {
                Text("Thread not found").font(.system(size: 20, weight: .heavy)).foregroundStyle(Theme.text)
                AppButton(label: "Back", full: false) { router.pop() }.frame(width: 120).padding(.top, 8)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.bg.ignoresSafeArea())
        }
    }

    private func messageBubble(_ msg: DmMessage, _ c: Creator) -> some View {
        HStack {
            if msg.fromMe { Spacer(minLength: 60) }
            VStack(alignment: msg.fromMe ? .trailing : .leading, spacing: 4) {
                if msg.locked {
                    lockedBubble(msg)
                } else {
                    Text(msg.text)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(msg.fromMe ? Theme.ink : Theme.text)
                        .padding(.horizontal, 14).padding(.vertical, 10)
                        .background(msg.fromMe ? Theme.lime : Theme.surface)
                        .overlay(
                            RoundedRectangle(cornerRadius: Theme.rMd)
                                .stroke(msg.fromMe ? Theme.lime : Theme.border, lineWidth: 1)
                        )
                        .clipShape(.rect(cornerRadius: Theme.rMd))
                }
                Text(msg.at.formatted(.dateTime.hour().minute()))
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(Theme.textDim)
            }
            if !msg.fromMe { Spacer(minLength: 60) }
        }
    }

    private func lockedBubble(_ msg: DmMessage) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "lock.fill").font(.system(size: 14)).foregroundStyle(Theme.cyan)
                Text("Locked message from \(creator?.name.split(separator: " ").first.map(String.init) ?? "creator")")
                    .font(.system(size: 13, weight: .heavy)).foregroundStyle(Theme.cyan)
            }
            Text("This is a paid POV message. Unlock to read and see the request.")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.textDim)
                .lineSpacing(4)
            AppButton(label: "Unlock for \(Fmt.moneyComma(msg.price ?? 0))", variant: .ppv, full: false, small: true) {
                if app.charge(msg.price ?? 0) {
                    if let idx = messages.firstIndex(where: { $0.id == msg.id }) {
                        messages[idx] = DmMessage(id: msg.id, fromMe: msg.fromMe, text: msg.text, at: msg.at, locked: false, price: nil)
                    }
                }
            }
            .frame(width: 180)
        }
    .padding(14)
    .background(Theme.cyan.opacity(0.08))
    .overlay(RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.cyan.opacity(0.25), lineWidth: 1))
    .clipShape(.rect(cornerRadius: Theme.rMd))
    }

    private func inputBar(_ c: Creator) -> some View {
        HStack(spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "pencil").font(.system(size: 14)).foregroundStyle(Theme.textDim)
                TextField("Message \(c.name.split(separator: " ").first.map(String.init) ?? c.name)…", text: $newMessage)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.text)
            }
            .padding(.horizontal, 14)
            .frame(height: 44)
            .background(Theme.surface)
            .overlay(RoundedRectangle(cornerRadius: Theme.rPill).stroke(Theme.border, lineWidth: 1))
            .clipShape(.rect(cornerRadius: Theme.rPill))

            PressableButton(scaleTo: 0.9) {
                if !newMessage.trimmingCharacters(in: .whitespaces).isEmpty {
                    messages.append(.init(id: "m\(messages.count)", fromMe: true, text: newMessage, at: Date(), locked: false, price: nil))
                    newMessage = ""
                }
            } label: {
                ZStack {
                    Circle().fill(Theme.lime).frame(width: 44, height: 44)
                    Image(systemName: "paperplane.fill")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Theme.ink)
                }
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(Theme.bg)
    }
}

import SwiftUI

/// Notifications screen — list of notification items with type icons.
struct NotificationsView: View {
    @Environment(AppState.self) private var app
    @Environment(Router.self) private var router

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                ForEach(Array(Mock.notifications.enumerated()), id: \.element.id) { idx, n in
                    notificationRow(n)
                    if idx < Mock.notifications.count - 1 {
                        AppDivider().padding(.leading, 58)
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
        .navigationTitle("Notifications")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func notificationRow(_ n: NotificationItem) -> some View {
        PressableButton(scaleTo: 0.99) {
            switch n.kind {
            case .live:
                if let sid = Mock.streamByCreator(n.creatorId ?? "")?.id { router.push(.live(sid)) }
            case .episode:
                if let eid = Mock.episodesByCreator(n.creatorId ?? "").first?.id { router.push(.episode(eid)) }
            case .dm:
                if let tid = Mock.dmThreads.first(where: { $0.creatorId == n.creatorId })?.id { router.push(.messageThread(tid)) }
            default: break
            }
        } label: {
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(notifColor(n.kind).opacity(0.14)).frame(width: 38, height: 38)
                    Image(systemName: notifIcon(n.kind))
                        .font(.system(size: 16, weight: .medium))
                        .foregroundStyle(notifColor(n.kind))
                }
                VStack(alignment: .leading, spacing: 3) {
                    Text(n.title)
                        .font(.system(size: 13.5, weight: .heavy))
                        .foregroundStyle(Theme.text)
                        .lineLimit(1)
                    Text(n.body)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.textDim)
                        .lineLimit(2)
                    Text(n.at.formatted(.relative(presentation: .named)))
                        .font(.system(size: 10.5, weight: .semibold))
                        .foregroundStyle(Theme.textDim)
                        .padding(.top, 1)
                }
                Spacer()
                if n.unread {
                    Circle().fill(Theme.magenta).frame(width: 8, height: 8)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
        }
        .buttonStyle(.plain)
    }

    private func notifIcon(_ kind: NotificationItem.NotifKind) -> String {
        switch kind {
        case .live: return "dot.radiowaves.left.and.right"
        case .episode: return "play.rectangle.fill"
        case .tip: return "sparkles"
        case .sub: return "person.2.fill"
        case .dm: return "message.fill"
        case .system: return "gearshape.fill"
        }
    }

    private func notifColor(_ kind: NotificationItem.NotifKind) -> Color {
        switch kind {
        case .live: return Theme.magenta
        case .episode: return Theme.lime
        case .tip: return Theme.gold
        case .sub: return Theme.lime
        case .dm: return Theme.cyan
        case .system: return Theme.textMid
        }
    }
}

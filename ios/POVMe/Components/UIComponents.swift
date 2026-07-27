import SwiftUI
import UIKit

// MARK: - Haptics

enum Hap {
    static func light() { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
    static func medium() { UIImpactFeedbackGenerator(style: .medium).impactOccurred() }
    static func heavy() { UIImpactFeedbackGenerator(style: .heavy).impactOccurred() }
    static func success() { UINotificationFeedbackGenerator().notificationOccurred(.success) }
}

// MARK: - PressableButton (scale + haptic micro-interaction)

struct PressableButton<Label: View>: View {
    let action: () -> Void
    let scaleTo: CGFloat
    let hapticStyle: () -> Void
    @ViewBuilder let label: () -> Label
    @State private var pressed = false

    init(scaleTo: CGFloat = 0.96, haptic: @escaping () -> Void = Hap.light, action: @escaping () -> Void, @ViewBuilder label: @escaping () -> Label) {
        self.scaleTo = scaleTo
        self.hapticStyle = haptic
        self.action = action
        self.label = label
    }

    var body: some View {
        Button {
            hapticStyle()
            action()
        } label: {
            label()
                .scaleEffect(pressed ? scaleTo : 1)
                .animation(.spring(response: 0.28, dampingFraction: 0.6), value: pressed)
        }
        .buttonStyle(PressableStyle(pressed: $pressed))
    }
}

private struct PressableStyle: ButtonStyle {
    @Binding var pressed: Bool
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .onChange(of: configuration.isPressed) { _, newValue in
                pressed = newValue
            }
    }
}

// MARK: - AppButton

enum ButtonVariant { case primary, live, ppv, ghost, dark }

struct AppButton: View {
    let label: String
    var variant: ButtonVariant = .primary
    var icon: AnyView? = nil
    var disabled: Bool = false
    var full: Bool = true
    var small: Bool = false
    var action: () -> Void

    private var gradient: [Color] {
        switch variant {
        case .primary: return Theme.primaryGradient
        case .live: return Theme.liveGradient
        case .ppv: return Theme.ppvGradient
        case .ghost: return [.clear, .clear]
        case .dark: return Theme.darkGradient
        }
    }

    private var textColor: Color {
        switch variant {
        case .primary, .ppv: return Theme.ink
        case .live: return .white
        case .ghost, .dark: return Theme.text
        }
    }

    var body: some View {
        PressableButton(scaleTo: 0.96, haptic: Hap.medium, action: action) {
            HStack(spacing: 9) {
                if let icon { icon }
                Text(label)
                    .font(.system(size: small ? 14 : 16, weight: .heavy))
                    .foregroundStyle(textColor)
            }
            .frame(height: small ? 42 : 54)
            .padding(.horizontal, small ? 18 : 26)
            .frame(maxWidth: full ? .infinity : nil)
            .background(
                ZStack {
                    if variant == .ghost {
                        RoundedRectangle(cornerRadius: Theme.rPill)
                            .stroke(Theme.borderHi, lineWidth: 1)
                    } else {
                        LinearGradient(colors: gradient, startPoint: .topLeading, endPoint: .bottomTrailing)
                    }
                }
            )
            .clipShape(.rect(cornerRadius: Theme.rPill))
            .opacity(disabled ? 0.45 : 1)
        }
        .disabled(disabled)
    }
}

// MARK: - Chip

struct Chip: View {
    let label: String
    var active: Bool = false
    var accent: Color = Theme.lime
    var emoji: String? = nil
    var action: () -> Void

    var body: some View {
        PressableButton(scaleTo: 0.93, action: action) {
            HStack(spacing: 6) {
                if let emoji { Text(emoji) }
                Text(label)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(active ? Theme.ink : Theme.textMid)
            }
            .padding(.horizontal, 14)
            .frame(height: 38)
            .background(active ? accent : Theme.surface)
            .clipShape(.rect(cornerRadius: Theme.rPill))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.rPill)
                    .stroke(active ? accent : Theme.border, lineWidth: 1)
            )
        }
    }
}

// MARK: - Tag

struct Tag: View {
    let label: String
    var color: Color = Theme.textMid
    var bg: Color = Color.white.opacity(0.07)
    var icon: AnyView? = nil

    var body: some View {
        HStack(spacing: 4) {
            if let icon { icon }
            Text(label)
                .font(.system(size: 9.5, weight: .heavy))
                .tracking(1.4)
                .textCase(.uppercase)
                .foregroundStyle(color)
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 5)
        .background(bg)
        .clipShape(.rect(cornerRadius: 8))
    }
}

// MARK: - LiveDot (pulsing)

struct LiveDot: View {
    var size: CGFloat = 7
    @State private var pulse = false

    var body: some View {
        Circle()
            .fill(.white)
            .frame(width: size, height: size)
            .opacity(pulse ? 0.35 : 1)
            .animation(.easeInOut(duration: 0.7).repeatForever(autoreverses: true), value: pulse)
            .onAppear { pulse = true }
    }
}

// MARK: - LiveBadge

struct LiveBadge: View {
    var viewers: Int? = nil

    var body: some View {
        HStack(spacing: 5) {
            LiveDot()
            Text("LIVE")
                .font(.system(size: 10, weight: .heavy))
                .tracking(1.4)
                .foregroundStyle(.white)
            if let viewers {
                Text(viewers >= 1000 ? String(format: "%.1fK", Double(viewers) / 1000) : "\(viewers)")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(.white.opacity(0.85))
                    .padding(.leading, 1)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Theme.magenta)
        .clipShape(.rect(cornerRadius: 7))
    }
}

// MARK: - Avatar

struct Avatar: View {
    let uri: String
    var size: CGFloat = 44
    var ring: Bool = false
    var live: Bool = false

    private var borderColor: Color { live ? Theme.magenta : Theme.lime }

    var body: some View {
        ZStack {
            if ring {
                RoundedRectangle(cornerRadius: (size + 6) / 2)
                    .stroke(borderColor, lineWidth: 2)
                    .frame(width: size + 5, height: size + 5)
            }
            AsyncImage(url: URL(string: uri)) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                default:
                    Rectangle().fill(Theme.surfaceHi)
                }
            }
            .frame(width: size, height: size)
            .clipShape(.rect(cornerRadius: size / 2))
        }
    }
}

// MARK: - SectionHeader

struct SectionHeader: View {
    var kicker: String? = nil
    let title: String
    var action: String? = nil
    var onAction: (() -> Void)? = nil

    var body: some View {
        HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 5) {
                if let kicker {
                    Text(kicker).microLabel(Theme.lime, size: 10)
                }
                Text(title)
                    .font(.system(size: 21, weight: .heavy))
                    .foregroundStyle(Theme.text)
            }
            Spacer()
            if let action, let onAction {
                PressableButton(scaleTo: 0.94, action: onAction) {
                    Text(action)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Theme.textMid)
                }
            }
        }
        .padding(.horizontal, 18)
        .padding(.top, 26)
        .padding(.bottom, 14)
    }
}

// MARK: - Divider

struct AppDivider: View {
    var body: some View {
        Rectangle().fill(Theme.border).frame(height: 1)
    }
}

// MARK: - StatTile

struct StatTile: View {
    let label: String
    let value: String
    var sub: String? = nil
    var accent: Color = Theme.lime

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label).microLabel(accent, size: 10)
            Text(value)
                .font(.system(size: 20, weight: .heavy))
                .foregroundStyle(Theme.text)
            if let sub {
                Text(sub)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.textDim)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Theme.surface)
        .clipShape(.rect(cornerRadius: Theme.rMd))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.rMd).stroke(Theme.border, lineWidth: 1)
        )
    }
}

// MARK: - ProgressBar

struct ProgressBar: View {
    let progress: Double
    var color: Color = Theme.lime
    @State private var width: CGFloat = 0

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 6)
                    .fill(Color.white.opacity(0.09))
                RoundedRectangle(cornerRadius: 6)
                    .fill(color)
                    .frame(width: width)
            }
            .onAppear {
                withAnimation(.easeOut(duration: 0.9)) {
                    width = geo.size.width * min(1, max(0, progress))
                }
            }
            .onChange(of: progress) { _, newValue in
                withAnimation(.easeOut(duration: 0.6)) {
                    width = geo.size.width * min(1, max(0, newValue))
                }
            }
        }
        .frame(height: 6)
    }
}

// MARK: - EmptyState

struct EmptyState: View {
    let title: String
    let message: String
    var iconName: String? = nil
    var iconColor: Color = Theme.textMid
    var action: String? = nil
    var onAction: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: 7) {
            ZStack {
                Circle()
                    .fill(Theme.surface)
                    .overlay(Circle().stroke(Theme.border, lineWidth: 1))
                    .frame(width: 64, height: 64)
                if let iconName {
                    Image(systemName: iconName)
                        .font(.system(size: 22, weight: .bold))
                        .foregroundStyle(iconColor)
                }
            }
            .padding(.bottom, 16)
            Text(title)
                .font(.system(size: 17, weight: .heavy))
                .foregroundStyle(Theme.text)
            Text(message)
                .font(.system(size: 13.5, weight: .medium))
                .foregroundStyle(Theme.textDim)
                .multilineTextAlignment(.center)
                .lineSpacing(4)
            if let action, let onAction {
                AppButton(label: action, full: false, small: true, action: onAction)
                    .padding(.top, 18)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 42)
        .padding(.vertical, 54)
    }
}

// MARK: - Icon helpers (SF Symbols proxy for lucide icons)

enum AppIcon {
    static func view(_ name: String, size: CGFloat = 16, color: Color = Theme.textMid) -> some View {
        Image(systemName: name)
            .font(.system(size: size, weight: .medium))
            .foregroundStyle(color)
    }
}

// MARK: - Wordmark

struct Wordmark: View {
    var size: CGFloat = 24
    var body: some View {
        HStack(spacing: 0) {
            Text("POV")
                .font(.system(size: size, weight: .heavy))
                .tracking(-1.2)
                .foregroundStyle(Theme.text)
            Text("ME")
                .font(.system(size: size, weight: .heavy))
                .tracking(-1.2)
                .foregroundStyle(Theme.lime)
        }
    }
}

// MARK: - HGradient (vertical gradient overlay used on imagery)

struct HGradient: View {
    var colors: [Color]
    var locations: [Double]? = nil
    var body: some View {
        LinearGradient(
            colors: colors,
            startPoint: .top,
            endPoint: .bottom
        )
    }
}

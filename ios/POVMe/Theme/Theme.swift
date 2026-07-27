import SwiftUI

/// POVMe design tokens.
/// Ink-black cinematic base, acid-lime primary, magenta for LIVE, cyan for PPV, gold for money.
enum Theme {
    // MARK: - Palette
    static let ink = Color(hex: 0x08080A)
    static let bg = Color(hex: 0x0A0A0C)
    static let surface = Color(hex: 0x131318)
    static let surfaceHi = Color(hex: 0x1B1B22)
    static let surfaceTop = Color(hex: 0x24242D)
    static let border = Color(hex: 0x26262F)
    static let borderHi = Color(hex: 0x3A3A46)
    static let text = Color(hex: 0xF6F6F8)
    static let textMid = Color(hex: 0xA9A9B8)
    static let textDim = Color(hex: 0x71717F)
    static let lime = Color(hex: 0xCCFF00)
    static let limeDark = Color(hex: 0x8FB300)
    static let magenta = Color(hex: 0xFF2D6F)
    static let magentaDark = Color(hex: 0xB01048)
    static let cyan = Color(hex: 0x35E7FF)
    static let gold = Color(hex: 0xFFB627)
    static let danger = Color(hex: 0xFF4D4D)
    static let success = Color(hex: 0x3DDC97)

    // MARK: - Radius
    static let rSm: CGFloat = 10
    static let rMd: CGFloat = 16
    static let rLg: CGFloat = 22
    static let rXl: CGFloat = 30
    static let rPill: CGFloat = 999

    // MARK: - Spacing
    static let sXs: CGFloat = 6
    static let sSm: CGFloat = 10
    static let sMd: CGFloat = 16
    static let sLg: CGFloat = 24
    static let sXl: CGFloat = 34

    // MARK: - Gradients
    static let primaryGradient = [Color(hex: 0xCCFF00), Color(hex: 0xA6E000)]
    static let liveGradient = [Color(hex: 0xFF2D6F), Color(hex: 0xD3005A)]
    static let ppvGradient = [Color(hex: 0x35E7FF), Color(hex: 0x00A9CC)]
    static let darkGradient = [Color(hex: 0x1B1B22), Color(hex: 0x131318)]
}

extension Color {
    init(hex: UInt32, alpha: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: alpha
        )
    }
}

// MARK: - Micro label modifier

struct MicroLabel: ViewModifier {
    var color: Color = Theme.textMid
    var fontSize: CGFloat = 10
    func body(content: Content) -> some View {
        content
            .font(.system(size: fontSize, weight: .heavy))
            .tracking(1.4)
            .textCase(.uppercase)
            .foregroundStyle(color)
    }
}

extension View {
    func microLabel(_ color: Color = Theme.textMid, size: CGFloat = 10) -> some View {
        modifier(MicroLabel(color: color, fontSize: size))
    }
}

// MARK: - Formatters

enum Fmt {
    static func money(_ n: Double) -> String {
        String(format: "$%.2f", n)
    }

    static func moneyComma(_ n: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.maximumFractionDigits = 2
        formatter.minimumFractionDigits = 2
        return formatter.string(from: NSNumber(value: n)) ?? "$0.00"
    }

    static func count(_ n: Int) -> String {
        if n >= 1_000_000 { return String(format: "%.1fM", Double(n) / 1_000_000) }
        if n >= 1000 { return String(format: "%.1fK", Double(n) / 1000) }
        return "\(n)"
    }

    static func duration(_ sec: Int) -> String {
        let m = sec / 60
        let s = sec % 60
        if m >= 60 {
            let h = m / 60
            return "\(h)h \(m % 60)m"
        }
        return String(format: "%d:%02d", m, s)
    }
}

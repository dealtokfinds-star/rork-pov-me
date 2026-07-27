/**
 * POVME design tokens.
 * Ink-black cinematic base, acid-lime primary, magenta for LIVE, cyan for PPV, gold for money.
 */
const palette = {
  ink: "#08080A",
  bg: "#0A0A0C",
  surface: "#131318",
  surfaceHi: "#1B1B22",
  surfaceTop: "#24242D",
  border: "#26262F",
  borderHi: "#3A3A46",
  text: "#F6F6F8",
  textMid: "#A9A9B8",
  textDim: "#71717F",
  lime: "#CCFF00",
  limeDark: "#8FB300",
  magenta: "#FF2D6F",
  magentaDark: "#B01048",
  cyan: "#35E7FF",
  gold: "#FFB627",
  danger: "#FF4D4D",
  success: "#3DDC97",
} as const;

const Colors = {
  ...palette,
  light: {
    text: palette.text,
    background: palette.bg,
    tint: palette.lime,
    tabIconDefault: palette.textDim,
    tabIconSelected: palette.lime,
  },
};

export const Radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 30,
  pill: 999,
} as const;

export const Space = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 34,
} as const;

/** Uppercase micro-label style shared across the app. */
export const microLabel = {
  fontSize: 10,
  fontWeight: "800" as const,
  letterSpacing: 1.4,
  textTransform: "uppercase" as const,
};

export default Colors;

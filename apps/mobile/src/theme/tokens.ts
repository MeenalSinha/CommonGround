/** Centralized design tokens. Components must read colors, spacing and sizes from here only. */

export const colors = {
  // Warm, cozy base
  cream: '#FFF6E5',
  creamDeep: '#FBE9C8',
  surface: '#FFFFFF',
  border: '#EAD9B8',
  // Pastel accents
  sky: '#BFE3F7',
  skyDeep: '#2D6A8F',
  yellow: '#FFE9A8',
  yellowDeep: '#7A5B00',
  mint: '#BDEBD3',
  mintDeep: '#1F6B4A',
  lavender: '#D9CCF5',
  lavenderDeep: '#5B3FA0',
  coral: '#C73A25', // 5.2:1 against white text (WCAG AA for normal text)
  coralSoft: '#FFD3CB',
  coralDeep: '#8E2312',
  // Text
  ink: '#2B2A33',
  inkSoft: '#5C5A66',
  onCoral: '#FFFFFF',
  focus: '#2D6A8F',
  disabled: '#D8D1C2',
  onDisabled: '#6E6A5F',
} as const;

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radii = { sm: 10, md: 16, lg: 24, pill: 999 } as const;

export const sizes = {
  touchTarget: 48,
  borderWidth: 2,
  focusBorderWidth: 3,
  buttonDepth: 4,
  stateGlyph: 28,
  statusDot: 12,
  avatar: 56,
  logoMark: 64,
  logoMarkCompact: 40,
  maxContentWidth: 640,
} as const;

export const fonts = {
  heading: 'Fredoka_600SemiBold',
  headingMedium: 'Fredoka_500Medium',
  body: 'Nunito_400Regular',
  bodySemi: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_700Bold',
} as const;

export const motion = { fast: 160, normal: 280, pulse: 900, bob: 1400, bobDistance: 4 } as const;

/** Interaction feedback used by pressable components. */
export const interaction = {
  pressedOpacity: 0.85,
  pressedScale: 0.98,
} as const;

/** Centralized design tokens. Components must read colors, spacing and sizes from here only. */

export const colors = {
  // Warm, cozy base
  cream: '#FFF6E5',
  creamLight: '#FFFDF9',
  creamDeep: '#FBE9C8',
  creamCard: '#FFF9EE',
  sand: '#F5EBD7',
  surface: '#FFFFFF',
  border: '#EAD9B8',
  borderStrong: '#D6C098',
  // Pastel accents
  sky: '#BFE3F7',
  skySoft: '#E6F4FC',
  skyDeep: '#2D6A8F',
  yellow: '#FFE9A8',
  yellowSoft: '#FFF6D6',
  yellowDeep: '#7A5B00',
  mint: '#BDEBD3',
  mintSoft: '#E4F8EE',
  mintDeep: '#1F6B4A',
  lavender: '#D9CCF5',
  lavenderSoft: '#EFEAFC',
  lavenderDeep: '#5B3FA0',
  coral: '#C73A25', // 5.2:1 against white text (WCAG AA for normal text)
  coralSoft: '#FFD3CB',
  coralDeep: '#8E2312',
  coralGlow: 'rgba(199, 58, 37, 0.15)',
  gold: '#F6C042',
  goldDeep: '#946700',
  // Text
  ink: '#2B2A33',
  inkSoft: '#5C5A66',
  inkLight: '#8C8A96',
  onCoral: '#FFFFFF',
  focus: '#2D6A8F',
  disabled: '#D8D1C2',
  onDisabled: '#6E6A5F',
  // Badges and highlights
  badgeBg: '#F3E8D3',
} as const;

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radii = { xs: 6, sm: 10, md: 16, lg: 24, xl: 32, pill: 999 } as const;

export const sizes = {
  touchTarget: 48,
  borderWidth: 2,
  focusBorderWidth: 3,
  buttonDepth: 4,
  stateGlyph: 28,
  statusDot: 12,
  avatar: 56,
  avatarSmall: 36,
  avatarLarge: 72,
  logoMark: 64,
  logoMarkCompact: 40,
  maxContentWidth: 680,
} as const;

export const fonts = {
  heading: 'Fredoka_600SemiBold',
  headingMedium: 'Fredoka_500Medium',
  body: 'Nunito_400Regular',
  bodySemi: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_700Bold',
} as const;

export const motion = { fast: 160, normal: 280, pulse: 900, bob: 1400, bobDistance: 4 } as const;

export const shadows = {
  card: {
    shadowColor: '#4A341C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  subtle: {
    shadowColor: '#4A341C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  glowCoral: {
    shadowColor: '#C73A25',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
} as const;

/** Interaction feedback used by pressable components. */
export const interaction = {
  pressedOpacity: 0.85,
  pressedScale: 0.98,
} as const;

import type { TextStyle } from 'react-native';
import { fonts } from './tokens';

export const typography = {
  display: { fontFamily: fonts.heading, fontSize: 34, lineHeight: 40 },
  title: { fontFamily: fonts.heading, fontSize: 24, lineHeight: 30 },
  subtitle: { fontFamily: fonts.headingMedium, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 24 },
  caption: { fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 18 },
  button: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 22 },
} satisfies Record<string, TextStyle>;

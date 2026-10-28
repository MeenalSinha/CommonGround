import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, sizes, spacing, typography } from '@/theme';

export type PillTone = 'good' | 'warn' | 'bad' | 'neutral';

const palette: Record<PillTone, { bg: string; fg: string; dot: string }> = {
  good: { bg: colors.mint, fg: colors.mintDeep, dot: colors.mintDeep },
  warn: { bg: colors.yellow, fg: colors.yellowDeep, dot: colors.yellowDeep },
  bad: { bg: colors.coralSoft, fg: colors.coralDeep, dot: colors.coralDeep },
  neutral: { bg: colors.lavender, fg: colors.lavenderDeep, dot: colors.lavenderDeep },
};

/** Status is conveyed by text and shape as well as color, never by color alone. */
export function StatusPill({ label, tone }: { label: string; tone: PillTone }) {
  const p = palette[tone];
  return (
    <View style={[styles.pill, { backgroundColor: p.bg }]} accessible accessibilityLabel={label}>
      <View style={[styles.dot, { backgroundColor: p.dot }, tone === 'bad' && styles.square]} />
      <Text style={[typography.caption, { color: p.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
  },
  dot: { width: sizes.statusDot, height: sizes.statusDot, borderRadius: sizes.statusDot / 2 },
  square: { borderRadius: 2 },
});

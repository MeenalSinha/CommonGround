import { StyleSheet, Text, View } from 'react-native';
import { colors, sizes, spacing, typography } from '@/theme';

/** Two overlapping circles: common ground between different tastes. Drawn, not an image asset. */
export function Logo({ compact = false }: { compact?: boolean }) {
  const d = compact ? sizes.logoMarkCompact : sizes.logoMark;
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="header"
      accessibilityLabel="CommonGround"
    >
      <View style={{ width: d * 1.5, height: d }}>
        <View
          style={[styles.circle, { width: d, height: d, left: 0, backgroundColor: colors.sky }]}
        />
        <View
          style={[
            styles.circle,
            { width: d, height: d, left: d * 0.5, backgroundColor: colors.coralSoft, opacity: 0.9 },
          ]}
        />
        <View
          style={[styles.overlap, { width: d * 0.5, height: d * 0.8, left: d * 0.5, top: d * 0.1 }]}
        />
      </View>
      <Text style={[compact ? typography.title : typography.display, styles.word]}>CommonGround</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  circle: {
    position: 'absolute',
    top: 0,
    borderRadius: 999,
    borderWidth: sizes.borderWidth,
    borderColor: colors.ink,
  },
  overlap: { position: 'absolute', borderRadius: 999, backgroundColor: colors.yellow },
  word: { color: colors.ink },
});

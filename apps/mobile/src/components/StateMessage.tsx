import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, sizes, spacing, typography } from '@/theme';
import { Card } from './Card';
import { LoadingBlob } from './LoadingBlob';

export type StateKind = 'loading' | 'empty' | 'unavailable' | 'error' | 'success';

interface Props {
  kind: StateKind;
  message: string;
  /** Overrides the default heading for this kind. */
  title?: string;
}

const presets = {
  empty: { tone: 'plain', glyph: '🔍', title: 'Nothing found' },
  unavailable: { tone: 'yellow', glyph: '⏳', title: 'Not available yet' },
  error: { tone: 'coral', glyph: '⚠️', title: 'Something went wrong' },
  success: { tone: 'mint', glyph: '✨', title: 'All set' },
} as const;

/**
 * One consistent presentation for non-happy-path states. Meaning is carried by the heading and
 * glyph as well as color. Errors are announced to screen readers; the others are plain content.
 */
export function StateMessage({ kind, message, title }: Props) {
  if (kind === 'loading') return <LoadingBlob label={message} />;
  const preset = presets[kind];
  return (
    <Card tone={preset.tone}>
      <View style={styles.row} accessibilityRole={kind === 'error' ? 'alert' : undefined}>
        <View style={styles.glyph} accessibilityElementsHidden importantForAccessibility="no">
          <Text style={[typography.bodyStrong, styles.glyphText]}>{preset.glyph}</Text>
        </View>
        <View style={styles.copy}>
          <Text style={[typography.title, styles.titleText]}>{title ?? preset.title}</Text>
          <Text style={[typography.body, styles.ink]}>{message}</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  glyph: {
    width: sizes.stateGlyph + 8,
    height: sizes.stateGlyph + 8,
    borderRadius: radii.md,
    borderWidth: sizes.borderWidth,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphText: { fontSize: 16 },
  copy: { flex: 1, gap: spacing.xxs },
  titleText: { color: colors.ink, fontSize: 18, lineHeight: 22 },
  ink: { color: colors.ink },
});

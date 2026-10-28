import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, sizes, spacing, typography } from '@/theme';
import { entityTypeLabel } from '@/utils/format';

interface Props {
  name: string;
  /** Qloo entity type URN for resolved interests; omit for unresolved text. */
  type?: string | null;
  unresolved?: boolean;
  onRemove?: () => void;
}

/** Resolved interests show their type; unresolved ones are labelled "Not verified". */
export function InterestChip({ name, type, unresolved = false, onRemove }: Props) {
  const detail = unresolved ? 'Not verified' : entityTypeLabel(type ?? null);
  return (
    <View style={[styles.chip, unresolved && styles.unresolved]}>
      <View style={styles.text} accessible accessibilityLabel={`${name}, ${detail}`}>
        <Text style={[typography.bodyStrong, styles.ink]} numberOfLines={2}>
          {name}
        </Text>
        <Text style={[typography.caption, styles.soft]}>{detail}</Text>
      </View>
      {onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${name}`}
          onPress={onRemove}
          hitSlop={spacing.md}
          style={styles.remove}
        >
          <Text style={[typography.bodyStrong, styles.ink]}>{'\u00D7'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    borderRadius: radii.md,
    borderWidth: sizes.borderWidth,
    borderColor: colors.ink,
    backgroundColor: colors.mint,
  },
  unresolved: { backgroundColor: colors.surface, borderStyle: 'dashed' },
  text: { flexShrink: 1 },
  remove: {
    width: sizes.touchTarget - spacing.md,
    height: sizes.touchTarget - spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ink: { color: colors.ink },
  soft: { color: colors.inkSoft },
});

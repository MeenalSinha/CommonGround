import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, sizes, spacing, typography } from '@/theme';
import { entityTypeLabel } from '@/utils/format';

export function entityIcon(type?: string | null): string {
  if (!type) return '⭐';
  if (type.includes('movie') || type.includes('film')) return '🎬';
  if (type.includes('artist') || type.includes('music')) return '🎵';
  if (type.includes('place') || type.includes('destination')) return '🏛️';
  if (type.includes('book') || type.includes('author')) return '📚';
  if (type.includes('dining') || type.includes('restaurant')) return '🍽️';
  if (type.includes('tv_show') || type.includes('series')) return '📺';
  if (type.includes('videogame') || type.includes('game')) return '🎮';
  if (type.includes('podcast')) return '🎙️';
  if (type.includes('brand')) return '🏷️';
  return '⭐';
}

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
  const icon = entityIcon(type);
  return (
    <View style={[styles.chip, unresolved && styles.unresolved]}>
      <Text style={styles.icon} accessibilityElementsHidden importantForAccessibility="no">
        {icon}
      </Text>
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
    paddingVertical: spacing.xs + 2,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    borderRadius: radii.md,
    borderWidth: sizes.borderWidth,
    borderBottomWidth: sizes.buttonDepth - 1,
    borderColor: colors.ink,
    backgroundColor: colors.mint,
  },
  unresolved: { backgroundColor: colors.surface, borderStyle: 'dashed' },
  icon: { fontSize: 16 },
  text: { flexShrink: 1 },
  soft: { color: colors.inkSoft },
  ink: { color: colors.ink },
  remove: {
    width: sizes.touchTarget - spacing.md,
    height: sizes.touchTarget - spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer' as any,
  },
});

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, sizes, spacing, typography } from '@/theme';
import { entityTypeLabel } from '@/utils/format';

interface Props {
  /** Types exactly as the backend reported them. */
  types: string[];
  selected: string | null;
  onSelect: (type: string | null) => void;
  /** When true a second tap on the selected chip clears it. */
  allowClear?: boolean;
}

export function CategoryChips({ types, selected, onSelect, allowClear = false }: Props) {
  return (
    <View style={styles.row}>
      {types.map((type) => {
        const active = type === selected;
        const label = entityTypeLabel(type);
        return (
          <Pressable
            key={type}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(active && allowClear ? null : type)}
            style={[styles.chip, active && styles.active]}
          >
            <Text style={[typography.bodyStrong, styles.ink]}>
              {active ? `\u2713 ${label}` : label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: sizes.touchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: sizes.borderWidth,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
  },
  active: { backgroundColor: colors.lavender },
  ink: { color: colors.ink },
});

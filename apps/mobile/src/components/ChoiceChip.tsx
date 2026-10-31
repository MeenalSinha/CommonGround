import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, interaction, radii, sizes, spacing, typography } from '@/theme';

interface Props {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** `danger` is used for hard exclusions so they never look like an ordinary choice. */
  tone?: 'neutral' | 'danger';
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

/** A selectable pill (single choice among several). Selected state is shown by fill AND a check mark. */
export function ChoiceChip({
  label,
  selected,
  onPress,
  tone = 'neutral',
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
}: Props) {
  const [focused, setFocused] = useState(false);
  const fill = tone === 'danger' ? colors.coralSoft : colors.mint;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.chip,
        selected && { backgroundColor: fill, borderColor: colors.ink },
        focused && styles.focused,
        disabled && styles.disabled,
        pressed && !disabled && { opacity: interaction.pressedOpacity },
      ]}
    >
      <Text style={[typography.caption, styles.text, disabled && styles.disabledText]}>
        {`${selected ? '\u2713 ' : ''}${label}`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: sizes.touchTarget,
    minWidth: sizes.touchTarget,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: sizes.borderWidth,
    borderBottomWidth: sizes.buttonDepth - 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    cursor: 'pointer' as any,
  },
  focused: { borderColor: colors.focus, borderWidth: sizes.focusBorderWidth },
  disabled: { backgroundColor: colors.disabled, borderColor: colors.disabled },
  text: { color: colors.ink },
  disabledText: { color: colors.onDisabled },
});

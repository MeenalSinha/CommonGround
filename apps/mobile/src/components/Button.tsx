import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, interaction, radii, sizes, spacing, typography } from '@/theme';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  busy?: boolean;
  accessibilityHint?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  busy = false,
  accessibilityHint,
}: Props) {
  const inactive = disabled || busy;
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' ? styles.primary : styles.secondary,
        inactive && styles.disabled,
        focused && !inactive && styles.focused,
        pressed &&
          !inactive && {
            opacity: interaction.pressedOpacity,
            transform: [{ scale: interaction.pressedScale }],
          },
      ]}
    >
      <View style={styles.row}>
        <Text
          style={[
            typography.button,
            variant === 'primary' ? styles.primaryText : styles.secondaryText,
            inactive && styles.disabledText,
          ]}
        >
          {busy ? `${label}...` : label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: sizes.touchTarget,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: sizes.borderWidth,
    borderBottomWidth: sizes.buttonDepth,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  primary: { backgroundColor: colors.coral, borderColor: colors.coralDeep },
  secondary: { backgroundColor: colors.surface, borderColor: colors.ink },
  disabled: { backgroundColor: colors.disabled, borderColor: colors.disabled },
  focused: { borderColor: colors.focus, borderWidth: sizes.focusBorderWidth },
  primaryText: { color: colors.onCoral },
  secondaryText: { color: colors.ink },
  disabledText: { color: colors.onDisabled },
});

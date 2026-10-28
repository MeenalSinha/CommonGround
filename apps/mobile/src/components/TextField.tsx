import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radii, sizes, spacing, typography } from '@/theme';

interface Props {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string | null;
  editable?: boolean;
  maxLength?: number;
  returnKeyType?: 'done' | 'search' | 'next';
  onSubmitEditing?: () => void;
}

/** Shared labelled text input with focus, disabled and inline-error states. */
export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  editable = true,
  maxLength,
  returnKeyType = 'done',
  onSubmitEditing,
}: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text style={[typography.caption, styles.label]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholder={placeholder}
        placeholderTextColor={colors.inkSoft}
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        maxLength={maxLength}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.input,
          focused && editable && styles.focused,
          error ? styles.invalid : null,
          !editable && styles.disabled,
        ]}
      />
      {error ? (
        <Text style={[typography.caption, styles.error]} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { color: colors.inkSoft },
  input: {
    minHeight: sizes.touchTarget,
    borderRadius: radii.md,
    borderWidth: sizes.borderWidth,
    borderColor: colors.ink,
    backgroundColor: colors.cream,
    paddingHorizontal: spacing.lg,
    color: colors.ink,
    fontFamily: typography.body.fontFamily,
    fontSize: typography.body.fontSize,
  },
  focused: { borderColor: colors.focus, borderWidth: sizes.focusBorderWidth },
  invalid: { borderColor: colors.coralDeep },
  disabled: { borderColor: colors.disabled, backgroundColor: colors.creamDeep },
  error: { color: colors.coralDeep },
});

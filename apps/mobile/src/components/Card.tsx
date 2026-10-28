import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, interaction, radii, sizes, spacing } from '@/theme';

export type CardTone = 'plain' | 'sky' | 'yellow' | 'mint' | 'lavender' | 'coral';

const toneBackground: Record<CardTone, string> = {
  plain: colors.surface,
  sky: colors.sky,
  yellow: colors.yellow,
  mint: colors.mint,
  lavender: colors.lavender,
  coral: colors.coralSoft,
};

interface Props {
  children: ReactNode;
  tone?: CardTone;
  style?: ViewStyle;
  /** When provided the card is a real button and gets pressed feedback; otherwise it is inert. */
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export function Card({
  children,
  tone = 'plain',
  style,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: Props) {
  const base = [styles.card, { backgroundColor: toneBackground[tone] }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [
        ...base,
        styles.interactive,
        pressed && {
          opacity: interaction.pressedOpacity,
          transform: [{ scale: interaction.pressedScale }],
        },
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: sizes.borderWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  // Interactive cards get the same chunky lower edge as buttons so tappability is visible.
  interactive: { borderBottomWidth: sizes.buttonDepth, minHeight: sizes.touchTarget },
});

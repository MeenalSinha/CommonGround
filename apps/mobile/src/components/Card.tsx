import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, interaction, radii, shadows, sizes, spacing } from '@/theme';

export type CardTone = 'plain' | 'sky' | 'yellow' | 'mint' | 'lavender' | 'coral';

const toneBackground: Record<CardTone, string> = {
  plain: colors.surface,
  sky: colors.sky,
  yellow: colors.yellow,
  mint: colors.mint,
  lavender: colors.lavender,
  coral: colors.coralSoft,
};

const toneBorder: Record<CardTone, string> = {
  plain: colors.border,
  sky: '#A5D4EC',
  yellow: '#ECD188',
  mint: '#A4DEBE',
  lavender: '#C6B4E8',
  coral: '#F4B3A7',
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
  const base = [
    styles.card,
    { backgroundColor: toneBackground[tone], borderColor: toneBorder[tone] },
    style,
  ];
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
    ...shadows.card,
  },
  // Interactive cards get the same chunky lower edge as buttons so tappability is visible.
  interactive: {
    borderBottomWidth: sizes.buttonDepth,
    minHeight: sizes.touchTarget,
    cursor: 'pointer' as any,
  },
});

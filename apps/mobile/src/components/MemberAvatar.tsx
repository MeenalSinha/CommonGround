import { StyleSheet, Text, View } from 'react-native';
import type { AvatarColor } from '@/state/party';
import { colors, shadows, sizes, typography } from '@/theme';

const background: Record<AvatarColor, string> = {
  sky: colors.sky,
  mint: colors.mint,
  lavender: colors.lavender,
  yellow: colors.yellow,
  coral: colors.coralSoft,
};

const borderTint: Record<AvatarColor, string> = {
  sky: colors.skyDeep,
  mint: colors.mintDeep,
  lavender: colors.lavenderDeep,
  yellow: colors.yellowDeep,
  coral: colors.coralDeep,
};

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.charAt(0) ?? '?';
  const second = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : '';
  return (first + second).toUpperCase();
}

/** Decorative initials badge. It is not an account or photo; the name is always shown beside it. */
export function MemberAvatar({
  name,
  color,
  size = 'normal',
}: {
  name: string;
  color: AvatarColor;
  size?: 'small' | 'normal' | 'large';
}) {
  const dim =
    size === 'small' ? sizes.avatarSmall : size === 'large' ? sizes.avatarLarge : sizes.avatar;
  return (
    <View
      style={[
        styles.badge,
        {
          width: dim,
          height: dim,
          borderRadius: dim / 2,
          backgroundColor: background[color],
          borderColor: borderTint[color],
        },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text
        style={[
          size === 'large' ? typography.title : typography.bodyStrong,
          styles.text,
          { color: borderTint[color] },
        ]}
      >
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: sizes.borderWidth,
    borderBottomWidth: sizes.buttonDepth - 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.subtle,
  },
  text: { color: colors.ink },
});

import { StyleSheet, Text, View } from 'react-native';
import type { AvatarColor } from '@/state/party';
import { colors, sizes, typography } from '@/theme';

const background: Record<AvatarColor, string> = {
  sky: colors.sky,
  mint: colors.mint,
  lavender: colors.lavender,
  yellow: colors.yellow,
  coral: colors.coralSoft,
};

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.charAt(0) ?? '?';
  const second = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : '';
  return (first + second).toUpperCase();
}

/** Decorative initials badge. It is not an account or photo; the name is always shown beside it. */
export function MemberAvatar({ name, color }: { name: string; color: AvatarColor }) {
  return (
    <View
      style={[styles.badge, { backgroundColor: background[color] }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={[typography.bodyStrong, styles.text]}>{initials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: sizes.avatar,
    height: sizes.avatar,
    borderRadius: sizes.avatar / 2,
    borderWidth: sizes.borderWidth,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { color: colors.ink },
});

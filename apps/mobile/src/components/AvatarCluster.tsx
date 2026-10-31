import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { colors, motion, shadows, sizes, spacing } from '@/theme';

const faces = [colors.sky, colors.mint, colors.lavender, colors.yellow] as const;

/**
 * Decorative friendly faces, hidden from assistive tech. Ornamental artwork only: these are not
 * users, profiles or data. A gentle bob plays unless the OS requests reduced motion.
 */
export function AvatarCluster() {
  const d = sizes.avatar;
  const reduced = useReducedMotion();
  const [lift] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduced) {
      lift.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(lift, {
          toValue: -motion.bobDistance,
          duration: motion.bob,
          useNativeDriver: true,
        }),
        Animated.timing(lift, { toValue: 0, duration: motion.bob, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, lift]);

  return (
    <Animated.View
      style={[styles.row, { transform: [{ translateY: lift }] }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {faces.map((bg, i) => (
        <View
          key={bg}
          style={[
            styles.face,
            { width: d, height: d, backgroundColor: bg, marginLeft: i === 0 ? 0 : -spacing.md },
          ]}
        >
          <View style={styles.eyes}>
            <View style={styles.eye} />
            <View style={styles.eye} />
          </View>
          <View style={styles.smile} />
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  face: {
    borderRadius: 999,
    borderWidth: sizes.borderWidth,
    borderBottomWidth: sizes.buttonDepth - 1,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    ...shadows.subtle,
  },
  eyes: { flexDirection: 'row', gap: spacing.md },
  eye: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.ink },
  smile: {
    width: 20,
    height: 10,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderColor: colors.ink,
  },
});

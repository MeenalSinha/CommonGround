import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { colors, motion, sizes, spacing, typography } from '@/theme';

/** A gentle pulsing dot. Static when the OS requests reduced motion. */
export function LoadingBlob({ label }: { label: string }) {
  const reduced = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (reduced) {
      scale.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.25, duration: motion.pulse, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: motion.pulse, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, scale]);

  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
    >
      <Animated.View style={[styles.blob, { transform: [{ scale }] }]} />
      <Text style={[typography.body, styles.text]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  blob: {
    width: sizes.statusDot * 2,
    height: sizes.statusDot * 2,
    borderRadius: 999,
    backgroundColor: colors.sky,
    borderWidth: sizes.borderWidth,
    borderColor: colors.skyDeep,
  },
  text: { color: colors.inkSoft },
});

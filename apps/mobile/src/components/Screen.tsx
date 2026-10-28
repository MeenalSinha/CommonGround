import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, sizes, spacing } from '@/theme';

/**
 * Shared screen container. Screens that sit under a navigation header pass edges without 'top'
 * so the header, not the screen, owns the status-bar inset.
 */
export function Screen({
  children,
  edges = ['top', 'left', 'right', 'bottom'],
}: {
  children: ReactNode;
  edges?: Edge[];
}) {
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.column}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  scroll: { flexGrow: 1, alignItems: 'center', padding: spacing.lg },
  column: { width: '100%', maxWidth: sizes.maxContentWidth, gap: spacing.lg },
});

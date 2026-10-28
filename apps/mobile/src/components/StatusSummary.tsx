import { StyleSheet, Text, View } from 'react-native';
import { useBackendStatusModel } from '@/hooks/BackendStatusContext';
import { colors, spacing, typography } from '@/theme';
import { backendPill, qlooPill } from '@/utils/status';
import { Card } from './Card';
import { StatusPill } from './StatusPill';

/** Compact, real status for the home screen. Tapping opens the full diagnostics screen. */
export function StatusSummary({ onPress }: { onPress: () => void }) {
  const model = useBackendStatusModel();
  const backend = backendPill(model.backend);
  const qloo = qlooPill(model);
  return (
    <Card
      tone="plain"
      onPress={onPress}
      accessibilityLabel={`Connection status. ${backend.label}. Qloo: ${qloo.label}.`}
      accessibilityHint="Opens connection details"
    >
      <Text style={[typography.subtitle, styles.ink]}>Connection status</Text>
      <View style={styles.pills}>
        <StatusPill {...backend} />
        <StatusPill label={`Qloo: ${qloo.label}`} tone={qloo.tone} />
      </View>
      <Text style={[typography.caption, styles.soft]}>Tap for details</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  pills: { gap: spacing.sm },
  ink: { color: colors.ink },
  soft: { color: colors.inkSoft },
});

import { StyleSheet, Text, View } from 'react-native';
import type { BackendStatusModel } from '@/hooks/useBackendStatus';
import { formatTime } from '@/utils/format';
import { backendPill, qlooPill } from '@/utils/status';
import { colors, spacing, typography } from '@/theme';
import { Button } from './Button';
import { Card } from './Card';
import { LoadingBlob } from './LoadingBlob';
import { StateMessage } from './StateMessage';
import { StatusPill } from './StatusPill';

export function ConnectionPanel({ model }: { model: BackendStatusModel }) {
  const { backend, backendMessage, qloo, qlooError, refreshing, verifying, refresh, verify } =
    model;
  const checking = backend === 'checking' && refreshing;
  const canVerify = backend === 'online' && qloo?.configured === true;
  const verifiedAt = formatTime(qloo?.last_verified_at ?? null);

  return (
    <Card tone="plain">
      <Text style={[typography.title, styles.ink]} accessibilityRole="header">
        Connection status
      </Text>

      {checking ? <LoadingBlob label="Checking the connection" /> : null}

      <View style={styles.row} accessibilityLiveRegion="polite">
        <Text style={[typography.bodyStrong, styles.ink]}>Backend</Text>
        <StatusPill {...backendPill(backend)} />
      </View>
      {backend === 'offline' && backendMessage ? (
        <StateMessage kind="error" title="Backend unreachable" message={backendMessage} />
      ) : null}

      <View style={styles.row} accessibilityLiveRegion="polite">
        <Text style={[typography.bodyStrong, styles.ink]}>Qloo cultural engine</Text>
        <StatusPill {...qlooPill(model)} />
      </View>

      {qloo ? <Text style={[typography.body, styles.soft]}>{qloo.message}</Text> : null}
      {qloo?.state === 'not_configured' ? (
        <StateMessage
          kind="unavailable"
          title="Waiting for the key"
          message="Add QLOO_API_KEY to backend/.env, restart the backend, then run verification. Until then there are no live discoveries, and nothing here is pretending otherwise."
        />
      ) : null}
      {verifiedAt ? (
        <Text style={[typography.caption, styles.soft]}>Last verified at {verifiedAt}</Text>
      ) : null}

      {qlooError ? <StateMessage kind="error" message={qlooError} /> : null}

      <View style={styles.actions}>
        <Button label="Refresh status" variant="secondary" onPress={refresh} busy={refreshing} />
        <Button
          label="Verify with Qloo"
          onPress={verify}
          busy={verifying}
          disabled={!canVerify}
          accessibilityHint={
            canVerify
              ? 'Sends one real request to Qloo through the backend'
              : 'Unavailable until the backend is online and a Qloo key is configured'
          }
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actions: { gap: spacing.md },
  ink: { color: colors.ink },
  soft: { color: colors.inkSoft },
});

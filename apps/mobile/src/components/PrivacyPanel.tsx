import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { Card } from './Card';
import { useParty } from '@/state/PartyContext';
import { colors, spacing, typography } from '@/theme';

export function PrivacyPanel() {
  const { state, actions } = useParty();
  const [confirmClear, setConfirmClear] = useState(false);
  const [cleared, setCleared] = useState(false);

  const hasData = Boolean(state.party || state.negotiation || state.targetType || state.run);

  const handleClear = async () => {
    await actions.startOver();
    setConfirmClear(false);
    setCleared(true);
  };

  return (
    <Card tone="plain">
      <Text style={[typography.title, styles.ink]} accessibilityRole="header">
        Privacy & data handling
      </Text>

      <Text style={[typography.body, styles.ink]}>
        CommonGround is designed with a local-first privacy model:
      </Text>

      <View style={styles.point}>
        <Text style={[typography.bodyStrong, styles.ink]}>Local-only storage</Text>
        <Text style={[typography.caption, styles.soft]}>
          Your party members, taste profiles, participant feedback, and proposed plans are stored
          locally on this device using local storage (AsyncStorage). Data is stored as unencrypted
          JSON on the device filesystem.
        </Text>
      </View>

      <View style={styles.point}>
        <Text style={[typography.bodyStrong, styles.ink]}>No cloud sync or user accounts</Text>
        <Text style={[typography.caption, styles.soft]}>
          CommonGround requires no logins or user tracking. We do not maintain a central database of
          user profiles or cross-device synchronizations.
        </Text>
      </View>

      <View style={styles.point}>
        <Text style={[typography.bodyStrong, styles.ink]}>Qloo cultural intelligence</Text>
        <Text style={[typography.caption, styles.soft]}>
          Only selected cultural entity IDs and search terms are transmitted through your backend to
          Qloo for discovery queries. Personal participant names and individual identities are never
          sent to Qloo.
        </Text>
      </View>

      {cleared ? (
        <View style={styles.clearedBanner}>
          <Text style={[typography.bodyStrong, styles.ink]}>
            Local party and plan data cleared successfully.
          </Text>
        </View>
      ) : confirmClear ? (
        <Card tone="coral">
          <Text style={[typography.body, styles.ink]}>
            Are you sure? This permanently deletes your party, all participant profiles, feedback,
            and any saved plans from this device.
          </Text>
          <View style={styles.buttonStack}>
            <Button
              label="Yes, delete all data"
              onPress={handleClear}
              accessibilityHint="Permanently wipes local storage"
            />
            <Button label="Cancel" variant="secondary" onPress={() => setConfirmClear(false)} />
          </View>
        </Card>
      ) : (
        <Button
          label="Clear all local data"
          variant="secondary"
          disabled={!hasData}
          onPress={() => setConfirmClear(true)}
          accessibilityHint={
            hasData
              ? 'Opens confirmation to clear local storage'
              : 'No local party data stored on this device'
          }
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  point: {
    gap: spacing.xs,
  },
  buttonStack: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  clearedBanner: {
    backgroundColor: colors.mint,
    padding: spacing.md,
    borderRadius: 8,
  },
  ink: { color: colors.ink },
  soft: { color: colors.inkSoft },
});

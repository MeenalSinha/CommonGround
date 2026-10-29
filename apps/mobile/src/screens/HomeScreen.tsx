import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { AvatarCluster } from '@/components/AvatarCluster';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Logo } from '@/components/Logo';
import { Screen } from '@/components/Screen';
import { StatusPill } from '@/components/StatusPill';
import { StatusSummary } from '@/components/StatusSummary';
import { useParty } from '@/state/PartyContext';
import { colors, radii, sizes, spacing, typography } from '@/theme';

/** Static product copy describing the steps that exist today. */
const STEPS = [
  'Create a party and add your people.',
  'Search Qloo for what each person loves and add it to their profile.',
  'Discover experiences Qloo suggests from the interests you choose.',
  'Plan together: record who is in, who is unsure and who would rather pass, then build and adjust a shared plan.',
] as const;

export function HomeScreen() {
  const router = useRouter();
  const { state, persistence } = useParty();
  const party = state.party;

  return (
    <Screen>
      <Logo compact />

      <Card tone="sky">
        <AvatarCluster />
        <Text style={[typography.display, styles.ink]} accessibilityRole="header">
          Different tastes. One unforgettable adventure.
        </Text>
        <Text style={[typography.body, styles.ink]}>
          Friends who love different things, finding the ground they share. CommonGround uses
          cultural intelligence from Qloo to spot connections between tastes.
        </Text>
        <Button
          label={party ? 'Open your party' : 'Create a party'}
          onPress={() => router.push('/party')}
          accessibilityHint={party ? `Opens ${party.name}` : 'Starts a new party'}
        />
        {party && state.negotiation ? (
          <Button
            label={state.negotiation.plan ? 'Continue your plan' : 'Continue planning together'}
            variant="secondary"
            onPress={() => router.push(state.negotiation?.plan ? '/plan' : '/negotiate')}
            accessibilityHint="Opens the saved negotiation"
          />
        ) : null}
        <Button
          label="Try an entity search"
          variant="secondary"
          onPress={() => router.push('/search')}
          accessibilityHint="Opens the Qloo entity search"
        />
      </Card>

      {persistence.notice ? (
        <Card tone="yellow">
          <Text style={[typography.body, styles.ink]} accessibilityRole="alert">
            {persistence.notice}
          </Text>
        </Card>
      ) : null}

      <Card tone="lavender">
        <View style={styles.header}>
          <Text style={[typography.title, styles.ink]} accessibilityRole="header">
            How it works
          </Text>
          <StatusPill label="Planning: live data needs a Qloo key" tone="neutral" />
        </View>
        {STEPS.map((step, index) => (
          <View key={step} style={styles.step}>
            <View style={styles.badge} accessibilityElementsHidden importantForAccessibility="no">
              <Text style={[typography.bodyStrong, styles.ink]}>{index + 1}</Text>
            </View>
            <Text style={[typography.body, styles.ink, styles.stepText]}>{step}</Text>
          </View>
        ))}
        <Text style={[typography.caption, styles.ink]}>
          Plans are saved on this device only and are not shared with anyone. Suggestions come from
          Qloo, so planning with real data starts once a Qloo key is connected.
        </Text>
      </Card>

      <StatusSummary onPress={() => router.push('/status')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  ink: { color: colors.ink },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepText: { flex: 1 },
  badge: {
    width: sizes.touchTarget - spacing.sm,
    height: sizes.touchTarget - spacing.sm,
    borderRadius: radii.pill,
    borderWidth: sizes.borderWidth,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { CategoryChips } from '@/components/CategoryChips';
import { Card } from '@/components/Card';
import { RecommendationCard } from '@/components/RecommendationCard';
import { Screen } from '@/components/Screen';
import { StateMessage } from '@/components/StateMessage';
import { useBackendStatusModel } from '@/hooks/BackendStatusContext';
import { useEntityTypes } from '@/hooks/useEntityTypes';
import { ApiError } from '@/services/apiClient';
import { integrationApi } from '@/services/integrationApi';
import { useParty } from '@/state/PartyContext';
import {
  MAX_SIGNAL_IDS,
  discoveryBlockers,
  fingerprint,
  groupInterests,
  memberNamesFor,
  snapshotSignals,
  type DiscoveryRun,
  type Party,
} from '@/state/party';
import { colors, radii, sizes, spacing, typography } from '@/theme';
import { entityTypeLabel, formatTime } from '@/utils/format';
import { searchAvailability } from '@/utils/status';

export function DiscoveryScreen() {
  const router = useRouter();
  const { state, actions } = useParty();
  const { party, targetType, run } = state;
  const model = useBackendStatusModel();
  const availability = searchAvailability(model);
  const entityTypes = useEntityTypes(model.backend === 'online');
  const [excluded, setExcluded] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<{ message: string; fingerprint: string } | null>(null);
  const inFlight = useRef(false);
  const latest = useRef('');

  const interests = groupInterests(party);
  const signalIds = interests.map((g) => g.entity.id).filter((id) => !excluded.includes(id));
  const current = targetType ? fingerprint(targetType, signalIds) : '';
  useEffect(() => {
    latest.current = current;
  }, [current]);

  const blockers = discoveryBlockers({
    party,
    searchEnabled: availability.enabled,
    searchReason: availability.reason,
    supportedTypes: entityTypes.types,
    targetType,
    signalIds,
  });

  const stale = run !== null && run.fingerprint !== current;
  const shownRun = run && !stale ? run : null;
  const shownFailure = failure && failure.fingerprint === current ? failure.message : null;

  const toggle = (id: string) =>
    setExcluded((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const discover = async () => {
    if (!party || !targetType || blockers.length > 0 || inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setFailure(null);
    const requested = fingerprint(targetType, signalIds);
    const signals = snapshotSignals(party, signalIds);
    try {
      const response = await integrationApi.recommendations(targetType, signalIds);
      // Ignore a response whose inputs changed while it was in flight.
      if (latest.current === requested) {
        actions.recordRun({ fingerprint: requested, targetType, signals, response });
      }
    } catch (e) {
      setFailure({
        message: e instanceof ApiError ? e.message : 'Something unexpected happened.',
        fingerprint: requested,
      });
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  };

  if (!party) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <StateMessage kind="unavailable" title="No party yet" message="Create a party first." />
        <Button label="Create a party" onPress={() => router.push('/party')} />
      </Screen>
    );
  }

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <Card tone="sky">
        <Text style={[typography.title, styles.ink]} accessibilityRole="header">
          {`Discover for ${party.name}`}
        </Text>
        <Text style={[typography.body, styles.ink]}>
          Pick what you want to find. Qloo suggests candidates based on the interests you select
          below. These are starting points, not a promise that everyone will love them.
        </Text>
      </Card>

      <Card>
        <Text style={[typography.subtitle, styles.ink]} accessibilityRole="header">
          What should we discover?
        </Text>
        {entityTypes.types ? (
          <CategoryChips
            types={entityTypes.types}
            selected={targetType}
            onSelect={actions.setTargetType}
          />
        ) : entityTypes.loading ? (
          <StateMessage kind="loading" message="Loading categories" />
        ) : entityTypes.error ? (
          <>
            <StateMessage kind="error" title="Categories unavailable" message={entityTypes.error} />
            <Button label="Reload categories" variant="secondary" onPress={entityTypes.reload} />
          </>
        ) : (
          <StateMessage
            kind="unavailable"
            title="Categories unavailable"
            message="Categories load once the backend is reachable."
          />
        )}
      </Card>

      <Card>
        <Text style={[typography.subtitle, styles.ink]} accessibilityRole="header">
          Interests to use
        </Text>
        {interests.length === 0 ? (
          <StateMessage
            kind="empty"
            title="No interests yet"
            message="Add interests to each person's profile first."
          />
        ) : (
          <>
            <Text style={[typography.caption, styles.soft]}>
              {`${signalIds.length} selected, up to ${MAX_SIGNAL_IDS} per request`}
            </Text>
            {interests.map((g) => {
              const on = !excluded.includes(g.entity.id);
              const names = g.memberIds
                .map((id) => party.members.find((m) => m.id === id)?.displayName)
                .filter(Boolean)
                .join(', ');
              return (
                <Pressable
                  key={g.entity.id}
                  accessibilityRole="checkbox"
                  accessibilityLabel={`${g.entity.name}, from ${names}`}
                  accessibilityState={{ checked: on }}
                  onPress={() => toggle(g.entity.id)}
                  style={[styles.signal, on && styles.signalOn]}
                >
                  <Text style={[typography.bodyStrong, styles.ink]}>
                    {`${on ? '\u2713 ' : ''}${g.entity.name}`}
                  </Text>
                  <Text style={[typography.caption, styles.soft]}>
                    {`${entityTypeLabel(g.entity.type)} \u00B7 ${names}`}
                  </Text>
                </Pressable>
              );
            })}
          </>
        )}
      </Card>

      {blockers.length > 0 ? (
        <StateMessage kind="unavailable" title="Not ready yet" message={blockers.join(' ')} />
      ) : null}
      {!availability.enabled ? (
        <Button
          label="Refresh status"
          variant="secondary"
          onPress={model.refresh}
          busy={model.refreshing}
        />
      ) : null}
      <Button
        label="Find shared experiences"
        onPress={discover}
        disabled={blockers.length > 0}
        busy={loading}
      />

      {loading ? <StateMessage kind="loading" message="Asking Qloo" /> : null}
      {shownFailure ? (
        <>
          <StateMessage kind="error" message={shownFailure} />
          <Button label="Try again" variant="secondary" onPress={discover} />
        </>
      ) : null}
      {stale ? (
        <StateMessage
          kind="unavailable"
          title="Selection changed"
          message="Your interests or category changed, so earlier results are hidden. Run discovery again."
        />
      ) : null}

      {shownRun ? <Results run={shownRun} party={party} /> : null}

      <Button
        label="Plan together"
        variant="secondary"
        disabled={!targetType}
        onPress={() => router.push('/negotiate')}
        accessibilityHint="Opens the group negotiation for this category"
      />
      <Button label="Back to party" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

function Results({ run, party }: { run: DiscoveryRun; party: Party }) {
  const [showSource, setShowSource] = useState(false);
  const { response } = run;
  const people = new Set(run.signals.flatMap((s) => s.memberIds)).size;
  const retrieved = formatTime(response.provenance.retrieved_at);
  return (
    <View style={styles.stack}>
      <Card tone="mint">
        <Text style={[typography.subtitle, styles.ink]} accessibilityRole="header">
          {`${entityTypeLabel(run.targetType)} suggestions from Qloo`}
        </Text>
        <Text style={[typography.body, styles.ink]}>
          {`Based on ${run.signals.length} ${run.signals.length === 1 ? 'interest' : 'interests'} from ${people} ${people === 1 ? 'person' : 'people'}: ${run.signals.map((s) => `${s.name} (${memberNamesFor(party, s.memberIds).join(', ')})`).join('; ')}.`}
        </Text>
      </Card>

      {response.empty ? (
        <StateMessage
          kind="empty"
          message="Qloo returned no suggestions for this selection. Try another category or different interests."
        />
      ) : (
        response.items.map((item) => <RecommendationCard key={item.id} item={item} />)
      )}

      <Button
        label={showSource ? 'Hide source details' : 'Show source details'}
        variant="secondary"
        onPress={() => setShowSource((v) => !v)}
      />
      {showSource ? (
        <Card>
          <Text
            style={[typography.body, styles.ink]}
          >{`Source: ${response.provenance.source}`}</Text>
          <Text style={[typography.body, styles.ink]}>
            {`Endpoint: ${response.provenance.endpoint}`}
          </Text>
          {retrieved ? (
            <Text style={[typography.body, styles.ink]}>{`Retrieved at ${retrieved}`}</Text>
          ) : null}
          <Text style={[typography.caption, styles.soft]}>
            Qloo returned no per-person fit or compatibility score, so none is shown.
          </Text>
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  signal: {
    minHeight: sizes.touchTarget,
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: sizes.borderWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  signalOn: { borderColor: colors.ink, backgroundColor: colors.mint },
  ink: { color: colors.ink },
  soft: { color: colors.inkSoft },
});

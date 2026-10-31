import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  explainCandidate,
  FEEDBACK_LABELS,
  describeIneligible,
  namesFor,
} from '@/state/negotiation/explain';
import { parseOptionalNumber } from '@/state/negotiation/inputs';
import type { RankedCandidate } from '@/state/negotiation/ranking';
import type { FeedbackKind, NegotiationCandidate, TagRef } from '@/state/negotiation/types';
import type { Party } from '@/state/party';
import { colors, radii, spacing, typography } from '@/theme';
import { entityTypeLabel, formatTime } from '@/utils/format';
import { Button } from './Button';
import { Card } from './Card';
import { ChoiceChip } from './ChoiceChip';
import { TextField } from './TextField';

const KINDS: FeedbackKind[] = ['interested', 'unsure', 'pass', 'exclude'];

interface Props {
  ranked: RankedCandidate;
  candidate: NegotiationCandidate;
  party: Party;
  /** The person whose response is being recorded right now (the organizer switches between people). */
  activeMemberId: string | null;
  inPlan: boolean;
  readOnly: boolean;
  excludedTagIds: string[];
  retrievedAt: (queryId: string) => string | null;
  onFeedback: (kind: FeedbackKind | null) => void;
  onTogglePlan: () => void;
  onExclude: () => void;
  onExcludeTag: (tag: TagRef) => void;
  onDetails: (patch: {
    cost?: number | null;
    durationMinutes?: number | null;
    note?: string;
  }) => void;
}

export function CandidateCard(p: Props) {
  const { candidate, ranked, party } = p;
  const name = candidate.entity.name;
  const [showWhy, setShowWhy] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [cost, setCost] = useState(candidate.details.cost?.toString() ?? '');
  const [minutes, setMinutes] = useState(candidate.details.durationMinutes?.toString() ?? '');
  const [note, setNote] = useState(candidate.details.note);
  const [error, setError] = useState<string | null>(null);

  const mine = p.activeMemberId ? candidate.feedback[p.activeMemberId] : undefined;
  const others = party.members
    .filter((m) => m.id !== p.activeMemberId)
    .map(
      (m) =>
        `${m.displayName}: ${candidate.feedback[m.id] ? FEEDBACK_LABELS[candidate.feedback[m.id]!] : 'no response'}`,
    );

  const saveDetails = () => {
    const c = parseOptionalNumber(cost, { allowZero: true, what: 'the cost' });
    const m = parseOptionalNumber(minutes, { integer: true, what: 'the duration in minutes' });
    if (!c.ok) return setError(c.error);
    if (!m.ok) return setError(m.error);
    setError(null);
    p.onDetails({ cost: c.value, durationMinutes: m.value, note });
  };

  const meta = [
    entityTypeLabel(candidate.entity.type),
    candidate.entity.release_year ? String(candidate.entity.release_year) : null,
  ]
    .filter(Boolean)
    .join(' \u00B7 ');

  return (
    <Card tone={p.inPlan ? 'mint' : 'plain'}>
      <Text style={[typography.subtitle, styles.ink]} accessibilityRole="header">
        {name}
      </Text>
      <Text
        style={[typography.caption, styles.soft]}
      >{`${meta}${p.inPlan ? ' \u00B7 In the plan' : ''}`}</Text>
      {candidate.entity.description ? (
        <Text style={[typography.body, styles.ink]} numberOfLines={3}>
          {candidate.entity.description}
        </Text>
      ) : null}

      {explainCandidate(ranked, candidate, party).map((line) => (
        <Text key={line} style={[typography.body, styles.ink]}>
          {line}
        </Text>
      ))}

      <Button
        label={showWhy ? `Hide evidence: ${name}` : `Show evidence: ${name}`}
        variant="secondary"
        onPress={() => setShowWhy((v) => !v)}
      />
      {showWhy ? (
        <View style={styles.evidenceBox}>
          {ranked.sources.length === 0 ? (
            <Text style={[typography.body, styles.ink]}>
              No recommendation request returned this. It is here because it was added by hand.
            </Text>
          ) : (
            ranked.sources.map((s) => (
              <Text key={s.queryId} style={[typography.body, styles.ink]}>
                {`${s.kind === 'group' ? 'Group-level query' : `${namesFor(party, [s.memberId ?? ''])[0] ?? 'Someone'}’s selected interests`}: returned at position ${s.position}${p.retrievedAt(s.queryId) ? ` (retrieved ${formatTime(p.retrievedAt(s.queryId))})` : ''}.`}
              </Text>
            ))
          )}
          <Text style={[typography.caption, styles.soft]}>
            Being surfaced is not the same as being liked. Only the responses below count as
            preferences. Qloo returned no fit or compatibility score, so none is shown.
          </Text>
        </View>
      ) : null}

      {p.activeMemberId ? (
        <View style={styles.stack}>
          <Text style={[typography.caption, styles.soft]}>
            {`Recording for ${party.members.find((m) => m.id === p.activeMemberId)?.displayName ?? 'someone'} (saved on this device):`}
          </Text>
          <View style={styles.row}>
            {KINDS.map((kind) => (
              <ChoiceChip
                key={kind}
                label={FEEDBACK_LABELS[kind]}
                accessibilityLabel={`${FEEDBACK_LABELS[kind]}: ${name}`}
                selected={mine === kind}
                tone={kind === 'exclude' ? 'danger' : 'neutral'}
                disabled={p.readOnly}
                onPress={() => p.onFeedback(mine === kind ? null : kind)}
                accessibilityHint={
                  kind === 'exclude'
                    ? 'A hard exclusion: this option will never be in the plan'
                    : kind === 'pass'
                      ? 'A soft preference, not a hard exclusion'
                      : undefined
                }
              />
            ))}
          </View>
          {others.length > 0 ? (
            <Text style={[typography.caption, styles.soft]}>{others.join(' \u00B7 ')}</Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.row}>
        <Button
          label={p.inPlan ? `Remove from plan: ${name}` : `Add to plan: ${name}`}
          variant={p.inPlan ? 'secondary' : 'primary'}
          disabled={p.readOnly}
          onPress={p.onTogglePlan}
        />
        <Button
          label={`Exclude for everyone: ${name}`}
          variant="secondary"
          disabled={p.readOnly}
          onPress={p.onExclude}
        />
      </View>

      {candidate.entity.tags.length > 0 ? (
        <View style={styles.stack}>
          <Text style={[typography.caption, styles.soft]}>
            Exclude everything with a tag (a hard rule):
          </Text>
          <View style={styles.row}>
            {candidate.entity.tags.slice(0, 6).map((tag) => (
              <ChoiceChip
                key={tag.id}
                label={tag.name ?? tag.id}
                accessibilityLabel={`Exclude tag ${tag.name ?? tag.id}`}
                selected={p.excludedTagIds.includes(tag.id)}
                tone="danger"
                disabled={p.readOnly || p.excludedTagIds.includes(tag.id)}
                onPress={() => p.onExcludeTag({ id: tag.id, name: tag.name })}
              />
            ))}
          </View>
        </View>
      ) : null}

      <Button
        label={
          showDetails ? `Hide your details: ${name}` : `Add your own cost and duration: ${name}`
        }
        variant="secondary"
        onPress={() => setShowDetails((v) => !v)}
      />
      {showDetails ? (
        <View style={styles.stack}>
          <Text style={[typography.caption, styles.soft]}>
            You enter these. Qloo does not provide prices, durations or opening hours, so they are
            marked as yours.
          </Text>
          <TextField
            label={`Cost for ${name} (your estimate)`}
            value={cost}
            onChangeText={setCost}
            placeholder="e.g. 12"
          />
          <TextField
            label={`Duration in minutes for ${name} (your estimate)`}
            value={minutes}
            onChangeText={setMinutes}
            placeholder="e.g. 120"
          />
          <TextField
            label={`Note for ${name}`}
            value={note}
            onChangeText={setNote}
            maxLength={200}
          />
          {error ? <Text style={[typography.caption, styles.error]}>{error}</Text> : null}
          <Button label={`Save details: ${name}`} onPress={saveDetails} disabled={p.readOnly} />
        </View>
      ) : null}
    </Card>
  );
}

/** A candidate set aside by a hard rule or a group pass, with each reason and its own way to undo it. */
export function SetAsideCard({
  name,
  eligibility,
  party,
  undo,
  readOnly,
}: {
  name: string;
  eligibility: RankedCandidate['eligibility'];
  party: Party;
  undo: { label: string; onPress: () => void }[];
  readOnly: boolean;
}) {
  const lines = eligibility.eligible ? [] : describeIneligible(eligibility.reasons, party);
  return (
    <Card tone="coral">
      <Text style={[typography.subtitle, styles.ink]} accessibilityRole="header">
        {name}
      </Text>
      {lines.map((l) => (
        <Text key={l} style={[typography.body, styles.ink]}>
          {l}
        </Text>
      ))}
      {undo.map((u) => (
        <Button
          key={u.label}
          label={u.label}
          variant="secondary"
          disabled={readOnly}
          onPress={u.onPress}
        />
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  evidenceBox: {
    gap: spacing.sm,
    backgroundColor: colors.creamDeep,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  ink: { color: colors.ink },
  soft: { color: colors.inkSoft },
  error: { color: colors.coralDeep },
});

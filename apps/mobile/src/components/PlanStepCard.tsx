import { StyleSheet, Text, View } from 'react-native';
import { FEEDBACK_LABELS, namesFor } from '@/state/negotiation/explain';
import type { NegotiationCandidate, PlanEntry } from '@/state/negotiation/types';
import type { Party } from '@/state/party';
import { colors, radii, shadows, sizes, spacing, typography } from '@/theme';
import { entityTypeLabel } from '@/utils/format';
import { Button } from './Button';
import { Card } from './Card';

interface Props {
  index: number;
  total: number;
  entry: PlanEntry;
  /** Missing when the candidate left the pool; the card then says so instead of inventing details. */
  candidate: NegotiationCandidate | undefined;
  party: Party;
  surfacedBy: string[];
  readOnly: boolean;
  onMove: (delta: -1 | 1) => void;
  onReplace: () => void;
  onRemove: () => void;
  onReject: () => void;
  onExclude: () => void;
}

export function PlanStepCard(p: Props) {
  const name = p.candidate?.entity.name ?? 'A suggestion that left the pool';
  const feedback = p.candidate
    ? p.party.members.map(
        (m) =>
          `${m.displayName}: ${p.candidate!.feedback[m.id] ? FEEDBACK_LABELS[p.candidate!.feedback[m.id]!] : 'no response'}`,
      )
    : [];
  const d = p.candidate?.details;
  const mine = [
    d?.cost != null ? `cost ${d.cost}` : null,
    d?.durationMinutes != null ? `${d.durationMinutes} min` : null,
  ].filter(Boolean);
  const surfaced = namesFor(p.party, p.surfacedBy);

  return (
    <View style={styles.wrap}>
      <View
        style={styles.badgeCol}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={styles.badge}>
          <Text style={[typography.bodyStrong, styles.ink]}>{p.index + 1}</Text>
        </View>
        {p.index < p.total - 1 ? <View style={styles.connector} /> : null}
      </View>
      <Card tone={p.candidate ? 'plain' : 'coral'} style={styles.card}>
        <Text style={[typography.subtitle, styles.ink]} accessibilityRole="header">
          {`${p.index + 1}. ${name}`}
        </Text>
        {p.candidate ? (
          <Text style={[typography.caption, styles.soft]}>
            {[
              entityTypeLabel(p.candidate.entity.type),
              p.candidate.entity.release_year,
              p.entry.origin === 'user' ? 'Added by you' : null,
            ]
              .filter(Boolean)
              .join(' \u00B7 ')}
          </Text>
        ) : (
          <Text style={[typography.body, styles.ink]}>
            This entry is no longer in the candidate pool. Remove or replace it.
          </Text>
        )}
        {p.entry.reasons.map((r) => (
          <Text key={r} style={[typography.body, styles.ink]}>
            {r}
          </Text>
        ))}
        {surfaced.length > 0 ? (
          <Text
            style={[typography.caption, styles.soft]}
          >{`Recommendation lists built from ${surfaced.join(', ')}’s interests returned it.`}</Text>
        ) : null}
        {feedback.length > 0 ? (
          <Text
            style={[typography.caption, styles.soft]}
          >{`Responses (recorded locally): ${feedback.join(' \u00B7 ')}`}</Text>
        ) : null}
        <Text style={[typography.caption, styles.soft]}>
          {mine.length > 0
            ? `Your estimate (not verified): ${mine.join(', ')}${d?.note ? `. Note: ${d.note}` : ''}`
            : 'No cost or duration entered by you. Hours, prices and availability are not verified.'}
        </Text>

        <View style={styles.row}>
          <Button
            label={`Move earlier: ${name}`}
            variant="secondary"
            disabled={p.readOnly || p.index === 0}
            onPress={() => p.onMove(-1)}
          />
          <Button
            label={`Move later: ${name}`}
            variant="secondary"
            disabled={p.readOnly || p.index === p.total - 1}
            onPress={() => p.onMove(1)}
          />
        </View>
        <View style={styles.row}>
          <Button
            label={`Replace: ${name}`}
            variant="secondary"
            disabled={p.readOnly}
            onPress={p.onReplace}
          />
          <Button
            label={`Remove: ${name}`}
            variant="secondary"
            disabled={p.readOnly}
            onPress={p.onRemove}
          />
        </View>
        {p.candidate ? (
          <View style={styles.row}>
            <Button
              label={`Pass for the group: ${name}`}
              variant="secondary"
              disabled={p.readOnly}
              onPress={p.onReject}
            />
            <Button
              label={`Hard exclude for everyone: ${name}`}
              variant="secondary"
              disabled={p.readOnly}
              onPress={p.onExclude}
            />
          </View>
        ) : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: spacing.md },
  badgeCol: { alignItems: 'center', width: sizes.touchTarget - spacing.sm },
  badge: {
    width: sizes.touchTarget - spacing.sm,
    height: sizes.touchTarget - spacing.sm,
    borderRadius: radii.pill,
    borderWidth: sizes.borderWidth,
    borderBottomWidth: sizes.buttonDepth - 1,
    borderColor: colors.ink,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.subtle,
  },
  // A dotted path between steps: decorative only, it implies no geography.
  connector: {
    flex: 1,
    borderLeftWidth: sizes.borderWidth,
    borderStyle: 'dotted',
    borderColor: colors.ink,
    marginTop: spacing.xs,
  },
  card: { flex: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  ink: { color: colors.ink },
  soft: { color: colors.inkSoft },
});

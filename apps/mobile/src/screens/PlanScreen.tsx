import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { PlanStepCard } from '@/components/PlanStepCard';
import { Screen } from '@/components/Screen';
import { StateMessage } from '@/components/StateMessage';
import { StatusPill, type PillTone } from '@/components/StatusPill';
import { TextField } from '@/components/TextField';
import { useParty } from '@/state/PartyContext';
import { plan as planConfig, planModes } from '@/state/negotiation/config';
import { candidateSources, surfacingMemberIds } from '@/state/negotiation/pool';
import { planTotals } from '@/state/negotiation/planner';
import {
  STATUS_LABELS,
  STATUS_MEANINGS,
  blockingIssues,
  planStatus,
  validatePlan,
} from '@/state/negotiation/validation';
import type { PlanStatus } from '@/state/negotiation/types';
import { colors, spacing, typography } from '@/theme';

const STATUS_TONE: Record<PlanStatus, PillTone> = {
  draft: 'neutral',
  proposed: 'warn',
  needs_changes: 'bad',
  ready: 'good',
  finalized: 'good',
};

export function PlanScreen() {
  const router = useRouter();
  const { state, actions, persistence } = useParty();
  const { party, negotiation: session } = state;
  const n = actions.negotiation;
  const [confirming, setConfirming] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState<string | null>(null);

  if (!party || !session) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <StateMessage
          kind="unavailable"
          title="No negotiation yet"
          message="Gather suggestions and record responses first."
        />
        <Button label="Go to negotiation" onPress={() => router.push('/negotiate')} />
      </Screen>
    );
  }
  const plan = session.plan;
  const outcome = session.lastOutcome;
  if (!plan) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <StateMessage
          kind="unavailable"
          title="No plan yet"
          message={
            outcome && !outcome.ok
              ? `${outcome.message} ${outcome.nextStep}`
              : 'Build a plan from the shortlist first.'
          }
        />
        <Button label="Back to negotiation" onPress={() => router.push('/negotiate')} />
      </Screen>
    );
  }

  const status = planStatus(session, party)!;
  const issues = validatePlan(session, party);
  const blocking = blockingIssues(issues);
  const warnings = issues.filter((i) => i.severity === 'warning');
  const stale = blocking.some((i) => i.code === 'stale_inputs');
  const finalized = status === 'finalized';
  const mode = planModes[plan.mode];
  const ids = plan.entries.map((e) => e.candidateId);
  const totals = planTotals(session, ids);
  const showOutcome = (o: ReturnType<typeof n.generatePlan>) =>
    setNote(o && !o.ok ? `${o.message} ${o.nextStep}` : null);

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <Card tone="lavender">
        <Text style={[typography.title, styles.ink]} accessibilityRole="header">
          {plan.title}
        </Text>
        <StatusPill label={STATUS_LABELS[status]} tone={STATUS_TONE[status]} />
        <Text style={[typography.body, styles.ink]}>{STATUS_MEANINGS[status]}</Text>
        <Text style={[typography.bodyStrong, styles.ink]}>{mode.label}</Text>
        <Text style={[typography.caption, styles.soft]}>{mode.note}</Text>
        <Text style={[typography.caption, styles.soft]}>
          {`${plan.entries.length} of ${session.planLength} requested ${session.planLength === 1 ? 'entry' : 'entries'}. Saved on this device only; it is not shared with anyone.`}
        </Text>
        {persistence.error ? (
          <Text style={[typography.caption, styles.error]}>{persistence.error}</Text>
        ) : null}
        {renaming ? (
          <>
            <TextField label="Plan title" value={title} onChangeText={setTitle} maxLength={60} />
            <Button
              label="Save title"
              onPress={() => {
                n.renamePlan(title);
                setRenaming(false);
              }}
              disabled={!title.trim()}
            />
          </>
        ) : (
          <Button
            label="Rename plan"
            variant="secondary"
            disabled={finalized}
            onPress={() => {
              setTitle(plan.title);
              setRenaming(true);
            }}
          />
        )}
      </Card>

      {outcome ? (
        <Card tone={outcome.ok ? 'mint' : 'yellow'}>
          <Text style={[typography.subtitle, styles.ink]} accessibilityRole="header">
            {outcome.ok ? 'What changed' : 'That did not work'}
          </Text>
          {outcome.ok ? (
            outcome.messages.map((m) => (
              <Text key={m} style={[typography.body, styles.ink]}>
                {m}
              </Text>
            ))
          ) : (
            <Text
              style={[typography.body, styles.ink]}
            >{`${outcome.message} ${outcome.nextStep}`}</Text>
          )}
        </Card>
      ) : null}
      {note ? <StateMessage kind="unavailable" title="Heads up" message={note} /> : null}

      {blocking.length > 0 ? (
        <Card tone="coral">
          <Text style={[typography.subtitle, styles.ink]} accessibilityRole="header">
            Needs your attention
          </Text>
          {blocking.map((i) => (
            <Text
              key={`${i.code}-${i.candidateId ?? ''}-${i.message}`}
              style={[typography.body, styles.ink]}
            >
              {i.message}
            </Text>
          ))}
        </Card>
      ) : null}
      {warnings.length > 0 ? (
        <Card tone="yellow">
          <Text style={[typography.subtitle, styles.ink]} accessibilityRole="header">
            Still unresolved
          </Text>
          {warnings.map((i) => (
            <Text
              key={`${i.code}-${i.candidateId ?? ''}-${i.message}`}
              style={[typography.body, styles.ink]}
            >
              {i.message}
            </Text>
          ))}
        </Card>
      ) : null}

      <View style={styles.stack}>
        {plan.entries.length === 0 ? (
          <StateMessage
            kind="empty"
            title="No entries"
            message="Add suggestions from the shortlist, or rebuild the plan."
          />
        ) : null}
        {plan.entries.map((entry, index) => {
          const candidate = session.candidates[entry.candidateId];
          return (
            <PlanStepCard
              key={entry.candidateId}
              index={index}
              total={plan.entries.length}
              entry={entry}
              candidate={candidate}
              party={party}
              surfacedBy={surfacingMemberIds(candidateSources(session, entry.candidateId))}
              readOnly={finalized}
              onMove={(d) => n.moveInPlan(entry.candidateId, d)}
              onReplace={() => showOutcome(n.replaceInPlan(entry.candidateId))}
              onRemove={() => n.removeFromPlan(entry.candidateId)}
              onReject={() => n.rejectFromPlan(entry.candidateId)}
              onExclude={() => n.excludeFromPlan(entry.candidateId)}
            />
          );
        })}
      </View>

      {session.constraints.budgetMax != null ||
      session.constraints.maxTotalMinutes != null ||
      totals.knownCost > 0 ||
      totals.knownMinutes > 0 ? (
        <Card>
          <Text style={[typography.subtitle, styles.ink]} accessibilityRole="header">
            Your numbers
          </Text>
          <Text style={[typography.body, styles.ink]}>
            {`Costs you entered: ${totals.knownCost}${session.constraints.budgetMax != null ? ` of ${session.constraints.budgetMax}` : ''}. ${totals.unknownCost} without a cost.`}
          </Text>
          <Text style={[typography.body, styles.ink]}>
            {`Minutes you entered: ${totals.knownMinutes}${session.constraints.maxTotalMinutes != null ? ` of ${session.constraints.maxTotalMinutes}` : ''}. ${totals.unknownMinutes} without a duration.`}
          </Text>
          <Text style={[typography.caption, styles.soft]}>
            These are your estimates. Nothing here comes from Qloo.
          </Text>
        </Card>
      ) : null}

      <Card>
        <Text style={[typography.subtitle, styles.ink]} accessibilityRole="header">
          Change the plan
        </Text>
        <View style={styles.row}>
          <Button
            label="Fewer entries"
            variant="secondary"
            disabled={finalized || session.planLength <= planConfig.minLength}
            onPress={() => n.setPlanLength(session.planLength - 1)}
          />
          <Text
            style={[typography.bodyStrong, styles.ink]}
          >{`${session.planLength} requested`}</Text>
          <Button
            label="More entries"
            variant="secondary"
            disabled={finalized || session.planLength >= planConfig.maxLength}
            onPress={() => n.setPlanLength(session.planLength + 1)}
          />
        </View>
        <Button
          label="Suggest an alternative plan"
          disabled={finalized}
          onPress={() => showOutcome(n.generatePlan({ alternative: true }))}
        />
        <Button
          label="Rebuild with current responses"
          variant="secondary"
          disabled={finalized}
          onPress={() => showOutcome(n.generatePlan())}
        />
        <Button
          label="Back to negotiation"
          variant="secondary"
          onPress={() => router.push('/negotiate')}
        />
      </Card>

      <Card tone={finalized ? 'mint' : 'plain'}>
        <Text style={[typography.subtitle, styles.ink]} accessibilityRole="header">
          Finish
        </Text>
        {finalized ? (
          <>
            <Text style={[typography.body, styles.ink]}>
              This plan is finalized on this device. That is your confirmation, not a record that
              everyone approved it.
            </Text>
            <Button
              label="Reopen plan to change it"
              variant="secondary"
              onPress={() => n.reopen()}
            />
          </>
        ) : confirming ? (
          <>
            <Text style={[typography.body, styles.ink]}>
              {warnings.length > 0
                ? `Finalize anyway? ${warnings.length} ${warnings.length === 1 ? 'item is' : 'items are'} still unresolved (see above). Finalizing does not mean everyone agreed.`
                : 'Finalize this plan? You can reopen it later.'}
            </Text>
            <Button
              label="Yes, finalize this plan"
              onPress={() => {
                showOutcome(n.finalize(true));
                setConfirming(false);
              }}
            />
            <Button label="Not yet" variant="secondary" onPress={() => setConfirming(false)} />
          </>
        ) : (
          <>
            {stale ? (
              <>
                <Button
                  label="Confirm it still works as it is"
                  variant="secondary"
                  onPress={() => showOutcome(n.acknowledgeInputs())}
                />
                <Text style={[typography.caption, styles.soft]}>
                  Or rebuild it above so it reflects the latest responses.
                </Text>
              </>
            ) : null}
            {status === 'proposed' ? (
              <Button
                label="Mark ready for confirmation"
                onPress={() => showOutcome(n.markReady())}
              />
            ) : null}
            {status === 'ready' ? (
              <Button label="Finalize plan" onPress={() => setConfirming(true)} />
            ) : null}
            {status === 'needs_changes' && !stale ? (
              <Text style={[typography.caption, styles.soft]}>
                Fix the items under “Needs your attention” to continue.
              </Text>
            ) : null}
            {status === 'draft' ? (
              <Text style={[typography.caption, styles.soft]}>
                Add at least one entry to continue.
              </Text>
            ) : null}
          </>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  ink: { color: colors.ink },
  soft: { color: colors.inkSoft },
  error: { color: colors.coralDeep },
});

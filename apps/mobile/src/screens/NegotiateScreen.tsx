import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { CandidateCard, SetAsideCard } from '@/components/CandidateCard';
import { Card } from '@/components/Card';
import { ChoiceChip } from '@/components/ChoiceChip';
import { Screen } from '@/components/Screen';
import { StateMessage } from '@/components/StateMessage';
import { StatusPill } from '@/components/StatusPill';
import { TextField } from '@/components/TextField';
import { useBackendStatusModel } from '@/hooks/BackendStatusContext';
import { useEntitySearch } from '@/hooks/useEntitySearch';
import { useParty } from '@/state/PartyContext';
import { plan as planConfig } from '@/state/negotiation/config';
import { parseOptionalNumber } from '@/state/negotiation/inputs';
import { memberQueryId } from '@/state/negotiation/queries';
import { buildNegotiationView } from '@/state/negotiation/view';
import { MAX_SIGNAL_IDS } from '@/state/party';
import { colors, spacing, typography } from '@/theme';
import { entityTypeLabel } from '@/utils/format';
import { searchAvailability } from '@/utils/status';

export function NegotiateScreen() {
  const router = useRouter();
  const { state, actions, gather } = useParty();
  const model = useBackendStatusModel();
  const availability = searchAvailability(model);
  const { party, targetType } = state;
  const n = actions.negotiation;

  // Create the session once a party and category exist. Restored sessions are reused, never duplicated.
  useEffect(() => {
    if (party && targetType && !state.negotiation) n.start();
  }, [party, targetType, state.negotiation, n]);

  const view = buildNegotiationView(state, {
    available: availability.enabled,
    reason: availability.reason,
  });
  const session = view.session;
  const finalized = Boolean(session?.plan?.finalizedAt);

  const [activeId, setActiveId] = useState<string | null>(null);
  const active = party?.members.find((m) => m.id === activeId) ?? party?.members[0] ?? null;
  const [openScopes, setOpenScopes] = useState<string[]>([]);
  // null means "not editing": show the saved value. Typing creates a draft; saving clears it.
  const [draft, setDraft] = useState<{ budget: string | null; minutes: string | null }>({
    budget: null,
    minutes: null,
  });
  const [limitError, setLimitError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (!party) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <StateMessage kind="unavailable" title="No party yet" message="Create a party first." />
        <Button label="Create a party" onPress={() => router.push('/party')} />
      </Screen>
    );
  }
  if (!targetType) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <StateMessage
          kind="unavailable"
          title="Pick a category first"
          message="Choose what you want to plan (movies, places, music...) on the Discover screen."
        />
        <Button label="Choose a category" onPress={() => router.push('/discover')} />
      </Screen>
    );
  }
  if (!session) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <StateMessage kind="loading" message="Setting up your negotiation" />
      </Screen>
    );
  }

  const budget = draft.budget ?? session?.constraints.budgetMax?.toString() ?? '';
  const minutes = draft.minutes ?? session?.constraints.maxTotalMinutes?.toString() ?? '';
  const setBudget = (v: string) => setDraft((d) => ({ ...d, budget: v }));
  const setMinutes = (v: string) => setDraft((d) => ({ ...d, minutes: v }));
  const inPlanIds = new Set(session.plan?.entries.map((e) => e.candidateId) ?? []);
  const saveLimits = () => {
    const b = parseOptionalNumber(budget, { what: 'the budget' });
    const m = parseOptionalNumber(minutes, { integer: true, what: 'the time limit in minutes' });
    if (!b.ok) return setLimitError(b.error);
    if (!m.ok) return setLimitError(m.error);
    setLimitError(null);
    n.setConstraint({ budgetMax: b.value, maxTotalMinutes: m.value });
    setDraft({ budget: null, minutes: null });
  };
  const build = (alternative = false) => {
    const outcome = n.generatePlan({ alternative });
    if (outcome?.ok) router.push('/plan');
    else setNotice(outcome && !outcome.ok ? `${outcome.message} ${outcome.nextStep}` : null);
  };

  const stageText = gather.running ? (gather.stage?.label ?? 'Starting') : null;
  const summary = gather.summary;
  const hasPool = Object.keys(session.candidates).length > 0;

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <Card tone="sky">
        <Text style={[typography.title, styles.ink]} accessibilityRole="header">
          {`Plan together: ${entityTypeLabel(targetType)}`}
        </Text>
        <Text style={[typography.body, styles.ink]}>
          Gather suggestions from everyone&apos;s interests, record who is in, who is unsure and who
          would rather pass, then build a plan the group can tweak. You, the organizer, record each
          person&apos;s response here; it is saved on this device and not shared with anyone.
        </Text>
        {finalized ? (
          <StatusPill label="Plan finalized: reopen it to change anything" tone="warn" />
        ) : null}
      </Card>

      <Card>
        <Text style={[typography.subtitle, styles.ink]} accessibilityRole="header">
          Whose interests are in the mix
        </Text>
        {party.members.map((m) => {
          const record = view.recordFor(memberQueryId(m.id));
          const label =
            m.interests.length === 0
              ? 'No Qloo interests yet: not represented'
              : !record
                ? 'Waiting to be gathered'
                : record.status === 'ok'
                  ? `${record.results.length} suggestions`
                  : record.status === 'empty'
                    ? 'Qloo returned none'
                    : record.status === 'failed'
                      ? 'Request failed'
                      : 'Not sent yet';
          const tone =
            m.interests.length === 0 || record?.status === 'failed'
              ? 'bad'
              : record?.status === 'ok'
                ? 'good'
                : 'warn';
          return (
            <View key={m.id} style={styles.row}>
              <Text style={[typography.bodyStrong, styles.ink]}>{m.displayName}</Text>
              <StatusPill label={label} tone={tone} />
            </View>
          );
        })}
        {view.notes.map((note) => (
          <Text key={note} style={[typography.body, styles.ink]}>
            {note}
          </Text>
        ))}
      </Card>

      <Card>
        <Text style={[typography.subtitle, styles.ink]} accessibilityRole="header">
          Interests used for each request
        </Text>
        <Text style={[typography.caption, styles.soft]}>
          {`Qloo accepts up to ${MAX_SIGNAL_IDS} interests per request. Nothing is trimmed for you: if a list is too long, choose which to keep.`}
        </Text>
        {view.specs.map((spec) => {
          const owner =
            spec.kind === 'group'
              ? 'The whole group'
              : (party.members.find((m) => m.id === spec.memberId)?.displayName ?? 'Someone');
          const scope = spec.kind === 'group' ? 'group' : spec.memberId!;
          const open = openScopes.includes(spec.id) || spec.overLimitBy > 0;
          const pool =
            spec.kind === 'group'
              ? party.members.flatMap((m) => m.interests)
              : (party.members.find((m) => m.id === spec.memberId)?.interests ?? []);
          const unique = [...new Map(pool.map((i) => [i.id, i])).values()];
          return (
            <View key={spec.id} style={styles.stack}>
              <Text style={[typography.bodyStrong, styles.ink]}>
                {`${owner}: ${spec.entityIds.length} of ${unique.length} interests selected`}
              </Text>
              {spec.overLimitBy > 0 ? (
                <Text
                  style={[typography.caption, styles.error]}
                >{`Too many for one request. Deselect ${spec.overLimitBy}.`}</Text>
              ) : null}
              <Button
                label={open ? `Hide interests for ${owner}` : `Choose interests for ${owner}`}
                variant="secondary"
                disabled={finalized}
                onPress={() =>
                  setOpenScopes((s) =>
                    s.includes(spec.id) ? s.filter((x) => x !== spec.id) : [...s, spec.id],
                  )
                }
              />
              {open ? (
                <View style={styles.wrap}>
                  {unique.map((i) => (
                    <ChoiceChip
                      key={i.id}
                      label={i.name}
                      accessibilityLabel={`${i.name} for ${owner}`}
                      selected={spec.entityIds.includes(i.id)}
                      disabled={finalized}
                      onPress={() => n.setSignal(scope, i.id, !spec.entityIds.includes(i.id))}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </Card>

      <Card tone="lavender">
        <Text style={[typography.subtitle, styles.ink]} accessibilityRole="header">
          Gather suggestions
        </Text>
        {view.blockers.length > 0 ? (
          <StateMessage
            kind="unavailable"
            title="Not ready yet"
            message={view.blockers.join(' ')}
          />
        ) : null}
        {stageText ? <StateMessage kind="loading" message={stageText} /> : null}
        {summary && !gather.running ? (
          <Text style={[typography.body, styles.ink]}>
            {`Last run: ${summary.requested} ${summary.requested === 1 ? 'request' : 'requests'} sent, ${summary.ok} returned suggestions, ${summary.empty} returned none, ${summary.failed} failed${summary.notSent ? `, ${summary.notSent} not sent` : ''}.`}
          </Text>
        ) : null}
        {summary?.stoppedBecause ? (
          <Text style={[typography.caption, styles.error]}>
            Stopped early so the remaining requests were not sent. Retry when the problem is
            resolved.
          </Text>
        ) : null}
        <Button
          label={hasPool ? 'Gather missing suggestions' : 'Gather suggestions'}
          onPress={() => void n.gather()}
          disabled={view.blockers.length > 0 || finalized}
          busy={gather.running}
        />
        {view.retryable > 0 && !gather.running ? (
          <Button
            label={`Retry ${view.retryable} failed or unsent ${view.retryable === 1 ? 'request' : 'requests'}`}
            variant="secondary"
            disabled={view.blockers.length > 0 || finalized}
            onPress={() => void n.gather()}
          />
        ) : null}
        {hasPool ? (
          <Button
            label="Refresh everything from Qloo"
            variant="secondary"
            disabled={view.blockers.length > 0 || finalized}
            busy={gather.running}
            onPress={() => void n.gather({ force: true })}
          />
        ) : null}
        <Text style={[typography.caption, styles.soft]}>
          Requests are sent one at a time. A suggestion surfaced from someone&apos;s interests is
          not proof they like it.
        </Text>
      </Card>

      {hasPool ? (
        <>
          <Card>
            <Text style={[typography.subtitle, styles.ink]} accessibilityRole="header">
              Recording responses for
            </Text>
            <View style={styles.wrap}>
              {party.members.map((m) => (
                <ChoiceChip
                  key={m.id}
                  label={m.displayName}
                  accessibilityLabel={`Record responses for ${m.displayName}`}
                  selected={active?.id === m.id}
                  onPress={() => setActiveId(m.id)}
                />
              ))}
            </View>
            <Text style={[typography.caption, styles.soft]}>
              Pass and Unsure are ordinary opinions. Only Hard exclusion keeps an option out of the
              plan for good.
            </Text>
          </Card>

          <Text style={[typography.title, styles.ink]} accessibilityRole="header">
            {`Shortlist (${view.ranked.length})`}
          </Text>
          {view.ranked.length === 0 ? (
            <StateMessage
              kind="empty"
              title="No eligible candidates"
              message="Everything has been excluded or passed on. Undo an exclusion below, or gather more."
            />
          ) : null}
          {view.ranked.map((r) => (
            <CandidateCard
              key={r.candidateId}
              ranked={r}
              candidate={session.candidates[r.candidateId]!}
              party={party}
              activeMemberId={active?.id ?? null}
              inPlan={inPlanIds.has(r.candidateId)}
              readOnly={finalized}
              excludedTagIds={session.constraints.excludedTags.map((t) => t.id)}
              retrievedAt={(qid) => session.queries[qid]?.retrievedAt ?? null}
              onFeedback={(kind) => active && n.setFeedback(r.candidateId, active.id, kind)}
              onTogglePlan={() => {
                if (inPlanIds.has(r.candidateId)) n.removeFromPlan(r.candidateId);
                else {
                  const out = n.addToPlan(r.candidateId);
                  setNotice(out && !out.ok ? `${out.message} ${out.nextStep}` : null);
                }
              }}
              onExclude={() => n.excludeCandidate(r.candidateId)}
              onExcludeTag={n.excludeTag}
              onDetails={(patch) => n.setDetails(r.candidateId, patch)}
            />
          ))}

          {view.setAside.length > 0 ? (
            <>
              <Text style={[typography.title, styles.ink]} accessibilityRole="header">
                {`Set aside (${view.setAside.length})`}
              </Text>
              {view.setAside.map((r) => {
                const c = session.candidates[r.candidateId]!;
                const undo: { label: string; onPress: () => void }[] = [];
                if (!r.eligibility.eligible) {
                  for (const reason of r.eligibility.reasons) {
                    if (reason.code === 'member_exclusion') {
                      const who =
                        party.members.find((m) => m.id === reason.memberId)?.displayName ?? 'their';
                      undo.push({
                        label: `Clear ${who}’s exclusion: ${c.entity.name}`,
                        onPress: () => n.setFeedback(r.candidateId, reason.memberId, null),
                      });
                    } else if (reason.code === 'group_exclusion') {
                      undo.push({
                        label: `Allow again: ${c.entity.name}`,
                        onPress: () => n.unexcludeCandidate(r.candidateId),
                      });
                    } else if (reason.code === 'excluded_tag') {
                      undo.push({
                        label: `Remove tag rule ${reason.tag.name ?? reason.tag.id}: ${c.entity.name}`,
                        onPress: () => n.includeTag(reason.tag.id),
                      });
                    } else if (reason.code === 'rejected') {
                      undo.push({
                        label: `Consider again: ${c.entity.name}`,
                        onPress: () => n.unreject(r.candidateId),
                      });
                    }
                  }
                }
                return (
                  <SetAsideCard
                    key={r.candidateId}
                    name={c.entity.name}
                    eligibility={r.eligibility}
                    party={party}
                    undo={undo}
                    readOnly={finalized}
                  />
                );
              })}
            </>
          ) : null}
        </>
      ) : null}

      <AddByHand
        targetType={targetType}
        enabled={availability.enabled && !finalized}
        reason={availability.reason}
        onAdd={(entity) => n.addManual(entity)}
        existing={Object.keys(session.candidates)}
      />

      <Card>
        <Text style={[typography.subtitle, styles.ink]} accessibilityRole="header">
          Group rules and plan size
        </Text>
        <Text style={[typography.caption, styles.soft]}>
          Limits apply only to costs and durations you enter yourself. Qloo provides no prices or
          times.
        </Text>
        <TextField
          label="Budget limit (optional)"
          value={budget}
          onChangeText={setBudget}
          placeholder="e.g. 60"
          editable={!finalized}
        />
        <TextField
          label="Total time limit in minutes (optional)"
          value={minutes}
          onChangeText={setMinutes}
          placeholder="e.g. 240"
          editable={!finalized}
        />
        {limitError ? <Text style={[typography.caption, styles.error]}>{limitError}</Text> : null}
        <Button label="Save limits" variant="secondary" onPress={saveLimits} disabled={finalized} />
        {session.constraints.excludedTags.length > 0 ? (
          <View style={styles.stack}>
            <Text style={[typography.caption, styles.soft]}>Excluded tags:</Text>
            <View style={styles.wrap}>
              {session.constraints.excludedTags.map((t) => (
                <ChoiceChip
                  key={t.id}
                  label={`${t.name ?? t.id} (remove)`}
                  accessibilityLabel={`Remove excluded tag ${t.name ?? t.id}`}
                  selected
                  tone="danger"
                  disabled={finalized}
                  onPress={() => n.includeTag(t.id)}
                />
              ))}
            </View>
          </View>
        ) : null}
        <View style={styles.row}>
          <Button
            label="Fewer entries"
            variant="secondary"
            disabled={finalized || session.planLength <= planConfig.minLength}
            onPress={() => n.setPlanLength(session.planLength - 1)}
          />
          <Text
            style={[typography.bodyStrong, styles.ink]}
            accessibilityLabel={`Plan length ${session.planLength}`}
          >
            {`${session.planLength} ${session.planLength === 1 ? 'entry' : 'entries'}`}
          </Text>
          <Button
            label="More entries"
            variant="secondary"
            disabled={finalized || session.planLength >= planConfig.maxLength}
            onPress={() => n.setPlanLength(session.planLength + 1)}
          />
        </View>
      </Card>

      {notice ? <StateMessage kind="unavailable" title="Heads up" message={notice} /> : null}
      <Button
        label={session.plan ? 'Rebuild the plan from current responses' : 'Build the plan'}
        onPress={() => build(false)}
        disabled={finalized || !hasPool}
      />
      {session.plan ? (
        <Button
          label="Open the current plan"
          variant="secondary"
          onPress={() => router.push('/plan')}
        />
      ) : null}
      {!hasPool ? (
        <Text style={[typography.caption, styles.soft]}>
          Planning needs candidates. Nothing is made up: they come from Qloo through the backend, or
          from a Qloo search you add by hand.
        </Text>
      ) : null}

      <Card>
        {confirmReset ? (
          <>
            <Text style={[typography.body, styles.ink]}>
              This clears the gathered suggestions, feedback, limits and plan. Your party and
              profiles stay.
            </Text>
            <Button
              label="Yes, reset the negotiation"
              onPress={() => {
                n.reset();
                setConfirmReset(false);
              }}
            />
            <Button label="Keep it" variant="secondary" onPress={() => setConfirmReset(false)} />
          </>
        ) : (
          <Button
            label="Reset negotiation"
            variant="secondary"
            onPress={() => setConfirmReset(true)}
          />
        )}
      </Card>
      <Button label="Back" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

function AddByHand({
  targetType,
  enabled,
  reason,
  onAdd,
  existing,
}: {
  targetType: string;
  enabled: boolean;
  reason: string | null;
  onAdd: (entity: import('@/types/api').Entity) => void;
  existing: string[];
}) {
  const [text, setText] = useState('');
  const { loading, result, error, search, retry } = useEntitySearch();
  return (
    <Card>
      <Text style={[typography.subtitle, styles.ink]} accessibilityRole="header">
        Add a suggestion you know
      </Text>
      {!enabled ? (
        <Text style={[typography.caption, styles.soft]}>{reason ?? 'Unavailable right now.'}</Text>
      ) : null}
      <TextField
        label="Search Qloo for something to add"
        value={text}
        onChangeText={setText}
        editable={enabled}
        returnKeyType="search"
        onSubmitEditing={() => enabled && search(text, [targetType])}
      />
      <Button
        label="Search to add"
        variant="secondary"
        disabled={!enabled || !text.trim()}
        busy={loading}
        onPress={() => search(text, [targetType])}
      />
      {error ? (
        <>
          <StateMessage kind="error" message={error} />
          <Button label="Try the search again" variant="secondary" onPress={retry} />
        </>
      ) : null}
      {result && result.items.length === 0 ? (
        <StateMessage kind="empty" message="Qloo found nothing for that search." />
      ) : null}
      {result?.items.map((e) => (
        <View key={e.id} style={styles.row}>
          <Text style={[typography.bodyStrong, styles.ink, styles.grow]}>{e.name}</Text>
          <Button
            label={
              existing.includes(e.id)
                ? `Already on the list: ${e.name}`
                : `Add to shortlist: ${e.name}`
            }
            variant="secondary"
            disabled={existing.includes(e.id)}
            onPress={() => onAdd(e)}
          />
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  grow: { flex: 1 },
  ink: { color: colors.ink },
  soft: { color: colors.inkSoft },
  error: { color: colors.coralDeep },
});

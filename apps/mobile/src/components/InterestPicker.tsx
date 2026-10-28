import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useEntitySearch } from '@/hooks/useEntitySearch';
import type { PartyMember } from '@/state/party';
import { validateUnresolvedText } from '@/state/party';
import type { Entity } from '@/types/api';
import { colors, spacing, typography } from '@/theme';
import { entityTypeLabel } from '@/utils/format';
import { Button } from './Button';
import { CategoryChips } from './CategoryChips';
import { Card } from './Card';
import { StateMessage } from './StateMessage';
import { TextField } from './TextField';

interface Props {
  member: PartyMember;
  searchEnabled: boolean;
  searchReason: string | null;
  /** Backend-reported types, or null while unknown/unavailable. */
  types: string[] | null;
  onAdd: (entity: Entity) => void;
  onAddUnresolved: (text: string) => { ok: boolean; error?: string };
  onRefreshStatus: () => void;
  refreshing: boolean;
}

/** Resolves interests through the backend. Typed text is never stored as a Qloo entity. */
export function InterestPicker({
  member,
  searchEnabled,
  searchReason,
  types,
  onAdd,
  onAddUnresolved,
  onRefreshStatus,
  refreshing,
}: Props) {
  const [text, setText] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const { loading, result, error, search, retry } = useEntitySearch();
  const have = new Set(member.interests.map((i) => i.id));
  const canSearch = searchEnabled && text.trim().length > 0 && !loading;
  const run = () => canSearch && search(text, category ? [category] : undefined);

  const saveNote = () => {
    const check = validateUnresolvedText(note);
    if (!check.ok) return setNoteError(check.error);
    const outcome = onAddUnresolved(note);
    setNoteError(outcome.ok ? null : (outcome.error ?? null));
    if (outcome.ok) setNote('');
  };

  return (
    <Card>
      <Text style={[typography.title, styles.ink]} accessibilityRole="header">
        Find an interest
      </Text>

      {!searchEnabled ? (
        <>
          <StateMessage kind="unavailable" message={searchReason ?? 'Search is unavailable.'} />
          <Button
            label="Refresh status"
            variant="secondary"
            onPress={onRefreshStatus}
            busy={refreshing}
          />
        </>
      ) : null}

      {types && types.length > 0 ? (
        <View style={styles.group}>
          <Text style={[typography.caption, styles.soft]}>Narrow by category (optional)</Text>
          <CategoryChips types={types} selected={category} onSelect={setCategory} allowClear />
        </View>
      ) : null}

      <TextField
        label="Search Qloo entities"
        placeholder="An artist, film, book, place..."
        value={text}
        onChangeText={setText}
        editable={searchEnabled}
        maxLength={100}
        returnKeyType="search"
        onSubmitEditing={run}
      />
      <Button label="Search" onPress={run} disabled={!canSearch} busy={loading} />

      {loading ? <StateMessage kind="loading" message="Searching Qloo" /> : null}
      {error ? (
        <>
          <StateMessage kind="error" message={error} />
          <Button label="Try again" variant="secondary" onPress={retry} />
        </>
      ) : null}
      {result?.empty ? (
        <StateMessage
          kind="empty"
          message="Qloo returned no matches for that search. Try a different name or category."
        />
      ) : null}

      {result?.items.map((item) => {
        const added = have.has(item.id);
        return (
          <View key={item.id} style={styles.result}>
            <Text style={[typography.bodyStrong, styles.ink]}>{item.name}</Text>
            <Text style={[typography.caption, styles.soft]}>
              {entityTypeLabel(item.type)}
              {item.release_year ? `, ${item.release_year}` : ''}
            </Text>
            {item.description ? (
              <Text style={[typography.body, styles.soft]} numberOfLines={3}>
                {item.description}
              </Text>
            ) : null}
            <Button
              label={added ? `Added ${item.name}` : `Add ${item.name}`}
              variant="secondary"
              disabled={added}
              onPress={() => onAdd(item)}
              accessibilityHint={`Adds this interest to ${member.displayName}'s profile`}
            />
          </View>
        );
      })}

      {!searchEnabled ? (
        <View style={styles.group}>
          <Text style={[typography.subtitle, styles.ink]}>Note an interest for later</Text>
          <Text style={[typography.body, styles.soft]}>
            Notes are your own words. They are not verified by Qloo and are never used for
            discovery.
          </Text>
          <TextField
            label="Interest note"
            value={note}
            onChangeText={setNote}
            error={noteError}
            maxLength={60}
            onSubmitEditing={saveNote}
          />
          <Button label="Save note" variant="secondary" onPress={saveNote} />
        </View>
      ) : null}

    </Card>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  result: {
    gap: spacing.xs,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  ink: { color: colors.ink },
  soft: { color: colors.inkSoft },
});

import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useEntitySearch } from '@/hooks/useEntitySearch';
import { entityTypeLabel } from '@/utils/format';
import { colors, radii, sizes, spacing, typography } from '@/theme';
import { Button } from './Button';
import { Card } from './Card';
import { StateMessage } from './StateMessage';

interface Props {
  enabled: boolean;
  /** Why search is unavailable; shown only when `enabled` is false. */
  disabledReason: string;
}

/** Functional developer check: every result comes from a real backend request to Qloo. */
export function EntitySearch({ enabled, disabledReason }: Props) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const { loading, result, error, search } = useEntitySearch();
  const canSearch = enabled && text.trim().length > 0;

  return (
    <Card tone="plain">
      <Text style={[typography.title, styles.ink]} accessibilityRole="header">
        Try an entity search
      </Text>
      {enabled ? (
        <Text style={[typography.body, styles.soft]}>
          A real lookup through the backend to Qloo. Results are shown exactly as returned.
        </Text>
      ) : null}

      <TextInput
        accessibilityLabel="Search Qloo entities"
        accessibilityHint="Type a name, then press Search"
        placeholder="An artist, film, book, place..."
        placeholderTextColor={colors.inkSoft}
        value={text}
        onChangeText={setText}
        editable={enabled}
        returnKeyType="search"
        onSubmitEditing={() => canSearch && search(text)}
        maxLength={100}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.input,
          focused && enabled && styles.inputFocused,
          !enabled && styles.inputDisabled,
        ]}
      />
      <Button label="Search" onPress={() => search(text)} disabled={!canSearch} busy={loading} />

      {!enabled ? <StateMessage kind="unavailable" message={disabledReason} /> : null}
      {loading ? <StateMessage kind="loading" message="Searching Qloo" /> : null}
      {error ? <StateMessage kind="error" message={error} /> : null}
      {result && result.empty ? (
        <StateMessage
          kind="empty"
          message="Qloo returned no matches for that search. Try a different name."
        />
      ) : null}

      {result?.items.map((item) => (
        <View key={item.id} style={styles.item} accessible>
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
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: sizes.touchTarget,
    borderRadius: radii.md,
    borderWidth: sizes.borderWidth,
    borderColor: colors.ink,
    backgroundColor: colors.cream,
    paddingHorizontal: spacing.lg,
    color: colors.ink,
    fontFamily: typography.body.fontFamily,
    fontSize: typography.body.fontSize,
  },
  inputFocused: { borderColor: colors.focus, borderWidth: sizes.focusBorderWidth },
  inputDisabled: { borderColor: colors.disabled, backgroundColor: colors.creamDeep },
  item: {
    gap: spacing.xxs,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  ink: { color: colors.ink },
  soft: { color: colors.inkSoft },
});

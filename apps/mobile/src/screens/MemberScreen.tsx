import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { InterestChip } from '@/components/InterestChip';
import { InterestPicker } from '@/components/InterestPicker';
import { MemberAvatar } from '@/components/MemberAvatar';
import { Screen } from '@/components/Screen';
import { StateMessage } from '@/components/StateMessage';
import { TextField } from '@/components/TextField';
import { useBackendStatusModel } from '@/hooks/BackendStatusContext';
import { useEntityTypes } from '@/hooks/useEntityTypes';
import { useParty } from '@/state/PartyContext';
import { colors, spacing, typography } from '@/theme';
import { searchAvailability } from '@/utils/status';

export function MemberScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, actions } = useParty();
  const model = useBackendStatusModel();
  const availability = searchAvailability(model);
  const entityTypes = useEntityTypes(model.backend === 'online');
  const member = state.party?.members.find((m) => m.id === id);
  const [editing, setEditing] = useState(false);
  const [nameText, setNameText] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);

  if (!member) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <StateMessage
          kind="empty"
          title="Profile not found"
          message="This person is no longer in the party."
        />
        <Button label="Back to party" onPress={() => router.back()} />
      </Screen>
    );
  }

  const saveName = () => {
    const result = actions.renameMember(member.id, nameText);
    if (result.ok) {
      setEditing(false);
      setNameError(null);
    } else setNameError(result.error);
  };

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <Card tone="lavender">
        <View style={styles.header}>
          <MemberAvatar name={member.displayName} color={member.avatarColor} />
          <Text style={[typography.title, styles.ink, styles.name]} accessibilityRole="header">
            {member.displayName}
          </Text>
        </View>
        {editing ? (
          <View style={styles.stack}>
            <TextField
              label="Name"
              value={nameText}
              onChangeText={setNameText}
              error={nameError}
              maxLength={40}
              onSubmitEditing={saveName}
            />
            <Button label="Save name" onPress={saveName} />
            <Button
              label="Cancel"
              variant="secondary"
              onPress={() => {
                setEditing(false);
                setNameError(null);
              }}
            />
          </View>
        ) : (
          <Button
            label="Edit name"
            variant="secondary"
            onPress={() => {
              setNameText(member.displayName);
              setEditing(true);
            }}
          />
        )}
      </Card>

      <Card>
        <Text style={[typography.subtitle, styles.ink]} accessibilityRole="header">
          {`${member.displayName}'s interests`}
        </Text>
        {member.interests.length === 0 && member.unresolvedInterests.length === 0 ? (
          <StateMessage
            kind="empty"
            title="No interests yet"
            message="Search below and add things this person loves."
          />
        ) : null}
        <View style={styles.stack}>
          {member.interests.map((i) => (
            <InterestChip
              key={i.id}
              name={i.name}
              type={i.type}
              onRemove={() => actions.removeInterest(member.id, i.id)}
            />
          ))}
          {member.unresolvedInterests.map((u) => (
            <InterestChip
              key={u.id}
              name={u.text}
              unresolved
              onRemove={() => actions.removeUnresolved(member.id, u.id)}
            />
          ))}
        </View>
      </Card>

      <InterestPicker
        member={member}
        searchEnabled={availability.enabled}
        searchReason={availability.reason}
        types={entityTypes.types}
        onAdd={(entity) => actions.addInterest(member.id, entity)}
        onAddUnresolved={(text) => {
          const result = actions.addUnresolved(member.id, text);
          return result.ok ? { ok: true } : { ok: false, error: result.error };
        }}
        onRefreshStatus={model.refresh}
        refreshing={model.refreshing}
      />

      <Button label="Back to party" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { flex: 1 },
  stack: { gap: spacing.sm },
  ink: { color: colors.ink },
});

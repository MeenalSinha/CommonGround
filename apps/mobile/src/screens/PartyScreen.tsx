import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { MemberCard } from '@/components/MemberCard';
import { Screen } from '@/components/Screen';
import { StateMessage } from '@/components/StateMessage';
import { TextField } from '@/components/TextField';
import { useParty } from '@/state/PartyContext';
import { groupInterests, totalInterestCount } from '@/state/party';
import { colors, spacing, typography } from '@/theme';

export function PartyScreen() {
  const router = useRouter();
  const { state, actions } = useParty();
  const { party } = state;
  const [partyName, setPartyName] = useState('');
  const [partyError, setPartyError] = useState<string | null>(null);
  const [memberName, setMemberName] = useState('');
  const [memberError, setMemberError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameText, setRenameText] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  if (!party) {
    const create = () => {
      const result = actions.createParty(partyName);
      setPartyError(result.ok ? null : result.error);
    };
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <Card tone="sky">
          <Text style={[typography.title, styles.ink]} accessibilityRole="header">
            Start your party
          </Text>
          <Text style={[typography.body, styles.ink]}>
            Every great adventure starts with your party. Bring your people together, then show us
            what everyone loves.
          </Text>
          <TextField
            label="Party name"
            value={partyName}
            onChangeText={setPartyName}
            error={partyError}
            maxLength={40}
            onSubmitEditing={create}
          />
          <Button label="Create party" onPress={create} />
        </Card>
      </Screen>
    );
  }

  const people = party.members.length;
  const unique = groupInterests(party).length;
  const total = totalInterestCount(party);
  const canDiscover = people >= 2;

  const addMember = () => {
    const result = actions.addMember(memberName);
    if (result.ok) {
      setMemberName('');
      setMemberError(null);
      setAdded(memberName.replace(/\s+/g, ' ').trim());
    } else {
      setMemberError(result.error);
      setAdded(null);
    }
  };

  const saveRename = () => {
    const result = actions.renameParty(renameText);
    if (result.ok) {
      setRenaming(false);
      setRenameError(null);
    } else setRenameError(result.error);
  };

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <Card tone="sky">
        <Text style={[typography.title, styles.ink]} accessibilityRole="header">
          {party.name}
        </Text>
        <Text style={[typography.body, styles.ink]}>
          {people === 1 ? '1 person' : `${people} people`}
          {' \u00B7 '}
          {total === 1 ? '1 interest' : `${total} interests`}
          {unique !== total ? ` (${unique} unique)` : ''}
        </Text>
        {renaming ? (
          <View style={styles.stack}>
            <TextField
              label="Party name"
              value={renameText}
              onChangeText={setRenameText}
              error={renameError}
              maxLength={40}
              onSubmitEditing={saveRename}
            />
            <Button label="Save name" onPress={saveRename} />
            <Button
              label="Cancel"
              variant="secondary"
              onPress={() => {
                setRenaming(false);
                setRenameError(null);
              }}
            />
          </View>
        ) : (
          <Button
            label="Rename party"
            variant="secondary"
            onPress={() => {
              setRenameText(party.name);
              setRenaming(true);
            }}
          />
        )}
      </Card>

      <Card>
        <Text style={[typography.subtitle, styles.ink]} accessibilityRole="header">
          Add someone to the party
        </Text>
        <TextField
          label="Name"
          value={memberName}
          onChangeText={(t) => {
            setMemberName(t);
            setMemberError(null);
          }}
          error={memberError}
          maxLength={40}
          onSubmitEditing={addMember}
        />
        <Button label="Add to party" onPress={addMember} />
        {added ? <StateMessage kind="success" message={`${added} joined the party.`} /> : null}
      </Card>

      {people === 0 ? (
        <StateMessage
          kind="empty"
          title="No one here yet"
          message="Add the first person above, then open their profile to add what they love."
        />
      ) : (
        party.members.map((member) => (
          <MemberCard
            key={member.id}
            member={member}
            onOpen={() => router.push({ pathname: '/member/[id]', params: { id: member.id } })}
            onRemove={() => actions.removeMember(member.id)}
          />
        ))
      )}

      {!canDiscover ? (
        <StateMessage
          kind="unavailable"
          title="Discovery needs two people"
          message="Add at least two people to the party to discover things together."
        />
      ) : null}
      <Button
        label="Continue to discovery"
        onPress={() => router.push('/discover')}
        disabled={!canDiscover}
      />

      {confirmReset ? (
        <Card tone="coral">
          <Text style={[typography.body, styles.ink]}>
            This removes the party, everyone in it and all their interests.
          </Text>
          <Button
            label="Yes, start over"
            onPress={() => {
              actions.resetParty();
              setConfirmReset(false);
            }}
          />
          <Button label="Keep party" variant="secondary" onPress={() => setConfirmReset(false)} />
        </Card>
      ) : (
        <Button label="Start over" variant="secondary" onPress={() => setConfirmReset(true)} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  ink: { color: colors.ink },
});

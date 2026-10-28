import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { PartyMember } from '@/state/party';
import { colors, spacing, typography } from '@/theme';
import { Button } from './Button';
import { Card } from './Card';
import { InterestChip } from './InterestChip';
import { MemberAvatar } from './MemberAvatar';

interface Props {
  member: PartyMember;
  onOpen: () => void;
  onRemove: () => void;
}

/** Overview card. Removal needs a second, explicit confirmation. */
export function MemberCard({ member, onOpen, onRemove }: Props) {
  const [confirming, setConfirming] = useState(false);
  const count = member.interests.length;
  return (
    <Card>
      <View style={styles.header}>
        <MemberAvatar name={member.displayName} color={member.avatarColor} />
        <View style={styles.name}>
          <Text style={[typography.subtitle, styles.ink]}>{member.displayName}</Text>
          <Text style={[typography.caption, styles.soft]}>
            {count === 1 ? '1 interest' : `${count} interests`}
          </Text>
        </View>
      </View>

      {count === 0 ? (
        <Text style={[typography.body, styles.soft]}>
          No interests yet. Open the profile to search for things they love.
        </Text>
      ) : (
        <View style={styles.chips}>
          {member.interests.map((i) => (
            <InterestChip key={i.id} name={i.name} type={i.type} />
          ))}
        </View>
      )}

      <Button
        label={`Open ${member.displayName}'s profile`}
        variant="secondary"
        onPress={onOpen}
      />
      {confirming ? (
        <View style={styles.chips}>
          <Button label={`Confirm remove ${member.displayName}`} onPress={onRemove} />
          <Button label="Keep" variant="secondary" onPress={() => setConfirming(false)} />
        </View>
      ) : (
        <Button
          label={`Remove ${member.displayName}`}
          variant="secondary"
          onPress={() => setConfirming(true)}
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { flex: 1 },
  chips: { gap: spacing.sm },
  ink: { color: colors.ink },
  soft: { color: colors.inkSoft },
});

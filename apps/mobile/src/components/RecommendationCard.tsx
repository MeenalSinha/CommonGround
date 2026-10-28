import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { Entity } from '@/types/api';
import { colors, radii, sizes, spacing, typography } from '@/theme';
import { entityTypeLabel } from '@/utils/format';
import { Card } from './Card';

/** Renders only what Qloo returned. Missing fields are omitted, never filled in. */
export function RecommendationCard({ item }: { item: Entity }) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(item.image_url) && !imageFailed;
  return (
    <Card>
      {showImage ? (
        <Image
          source={{ uri: item.image_url ?? undefined }}
          accessibilityIgnoresInvertColors
          accessible={false}
          onError={() => setImageFailed(true)}
          style={styles.image}
        />
      ) : null}
      <View style={styles.text}>
        <Text style={[typography.subtitle, styles.ink]}>{item.name}</Text>
        <Text style={[typography.caption, styles.soft]}>
          {entityTypeLabel(item.type)}
          {item.release_year ? `, ${item.release_year}` : ''}
        </Text>
        {item.description ? (
          <Text style={[typography.body, styles.soft]} numberOfLines={4}>
            {item.description}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: sizes.avatar * 3,
    borderRadius: radii.md,
    backgroundColor: colors.creamDeep,
  },
  text: { gap: spacing.xs },
  ink: { color: colors.ink },
  soft: { color: colors.inkSoft },
});

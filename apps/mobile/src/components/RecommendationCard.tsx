import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { Entity } from '@/types/api';
import { colors, radii, sizes, spacing, typography } from '@/theme';
import { entityTypeLabel } from '@/utils/format';
import { Card } from './Card';
import { entityIcon } from './InterestChip';

/** Renders only what Qloo returned. Missing fields are omitted, never filled in. */
export function RecommendationCard({ item }: { item: Entity }) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(item.image_url) && !imageFailed;
  const icon = entityIcon(item.type);
  const typeLabel = entityTypeLabel(item.type);

  return (
    <Card>
      <View style={styles.topBadgeRow}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryBadgeText}>
            {icon} {typeLabel}
          </Text>
        </View>
        {item.popularity ? (
          <View style={styles.popularityBadge}>
            <Text style={styles.popularityText}>★ {Math.round(item.popularity * 100)}% Match</Text>
          </View>
        ) : null}
      </View>
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
          {typeLabel}
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
  topBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  categoryBadge: {
    backgroundColor: colors.creamDeep,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xxs + 1,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  categoryBadgeText: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 12,
    color: colors.ink,
    fontWeight: '700',
  },
  popularityBadge: {
    backgroundColor: colors.yellow,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xxs + 1,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.yellowDeep,
  },
  popularityText: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 12,
    color: colors.yellowDeep,
    fontWeight: '800',
  },
  image: {
    width: '100%',
    height: sizes.avatar * 3,
    borderRadius: radii.md,
    backgroundColor: colors.creamDeep,
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: { gap: spacing.xs },
  ink: { color: colors.ink },
  soft: { color: colors.inkSoft },
});

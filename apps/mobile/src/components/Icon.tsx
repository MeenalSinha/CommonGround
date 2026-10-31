import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { colors } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  style?: object;
}

export function Icon({ name, size = 18, color = colors.ink, style }: Props) {
  return <Ionicons name={name} size={size} color={color} style={style} />;
}

/**
 * Maps entity type / category identifiers to a crisp vector icon name.
 */
export function getEntityTypeIconName(type: string): IconName {
  const lower = type.toLowerCase();
  if (lower.includes('movie') || lower.includes('film')) return 'film-outline';
  if (
    lower.includes('music') ||
    lower.includes('artist') ||
    lower.includes('album') ||
    lower.includes('song')
  )
    return 'musical-notes-outline';
  if (lower.includes('place') || lower.includes('venue') || lower.includes('location'))
    return 'location-outline';
  if (lower.includes('book') || lower.includes('author') || lower.includes('literature'))
    return 'book-outline';
  if (lower.includes('dining') || lower.includes('restaurant') || lower.includes('food'))
    return 'restaurant-outline';
  if (lower.includes('game') || lower.includes('videogame')) return 'game-controller-outline';
  if (lower.includes('podcast')) return 'mic-outline';
  if (lower.includes('brand')) return 'pricetag-outline';
  return 'sparkles-outline';
}

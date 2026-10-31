import { createElement } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '@/theme';

export type IconName =
  | 'film'
  | 'film-outline'
  | 'music'
  | 'musical-notes-outline'
  | 'place'
  | 'location-outline'
  | 'book'
  | 'book-outline'
  | 'dining'
  | 'restaurant-outline'
  | 'game'
  | 'game-controller-outline'
  | 'podcast'
  | 'mic-outline'
  | 'tag'
  | 'pricetag-outline'
  | 'sparkles'
  | 'sparkles-outline'
  | 'star'
  | 'people'
  | 'people-outline'
  | 'search'
  | 'search-outline'
  | 'compass'
  | 'compass-outline'
  | 'map'
  | 'map-outline'
  | 'time'
  | 'time-outline'
  | 'alert'
  | 'alert-circle-outline'
  | 'check'
  | 'checkmark-circle-outline'
  | 'shield';

interface Props {
  name: IconName | string;
  size?: number;
  color?: string;
  fill?: string;
  style?: StyleProp<ViewStyle>;
}

// Crisp Lucide / Feather vector SVG paths (24x24 viewBox)
const ICON_PATHS: Record<string, string> = {
  // Film / Movies
  film: '<rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/>',
  'film-outline':
    '<rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/>',

  // Music / Artists
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  'musical-notes-outline':
    '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',

  // Place / Location
  place:
    '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  'location-outline':
    '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',

  // Book / Literature
  book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  'book-outline':
    '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',

  // Dining / Food
  dining:
    '<path d="M18 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2"/><line x1="15" y1="11" x2="15" y2="22"/><path d="M6 2v20"/><path d="M6 2c2 0 4 2 4 5s-2 5-4 5"/>',
  'restaurant-outline':
    '<path d="M18 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2"/><line x1="15" y1="11" x2="15" y2="22"/><path d="M6 2v20"/><path d="M6 2c2 0 4 2 4 5s-2 5-4 5"/>',

  // Games
  game: '<rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/>',
  'game-controller-outline':
    '<rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/>',

  // Podcasts / Audio
  podcast:
    '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>',
  'mic-outline':
    '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>',

  // Tag
  tag: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
  'pricetag-outline':
    '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',

  // Sparkles
  sparkles:
    '<path d="M12 3l1.912 5.886a2 2 0 0 0 1.272 1.272L21 12l-5.886 1.912a2 2 0 0 0-1.272 1.272L12 21l-1.912-5.886a2 2 0 0 0-1.272-1.272L3 12l5.886-1.912a2 2 0 0 0 1.272-1.272L12 3z"/>',
  'sparkles-outline':
    '<path d="M12 3l1.912 5.886a2 2 0 0 0 1.272 1.272L21 12l-5.886 1.912a2 2 0 0 0-1.272 1.272L12 21l-1.912-5.886a2 2 0 0 0-1.272-1.272L3 12l5.886-1.912a2 2 0 0 0 1.272-1.272L12 3z"/>',

  // Star
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',

  // People / Party
  people:
    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  'people-outline':
    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',

  // Search
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  'search-outline': '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',

  // Compass
  compass:
    '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
  'compass-outline':
    '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',

  // Map
  map: '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>',
  'map-outline':
    '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>',

  // Time / Clock
  time: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  'time-outline': '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',

  // Alert
  alert:
    '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  'alert-circle-outline':
    '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',

  // Check
  check: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  'checkmark-circle-outline':
    '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',

  // Shield
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
};

export function Icon({
  name,
  size = 18,
  color = colors.ink,
  fill = name === 'star' ? color : 'none',
  style,
}: Props) {
  const innerSvg = ICON_PATHS[name] ?? ICON_PATHS['sparkles-outline']!;

  if (Platform.OS === 'web') {
    return createElement(
      'span',
      {
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size,
          height: size,
          flexShrink: 0,
        },
      },
      createElement('svg', {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill,
        stroke: color,
        strokeWidth: '2',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        dangerouslySetInnerHTML: { __html: innerSvg },
      }),
    );
  }

  // Non-web / test fallback
  return <View style={[{ width: size, height: size }, style]} testID={`icon-${name}`} />;
}

/**
 * Maps entity type / category identifiers to a crisp vector icon name.
 */
export function getEntityTypeIconName(type: string): IconName {
  const lower = type.toLowerCase();
  if (lower.includes('movie') || lower.includes('film')) return 'film';
  if (
    lower.includes('music') ||
    lower.includes('artist') ||
    lower.includes('album') ||
    lower.includes('song')
  )
    return 'music';
  if (lower.includes('place') || lower.includes('venue') || lower.includes('location'))
    return 'place';
  if (lower.includes('book') || lower.includes('author') || lower.includes('literature'))
    return 'book';
  if (lower.includes('dining') || lower.includes('restaurant') || lower.includes('food'))
    return 'dining';
  if (lower.includes('game') || lower.includes('videogame')) return 'game';
  if (lower.includes('podcast')) return 'podcast';
  if (lower.includes('brand')) return 'tag';
  return 'sparkles';
}

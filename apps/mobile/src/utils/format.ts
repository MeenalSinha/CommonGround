/** "urn:entity:tv_show" -> "Tv show". Presentation only; the raw URN is preserved elsewhere. */
export function entityTypeLabel(urn: string | null): string {
  if (!urn) return 'Unknown type';
  const last = urn.split(':').pop() ?? urn;
  const spaced = last.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function formatTime(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleTimeString();
}

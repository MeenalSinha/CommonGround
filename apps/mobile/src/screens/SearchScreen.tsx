import { EntitySearch } from '@/components/EntitySearch';
import { Screen } from '@/components/Screen';
import { useBackendStatusModel } from '@/hooks/BackendStatusContext';
import { searchAvailability } from '@/utils/status';

export function SearchScreen() {
  const availability = searchAvailability(useBackendStatusModel());
  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <EntitySearch enabled={availability.enabled} disabledReason={availability.reason ?? ''} />
    </Screen>
  );
}

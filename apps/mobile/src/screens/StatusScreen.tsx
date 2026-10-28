import { ConnectionPanel } from '@/components/ConnectionPanel';
import { Screen } from '@/components/Screen';
import { useBackendStatusModel } from '@/hooks/BackendStatusContext';

export function StatusScreen() {
  const model = useBackendStatusModel();
  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <ConnectionPanel model={model} />
    </Screen>
  );
}

import { act, render, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Text } from 'react-native';
import { PartyProvider, useParty, type PartyActions } from '@/state/PartyContext';
import { persistence as cfg } from '@/state/negotiation/config';
import { memoryStorage, pickPersisted, serialize, type SessionStorage } from '@/state/persistence';
import { NOW, gen, planIds, threeFriends } from '@/testing/negotiationFixtures';

let captured: PartyActions | null = null;

function Probe() {
  const { state, persistence, actions } = useParty();
  useEffect(() => {
    captured = actions;
  }, [actions]);
  return (
    <>
      <Text>{`status:${persistence.status}`}</Text>
      <Text>{`party:${state.party?.name ?? 'none'}`}</Text>
      <Text>{`members:${state.party?.members.length ?? 0}`}</Text>
      <Text>{`plan:${state.negotiation?.plan?.entries.length ?? 0}`}</Text>
      <Text>{`notice:${persistence.notice ?? 'none'}`}</Text>
      <Text>{`error:${persistence.error ?? 'none'}`}</Text>
    </>
  );
}
const mount = (storage: SessionStorage | null) =>
  render(
    <PartyProvider storage={storage} persistDebounceMs={0}>
      <Probe />
    </PartyProvider>,
  );

const saved = () => serialize(pickPersisted(gen(threeFriends())), NOW);

describe('PartyProvider persistence', () => {
  it('does not report ready until the saved session has been read, then shows the restored data', async () => {
    let release: (v: string | null) => void = () => undefined;
    const storage: SessionStorage = {
      getItem: () => new Promise((r) => (release = r)),
      setItem: async () => undefined,
      removeItem: async () => undefined,
    };
    await mount(storage);
    expect(screen.getByText('status:restoring')).toBeTruthy();
    expect(screen.getByText('party:none')).toBeTruthy();
    await act(async () => release(saved()));
    expect(await screen.findByText('status:ready')).toBeTruthy();
    expect(screen.getByText('party:Test party')).toBeTruthy();
    expect(screen.getByText('members:3')).toBeTruthy();
    expect(screen.getByText('plan:3')).toBeTruthy();
  });

  it('starts fresh with a calm notice for corrupt data, keeping a backup copy', async () => {
    const storage = memoryStorage({ [cfg.storageKey]: '{oops' });
    await mount(storage);
    expect(await screen.findByText('status:ready')).toBeTruthy();
    expect(screen.getByText('party:none')).toBeTruthy();
    expect(screen.getByText(/notice:We couldn’t restore your saved party/)).toBeTruthy();
    expect(storage.dump()[cfg.backupKey]).toBe('{oops');
  });

  it('is ready with an error message when storage cannot be read', async () => {
    const storage: SessionStorage = {
      getItem: () => Promise.reject(new Error('disk')),
      setItem: async () => undefined,
      removeItem: async () => undefined,
    };
    await mount(storage);
    expect(await screen.findByText('status:ready')).toBeTruthy();
    expect(screen.getByText(/error:Saved data could not be read/)).toBeTruthy();
  });

  it('saves changes and restores them in a fresh provider (same storage), without duplicating anything', async () => {
    const storage = memoryStorage();
    const first = await mount(storage);
    await screen.findByText('status:ready');
    await act(async () => {
      captured!.createParty('Friday crew');
      captured!.addMember('Ann');
    });
    await waitFor(() => expect(storage.dump()[cfg.storageKey]).toBeDefined());
    await first.unmount();

    await mount(storage);
    expect(await screen.findByText('party:Friday crew')).toBeTruthy();
    expect(screen.getByText('members:1')).toBeTruthy();
    // Restoring again changes nothing and adds nothing.
    await act(async () => undefined);
    expect(screen.getByText('members:1')).toBeTruthy();
  });

  it('keeps plan order across a restart', async () => {
    const before = planIds(gen(threeFriends()));
    const storage = memoryStorage({ [cfg.storageKey]: saved() });
    await mount(storage);
    await screen.findByText('plan:3');
    const raw = JSON.parse(storage.dump()[cfg.storageKey]!);
    expect(
      raw.data.negotiation.plan.entries.map((e: { candidateId: string }) => e.candidateId),
    ).toEqual(before);
  });

  it('startOver clears the party, the plan and the saved copy', async () => {
    const storage = memoryStorage({ [cfg.storageKey]: saved() });
    await mount(storage);
    await screen.findByText('plan:3');
    await act(async () => {
      await captured!.startOver();
    });
    expect(screen.getByText('party:none')).toBeTruthy();
    expect(screen.getByText('plan:0')).toBeTruthy();
    await waitFor(() => expect(storage.dump()[cfg.storageKey]).toBeUndefined());
  });

  it('never overwrites a good save with an empty state before the restore finishes', async () => {
    const storage = memoryStorage({ [cfg.storageKey]: saved() });
    const spy = jest.spyOn(storage, 'setItem');
    const remove = jest.spyOn(storage, 'removeItem');
    await mount(storage);
    await screen.findByText('plan:3');
    expect(remove).not.toHaveBeenCalled();
    for (const [, value] of spy.mock.calls) expect(JSON.parse(value).data.party).not.toBeNull();
  });

  it('without storage it is ready immediately and saves nothing', async () => {
    await mount(null);
    expect(screen.getByText('status:ready')).toBeTruthy();
  });

  it('a save failure surfaces as a visible error, and the in-memory state keeps working', async () => {
    const storage = memoryStorage();
    storage.setItem = () => Promise.reject(new Error('quota'));
    await mount(storage);
    await screen.findByText('status:ready');
    await act(async () => {
      captured!.createParty('Crew');
      await new Promise((r) => setTimeout(r, 30)); // let the failing save settle inside act
    });
    expect(screen.getByText(/error:Your latest changes could not be saved/)).toBeTruthy();
    expect(screen.getByText('party:Crew')).toBeTruthy();
  });
});

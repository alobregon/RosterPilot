import { describe, expect, it } from 'vitest';
import { parseDraftSnapshot, serializeDraftSnapshot } from '../lib/persistence';
import type { DraftConfig } from '../lib/types';

const config: DraftConfig = {
  teamCount: 10,
  userDraftSlot: 7,
  scoringFormat: 'HALF_PPR',
  qbStarters: 1,
  rbStarters: 2,
  wrStarters: 3,
  teStarters: 1,
  flexStarters: 1,
  dstStarters: 1,
  kStarters: 1,
  benchSpots: 6,
  draftStrategy: 'BALANCED',
  draftMode: 'SIMULATOR',
  simulationRoomProfile: 'RB_RUSH',
  simulationPace: 'WATCH',
};

describe('interactive simulator persistence', () => {
  it('round trips mode, room behavior, and pace', () => {
    const parsed = parseDraftSnapshot(serializeDraftSnapshot({
      config,
      players: [],
      picks: [],
      draftStarted: false,
      savedAt: new Date('2026-08-26T18:00:00-05:00'),
    }));

    expect(parsed?.config.draftMode).toBe('SIMULATOR');
    expect(parsed?.config.simulationRoomProfile).toBe('RB_RUSH');
    expect(parsed?.config.simulationPace).toBe('WATCH');
  });
});

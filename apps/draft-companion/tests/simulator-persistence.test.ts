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
  simulationSeed: 'mock-run-123',
};

describe('interactive simulator persistence', () => {
  it('round trips mode, room behavior, pace, and the per-mock seed', () => {
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
    expect(parsed?.config.simulationSeed).toBe('mock-run-123');
  });

  it('rejects a malformed simulator seed in a backup', () => {
    const raw = JSON.parse(serializeDraftSnapshot({
      config,
      players: [],
      picks: [],
      draftStarted: false,
      savedAt: new Date('2026-08-26T18:00:00-05:00'),
    })) as { config: Record<string, unknown> };
    raw.config.simulationSeed = { invalid: true };

    expect(parseDraftSnapshot(JSON.stringify(raw))).toBeNull();
  });
});
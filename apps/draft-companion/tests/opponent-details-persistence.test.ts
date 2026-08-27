import { describe, expect, it } from 'vitest';
import { parseDraftSnapshot, serializeDraftSnapshot } from '../lib/persistence';
import type { DraftConfig } from '../lib/types';

const baseConfig: DraftConfig = {
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
};

describe('opponent details preference persistence', () => {
  it('preserves the disabled preference while retaining saved assignments', () => {
    const config: DraftConfig = { ...baseConfig, opponentDetailsEnabled: false };
    const raw = serializeDraftSnapshot({
      config,
      players: [],
      picks: [],
      teamNames: ['Dildo Year', '', '', '', '', '', '', '', '', ''],
      managerIds: ['dixie', '', '', '', '', '', '', '', '', ''],
      draftStarted: false,
      savedAt: new Date('2026-08-26T18:00:00-05:00'),
    });

    const parsed = parseDraftSnapshot(raw);
    expect(parsed?.config.opponentDetailsEnabled).toBe(false);
    expect(parsed?.teamNames[0]).toBe('Dildo Year');
    expect(parsed?.managerIds[0]).toBe('dixie');
  });

  it('preserves the enabled preference', () => {
    const config: DraftConfig = { ...baseConfig, opponentDetailsEnabled: true };
    const parsed = parseDraftSnapshot(serializeDraftSnapshot({ config, players: [], picks: [], draftStarted: false }));
    expect(parsed?.config.opponentDetailsEnabled).toBe(true);
  });
});

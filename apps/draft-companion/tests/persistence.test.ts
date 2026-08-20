import { describe, expect, it } from 'vitest';
import { parseDraftSnapshot, serializeDraftSnapshot } from '../lib/persistence';
import type { DraftConfig, DraftPick, PlayerRanking } from '../lib/types';

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
};
const players: PlayerRanking[] = [
  { id: 'wr-dal', name: 'Example WR', position: 'WR', nflTeam: 'DAL', overallRank: 9, byeWeek: 14 },
];
const picks: DraftPick[] = [
  { overallPick: 7, round: 1, pickInRound: 7, draftSlot: 7, playerId: 'wr-dal' },
];

describe('draft persistence', () => {
  it('round trips a normalized draft snapshot', () => {
    const raw = serializeDraftSnapshot({ config, players, picks, savedAt: new Date('2026-08-19T22:00:00-05:00') });
    const parsed = parseDraftSnapshot(raw);
    expect(parsed?.config).toEqual(config);
    expect(parsed?.players).toEqual(players);
    expect(parsed?.picks).toEqual(picks);
  });

  it('rejects corrupt JSON and unsupported versions', () => {
    expect(parseDraftSnapshot('{bad json')).toBeNull();
    expect(parseDraftSnapshot(JSON.stringify({ version: 999 }))).toBeNull();
  });

  it('rejects picks referencing players not present in the saved pool', () => {
    const raw = serializeDraftSnapshot({ config, players, picks, savedAt: new Date() });
    const broken = JSON.parse(raw);
    broken.picks[0].playerId = 'missing';
    expect(parseDraftSnapshot(JSON.stringify(broken))).toBeNull();
  });
});

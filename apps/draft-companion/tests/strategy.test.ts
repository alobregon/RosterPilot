import { describe, expect, it } from 'vitest';
import { recommendPlayers } from '../lib/recommendation';
import { defaultStrategyForDraftSlot } from '../lib/strategy';
import type { DraftConfig, PlayerRanking } from '../lib/types';

const base: DraftConfig = {
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
};

const equalPlayers: PlayerRanking[] = [
  { id: 'rb', name: 'RB', position: 'RB', overallRank: 20, tier: 2 },
  { id: 'wr', name: 'WR', position: 'WR', overallRank: 20, tier: 2 },
  { id: 'qb', name: 'QB', position: 'QB', overallRank: 20, tier: 2 },
  { id: 'te', name: 'TE', position: 'TE', overallRank: 20, tier: 2 },
];

describe('draft strategies', () => {
  it('uses Hero RB as the opening preference from slots 1 or 2', () => {
    expect(defaultStrategyForDraftSlot(1)).toBe('HERO_RB');
    expect(defaultStrategyForDraftSlot(2)).toBe('HERO_RB');
    expect(defaultStrategyForDraftSlot(3)).toBe('BALANCED');
    expect(defaultStrategyForDraftSlot(10)).toBe('BALANCED');
  });

  it('Zero RB favors WR over an equivalent RB in early rounds', () => {
    const result = recommendPlayers({ players: equalPlayers, picks: [], config: { ...base, draftStrategy: 'ZERO_RB' }, currentOverallPick: 7, limit: 4 });
    expect(result[0].player.position).toBe('WR');
    expect(result.find((item) => item.player.position === 'WR')?.breakdown.strategyFit).toBe(100);
    expect(result.find((item) => item.player.position === 'RB')?.breakdown.strategyFit).toBe(10);
  });

  it('Robust RB favors RB before three RBs are rostered', () => {
    const result = recommendPlayers({ players: equalPlayers, picks: [], config: { ...base, draftStrategy: 'ROBUST_RB' }, currentOverallPick: 7, limit: 4 });
    expect(result[0].player.position).toBe('RB');
  });

  it('Late QB heavily suppresses QB before round seven', () => {
    const result = recommendPlayers({ players: equalPlayers, picks: [], config: { ...base, draftStrategy: 'LATE_QB' }, currentOverallPick: 27, limit: 4 });
    const qb = result.find((item) => item.player.position === 'QB');
    expect(qb?.breakdown.strategyFit).toBe(5);
    expect(result[0].player.position).not.toBe('QB');
  });

  it('Upside Heavy uses imported provider upside metadata', () => {
    const players: PlayerRanking[] = [
      { id: 'safe', name: 'Safe', position: 'WR', overallRank: 40, tier: 4, sourceMetadata: { upsideRating: 2 } },
      { id: 'upside', name: 'Upside', position: 'WR', overallRank: 40, tier: 4, sourceMetadata: { upsideRating: 5 } },
    ];
    const result = recommendPlayers({ players, picks: [], config: { ...base, draftStrategy: 'UPSIDE_HEAVY' }, currentOverallPick: 34, limit: 2 });
    expect(result[0].player.id).toBe('upside');
    expect(result[0].breakdown.strategyFit).toBe(100);
  });
});

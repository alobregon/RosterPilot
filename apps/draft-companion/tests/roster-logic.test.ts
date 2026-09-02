import { describe, expect, it } from 'vitest';
import { recommendPlayers } from '../lib/recommendation';
import type { DraftConfig, DraftPick, PlayerRanking } from '../lib/types';

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
  draftStrategy: 'BALANCED',
};

function userPick(overallPick: number, playerId: string): DraftPick {
  return { overallPick, round: 1, pickInRound: 1, draftSlot: 7, playerId };
}

describe('roster construction', () => {
  it('does not count FLEX as open until base RB/WR/TE starters are filled', () => {
    const roster: PlayerRanking[] = [
      { id: 'wr1', name: 'WR1', position: 'WR', overallRank: 1 },
      { id: 'wr2', name: 'WR2', position: 'WR', overallRank: 2 },
      { id: 'wr3', name: 'WR3', position: 'WR', overallRank: 3 },
      { id: 'rb1', name: 'RB1', position: 'RB', overallRank: 4 },
      { id: 'te1', name: 'TE1', position: 'TE', overallRank: 5 },
      { id: 'rb2', name: 'Candidate RB', position: 'RB', overallRank: 30, tier: 3 },
      { id: 'te2', name: 'Candidate TE', position: 'TE', overallRank: 30, tier: 3 },
    ];
    const picks = roster.slice(0, 5).map((player, index) => userPick(index + 1, player.id));
    const result = recommendPlayers({ players: roster, picks, config: base, currentOverallPick: 27, limit: 4 });
    const rb = result.find((item) => item.player.id === 'rb2');
    const te = result.find((item) => item.player.id === 'te2');
    expect(rb?.breakdown.rosterFit).toBe(100);
    expect(te?.breakdown.rosterFit).toBe(35);
  });

  it('forces missing required lineup positions when roster slots run out', () => {
    const roster: PlayerRanking[] = [
      { id: 'qb', name: 'QB', position: 'QB', overallRank: 1 },
      { id: 'rb1', name: 'RB1', position: 'RB', overallRank: 2 },
      { id: 'rb2', name: 'RB2', position: 'RB', overallRank: 3 },
      { id: 'rb3', name: 'RB3', position: 'RB', overallRank: 4 },
      { id: 'rb4', name: 'RB4', position: 'RB', overallRank: 5 },
      { id: 'wr1', name: 'WR1', position: 'WR', overallRank: 6 },
      { id: 'wr2', name: 'WR2', position: 'WR', overallRank: 7 },
      { id: 'wr3', name: 'WR3', position: 'WR', overallRank: 8 },
      { id: 'wr4', name: 'WR4', position: 'WR', overallRank: 9 },
      { id: 'wr5', name: 'WR5', position: 'WR', overallRank: 10 },
      { id: 'wr6', name: 'WR6', position: 'WR', overallRank: 11 },
      { id: 'te', name: 'TE', position: 'TE', overallRank: 12 },
      { id: 'bench-rb', name: 'Bench RB', position: 'RB', overallRank: 13 },
      { id: 'bench-wr', name: 'Bench WR', position: 'WR', overallRank: 14 },
      { id: 'dst1', name: 'DST1', position: 'DST', overallRank: 181, tier: 8 },
      { id: 'dst2', name: 'DST2', position: 'DST', overallRank: 189, tier: 8 },
      { id: 'k1', name: 'K1', position: 'K', overallRank: 210, tier: 8 },
      { id: 'k2', name: 'K2', position: 'K', overallRank: 212, tier: 8 },
    ];
    const picks = roster.slice(0, 14).map((player, index) => userPick(index + 1, player.id));
    const result = recommendPlayers({ players: roster, picks, config: base, currentOverallPick: 147, limit: 4 });
    expect(result.every((item) => item.player.position === 'DST' || item.player.position === 'K')).toBe(true);
  });

  it('does not give scarcity credit to a worse tier while a better tier remains', () => {
    const players: PlayerRanking[] = [
      { id: 'k1', name: 'K1', position: 'K', overallRank: 210, tier: 8 },
      { id: 'k18', name: 'K18', position: 'K', overallRank: 315, tier: 10 },
    ];
    const result = recommendPlayers({ players, picks: [], config: { ...base, kStarters: 1, dstStarters: 0, benchSpots: 0, qbStarters: 0, rbStarters: 0, wrStarters: 0, teStarters: 0, flexStarters: 0 }, currentOverallPick: 1, limit: 2 });
    expect(result[0].player.id).toBe('k1');
    expect(result[0].breakdown.tierUrgency).toBeGreaterThan(result[1].breakdown.tierUrgency);
  });
});

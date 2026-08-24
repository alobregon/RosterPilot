import { describe, expect, it } from 'vitest';
import { survivalProbabilityForPlayer } from '../lib/survival';
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

function player(id: string, position: PlayerRanking['position'], rank: number, adp?: number): PlayerRanking {
  return { id, name: id, position, overallRank: rank, adp };
}

describe('calibrated survival probability', () => {
  it('returns a stable calibrated probability inside the validated domain', () => {
    const target = player('target-rb', 'RB', 8, 8);
    const result = survivalProbabilityForPlayer({
      player: target,
      players: [target, player('wr', 'WR', 9, 9), player('te', 'TE', 10, 10)],
      picks: [],
      config,
      currentOverallPick: 7,
    });

    expect(result).not.toBeNull();
    expect(result?.returnPick).toBe(14);
    expect(result?.interveningPicks).toBe(6);
    expect(result?.probability).toBeCloseTo(0.32855, 4);
  });

  it('raises survival probability when intervening opponents have already filled the position', () => {
    const target = player('target-rb', 'RB', 8, 8);
    const rosterPlayers = [
      player('rb8a', 'RB', 101, 101), player('rb8b', 'RB', 102, 102),
      player('rb9a', 'RB', 103, 103), player('rb9b', 'RB', 104, 104),
      player('rb10a', 'RB', 105, 105), player('rb10b', 'RB', 106, 106),
    ];
    const picks: DraftPick[] = [
      { overallPick: 8, round: 1, pickInRound: 8, draftSlot: 8, playerId: 'rb8a' },
      { overallPick: 13, round: 2, pickInRound: 3, draftSlot: 8, playerId: 'rb8b' },
      { overallPick: 9, round: 1, pickInRound: 9, draftSlot: 9, playerId: 'rb9a' },
      { overallPick: 12, round: 2, pickInRound: 2, draftSlot: 9, playerId: 'rb9b' },
      { overallPick: 10, round: 1, pickInRound: 10, draftSlot: 10, playerId: 'rb10a' },
      { overallPick: 11, round: 2, pickInRound: 1, draftSlot: 10, playerId: 'rb10b' },
    ];
    const empty = survivalProbabilityForPlayer({
      player: target,
      players: [target, ...rosterPlayers],
      picks: [],
      config,
      currentOverallPick: 27,
    });
    const filled = survivalProbabilityForPlayer({
      player: target,
      players: [target, ...rosterPlayers],
      picks,
      config,
      currentOverallPick: 27,
    });

    expect(empty).not.toBeNull();
    expect(filled).not.toBeNull();
    expect(filled!.probability).toBeGreaterThan(empty!.probability);
    expect(filled!.probability).toBeGreaterThan(0.5);
  });

  it('does not extrapolate without ADP, for K/DST, or beyond the validated top-20 market pool', () => {
    const noAdp = player('no-adp', 'WR', 1);
    expect(survivalProbabilityForPlayer({ player: noAdp, players: [noAdp], picks: [], config, currentOverallPick: 7 })).toBeNull();

    const kicker = player('kicker', 'K', 1, 1);
    expect(survivalProbabilityForPlayer({ player: kicker, players: [kicker], picks: [], config, currentOverallPick: 7 })).toBeNull();

    const players = Array.from({ length: 21 }, (_, index) => player(`p${index + 1}`, 'WR', index + 1, index + 1));
    const outside = players[20];
    expect(survivalProbabilityForPlayer({ player: outside, players, picks: [], config, currentOverallPick: 7 })).toBeNull();
  });
});

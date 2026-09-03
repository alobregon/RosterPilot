import { describe, expect, it } from 'vitest';
import {
  canCompleteStartingRosterAfterPick,
  hasLegalStartingRoster,
  minimumStarterPicksRequired,
  simulateDraft,
  simulateNextOpponentPick,
} from '../lib/simulation';
import type { DraftConfig, DraftPick, PlayerRanking, Position } from '../lib/types';

const config: DraftConfig = {
  teamCount: 4,
  userDraftSlot: 2,
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
  simulationSeed: 'feasibility-test',
};

function player(id: string, position: Position, rank: number): PlayerRanking {
  return { id, name: id, position, overallRank: rank, adp: rank };
}

function fakePick(overallPick: number, draftSlot: number, playerId: string): DraftPick {
  return { overallPick, round: 1, pickInRound: 1, draftSlot, playerId };
}

function counts(roster: PlayerRanking[]): Record<Position, number> {
  return roster.reduce<Record<Position, number>>((result, item) => {
    result[item.position] += 1;
    return result;
  }, { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 });
}

describe('simulator opponent roster feasibility', () => {
  it('counts fixed starters, FLEX, DST, and K in the minimum completion requirement', () => {
    const roster = [
      player('qb', 'QB', 1),
      player('rb1', 'RB', 2),
      player('rb2', 'RB', 3),
      player('wr1', 'WR', 4),
      player('wr2', 'WR', 5),
      player('wr3', 'WR', 6),
      player('te', 'TE', 7),
    ];
    expect(minimumStarterPicksRequired(roster, config)).toBe(3); // FLEX + DST + K
    expect(canCompleteStartingRosterAfterPick(roster, player('depth-wr', 'WR', 8), config)).toBe(true);
  });

  it('forces a missing final-position player even when that player is far outside the market window', () => {
    const roster = [
      player('qb', 'QB', 1),
      player('rb1', 'RB', 2), player('rb2', 'RB', 3), player('rb3', 'RB', 4), player('rb4', 'RB', 5),
      player('wr1', 'WR', 6), player('wr2', 'WR', 7), player('wr3', 'WR', 8), player('wr4', 'WR', 9), player('wr5', 'WR', 10),
      player('te1', 'TE', 11), player('te2', 'TE', 12),
      player('dst', 'DST', 13),
      player('depth1', 'WR', 14), player('depth2', 'RB', 15),
    ];
    const market = Array.from({ length: 35 }, (_, index) => player(`market-${index + 1}`, index % 2 ? 'WR' : 'RB', index + 1));
    const kicker = player('required-k', 'K', 250);
    const players = [...roster, ...market, kicker];
    const picks = roster.map((item, index) => fakePick(index + 1, 1, item.id));

    const result = simulateNextOpponentPick({
      players,
      picks,
      config,
      currentOverallPick: 64,
      roomProfile: 'RANK_ORDER',
      managerIds: ['Dixie', '', '', ''],
    });

    expect(result.find((pick) => pick.overallPick === 64)?.playerId).toBe('required-k');
  });

  it('allows only a required position when two picks remain and DST plus K are still missing', () => {
    const roster = [
      player('qb', 'QB', 1),
      player('rb1', 'RB', 2), player('rb2', 'RB', 3), player('rb3', 'RB', 4),
      player('wr1', 'WR', 5), player('wr2', 'WR', 6), player('wr3', 'WR', 7), player('wr4', 'WR', 8), player('wr5', 'WR', 9),
      player('te1', 'TE', 10), player('te2', 'TE', 11),
      player('qb2', 'QB', 12), player('rb4', 'RB', 13), player('wr6', 'WR', 14),
    ];
    const players = [
      ...roster,
      player('tempting-qb3', 'QB', 15),
      player('tempting-wr', 'WR', 16),
      player('needed-dst', 'DST', 180),
      player('needed-k', 'K', 200),
    ];
    const picks = roster.map((item, index) => fakePick(index + 1, 1, item.id));

    const result = simulateNextOpponentPick({
      players,
      picks,
      config,
      currentOverallPick: 57,
      roomProfile: 'RANK_ORDER',
      managerIds: ['Dixie', '', '', ''],
    });
    const selected = result.find((pick) => pick.overallPick === 57)?.playerId;
    expect(['needed-dst', 'needed-k']).toContain(selected);
  });

  it('finishes every personalized opponent roster legally across multiple seeds', () => {
    const positions: Position[] = ['RB', 'WR', 'RB', 'WR', 'TE', 'QB', 'WR', 'RB', 'TE', 'QB', 'DST', 'K'];
    const players = Array.from({ length: 240 }, (_, index) =>
      player(`p-${index + 1}`, positions[index % positions.length], index + 1),
    );
    const managers = ['Alex', 'Alvaro Obregon', 'Armando', 'Dixie'];

    for (const seed of ['legal-a', 'legal-b', 'legal-c', 'legal-d']) {
      const result = simulateDraft({
        players,
        config: { ...config, simulationSeed: seed },
        roomProfile: 'RANK_ORDER',
        managerIds: managers,
      });
      expect(result.completed).toBe(true);
      for (const slot of [1, 3, 4]) {
        const roster = result.picks
          .filter((pick) => pick.draftSlot === slot)
          .map((pick) => players.find((item) => item.id === pick.playerId)!)
          .filter(Boolean);
        expect(roster).toHaveLength(16);
        expect(hasLegalStartingRoster(counts(roster), config)).toBe(true);
      }
    }
  });
});

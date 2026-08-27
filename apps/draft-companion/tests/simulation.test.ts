import { describe, expect, it } from 'vitest';
import {
  autoDraftOpponentsUntilUserTurn,
  hasLegalStartingRoster,
  historicalRosterConstructionBias,
  historicalSequencePositionProbability,
  simulateDeterministicDraft,
  simulateNextOpponentPick,
} from '../lib/simulation';
import { draftPickAtOverall } from '../lib/corrections';
import type { DraftConfig, PlayerRanking, Position } from '../lib/types';

const config: DraftConfig = {
  teamCount: 4,
  userDraftSlot: 2,
  scoringFormat: 'HALF_PPR',
  qbStarters: 1,
  rbStarters: 1,
  wrStarters: 1,
  teStarters: 1,
  flexStarters: 1,
  dstStarters: 1,
  kStarters: 1,
  benchSpots: 1,
  draftStrategy: 'BALANCED',
};

const tenTeamConfig: DraftConfig = {
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

function syntheticPool(): PlayerRanking[] {
  const positions: Position[] = ['RB', 'WR', 'QB', 'TE', 'RB', 'WR', 'RB', 'WR', 'TE', 'QB', 'DST', 'K'];
  const players: PlayerRanking[] = [];
  for (let rank = 1; rank <= 80; rank += 1) {
    const position = positions[(rank - 1) % positions.length];
    players.push({ id: `p-${rank}`, name: `Player ${rank}`, position, overallRank: rank, tier: Math.ceil(rank / 8) });
  }
  return players;
}

describe('full draft simulation harness', () => {
  it('completes a draft and preserves a legal user starting roster', () => {
    const result = simulateDeterministicDraft({ players: syntheticPool(), config });
    expect(result.picks).toHaveLength(32);
    expect(result.userPlayerIds).toHaveLength(8);
    expect(hasLegalStartingRoster(result.userCounts, config)).toBe(true);
  });

  it('keeps every displayed recommendation set normalized to 100 percent', () => {
    const result = simulateDeterministicDraft({ players: syntheticPool(), config });
    for (const snapshot of result.userRecommendations) {
      expect(snapshot.recommendations.reduce((sum, recommendation) => sum + recommendation.recommendationPercent, 0)).toBe(100);
    }
  });
});

describe('interactive draft simulator', () => {
  it('advances one opponent pick without ever auto-picking the user slot', () => {
    const players = syntheticPool();
    const first = simulateNextOpponentPick({ players, picks: [], config, currentOverallPick: 1 });
    expect(first).toHaveLength(1);
    expect(first[0].overallPick).toBe(1);

    const stopped = simulateNextOpponentPick({ players, picks: first, config, currentOverallPick: 2 });
    expect(stopped).toEqual(first);
  });

  it('fills opponents only until the next user turn across a snake turn', () => {
    const players = syntheticPool();
    const picks = [
      draftPickAtOverall(1, 'p-1', 4),
      draftPickAtOverall(2, 'p-2', 4),
    ];
    const result = autoDraftOpponentsUntilUserTurn({
      players,
      picks,
      config,
      currentOverallPick: 3,
      roomProfile: 'RANK_ORDER',
    });

    expect(result.map((pick) => pick.overallPick)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(result.some((pick) => pick.overallPick === 7)).toBe(false);
  });

  it('supports alternate room profiles for opponent picks', () => {
    const players = syntheticPool();
    const result = simulateNextOpponentPick({
      players,
      picks: [],
      config,
      currentOverallPick: 1,
      roomProfile: 'QB_RUSH',
    });
    const selected = players.find((player) => player.id === result[0]?.playerId);
    expect(selected?.position).toBe('QB');
  });

  it('uses an assigned manager history to break close ranking decisions', () => {
    const players: PlayerRanking[] = [
      { id: 'wr-1', name: 'Top WR', position: 'WR', overallRank: 1, adp: 1 },
      { id: 'te-2', name: 'Close TE', position: 'TE', overallRank: 2, adp: 2 },
      { id: 'rb-3', name: 'Close RB', position: 'RB', overallRank: 3, adp: 3 },
      { id: 'qb-4', name: 'Close QB', position: 'QB', overallRank: 4, adp: 4 },
    ];

    const neutral = simulateNextOpponentPick({
      players,
      picks: [],
      config,
      currentOverallPick: 1,
      roomProfile: 'RANK_ORDER',
    });
    expect(neutral[0]?.playerId).toBe('wr-1');

    const armando = simulateNextOpponentPick({
      players,
      picks: [],
      config,
      currentOverallPick: 1,
      roomProfile: 'RANK_ORDER',
      managerIds: ['Armando', '', '', ''],
    });
    expect(armando[0]?.playerId).toBe('te-2');
  });

  it('uses a dedicated recency-weighted Round 1 tendency for Sunny-D', () => {
    const rb = historicalSequencePositionProbability({
      managerId: 'Sunny-DCommissioner',
      position: 'RB',
      round: 1,
      priorPositions: [],
    });
    const wr = historicalSequencePositionProbability({
      managerId: 'Sunny-DCommissioner',
      position: 'WR',
      round: 1,
      priorPositions: [],
    });

    expect(rb).toBeCloseTo(0.588, 3);
    expect(wr).toBeCloseTo(0.412, 3);
  });

  it('keeps the 2026 market board dominant for Sunny-D at pick five', () => {
    const players: PlayerRanking[] = [
      { id: 'jahmyr-gibbs-rb-det', name: 'Jahmyr Gibbs', position: 'RB', overallRank: 1, adp: 1 },
      { id: 'bijan-robinson-rb-atl', name: 'Bijan Robinson', position: 'RB', overallRank: 2, adp: 2 },
      { id: 'ja-marr-chase-wr-cin', name: "Ja'Marr Chase", position: 'WR', overallRank: 3, adp: 3 },
      { id: 'puka-nacua-wr-lar', name: 'Puka Nacua', position: 'WR', overallRank: 4, adp: 4 },
      { id: 'jaxon-smith-njigba-wr-sea', name: 'Jaxon Smith-Njigba', position: 'WR', overallRank: 5, adp: 7 },
      { id: 'jonathan-taylor-rb-ind', name: 'Jonathan Taylor', position: 'RB', overallRank: 6, adp: 6 },
      { id: 'christian-mccaffrey-rb-sf', name: 'Christian McCaffrey', position: 'RB', overallRank: 7, adp: 5 },
      { id: 'amon-ra-st-brown-wr-det', name: 'Amon-Ra St. Brown', position: 'WR', overallRank: 8, adp: 8 },
    ];
    const picks = [
      draftPickAtOverall(1, 'jahmyr-gibbs-rb-det', 10),
      draftPickAtOverall(2, 'bijan-robinson-rb-atl', 10),
      draftPickAtOverall(3, 'ja-marr-chase-wr-cin', 10),
      draftPickAtOverall(4, 'jonathan-taylor-rb-ind', 10),
    ];
    const managerIds = ['', '', '', '', 'Sunny-DCommissioner', '', '', '', '', ''];

    const result = simulateNextOpponentPick({
      players,
      picks,
      config: tenTeamConfig,
      currentOverallPick: 5,
      roomProfile: 'RANK_ORDER',
      managerIds,
    });

    expect(result.find((pick) => pick.overallPick === 5)?.playerId).toBe('puka-nacua-wr-lar');
  });

  it('caps Round 1 history so Dixie does not routinely jump three market slots for RB', () => {
    const players: PlayerRanking[] = [
      { id: 'jahmyr-gibbs-rb-det', name: 'Jahmyr Gibbs', position: 'RB', overallRank: 1, adp: 1 },
      { id: 'bijan-robinson-rb-atl', name: 'Bijan Robinson', position: 'RB', overallRank: 2, adp: 2 },
      { id: 'ja-marr-chase-wr-cin', name: "Ja'Marr Chase", position: 'WR', overallRank: 3, adp: 3 },
      { id: 'puka-nacua-wr-lar', name: 'Puka Nacua', position: 'WR', overallRank: 4, adp: 4 },
      { id: 'jaxon-smith-njigba-wr-sea', name: 'Jaxon Smith-Njigba', position: 'WR', overallRank: 5, adp: 7 },
      { id: 'jonathan-taylor-rb-ind', name: 'Jonathan Taylor', position: 'RB', overallRank: 6, adp: 6 },
      { id: 'christian-mccaffrey-rb-sf', name: 'Christian McCaffrey', position: 'RB', overallRank: 7, adp: 5 },
    ];
    const picks = [
      draftPickAtOverall(1, 'jahmyr-gibbs-rb-det', 10),
      draftPickAtOverall(2, 'bijan-robinson-rb-atl', 10),
      draftPickAtOverall(3, 'jonathan-taylor-rb-ind', 10),
    ];
    const managerIds = ['', '', '', 'Dixie', '', '', '', '', '', ''];

    const result = simulateNextOpponentPick({
      players,
      picks,
      config: { ...tenTeamConfig, simulationSeed: 'dixie-market-regression' },
      currentOverallPick: 4,
      roomProfile: 'RANK_ORDER',
      managerIds,
    });

    expect(result.find((pick) => pick.overallPick === 4)?.playerId).toBe('ja-marr-chase-wr-cin');
  });

  it('keeps one mock stable while allowing different seeds to change close picks', () => {
    const players: PlayerRanking[] = [
      { id: 'top-wr', name: 'Top WR', position: 'WR', overallRank: 1, adp: 1 },
      { id: 'close-rb', name: 'Close RB', position: 'RB', overallRank: 2, adp: 2 },
    ];
    const managerIds = ['Sunny-DCommissioner', '', '', '', '', '', '', '', '', ''];

    const run = (simulationSeed: string) =>
      simulateNextOpponentPick({
        players,
        picks: [],
        config: { ...tenTeamConfig, simulationSeed },
        currentOverallPick: 1,
        roomProfile: 'RANK_ORDER',
        managerIds,
      })[0]?.playerId;

    expect(run('seed-0')).toBe('top-wr');
    expect(run('seed-0')).toBe('top-wr');
    expect(run('seed-1')).toBe('close-rb');
  });

  it('conditions Sunny-D early-round tendencies on an RB-RB start', () => {
    const rbAfterOne = historicalSequencePositionProbability({
      managerId: 'Sunny-DCommissioner',
      position: 'RB',
      round: 2,
      priorPositions: ['RB'],
    });
    const rbAfterTwo = historicalSequencePositionProbability({
      managerId: 'Sunny-DCommissioner',
      position: 'RB',
      round: 3,
      priorPositions: ['RB', 'RB'],
    });
    const wrAfterTwo = historicalSequencePositionProbability({
      managerId: 'Sunny-DCommissioner',
      position: 'WR',
      round: 3,
      priorPositions: ['RB', 'RB'],
    });

    expect(rbAfterOne).toBeCloseTo(0.651, 3);
    expect(rbAfterTwo).toBeCloseTo(0.268, 3);
    expect(wrAfterTwo).toBeCloseTo(0.546, 3);
    expect(wrAfterTwo ?? 0).toBeGreaterThan(rbAfterTwo ?? 0);
  });

  it('nudges an RB-heavy roster toward the manager historical roster shape', () => {
    const roster: PlayerRanking[] = [
      { id: 'rb-a', name: 'RB A', position: 'RB', overallRank: 1 },
      { id: 'rb-b', name: 'RB B', position: 'RB', overallRank: 2 },
      { id: 'rb-c', name: 'RB C', position: 'RB', overallRank: 3 },
      { id: 'rb-d', name: 'RB D', position: 'RB', overallRank: 4 },
      { id: 'wr-a', name: 'WR A', position: 'WR', overallRank: 5 },
    ];

    const wrBias = historicalRosterConstructionBias({
      managerId: 'Hansel',
      position: 'WR',
      roster,
      config,
    });
    const rbBias = historicalRosterConstructionBias({
      managerId: 'Hansel',
      position: 'RB',
      roster,
      config,
    });

    expect(wrBias).not.toBeNull();
    expect(rbBias).not.toBeNull();
    expect(wrBias ?? 0).toBeGreaterThan(0);
    expect(rbBias ?? 0).toBeLessThan(0);
    expect(wrBias ?? 0).toBeGreaterThan(rbBias ?? 0);
  });

  it('uses the sequence-aware history to avoid blindly extending an RB-RB start', () => {
    const players: PlayerRanking[] = [
      { id: 'sun-rb1', name: 'Sunny RB 1', position: 'RB', overallRank: 20, adp: 20 },
      { id: 'other-2', name: 'Other 2', position: 'WR', overallRank: 21, adp: 21 },
      { id: 'other-3', name: 'Other 3', position: 'WR', overallRank: 22, adp: 22 },
      { id: 'other-4', name: 'Other 4', position: 'WR', overallRank: 23, adp: 23 },
      { id: 'other-5', name: 'Other 5', position: 'WR', overallRank: 24, adp: 24 },
      { id: 'other-6', name: 'Other 6', position: 'WR', overallRank: 25, adp: 25 },
      { id: 'other-7', name: 'Other 7', position: 'WR', overallRank: 26, adp: 26 },
      { id: 'sun-rb2', name: 'Sunny RB 2', position: 'RB', overallRank: 27, adp: 27 },
      { id: 'rb-next', name: 'Best Remaining RB', position: 'RB', overallRank: 28, adp: 28 },
      { id: 'wr-next', name: 'Close Remaining WR', position: 'WR', overallRank: 29, adp: 29 },
      { id: 'te-next', name: 'Close Remaining TE', position: 'TE', overallRank: 30, adp: 30 },
    ];
    const picks = Array.from({ length: 8 }, (_, index) => {
      const overallPick = index + 1;
      const playerId = overallPick === 1 ? 'sun-rb1' : overallPick === 8 ? 'sun-rb2' : `other-${overallPick}`;
      return draftPickAtOverall(overallPick, playerId, 4);
    });

    const result = simulateNextOpponentPick({
      players,
      picks,
      config,
      currentOverallPick: 9,
      roomProfile: 'RANK_ORDER',
      managerIds: ['Sunny-DCommissioner', '', '', ''],
    });

    expect(result.find((pick) => pick.overallPick === 9)?.playerId).toBe('wr-next');
  });
});
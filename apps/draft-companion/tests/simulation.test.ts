import { describe, expect, it } from 'vitest';
import {
  autoDraftOpponentsUntilUserTurn,
  hasLegalStartingRoster,
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
});

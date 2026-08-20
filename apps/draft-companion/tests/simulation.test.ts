import { describe, expect, it } from 'vitest';
import { hasLegalStartingRoster, simulateDeterministicDraft } from '../lib/simulation';
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

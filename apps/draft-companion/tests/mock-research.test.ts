import { describe, expect, it } from 'vitest';
import { simulateDecisionEngineMock } from '../lib/mock-research';
import type { DraftConfig, PlayerRanking } from '../lib/types';

const config: DraftConfig = {
  teamCount: 2,
  userDraftSlot: 1,
  scoringFormat: 'HALF_PPR',
  qbStarters: 1,
  rbStarters: 1,
  wrStarters: 1,
  teStarters: 0,
  flexStarters: 0,
  dstStarters: 0,
  kStarters: 0,
  benchSpots: 1,
  draftStrategy: 'BALANCED',
};

const players: PlayerRanking[] = [
  { id: 'alpha-rb', name: 'Alpha Runner', position: 'RB', overallRank: 1, adp: 1, tier: 1 },
  { id: 'bravo-wr', name: 'Bravo Receiver', position: 'WR', overallRank: 2, adp: 2, tier: 1 },
  { id: 'charlie-qb', name: 'Charlie Passer', position: 'QB', overallRank: 3, adp: 3, tier: 1 },
  { id: 'delta-rb', name: 'Delta Runner', position: 'RB', overallRank: 4, adp: 4, tier: 2 },
  { id: 'echo-wr', name: 'Echo Receiver', position: 'WR', overallRank: 5, adp: 5, tier: 2 },
  { id: 'foxtrot-qb', name: 'Foxtrot Passer', position: 'QB', overallRank: 6, adp: 6, tier: 2 },
  { id: 'golf-rb', name: 'Golf Runner', position: 'RB', overallRank: 7, adp: 7, tier: 3 },
  { id: 'hotel-wr', name: 'Hotel Receiver', position: 'WR', overallRank: 8, adp: 8, tier: 3 },
  { id: 'india-qb', name: 'India Passer', position: 'QB', overallRank: 9, adp: 9, tier: 3 },
  { id: 'juliet-wr', name: 'Juliet Receiver', position: 'WR', overallRank: 10, adp: 10, tier: 4 },
];

describe('mock research harness', () => {
  it('drives the live decision path through a complete legal simulated draft', () => {
    const result = simulateDecisionEngineMock({
      players,
      config,
      seed: 'synthetic-mock-research',
      roomProfile: 'RANK_ORDER',
    });

    expect(result.completed).toBe(true);
    expect(result.legalStartingRoster).toBe(true);
    expect(result.userPlayerIds).toHaveLength(4);
    expect(result.decisions).toHaveLength(4);
    expect(result.decisions.every((decision) => Number.isFinite(decision.topRecommendationStrength))).toBe(true);
    expect(result.userCounts.QB).toBeGreaterThanOrEqual(1);
    expect(result.userCounts.RB).toBeGreaterThanOrEqual(1);
    expect(result.userCounts.WR).toBeGreaterThanOrEqual(1);
  });
});

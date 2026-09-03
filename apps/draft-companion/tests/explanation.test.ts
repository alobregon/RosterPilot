import { afterEach, describe, expect, it } from 'vitest';
import { POST } from '../app/api/recommendations/explain/route';
import { recommendForCurrentPick } from '../lib/decision';
import {
  buildRecommendationNarrativeRequest,
  mergeAiRecommendationNarratives,
} from '../lib/explanation';
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
  { id: 'jsn', name: 'Jaxon Smith-Njigba', position: 'WR', nflTeam: 'SEA', overallRank: 7, tier: 1 },
  { id: 'saquon', name: 'Saquon Barkley', position: 'RB', nflTeam: 'PHI', overallRank: 14, tier: 2 },
  { id: 'devonta', name: 'DeVonta Smith', position: 'WR', nflTeam: 'PHI', overallRank: 27, tier: 3 },
  { id: 'other-wr', name: 'Other WR', position: 'WR', overallRank: 28, tier: 3 },
  { id: 'other-rb', name: 'Other RB', position: 'RB', overallRank: 29, tier: 3 },
];
const picks: DraftPick[] = [
  { overallPick: 7, round: 1, pickInRound: 7, draftSlot: 7, playerId: 'jsn' },
  { overallPick: 14, round: 2, pickInRound: 4, draftSlot: 7, playerId: 'saquon' },
];

afterEach(() => {
  delete process.env.OPENAI_API_KEY;
});

describe('grounded recommendation explanations', () => {
  it('produces the desired decisive DeVonta-style fallback from curated evidence and roster state', () => {
    const recommendations = recommendForCurrentPick({
      players,
      picks,
      config,
      currentOverallPick: 27,
      limit: 3,
    });

    const devonta = recommendations[0];
    expect(devonta.player.id).toBe('devonta');
    expect(devonta.analysis?.verdict).toBe('This is my pick.');
    expect(devonta.analysis?.why).toContain('A.J. Brown is no longer in Philadelphia');
    expect(devonta.analysis?.why).toContain('right in range at pick #27');
    expect(devonta.analysis?.rosterImpact).toBe(
      'Pairing Jaxon Smith-Njigba + DeVonta Smith gives you two strong WRs while Saquon Barkley anchors RB.',
    );
    expect(devonta.analysis?.evidence.some((evidence) => evidence.publisher === 'ESPN')).toBe(true);
    expect(devonta.analysis?.source).toBe('RULES');
  });

  it('builds a bounded model request and only accepts cited evidence IDs when merging', () => {
    const recommendations = recommendForCurrentPick({ players, picks, config, currentOverallPick: 27, limit: 3 });
    const roster = players.filter((player) => player.id === 'jsn' || player.id === 'saquon');
    const request = buildRecommendationNarrativeRequest({
      recommendations,
      roster,
      config,
      currentOverallPick: 27,
    });
    const allowedId = request.recommendations[0].evidence[0].id;
    const merged = mergeAiRecommendationNarratives(recommendations, [{
      playerId: 'devonta',
      verdict: 'This is my pick.',
      why: 'Grounded enhanced explanation.',
      rosterImpact: 'Grounded enhanced roster impact.',
      caution: null,
      evidenceIds: [allowedId, 'invented:evidence'],
    }]);

    expect(request.recommendations).toHaveLength(3);
    expect(request.recommendations[0].isTopPick).toBe(true);
    expect(merged[0].analysis?.source).toBe('OPENAI');
    expect(merged[0].analysis?.evidenceIds).toEqual([allowedId]);
    expect(merged[1].analysis?.source).toBe('RULES');
  });

  it('keeps the API optional and returns the local fallback path when no key is configured', async () => {
    const recommendations = recommendForCurrentPick({ players, picks, config, currentOverallPick: 27, limit: 3 });
    const payload = buildRecommendationNarrativeRequest({
      recommendations,
      roster: players.filter((player) => player.id === 'jsn' || player.id === 'saquon'),
      config,
      currentOverallPick: 27,
    });
    const response = await POST(new Request('http://localhost/api/recommendations/explain', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ enabled: false, narratives: [] });
  });
});

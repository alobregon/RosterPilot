import { describe, expect, it } from 'vitest';
import { parseRankingRows } from '../lib/spreadsheet';

describe('ranking spreadsheet importer', () => {
  it('imports FantasyPros combined position/rank values and provider metadata', () => {
    const result = parseRankingRows([
      {
        RK: 1,
        TIERS: 1,
        'PLAYER NAME': 'J. Example',
        TEAM: 'DET',
        POS: 'RB1',
        BYE: 6,
        'UPSIDE ': '5 out of 5',
        'BUST ': '1 out of 5',
        SOS: '4 out of 5 stars',
        'ECR VS ADP': 2,
        'AVG. DIFF ': '+1.9',
        '% OVER ': '50% (8/16)',
      },
    ]);

    expect(result.detectedSource).toBe('FantasyPros');
    expect(result.warnings).toEqual([]);
    expect(result.players).toHaveLength(1);
    expect(result.players[0]).toMatchObject({
      name: 'J. Example',
      position: 'RB',
      positionRank: 1,
      overallRank: 1,
      tier: 1,
      nflTeam: 'DET',
      byeWeek: 6,
      sourceMetadata: {
        provider: 'FantasyPros',
        upsideRating: 5,
        bustRating: 1,
        strengthOfScheduleRating: 4,
        ecrVsAdp: 2,
        averageDifference: 1.9,
        percentOverConsensus: 50,
        percentOverCount: 8,
        percentOverTotal: 16,
      },
    });
  });

  it('continues to support plain position values from custom sheets', () => {
    const result = parseRankingRows([
      { Rank: 12, Player: 'Custom Player', Position: 'WR', Team: 'SEA', Tier: 3 },
    ]);

    expect(result.players[0]).toMatchObject({
      name: 'Custom Player',
      position: 'WR',
      overallRank: 12,
      tier: 3,
    });
  });

  it('normalizes common defense position formats', () => {
    const result = parseRankingRows([
      { Rank: 100, Player: 'Example Defense', Position: 'D/ST1' },
    ]);

    expect(result.players[0].position).toBe('DST');
    expect(result.players[0].positionRank).toBe(1);
  });
});

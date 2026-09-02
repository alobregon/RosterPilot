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
      id: 'j-example-rb-det',
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

  it('keeps abbreviated-name collisions when the players are on different teams', () => {
    const result = parseRankingRows([
      { RK: 7, TIERS: 1, 'PLAYER NAME': 'J. Taylor', TEAM: 'IND', POS: 'RB5' },
      { RK: 383, TIERS: 14, 'PLAYER NAME': 'J. Taylor', TEAM: 'JAC', POS: 'RB116' },
    ]);

    expect(result.warnings).toEqual([]);
    expect(result.players).toHaveLength(2);
    expect(new Set(result.players.map((player) => player.id)).size).toBe(2);
    expect(result.players.map((player) => player.id)).toEqual([
      'j-taylor-rb-ind',
      'j-taylor-rb-jac',
    ]);
  });

  it('still rejects an exact name, position, and team duplicate', () => {
    const result = parseRankingRows([
      { Rank: 12, Player: 'Duplicate Player', Position: 'WR', Team: 'SEA' },
      { Rank: 13, Player: 'Duplicate Player', Position: 'WR', Team: 'SEA' },
    ]);

    expect(result.players).toHaveLength(1);
    expect(result.warnings).toHaveLength(1);
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

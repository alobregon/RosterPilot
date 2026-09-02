import { describe, expect, it } from 'vitest';
import {
  buildFantasyProsNewsDiagnostic,
  buildFantasyProsProjectionDiagnostic,
  isFantasyProsNewsCategory,
  isFantasyProsProjectionPosition,
  parseFantasyProsPlayerIds,
} from '../lib/fantasypros';

describe('FantasyPros projection diagnostics', () => {
  it('detects a response whose declared count exceeds the returned players', () => {
    const diagnostic = buildFantasyProsProjectionDiagnostic({
      season: 2026,
      week: 0,
      count: 194,
      positions: 'WR',
      scoring: 'STD',
      players: [
        {
          fpid: 123,
          name: 'Example Receiver',
          position_id: 'WR',
          team_id: 'DET',
          stats: [
            {
              points: 200.5,
              points_half: 245.5,
              points_ppr: 290.5,
              rec: 90,
              rec_yds: 1200,
            },
          ],
        },
        {
          fpid: 456,
          name: 'Second Receiver',
          position_id: 'WR',
          team_id: 'DAL',
          stats: [{ points_half: 230.1 }],
        },
      ],
    });

    expect(diagnostic.declaredCount).toBe(194);
    expect(diagnostic.receivedPlayerCount).toBe(2);
    expect(diagnostic.appearsTruncated).toBe(true);
    expect(diagnostic.playerKeys).toContain('fpid');
    expect(diagnostic.statKeys).toEqual(expect.arrayContaining(['points_half', 'rec', 'rec_yds']));
    expect(diagnostic.samplePlayers[0]).toEqual({
      fpid: 123,
      name: 'Example Receiver',
      position: 'WR',
      team: 'DET',
      projectedPoints: 200.5,
      projectedHalfPprPoints: 245.5,
      projectedPprPoints: 290.5,
    });
  });

  it('does not label a complete response as truncated', () => {
    const diagnostic = buildFantasyProsProjectionDiagnostic({
      count: '1',
      players: [{ name: 'One Player', stats: [] }],
    });

    expect(diagnostic.declaredCount).toBe(1);
    expect(diagnostic.receivedPlayerCount).toBe(1);
    expect(diagnostic.appearsTruncated).toBe(false);
  });

  it('accepts only supported NFL projection positions', () => {
    expect(isFantasyProsProjectionPosition('QB')).toBe(true);
    expect(isFantasyProsProjectionPosition('DST')).toBe(true);
    expect(isFantasyProsProjectionPosition('ALL')).toBe(false);
    expect(isFantasyProsProjectionPosition('')).toBe(false);
  });

  it('parses and deduplicates targeted FantasyPros player IDs', () => {
    expect(parseFantasyProsPlayerIds('19799:23180,19799')).toEqual([19799, 23180]);
    expect(parseFantasyProsPlayerIds(null)).toEqual([]);
    expect(() => parseFantasyProsPlayerIds('19799:nope')).toThrow('positive integers');
    expect(() => parseFantasyProsPlayerIds('1:2:3:4:5:6:7:8:9:10:11')).toThrow('At most 10');
  });
});

describe('FantasyPros news diagnostics', () => {
  it('reports available news text and impact fields without returning the full payload', () => {
    const diagnostic = buildFantasyProsNewsDiagnostic({
      sport: 'NFL',
      count: 2,
      public_api_limited: false,
      items: [
        {
          id: 1234,
          created: '2026-08-20 12:00:00',
          player_id: 999,
          team_id: 'LAC',
          title: 'Example receiver gets a larger role',
          categories: ['News', 'Transaction'],
          link: 'https://example.com/news/1234',
          desc: 'The receiver moved up the depth chart.<br><strong>More context</strong>',
          impact: 'This could increase his target opportunity.',
        },
        {
          id: 1235,
          player_id: 1000,
          title: 'Second item',
          desc: 'Another update.',
        },
      ],
    });

    expect(diagnostic.declaredCount).toBe(2);
    expect(diagnostic.receivedItemCount).toBe(2);
    expect(diagnostic.appearsTruncated).toBe(false);
    expect(diagnostic.publicApiLimited).toBe(false);
    expect(diagnostic.itemKeys).toEqual(expect.arrayContaining(['desc', 'impact', 'player_id', 'title']));
    expect(diagnostic.hasDescriptionContent).toBe(true);
    expect(diagnostic.hasImpactContent).toBe(true);
    expect(diagnostic.sampleItems[0]).toEqual({
      id: 1234,
      playerId: 999,
      team: 'LAC',
      title: 'Example receiver gets a larger role',
      created: '2026-08-20 12:00:00',
      categories: ['News', 'Transaction'],
      link: 'https://example.com/news/1234',
      descriptionSnippet: 'The receiver moved up the depth chart. More context',
      impactSnippet: 'This could increase his target opportunity.',
    });
  });

  it('accepts only documented news categories', () => {
    expect(isFantasyProsNewsCategory('transaction')).toBe(true);
    expect(isFantasyProsNewsCategory('injury')).toBe(true);
    expect(isFantasyProsNewsCategory('breaking')).toBe(true);
    expect(isFantasyProsNewsCategory('offseason')).toBe(false);
    expect(isFantasyProsNewsCategory('')).toBe(false);
  });
});

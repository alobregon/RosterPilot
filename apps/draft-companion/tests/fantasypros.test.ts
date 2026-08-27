import { describe, expect, it } from 'vitest';
import {
  buildFantasyProsProjectionDiagnostic,
  isFantasyProsProjectionPosition,
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
});

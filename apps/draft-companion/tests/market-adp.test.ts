import { describe, expect, it } from 'vitest';
import { deriveAdpFromEcrDifference, parseRankingRows } from '../lib/spreadsheet';

describe('FantasyPros market ADP fallback', () => {
  it('derives approximate ADP as ECR plus ECR-vs-ADP', () => {
    expect(deriveAdpFromEcrDifference(8, -3)).toBe(5);
    expect(deriveAdpFromEcrDifference(13, 6)).toBe(19);
  });

  it('uses a derived ADP only when explicit ADP is absent', () => {
    const derived = parseRankingRows([{ RK: 27, TIERS: 3, 'PLAYER NAME': 'J. Allen', TEAM: 'BUF', POS: 'QB1', 'ECR VS ADP': -7 }]).players[0];
    expect(derived.adp).toBe(20); expect(derived.sourceMetadata?.adpSource).toBe('DERIVED_ECR_VS_ADP');
    const explicit = parseRankingRows([{ RK: 27, TIERS: 3, 'PLAYER NAME': 'J. Allen', TEAM: 'BUF', POS: 'QB1', ADP: 22, 'ECR VS ADP': -7 }]).players[0];
    expect(explicit.adp).toBe(22); expect(explicit.sourceMetadata?.adpSource).toBe('EXPLICIT');
  });
});

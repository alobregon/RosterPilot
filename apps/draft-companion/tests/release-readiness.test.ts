import { describe, expect, it } from 'vitest';
import { draftPickAtOverall } from '../lib/corrections';
import { parseDraftSnapshot, serializeDraftSnapshot } from '../lib/persistence';
import { validateRankingPool } from '../lib/preflight';
import { deriveDraftSession } from '../lib/session';
import { simulateDraft } from '../lib/simulation';
import { buildPositionTrends } from '../lib/trends';
import type { DraftConfig, PlayerRanking } from '../lib/types';

const config: DraftConfig = { teamCount: 10, userDraftSlot: 7, scoringFormat: 'HALF_PPR', qbStarters: 1, rbStarters: 2, wrStarters: 3, teStarters: 1, flexStarters: 1, dstStarters: 1, kStarters: 1, benchSpots: 6, draftStrategy: 'BALANCED' };

function syntheticPool(count = 200): PlayerRanking[] {
  return Array.from({ length: count }, (_, index) => {
    const rank = index + 1; const mod = rank % 12;
    const position = mod === 0 ? 'QB' : mod === 1 ? 'TE' : mod === 2 ? 'DST' : mod === 3 ? 'K' : mod < 8 ? 'WR' : 'RB';
    return { id: `p-${rank}`, name: `Player ${rank}`, position, overallRank: rank, tier: Math.ceil(rank / 20) } as PlayerRanking;
  });
}

describe('release readiness', () => {
  it('blocks an undersized pool before a 160-pick draft', () => {
    expect(validateRankingPool(syntheticPool(100), config).valid).toBe(false);
    expect(validateRankingPool(syntheticPool(200), config).valid).toBe(true);
  });

  it('resumes at the earliest correction gap', () => {
    const picks = [draftPickAtOverall(1, 'p-1', 10), draftPickAtOverall(3, 'p-3', 10)];
    const state = deriveDraftSession(picks, config, true);
    expect(state.currentOverallPick).toBe(2); expect(state.historicalGap).toBe(true);
  });

  it('rejects contradictory or duplicate backup data', () => {
    const players = syntheticPool(200);
    const raw = serializeDraftSnapshot({ config, players, picks: [draftPickAtOverall(1, players[0].id, 10)], draftStarted: true });
    const unlocked = JSON.parse(raw); unlocked.draftStarted = false;
    expect(parseDraftSnapshot(JSON.stringify(unlocked))).toBeNull();
    const dup = JSON.parse(raw); dup.players.push({ ...dup.players[0] });
    expect(parseDraftSnapshot(JSON.stringify(dup))).toBeNull();
  });

  it('detects a hot accelerated position run', () => {
    const players: PlayerRanking[] = []; const picks = [];
    for (let overallPick = 1; overallPick <= 12; overallPick += 1) {
      const position = overallPick >= 7 && overallPick <= 10 ? 'RB' : 'WR';
      players.push({ id: `x-${overallPick}`, name: `X ${overallPick}`, position, overallRank: overallPick });
      picks.push(draftPickAtOverall(overallPick, `x-${overallPick}`, 10));
    }
    expect(buildPositionTrends(picks, players, 13).RB.status).toBe('HOT');
  });

  it('completes a weird-room simulation without duplicate user picks', () => {
    const result = simulateDraft({ players: syntheticPool(220), config, roomProfile: 'RB_RUSH' });
    expect(result.completed).toBe(true);
    expect(new Set(result.userPlayerIds).size).toBe(result.userPlayerIds.length);
  });
});

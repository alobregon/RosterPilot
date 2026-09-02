import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { simulateDecisionEngineMock, type MockResearchRun } from '../lib/mock-research';
import { managerProfileOptions } from '../lib/opponent-model';
import { parseRankingRows } from '../lib/spreadsheet';
import type { DraftConfig, PlayerRanking, Position, SimulationRoomProfile } from '../lib/types';

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

const scenarios: Array<{ name: string; runs: number; roomProfile: SimulationRoomProfile }> = [
  { name: 'NORMAL_HISTORY', runs: 40, roomProfile: 'RANK_ORDER' },
  { name: 'RB_RUSH', runs: 20, roomProfile: 'RB_RUSH' },
  { name: 'WR_RUSH', runs: 20, roomProfile: 'WR_RUSH' },
  { name: 'QB_RUSH', runs: 10, roomProfile: 'QB_RUSH' },
  { name: 'TE_RUSH', runs: 10, roomProfile: 'TE_RUSH' },
];

function loadRankings(): PlayerRanking[] {
  const text = readFileSync(new URL('./fixtures/fantasypros-2026-09-02-top280.csv', import.meta.url), 'utf8');
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(',');
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(',');
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']));
  });
  return parseRankingRows(rows).players;
}

function managerIdsForRun(runIndex: number): string[] {
  const ids = managerProfileOptions.map((manager) => manager.id);
  const ordered = [...ids].sort((a, b) => hash(`${runIndex}|${a}`) - hash(`${runIndex}|${b}`));
  const result = Array<string>(config.teamCount).fill('');
  let cursor = 0;
  for (let slot = 1; slot <= config.teamCount; slot += 1) {
    if (slot === config.userDraftSlot) continue;
    result[slot - 1] = ordered[cursor % ordered.length] ?? '';
    cursor += 1;
  }
  return result;
}

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function summarize(runs: MockResearchRun[], players: PlayerRanking[]) {
  const positionTotals: Record<Position, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 };
  const rosterFrequency = new Map<string, number>();
  const playerById = new Map(players.map((player) => [player.id, player]));
  const positiveSkillReaches: number[] = [];
  let contextChangedWinner = 0;
  let contextTierDrops = 0;
  let multiQbRuns = 0;
  let multiTeRuns = 0;
  let sevenPlusWrRuns = 0;
  let sixPlusRbRuns = 0;

  for (const run of runs) {
    for (const position of Object.keys(positionTotals) as Position[]) positionTotals[position] += run.userCounts[position];
    if (run.userCounts.QB >= 2) multiQbRuns += 1;
    if (run.userCounts.TE >= 2) multiTeRuns += 1;
    if (run.userCounts.WR >= 7) sevenPlusWrRuns += 1;
    if (run.userCounts.RB >= 6) sixPlusRbRuns += 1;
    for (const id of run.userPlayerIds) rosterFrequency.set(id, (rosterFrequency.get(id) ?? 0) + 1);
    for (const decision of run.decisions) {
      if (decision.contextChangedWinner) contextChangedWinner += 1;
      if (decision.contextChangedWinner && decision.contextTierDrop > 0) contextTierDrops += 1;
      if ((decision.position === 'QB' || decision.position === 'RB' || decision.position === 'WR' || decision.position === 'TE') && decision.rankReach > 0) {
        positiveSkillReaches.push(decision.rankReach);
      }
    }
  }

  positiveSkillReaches.sort((a, b) => a - b);
  return {
    runs: runs.length,
    completed: runs.filter((run) => run.completed).length,
    legal: runs.filter((run) => run.legalStartingRoster).length,
    uniqueRosters: new Set(runs.map((run) => [...run.userPlayerIds].sort().join('|'))).size,
    averagePositionCounts: Object.fromEntries(
      (Object.entries(positionTotals) as Array<[Position, number]>).map(([position, total]) => [position, Math.round((total / runs.length) * 100) / 100]),
    ),
    multiQbRuns,
    multiTeRuns,
    sevenPlusWrRuns,
    sixPlusRbRuns,
    contextChangedWinner,
    contextTierDrops,
    maxPositiveSkillReach: positiveSkillReaches.at(-1) ?? 0,
    p90PositiveSkillReach: positiveSkillReaches.length
      ? positiveSkillReaches[Math.floor((positiveSkillReaches.length - 1) * 0.9)]
      : 0,
    topRosterPlayers: [...rosterFrequency.entries()]
      .map(([id, count]) => ({ name: playerById.get(id)?.name ?? id, count, rate: Math.round((count / runs.length) * 1000) / 1000 }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 12),
  };
}

describe('QB2 suppression A/B against the Sept. 2 100-mock baseline', () => {
  it('replays the exact prior stochastic seeds and emits the post-change summary', () => {
    const players = loadRankings();
    expect(players).toHaveLength(280);

    const allRuns: MockResearchRun[] = [];
    const scenarioSummary: Record<string, ReturnType<typeof summarize>> = {};
    let globalIndex = 0;
    for (const scenario of scenarios) {
      const runs: MockResearchRun[] = [];
      for (let index = 0; index < scenario.runs; index += 1) {
        const runIndex = globalIndex + index;
        runs.push(simulateDecisionEngineMock({
          players,
          config,
          seed: `mock-2026-09-02-${scenario.name}-${runIndex}`,
          roomProfile: scenario.roomProfile,
          managerIds: managerIdsForRun(runIndex),
        }));
      }
      scenarioSummary[scenario.name] = summarize(runs, players);
      allRuns.push(...runs);
      globalIndex += scenario.runs;
    }

    expect(allRuns).toHaveLength(100);
    expect(allRuns.every((run) => run.completed)).toBe(true);
    expect(allRuns.every((run) => run.legalStartingRoster)).toBe(true);

    const neutral = simulateDecisionEngineMock({
      players,
      config,
      seed: 'neutral-control-2026-09-02',
      roomProfile: 'RANK_ORDER',
    });

    console.log(`ROSTERPILOT_QB2_AB=${JSON.stringify({
      baseline: { multiQbRuns: 61, averageQB: 1.65, multiTeRuns: 2, sevenPlusWrRuns: 45, sixPlusRbRuns: 12, contextChangedWinner: 296, contextTierDrops: 0, maxPositiveSkillReach: 10, p90PositiveSkillReach: 6 },
      after: summarize(allRuns, players),
      scenarios: scenarioSummary,
      neutralControl: neutral.decisions.map((decision) => ({ round: decision.round, player: decision.selectedPlayerName, position: decision.position, rank: decision.overallRank })),
    })}`);
  }, 180_000);
});

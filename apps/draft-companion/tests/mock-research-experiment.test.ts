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

const SKILL_POSITIONS = new Set<Position>(['QB', 'RB', 'WR', 'TE']);

type Scenario = {
  name: string;
  runs: number;
  roomProfile: SimulationRoomProfile;
  useHistoricalManagers: boolean;
};

const scenarios: Scenario[] = [
  { name: 'NORMAL_HISTORY', runs: 40, roomProfile: 'RANK_ORDER', useHistoricalManagers: true },
  { name: 'RB_RUSH', runs: 20, roomProfile: 'RB_RUSH', useHistoricalManagers: true },
  { name: 'WR_RUSH', runs: 20, roomProfile: 'WR_RUSH', useHistoricalManagers: true },
  { name: 'QB_RUSH', runs: 10, roomProfile: 'QB_RUSH', useHistoricalManagers: true },
  { name: 'TE_RUSH', runs: 10, roomProfile: 'TE_RUSH', useHistoricalManagers: true },
];

interface ScenarioSummary {
  runs: number;
  completed: number;
  legal: number;
  uniqueRosters: number;
  decisions: number;
  averagePositionCounts: Record<Position, number>;
  multiQbRuns: number;
  multiTeRuns: number;
  sixPlusRbRuns: number;
  sevenPlusWrRuns: number;
  averageFirstRound: Partial<Record<Position, number>>;
  averageSkillRankReach: number;
  averageSkillPositiveReach: number;
  p90SkillPositiveReach: number;
  maxSkillPositiveReach: number;
  skillReachesOver5: number;
  skillReachesOver10: number;
  averageTopRecommendationPercent: number;
  contextChangedWinner: number;
  contextChangedWinnerRate: number;
  contextChangedTop3Order: number;
  contextChangedTop3Rate: number;
  selectedWithContext: number;
  contextTierDrops: number;
  topContextFlipWinners: Array<{ name: string; count: number }>;
  averageSelectedChanceBack: number | null;
  selectedWithChanceBackAtLeast65: number;
  timingConflicts: number;
  timingConflictRate: number;
  topTimingConflictPairs: Array<{ selected: string; alternative: string; count: number }>;
  topRosterPlayers: Array<{ name: string; count: number; rate: number }>;
  roundPositionRates: Record<string, Partial<Record<Position, number>>>;
}

function loadRankings(): PlayerRanking[] {
  const text = readFileSync(
    new URL('./fixtures/fantasypros-2026-09-02-top280.csv', import.meta.url),
    'utf8',
  );
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

function summarize(runs: MockResearchRun[], players: PlayerRanking[]): ScenarioSummary {
  const playerById = new Map(players.map((player) => [player.id, player]));
  const positionTotals = emptyPositionCounts();
  const firstRounds: Partial<Record<Position, number[]>> = {};
  const rosterFrequency = new Map<string, number>();
  const rosterSignatures = new Set<string>();
  const roundPositions = new Map<number, Record<Position, number>>();
  const skillPositiveReaches: number[] = [];
  const contextFlipWinners = new Map<string, number>();
  const timingPairs = new Map<string, number>();
  let skillReachTotal = 0;
  let skillDecisionCount = 0;
  let decisionCount = 0;
  let topPercentTotal = 0;
  let contextChangedWinner = 0;
  let contextChangedTop3Order = 0;
  let selectedWithContext = 0;
  let contextTierDrops = 0;
  let skillReachesOver5 = 0;
  let skillReachesOver10 = 0;
  let survivalTotal = 0;
  let survivalCount = 0;
  let highChanceBack = 0;
  let timingConflicts = 0;

  for (const run of runs) {
    rosterSignatures.add([...run.userPlayerIds].sort().join('|'));
    for (const position of Object.keys(positionTotals) as Position[]) {
      positionTotals[position] += run.userCounts[position];
      const first = run.decisions.find((decision) => decision.position === position)?.round;
      if (first != null) (firstRounds[position] ??= []).push(first);
    }
    for (const id of run.userPlayerIds) rosterFrequency.set(id, (rosterFrequency.get(id) ?? 0) + 1);

    for (const decision of run.decisions) {
      decisionCount += 1;
      topPercentTotal += decision.topRecommendationPercent;
      if (SKILL_POSITIONS.has(decision.position)) {
        skillDecisionCount += 1;
        skillReachTotal += decision.rankReach;
        if (decision.rankReach > 0) skillPositiveReaches.push(decision.rankReach);
        if (decision.rankReach > 5) skillReachesOver5 += 1;
        if (decision.rankReach > 10) skillReachesOver10 += 1;
      }
      if (decision.contextChangedWinner) {
        contextChangedWinner += 1;
        contextFlipWinners.set(
          decision.selectedPlayerId,
          (contextFlipWinners.get(decision.selectedPlayerId) ?? 0) + 1,
        );
      }
      if (decision.contextChangedTop3Order) contextChangedTop3Order += 1;
      if (Math.abs(decision.contextAdjustment) >= 0.05) selectedWithContext += 1;
      if (decision.contextChangedWinner && decision.contextTierDrop > 0) contextTierDrops += 1;
      if (decision.survivalProbability != null) {
        survivalTotal += decision.survivalProbability;
        survivalCount += 1;
        if (decision.survivalProbability >= 0.65) highChanceBack += 1;
      }
      if (decision.timingConflict) {
        timingConflicts += 1;
        const key = `${decision.selectedPlayerName}|||${decision.timingAlternativeName ?? 'Unknown'}`;
        timingPairs.set(key, (timingPairs.get(key) ?? 0) + 1);
      }
      const counts = roundPositions.get(decision.round) ?? emptyPositionCounts();
      counts[decision.position] += 1;
      roundPositions.set(decision.round, counts);
    }
  }

  skillPositiveReaches.sort((a, b) => a - b);
  const topRosterPlayers = [...rosterFrequency.entries()]
    .map(([id, count]) => ({ name: playerById.get(id)?.name ?? id, count, rate: round3(count / runs.length) }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 15);
  const topContextFlipWinners = [...contextFlipWinners.entries()]
    .map(([id, count]) => ({ name: playerById.get(id)?.name ?? id, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 10);
  const topTimingConflictPairs = [...timingPairs.entries()]
    .map(([key, count]) => {
      const [selected, alternative] = key.split('|||');
      return { selected, alternative, count };
    })
    .sort((a, b) => b.count - a.count || a.selected.localeCompare(b.selected))
    .slice(0, 10);
  const roundPositionRates: Record<string, Partial<Record<Position, number>>> = {};
  for (const [round, counts] of [...roundPositions.entries()].sort((a, b) => a[0] - b[0])) {
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    roundPositionRates[String(round)] = Object.fromEntries(
      (Object.entries(counts) as Array<[Position, number]>)
        .filter(([, count]) => count > 0)
        .map(([position, count]) => [position, round3(count / total)]),
    );
  }

  return {
    runs: runs.length,
    completed: runs.filter((run) => run.completed).length,
    legal: runs.filter((run) => run.legalStartingRoster).length,
    uniqueRosters: rosterSignatures.size,
    decisions: decisionCount,
    averagePositionCounts: mapPositionCounts(positionTotals, (value) => round2(value / runs.length)),
    multiQbRuns: runs.filter((run) => run.userCounts.QB >= 2).length,
    multiTeRuns: runs.filter((run) => run.userCounts.TE >= 2).length,
    sixPlusRbRuns: runs.filter((run) => run.userCounts.RB >= 6).length,
    sevenPlusWrRuns: runs.filter((run) => run.userCounts.WR >= 7).length,
    averageFirstRound: Object.fromEntries(
      Object.entries(firstRounds).map(([position, values]) => [
        position,
        round2(values.reduce((sum, value) => sum + value, 0) / values.length),
      ]),
    ),
    averageSkillRankReach: round2(skillReachTotal / Math.max(1, skillDecisionCount)),
    averageSkillPositiveReach: skillPositiveReaches.length
      ? round2(skillPositiveReaches.reduce((sum, value) => sum + value, 0) / skillPositiveReaches.length)
      : 0,
    p90SkillPositiveReach: percentile(skillPositiveReaches, 0.9),
    maxSkillPositiveReach: skillPositiveReaches.at(-1) ?? 0,
    skillReachesOver5,
    skillReachesOver10,
    averageTopRecommendationPercent: round2(topPercentTotal / Math.max(1, decisionCount)),
    contextChangedWinner,
    contextChangedWinnerRate: round3(contextChangedWinner / Math.max(1, decisionCount)),
    contextChangedTop3Order,
    contextChangedTop3Rate: round3(contextChangedTop3Order / Math.max(1, decisionCount)),
    selectedWithContext,
    contextTierDrops,
    topContextFlipWinners,
    averageSelectedChanceBack: survivalCount ? round3(survivalTotal / survivalCount) : null,
    selectedWithChanceBackAtLeast65: highChanceBack,
    timingConflicts,
    timingConflictRate: round3(timingConflicts / Math.max(1, decisionCount)),
    topTimingConflictPairs,
    topRosterPlayers,
    roundPositionRates,
  };
}

function percentile(values: number[], quantile: number): number {
  if (!values.length) return 0;
  return values[Math.min(values.length - 1, Math.floor((values.length - 1) * quantile))];
}

function mapPositionCounts(
  counts: Record<Position, number>,
  mapper: (value: number) => number,
): Record<Position, number> {
  return Object.fromEntries(
    (Object.entries(counts) as Array<[Position, number]>).map(([position, value]) => [position, mapper(value)]),
  ) as Record<Position, number>;
}

function emptyPositionCounts(): Record<Position, number> {
  return { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 };
}

function round2(value: number): number { return Math.round(value * 100) / 100; }
function round3(value: number): number { return Math.round(value * 1000) / 1000; }

describe('100-mock behavior research with Sept. 2 rankings', () => {
  it('runs 100 stochastic mocks plus one neutral control and emits a compact report', () => {
    const players = loadRankings();
    expect(players).toHaveLength(280);
    expect(players[0]?.name).toBe('Jahmyr Gibbs');
    expect(players.find((player) => player.name === 'Josh Jacobs')?.overallRank).toBe(123);

    const control = simulateDecisionEngineMock({
      players,
      config,
      seed: 'neutral-control-2026-09-02',
      roomProfile: 'RANK_ORDER',
    });
    expect(control.completed).toBe(true);
    expect(control.legalStartingRoster).toBe(true);

    const scenarioRuns: Record<string, MockResearchRun[]> = {};
    let globalIndex = 0;
    for (const scenario of scenarios) {
      const runs: MockResearchRun[] = [];
      for (let index = 0; index < scenario.runs; index += 1) {
        const runIndex = globalIndex + index;
        const managerIds = scenario.useHistoricalManagers ? managerIdsForRun(runIndex) : [];
        runs.push(simulateDecisionEngineMock({
          players,
          config,
          seed: `mock-2026-09-02-${scenario.name}-${runIndex}`,
          roomProfile: scenario.roomProfile,
          managerIds,
        }));
      }
      scenarioRuns[scenario.name] = runs;
      globalIndex += scenario.runs;
    }

    const allRuns = Object.values(scenarioRuns).flat();
    expect(allRuns).toHaveLength(100);
    expect(allRuns.every((run) => run.completed)).toBe(true);
    expect(allRuns.every((run) => run.legalStartingRoster)).toBe(true);

    const report = {
      generatedFor: 'FantasyPros_2026_Draft_ALL_Rankings(5).csv',
      rankingRowsUsed: players.length,
      stochasticRuns: allRuns.length,
      neutralControlPicks: control.decisions.map((decision) => ({
        round: decision.round,
        overallPick: decision.overallPick,
        player: decision.selectedPlayerName,
        position: decision.position,
        rank: decision.overallRank,
        contextAdjustment: decision.contextAdjustment,
        chanceBack: decision.survivalProbability == null ? null : round3(decision.survivalProbability),
      })),
      neutralControl: summarize([control], players),
      overall: summarize(allRuns, players),
      scenarios: Object.fromEntries(
        Object.entries(scenarioRuns).map(([name, runs]) => [name, summarize(runs, players)]),
      ),
    };

    console.log(`ROSTERPILOT_MOCK_RESEARCH=${JSON.stringify(report)}`);
  }, 180_000);
});

import { roundForOverallPick } from './draft';
import {
  getOffseasonContextForPlayers,
  getOffseasonContextSource,
  type OffseasonContextConfidence,
  type OffseasonContextDirection,
  type OffseasonContextEntry,
  type OffseasonContextOutlookOrigin,
} from './offseason-context';
import type { PlayerRanking } from './types';

const MAX_CONTEXT_ADJUSTMENT = 3;

export type AggregatedContextDirection = 'POSITIVE' | 'NEGATIVE' | 'MIXED';

export interface OffseasonContextSignal {
  adjustment: number;
  unboundedAdjustment: number;
  direction: AggregatedContextDirection;
  entryCount: number;
  rankDisciplineMultiplier: number;
  reason?: string;
}

/**
 * Convert curated offseason context into a small recommendation tie-breaker.
 *
 * Imported rankings remain authoritative. The signal is capped at +/-3 raw
 * score points, is damped as a candidate moves away from the best-ranked
 * serious option, and is suppressed when a meaningful early-round rank/tier
 * gap exists. This lets current context break close decisions without turning
 * an analyst article into a replacement ranking system.
 */
export function offseasonContextSignalForPlayer(args: {
  player: PlayerRanking;
  bestCandidateRank: number;
  bestCandidateTier?: number;
  selectionPick: number;
  teamCount: number;
}): OffseasonContextSignal {
  const { player, bestCandidateRank, bestCandidateTier, selectionPick, teamCount } = args;
  const entries = getOffseasonContextForPlayers([player.name], 20).filter(
    (entry) => entry.outlook != null,
  );

  if (!entries.length || player.position === 'K' || player.position === 'DST') {
    return {
      adjustment: 0,
      unboundedAdjustment: 0,
      direction: 'MIXED',
      entryCount: entries.length,
      rankDisciplineMultiplier: 0,
    };
  }

  const contributions = entries.map((entry) => ({
    entry,
    value: entryContribution(entry),
  }));
  const totalContribution = contributions.reduce((sum, item) => sum + item.value, 0);
  const unboundedAdjustment = clamp(totalContribution * 1.75, -MAX_CONTEXT_ADJUSTMENT, MAX_CONTEXT_ADJUSTMENT);
  const round = roundForOverallPick(selectionPick, teamCount);
  const discipline = rankDisciplineMultiplier({
    player,
    bestCandidateRank,
    bestCandidateTier,
    round,
  });
  const adjustment = roundTenth(unboundedAdjustment * discipline);
  const direction: AggregatedContextDirection = adjustment > 0.05
    ? 'POSITIVE'
    : adjustment < -0.05
      ? 'NEGATIVE'
      : 'MIXED';

  const strongest = strongestSupportingEntry(contributions, direction);
  const reason = Math.abs(adjustment) >= 0.25 && strongest
    ? contextReason(strongest.entry, direction)
    : undefined;

  return {
    adjustment,
    unboundedAdjustment: roundTenth(unboundedAdjustment),
    direction,
    entryCount: entries.length,
    rankDisciplineMultiplier: discipline,
    reason,
  };
}

function entryContribution(entry: OffseasonContextEntry): number {
  const outlook = entry.outlook;
  if (!outlook) return 0;
  return directionWeight(outlook.direction)
    * confidenceWeight(outlook.confidence)
    * originWeight(outlook.origin);
}

function directionWeight(direction: OffseasonContextDirection): number {
  switch (direction) {
    case 'POSITIVE':
      return 1;
    case 'MIXED_POSITIVE':
      return 0.5;
    case 'MIXED_NEGATIVE':
      return -0.5;
    case 'NEGATIVE':
      return -1;
    default:
      return 0;
  }
}

function confidenceWeight(confidence: OffseasonContextConfidence): number {
  switch (confidence) {
    case 'HIGH':
      return 1.1;
    case 'MEDIUM_HIGH':
      return 1;
    case 'MEDIUM':
      return 0.8;
    case 'LOW_MEDIUM':
      return 0.6;
  }
}

function originWeight(origin: OffseasonContextOutlookOrigin): number {
  switch (origin) {
    case 'SOURCE_CONSENSUS':
      return 1;
    case 'SOURCE_ANALYST':
      return 0.9;
    case 'ROSTERPILOT_INFERENCE':
      return 0.7;
    case 'SOURCE_CONFLICT':
      return 0.5;
  }
}

function rankDisciplineMultiplier(args: {
  player: PlayerRanking;
  bestCandidateRank: number;
  bestCandidateTier?: number;
  round: number;
}): number {
  const { player, bestCandidateRank, bestCandidateTier, round } = args;
  const rankGap = Math.max(0, player.overallRank - bestCandidateRank);
  let multiplier: number;

  if (round <= 2) {
    multiplier = rankGap <= 1 ? 1 : rankGap <= 2 ? 0.75 : rankGap <= 4 ? 0.35 : 0;
  } else if (round <= 4) {
    multiplier = rankGap <= 2 ? 1 : rankGap <= 4 ? 0.7 : rankGap <= 6 ? 0.35 : 0;
  } else if (round <= 8) {
    multiplier = rankGap <= 3 ? 1 : rankGap <= 6 ? 0.7 : rankGap <= 9 ? 0.35 : 0;
  } else {
    multiplier = rankGap <= 4 ? 1 : rankGap <= 8 ? 0.7 : rankGap <= 12 ? 0.35 : 0;
  }

  if (bestCandidateTier != null && player.tier != null) {
    const tierGap = player.tier - bestCandidateTier;
    if (tierGap >= 2) return 0;
    if (tierGap === 1) multiplier *= 0.5;
  }

  return roundHundredth(multiplier);
}

function strongestSupportingEntry(
  contributions: Array<{ entry: OffseasonContextEntry; value: number }>,
  direction: AggregatedContextDirection,
): { entry: OffseasonContextEntry; value: number } | undefined {
  if (direction === 'MIXED') return undefined;
  const sign = direction === 'POSITIVE' ? 1 : -1;
  return contributions
    .filter((item) => item.value * sign > 0)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0];
}

function contextReason(entry: OffseasonContextEntry, direction: AggregatedContextDirection): string {
  const outlook = entry.outlook;
  if (!outlook) return '';
  const sourceId = entry.facts.flatMap((fact) => fact.sourceIds)[0];
  const source = sourceId ? getOffseasonContextSource(sourceId) : undefined;
  const label = outlook.origin === 'ROSTERPILOT_INFERENCE'
    ? 'RosterPilot context'
    : source?.publisher
      ? `${source.publisher} context`
      : 'Offseason context';
  const polarity = direction === 'POSITIVE' ? 'boost' : 'caution';
  return `${label} ${polarity}: ${outlook.summary}`;
}

function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundHundredth(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

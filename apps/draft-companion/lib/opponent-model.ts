import managerProfilesData from '../../../research/league_manager_profiles_2013_2025.json';
import { draftSlotForOverallPick, followingUserOverallPick, nextUserOverallPick, roundForOverallPick } from './draft';
import type { DraftConfig, PlayerRanking, Position } from './types';

type HistoricalPosition = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';
type DraftPhase = 'R1_4' | 'R5_8' | 'R9_12' | 'R13_16';

interface ManagerProfile {
  manager_id: string;
  display_name: string;
  current_team_2025?: string;
  draft_count: number;
  phase_position_probabilities_recency_weighted: Record<DraftPhase, Record<HistoricalPosition, number>>;
}

export interface OpponentHistorySignal {
  adjustment: number;
  matchedManagers: number;
  pressureManagers: number;
  reasons: string[];
}

const profiles = managerProfilesData.profiles as unknown as ManagerProfile[];
const MAX_AVAILABILITY_ADJUSTMENT = 14;
const MAX_MANAGER_ADJUSTMENT = 8;

/**
 * Returns a bounded adjustment to Future Availability urgency based on the
 * historical positional tendencies of the managers drafting before the user's
 * following turn. Positive values mean the player is less likely to make it
 * back; negative values mean the historical room tendencies are slightly more
 * favorable.
 *
 * This signal is intentionally relative to the Purple League average for the
 * same draft phase. It never changes the player's imported ranking/value.
 */
export function opponentHistoryAvailabilitySignal(args: {
  player: PlayerRanking;
  config: DraftConfig;
  currentOverallPick: number;
  teamNames?: readonly string[];
}): OpponentHistorySignal {
  const { player, config, currentOverallPick, teamNames = [] } = args;
  if (!teamNames.length) return emptySignal();

  const selectionPick = nextUserOverallPick(currentOverallPick, config);
  const returnPick = followingUserOverallPick(currentOverallPick, config);
  const totalPicks = config.teamCount * totalRosterSlots(config);
  if (returnPick > totalPicks) return emptySignal();

  const opportunities = new Map<number, number[]>();
  for (let overallPick = selectionPick + 1; overallPick < returnPick; overallPick += 1) {
    const slot = draftSlotForOverallPick(overallPick, config.teamCount);
    if (slot === config.userDraftSlot) continue;
    const list = opportunities.get(slot) ?? [];
    list.push(overallPick);
    opportunities.set(slot, list);
  }

  let weightedAdjustment = 0;
  let matchedManagers = 0;
  let pressureManagers = 0;
  const reasons: string[] = [];

  for (const [slot, picks] of opportunities) {
    const profile = resolveManagerProfile(teamNames[slot - 1]);
    if (!profile) continue;
    matchedManagers += 1;

    const perPick = picks.map((pick) => managerPositionAdjustment(profile, player.position, roundForOverallPick(pick, config.teamCount)));
    const managerAdjustment = perPick.reduce((sum, value) => sum + value, 0) / perPick.length;
    const opportunityWeight = 1 + Math.max(0, picks.length - 1) * 0.35;
    weightedAdjustment += managerAdjustment * opportunityWeight;

    if (managerAdjustment >= 3.5) {
      pressureManagers += 1;
      reasons.push(`${profile.display_name} historically leans ${displayPosition(player.position)} in this draft phase`);
    }
  }

  return {
    adjustment: clamp(weightedAdjustment, -MAX_AVAILABILITY_ADJUSTMENT, MAX_AVAILABILITY_ADJUSTMENT),
    matchedManagers,
    pressureManagers,
    reasons: [...new Set(reasons)].slice(0, 2),
  };
}

export function resolveManagerProfile(label: string | undefined): ManagerProfile | null {
  const normalized = normalizeLabel(label);
  if (!normalized || /^team\d+$/.test(normalized)) return null;
  return profiles.find((profile) => {
    const aliases = [profile.manager_id, profile.display_name, profile.current_team_2025];
    return aliases.some((alias) => normalizeLabel(alias) === normalized);
  }) ?? null;
}

function managerPositionAdjustment(profile: ManagerProfile, position: Position, round: number): number {
  const phase = phaseForRound(round);
  const historicalPosition = historyPosition(position);
  const managerProbability = profile.phase_position_probabilities_recency_weighted[phase]?.[historicalPosition] ?? 0;
  const leagueProbability = averageProbability(phase, historicalPosition);
  const confidence = clamp(profile.draft_count / 10, 0.35, 1);
  return clamp((managerProbability - leagueProbability) * 70 * confidence, -MAX_MANAGER_ADJUSTMENT, MAX_MANAGER_ADJUSTMENT);
}

function averageProbability(phase: DraftPhase, position: HistoricalPosition): number {
  const values = profiles
    .map((profile) => profile.phase_position_probabilities_recency_weighted[phase]?.[position])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function phaseForRound(round: number): DraftPhase {
  if (round <= 4) return 'R1_4';
  if (round <= 8) return 'R5_8';
  if (round <= 12) return 'R9_12';
  return 'R13_16';
}

function historyPosition(position: Position): HistoricalPosition {
  return position === 'DST' ? 'DEF' : position;
}

function displayPosition(position: Position): string {
  return position === 'DST' ? 'DST' : position;
}

function normalizeLabel(value: string | undefined): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function totalRosterSlots(config: DraftConfig): number {
  return config.qbStarters + config.rbStarters + config.wrStarters + config.teStarters + config.flexStarters + config.dstStarters + config.kStarters + config.benchSpots;
}

function emptySignal(): OpponentHistorySignal {
  return { adjustment: 0, matchedManagers: 0, pressureManagers: 0, reasons: [] };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

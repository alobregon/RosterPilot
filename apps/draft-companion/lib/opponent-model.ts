import managerProfilesData from '../../../research/league_manager_profiles_2013_2025.json';
import managerAdpProfilesData from '../../../research/league_manager_adp_profiles_2018_2025.json';
import { draftSlotForOverallPick, followingUserOverallPick, nextUserOverallPick, roundForOverallPick } from './draft';
import type { DraftConfig, PlayerRanking, Position } from './types';

type HistoricalPosition = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';
type SkillPosition = 'QB' | 'RB' | 'WR' | 'TE';
type DraftPhase = 'R1_4' | 'R5_8' | 'R9_12' | 'R13_16';

interface ManagerProfile {
  manager_id: string;
  display_name: string;
  current_team_2025?: string;
  seasons?: number[];
  draft_count: number;
  phase_position_probabilities_recency_weighted: Record<DraftPhase, Record<HistoricalPosition, number>>;
}

interface ReachStat {
  n?: number;
  shift: number;
  reach_5_rate?: number;
  reach_10_rate?: number;
}

interface ManagerAdpProfile {
  manager_id: string;
  matched_skill_picks: number;
  overall: ReachStat;
  by_position: Partial<Record<SkillPosition, ReachStat>>;
  by_phase: Partial<Record<DraftPhase, ReachStat>>;
}

export interface ManagerProfileOption {
  id: string;
  displayName: string;
  currentTeam?: string;
  draftCount: number;
  seasons: number[];
}

export interface OpponentHistorySignal {
  adjustment: number;
  positionAdjustment: number;
  reachAdjustment: number;
  matchedManagers: number;
  pressureManagers: number;
  reasons: string[];
}

const profiles = managerProfilesData.profiles as unknown as ManagerProfile[];
const adpProfiles = managerAdpProfilesData.profiles as unknown as ManagerAdpProfile[];
const MAX_AVAILABILITY_ADJUSTMENT = 14;
const MAX_MANAGER_POSITION_ADJUSTMENT = 8;
const MAX_REACH_AVAILABILITY_ADJUSTMENT = 8;
const MAX_MANAGER_REACH_ADJUSTMENT = 4.5;
const MAX_EFFECTIVE_ADP_SHIFT = 6;

// Walk-forward validation over 2019-2025 did not improve out-of-sample
// manager-relative ADP prediction versus a neutral-manager baseline. Preserve
// the derived research data and scorer for future calibration, but do not let
// the V2 reach signal affect live recommendations until it earns its weight.
export const HISTORICAL_ADP_REACH_ENABLED = false;

export const managerProfileOptions: ManagerProfileOption[] = profiles
  .map((profile) => ({
    id: profile.manager_id,
    displayName: profile.display_name,
    currentTeam: profile.current_team_2025,
    draftCount: profile.draft_count,
    seasons: [...(profile.seasons ?? [])],
  }))
  .sort((a, b) => a.displayName.localeCompare(b.displayName));

/**
 * Returns a bounded adjustment to Future Availability urgency based on the
 * historical behavior of the managers drafting before the user's following
 * turn. V1 contributes phase-relative positional demand. V2's manager-specific
 * reach/wait scorer remains available for research but is currently gated off
 * after walk-forward validation failed to beat a neutral-manager baseline.
 *
 * Positive values mean the player is less likely to make it back; negative
 * values mean the historical room tendencies are slightly more favorable.
 * Explicit manager IDs are authoritative. Team-name matching remains a
 * backward-compatible fallback for older saved drafts and manual labels.
 *
 * Historical behavior never changes the player's imported ranking/value.
 */
export function opponentHistoryAvailabilitySignal(args: {
  player: PlayerRanking;
  config: DraftConfig;
  currentOverallPick: number;
  managerIds?: readonly string[];
  teamNames?: readonly string[];
}): OpponentHistorySignal {
  const { player, config, currentOverallPick, managerIds = [], teamNames = [] } = args;
  if (!managerIds.length && !teamNames.length) return emptySignal();

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

  let positionWeightedAdjustment = 0;
  let reachWeightedAdjustment = 0;
  let matchedManagers = 0;
  let pressureManagers = 0;
  const reasons: string[] = [];

  for (const [slot, picks] of opportunities) {
    const profile = resolveManagerProfileById(managerIds[slot - 1]) ?? resolveManagerProfile(teamNames[slot - 1]);
    if (!profile) continue;
    matchedManagers += 1;

    const perPickPosition = picks.map((pick) => managerPositionAdjustment(profile, player.position, roundForOverallPick(pick, config.teamCount)));
    const managerPosition = average(perPickPosition);
    const managerReach = HISTORICAL_ADP_REACH_ENABLED
      ? managerReachAvailabilityAdjustment(profile.manager_id, player, picks, config.teamCount)
      : 0;
    const opportunityWeight = 1 + Math.max(0, picks.length - 1) * 0.35;
    positionWeightedAdjustment += managerPosition * opportunityWeight;
    reachWeightedAdjustment += managerReach * opportunityWeight;

    let createsPressure = false;
    if (managerPosition >= 3.5) {
      createsPressure = true;
      reasons.push(`${profile.display_name} historically leans ${displayPosition(player.position)} in this draft phase`);
    }
    if (HISTORICAL_ADP_REACH_ENABLED && managerReach >= 2) {
      createsPressure = true;
      reasons.push(`${profile.display_name} historically reaches for ${displayPosition(player.position)} ahead of league ADP`);
    }
    if (createsPressure) pressureManagers += 1;
  }

  const positionAdjustment = clamp(positionWeightedAdjustment, -MAX_AVAILABILITY_ADJUSTMENT, MAX_AVAILABILITY_ADJUSTMENT);
  const reachAdjustment = clamp(reachWeightedAdjustment, -MAX_REACH_AVAILABILITY_ADJUSTMENT, MAX_REACH_AVAILABILITY_ADJUSTMENT);
  return {
    adjustment: clamp(positionAdjustment + reachAdjustment, -MAX_AVAILABILITY_ADJUSTMENT, MAX_AVAILABILITY_ADJUSTMENT),
    positionAdjustment,
    reachAdjustment,
    matchedManagers,
    pressureManagers,
    reasons: [...new Set(reasons)].slice(0, 2),
  };
}

export function resolveManagerProfileById(managerId: string | undefined): ManagerProfile | null {
  if (!managerId) return null;
  return profiles.find((profile) => profile.manager_id === managerId) ?? null;
}

export function resolveManagerProfile(label: string | undefined): ManagerProfile | null {
  const normalized = normalizeLabel(label);
  if (!normalized || /^team\d+$/.test(normalized)) return null;
  return profiles.find((profile) => {
    const aliases = [profile.manager_id, profile.display_name, profile.current_team_2025];
    return aliases.some((alias) => normalizeLabel(alias) === normalized);
  }) ?? null;
}

/**
 * Returns the manager-specific effective-ADP shift learned from historical
 * drafts. Negative means the manager tends to select this kind of player
 * earlier than the league does relative to market ADP; positive means later.
 * This research scorer is currently not applied to live recommendations.
 */
export function historicalAdpShift(managerId: string, position: Position, round: number): number {
  if (!isSkillPosition(position)) return 0;
  const profile = adpProfiles.find((candidate) => candidate.manager_id === managerId);
  if (!profile) return 0;
  const positionStat = profile.by_position[position];
  const phaseStat = profile.by_phase[phaseForRound(round)];
  const shift = profile.overall.shift * 0.45 + (positionStat?.shift ?? profile.overall.shift) * 0.35 + (phaseStat?.shift ?? profile.overall.shift) * 0.20;
  return clamp(shift, -MAX_EFFECTIVE_ADP_SHIFT, MAX_EFFECTIVE_ADP_SHIFT);
}

function managerPositionAdjustment(profile: ManagerProfile, position: Position, round: number): number {
  const phase = phaseForRound(round);
  const historicalPosition = historyPosition(position);
  const managerProbability = profile.phase_position_probabilities_recency_weighted[phase]?.[historicalPosition] ?? 0;
  const leagueProbability = averageProbability(phase, historicalPosition);
  const confidence = clamp(profile.draft_count / 10, 0.35, 1);
  return clamp((managerProbability - leagueProbability) * 70 * confidence, -MAX_MANAGER_POSITION_ADJUSTMENT, MAX_MANAGER_POSITION_ADJUSTMENT);
}

function managerReachAvailabilityAdjustment(managerId: string, player: PlayerRanking, picks: number[], teamCount: number): number {
  const adp = player.adp;
  if (adp == null || !isSkillPosition(player.position) || !picks.length) return 0;
  const adjustments = picks.map((pick) => {
    const shift = historicalAdpShift(managerId, player.position, roundForOverallPick(pick, teamCount));
    if (Math.abs(shift) < 0.05) return 0;
    const baseline = marketSelectionPressure(pick, adp);
    const personalized = marketSelectionPressure(pick, adp + shift);
    return (personalized - baseline) * 0.38;
  });
  return clamp(average(adjustments), -MAX_MANAGER_REACH_ADJUSTMENT, MAX_MANAGER_REACH_ADJUSTMENT);
}

function marketSelectionPressure(opponentPick: number, marketPick: number): number {
  const x = (opponentPick - marketPick) / 4.5;
  return 100 / (1 + Math.exp(-x));
}

function averageProbability(phase: DraftPhase, position: HistoricalPosition): number {
  const values = profiles
    .map((profile) => profile.phase_position_probabilities_recency_weighted[phase]?.[position])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return values.length ? average(values) : 0;
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

function isSkillPosition(position: Position): position is SkillPosition {
  return position === 'QB' || position === 'RB' || position === 'WR' || position === 'TE';
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
  return { adjustment: 0, positionAdjustment: 0, reachAdjustment: 0, matchedManagers: 0, pressureManagers: 0, reasons: [] };
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

import type { DraftConfig, ScoringFormat } from './types';

const MIN_TEAMS = 4;
const MAX_TEAMS = 20;
const MAX_POSITION_SLOTS = 10;
const MAX_BENCH_SPOTS = 20;

export interface DraftSetupValidation {
  valid: boolean;
  errors: string[];
}

export function defaultTeamNames(teamCount: number): string[] {
  return Array.from({ length: Math.max(0, teamCount) }, () => '');
}

export function resizeTeamNames(teamNames: readonly string[], teamCount: number): string[] {
  const safeCount = Math.max(0, teamCount);
  return Array.from({ length: safeCount }, (_, index) => teamNames[index] ?? '');
}

export function teamDisplayName(
  draftSlot: number,
  userDraftSlot: number,
  teamNames: readonly string[],
): string {
  const custom = teamNames[draftSlot - 1]?.trim();
  if (custom) return draftSlot === userDraftSlot ? `${custom} (YOU)` : custom;
  return draftSlot === userDraftSlot ? 'YOU' : `Team ${draftSlot}`;
}

export function scoringFormatLabel(format: ScoringFormat): string {
  if (format === 'HALF_PPR') return 'Half-PPR';
  if (format === 'PPR') return 'PPR';
  return 'Standard';
}

export function leagueSummary(config: DraftConfig): string {
  return `${scoringFormatLabel(config.scoringFormat)} • ${config.qbStarters}QB / ${config.rbStarters}RB / ${config.wrStarters}WR / ${config.teStarters}TE / ${config.flexStarters} FLEX / ${config.dstStarters} DST / ${config.kStarters} K / ${config.benchSpots} bench`;
}

export function validateDraftSetup(config: DraftConfig): DraftSetupValidation {
  const errors: string[] = [];

  if (!Number.isInteger(config.teamCount) || config.teamCount < MIN_TEAMS || config.teamCount > MAX_TEAMS) {
    errors.push(`Teams must be between ${MIN_TEAMS} and ${MAX_TEAMS}.`);
  }
  if (!Number.isInteger(config.userDraftSlot) || config.userDraftSlot < 1 || config.userDraftSlot > config.teamCount) {
    errors.push('Your draft slot must be within the league team count.');
  }

  const slotFields: Array<[string, number, number]> = [
    ['QB starters', config.qbStarters, MAX_POSITION_SLOTS],
    ['RB starters', config.rbStarters, MAX_POSITION_SLOTS],
    ['WR starters', config.wrStarters, MAX_POSITION_SLOTS],
    ['TE starters', config.teStarters, MAX_POSITION_SLOTS],
    ['FLEX starters', config.flexStarters, MAX_POSITION_SLOTS],
    ['DST starters', config.dstStarters, MAX_POSITION_SLOTS],
    ['K starters', config.kStarters, MAX_POSITION_SLOTS],
    ['Bench spots', config.benchSpots, MAX_BENCH_SPOTS],
  ];

  for (const [label, value, max] of slotFields) {
    if (!Number.isInteger(value) || value < 0 || value > max) {
      errors.push(`${label} must be between 0 and ${max}.`);
    }
  }

  const starterCount =
    config.qbStarters +
    config.rbStarters +
    config.wrStarters +
    config.teStarters +
    config.flexStarters +
    config.dstStarters +
    config.kStarters;
  if (starterCount === 0) errors.push('At least one starting roster slot is required.');

  return { valid: errors.length === 0, errors };
}

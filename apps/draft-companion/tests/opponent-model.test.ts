import { describe, expect, it } from 'vitest';
import { recommendForCurrentPick } from '../lib/decision';
import {
  managerProfileOptions,
  opponentHistoryAvailabilitySignal,
  resolveManagerProfile,
  resolveManagerProfileById,
} from '../lib/opponent-model';
import type { DraftConfig, PlayerRanking } from '../lib/types';

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

const tightEnd: PlayerRanking = {
  id: 'te-target',
  name: 'TE Target',
  position: 'TE',
  overallRank: 7,
  adp: 8,
  tier: 1,
};

describe('league-specific opponent model', () => {
  it('exposes manager profiles for explicit setup selection', () => {
    const armando = managerProfileOptions.find((option) => option.id === 'Armando');
    expect(armando?.displayName).toBe('Armando');
    expect(armando?.currentTeam).toBe('The Kittle Engine that Could');
    expect(armando?.draftCount).toBeGreaterThanOrEqual(10);
    expect(resolveManagerProfileById('Armando')?.manager_id).toBe('Armando');
  });

  it('matches both manager names and known team names as a fallback', () => {
    expect(resolveManagerProfile('Armando')?.manager_id).toBe('Armando');
    expect(resolveManagerProfile('The Kittle Engine that Could')?.manager_id).toBe('Armando');
    expect(resolveManagerProfile('Team 8')).toBeNull();
  });

  it('uses an explicit manager binding even when the team label is unrelated', () => {
    const managerIds = Array.from({ length: 10 }, () => '');
    managerIds[7] = 'Armando';
    const teamNames = Array.from({ length: 10 }, (_, index) => `Team ${index + 1}`);
    teamNames[7] = 'Completely Different Team Name';

    const signal = opponentHistoryAvailabilitySignal({
      player: tightEnd,
      config,
      currentOverallPick: 7,
      managerIds,
      teamNames,
    });

    expect(signal.matchedManagers).toBe(1);
    expect(signal.adjustment).toBeGreaterThan(0);
    expect(signal.reasons.some((reason) => reason.includes('Armando'))).toBe(true);
  });

  it('adds bounded TE pressure when a historically TE-aggressive manager drafts before the return pick', () => {
    const teamNames = Array.from({ length: 10 }, (_, index) => `Team ${index + 1}`);
    teamNames[7] = 'Armando';

    const signal = opponentHistoryAvailabilitySignal({
      player: tightEnd,
      config,
      currentOverallPick: 7,
      teamNames,
    });

    expect(signal.matchedManagers).toBe(1);
    expect(signal.adjustment).toBeGreaterThan(0);
    expect(signal.adjustment).toBeLessThanOrEqual(14);
    expect(signal.reasons.some((reason) => reason.includes('Armando'))).toBe(true);
  });

  it('leaves recommendations unchanged when opponent labels do not match history', () => {
    const baseline = recommendForCurrentPick({
      players: [tightEnd],
      picks: [],
      config,
      currentOverallPick: 7,
      teamNames: Array.from({ length: 10 }, (_, index) => `Team ${index + 1}`),
      limit: 1,
    });
    const noLabels = recommendForCurrentPick({
      players: [tightEnd],
      picks: [],
      config,
      currentOverallPick: 7,
      limit: 1,
    });

    expect(baseline[0].rawScore).toBe(noLabels[0].rawScore);
    expect(baseline[0].breakdown.futureAvailability).toBe(noLabels[0].breakdown.futureAvailability);
  });

  it('raises future-availability urgency without changing the imported player ranking', () => {
    const managerIds = Array.from({ length: 10 }, () => '');
    managerIds[7] = 'Armando';

    const baseline = recommendForCurrentPick({
      players: [tightEnd],
      picks: [],
      config,
      currentOverallPick: 7,
      limit: 1,
    })[0];
    const modeled = recommendForCurrentPick({
      players: [tightEnd],
      picks: [],
      config,
      currentOverallPick: 7,
      managerIds,
      limit: 1,
    })[0];

    expect(modeled.player.overallRank).toBe(7);
    expect(modeled.breakdown.futureAvailability).toBeGreaterThan(baseline.breakdown.futureAvailability);
    expect(modeled.rawScore - baseline.rawScore).toBeLessThanOrEqual(1);
  });
});

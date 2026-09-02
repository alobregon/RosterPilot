import { describe, expect, it } from 'vitest';
import { backupQbRosterPenalty, recommendForCurrentPick } from '../lib/decision';
import { conditionalAvailabilityPercent, projectUpcomingTargets } from '../lib/targets';
import type { DraftConfig, DraftPick, PlayerRanking } from '../lib/types';

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

const openingPool: PlayerRanking[] = [
  { id: 'gibbs', name: 'Jahmyr Gibbs', position: 'RB', overallRank: 1, adp: 1, tier: 1 },
  { id: 'bijan', name: 'Bijan Robinson', position: 'RB', overallRank: 2, adp: 2, tier: 1 },
  { id: 'chase', name: "Ja'Marr Chase", position: 'WR', overallRank: 3, adp: 3, tier: 1 },
  { id: 'puka', name: 'Puka Nacua', position: 'WR', overallRank: 4, adp: 4, tier: 1 },
  { id: 'jsn', name: 'Jaxon Smith-Njigba', position: 'WR', overallRank: 5, adp: 6, tier: 1 },
  { id: 'amon', name: 'Amon-Ra St. Brown', position: 'WR', overallRank: 6, adp: 8, tier: 1 },
  { id: 'taylor', name: 'Jonathan Taylor', position: 'RB', overallRank: 7, adp: 7, tier: 1 },
  { id: 'cmc', name: 'Christian McCaffrey', position: 'RB', overallRank: 8, adp: 5, tier: 1 },
  { id: 'lamb', name: 'CeeDee Lamb', position: 'WR', overallRank: 9, adp: 11, tier: 1 },
];

describe('pre-turn targeting vs on-clock recommendations', () => {
  it('shows realistic rank-ordered targets before the user is on the clock', () => {
    const targets = projectUpcomingTargets({ players: openingPool, picks: [], config, currentOverallPick: 1 });
    expect(targets.map((target) => target.player.id)).toEqual(['puka', 'jsn', 'amon']);
    expect(targets.some((target) => target.player.id === 'taylor')).toBe(false);
  });

  it('promotes elite players into the target set only after they actually slide', () => {
    const atOne = conditionalAvailabilityPercent(1, 1, 7);
    const atFour = conditionalAvailabilityPercent(1, 4, 7);
    expect(atFour).toBeGreaterThan(atOne);
    const targets = projectUpcomingTargets({ players: openingPool, picks: [], config, currentOverallPick: 4 });
    expect(targets[0].player.id).toBe('gibbs');
  });

  it('does not claim a market fall before the draft reaches the player ADP', () => {
    const result = recommendForCurrentPick({
      players: openingPool,
      picks: [],
      config,
      currentOverallPick: 1,
      favoritePlayerIds: ['gibbs', 'bijan'],
    });
    expect(result.some((item) => item.marketFall != null)).toBe(false);
  });

  it('dampens tier scarcity in round one so higher rankings dominate close positional arguments', () => {
    const result = recommendForCurrentPick({
      players: openingPool,
      picks: [],
      config,
      currentOverallPick: 7,
      favoritePlayerIds: ['gibbs', 'bijan'],
    });
    expect(result.map((item) => item.player.id)).toEqual(['gibbs', 'bijan', 'chase']);
    expect(result.find((item) => item.player.id === 'gibbs')?.marketFall).toBe(6);
  });

  it('strongly suppresses QB2 while skill starters or FLEX are still incomplete', () => {
    const qb2: PlayerRanking = { id: 'qb2', name: 'QB Two', position: 'QB', overallRank: 70, adp: 70, tier: 3 };
    const roster: PlayerRanking[] = [
      { id: 'qb1', name: 'QB One', position: 'QB', overallRank: 20 },
      { id: 'rb1', name: 'RB One', position: 'RB', overallRank: 10 },
      { id: 'wr1', name: 'WR One', position: 'WR', overallRank: 11 },
    ];
    expect(backupQbRosterPenalty(qb2, roster, config, 74)).toBe(12);
  });

  it('keeps a meaningful QB2 penalty at ordinary value after starters are filled', () => {
    const qb2: PlayerRanking = { id: 'qb2', name: 'QB Two', position: 'QB', overallRank: 130, adp: 130, tier: 6 };
    const roster: PlayerRanking[] = [
      { id: 'qb1', name: 'QB One', position: 'QB', overallRank: 20 },
      { id: 'rb1', name: 'RB One', position: 'RB', overallRank: 10 },
      { id: 'rb2', name: 'RB Two', position: 'RB', overallRank: 30 },
      { id: 'rb3', name: 'RB Three', position: 'RB', overallRank: 50 },
      { id: 'wr1', name: 'WR One', position: 'WR', overallRank: 11 },
      { id: 'wr2', name: 'WR Two', position: 'WR', overallRank: 31 },
      { id: 'wr3', name: 'WR Three', position: 'WR', overallRank: 51 },
      { id: 'te1', name: 'TE One', position: 'TE', overallRank: 40 },
    ];
    expect(backupQbRosterPenalty(qb2, roster, config, 134)).toBe(10);
  });

  it('does not hard-ban QB2 when an exceptional value falls multiple rounds', () => {
    const qb2: PlayerRanking = { id: 'qb2', name: 'Falling QB', position: 'QB', overallRank: 90, adp: 92, tier: 4 };
    const roster: PlayerRanking[] = [
      { id: 'qb1', name: 'QB One', position: 'QB', overallRank: 20 },
      { id: 'rb1', name: 'RB One', position: 'RB', overallRank: 10 },
      { id: 'rb2', name: 'RB Two', position: 'RB', overallRank: 30 },
      { id: 'rb3', name: 'RB Three', position: 'RB', overallRank: 50 },
      { id: 'wr1', name: 'WR One', position: 'WR', overallRank: 11 },
      { id: 'wr2', name: 'WR Two', position: 'WR', overallRank: 31 },
      { id: 'wr3', name: 'WR Three', position: 'WR', overallRank: 51 },
      { id: 'te1', name: 'TE One', position: 'TE', overallRank: 40 },
    ];
    expect(backupQbRosterPenalty(qb2, roster, config, 134)).toBe(2);
  });
});

import { describe, expect, it } from 'vitest';
import {
  leagueSummary,
  resizeTeamNames,
  teamDisplayName,
  validateDraftSetup,
} from '../lib/setup';
import type { DraftConfig } from '../lib/types';

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

describe('draft setup', () => {
  it('validates the current 10-team preset', () => {
    expect(validateDraftSetup(config)).toEqual({ valid: true, errors: [] });
  });

  it('rejects an out-of-range user slot and empty starting lineup', () => {
    const invalid: DraftConfig = {
      ...config,
      teamCount: 8,
      userDraftSlot: 9,
      qbStarters: 0,
      rbStarters: 0,
      wrStarters: 0,
      teStarters: 0,
      flexStarters: 0,
      dstStarters: 0,
      kStarters: 0,
    };
    const result = validateDraftSetup(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('draft slot'))).toBe(true);
    expect(result.errors.some((error) => error.includes('starting roster slot'))).toBe(true);
  });

  it('resizes team names without losing existing names', () => {
    expect(resizeTeamNames(['Alpha', 'Bravo'], 4)).toEqual(['Alpha', 'Bravo', '', '']);
    expect(resizeTeamNames(['Alpha', 'Bravo', 'Charlie'], 2)).toEqual(['Alpha', 'Bravo']);
  });

  it('uses custom team names and identifies the user team', () => {
    expect(teamDisplayName(2, 2, ['Alpha', 'Purple Reign'])).toBe('Purple Reign (YOU)');
    expect(teamDisplayName(1, 2, ['Alpha', 'Purple Reign'])).toBe('Alpha');
    expect(teamDisplayName(3, 2, [])).toBe('Team 3');
  });

  it('builds a dynamic league summary', () => {
    expect(leagueSummary(config)).toContain('Half-PPR');
    expect(leagueSummary(config)).toContain('3WR');
    expect(leagueSummary(config)).toContain('6 bench');
  });
});

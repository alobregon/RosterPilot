import { describe, expect, it } from 'vitest';
import { offseasonContextSignalForPlayer } from '../lib/context-signal';
import { recommendForCurrentPick } from '../lib/decision';
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

function player(
  id: string,
  name: string,
  position: PlayerRanking['position'],
  overallRank: number,
  tier?: number,
): PlayerRanking {
  return { id, name, position, overallRank, tier };
}

describe('bounded offseason context signal', () => {
  it('nudges the Amon-Ra vs CMC close call in opposite directions', () => {
    const amon = offseasonContextSignalForPlayer({
      player: player('amon', 'Amon-Ra St. Brown', 'WR', 8, 2),
      bestCandidateRank: 7,
      bestCandidateTier: 2,
      selectionPick: 7,
      teamCount: 10,
    });
    const cmc = offseasonContextSignalForPlayer({
      player: player('cmc', 'Christian McCaffrey', 'RB', 7, 2),
      bestCandidateRank: 7,
      bestCandidateTier: 2,
      selectionPick: 7,
      teamCount: 10,
    });

    expect(amon.adjustment).toBeGreaterThan(0);
    expect(cmc.adjustment).toBeLessThan(0);
    expect(Math.abs(amon.adjustment)).toBeLessThanOrEqual(3);
    expect(Math.abs(cmc.adjustment)).toBeLessThanOrEqual(3);
  });

  it('allows Ladd context to break a close round-four ranking tie', () => {
    const result = recommendForCurrentPick({
      players: [
        player('neutral', 'Neutral Receiver', 'WR', 38, 4),
        player('ladd', 'Ladd McConkey', 'WR', 40, 4),
      ],
      picks: [],
      config,
      currentOverallPick: 34,
      limit: 2,
    });

    const ladd = result.find((item) => item.player.id === 'ladd');
    expect(ladd?.contextAdjustment).toBeGreaterThan(0);
    expect(ladd?.reasons.some((reason) => reason.includes('context boost'))).toBe(true);
    expect(result[0]?.player.id).toBe('ladd');
  });

  it('adds positive mid-round context for Reed and Lemon', () => {
    const reed = offseasonContextSignalForPlayer({
      player: player('reed', 'Jayden Reed', 'WR', 91, 7),
      bestCandidateRank: 88,
      bestCandidateTier: 7,
      selectionPick: 87,
      teamCount: 10,
    });
    const lemon = offseasonContextSignalForPlayer({
      player: player('lemon', 'Makai Lemon', 'WR', 97, 7),
      bestCandidateRank: 95,
      bestCandidateTier: 7,
      selectionPick: 94,
      teamCount: 10,
    });

    expect(reed.adjustment).toBeGreaterThan(0);
    expect(reed.reason).toContain('Sports Illustrated context boost');
    expect(lemon.adjustment).toBeGreaterThan(0);
    expect(lemon.reason).toContain('context boost');
  });

  it('turns the latest Jacobs availability status into a strong caution and Lloyd into an opportunity boost', () => {
    const jacobs = offseasonContextSignalForPlayer({
      player: player('jacobs', 'Josh Jacobs', 'RB', 37, 4),
      bestCandidateRank: 37,
      bestCandidateTier: 4,
      selectionPick: 37,
      teamCount: 10,
    });
    const lloyd = offseasonContextSignalForPlayer({
      player: player('lloyd', 'MarShawn Lloyd', 'RB', 144, 9),
      bestCandidateRank: 144,
      bestCandidateTier: 9,
      selectionPick: 144,
      teamCount: 10,
    });

    expect(jacobs.adjustment).toBeLessThan(0);
    expect(jacobs.reason).toContain('CBS Sports context caution');
    expect(lloyd.adjustment).toBeGreaterThan(0);
    expect(lloyd.reason).toContain('CBS Sports context boost');
  });

  it('treats Allgeier as an injury beneficiary rather than inheriting Love and Conner cautions', () => {
    const allgeier = offseasonContextSignalForPlayer({
      player: player('allgeier', 'Tyler Allgeier', 'RB', 134, 9),
      bestCandidateRank: 134,
      bestCandidateTier: 9,
      selectionPick: 134,
      teamCount: 10,
    });

    expect(allgeier.adjustment).toBeGreaterThan(0);
    expect(allgeier.reason).toContain('Athlon Sports context boost');
  });

  it('blocks a positive article signal from overriding a meaningful early rank and tier gap', () => {
    const jeanty = offseasonContextSignalForPlayer({
      player: player('jeanty', 'Ashton Jeanty', 'RB', 19, 3),
      bestCandidateRank: 14,
      bestCandidateTier: 2,
      selectionPick: 14,
      teamCount: 10,
    });

    expect(jeanty.unboundedAdjustment).toBeGreaterThan(0);
    expect(jeanty.rankDisciplineMultiplier).toBe(0);
    expect(jeanty.adjustment).toBe(0);
    expect(jeanty.reason).toBeUndefined();
  });

  it('does not manufacture context for players without a journal entry', () => {
    const signal = offseasonContextSignalForPlayer({
      player: player('neutral', 'Completely Neutral Player', 'WR', 55, 5),
      bestCandidateRank: 54,
      bestCandidateTier: 5,
      selectionPick: 54,
      teamCount: 10,
    });

    expect(signal.adjustment).toBe(0);
    expect(signal.entryCount).toBe(0);
    expect(signal.reason).toBeUndefined();
  });
});

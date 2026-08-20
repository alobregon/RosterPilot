import { describe, expect, it } from 'vitest';
import { recommendPlayers } from '../lib/recommendation';
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

const players: PlayerRanking[] = [
  { id: 'rb-1', name: 'RB One', position: 'RB', overallRank: 1, tier: 1 },
  { id: 'wr-2', name: 'WR Two', position: 'WR', overallRank: 2, tier: 1 },
  { id: 'wr-3', name: 'WR Three', position: 'WR', overallRank: 3, tier: 2 },
  { id: 'wr-4', name: 'WR Four', position: 'WR', overallRank: 4, tier: 3 },
  { id: 'rb-5', name: 'RB Five', position: 'RB', overallRank: 5, tier: 2 },
  { id: 'qb-6', name: 'QB Six', position: 'QB', overallRank: 6, tier: 1 },
];

describe('recommendation engine', () => {
  it('returns three recommendations with one percentage that sums to 100', () => {
    const result = recommendPlayers({ players, picks: [], config, currentOverallPick: 1 });
    expect(result).toHaveLength(3);
    expect(result.reduce((sum, item) => sum + item.recommendationPercent, 0)).toBe(100);
    expect(result[0].recommendationPercent).toBeGreaterThanOrEqual(result[1].recommendationPercent);
  });

  it('does not recommend drafted players', () => {
    const picks: DraftPick[] = [
      { overallPick: 1, round: 1, pickInRound: 1, draftSlot: 1, playerId: 'rb-1' },
    ];
    const result = recommendPlayers({ players, picks, config, currentOverallPick: 2 });
    expect(result.some((item) => item.player.id === 'rb-1')).toBe(false);
  });

  it('raises DST urgency when a real defense run develops but not after one pick', () => {
    const trendPlayers: PlayerRanking[] = [
      { id: 'rb-a', name: 'RB A', position: 'RB', overallRank: 20, tier: 3 },
      { id: 'dst-a', name: 'DST A', position: 'DST', overallRank: 30, tier: 2 },
      { id: 'dst-b', name: 'DST B', position: 'DST', overallRank: 31, tier: 2 },
      { id: 'dst-c', name: 'DST C', position: 'DST', overallRank: 32, tier: 2 },
      { id: 'dst-d', name: 'DST D', position: 'DST', overallRank: 33, tier: 2 },
    ];
    const onePick: DraftPick[] = [
      { overallPick: 1, round: 1, pickInRound: 1, draftSlot: 1, playerId: 'dst-b' },
    ];
    const one = recommendPlayers({ players: trendPlayers, picks: onePick, config, currentOverallPick: 2, limit: 5 });
    expect(one.find((item) => item.player.id === 'dst-a')?.breakdown.rosterFit).toBe(10);

    const runPicks: DraftPick[] = [
      { overallPick: 1, round: 1, pickInRound: 1, draftSlot: 1, playerId: 'dst-b' },
      { overallPick: 2, round: 1, pickInRound: 2, draftSlot: 2, playerId: 'dst-c' },
      { overallPick: 3, round: 1, pickInRound: 3, draftSlot: 3, playerId: 'dst-d' },
    ];
    const run = recommendPlayers({ players: trendPlayers, picks: runPicks, config, currentOverallPick: 4, limit: 5 });
    expect(run.find((item) => item.player.id === 'dst-a')?.breakdown.rosterFit).toBe(58);
  });

  it('uses bye week as a soft tiebreaker between otherwise equivalent players', () => {
    const byePlayers: PlayerRanking[] = [
      { id: 'roster-rb', name: 'Roster RB', position: 'RB', overallRank: 1, byeWeek: 9 },
      { id: 'roster-wr', name: 'Roster WR', position: 'WR', overallRank: 2, byeWeek: 9 },
      { id: 'roster-te', name: 'Roster TE', position: 'TE', overallRank: 3, byeWeek: 7 },
      { id: 'wr-clean', name: 'WR Clean', position: 'WR', overallRank: 20, tier: 4, byeWeek: 11 },
      { id: 'wr-crowded', name: 'WR Crowded', position: 'WR', overallRank: 20, tier: 4, byeWeek: 9 },
    ];
    const picks: DraftPick[] = [
      { overallPick: 7, round: 1, pickInRound: 7, draftSlot: 7, playerId: 'roster-rb' },
      { overallPick: 14, round: 2, pickInRound: 4, draftSlot: 7, playerId: 'roster-wr' },
      { overallPick: 27, round: 3, pickInRound: 7, draftSlot: 7, playerId: 'roster-te' },
    ];

    const result = recommendPlayers({ players: byePlayers, picks, config, currentOverallPick: 28, limit: 5 });
    const clean = result.find((item) => item.player.id === 'wr-clean');
    const crowded = result.find((item) => item.player.id === 'wr-crowded');
    expect(clean?.breakdown.byeWeekFit).toBe(100);
    expect(crowded?.breakdown.byeWeekFit).toBe(58);
    expect((clean?.rawScore ?? 0)).toBeGreaterThan(crowded?.rawScore ?? 0);
  });

  it('uses favorites as a bounded tiebreaker near fair value', () => {
    const favoritePlayers: PlayerRanking[] = [
      { id: 'wr-ranked-20', name: 'WR Ranked 20', position: 'WR', overallRank: 20, tier: 3, byeWeek: 10 },
      { id: 'wr-favorite-21', name: 'WR Favorite 21', position: 'WR', overallRank: 21, tier: 3, byeWeek: 11 },
    ];

    const withoutFavorite = recommendPlayers({
      players: favoritePlayers,
      picks: [],
      config,
      currentOverallPick: 20,
      limit: 2,
    });
    expect(withoutFavorite[0].player.id).toBe('wr-ranked-20');

    const withFavorite = recommendPlayers({
      players: favoritePlayers,
      picks: [],
      config,
      currentOverallPick: 20,
      favoritePlayerIds: ['wr-favorite-21'],
      limit: 2,
    });
    expect(withFavorite[0].player.id).toBe('wr-favorite-21');
    expect(withFavorite[0].breakdown.favoriteFit).toBeGreaterThan(50);
    expect(withFavorite[0].reasons.some((reason) => reason.includes('Favorite'))).toBe(true);
  });

  it('does not let a favorite force a major reach', () => {
    const favoritePlayers: PlayerRanking[] = [
      { id: 'wr-value', name: 'WR Value', position: 'WR', overallRank: 20, tier: 3 },
      { id: 'wr-reach', name: 'WR Reach', position: 'WR', overallRank: 80, tier: 7 },
    ];

    const result = recommendPlayers({
      players: favoritePlayers,
      picks: [],
      config,
      currentOverallPick: 20,
      favoritePlayerIds: ['wr-reach'],
      limit: 2,
    });

    expect(result[0].player.id).toBe('wr-value');
    expect(result.find((item) => item.player.id === 'wr-reach')?.breakdown.favoriteFit).toBe(51);
  });

});

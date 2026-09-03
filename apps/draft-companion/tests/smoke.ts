import { followingUserOverallPick } from '../lib/draft';
import {
  futureAvailabilityForPlayer,
  opponentPickOpportunities,
  recommendPlayers,
} from '../lib/recommendation';
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
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(followingUserOverallPick(7, config) === 14, '1.07 should return at #14');
const opps = opponentPickOpportunities(7, 14, 10, 7);
assert(JSON.stringify(opps) === JSON.stringify([8, 9, 10, 10, 9, 8]), 'intervening snake slots are wrong');

const players: PlayerRanking[] = [
  { id: 'rb-user', name: 'User RB', position: 'RB', overallRank: 1, tier: 1, byeWeek: 9 },
  { id: 'wr8', name: 'WR 8', position: 'WR', overallRank: 2, tier: 1 },
  { id: 'qb8', name: 'QB 8', position: 'QB', overallRank: 3, tier: 1 },
  { id: 'wr9', name: 'WR 9', position: 'WR', overallRank: 4, tier: 1 },
  { id: 'qb9', name: 'QB 9', position: 'QB', overallRank: 5, tier: 1 },
  { id: 'wr10', name: 'WR 10', position: 'WR', overallRank: 6, tier: 1 },
  { id: 'qb10', name: 'QB 10', position: 'QB', overallRank: 7, tier: 1 },
  { id: 'rb-candidate', name: 'RB Candidate', position: 'RB', overallRank: 25, tier: 3, byeWeek: 11 },
  { id: 'wr-candidate', name: 'WR Candidate', position: 'WR', overallRank: 25, tier: 3, byeWeek: 11 },
  { id: 'te-candidate', name: 'TE Candidate', position: 'TE', overallRank: 25, tier: 3, byeWeek: 11 },
];

const picks: DraftPick[] = [
  { overallPick: 7, round: 1, pickInRound: 7, draftSlot: 7, playerId: 'rb-user' },
  { overallPick: 8, round: 1, pickInRound: 8, draftSlot: 8, playerId: 'wr8' },
  { overallPick: 13, round: 2, pickInRound: 3, draftSlot: 8, playerId: 'qb8' },
  { overallPick: 9, round: 1, pickInRound: 9, draftSlot: 9, playerId: 'wr9' },
  { overallPick: 12, round: 2, pickInRound: 2, draftSlot: 9, playerId: 'qb9' },
  { overallPick: 10, round: 1, pickInRound: 10, draftSlot: 10, playerId: 'wr10' },
  { overallPick: 11, round: 2, pickInRound: 1, draftSlot: 10, playerId: 'qb10' },
];

const availability = futureAvailabilityForPlayer(
  players.find((p) => p.id === 'rb-candidate')!,
  players.filter((p) => !picks.some((pick) => pick.playerId === p.id)),
  picks,
  players,
  config,
  27,
);
assert(availability.returnPick === 34, 'at #27 next return should be #34');
assert(availability.strongNeedTeams === 3, 'teams 8/9/10 should all show strong RB need');

const result = recommendPlayers({ players, picks, config, currentOverallPick: 27, limit: 3 });
assert(result.length === 3, 'expected top 3');
assert(result.every((item) => item.recommendationStrength >= 0 && item.recommendationStrength <= 100), 'top 3 recommendation strengths must stay in range');
assert(result.every((item) => !('strength' in item)), 'public recommendation should expose only one percentage');

console.log(JSON.stringify({ opps, availability, top3: result.map((r) => ({ id: r.player.id, strength: r.recommendationStrength, raw: r.rawScore, reasons: r.reasons })) }, null, 2));

import { draftPickAtOverall } from './corrections';
import { draftSlotForOverallPick } from './draft';
import { recommendPlayers } from './recommendation';
import type { DraftConfig, DraftPick, PlayerRanking, Position } from './types';

export type RoomProfile = 'RANK_ORDER' | 'RB_RUSH' | 'WR_RUSH' | 'QB_RUSH' | 'TE_RUSH' | 'DST_EARLY';

export interface DraftSimulationResult {
  picks: DraftPick[];
  userPlayerIds: string[];
  completed: boolean;
}

export function simulateDraft(args: {
  players: PlayerRanking[];
  config: DraftConfig;
  favoritePlayerIds?: readonly string[];
  roomProfile?: RoomProfile;
}): DraftSimulationResult {
  const { players, config, favoritePlayerIds = [], roomProfile = 'RANK_ORDER' } = args;
  const rosterSlots = config.qbStarters + config.rbStarters + config.wrStarters + config.teStarters + config.flexStarters + config.dstStarters + config.kStarters + config.benchSpots;
  const total = config.teamCount * rosterSlots;
  const picks: DraftPick[] = [];
  const drafted = new Set<string>();
  const userPlayerIds: string[] = [];

  for (let overallPick = 1; overallPick <= total; overallPick += 1) {
    const slot = draftSlotForOverallPick(overallPick, config.teamCount);
    const available = players.filter((player) => !drafted.has(player.id));
    if (available.length === 0) break;

    let selected: PlayerRanking | undefined;
    if (slot === config.userDraftSlot) {
      selected = recommendPlayers({ players, picks, config, currentOverallPick: overallPick, favoritePlayerIds, limit: 1 })[0]?.player;
    } else {
      selected = chooseOpponentPlayer(available, roomProfile, overallPick, config.teamCount);
    }
    if (!selected) break;
    drafted.add(selected.id);
    picks.push(draftPickAtOverall(overallPick, selected.id, config.teamCount));
    if (slot === config.userDraftSlot) userPlayerIds.push(selected.id);
  }

  return { picks, userPlayerIds, completed: picks.length === total };
}

function chooseOpponentPlayer(
  available: PlayerRanking[],
  profile: RoomProfile,
  overallPick: number,
  teamCount: number,
): PlayerRanking {
  const round = Math.floor((overallPick - 1) / teamCount) + 1;
  const preferred = preferredPosition(profile, round);
  const ranked = [...available].sort((a, b) => a.overallRank - b.overallRank);
  if (!preferred) return ranked[0];
  const positional = ranked.filter((player) => player.position === preferred);
  return positional[0] ?? ranked[0];
}

function preferredPosition(profile: RoomProfile, round: number): Position | null {
  if (profile === 'RB_RUSH' && round <= 4) return 'RB';
  if (profile === 'WR_RUSH' && round <= 4) return 'WR';
  if (profile === 'QB_RUSH' && round <= 3) return 'QB';
  if (profile === 'TE_RUSH' && round <= 4) return 'TE';
  if (profile === 'DST_EARLY' && round >= 8 && round <= 10) return 'DST';
  return null;
}

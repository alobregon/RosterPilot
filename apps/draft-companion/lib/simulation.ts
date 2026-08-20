import { draftSlotForOverallPick } from './draft';
import { draftPickAtOverall } from './corrections';
import { recommendPlayers } from './recommendation';
import type { DraftConfig, DraftPick, PlayerRanking, Position, Recommendation } from './types';

export interface UserRecommendationSnapshot {
  overallPick: number;
  recommendations: Recommendation[];
  selectedPlayerId: string;
}

export interface DraftSimulationResult {
  picks: DraftPick[];
  userPlayerIds: string[];
  userCounts: Record<Position, number>;
  userRecommendations: UserRecommendationSnapshot[];
}

export function simulateDeterministicDraft(args: {
  players: PlayerRanking[];
  config: DraftConfig;
  favoritePlayerIds?: readonly string[];
}): DraftSimulationResult {
  const { players, config, favoritePlayerIds = [] } = args;
  const totalRosterSlots =
    config.qbStarters + config.rbStarters + config.wrStarters + config.teStarters +
    config.flexStarters + config.dstStarters + config.kStarters + config.benchSpots;
  const totalPicks = config.teamCount * totalRosterSlots;
  const picks: DraftPick[] = [];
  const draftedIds = new Set<string>();
  const userRecommendations: UserRecommendationSnapshot[] = [];

  for (let overallPick = 1; overallPick <= totalPicks; overallPick += 1) {
    const draftSlot = draftSlotForOverallPick(overallPick, config.teamCount);
    let selected: PlayerRanking | undefined;

    if (draftSlot === config.userDraftSlot) {
      const recommendations = recommendPlayers({
        players,
        picks,
        config,
        currentOverallPick: overallPick,
        favoritePlayerIds,
        limit: 3,
      });
      selected = recommendations[0]?.player;
      if (selected) {
        userRecommendations.push({ overallPick, recommendations, selectedPlayerId: selected.id });
      }
    } else {
      selected = players.find((player) => !draftedIds.has(player.id));
    }

    if (!selected) throw new Error(`No selectable player available at overall pick ${overallPick}.`);
    draftedIds.add(selected.id);
    picks.push(draftPickAtOverall(overallPick, selected.id, config.teamCount));
  }

  const playerById = new Map(players.map((player) => [player.id, player]));
  const userPicks = picks.filter((pick) => pick.draftSlot === config.userDraftSlot);
  const userCounts: Record<Position, number> = { QB: 0, RB: 0, WR: 0, TE: 0, DST: 0, K: 0 };
  for (const pick of userPicks) {
    const player = playerById.get(pick.playerId);
    if (player) userCounts[player.position] += 1;
  }

  return {
    picks,
    userPlayerIds: userPicks.map((pick) => pick.playerId),
    userCounts,
    userRecommendations,
  };
}

export function hasLegalStartingRoster(counts: Record<Position, number>, config: DraftConfig): boolean {
  const skillCount = counts.RB + counts.WR + counts.TE;
  const requiredSkillCount = config.rbStarters + config.wrStarters + config.teStarters + config.flexStarters;
  return (
    counts.QB >= config.qbStarters &&
    counts.RB >= config.rbStarters &&
    counts.WR >= config.wrStarters &&
    counts.TE >= config.teStarters &&
    skillCount >= requiredSkillCount &&
    counts.DST >= config.dstStarters &&
    counts.K >= config.kStarters
  );
}

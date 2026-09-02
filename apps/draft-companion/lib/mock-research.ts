import { draftPickAtOverall } from './corrections';
import { recommendForCurrentPick } from './decision';
import { draftSlotForOverallPick, roundForOverallPick } from './draft';
import { relativeRecommendationPercents } from './recommendation';
import { hasLegalStartingRoster, simulateNextOpponentPick } from './simulation';
import type {
  DraftConfig,
  DraftPick,
  PlayerRanking,
  Position,
  SimulationRoomProfile,
} from './types';

export interface MockResearchDecision {
  overallPick: number;
  round: number;
  selectedPlayerId: string;
  selectedPlayerName: string;
  position: Position;
  overallRank: number;
  tier?: number;
  rankReach: number;
  topRecommendationPercent: number;
  survivalProbability?: number;
  contextAdjustment: number;
  contextChangedWinner: boolean;
  contextChangedTop3Order: boolean;
  noContextWinnerId: string;
  noContextWinnerName: string;
  noContextWinnerRank: number;
  noContextWinnerTier?: number;
  contextTierDrop: number;
}

export interface MockResearchRun {
  seed: string;
  roomProfile: SimulationRoomProfile;
  historicalManagersEnabled: boolean;
  completed: boolean;
  legalStartingRoster: boolean;
  picks: DraftPick[];
  userPlayerIds: string[];
  userCounts: Record<Position, number>;
  decisions: MockResearchDecision[];
}

export function simulateDecisionEngineMock(args: {
  players: PlayerRanking[];
  config: DraftConfig;
  seed: string;
  roomProfile?: SimulationRoomProfile;
  managerIds?: readonly string[];
  favoritePlayerIds?: readonly string[];
}): MockResearchRun {
  const {
    players,
    seed,
    roomProfile = 'RANK_ORDER',
    managerIds = [],
    favoritePlayerIds = [],
  } = args;
  const config: DraftConfig = {
    ...args.config,
    draftMode: 'SIMULATOR',
    simulationRoomProfile: roomProfile,
    simulationSeed: seed,
    historicalManagersEnabled: managerIds.some(Boolean),
  };
  const total = config.teamCount * totalRosterSlots(config);
  let picks: DraftPick[] = [];
  const userPlayerIds: string[] = [];
  const decisions: MockResearchDecision[] = [];

  for (let overallPick = 1; overallPick <= total; overallPick += 1) {
    const slot = draftSlotForOverallPick(overallPick, config.teamCount);
    if (slot === config.userDraftSlot) {
      const recommendations = recommendForCurrentPick({
        players,
        picks,
        config,
        currentOverallPick: overallPick,
        favoritePlayerIds,
        managerIds,
        limit: 12,
      });
      const selected = recommendations[0];
      if (!selected) break;

      const noContext = [...recommendations].sort((a, b) => {
        const aScore = a.rawScore - (a.contextAdjustment ?? 0);
        const bScore = b.rawScore - (b.contextAdjustment ?? 0);
        return bScore - aScore || a.player.overallRank - b.player.overallRank;
      });
      const noContextWinner = noContext[0] ?? selected;
      const withTop3 = recommendations.slice(0, 3).map((item) => item.player.id);
      const noContextTop3 = noContext.slice(0, 3).map((item) => item.player.id);
      const topRecommendationPercent = relativeRecommendationPercents(
        recommendations.slice(0, 3).map((item) => item.rawScore),
      )[0] ?? 100;
      const contextTierDrop = selected.player.tier != null && noContextWinner.player.tier != null
        ? selected.player.tier - noContextWinner.player.tier
        : 0;

      decisions.push({
        overallPick,
        round: roundForOverallPick(overallPick, config.teamCount),
        selectedPlayerId: selected.player.id,
        selectedPlayerName: selected.player.name,
        position: selected.player.position,
        overallRank: selected.player.overallRank,
        tier: selected.player.tier,
        rankReach: selected.player.overallRank - overallPick,
        topRecommendationPercent,
        survivalProbability: selected.survivalProbability,
        contextAdjustment: selected.contextAdjustment ?? 0,
        contextChangedWinner: selected.player.id !== noContextWinner.player.id,
        contextChangedTop3Order: withTop3.some((id, index) => id !== noContextTop3[index]),
        noContextWinnerId: noContextWinner.player.id,
        noContextWinnerName: noContextWinner.player.name,
        noContextWinnerRank: noContextWinner.player.overallRank,
        noContextWinnerTier: noContextWinner.player.tier,
        contextTierDrop,
      });
      userPlayerIds.push(selected.player.id);
      picks = [...picks, draftPickAtOverall(overallPick, selected.player.id, config.teamCount)]
        .sort((a, b) => a.overallPick - b.overallPick);
      continue;
    }

    const next = simulateNextOpponentPick({
      players,
      picks,
      config,
      currentOverallPick: overallPick,
      roomProfile,
      managerIds,
    });
    if (next.length === picks.length) break;
    picks = next;
  }

  const playerById = new Map(players.map((player) => [player.id, player]));
  const userCounts = emptyPositionCounts();
  for (const playerId of userPlayerIds) {
    const player = playerById.get(playerId);
    if (player) userCounts[player.position] += 1;
  }

  return {
    seed,
    roomProfile,
    historicalManagersEnabled: managerIds.some(Boolean),
    completed: picks.length === total,
    legalStartingRoster: hasLegalStartingRoster(userCounts, config),
    picks,
    userPlayerIds,
    userCounts,
    decisions,
  };
}

function totalRosterSlots(config: DraftConfig): number {
  return config.qbStarters
    + config.rbStarters
    + config.wrStarters
    + config.teStarters
    + config.flexStarters
    + config.dstStarters
    + config.kStarters
    + config.benchSpots;
}

function emptyPositionCounts(): Record<Position, number> {
  return { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 };
}

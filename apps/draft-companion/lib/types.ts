export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DST';

export interface RankingSourceMetadata {
  provider?: string;
  upsideRating?: number;
  bustRating?: number;
  strengthOfScheduleRating?: number;
  ecrVsAdp?: number;
  averageDifference?: number;
  percentOverConsensus?: number;
  percentOverCount?: number;
  percentOverTotal?: number;
}

export interface PlayerRanking {
  id: string;
  name: string;
  position: Position;
  nflTeam?: string;
  overallRank: number;
  positionRank?: number;
  tier?: number;
  adp?: number;
  projectedPoints?: number;
  byeWeek?: number;
  notes?: string;
  sourceMetadata?: RankingSourceMetadata;
}

export interface DraftPick {
  overallPick: number;
  round: number;
  pickInRound: number;
  draftSlot: number;
  playerId: string;
}

export interface DraftConfig {
  teamCount: number;
  userDraftSlot: number;
  qbStarters: number;
  rbStarters: number;
  wrStarters: number;
  teStarters: number;
  flexStarters: number;
}

export interface RecommendationBreakdown {
  rankingValue: number;
  rosterFit: number;
  tierUrgency: number;
  valueAtPick: number;
}

export interface Recommendation {
  player: PlayerRanking;
  rawScore: number;
  strength: number;
  breakdown: RecommendationBreakdown;
  reasons: string[];
}

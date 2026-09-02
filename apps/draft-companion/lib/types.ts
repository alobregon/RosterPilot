export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DST';
export type ScoringFormat = 'STANDARD' | 'HALF_PPR' | 'PPR';
export type DraftMode = 'LIVE' | 'SIMULATOR';
export type SimulationRoomProfile = 'RANK_ORDER' | 'RB_RUSH' | 'WR_RUSH' | 'QB_RUSH' | 'TE_RUSH' | 'DST_EARLY';
export type SimulationPace = 'INSTANT' | 'WATCH';
export type DraftStrategy =
  | 'BALANCED'
  | 'HERO_RB'
  | 'ZERO_RB'
  | 'ROBUST_RB'
  | 'WR_HEAVY'
  | 'LATE_QB'
  | 'ELITE_TE'
  | 'UPSIDE_HEAVY';
export type AvailabilityLabel = 'LIKELY' | 'UNCERTAIN' | 'UNLIKELY' | 'FINAL_PICK';
export type PositionTrendStatus = 'QUIET' | 'DEVELOPING' | 'HOT';

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
  adpSource?: 'EXPLICIT' | 'DERIVED_ECR_VS_ADP';
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
  scoringFormat: ScoringFormat;
  qbStarters: number;
  rbStarters: number;
  wrStarters: number;
  teStarters: number;
  flexStarters: number;
  dstStarters: number;
  kStarters: number;
  benchSpots: number;
  draftStrategy?: DraftStrategy;
  /** Legacy combined toggle retained so older v1 snapshots still restore. */
  opponentDetailsEnabled?: boolean;
  /** Enables editable team labels. Saved labels are retained while disabled. */
  teamNamesEnabled?: boolean;
  /** Enables Purple League historical-manager assignments and V1 modeling. */
  historicalManagersEnabled?: boolean;
  /** Live manual entry or interactive mock-draft simulator. */
  draftMode?: DraftMode;
  /** Opponent behavior used only by interactive simulator mode. */
  simulationRoomProfile?: SimulationRoomProfile;
  /** Whether simulated opponent picks fill immediately or visibly one at a time. */
  simulationPace?: SimulationPace;
  /** Per-mock seed: stable inside one simulation, regenerated for each new mock. */
  simulationSeed?: string;
}

export interface RecommendationBreakdown {
  rankingValue: number;
  rosterFit: number;
  tierUrgency: number;
  valueAtPick: number;
  byeWeekFit: number;
  futureAvailability: number;
  strategyFit: number;
  favoriteFit: number;
}

export interface Recommendation {
  player: PlayerRanking;
  rawScore: number;
  recommendationPercent: number;
  availabilityLabel: AvailabilityLabel;
  returnPick?: number;
  survivalProbability?: number;
  positionTrend: PositionTrendStatus;
  marketFall?: number;
  /** Bounded +/-3 raw-score tie-breaker derived from curated offseason context. */
  contextAdjustment?: number;
  breakdown: RecommendationBreakdown;
  reasons: string[];
}

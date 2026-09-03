import {
  getOffseasonContextForPlayers,
  getOffseasonContextSource,
} from './offseason-context';
import type {
  DraftConfig,
  DraftPick,
  PlayerRanking,
  Position,
  Recommendation,
  RecommendationAnalysis,
  RecommendationEvidence,
} from './types';

export interface RecommendationNarrativeCandidate {
  playerId: string;
  playerName: string;
  position: Position;
  nflTeam?: string;
  overallRank: number;
  recommendationStrength: number;
  isTopPick: boolean;
  reasons: string[];
  evidence: RecommendationEvidence[];
  fallback: Pick<RecommendationAnalysis, 'verdict' | 'why' | 'rosterImpact' | 'caution'>;
}

export interface RecommendationNarrativeRequest {
  currentOverallPick: number;
  league: {
    teamCount: number;
    scoringFormat: DraftConfig['scoringFormat'];
    starters: Pick<DraftConfig, 'qbStarters' | 'rbStarters' | 'wrStarters' | 'teStarters' | 'flexStarters'>;
    strategy: NonNullable<DraftConfig['draftStrategy']>;
  };
  roster: Array<Pick<PlayerRanking, 'id' | 'name' | 'position' | 'overallRank'>>;
  recommendations: RecommendationNarrativeCandidate[];
}

export interface AiRecommendationNarrative {
  playerId: string;
  verdict: string;
  why: string;
  rosterImpact: string;
  caution: string | null;
  evidenceIds: string[];
}

/**
 * Attach a complete, evidence-grounded rules narrative to every recommendation.
 * This is the always-available experience; the optional OpenAI layer can improve
 * wording but never owns scoring, ordering, or the underlying facts.
 */
export function attachRecommendationAnalyses(args: {
  recommendations: Recommendation[];
  players: PlayerRanking[];
  picks: DraftPick[];
  config: DraftConfig;
  currentOverallPick: number;
}): Recommendation[] {
  const { recommendations, players, picks, config, currentOverallPick } = args;
  const playerById = new Map(players.map((player) => [player.id, player]));
  const userRoster = picks
    .filter((pick) => pick.draftSlot === config.userDraftSlot)
    .map((pick) => playerById.get(pick.playerId))
    .filter((player): player is PlayerRanking => Boolean(player));

  return recommendations.map((recommendation, index) => ({
    ...recommendation,
    analysis: deterministicAnalysis({
      recommendation,
      index,
      userRoster,
      currentOverallPick,
    }),
  }));
}

export function buildRecommendationNarrativeRequest(args: {
  recommendations: Recommendation[];
  roster: PlayerRanking[];
  config: DraftConfig;
  currentOverallPick: number;
}): RecommendationNarrativeRequest {
  const { recommendations, roster, config, currentOverallPick } = args;
  return {
    currentOverallPick,
    league: {
      teamCount: config.teamCount,
      scoringFormat: config.scoringFormat,
      starters: {
        qbStarters: config.qbStarters,
        rbStarters: config.rbStarters,
        wrStarters: config.wrStarters,
        teStarters: config.teStarters,
        flexStarters: config.flexStarters,
      },
      strategy: config.draftStrategy ?? 'BALANCED',
    },
    roster: roster.map(({ id, name, position, overallRank }) => ({ id, name, position, overallRank })),
    recommendations: recommendations.map((recommendation, index) => {
      const fallback = recommendation.analysis ?? deterministicAnalysis({
        recommendation,
        index,
        userRoster: roster,
        currentOverallPick,
      });
      return {
        playerId: recommendation.player.id,
        playerName: recommendation.player.name,
        position: recommendation.player.position,
        nflTeam: recommendation.player.nflTeam,
        overallRank: recommendation.player.overallRank,
        recommendationStrength: recommendation.recommendationStrength,
        isTopPick: index === 0,
        reasons: recommendation.reasons,
        evidence: fallback.evidence,
        fallback: {
          verdict: fallback.verdict,
          why: fallback.why,
          rosterImpact: fallback.rosterImpact,
          caution: fallback.caution,
        },
      };
    }),
  };
}

export function mergeAiRecommendationNarratives(
  recommendations: Recommendation[],
  narratives: readonly AiRecommendationNarrative[],
): Recommendation[] {
  const byPlayer = new Map(narratives.map((narrative) => [narrative.playerId, narrative]));
  return recommendations.map((recommendation) => {
    const narrative = byPlayer.get(recommendation.player.id);
    const fallback = recommendation.analysis;
    if (!narrative || !fallback) return recommendation;
    const allowedEvidenceIds = new Set(fallback.evidence.map((evidence) => evidence.id));
    return {
      ...recommendation,
      analysis: {
        ...fallback,
        verdict: narrative.verdict,
        why: narrative.why,
        rosterImpact: narrative.rosterImpact,
        caution: narrative.caution ?? undefined,
        evidenceIds: narrative.evidenceIds.filter((id) => allowedEvidenceIds.has(id)),
        source: 'OPENAI',
      },
    };
  });
}

function deterministicAnalysis(args: {
  recommendation: Recommendation;
  index: number;
  userRoster: PlayerRanking[];
  currentOverallPick: number;
}): RecommendationAnalysis {
  const { recommendation, index, userRoster, currentOverallPick } = args;
  const evidence = recommendationEvidence(recommendation.player);
  const positiveEvidence = evidence.find((item) => item.kind === 'FACT') ?? evidence[0];
  const context = positiveEvidence ? ensureSentence(positiveEvidence.summary) : '';
  const value = valueSentence(recommendation.player, currentOverallPick);
  const reason = recommendation.reasons[0]
    ? ensureSentence(recommendation.reasons[0])
    : 'The profile balances ranking value with roster construction.';
  const why = [context, value || reason].filter(Boolean).join(' ');
  const cautionEntry = getOffseasonContextForPlayers([recommendation.player.name], 8).find(
    (entry) => entry.outlook?.direction === 'NEGATIVE' || entry.outlook?.direction === 'MIXED_NEGATIVE',
  );

  return {
    verdict: index === 0 ? 'This is my pick.' : index === 1 ? 'Strong alternative.' : 'Upside alternative.',
    why,
    rosterImpact: rosterImpactSentence(recommendation.player, userRoster),
    caution: cautionEntry?.outlook ? ensureSentence(cautionEntry.outlook.summary) : undefined,
    evidenceIds: evidence.map((item) => item.id),
    evidence,
    source: 'RULES',
  };
}

function recommendationEvidence(player: PlayerRanking): RecommendationEvidence[] {
  const result: RecommendationEvidence[] = [];
  const seen = new Set<string>();
  for (const entry of getOffseasonContextForPlayers([player.name], 8)) {
    entry.facts.forEach((fact, factIndex) => {
      if (seen.has(fact.summary)) return;
      const source = fact.sourceIds.map(getOffseasonContextSource).find((candidate) => candidate?.status === 'INGESTED');
      if (!source) return;
      seen.add(fact.summary);
      result.push({
        id: `${entry.id}:fact:${factIndex}`,
        kind: 'FACT',
        summary: fact.summary,
        publisher: source.publisher,
        title: source.title,
        url: source.url,
      });
    });
    if (entry.outlook && !seen.has(entry.outlook.summary)) {
      const sourceId = entry.facts.flatMap((fact) => fact.sourceIds)[0];
      const source = sourceId ? getOffseasonContextSource(sourceId) : undefined;
      if (source?.status === 'INGESTED') {
        seen.add(entry.outlook.summary);
        result.push({
          id: `${entry.id}:outlook`,
          kind: 'OUTLOOK',
          summary: entry.outlook.summary,
          publisher: source.publisher,
          title: source.title,
          url: source.url,
        });
      }
    }
    if (result.length >= 4) break;
  }
  return result.slice(0, 4);
}

function valueSentence(player: PlayerRanking, currentOverallPick: number): string {
  const difference = player.overallRank - currentOverallPick;
  if (Math.abs(difference) <= 3) {
    return `Your rankings put ${player.name} right in range at pick #${currentOverallPick}.`;
  }
  if (difference < -3) {
    return `${player.name} is ${Math.abs(difference)} spots past your ranking at pick #${currentOverallPick}.`;
  }
  return difference <= 7
    ? `${player.name} is within the same draft range at pick #${currentOverallPick}.`
    : '';
}

function rosterImpactSentence(player: PlayerRanking, userRoster: PlayerRanking[]): string {
  const after = [...userRoster, player];
  const samePosition = after.filter((candidate) => candidate.position === player.position);
  const rbAnchor = bestAtPosition(after, 'RB');
  const wrAnchor = bestAtPosition(after, 'WR');

  if (player.position === 'WR' && samePosition.length === 2 && rbAnchor) {
    return `Pairing ${samePosition[0].name} + ${samePosition[1].name} gives you two strong WRs while ${rbAnchor.name} anchors RB.`;
  }
  if (player.position === 'RB' && samePosition.length === 2 && wrAnchor) {
    return `Pairing ${samePosition[0].name} + ${samePosition[1].name} gives you two strong RBs while ${wrAnchor.name} anchors WR.`;
  }
  if (player.position === 'WR' && samePosition.length > 1) {
    return `${player.name} gives you ${samePosition.length} WR options for a league that starts three receivers.`;
  }
  if (player.position === 'RB' && samePosition.length > 1) {
    return `${player.name} gives you ${samePosition.length} RB options and strengthens a high-variance position.`;
  }
  if (player.position === 'QB' || player.position === 'TE') {
    const label = player.position === 'QB' ? 'quarterback' : 'tight end';
    return samePosition.length === 1
      ? `${player.name} fills your starting ${label} spot without changing the rest of your core.`
      : `${player.name} adds depth at ${label} behind ${samePosition[0].name}.`;
  }
  if (player.position === 'DST' || player.position === 'K') {
    return `${player.name} fills your ${player.position} requirement while preserving the skill-position core you built.`;
  }
  return `${player.name} becomes the first ${player.position} anchor on your roster.`;
}

function bestAtPosition(roster: PlayerRanking[], position: Position): PlayerRanking | undefined {
  return roster
    .filter((player) => player.position === position)
    .sort((a, b) => a.overallRank - b.overallRank)[0];
}

function ensureSentence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const sentence = trimmed[0].toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

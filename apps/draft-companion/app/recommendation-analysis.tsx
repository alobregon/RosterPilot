import type { Recommendation } from '@/lib/types';

export function RecommendationAnalysis({
  recommendation,
  isTopPick,
}: {
  recommendation: Recommendation;
  isTopPick: boolean;
}) {
  const analysis = recommendation.analysis;
  if (!analysis) {
    return <ul>{recommendation.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>;
  }

  const usedEvidence = analysis.evidence.filter(
    (evidence) => analysis.source === 'RULES' || analysis.evidenceIds.includes(evidence.id),
  );
  const sources = [...new Map(
    usedEvidence
      .filter((evidence) => evidence.url && evidence.publisher)
      .map((evidence) => [evidence.url, evidence]),
  ).values()];

  return <div className="recommendationAnalysis">
    <p className="recommendationVerdict">{analysis.verdict}{isTopPick ? ' ⭐' : ''}</p>
    <p>{analysis.why}</p>
    <p>{analysis.rosterImpact}</p>
    {analysis.caution ? <p className="recommendationCaution"><strong>Watch:</strong> {analysis.caution}</p> : null}
    {sources.length ? <div className="recommendationSources">
      <span>Sources:</span>
      {sources.map((source) => <a
        href={source.url}
        target="_blank"
        rel="noreferrer"
        title={source.title}
        key={source.url}
      >{source.publisher}</a>)}
    </div> : null}
    <details className="recommendationDetails">
      <summary>Engine signals</summary>
      <ul>{recommendation.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
    </details>
  </div>;
}

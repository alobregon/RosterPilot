'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { DraftUi, type DraftUiProps } from './draft-ui';
import { managerProfileOptions } from '@/lib/opponent-model';
import type { AvailabilityLabel } from '@/lib/types';
import type { UpcomingTarget } from '@/lib/targets';

const ROUND_COLUMN_WIDTH = 64;
const MIN_TEAM_COLUMN_WIDTH = 122;

type DraftUiWithTargetsProps = DraftUiProps & {
  targets: UpcomingTarget[];
  managerIds: string[];
  onManagerId: (index: number, value: string) => void;
};

export function DraftUiWithTargets(props: DraftUiWithTargetsProps) {
  const targetMode = props.started && !props.complete && !props.correcting && !props.onClock;
  const [host, setHost] = useState<Element | null>(null);
  const [setupHost, setSetupHost] = useState<Element | null>(null);
  const boardMinWidth = ROUND_COLUMN_WIDTH + props.config.teamCount * MIN_TEAM_COLUMN_WIDTH;

  useEffect(() => {
    setHost(targetMode || props.onClock ? document.querySelector('.sideStack') : null);
    setSetupHost(document.querySelector('.teamNamesSection'));
  }, [targetMode, props.onClock, props.currentOverallPick, props.config.teamCount, props.started]);

  const { targets, managerIds, onManagerId, ...draftUiProps } = props;

  return <>
    <style>{`.draftBoardHeader,.draftBoardRow{min-width:${boardMinWidth}px;width:max(100%,${boardMinWidth}px)}`}</style>
    {targetMode || props.onClock ? <style>{'.recommendationPanel{display:none}'}</style> : null}
    <DraftUi {...draftUiProps} recs={props.onClock ? props.recs : []} />
    {setupHost ? createPortal(
      <ManagerSelector
        teamCount={props.config.teamCount}
        userDraftSlot={props.config.userDraftSlot}
        managerIds={managerIds}
        disabled={props.started}
        onManagerId={onManagerId}
      />,
      setupHost,
    ) : null}
    {props.onClock && host ? createPortal(<CalibratedRecommendations props={props} />, host) : null}
    {targetMode && host ? createPortal(<TargetsPanel targets={targets} nextPick={props.nextUserPick} />, host) : null}
  </>;
}

function ManagerSelector({
  teamCount,
  userDraftSlot,
  managerIds,
  disabled,
  onManagerId,
}: {
  teamCount: number;
  userDraftSlot: number;
  managerIds: string[];
  disabled: boolean;
  onManagerId: (index: number, value: string) => void;
}) {
  const selectedIds = new Set(managerIds.filter(Boolean));

  return <div style={{ borderTop: '1px solid var(--border)', marginTop: 14, paddingTop: 14 }}>
    <div className="teamNamesHeader">
      <div>
        <strong>Historical managers</strong>
        <span className="muted">Optional. Explicit assignments power Purple League opponent modeling.</span>
      </div>
      <span className="countPill">{managerIds.filter(Boolean).length}/{teamCount} assigned</span>
    </div>
    <div className="teamNameGrid">
      {Array.from({ length: teamCount }, (_, index) => {
        const selected = managerProfileOptions.find((option) => option.id === managerIds[index]);
        const isUser = index + 1 === userDraftSlot;
        return <label className={isUser ? 'teamNameField userTeamName' : 'teamNameField'} key={index}>
          <span>Slot {index + 1}{isUser ? ' • YOU' : ''}</span>
          <select
            disabled={disabled}
            value={managerIds[index] ?? ''}
            onChange={(event) => onManagerId(index, event.target.value)}
            style={{ width: '100%', minWidth: 0, border: 0, outline: 0, color: 'var(--text)', background: 'transparent', padding: '2px 0' }}
          >
            <option value="">Unassigned</option>
            {managerProfileOptions.map((option) => (
              <option
                value={option.id}
                key={option.id}
                disabled={selectedIds.has(option.id) && option.id !== managerIds[index]}
              >
                {option.displayName}
              </option>
            ))}
          </select>
          <small style={{ color: 'var(--muted)', lineHeight: 1.35 }}>
            {selected
              ? `${selected.currentTeam ?? 'No 2025 team'} • ${selected.draftCount} seasons of draft history ✓`
              : isUser
                ? 'Your assignment is optional; opponent modeling ignores your own slot.'
                : 'No historical behavior applied.'}
          </small>
        </label>;
      })}
    </div>
  </div>;
}

function CalibratedRecommendations({ props }: { props: DraftUiWithTargetsProps }) {
  return <section className="panel recommendationPanel calibratedRecommendationPanel" style={{ display: 'block', order: -1 }}>
    <div className="panelHeader">
      <div><span className="eyebrow">Decision engine</span><h2>Top 3</h2></div>
      <span className="countPill">Recommendation %</span>
    </div>
    <p className="muted" style={{ margin: '-4px 0 12px' }}>Return probability is calibrated separately from recommendation strength.</p>
    {props.recs.length ? <div className="recommendationList">{props.recs.map((recommendation, index) => <article className="recommendation" key={recommendation.player.id}>
      <div className="recommendationTopline">
        <span className="medal">#{index + 1}</span>
        <div><strong>{props.favorites.has(recommendation.player.id) ? '★ ' : ''}{recommendation.player.name}</strong><small>{recommendation.player.position} • Rank {recommendation.player.overallRank}</small></div>
        <span className="score">{recommendation.recommendationPercent}%</span>
      </div>
      <div className="scoreTrack"><span style={{ width: `${recommendation.recommendationPercent}%` }} /></div>
      <div className="recommendationSignals">
        {recommendation.survivalProbability != null
          ? <span
              className={`signalChip availability ${recommendation.availabilityLabel.toLowerCase()}`}
              title="Calibrated from 2018–2025 market ADP, picks to survive, and opponent roster need. Manager identity is excluded from this percentage."
            >
              {Math.round(recommendation.survivalProbability * 100)}% chance back{recommendation.returnPick ? ` by #${recommendation.returnPick}` : ''}
            </span>
          : <span className={`signalChip availability ${recommendation.availabilityLabel.toLowerCase()}`}>{availabilitySignal(recommendation.availabilityLabel, recommendation.returnPick)}</span>}
        {recommendation.positionTrend !== 'QUIET' ? <span className="signalChip">{recommendation.positionTrend === 'HOT' ? '🔥' : '↗'} {recommendation.player.position} run</span> : null}
        {recommendation.marketFall != null ? <span className="signalChip">Market fall +{Math.round(recommendation.marketFall)}</span> : null}
        {recommendation.breakdown.rosterFit >= 90 ? <span className="signalChip">Starter need</span> : null}
        {props.favorites.has(recommendation.player.id) ? <span className="signalChip favorite">★ Favorite</span> : null}
        {(props.config.draftStrategy ?? 'BALANCED') !== 'BALANCED' && recommendation.breakdown.strategyFit >= 85 ? <span className="signalChip">{props.strategyLabel} fit</span> : null}
      </div>
      <button className="secondaryButton" onClick={() => props.onDraft(recommendation.player)} aria-label={`Draft ${recommendation.player.name} for my team`}>Draft for my team</button>
      <ul>{recommendation.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
    </article>)}</div> : <div className="emptyState">No recommendations available.</div>}
  </section>;
}

function TargetsPanel({ targets, nextPick }: { targets: UpcomingTarget[]; nextPick: number | null }) {
  return <section className="panel targetPanel" style={{ order: -1 }}>
    <div className="panelHeader">
      <div><span className="eyebrow">Draft plan</span><h2>Targets for #{nextPick ?? '—'}</h2></div>
      <span className="countPill">Est. availability</span>
    </div>
    {targets.length ? <div className="recommendationList">{targets.map((target, index) => <article className="recommendation" key={target.player.id}>
      <div className="recommendationTopline">
        <span className="medal">#{index + 1}</span>
        <div><strong>{target.player.name}</strong><small>{target.player.position} • Rank {target.player.overallRank}</small></div>
        <span className="score">{target.availabilityPercent}%</span>
      </div>
      <div className="scoreTrack"><span style={{ width: `${target.availabilityPercent}%` }} /></div>
      <div className="recommendationSignals">
        <span className={`signalChip availability ${target.availabilityLabel === 'LIKELY' ? 'likely' : target.availabilityLabel === 'POSSIBLE' ? 'uncertain' : 'unlikely'}`}>
          {target.availabilityLabel === 'LIKELY' ? `Likely at #${target.targetPick}` : target.availabilityLabel === 'POSSIBLE' ? `Possible at #${target.targetPick}` : `Long shot at #${target.targetPick}`}
        </span>
        {target.player.adp != null ? <span className="signalChip">ADP {Math.round(target.player.adp)}</span> : null}
      </div>
      <ul>{target.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
    </article>)}</div> : <div className="emptyState">No realistic targets yet. This updates as players come off the board.</div>}
  </section>;
}

function availabilitySignal(label: AvailabilityLabel, returnPick?: number) {
  if (label === 'UNLIKELY') return returnPick ? `Unlikely back by #${returnPick}` : 'Unlikely to return';
  if (label === 'LIKELY') return returnPick ? `Likely back by #${returnPick}` : 'Likely to return';
  if (label === 'UNCERTAIN') return returnPick ? `Return uncertain by #${returnPick}` : 'Return uncertain';
  return 'Final selection';
}

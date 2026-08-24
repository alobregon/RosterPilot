'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { DraftUi, type DraftUiProps } from './draft-ui';
import { managerProfileOptions } from '@/lib/opponent-model';
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
    setHost(targetMode ? document.querySelector('.sideStack') : null);
    setSetupHost(document.querySelector('.teamNamesSection'));
  }, [targetMode, props.currentOverallPick, props.config.teamCount, props.started]);

  const { targets, managerIds, onManagerId, ...draftUiProps } = props;

  return <>
    <style>{`.draftBoardHeader,.draftBoardRow{min-width:${boardMinWidth}px;width:max(100%,${boardMinWidth}px)}`}</style>
    {targetMode ? <style>{'.recommendationPanel{display:none}'}</style> : null}
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

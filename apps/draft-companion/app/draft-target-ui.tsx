'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { DraftUi, type DraftUiProps } from './draft-ui';
import { managerProfileOptions } from '@/lib/opponent-model';
import type {
  AvailabilityLabel,
  DraftMode,
  SimulationPace,
  SimulationRoomProfile,
} from '@/lib/types';
import type { UpcomingTarget } from '@/lib/targets';

const ROUND_COLUMN_WIDTH = 64;
const MIN_TEAM_COLUMN_WIDTH = 122;

const ROOM_PROFILES: Array<[SimulationRoomProfile, string]> = [
  ['RANK_ORDER', 'Normal / rank order'],
  ['RB_RUSH', 'Early RB rush'],
  ['WR_RUSH', 'Early WR rush'],
  ['QB_RUSH', 'Early QB rush'],
  ['TE_RUSH', 'Early TE rush'],
  ['DST_EARLY', 'Early DST room'],
];

type DraftUiWithTargetsProps = DraftUiProps & {
  targets: UpcomingTarget[];
  managerIds: string[];
  useTeamNames: boolean;
  useHistoricalManagers: boolean;
  onManagerId: (index: number, value: string) => void;
  onUseTeamNames: (enabled: boolean) => void;
  onUseHistoricalManagers: (enabled: boolean) => void;
  onDraftMode: (value: DraftMode) => void;
  onSimulationRoomProfile: (value: SimulationRoomProfile) => void;
  onSimulationPace: (value: SimulationPace) => void;
};

export function DraftUiWithTargets(props: DraftUiWithTargetsProps) {
  const targetMode = props.started && !props.complete && !props.correcting && !props.onClock;
  const [host, setHost] = useState<Element | null>(null);
  const [setupHost, setSetupHost] = useState<Element | null>(null);
  const [modeHost, setModeHost] = useState<Element | null>(null);
  const boardMinWidth = ROUND_COLUMN_WIDTH + props.config.teamCount * MIN_TEAM_COLUMN_WIDTH;

  useEffect(() => {
    setHost(targetMode || props.onClock ? document.querySelector('.sideStack') : null);
    setSetupHost(document.querySelector('.teamNamesSection'));
    setModeHost(document.querySelector('.setupPrimaryControls'));
  }, [targetMode, props.onClock, props.currentOverallPick, props.config.teamCount, props.started, props.useTeamNames, props.useHistoricalManagers]);

  const {
    targets,
    managerIds,
    useTeamNames,
    useHistoricalManagers,
    onManagerId,
    onUseTeamNames,
    onUseHistoricalManagers,
    onDraftMode,
    onSimulationRoomProfile,
    onSimulationPace,
    ...draftUiProps
  } = props;

  const opponentDetailsStyle = `
    .teamNamesSection{display:flex;flex-direction:column}
    .opponentSetupToggles{order:-2}
    .teamNamesSection>.teamNamesHeader{order:-1}
    .teamNamesSection>.teamNameGrid{order:0}
    .historicalManagersSection{order:1}
    ${useTeamNames ? '' : '.teamNamesSection>.teamNamesHeader,.teamNamesSection>.teamNameGrid{display:none}'}
  `;

  return <>
    <style>{`.draftBoardHeader,.draftBoardRow{min-width:${boardMinWidth}px;width:max(100%,${boardMinWidth}px)}${opponentDetailsStyle}`}</style>
    {targetMode || props.onClock ? <style>{'.recommendationPanel{display:none}'}</style> : null}
    <DraftUi {...draftUiProps} recs={props.onClock ? props.recs : []} />
    {modeHost ? createPortal(
      <SimulatorControls
        mode={props.config.draftMode ?? 'LIVE'}
        roomProfile={props.config.simulationRoomProfile ?? 'RANK_ORDER'}
        pace={props.config.simulationPace ?? 'INSTANT'}
        disabled={props.started}
        onMode={onDraftMode}
        onRoomProfile={onSimulationRoomProfile}
        onPace={onSimulationPace}
      />,
      modeHost,
    ) : null}
    {setupHost ? createPortal(
      <OpponentSetupToggles
        teamNamesEnabled={useTeamNames}
        historicalManagersEnabled={useHistoricalManagers}
        disabled={props.started}
        onTeamNames={onUseTeamNames}
        onHistoricalManagers={onUseHistoricalManagers}
      />,
      setupHost,
    ) : null}
    {setupHost && useHistoricalManagers ? createPortal(
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

function SimulatorControls({
  mode,
  roomProfile,
  pace,
  disabled,
  onMode,
  onRoomProfile,
  onPace,
}: {
  mode: DraftMode;
  roomProfile: SimulationRoomProfile;
  pace: SimulationPace;
  disabled: boolean;
  onMode: (value: DraftMode) => void;
  onRoomProfile: (value: SimulationRoomProfile) => void;
  onPace: (value: SimulationPace) => void;
}) {
  return <>
    <label>
      Mode
      <select value={mode} disabled={disabled} onChange={(event) => onMode(event.target.value as DraftMode)}>
        <option value="LIVE">Live Draft</option>
        <option value="SIMULATOR">Draft Simulator</option>
      </select>
    </label>
    {mode === 'SIMULATOR' ? <>
      <label>
        Room
        <select value={roomProfile} disabled={disabled} onChange={(event) => onRoomProfile(event.target.value as SimulationRoomProfile)}>
          {ROOM_PROFILES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select>
      </label>
      <label>
        Pace
        <select value={pace} disabled={disabled} onChange={(event) => onPace(event.target.value as SimulationPace)}>
          <option value="INSTANT">Instant to my pick</option>
          <option value="WATCH">Watch picks</option>
        </select>
      </label>
    </> : null}
  </>;
}

function OpponentSetupToggles({
  teamNamesEnabled,
  historicalManagersEnabled,
  disabled,
  onTeamNames,
  onHistoricalManagers,
}: {
  teamNamesEnabled: boolean;
  historicalManagersEnabled: boolean;
  disabled: boolean;
  onTeamNames: (enabled: boolean) => void;
  onHistoricalManagers: (enabled: boolean) => void;
}) {
  return <div
    className="opponentSetupToggles"
    style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(220px, 1fr) repeat(2, minmax(210px, auto))',
      alignItems: 'center',
      gap: 14,
      padding: '2px 0 14px',
    }}
  >
    <div style={{ display: 'grid', gap: 2 }}>
      <strong>Optional opponent setup</strong>
      <small className="muted">
        {historicalManagersEnabled && !teamNamesEnabled
          ? 'Selected manager names will be used as the team labels.'
          : 'Add only the opponent information you want to maintain.'}
      </small>
    </div>
    <ToggleOption
      label="Team names"
      detail="Custom labels only; no history effect."
      checked={teamNamesEnabled}
      disabled={disabled}
      onChange={onTeamNames}
    />
    <ToggleOption
      label="Historical manager data"
      detail="Enables Purple League V1 tendencies."
      checked={historicalManagersEnabled}
      disabled={disabled}
      onChange={onHistoricalManagers}
    />
  </div>;
}

function ToggleOption({
  label,
  detail,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  detail: string;
  checked: boolean;
  disabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, cursor: disabled ? 'default' : 'pointer' }}>
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
      style={{ width: 18, height: 18, marginTop: 1, accentColor: 'var(--accent)' }}
    />
    <span style={{ display: 'grid', gap: 2 }}>
      <strong style={{ fontSize: '.82rem' }}>{label}</strong>
      <small className="muted">{detail}</small>
    </span>
  </label>;
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

  return <div className="historicalManagersSection" style={{ borderTop: '1px solid var(--border)', marginTop: 14, paddingTop: 14 }}>
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

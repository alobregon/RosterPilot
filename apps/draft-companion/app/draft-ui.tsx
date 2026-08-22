'use client';

import { useEffect, useRef, type ChangeEvent } from 'react';
import { rosterSize, type DraftBoardCell } from '@/lib/board';
import { draftSlotForOverallPick } from '@/lib/draft';
import { teamDisplayName } from '@/lib/setup';
import type {
  AvailabilityLabel,
  DraftConfig,
  DraftPick,
  DraftStrategy,
  PlayerRanking,
  Recommendation,
  ScoringFormat,
} from '@/lib/types';

export type PlayerFilter = 'ALL' | 'FAVORITES' | 'DRAFTED' | PlayerRanking['position'];
export type PlayerSort = 'RANK' | 'ADP' | 'NAME';
export type Correction = { overallPick: number; originalPick: DraftPick };

export const FILTERS: PlayerFilter[] = ['ALL', 'FAVORITES', 'DRAFTED', 'QB', 'RB', 'WR', 'TE', 'K', 'DST'];
export const STRATEGIES: Array<[DraftStrategy, string]> = [
  ['BALANCED', 'Balanced'], ['HERO_RB', 'Hero RB'], ['ZERO_RB', 'Zero RB'], ['ROBUST_RB', 'Robust RB'],
  ['WR_HEAVY', 'WR Heavy'], ['LATE_QB', 'Late QB'], ['ELITE_TE', 'Elite TE'], ['UPSIDE_HEAVY', 'Upside Heavy'],
];
export const ROSTER: Array<[
  keyof Pick<DraftConfig, 'qbStarters' | 'rbStarters' | 'wrStarters' | 'teStarters' | 'flexStarters' | 'dstStarters' | 'kStarters' | 'benchSpots'>,
  string,
  number,
]> = [
  ['qbStarters', 'QB', 10], ['rbStarters', 'RB', 10], ['wrStarters', 'WR', 10], ['teStarters', 'TE', 10],
  ['flexStarters', 'FLEX', 10], ['dstStarters', 'DST', 10], ['kStarters', 'K', 10], ['benchSpots', 'Bench', 20],
];

export interface DraftUiProps {
  config: DraftConfig;
  players: PlayerRanking[];
  picks: DraftPick[];
  favorites: Set<string>;
  teamNames: string[];
  started: boolean;
  correction: Correction | null;
  correcting: boolean;
  complete: boolean;
  totalPicks: number;
  currentOverallPick: number;
  currentRound: number;
  currentPickInRound: number;
  currentSlot: number | null;
  historicalGap: boolean;
  nextUserPick: number | null;
  onClock: boolean;
  message: string;
  error: string | null;
  storage: string | null;
  startError: string | null;
  visible: PlayerRanking[];
  filter: PlayerFilter;
  sort: PlayerSort;
  search: string;
  board: DraftBoardCell[][];
  recs: Recommendation[];
  userRoster: PlayerRanking[];
  strategyLabel: string;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
  onRestore: (event: ChangeEvent<HTMLInputElement>) => void;
  onBackup: () => void;
  onUndo: () => void;
  onRestart: () => void;
  onCancelCorrection: () => void;
  onStart: () => void;
  onTeamCount: (value: number) => void;
  onSlot: (value: number) => void;
  onScoring: (value: ScoringFormat) => void;
  onStrategy: (value: DraftStrategy) => void;
  onRoster: (key: (typeof ROSTER)[number][0], value: number, max: number) => void;
  onTeamName: (index: number, value: string) => void;
  onFilter: (value: PlayerFilter) => void;
  onSort: (value: PlayerSort) => void;
  onSearch: (value: string) => void;
  onFavorite: (id: string) => void;
  onDraft: (player: PlayerRanking) => void;
  onCorrect: (pick: DraftPick, remove?: boolean) => void;
}

export function DraftUi(props: DraftUiProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const boardScrollerRef = useRef<HTMLDivElement>(null);
  const team = (slot: number) => teamDisplayName(slot, props.config.userDraftSlot, props.teamNames);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
      event.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    if (!props.started || props.complete) return;
    const scroller = boardScrollerRef.current;
    const pick = props.correction?.overallPick ?? props.currentOverallPick;
    const cell = document.getElementById(`draft-cell-${pick}`);
    if (!scroller || !cell) return;
    const left = cell.offsetLeft - scroller.clientWidth / 2 + cell.clientWidth / 2;
    scroller.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }, [props.started, props.complete, props.currentOverallPick, props.correction?.overallPick]);

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <div className="eyebrow">RosterPilot</div>
          <h1>Draft Companion</h1>
          <p>Import rankings, enter picks live, and get three transparent recommendations.</p>
        </div>
        <div className="statusActions">
          <FileLabel text={props.started ? 'Rankings locked' : 'Import rankings'} disabled={props.started} accept=".xlsx,.xls,.csv" onChange={props.onImport} />
          <button className="secondaryButton" onClick={props.onBackup} disabled={!props.players.length}>Download backup</button>
          <FileLabel text="Restore backup" accept=".json,application/json" onChange={props.onRestore} />
        </div>
      </header>

      <section className="statusBar">
        <Status label="Current" value={!props.started ? 'Setup' : props.correction ? `Correcting #${props.correction.overallPick}` : props.historicalGap ? `Correction needed #${props.currentOverallPick}` : props.complete ? 'Draft complete' : `R${props.currentRound} • ${props.currentRound}.${String(props.currentPickInRound).padStart(2, '0')}`} />
        <Status label="Overall pick" value={!props.started ? `0/${props.totalPicks}` : props.correction ? `#${props.correction.overallPick}` : props.complete ? `${props.totalPicks}/${props.totalPicks}` : `${props.currentOverallPick}/${props.totalPicks}`} />
        <Status label="On the clock" value={!props.started || props.complete ? '—' : props.correction ? team(draftSlotForOverallPick(props.correction.overallPick, props.config.teamCount)) : props.currentSlot ? team(props.currentSlot) : '—'} emphasis={props.onClock} />
        <Status label="Your next pick" value={props.correcting ? 'Paused' : props.nextUserPick ? `#${props.nextUserPick}` : '—'} />
        <div className="statusActions">
          <button className="secondaryButton" onClick={props.onUndo} disabled={!props.picks.length || props.correcting}>Undo last pick</button>
          {props.correction ? <button className="secondaryButton" onClick={props.onCancelCorrection}>Cancel correction</button> : null}
          <button className="secondaryButton" onClick={props.onRestart} disabled={!props.started}>Restart / edit setup</button>
        </div>
      </section>

      <Setup props={props} />
      <Board props={props} scrollerRef={boardScrollerRef} />
      <div className="dashboardGrid">
        <Players props={props} searchRef={searchRef} />
        <aside className="sideStack">
          <Recommendations props={props} />
          <Roster props={props} />
        </aside>
      </div>
      <History props={props} />
    </main>
  );
}

function Setup({ props }: { props: DraftUiProps }) {
  return (
    <section className={props.started ? 'setupPanel locked' : 'setupPanel'}>
      <div className="setupHeader">
        <div>
          <span className="eyebrow">League setup</span>
          <h2>{props.started ? 'Draft settings locked' : 'Configure your draft'}</h2>
          <p className="muted">{props.message}</p>
          {[props.error, props.storage, props.startError].filter(Boolean).map((message, index) => <p className="error" key={index}>{message}</p>)}
        </div>
        <div className="setupStart">
          <span className={props.started ? 'setupState active' : 'setupState'}>{props.started ? 'LIVE' : 'SETUP'}</span>
          <button className="primaryButton" onClick={props.onStart} disabled={props.started || !props.players.length || Boolean(props.startError)}>
            {!props.players.length ? 'Import rankings first' : props.started ? 'Draft started' : 'Start draft'}
          </button>
        </div>
      </div>
      <div className="setupControls setupPrimaryControls">
        <NumberField label="Teams" value={props.config.teamCount} disabled={props.started} min={4} max={20} onChange={props.onTeamCount} />
        <NumberField label="Your slot" value={props.config.userDraftSlot} disabled={props.started} min={1} max={props.config.teamCount} onChange={props.onSlot} />
        <label>Scoring<select value={props.config.scoringFormat} disabled={props.started} onChange={(event) => props.onScoring(event.target.value as ScoringFormat)}><option value="STANDARD">Standard</option><option value="HALF_PPR">Half-PPR</option><option value="PPR">PPR</option></select></label>
        <label>Strategy<select value={props.config.draftStrategy ?? 'BALANCED'} onChange={(event) => props.onStrategy(event.target.value as DraftStrategy)}>{STRATEGIES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      </div>
      <div className="rosterSetupGrid">{ROSTER.map(([key, label, max]) => <NumberField key={key} label={label} value={props.config[key]} disabled={props.started} min={0} max={max} onChange={(value) => props.onRoster(key, value, max)} />)}</div>
      <div className="teamNamesSection">
        <div className="teamNamesHeader"><strong>Team names</strong><span className="muted">Optional opponent labels.</span></div>
        <div className="teamNameGrid">{Array.from({ length: props.config.teamCount }, (_, index) => <label className={index + 1 === props.config.userDraftSlot ? 'teamNameField userTeamName' : 'teamNameField'} key={index}><span>Slot {index + 1}{index + 1 === props.config.userDraftSlot ? ' • YOU' : ''}</span><input disabled={props.started} value={props.teamNames[index] ?? ''} placeholder={`Team ${index + 1}`} onChange={(event) => props.onTeamName(index, event.target.value)} /></label>)}</div>
      </div>
    </section>
  );
}

function Board({ props, scrollerRef }: { props: DraftUiProps; scrollerRef: React.RefObject<HTMLDivElement | null> }) {
  const team = (slot: number) => teamDisplayName(slot, props.config.userDraftSlot, props.teamNames);
  const activePick = props.correction?.overallPick ?? props.currentOverallPick;
  return (
    <section className="panel draftBoardPanel">
      <PanelHeader eyebrow="Live draft" title="Draft board" pill={`${props.picks.length} / ${props.totalPicks} picks`} />
      <div className="draftBoardScroller" ref={scrollerRef}>
        <div className="draftBoardHeader" style={{ gridTemplateColumns: `64px repeat(${props.config.teamCount}, minmax(122px,1fr))` }}>
          <div className="roundHeader">Rnd</div>
          {Array.from({ length: props.config.teamCount }, (_, index) => { const slot = index + 1; return <div className={['teamHeader', slot === props.config.userDraftSlot ? 'userTeam' : '', props.started && !props.complete && slot === (props.correction ? draftSlotForOverallPick(props.correction.overallPick, props.config.teamCount) : props.currentSlot) ? 'currentTeam' : ''].filter(Boolean).join(' ')} key={slot}><strong>{team(slot)}</strong><small>{props.picks.filter((pick) => pick.draftSlot === slot).length}/{rosterSize(props.config)}</small></div>; })}
        </div>
        {props.board.map((row, roundIndex) => <div className="draftBoardRow" style={{ gridTemplateColumns: `64px repeat(${props.config.teamCount}, minmax(122px,1fr))` }} key={roundIndex}><div className="roundLabel">{roundIndex + 1}</div>{row.map((cell) => { const current = props.started && !props.complete && cell.overallPick === activePick; return <div id={`draft-cell-${cell.overallPick}`} className={['draftCell', current ? 'currentPick' : '', cell.draftSlot === props.config.userDraftSlot ? 'userCell' : ''].filter(Boolean).join(' ')} key={cell.overallPick}><small>#{cell.overallPick}</small>{cell.player ? <><strong>{cell.player.name}</strong><span>{cell.player.position}{cell.player.nflTeam ? ` • ${cell.player.nflTeam}` : ''}</span>{cell.pick ? <div className="draftCellActions"><button disabled={props.correcting} onClick={() => props.onCorrect(cell.pick!)}>Edit</button><button disabled={props.correcting} onClick={() => props.onCorrect(cell.pick!, true)}>Remove</button></div> : null}</> : current ? <strong className="onClock">On clock</strong> : null}</div>; })}</div>)}
      </div>
    </section>
  );
}

function Players({ props, searchRef }: { props: DraftUiProps; searchRef: React.RefObject<HTMLInputElement | null> }) {
  const byPlayer = new Map(props.picks.map((pick) => [pick.playerId, pick]));
  const team = (slot: number) => teamDisplayName(slot, props.config.userDraftSlot, props.teamNames);
  return (
    <section className="panel playersPanel">
      <PanelHeader eyebrow="Player pool" title="Available players" pill={props.filter === 'DRAFTED' ? `${props.picks.length} drafted` : `${props.players.length - props.picks.length} available`} />
      {props.correcting ? <div className="correctionBanner"><strong>Correcting pick #{props.correction?.overallPick ?? props.currentOverallPick}</strong>{props.correction ? <button className="secondaryButton" onClick={props.onCancelCorrection}>Cancel</button> : null}</div> : null}
      <div className="playerTools">
        <input ref={searchRef} className="searchInput" placeholder="Search player or team...  (press /)" value={props.search} onChange={(event) => props.onSearch(event.target.value)} />
        <label className="sortControl">Sort<select value={props.sort} onChange={(event) => props.onSort(event.target.value as PlayerSort)}><option value="RANK">Rank</option><option value="ADP">ADP</option><option value="NAME">Name</option></select></label>
      </div>
      <div className="filters">{FILTERS.map((filter) => <button className={props.filter === filter ? 'filter active' : 'filter'} key={filter} onClick={() => props.onFilter(filter)}>{filter === 'FAVORITES' ? '★ Favorites' : filter === 'DRAFTED' ? 'Drafted' : filter}</button>)}</div>
      <div className="playerList">
        {props.visible.slice(0, 100).map((player) => {
          const pick = byPlayer.get(player.id);
          const favorite = props.favorites.has(player.id);
          return <div className={pick ? 'playerRow drafted' : 'playerRow'} key={player.id}><button className={favorite ? 'favoriteButton active' : 'favoriteButton'} onClick={() => props.onFavorite(player.id)} aria-label={favorite ? `Remove ${player.name} from favorites` : `Add ${player.name} to favorites`} title={favorite ? 'Remove from My Guys' : 'Add to My Guys'}>{favorite ? '★' : '☆'}</button><span className="rank">{player.overallRank}</span><span className="playerIdentity"><strong>{player.name}</strong><small>{player.position}{player.nflTeam ? ` • ${player.nflTeam}` : ''}{player.tier != null ? ` • Tier ${player.tier}` : ''}{player.adp != null ? ` • ADP ${Math.round(player.adp)}` : ''}</small></span><button className="draftPlayerButton" disabled={Boolean(pick) || !props.started || props.complete} onClick={() => props.onDraft(player)}>{pick ? `#${pick.overallPick} • ${team(pick.draftSlot)}` : props.correcting ? `Use at #${props.correction?.overallPick ?? props.currentOverallPick}` : 'Draft'}</button></div>;
        })}
        {!props.visible.length ? <EmptyState text={props.players.length ? 'No players match this view.' : 'Import rankings to begin.'} /> : null}
      </div>
    </section>
  );
}

function Recommendations({ props }: { props: DraftUiProps }) {
  return (
    <section className="panel recommendationPanel">
      <PanelHeader eyebrow="Decision engine" title="Top 3" pill="Recommendation %" />
      {props.recs.length ? <div className="recommendationList">{props.recs.map((recommendation, index) => <article className="recommendation" key={recommendation.player.id}><div className="recommendationTopline"><span className="medal">#{index + 1}</span><div><strong>{props.favorites.has(recommendation.player.id) ? '★ ' : ''}{recommendation.player.name}</strong><small>{recommendation.player.position} • Rank {recommendation.player.overallRank}</small></div><span className="score">{recommendation.recommendationPercent}%</span></div><div className="scoreTrack"><span style={{ width: `${recommendation.recommendationPercent}%` }} /></div><div className="recommendationSignals"><span className={`signalChip availability ${recommendation.availabilityLabel.toLowerCase()}`}>{availabilitySignal(recommendation.availabilityLabel, recommendation.returnPick)}</span>{recommendation.positionTrend !== 'QUIET' ? <span className="signalChip">{recommendation.positionTrend === 'HOT' ? '🔥' : '↗'} {recommendation.player.position} run</span> : null}{recommendation.marketFall != null ? <span className="signalChip">Market fall +{Math.round(recommendation.marketFall)}</span> : null}{recommendation.breakdown.rosterFit >= 90 ? <span className="signalChip">Starter need</span> : null}{props.favorites.has(recommendation.player.id) ? <span className="signalChip favorite">★ Favorite</span> : null}{(props.config.draftStrategy ?? 'BALANCED') !== 'BALANCED' && recommendation.breakdown.strategyFit >= 85 ? <span className="signalChip">{props.strategyLabel} fit</span> : null}</div>{props.onClock ? <button className="secondaryButton" onClick={() => props.onDraft(recommendation.player)} aria-label={`Draft ${recommendation.player.name} for my team`}>Draft for my team</button> : null}<ul>{recommendation.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></article>)}</div> : <EmptyState text={props.complete ? 'Draft complete.' : props.correcting ? 'Recommendations paused during correction.' : !props.started ? 'Start the draft to activate recommendations.' : 'No recommendations available.'} />}
    </section>
  );
}

function Roster({ props }: { props: DraftUiProps }) {
  return <section className="panel rosterPanel"><PanelHeader eyebrow={teamDisplayName(props.config.userDraftSlot, props.config.userDraftSlot, props.teamNames)} title="Your roster" pill={`${props.userRoster.length} / ${rosterSize(props.config)}`} /><div className="rosterList">{props.userRoster.length ? props.userRoster.map((player) => <div className="rosterRow" key={player.id}><span className="positionBadge">{player.position}</span><span>{player.name}</span></div>) : <EmptyState text="Your drafted players will appear here." />}</div></section>;
}

function History({ props }: { props: DraftUiProps }) {
  const byId = new Map(props.players.map((player) => [player.id, player]));
  return <section className="panel historyPanel"><PanelHeader eyebrow="Draft state" title="Recent picks" pill={`${props.picks.length} entered`} /><div className="historyGrid">{[...props.picks].reverse().slice(0, 16).map((pick) => <div className={pick.draftSlot === props.config.userDraftSlot ? 'historyPick userPick' : 'historyPick'} key={pick.overallPick}><small>#{pick.overallPick} • {teamDisplayName(pick.draftSlot, props.config.userDraftSlot, props.teamNames)}</small><strong>{byId.get(pick.playerId)?.name ?? pick.playerId}</strong><span>{byId.get(pick.playerId)?.position}</span><div className="historyActions"><button disabled={props.correcting} onClick={() => props.onCorrect(pick)}>Edit</button><button disabled={props.correcting} onClick={() => props.onCorrect(pick, true)}>Remove</button></div></div>)}{!props.picks.length ? <EmptyState text="No picks entered yet." /> : null}</div></section>;
}

function availabilitySignal(label: AvailabilityLabel, returnPick?: number) {
  if (label === 'UNLIKELY') return returnPick ? `Unlikely back by #${returnPick}` : 'Unlikely to return';
  if (label === 'LIKELY') return returnPick ? `Likely back by #${returnPick}` : 'Likely to return';
  if (label === 'UNCERTAIN') return returnPick ? `Return uncertain by #${returnPick}` : 'Return uncertain';
  return 'Final selection';
}

function Status({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return <div className={emphasis ? 'status emphasis' : 'status'}><small>{label}</small><strong>{value}</strong></div>;
}
function PanelHeader({ eyebrow, title, pill }: { eyebrow: string; title: string; pill: string }) {
  return <div className="panelHeader"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><span className="countPill">{pill}</span></div>;
}
function EmptyState({ text }: { text: string }) { return <div className="emptyState">{text}</div>; }
function NumberField({ label, value, disabled, min, max, onChange }: { label: string; value: number; disabled: boolean; min: number; max: number; onChange: (value: number) => void }) {
  return <label><span>{label}</span><input type="number" value={value} disabled={disabled} min={min} max={max} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}
function FileLabel({ text, accept, onChange, disabled = false }: { text: string; accept: string; onChange: (event: ChangeEvent<HTMLInputElement>) => void; disabled?: boolean }) {
  return <label className={disabled ? 'uploadButton disabled' : 'secondaryButton'}>{text}<input type="file" accept={accept} onChange={onChange} disabled={disabled} hidden /></label>;
}

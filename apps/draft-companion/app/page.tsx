'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { buildDraftBoard, isDraftComplete, nextOpenOverallPick, rosterForSlot, rosterSize, totalDraftPicks } from '@/lib/board';
import { replaceDraftPick, removeDraftPick } from '@/lib/corrections';
import {
  draftSlotForOverallPick,
  nextUserOverallPick,
  pickInRound,
  roundForOverallPick,
} from '@/lib/draft';
import {
  DRAFT_STORAGE_KEY,
  parseDraftSnapshot,
  serializeDraftSnapshot,
} from '@/lib/persistence';
import { recommendPlayers } from '@/lib/recommendation';
import {
  defaultTeamNames,
  leagueSummary,
  resizeTeamNames,
  teamDisplayName,
  validateDraftSetup,
} from '@/lib/setup';
import { parseRankingFile } from '@/lib/spreadsheet';
import { defaultStrategyForDraftSlot } from '@/lib/strategy';
import type {
  AvailabilityLabel,
  DraftConfig,
  DraftPick,
  DraftStrategy,
  PlayerRanking,
  Position,
  ScoringFormat,
} from '@/lib/types';

const DEFAULT_CONFIG: DraftConfig = {
  teamCount: 10,
  userDraftSlot: 7,
  scoringFormat: 'HALF_PPR',
  qbStarters: 1,
  rbStarters: 2,
  wrStarters: 3,
  teStarters: 1,
  flexStarters: 1,
  dstStarters: 1,
  kStarters: 1,
  benchSpots: 6,
  draftStrategy: 'BALANCED',
};

type PlayerFilter = 'ALL' | 'FAVORITES' | 'DRAFTED' | Position;
type PlayerSort = 'RANK' | 'ADP' | 'NAME';
type CorrectionState = { overallPick: number; originalPick: DraftPick };
const PLAYER_FILTERS: Array<PlayerFilter> = ['ALL', 'FAVORITES', 'DRAFTED', 'QB', 'RB', 'WR', 'TE', 'K', 'DST'];
const PLAYER_SORTS: Array<{ value: PlayerSort; label: string }> = [
  { value: 'RANK', label: 'Rank' },
  { value: 'ADP', label: 'ADP' },
  { value: 'NAME', label: 'Name' },
];
const SCORING_OPTIONS: Array<{ value: ScoringFormat; label: string }> = [
  { value: 'STANDARD', label: 'Standard' },
  { value: 'HALF_PPR', label: 'Half-PPR' },
  { value: 'PPR', label: 'PPR' },
];
const ROSTER_FIELDS: Array<{ key: keyof Pick<DraftConfig, 'qbStarters' | 'rbStarters' | 'wrStarters' | 'teStarters' | 'flexStarters' | 'dstStarters' | 'kStarters' | 'benchSpots'>; label: string; max: number }> = [
  { key: 'qbStarters', label: 'QB', max: 10 },
  { key: 'rbStarters', label: 'RB', max: 10 },
  { key: 'wrStarters', label: 'WR', max: 10 },
  { key: 'teStarters', label: 'TE', max: 10 },
  { key: 'flexStarters', label: 'FLEX', max: 10 },
  { key: 'dstStarters', label: 'DST', max: 10 },
  { key: 'kStarters', label: 'K', max: 10 },
  { key: 'benchSpots', label: 'Bench', max: 20 },
];
const STRATEGY_OPTIONS: Array<{ value: DraftStrategy; label: string }> = [
  { value: 'BALANCED', label: 'Balanced' },
  { value: 'HERO_RB', label: 'Hero RB' },
  { value: 'ZERO_RB', label: 'Zero RB' },
  { value: 'ROBUST_RB', label: 'Robust RB' },
  { value: 'WR_HEAVY', label: 'WR Heavy' },
  { value: 'LATE_QB', label: 'Late QB' },
  { value: 'ELITE_TE', label: 'Elite TE' },
  { value: 'UPSIDE_HEAVY', label: 'Upside Heavy' },
];


export default function DraftCompanionPage() {
  const [config, setConfig] = useState<DraftConfig>(DEFAULT_CONFIG);
  const [players, setPlayers] = useState<PlayerRanking[]>([]);
  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [favoritePlayerIds, setFavoritePlayerIds] = useState<string[]>([]);
  const [teamNames, setTeamNames] = useState<string[]>(() => defaultTeamNames(DEFAULT_CONFIG.teamCount));
  const [draftStarted, setDraftStarted] = useState(false);
  const [correction, setCorrection] = useState<CorrectionState | null>(null);
  const [search, setSearch] = useState('');
  const [playerFilter, setPlayerFilter] = useState<PlayerFilter>('ALL');
  const [playerSort, setPlayerSort] = useState<PlayerSort>('RANK');
  const [importMessage, setImportMessage] = useState('Upload your rankings to begin.');
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const totalPicks = totalDraftPicks(config);
  const setupValidation = useMemo(() => validateDraftSetup(config), [config]);
  const complete = draftStarted && isDraftComplete(picks, config);
  const nextOpenPick = nextOpenOverallPick(picks, config);
  const currentOverallPick = complete ? totalPicks : nextOpenPick ?? totalPicks;
  const historicalGap = draftStarted && nextOpenPick != null && picks.some((pick) => pick.overallPick > nextOpenPick);
  const correctionActive = Boolean(correction) || historicalGap;
  const currentRound = roundForOverallPick(currentOverallPick, config.teamCount);
  const currentSlot = !draftStarted || complete ? null : draftSlotForOverallPick(currentOverallPick, config.teamCount);
  const currentPickInRound = pickInRound(currentOverallPick, config.teamCount);
  const nextUserPick = !draftStarted || complete ? null : nextUserOverallPick(currentOverallPick, config);
  const isUserOnClock = draftStarted && !correctionActive && currentSlot === config.userDraftSlot;
  const userTeamName = teamDisplayName(config.userDraftSlot, config.userDraftSlot, teamNames);
  const activeStrategyLabel = STRATEGY_OPTIONS.find((option) => option.value === (config.draftStrategy ?? 'BALANCED'))?.label ?? 'Balanced';

  useEffect(() => {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    const snapshot = raw ? parseDraftSnapshot(raw) : null;

    if (snapshot) {
      setConfig(snapshot.config);
      setPlayers(snapshot.players);
      setPicks(snapshot.picks);
      setFavoritePlayerIds(snapshot.favoritePlayerIds);
      setTeamNames(snapshot.teamNames);
      setDraftStarted(snapshot.draftStarted);
      setImportMessage(
        `Restored ${snapshot.players.length} players • ${snapshot.picks.length} picks saved`,
      );
    }

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      DRAFT_STORAGE_KEY,
      serializeDraftSnapshot({ config, players, picks, favoritePlayerIds, teamNames, draftStarted }),
    );
  }, [hydrated, config, players, picks, favoritePlayerIds, teamNames, draftStarted]);

  useEffect(() => {
    if (!draftStarted) return;
    const targetPick = correction?.overallPick ?? currentOverallPick;
    const element = document.getElementById(`draft-cell-${targetPick}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [draftStarted, currentOverallPick, correction?.overallPick]);

  const favoriteIds = useMemo(() => new Set(favoritePlayerIds), [favoritePlayerIds]);
  const playerById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const draftedIds = useMemo(() => new Set(picks.map((pick) => pick.playerId)), [picks]);
  const pickByPlayerId = useMemo(() => new Map(picks.map((pick) => [pick.playerId, pick])), [picks]);
  const board = useMemo(() => buildDraftBoard(config, picks, players), [config, picks, players]);
  const availablePlayers = useMemo(() => {
    const filtered = players.filter((player) => {
      const drafted = draftedIds.has(player.id);
      if (playerFilter === 'DRAFTED') {
        if (!drafted) return false;
      } else {
        if (drafted) return false;
        if (playerFilter === 'FAVORITES' && !favoriteIds.has(player.id)) return false;
        if (playerFilter !== 'ALL' && playerFilter !== 'FAVORITES' && player.position !== playerFilter) return false;
      }
      const query = search.trim().toLowerCase();
      if (!query) return true;
      return (
        player.name.toLowerCase().includes(query) ||
        player.position.toLowerCase().includes(query) ||
        player.nflTeam?.toLowerCase().includes(query)
      );
    });

    return filtered.sort((a, b) => {
      if (playerSort === 'NAME') return a.name.localeCompare(b.name) || a.overallRank - b.overallRank;
      if (playerSort === 'ADP') return (a.adp ?? Number.POSITIVE_INFINITY) - (b.adp ?? Number.POSITIVE_INFINITY) || a.overallRank - b.overallRank;
      return a.overallRank - b.overallRank;
    });
  }, [players, draftedIds, playerFilter, favoriteIds, search, playerSort]);

  const recommendations = useMemo(
    () =>
      !draftStarted || complete || correctionActive
        ? []
        : recommendPlayers({ players, picks, config, currentOverallPick, favoritePlayerIds, limit: 3 }),
    [players, picks, config, currentOverallPick, favoritePlayerIds, draftStarted, complete, correctionActive],
  );

  const userRoster = useMemo(
    () => rosterForSlot(config.userDraftSlot, picks, players),
    [players, picks, config.userDraftSlot],
  );

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || draftStarted) return;

    try {
      setError(null);
      const result = await parseRankingFile(file);
      setPlayers(result.players);
      setPicks([]);
      const importedIds = new Set(result.players.map((player) => player.id));
      setFavoritePlayerIds((existing) => existing.filter((id) => importedIds.has(id)));
      setImportMessage(
        `${result.players.length} players imported${result.detectedSource ? ` from ${result.detectedSource}` : ''}${
          result.warnings.length ? ` • ${result.warnings.length} warning(s)` : ''
        }`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to import rankings.');
    } finally {
      event.target.value = '';
    }
  }

  function draftPlayer(player: PlayerRanking) {
    if (!draftStarted || complete || draftedIds.has(player.id)) return;
    const overallPick = correction?.overallPick ?? currentOverallPick;
    setPicks((existing) => replaceDraftPick(existing, overallPick, player.id, config.teamCount));
    setCorrection(null);
    setSearch('');
  }

  function toggleFavorite(playerId: string) {
    setFavoritePlayerIds((existing) =>
      existing.includes(playerId)
        ? existing.filter((id) => id !== playerId)
        : [...existing, playerId],
    );
  }

  function undoLastPick() {
    if (correction) return;
    setPicks((existing) => [...existing].sort((a, b) => a.overallPick - b.overallPick).slice(0, -1));
  }


  function beginCorrection(pick: DraftPick, remove = false) {
    if (correctionActive) return;
    if (remove && !window.confirm(`Remove pick #${pick.overallPick}? You will need to select a replacement before continuing.`)) return;
    setCorrection({ overallPick: pick.overallPick, originalPick: pick });
    if (remove) setPicks((existing) => removeDraftPick(existing, pick.overallPick));
    setSearch('');
    setPlayerFilter('ALL');
  }

  function cancelCorrection() {
    if (!correction) return;
    setPicks((existing) => {
      if (existing.some((pick) => pick.overallPick === correction.overallPick)) return existing;
      return [...existing, correction.originalPick].sort((a, b) => a.overallPick - b.overallPick);
    });
    setCorrection(null);
  }

  function startDraft() {
    if (!setupValidation.valid || players.length === 0) return;
    setError(null);
    setDraftStarted(true);
  }

  function restartDraft() {
    if (draftStarted && !window.confirm('Restart the draft, clear entered picks, and unlock league setup?')) return;
    setPicks([]);
    setCorrection(null);
    setDraftStarted(false);
  }

  function updateTeamCount(value: number) {
    const teamCount = Math.min(20, Math.max(4, Math.trunc(value || 10)));
    setTeamNames((existing) => resizeTeamNames(existing, teamCount));
    setConfig((current) => {
      const userDraftSlot = Math.min(current.userDraftSlot, teamCount);
      return {
        ...current,
        teamCount,
        userDraftSlot,
        draftStrategy: defaultStrategyForDraftSlot(userDraftSlot),
      };
    });
  }

  function updateRosterField(
    key: keyof Pick<DraftConfig, 'qbStarters' | 'rbStarters' | 'wrStarters' | 'teStarters' | 'flexStarters' | 'dstStarters' | 'kStarters' | 'benchSpots'>,
    value: number,
    max: number,
  ) {
    const safeValue = Math.min(max, Math.max(0, Math.trunc(value || 0)));
    setConfig((current) => ({ ...current, [key]: safeValue }));
  }

  function updateTeamName(index: number, value: string) {
    setTeamNames((existing) => {
      const next = resizeTeamNames(existing, config.teamCount);
      next[index] = value.slice(0, 32);
      return next;
    });
  }

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <div className="eyebrow">RosterPilot</div>
          <h1>Draft Companion</h1>
          <p>
            Import your rankings, enter picks as they happen, and get three transparent recommendations for your next selection.
          </p>
        </div>
        <label className={draftStarted ? 'uploadButton disabled' : 'uploadButton'}>
          {draftStarted ? 'Rankings locked' : 'Import rankings'}
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} disabled={draftStarted} hidden />
        </label>
      </header>

      <section className="statusBar">
        <Status
          label="Current"
          value={!draftStarted ? 'Setup' : correction ? `Correcting #${correction.overallPick}` : historicalGap ? `Correction needed #${currentOverallPick}` : complete ? 'Draft complete' : `R${currentRound} • ${currentRound}.${String(currentPickInRound).padStart(2, '0')}`}
        />
        <Status
          label="Overall pick"
          value={!draftStarted ? `0/${totalPicks}` : correction ? `#${correction.overallPick}` : historicalGap ? `#${currentOverallPick}` : complete ? `${totalPicks}/${totalPicks}` : `${currentOverallPick}/${totalPicks}`}
        />
        <Status
          label="On the clock"
          value={!draftStarted || complete ? '—' : correction ? teamDisplayName(draftSlotForOverallPick(correction.overallPick, config.teamCount), config.userDraftSlot, teamNames) : currentSlot == null ? '—' : teamDisplayName(currentSlot, config.userDraftSlot, teamNames)}
          emphasis={isUserOnClock}
        />
        <Status label="Your next pick" value={correctionActive ? 'Paused' : nextUserPick ? `#${nextUserPick}` : '—'} />
        <div className="statusActions">
          <button className="secondaryButton" onClick={undoLastPick} disabled={picks.length === 0 || correctionActive}>
            Undo last pick
          </button>
          {correction ? (
            <button className="secondaryButton correctionCancel" onClick={cancelCorrection}>
              Cancel correction
            </button>
          ) : null}
          <button className="secondaryButton" onClick={restartDraft} disabled={!draftStarted}>
            Restart / edit setup
          </button>
        </div>
      </section>

      <section className={draftStarted ? 'setupPanel locked' : 'setupPanel'}>
        <div className="setupHeader">
          <div>
            <span className="eyebrow">League setup</span>
            <h2>{draftStarted ? 'Draft settings locked' : 'Configure your draft'}</h2>
            <p>{leagueSummary(config)}</p>
            <p className="muted">{importMessage}</p>
            {error ? <p className="error">{error}</p> : null}
            {!setupValidation.valid ? <p className="error">{setupValidation.errors[0]}</p> : null}
          </div>
          <div className="setupStart">
            <span className={draftStarted ? 'setupState active' : 'setupState'}>
              {draftStarted ? 'LIVE' : 'SETUP'}
            </span>
            <button
              className="primaryButton"
              onClick={startDraft}
              disabled={draftStarted || players.length === 0 || !setupValidation.valid}
            >
              {players.length === 0 ? 'Import rankings first' : draftStarted ? 'Draft started' : 'Start draft'}
            </button>
          </div>
        </div>

        <div className="setupControls setupPrimaryControls">
          <label>
            Teams
            <input
              type="number"
              min={4}
              max={20}
              value={config.teamCount}
              disabled={draftStarted}
              onChange={(event) => updateTeamCount(Number(event.target.value))}
            />
          </label>
          <label>
            Your slot
            <input
              type="number"
              min={1}
              max={config.teamCount}
              value={config.userDraftSlot}
              disabled={draftStarted}
              onChange={(event) => {
                const slot = Math.min(config.teamCount, Math.max(1, Number(event.target.value) || 1));
                setConfig((current) => ({
                  ...current,
                  userDraftSlot: slot,
                  draftStrategy: defaultStrategyForDraftSlot(slot),
                }));
              }}
            />
          </label>
          <label>
            Scoring
            <select
              value={config.scoringFormat}
              disabled={draftStarted}
              onChange={(event) =>
                setConfig((current) => ({ ...current, scoringFormat: event.target.value as ScoringFormat }))
              }
            >
              {SCORING_OPTIONS.map((option) => (
                <option value={option.value} key={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            Strategy
            <select
              value={config.draftStrategy ?? 'BALANCED'}
              onChange={(event) =>
                setConfig((current) => ({ ...current, draftStrategy: event.target.value as DraftStrategy }))
              }
            >
              {STRATEGY_OPTIONS.map((strategy) => (
                <option value={strategy.value} key={strategy.value}>{strategy.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="rosterSetupGrid">
          {ROSTER_FIELDS.map((field) => (
            <label key={field.key}>
              <span>{field.label}</span>
              <input
                type="number"
                min={0}
                max={field.max}
                value={config[field.key]}
                disabled={draftStarted}
                onChange={(event) => updateRosterField(field.key, Number(event.target.value), field.max)}
              />
            </label>
          ))}
        </div>

        <div className="teamNamesSection">
          <div className="teamNamesHeader">
            <div>
              <strong>Team names</strong>
              <span className="muted">Optional. Useful for opponent tracking during the live draft.</span>
            </div>
            <span className="countPill">{config.teamCount} teams</span>
          </div>
          <div className="teamNameGrid">
            {Array.from({ length: config.teamCount }, (_, index) => {
              const slot = index + 1;
              return (
                <label className={slot === config.userDraftSlot ? 'teamNameField userTeamName' : 'teamNameField'} key={slot}>
                  <span>{slot === config.userDraftSlot ? `Slot ${slot} • YOU` : `Slot ${slot}`}</span>
                  <input
                    type="text"
                    placeholder={slot === config.userDraftSlot ? 'Your team name' : `Team ${slot}`}
                    value={teamNames[index] ?? ''}
                    disabled={draftStarted}
                    onChange={(event) => updateTeamName(index, event.target.value)}
                  />
                </label>
              );
            })}
          </div>
        </div>
      </section>

      <section className="panel draftBoardPanel">
        <div className="panelHeader">
          <div>
            <span className="eyebrow">Live draft</span>
            <h2>Draft board</h2>
          </div>
          <span className="countPill">{picks.length} / {totalPicks} picks</span>
        </div>
        <div className="draftBoardScroller">
          <div className="draftBoardHeader" style={{ gridTemplateColumns: `64px repeat(${config.teamCount}, minmax(122px, 1fr))` }}>
            <div className="roundHeader">Rnd</div>
            {Array.from({ length: config.teamCount }, (_, index) => {
              const slot = index + 1;
              const count = picks.filter((pick) => pick.draftSlot === slot).length;
              return (
                <div
                  className={[
                    'teamHeader',
                    slot === config.userDraftSlot ? 'userTeam' : '',
                    draftStarted && !complete && slot === (correction ? draftSlotForOverallPick(correction.overallPick, config.teamCount) : currentSlot) ? 'currentTeam' : '',
                  ].filter(Boolean).join(' ')}
                  key={slot}
                >
                  <strong>{teamDisplayName(slot, config.userDraftSlot, teamNames)}</strong>
                  <small>{count}/{rosterSize(config)}</small>
                </div>
              );
            })}
          </div>
          {board.map((row, roundIndex) => (
            <div
              className="draftBoardRow"
              style={{ gridTemplateColumns: `64px repeat(${config.teamCount}, minmax(122px, 1fr))` }}
              key={roundIndex + 1}
            >
              <div className="roundLabel">{roundIndex + 1}</div>
              {row.map((cell) => {
                const current = draftStarted && !complete && cell.overallPick === (correction?.overallPick ?? currentOverallPick);
                const userCell = cell.draftSlot === config.userDraftSlot;
                const classes = ['draftCell', current ? 'currentPick' : '', userCell ? 'userCell' : '']
                  .filter(Boolean)
                  .join(' ');
                return (
                  <div className={classes} id={`draft-cell-${cell.overallPick}`} key={cell.overallPick}>
                    <small>#{cell.overallPick}</small>
                    {cell.player ? (
                      <>
                        <strong>{cell.player.name}</strong>
                        <span>
                          {cell.player.position}{cell.player.nflTeam ? ` • ${cell.player.nflTeam}` : ''}
                        </span>
                        {cell.pick ? (
                          <div className="draftCellActions">
                            <button onClick={() => beginCorrection(cell.pick!)} disabled={correctionActive}>Edit</button>
                            <button onClick={() => beginCorrection(cell.pick!, true)} disabled={correctionActive}>Remove</button>
                          </div>
                        ) : null}
                      </>
                    ) : current ? (
                      <strong className="onClock">On clock</strong>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      <div className="dashboardGrid">
        <section className="panel playersPanel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Player pool</span>
              <h2>Available players</h2>
            </div>
            <span className="countPill">{playerFilter === 'DRAFTED' ? `${draftedIds.size} drafted` : `${players.length - draftedIds.size} available`}</span>
          </div>

          {correctionActive ? (
            <div className="correctionBanner">
              <div>
                <strong>Correcting pick #{correction?.overallPick ?? currentOverallPick}</strong>
                <span>
                  {correction
                    ? `${playerById.get(correction.originalPick.playerId)?.name ?? correction.originalPick.playerId} → choose the replacement below`
                    : 'A historical pick is open. Fill it before continuing the live draft.'}
                </span>
              </div>
              {correction ? <button className="secondaryButton" onClick={cancelCorrection}>Cancel</button> : null}
            </div>
          ) : null}

          <div className="playerTools">
            <input
              className="searchInput"
              placeholder="Search player or team..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <label className="sortControl">
              Sort
              <select value={playerSort} onChange={(event) => setPlayerSort(event.target.value as PlayerSort)}>
                {PLAYER_SORTS.map((option) => (
                  <option value={option.value} key={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="filters">
            {PLAYER_FILTERS.map((filter) => (
              <button
                key={filter}
                className={playerFilter === filter ? 'filter active' : 'filter'}
                onClick={() => setPlayerFilter(filter)}
              >
                {filter === 'FAVORITES' ? '★ Favorites' : filter === 'DRAFTED' ? 'Drafted' : filter}
              </button>
            ))}
          </div>

          <div className="playerList">
            {availablePlayers.slice(0, 100).map((player) => {
              const favorite = favoriteIds.has(player.id);
              const draftedPick = pickByPlayerId.get(player.id);
              return (
                <div className={draftedPick ? 'playerRow drafted' : 'playerRow'} key={player.id}>
                  <button
                    className={favorite ? 'favoriteButton active' : 'favoriteButton'}
                    onClick={() => toggleFavorite(player.id)}
                    aria-label={favorite ? `Remove ${player.name} from favorites` : `Add ${player.name} to favorites`}
                    title={favorite ? 'Remove from My Guys' : 'Add to My Guys'}
                  >
                    {favorite ? '★' : '☆'}
                  </button>
                  <span className="rank">{player.overallRank}</span>
                  <span className="playerIdentity">
                    <strong>{player.name}</strong>
                    <small>
                      {player.position} {player.nflTeam ? `• ${player.nflTeam}` : ''}
                      {player.tier != null ? ` • Tier ${player.tier}` : ''}
                      {player.byeWeek != null ? ` • Bye ${player.byeWeek}` : ''}
                    </small>
                  </span>
                  <button
                    className="draftPlayerButton"
                    onClick={() => draftPlayer(player)}
                    disabled={Boolean(draftedPick) || !draftStarted || complete}
                  >
                    {draftedPick
                      ? `#${draftedPick.overallPick} • ${teamDisplayName(draftedPick.draftSlot, config.userDraftSlot, teamNames)}`
                      : !draftStarted
                        ? 'Start draft'
                        : correctionActive
                          ? `Use at #${correction?.overallPick ?? currentOverallPick}`
                          : complete
                            ? 'Complete'
                            : 'Draft'}
                  </button>
                </div>
              );
            })}
            {players.length === 0 ? (
              <EmptyState text="Import an .xlsx, .xls, or .csv rankings file. Required columns: Player, Position, Rank." />
            ) : availablePlayers.length === 0 ? (
              <EmptyState
                text={playerFilter === 'DRAFTED'
                  ? 'No drafted players match this search.'
                  : complete
                    ? 'Draft complete.'
                    : 'No available players match this filter.'}
              />
            ) : null}
          </div>
        </section>

        <aside className="sideStack">
          <section className="panel recommendationPanel">
            <div className="panelHeader">
              <div>
                <span className="eyebrow">Decision engine</span>
                <h2>Top 3</h2>
              </div>
              <span className="countPill">Recommendation %</span>
            </div>
            {recommendations.length ? (
              <div className="recommendationList">
                {recommendations.map((recommendation, index) => (
                  <article className="recommendation" key={recommendation.player.id}>
                    <div className="recommendationTopline">
                      <span className="medal">#{index + 1}</span>
                      <div>
                        <strong>
                          {favoriteIds.has(recommendation.player.id) ? '★ ' : ''}
                          {recommendation.player.name}
                        </strong>
                        <small>
                          {recommendation.player.position} • Rank {recommendation.player.overallRank}
                          {recommendation.player.byeWeek != null ? ` • Bye ${recommendation.player.byeWeek}` : ''}
                        </small>
                      </div>
                      <span className="score">{recommendation.recommendationPercent}%</span>
                    </div>
                    <div className="scoreTrack">
                      <span style={{ width: `${recommendation.recommendationPercent}%` }} />
                    </div>
                    <div className="recommendationSignals">
                      <span className={`signalChip availability ${recommendation.availabilityLabel.toLowerCase()}`}>
                        {availabilitySignal(recommendation.availabilityLabel, recommendation.returnPick)}
                      </span>
                      {recommendation.breakdown.rosterFit >= 90 ? <span className="signalChip">Starter need</span> : null}
                      {recommendation.breakdown.tierUrgency >= 88 ? <span className="signalChip">Tier cliff</span> : null}
                      {favoriteIds.has(recommendation.player.id) ? <span className="signalChip favorite">★ Favorite</span> : null}
                      {(config.draftStrategy ?? 'BALANCED') !== 'BALANCED' && recommendation.breakdown.strategyFit >= 85
                        ? <span className="signalChip">{activeStrategyLabel} fit</span>
                        : null}
                    </div>
                    <ul>
                      {recommendation.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState text={complete ? 'Draft complete.' : correctionActive ? `Recommendations paused while correcting pick #${correction?.overallPick ?? currentOverallPick}.` : !draftStarted ? 'Start the draft to activate recommendations.' : 'Recommendations appear after rankings are imported.'} />
            )}
          </section>

          <section className="panel rosterPanel">
            <div className="panelHeader">
              <div>
                <span className="eyebrow">{userTeamName}</span>
                <h2>Your roster</h2>
              </div>
              <span className="countPill">{userRoster.length} / {rosterSize(config)}</span>
            </div>
            <div className="rosterList">
              {userRoster.length ? (
                userRoster.map((player) => (
                  <div className="rosterRow" key={player.id}>
                    <span className="positionBadge">{player.position}</span>
                    <span>
                      {player.name}
                      {player.byeWeek != null ? <small className="rosterBye">Bye {player.byeWeek}</small> : null}
                    </span>
                  </div>
                ))
              ) : (
                <EmptyState text="Your drafted players will appear here." />
              )}
            </div>
          </section>
        </aside>
      </div>

      <section className="panel historyPanel">
        <div className="panelHeader">
          <div>
            <span className="eyebrow">Draft state</span>
            <h2>Recent picks</h2>
          </div>
          <span className="countPill">{picks.length} entered</span>
        </div>
        <div className="historyGrid">
          {[...picks].reverse().slice(0, 16).map((pick) => {
            const player = playerById.get(pick.playerId);
            return (
              <div className={pick.draftSlot === config.userDraftSlot ? 'historyPick userPick' : 'historyPick'} key={pick.overallPick}>
                <small>#{pick.overallPick} • {teamDisplayName(pick.draftSlot, config.userDraftSlot, teamNames)}</small>
                <strong>{player?.name ?? pick.playerId}</strong>
                <span>{player?.position}</span>
                <div className="historyActions">
                  <button onClick={() => beginCorrection(pick)} disabled={correctionActive}>Edit</button>
                  <button onClick={() => beginCorrection(pick, true)} disabled={correctionActive}>Remove</button>
                </div>
              </div>
            );
          })}
          {picks.length === 0 ? <EmptyState text="No picks entered yet." /> : null}
        </div>
      </section>
    </main>
  );
}

function availabilitySignal(label: AvailabilityLabel, returnPick?: number): string {
  if (label === 'UNLIKELY') return returnPick ? `Unlikely back by #${returnPick}` : 'Unlikely to return';
  if (label === 'LIKELY') return returnPick ? `Likely back by #${returnPick}` : 'Likely to return';
  if (label === 'UNCERTAIN') return returnPick ? `Return uncertain by #${returnPick}` : 'Return uncertain';
  return 'Final selection';
}

function Status({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={emphasis ? 'status emphasis' : 'status'}>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="emptyState">{text}</div>;
}

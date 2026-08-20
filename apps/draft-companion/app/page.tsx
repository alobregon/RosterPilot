'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { buildDraftBoard, isDraftComplete, rosterForSlot, rosterSize, totalDraftPicks } from '@/lib/board';
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
import { parseRankingFile } from '@/lib/spreadsheet';
import { defaultStrategyForDraftSlot } from '@/lib/strategy';
import type {
  DraftConfig,
  DraftPick,
  DraftStrategy,
  PlayerRanking,
  Position,
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

type PlayerFilter = 'ALL' | 'FAVORITES' | Position;
const PLAYER_FILTERS: Array<PlayerFilter> = ['ALL', 'FAVORITES', 'QB', 'RB', 'WR', 'TE', 'K', 'DST'];
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
  const [search, setSearch] = useState('');
  const [playerFilter, setPlayerFilter] = useState<PlayerFilter>('ALL');
  const [importMessage, setImportMessage] = useState('Upload your rankings to begin.');
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const totalPicks = totalDraftPicks(config);
  const complete = isDraftComplete(picks, config);
  const currentOverallPick = complete ? totalPicks : picks.length + 1;
  const currentRound = roundForOverallPick(currentOverallPick, config.teamCount);
  const currentSlot = complete ? null : draftSlotForOverallPick(currentOverallPick, config.teamCount);
  const currentPickInRound = pickInRound(currentOverallPick, config.teamCount);
  const nextUserPick = complete ? null : nextUserOverallPick(currentOverallPick, config);
  const isUserOnClock = currentSlot === config.userDraftSlot;

  useEffect(() => {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    const snapshot = raw ? parseDraftSnapshot(raw) : null;

    if (snapshot) {
      setConfig(snapshot.config);
      setPlayers(snapshot.players);
      setPicks(snapshot.picks);
      setFavoritePlayerIds(snapshot.favoritePlayerIds);
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
      serializeDraftSnapshot({ config, players, picks, favoritePlayerIds }),
    );
  }, [hydrated, config, players, picks, favoritePlayerIds]);

  const favoriteIds = useMemo(() => new Set(favoritePlayerIds), [favoritePlayerIds]);
  const draftedIds = useMemo(() => new Set(picks.map((pick) => pick.playerId)), [picks]);
  const board = useMemo(() => buildDraftBoard(config, picks, players), [config, picks, players]);
  const availablePlayers = useMemo(
    () =>
      players.filter((player) => {
        if (draftedIds.has(player.id)) return false;
        if (playerFilter === 'FAVORITES' && !favoriteIds.has(player.id)) return false;
        if (playerFilter !== 'ALL' && playerFilter !== 'FAVORITES' && player.position !== playerFilter) return false;
        const query = search.trim().toLowerCase();
        if (!query) return true;
        return (
          player.name.toLowerCase().includes(query) ||
          player.position.toLowerCase().includes(query) ||
          player.nflTeam?.toLowerCase().includes(query)
        );
      }),
    [players, draftedIds, playerFilter, favoriteIds, search],
  );

  const recommendations = useMemo(
    () =>
      complete
        ? []
        : recommendPlayers({ players, picks, config, currentOverallPick, favoritePlayerIds, limit: 3 }),
    [players, picks, config, currentOverallPick, favoritePlayerIds, complete],
  );

  const userRoster = useMemo(
    () => rosterForSlot(config.userDraftSlot, picks, players),
    [players, picks, config.userDraftSlot],
  );

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

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
    if (complete || draftedIds.has(player.id)) return;
    const overallPick = picks.length + 1;
    setPicks((existing) => [
      ...existing,
      {
        overallPick,
        round: roundForOverallPick(overallPick, config.teamCount),
        pickInRound: pickInRound(overallPick, config.teamCount),
        draftSlot: draftSlotForOverallPick(overallPick, config.teamCount),
        playerId: player.id,
      },
    ]);
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
    setPicks((existing) => existing.slice(0, -1));
  }

  function restartDraft() {
    if (picks.length > 0 && !window.confirm('Restart the draft and clear all entered picks?')) return;
    setPicks([]);
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
        <label className="uploadButton">
          Import rankings
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} hidden />
        </label>
      </header>

      <section className="statusBar">
        <Status
          label="Current"
          value={complete ? 'Draft complete' : `R${currentRound} • ${currentRound}.${String(currentPickInRound).padStart(2, '0')}`}
        />
        <Status label="Overall pick" value={complete ? `${totalPicks}/${totalPicks}` : `${currentOverallPick}/${totalPicks}`} />
        <Status
          label="On the clock"
          value={complete ? '—' : isUserOnClock ? 'YOU' : `Team ${currentSlot}`}
          emphasis={isUserOnClock}
        />
        <Status label="Your next pick" value={nextUserPick ? `#${nextUserPick}` : '—'} />
        <div className="statusActions">
          <button className="secondaryButton" onClick={undoLastPick} disabled={picks.length === 0}>
            Undo last pick
          </button>
          <button className="secondaryButton" onClick={restartDraft} disabled={picks.length === 0}>
            Restart draft
          </button>
        </div>
      </section>

      <section className="setupCard">
        <div>
          <strong>Rankings</strong>
          <span className="muted">{importMessage}</span>
          {error ? <span className="error">{error}</span> : null}
          <strong>League</strong>
          <span className="muted">Half-PPR • 1QB / 2RB / 3WR / 1TE / 1 FLEX (RB/WR/TE) / 1 DST / 1 K / 6 bench</span>
        </div>
        <div className="setupControls">
          <label>
            Teams
            <input
              type="number"
              min={4}
              max={20}
              value={config.teamCount}
              disabled={picks.length > 0}
              onChange={(event) =>
                setConfig((current) => ({ ...current, teamCount: Number(event.target.value) || 10 }))
              }
            />
          </label>
          <label>
            Your slot
            <input
              type="number"
              min={1}
              max={config.teamCount}
              value={config.userDraftSlot}
              disabled={picks.length > 0}
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
            Strategy
            <select
              value={config.draftStrategy ?? 'BALANCED'}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  draftStrategy: event.target.value as DraftStrategy,
                }))
              }
            >
              {STRATEGY_OPTIONS.map((strategy) => (
                <option value={strategy.value} key={strategy.value}>
                  {strategy.label}
                </option>
              ))}
            </select>
          </label>
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
                <div className={slot === config.userDraftSlot ? 'teamHeader userTeam' : 'teamHeader'} key={slot}>
                  <strong>{slot === config.userDraftSlot ? 'YOU' : `Team ${slot}`}</strong>
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
                const current = !complete && cell.overallPick === currentOverallPick;
                const userCell = cell.draftSlot === config.userDraftSlot;
                const classes = ['draftCell', current ? 'currentPick' : '', userCell ? 'userCell' : '']
                  .filter(Boolean)
                  .join(' ');
                return (
                  <div className={classes} key={cell.overallPick}>
                    <small>#{cell.overallPick}</small>
                    {cell.player ? (
                      <>
                        <strong>{cell.player.name}</strong>
                        <span>
                          {cell.player.position}{cell.player.nflTeam ? ` • ${cell.player.nflTeam}` : ''}
                        </span>
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
            <span className="countPill">{players.length - draftedIds.size} available</span>
          </div>

          <input
            className="searchInput"
            placeholder="Search player or team..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <div className="filters">
            {PLAYER_FILTERS.map((filter) => (
              <button
                key={filter}
                className={playerFilter === filter ? 'filter active' : 'filter'}
                onClick={() => setPlayerFilter(filter)}
              >
                {filter === 'FAVORITES' ? '★ Favorites' : filter}
              </button>
            ))}
          </div>

          <div className="playerList">
            {availablePlayers.slice(0, 100).map((player) => {
              const favorite = favoriteIds.has(player.id);
              return (
                <div className="playerRow" key={player.id}>
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
                    disabled={complete}
                  >
                    {complete ? 'Complete' : 'Draft'}
                  </button>
                </div>
              );
            })}
            {players.length === 0 ? (
              <EmptyState text="Import an .xlsx, .xls, or .csv rankings file. Required columns: Player, Position, Rank." />
            ) : complete ? (
              <EmptyState text="Draft complete. Use Undo last pick if you need to correct the final selection." />
            ) : availablePlayers.length === 0 ? (
              <EmptyState text="No available players match this filter." />
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
                    <ul>
                      {recommendation.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState text={complete ? 'Draft complete.' : 'Recommendations appear after rankings are imported.'} />
            )}
          </section>

          <section className="panel rosterPanel">
            <div className="panelHeader">
              <div>
                <span className="eyebrow">Team {config.userDraftSlot}</span>
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
            const player = players.find((candidate) => candidate.id === pick.playerId);
            return (
              <div className={pick.draftSlot === config.userDraftSlot ? 'historyPick userPick' : 'historyPick'} key={pick.overallPick}>
                <small>#{pick.overallPick} • Team {pick.draftSlot}</small>
                <strong>{player?.name ?? pick.playerId}</strong>
                <span>{player?.position}</span>
              </div>
            );
          })}
          {picks.length === 0 ? <EmptyState text="No picks entered yet." /> : null}
        </div>
      </section>
    </main>
  );
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

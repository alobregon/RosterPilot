'use client';

import { ChangeEvent, useMemo, useState } from 'react';
import {
  draftSlotForOverallPick,
  nextUserOverallPick,
  pickInRound,
  roundForOverallPick,
} from '@/lib/draft';
import { recommendPlayers } from '@/lib/recommendation';
import { parseRankingFile } from '@/lib/spreadsheet';
import type { DraftConfig, DraftPick, PlayerRanking, Position } from '@/lib/types';

const DEFAULT_CONFIG: DraftConfig = {
  teamCount: 10,
  userDraftSlot: 7,
  qbStarters: 1,
  rbStarters: 2,
  wrStarters: 3,
  teStarters: 1,
  flexStarters: 1,
};

const POSITION_FILTERS: Array<'ALL' | Position> = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DST'];

export default function DraftCompanionPage() {
  const [config, setConfig] = useState<DraftConfig>(DEFAULT_CONFIG);
  const [players, setPlayers] = useState<PlayerRanking[]>([]);
  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [search, setSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState<'ALL' | Position>('ALL');
  const [importMessage, setImportMessage] = useState('Upload your rankings to begin.');
  const [error, setError] = useState<string | null>(null);

  const currentOverallPick = picks.length + 1;
  const currentRound = roundForOverallPick(currentOverallPick, config.teamCount);
  const currentSlot = draftSlotForOverallPick(currentOverallPick, config.teamCount);
  const currentPickInRound = pickInRound(currentOverallPick, config.teamCount);
  const nextUserPick = nextUserOverallPick(currentOverallPick, config);
  const isUserOnClock = currentSlot === config.userDraftSlot;

  const draftedIds = useMemo(() => new Set(picks.map((pick) => pick.playerId)), [picks]);
  const availablePlayers = useMemo(
    () =>
      players.filter((player) => {
        if (draftedIds.has(player.id)) return false;
        if (positionFilter !== 'ALL' && player.position !== positionFilter) return false;
        const query = search.trim().toLowerCase();
        if (!query) return true;
        return (
          player.name.toLowerCase().includes(query) ||
          player.position.toLowerCase().includes(query) ||
          player.nflTeam?.toLowerCase().includes(query)
        );
      }),
    [players, draftedIds, positionFilter, search],
  );

  const recommendations = useMemo(
    () => recommendPlayers({ players, picks, config, currentOverallPick, limit: 3 }),
    [players, picks, config, currentOverallPick],
  );

  const userRoster = useMemo(() => {
    const userIds = new Set(
      picks.filter((pick) => pick.draftSlot === config.userDraftSlot).map((pick) => pick.playerId),
    );
    return players.filter((player) => userIds.has(player.id));
  }, [players, picks, config.userDraftSlot]);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setError(null);
      const result = await parseRankingFile(file);
      setPlayers(result.players);
      setPicks([]);
      setImportMessage(
        `${result.players.length} players imported${
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
    if (draftedIds.has(player.id)) return;
    const overallPick = currentOverallPick;
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

  function undoLastPick() {
    setPicks((existing) => existing.slice(0, -1));
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
          value={`R${currentRound} • ${currentRound}.${String(currentPickInRound).padStart(2, '0')}`}
        />
        <Status label="Overall pick" value={`${currentOverallPick}`} />
        <Status label="On the clock" value={isUserOnClock ? 'YOU' : `Team ${currentSlot}`} emphasis={isUserOnClock} />
        <Status label="Your next pick" value={`#${nextUserPick}`} />
        <button className="secondaryButton" onClick={undoLastPick} disabled={picks.length === 0}>
          Undo last pick
        </button>
      </section>

      <section className="setupCard">
        <div>
          <strong>Rankings</strong>
          <span className="muted">{importMessage}</span>
          {error ? <span className="error">{error}</span> : null}
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
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  userDraftSlot: Math.min(config.teamCount, Math.max(1, Number(event.target.value) || 1)),
                }))
              }
            />
          </label>
        </div>
      </section>

      <div className="dashboardGrid">
        <section className="panel playersPanel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Live board</span>
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
            {POSITION_FILTERS.map((position) => (
              <button
                key={position}
                className={positionFilter === position ? 'filter active' : 'filter'}
                onClick={() => setPositionFilter(position)}
              >
                {position}
              </button>
            ))}
          </div>

          <div className="playerList">
            {availablePlayers.slice(0, 80).map((player) => (
              <button className="playerRow" key={player.id} onClick={() => draftPlayer(player)}>
                <span className="rank">{player.overallRank}</span>
                <span className="playerIdentity">
                  <strong>{player.name}</strong>
                  <small>
                    {player.position} {player.nflTeam ? `• ${player.nflTeam}` : ''}
                    {player.tier != null ? ` • Tier ${player.tier}` : ''}
                  </small>
                </span>
                <span className="draftAction">Draft</span>
              </button>
            ))}
            {players.length === 0 ? (
              <EmptyState text="Import an .xlsx, .xls, or .csv rankings file. Required columns: Player, Position, Rank." />
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
              <span className="countPill">Recommendation strength</span>
            </div>
            {recommendations.length ? (
              <div className="recommendationList">
                {recommendations.map((recommendation, index) => (
                  <article className="recommendation" key={recommendation.player.id}>
                    <div className="recommendationTopline">
                      <span className="medal">#{index + 1}</span>
                      <div>
                        <strong>{recommendation.player.name}</strong>
                        <small>
                          {recommendation.player.position} • Rank {recommendation.player.overallRank}
                        </small>
                      </div>
                      <span className="score">{recommendation.strength}%</span>
                    </div>
                    <div className="scoreTrack">
                      <span style={{ width: `${recommendation.strength}%` }} />
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
              <EmptyState text="Recommendations appear after rankings are imported." />
            )}
          </section>

          <section className="panel rosterPanel">
            <div className="panelHeader">
              <div>
                <span className="eyebrow">Team {config.userDraftSlot}</span>
                <h2>Your roster</h2>
              </div>
              <span className="countPill">{userRoster.length} players</span>
            </div>
            <div className="rosterList">
              {userRoster.length ? (
                userRoster.map((player) => (
                  <div className="rosterRow" key={player.id}>
                    <span className="positionBadge">{player.position}</span>
                    <span>{player.name}</span>
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

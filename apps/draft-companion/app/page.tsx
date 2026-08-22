'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { buildDraftBoard, rosterForSlot } from '@/lib/board';
import { replaceDraftPick, removeDraftPick } from '@/lib/corrections';
import { nextUserOverallPick } from '@/lib/draft';
import { DRAFT_STORAGE_KEY, parseDraftSnapshot, serializeDraftSnapshot } from '@/lib/persistence';
import { validateRankingPool } from '@/lib/preflight';
import { recommendPlayers } from '@/lib/recommendation';
import { deriveDraftSession } from '@/lib/session';
import { defaultTeamNames, resizeTeamNames, validateDraftSetup } from '@/lib/setup';
import { parseRankingFile } from '@/lib/spreadsheet';
import { strategyAfterSlotChange } from '@/lib/strategy';
import { DraftUi, STRATEGIES, type Correction, type PlayerFilter, type PlayerSort } from './draft-ui';
import type { DraftConfig, DraftPick, DraftStrategy, PlayerRanking, ScoringFormat } from '@/lib/types';

const DEFAULT: DraftConfig = {
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

export default function Page() {
  const [config, setConfig] = useState(DEFAULT);
  const [players, setPlayers] = useState<PlayerRanking[]>([]);
  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [teamNames, setTeamNames] = useState(() => defaultTeamNames(10));
  const [started, setStarted] = useState(false);
  const [correction, setCorrection] = useState<Correction | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<PlayerFilter>('ALL');
  const [sort, setSort] = useState<PlayerSort>('RANK');
  const [message, setMessage] = useState('Upload your rankings to begin.');
  const [error, setError] = useState<string | null>(null);
  const [storage, setStorage] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const setup = useMemo(() => validateDraftSetup(config), [config]);
  const preflight = useMemo(() => validateRankingPool(players, config), [players, config]);
  const session = useMemo(() => deriveDraftSession(picks, config, started), [picks, config, started]);
  const correcting = Boolean(correction) || session.historicalGap;
  const nextUserPick = !started || session.complete ? null : nextUserOverallPick(session.currentOverallPick, config);
  const favorites = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const drafted = useMemo(() => new Set(picks.map((pick) => pick.playerId)), [picks]);
  const board = useMemo(() => buildDraftBoard(config, picks, players), [config, picks, players]);
  const userRoster = useMemo(
    () => rosterForSlot(config.userDraftSlot, picks, players),
    [config.userDraftSlot, picks, players],
  );
  const recs = useMemo(
    () =>
      !started || session.complete || correcting
        ? []
        : recommendPlayers({
            players,
            picks,
            config,
            currentOverallPick: session.currentOverallPick,
            favoritePlayerIds: favoriteIds,
            limit: 3,
          }),
    [started, session.complete, session.currentOverallPick, correcting, players, picks, config, favoriteIds],
  );

  const visible = useMemo(
    () =>
      players
        .filter((player) => {
          const isDrafted = drafted.has(player.id);
          if (filter === 'DRAFTED' ? !isDrafted : isDrafted) return false;
          if (filter === 'FAVORITES' && !favorites.has(player.id)) return false;
          if (!['ALL', 'FAVORITES', 'DRAFTED'].includes(filter) && player.position !== filter) return false;
          const query = search.trim().toLowerCase();
          return (
            !query ||
            player.name.toLowerCase().includes(query) ||
            player.position.toLowerCase().includes(query) ||
            Boolean(player.nflTeam?.toLowerCase().includes(query))
          );
        })
        .sort((a, b) => {
          if (sort === 'NAME') return a.name.localeCompare(b.name) || a.overallRank - b.overallRank;
          if (sort === 'ADP') {
            return (a.adp ?? Infinity) - (b.adp ?? Infinity) || a.overallRank - b.overallRank;
          }
          return a.overallRank - b.overallRank;
        }),
    [players, drafted, filter, favorites, search, sort],
  );

  function restore(snapshot: NonNullable<ReturnType<typeof parseDraftSnapshot>>) {
    setConfig(snapshot.config);
    setPlayers(snapshot.players);
    setPicks(snapshot.picks);
    setFavoriteIds(snapshot.favoritePlayerIds);
    setTeamNames(snapshot.teamNames);
    setStarted(snapshot.draftStarted);
    setCorrection(null);
    setMessage(`Restored ${snapshot.players.length} players • ${snapshot.picks.length} picks saved`);
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      const snapshot = raw ? parseDraftSnapshot(raw) : null;
      if (snapshot) restore(snapshot);
      else if (raw) setStorage('Saved draft data was invalid. Restore a JSON backup if available.');
    } catch {
      setStorage('Browser storage is unavailable. Download JSON backups during the draft.');
    } finally {
      setHydrated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        DRAFT_STORAGE_KEY,
        serializeDraftSnapshot({
          config,
          players,
          picks,
          favoritePlayerIds: favoriteIds,
          teamNames,
          draftStarted: started,
        }),
      );
      setStorage(null);
    } catch {
      setStorage('Could not save to browser storage. Download a JSON backup now.');
    }
  }, [hydrated, config, players, picks, favoriteIds, teamNames, started]);

  async function importRankings(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || started) return;
    try {
      setError(null);
      const result = await parseRankingFile(file);
      setPlayers(result.players);
      setPicks([]);
      const ids = new Set(result.players.map((player) => player.id));
      setFavoriteIds((existing) => existing.filter((id) => ids.has(id)));
      const derivedAdp = result.players.filter(
        (player) => player.sourceMetadata?.adpSource === 'DERIVED_ECR_VS_ADP',
      ).length;
      setMessage(
        `${result.players.length} players imported${result.detectedSource ? ` from ${result.detectedSource}` : ''}${derivedAdp ? ` • market ADP estimated for ${derivedAdp}` : ''}`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to import rankings.');
    } finally {
      event.target.value = '';
    }
  }

  async function restoreBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setError(null);
      const snapshot = parseDraftSnapshot(await file.text());
      if (!snapshot) throw new Error('This backup is invalid or incompatible.');
      if (started && !confirm('Replace the current draft with this backup?')) return;
      restore(snapshot);
      setStorage('Backup restored successfully.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to restore backup.');
    } finally {
      event.target.value = '';
    }
  }

  function backup() {
    const raw = serializeDraftSnapshot({
      config,
      players,
      picks,
      favoritePlayerIds: favoriteIds,
      teamNames,
      draftStarted: started,
    });
    const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `rosterpilot-draft-backup-${Date.now()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function correct(pick: DraftPick, remove = false) {
    if (correcting) return;
    if (remove && !confirm(`Remove pick #${pick.overallPick}?`)) return;
    setCorrection({ overallPick: pick.overallPick, originalPick: pick });
    if (remove) setPicks((existing) => removeDraftPick(existing, pick.overallPick));
    setFilter('ALL');
  }

  const startError = !setup.valid
    ? setup.errors[0]
    : players.length && !preflight.valid
      ? preflight.errors[0]
      : null;
  const strategyLabel =
    STRATEGIES.find(([value]) => value === (config.draftStrategy ?? 'BALANCED'))?.[1] ?? 'Balanced';

  return (
    <DraftUi
      config={config}
      players={players}
      picks={picks}
      favorites={favorites}
      teamNames={teamNames}
      started={started}
      correction={correction}
      correcting={correcting}
      {...session}
      nextUserPick={nextUserPick}
      onClock={started && !correcting && session.currentSlot === config.userDraftSlot}
      message={message}
      error={error}
      storage={storage}
      startError={startError}
      visible={visible}
      filter={filter}
      sort={sort}
      search={search}
      board={board}
      recs={recs}
      userRoster={userRoster}
      strategyLabel={strategyLabel}
      onImport={importRankings}
      onRestore={restoreBackup}
      onBackup={backup}
      onUndo={() => setPicks((existing) => [...existing].sort((a, b) => a.overallPick - b.overallPick).slice(0, -1))}
      onRestart={() => {
        if (started && !confirm('Restart the draft and unlock setup?')) return;
        setPicks([]);
        setCorrection(null);
        setStarted(false);
      }}
      onCancelCorrection={() => {
        if (!correction) return;
        setPicks((existing) =>
          existing.some((pick) => pick.overallPick === correction.overallPick)
            ? existing
            : [...existing, correction.originalPick].sort((a, b) => a.overallPick - b.overallPick),
        );
        setCorrection(null);
      }}
      onStart={() => setup.valid && preflight.valid && setStarted(true)}
      onTeamCount={(value) => {
        const teamCount = Math.min(20, Math.max(4, Math.trunc(value || 10)));
        setTeamNames((existing) => resizeTeamNames(existing, teamCount));
        setConfig((current) => {
          const nextSlot = Math.min(current.userDraftSlot, teamCount);
          return {
            ...current,
            teamCount,
            userDraftSlot: nextSlot,
            draftStrategy: strategyAfterSlotChange(current.draftStrategy, current.userDraftSlot, nextSlot),
          };
        });
      }}
      onSlot={(value) => {
        const nextSlot = Math.min(config.teamCount, Math.max(1, value || 1));
        setConfig((current) => ({
          ...current,
          userDraftSlot: nextSlot,
          draftStrategy: strategyAfterSlotChange(current.draftStrategy, current.userDraftSlot, nextSlot),
        }));
      }}
      onScoring={(value: ScoringFormat) => setConfig((current) => ({ ...current, scoringFormat: value }))}
      onStrategy={(value: DraftStrategy) => setConfig((current) => ({ ...current, draftStrategy: value }))}
      onRoster={(key, value, max) =>
        setConfig((current) => ({ ...current, [key]: Math.min(max, Math.max(0, Math.trunc(value || 0))) }))
      }
      onTeamName={(index, value) =>
        setTeamNames((existing) => {
          const next = resizeTeamNames(existing, config.teamCount);
          next[index] = value.slice(0, 32);
          return next;
        })
      }
      onFilter={setFilter}
      onSort={setSort}
      onSearch={setSearch}
      onFavorite={(id) =>
        setFavoriteIds((existing) =>
          existing.includes(id) ? existing.filter((value) => value !== id) : [...existing, id],
        )
      }
      onDraft={(player) => {
        if (!started || session.complete || drafted.has(player.id)) return;
        setPicks((existing) =>
          replaceDraftPick(
            existing,
            correction?.overallPick ?? session.currentOverallPick,
            player.id,
            config.teamCount,
          ),
        );
        setCorrection(null);
        setSearch('');
      }}
      onCorrect={correct}
    />
  );
}

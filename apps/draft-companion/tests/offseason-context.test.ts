import { describe, expect, it } from 'vitest';
import {
  getOffseasonContextForPlayers,
  getOffseasonContextJournal,
  getOffseasonContextSource,
  normalizeContextName,
} from '../lib/offseason-context';

describe('2026 offseason context journal', () => {
  it('has unique source and entry IDs and only references known sources', () => {
    const journal = getOffseasonContextJournal();
    const sourceIds = journal.sources.map((source) => source.id);
    const entryIds = journal.entries.map((entry) => entry.id);
    const knownSources = new Set(sourceIds);

    expect(new Set(sourceIds).size).toBe(sourceIds.length);
    expect(new Set(entryIds).size).toBe(entryIds.length);
    expect(journal.season).toBe(2026);

    for (const entry of journal.entries) {
      expect(entry.subjects.length).toBeGreaterThan(0);
      expect(entry.facts.length).toBeGreaterThan(0);
      for (const fact of entry.facts) {
        expect(fact.summary.trim().length).toBeGreaterThan(0);
        expect(fact.sourceIds.length).toBeGreaterThan(0);
        for (const sourceId of fact.sourceIds) {
          expect(knownSources.has(sourceId)).toBe(true);
        }
      }
    }
  });

  it('marks the user-provided ESPN article ingested and exposes grounded offensive context', () => {
    expect(getOffseasonContextSource('espn-newcomers-impact-2026')?.status).toBe('INGESTED');

    const journal = getOffseasonContextJournal();
    const espnFacts = journal.entries.flatMap((entry) =>
      entry.facts.filter((fact) => fact.sourceIds.includes('espn-newcomers-impact-2026')),
    );
    expect(espnFacts.length).toBeGreaterThan(20);

    const moore = getOffseasonContextForPlayers(['DJ Moore']).find(
      (entry) => entry.id === 'espn-dj-moore-buffalo-role',
    );
    expect(moore?.outlook?.origin).toBe('SOURCE_ANALYST');
    expect(moore?.outlook?.summary).toContain('more than 100 targets');
  });

  it('keeps the Yahoo Amon-Ra schedule take small and explicitly analyst-authored', () => {
    expect(getOffseasonContextSource('yahoo-lindys-amonra-schedule-2026')?.status).toBe('INGESTED');

    const schedule = getOffseasonContextForPlayers(['Amon-Ra St. Brown']).find(
      (entry) => entry.id === 'yahoo-amonra-2026-schedule-context',
    );
    expect(schedule?.categories).toContain('SCHEDULE');
    expect(schedule?.outlook).toMatchObject({
      origin: 'SOURCE_ANALYST',
      direction: 'POSITIVE',
      confidence: 'LOW_MEDIUM',
    });
  });

  it('exposes PhillyVoice RB upside and downside without turning opinions into facts', () => {
    expect(getOffseasonContextSource('phillyvoice-rb-rankings-2026')?.status).toBe('INGESTED');

    const gibbs = getOffseasonContextForPlayers(['Jahmyr Gibbs']).find(
      (entry) => entry.id === 'phillyvoice-gibbs-expanded-role',
    );
    const cmc = getOffseasonContextForPlayers(['Christian McCaffrey']).find(
      (entry) => entry.id === 'phillyvoice-cmc-age-efficiency-risk',
    );

    expect(gibbs?.outlook).toMatchObject({
      origin: 'SOURCE_ANALYST',
      direction: 'POSITIVE',
      confidence: 'MEDIUM_HIGH',
    });
    expect(cmc?.facts.some((fact) => fact.summary.includes('2,126 yards from scrimmage'))).toBe(true);
    expect(cmc?.outlook?.direction).toBe('MIXED_NEGATIVE');
  });

  it('returns the Ladd McConkey environment entries with explicit inference labels', () => {
    const entries = getOffseasonContextForPlayers(['Ladd McConkey']);
    const environment = entries.find((entry) => entry.id === 'lac-ladd-2026-environment');
    const personnel = entries.find((entry) => entry.id === 'espn-chargers-mcdaniel-personnel-clue');

    expect(environment).toBeDefined();
    expect(environment?.categories).toEqual(
      expect.arrayContaining(['COACHING_CHANGE', 'TARGET_COMPETITION']),
    );
    expect(environment?.outlook?.origin).toBe('ROSTERPILOT_INFERENCE');
    expect(environment?.outlook?.direction).toBe('POSITIVE');

    expect(personnel).toBeDefined();
    expect(personnel?.outlook?.origin).toBe('ROSTERPILOT_INFERENCE');
    expect(personnel?.outlook?.summary).toContain('does not by itself prove higher target volume');
  });

  it('normalizes apostrophes, accents, punctuation, and whitespace for player matching', () => {
    expect(normalizeContextName("Ja'Kobi Lane")).toBe(normalizeContextName('Ja’Kobi   Lane'));
    expect(normalizeContextName('DÉZHAUN Stribling')).toBe('dezhaun stribling');

    const entries = getOffseasonContextForPlayers(['Ja’Kobi Lane']);
    expect(entries.some((entry) => entry.id === 'bal-jakobi-lane-sleeper')).toBe(true);
  });

  it('preserves conflicting source outlooks instead of forcing consensus', () => {
    const brooks = getOffseasonContextForPlayers(['Jonathon Brooks']).find(
      (entry) => entry.id === 'car-jonathon-brooks-conflicting-outlook',
    );

    expect(brooks?.outlook?.origin).toBe('SOURCE_CONFLICT');
    expect(brooks?.outlook?.direction).toBe('MIXED');
    expect(brooks?.facts.length).toBeGreaterThanOrEqual(3);
  });

  it('overrides corrected metadata without duplicating the legacy entry', () => {
    const journal = getOffseasonContextJournal();
    const darnoldEntries = journal.entries.filter(
      (entry) => entry.id === 'nyj-sam-darnold-fantasy-ceiling',
    );

    expect(darnoldEntries).toHaveLength(1);
    expect(darnoldEntries[0].subjects[0]).toMatchObject({ name: 'Sam Darnold', team: 'SEA' });
  });

  it('prioritizes time-sensitive and higher-confidence entries and caps output', () => {
    const entries = getOffseasonContextForPlayers(
      ['Jonathon Brooks', 'George Kittle', 'Ladd McConkey'],
      2,
    );

    expect(entries).toHaveLength(2);
    expect(entries.every((entry) => entry.timeSensitive)).toBe(true);
    expect(() => getOffseasonContextForPlayers(['Ladd McConkey'], 0)).toThrow(
      'maxEntries must be a positive integer',
    );
  });
});

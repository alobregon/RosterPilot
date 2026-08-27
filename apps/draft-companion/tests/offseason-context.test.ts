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

  it('keeps the unavailable ESPN article pending rather than synthesizing claims', () => {
    expect(getOffseasonContextSource('espn-newcomers-impact-2026')?.status).toBe('PENDING_EXCERPT');

    const journal = getOffseasonContextJournal();
    const espnFacts = journal.entries.flatMap((entry) =>
      entry.facts.filter((fact) => fact.sourceIds.includes('espn-newcomers-impact-2026')),
    );
    expect(espnFacts).toHaveLength(0);
  });

  it('returns the Ladd McConkey environment entry with an explicit inference label', () => {
    const entries = getOffseasonContextForPlayers(['Ladd McConkey']);
    const environment = entries.find((entry) => entry.id === 'lac-ladd-2026-environment');

    expect(environment).toBeDefined();
    expect(environment?.categories).toEqual(
      expect.arrayContaining(['COACHING_CHANGE', 'TARGET_COMPETITION']),
    );
    expect(environment?.outlook?.origin).toBe('ROSTERPILOT_INFERENCE');
    expect(environment?.outlook?.direction).toBe('POSITIVE');
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

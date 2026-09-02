import { describe, expect, it } from 'vitest';
import {
  buildNflverseHistoricalProfile,
  NflverseAmbiguousPlayerError,
  normalizeNflversePlayerName,
  parseNflversePlayerStatsCsv,
  parseNflverseSeasons,
} from '../lib/nflverse';

describe('nflverse historical player profiles', () => {
  it('parses quoted CSV fields and preserves verified player-stat columns', () => {
    const rows = parseNflversePlayerStatsCsv(
      [
        'player_id,player_name,player_display_name,position,team,season,games,targets,receptions,receiving_yards,receiving_tds,fantasy_points,fantasy_points_ppr,note',
        '00-1234,A.Example,"Example, Jr.",WR,DET,2025,17,150,100,1200,9,174,274,"He said ""hello"""',
      ].join('\r\n'),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      player_id: '00-1234',
      player_display_name: 'Example, Jr.',
      position: 'WR',
      team: 'DET',
      targets: '150',
      receptions: '100',
      receiving_yards: '1200',
      fantasy_points_ppr: '274',
      note: 'He said "hello"',
    });
  });

  it('normalizes punctuation, accents, and spacing for exact name matching', () => {
    expect(normalizeNflversePlayerName('Amon-Ra St. Brown')).toBe('amon ra st brown');
    expect(normalizeNflversePlayerName('  Amon–Ra   St. Brown  ')).toBe('amon ra st brown');
    expect(normalizeNflversePlayerName('José Núñez')).toBe('jose nunez');
  });

  it('builds a multi-season profile and derives half-PPR/per-game values', () => {
    const profile = buildNflverseHistoricalProfile({
      playerName: 'Amon-Ra St. Brown',
      position: 'WR',
      seasonRows: [
        {
          season: 2025,
          rows: [
            {
              player_id: '00-0036963',
              player_name: 'A.St. Brown',
              player_display_name: 'Amon-Ra St. Brown',
              position: 'WR',
              team: 'DET',
              games: '17',
              targets: '170',
              receptions: '110',
              receiving_yards: '1300',
              receiving_tds: '10',
              carries: '2',
              rushing_yards: '12',
              rushing_tds: '0',
              fantasy_points: '191.2',
              fantasy_points_ppr: '301.2',
            },
          ],
        },
        {
          season: 2024,
          rows: [
            {
              player_id: '00-0036963',
              player_name: 'A.St. Brown',
              player_display_name: 'Amon-Ra St. Brown',
              position: 'WR',
              team: 'DET',
              games: '17',
              targets: '141',
              receptions: '115',
              receiving_yards: '1263',
              receiving_tds: '12',
              carries: '3',
              rushing_yards: '7',
              rushing_tds: '0',
              fantasy_points: '204',
              fantasy_points_ppr: '319',
            },
          ],
        },
      ],
    });

    expect(profile).not.toBeNull();
    expect(profile?.playerId).toBe('00-0036963');
    expect(profile?.recentTeam).toBe('DET');
    expect(profile?.seasons.map((season) => season.season)).toEqual([2025, 2024]);
    expect(profile?.seasons[0].receiving).toMatchObject({
      targets: 170,
      receptions: 110,
      yards: 1300,
      touchdowns: 10,
    });
    expect(profile?.seasons[0].fantasy.halfPprPoints).toBeCloseTo(246.2, 5);
    expect(profile?.seasons[0].perGame.targets).toBe(10);
    expect(profile?.seasons[0].perGame.halfPprPoints).toBe(14.48);
  });

  it('aggregates multiple same-season team rows for a traded player', () => {
    const profile = buildNflverseHistoricalProfile({
      playerName: 'Example Player',
      seasonRows: [
        {
          season: 2025,
          rows: [
            {
              player_id: '00-traded',
              player_display_name: 'Example Player',
              position: 'RB',
              team: 'AAA',
              games: '8',
              carries: '100',
              rushing_yards: '450',
              receptions: '20',
              fantasy_points: '80',
              fantasy_points_ppr: '100',
            },
            {
              player_id: '00-traded',
              player_display_name: 'Example Player',
              position: 'RB',
              team: 'BBB',
              games: '7',
              carries: '80',
              rushing_yards: '350',
              receptions: '15',
              fantasy_points: '60',
              fantasy_points_ppr: '75',
            },
          ],
        },
      ],
    });

    expect(profile?.seasons[0].team).toBe('AAA/BBB');
    expect(profile?.seasons[0].games).toBe(15);
    expect(profile?.seasons[0].rushing.carries).toBe(180);
    expect(profile?.seasons[0].rushing.yards).toBe(800);
    expect(profile?.seasons[0].fantasy.halfPprPoints).toBe(157.5);
  });

  it('requires disambiguation when the same normalized name maps to two player IDs', () => {
    expect(() =>
      buildNflverseHistoricalProfile({
        playerName: 'Same Name',
        seasonRows: [
          {
            season: 2025,
            rows: [
              { player_id: '00-one', player_display_name: 'Same Name', position: 'WR', team: 'AAA' },
              { player_id: '00-two', player_display_name: 'Same Name', position: 'RB', team: 'BBB' },
            ],
          },
        ],
      }),
    ).toThrow(NflverseAmbiguousPlayerError);
  });

  it('validates and de-duplicates requested seasons', () => {
    expect(parseNflverseSeasons(null, 2026)).toEqual([2025, 2024, 2023]);
    expect(parseNflverseSeasons('2024,2025,2025', 2026)).toEqual([2025, 2024]);
    expect(() => parseNflverseSeasons('2025,2024,2023,2022,2021,2020', 2026)).toThrow(
      'Request between 1 and 5 seasons.',
    );
    expect(() => parseNflverseSeasons('2027', 2026)).toThrow('Seasons must be whole years');
  });
});

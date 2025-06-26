import { describe, test, expect } from 'bun:test'
import { scoreContest } from '../../src/lib/index'
import type { Participant, ContestRules } from '../../src/lib/types'

describe('Missing Participants and Blacklisted Callsigns Format', () => {
  test('returns tuples with appearance counts for missing participants and blacklisted callsigns', () => {
    const submissions: Participant[] = [
      [
        'OA4T',
        [
          {
            call: 'OA4P',
            qso_date: '20250110',
            time_on: '120000',
            freq: '14.000',
            mode: 'SSB',
          },
          {
            call: 'OA4MISSING', // Missing participant
            qso_date: '20250110',
            time_on: '130000',
            freq: '14.000',
            mode: 'SSB',
          },
          {
            call: 'OA4BLACK', // Blacklisted participant
            qso_date: '20250110',
            time_on: '140000',
            freq: '14.000',
            mode: 'SSB',
          },
        ],
      ],
      [
        'OA4P',
        [
          {
            call: 'OA4T',
            qso_date: '20250110',
            time_on: '120000',
            freq: '14.000',
            mode: 'SSB',
          },
          {
            call: 'OA4MISSING', // Missing participant appears again
            qso_date: '20250110',
            time_on: '130000',
            freq: '14.000',
            mode: 'SSB',
          },
          {
            call: 'OA4BLACK', // Blacklisted participant appears again
            qso_date: '20250110',
            time_on: '140000',
            freq: '14.000',
            mode: 'SSB',
          },
        ],
      ],
    ]

    const rules: ContestRules = {
      name: 'Test Contest',
      start: '2025-01-01T00:00:00Z',
      end: '2025-01-31T23:59:59Z',
      allowMissingParticipants: true,
      blacklist: ['OA4BLACK'],
      rules: {
        validation: ['timeRange', ['default', { maximumTimeDiff: 5 }]],
        scoring: [['default', 1]],
        bonus: [['default', 1]],
        tiebreaker: ['validStations'],
      },
    }

    const result = scoreContest(submissions, rules)

    // Check that missingParticipants is an array of tuples
    expect(Array.isArray(result.missingParticipants)).toBe(true)
    expect(result.missingParticipants.length).toBe(1)
    expect(result.missingParticipants[0]).toEqual(['OA4MISSING', 2]) // Appears in 2 logs

    // Check that blacklistedCallsignsFound is an array of tuples
    expect(Array.isArray(result.blacklistedCallsignsFound)).toBe(true)
    expect(result.blacklistedCallsignsFound.length).toBe(1)
    expect(result.blacklistedCallsignsFound[0]).toEqual(['OA4BLACK', 2]) // Appears in 2 logs

    // Verify alphabetical sorting (single entries in this case)
    expect(result.missingParticipants[0]![0]).toBe('OA4MISSING')
    expect(result.blacklistedCallsignsFound[0]![0]).toBe('OA4BLACK')
  })

  test('handles multiple missing participants and blacklisted callsigns with correct sorting', () => {
    const submissions: Participant[] = [
      [
        'OA4T',
        [
          {
            call: 'ZZ4MISSING', // This should appear last alphabetically
            qso_date: '20250110',
            time_on: '120000',
            freq: '14.000',
            mode: 'SSB',
          },
          {
            call: 'AA4MISSING', // This should appear first alphabetically
            qso_date: '20250110',
            time_on: '130000',
            freq: '14.000',
            mode: 'SSB',
          },
          {
            call: 'ZZ4BLACK',
            qso_date: '20250110',
            time_on: '140000',
            freq: '14.000',
            mode: 'SSB',
          },
          {
            call: 'AA4BLACK',
            qso_date: '20250110',
            time_on: '150000',
            freq: '14.000',
            mode: 'SSB',
          },
        ],
      ],
    ]

    const rules: ContestRules = {
      name: 'Test Contest',
      start: '2025-01-01T00:00:00Z',
      end: '2025-01-31T23:59:59Z',
      allowMissingParticipants: true,
      blacklist: ['AA4BLACK', 'ZZ4BLACK'],
      rules: {
        validation: ['timeRange', ['default', { maximumTimeDiff: 5 }]],
        scoring: [['default', 1]],
        bonus: [['default', 1]],
        tiebreaker: ['validStations'],
      },
    }

    const result = scoreContest(submissions, rules)

    // Check alphabetical sorting of missing participants
    expect(result.missingParticipants).toEqual([
      ['AA4MISSING', 1],
      ['ZZ4MISSING', 1],
    ])

    // Check alphabetical sorting of blacklisted callsigns
    expect(result.blacklistedCallsignsFound).toEqual([
      ['AA4BLACK', 1],
      ['ZZ4BLACK', 1],
    ])
  })
})

import { describe, test, expect, beforeEach } from 'bun:test'
import type { SimpleAdif } from 'adif-parser-ts'
import type { ContestRules, Participant } from '../../src/lib/types'
import { scoreContest } from '../../src/lib'

describe('Contest Scoring E2E', () => {
  let sampleRules: ContestRules
  let submissions: Participant[]

  beforeEach(() => {
    // Setup sample rules
    sampleRules = {
      name: 'Sample Contest 2025',
      start: '2025-04-01T00:00:00Z',
      end: '2025-04-02T23:59:59Z',
      rules: {
        validation: [
          'timeRange',
          ['bands', { '40m': ['7.000', '7.300'], '20m': ['14.000', '14.350'] }],
          ['mode', ['SSB', 'CW', 'FT8']],
          'contactedInContest',
          [
            'uniqueContactsByTimeRange',
            {
              day1: ['2025-04-01T00:00:00Z', '2025-04-01T23:59:59Z'],
              day2: ['2025-04-02T00:00:00Z', '2025-04-02T23:59:59Z'],
            },
          ],
          ['exchange', '^[0-9]{3}$'],
          ['default', { maximumTimeDiff: 5 }],
        ],
        scoring: [
          ['timeRange', { day1: 1, day2: 2 }],
          ['bonusStations', { OA4O: 5, OA4EFJ: 3 }],
        ],
        bonus: [['default', 1]],
        tiebreaker: ['validStations', 'minimumTime'],
      },
    }

    // Create sample ADIF data for participants
    // OA4T submission - contacts with OA4P, OA4EFJ, and OA4O
    const oa4tSubmission: SimpleAdif['records'] = [
      // Day 1 contacts
      {
        call: 'OA4P',
        qso_date: '20250401',
        time_on: '120000',
        freq: '14.000',
        mode: 'SSB',
        rst_sent: '59',
        rst_rcvd: '59',
        stx_string: '000',
        srx_string: '100',
      },
      {
        call: 'OA4EFJ',
        qso_date: '20250401',
        time_on: '130000',
        freq: '7.000',
        mode: 'CW',
        comment: '456',
        rst_sent: '599',
        rst_rcvd: '599',
        stx_string: '001',
        srx_string: '200',
      },
      // Day 2 contacts
      {
        call: 'OA4O',
        qso_date: '20250402',
        time_on: '140000',
        freq: '14.000',
        mode: 'SSB',
        comment: '789',
        rst_sent: '59',
        rst_rcvd: '59',
        stx_string: '002',
        srx_string: '300',
      },
    ]

    // OA4P submission - contacts with OA4T, OA4EFJ
    const oa4pSubmission: SimpleAdif['records'] = [
      // Day 1 contacts
      {
        call: 'OA4T',
        qso_date: '20250401',
        time_on: '120000',
        freq: '14.000',
        mode: 'SSB',
        comment: '123',
        rst_sent: '59',
        rst_rcvd: '59',
        stx_string: '100',
        srx_string: '000',
      },
      // Day 2 contacts
      {
        call: 'OA4EFJ',
        qso_date: '20250402',
        time_on: '150000',
        freq: '7.000',
        mode: 'CW',
        comment: '456',
        rst_sent: '599',
        rst_rcvd: '599',
        stx_string: '101',
        srx_string: '201',
      },
    ]

    // OA4EFJ submission - contacts with OA4T, OA4P, and OA4O
    const oa4efjSubmission: SimpleAdif['records'] = [
      // Day 1 contacts
      {
        call: 'OA4T',
        qso_date: '20250401',
        time_on: '130000',
        freq: '7.000',
        mode: 'CW',
        comment: '456',
        rst_sent: '599',
        rst_rcvd: '599',
        stx_string: '200',
        srx_string: '001',
      },
      // Day 2 contacts
      {
        call: 'OA4P',
        qso_date: '20250402',
        time_on: '150000',
        freq: '7.000',
        mode: 'CW',
        comment: '456',
        rst_sent: '599',
        rst_rcvd: '599',
        stx_string: '201',
        srx_string: '101',
      },
      {
        call: 'OA4O',
        qso_date: '20250402',
        time_on: '160000',
        freq: '14.000',
        mode: 'SSB',
        comment: '789',
        rst_sent: '59',
        rst_rcvd: '59',
        stx_string: '202',
        srx_string: '301',
      },
    ]

    // OA4O submission - contacts with OA4T and OA4EFJ
    const oa4oSubmission: SimpleAdif['records'] = [
      // Day 2 contacts
      {
        call: 'OA4T',
        qso_date: '20250402',
        time_on: '140000',
        freq: '14.000',
        mode: 'SSB',
        comment: '789',
        rst_sent: '59',
        rst_rcvd: '59',
        stx_string: '300',
        srx_string: '002',
      },
      {
        call: 'OA4EFJ',
        qso_date: '20250402',
        time_on: '160000',
        freq: '14.000',
        mode: 'SSB',
        comment: '789',
        rst_sent: '59',
        rst_rcvd: '59',
        stx_string: '301',
        srx_string: '202',
      },
    ]

    submissions = [
      ['OA4T', oa4tSubmission],
      ['OA4P', oa4pSubmission],
      ['OA4EFJ', oa4efjSubmission],
      ['OA4O', oa4oSubmission],
    ]
  })

  test('scoreContest returns correctly scored and sorted results', () => {
    const results = scoreContest(submissions, sampleRules)

    // Verify we have results for all participants
    expect(results.length).toBe(4)

    // Expected scores based on contact points and bonus stations:
    // OA4T: 3 contacts
    //   - OA4P (day1): 1 point
    //   - OA4EFJ (day1): 3 points (bonus station)
    //   - OA4O (day2): 5 points (bonus station)
    //   Total = 9 points

    // OA4P: 2 contacts
    //   - OA4T (day1): 1 point
    //   - OA4EFJ (day2): 3 points (bonus station)
    //   Total = 4 points

    // OA4EFJ: 3 contacts
    //   - OA4T (day1): 1 point
    //   - OA4P (day2): 2 points
    //   - OA4O (day2): 5 points (bonus station)
    //   Total = 8 points

    // OA4O: 2 contacts
    //   - OA4T (day2): 2 points
    //   - OA4EFJ (day2): 2 points
    //   Total = 4 points

    // OA4T should have the highest score
    expect(results[0]?.[0]).toBe('OA4T')
    expect(results[0]?.[1]).toBe(9)

    // OA4EFJ should be second
    expect(results[1]?.[0]).toBe('OA4EFJ')
    expect(results[1]?.[1]).toBe(8)

    // OA4O should be tied with OA4P (both 4 pts), but actual ordering depends
    // on the tiebreaker implementation
    const remainingScores = results.slice(2).map(r => r[1])
    expect(remainingScores).toContain(4)
    expect(remainingScores).toContain(4)
  })

  test('multiplying bonus is applied correctly', () => {
    // Update rules to include a score multiplier
    const rulesWithBonus: ContestRules = {
      ...sampleRules,
      rules: {
        ...sampleRules.rules,
        bonus: [['default', 2]], // Multiply scores by 2
      },
    }

    const results = scoreContest(submissions, rulesWithBonus)

    // Verify scores are doubled
    expect(results[0]?.[1]).toBe(18) // OA4T: 9 * 2 = 18
    expect(results[1]?.[1]).toBe(16) // OA4EFJ: 8 * 2 = 16
    // Others should be doubled as well (8, 8)
  })

  test('minimumContacts rule filters out participants with insufficient appearances', () => {
    // Create a test scenario with a minimumContacts rule
    const contestRules: ContestRules = {
      name: 'Selective Contest',
      start: '2025-01-01T00:00:00Z',
      end: '2025-01-31T23:59:59Z',
      rules: {
        validation: [
          'timeRange',
          ['mode', ['SSB', 'CW']],
          'contactedInContest',
          ['minimumContacts', 2], // Station must appear in at least 2 logs
        ],
        scoring: [['default', 1]],
        bonus: [['default', 1]],
        tiebreaker: ['validStations'],
      },
    }

    // Create submissions where some stations don't meet minimum requirements
    const oa4tSubmission: SimpleAdif['records'] = [
      { call: 'OA4P', qso_date: '20250110', time_on: '120000', mode: 'SSB' },
      { call: 'OA4X', qso_date: '20250110', time_on: '130000', mode: 'CW' },
    ]

    const oa4pSubmission: SimpleAdif['records'] = [
      { call: 'OA4T', qso_date: '20250110', time_on: '120000', mode: 'SSB' },
      { call: 'OA4X', qso_date: '20250110', time_on: '130000', mode: 'CW' },
    ]

    const oa4zSubmission: SimpleAdif['records'] = [
      { call: 'OA4T', qso_date: '20250110', time_on: '140000', mode: 'SSB' },
    ]

    const testSubmissions: Participant[] = [
      ['OA4T', oa4tSubmission],
      ['OA4P', oa4pSubmission],
      ['OA4Z', oa4zSubmission],
    ]

    const results = scoreContest(testSubmissions, contestRules)

    // OA4T appears in OA4P and OA4Z logs (2 appearances) - should be included
    // OA4P appears in OA4T logs (1 appearance) - should be excluded
    // OA4Z appears in 0 logs (0 appearances) - should be excluded
    // OA4X appears in OA4T and OA4P logs (2 appearances) - missing submission so should be excluded from results

    // Check that only OA4T is included
    expect(results.length).toBe(1)

    const includedCallsigns = results.map(result => result[0])
    expect(includedCallsigns).toContain('OA4T')
    expect(includedCallsigns).not.toContain('OA4X') // Missing participant
    expect(includedCallsigns).not.toContain('OA4P') // Only 1 appearance
    expect(includedCallsigns).not.toContain('OA4Z') // No appearances
  })

  test('blacklist rule correctly excludes stations', () => {
    // Create a test scenario with a blacklist
    const rulesWithBlacklist: ContestRules = {
      name: 'Blacklist Test',
      start: '2025-01-01T00:00:00Z',
      end: '2025-01-31T23:59:59Z',
      blacklist: ['OA4Z'], // OA4Z is blacklisted

      rules: {
        validation: [
          'timeRange',
          'contactedInContest',
          ['default', { maximumTimeDiff: 5 }],
        ],
        scoring: [['default', 1]],
        bonus: [['default', 1]],
        tiebreaker: ['validStations'],
      },
    }

    // Create submissions including blacklisted station
    const oa4tSubmission: SimpleAdif['records'] = [
      {
        call: 'OA4P',
        qso_date: '20250110',
        time_on: '120000',
        freq: '14.000',
        mode: 'SSB',
      },
      {
        call: 'OA4Z',
        qso_date: '20250110',
        time_on: '130000',
        freq: '14.000',
        mode: 'CW',
      },
    ]

    const oa4pSubmission: SimpleAdif['records'] = [
      {
        call: 'OA4T',
        qso_date: '20250110',
        time_on: '120000',
        freq: '14.000',
        mode: 'SSB',
      },
      {
        call: 'OA4Z',
        qso_date: '20250110',
        time_on: '130000',
        freq: '14.000',
        mode: 'CW',
      },
    ]

    const oa4zSubmission: SimpleAdif['records'] = [
      {
        call: 'OA4T',
        qso_date: '20250110',
        time_on: '130000',
        freq: '14.000',
        mode: 'CW',
      },
      {
        call: 'OA4P',
        qso_date: '20250110',
        time_on: '140000',
        freq: '14.000',
        mode: 'CW',
      },
    ]

    const testSubmissions: Participant[] = [
      ['OA4T', oa4tSubmission],
      ['OA4P', oa4pSubmission],
      ['OA4Z', oa4zSubmission],
    ]

    const results = scoreContest(testSubmissions, rulesWithBlacklist)

    // Blacklisted OA4Z should not appear in results
    expect(results.map(r => r[0])).not.toContain('OA4Z')

    // Contacts with OA4Z should be excluded from scores
    const oa4tResult = results.find(r => r[0] === 'OA4T')
    const oa4pResult = results.find(r => r[0] === 'OA4P')
    expect(oa4tResult?.[1]).toBe(1) // Only OA4P contact counts
    expect(oa4pResult?.[1]).toBe(1) // Only OA4T contact counts
  })

  test('tiebreaker rules are correctly applied', () => {
    // Create a scenario with tied scores but different tiebreaker criteria
    const tiebreakerRules: ContestRules = {
      name: 'Tiebreaker Test',
      start: '2025-01-01T00:00:00Z',
      end: '2025-01-31T23:59:59Z',
      rules: {
        validation: ['timeRange', 'contactedInContest'],
        scoring: [['default', 1]], // All contacts worth 1 point
        bonus: [['default', 1]],
        tiebreaker: ['validStations', 'minimumTime'],
      },
    }

    // OA4T - 3 contacts, 2 unique stations (OA4P appears twice), 2-hour span
    const oa4tSubmission: SimpleAdif['records'] = [
      {
        call: 'OA4P',
        qso_date: '20250110',
        time_on: '120000', // 12:00
        mode: 'SSB',
      },
      {
        call: 'OA4P',
        qso_date: '20250110',
        time_on: '130000', // 13:00
        mode: 'CW',
      },
      {
        call: 'OA4X',
        qso_date: '20250110',
        time_on: '140000', // 14:00 - 2 hour span
        mode: 'SSB',
      },
    ]

    // OA4P - 3 contacts, 3 unique stations, 3-hour span
    const oa4pSubmission: SimpleAdif['records'] = [
      {
        call: 'OA4T',
        qso_date: '20250110',
        time_on: '120000', // 12:00
        mode: 'SSB',
      },
      {
        call: 'OA4X',
        qso_date: '20250110',
        time_on: '130000', // 13:00
        mode: 'CW',
      },
      {
        call: 'OA4Z',
        qso_date: '20250110',
        time_on: '150000', // 15:00 - 3 hour span
        mode: 'SSB',
      },
    ]

    const testSubmissions: Participant[] = [
      ['OA4T', oa4tSubmission],
      ['OA4P', oa4pSubmission],
      // Include empty submissions for the contacted stations
      ['OA4X', []],
      ['OA4Z', []],
    ]

    // First test: validStations tiebreaker
    const validStationsRules: ContestRules = {
      ...tiebreakerRules,
      rules: {
        ...tiebreakerRules.rules,
        tiebreaker: ['validStations'],
      },
    }

    const validStationsResults = scoreContest(
      testSubmissions,
      validStationsRules
    )

    // Both have 3 contacts worth 1 point, but OA4P has more unique stations (3 vs 2)
    expect(validStationsResults[0]?.[0]).toBe('OA4P')
    expect(validStationsResults[1]?.[0]).toBe('OA4T')
    expect(validStationsResults[0]?.[1]).toBe(validStationsResults[1]![1]) // Same score

    // Second test: minimumTime tiebreaker
    const minimumTimeRules: ContestRules = {
      ...tiebreakerRules,
      rules: {
        ...tiebreakerRules.rules,
        tiebreaker: ['minimumTime'],
      },
    }

    const minimumTimeResults = scoreContest(testSubmissions, minimumTimeRules)

    // Both have 3 contacts worth 1 point, but OA4T has shorter time span (2 hours vs 3 hours)
    expect(minimumTimeResults[0]?.[0]).toBe('OA4T')
    expect(minimumTimeResults[1]?.[0]).toBe('OA4P')
    expect(minimumTimeResults[0]?.[1]).toBe(minimumTimeResults[1]![1]) // Same score
  })

  test('missing participants are correctly handled', () => {
    const missParticipantRules: ContestRules = {
      name: 'Missing Participant Test',
      start: '2025-01-01T00:00:00Z',
      end: '2025-01-31T23:59:59Z',
      rules: {
        validation: [
          'timeRange',
          ['minimumContacts', 2], // Station must appear in at least 2 logs
        ],
        scoring: [['default', 1]],
        bonus: [['default', 1]],
        tiebreaker: ['validStations'],
      },
    }

    // OA4T has contacts with OA4P and OA4X (non-submitting)
    const oa4tSubmission: SimpleAdif['records'] = [
      { call: 'OA4P', qso_date: '20250110', time_on: '120000', mode: 'SSB' },
      { call: 'OA4X', qso_date: '20250110', time_on: '130000', mode: 'CW' },
    ]

    // OA4P has contacts with OA4T and OA4X (non-submitting)
    const oa4pSubmission: SimpleAdif['records'] = [
      { call: 'OA4T', qso_date: '20250110', time_on: '120000', mode: 'SSB' },
      { call: 'OA4X', qso_date: '20250110', time_on: '130000', mode: 'CW' },
    ]

    // OA4EFJ has contacts with OA4T and OA4P, but doesn't appear in enough logs
    const oa4efjSubmission: SimpleAdif['records'] = [
      { call: 'OA4T', qso_date: '20250110', time_on: '140000', mode: 'SSB' },
      { call: 'OA4P', qso_date: '20250110', time_on: '140000', mode: 'CW' },
    ]

    const testSubmissions: Participant[] = [
      ['OA4T', oa4tSubmission],
      ['OA4P', oa4pSubmission],
      ['OA4EFJ', oa4efjSubmission],
      // OA4X is not submitting but appears in multiple logs
    ]

    const results = scoreContest(testSubmissions, missParticipantRules)

    // OA4X should not be included as a "missing participant" although it appears in multiple logs
    const includedCallsigns = results.map(r => r[0])
    expect(includedCallsigns).not.toContain('OA4X')

    // OA4T and OA4P should be included and have appropriate scores
    expect(includedCallsigns).toContain('OA4T')
    expect(includedCallsigns).toContain('OA4P')
    expect(results.find(r => r[0] === 'OA4T')?.[1]).toBe(2)
    expect(results.find(r => r[0] === 'OA4P')?.[1]).toBe(2)
  })
})

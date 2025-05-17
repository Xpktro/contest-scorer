import { describe, test, expect, beforeEach } from 'bun:test'
import type { SimpleAdif } from 'adif-parser-ts'
import type { ContestRules, Participant } from '../../src/lib/types'
import { scoreContest } from '../../src/lib'

describe('Missing Participants E2E', () => {
  let baseRules: ContestRules
  let submissions: Participant[]

  beforeEach(() => {
    // Setup base rules with more complex scoring rules
    baseRules = {
      name: 'Missing Participants E2E Test',
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
          ['default', { maximumTimeDiff: 5 }],
          ['minimumContacts', 1],
        ],
        scoring: [
          ['timeRange', { day1: 1, day2: 2 }],
          ['bonusStations', { OA4X: 4 }], // OA4X is a missing participant but bonus station
        ],
        bonus: [['default', 1]],
        tiebreaker: ['validStations', 'minimumTime'],
      },
    }

    // Create sample submissions
    const oa4tSubmission: SimpleAdif['records'] = [
      // Day 1 contacts with participants who submitted logs
      {
        call: 'OA4P',
        qso_date: '20250401',
        time_on: '120000',
        freq: '14.000',
        mode: 'SSB',
        rst_sent: '59',
        rst_rcvd: '59',
      },
      {
        call: 'OA4Q',
        qso_date: '20250401',
        time_on: '130000',
        freq: '7.100',
        mode: 'CW',
        rst_sent: '599',
        rst_rcvd: '599',
      },
      // Day 1 contact with missing participant (not submitted a log)
      {
        call: 'OA4X',
        qso_date: '20250401',
        time_on: '140000',
        freq: '14.200',
        mode: 'SSB',
        rst_sent: '59',
        rst_rcvd: '58',
      },
      // Day 2 contact with participant who submitted log
      {
        call: 'OA4P',
        qso_date: '20250402',
        time_on: '150000',
        freq: '7.200',
        mode: 'SSB',
        rst_sent: '57',
        rst_rcvd: '59',
      },
      // Day 2 contact with missing participant
      {
        call: 'OA4Y',
        qso_date: '20250402',
        time_on: '160000',
        freq: '14.100',
        mode: 'SSB',
        rst_sent: '59',
        rst_rcvd: '59',
      },
    ]

    const oa4pSubmission: SimpleAdif['records'] = [
      // Day 1 contact
      {
        call: 'OA4T',
        qso_date: '20250401',
        time_on: '120000',
        freq: '14.000',
        mode: 'SSB',
        rst_sent: '59',
        rst_rcvd: '59',
      },
      // Day 2 contact
      {
        call: 'OA4T',
        qso_date: '20250402',
        time_on: '150000',
        freq: '7.200',
        mode: 'SSB',
        rst_sent: '59',
        rst_rcvd: '57',
      },
    ]

    const oa4qSubmission: SimpleAdif['records'] = [
      // Day 1 contact
      {
        call: 'OA4T',
        qso_date: '20250401',
        time_on: '130000',
        freq: '7.100',
        mode: 'CW',
        rst_sent: '599',
        rst_rcvd: '599',
      },
    ]

    submissions = [
      ['OA4T', oa4tSubmission],
      ['OA4P', oa4pSubmission],
      ['OA4Q', oa4qSubmission],
    ]
  })

  test('With allowMissingParticipants=true, contacts with missing participants are counted and scored', () => {
    const rules: ContestRules = {
      ...baseRules,
      allowMissingParticipants: true,
    }

    const results = scoreContest(submissions, rules)

    // OA4T should have 5 valid contacts
    // - Day 1: OA4P (1pt), OA4Q (1pt), OA4X (4pts with bonus) = 6pts
    // - Day 2: OA4P (2pts), OA4Y (2pts) = 4pts
    // Total: 10pts
    const oa4tResult = results.find(([callsign]) => callsign === 'OA4T')
    expect(oa4tResult).toBeDefined()
    expect(oa4tResult?.[1]).toBe(10)

    // OA4P should have 2 valid contacts
    // - Day 1: OA4T (1pt)
    // - Day 2: OA4T (2pts)
    // Total: 3pts
    const oa4pResult = results.find(([callsign]) => callsign === 'OA4P')
    expect(oa4pResult).toBeDefined()
    expect(oa4pResult?.[1]).toBe(3)

    // OA4Q should have 1 valid contact
    // - Day 1: OA4T (1pt)
    // Total: 1pt
    const oa4qResult = results.find(([callsign]) => callsign === 'OA4Q')
    expect(oa4qResult).toBeDefined()
    expect(oa4qResult?.[1]).toBe(1)
  })

  test('With allowMissingParticipants=false, contacts with missing participants are rejected', () => {
    const rules: ContestRules = {
      ...baseRules,
      allowMissingParticipants: false,
    }

    const results = scoreContest(submissions, rules)

    // OA4T should have 3 valid contacts (missing OA4X and OA4Y)
    // - Day 1: OA4P (1pt), OA4Q (1pt) = 2pts
    // - Day 2: OA4P (2pts) = 2pts
    // Total: 4pts
    const oa4tResult = results.find(([callsign]) => callsign === 'OA4T')
    expect(oa4tResult).toBeDefined()
    expect(oa4tResult?.[1]).toBe(4)

    // OA4P should have 2 valid contacts
    // - Day 1: OA4T (1pt)
    // - Day 2: OA4T (2pts)
    // Total: 3pts
    const oa4pResult = results.find(([callsign]) => callsign === 'OA4P')
    expect(oa4pResult).toBeDefined()
    expect(oa4pResult?.[1]).toBe(3)

    // OA4Q should have 1 valid contact
    // - Day 1: OA4T (1pt)
    // Total: 1pt
    const oa4qResult = results.find(([callsign]) => callsign === 'OA4Q')
    expect(oa4qResult).toBeDefined()
    expect(oa4qResult?.[1]).toBe(1)
  })
})

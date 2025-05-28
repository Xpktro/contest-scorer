import { describe, test, expect, beforeEach } from 'bun:test'
import type { SimpleAdif } from 'adif-parser-ts'
import type { ContestRules, Participant } from '../../src/lib/types'
import { scoreContest } from '../../src/lib'
import { getResults, getScoreForCallsign } from '../utils/test-helpers'

describe('Missing Participants Feature', () => {
  let baseRules: ContestRules
  let submissions: Participant[]

  beforeEach(() => {
    // Setup base rules
    baseRules = {
      name: 'Missing Participants Test Contest',
      start: '2025-04-01T00:00:00Z',
      end: '2025-04-02T23:59:59Z',
      rules: {
        validation: [
          'timeRange',
          ['bands', { '40m': ['7.000', '7.300'], '20m': ['14.000', '14.350'] }],
          ['mode', ['SSB', 'CW']],
          ['default', { maximumTimeDiff: 5 }],
        ],
        scoring: [['default', 1]],
        bonus: [['default', 1]],
        tiebreaker: ['validStations'],
      },
    }

    // OA4T has submitted a log with contacts to OA4P and OA4X (OA4X did not submit a log)
    const oa4tSubmission: SimpleAdif['records'] = [
      // Contact with participant who submitted a log
      {
        call: 'OA4P',
        qso_date: '20250401',
        time_on: '120000',
        freq: '14.000',
        mode: 'SSB',
        rst_sent: '59',
        rst_rcvd: '59',
      },
      // Contact with missing participant (not submitted a log)
      {
        call: 'OA4X',
        qso_date: '20250401',
        time_on: '130000',
        freq: '7.100',
        mode: 'SSB',
        rst_sent: '59',
        rst_rcvd: '58',
      },
    ]

    // OA4P has submitted a log with contact to OA4T
    const oa4pSubmission: SimpleAdif['records'] = [
      {
        call: 'OA4T',
        qso_date: '20250401',
        time_on: '120000',
        freq: '14.000',
        mode: 'SSB',
        rst_sent: '59',
        rst_rcvd: '59',
      },
    ]

    submissions = [
      ['OA4T', oa4tSubmission],
      ['OA4P', oa4pSubmission],
    ]
  })

  test('With allowMissingParticipants=true, contacts with missing participants are counted', () => {
    const rules: ContestRules = {
      ...baseRules,
      allowMissingParticipants: true,
    }

    const contestResults = scoreContest(submissions, rules)

    // Find OA4T's score
    const oa4tResult = getScoreForCallsign(contestResults, 'OA4T')
    expect(oa4tResult).toBeDefined()
    // OA4T should get points for both contacts (OA4P and OA4X)
    expect(oa4tResult).toBe(2)

    // Find OA4P's score
    const oa4pResult = getScoreForCallsign(contestResults, 'OA4P')
    expect(oa4pResult).toBeDefined()
    // OA4P should get points for 1 contact (OA4T)
    expect(oa4pResult).toBe(1)
  })

  test('With allowMissingParticipants=false, contacts with missing participants are rejected', () => {
    const rules: ContestRules = {
      ...baseRules,
      allowMissingParticipants: false,
    }

    const results = scoreContest(submissions, rules)

    // Find OA4T's score
    const oa4tResult = getScoreForCallsign(results, 'OA4T')
    expect(oa4tResult).toBeDefined()
    // OA4T should get points only for the contact with OA4P, not OA4X
    expect(oa4tResult).toBe(1)

    // Find OA4P's score
    const oa4pResult = getScoreForCallsign(results, 'OA4P')
    expect(oa4pResult).toBeDefined()
    // OA4P should get points for 1 contact (OA4T)
    expect(oa4pResult).toBe(1)
  })

  test('By default (unspecified), it should behave as if allowMissingParticipants=true for backward compatibility', () => {
    const rules: ContestRules = {
      ...baseRules,
      // allowMissingParticipants not specified
    }

    const results = scoreContest(submissions, rules)

    // Find OA4T's score
    const oa4tResult = getScoreForCallsign(results, 'OA4T')
    expect(oa4tResult).toBeDefined()
    // OA4T should get points only for the contact with OA4P as our default for backward compatibility
    // is now to check allowMissingParticipants !== false (meaning unspecified behaves like false)
    expect(oa4tResult).toBe(1)

    // Find OA4P's score
    const oa4pResult = getScoreForCallsign(results, 'OA4P')
    expect(oa4pResult).toBeDefined()
    // OA4P should get points for 1 contact (OA4T)
    expect(oa4pResult).toBe(1)
  })
})

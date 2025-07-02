import { describe, expect, test } from 'bun:test'
import { scoreContest } from '../../src/lib'
import type { ContestRules, Participant } from '../../src/types'

describe('Non-Competing Participants E2E', () => {
  test('should handle non-competing participants in a real contest scenario', () => {
    // Simple contest rules with non-competing participants
    const rules: ContestRules = {
      name: 'Test Contest',
      start: '2025-04-01T00:00:00Z',
      end: '2025-04-01T23:59:59Z',
      nonCompeting: ['OA4DEF', 'OA4GHI'], // These should not appear in main results
      rules: {
        validation: ['default'],
        scoring: [['default', 1]],
        bonus: [['default', 2]], // 2x multiplier for testing bonus rules
        tiebreaker: ['default'],
      },
    }

    // Sample contest data with reciprocal contacts
    const submissions: Participant[] = [
      [
        'OA4ABC',
        [
          {
            call: 'OA4DEF',
            qso_date: '20250401',
            time_on: '120000',
            freq: '14.000',
            mode: 'SSB',
            rst_sent: '59',
            rst_rcvd: '59',
            stx_string: '001',
            srx_string: '002',
          },
          {
            call: 'OA4GHI',
            qso_date: '20250401',
            time_on: '120100',
            freq: '14.000',
            mode: 'SSB',
            rst_sent: '59',
            rst_rcvd: '59',
            stx_string: '001',
            srx_string: '003',
          },
          {
            call: 'OA4JKL',
            qso_date: '20250401',
            time_on: '120200',
            freq: '14.000',
            mode: 'SSB',
            rst_sent: '59',
            rst_rcvd: '59',
            stx_string: '001',
            srx_string: '004',
          },
        ],
      ],
      [
        'OA4DEF', // Non-competing
        [
          {
            call: 'OA4ABC',
            qso_date: '20250401',
            time_on: '120000',
            freq: '14.000',
            mode: 'SSB',
            rst_sent: '59',
            rst_rcvd: '59',
            stx_string: '002',
            srx_string: '001',
          },
        ],
      ],
      [
        'OA4GHI', // Non-competing
        [
          {
            call: 'OA4ABC',
            qso_date: '20250401',
            time_on: '120100',
            freq: '14.000',
            mode: 'SSB',
            rst_sent: '59',
            rst_rcvd: '59',
            stx_string: '003',
            srx_string: '001',
          },
          {
            call: 'OA4JKL',
            qso_date: '20250401',
            time_on: '120300',
            freq: '14.000',
            mode: 'SSB',
            rst_sent: '59',
            rst_rcvd: '59',
            stx_string: '003',
            srx_string: '004',
          },
        ],
      ],
      [
        'OA4JKL', // Competing
        [
          {
            call: 'OA4ABC',
            qso_date: '20250401',
            time_on: '120200',
            freq: '14.000',
            mode: 'SSB',
            rst_sent: '59',
            rst_rcvd: '59',
            stx_string: '004',
            srx_string: '001',
          },
          {
            call: 'OA4GHI',
            qso_date: '20250401',
            time_on: '120300',
            freq: '14.000',
            mode: 'SSB',
            rst_sent: '59',
            rst_rcvd: '59',
            stx_string: '004',
            srx_string: '003',
          },
        ],
      ],
    ]

    const result = scoreContest(submissions, rules)

    // Verify main results only contain competing participants
    expect(result.results).toHaveLength(2)
    const competingCallsigns = result.results.map(([callsign]) => callsign)
    expect(competingCallsigns).toContain('OA4ABC')
    expect(competingCallsigns).toContain('OA4JKL')
    expect(competingCallsigns).not.toContain('OA4DEF')
    expect(competingCallsigns).not.toContain('OA4GHI')

    // Verify non-competing results contain only non-competing participants
    expect(result.nonCompetingResults).toHaveLength(2)
    const nonCompetingCallsigns = result.nonCompetingResults.map(
      ([callsign]) => callsign
    )
    expect(nonCompetingCallsigns).toContain('OA4DEF')
    expect(nonCompetingCallsigns).toContain('OA4GHI')

    // Verify correct scoring with bonus applied
    // OA4ABC: 3 contacts * 1 point * 2 bonus = 6 points
    // OA4JKL: 2 contacts * 1 point * 2 bonus = 4 points
    expect(result.results[0]![0]).toBe('OA4ABC') // Should be first with highest score
    expect(result.results[0]![1]).toBe(6)
    expect(result.results[1]![0]).toBe('OA4JKL') // Should be second
    expect(result.results[1]![1]).toBe(4)

    // Verify non-competing participants are also scored correctly
    // OA4GHI: 2 contacts * 1 point * 2 bonus = 4 points
    // OA4DEF: 1 contact * 1 point * 2 bonus = 2 points
    expect(result.nonCompetingResults[0]![0]).toBe('OA4GHI') // Should be first among non-competing
    expect(result.nonCompetingResults[0]![1]).toBe(4)
    expect(result.nonCompetingResults[1]![0]).toBe('OA4DEF') // Should be second among non-competing
    expect(result.nonCompetingResults[1]![1]).toBe(2)

    // Verify all participants have scoring details
    expect(result.scoringDetails['OA4ABC']).toBeDefined()
    expect(result.scoringDetails['OA4DEF']).toBeDefined()
    expect(result.scoringDetails['OA4GHI']).toBeDefined()
    expect(result.scoringDetails['OA4JKL']).toBeDefined()

    // Verify bonus was applied to all participants (2x multiplier means bonus > 0)
    expect(result.scoringDetails['OA4ABC']!.givenBonus).toBeGreaterThan(0)
    expect(result.scoringDetails['OA4DEF']!.givenBonus).toBeGreaterThan(0)
    expect(result.scoringDetails['OA4GHI']!.givenBonus).toBeGreaterThan(0)
    expect(result.scoringDetails['OA4JKL']!.givenBonus).toBeGreaterThan(0)
  })
})

import { describe, expect, test } from 'bun:test'
import { scoreContest } from '../../src/lib'
import type { ContestRules, Participant } from '../../src/types'

describe('Non-Competing Participants Feature', () => {
  const baseRules: ContestRules = {
    name: 'Test Contest',
    start: '2025-04-01T00:00:00Z',
    end: '2025-04-01T23:59:59Z',
    rules: {
      validation: ['default'],
      scoring: [['default', 1]],
      bonus: [['default', 1]],
      tiebreaker: ['default'],
    },
  }

  const sampleSubmissions: Participant[] = [
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
      ],
    ],
    [
      'OA4DEF',
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
      'OA4GHI',
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
      ],
    ],
  ]

  test('should separate non-competing participants from main results', () => {
    const rules: ContestRules = {
      ...baseRules,
      nonCompeting: ['OA4DEF'],
    }

    const result = scoreContest(sampleSubmissions, rules)

    // Main results should not include non-competing participants
    expect(result.results).toHaveLength(2)
    expect(
      result.results.find(
        ([callsign]: [string, number]) => callsign === 'OA4DEF'
      )
    ).toBeUndefined()
    expect(
      result.results.find(
        ([callsign]: [string, number]) => callsign === 'OA4ABC'
      )
    ).toBeDefined()
    expect(
      result.results.find(
        ([callsign]: [string, number]) => callsign === 'OA4GHI'
      )
    ).toBeDefined()

    // Non-competing results should include only non-competing participants
    expect(result.nonCompetingResults).toHaveLength(1)
    expect(result.nonCompetingResults[0]![0]).toBe('OA4DEF')
    expect(result.nonCompetingResults[0]![1]).toBe(1) // Should have scored 1 point
  })

  test('should handle multiple non-competing participants', () => {
    const rules: ContestRules = {
      ...baseRules,
      nonCompeting: ['OA4DEF', 'OA4GHI'],
    }

    const result = scoreContest(sampleSubmissions, rules)

    // Main results should only include competing participants
    expect(result.results).toHaveLength(1)
    expect(result.results[0]![0]).toBe('OA4ABC')

    // Non-competing results should include both non-competing participants
    expect(result.nonCompetingResults).toHaveLength(2)
    const nonCompetingCallsigns = result.nonCompetingResults.map(
      ([callsign]: [string, number]) => callsign
    )
    expect(nonCompetingCallsigns).toContain('OA4DEF')
    expect(nonCompetingCallsigns).toContain('OA4GHI')
  })

  test('should sort non-competing participants by score (highest first)', () => {
    // OA4GHI will have 2 contacts, OA4DEF will have 1 contact
    const rules: ContestRules = {
      ...baseRules,
      nonCompeting: ['OA4DEF', 'OA4GHI'],
    }

    // Add an extra participant for OA4GHI to contact
    const extendedSubmissions: Participant[] = [
      ...sampleSubmissions,
      [
        'OA4JKL',
        [
          {
            call: 'OA4GHI',
            qso_date: '20250401',
            time_on: '120200',
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

    // Add reciprocal contact for OA4GHI to contact OA4JKL
    if (extendedSubmissions[2]?.[1]) {
      extendedSubmissions[2][1].push({
        call: 'OA4JKL',
        qso_date: '20250401',
        time_on: '120200',
        freq: '14.000',
        mode: 'SSB',
        rst_sent: '59',
        rst_rcvd: '59',
        stx_string: '003',
        srx_string: '004',
      })
    }

    const result = scoreContest(extendedSubmissions, rules)

    expect(result.nonCompetingResults).toHaveLength(2)
    // OA4GHI should be first with 2 points, OA4DEF second with 1 point
    expect(result.nonCompetingResults[0]![0]).toBe('OA4GHI')
    expect(result.nonCompetingResults[0]![1]).toBe(2)
    expect(result.nonCompetingResults[1]![0]).toBe('OA4DEF')
    expect(result.nonCompetingResults[1]![1]).toBe(1)
  })

  test('should handle empty non-competing list', () => {
    const rules: ContestRules = {
      ...baseRules,
      nonCompeting: [],
    }

    const result = scoreContest(sampleSubmissions, rules)

    // All participants should be in main results
    expect(result.results).toHaveLength(3)
    expect(result.nonCompetingResults).toHaveLength(0)
  })

  test('should handle undefined non-competing list', () => {
    const result = scoreContest(sampleSubmissions, baseRules)

    // All participants should be in main results
    expect(result.results).toHaveLength(3)
    expect(result.nonCompetingResults).toHaveLength(0)
  })

  test('should include non-competing participants in scoring details', () => {
    const rules: ContestRules = {
      ...baseRules,
      nonCompeting: ['OA4DEF'],
    }

    const result = scoreContest(sampleSubmissions, rules)

    // Non-competing participants should still have scoring details
    expect(result.scoringDetails['OA4DEF']).toBeDefined()
    expect(result.scoringDetails['OA4DEF']!.contacts).toHaveLength(1)
    expect(result.scoringDetails['OA4DEF']!.bonusRuleApplied).toBe(null) // No bonus applied when multiplier is 1
    expect(result.scoringDetails['OA4DEF']!.givenBonus).toBe(0)
    expect(result.scoringDetails['OA4DEF']!.hasMinimumAppearances).toBe(true)
  })

  test('should handle non-competing participants with bonus rules', () => {
    const rules: ContestRules = {
      ...baseRules,
      nonCompeting: ['OA4DEF'],
      rules: {
        ...baseRules.rules,
        bonus: [['default', 2]], // 2x multiplier
      },
    }

    const result = scoreContest(sampleSubmissions, rules)

    // Non-competing participant should get bonus applied
    expect(result.nonCompetingResults[0]![1]).toBe(2) // 1 point * 2 multiplier
    expect(result.scoringDetails['OA4DEF']!.givenBonus).toBe(1) // bonus = final - base = 2 - 1
  })
})

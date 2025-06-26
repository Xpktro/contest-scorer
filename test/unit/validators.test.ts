import { describe, test, expect, beforeEach } from 'bun:test'
import type { SimpleAdif } from 'adif-parser-ts'
import type {
  ContestRules,
  Participant,
  ValidationContext,
  ValidContact,
  RulesContext,
  ParticipantScoringDetail,
  ContactValidatorResult,
} from '../../src/lib/types'
import {
  defaultValidator,
  minimumContactsValidator,
  uniqueContactsByTimeRangeValidator,
  validators,
} from 'lib/rules/validators'
import { validateContacts } from 'lib/validator'
import { getRulesContext } from 'lib/precalculate'

// Test fixtures and helper functions
function createContact(
  overrides = {}
): NonNullable<SimpleAdif['records']>[number] {
  return {
    call: 'OA4P',
    qso_date: '20241210',
    time_on: '120000',
    band: '20m',
    freq: '14.000',
    mode: 'SSB',
    ...overrides,
  }
}

// Create ValidContact objects from the raw contact data
function createValidContact(
  rawContact: ReturnType<typeof createContact>,
  callsign = 'OA4T',
  index = 0
): ValidContact {
  const contactedCallsign = String(rawContact.call || '')
  return {
    callsign,
    contactedCallsign,
    date: String(rawContact.qso_date || ''),
    time: String(rawContact.time_on || ''),
    freq: String(rawContact.freq || ''),
    band: String(rawContact.band || ''),
    mode: String(rawContact.mode || ''),
    score: 0,
    exchanges: {
      rstSent: String(rawContact.rst_sent || ''),
      rstRcvd: String(rawContact.rst_rcvd || ''),
      stxString: String(rawContact.stx_string || ''),
      srxString: String(rawContact.srx_string || ''),
    },
    scoringDetailsIndex: index,
  }
}

// Create empty initial scoring details for a callsign
function createScoringDetails(
  callsign: string
): Record<string, Partial<ParticipantScoringDetail>> {
  return {
    [callsign]: {
      contacts: [],
      bonusRuleApplied: null,
      givenBonus: 0,
      hasMinimumAppearances: true,
    },
  }
}

// Common test helper to create initial scoring details
function initializeScoringDetails(
  callsigns: string[]
): Record<string, Partial<ParticipantScoringDetail>> {
  return Object.fromEntries(
    callsigns.map(callsign => [
      callsign,
      {
        contacts: [],
        bonusRuleApplied: null,
        givenBonus: 0,
        hasMinimumAppearances: false,
      },
    ])
  )
}

// Helper to get contacts from validator result
function getContactsFromResult(
  result: ContactValidatorResult,
  callsign: string
): ValidContact[] {
  return result.validContacts.get(callsign) || []
}

describe('Validators', () => {
  let sampleRules: ContestRules
  let validContacts: Map<string, ValidContact[]>
  let submissions: Participant[]
  let validationContext: ValidationContext
  let rulesContext: RulesContext

  beforeEach(() => {
    // Setup sample rules
    sampleRules = {
      name: 'Test Contest',
      start: '2024-12-01T00:00:00Z',
      end: '2024-12-31T23:59:59Z',
      rules: {
        validation: [
          'timeRange',
          ['bands', { '40m': ['7.080', '7.140'], '20m': ['14.000', '14.350'] }],
          ['mode', ['SSB', 'CW', 'FT8']],
          'contactedInContest',
          [
            'uniqueContactsByTimeRange',
            {
              firstDay: ['2024-12-01T00:00:00Z', '2024-12-15T23:59:59Z'],
              secondDay: ['2024-12-16T00:00:00Z', '2024-12-31T23:59:59Z'],
            },
          ],
          ['exchange', '^[0-9]{3}$'],
          ['default', { maximumTimeDiff: 5 }],
        ],
        scoring: [
          ['timeRange', { firstDay: 1, secondDay: 2 }],
          ['bonusStations', { OA4O: 5, OA4EFJ: 3 }],
        ],
        bonus: [['default', 1]],
        tiebreaker: ['validStations', 'minimumTime'],
      },
    }

    rulesContext = getRulesContext(sampleRules)

    // Setup sample submissions
    const oa4tSubmission: SimpleAdif['records'] = [
      {
        call: 'OA4P',
        qso_date: '20241210',
        time_on: '120000',
        freq: '14.000',
        mode: 'SSB',
        stx_string: '001',
        srx_string: '101',
      },
      {
        call: 'OA4EFJ',
        qso_date: '20241210',
        time_on: '130000',
        freq: '7.100',
        mode: 'CW',
        stx_string: '002',
        srx_string: '201',
      },
    ]

    const oa4pSubmission: SimpleAdif['records'] = [
      {
        call: 'OA4T',
        qso_date: '20241210',
        time_on: '120000',
        freq: '14.000',
        mode: 'SSB',
        stx_string: '101',
        srx_string: '001',
      },
      {
        call: 'OA4EFJ',
        qso_date: '20241220',
        time_on: '140000',
        freq: '7.100',
        mode: 'CW',
        stx_string: '102',
        srx_string: '202',
      },
    ]

    const oa4efjSubmission: SimpleAdif['records'] = [
      {
        call: 'OA4T',
        qso_date: '20241210',
        time_on: '130000',
        freq: '7.100',
        mode: 'CW',
        stx_string: '201',
        srx_string: '002',
      },
      {
        call: 'OA4P',
        qso_date: '20241220',
        time_on: '140000',
        freq: '7.100',
        mode: 'CW',
        stx_string: '202',
        srx_string: '102',
      },
    ]

    submissions = [
      ['OA4T', oa4tSubmission],
      ['OA4P', oa4pSubmission],
      ['OA4EFJ', oa4efjSubmission],
    ]

    validContacts = new Map()

    // Creating time ranges for context
    const timeRanges = {
      firstDay: {
        start: new Date('2024-12-01T00:00:00Z'),
        end: new Date('2024-12-15T23:59:59Z'),
      },
      secondDay: {
        start: new Date('2024-12-16T00:00:00Z'),
        end: new Date('2024-12-31T23:59:59Z'),
      },
    }

    validationContext = {
      submissions,
      validContacts,
      contestRules: sampleRules,
      timeRanges,
      bandRanges: [
        { start: 7.08, end: 7.14 },
        { start: 14.0, end: 14.35 },
      ],
      contestStart: new Date(sampleRules.start),
      contestEnd: new Date(sampleRules.end),
    }
  })

  // Group tests by validator type
  describe('Time and Frequency Validators', () => {
    test('timeRange validator checks contest date range', () => {
      // Valid contact - within time range
      const validContact = createContact()

      // Invalid contact - outside time range (before contest)
      const invalidContactBefore = createContact({
        qso_date: '20241130', // Before contest start
      })

      // Invalid contact - outside time range (after contest)
      const invalidContactAfter = createContact({
        qso_date: '20250101', // After contest end
      })

      expect(
        validators.timeRange('OA4T', validContact, validationContext)
      ).toBe(true)
      expect(
        validators.timeRange('OA4T', invalidContactBefore, validationContext)
      ).toBe(false)
      expect(
        validators.timeRange('OA4T', invalidContactAfter, validationContext)
      ).toBe(false)
    })

    test('bands validator checks valid frequency bands', () => {
      const params = { '40m': ['7.080', '7.140'], '20m': ['14.000', '14.350'] }

      // Valid contact - on 20m band
      const validContact1 = createContact({
        freq: '14.000', // Set explicit frequency instead of relying on the default
      })

      // Valid contact - on 40m band
      const validContact2 = createContact({
        freq: '7.100', // Need freq, not band for validation
      })

      // Edge case - at band lower edge
      const edgeCaseLower = createContact({
        freq: '7.080', // Need freq, not band for validation
      })

      // Edge case - at band upper edge
      const edgeCaseUpper = createContact({
        freq: '7.140', // Need freq, not band for validation
      })

      // Invalid contact - on 80m band
      const invalidContact = createContact({
        freq: '3.500', // Need freq, not band for validation
      })

      // Invalid contact - just outside band edge
      const outsideBand = createContact({
        freq: '7.079', // Need freq, not band for validation
      })

      expect(
        validators.bands('OA4T', validContact1, validationContext, params)
      ).toBe(true)
      expect(
        validators.bands('OA4T', validContact2, validationContext, params)
      ).toBe(true)
      expect(
        validators.bands('OA4T', edgeCaseLower, validationContext, params)
      ).toBe(true)
      expect(
        validators.bands('OA4T', edgeCaseUpper, validationContext, params)
      ).toBe(true)
      expect(
        validators.bands('OA4T', invalidContact, validationContext, params)
      ).toBe(false)
      expect(
        validators.bands('OA4T', outsideBand, validationContext, params)
      ).toBe(false)
    })

    test('mode validator checks valid modes', () => {
      const params = ['SSB', 'CW', 'FT8']

      // Valid contact - SSB mode
      const validContact1 = createContact()

      // Valid contact - CW mode
      const validContact2 = createContact({
        mode: 'CW',
      })

      // Valid contact - FT8 mode
      const validContact3 = createContact({
        mode: 'FT8',
      })

      // Invalid contact - RTTY mode
      const invalidContact1 = createContact({
        mode: 'RTTY',
      })

      // Invalid contact - lowercase mode not matching case
      const invalidContact2 = createContact({
        mode: 'ssb',
      })

      expect(
        validators.mode('OA4T', validContact1, validationContext, params)
      ).toBe(true)
      expect(
        validators.mode('OA4T', validContact2, validationContext, params)
      ).toBe(true)
      expect(
        validators.mode('OA4T', validContact3, validationContext, params)
      ).toBe(true)
      expect(
        validators.mode('OA4T', invalidContact1, validationContext, params)
      ).toBe(false)
      expect(
        validators.mode('OA4T', invalidContact2, validationContext, params)
      ).toBe(false)
    })
  })

  describe('Callsign and Contact Validation', () => {
    test('contactedInContest validator checks if contacted station is a participant', () => {
      // Create a context with participant callsigns for faster lookups
      const contextWithSet = {
        ...validationContext,
        participantCallsigns: new Set(['OA4T', 'OA4P', 'OA4EFJ']),
      }

      // Valid contact - with a participant
      const validContact = createContact()

      // Valid contact - with another participant
      const validContact2 = createContact({
        call: 'OA4EFJ',
      })

      // Invalid contact - non-participant
      const invalidContact = createContact({
        call: 'K1ABC', // Not in our submission list
      })

      // Test with context having participantCallsigns set (faster method)
      expect(
        validators.contactedInContest('OA4T', validContact, contextWithSet)
      ).toBe(true)
      expect(
        validators.contactedInContest('OA4T', validContact2, contextWithSet)
      ).toBe(true)
      expect(
        validators.contactedInContest('OA4T', invalidContact, contextWithSet)
      ).toBe(false)

      // Test fallback method (slower, using array search)
      expect(
        validators.contactedInContest('OA4T', invalidContact, validationContext)
      ).toBe(false)
    })

    test('uniqueContactsByTimeRange validator checks for unique contacts in time periods', () => {
      // Setup context with prefilled validContacts
      const firstDayContact: ValidContact = {
        callsign: 'OA4T',
        contactedCallsign: 'OA4P',
        date: '20241210',
        time: '120000',
        freq: '14.000',
        band: '20m',
        mode: 'SSB',
        score: 0,
        exchanges: { rstSent: '', rstRcvd: '', stxString: '', srxString: '' },
        scoringDetailsIndex: 0,
      }

      const existingContacts = new Map<string, ValidContact[]>()
      existingContacts.set('OA4T', [firstDayContact])

      const contextWithContacts = {
        ...validationContext,
        validContacts: existingContacts,
      }

      // Contact with same station in the first time range (should be invalid - duplicate)
      const duplicateFirstDayContact = createValidContact(
        createContact({
          qso_date: '20241215',
        })
      )

      // Contact with same station but in the second time range (should be valid - different time range)
      const uniqueSecondDayContact = createValidContact(
        createContact({
          qso_date: '20241220',
        })
      )

      // Contact with different station in the first time range (should be valid - different station)
      const differentStationContact = createValidContact(
        createContact({
          call: 'OA4EFJ',
          qso_date: '20241215',
        })
      )

      const params = {
        firstDay: {
          start: new Date('2024-12-01T00:00:00Z'),
          end: new Date('2024-12-15T23:59:59Z'),
        },
        secondDay: {
          start: new Date('2024-12-16T00:00:00Z'),
          end: new Date('2024-12-31T23:59:59Z'),
        },
      }

      expect(
        uniqueContactsByTimeRangeValidator(
          'OA4T',
          duplicateFirstDayContact,
          existingContacts,
          params
        )
      ).toBe(false)

      expect(
        uniqueContactsByTimeRangeValidator(
          'OA4T',
          uniqueSecondDayContact,
          existingContacts,
          params
        )
      ).toBe(true)

      expect(
        uniqueContactsByTimeRangeValidator(
          'OA4T',
          differentStationContact,
          existingContacts,
          params
        )
      ).toBe(true)
    })
  })

  describe('Exchange and QSO Data Validation', () => {
    test('exchange validator checks exchange format', () => {
      const regex = '^[0-9]{3}$'

      // Invalid contact - exchange in srx_string field
      const invalidContactSrx = createContact({
        srx_string: '456',
      })

      // Invalid contact - exchange in stx_string field
      const invalidContactStx = createContact({
        stx_string: '789',
      })

      // Valid contact - both fields present and valid
      const validContactBoth = createContact({
        srx_string: '123',
        stx_string: '456',
      })

      // Invalid contact - wrong exchange format
      const invalidContact1 = createContact({
        srx_string: 'ABC',
      })

      // Invalid contact - too many digits
      const invalidContact2 = createContact({
        stx_string: '1234',
      })

      // Invalid contact - too few digits
      const invalidContact3 = createContact({
        srx_string: '12',
      })

      // Invalid contact - no exchange fields
      const invalidContactNoExchange = createContact({
        // No srx_string or stx_string fields
        comment: '123', // Comment field is not checked by the validator
      })

      // The implementation only checks srx_string and stx_string fields
      expect(
        validators.exchange('OA4T', invalidContactSrx, validationContext, regex)
      ).toBe(false)

      expect(
        validators.exchange('OA4T', invalidContactStx, validationContext, regex)
      ).toBe(false)

      expect(
        validators.exchange('OA4T', validContactBoth, validationContext, regex)
      ).toBe(true)

      expect(
        validators.exchange('OA4T', invalidContact1, validationContext, regex)
      ).toBe(false)

      expect(
        validators.exchange('OA4T', invalidContact2, validationContext, regex)
      ).toBe(false)

      expect(
        validators.exchange('OA4T', invalidContact3, validationContext, regex)
      ).toBe(false)

      expect(
        validators.exchange(
          'OA4T',
          invalidContactNoExchange,
          validationContext,
          regex
        )
      ).toBe(false)
    })

    test('default validator checks for matching contacts in other logs', () => {
      // Create raw contacts first
      const validContact = createValidContact(
        createContact({
          band: '20m', // Must match exactly with other's band
          mode: 'SSB', // Must match exactly with other's mode
          freq: '14.000', // Should match
          rst_sent: '59', // Should match other's received
          rst_rcvd: '59', // Should match other's sent
          stx_string: '123', // Should match other's received
          srx_string: '456', // Should match other's sent
        })
      )

      const validContactTime = createValidContact(
        createContact({
          mode: 'SSB',
          time_on: '120300', // 3 minutes later
          rst_sent: '59',
          rst_rcvd: '59',
          stx_string: '123',
          srx_string: '456',
        })
      )

      const invalidContactTime = createValidContact(
        createContact({
          mode: 'SSB',
          time_on: '120600', // 6 minutes later - exceeds maximumTimeDiff of 5
          rst_sent: '59',
          rst_rcvd: '59',
          stx_string: '123',
          srx_string: '456',
        })
      )

      const invalidContactBand = createValidContact(
        createContact({
          band: '10m', // Different band than 20m in the submission map
          mode: 'SSB',
          rst_sent: '59',
          rst_rcvd: '59',
          stx_string: '123',
          srx_string: '456',
        })
      )

      const invalidContactMode = createValidContact(
        createContact({
          mode: 'CW', // Different mode than SSB in the submission map
          rst_sent: '599',
          rst_rcvd: '599',
          stx_string: '123',
          srx_string: '456',
        })
      )

      const invalidContactExchange = createValidContact(
        createContact({
          mode: 'SSB',
          rst_sent: '59',
          rst_rcvd: '59',
          stx_string: '100', // Different from expected 123
          srx_string: '456',
        })
      )

      const invalidContactStation = createValidContact(
        createContact({
          call: 'OA4X', // Not in our submission list
          mode: 'SSB',
          rst_sent: '59',
          rst_rcvd: '59',
        })
      )

      // Create a contactIndex for the second validation pass
      const contactIndex = new Map([
        [
          'OA4P',
          new Map([
            [
              'OA4T',
              new Map([
                [
                  '20m-SSB',
                  [
                    {
                      callsign: 'OA4P',
                      contactedCallsign: 'OA4T',
                      date: '20241210',
                      time: '120000',
                      freq: '14.000',
                      band: '20m',
                      mode: 'SSB',
                      score: 0,
                      exchanges: {
                        rstSent: '59',
                        rstRcvd: '59',
                        stxString: '456',
                        srxString: '123',
                      },
                      scoringDetailsIndex: 0,
                    },
                  ],
                ],
              ]),
            ],
          ]),
        ],
      ])

      // Test with raw submissions (first validation pass) where bandModeMatch is explicitly checked
      expect(
        defaultValidator('OA4T', validContact, contactIndex, {
          maximumTimeDiff: 5,
        })
      ).toBe(true)

      expect(
        defaultValidator('OA4T', validContactTime, contactIndex, {
          maximumTimeDiff: 5,
        })
      ).toBe(true)

      expect(
        defaultValidator('OA4T', invalidContactTime, contactIndex, {
          maximumTimeDiff: 5,
        })
      ).toBe(false)

      expect(
        defaultValidator('OA4T', invalidContactBand, contactIndex, {
          maximumTimeDiff: 5,
        })
      ).toBe(false)

      expect(
        defaultValidator('OA4T', invalidContactMode, contactIndex, {
          maximumTimeDiff: 5,
        })
      ).toBe(false)

      expect(
        defaultValidator('OA4T', invalidContactExchange, contactIndex, {
          maximumTimeDiff: 5,
        })
      ).toBe(false)

      expect(
        defaultValidator('OA4T', invalidContactStation, contactIndex, {
          maximumTimeDiff: 5,
        })
      ).toBe(false)

      // Test the same assertions but with the second pass context
      expect(
        defaultValidator('OA4T', validContact, contactIndex, {
          maximumTimeDiff: 5,
        })
      ).toBe(true)

      expect(
        defaultValidator('OA4T', invalidContactBand, contactIndex, {
          maximumTimeDiff: 5,
        })
      ).toBe(false)

      expect(
        defaultValidator('OA4T', invalidContactMode, contactIndex, {
          maximumTimeDiff: 5,
        })
      ).toBe(false)
    })

    test('default validator handles frequency threshold for matching contacts', () => {
      // Test contact with slightly different frequency (within threshold)
      const validContactFreq = createValidContact(
        createContact({
          band: '40m',
          mode: 'CW',
          freq: '7.098', // 2 kHz different from 7.100
          rst_sent: '599',
          rst_rcvd: '599',
          stx_string: '123',
          srx_string: '456',
        })
      )

      // Contact with frequency too far from match
      const invalidContactFreq = createValidContact(
        createContact({
          band: '40m',
          mode: 'CW',
          freq: '7.105', // 7 kHz different - should not match with default threshold of 2 kHz
          rst_sent: '599',
          rst_rcvd: '599',
          stx_string: '123',
          srx_string: '456',
        })
      )

      const contactIndex = new Map([
        [
          'OA4P',
          new Map([
            [
              'OA4T',
              new Map([
                [
                  '40m-CW',
                  [
                    {
                      callsign: 'OA4P',
                      contactedCallsign: 'OA4T',
                      date: '20241210',
                      time: '120000',
                      freq: '7.100',
                      band: '40m',
                      mode: 'CW',
                      score: 0,
                      exchanges: {
                        rstSent: '599',
                        rstRcvd: '599',
                        stxString: '456',
                        srxString: '123',
                      },
                      scoringDetailsIndex: 0,
                    },
                  ],
                ],
              ]),
            ],
          ]),
        ],
      ])

      // Default threshold (2 kHz) - should match within 2 kHz
      expect(
        defaultValidator('OA4T', validContactFreq, contactIndex, {
          maximumTimeDiff: 5,
        })
      ).toBe(true)

      // Default threshold - should not match if difference > 2 kHz
      expect(
        defaultValidator('OA4T', invalidContactFreq, contactIndex, {
          maximumTimeDiff: 5,
        })
      ).toBe(false)

      // Custom threshold - should match if within custom threshold
      expect(
        defaultValidator('OA4T', invalidContactFreq, contactIndex, {
          maximumTimeDiff: 5,
          maximumFrequencyDiff: 10, // Larger threshold that accommodates 7 kHz difference
        })
      ).toBe(true)

      // Test in second pass
      expect(
        defaultValidator('OA4T', validContactFreq, contactIndex, {
          maximumTimeDiff: 5,
          maximumFrequencyDiff: 3, // Should match since 7.100 - 7.098 = 2 kHz
        })
      ).toBe(true)
    })
  })

  describe('Participation and Minimum Requirements', () => {
    test('minimumContacts validates participant appearances', () => {
      // Setup some valid contacts in the map
      const validContactsOA4T: ValidContact[] = [
        {
          callsign: 'OA4T',
          contactedCallsign: 'OA4P',
          date: '20241210',
          time: '120000',
          freq: '14.000',
          band: '20m',
          mode: 'SSB',
          score: 0,
          exchanges: { rstSent: '', rstRcvd: '', stxString: '', srxString: '' },
          scoringDetailsIndex: 0,
        },
      ]

      const validContactsOA4P: ValidContact[] = [
        {
          callsign: 'OA4P',
          contactedCallsign: 'OA4T',
          date: '20241210',
          time: '120000',
          freq: '14.000',
          band: '20m',
          mode: 'SSB',
          score: 0,
          exchanges: { rstSent: '', rstRcvd: '', stxString: '', srxString: '' },
          scoringDetailsIndex: 0,
        },
        {
          callsign: 'OA4P',
          contactedCallsign: 'OA4EFJ',
          date: '20241220',
          time: '140000',
          freq: '7.100',
          band: '40m',
          mode: 'CW',
          score: 0,
          exchanges: { rstSent: '', rstRcvd: '', stxString: '', srxString: '' },
          scoringDetailsIndex: 1,
        },
        {
          callsign: 'OA4P',
          contactedCallsign: 'OA4ABC', // Extra station that has no submission
          date: '20241220',
          time: '150000',
          freq: '7.100',
          band: '40m',
          mode: 'CW',
          score: 0,
          exchanges: { rstSent: '', rstRcvd: '', stxString: '', srxString: '' },
          scoringDetailsIndex: 2,
        },
      ]

      const validContactsOA4EFJ: ValidContact[] = [
        {
          callsign: 'OA4EFJ',
          contactedCallsign: 'OA4T',
          date: '20241210',
          time: '130000',
          freq: '7.100',
          band: '40m',
          mode: 'CW',
          score: 0,
          exchanges: { rstSent: '', rstRcvd: '', stxString: '', srxString: '' },
          scoringDetailsIndex: 0,
        },
        {
          callsign: 'OA4EFJ',
          contactedCallsign: 'OA4P',
          date: '20241220',
          time: '140000',
          freq: '7.100',
          band: '40m',
          mode: 'CW',
          score: 0,
          exchanges: { rstSent: '', rstRcvd: '', stxString: '', srxString: '' },
          scoringDetailsIndex: 1,
        },
        {
          callsign: 'OA4EFJ',
          contactedCallsign: 'OA4ABC', // Extra station that has no submission
          date: '20241220',
          time: '160000',
          freq: '7.100',
          band: '40m',
          mode: 'CW',
          score: 0,
          exchanges: { rstSent: '', rstRcvd: '', stxString: '', srxString: '' },
          scoringDetailsIndex: 2,
        },
      ]

      const validContactsMap = new Map<string, ValidContact[]>()
      validContactsMap.set('OA4T', validContactsOA4T)
      validContactsMap.set('OA4P', validContactsOA4P)
      validContactsMap.set('OA4EFJ', validContactsOA4EFJ)

      // Create a mock RulesContext with allowMissingParticipants=true
      const mockRulesContext = {
        contestRules: {
          name: 'Test Contest',
          start: '2024-12-01T00:00:00Z',
          end: '2024-12-31T23:59:59Z',
          allowMissingParticipants: true,
          rules: {
            validation: [],
            scoring: [],
            bonus: [],
            tiebreaker: [],
          },
        },
        contestStart: new Date('2024-12-01T00:00:00Z'),
        contestEnd: new Date('2024-12-31T23:59:59Z'),
        timeRanges: {},
        bandRanges: [],
      }

      const scoringDetails = initializeScoringDetails([
        'OA4T',
        'OA4P',
        'OA4EFJ',
      ])

      // Create appearance counts based on the test data
      const appearanceCounts = new Map<string, number>([
        ['OA4T', 2], // appears in OA4P and OA4EFJ logs
        ['OA4P', 2], // appears in OA4T and OA4EFJ logs
        ['OA4EFJ', 1], // appears in OA4T log only
        ['OA4ABC', 2], // appears in OA4P and OA4EFJ logs
      ])

      // With minimum of 1 appearance and allowMissingParticipants=true
      const result1 = minimumContactsValidator(
        validContactsMap,
        1,
        mockRulesContext,
        scoringDetails,
        new Set(['OA4ABC']), // OA4ABC is a missing participant
        appearanceCounts
      )
      expect(result1.has('OA4T')).toBe(true)
      expect(result1.has('OA4P')).toBe(true)
      expect(result1.has('OA4EFJ')).toBe(true)
      expect(result1.has('OA4ABC')).toBe(true) // Should be added as a missing participant
      expect(result1.get('OA4ABC')).toBeNull() // Missing participant should have empty contacts

      // With minimum of 2 appearances and allowMissingParticipants=true
      const result2 = minimumContactsValidator(
        validContactsMap,
        2,
        mockRulesContext,
        scoringDetails,
        new Set(['OA4ABC']), // OA4ABC is a missing participant
        appearanceCounts
      )
      expect(result2.has('OA4T')).toBe(true) // Appears in OA4P and OA4EFJ logs
      expect(result2.has('OA4P')).toBe(true) // Appears in OA4T and OA4EFJ logs
      expect(result2.has('OA4EFJ')).toBe(false) // Only appears once as a contacted station
      expect(result2.has('OA4ABC')).toBe(true) // Appears in OA4P and OA4EFJ logs
      expect(result2.get('OA4ABC')).toBeNull() // Missing participant should have empty contacts

      // With minimum of 2 appearances but allowMissingParticipants=false
      const mockRulesContextDisallowMissing = {
        ...mockRulesContext,
        contestRules: {
          ...mockRulesContext.contestRules,
          allowMissingParticipants: false,
        },
      }
      const resultNoMissing = minimumContactsValidator(
        validContactsMap,
        2,
        mockRulesContextDisallowMissing,
        scoringDetails,
        new Set(['OA4ABC']), // OA4ABC is a missing participant
        appearanceCounts
      )
      expect(resultNoMissing.has('OA4T')).toBe(true) // Appears in OA4P and OA4EFJ logs
      expect(resultNoMissing.has('OA4P')).toBe(true) // Appears in OA4T and OA4EFJ logs
      expect(resultNoMissing.has('OA4EFJ')).toBe(false) // Only appears once
      expect(resultNoMissing.has('OA4ABC')).toBe(false) // Should not be added as missing participants aren't allowed

      // With minimum of 3 appearances
      const result3 = minimumContactsValidator(
        validContactsMap,
        3,
        mockRulesContext,
        scoringDetails,
        new Set(['OA4ABC']), // OA4ABC is a missing participant
        appearanceCounts
      )
      expect(result3.has('OA4T')).toBe(false) // Only appears twice
      expect(result3.has('OA4P')).toBe(false) // Only appears twice
      expect(result3.has('OA4EFJ')).toBe(false) // Only appears once
      expect(result3.has('OA4ABC')).toBe(false) // Only appears twice
    })

    test('blacklist functionality excludes stations correctly', () => {
      // Setup sample rules with blacklisted callsigns
      const rulesWithBlacklist: ContestRules = {
        name: 'Test Contest with Blacklist',
        start: '2024-12-01T00:00:00Z',
        end: '2024-12-31T23:59:59Z',
        blacklist: ['OA4EFJ'], // OA4EFJ is blacklisted
        rules: {
          validation: [
            'timeRange',
            [
              'bands',
              { '40m': ['7.080', '7.140'], '20m': ['14.000', '14.350'] },
            ],
            ['mode', ['SSB', 'CW']],
            'contactedInContest',
            ['default', { maximumTimeDiff: 5 }],
          ],
          scoring: [['default', 1]],
          bonus: [['default', 1]],
          tiebreaker: ['validStations'],
        },
      }

      // Create test submissions WITH EXCHANGE INFORMATION
      const oa4tSubmission: SimpleAdif['records'] = [
        {
          call: 'OA4P', // Valid contact
          qso_date: '20241210',
          time_on: '120000',
          freq: '14.000',
          mode: 'SSB',
          rst_sent: '59', // Add RST sent
          rst_rcvd: '59', // Add RST received
          stx_string: '001', // Add sequence number sent
          srx_string: '101', // Add sequence number received
        },
        {
          call: 'OA4EFJ', // Contact with blacklisted station
          qso_date: '20241210',
          time_on: '130000',
          freq: '7.100',
          mode: 'CW',
          rst_sent: '599', // Add RST sent for CW
          rst_rcvd: '599', // Add RST received for CW
          stx_string: '002', // Add sequence number sent
          srx_string: '201', // Add sequence number received
        },
      ]

      const oa4pSubmission: SimpleAdif['records'] = [
        {
          call: 'OA4T', // Valid contact
          qso_date: '20241210',
          time_on: '120000',
          freq: '14.000',
          mode: 'SSB',
          rst_sent: '59', // Add RST sent
          rst_rcvd: '59', // Add RST received
          stx_string: '101', // Add sequence number sent (matches OA4T's received)
          srx_string: '001', // Add sequence number received (matches OA4T's sent)
        },
        {
          call: 'OA4EFJ', // Contact with blacklisted station
          qso_date: '20241210',
          time_on: '140000',
          freq: '7.100',
          mode: 'CW',
          rst_sent: '599', // Add RST sent
          rst_rcvd: '599', // Add RST received
          stx_string: '102', // Add sequence number sent
          srx_string: '202', // Add sequence number received
        },
      ]

      const oa4efjSubmission: SimpleAdif['records'] = [
        {
          call: 'OA4T', // Valid contact, but from blacklisted station
          qso_date: '20241210',
          time_on: '130000',
          freq: '7.100',
          mode: 'CW',
          rst_sent: '599', // Add RST sent
          rst_rcvd: '599', // Add RST received
          stx_string: '201', // Add sequence number sent (matches OA4T's received)
          srx_string: '002', // Add sequence number received (matches OA4T's sent)
        },
        {
          call: 'OA4P', // Valid contact, but from blacklisted station
          qso_date: '20241210',
          time_on: '140000',
          freq: '7.100',
          mode: 'CW',
          rst_sent: '599', // Add RST sent
          rst_rcvd: '599', // Add RST received
          stx_string: '202', // Add sequence number sent (matches OA4P's received)
          srx_string: '102', // Add sequence number received (matches OA4P's sent)
        },
      ]

      const submissions: Participant[] = [
        ['OA4T', oa4tSubmission],
        ['OA4P', oa4pSubmission],
        ['OA4EFJ', oa4efjSubmission], // Blacklisted participant
      ]

      // Process the submissions with validateContacts
      const rulesContext = getRulesContext(rulesWithBlacklist)
      const validatedContacts = validateContacts(submissions, rulesContext)

      // Check blacklist functionality
      // 1. Blacklisted station should not be in results at all
      expect(validatedContacts.blacklistedCallsignsFound.has('OA4EFJ')).toBe(
        true
      )
      expect(validatedContacts.validContacts.has('OA4EFJ')).toBe(false)

      // 2. Non-blacklisted stations should be in results
      expect(validatedContacts.validContacts.has('OA4T')).toBe(true)
      expect(validatedContacts.validContacts.has('OA4P')).toBe(true)

      // 3. Contacts with blacklisted stations should be excluded
      const oa4tContacts = validatedContacts.validContacts.get('OA4T') || []
      const oa4pContacts = validatedContacts.validContacts.get('OA4P') || []

      // OA4T should only have contact with OA4P, not with OA4EFJ
      expect(oa4tContacts.length).toBe(1)
      expect(oa4tContacts[0]?.contactedCallsign).toBe('OA4P')

      // OA4P should only have contact with OA4T, not with OA4EFJ
      expect(oa4pContacts.length).toBe(1)
      expect(oa4pContacts[0]?.contactedCallsign).toBe('OA4T')

      // Test with multiple blacklisted stations
      const rulesWithMultipleBlacklist: ContestRules = {
        ...rulesWithBlacklist,
        blacklist: ['OA4EFJ', 'OA4T'], // Both OA4EFJ and OA4T are blacklisted
      }

      const contextWithMultipleBlacklist = getRulesContext(
        rulesWithMultipleBlacklist
      )
      const validatedContactsMultiple = validateContacts(
        submissions,
        contextWithMultipleBlacklist
      )

      // Both blacklisted stations should not be in results
      expect(validatedContactsMultiple.validContacts.has('OA4EFJ')).toBe(false)
      expect(validatedContactsMultiple.validContacts.has('OA4T')).toBe(false)
      expect(
        validatedContactsMultiple.blacklistedCallsignsFound.has('OA4EFJ')
      ).toBe(true)
      expect(
        validatedContactsMultiple.blacklistedCallsignsFound.has('OA4T')
      ).toBe(true)

      // Only non-blacklisted station should be in results
      expect(validatedContactsMultiple.validContacts.has('OA4P')).toBe(true)

      // OA4P should have no valid contacts since all contacts are with blacklisted stations
      const oa4pContactsMultiple =
        validatedContactsMultiple.validContacts.get('OA4P') || []
      expect(oa4pContactsMultiple.length).toBe(0)
    })
  })

  describe('Integration Tests', () => {
    test('validateContacts integrates all validators correctly', () => {
      // Use the sample rules and submissions
      const validatedContacts = validateContacts(submissions, rulesContext)

      // We should have valid contacts for all callsigns
      expect(
        validatedContacts.validContacts.has('OA4T') &&
          validatedContacts.validContacts.get('OA4T')!.length > 0
      ).toBe(true)
      expect(
        validatedContacts.validContacts.has('OA4P') &&
          validatedContacts.validContacts.get('OA4P')!.length > 0
      ).toBe(true)
      expect(
        validatedContacts.validContacts.has('OA4EFJ') &&
          validatedContacts.validContacts.get('OA4EFJ')!.length > 0
      ).toBe(true)

      // Check specific contacts for each participant
      const oa4tContacts = validatedContacts.validContacts.get('OA4T')!
      const oa4pContacts = validatedContacts.validContacts.get('OA4P')!
      const oa4efjContacts = validatedContacts.validContacts.get('OA4EFJ')!

      // OA4T should have contacts with OA4P and OA4EFJ
      expect(oa4tContacts.length).toBe(2)
      expect(oa4tContacts[0]!.contactedCallsign).toBe('OA4P')
      expect(oa4tContacts[0]!.band).toBe('20m')
      expect(oa4tContacts[0]!.mode).toBe('SSB')
      expect(oa4tContacts[1]!.contactedCallsign).toBe('OA4EFJ')
      expect(oa4tContacts[1]!.band).toBe('40m')
      expect(oa4tContacts[1]!.mode).toBe('CW')

      // OA4P should have contacts with OA4T and OA4EFJ
      expect(oa4pContacts.length).toBe(2)
      expect(oa4pContacts[0]!.contactedCallsign).toBe('OA4T')
      expect(oa4pContacts[1]!.contactedCallsign).toBe('OA4EFJ')

      // OA4EFJ should have contacts with OA4T and OA4P
      expect(oa4efjContacts.length).toBe(2)
      expect(oa4efjContacts[0]!.contactedCallsign).toBe('OA4T')
      expect(oa4efjContacts[1]!.contactedCallsign).toBe('OA4P')

      // Test with minimumContacts rule
      const rulesWithMinimumContacts: RulesContext = {
        ...rulesContext,
        contestRules: {
          ...rulesContext.contestRules,
          rules: {
            ...rulesContext.contestRules.rules,
            validation: [
              ...rulesContext.contestRules.rules.validation,
              ['minimumContacts', 3],
            ],
          },
        },
      }

      // With minimumContacts of 3, we should have no valid contacts since each station
      // only appears in at most 2 other logs
      const filteredContacts = validateContacts(
        submissions,
        rulesWithMinimumContacts
      )
      expect(filteredContacts.validContacts.size).toBe(0)
    })
  })
})

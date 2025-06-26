import type {
  Callsign,
  ValidContact,
  ValidationRule,
  ContactIndex,
  Validator,
  RulesContext,
  ParticipantScoringDetail,
} from 'types'
import {
  getDateTimeFromContact,
  parseDateTime,
  getTimeDiffInMinutes,
  areFrequenciesWithinTolerance,
} from 'utils'

export const defaultValidator = (
  callsign: Callsign,
  contact: ValidContact,
  contactIndex: ContactIndex,
  params: { maximumTimeDiff?: number; maximumFrequencyDiff?: number } = {}
): boolean => {
  const maximumTimeDiff = params.maximumTimeDiff || 2
  const maximumFrequencyDiff = (params.maximumFrequencyDiff || 2) / 1000

  const contactDateTime = parseDateTime(contact.date, contact.time)
  const band = contact.band
  const freq = contact.freq
  const freqNum = freq ? Number(freq) : NaN
  const mode = contact.mode

  const { rstSent, rstRcvd, stxString, srxString } = contact.exchanges

  const callsignIndex = contactIndex?.get(contact.contactedCallsign)
  if (!callsignIndex) return false

  const callerIndex = callsignIndex.get(callsign)
  if (!callerIndex) return false

  const bandModeKey = `${band}-${mode}`
  const potentialMatches = callerIndex.get(bandModeKey)
  if (!potentialMatches || potentialMatches.length === 0) return false

  return potentialMatches.some(validContact => {
    const validContactDateTime = parseDateTime(
      validContact.date,
      validContact.time
    )

    const timeDiff = getTimeDiffInMinutes(contactDateTime, validContactDateTime)

    const {
      rstSent: otherRstSent,
      rstRcvd: otherRstRcvd,
      stxString: otherStxString,
      srxString: otherSrxString,
    } = validContact.exchanges

    const timeMatch = timeDiff <= maximumTimeDiff

    const freqMatch = areFrequenciesWithinTolerance(
      freqNum,
      validContact.freq,
      maximumFrequencyDiff
    )

    const rstMatch =
      (rstSent === '' && rstRcvd === '') ||
      (rstSent === otherRstRcvd && rstRcvd === otherRstSent)

    const hasExchangeInfo =
      stxString !== '' ||
      srxString !== '' ||
      otherStxString !== '' ||
      otherSrxString !== ''

    const exchangeMatch =
      !hasExchangeInfo ||
      (stxString === otherSrxString && srxString === otherStxString)

    return timeMatch && freqMatch && rstMatch && exchangeMatch
  })
}

export const timeRangeValidator: Validator = (_, contact, context) => {
  const { date, time } = getDateTimeFromContact(contact)
  if (!date || !time) return false

  const contactDateTime = parseDateTime(date, time)

  return (
    contactDateTime >= context.contestStart &&
    contactDateTime <= context.contestEnd
  )
}

export const bandsValidator: Validator = (_, contact, context) => {
  const contactFreq = contact.freq
  if (!contactFreq) return false

  const contactFreqNum = Number(contactFreq)
  if (isNaN(contactFreqNum)) return false

  return context.bandRanges.some(
    range => contactFreqNum >= range.start && contactFreqNum <= range.end
  )
}

export const modeValidator: Validator<string[]> = (
  _,
  contact,
  __,
  validModes = []
) => (contact.mode ? validModes.includes(contact.mode) : false)

export const contactedInContestValidator: Validator = (_, contact, context) =>
  context.contestRules.allowMissingParticipants ||
  (contact.call && context.participantCallsigns
    ? context.participantCallsigns.has(contact.call)
    : false)

export const uniqueContactsByTimeRangeValidator = (
  callsign: Callsign,
  contact: ValidContact,
  validContacts: Map<Callsign, ValidContact[]>,
  timeRanges: Record<string, { start: Date; end: Date }>
): boolean => {
  const contactedCallsign = contact.contactedCallsign || ''
  if (!contactedCallsign) return false

  const { date, time } = getDateTimeFromContact(contact)
  if (!date || !time) return false

  const contactDateTime = parseDateTime(date, time)

  const existingContacts = validContacts.get(callsign) || []

  const currentRange = Object.entries(timeRanges).find(
    ([_, { start, end }]) => contactDateTime >= start && contactDateTime <= end
  )?.[0]
  if (!currentRange) return false

  const existingContactsInSameRange = existingContacts.filter(existing => {
    if (existing.contactedCallsign !== contactedCallsign) return false

    const existingDateTime = parseDateTime(existing.date, existing.time)
    const range = timeRanges[currentRange]
    if (!range) return false

    return existingDateTime >= range.start && existingDateTime <= range.end
  })

  return existingContactsInSameRange.length === 0
}

export const exchangeValidator: Validator<string> = (
  _,
  contact,
  __,
  pattern = ''
) =>
  contact.srx_string && contact.stx_string
    ? [contact.srx_string, contact.stx_string].every(exchange =>
        new RegExp(pattern).test(exchange)
      )
    : false

export const minimumContactsValidator = (
  validContactsMap: Map<Callsign, ValidContact[]>,
  minimumAppearances: number,
  rulesContext: RulesContext,
  scoringDetails: Record<Callsign, Partial<ParticipantScoringDetail>>,
  missingParticipants: Set<Callsign>,
  appearanceCounts: Map<Callsign, number>
): Map<Callsign, ValidContact[] | null> => {
  const allowMissingParticipants =
    !!rulesContext?.contestRules?.allowMissingParticipants

  const missingParticipantsResult: [Callsign, ValidContact[] | null][] = []
  if (allowMissingParticipants) {
    // For stations that meet the minimum appearances threshold but didn't submit logs,
    // create "virtual" placeholder entries so they can award points but don't score themselves
    for (const missingCallsign of missingParticipants) {
      const appearances = appearanceCounts.get(missingCallsign) || 0
      if (
        appearances >= minimumAppearances &&
        !validContactsMap.has(missingCallsign)
      ) {
        // Add an null entry for missing participants who meet the threshold
        missingParticipantsResult.push([missingCallsign, null])
      }
    }
  }

  // Filter out participants who don't appear in enough logs
  return new Map(
    Array.from<[string, ValidContact[] | null]>(validContactsMap)
      .filter(([callsign, contacts]) => {
        const hasMinimumAppearances =
          (appearanceCounts.get(callsign) || 0) >= minimumAppearances
        if (!hasMinimumAppearances) {
          for (const contact of contacts || []) {
            if (!scoringDetails[callsign]!.contacts!) continue
            const contactDetail =
              scoringDetails[callsign]!.contacts![contact.scoringDetailsIndex]
            if (contactDetail) {
              contactDetail.givenScore ??= 0
            }
          }
        }
        return hasMinimumAppearances
      })
      .concat(missingParticipantsResult)
  )
}

export const validators = {
  timeRange: timeRangeValidator,
  bands: bandsValidator,
  mode: modeValidator,
  contactedInContest: contactedInContestValidator,
  exchange: exchangeValidator,
} as Record<ValidationRule, Validator>

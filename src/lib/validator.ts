import type {
  Callsign,
  Participant,
  ValidationContext,
  ValidContact,
  ValidationRule,
  ContestRules,
  ValidationRuleConfig,
  ContactIndex,
  RulesContext,
  DefaultValidatorParams,
  ContactValidator,
  ContactScoringDetail,
  ParticipantScoringDetail,
} from 'types'
import {
  defaultValidator,
  minimumContactsValidator,
  uniqueContactsByTimeRangeValidator,
  validators,
} from 'lib/rules/validators'
import { extractRule, getDateTimeFromContact } from 'utils'

const RULES_TO_SKIP_DURING_INITIAL_VALIDATION: ValidationRule[] = [
  'uniqueContactsByTimeRange',
  'minimumContacts',
  'default',
] as const

export const validateContacts: ContactValidator = (
  submissions,
  rulesContext
) => {
  const contestRules = rulesContext.contestRules

  const blacklistedCallsigns = new Set(contestRules.blacklist || [])
  const blacklistedCallsignsFound = new Set<Callsign>()
  const blacklistedAppearanceCounts = new Map<Callsign, number>()
  const scoringDetails: Record<Callsign, Partial<ParticipantScoringDetail>> = {}
  const missingParticipants = new Set<Callsign>()

  // Create a Set of participant callsigns for efficient lookups
  const participantCallsigns = submissions.reduce(
    (participants, [callsign]) =>
      blacklistedCallsigns.has(callsign)
        ? participants
        : participants.add(callsign),
    new Set<Callsign>()
  )

  const defaultRuleConfig = extractRule(
    contestRules.rules.validation,
    'default'
  )
  const minimumContactsRule = extractRule(
    contestRules.rules.validation,
    'minimumContacts'
  )
  const uniqueContactsByTimeRangeRule = extractRule(
    contestRules.rules.validation,
    'uniqueContactsByTimeRange'
  )

  const initialValidationRules = contestRules.rules.validation.filter(rule => {
    const ruleName = typeof rule === 'string' ? rule : rule[0]
    return !RULES_TO_SKIP_DURING_INITIAL_VALIDATION.includes(ruleName)
  })

  // Validate with basic rules to establish initial valid contacts
  const initialValidContacts = applyInitialValidation(
    submissions,
    rulesContext,
    initialValidationRules,
    participantCallsigns,
    blacklistedCallsigns,
    blacklistedCallsignsFound,
    blacklistedAppearanceCounts,
    scoringDetails
  )

  const contactIndex = createContactIndex(initialValidContacts)
  const contactsAfterDefaultValidation = defaultRuleConfig
    ? applyDefaultValidation(
        initialValidContacts,
        {
          submissions,
          contestRules,
          participantCallsigns,
          contactIndex,
          blacklistedCallsigns,
          blacklistedCallsignsFound,
          scoringDetails,
          missingParticipants,
        },
        Array.isArray(defaultRuleConfig) && defaultRuleConfig.length > 1
          ? (defaultRuleConfig[1] as DefaultValidatorParams)
          : {}
      )
    : initialValidContacts

  const contactsAfterUniqueValidation = uniqueContactsByTimeRangeRule
    ? applyUniqueContactsByTimeRangeValidation(
        contactsAfterDefaultValidation,
        rulesContext.timeRanges,
        scoringDetails
      )
    : contactsAfterDefaultValidation

  const appearanceCounts = countAppearances(
    contactsAfterUniqueValidation,
    (minimumContactsRule?.[1] as number | undefined) || 0,
    rulesContext,
    missingParticipants,
    scoringDetails
  )

  const validContacts =
    minimumContactsRule && Array.isArray(minimumContactsRule)
      ? minimumContactsValidator(
          contactsAfterUniqueValidation,
          minimumContactsRule[1] as number,
          rulesContext,
          scoringDetails,
          missingParticipants,
          appearanceCounts
        )
      : contactsAfterUniqueValidation

  return {
    validContacts,
    scoringDetails,
    missingParticipants,
    blacklistedCallsignsFound,
    appearanceCounts,
    blacklistedAppearanceCounts,
  }
}

const applyDefaultValidation = (
  validContacts: Map<Callsign, ValidContact[]>,
  context: {
    submissions: Participant[]
    contestRules: ContestRules
    participantCallsigns: Set<Callsign>
    contactIndex: ContactIndex
    blacklistedCallsigns: Set<Callsign>
    blacklistedCallsignsFound: Set<Callsign>
    scoringDetails: Record<Callsign, Partial<ParticipantScoringDetail>>
    missingParticipants: Set<Callsign>
  },
  params?: DefaultValidatorParams
): Map<Callsign, ValidContact[]> => {
  const result = new Map<Callsign, ValidContact[]>()

  for (const [callsign, contacts] of validContacts.entries()) {
    if (context.blacklistedCallsigns?.has(callsign)) {
      context.blacklistedCallsignsFound?.add(callsign)
      continue
    }

    const validatedContacts = contacts.filter(contact => {
      if (context.blacklistedCallsigns?.has(contact.contactedCallsign)) {
        context.blacklistedCallsignsFound?.add(callsign)
        return false
      }

      const isMissingParticipant = !context.participantCallsigns.has(
        contact.contactedCallsign
      )

      // Depending on allowMissingParticipants flag:
      // If true, skip default validator and validate this contact
      // If false, exclude the contact altogether
      if (isMissingParticipant) {
        context.missingParticipants.add(contact.contactedCallsign)
        return !!context.contestRules.allowMissingParticipants
      }

      const isValid = defaultValidator(
        callsign,
        contact,
        context.contactIndex,
        params
      )

      if (!isValid) {
        context.scoringDetails[callsign]!.contacts![
          contact.scoringDetailsIndex
        ]!.invalidValidationRule = 'default'
      }

      return isValid
    })

    result.set(callsign, validatedContacts)
  }

  return result
}

// Create an indexed structure for efficient contact lookups
// The index is a nested map: callsign -> contacted callsign -> band+mode -> array of contacts
const createContactIndex = (
  validContacts: Map<Callsign, ValidContact[]>
): ContactIndex => {
  const index: ContactIndex = new Map()

  for (const [_, contacts] of validContacts) {
    for (const contact of contacts) {
      if (!index.has(contact.callsign)) {
        index.set(contact.callsign, new Map())
      }

      const callsignIndex = index.get(contact.callsign)!

      if (!callsignIndex.has(contact.contactedCallsign)) {
        callsignIndex.set(contact.contactedCallsign, new Map())
      }

      const bandModeKey = `${contact.band}-${contact.mode}`
      const callerIndex = callsignIndex.get(contact.contactedCallsign)!

      if (!callerIndex.has(bandModeKey)) {
        callerIndex.set(bandModeKey, [])
      }

      callerIndex.get(bandModeKey)!.push(contact)
    }
  }

  return index
}

const applyInitialValidation = (
  submissions: Participant[],
  rulesContext: RulesContext,
  validationRules: ValidationRuleConfig[],
  participantCallsigns: Set<Callsign>,
  blacklistedCallsigns: Set<Callsign>,
  blacklistedCallsignsFound: Set<Callsign>,
  blacklistedAppearanceCounts: Map<Callsign, number>,
  scoringDetails: Record<Callsign, Partial<ParticipantScoringDetail>>
): Map<Callsign, ValidContact[]> => {
  const validContacts = new Map<Callsign, ValidContact[]>()

  const context: ValidationContext = {
    submissions,
    validContacts,
    contestRules: rulesContext.contestRules,
    participantCallsigns,
    timeRanges: rulesContext.timeRanges,
    bandRanges: rulesContext.bandRanges,
    blacklistedCallsigns,
    contestStart: rulesContext.contestStart,
    contestEnd: rulesContext.contestEnd,
  }

  for (const [callsign, contacts] of submissions) {
    if (blacklistedCallsigns.has(callsign)) {
      blacklistedCallsignsFound?.add(callsign)
      blacklistedAppearanceCounts.set(
        callsign,
        (blacklistedAppearanceCounts.get(callsign) || 0) + 1
      )
      continue
    }

    scoringDetails[callsign] = {
      ...scoringDetails[callsign],
      contacts: scoringDetails[callsign]?.contacts || [],
    }

    validContacts.set(callsign, [])

    const localBlacklistedAppearances = new Set<Callsign>()

    for (const contact of contacts || []) {
      const contactedCallsign = String(contact.call || '')
      const currentContactDetails = {
        ...contact,
        invalidValidationRule: null,
      } as ContactScoringDetail

      if (blacklistedCallsigns.has(contactedCallsign)) {
        blacklistedCallsignsFound?.add(contactedCallsign)
        if (!localBlacklistedAppearances.has(contactedCallsign)) {
          blacklistedAppearanceCounts.set(
            contactedCallsign,
            (blacklistedAppearanceCounts.get(contactedCallsign) || 0) + 1
          )
          localBlacklistedAppearances.add(contactedCallsign)
        }
        continue
      }

      const isValid = validationRules.every(rule => {
        const [ruleName, params] =
          typeof rule === 'string' ? [rule, undefined] : rule
        const passesValidation = validators[ruleName](
          callsign,
          contact,
          context,
          params
        )

        if (!passesValidation) {
          currentContactDetails.invalidValidationRule = ruleName
          currentContactDetails.givenScore = 0
          currentContactDetails.scoreRule = null
        }

        return passesValidation
      })

      scoringDetails[callsign].contacts = scoringDetails[
        callsign
      ].contacts!.concat(currentContactDetails)

      if (!isValid) continue

      const { date, time } = getDateTimeFromContact(contact)

      const rstSent = String(contact.rst_sent || '')
      const rstRcvd = String(contact.rst_rcvd || '')

      const stxString = String(contact.stx_string || '')
      const srxString = String(contact.srx_string || '')

      const exchanges = {
        rstSent,
        rstRcvd,
        stxString,
        srxString,
      }

      const freq = String(contact.freq || '')
      const freqNum = Number(freq)

      const band =
        freq && !isNaN(freqNum) && rulesContext.bandRanges?.length > 0
          ? rulesContext.bandRanges.find(
              range =>
                freqNum >= range.start && freqNum <= range.end && range.name
            )?.name || String(contact.band || '')
          : String(contact.band || '')

      // Correctly set the band in the contact object
      contact.band = band

      const validContact: ValidContact = {
        callsign,
        contactedCallsign: contactedCallsign,
        date,
        time,
        freq,
        band,
        mode: String(contact.mode || ''),
        exchanges,
        score: 0,
        scoringDetailsIndex: scoringDetails[callsign].contacts!.length - 1,
      }

      validContacts.get(callsign)!.push(validContact)
    }
  }

  return validContacts
}

// Count how many times each callsign appears as a contacted station
const countAppearances = (
  validContactsMap: Map<Callsign, ValidContact[]>,
  minimumAppearances: number,
  rulesContext: RulesContext,
  missingParticipants: Set<Callsign>,
  scoringDetails: Record<Callsign, Partial<ParticipantScoringDetail>>
) => {
  const allowMissingParticipants =
    !!rulesContext?.contestRules?.allowMissingParticipants

  const appearanceCounts = new Map<Callsign, number>()

  for (const contacts of validContactsMap.values()) {
    const localAppearances = new Set<Callsign>()
    for (const contact of contacts) {
      const contactedCallsign = contact.contactedCallsign
      if (localAppearances.has(contactedCallsign)) continue
      const appearances = (appearanceCounts.get(contactedCallsign) || 0) + 1
      appearanceCounts.set(contactedCallsign, appearances)
      localAppearances.add(contactedCallsign)

      if (contactedCallsign in scoringDetails) {
        scoringDetails[contactedCallsign]!.hasMinimumAppearances =
          appearances >= minimumAppearances
      }

      // Track missing participants - stations that were contacted but didn't submit logs
      if (
        allowMissingParticipants &&
        !validContactsMap.has(contactedCallsign)
      ) {
        missingParticipants.add(contactedCallsign)
      }
    }
  }
  return appearanceCounts
}

const applyUniqueContactsByTimeRangeValidation = (
  validContacts: Map<Callsign, ValidContact[]>,
  timeRanges: Record<string, { start: Date; end: Date }> = {},
  scoringDetails: Record<Callsign, Partial<ParticipantScoringDetail>> = {}
): Map<Callsign, ValidContact[]> => {
  const result = new Map<Callsign, ValidContact[]>()
  for (const [callsign, contacts] of validContacts.entries()) {
    result.set(callsign, [])
    for (const contact of contacts) {
      const isValid = uniqueContactsByTimeRangeValidator(
        callsign,
        contact,
        result,
        timeRanges
      )

      if (!isValid) {
        const contactDetails =
          scoringDetails[callsign]!.contacts![contact.scoringDetailsIndex]!
        contactDetails.invalidValidationRule = 'uniqueContactsByTimeRange'
        contactDetails.givenScore = 0
        contactDetails.scoreRule = null
        continue
      }

      result.get(callsign)!.push(contact)
    }
  }
  return result
}

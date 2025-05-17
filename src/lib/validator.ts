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
} from 'types'
import {
  defaultValidator,
  minimumContactsValidator,
  validators,
} from 'lib/rules/validators'
import { extractRule, getDateTimeFromContact } from 'utils'

const RULES_TO_SKIP_DURING_INITIAL_VALIDATION: ValidationRule[] = [
  'minimumContacts',
  'default',
] as const

export const validateContacts = (
  submissions: Participant[],
  rulesContext: RulesContext
): Map<Callsign, ValidContact[]> => {
  const contestRules = rulesContext.contestRules

  const blacklistedCallsigns = new Set(contestRules.blacklist || [])

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

  const initialValidationRules = contestRules.rules.validation.filter(rule => {
    const ruleName = typeof rule === 'string' ? rule : rule[0]
    return !RULES_TO_SKIP_DURING_INITIAL_VALIDATION.includes(ruleName)
  })

  // Validate with basic rules to establish initial valid contacts
  const initialValidContacts = runValidation(
    submissions,
    rulesContext,
    initialValidationRules,
    participantCallsigns,
    blacklistedCallsigns
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
        },
        Array.isArray(defaultRuleConfig) && defaultRuleConfig.length > 1
          ? (defaultRuleConfig[1] as DefaultValidatorParams)
          : {}
      )
    : initialValidContacts

  const finalContacts =
    minimumContactsRule && Array.isArray(minimumContactsRule)
      ? minimumContactsValidator(
          contactsAfterDefaultValidation,
          minimumContactsRule[1] as number,
          rulesContext
        )
      : contactsAfterDefaultValidation

  return finalContacts
}

const applyDefaultValidation = (
  validContacts: Map<Callsign, ValidContact[]>,
  context: {
    submissions: Participant[]
    contestRules: ContestRules
    participantCallsigns: Set<Callsign>
    contactIndex: ContactIndex
    blacklistedCallsigns?: Set<Callsign>
  },
  params?: DefaultValidatorParams
): Map<Callsign, ValidContact[]> => {
  const result = new Map<Callsign, ValidContact[]>()

  for (const [callsign, contacts] of validContacts.entries()) {
    if (context.blacklistedCallsigns?.has(callsign)) continue

    const validatedContacts = contacts.filter(contact => {
      if (context.blacklistedCallsigns?.has(contact.contactedCallsign))
        return false

      const isMissingParticipant = !context.participantCallsigns.has(
        contact.contactedCallsign
      )

      // Depending on allowMissingParticipants flag:
      // If true, skip default validator and validate this contact
      // If false, exclude the contact altogether
      if (isMissingParticipant) {
        return !!context.contestRules.allowMissingParticipants
      }

      return defaultValidator(callsign, contact, context.contactIndex, params)
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

const runValidation = (
  submissions: Participant[],
  rulesContext: RulesContext,
  validationRules: ValidationRuleConfig[],
  participantCallsigns: Set<Callsign>,
  blacklistedCallsigns?: Set<Callsign>
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
    if (blacklistedCallsigns && blacklistedCallsigns.has(callsign)) continue

    const validContactsForCallsign: ValidContact[] = []

    for (const contact of contacts || []) {
      const contactedCallsign = String(contact.call || '')
      if (blacklistedCallsigns && blacklistedCallsigns.has(contactedCallsign))
        continue

      const isValid = validationRules.every(rule => {
        const [ruleName, params] =
          typeof rule === 'string' ? [rule, undefined] : rule
        return validators[ruleName](callsign, contact, context, params)
      })

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
      }

      validContactsForCallsign.push(validContact)
    }

    validContacts.set(callsign, validContactsForCallsign)
  }

  return validContacts
}

import type {
  Callsign,
  ValidContact,
  ValidContacts,
  ScoringContext,
  RulesContext,
  ParticipantScoringDetail,
} from 'types'
import { scorers } from 'lib/rules/scorers'
import { extractRule } from 'utils'

export const scoreContacts = (
  validContacts: ValidContacts,
  rulesContext: RulesContext,
  scoringDetails: Record<Callsign, Partial<ParticipantScoringDetail>>,
  appearanceCounts: Map<Callsign, number>
): Map<Callsign, ValidContact[]> => {
  const minimumContactsRule = extractRule(
    rulesContext.contestRules.rules.scoring,
    'minimumContacts'
  )

  const minimumContacts =
    minimumContactsRule && Array.isArray(minimumContactsRule)
      ? (minimumContactsRule[1] as number)
      : 0

  const otherScoringRules = rulesContext.contestRules.rules.scoring.filter(
    rule => {
      const ruleName = typeof rule === 'string' ? rule : rule[0]
      return ruleName !== 'minimumContacts'
    }
  )

  const context: ScoringContext = {
    validContacts,
    timeRanges: rulesContext.timeRanges,
  }

  return new Map(
    Array.from(validContacts.entries()).reduce(
      (result, [callsign, contacts]) => {
        // Missing participants are ignored
        if (contacts === null) return result

        // If a minimum contacts rule is defined,
        // only participants with enough contacts are scored
        if (
          minimumContactsRule &&
          (scoringDetails[callsign]?.contacts?.length || 0) < minimumContacts
        )
          return result.concat([[callsign, []]])

        return result.concat([
          [
            callsign,
            contacts.map(contact => {
              const contactScoringDetails =
                scoringDetails[callsign]!.contacts![
                  contact.scoringDetailsIndex
                ]!

              // If the contact does not have enough appearances, do not score it
              if (
                minimumContactsRule &&
                (appearanceCounts.get(contact.contactedCallsign) || 0) <
                  minimumContacts
              ) {
                contactScoringDetails.scoreRule = 'minimumContacts'
                contactScoringDetails.givenScore = 0
                return { ...contact, score: 0 }
              }

              // Create a new contact object for each scoring rule, passing the updated score forward
              return otherScoringRules.reduce(
                (scoredContact, rule) => {
                  const [ruleName, params] = Array.isArray(rule)
                    ? rule
                    : [rule, undefined]

                  const score = scorers[ruleName as keyof typeof scorers](
                    scoredContact,
                    context,
                    params
                  )

                  if (scoredContact.score !== score) {
                    contactScoringDetails.scoreRule = ruleName
                    contactScoringDetails.givenScore = score
                  }

                  return {
                    ...scoredContact,
                    score,
                  }
                },
                { ...contact, score: 0 }
              )
            }),
          ],
        ])
      },
      [] as [Callsign, ValidContact[]][]
    )
  )
}

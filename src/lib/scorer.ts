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
  scoringDetails: Record<Callsign, Partial<ParticipantScoringDetail>>
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
        if (!contacts) return result

        // If a minimum contacts rule is defined,
        // only participants with enough contacts are scored
        if (minimumContactsRule && contacts.length < minimumContacts)
          return result.concat([[callsign, []]])

        return result.concat([
          [
            callsign,
            contacts.map(contact =>
              // Create a new contact object for each scoring rule, passing the updated score forward
              otherScoringRules.reduce(
                (scoredContact, rule) => {
                  const [ruleName, params] = Array.isArray(rule)
                    ? rule
                    : [rule, undefined]

                  // Apply the rule and return a new contact object with the updated score
                  const score = scorers[ruleName](
                    scoredContact,
                    context,
                    params
                  )

                  if (scoredContact.score !== score) {
                    scoringDetails[callsign]!.contacts![
                      scoredContact.scoringDetailsIndex
                    ]!.scoreRule = ruleName

                    scoringDetails[callsign]!.contacts![
                      scoredContact.scoringDetailsIndex
                    ]!.givenScore = score
                  }

                  return {
                    ...scoredContact,
                    score,
                  }
                },
                { ...contact, score: 0 }
              )
            ),
          ],
        ])
      },
      [] as [Callsign, ValidContact[]][]
    )
  )
}

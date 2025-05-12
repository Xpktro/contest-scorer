import type {
  Callsign,
  ValidContact,
  ScoringContext,
  RulesContext,
} from 'types'
import { scorers } from 'lib/rules/scorers'

export const scoreContacts = (
  validContacts: Map<Callsign, ValidContact[]>,
  rulesContext: RulesContext
): Map<Callsign, ValidContact[]> => {
  const context: ScoringContext = {
    validContacts,
    timeRanges: rulesContext.timeRanges,
  }

  return new Map(
    Array.from(validContacts.entries()).map(([callsign, contacts]) => [
      callsign,
      contacts.length === 0
        ? // Missing participants have empty contact arrays - they don't receive points
          // but their callsigns exist in the validContacts map to award points to others
          []
        : contacts.map(contact =>
            // Create a new contact object for each scoring rule, passing the updated score forward
            rulesContext.contestRules.rules.scoring.reduce(
              (scoredContact, rule) => {
                const [ruleName, params] = Array.isArray(rule)
                  ? rule
                  : [rule, undefined]

                // Apply the rule and return a new contact object with the updated score
                return {
                  ...scoredContact,
                  score: scorers[ruleName](scoredContact, context, params),
                }
              },
              { ...contact, score: 0 }
            )
          ),
    ])
  )
}

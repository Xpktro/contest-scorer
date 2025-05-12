import type {
  Callsign,
  ValidContact,
  ContestRules,
  ScoringContext,
  ScoringResult,
  RulesContext,
} from './types'
import { bonusers } from './rules/bonusers'

export const applyBonusRules = (
  scoredContacts: Map<Callsign, ValidContact[]>,
  rules: ContestRules,
  rulesContext: RulesContext
): ScoringResult[] => {
  const context: ScoringContext = {
    validContacts: scoredContacts,
    timeRanges: rulesContext.timeRanges,
  }

  return Array.from(scoredContacts.entries()).map(([callsign, contacts]) => {
    const finalScore = contacts.reduce((sum, contact) => {
      // Apply each bonus rule to the contact sequentially, passing forward the updated contact
      const contactWithFinalScore = rules.rules.bonus.reduce(
        (updatedContact, rule) => {
          const [ruleName, params] = Array.isArray(rule)
            ? rule
            : [rule, undefined]

          return {
            ...contact,
            score: bonusers[ruleName](updatedContact, context, params),
          }
        },
        { ...contact }
      )

      return sum + contactWithFinalScore.score
    }, 0)

    return [callsign, finalScore]
  })
}

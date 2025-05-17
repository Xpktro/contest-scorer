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
    const baseScore = contacts.reduce((sum, contact) => sum + contact.score, 0)

    const finalScore = rules.rules.bonus.reduce((currentScore, rule) => {
      const [ruleName, params] = Array.isArray(rule) ? rule : [rule, undefined]

      return bonusers[ruleName](currentScore, context, params)
    }, baseScore)

    return [callsign, finalScore]
  })
}

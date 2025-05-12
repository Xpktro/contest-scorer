import type { ValidContact, ScoringContext, BonusRule } from 'lib/types'

export const defaultBonus = (
  contact: ValidContact,
  _: ScoringContext,
  multiplier: number = 1
): number => contact.score * multiplier

export const bonusers: Record<BonusRule, any> = {
  default: defaultBonus,
}

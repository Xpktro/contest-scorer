import type { ScoringContext, ValidContact, ScoringRule } from 'types'
import { parseDateTime } from 'utils'

export const defaultScorer = (
  _: ValidContact,
  __: ScoringContext,
  score: number = 1
): number => score

export const timeRangeScorer = (
  validContact: ValidContact,
  context: ScoringContext,
  params: Record<string, number>
): number => {
  const { date, time } = validContact
  const contactDateTime = parseDateTime(date, time)

  for (const [rangeName, { start, end }] of Object.entries(
    context.timeRanges
  )) {
    if (contactDateTime >= start && contactDateTime <= end) {
      return params[rangeName] ?? validContact.score
    }
  }

  return validContact.score
}

export const bonusStationsScorer = (
  validContact: ValidContact,
  _: ScoringContext,
  params: Record<string, number>
): number => {
  const { contactedCallsign } = validContact
  return params[contactedCallsign] ?? validContact.score
}

export const scorers: Record<Exclude<ScoringRule, 'minimumContacts'>, any> = {
  default: defaultScorer,
  timeRange: timeRangeScorer,
  bonusStations: bonusStationsScorer,
}

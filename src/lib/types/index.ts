import type { SimpleAdif } from 'adif-parser-ts'

export type Callsign = string
export type Contact = NonNullable<SimpleAdif['records']>[number]

export type ValidationRule =
  | 'default'
  | 'timeRange'
  | 'bands'
  | 'mode'
  | 'contactedInContest'
  | 'uniqueContactsByTimeRange'
  | 'exchange'
  | 'minimumContacts'

export type ScoringRule = 'default' | 'timeRange' | 'bonusStations'

export type BonusRule = 'default'

export type TieBreakerRule = 'default' | 'validStations' | 'minimumTime'

export type ValidationRuleParam =
  | Record<string, any>
  | string
  | string[]
  | number

export type Validator<T extends ValidationRuleParam = ValidationRuleParam> = (
  callsign: Callsign,
  contact: Contact,
  context: ValidationContext,
  params?: T
) => boolean

export type ValidationRuleConfig =
  | ValidationRule
  | [ValidationRule, ValidationRuleParam]

export type DefaultValidatorParams = {
  maximumTimeDiff?: number
  maximumFrequencyDiff?: number
}

export type ScoringRuleParam = Record<string, any> | string | number

export type ScoringRuleConfig = ScoringRule | [ScoringRule, ScoringRuleParam]

export type BonusRuleParam = Record<string, any> | string | number

export type BonusRuleConfig = BonusRule | [BonusRule, BonusRuleParam]

export type ContactIndex = Map<
  Callsign,
  Map<Callsign, Map<Callsign, ValidContact[]>>
>

export interface ContestRules {
  name: string
  start: string
  end: string
  blacklist?: Callsign[]
  allowMissingParticipants?: boolean
  rules: {
    validation: ValidationRuleConfig[]
    scoring: ScoringRuleConfig[]
    bonus: BonusRuleConfig[]
    tiebreaker: TieBreakerRule[]
  }
}

export interface ValidContact {
  callsign: string
  contactedCallsign: string
  date: string
  time: string
  freq: string
  band: string
  mode: string
  exchanges: {
    rstSent: string
    rstRcvd: string
    stxString: string
    srxString: string
  }
  score: number
  scoringDetailsIndex: number
}

export type ValidContacts = Map<Callsign, ValidContact[] | null>

export interface ValidationContext {
  submissions: Participant[]
  validContacts: ValidContacts
  contestRules: ContestRules
  participantCallsigns?: Set<Callsign>
  timeRanges: Record<string, { start: Date; end: Date }>
  bandRanges: Array<{ start: number; end: number; name?: string }>
  missingParticipants?: Set<Callsign>
  blacklistedCallsigns?: Set<Callsign>
  contestStart: Date
  contestEnd: Date
}

export interface ScoringContext {
  validContacts: ValidContacts
  timeRanges: Record<string, { start: Date; end: Date }>
}

export interface RulesContext {
  contestRules: ContestRules
  timeRanges: Record<string, { start: Date; end: Date }>
  bandRanges: Array<{ start: number; end: number; name?: string }>
  contestStart: Date
  contestEnd: Date
}

export type Participant = [Callsign, SimpleAdif['records']]
export type ScoringResult = [Callsign, number]

export type ContactScoringDetail = NonNullable<
  SimpleAdif['records']
>[number] & {
  invalidValidationRule: ValidationRule | null
  scoreRule: ScoringRule | null
  givenScore: number
}

export interface ParticipantScoringDetail {
  bonusRuleApplied: BonusRule | null
  givenBonus: number
  contacts: ContactScoringDetail[]
  hasMinimumAppearances: boolean
}

export interface ContestResult {
  results: ScoringResult[]
  scoringDetails: Record<Callsign, ParticipantScoringDetail>
  missingParticipants: Callsign[]
  blacklistedCallsignsFound: Callsign[]
}

export type ContactValidatorResult = {
  validContacts: ValidContacts
  scoringDetails: Record<Callsign, Partial<ParticipantScoringDetail>>
  missingParticipants: Set<Callsign>
  blacklistedCallsignsFound: Set<Callsign>
}

export type ContactValidator = (
  submissions: Participant[],
  rulesContext: RulesContext
) => ContactValidatorResult

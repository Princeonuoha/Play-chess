export type ShowcaseCase = {
  readonly state: string
  readonly seed?: boolean
  readonly node: React.ReactNode
}

export type ShowcaseGroup = {
  readonly name: string
  readonly source: string
  readonly pending?: string
  readonly cases: readonly ShowcaseCase[]
}

export const LONG_LABEL = 'Start training the Nimzo-Indian Defence, Rubinstein Variation, Main Line'

export const LONG_BODY =
  'Stockfish graded every move in this game, flagged the two inaccuracies on moves 14 and 23, and compared ' +
  'your continuation against the master repertoire for the Nimzo-Indian Defence, Rubinstein Variation, so you ' +
  'can see exactly where the plan diverged from established theory and what the stronger alternative was.'

export type MoveLabel = 'Best' | 'Good' | 'Inaccuracy' | 'Mistake' | 'Blunder'

export function classify(cpDelta: number): MoveLabel {
  if (cpDelta <= 15) return 'Best'
  else if (cpDelta <= 90) return 'Good'
  else if (cpDelta <= 175) return 'Inaccuracy'
  else if (cpDelta <= 330) return 'Mistake'
  else return 'Blunder'
}

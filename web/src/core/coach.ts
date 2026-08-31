/* Curated coaching notes keyed by primary opening (lichess names). These are
   general, well-established strategic ideas — pawn structure, themes, and
   middle-game plans — not concrete move theory. The opening DB supplies the
   verified moves; this adds the "why" for the popular openings. */

export interface CoachNote {
  themes: string // 1–2 sentences: pawn structure and key ideas
  plans: string[] // 2–3 actionable middle-game goals
}

export const COACH: Record<string, CoachNote> = {
  'Sicilian Defense': {
    themes:
      'Black trades a wing pawn for a centre pawn and fights for the initiative on the queenside and the half-open c-file. Asymmetrical, sharp positions where both sides attack.',
    plans: [
      'Press the half-open c-file with a rook on c8 and consider the ...Rxc3 exchange sacrifice.',
      'Expand with ...b5–b4 and ...a5 to chase White’s knight and open lines toward the king.',
      'When White castles queenside, race with pawns; when White castles kingside, aim for ...d5 to free the position.',
    ],
  },
  'French Defense': {
    themes:
      'Black builds a solid pawn chain (…e6/…d5) and strikes at White’s centre with …c5 and …f6. The light-squared bishop is the traditional problem piece.',
    plans: [
      'Break with …c5 (and later …f6) to undermine White’s d4/e5 chain at its base.',
      'Solve the bad bishop — trade it via …b6/…Ba6 or …Bd7–b5, or activate it after a timely …f6.',
      'Use the half-open c- and f-files and pressure d4; a knight on f5 or c4 is often ideal.',
    ],
  },
  'Caro-Kann Defense': {
    themes:
      'Like the French but the light-squared bishop develops outside the chain to f5/g6 first. Rock-solid structure aiming for a comfortable, low-risk middlegame.',
    plans: [
      'Complete development smoothly and castle; then contest the centre with …c5 or …e5 at the right moment.',
      'Trade into a sound endgame — Black’s structure is durable and the better-placed pieces tell.',
      'Watch the kingside if you fianchetto (…g6); keep the dark squares covered.',
    ],
  },
  'Ruy Lopez': {
    themes:
      'White pins and pressures the e5-pawn, then builds a big centre with c3/d4. One of the deepest positional battlegrounds in chess.',
    plans: [
      'As White, prepare d4 with c3, gaining space; reroute the b1-knight via d2–f1–g3.',
      'As Black in the Closed lines, hold e5, manoeuvre …Nb8–d7 or …Na5, and time …c5 or …d5.',
      'Control the centre before committing to a wing; the game often opens once d4/…d5 lands.',
    ],
  },
  'Italian Game': {
    themes:
      'Fast, natural development around the a2–g8 diagonal. Modern play is the slow Giuoco Pianissimo (d3/c3) building toward a central d4 break.',
    plans: [
      'Prepare d4 with c3 and a rook on e1; don’t rush — improve pieces first.',
      'Reroute the b1-knight (Nbd2–f1–g3) toward the kingside.',
      'Watch for the …d5 freeing break as Black, or clamp it down as White.',
    ],
  },
  "Queen's Gambit Declined": {
    themes:
      'A classical, solid structure where Black accepts a slightly passive but very sound game. Play revolves around the c-file and the …c5 / …dxc4 breaks.',
    plans: [
      'As Black, free the game with …c5 or the …dxc4 and …b5/…Bb7 setup.',
      'As White, use the minority attack (b4–b5) to create a weak pawn on c6.',
      'Fight for the c-file and the e4/e5 central squares.',
    ],
  },
  'Slav Defense': {
    themes:
      'Black supports d5 with …c6, keeping the light-squared bishop free to develop to f5 or g4. Solid and resilient.',
    plans: [
      'Develop the light bishop actively (…Bf5/…Bg4) before …e6.',
      'Grab and hold c4 when possible, then support …b5.',
      'Aim for the …c5 or …e5 break to equalise in the centre.',
    ],
  },
  "King's Indian Defense": {
    themes:
      'Black cedes the centre, then storms the kingside with …f5–f4 while White expands and attacks on the queenside. A full-blooded race.',
    plans: [
      'Play …f5, …f4, …g5–g4 and throw the kingside pawns at White’s king.',
      'Keep the centre closed so the wing attacks decide the game.',
      'As White, break with c5 and pour pieces down the c-file toward b7/queenside.',
    ],
  },
  'Nimzo-Indian Defense': {
    themes:
      'Black pins the c3-knight with …Bb4 and is ready to trade it, saddling White with doubled c-pawns in exchange for the bishop pair.',
    plans: [
      'Trade on c3 to double White’s pawns, then blockade the light squares (…d5, …b6, …Ba6).',
      'Target the c4-pawn and the c-file weaknesses.',
      'As White, use the bishop pair and open lines; aim for e4 to activate the centre.',
    ],
  },
  'English Opening': {
    themes:
      'A flexible flank opening — often a Sicilian with colours reversed and an extra tempo. Fianchetto and press the long diagonal and the c-file.',
    plans: [
      'Fianchetto the king’s bishop and pressure d5 and the long diagonal.',
      'Expand on the queenside with b4/a3 or contest the centre with a timely d4/e4.',
      'Use the c-file; the reversed-Sicilian tempo lets White dictate.',
    ],
  },
  'Scandinavian Defense': {
    themes:
      'Black challenges e4 immediately; after …Qxd5 the queen sits actively but must find a safe home. Easy development and a clear plan.',
    plans: [
      'Develop naturally (…Nf6, …c6, …Bf5/…Bg4) and castle; keep the queen safe on a5 or c7.',
      'Aim for a solid Caro-Kann-like structure and press the central files.',
      'Trade pieces to reach a comfortable, symmetrical endgame.',
    ],
  },
  'Pirc Defense': {
    themes:
      'A hypermodern setup: Black lets White build a big centre, then undermines it with …c5, …e5 and pressure from the g7-bishop.',
    plans: [
      'Fianchetto and strike the centre with …e5 or …c5 at the right moment.',
      'Use the g7-bishop’s pressure on the long diagonal.',
      'Against the Austrian Attack (f4), be precise — counter in the centre before White’s pawns roll.',
    ],
  },
  'London System': {
    themes:
      'An easy-to-learn system: Bf4, e3, c3, Bd3, Nbd2. Solid and flexible, aiming for a well-timed e4 or a kingside build-up.',
    plans: [
      'Complete the standard setup, then break with e4 (or push kingside with Ne5 and f4).',
      'Trade off Black’s good bishop and target e5/kingside.',
      'Keep the structure sound; the London rewards patience.',
    ],
  },
  'Catalan Opening': {
    themes:
      'White combines a Queen’s Gambit with a kingside fianchetto; the g2-bishop rakes the long diagonal and pressures Black’s queenside.',
    plans: [
      'Recover or pressure the c4-pawn while the g2-bishop eyes b7/d5.',
      'Build slow queenside pressure; Black often struggles to develop the light bishop.',
      'As Black, either hold c4 with …b5 or return it for smooth development and …c5.',
    ],
  },
  "Queen's Gambit Accepted": {
    themes:
      'Black grabs the c4-pawn but usually gives it back for free development and a share of the centre with …c5 and …e6.',
    plans: [
      'Return the pawn for quick development; strike with …c5 against d4.',
      'Develop the light bishop before …e6 so it isn’t shut in.',
      'As White, use the extra centre space and lead in development.',
    ],
  },
  'Grünfeld Defense': {
    themes:
      'Black lets White build a broad pawn centre, then attacks it with …d5, …c5 and the g7-bishop. Dynamic counterattack over structure.',
    plans: [
      'Hit the centre with …c5 and …Bg7 pressure; provoke White into overextension.',
      'Target d4 and the c3-pawn; open lines for the fianchettoed bishop.',
      'As White, use the big centre to attack — but keep it defended.',
    ],
  },
  'Vienna Game': {
    themes:
      'White develops the b1-knight early and prepares f4, aiming for a King’s-Gambit-style attack with a sounder structure.',
    plans: [
      'Prepare f4 to open lines toward the black king.',
      'Develop quickly and castle; use the e-file after the centre opens.',
      'As Black, meet the centre with …d5 to free the position.',
    ],
  },
}

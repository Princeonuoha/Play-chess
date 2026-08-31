/* Opening trainer lines + master games. Move lists are facts (public game scores
   and standard theory); every line was verified legal against chess.js in the
   original app. Ported verbatim. */

export interface BookLine {
  opening?: string;
  variation: string;
  eco?: string;
  you: 'w' | 'b';
  idea?: string;
  moves: string[];
  // When set, the trainer stops at the end of the line instead of handing the
  // position over to Stockfish to play on (used for suggested best-move lines).
  noHandoff?: boolean;
  // Master-game-only fields:
  game?: boolean;
  hero?: string;
  theme?: string;
  era?: string;
  result?: string;
  white?: string;
  black?: string;
  notes?: Record<number, string>;
}

export const BOOK: BookLine[] = [
  { opening:'French Defense', variation:'Advance, Main Line', you:'b',
    idea:'Black chips at the e5/d4 pawn chain with ...c5 and ...f6; White defends the base and grabs space on the kingside.',
    moves:['e4','e6','d4','d5','e5','c5','c3','Nc6','Nf3','Qb6','a3','Nh6','b4','cxd4','cxd4','Nf5','Bb2','Be7','g4','Nh4','Nxh4','Bxh4'] },
  { opening:'French Defense', variation:'Tarrasch, Open (3...c5)', you:'b',
    idea:'Black accepts an isolated d-pawn for free piece play and open lines — activity over structure.',
    moves:['e4','e6','d4','d5','Nd2','c5','exd5','exd5','Ngf3','Nc6','Bb5','Bd6','dxc5','Bxc5','O-O','Ne7','Nb3','Bd6','Nbd4','O-O'] },
  { opening:'French Defense', variation:'Tarrasch, Closed (3...Nf6)', you:'b',
    idea:'Classic French pawn chain: Black plays ...c5 and ...f6 to break, aiming for the c- and e-files.',
    moves:['e4','e6','d4','d5','Nd2','Nf6','e5','Nfd7','Bd3','c5','c3','Nc6','Ne2','cxd4','cxd4','f6','exf6','Nxf6','Nf3','Bd6'] },
  { opening:'French Defense', variation:'Winawer, Main Line', you:'b',
    idea:'Black trades the dark-squared bishop to wreck White’s queenside pawns, then counters the centre; White hunts on the kingside with Qg4.',
    moves:['e4','e6','d4','d5','Nc3','Bb4','e5','c5','a3','Bxc3+','bxc3','Ne7','Qg4','Qc7','Qxg7','Rg8','Qxh7','cxd4','Ne2','Nbc6','f4','Bd7','Qd3','dxc3'] },
  { opening:'French Defense', variation:'Classical, Steinitz', you:'b',
    idea:'Both sides fight over the d4/e5 squares; Black pressures d4 with ...c5, ...Nc6 and ...Qb6.',
    moves:['e4','e6','d4','d5','Nc3','Nf6','e5','Nfd7','f4','c5','Nf3','Nc6','Be3','cxd4','Nxd4','Bc5','Qd2','O-O','O-O-O','a6'] },
  { opening:'French Defense', variation:'Rubinstein', you:'b',
    idea:'Black gives up the centre for a solid, low-risk structure and easy development — a drawing weapon with bite.',
    moves:['e4','e6','d4','d5','Nc3','dxe4','Nxe4','Nd7','Nf3','Ngf6','Nxf6+','Nxf6','Bd3','c5','dxc5','Bxc5','Qe2','O-O','O-O','b6'] },
  { opening:'French Defense', variation:'MacCutcheon', you:'b',
    idea:'Instead of retreating, Black pins with ...Bb4 and accepts doubled pawns for active piece play and the bishop pair.',
    moves:['e4','e6','d4','d5','Nc3','Nf6','Bg5','Bb4','e5','h6','Bd2','Bxc3','bxc3','Ne4','Qg4','Kf8','Bd3','Nxd2'] },
  { opening:'French Defense', variation:'Exchange', you:'b',
    idea:'Symmetrical and open — play for piece activity and the only open file; don’t drift into a lifeless draw.',
    moves:['e4','e6','d4','d5','exd5','exd5','Nf3','Nf6','Bd3','Bd6','O-O','O-O','Bg5','Bg4','Nbd2','Nbd7','c3','c6'] },
  { opening:'Sicilian Defense', variation:'Najdorf, English Attack', you:'b',
    idea:'Opposite-side castling race: White storms with f3, g4, h4; Black counters on the queenside with ...b5 and ...a5.',
    moves:['e4','c5','Nf3','d6','d4','cxd4','Nxd4','Nf6','Nc3','a6','Be3','e5','Nb3','Be6','f3','Be7','Qd2','O-O','O-O-O','Nbd7'] },
  { opening:'Sicilian Defense', variation:'Najdorf, 6.Bg5', you:'b',
    idea:'Sharpest Najdorf: White pins and pressures; Black seeks ...b5, ...Bb7 and counterplay down the c-file.',
    moves:['e4','c5','Nf3','d6','d4','cxd4','Nxd4','Nf6','Nc3','a6','Bg5','e6','f4','Be7','Qf3','Qc7','O-O-O','Nbd7'] },
  { opening:'Sicilian Defense', variation:'Sveshnikov', you:'b',
    idea:'Black accepts a backward d-pawn and a hole on d5 in exchange for active pieces and the bishop pair.',
    moves:['e4','c5','Nf3','Nc6','d4','cxd4','Nxd4','Nf6','Nc3','e5','Ndb5','d6','Bg5','a6','Na3','b5','Bxf6','gxf6','Nd5','f5'] },
  { opening:'Sicilian Defense', variation:'Dragon, Yugoslav', you:'b',
    idea:'Opposite-side attacks: Black’s g7-bishop and c-file vs White’s h-pawn storm. Fastest attack wins.',
    moves:['e4','c5','Nf3','d6','d4','cxd4','Nxd4','Nf6','Nc3','g6','Be3','Bg7','f3','O-O','Qd2','Nc6','Bc4','Bd7','O-O-O','Rc8'] },
  { opening:'Sicilian Defense', variation:'Rossolimo', you:'w',
    idea:'White trades on c6 to damage Black’s structure and plays a positional game against the doubled pawns.',
    moves:['e4','c5','Nf3','Nc6','Bb5','g6','Bxc6','dxc6','d3','Bg7','h3','Nf6','Nc3','O-O'] },
  { opening:'Ruy Lopez', variation:'Berlin Defense', you:'w',
    idea:'The famous endgame: queens come off early; White has a kingside majority, Black the bishop pair.',
    moves:['e4','e5','Nf3','Nc6','Bb5','Nf6','O-O','Nxe4','d4','Nd6','Bxc6','dxc6','dxe5','Nf5','Qxd8+','Kxd8'] },
  { opening:'Ruy Lopez', variation:'Closed, Main Line', you:'w',
    idea:'The main battleground of classical chess: White builds with c3/d4, Black holds with ...Bb7 and manoeuvres the knight to g6/f4.',
    moves:['e4','e5','Nf3','Nc6','Bb5','a6','Ba4','Nf6','O-O','Be7','Re1','b5','Bb3','d6','c3','O-O','h3','Bb7','d4','Re8'] },
  { opening:'Ruy Lopez', variation:'Marshall Attack', you:'b',
    idea:'Black sacrifices a pawn for a lasting kingside initiative and attacking chances against the white king.',
    moves:['e4','e5','Nf3','Nc6','Bb5','a6','Ba4','Nf6','O-O','Be7','Re1','b5','Bb3','O-O','c3','d5','exd5','Nxd5','Nxe5','Nxe5','Rxe5','c6'] },
  { opening:'Italian Game', variation:'Giuoco Pianissimo', you:'w',
    idea:'The “quiet game”: slow build-up with d3/c3, then a central break with d4 at the right moment.',
    moves:['e4','e5','Nf3','Nc6','Bc4','Bc5','c3','Nf6','d3','d6','O-O','O-O','Re1','a6','a4','Ba7','h3','Be6'] },
  { opening:'Italian Game', variation:'Two Knights, Fried Liver', you:'w',
    idea:'A sharp gambit: White sacrifices material to expose the black king in the centre — calculate carefully.',
    moves:['e4','e5','Nf3','Nc6','Bc4','Nf6','Ng5','d5','exd5','Na5','Bb5+','c6','dxc6','bxc6','Be2','h6','Nf3','e4'] },
  { opening:'Caro-Kann', variation:'Advance', you:'b',
    idea:'Like a French but with the light-squared bishop already outside the pawn chain on f5 — solid and comfortable.',
    moves:['e4','c6','d4','d5','e5','Bf5','Nf3','e6','Be2','c5','Be3','Qb6','Nc3','Nc6'] },
  { opening:'Caro-Kann', variation:'Classical', you:'b',
    idea:'Black develops the bishop to f5 first, then builds a rock-solid structure; a low-risk, positional defence.',
    moves:['e4','c6','d4','d5','Nc3','dxe4','Nxe4','Bf5','Ng3','Bg6','h4','h6','Nf3','Nd7','h5','Bh7','Bd3','Bxd3','Qxd3','e6'] },
  { opening:'Caro-Kann', variation:'Panov Attack', you:'w',
    idea:'White takes on an isolated d-pawn for active pieces and open lines — an IQP middlegame in reverse.',
    moves:['e4','c6','d4','d5','exd5','cxd5','c4','Nf6','Nc3','e6','Nf3','Be7','cxd5','Nxd5'] },
  { opening:"Queen's Gambit", variation:'Declined, Main Line', you:'w',
    idea:'White pressures the centre and the c-file; Black frees the game with ...c5 or the ...b6/...Bb7 setup.',
    moves:['d4','d5','c4','e6','Nc3','Nf6','Bg5','Be7','e3','O-O','Nf3','h6','Bh4','b6'] },
  { opening:"Queen's Gambit", variation:'Slav Defense', you:'b',
    idea:'Black supports d5 with ...c6 (keeping the light bishop free), grabs c4, and develops the bishop to f5.',
    moves:['d4','d5','c4','c6','Nf3','Nf6','Nc3','dxc4','a4','Bf5','e3','e6','Bxc4','Bb4'] },
  { opening:"King's Indian Defense", variation:'Classical Main Line', you:'b',
    idea:'Black cedes the centre then storms the kingside with ...f5–f4 while White attacks the queenside. A race.',
    moves:['d4','Nf6','c4','g6','Nc3','Bg7','e4','d6','Nf3','O-O','Be2','e5','O-O','Nc6','d5','Ne7'] },
  { opening:'Nimzo-Indian Defense', variation:'Rubinstein', you:'b',
    idea:'Black trades the bishop for the c3-knight to give White doubled pawns, then blockades the light squares.',
    moves:['d4','Nf6','c4','e6','Nc3','Bb4','e3','O-O','Bd3','d5','Nf3','c5','O-O','Nc6','a3','Bxc3','bxc3'] },
  { opening:'London System', variation:'Main Line', you:'w',
    idea:'An easy-to-learn system: Bf4, e3, c3, Bd3, Nbd2 — solid setup, then break with a well-timed e4.',
    moves:['d4','d5','Bf4','Nf6','e3','c5','Nf3','Nc6','c3','e6','Nbd2','Bd6','Bg3','O-O','Bd3'] },
  { opening:'Scandinavian', variation:'Main Line 3...Qa5', you:'b',
    idea:'Black gets an early, easy development and a solid structure; the queen sits safely on a5 or c7.',
    moves:['e4','d5','exd5','Qxd5','Nc3','Qa5','d4','Nf6','Nf3','c6','Bc4','Bf5','Bd2','e6'] },
  { opening:'Petroff Defense', variation:'Classical', you:'b',
    idea:'Symmetrical and super-solid: Black mirrors White, aiming for equality and easy piece play.',
    moves:['e4','e5','Nf3','Nf6','Nxe5','d6','Nf3','Nxe4','d4','d5','Bd3','Nc6','O-O','Be7','c4'] },
  { opening:'English Opening', variation:'Reversed Sicilian', you:'w',
    idea:'White plays a Sicilian with an extra tempo: fianchetto the bishop and press on the long diagonal and c-file.',
    moves:['c4','e5','Nc3','Nf6','Nf3','Nc6','g3','d5','cxd5','Nxd5','Bg2','Nb6','O-O','Be7'] },

  // ---- Master games: real historical games (moves are facts; play a legend's side).
  //      Each is tagged so it can be browsed by opening / player / theme / era. ----
  { game:true, hero:'Morphy', opening:'Philidor Defense', theme:'Attack', era:'Romantic (1800s)',
    variation:'Morphy “Opera Game” · 1858', you:'w', result:'1–0', white:'Morphy', black:'Duke & Count',
    idea:'Morphy vs the Duke of Brunswick & Count Isouard, Paris Opera 1858 — a textbook of rapid development and open lines.',
    moves:['e4','e5','Nf3','d6','d4','Bg4','dxe5','Bxf3','Qxf3','dxe5','Bc4','Nf6','Qb3','Qe7','Nc3','c6','Bg5','b5','Nxb5','cxb5','Bxb5+','Nbd7','O-O-O','Rd8','Rxd7','Rxd7','Rd1','Qe6','Bxd7+','Nxd7','Qb8+','Nxb8','Rd8#'],
    notes:{18:'10.Nxb5! A knight sacrifice to rip open the d-file against the stranded king.',30:'16.Qb8+!! The immortal queen sacrifice.',32:'17.Rd8# — checkmate. Every white piece developed; the black army but the king still asleep.'} },
  { game:true, hero:'Anderssen', opening:"King's Gambit", theme:'Sacrifice', era:'Romantic (1800s)',
    variation:'The “Immortal Game” · 1851', you:'w', result:'1–0', white:'Anderssen', black:'Kieseritzky',
    idea:'Anderssen vs Kieseritzky, London 1851 — the “Immortal Game”. White gives up a bishop, both rooks and the queen to mate with three minor pieces.',
    moves:['e4','e5','f4','exf4','Bc4','Qh4+','Kf1','b5','Bxb5','Nf6','Nf3','Qh6','d3','Nh5','Nh4','Qg5','Nf5','c6','g4','Nf6','Rg1','cxb5','h4','Qg6','h5','Qg5','Qf3','Ng8','Bxf4','Qf6','Nc3','Bc5','Nd5','Qxb2','Bd6','Bxg1','e5','Qxa1+','Ke2','Na6','Nxg7+','Kd8','Qf6+','Nxf6','Be7#'],
    notes:{34:'18.Bd6!! Offering both rooks to seize the dark squares.',42:'22.Qf6+!! The final sacrifice — Black is forced to capture.',44:'23.Be7# — mate by three minor pieces while Black still has a queen and both rooks.'} },
  { game:true, hero:'Anderssen', opening:'Evans Gambit', theme:'Sacrifice', era:'Romantic (1800s)',
    variation:'The “Evergreen Game” · 1852', you:'w', result:'1–0', white:'Anderssen', black:'Dufresne',
    idea:'Anderssen vs Dufresne, Berlin 1852 — the “Evergreen Game”. An Evans Gambit attack crowned by a storied queen sacrifice.',
    moves:['e4','e5','Nf3','Nc6','Bc4','Bc5','b4','Bxb4','c3','Ba5','d4','exd4','O-O','d3','Qb3','Qf6','e5','Qg6','Re1','Nge7','Ba3','b5','Qxb5','Rb8','Qa4','Bb6','Nbd2','Bb7','Ne4','Qf5','Bxd3','Qh5','Nf6+','gxf6','exf6','Rg8','Rad1','Qxf3','Rxe7+','Nxe7','Qxd7+','Kxd7','Bf5+','Ke8','Bd7+','Kf8','Bxe7#'],
    notes:{36:'19.Rad1!! Ignoring the threat to his own queen to strike first.',40:'20.Rxe7+! then 21.Qxd7+!! drag the king into a mating net.',46:'24.Bxe7# — checkmate.'} },
  { game:true, hero:'Rubinstein', opening:'Tarrasch Defense', theme:'Combination', era:'Classical (early 1900s)',
    variation:'Rotlewi–Rubinstein “Rubinstein’s Immortal” · 1907', you:'b', result:'0–1', white:'Rotlewi', black:'Rubinstein',
    idea:'Rotlewi vs Rubinstein, Łódź 1907 — “Rubinstein’s Immortal”. A quiet build-up erupts into one of history’s most beautiful combinations.',
    moves:['d4','d5','Nf3','e6','e3','c5','c4','Nc6','Nc3','Nf6','dxc5','Bxc5','a3','a6','b4','Bd6','Bb2','O-O','Qd2','Qe7','Bd3','dxc4','Bxc4','b5','Bd3','Rd8','Qe2','Bb7','O-O','Ne5','Nxe5','Bxe5','f4','Bc7','e4','Rac8','e5','Bb6+','Kh1','Ng4','Be4','Qh4','g3','Rxc3','gxh4','Rd2','Qxd2','Bxe4+','Qg2','Rh3'],
    notes:{43:'22…Rxc3! Black ignores his attacked queen — the combination runs far deeper.',47:'24…Bxe4+ — the quiet point behind the storm.',49:'25…Rh3! and White resigned; …Rxh2 mate cannot be met.'} },
  { game:true, hero:'Fischer', opening:'Pirc · Austrian Attack', theme:'Attack', era:'Modern (20th c.)',
    variation:'Fischer–Benko · 1963', you:'w', result:'1–0', white:'Fischer', black:'Benko',
    idea:'Fischer vs Benko, US Championship 1963 — Pirc, Austrian Attack. A model kingside attack that ends with 19.Rf6!!',
    moves:['e4','g6','d4','Bg7','Nc3','d6','f4','Nf6','Nf3','O-O','Bd3','Bg4','h3','Bxf3','Qxf3','Nc6','Be3','e5','dxe5','dxe5','f5','gxf5','Qxf5','Nd4','Qf2','Ne8','O-O','Nd6','Qg3','Kh8','Qg4','c6','Qh5','Qe8','Bxd4','exd4','Rf6','Kg8','e5','h6','Ne2'],
    notes:{6:'The Austrian Attack: White seizes the centre and prepares f5.',36:'19.Rf6!! The rook is immune — 19…Bxf6 20.e5 shuts in the g7-bishop and Qxh6 crashes through.',38:'Slamming the door on the g7-bishop; f6 and h6 can no longer be defended.',40:'Ne2–f4 (or g3) and Qxh6 is unstoppable. Benko resigned.'} },
  { game:true, hero:'Fischer', opening:'Grünfeld Defense', theme:'Counterattack', era:'Modern (20th c.)',
    variation:'Byrne–Fischer “Game of the Century” · 1956', you:'b', result:'0–1', white:'D. Byrne', black:'Fischer',
    idea:'Donald Byrne vs 13-year-old Bobby Fischer, New York 1956. Fischer answers with 17…Be6!! and a cascade of counterblows — one of the greatest games ever played.',
    moves:['Nf3','Nf6','c4','g6','Nc3','Bg7','d4','O-O','Bf4','d5','Qb3','dxc4','Qxc4','c6','e4','Nbd7','Rd1','Nb6','Qc5','Bg4','Bg5','Na4','Qa3','Nxc3','bxc3','Nxe4','Bxe7','Qb6','Bc4','Nxc3','Bc5','Rfe8+','Kf1','Be6','Bxb6','Bxc4+','Kg1','Ne2+','Kf1','Nxd4+','Kg1','Ne2+','Kf1','Nc3+','Kg1','axb6','Qb4','Ra4','Qxb6','Nxd1','h3','Rxa2','Kh2','Nxf2','Re1','Rxe1','Qd8+','Bf8','Nxe1','Bd5','Nf3','Ne4','Qb8','b5','h4','h5','Ne5','Kg7','Kg1','Bc5+','Kf1','Ng3+','Ke1','Bb4+','Kd1','Bb3+','Kc1','Ne2+','Kb1','Nc3+','Kc1','Rc2#'],
    notes:{33:'17…Be6!! The move of the century — the queen is offered; grabbing it walks into a windmill.',81:'41…Rc2# — checkmate. Fischer, at 13, finishes in total harmony.'} },
  { game:true, hero:'Fischer', opening:"Queen's Gambit Declined", theme:'Positional', era:'World Championship',
    variation:'Fischer–Spassky · WCC 1972, Game 6', you:'w', result:'1–0', white:'Fischer', black:'Spassky',
    idea:'Fischer vs Spassky, World Championship 1972, Game 6 — a flawless positional squeeze in the QGD. Even Spassky applauded at the end.',
    moves:['c4','e6','Nf3','d5','d4','Nf6','Nc3','Be7','Bg5','O-O','e3','h6','Bh4','b6','cxd5','Nxd5','Bxe7','Qxe7','Nxd5','exd5','Rc1','Be6','Qa4','c5','Qa3','Rc8','Bb5','a6','dxc5','bxc5','O-O','Ra7','Be2','Nd7','Nd4','Qf8','Nxe6','fxe6','e4','d4','f4','Qe7','e5','Rb8','Bc4','Kh8','Qh3','Nf8','b3','a5','f5','exf5','Rxf5','Nh7','Rcf1','Qd8','Qg3','Re7','h4','Rbb7','e6','Rbc7','Qe5','Qe8','a4','Qd8','R1f2','Qe8','R2f3','Qd8','Bd3','Qe8','Qe4','Nf6','Rxf6','gxf6','Rxf6','Kg8','Bc4','Kh8','Qf4'],
    notes:{52:'A textbook squeeze out of the QGD Tartakower — every white piece steadily improves.',74:'38.Rxf6! The breakthrough; Spassky resigned shortly after. Fischer’s finest positional win.'} },
  { game:true, hero:'Kasparov', opening:'Pirc Defense', theme:'Attack', era:'Modern (20th c.)',
    variation:'Kasparov–Topalov “Kasparov’s Immortal” · 1999', you:'w', result:'1–0', white:'Kasparov', black:'Topalov',
    idea:'Kasparov vs Topalov, Wijk aan Zee 1999 — “Kasparov’s Immortal”. A rook sacrifice launches a king hunt from a7 all the way to d1.',
    moves:['e4','d6','d4','Nf6','Nc3','g6','Be3','Bg7','Qd2','c6','f3','b5','Nge2','Nbd7','Bh6','Bxh6','Qxh6','Bb7','a3','e5','O-O-O','Qe7','Kb1','a6','Nc1','O-O-O','Nb3','exd4','Rxd4','c5','Rd1','Nb6','g3','Kb8','Na5','Ba8','Bh3','d5','Qf4+','Ka7','Rhe1','d4','Nd5','Nbxd5','exd5','Qd6','Rxd4','cxd4','Re7+','Kb6','Qxd4+','Kxa5','b4+','Ka4','Qc3','Qxd5','Ra7','Bb7','Rxb7','Qc4','Qxf6','Kxa3','Qxa6+','Kxb4','c3+','Kxc3','Qa1+','Kd2','Qb2+','Kd1','Bf1','Rd2','Rd7','Rxd7','Bxc4','bxc4','Qxh8','Rd3','Qa8','c3','Qa4+','Ke1','f4','f5','Kc1','Rd2','Qa7'],
    notes:{46:'24.Rxd4!! A rook sacrifice tearing open the black king — the start of a famous king hunt.',48:'25.Re7+ and the king is dragged across the entire board, a7 → d1.'} },
  { game:true, hero:'Steinitz', opening:'Italian Game', theme:'Attack', era:'Classical (early 1900s)',
    variation:'Steinitz–von Bardeleben · 1895', you:'w', result:'1–0', white:'Steinitz', black:'von Bardeleben',
    idea:'Steinitz vs von Bardeleben, Hastings 1895 — a storied attack where every white piece hangs yet the black king cannot escape.',
    moves:['e4','e5','Nf3','Nc6','Bc4','Bc5','c3','Nf6','d4','exd4','cxd4','Bb4+','Nc3','d5','exd5','Nxd5','O-O','Be6','Bg5','Be7','Bxd5','Bxd5','Nxd5','Qxd5','Bxe7','Nxe7','Re1','f6','Qe2','Qd7','Rac1','c6','d5','cxd5','Nd4','Kf7','Ne6','Rhc8','Qg4','g6','Ng5+','Ke8','Rxe7+','Kf8','Rf7+','Kg8','Rg7+','Kh8','Rxh7+'],
    notes:{36:'19.Ne6! The knight lands in the heart of Black’s position and the attack ignites.',42:'22.Rxe7+!! Every white piece hangs, yet the king is trapped.',48:'25.Rxh7+! forcing mate. Von Bardeleben famously walked out rather than resign.'} },
  { game:true, hero:'Réti', opening:'Réti Opening', theme:'Positional', era:'Classical (early 1900s)',
    variation:'Réti–Bogoljubov · 1924', you:'w', result:'1–0', white:'Réti', black:'Bogoljubov',
    idea:'Réti vs Bogoljubov, New York 1924 — a hypermodern masterpiece that ends with the famously quiet 25.Be8.',
    moves:['Nf3','d5','c4','e6','g3','Nf6','Bg2','Bd6','O-O','O-O','b3','Re8','Bb2','Nbd7','d4','c6','Nbd2','Ne4','Nxe4','dxe4','Ne5','f5','f3','exf3','Bxf3','Qc7','Nxd7','Bxd7','e4','e5','c5','Bf8','Qc2','exd4','exf5','Rad8','Bh5','Re5','Bxd4','Rxf5','Rxf5','Bxf5','Qxf5','Rxd4','Rf1','Rd8','Bf7+','Kh8','Be8'],
    notes:{46:'23.Bf7+! nudging the king to h8 for the killer.',48:'25.Be8! The bishop calmly cuts the board in two; Black is helpless. A famous quiet finish.'} },
];

export const OPENING_IDX = BOOK.map((_, i) => i).filter((i) => !BOOK[i].game);
export const GAME_IDX = BOOK.map((_, i) => i).filter((i) => BOOK[i].game);
export const side = (l: BookLine) => (l.you === 'w' ? 'White' : 'Black');

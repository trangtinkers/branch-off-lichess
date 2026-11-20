// node test/test.mjs
import { Chess } from '../vendor/chess.js';
import { extract } from '../core.js';

const pgn = `[Event "My game: Chapter 1"]
[Result "*"]
[ChapterName "Chapter 1"]
[Orientation "black"]

{ Intro } 1. e4 e5 (1... c5 { Sicilian } 2. Nf3) 2. Nf3 Nc6 3. Bc4! { Italian [%cal Gc4f7] } (3. Bb5 a6 4. Ba4 (4. Bxc6 dxc6) 4... Nf6) 3... Bc5 $14 4. O-O Nf6 5. d4 (5. c3 d6) 5... exd4 6. e5 d5 7. exf6 dxc4 *`;

const c = (n) => String.fromCharCode(35 + n);
const sq = (s) => s.charCodeAt(0) - 97 + 8 * (Number(s[1]) - 1);
const id = (a, b) => c(sq(a)) + c(sq(b));
const path = [['e2','e4'],['e7','e5'],['g1','f3'],['b8','c6'],['f1','c4']].map(([a,b]) => id(a,b)).join('');

const out = extract(pgn, path, Chess);
console.log(out.pgn);
console.log(out.label, out.orientation);

// Round-trip: the result must load in chess.js and contain the branches.
new Chess().loadPgn(out.pgn);
for (const s of ['{ Italian [%cal Gc4f7] }', '3... Bc5 $14', '(5. c3 d6)', '4. O-O']) {
  if (!out.pgn.includes(s)) throw new Error('missing ' + s);
}
if (out.pgn.includes('Bb5') || out.pgn.includes('Sicilian')) throw new Error('kept moves from before the position');

// Castling path (king->g1) and fallback by DOM order
const castle = extract(pgn, path + id('f8','c5') + id('e1','g1'), Chess);
if (castle.label !== '4. O-O') throw new Error('castle path failed: ' + castle.label);
const fb = extract(pgn, 'zz', Chess, ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4!', 'Bc5', 'O-O']);
if (fb.label !== '4. O-O') throw new Error('fallback failed: ' + fb.label);
// Black move with variations
const blk = extract(pgn, id('e2','e4') + id('c7','c5'), Chess);
console.log(blk.pgn);
console.log('ALL OK');

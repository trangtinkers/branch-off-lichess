// Paths and PGN captured from a real public Lichess study
// plus castling ids captured from the Lichess analysis board.
import { Chess } from '../vendor/chess.js';
import { extract } from '../core.js';

const pgn = `[Event "ENDGAME GUIDE: ROOK + PAWN VS ROOK: The Advanced Long Side (PART 2)"]
[Result "*"]
[Variant "Standard"]
[ChapterName "Rook endgame"]
[ChapterURL "https://lichess.org/study/AAAAAAAA/BBBBBBBB"]
[FEN "r7/3RK1k1/4P3/8/8/8/8/8 b - - 0 1"]
[SetUp "1"]
[Orientation "black"]

{ Intro comment } 1... Kg6 { Waiting move. } (1... Ra6?? { Blunder! } 2. Ke8+ Kf6 3. e7 { The point! } 3... Ke6 4. Kf8 Kxd7 5. e8=Q+ { Queen vs Rook is winning. }) (1... Ra5 { This draws, too. } 2. Ke8+ Kf6 3. e7 Ke6 { Now you move your king here. } 4. Rd1 { White wants to check } { [%cal Gd1e1] } (4. Kf8 Rf5+! { The point! } 5. Ke8 Ra5 6. Kd8 Ra8+ 7. Kc7 { Draw. }) 4... Ra8+ { NOPE! } 5. Rd8 Ra7 { Only move. }) 2. Rd6 { But YOU MUST play Kg7 back. } { [%cal Gg6g7] } 2... Kg7 (2... Ra7+?? { Nope! } 3. Ke8 Ra8+ 4. Rd8 { Extra tempo. } 4... Ra7 5. e7 Kf6 6. Rd6+ { Not in time. }) 3. Rd8 { Now you can check. } { [%cal Ga8a7] } 3... Ra7+ 4. Ke8 { We draw } 4... Kf6 5. Rd6 Re7+ 6. Kd8 Rxe6 $10 *
`;

// every <move p> on the page (path -> SAN), as captured from Lichess
const DOM_ALL = [["YQ","Kg6"],["[K","Ra6"],["[KW_","Ke8+"],["[KW_YP","Kf6"],["[KW_YPOW","e7"],["[KW_YPOWPO","Ke6"],["[KW_YPOWPO_`","Kf8"],["[KW_YPOWPO_`OV","Kxd7"],["[KW_YPOWPO_`OVWg","e8=Q+"],["[C","Ra5"],["[CW_","Ke8+"],["[CW_YP","Kf6"],["[CW_YPOW","e7"],["[CW_YPOWPO","Ke6"],["[CW_YPOWPOV&","Rd1"],["[CW_YPOWPO_`","Kf8"],["[CW_YPOWPO_`CH","Rf5+"],["YQVN","Rd6"],["YQVNQY","Kg7"],["YQVN[S","Ra7+"],["YQVNQYN^","Rd8"],["YQVNQYN^[S","Ra7+"],["YQVNQYN^[SW_","Ke8"],["YQVNQYN^[SW_YP","Kf6"],["YQVNQYN^[SW_YP^N","Rd6"],["YQVNQYN^[SW_YP^NSW","Re7+"],["YQVNQYN^[SW_YP^NSW_^","Kd8"],["YQVNQYN^[SW_YP^NSW_^WO","Rxe6"]];

// [domOrder, path, san] exactly as rendered by Lichess
const dom = [
  [0, 'YQ', 'Kg6'], [1, '[K', 'Ra6'], [4, '[KW_YPOW', 'e7'], [8, '[KW_YPOWPO_`OVWg', 'e8=Q+'],
  [9, '[C', 'Ra5'], [14, '[CW_YPOWPOV&', 'Rd1'], [18, '[CW_YPOWPO_`', 'Kf8'], [19, '[CW_YPOWPO_`CH', 'Rf5+'],
  [25, 'YQVN', 'Rd6'], [26, 'YQVNQY', 'Kg7'], [27, 'YQVN[S', 'Ra7+'], [42, 'YQVNQYN^[SW_YP^NSW_^WO', 'Rxe6'],
];
const sanAt = Object.fromEntries(DOM_ALL.map(([p, san]) => [p, san]));
for (const [order, path, san] of dom) {
  const out = extract(pgn, path, Chess);
  if (out.label.split(' ')[1] !== san) throw new Error(`path ${path}: got ${out.label}, want ${san}`);
  // SAN fallback: rebuild the SAN line from the path prefixes, as content.js does
  const sans = [];
  for (let i = 2; i <= path.length; i += 2) sans.push(sanAt[path.slice(0, i)]);
  const bySan = extract(pgn, 'zz', Chess, sans);
  if (bySan.label !== out.label) throw new Error(`san fallback ${path}: got ${bySan.label}`);
  new Chess().loadPgn(out.pgn.replace(/\}\s*\{/g, " ")); // valid PGN (chess.js dislikes back-to-back comments)
}

// After 4. Rd1 the sibling (4. Kf8 ...) branches *before* the position, so it must be dropped.
const rd1 = extract(pgn, '[CW_YPOWPOV&', Chess).pgn;
if (!rd1.includes('{ White wants to check } { [%cal Gd1e1] } 4... Ra8+ { NOPE! } 5. Rd8')) throw new Error('rd1 body');
if (rd1.includes('Kf8')) throw new Error('kept a variation from before the position');
// After 3... Ke6 both 4. Rd1 and the (4. Kf8 ...) branch follow the position, so both stay.
const ke6 = extract(pgn, '[CW_YPOWPO', Chess).pgn;
console.log(ke6);
if (!ke6.includes('(4. Kf8 Rf5+! { The point! } 5. Ke8')) throw new Error('missing nested variation');

// Castling ids exactly as Lichess renders them (king -> rook square)
const castles = `1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. O-O Nf6 5. d3 d6 6. Nc3 Bg4 7. h3 Bh5 8. g4 Bg6 9. Bg5 Qd7 10. Kh2 O-O-O *`;
const p = "/?WG)8\\M(=`E'*";
if (extract(castles, p, Chess).label !== '4. O-O') throw new Error('white castling id');
const p2 = p + "aP.6VN$5]A2:AJ1AJQ%I^V)2_[";
if (extract(castles, p2, Chess).label !== '10... O-O-O') throw new Error('black castling id');
console.log('REAL DATA OK');

// Pure logic: parse a Lichess chapter PGN, find the node the user right-clicked,
// and rebuild a PGN that starts from the position after that move, keeping
// every later variation, comment and annotation.

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// ---------- parsing ----------

function splitHeaders(text) {
  const headers = {};
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let i = 0;
  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const m = line.match(/^\[(\w+)\s+"((?:[^"\\]|\\.)*)"\]$/);
    if (!m) break;
    headers[m[1]] = m[2].replace(/\\(.)/g, '$1');
  }
  return { headers, movetext: lines.slice(i).join('\n') };
}

const TOKEN = new RegExp(
  [
    '\\{([^}]*)\\}', // 1 comment
    ';([^\\n]*)', // 2 line comment
    '(\\()', // 3
    '(\\))', // 4
    '(\\$\\d+)', // 5 NAG
    '(1-0|0-1|1/2-1/2|\\*)', // 6 result
    '\\d+\\s*\\.+', // move number (ignored)
    '([A-Za-z][A-Za-z0-9+#=\\-]*)([!?]{1,2})?', // 7 SAN, 8 suffix glyph
    '\\s+',
    '(.)', // 9 anything else
  ].join('|'),
  'gy',
);

export function parsePgn(text) {
  const { headers, movetext } = splitHeaders(text);
  const root = { san: null, children: [], comments: [], pre: [], nags: [], parent: null };
  let cur = root;
  let last = null; // last move node added on the current line
  const stack = [];
  let pendingPre = [];
  TOKEN.lastIndex = 0;
  let m;
  while ((m = TOKEN.exec(movetext))) {
    if (m[1] !== undefined || m[2] !== undefined) {
      const c = (m[1] ?? m[2]).trim();
      if (!c) continue;
      if (last) last.comments.push(c);
      else if (cur === root && !stack.length) root.comments.push(c);
      else pendingPre.push(c);
    } else if (m[3]) {
      stack.push({ cur, last });
      // a variation is an alternative to `last`, so it hangs off last's parent
      cur = last ? last.parent : cur;
      last = null;
    } else if (m[4]) {
      if (!stack.length) continue;
      ({ cur, last } = stack.pop());
    } else if (m[5]) {
      if (last) last.nags.push(m[5]);
    } else if (m[6]) {
      if (!stack.length) break;
    } else if (m[7]) {
      if (/^(Z0|null)$/.test(m[7])) throw new Error('Null moves are not supported');
      const node = {
        san: m[7],
        suffix: m[8] || '',
        nags: [],
        comments: [],
        pre: pendingPre,
        children: [],
        parent: cur,
      };
      pendingPre = [];
      cur.children.push(node);
      cur = node;
      last = node;
    } else if (m[9]) {
      // ignore stray characters
    }
  }
  return { headers, root };
}

// ---------- replay ----------

const sq = (s) => s.charCodeAt(0) - 97 + 8 * (Number(s[1]) - 1);
const ch = (n) => String.fromCharCode(35 + n);

// Lichess node ids (scalachess UciCharPair): two chars, origin square and
// destination square shifted by 35; promotions use a separate char range.
function idsFor(mv) {
  const from = ch(sq(mv.from));
  if (mv.promotion) {
    const role = 'qrbnk'.indexOf(mv.promotion);
    const file = mv.to.charCodeAt(0) - 97;
    return [from + String.fromCharCode(35 + 64 + role * 8 + file)];
  }
  const ids = [from + ch(sq(mv.to))];
  // castling may be encoded king->target or king->rook; accept both
  if (mv.flags.includes('k')) ids.push(from + ch(sq('h' + mv.from[1])));
  if (mv.flags.includes('q')) ids.push(from + ch(sq('a' + mv.from[1])));
  return ids;
}

function annotate(root, Chess) {
  const todo = [root];
  while (todo.length) {
    const node = todo.pop();
    const moveNumber = Number(node.fen.split(' ')[5]) || 1;
    for (const c of node.children) {
      const chess = new Chess(node.fen);
      let mv;
      try {
        mv = chess.move(c.san, { strict: false });
      } catch {
        throw new Error(`Could not replay move "${c.san}" (move ${moveNumber}). Is this a non-standard variant?`);
      }
      c.fen = chess.fen();
      c.color = mv.color;
      c.moveNumber = moveNumber;
      c.ids = idsFor(mv);
      todo.push(c);
    }
  }
}

export function findByPath(root, path) {
  let node = root;
  for (let i = 0; i < path.length; i += 2) {
    const id = path.slice(i, i + 2);
    node = node.children.find((c) => c.ids.includes(id));
    if (!node) return null;
  }
  return node === root ? null : node;
}

const cleanSan = (s) => (s || '').replace(/[!?]+$/, '');

// Walk the tree by the SAN of every move from the root to the clicked move.
function findBySans(root, sans) {
  let node = root;
  for (const san of sans) {
    node = node.children.find((c) => cleanSan(c.san) === cleanSan(san));
    if (!node) return null;
  }
  return node === root ? null : node;
}

// ---------- writing ----------

function moveText(n, forceNumber) {
  const parts = n.pre.map((c) => `{ ${c} }`);
  if (n.color === 'w') parts.push(`${n.moveNumber}. ${n.san}${n.suffix}`);
  else if (forceNumber || n.pre.length) parts.push(`${n.moveNumber}... ${n.san}${n.suffix}`);
  else parts.push(n.san + n.suffix);
  parts.push(...n.nags);
  parts.push(...n.comments.map((c) => `{ ${c} }`));
  return parts.join(' ');
}

// Write everything that follows `parent` (its main line plus all branches).
function continuation(parent, forceNumber) {
  const out = [];
  let cur = parent;
  let force = forceNumber;
  while (cur.children.length) {
    const [main, ...alts] = cur.children;
    out.push(moveText(main, force));
    for (const a of alts) {
      out.push('(' + [moveText(a, true), ...continuation(a, a.comments.length > 0)].join(' ') + ')');
    }
    force = alts.length > 0 || main.comments.length > 0;
    cur = main;
  }
  return out;
}

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/**
 * @param {string} pgnText  chapter PGN as exported by Lichess
 * @param {string} path     Lichess node path of the clicked move (`p` attribute)
 * @param {Function} Chess  chess.js Chess class
 * @param {string[]} [sans]  SAN of each move from the root to the clicked move, used if the path can't be matched
 */
export function extract(pgnText, path, Chess, sans) {
  const { headers, root } = parsePgn(pgnText);
  const variant = headers.Variant || 'Standard';
  if (!/^(Standard|From Position)$/i.test(variant)) {
    throw new Error(`Variant "${variant}" is not supported (standard chess only).`);
  }
  root.fen = headers.FEN || START_FEN;
  annotate(root, Chess);

  let target = path ? findByPath(root, path) : null;
  if (!target && sans && sans.length) target = findBySans(root, sans);
  if (!target) {
    throw new Error(
      'Could not find that move in the saved chapter. If you added moves locally without saving them to the study, they are not in the exported PGN.',
    );
  }

  const label = `${target.moveNumber}${target.color === 'w' ? '.' : '...'} ${target.san}`;
  const baseName = headers.ChapterName || headers.Event || 'Study';
  const tags = [
    ['Event', `${baseName} (after ${label})`],
    ['Site', headers.ChapterURL || headers.Site || ''],
    ['Annotator', headers.Annotator || ''],
    ['Result', '*'],
    ['SetUp', '1'],
    ['FEN', target.fen],
  ].filter(([, v]) => v);

  const body = [
    ...target.comments.map((c) => `{ ${c} }`),
    ...continuation(target, target.comments.length > 0),
    '*',
  ].join(' ');

  return {
    pgn: tags.map(([k, v]) => `[${k} "${esc(v)}"]`).join('\n') + '\n\n' + body + '\n',
    fen: target.fen,
    label,
    orientation: /^black$/i.test(headers.Orientation || '') ? 'black' : 'white',
  };
}

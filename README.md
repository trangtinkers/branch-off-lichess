# Branch Off for Lichess

Right-click any move in a Lichess study and choose:

- **➜ Continue in new study**: opens a new tab with a new study whose chapter starts from the position *after* that move.
- **➜ Continue in a study…**: opens Lichess's "new study or existing study" picker, so you can add the position as a chapter to a study you already have.

Everything that follows the move comes along: the main line, every variation and sub-variation, comments, arrows and circles (`[%cal]`/`[%csl]`), and move glyphs (`!`, `?!`, `$14`…). The move's own comment becomes the new chapter's opening comment. Lines that branched off *before* the chosen position are left out, since they don't start from it.

## Install (Chrome, Edge, Brave, Arc)

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose this `branch-off-lichess` folder.
4. Reload any open Lichess study tab.

## How it works

1. The extension records which move you right-clicked (Lichess stores each move's tree path in its `p` attribute) and adds two items to Lichess's own move menu.
2. When you pick one, it downloads the chapter's PGN from `lichess.org/study/<study>/<chapter>.pgn` using your normal Lichess login.
3. `core.js` parses the PGN, replays it with [chess.js](https://github.com/jhlywa/chess.js) (bundled in `vendor/`, BSD-2 licence) to find the clicked move and its FEN, and writes a new PGN with `[SetUp "1"]` and `[FEN "…"]` that keeps only what follows.
4. It posts that PGN to `/study` or `/study/as`, the same endpoints the analysis board's **Study** button uses.

No data goes anywhere except lichess.org, and the extension requests no special permissions.

## Limitations

- **Standard chess only.** Chess960 and other variants show an error.
- **Saved moves only.** Moves you've played locally but that aren't saved to the study (for example in someone else's study) aren't in the exported PGN, so you'll get an error.
- **Desktop right-click only.** On touch devices, Lichess opens this menu with a long-press, which the extension doesn't hook.
- **It depends on Lichess's page structure** (`#analyse-cm`, `<move p="…">`, `.tview2`). If Lichess redesigns the move list, the menu items may stop appearing.

## Tests

```bash
node test/test.mjs && node test/real.mjs
```

`test/real.mjs` uses move paths and a PGN captured from a real public Lichess study, plus castling paths from the Lichess analysis board.

## License

MIT (see `LICENSE`). The bundled `vendor/chess.js` is © Jeff Hlywa, BSD-2-Clause (see `vendor/chess.js.LICENSE`).

Not affiliated with lichess.org.

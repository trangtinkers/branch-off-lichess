// Adds two items to Lichess's own right-click menu on study moves:
//   "Continue in new study"  -> creates a new study starting after that move
//   "Continue in a study…"    -> lets you pick a new or an existing study
(() => {
  const ITEM_CLASS = 'lcis-item';
  let clicked = null; // { path, order, san }

  // Capture phase runs before Lichess's own handler, which builds #analyse-cm.
  document.addEventListener(
    'contextmenu',
    (e) => {
      const move = e.target instanceof Element ? e.target.closest('move[p]') : null;
      const tree = move && move.closest('.tview2');
      if (!move || !tree) return;
      const path = move.getAttribute('p');
      // SAN of every ancestor (each path prefix is its own <move>), as a fallback
      const sans = [];
      for (let i = 2; i <= path.length; i += 2) {
        const el = Array.from(tree.querySelectorAll('move[p]')).find((m) => m.getAttribute('p') === path.slice(0, i));
        sans.push(el?.querySelector('san')?.textContent.trim() || '');
      }
      clicked = { path, sans };
      setTimeout(inject, 0);
    },
    true,
  );

  function inject() {
    const menu = document.getElementById('analyse-cm');
    if (!menu || !clicked || menu.querySelector('.' + ITEM_CLASS)) return;
    menu.append(
      item('➜ Continue in new study', '/study'),
      item('➜ Continue in a study…', '/study/as'),
    );
  }

  function item(text, action) {
    const a = document.createElement('a');
    a.className = ITEM_CLASS;
    a.textContent = text;
    a.style.cursor = 'pointer';
    a.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      document.getElementById('analyse-cm')?.classList.remove('visible');
      // Open the tab now, while we still have the user's click, then fill it.
      const name = 'lcis-' + Date.now();
      const win = window.open('about:blank', name);
      run(clicked, action, win, name);
    });
    return a;
  }

  // Lichess re-renders the menu on every open; re-add our items if needed.
  new MutationObserver(() => {
    const menu = document.getElementById('analyse-cm');
    if (menu && menu.classList.contains('visible')) inject();
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  function ids() {
    const m = location.pathname.match(/^\/study\/(\w{8})(?:\/(\w{8}))?/);
    if (!m) return null;
    const chapter =
      m[2] ||
      document.querySelector('.study__chapters .active[data-id]')?.getAttribute('data-id') ||
      document.querySelector('.study__chapters [data-id].active')?.getAttribute('data-id');
    return chapter ? { study: m[1], chapter } : null;
  }

  async function run(target, action, win, winName) {
    try {
      const id = ids();
      if (!id) throw new Error('Could not tell which chapter is open. Open the chapter so its ID shows in the address bar, then try again.');
      const res = await fetch(`/study/${id.study}/${id.chapter}.pgn?clocks=false`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`Lichess returned ${res.status} when exporting the chapter PGN.`);
      const pgnText = await res.text();

      const [{ extract }, { Chess }] = await Promise.all([
        import(chrome.runtime.getURL('core.js')),
        import(chrome.runtime.getURL('vendor/chess.js')),
      ]);
      const out = extract(pgnText, target.path, Chess, target.sans);

      const form = document.createElement('form');
      form.method = 'post';
      form.action = action;
      form.target = win && !win.closed ? winName : '_blank';
      form.style.display = 'none';
      for (const [k, v] of Object.entries({
        pgn: out.pgn,
        fen: out.fen,
        orientation: out.orientation,
        variant: 'standard',
      })) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = k;
        input.value = v;
        form.append(input);
      }
      document.body.append(form);
      form.submit();
      form.remove();
    } catch (err) {
      if (win && !win.closed) win.close();
      console.error('[Branch Off]', err);
      alert('Branch Off: ' + (err && err.message ? err.message : err));
    }
  }
})();

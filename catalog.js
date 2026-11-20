// The app catalog as one component, so the gallery on GitHub Pages and TRMNL Apps Studio show the same place with
// the same content: tiles like trmnl.com's Plugins page (screen, name, one line), search, and a detail sheet.
//   mountCatalog(element, { indexURL, actions: (app, tappURL, closeSheet) => [{ label, href?, onClick?, primary? }],
//     tools?: [element] })   tools: the host's own buttons, next to the search field
// Each host decides the actions: the gallery offers the .tapp and its source, Studio opens, forks and installs.

const CSS = `
.tc { --tc-bg: #F2F0ED; --tc-tile: #FBFAF8; --tc-line: #DCDBD9; --tc-ink: #151515; --tc-muted: #5B5B5B;
  --tc-faint: #8F8F8F; --tc-accent: #F8654B; --tc-accent-ink: #B94938; --tc-paper: #E4E2DD;
  color: var(--tc-ink); font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; display: grid; gap: 22px; }
@media (prefers-color-scheme: dark) {
  .tc { --tc-bg: #151515; --tc-tile: #1C1C1C; --tc-line: #2E2E2E; --tc-ink: #E8E7E4; --tc-muted: #AAAAAA;
    --tc-faint: #7D7D7D; --tc-accent-ink: #FF9280; }
}
.tc-head { display: flex; flex-wrap: wrap; gap: 12px 24px; align-items: end; justify-content: space-between; }
.tc-head h1 { margin: 0; font: 600 30px/1.1 Literata, Georgia, "Times New Roman", serif; }
.tc-head p { margin: 4px 0 0; color: var(--tc-muted); font-size: 15px; }
.tc-tools { display: flex; gap: 8px; align-items: center; flex: 0 1 380px; min-width: 0; }
.tc-search { position: relative; flex: 1 1 auto; min-width: 160px; }
.tc-search input { width: 100%; box-sizing: border-box; height: 38px; padding: 0 12px 0 34px; border-radius: 999px;
  border: 1px solid var(--tc-line); background: var(--tc-tile); color: var(--tc-ink); font: inherit; }
.tc-search input:focus-visible { outline: 2px solid var(--tc-accent); outline-offset: 1px; }
.tc-search svg { position: absolute; left: 12px; top: 11px; width: 16px; height: 16px; color: var(--tc-faint); }
.tc-section { margin: 0; font-size: 17px; font-weight: 600; display: flex; gap: 8px; align-items: baseline; }
.tc-count { font-size: 13px; font-weight: 400; color: var(--tc-faint); }
.tc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 14px; }
.tc-tile { all: unset; box-sizing: border-box; cursor: pointer; background: var(--tc-tile); border: 1px solid var(--tc-line);
  border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 10px; transition: border-color .15s; }
.tc-tile:hover { border-color: var(--tc-faint); }
.tc-tile:focus-visible { outline: 2px solid var(--tc-accent); outline-offset: 2px; }
.tc-screen { aspect-ratio: 1872 / 1404; width: 100%; border-radius: 4px; background: var(--tc-paper); object-fit: cover;
  border: 5px solid #1B1B1B; box-sizing: border-box; }
/* no screenshot yet: an X screen with the app's name and the title bar every app has */
.tc-blank { display: grid; grid-template-rows: 1fr auto; overflow: hidden; color: #161616; container-type: inline-size; }
.tc-blank-name { align-self: center; padding: 0 8%; font: 600 9cqw/1.15 Literata, Georgia, serif; text-wrap: balance; }
.tc-blank-bar { background: #161616; color: #E4E2DD; font: 600 5cqw/1 -apple-system, BlinkMacSystemFont, sans-serif; padding: 2.6% 8%; }
.tc-name { font-weight: 600; font-size: 15px; display: flex; gap: 6px; align-items: baseline; }
.tc-summary { color: var(--tc-muted); font-size: 13px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.tc-badge { font-size: 11px; font-weight: 600; color: var(--tc-accent-ink); }
.tc-empty { color: var(--tc-muted); }
.tc-sheet { border: 1px solid var(--tc-line); border-radius: 16px; padding: 0; background: var(--tc-tile); color: var(--tc-ink);
  width: min(560px, calc(100vw - 32px)); }
.tc-sheet::backdrop { background: rgba(0, 0, 0, .45); }
.tc-sheet-body { padding: 20px; display: grid; gap: 14px; }
.tc-sheet h2 { margin: 0; font: 600 22px/1.2 Literata, Georgia, serif; }
.tc-sheet p { margin: 0; color: var(--tc-muted); }
.tc-facts { display: grid; grid-template-columns: auto 1fr; gap: 4px 16px; font-size: 13px; margin: 0; }
.tc-facts dt { color: var(--tc-faint); }
.tc-facts dd { margin: 0; overflow-wrap: anywhere; }
.tc-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.tc-actions a, .tc-actions button { all: unset; cursor: pointer; font-size: 13px; font-weight: 600; padding: 8px 14px;
  border-radius: 999px; border: 1px solid var(--tc-line); color: var(--tc-ink); }
.tc-actions .primary { background: var(--tc-ink); color: var(--tc-bg); border-color: var(--tc-ink); }
.tc-actions :focus-visible { outline: 2px solid var(--tc-accent); outline-offset: 2px; }
.tc-close { position: absolute; top: 12px; right: 12px; }
`;

function el(tag, props = {}, ...children) {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...children.filter((c) => c != null && c !== false));
  return e;
}

const SEARCH_ICON = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="7" cy="7" r="5"/><path d="m11 11 3.5 3.5"/></svg>';

/** The app's screen: its screenshot, or a blank e-ink panel with its initial. */
function screen(app, base, large = false) {
  if (app.screenshot) return el('img', { className: 'tc-screen', src: new URL(app.screenshot, base).href, alt: `${app.name} on a TRMNL X`, loading: large ? 'eager' : 'lazy' });
  return el('div', { className: 'tc-screen tc-blank', role: 'img', ariaLabel: `${app.name}, no screenshot yet` },
    el('div', { className: 'tc-blank-name', textContent: app.name }), el('div', { className: 'tc-blank-bar', textContent: app.name }));
}

function action({ label, href, onClick, primary }) {
  const a = href ? el('a', { href, textContent: label, rel: 'noopener' }) : el('button', { type: 'button', textContent: label });
  if (primary) a.className = 'primary';
  if (onClick) a.addEventListener('click', onClick);
  return a;
}

export async function mountCatalog(root, { indexURL, actions, tools = [], title = 'Apps', subtitle = 'What will your TRMNL run?' }) {
  if (!document.getElementById('tc-style')) document.head.append(el('style', { id: 'tc-style', textContent: CSS }));
  const base = new URL('.', new URL(indexURL, location.href)).href;
  const search = el('input', { type: 'search', placeholder: 'Search apps', ariaLabel: 'Search apps' });
  const searchBox = el('label', { className: 'tc-search' }, search);
  searchBox.insertAdjacentHTML('afterbegin', SEARCH_ICON);
  const grid = el('div', { className: 'tc-grid' });
  const status = el('p', { className: 'tc-empty', textContent: 'Loading apps…' });
  const count = el('span', { className: 'tc-count' });
  const sheet = el('dialog', { className: 'tc-sheet' });
  root.replaceChildren(el('div', { className: 'tc' },
    el('div', { className: 'tc-head' }, el('div', {}, el('h1', { textContent: title }), el('p', { textContent: subtitle })),
      el('div', { className: 'tc-tools' }, searchBox, ...tools)),
    el('h2', { className: 'tc-section' }, 'Community apps', count), status, grid, sheet));

  let index;
  try {
    const r = await fetch(indexURL, { cache: 'no-cache' });
    if (!r.ok) throw new Error(String(r.status));
    index = await r.json();
  } catch {
    status.textContent = 'The catalog could not be loaded. Check your connection and try again.';
    return;
  }
  const byId = new Map(index.apps.map((a) => [a.id, a]));
  const tappURL = (a) => new URL(a.tapp, base).href;

  const open = (a) => {
    const origin = a.forked_from && (byId.get(a.forked_from.id)?.name ?? a.forked_from.id);
    const facts = [
      ['Version', a.versions.length > 1 ? `${a.version} (${a.versions.length} versions)` : a.version],
      ['Author', a.author], ['License', a.license], ['Size', `${(a.size / 1024).toFixed(1)} KB`],
      ['Source', a.has_source ? 'included, can be forked' : 'not included'],
      origin && ['Forked from', `${origin} ${a.forked_from.version}`],
    ].filter(Boolean);
    const close = el('button', { type: 'button', className: 'tc-close', textContent: 'Close' });
    close.addEventListener('click', () => sheet.close());
    sheet.replaceChildren(el('div', { className: 'tc-sheet-body' },
      screen(a, base, true),
      el('h2', { textContent: a.name }),
      el('p', { textContent: a.summary }),
      el('dl', { className: 'tc-facts' }, ...facts.flatMap(([k, v]) => [el('dt', { textContent: k }), el('dd', { textContent: v })])),
      el('div', { className: 'tc-actions' }, ...actions(a, tappURL(a), () => sheet.close()).map(action), close)));
    sheet.showModal();
  };

  const render = () => {
    const q = search.value.trim().toLowerCase();
    const shown = index.apps.filter((a) => !q || `${a.name} ${a.summary} ${a.author}`.toLowerCase().includes(q));
    status.textContent = shown.length ? '' : q ? `No apps match “${search.value.trim()}”.` : 'No apps yet.';
    status.hidden = !status.textContent;
    count.textContent = q ? `${shown.length} of ${index.apps.length}` : String(index.apps.length);
    grid.replaceChildren(...shown.map((a) => {
      const tile = el('button', { type: 'button', className: 'tc-tile', ariaLabel: `${a.name}: ${a.summary}` },
        screen(a, base),
        el('div', {}, el('div', { className: 'tc-name' }, a.name, a.forked_from ? el('span', { className: 'tc-badge', textContent: 'Fork' }) : null),
          el('div', { className: 'tc-summary', textContent: a.summary })));
      tile.addEventListener('click', () => open(a));
      return tile;
    }));
  };
  search.addEventListener('input', render);
  render();
  return { index, open: (id) => byId.has(id) && open(byId.get(id)) };
}

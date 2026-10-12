const $ = (s, r = document) => r.querySelector(s);

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

/** Button/link whose label rolls to a second copy on hover. */
function rollBtn(label, cls, props = {}) {
  const b = h('button', { class: `${cls} roll-host`, ...props });
  b.append(K.roll(label));
  return b;
}

const MAIN_VERSIONS = [
  { id: '1.8.9', label: '1.8', loader: 'vanilla' },
  { id: '1.21.11', label: '1.21.11', loader: 'fabric' },
  { id: '26.1', label: '26.1', loader: 'fabric' },
  { id: '26.2', label: '26.2', loader: 'fabric' },
];

const PAGES = [
  { id: 'play', label: 'Play' },
  { id: 'mods', label: 'Mods' },
  { id: 'library', label: 'Library' },
  { id: 'settings', label: 'Settings' },
];

const S = {
  st: null,
  page: 'play',
  titleChars: [],
  launch: { active: false, status: '', pct: 0, type: '', log: [], error: '' },
  imp: { parts: { mods: true, config: true, settings: true, resourcepacks: true, shaderpacks: true, saves: false }, sources: null, msg: '' },
  mods: { q: '', source: 'modrinth', sort: 'relevance', tab: 'search', results: null, total: 0, loading: false, busy: {}, done: {} },
  releases: null,
  token: 0,
};

// ---------------------------------------------------------------- shell

function selectedInstance() {
  return S.st.instances.find(i => i.id === S.st.selected) || null;
}

function buildRail() {
  const rail = $('#rail');
  rail.textContent = '';
  for (const p of PAGES) {
    const b = h('button', { class: 'nav roll-host' + (p.id === S.page ? ' on' : ''), 'data-id': p.id, onclick: () => go(p.id) });
    b.append(K.roll(p.label));
    rail.append(b);
  }
  const foot = h('div', { class: 'rail-foot' },
    h('div', {}, 'SIGNED IN AS'),
    h('b', {}, S.st.username.toUpperCase()),
    h('div', {}, S.st.microsoft ? 'MICROSOFT' : 'OFFLINE'));
  rail.append(foot);
}

async function setTitle(text) {
  const el = $('#title');
  const old = S.titleChars;
  await K.exit(old);
  const chars = K.split(el, text);
  chars.forEach((c, i) => { if (i % 5 === 3) c.classList.add('alt'); });
  S.titleChars = chars;
  K.enter(chars);
}

async function go(id) {
  if (S.launch.active && id === S.page) return;
  const token = ++S.token;
  S.page = id;
  document.querySelectorAll('.nav').forEach(n => n.classList.toggle('on', n.dataset.id === id));
  const page = $('#page');
  const label = PAGES.find(p => p.id === id).label;
  await Promise.all([
    setTitle(label),
    K.exit([...page.children]).then(() => {}),
  ]);
  if (token !== S.token) return;
  page.textContent = '';
  PAGE_RENDER[id](page);
  if (!K.reduce) {
    gsap.from([...page.children], { y: 36, opacity: 0, duration: 0.7, stagger: 0.07, ease: 'expo.out', clearProps: 'all' });
  }
}

async function refresh(patchState) {
  S.st = patchState || await starburst.state();
  buildRail();
}

// ---------------------------------------------------------------- play

let counter = null;

function renderPlay(page) {
  const inst = selectedInstance();
  if (!inst) {
    page.append(h('p', { class: 'empty' }, 'No instances yet. Make one in the Library.'));
    return;
  }
  const mods = S.modCount === undefined ? '' : S.modCount;
  const left = h('div', {},
    h('div', { class: 'label' }, 'Selected instance'),
    h('div', { class: 'inst-name' }, inst.name),
    h('div', { class: 'inst-meta' },
      h('span', {}, 'MINECRAFT ', h('b', {}, inst.mc)),
      h('span', {}, h('b', {}, inst.loader.toUpperCase())),
      h('span', { id: 'modcount' }, mods ? `${mods} MODS` : '')),
    h('div', { class: 'switcher' },
      S.st.instances.map(i => h('button', {
        class: 'chip' + (i.id === inst.id ? ' on' : ''),
        onclick: async () => { await refresh(await starburst.selectInstance(i.id)); go('play'); },
      }, i.name))),
  );

  const right = h('div', { class: 'card' });
  const play = rollBtn('PLAY', 'big-btn', { id: 'playBtn' });
  play.append(h('span', { class: 'sub' }, `${inst.mc} / ${inst.loader.toUpperCase()}`));
  play.disabled = S.launch.active;
  play.addEventListener('click', startLaunch);
  play.addEventListener('mouseenter', () => !K.reduce && gsap.to(play, { scaleY: 0.94, scaleX: 1.015, duration: 0.18, ease: 'power2.out' }));
  play.addEventListener('mouseleave', () => !K.reduce && gsap.to(play, { scaleY: 1, scaleX: 1, duration: 0.6, ease: 'elastic.out(1.2,0.35)' }));

  const statWrap = h('div', { style: 'margin-top:28px' },
    h('div', { class: 'label', id: 'statusLbl' }, S.launch.status || 'Ready'),
    h('div', { class: 'stat' }, h('span', { id: 'digits' }), h('span', { class: 'pct' }, '%')),
    h('div', { class: 'bar-track' }, h('div', { class: 'bar-fill2', id: 'barFill' })),
    h('div', { class: 'err', id: 'launchErr' }, S.launch.error),
    h('div', { class: 'log', id: 'logBox' }, S.launch.log.slice(-9).join('\n')));
  right.append(play, statWrap);

  page.append(h('div', { class: 'play' }, left, right));
  counter = K.counter($('#digits'), 3);
  counter.set(S.launch.pct);
  $('#barFill').style.width = S.launch.pct + '%';

  starburst.mods(inst.id).then(m => {
    S.modCount = m.filter(x => x.enabled).length;
    const el = $('#modcount');
    if (el) el.textContent = `${S.modCount} MODS`;
  });
}

async function startLaunch() {
  const inst = selectedInstance();
  if (!inst || S.launch.active) return;
  S.launch = { active: true, status: 'Preparing', pct: 0, type: '', log: [], error: '' };
  renderLaunch();
  try { await starburst.launch(inst.id); }
  catch (e) { failLaunch(e.message); }
}

function failLaunch(msg) {
  S.launch.active = false;
  S.launch.error = msg;
  S.launch.status = 'Failed';
  renderLaunch();
}

function renderLaunch() {
  if (S.page !== 'play') return;
  const btn = $('#playBtn');
  if (!btn) return;
  btn.disabled = S.launch.active;
  $('#statusLbl').textContent = (S.launch.status + (S.launch.type ? ` / ${S.launch.type}` : '')).toUpperCase();
  counter.set(S.launch.pct);
  gsap.to('#barFill', { width: S.launch.pct + '%', duration: 0.4, ease: 'power2.out' });
  $('#launchErr').textContent = S.launch.error;
  const log = $('#logBox');
  log.textContent = S.launch.log.slice(-9).join('\n');
}

starburst.on('status', s => {
  S.launch.status = s;
  if (s === 'Playing') S.launch.pct = 100;
  renderLaunch();
});
starburst.on('progress', p => {
  if (p.total) S.launch.pct = Math.min(99, Math.round((p.task / p.total) * 100));
  S.launch.type = p.type || '';
  renderLaunch();
});
starburst.on('log', l => { S.launch.log.push(String(l).slice(0, 220)); renderLaunch(); });
starburst.on('error', m => failLaunch(m));
starburst.on('closed', code => {
  S.launch.active = false;
  S.launch.status = code === 0 || code === null ? 'Closed' : `Exited (${code})`;
  S.launch.pct = 0;
  S.launch.type = '';
  renderLaunch();
});

// ---------------------------------------------------------------- mods

let searchTimer = null;

function renderMods(page) {
  const inst = selectedInstance();
  if (!inst) { page.append(h('p', { class: 'empty' }, 'Create an instance in the Library first.')); return; }
  const M = S.mods;
  if (inst.loader !== 'fabric') {
    page.append(
      h('p', { class: 'empty' }, inst.mc + ' has no Fabric, so no Modrinth mods. Pick a Fabric instance:'),
      h('select', { class: 'inp', onchange: async (e) => { await refresh(await starburst.selectInstance(e.target.value)); go('mods'); } },
        S.st.instances.map(i => h('option', { value: i.id, selected: i.id === inst.id }, i.name + ' (' + i.mc + ')'))));
    return;
  }

  const q = h('input', { class: 'q', placeholder: 'SEARCH MODRINTH', value: M.q, spellcheck: 'false', 'aria-label': 'Search mods' });
  q.addEventListener('input', () => {
    M.q = q.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => runSearch(), 320);
  });

  const target = h('select', { class: 'inp', 'aria-label': 'Target instance', onchange: async (e) => {
    await refresh(await starburst.selectInstance(e.target.value));
    M.results = null; M.done = {}; go('mods');
  } }, S.st.instances.map(i => h('option', { value: i.id, selected: i.id === inst.id }, `${i.name} (${i.mc})`)));

  const sorts = ['relevance', 'downloads', 'follows', 'newest', 'updated'];
  const tabs = h('div', { class: 'tabs' },
    ['search', 'installed'].map(t => h('button', { class: 'chip' + (M.tab === t ? ' on' : ''), onclick: () => { M.tab = t; go('mods'); } }, t.toUpperCase())),
    h('span', { class: 'grow' }),
    M.tab === 'search' ? ['modrinth', 'curseforge'].map(src => h('button', {
      class: 'chip' + (M.source === src ? ' on' : ''),
      onclick: () => { M.source = src; M.results = null; M.done = {}; go('mods'); },
    }, src)) : null,
    M.tab === 'search' ? sorts.map(s => h('button', { class: 'chip' + (M.sort === s ? ' on' : ''), onclick: () => { M.sort = s; runSearch(); markSort(); } }, s)) : null,
    target);

  page.append(h('div', { class: 'search-row' }, q), tabs, h('div', { id: 'results' }));
  if (M.tab === 'installed') renderInstalled(inst);
  else if (M.results) paintResults(); else runSearch();

  function markSort() {
    const idx = sorts.indexOf(M.sort);
    page.querySelectorAll('.tabs .chip').forEach((c, i) => { if (i >= 4 && i < 4 + sorts.length) c.classList.toggle('on', i - 4 === idx); });
  }
}

async function runSearch() {
  const inst = selectedInstance();
  const M = S.mods;
  if (!inst || M.tab !== 'search') return;
  M.loading = true;
  const box = $('#results');
  if (box && !M.results) box.replaceChildren(h('p', { class: 'empty' }, 'Searching...'));
  const stamp = (runSearch.n = (runSearch.n || 0) + 1);
  try {
    const r = await starburst.search({ query: M.q, index: M.sort, instance: inst.id, limit: 20, source: M.source });
    if (stamp !== runSearch.n) return;
    M.results = r.hits; M.total = r.total;
  } catch (e) {
    if (stamp !== runSearch.n) return;
    M.results = [];
    const b = $('#results');
    if (b) b.replaceChildren(h('p', { class: 'err' }, `Search failed: ${e.message}`));
    return;
  } finally { M.loading = false; }
  paintResults(true);
}

function fmt(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return Math.round(n / 1e3) + 'K';
  return String(n);
}

function paintResults(animate) {
  const box = $('#results');
  if (!box) return;
  const M = S.mods;
  const inst = selectedInstance();
  box.textContent = '';
  if (!M.results.length) { box.append(h('p', { class: 'empty' }, `Nothing for ${inst.mc} on Fabric.`)); return; }
  const rows = M.results.map(m => {
    const state = M.done[m.id];
    const btn = h('button', { class: 'btn' + (state ? ' done' : '') }, h('span', {}, state ? 'INSTALLED' : (M.busy[m.id] ? 'WORKING' : 'INSTALL')));
    btn.disabled = !!state || !!M.busy[m.id];
    btn.addEventListener('click', async () => {
      M.busy[m.id] = true; btn.disabled = true; btn.firstChild.textContent = 'WORKING';
      try {
        await starburst.install(inst.id, m.id, M.source);
        M.done[m.id] = true; btn.classList.add('done'); btn.firstChild.textContent = 'INSTALLED';
        if (!K.reduce) gsap.fromTo(btn, { scale: 1.15 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1,0.4)' });
      } catch (e) {
        btn.disabled = false; btn.firstChild.textContent = 'RETRY';
        const err = btn.closest('.row').querySelector('.ds');
        err.textContent = e.message; err.style.color = 'var(--yellow)';
      } finally { delete M.busy[m.id]; }
    });
    return h('div', { class: 'row' },
      h('img', { class: 'ic', src: m.icon || '', alt: '' }),
      h('div', {},
        h('div', {}, h('span', { class: 'nm' }, m.title), h('span', { class: 'by' }, 'BY ' + m.author.toUpperCase())),
        h('div', { class: 'ds' }, m.description),
        h('div', { class: 'tg' }, m.categories.slice(0, 4).map(c => h('span', {}, c)))),
      h('div', { class: 'act' }, btn, h('span', { class: 'dl' }, `${fmt(m.downloads)} DOWNLOADS`)));
  });
  box.append(...rows);
  if (animate && !K.reduce) gsap.from(rows, { y: 28, opacity: 0, duration: 0.55, stagger: 0.04, ease: 'expo.out', clearProps: 'all' });
}

async function renderInstalled(inst) {
  const box = $('#results');
  const mods = await starburst.mods(inst.id);
  box.textContent = '';
  if (!mods.length) { box.append(h('p', { class: 'empty' }, 'No mods installed.')); return; }
  for (const m of mods) {
    box.append(h('div', { class: 'mod-line' + (m.enabled ? '' : ' off') },
      h('span', { class: 'f' }, m.file.replace('.disabled', '')),
      h('span', { class: 'label' }, (m.size / 1048576).toFixed(1) + ' MB'),
      m.locked ? h('span', { class: 'label' }, 'PRELOADED') : [
        h('button', { class: 'btn ghost', onclick: async () => { await starburst.toggleMod(inst.id, m.file); renderInstalled(inst); } }, h('span', {}, m.enabled ? 'DISABLE' : 'ENABLE')),
        h('button', { class: 'btn ghost', onclick: async () => { await starburst.removeMod(inst.id, m.file); renderInstalled(inst); } }, h('span', {}, 'REMOVE')),
      ]));
  }
}

// ---------------------------------------------------------------- library

async function renderLibrary(page) {
  const list = h('div', {}, S.st.instances.length ? null : h('p', { class: 'empty' }, 'Nothing here yet.'));
  for (const i of S.st.instances) {
    list.append(h('div', { class: 'lib-row' },
      h('span', { class: 'nm' }, i.name),
      h('span', { class: 'mt' }, `${i.mc} / ${i.loader}`),
      h('button', { class: 'btn', onclick: async () => { await refresh(await starburst.selectInstance(i.id)); go('play'); } }, h('span', {}, 'SELECT')),
      h('button', { class: 'btn ghost', onclick: () => starburst.openFolder(i.id) }, h('span', {}, 'FOLDER')),
      h('button', { class: 'btn ghost', onclick: async () => {
        if (!confirm(`Delete "${i.name}" and all its files?`)) return;
        await refresh(await starburst.removeInstance(i.id)); go('library');
      } }, h('span', {}, 'DELETE'))));
  }

  const name = h('input', { class: 'inp', placeholder: 'e.g. Survival', maxlength: 32 });
  let pick = MAIN_VERSIONS[1];
  const other = h('select', { class: 'inp', 'aria-label': 'Other versions' }, h('option', { value: '' }, 'Other versions...'));
  const chips = h('div', { class: 'switcher', style: 'margin-top:0;flex-wrap:wrap' });
  const paint = () => chips.replaceChildren(...MAIN_VERSIONS.map(v => h('button', {
    class: 'chip' + (pick === v ? ' on' : ''),
    onclick: () => { pick = v; other.value = ''; paint(); },
  }, v.label)));
  paint();
  other.addEventListener('change', () => {
    if (!other.value) return;
    const v = other.value;
    const old = /^1\.(\d|1[0-3])(\.|$)/.test(v);
    pick = { id: v, label: v, loader: old ? 'vanilla' : 'fabric' };
    paint();
  });
  const err = h('div', { class: 'err' });
  const create = h('button', { class: 'btn' }, h('span', {}, 'CREATE INSTANCE'));
  create.addEventListener('click', async () => {
    err.textContent = '';
    try {
      const st = await starburst.createInstance({ name: name.value, mc: pick.id, loader: pick.loader });
      await refresh(st); go('library');
    } catch (e) { err.textContent = e.message; }
  });
  const form = h('div', { class: 'card' },
    h('div', { class: 'label', style: 'margin-bottom:14px' }, 'New instance'),
    h('div', { class: 'field' }, h('label', { class: 'label' }, 'Name'), name),
    h('div', { class: 'field' }, h('label', { class: 'label' }, 'Minecraft version'), chips),
    h('div', { class: 'field' }, other),
    h('div', { class: 'label', style: 'margin-bottom:14px' }, '1.8 is vanilla only: Fabric does not support it.'),
    create, err);
  const left = h('div', {}, list, importCard());
  page.append(h('div', { class: 'two' }, left, form));

  try {
    S.releases = S.releases || await starburst.versions();
    other.replaceChildren(h('option', { value: '' }, 'Other versions...'), ...S.releases.slice(0, 60).map(v => h('option', { value: v }, v)));
  } catch (e) { err.textContent = 'Could not load versions: ' + e.message; }
}


// ---------------------------------------------------------------- import

const PART_LABELS = { mods: 'Mods', config: 'Config', settings: 'Options + servers', resourcepacks: 'Resource packs', shaderpacks: 'Shaders', saves: 'Worlds' };

function importCard() {
  const I = S.imp;
  const card = h('div', { class: 'card', style: 'margin-top:18px' });
  const msg = h('div', { class: 'err', style: 'color:var(--purple)' }, I.msg);
  const say = t => { I.msg = t; msg.textContent = t; };
  const inst = selectedInstance();

  const target = h('div', { class: 'label' }, inst ? 'Importing into: ' + inst.name + ' (' + inst.mc + ')' : 'Select an instance first');

  const packBtn = h('button', { class: 'btn', onclick: async () => {
    say('Choose a .mrpack or CurseForge .zip...');
    const off = starburst.on('packstatus', t => say('Importing pack: ' + t));
    try {
      const st = await starburst.importPack();
      if (!st) { say(''); return; }
      await refresh(st); go('library');
    } catch (e) { say(e.message); }
  } }, h('span', {}, 'IMPORT MODPACK'));

  const jarBtn = h('button', { class: 'btn ghost', onclick: async () => {
    if (!inst) return say('Select an instance first');
    try { const n = await starburst.addJars(inst.id); say(n ? n + ' mod file(s) added' : ''); } catch (e) { say(e.message); }
  } }, h('span', {}, 'ADD JAR FILES'));

  const folderBtn = h('button', { class: 'btn ghost', onclick: async () => {
    try {
      const r = await starburst.pickFolder();
      if (r) { I.sources = [r, ...(I.sources || [])]; go('library'); }
    } catch (e) { say(e.message); }
  } }, h('span', {}, 'PICK A FOLDER'));

  const parts = h('div', { class: 'switcher', style: 'flex-wrap:wrap;margin:14px 0' },
    Object.keys(PART_LABELS).map(k => h('button', {
      class: 'chip' + (I.parts[k] ? ' on' : ''),
      onclick: (e) => { I.parts[k] = !I.parts[k]; e.currentTarget.classList.toggle('on', I.parts[k]); },
    }, PART_LABELS[k])));

  const list = h('div', {});
  const paintSources = () => {
    list.textContent = '';
    if (!I.sources) { list.append(h('p', { class: 'empty', style: 'padding:12px 0' }, 'Looking for Minecraft, Prism, Modrinth App and CurseForge folders...')); return; }
    if (!I.sources.length) list.append(h('p', { class: 'empty', style: 'padding:12px 0' }, 'No existing installs found. Use PICK A FOLDER.'));
    for (const src of I.sources) {
      const bits = [src.mods && src.mods + ' mods', src.saves && src.saves + ' worlds', src.resourcepacks && src.resourcepacks + ' packs', src.config && 'config'].filter(Boolean).join(' / ');
      list.append(h('div', { class: 'mod-line' },
        h('span', { class: 'f' }, h('b', {}, src.label), h('div', { class: 'label', style: 'margin-top:4px' }, bits || 'empty')),
        h('button', { class: 'btn', onclick: async () => {
          if (!inst) return say('Select an instance first');
          const chosen = Object.keys(I.parts).filter(k => I.parts[k]);
          if (!chosen.length) return say('Pick what to import');
          try {
            say('Copying...');
            const r = await starburst.runImport(inst.id, src.dir, chosen);
            say('Imported: ' + Object.entries(r.copied).map(([k, n]) => n + ' ' + k).join(', '));
          } catch (e) { say(e.message); }
        } }, h('span', {}, 'IMPORT'))));
    }
  };
  paintSources();
  if (!I.sources) starburst.detectImports().then(r => { I.sources = r; if (list.isConnected) paintSources(); }).catch(() => { I.sources = []; paintSources(); });

  card.append(
    h('div', { class: 'label', style: 'margin-bottom:12px' }, 'Import'),
    h('div', { class: 'switcher', style: 'margin:0' }, packBtn, jarBtn, folderBtn),
    target, parts, list, msg);
  return card;
}

// ---------------------------------------------------------------- settings

function renderSettings(page) {
  const st = S.st;
  const user = h('input', { class: 'inp', value: st.username, maxlength: 16, 'aria-label': 'Offline username' });
  user.addEventListener('change', async () => { await refresh(await starburst.setSettings({ username: user.value })); });
  const err = h('div', { class: 'err' });

  const acct = st.microsoft
    ? h('button', { class: 'btn ghost', onclick: async () => { await refresh(await starburst.signOut()); go('settings'); } }, h('span', {}, 'SIGN OUT'))
    : h('button', { class: 'btn', onclick: async () => {
      err.textContent = '';
      try { await refresh(await starburst.microsoftLogin()); go('settings'); } catch (e) { err.textContent = e.message; }
    } }, h('span', {}, 'SIGN IN WITH MICROSOFT'));

  const memLbl = h('span', { class: 'label' }, (st.memoryMb / 1024).toFixed(1) + ' GB');
  const mem = h('input', { type: 'range', min: 1024, max: 16384, step: 512, value: st.memoryMb, 'aria-label': 'Memory' });
  mem.addEventListener('input', () => { memLbl.textContent = (mem.value / 1024).toFixed(1) + ' GB'; });
  mem.addEventListener('change', () => starburst.setSettings({ memoryMb: Number(mem.value) }));

  const cfKey = h('input', { class: 'inp', type: 'password', placeholder: st.hasCurseforge ? 'saved (enter new key to replace)' : 'paste API key to enable CurseForge', autocomplete: 'off' });
  cfKey.addEventListener('change', async () => { await refresh(await starburst.setSettings({ curseforgeKey: cfKey.value })); cfKey.value = ''; });
  const java = h('input', { class: 'inp', value: st.javaPath, placeholder: 'auto (java from PATH, needs 21+)' });
  java.addEventListener('change', () => starburst.setSettings({ javaPath: java.value }));

  page.append(h('div', { class: 'two' },
    h('div', {},
      h('div', { class: 'field' }, h('label', { class: 'label' }, 'Account'), acct, err),
      st.microsoft ? null : h('div', { class: 'field' }, h('label', { class: 'label' }, 'Offline username'), user)),
    h('div', {},
      h('div', { class: 'field' }, h('div', { style: 'display:flex;justify-content:space-between' }, h('label', { class: 'label' }, 'Memory'), memLbl), mem),
      h('div', { class: 'field' }, h('label', { class: 'label' }, 'CurseForge API key'), cfKey),
      h('div', { class: 'field' }, h('label', { class: 'label' }, 'Java path'), java),
      h('div', { class: 'label' }, 'Data folder: ' + st.root))));
}

const PAGE_RENDER = { play: renderPlay, mods: renderMods, library: renderLibrary, settings: renderSettings };

// ---------------------------------------------------------------- boot

document.querySelectorAll('[data-win]').forEach(b => b.addEventListener('click', () => starburst.win(b.dataset.win)));

(async function boot() {
  let st = await starburst.state();
  if (!st.instances.length) {
    st = await starburst.createInstance({ name: 'Starburst 1.21.11', mc: '1.21.11', loader: 'fabric' });
  }
  S.st = st;
  buildRail();
  if (!K.reduce) gsap.from('.nav', { x: -60, opacity: 0, duration: 0.8, stagger: 0.08, ease: 'expo.out', clearProps: 'all' });
  go('play');
})();

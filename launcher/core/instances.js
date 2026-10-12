const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const store = require('./store');

const INST_DIR = path.join(store.ROOT, 'instances');
// versions, libraries and assets are shared across instances
const SHARED = path.join(store.ROOT, 'shared');
const HOME_JAR = 'starburst-home.jar';

function dirOf(inst) { return path.join(INST_DIR, inst.id); }
function modsDirOf(inst) { return path.join(dirOf(inst), 'mods'); }

function list() { return store.load().instances; }
function find(id) { return list().find(i => i.id === id); }

function create({ name, mc, loader = 'fabric' }) {
  const cfg = store.load();
  const inst = {
    id: crypto.randomBytes(4).toString('hex'),
    name: (name || '').trim() || `Minecraft ${mc}`,
    mc, loader, createdAt: Date.now(), lastPlayed: 0,
  };
  fs.mkdirSync(modsDirOf(inst), { recursive: true });
  cfg.instances.push(inst);
  if (!cfg.selected) cfg.selected = inst.id;
  store.save();
  syncHome(inst);
  return inst;
}

/** The Starbursttttt home screen mod is preloaded into every Fabric instance, and refreshed on launch. */
function syncHome(inst) {
  if (inst.loader !== 'fabric') return;
  const name = /^26./.test(inst.mc) ? 'starburst-home-26.jar' : (inst.mc === '1.21.11' ? 'starburst-home-1.21.11.jar' : null);
  if (!name) return;
  const src = path.join(__dirname, '..', 'resources', name);
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(modsDirOf(inst), { recursive: true });
  fs.copyFileSync(src, path.join(modsDirOf(inst), HOME_JAR));
}

function remove(id) {
  const cfg = store.load();
  const inst = find(id);
  if (!inst) return;
  fs.rmSync(dirOf(inst), { recursive: true, force: true });
  cfg.instances = cfg.instances.filter(i => i.id !== id);
  if (cfg.selected === id) cfg.selected = cfg.instances[0] ? cfg.instances[0].id : null;
  store.save();
}

function installedMods(inst) {
  const d = modsDirOf(inst);
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d)
    .filter(f => f.endsWith('.jar') || f.endsWith('.jar.disabled'))
    .map(f => ({ file: f, enabled: f.endsWith('.jar'), size: fs.statSync(path.join(d, f)).size, locked: f === HOME_JAR }));
}

function safeName(file) {
  const base = path.basename(file);
  if (base === HOME_JAR || base !== file) return null;
  return base;
}

function toggleMod(inst, file) {
  const f = safeName(file);
  if (!f) return;
  const to = f.endsWith('.disabled') ? f.slice(0, -9) : f + '.disabled';
  fs.renameSync(path.join(modsDirOf(inst), f), path.join(modsDirOf(inst), to));
}

function removeMod(inst, file) {
  const f = safeName(file);
  if (!f) return;
  fs.rmSync(path.join(modsDirOf(inst), f), { force: true });
}

module.exports = { list, find, create, remove, syncHome, dirOf, modsDirOf, installedMods, toggleMod, removeMod, SHARED, INST_DIR };

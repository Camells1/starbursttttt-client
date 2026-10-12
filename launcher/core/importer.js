const fs = require('fs');
const path = require('path');
const os = require('os');
const inst = require('./instances');

const APPDATA = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');

// part id -> what to copy (relative to the game dir)
const PARTS = {
  mods: ['mods'],
  config: ['config'],
  saves: ['saves'],
  resourcepacks: ['resourcepacks'],
  shaderpacks: ['shaderpacks'],
  settings: ['options.txt', 'optionsof.txt', 'optionsshaders.txt', 'servers.dat'],
};

function isDir(p) { try { return fs.statSync(p).isDirectory(); } catch { return false; } }
function exists(p) { return fs.existsSync(p); }

/** Resolves a user-picked folder to the real game dir (handles Prism/Modrinth style nesting). */
function gameDirOf(dir) {
  for (const sub of ['', '.minecraft', 'minecraft']) {
    const d = path.join(dir, sub);
    if (isDir(d) && ['mods', 'saves', 'config', 'options.txt', 'versions'].some(n => exists(path.join(d, n)))) return d;
  }
  return dir;
}

function countFiles(d, test) {
  try { return fs.readdirSync(d).filter(test).length; } catch { return 0; }
}

function scan(dir) {
  const g = gameDirOf(dir);
  return {
    dir: g,
    mods: countFiles(path.join(g, 'mods'), f => /\.jar(\.disabled)?$/.test(f)),
    saves: countFiles(path.join(g, 'saves'), f => isDir(path.join(g, 'saves', f))),
    resourcepacks: countFiles(path.join(g, 'resourcepacks'), () => true),
    shaderpacks: countFiles(path.join(g, 'shaderpacks'), () => true),
    config: isDir(path.join(g, 'config')),
    settings: ['options.txt', 'servers.dat'].some(n => exists(path.join(g, n))),
  };
}

function subdirs(p) {
  try { return fs.readdirSync(p).map(n => path.join(p, n)).filter(isDir); } catch { return []; }
}

function detect() {
  const found = [];
  const add = (label, dir) => {
    const s = scan(dir);
    if (s.mods || s.saves || s.config || s.settings || s.resourcepacks) found.push({ label, ...s });
  };
  add('Minecraft (default)', path.join(APPDATA, '.minecraft'));
  for (const d of subdirs(path.join(APPDATA, 'PrismLauncher', 'instances'))) add(`Prism: ${path.basename(d)}`, d);
  for (const d of subdirs(path.join(APPDATA, 'ModrinthApp', 'profiles'))) add(`Modrinth: ${path.basename(d)}`, d);
  for (const d of subdirs(path.join(os.homedir(), 'curseforge', 'minecraft', 'Instances'))) add(`CurseForge: ${path.basename(d)}`, d);
  for (const d of subdirs(path.join(APPDATA, 'ATLauncher', 'instances'))) add(`ATLauncher: ${path.basename(d)}`, d);
  return found;
}

function copyInto(src, dest, onlyJars) {
  let n = 0;
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dest, name);
    if (onlyJars && !/\.jar(\.disabled)?$/.test(name)) continue;
    if (name === 'starburst-home.jar') continue; // ours is managed by the launcher
    if (isDir(s)) {
      fs.cpSync(s, d, { recursive: true, force: true });
    } else {
      fs.copyFileSync(s, d);
    }
    n++;
  }
  return n;
}

/** parts: array of PARTS keys. Returns { copied: {part: count} }. */
function run(instanceId, srcDir, parts) {
  const i = inst.find(instanceId);
  if (!i) throw new Error('Pick an instance to import into');
  const g = gameDirOf(srcDir);
  const dest = inst.dirOf(i);
  if (path.resolve(g) === path.resolve(dest)) throw new Error('Source and destination are the same folder');
  const copied = {};
  for (const part of parts) {
    const rels = PARTS[part];
    if (!rels) continue;
    let n = 0;
    for (const rel of rels) {
      const s = path.join(g, rel);
      if (!exists(s)) continue;
      const d = path.join(dest, rel);
      if (isDir(s)) n += copyInto(s, d, rel === 'mods');
      else { fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(s, d); n++; }
    }
    copied[part] = n;
  }
  return { copied };
}

/** Copy loose jar files straight into an instance's mods folder. */
function addJars(instanceId, files) {
  const i = inst.find(instanceId);
  if (!i) throw new Error('Pick an instance first');
  const mods = inst.modsDirOf(i);
  fs.mkdirSync(mods, { recursive: true });
  let n = 0;
  for (const f of files) {
    if (!/\.jar$/i.test(f)) continue;
    fs.copyFileSync(f, path.join(mods, path.basename(f)));
    n++;
  }
  return n;
}

module.exports = { detect, scan, run, addJars, PARTS };

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const inst = require('./instances');
const { download } = require('./modrinth');
const cf = require('./curseforge');

const run = promisify(execFile);

async function unzip(file) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'starburst-pack-'));
  const zip = path.join(tmp, 'pack.zip');
  fs.copyFileSync(file, zip);
  const out = path.join(tmp, 'x');
  await run('powershell.exe', ['-NoProfile', '-Command',
    `Expand-Archive -LiteralPath "${zip}" -DestinationPath "${out}" -Force`]);
  return { dir: out, tmp };
}

/** Refuses paths that would escape the instance directory. */
function inside(base, rel) {
  const full = path.resolve(base, rel);
  if (!full.startsWith(path.resolve(base) + path.sep)) throw new Error(`Unsafe path in modpack: ${rel}`);
  return full;
}

function copyOverrides(from, to) {
  if (fs.existsSync(from)) fs.cpSync(from, to, { recursive: true, force: true });
}

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; await fn(items[k], k); }
  }));
}

async function importMrpack(dir, onStatus) {
  const idx = JSON.parse(fs.readFileSync(path.join(dir, 'modrinth.index.json'), 'utf8'));
  const deps = idx.dependencies || {};
  const mc = deps.minecraft;
  if (!mc) throw new Error('Pack has no Minecraft version');
  if (!deps['fabric-loader']) throw new Error('Only Fabric modpacks are supported (this pack uses another loader).');
  const i = inst.create({ name: idx.name, mc, loader: 'fabric' });
  const base = inst.dirOf(i);
  const files = (idx.files || []).filter(f => !(f.env && f.env.client === 'unsupported'));
  let done = 0;
  await pool(files, 6, async (f) => {
    const dest = inside(base, f.path);
    onStatus(`mods ${++done}/${files.length}`);
    if (!f.downloads || !f.downloads.length) return;
    await download(f.downloads[0], dest);
    if (f.hashes && f.hashes.sha512) {
      const h = crypto.createHash('sha512').update(fs.readFileSync(dest)).digest('hex');
      if (h !== f.hashes.sha512) { fs.rmSync(dest, { force: true }); throw new Error(`Hash mismatch: ${f.path}`); }
    }
  });
  copyOverrides(path.join(dir, 'overrides'), base);
  copyOverrides(path.join(dir, 'client-overrides'), base);
  inst.syncHome(i);
  return i;
}

async function importCurseforge(dir, onStatus) {
  const man = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const mc = man.minecraft && man.minecraft.version;
  const loaders = (man.minecraft && man.minecraft.modLoaders) || [];
  const primary = loaders.find(l => l.primary) || loaders[0];
  if (!mc) throw new Error('Pack has no Minecraft version');
  if (!primary || !/^fabric/.test(primary.id)) throw new Error('Only Fabric modpacks are supported (this pack uses another loader).');
  const entries = (man.files || []).filter(f => f.required !== false);
  onStatus('Resolving CurseForge files');
  const resolved = await cf.resolveFiles(entries);
  const i = inst.create({ name: man.name, mc, loader: 'fabric' });
  const base = inst.dirOf(i);
  let done = 0;
  await pool(resolved, 6, async (r) => {
    onStatus(`mods ${++done}/${resolved.length}`);
    if (!r) return;
    await download(r.url, inside(base, path.join('mods', path.basename(r.fileName))));
  });
  copyOverrides(path.join(dir, man.overrides || 'overrides'), base);
  inst.syncHome(i);
  return i;
}

/** Imports a .mrpack (Modrinth) or CurseForge modpack .zip as a new instance. */
async function importPack(file, onStatus = () => {}) {
  const { dir, tmp } = await unzip(file);
  try {
    if (fs.existsSync(path.join(dir, 'modrinth.index.json'))) return await importMrpack(dir, onStatus);
    if (fs.existsSync(path.join(dir, 'manifest.json'))) return await importCurseforge(dir, onStatus);
    throw new Error('Not a Modrinth (.mrpack) or CurseForge modpack');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

module.exports = { importPack };

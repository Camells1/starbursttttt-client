const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const store = require('./store');
const { get, download } = require('./modrinth');

const run = promisify(execFile);
const MANIFEST = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
const JAVA_DIR = path.join(store.ROOT, 'java');
const EXE = process.platform === 'win32' ? 'java.exe' : 'java';

function majorOf(home) {
  try {
    const rel = fs.readFileSync(path.join(home, 'release'), 'utf8');
    const m = /JAVA_VERSION="([^"]+)"/.exec(rel);
    if (!m) return 0;
    const v = m[1].startsWith('1.') ? m[1].split('.')[1] : m[1].split('.')[0];
    return parseInt(v, 10) || 0;
  } catch { return 0; }
}

function candidates() {
  const roots = [];
  if (process.env.JAVA_HOME) roots.push(process.env.JAVA_HOME);
  const parents = [
    'C:\\Program Files\\Eclipse Adoptium', 'C:\\Program Files\\Java', 'C:\\Program Files\\Microsoft',
    'C:\\Program Files\\Zulu', 'C:\\Program Files\\Amazon Corretto', 'D:\\jdks', 'D:\\Java', JAVA_DIR,
  ];
  for (const p of parents) {
    try { for (const d of fs.readdirSync(p)) roots.push(path.join(p, d)); } catch { /* absent */ }
  }
  try {
    for (const d of fs.readdirSync(JAVA_DIR)) {
      const dd = path.join(JAVA_DIR, d);
      if (fs.statSync(dd).isDirectory()) for (const e of fs.readdirSync(dd)) roots.push(path.join(dd, e));
    }
  } catch { /* none */ }
  {
  }
  const out = [];
  for (const home of roots) {
    const exe = path.join(home, 'bin', EXE);
    if (fs.existsSync(exe)) {
      const major = majorOf(home);
      if (major) out.push({ home, exe, major });
    }
  }
  return out;
}

/** Required Java major for a Minecraft version, from Mojang's version json. */
async function requiredMajor(mc) {
  const cache = path.join(store.ROOT, 'java-req.json');
  let c = {};
  try { c = JSON.parse(fs.readFileSync(cache, 'utf8')); } catch { /* none */ }
  if (c[mc]) return c[mc];
  const man = await get(MANIFEST);
  const v = man.versions.find(x => x.id === mc);
  if (!v) return 21;
  const j = await get(v.url);
  const major = (j.javaVersion && j.javaVersion.majorVersion) || 8;
  c[mc] = major;
  fs.writeFileSync(cache, JSON.stringify(c));
  return major;
}

async function installJre(major, onStatus) {
  onStatus(`Downloading Java ${major}`);
  const url = `https://api.adoptium.net/v3/binary/latest/${major}/ga/windows/x64/jre/hotspot/normal/eclipse`;
  const dest = path.join(JAVA_DIR, `jre-${major}`);
  const zip = path.join(JAVA_DIR, `jre-${major}.zip`);
  fs.mkdirSync(dest, { recursive: true });
  await download(url, zip);
  onStatus(`Unpacking Java ${major}`);
  await run('powershell.exe', ['-NoProfile', '-Command', 'Expand-Archive -LiteralPath "' + zip + '" -DestinationPath "' + dest + '" -Force']);
  fs.rmSync(zip, { force: true });
  const sub = fs.readdirSync(dest).map(d => path.join(dest, d)).find(d => fs.existsSync(path.join(d, 'bin', EXE)));
  if (!sub) throw new Error(`Java ${major} download did not unpack`);
  return path.join(sub, 'bin', EXE);
}

/** Picks a java executable for this Minecraft version: override > exact major > smallest newer > download. */
async function resolve(mc, override, onStatus = () => {}) {
  if (override) return override;
  const need = await requiredMajor(mc);
  const list = candidates();
  const exact = list.find(c => c.major === need);
  if (exact) return exact.exe;
  const newer = list.filter(c => c.major > need).sort((a, b) => a.major - b.major)[0];
  // Java 8 era versions are fragile on new JVMs, so fetch a matching JRE instead
  if (newer && need > 8) return newer.exe;
  if (process.platform === 'win32') {
    try { return await installJre(need, onStatus); }
    catch (e) { if (newer) return newer.exe; throw e; }
  }
  if (newer) return newer.exe;
  throw new Error(`Java ${need} is required. Install it or set a Java path in Settings.`);
}

module.exports = { resolve, requiredMajor };

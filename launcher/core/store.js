const fs = require('fs');
const path = require('path');

function pickRoot() {
  if (process.env.STARBURSTTTTT_HOME) return process.env.STARBURSTTTTT_HOME;
  if (process.platform === 'win32' && fs.existsSync('D:\\')) return 'D:\\StarburstClient';
  return path.join(require('os').homedir(), '.starbursttttt-client');
}

const ROOT = pickRoot();
const FILE = path.join(ROOT, 'config.json');
fs.mkdirSync(ROOT, { recursive: true });

const DEFAULTS = {
  username: 'Player',
  account: null, // MCLC auth object when signed in with Microsoft
  memoryMb: 4096,
  javaPath: '',
  instances: [],
  selected: null,
};

let cfg = null;

function load() {
  if (cfg) return cfg;
  try { cfg = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; }
  catch { cfg = { ...DEFAULTS }; }
  return cfg;
}

function save() {
  fs.writeFileSync(FILE, JSON.stringify(load(), null, 2));
}

module.exports = { ROOT, load, save, DEFAULTS };

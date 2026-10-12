const fs = require('fs');
const { Client, Authenticator } = require('minecraft-launcher-core');
const store = require('./store');
const inst = require('./instances');
const { ensureFabric } = require('./versions');
const mr = require('./modrinth');
const java = require('./java');

let running = null;

async function ensureAuth(cfg) {
  if (cfg.account && cfg.account.msmc) {
    try {
      const { Auth } = require('msmc');
      const am = new Auth('select_account');
      const xbox = await am.refresh(cfg.account.msmc);
      const mc = await xbox.getMinecraft();
      cfg.account = { ...cfg.account, msmc: xbox.save(), mclc: mc.mclc(), name: mc.profile.name };
      store.save();
      return cfg.account.mclc;
    } catch (e) {
      // fall through to offline
    }
  }
  return Authenticator.getAuth(cfg.username || 'Player');
}

/** Fabric instances get Fabric API automatically, since most mods require it. */
async function ensureFabricApi(i, send) {
  const mods = inst.installedMods(i);
  if (mods.some(m => /^fabric-api/i.test(m.file))) return;
  send('status', 'Fetching Fabric API');
  try {
    await mr.install('P7dR8mSH', { gameVersion: i.mc, loader: 'fabric', modsDir: inst.modsDirOf(i) });
  } catch (e) {
    send('log', `Fabric API skipped: ${e.message}`);
  }
}

async function launch(id, send) {
  if (running) throw new Error('Already running');
  const i = inst.find(id);
  if (!i) throw new Error('Unknown instance');
  const cfg = store.load();
  fs.mkdirSync(inst.SHARED, { recursive: true });
  fs.mkdirSync(inst.dirOf(i), { recursive: true });

  send('status', 'Preparing');
  let custom;
  if (i.loader === 'fabric') {
    custom = await ensureFabric(inst.SHARED, i.mc);
    inst.syncHome(i);
    await ensureFabricApi(i, send);
  }
  const authorization = await ensureAuth(cfg);

  const client = new Client();
  const opts = {
    authorization,
    root: inst.SHARED,
    version: { number: i.mc, type: 'release', ...(custom ? { custom } : {}) },
    memory: { max: `${cfg.memoryMb}M`, min: `${Math.min(cfg.memoryMb, 1024)}M` },
    overrides: { gameDirectory: inst.dirOf(i) },
  };
  send('status', 'Finding Java');
  opts.javaPath = await java.resolve(i.mc, cfg.javaPath, m => send('status', m));

  client.on('progress', p => send('progress', { type: p.type, task: p.task, total: p.total }));
  client.on('data', d => send('log', String(d).trimEnd()));
  client.on('debug', d => send('log', String(d)));
  client.on('close', code => {
    running = null;
    send('closed', code);
  });

  running = client;
  send('status', 'Downloading');
  const proc = await client.launch(opts);
  if (!proc) {
    running = null;
    throw new Error('Launch failed. Check that Java 21 is installed (Settings -> Java path).');
  }
  i.lastPlayed = Date.now();
  store.save();
  send('status', 'Playing');
}

function isRunning() { return !!running; }

module.exports = { launch, isRunning };

const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const store = require('./core/store');
const inst = require('./core/instances');
const mr = require('./core/modrinth');
const versions = require('./core/versions');
const launcher = require('./core/launch');
const importer = require('./core/importer');
const modpack = require('./core/modpack');
const cf = require('./core/curseforge');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1240, height: 780, minWidth: 980, minHeight: 640,
    icon: path.join(__dirname, 'resources', 'icon.png'),
    frame: false, backgroundColor: '#0C0B0E', show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  win.loadFile(path.join(__dirname, 'ui', 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

const sendUi = (ch, payload) => { if (win && !win.isDestroyed()) win.webContents.send('launch:' + ch, payload); };

function state() {
  const c = store.load();
  return {
    username: c.account ? c.account.name : c.username,
    microsoft: !!(c.account && c.account.msmc),
    memoryMb: c.memoryMb, javaPath: c.javaPath, hasCurseforge: !!c.curseforgeKey,
    instances: c.instances, selected: c.selected,
    running: launcher.isRunning(), root: store.ROOT,
  };
}

function handle(name, fn) {
  ipcMain.handle(name, async (_e, ...args) => {
    try { return { ok: true, data: await fn(...args) }; }
    catch (e) { return { ok: false, error: e.message || String(e) }; }
  });
}

handle('state', () => state());
handle('versions', () => versions.releases());
handle('instance:create', (o) => { inst.create(o); return state(); });
handle('instance:remove', (id) => { inst.remove(id); return state(); });
handle('instance:select', (id) => { store.load().selected = id; store.save(); return state(); });
handle('instance:mods', (id) => inst.installedMods(inst.find(id)));
handle('instance:toggleMod', (id, file) => { inst.toggleMod(inst.find(id), file); return inst.installedMods(inst.find(id)); });
handle('instance:removeMod', (id, file) => { inst.removeMod(inst.find(id), file); return inst.installedMods(inst.find(id)); });
handle('instance:openFolder', (id) => shell.openPath(inst.dirOf(inst.find(id))));
handle('settings:set', (patch) => {
  const c = store.load();
  if ('username' in patch) c.username = String(patch.username).replace(/[^\w]/g, '').slice(0, 16) || 'Player';
  if ('memoryMb' in patch) c.memoryMb = Math.max(1024, Math.min(32768, Number(patch.memoryMb) || 4096));
  if ('curseforgeKey' in patch) c.curseforgeKey = String(patch.curseforgeKey || '').trim();
  if ('javaPath' in patch) c.javaPath = String(patch.javaPath || '');
  store.save();
  return state();
});
handle('account:microsoft', async () => {
  const { Auth } = require('msmc');
  const am = new Auth('select_account');
  const xbox = await am.launch('electron');
  const mc = await xbox.getMinecraft();
  const c = store.load();
  c.account = { msmc: xbox.save(), mclc: mc.mclc(), name: mc.profile.name };
  store.save();
  return state();
});
handle('account:signout', () => { const c = store.load(); c.account = null; store.save(); return state(); });

handle('mods:search', (q) => {
  const i = inst.find(q.instance);
  const args = { ...q, gameVersion: i ? i.mc : undefined, loader: i ? i.loader : 'fabric' };
  return q.source === 'curseforge' ? cf.search(args) : mr.search(args);
});
handle('mods:install', async (instanceId, projectId, source) => {
  const i = inst.find(instanceId);
  if (!i) throw new Error('Pick an instance first');
  if (i.loader !== 'fabric') throw new Error('Mods need a Fabric instance');
  if (source === 'curseforge') return cf.install(projectId, { gameVersion: i.mc, modsDir: inst.modsDirOf(i) });
  return mr.install(projectId, { gameVersion: i.mc, loader: i.loader, modsDir: inst.modsDirOf(i) });
});

// ---- import: existing folders, loose jars, modpacks
handle('import:detect', () => importer.detect());
handle('import:pickFolder', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Pick a Minecraft folder', properties: ['openDirectory'] });
  if (r.canceled || !r.filePaths[0]) return null;
  return { label: require('path').basename(r.filePaths[0]), ...importer.scan(r.filePaths[0]) };
});
handle('import:run', (instanceId, dir, parts) => importer.run(instanceId, dir, parts));
handle('import:jars', async (instanceId) => {
  const r = await dialog.showOpenDialog(win, { title: 'Add mod jars', properties: ['openFile', 'multiSelections'], filters: [{ name: 'Mods', extensions: ['jar'] }] });
  if (r.canceled) return 0;
  return importer.addJars(instanceId, r.filePaths);
});
handle('import:pack', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Import a modpack', properties: ['openFile'], filters: [{ name: 'Modpacks', extensions: ['mrpack', 'zip'] }] });
  if (r.canceled || !r.filePaths[0]) return null;
  const i = await modpack.importPack(r.filePaths[0], (s) => sendUi('packstatus', s));
  store.load().selected = i.id; store.save();
  return state();
});

handle('launch', (id) => {
  launcher.launch(id, sendUi).catch(e => sendUi('error', e.message || String(e)));
  return true;
});

ipcMain.on('win', (_e, what) => {
  if (!win) return;
  if (what === 'min') win.minimize();
  else if (what === 'max') (win.isMaximized() ? win.unmaximize() : win.maximize());
  else if (what === 'close') win.close();
});

// ---- auto-update (GitHub releases). Only runs in the installed app, never in dev.
function setupUpdates() {
  if (!app.isPackaged) return;
  let autoUpdater;
  try { ({ autoUpdater } = require('electron-updater')); } catch { return; }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  const send = (s) => sendUi('update', s);
  autoUpdater.on('update-available', (i) => send({ state: 'available', version: i.version }));
  autoUpdater.on('download-progress', (p) => send({ state: 'downloading', percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (i) => {
    send({ state: 'ready', version: i.version });
    // install by itself unless a game is running; if one is, it installs when the launcher closes
    const tryInstall = () => {
      if (launcher.isRunning()) return setTimeout(tryInstall, 30000);
      send({ state: 'installing', version: i.version });
      setTimeout(() => autoUpdater.quitAndInstall(true, true), 2500);
    };
    setTimeout(tryInstall, 2000);
  });
  autoUpdater.on('error', (e) => send({ state: 'error', message: String(e && e.message || e).slice(0, 160) }));
  ipcMain.on('update:install', () => autoUpdater.quitAndInstall());
  ipcMain.on('update:check', () => autoUpdater.checkForUpdates().catch(() => {}));
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 4000);
}

app.whenReady().then(() => { createWindow(); setupUpdates(); });
app.on('window-all-closed', () => app.quit());

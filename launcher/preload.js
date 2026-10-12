const { contextBridge, ipcRenderer } = require('electron');

const call = (name) => (...a) => ipcRenderer.invoke(name, ...a).then(r => {
  if (!r.ok) throw new Error(r.error);
  return r.data;
});

contextBridge.exposeInMainWorld('starburst', {
  state: call('state'),
  versions: call('versions'),
  createInstance: call('instance:create'),
  removeInstance: call('instance:remove'),
  selectInstance: call('instance:select'),
  mods: call('instance:mods'),
  toggleMod: call('instance:toggleMod'),
  removeMod: call('instance:removeMod'),
  openFolder: call('instance:openFolder'),
  setSettings: call('settings:set'),
  microsoftLogin: call('account:microsoft'),
  signOut: call('account:signout'),
  search: call('mods:search'),
  install: call('mods:install'),
  launch: call('launch'),
  detectImports: call('import:detect'),
  pickFolder: call('import:pickFolder'),
  runImport: call('import:run'),
  addJars: call('import:jars'),
  importPack: call('import:pack'),
  win: (w) => ipcRenderer.send('win', w),
  installUpdate: () => ipcRenderer.send('update:install'),
  checkUpdate: () => ipcRenderer.send('update:check'),
  on: (ch, fn) => ipcRenderer.on('launch:' + ch, (_e, p) => fn(p)),
});

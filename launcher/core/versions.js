const fs = require('fs');
const path = require('path');
const { get } = require('./modrinth');

const MANIFEST = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
const FABRIC = 'https://meta.fabricmc.net/v2/versions/loader';

async function releases() {
  const m = await get(MANIFEST);
  return m.versions.filter(v => v.type === 'release').map(v => v.id);
}

/** Writes the Fabric profile JSON into <root>/versions and returns the custom version id. */
async function ensureFabric(gameDir, mc) {
  const loaders = await get(`${FABRIC}/${mc}`);
  const stable = loaders.find(l => l.loader.stable) || loaders[0];
  if (!stable) throw new Error(`Fabric does not support ${mc}`);
  const lv = stable.loader.version;
  const id = `fabric-loader-${lv}-${mc}`;
  const dir = path.join(gameDir, 'versions', id);
  const file = path.join(dir, `${id}.json`);
  if (!fs.existsSync(file)) {
    const profile = await get(`${FABRIC}/${mc}/${lv}/profile/json`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(profile));
  }
  return id;
}

module.exports = { releases, ensureFabric };

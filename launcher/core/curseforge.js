const fs = require('fs');
const path = require('path');
const store = require('./store');
const { download } = require('./modrinth');

const API = 'https://api.curseforge.com/v1';
const GAME_MINECRAFT = 432;
const CLASS_MODS = 6;
const LOADER_FABRIC = 4;

function key() {
  const k = store.load().curseforgeKey;
  if (!k) throw new Error('CurseForge needs an API key. Add one in Settings (free at console.curseforge.com).');
  return k;
}

async function call(pathname, opts = {}) {
  const r = await fetch(API + pathname, {
    ...opts,
    headers: { 'x-api-key': key(), Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'StarburstClient/1.0.0' },
  });
  if (!r.ok) throw new Error(`CurseForge HTTP ${r.status}`);
  return r.json();
}

const SORT = { relevance: 1, follows: 2, newest: 11, updated: 3, downloads: 6 };

async function search({ query = '', gameVersion, index = 'relevance', offset = 0, limit = 20 }) {
  const qs = new URLSearchParams({
    gameId: String(GAME_MINECRAFT), classId: String(CLASS_MODS), searchFilter: query,
    sortField: String(SORT[index] || 2), sortOrder: 'desc', index: String(offset), pageSize: String(limit),
    modLoaderType: String(LOADER_FABRIC),
  });
  if (gameVersion) qs.set('gameVersion', gameVersion);
  const j = await call(`/mods/search?${qs}`);
  return {
    total: j.pagination ? j.pagination.totalCount : j.data.length,
    hits: j.data.map(m => ({
      id: String(m.id), slug: m.slug, title: m.name, author: (m.authors && m.authors[0] && m.authors[0].name) || '',
      description: m.summary, downloads: m.downloadCount, follows: m.thumbsUpCount || 0,
      icon: m.logo && m.logo.thumbnailUrl, categories: (m.categories || []).map(c => c.name).slice(0, 4),
      updated: m.dateModified, source: 'curseforge',
    })),
  };
}

function cdnUrl(f) {
  return f.downloadUrl || `https://edge.forgecdn.net/files/${Math.floor(f.id / 1000)}/${f.id % 1000}/${encodeURIComponent(f.fileName)}`;
}

async function install(projectId, { gameVersion, modsDir, seen = new Set(), onStatus = () => {} }) {
  if (seen.has(projectId)) return [];
  seen.add(projectId);
  const qs = new URLSearchParams({ gameVersion, modLoaderType: String(LOADER_FABRIC), pageSize: '20' });
  const j = await call(`/mods/${projectId}/files?${qs}`);
  const files = j.data.sort((a, b) => new Date(b.fileDate) - new Date(a.fileDate));
  const f = files.find(x => x.releaseType === 1) || files[0];
  if (!f) throw new Error(`No Fabric build for ${gameVersion}`);
  const out = [];
  for (const dep of f.dependencies || []) {
    if (dep.relationType === 3) {
      try { out.push(...await install(String(dep.modId), { gameVersion, modsDir, seen, onStatus })); }
      catch (e) { onStatus(`dependency skipped: ${e.message}`); }
    }
  }
  const dest = path.join(modsDir, path.basename(f.fileName));
  onStatus(`downloading ${f.fileName}`);
  if (!fs.existsSync(dest)) await download(cdnUrl(f), dest);
  out.push(f.fileName);
  return out;
}

/** Resolves [{projectID,fileID}] to [{fileName,url}] for modpack import. */
async function resolveFiles(entries) {
  const ids = entries.map(e => e.fileID);
  const j = await call('/mods/files', { method: 'POST', body: JSON.stringify({ fileIds: ids }) });
  const byId = new Map(j.data.map(f => [f.id, f]));
  return entries.map(e => {
    const f = byId.get(e.fileID);
    return f ? { fileName: f.fileName, url: cdnUrl(f) } : null;
  });
}

module.exports = { search, install, resolveFiles };

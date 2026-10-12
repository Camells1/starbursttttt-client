const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { Readable } = require('stream');

const API = 'https://api.modrinth.com/v2';
const UA = 'StarburstClient/1.0.0 (starbursttttt-client)';

async function get(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${new URL(url).host}`);
  return r.json();
}

async function search({ query = '', gameVersion, loader = 'fabric', projectType = 'mod', index = 'relevance', offset = 0, limit = 20 }) {
  const facets = [[`project_type:${projectType}`]];
  if (gameVersion) facets.push([`versions:${gameVersion}`]);
  if (loader && projectType === 'mod') facets.push([`categories:${loader}`]);
  const qs = new URLSearchParams({
    query, facets: JSON.stringify(facets), index, offset: String(offset), limit: String(limit),
  });
  const j = await get(`${API}/search?${qs}`);
  return {
    total: j.total_hits,
    hits: j.hits.map(h => ({
      id: h.project_id, slug: h.slug, title: h.title, author: h.author,
      description: h.description, downloads: h.downloads, follows: h.follows,
      icon: h.icon_url, categories: h.display_categories || h.categories || [],
      updated: h.date_modified,
    })),
  };
}

async function bestVersion(projectId, gameVersion, loader) {
  const qs = new URLSearchParams({
    game_versions: JSON.stringify([gameVersion]),
    loaders: JSON.stringify([loader]),
  });
  const list = await get(`${API}/project/${projectId}/version?${qs}`);
  if (!list.length) return null;
  const rank = { release: 0, beta: 1, alpha: 2 };
  list.sort((a, b) => (rank[a.version_type] - rank[b.version_type]) || (new Date(b.date_published) - new Date(a.date_published)));
  return list[0];
}

async function download(url, dest) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`download failed (${r.status})`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  await pipeline(Readable.fromWeb(r.body), fs.createWriteStream(dest));
}

/** Installs a project plus its required dependencies into modsDir. Returns installed filenames. */
async function install(projectId, { gameVersion, loader = 'fabric', modsDir, seen = new Set(), onStatus = () => {} }) {
  if (seen.has(projectId)) return [];
  seen.add(projectId);
  const v = await bestVersion(projectId, gameVersion, loader);
  if (!v) throw new Error(`No ${loader} build for ${gameVersion}`);
  const out = [];
  for (const dep of v.dependencies || []) {
    if (dep.dependency_type === 'required' && dep.project_id) {
      try { out.push(...await install(dep.project_id, { gameVersion, loader, modsDir, seen, onStatus })); }
      catch (e) { onStatus(`dependency skipped: ${e.message}`); }
    }
  }
  const file = v.files.find(f => f.primary) || v.files[0];
  const dest = path.join(modsDir, path.basename(file.filename));
  onStatus(`downloading ${file.filename}`);
  if (!fs.existsSync(dest)) await download(file.url, dest);
  out.push(file.filename);
  return out;
}

module.exports = { search, install, bestVersion, download, get };

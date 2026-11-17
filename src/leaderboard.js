import { SUPABASE } from './config.js';

// Leaderboard storage. If Supabase is configured the board is shared by every player;
// otherwise (or if the network call fails) scores are kept on this device.
export const MAX_NAME = 16;
const LOCAL_KEY = 'sv-scores';
const NAME_KEY = 'sv-name';

export const cfg = { url: (SUPABASE.url || '').replace(/\/+$/, ''), key: SUPABASE.anonKey || '' };
export const isGlobal = () => Boolean(cfg.url && cfg.key);

export function cleanName(s) {
  return String(s ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME);
}

export function savedName() {
  try {
    return localStorage.getItem(NAME_KEY) || '';
  } catch {
    return '';
  }
}
function saveName(n) {
  try {
    localStorage.setItem(NAME_KEY, n);
  } catch {
    /* private mode: the name just will not be remembered */
  }
}

// ---------- This device ----------
function readLocal() {
  try {
    const a = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

function submitLocal(entry) {
  const all = readLocal();
  const row = { ...entry, id: `l${Date.now()}${Math.random().toString(36).slice(2, 6)}`, t: Date.now() };
  all.push(row);
  all.sort((a, b) => b.score - a.score || a.t - b.t);
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(all.slice(0, 200)));
  } catch {
    /* storage unavailable: the rank below is still correct for this session */
  }
  return { source: 'local', id: row.id, rank: all.findIndex((r) => r.id === row.id) + 1, total: all.length, top: all.slice(0, 10) };
}

// ---------- Shared board (Supabase REST) ----------
async function api(path, { method = 'GET', body, headers = {}, signal } = {}) {
  const res = await fetch(`${cfg.url}/rest/v1/${path}`, {
    method,
    signal,
    headers: {
      apikey: cfg.key,
      // Legacy anon keys are JWTs and go in Authorization too; the newer publishable keys (sb_publishable_...) are not JWTs.
      ...(cfg.key.startsWith('eyJ') ? { Authorization: `Bearer ${cfg.key}` } : {}),
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Leaderboard request failed (${res.status})`);
  return res;
}

// "0-0/123" or "*/0" -> 123
const countOf = (res) => {
  const m = /\/(\d+)$/.exec(res.headers.get('content-range') || '');
  return m ? Number(m[1]) : 0;
};

async function withTimeout(fn, ms = 7000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    return await fn(ac.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function submitGlobal(entry) {
  return withTimeout(async (signal) => {
    const ins = await api('scores', { method: 'POST', body: entry, headers: { Prefer: 'return=representation' }, signal });
    const row = (await ins.json())[0];
    const countHeaders = { Prefer: 'count=exact', Range: '0-0' };
    const [top, ahead, all] = await Promise.all([
      api('scores?select=id,name,score,won,title&order=score.desc,created_at.asc&limit=10', { signal }).then((r) => r.json()),
      api(`scores?select=id&score=gt.${row.score}`, { headers: countHeaders, signal }).then(countOf),
      api('scores?select=id', { headers: countHeaders, signal }).then(countOf),
    ]);
    return { source: 'global', id: row.id, rank: ahead + 1, total: Math.max(all, ahead + 1), top };
  });
}

// Save a score and work out where it ranks. Never throws: a failed network call falls back to this device.
// entry: { name, score, won, title }
export async function submitScore(entry) {
  const clean = { ...entry, name: cleanName(entry.name) };
  if (!clean.name) throw new Error('Enter a name first.');
  saveName(clean.name);
  if (isGlobal()) {
    try {
      return await submitGlobal(clean);
    } catch {
      return { ...submitLocal(clean), fellBack: true };
    }
  }
  return submitLocal(clean);
}

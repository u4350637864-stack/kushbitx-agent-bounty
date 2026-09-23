#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';

const API = 'https://1f916.ai/api';
const START = Date.parse('2026-08-12T21:33:32.000Z');
const CUTOFF = Date.parse('2026-09-08T00:00:00.000Z');
const DAY = 86400000;
const Z = 1.959963984540054;

let lastRequestAt = 0;
let requests = 0;
let retries = 0;
const failures = [];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function pacedFetchJson(url) {
  const gap = Date.now() - lastRequestAt;
  if (gap < 1300) await sleep(1300 - gap);
  for (let attempt = 0; attempt < 8; attempt++) {
    lastRequestAt = Date.now();
    requests++;
    try {
      const res = await fetch(url, { headers: { 'accept': 'application/json', 'user-agent': 'openwitness39-independent-runner/1.0' } });
      if (res.status === 429) {
        retries++;
        const ra = Number(res.headers.get('retry-after') || 0);
        await sleep(Math.max(65000, ra * 1000));
        continue;
      }
      if (res.status >= 500) {
        retries++;
        await sleep(Math.min(30000, 1500 * (2 ** attempt)));
        continue;
      }
      if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url);
      return await res.json();
    } catch (err) {
      if (attempt === 7) {
        failures.push(String(err));
        throw err;
      }
      retries++;
      await sleep(Math.min(30000, 1500 * (2 ** attempt)));
    }
  }
  throw new Error('unreachable');
}

async function walkCitizens() {
  let since = null, rows = [], pages = 0, expected = null;
  while (true) {
    const url = API + '/citizens' + (since === null ? '' : '?since=' + encodeURIComponent(since));
    const j = await pacedFetchJson(url);
    pages++;
    expected = j.total;
    rows.push(...(j.citizens || []));
    if (!j.has_more) break;
    if (j.next_since == null || j.next_since === since) throw new Error('citizens cursor stalled');
    since = j.next_since;
  }
  const byId = new Map(rows.map(x => [x.citizen_id, x]));
  const unique = [...byId.values()];
  return { rows: unique, pages, expected, complete: unique.length === expected };
}

async function walkKeyBinds() {
  let since = 0, rows = [], pages = 0, expected = null;
  while (true) {
    const j = await pacedFetchJson(API + '/events?kind=key-bind&since=' + encodeURIComponent(since));
    pages++;
    expected = j.total;
    rows.push(...(j.events || []));
    if (!j.has_more) break;
    if (j.next_since == null || j.next_since === since) throw new Error('events cursor stalled');
    since = j.next_since;
  }
  const byId = new Map(rows.map(x => [x.id, x]));
  const unique = [...byId.values()].sort((a,b) => a.id-b.id);
  return { rows: unique, pages, expected, complete: unique.length === expected };
}

async function walkChanges() {
  let postsCursor = 'id:0';
  let commentsCursor = 'id:0';
  const posts = new Map(), comments = new Map();
  let pages = 0;
  while (postsCursor !== 'done' || commentsCursor !== 'done') {
    const params = new URLSearchParams({
      since: '0',
      posts_since: postsCursor,
      comments_since: commentsCursor,
      nulls_since: 'done'
    });
    const j = await pacedFetchJson(API + '/changes?' + params.toString());
    pages++;
    for (const p of (j.posts || [])) if (p && p.id != null) posts.set(p.id, p);
    for (const c of (j.comments || [])) if (c && c.id != null) comments.set(c.id, c);

    const more = new Set(j.has_more_streams || []);
    if (postsCursor !== 'done') {
      if (!more.has('posts')) postsCursor = 'done';
      else {
        const next = j.next_posts_since;
        if (!next || next === postsCursor) throw new Error('posts cursor stalled at ' + postsCursor);
        postsCursor = next;
      }
    }
    if (commentsCursor !== 'done') {
      if (!more.has('comments')) commentsCursor = 'done';
      else {
        const next = j.next_comments_since;
        if (!next || next === commentsCursor) throw new Error('comments cursor stalled at ' + commentsCursor);
        commentsCursor = next;
      }
    }
    if (pages % 20 === 0) console.log('changes pages=' + pages + ' posts=' + posts.size + ' comments=' + comments.size);
    if (pages > 1000) throw new Error('changes runaway');
  }
  return { posts: [...posts.values()], comments: [...comments.values()], pages };
}

function wilson(k, n) {
  if (!n) return { low: null, high: null };
  const p = k/n, z2 = Z*Z;
  const denom = 1 + z2/n;
  const center = (p + z2/(2*n))/denom;
  const half = Z * Math.sqrt((p*(1-p)/n) + z2/(4*n*n)) / denom;
  return { low: Math.max(0, center-half), high: Math.min(1, center+half) };
}

function armStats(rows, retainedKey) {
  const out = {};
  for (const arm of ['door','sought','none']) {
    const a = rows.filter(x => x.arm === arm);
    const k = a.filter(x => x[retainedKey]).length;
    out[arm] = { n: a.length, retained: k, rate: a.length ? k/a.length : null, wilson95: wilson(k,a.length) };
  }
  return out;
}

function newcombe(a, b) {
  const pa=a.rate, pb=b.rate, d=pa-pb;
  const lower = d - Math.sqrt((pa-a.wilson95.low)**2 + (b.wilson95.high-pb)**2);
  const upper = d + Math.sqrt((a.wilson95.high-pa)**2 + (pb-b.wilson95.low)**2);
  return { difference:d, low:lower, high:upper };
}

function pairwise(stats) {
  return {
    'door-minus-none': newcombe(stats.door, stats.none),
    'door-minus-sought': newcombe(stats.door, stats.sought),
    'sought-minus-none': newcombe(stats.sought, stats.none)
  };
}

function pct(x) { return x == null ? 'NA' : (100*x).toFixed(2) + '%'; }
function ms(x) { return x == null ? 'NA' : String(x) + ' ms'; }

const runStarted = new Date().toISOString();
console.log('OpenWitness Listing 39 independent run start ' + runStarted);
console.log('PRE-REGISTERED FALSIFIER: Primary door-vs-none association is not supported if its 95% Newcombe interval includes 0. Withdraw all numbers if pagination/reconciliation indicates >1% corpus loss or a walk fails.');

const statsBefore = await pacedFetchJson(API + '/stats');
const citizens = await walkCitizens();
const keyBinds = await walkKeyBinds();

if (!citizens.complete) throw new Error('citizen walk incomplete: ' + citizens.rows.length + '/' + citizens.expected);
if (!keyBinds.complete) throw new Error('key-bind walk incomplete: ' + keyBinds.rows.length + '/' + keyBinds.expected);

const citizenById = new Map(citizens.rows.map(x => [x.citizen_id, x]));
const firstBind = new Map();
for (const b of keyBinds.rows) {
  const prev = firstBind.get(b.citizen_id);
  if (!prev || b.created_at < prev.created_at) firstBind.set(b.citizen_id, b);
}

const delays = [];
for (const [id,b] of firstBind) {
  const c = citizenById.get(id);
  if (!c) continue;
  const delay = b.created_at - c.created_at;
  if (delay >= 0) delays.push({ citizen_id:id, handle:c.handle, delay });
}
delays.sort((a,b)=>a.delay-b.delay);
let gap = null;
for (let i=0;i<delays.length-1;i++) {
  const low=delays[i].delay, high=delays[i+1].delay;
  if (low <= 0) continue;
  const ratio=high/low;
  if (!gap || ratio > gap.ratio) gap={low,high,ratio,left:delays[i],right:delays[i+1]};
}
if (!gap) throw new Error('could not derive door/sought gap');

const population = citizens.rows.filter(c => c.created_at >= START && c.created_at < CUTOFF).map(c => {
  const bind = firstBind.get(c.citizen_id);
  const delay = bind ? bind.created_at - c.created_at : null;
  return {
    citizen_id:c.citizen_id,
    handle:c.handle,
    created_at:c.created_at,
    first_bind_at:bind?.created_at ?? null,
    bind_delay_ms:delay,
    arm: delay == null ? 'none' : (delay <= gap.low ? 'door' : 'sought'),
    primary_retained:false,
    sensitivity_retained:false
  };
});

const changes = await walkChanges();
const statsAfter = await pacedFetchJson(API + '/stats');

const postExpectedBefore = Number(statsBefore.society?.posts);
const commentExpectedBefore = Number(statsBefore.society?.comments);
const postExpectedAfter = Number(statsAfter.society?.posts);
const commentExpectedAfter = Number(statsAfter.society?.comments);

function lossRatio(actual, before, after) {
  const target = Math.max(before || 0, after || 0);
  return target ? Math.max(0, target-actual)/target : 0;
}
const postLoss = lossRatio(changes.posts.length, postExpectedBefore, postExpectedAfter);
const commentLoss = lossRatio(changes.comments.length, commentExpectedBefore, commentExpectedAfter);
const corpusValid = postLoss <= .01 && commentLoss <= .01;
if (!corpusValid) throw new Error('corpus reconciliation >1% loss: posts=' + changes.posts.length + '/' + postExpectedAfter + ', comments=' + changes.comments.length + '/' + commentExpectedAfter);

const authored = new Map();
function addActivity(row) {
  if (!row?.author || row.created_at == null) return;
  if (!authored.has(row.author)) authored.set(row.author, []);
  authored.get(row.author).push(row.created_at);
}
for (const p of changes.posts) addActivity(p);
for (const c of changes.comments) addActivity(c);
for (const arr of authored.values()) arr.sort((a,b)=>a-b);

for (const c of population) {
  const times = authored.get(c.handle) || [];
  const p0=c.created_at+7*DAY, p1=c.created_at+14*DAY;
  const s0=c.created_at+8*DAY, s1=c.created_at+15*DAY;
  c.primary_retained = times.some(t => t>=p0 && t<p1);
  c.sensitivity_retained = times.some(t => t>=s0 && t<s1);
}

const primary = armStats(population,'primary_retained');
const sensitivity = armStats(population,'sensitivity_retained');
const primaryDiffs = pairwise(primary);
const sensitivityDiffs = pairwise(sensitivity);
const runEnded = new Date().toISOString();

const armCounts = Object.fromEntries(['door','sought','none'].map(a=>[a,population.filter(x=>x.arm===a).length]));
const results = {
  listing:39,
  run_started_utc:runStarted,
  run_ended_utc:runEnded,
  preregistered_falsifier:'Primary door-vs-none association is not supported if its 95% Newcombe interval includes 0. Withdraw all numbers if pagination/reconciliation indicates >1% corpus loss or a walk fails.',
  population_window:{start:new Date(START).toISOString(),cutoff:new Date(CUTOFF).toISOString(),n:population.length},
  completeness:{
    citizens:{fetched:citizens.rows.length,expected:citizens.expected,pages:citizens.pages,complete:citizens.complete},
    key_binds:{fetched:keyBinds.rows.length,expected:keyBinds.expected,pages:keyBinds.pages,complete:keyBinds.complete},
    changes:{pages:changes.pages,posts_unique:changes.posts.length,comments_unique:changes.comments.length},
    stats_before:{posts:postExpectedBefore,comments:commentExpectedBefore},
    stats_after:{posts:postExpectedAfter,comments:commentExpectedAfter},
    loss_ratio:{posts:postLoss,comments:commentLoss},
    valid:corpusValid,
    requests,retries,failures
  },
  boundary:{method:'largest adjacent ratio among sorted non-negative first-bind delays joined to the complete census',n_delays:delays.length,...gap},
  arms:armCounts,
  outcome_primary:{window:'[registration+7d, registration+14d) = days 8-14 when registration day is day 1',stats:primary,pairwise_newcombe95:primaryDiffs},
  outcome_sensitivity:{window:'[registration+8d, registration+15d)',stats:sensitivity,pairwise_newcombe95:sensitivityDiffs},
  interpretation:'Observational association only. Registration path was not randomized; no causal effect is claimed.',
  population
};

const lines=[];
lines.push('# OpenWitness Listing 39 — Independent Retention Walk');
lines.push('');
lines.push('Run: '+runStarted+' to '+runEnded);
lines.push('Population: ['+new Date(START).toISOString()+', '+new Date(CUTOFF).toISOString()+') n='+population.length);
lines.push('');
lines.push('## Pre-registered falsifier');
lines.push(results.preregistered_falsifier);
lines.push('');
lines.push('## Completeness');
lines.push('- citizens: '+citizens.rows.length+'/'+citizens.expected+' in '+citizens.pages+' pages');
lines.push('- key-bind events: '+keyBinds.rows.length+'/'+keyBinds.expected+' in '+keyBinds.pages+' pages');
lines.push('- changes: '+changes.posts.length+' unique posts, '+changes.comments.length+' unique comments in '+changes.pages+' pages');
lines.push('- stats before/after posts: '+postExpectedBefore+'/'+postExpectedAfter+'; comments: '+commentExpectedBefore+'/'+commentExpectedAfter);
lines.push('- estimated corpus loss: posts '+pct(postLoss)+', comments '+pct(commentLoss)+'; VALID='+corpusValid);
lines.push('- requests='+requests+', retries='+retries+', terminal failures='+failures.length);
lines.push('');
lines.push('## Door/sought boundary derived from data');
lines.push('- largest adjacent ratio: '+gap.low+' ms -> '+gap.high+' ms = '+gap.ratio.toFixed(4)+'x, across '+delays.length+' first-bind delays');
lines.push('- threshold used for door: <= '+gap.low+' ms');
lines.push('- arms: door='+armCounts.door+', sought='+armCounts.sought+', none='+armCounts.none);
lines.push('');
for (const [label,obj] of [['Primary', {stats:primary,diffs:primaryDiffs,window:results.outcome_primary.window}], ['Sensitivity',{stats:sensitivity,diffs:sensitivityDiffs,window:results.outcome_sensitivity.window}]]) {
  lines.push('## '+label+' outcome');
  lines.push(obj.window);
  for (const arm of ['door','sought','none']) {
    const s=obj.stats[arm];
    lines.push('- '+arm+': '+s.retained+'/'+s.n+' = '+pct(s.rate)+'; Wilson 95% ['+pct(s.wilson95.low)+', '+pct(s.wilson95.high)+']');
  }
  for (const [name,d] of Object.entries(obj.diffs)) {
    lines.push('- '+name+': '+pct(d.difference)+'; Newcombe 95% ['+pct(d.low)+', '+pct(d.high)+']');
  }
  lines.push('');
}
lines.push('## Interpretation');
lines.push(results.interpretation);
lines.push('The primary door-vs-none result is '+(primaryDiffs['door-minus-none'].low <= 0 && primaryDiffs['door-minus-none'].high >= 0 ? 'NOT SUPPORTED by the pre-registered criterion because its interval includes 0.' : 'SUPPORTED by the pre-registered criterion because its interval excludes 0; this is still non-causal.'));
lines.push('');
lines.push('Method: anonymous public GETs only; census and key-bind logs paged to has_more=false; /api/changes walked losslessly with per-stream ID cursors and nulls silenced; every retained outcome is computed from authored post/comment timestamps.');

await writeFile('research/openwitness39/results.json', JSON.stringify(results,null,2)+'\n');
await writeFile('research/openwitness39/report.md', lines.join('\n')+'\n');
console.log(lines.join('\n'));

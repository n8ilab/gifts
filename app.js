/* North Pole v2 front end (Nathan's family Christmas HQ). Self contained: no CDNs, no trackers. */
const API = localStorage.getItem('np.api') || 'https://north-pole.n8ilab.workers.dev';
const C = window.NP_CONTENT;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = u => /^https?:\/\//i.test(String(u || '')) ? esc(u) : '';
const money = n => '$' + (+n || 0).toFixed(2).replace(/\.00$/, '');
const COL = { kays: '#7c3aed', florys: '#c8102e', gammys: '#0f766e', patschkes: '#b45309', wolfes: '#1d4ed8' };
const PAL = ['#0e7490', '#be185d', '#4d7c0f', '#9333ea', '#b91c1c', '#0369a1', '#a16207', '#047857'];
const famCol = f => COL[f] || PAL[[...String(f)].reduce((a, c) => a + c.charCodeAt(0), 0) % PAL.length];
const ST = { idea: 'Idea', ordered: 'Ordered', delivered: 'Delivered', wrapped: 'Wrapped' }, STK = Object.keys(ST);
const FR = { parent: ['👪', 'Parent'], santa: ['🎅', 'Santa'], stocking: ['🧦', 'Stocking'] };
const EK = { party: '🎉', program: '🎭', travel: '✈️', church: '⛪', school: '🏫', other: '📌' }, MK = { eve: '🌙 Christmas Eve', day: '🎄 Christmas Day', other: '🍽️ Gathering' };
const DC = { appetizer: 'Appetizers', main: 'Mains', side: 'Sides', bread: 'Bread', dessert: 'Desserts', drink: 'Drinks', other: 'Other' };
let TOK = localStorage.getItem('np.tok'), S = null, TAB = 'hq', SUB = {}, VIEWP = null, PF = 'all', PEOPLE0 = null, PIN = '', LUSER = null, IDLE = Date.now(), PEND = null, PH = {}, OFFLINE = false;
const PREF = JSON.parse(localStorage.getItem('np.prefs') || '{}');
const applyPrefs = () => { document.documentElement.dataset.theme = PREF.theme === 'dark' ? 'dark' : ''; document.body.classList.toggle('snowing', !!PREF.snow); $('snowAll') && snowAll(); };
const savePref = (k, v) => { PREF[k] = v; localStorage.setItem('np.prefs', JSON.stringify(PREF)); applyPrefs(); };
const TODAY = () => { const o = localStorage.getItem('np.today'); return o ? new Date(o + 'T12:00:00') : new Date(); };
const iso = d => { const z = new Date(d); return `${z.getFullYear()}-${String(z.getMonth() + 1).padStart(2, '0')}-${String(z.getDate()).padStart(2, '0')}`; };
const todayIso = () => iso(TODAY());
const addDays = (d, n) => { const z = new Date(d); z.setDate(z.getDate() + n); return z; };
const xmasDate = () => new Date((S ? S.christmas : TODAY().getFullYear() + '-12-25') + 'T00:00:00');
const days = () => Math.max(0, Math.ceil((xmasDate() - TODAY()) / 864e5));
const fmtD = (s, o = { weekday: 'short', month: 'short', day: 'numeric' }) => s ? new Date(s + 'T12:00:00').toLocaleDateString(undefined, o) : '';
const fmtT = t => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return `${(h % 12) || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
const toast = (m, ms = 2200) => { const t = $('toast'); t.textContent = m; t.style.display = 'block'; clearTimeout(t._t); t._t = setTimeout(() => t.style.display = 'none', ms); };
const pName = id => (S.people.find(p => p.id === id) || {}).name || id;
const person = id => S.people.find(p => p.id === id);
const contact = id => (S.contacts || []).find(c => c.id === id);
const rName = rk => !rk ? '?' : rk.startsWith('u:') ? pName(rk.slice(2)) : rk.startsWith('c:') ? (contact(rk.slice(2)) || { name: 'someone' }).name : rk.slice(2);
const uid = () => S.me.id, kid = () => S.me.kid;
const who = w => w === S.me.id ? 'you' : w.startsWith && w.startsWith('n:') ? w.slice(2) : pName(w);

// ---------- network
async function call(path, body) {
  let r; try { r = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Token': TOK || '' }, body: JSON.stringify(body || {}) }); }
  catch { throw new Error('No connection to the North Pole right now.'); }
  const j = await r.json().catch(() => ({ error: 'North Pole server is napping. Try again in a minute.' }));
  if (r.status === 401 && path !== '/api/login') { signOut(true); throw new Error(j.error); }
  if (!r.ok) throw new Error(j.error || 'Something went wrong'); return j;
}
const setState = s => { S = s; OFFLINE = false; $('offline').style.display = 'none'; try { localStorage.setItem('np.state', JSON.stringify(s)); } catch {} };
const act = async (a, b, msg) => { try { const j = await call('/api/act', { a, b }); setState(j.state); render(); if (msg) toast(msg); return j.r; } catch (e) { toast('⚠ ' + e.message, 3500); throw e; } };
async function refresh(quiet) { try { setState(await call('/api/state')); render(); if (!quiet) { closeSheet(); toast('Up to date'); } } catch (e) { if (!quiet) toast(e.message); } }

// ---------- photos (resized on the phone, stored in their own table, fetched with the token -> blob URLs)
async function shrink(file) {
  const bmp = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = URL.createObjectURL(file); });
  let max = 1024, q = 0.72, out;
  for (let t = 0; t < 4; t++) {
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); out = c.toDataURL('image/jpeg', q);
    if (out.length * 0.75 < 150 * 1024) break; q -= 0.12; if (t >= 1) max = Math.round(max * 0.8);
  }
  URL.revokeObjectURL(bmp.src); return out;
}
function pickPhoto(cam, cb) {
  const i = $('phIn'); if (cam) i.setAttribute('capture', 'environment'); else i.removeAttribute('capture'); i.value = '';
  i.onchange = async () => { const f = i.files[0]; if (!f) return; if (!/^image\//.test(f.type)) return toast('That is not a picture'); try { cb(await shrink(f)); } catch { toast('Could not read that picture'); } };
  i.click();
}
async function upload(kind, ref, data) { const j = await call('/api/photo', { kind, ref, data }); setState(j.state); return j.id; }
async function delPhoto(id) { if (!confirm('Remove this photo?')) return; const j = await call('/api/photo/del', { id }); setState(j.state); render(); toast('Photo removed'); }
function hydrate() {
  document.querySelectorAll('img[data-ph]').forEach(img => {
    const id = img.dataset.ph; if (PH[id]) { img.src = PH[id]; return; }
    if (PH[id] === null) return; PH[id] = null;
    fetch(API + '/api/photo/' + id, { headers: { 'X-Token': TOK || '' } }).then(r => r.ok ? r.blob() : null).then(b => { if (!b) { delete PH[id]; return; } PH[id] = URL.createObjectURL(b); document.querySelectorAll(`img[data-ph="${id}"]`).forEach(x => x.src = PH[id]); }).catch(() => delete PH[id]);
  });
}
const img = (id, cls = 'thumb') => id ? `<img data-ph="${esc(id)}" class="${cls}" alt="">` : '';
// photo field inside a sheet: shows current/pending picture + camera/choose/remove buttons
function phField(cur, label = 'Photo') {
  return `<label>${label}</label><div class="phbox" id="phBox">${cur ? img(cur) : PEND ? `<img src="${PEND}">` : `<div class="thumb" style="display:grid;place-items:center;font-size:24px">📷</div>`}
    <div style="display:flex;flex-direction:column;gap:6px;flex:1"><div style="display:flex;gap:6px"><button type="button" class="btn sm ghost" onclick="pickPhoto(true,setPend)">📷 Camera</button><button type="button" class="btn sm ghost" onclick="pickPhoto(false,setPend)">🖼 Choose</button></div>
    ${cur ? `<button type="button" class="btn sm ghost" onclick="delPhoto('${esc(cur)}');closeSheet()">Remove photo</button>` : ''}</div></div>`;
}
function setPend(d) { PEND = d; const b = $('phBox'); if (b) b.querySelector('img,div.thumb').outerHTML = `<img src="${d}" style="width:72px;height:72px;border-radius:12px;object-fit:cover">`; }
async function flushPhoto(kind, ref) { if (!PEND) return; const d = PEND; PEND = null; try { await upload(kind, ref, d); render(); } catch (e) { toast('⚠ Photo: ' + e.message, 3500); } }
const av = (p, sz = 46) => `<div class="av" style="background:${famCol(p.family)};width:${sz}px;height:${sz}px;font-size:${sz * .42}px">${p.avatar ? img(p.avatar, '') : esc((p.name || '?')[0])}</div>`;
const avC = (c, sz = 46) => `<div class="av" style="background:#64748b;width:${sz}px;height:${sz}px;font-size:${sz * .42}px">${c.photo ? img(c.photo, '') : esc((c.name || '?')[0])}</div>`;

// ---------- login (family -> person -> PIN)
async function showLogin() {
  $('login').style.display = 'block'; $('lpin').style.display = 'none'; $('lwho').style.display = 'block';
  $('lcd').textContent = `${days()} sleeps till Christmas`;
  try { PEOPLE0 = PEOPLE0 || await (await fetch(API + '/api/people')).json(); } catch (e) { $('lwho').innerHTML = '<p style="color:#fecaca">The North Pole server is napping. Try again soon.</p>'; return; }
  $('lwho').innerHTML = Object.entries(PEOPLE0.families).map(([f, nm]) => { const ps = PEOPLE0.people.filter(p => p.family === f); return ps.length ? `<div class="fam"><b>${esc(nm)}</b><div class="ppl">${ps.map(p => `<button class="pp" data-u="${esc(p.id)}">${av(p)}${esc(p.name)}</button>`).join('')}</div></div>` : ''; }).join('')
    + `<p class="mut" style="color:#a7f3d0;max-width:460px;margin:14px auto 0">New family? Ask any grown-up already in the app to add you under <b>More → Add a family</b>.</p>`;
  $('lwho').querySelectorAll('[data-u]').forEach(b => b.onclick = () => pickUser(b.dataset.u));
}
function pickUser(u) {
  LUSER = PEOPLE0.people.find(p => p.id === u); PIN = ''; $('lwho').style.display = 'none'; $('lpin').style.display = 'block';
  $('lav').style.background = famCol(LUSER.family); $('lav').textContent = LUSER.name[0]; $('lnm').textContent = 'Hi ' + LUSER.name + '!'; $('lerr').textContent = ''; dots();
}
const dots = () => $('ldots').querySelectorAll('i').forEach((d, i) => d.classList.toggle('f', i < PIN.length));
$('lpad').innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map(k => k === '' ? '<span></span>' : `<button data-k="${k}">${k}</button>`).join('');
$('lpad').querySelectorAll('button').forEach(b => b.onclick = async () => {
  const k = b.dataset.k; if (k === '⌫') PIN = PIN.slice(0, -1); else if (PIN.length < 4) PIN += k; dots();
  if (PIN.length === 4) { try { const j = await call('/api/login', { user: LUSER.id, pin: PIN }); TOK = j.token; localStorage.setItem('np.tok', TOK); setState(j.state); $('login').style.display = 'none'; TAB = 'hq'; VIEWP = null; render(); toast(`Welcome, ${S.me.name}! 🎅`); }
    catch (e) { PIN = ''; dots(); $('lerr').textContent = e.message; $('ldots').classList.add('shake'); setTimeout(() => $('ldots').classList.remove('shake'), 400); } }
});
$('lback').onclick = showLogin;
function signOut(silent) { if (!silent && TOK) call('/api/logout').catch(() => {}); TOK = null; S = null; PH = {}; localStorage.removeItem('np.tok'); localStorage.removeItem('np.state'); closeSheet(); showLogin(); }
['click', 'touchstart', 'keydown'].forEach(e => addEventListener(e, () => IDLE = Date.now(), { passive: true }));
setInterval(() => { if (S && !S.me.kid && Date.now() - IDLE > 10 * 60e3) { signOut(); toast('🔒 Locked so nobody peeks'); } }, 30e3);

// ---------- shell
function render() {
  if (!S) return;
  $('cd').textContent = `🎄 ${days()} days till Christmas`;
  $('whoB').innerHTML = `${av(S.me, 26)}<span>${esc(S.me.name)}</span>`;
  const tabs = kid() ? [['hq', '🏠', 'Home'], ['lists', '🎁', 'Wish lists'], ['fun', '🎄', 'Fun'], ['more', '⭐', 'Me']]
    : [['hq', '🏠', 'HQ'], ['lists', '🎁', 'Wishes'], ['plan', '📝', 'Planner'], ['season', '📅', 'Season'], ['more', '⭐', 'More']];
  if (!tabs.some(t => t[0] === TAB)) TAB = 'hq';
  $('tabs').innerHTML = tabs.map(([k, i, l]) => `<button class="${TAB === k ? 'on' : ''}" data-t="${k}"><b>${i}</b>${l}</button>`).join('');
  $('tabs').querySelectorAll('button').forEach(b => b.onclick = () => { TAB = b.dataset.t; VIEWP = null; render(); scrollTo(0, 0); });
  ({ hq: kid() ? vKidHQ : vHQ, lists: vLists, plan: vPlan, season: vSeason, fun: vFun, more: vMore })[TAB]();
  hydrate();
}
const go = (tab, sub, p) => { TAB = tab; if (sub) SUB[tab] = sub; VIEWP = p || null; render(); scrollTo(0, 0); };
const chips = (tab, list) => `<div class="chips">${list.map(([k, l]) => `<button class="${(SUB[tab] || list[0][0]) === k ? 'on' : ''}" onclick="SUB['${tab}']='${k}';VIEWP=null;render()">${l}</button>`).join('')}</div>`;
const empty = (ico, txt) => `<div class="empty"><span class="ico">${ico}</span>${txt}</div>`;
$('whoB').onclick = () => sheet(`<h3><span>${esc(S.me.name)}</span><button class="x" onclick="closeSheet()">✕</button></h3>
  <button class="btn ghost wide" onclick="profileSheet()">👤 My profile, sizes + likes</button><div style="height:8px"></div><button class="btn ghost wide" onclick="refresh()">🔄 Refresh</button><div style="height:8px"></div><button class="btn wide" onclick="signOut()">🔒 Sign out</button>`);

// ---------- 🏠 Christmas HQ (grown-ups)
function weekTodo() {
  const t = TODAY(), in7 = addDays(t, 7), out = [], td = todayIso();
  for (const p of planItems()) if (!p.done && p.date <= iso(in7)) out.push({ ico: p.ico, text: p.text, sub: p.date < td ? '⚠ was due ' + fmtD(p.date) : 'by ' + fmtD(p.date), go: "go('season','plan')", late: p.date < td });
  const cards = S.cards || [], mb = (S.cardsMeta || {}).mailBy; if (cards.length && mb && mb <= iso(in7) && cards.some(c => !c.sent)) out.push({ ico: '💌', text: `${cards.filter(c => !c.sent).length} cards still to mail`, sub: 'mail by ' + fmtD(mb), go: "go('season','cards')" });
  for (const e of (S.events || []).filter(e => e.date >= td && e.date <= iso(in7))) out.push({ ico: EK[e.kind] || '📌', text: e.title, sub: fmtD(e.date) + (e.time ? ' ' + fmtT(e.time) : ''), go: "go('season','events')" });
  for (const m of S.meals || []) for (const d of m.dishes) if (d.who === uid() && m.date && m.date <= iso(in7) && m.date >= td) out.push({ ico: '🍲', text: `Bring ${d.name} to ${m.name}`, sub: fmtD(m.date), go: "go('season','meals')" });
  const ord = (S.gifts || []).filter(g => g.owner === uid() && g.status === 'ordered'); if (ord.length) out.push({ ico: '📦', text: `${ord.length} gift${ord.length > 1 ? 's' : ''} ordered: watch for delivery`, sub: ord.map(g => g.title).slice(0, 3).join(', '), go: "go('plan','gifts')" });
  for (const d of S.draws || []) if (d.mine && !(S.gifts || []).some(g => g.to === 'u:' + d.mine && g.owner === uid())) out.push({ ico: '🎅', text: `Secret Santa: get something for ${pName(d.mine)}`, sub: d.budget ? 'about ' + money(d.budget) : '', go: "go('season','santa')" });
  for (const l of (S.letters || []).filter(l => l.by !== uid() && !l.reply)) out.push({ ico: '✉️', text: `${pName(l.by)} wrote to Santa`, sub: 'Tap to read + write a reply from the North Pole', go: "go('season','letters')" });
  return out.sort((a, b) => (b.late ? 1 : 0) - (a.late ? 1 : 0)).slice(0, 8);
}
function vHQ() {
  $('ttl').textContent = 'Christmas HQ';
  const G = S.gifts || [], wrapped = G.filter(g => g.status === 'wrapped').length, cards = S.cards || [], sent = cards.filter(c => c.sent).length, dishes = (S.meals || []).flatMap(m => m.dishes).filter(d => d.who === uid()).length;
  const totB = Object.values(S.budgets || {}).reduce((a, b) => a + Object.values(b).reduce((x, y) => x + y, 0), 0), spent = G.filter(g => g.status !== 'idea').reduce((a, g) => a + g.cost, 0);
  const n = days(), xd = xmasDate();
  let h = `<div class="card hero"><div class="gold" style="font-weight:800;letter-spacing:1px;font-size:12px">COUNTDOWN</div><div class="big">${n === 0 ? '🎄 Today!' : n}</div><div class="mut">${n === 0 ? 'Merry Christmas, ' + esc(S.me.name) + '!' : (n === 1 ? 'sleep' : 'sleeps') + ' till Christmas · ' + xd.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
    <div class="stat" style="margin-top:12px"><div><b>${wrapped}/${G.length}</b><small>Wrapped</small></div><div><b>${sent}/${cards.length}</b><small>Cards sent</small></div><div><b>${dishes}</b><small>Dishes I bring</small></div></div></div>`;
  const okq = (S.wishes || []).filter(w => w.ok === false && w.canApprove);
  if (okq.length) h += `<div class="h">🗳️ Gift ideas waiting for your OK (${okq.length})</div><div class="card">` + okq.slice(0, 6).map(w => `<div class="row"><span style="font-size:22px">💡</span><div class="t"><b>${esc(w.title)}</b><small>for ${esc(pName(w.for))} · from ${esc(pName(w.by))}${w.price ? ' · ' + money(w.price) : ''}</small></div><div class="two" style="gap:6px;margin:0"><button class="btn sm claim" onclick="approveWish('${w.id}')">👍 OK</button><button class="btn sm ghost" onclick="declineWish('${w.id}')">✕</button></div></div>`).join('') + `</div>`;
  const mineWait = (S.wishes || []).filter(w => w.ok === false && w.by === uid()); if (mineWait.length) h += `<div class="mut" style="margin:6px 4px">⏳ ${mineWait.length} of your suggestion${mineWait.length > 1 ? 's are' : ' is'} waiting for an OK.</div>`;
  const todo = weekTodo();
  h += `<div class="h"><span>✅ This week</span><a class="lk" href="#" onclick="go('season','plan');return false">Full plan →</a></div><div class="card">` + (todo.map(t => `<div class="row" onclick="${t.go}"><span style="font-size:22px">${t.ico}</span><div class="t"><b>${esc(t.text)}</b><small style="${t.late ? 'color:var(--r2)' : ''}">${esc(t.sub)}</small></div><span class="mut">›</span></div>`).join('') || empty('🎉', "You're all set this week. Enjoy some cocoa.")) + `</div>`;
  h += `<div class="h">⚡ Quick</div><div class="grid3"><button class="qa" onclick="snapIdea()"><b>📸</b>Snap a gift idea</button><button class="qa" onclick="go('lists')"><b>🎁</b>Wish lists</button><button class="qa" onclick="contactSheet()"><b>👤</b>Add a person</button>
    <button class="qa" onclick="go('season','meals')"><b>🍽️</b>Meals</button><button class="qa" onclick="go('season','cards')"><b>💌</b>Cards</button><button class="qa" onclick="go('season','events')"><b>📅</b>Events</button></div>`;
  if (totB || spent) h += `<div class="h"><span>💰 Budget</span><a class="lk" href="#" onclick="go('plan','budget');return false">Details →</a></div><div class="card"><div style="display:flex;justify-content:space-between"><b>${money(spent)} spent</b><span class="mut">${totB ? 'of ' + money(totB) : 'no budgets set yet'}</span></div>${totB ? `<div class="bar"><i class="${spent > totB ? 'over' : ''}" style="width:${Math.min(100, spent / totB * 100)}%"></i></div>` : ''}</div>`;
  const doy = Math.floor((TODAY() - new Date(TODAY().getFullYear(), 0, 0)) / 864e5);
  h += `<div class="h">🧝 Elf on the shelf idea</div><div class="card"><div style="display:flex;gap:10px;align-items:center"><span style="font-size:30px">🧝</span><div><b>${esc(C.elf[(TODAY().getMonth() === 11 ? TODAY().getDate() - 1 : doy) % C.elf.length])}</b><div class="mut">A new one every day. Kids don't see this.</div></div></div></div>`;
  const mem = (S.memories || []).filter(m => m.photo).slice(-3).reverse();
  if (mem.length) h += `<div class="h"><span>📸 Memories</span><a class="lk" href="#" onclick="go('season','memories');return false">All →</a></div><div class="gal">${mem.map(m => `<figure onclick="go('season','memories')">${img(m.photo, '')}<figcaption>${esc(m.caption || '')}<small>${esc(pName(m.by))}</small></figcaption></figure>`).join('')}</div>`;
  $('view').innerHTML = h;
}
function snapIdea() {
  const ppl = S.people.filter(p => p.id !== uid()), cs = S.contacts || [];
  sheet(`<h3><span>📸 Snap a gift idea</span><button class="x" onclick="closeSheet()">✕</button></h3><div class="mut">Saw the perfect thing in a store? Snap it and pick who it's for. Only you (and who you share with) can see it.</div>
    <label>For</label><select class="in" id="sFor">${ppl.map(p => `<option value="u:${esc(p.id)}">${esc(p.name)}</option>`).join('')}${cs.map(c => `<option value="c:${esc(c.id)}">${esc(c.name)} (${esc(c.rel || 'my people')})</option>`).join('')}</select>
    <label>What is it?</label><input class="in" id="sT" placeholder="Blue hoodie at Target, $24…"><div class="two"><div><label>Price</label><input class="in" id="sP" inputmode="decimal" placeholder="$"></div><div><label>Store</label><input class="in" id="sS" placeholder="Target, Amazon…"></div></div>
    ${phField(null, 'Picture')}<button class="btn wide" id="sGo" style="margin-top:14px">Save to my planner</button>`);
  $('sGo').onclick = async () => { const id = await act('gift.save', { to: $('sFor').value, title: $('sT').value || 'Gift idea', cost: $('sP').value, store: $('sS').value, status: 'idea', from: 'parent', cat: 'gift' }, 'Saved 📸'); await flushPhoto('gift', id); closeSheet(); };
}

// ---------- 🏠 kids' home
function adventDay() { const t = TODAY(); return t.getMonth() === 11 ? Math.min(24, t.getDate()) : 0; }
function vKidHQ() {
  $('ttl').textContent = 'Hi ' + S.me.name + '!';
  const n = days(), d = adventDay(), opened = (S.advent || {}).opened || [], mine = S.wishes.filter(w => w.for === uid()).length;
  let h = `<div class="card hero"><div class="gold" style="font-weight:800;letter-spacing:1px;font-size:12px">SLEEPS TILL CHRISTMAS</div><div class="big">${n === 0 ? '🎄' : n}</div><div class="mut">${n === 0 ? 'Merry Christmas!!' : xmasDate().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div></div>`;
  h += `<div class="grid2"><button class="qa" onclick="go('fun','advent')"><b>🗓️</b>${d ? (opened.includes(d) ? 'Advent door ' + d + ' open' : 'Open door ' + d + '!') : 'Advent opens Dec 1'}</button><button class="qa" onclick="go('lists',null,'${uid()}')"><b>🎁</b>My wish list (${mine})</button>
    <button class="qa" onclick="go('fun','letter')"><b>✉️</b>Letter to Santa</button><button class="qa" onclick="go('fun','cookies')"><b>🍪</b>Cookie recipes</button></div>`;
  const j = C.advent[(d ? d - 1 : TODAY().getDate() % 24)][1];
  h += `<div class="h">😄 Joke of the day</div><div class="card"><b>${esc(j.split('?')[0])}${j.includes('?') ? '?' : ''}</b>${j.includes('?') ? `<div style="margin-top:6px">${esc(j.split('?').slice(1).join('?').trim())}</div>` : ''}</div>`;
  const rep = (S.letters || []).filter(l => l.by === uid() && l.reply); if (rep.length) h += `<div class="card" style="border-color:var(--gold)"><b>📬 You have mail from the North Pole!</b> <a class="lk" href="#" onclick="go('fun','letter');return false">Read it →</a></div>`;
  const ev = (S.events || []).filter(e => e.date >= todayIso()).slice(0, 3); if (ev.length) h += `<div class="h">📅 Coming up</div><div class="card">${ev.map(e => evRow(e, true)).join('')}</div>`;
  const mem = (S.memories || []).filter(m => m.photo).slice(-4).reverse(); h += `<div class="h"><span>📸 Memories</span><a class="lk" href="#" onclick="go('fun','memories');return false">All →</a></div>` + (mem.length ? `<div class="gal">${mem.map(m => `<figure>${img(m.photo, '')}<figcaption>${esc(m.caption || '')}</figcaption></figure>`).join('')}</div>` : `<div class="card">${empty('📷', 'No photos yet. Add one in Fun → Memories!')}</div>`);
  $('view').innerHTML = h;
}

// ---------- 🎁 wish lists
function vLists() {
  $('ttl').textContent = VIEWP ? (VIEWP === uid() ? 'My wish list' : pName(VIEWP) + "'s list") : 'Wish lists';
  if (!VIEWP) {
    const mine = S.wishes.filter(w => w.for === uid() && w.by === uid()).length;
    let h = `<div class="card" style="display:flex;align-items:center;gap:12px">${av(S.me)}<div style="flex:1"><b>My wish list</b><div class="mut">${mine} thing${mine === 1 ? '' : 's'} on it</div></div><button class="btn sm" onclick="openP('${uid()}')">Open</button></div>`;
    for (const [f, nm] of Object.entries(S.families)) {
      const ps = S.people.filter(p => p.family === f && p.id !== uid()); if (!ps.length) continue;
      h += `<div class="h">${esc(nm)}</div><div class="ppl">` + ps.map(p => {
        const ws = S.wishes.filter(w => w.for === p.id && w.ok !== false), open = ws.filter(w => !w.claimed).length, wait = S.wishes.filter(w => w.for === p.id && w.ok === false).length;
        return `<button class="pp" onclick="openP('${p.id}')">${av(p)}${esc(p.name)}<small>${ws.length ? (kid() ? ws.length + ' wishes' : open + ' open · ' + (ws.length - open) + ' taken') + (wait ? ' · ' + wait + ' to OK' : '') : (wait ? wait + ' idea' + (wait > 1 ? 's' : '') + ' to OK' : 'no list yet')}</small></button>`; }).join('') + '</div>';
    }
    if (!kid() && (S.contacts || []).length) h += `<div class="h"><span>👤 My people</span><a class="lk" href="#" onclick="go('plan','people');return false">Manage →</a></div><div class="ppl">${S.contacts.map(c => `<button class="pp" onclick="go('plan','people','${c.id}')">${avC(c)}${esc(c.name)}<small>${esc(c.rel || '')}</small></button>`).join('')}</div>`;
    $('view').innerHTML = h + `<div class="mut" style="text-align:center;margin:16px 6px">🤫 You never see who's getting you what, or ideas others add for you.</div>`;
    return;
  }
  const p = person(VIEWP), mine = VIEWP === uid();
  const ws = S.wishes.filter(w => w.for === VIEWP).sort((a, b) => (b.prio - a.prio) || (!!a.claimed - !!b.claimed));
  let h = `<button class="btn ghost sm" onclick="VIEWP=null;render()">← Everyone</button><div style="height:10px"></div>`;
  const pr = p.profile || {}, hints = [pr.sizes ? '📏 ' + pr.sizes : '', pr.likes ? '💛 ' + pr.likes : '', pr.allergies ? '⚠ ' + pr.allergies : '', pr.bday ? '🎂 ' + pr.bday : ''].filter(Boolean);
  h += `<div class="card" style="display:flex;gap:12px;align-items:center">${av(p, 54)}<div style="flex:1;min-width:0"><b>${esc(p.name)}</b><div class="mut">${hints.length ? hints.map(esc).join(' · ') : (mine ? 'Add your sizes + likes so people can shop smarter.' : 'No sizes or likes yet.')}</div></div>${mine ? `<button class="btn sm ghost" onclick="profileSheet()">Edit</button>` : ''}</div>`;
  h += `<div class="card">` + (ws.map(w => {
    const sug = w.by !== w.for, wait = w.ok === false; let right = '';
    if (wait) right = w.canApprove ? `<div class="two" style="gap:6px;margin:0"><button class="btn sm claim" onclick="approveWish('${w.id}')">👍 OK</button><button class="btn sm ghost" onclick="declineWish('${w.id}')">✕</button></div>` : `<span class="tag">⏳ waiting for an OK</span>`;
    else if (mine) right = `<button class="btn ghost sm" onclick="editWish('${w.id}')">Edit</button>`;
    else if (!kid()) right = w.claimed ? (w.claimed.by === uid() ? `<button class="btn sm claimed" onclick="unclaim('${w.id}')">✓ Mine</button>` : `<span class="tag claimed">✓ ${esc(w.claimed.name)}</span>`) : `<button class="btn sm claim" onclick="claim('${w.id}')">🎁 I'll get it</button>`;
    else if (w.claimed) right = `<span class="tag claimed">✓ taken</span>`;
    return `<div class="row">${w.photo ? img(w.photo) : ''}<div class="t"><b>${w.prio ? '❤️ ' : ''}${esc(w.title)}</b><small>${[w.price ? money(w.price) : '', w.size ? 'Size ' + esc(w.size) : '', w.note ? esc(w.note) : '', sug ? (wait ? '💡 suggested by ' : '💡 idea from ') + esc(pName(w.by)) : ''].filter(Boolean).join(' · ')}</small>
      ${safeUrl(w.link) ? `<a class="lk" href="${safeUrl(w.link)}" target="_blank" rel="noopener">View it ↗</a>` : ''}${!mine && w.by === uid() ? ` · <a class="lk" href="#" onclick="editWish('${w.id}');return false">edit my idea</a>` : ''}</div>${right}</div>`;
  }).join('') || empty('🎁', mine ? "Your list is empty. Add what you're wishing for!" : esc(p.name) + " hasn't added anything yet.")) + `</div>`;
  if (mine) h += `<button class="btn wide" onclick="editWish()">＋ Add to my wish list</button>`;
  else if (!kid()) h += `<button class="btn g wide" onclick="editWish(null,'${VIEWP}')">💡 Suggest a gift idea for ${esc(p.name)}</button><div class="mut" style="text-align:center;margin-top:8px">A suggestion waits for another grown-up to OK it. ${esc(p.name)} never sees ideas you add or who's buying.</div>`;
  $('view').innerHTML = h;
}
function openP(id) { VIEWP = id; TAB = 'lists'; render(); scrollTo(0, 0); }
function editWish(id, forId) {
  PEND = null; const w = id ? S.wishes.find(x => x.id === id) : { for: forId || uid() }, other = w.for !== uid();
  sheet(`<h3><span>${id ? 'Edit' : other ? '💡 Idea for ' + esc(pName(w.for)) : '🎁 Add a wish'}</span><button class="x" onclick="closeSheet()">✕</button></h3>
    <label>What is it?</label><input class="in" id="wT" value="${esc(w.title)}" placeholder="LEGO set, Ninja blender, hoodie…">
    <div class="two"><div><label>About how much?</label><input class="in" id="wP" inputmode="decimal" value="${w.price || ''}" placeholder="$"></div><div><label>Size / color</label><input class="in" id="wS" value="${esc(w.size)}" placeholder="M, blue…"></div></div>
    <label>Link (optional)</label><input class="in" id="wL" value="${esc(w.link)}" placeholder="Paste from Amazon, Target…">
    <label>Notes</label><input class="in" id="wN" value="${esc(w.note)}" placeholder="Any details">${phField(w.photo)}
    <label class="ck" style="margin-top:12px"><input type="checkbox" id="wH" ${w.prio ? 'checked' : ''}> ❤️ Really, really want this</label>
    <div style="display:flex;gap:8px;margin-top:14px">${id ? `<button class="btn ghost" onclick="delWish('${id}')">🗑</button>` : ''}<button class="btn wide" id="wGo">Save</button></div>`);
  $('wGo').onclick = async () => { const r = await act('wish.save', { id, for: w.for, title: $('wT').value, price: $('wP').value, size: $('wS').value, link: $('wL').value, note: $('wN').value, prio: $('wH').checked }, id ? 'Saved' : (other ? 'Suggested 💡 waiting for an OK' : 'Added ✨')); await flushPhoto('wish', r); closeSheet(); };
}
async function delWish(id) { if (confirm('Remove this?')) { await act('wish.del', { id }, 'Removed'); closeSheet(); } }
async function approveWish(id) { await act('wish.approve', { id }, '👍 Approved. Now anyone can claim it.'); }
async function declineWish(id) { if (confirm('Remove this suggestion?')) await act('wish.decline', { id }, 'Removed'); }
async function claim(id) { await act('claim', { wish: id }, "🎁 Got it! It's in your planner."); }
async function unclaim(id) { if (confirm('Let someone else get this one?')) await act('unclaim', { wish: id }, 'Released'); }

// ---------- 📝 planner tab: gifts | budget | my people
function vPlan() {
  const sub = SUB.plan || 'gifts'; $('ttl').textContent = { gifts: 'My gift planner', budget: 'Budget', people: 'My people' }[sub];
  let h = chips('plan', [['gifts', '🎁 Gifts'], ['budget', '💰 Budget'], ['people', '👤 My people']]);
  h += sub === 'gifts' ? planGifts() : sub === 'budget' ? planBudget() : planPeople();
  $('view').innerHTML = h;
}
function planRecips() {
  const rs = {}; (S.gifts || []).forEach(g => (rs[g.owner + '|' + g.to] = rs[g.owner + '|' + g.to] || []).push(g));
  Object.entries(S.budgets || {}).forEach(([o, b]) => Object.keys(b).forEach(rk => rs[o + '|' + rk] = rs[o + '|' + rk] || []));
  return rs;
}
function planGifts() {
  const G = S.gifts || [], spent = G.filter(g => g.status !== 'idea').reduce((a, g) => a + g.cost, 0);
  const totB = Object.values(S.budgets || {}).reduce((a, b) => a + Object.values(b).reduce((x, y) => x + y, 0), 0);
  let h = `<div class="stat"><div><b>${money(spent)}</b><small>Spent</small></div><div><b>${totB ? money(Math.max(0, totB - spent)) : '–'}</b><small>Left</small></div><div><b>${G.filter(g => g.status === 'wrapped').length}/${G.length}</b><small>Wrapped</small></div></div>`;
  if (totB) h += `<div class="bar" style="margin:8px 4px 0"><i class="${spent > totB ? 'over' : ''}" style="width:${Math.min(100, spent / totB * 100)}%"></i></div>`;
  h += `<div class="chips" style="margin-top:12px">${[['all', 'All'], ['todo', 'Not wrapped'], ['idea', '💭 Ideas'], ['santa', '🎅 Santa'], ['stocking', '🧦 Stocking']].map(([k, l]) => `<button class="${PF === k ? 'on' : ''}" onclick="PF='${k}';render()">${l}</button>`).join('')}<button onclick="printView('gifts')">🖨 Print</button><button onclick="printView('wrap')">🎀 Wrap list</button></div>`;
  const rs = planRecips(), keys = Object.keys(rs).sort((a, b) => rName(a.split('|')[1]).localeCompare(rName(b.split('|')[1])));
  const flt = g => PF === 'all' || (PF === 'todo' ? g.status !== 'wrapped' : PF === 'idea' ? g.status === 'idea' : g.from === PF);
  if (!keys.length) h += `<div class="card">${empty('🎁', 'Nothing yet. Tap <b>＋ Add a gift</b>, snap an idea in a store, or claim things from wish lists.')}</div>`;
  for (const k of keys) {
    const [own, rk] = k.split('|'), gs = rs[k].filter(flt), all = rs[k], b = ((S.budgets || {})[own] || {})[rk] || 0;
    const sp = all.filter(g => g.status !== 'idea').reduce((a, g) => a + g.cost, 0);
    if (!gs.length && PF !== 'all') continue;
    h += `<div class="h"><span>${esc(rName(rk))}${own !== uid() ? ' <span style="text-transform:none;color:var(--mut)">(' + esc(pName(own)) + "'s)</span>" : ''}</span><a class="lk" href="#" onclick="addGift('${esc(rk)}','${own}');return false">＋ add</a></div><div class="card">`;
    h += gs.map(g => `<div class="row"><button class="stp st-${g.status}" onclick="cycle('${g.id}')">${ST[g.status]}</button>${g.photo ? img(g.photo) : ''}
      <div class="t" onclick="addGift(null,null,'${g.id}')"><b>${esc(g.title)}</b><small>${FR[g.from][0]} ${FR[g.from][1]}${g.cat && g.cat !== 'gift' && C.categories[g.cat] ? ' · ' + C.categories[g.cat][0] + ' ' + C.categories[g.cat][1] : ''}${g.store ? ' · ' + esc(g.store) : ''}${g.wish ? ' · 🎁 from wish list' : ''}${g.hide ? ' · 🤫 ' + esc(g.hide) : ''}</small></div><span class="price">${money(g.cost)}</span></div>`).join('') || '<div class="empty">No gifts here yet</div>';
    h += `<div class="sum"><span>${all.filter(g => g.status !== 'idea').length} bought: ${money(sp)}</span><span>${b ? (sp > b ? '⚠ ' + money(sp - b) + ' over' : money(b - sp) + ' left of ' + money(b)) : `<a class="lk" href="#" onclick="setBudget('${esc(rk)}','${own}');return false">set budget</a>`}</span></div>`;
    if (b) h += `<div class="bar"><i class="${sp > b ? 'over' : ''}" style="width:${Math.min(100, sp / b * 100)}%"></i></div>`;
    h += `</div>`;
  }
  return h + `<div style="display:flex;gap:8px"><button class="btn wide" onclick="addGift()">＋ Add a gift</button><button class="btn g" onclick="snapIdea()">📸</button></div><div class="mut" style="text-align:center;margin-top:10px">Tap the colored button to move a gift along: Idea → Ordered → Delivered → Wrapped.</div>`;
}
async function cycle(id) { const g = S.gifts.find(x => x.id === id), n = STK[(STK.indexOf(g.status) + 1) % 4]; await act('gift.status', { id, status: n }, n === 'wrapped' ? '🎀 Wrapped!' : ST[n]); }
function recipOptions(sel) {
  const ppl = S.people.filter(p => p.id !== uid()).map(p => [`u:${p.id}`, p.name]), cs = (S.contacts || []).map(c => [`c:${c.id}`, c.name + (c.rel ? ' (' + c.rel + ')' : '')]);
  const extra = [...new Set((S.gifts || []).map(g => g.to).concat(Object.values(S.budgets || {}).flatMap(Object.keys)).filter(r => r.startsWith('n:')))].map(r => [r, r.slice(2)]);
  return [...ppl, ...cs, ...extra].map(([v, l]) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(l)}</option>`).join('') + `<option value="__new">＋ Someone else…</option>`;
}
const seg = (name, opts, cur) => `<div class="seg" data-seg="${name}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" class="${v === cur ? 'on' : ''}">${l}</button>`).join('')}</div>`;
const bindSeg = () => document.querySelectorAll('[data-seg] button').forEach(b => b.onclick = () => b.parentNode.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)));
const segV = n => document.querySelector(`[data-seg="${n}"] .on`).dataset.v;
function addGift(rk, own, id) {
  PEND = null; const g = id ? S.gifts.find(x => x.id === id) : { to: rk || '', status: 'idea', from: 'parent', owner: own || uid(), cat: 'gift' };
  sheet(`<h3><span>${id ? 'Edit gift' : '＋ Add a gift'}</span><button class="x" onclick="closeSheet()">✕</button></h3>
    <label>For</label><select class="in" id="gTo">${recipOptions(g.to)}</select><input class="in" id="gNew" placeholder="Name (teacher, neighbor, aunt…)" style="display:none;margin-top:6px">
    <label>Gift</label><input class="in" id="gT" value="${esc(g.title)}" placeholder="What is it?">
    <div class="two"><div><label>Cost</label><input class="in" id="gC" inputmode="decimal" value="${g.cost || ''}" placeholder="$"></div><div><label>Store</label><input class="in" id="gS" value="${esc(g.store)}" placeholder="Amazon, Target…"></div></div>
    <label>Status</label>${seg('status', STK.map(k => [k, ST[k]]), g.status)}
    <label>From</label>${seg('from', Object.entries(FR).map(([k, v]) => [k, v[0] + ' ' + v[1]]), g.from)}
    <label>Category</label><select class="in" id="gCat">${Object.entries(C.categories).map(([k, v]) => `<option value="${k}" ${(g.cat || 'gift') === k ? 'selected' : ''}>${v[0]} ${v[1]}</option>`).join('')}</select>
    <div class="two"><div><label>Link / notes</label><input class="in" id="gN" value="${esc(g.note || g.link)}" placeholder="Order #, tracking…"></div><div><label>Hiding spot 🤫</label><input class="in" id="gH" value="${esc(g.hide)}" placeholder="Closet, garage…"></div></div>
    ${phField(g.photo, 'Picture of it')}
    <div style="display:flex;gap:8px;margin-top:14px">${id ? `<button class="btn ghost" onclick="delGift('${id}')">🗑</button>` : ''}<button class="btn wide" id="gGo">Save</button></div>`);
  bindSeg();
  const sel = $('gTo'); if (!g.to) sel.value = '__new'; const chk = () => $('gNew').style.display = sel.value === '__new' ? 'block' : 'none'; sel.onchange = chk; chk();
  $('gGo').onclick = async () => {
    const to = sel.value === '__new' ? 'n:' + $('gNew').value.trim() : sel.value; if (to === 'n:') return toast('Who is it for?');
    const nt = $('gN').value;
    const r = await act('gift.save', { id, owner: g.owner, to, title: $('gT').value, cost: $('gC').value, store: $('gS').value, status: segV('status'), from: segV('from'), cat: $('gCat').value, hide: $('gH').value, note: nt, link: /^https?:/.test(nt) ? nt : '' }, 'Saved');
    await flushPhoto('gift', r); closeSheet();
  };
}
async function delGift(id) { if (confirm('Delete this gift?')) { await act('gift.del', { id }, 'Deleted'); closeSheet(); } }
function setBudget(rk, own) {
  const cur = (((S.budgets || {})[own || uid()]) || {})[rk] || '';
  sheet(`<h3><span>💰 Budget for ${esc(rName(rk))}</span><button class="x" onclick="closeSheet()">✕</button></h3><input class="in" id="bA" inputmode="decimal" value="${cur}" placeholder="$ amount"><div style="height:10px"></div><button class="btn wide" id="bGo">Save budget</button>`);
  $('bGo').onclick = async () => { await act('budget', { to: rk, owner: own, amount: $('bA').value }, 'Budget set'); closeSheet(); };
}
// simple inline SVG charts (no libraries)
function barChart(rows) { // rows: [{label, spent, budget}]
  if (!rows.length) return ''; const W = 600, rh = 34, H = rows.length * rh + 8, max = Math.max(1, ...rows.map(r => Math.max(r.spent, r.budget))), lw = 150, bw = W - lw - 70;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Budget vs spent by person">${rows.map((r, i) => { const y = i * rh + 6, bs = r.spent / max * bw, bb = r.budget / max * bw, over = r.budget && r.spent > r.budget;
    return `<text x="${lw - 8}" y="${y + 17}" text-anchor="end" font-size="13" font-weight="700" fill="currentColor">${esc(r.label.slice(0, 18))}</text>
    ${r.budget ? `<rect x="${lw}" y="${y + 4}" width="${bb}" height="18" rx="6" fill="currentColor" opacity=".12"/>` : ''}<rect x="${lw}" y="${y + 7}" width="${Math.max(2, bs)}" height="12" rx="5" fill="${over ? '#e63946' : '#2bb673'}"/>
    <text x="${lw + Math.max(bs, bb) + 6}" y="${y + 17}" font-size="12" fill="currentColor" opacity=".7">${money(r.spent)}${r.budget ? ' / ' + money(r.budget) : ''}</text>`; }).join('')}</svg>`;
}
function donut(parts) { // parts: [{label, value, color}]
  const tot = parts.reduce((a, p) => a + p.value, 0); if (!tot) return ''; let a0 = -Math.PI / 2, R = 54, r = 34, cx = 70, cy = 70;
  const arcs = parts.filter(p => p.value > 0).map(p => { const a1 = a0 + p.value / tot * Math.PI * 2, big = a1 - a0 > Math.PI ? 1 : 0, f = (ang, rad) => `${cx + rad * Math.cos(ang)} ${cy + rad * Math.sin(ang)}`;
    const d = p.value === tot ? `M ${f(a0, R)} A ${R} ${R} 0 1 1 ${f(a0 + Math.PI, R)} A ${R} ${R} 0 1 1 ${f(a0, R)} M ${f(a0, r)} A ${r} ${r} 0 1 0 ${f(a0 + Math.PI, r)} A ${r} ${r} 0 1 0 ${f(a0, r)} Z` : `M ${f(a0, R)} A ${R} ${R} 0 ${big} 1 ${f(a1, R)} L ${f(a1, r)} A ${r} ${r} 0 ${big} 0 ${f(a0, r)} Z`; a0 = a1; return `<path d="${d}" fill="${p.color}"/>`; }).join('');
  return `<div style="display:flex;gap:14px;align-items:center"><svg viewBox="0 0 140 140" width="120" height="120">${arcs}<text x="70" y="75" text-anchor="middle" font-size="15" font-weight="800" fill="currentColor">${money(tot)}</text></svg><div style="flex:1">${parts.filter(p => p.value > 0).map(p => `<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0"><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${p.color};margin-right:6px"></i>${esc(p.label)}</span><b>${money(p.value)}</b></div>`).join('')}</div></div>`;
}
function planBudget() {
  const G = S.gifts || [], rs = planRecips(), sum = f => G.filter(f).reduce((a, g) => a + g.cost, 0), spent = sum(g => g.status !== 'idea');
  const totB = Object.values(S.budgets || {}).reduce((a, b) => a + Object.values(b).reduce((x, y) => x + y, 0), 0);
  let h = `<div class="card"><div class="mut">Spent so far</div><div class="big">${money(spent)}${totB ? ` <span class="mut" style="font-size:16px">of ${money(totB)}</span>` : ''}</div>${totB ? `<div class="bar"><i class="${spent > totB ? 'over' : ''}" style="width:${Math.min(100, spent / totB * 100)}%"></i></div>` : ''}
    <div class="sum"><span>Still ideas: ${money(sum(g => g.status === 'idea'))}</span><span>Planned total: ${money(sum(() => true))}</span></div></div>`;
  const rows = Object.keys(rs).map(k => { const [own, rk] = k.split('|'); return { label: rName(rk), spent: rs[k].filter(g => g.status !== 'idea').reduce((a, g) => a + g.cost, 0), budget: ((S.budgets || {})[own] || {})[rk] || 0, rk, own }; }).sort((a, b) => b.spent + b.budget - a.spent - a.budget);
  if (rows.length) h += `<div class="h">Budget vs spent</div><div class="card">${barChart(rows)}<div class="mut" style="text-align:center">Green = spent, grey = budget. Red = over.</div></div>`;
  const cats = Object.entries(C.categories).map(([k, v], i) => ({ label: v[0] + ' ' + v[1], value: sum(g => (g.cat || 'gift') === k && g.status !== 'idea'), color: PAL[i % PAL.length] }));
  if (spent) h += `<div class="h">By category</div><div class="card">${donut(cats)}</div>`;
  h += `<div class="h">By who's giving it</div><div class="stat">${Object.entries(FR).map(([k, v]) => `<div><b>${money(sum(g => g.from === k && g.status !== 'idea'))}</b><small>${v[0]} ${v[1]}</small></div>`).join('')}</div>`;
  h += `<div class="h">By person</div><div class="card">` + (rows.map(r => `<div class="row" onclick="setBudget('${esc(r.rk)}','${r.own}')"><div class="t"><b>${esc(r.label)}</b><div class="bar"><i class="${r.budget && r.spent > r.budget ? 'over' : ''}" style="width:${r.budget ? Math.min(100, r.spent / r.budget * 100) : 0}%"></i></div></div><span class="price">${money(r.spent)}${r.budget ? ' / ' + money(r.budget) : ''}</span></div>`).join('') || empty('💰', 'Add gifts in your planner to see this.')) + `</div><div class="mut" style="text-align:center">Tap a person to set their budget.</div>`;
  const stores = {}; G.filter(g => g.status !== 'idea' && g.store).forEach(g => stores[g.store] = (stores[g.store] || 0) + g.cost);
  if (Object.keys(stores).length) h += `<div class="h">By store</div><div class="card">` + Object.entries(stores).sort((a, b) => b[1] - a[1]).map(([s, v]) => `<div class="row"><div class="t"><b>${esc(s)}</b></div><span class="price">${money(v)}</span></div>`).join('') + `</div>`;
  return h;
}
// ---- my people (contacts without a login)
function planPeople() {
  const cs = S.contacts || [];
  if (VIEWP) { const c = contact(VIEWP); if (c) return contactPage(c); VIEWP = null; }
  let h = `<div class="card"><div class="mut">Friends, teachers, coworkers, neighbors, in-laws, pets… anyone you shop for or send a card to. Only you ${(S.shares || {}).mine?.length ? '(and ' + S.shares.mine.map(pName).join(', ') + ') ' : ''}can see them.</div></div>`;
  h += cs.length ? `<div class="ppl">${cs.slice().sort((a, b) => a.name.localeCompare(b.name)).map(c => `<button class="pp" onclick="VIEWP='${c.id}';render()">${avC(c)}${esc(c.name)}<small>${esc(c.rel || '')}${c.owner !== uid() ? ' · ' + esc(pName(c.owner)) + "'s" : ''}</small></button>`).join('')}</div>` : `<div class="card">${empty('👤', 'No people yet. Add your first one!')}</div>`;
  return h + `<button class="btn wide" style="margin-top:10px" onclick="contactSheet()">＋ Add a person</button>`;
}
function contactPage(c) {
  const rk = 'c:' + c.id, gs = (S.gifts || []).filter(g => g.to === rk), b = ((S.budgets || {})[c.owner] || {})[rk] || 0, sp = gs.filter(g => g.status !== 'idea').reduce((a, g) => a + g.cost, 0), card = (S.cards || []).find(k => k.to === rk);
  let h = `<button class="btn ghost sm" onclick="VIEWP=null;render()">← My people</button><div style="height:10px"></div>`;
  h += `<div class="card" style="display:flex;gap:12px;align-items:center">${avC(c, 60)}<div style="flex:1;min-width:0"><b style="font-size:18px">${esc(c.name)}</b><div class="mut">${[c.rel, c.bday ? '🎂 ' + c.bday : '', c.sizes ? '📏 ' + c.sizes : ''].filter(Boolean).map(esc).join(' · ')}</div></div><button class="btn sm ghost" onclick="contactSheet('${c.id}')">Edit</button></div>`;
  if (c.likes || c.allergies || c.address || c.notes) h += `<div class="card">${c.likes ? `<div><b>💛 Likes:</b> ${esc(c.likes)}</div>` : ''}${c.allergies ? `<div><b>⚠ Allergies/diet:</b> ${esc(c.allergies)}</div>` : ''}${c.address ? `<div><b>📬 Address:</b> ${esc(c.address)}</div>` : ''}${c.notes ? `<div class="mut" style="margin-top:4px">${esc(c.notes)}</div>` : ''}</div>`;
  h += `<div class="h"><span>🎁 Gifts + ideas</span><a class="lk" href="#" onclick="addGift('${rk}','${c.owner}');return false">＋ add</a></div><div class="card">` + (gs.map(g => `<div class="row"><button class="stp st-${g.status}" onclick="cycle('${g.id}')">${ST[g.status]}</button>${g.photo ? img(g.photo) : ''}<div class="t" onclick="addGift(null,null,'${g.id}')"><b>${esc(g.title)}</b><small>${g.store ? esc(g.store) : ''}</small></div><span class="price">${money(g.cost)}</span></div>`).join('') || empty('💡', 'No ideas yet. Snap one in the store!'))
    + `<div class="sum"><span>${money(sp)} spent</span><span>${b ? money(b - sp) + ' left of ' + money(b) : `<a class="lk" href="#" onclick="setBudget('${rk}','${c.owner}');return false">set budget</a>`}</span></div></div>`;
  h += `<div class="h">💌 Christmas card</div><div class="card">${card ? `<div class="row"><div class="t"><b>${card.sent ? '✅ Sent' : '📝 On the list'}</b><small>${esc(card.address || c.address || 'no address')}</small></div><button class="btn sm ghost" onclick="cardSheet('${card.id}')">Edit</button></div>` : `<button class="btn sm ghost" onclick="cardSheet(null,'${rk}')">＋ Add to card list</button>`}</div>`;
  return h;
}
function contactSheet(id) {
  PEND = null; const c = id ? contact(id) : {}; const b = id ? (((S.budgets || {})[c.owner] || {})['c:' + id] || '') : '';
  sheet(`<h3><span>${id ? 'Edit ' + esc(c.name) : '👤 Add a person'}</span><button class="x" onclick="closeSheet()">✕</button></h3>
    <div class="two"><div><label>Name</label><input class="in" id="cN" value="${esc(c.name)}" placeholder="Mrs. Garcia"></div><div><label>Who are they?</label><input class="in" id="cR" list="rels" value="${esc(c.rel)}" placeholder="teacher, friend…"><datalist id="rels">${C.rels.map(r => `<option value="${r}">`).join('')}</datalist></div></div>
    ${phField(c.photo)}
    <div class="two"><div><label>Birthday</label><input class="in" id="cB" value="${esc(c.bday)}" placeholder="MM-DD or YYYY-MM-DD"></div><div><label>Sizes</label><input class="in" id="cS" value="${esc(c.sizes)}" placeholder="M shirt, 9 shoe"></div></div>
    <label>Likes / interests</label><input class="in" id="cL" value="${esc(c.likes)}" placeholder="coffee, gardening, Astros…">
    <label>Allergies / dietary</label><input class="in" id="cA" value="${esc(c.allergies)}" placeholder="nuts, gluten free…">
    <label>Address (for cards + shipping)</label><input class="in" id="cAd" value="${esc(c.address)}" placeholder="123 Main St, Bastrop TX 78602">
    <div class="two"><div><label>Gift budget</label><input class="in" id="cBu" inputmode="decimal" value="${b}" placeholder="$"></div><div><label>Notes</label><input class="in" id="cNo" value="${esc(c.notes)}" placeholder="Anything else"></div></div>
    <div style="display:flex;gap:8px;margin-top:14px">${id ? `<button class="btn ghost" onclick="delContact('${id}')">🗑</button>` : ''}<button class="btn wide" id="cGo">Save</button></div>`);
  $('cGo').onclick = async () => { if (!$('cN').value.trim()) return toast('Name please'); const r = await act('contact.save', { id, name: $('cN').value, rel: $('cR').value, bday: $('cB').value, sizes: $('cS').value, likes: $('cL').value, allergies: $('cA').value, address: $('cAd').value, budget: $('cBu').value, notes: $('cNo').value }, 'Saved'); await flushPhoto('contact', r); closeSheet(); if (!id) { TAB = 'plan'; SUB.plan = 'people'; VIEWP = r; render(); } };
}
async function delContact(id) { if (confirm('Remove this person? Their gifts stay in your planner under their name.')) { await act('contact.del', { id }, 'Removed'); VIEWP = null; closeSheet(); render(); } }

// ---------- 📅 season tab (grown-ups)
function vSeason() {
  const sub = SUB.season || 'plan';
  $('ttl').textContent = { plan: 'Countdown plan', cards: 'Christmas cards', meals: 'Meals + potluck', grocery: 'Grocery list', events: 'Events', memories: 'Memories', recipes: 'Recipes', santa: 'Secret Santa', letters: 'Letters to Santa' }[sub];
  let h = chips('season', [['plan', '✅ Countdown'], ['cards', '💌 Cards'], ['meals', '🍽️ Meals'], ['grocery', '🛒 Grocery'], ['events', '📅 Events'], ['santa', '🎅 Santa'], ['memories', '📸 Memories'], ['recipes', '🍪 Recipes'], ['letters', '✉️ Letters']]);
  h += ({ plan: seasonPlan, cards: seasonCards, meals: seasonMeals, grocery: seasonGrocery, events: seasonEvents, santa: seasonSanta, memories: seasonMemories, recipes: seasonRecipes, letters: seasonLetters })[sub]();
  $('view').innerHTML = h;
}
// ---- countdown plan
function planItems() {
  const P = S.plan || { done: [], hidden: [], custom: [] }, x = xmasDate(), items = C.plan.map(([off, ico, text], i) => ({ key: 'p' + i, date: iso(addDays(x, -off)), ico, text })).filter(i => !P.hidden.includes(i.key));
  P.custom.forEach(c => items.push({ key: c.id, date: c.date || todayIso(), ico: '📝', text: c.text, custom: true }));
  return items.map(i => ({ ...i, done: P.done.includes(i.key) })).sort((a, b) => a.date.localeCompare(b.date));
}
function seasonPlan() {
  const items = planItems(), td = todayIso(), done = items.filter(i => i.done).length, past = items.filter(i => i.date < td && !i.done);
  let h = `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><div><b>${done} of ${items.length} done</b><div class="mut">Auto-built from today to Dec 25. Tick, hide or add your own.</div></div><button class="btn sm ghost" onclick="customTask()">＋ Task</button></div><div class="bar"><i style="width:${items.length ? done / items.length * 100 : 0}%"></i></div></div>`;
  if (past.length) h += `<div class="card" style="border-color:#fecaca"><b>⚠ ${past.length} behind</b> <span class="mut">Still worth doing, or tick to clear.</span></div>`;
  let lastWeek = ''; h += `<div class="card tl">`;
  for (const i of items) {
    const wk = i.date < td ? 'Earlier' : i.date === td ? 'Today' : fmtD(i.date, { month: 'long', day: 'numeric' }); if (wk !== lastWeek) { h += `<div class="day">${wk}</div>`; lastWeek = wk; }
    h += `<div class="row ${i.done ? 'done' : ''} ${!i.done && i.date < td ? 'late' : ''}"><button class="chk ${i.done ? 'on' : ''}" onclick="togglePlan('${i.key}')">${i.done ? '✓' : ''}</button><div class="t"><b>${i.ico} ${esc(i.text)}</b><small>${fmtD(i.date)}${i.custom ? ' · yours' : ''}</small></div><button class="btn sm ghost" onclick="hidePlan('${i.key}',${!!i.custom})">✕</button></div>`;
  }
  return h + `</div>`;
}
async function togglePlan(k) { const P = S.plan; const done = P.done.includes(k) ? P.done.filter(x => x !== k) : [...P.done, k]; await act('plan.save', { done }); }
async function hidePlan(k, custom) { const P = S.plan; if (custom) await act('plan.save', { custom: P.custom.filter(c => c.id !== k) }, 'Removed'); else await act('plan.save', { hidden: [...P.hidden, k] }, 'Hidden'); }
function customTask() { sheet(`<h3><span>＋ My task</span><button class="x" onclick="closeSheet()">✕</button></h3><label>What</label><input class="in" id="tT" placeholder="Order the ham"><label>When</label><input class="in" id="tD" type="date" value="${todayIso()}"><button class="btn wide" id="tGo" style="margin-top:12px">Add</button>`);
  $('tGo').onclick = async () => { if (!$('tT').value.trim()) return; await act('plan.save', { custom: [...S.plan.custom, { date: $('tD').value, text: $('tT').value }] }, 'Added'); closeSheet(); }; }
// ---- cards
function seasonCards() {
  const cs = (S.cards || []).slice().sort((a, b) => (a.sent - b.sent) || rName(a.to).localeCompare(rName(b.to))), M = S.cardsMeta || {}, sent = cs.filter(c => c.sent).length, rec = cs.filter(c => c.received).length;
  let h = `<div class="stat"><div><b>${cs.length}</b><small>On the list</small></div><div><b>${sent}</b><small>Sent</small></div><div><b>${rec}</b><small>Received</small></div></div>`;
  h += `<div class="card" style="margin-top:10px;display:flex;gap:12px;align-items:center">${M.photo ? img(M.photo) : '<div class="thumb" style="display:grid;place-items:center;font-size:26px">🖼️</div>'}<div style="flex:1"><b>Mail by: ${M.mailBy ? fmtD(M.mailBy) : 'not set'}</b><div class="mut">${M.mailBy ? Math.max(0, Math.ceil((new Date(M.mailBy + 'T12:00') - TODAY()) / 864e5)) + ' days left' : 'First-class mail needs about a week before Christmas.'}</div></div><button class="btn sm ghost" onclick="cardMetaSheet()">Edit</button></div>`;
  h += `<div class="chips"><button onclick="cardSheet()">＋ Add</button><button onclick="cardsAddFamily()">👨‍👩‍👧 Add all families</button><button onclick="printView('cards')">🖨 Print labels</button></div>`;
  h += `<div class="card">` + (cs.map(c => `<div class="row"><button class="chk ${c.sent ? 'on' : ''}" onclick="cardFlag('${c.id}','sent')">${c.sent ? '✓' : ''}</button><div class="t" onclick="cardSheet('${c.id}')"><b>${esc(c.name || rName(c.to))}</b><small>${esc(c.address || addrFor(c.to) || 'no address yet')}${c.note ? ' · ' + esc(c.note) : ''}</small></div><button class="btn sm ${c.received ? 'claimed' : 'ghost'}" onclick="cardFlag('${c.id}','received')">${c.received ? '📬 got one' : '📬'}</button></div>`).join('') || empty('💌', 'Who gets a card this year? Add people or pull in the whole family.')) + `</div>`;
  return h;
}
const addrFor = rk => rk.startsWith('u:') ? ((person(rk.slice(2)) || {}).profile || {}).address || '' : rk.startsWith('c:') ? (contact(rk.slice(2)) || {}).address || '' : '';
async function cardFlag(id, k) { const c = S.cards.find(x => x.id === id); await act('card.save', { ...c, [k]: !c[k] }, k === 'sent' && !c.sent ? '📮 Sent!' : undefined); }
function cardSheet(id, rk) {
  const c = id ? S.cards.find(x => x.id === id) : { to: rk || '', name: rk ? rName(rk) : '', address: rk ? addrFor(rk) : '' };
  sheet(`<h3><span>${id ? 'Edit card' : '💌 Add a card'}</span><button class="x" onclick="closeSheet()">✕</button></h3>
    <label>Who</label><select class="in" id="kTo">${recipOptions(c.to)}</select><input class="in" id="kNew" placeholder="The Smith Family" style="display:none;margin-top:6px">
    <label>Name on the envelope</label><input class="in" id="kN" value="${esc(c.name)}" placeholder="The Garcia Family"><label>Address</label><textarea class="in" id="kA" style="min-height:64px" placeholder="123 Main St\nBastrop, TX 78602">${esc(c.address)}</textarea>
    <label>Note</label><input class="in" id="kNo" value="${esc(c.note)}" placeholder="Include the kids' photo…"><div class="two" style="margin-top:8px"><label class="ck"><input type="checkbox" id="kS" ${c.sent ? 'checked' : ''}> Sent</label><label class="ck"><input type="checkbox" id="kR" ${c.received ? 'checked' : ''}> Received one</label></div>
    <div style="display:flex;gap:8px;margin-top:14px">${id ? `<button class="btn ghost" onclick="act('card.del',{id:'${id}'},'Removed').then(closeSheet)">🗑</button>` : ''}<button class="btn wide" id="kGo">Save</button></div>`);
  const sel = $('kTo'); if (!c.to) sel.value = '__new'; const chk = () => { $('kNew').style.display = sel.value === '__new' ? 'block' : 'none'; if (sel.value !== '__new') { if (!$('kN').value) $('kN').value = rName(sel.value); if (!$('kA').value) $('kA').value = addrFor(sel.value); } }; sel.onchange = chk; chk();
  $('kGo').onclick = async () => { const to = sel.value === '__new' ? 'n:' + ($('kNew').value.trim() || $('kN').value.trim()) : sel.value; if (to === 'n:') return toast('Who is it for?'); await act('card.save', { id, to, name: $('kN').value, address: $('kA').value, note: $('kNo').value, sent: $('kS').checked, received: $('kR').checked }, 'Saved'); closeSheet(); };
}
function cardMetaSheet() { PEND = null; const M = S.cardsMeta || {}; sheet(`<h3><span>💌 Card settings</span><button class="x" onclick="closeSheet()">✕</button></h3><label>Mail by</label><input class="in" id="mB" type="date" value="${esc(M.mailBy || iso(addDays(xmasDate(), -13)))}">${phField(M.photo, 'This year\'s card photo')}<button class="btn wide" id="mGo" style="margin-top:12px">Save</button>`);
  $('mGo').onclick = async () => { await act('card.meta', { mailBy: $('mB').value }, 'Saved'); await flushPhoto('card', 'me'); closeSheet(); }; }
async function cardsAddFamily() {
  const have = new Set((S.cards || []).map(c => c.to)), fams = {}; S.people.filter(p => p.family !== S.me.family && !p.kid).forEach(p => (fams[p.family] = fams[p.family] || []).push(p));
  let n = 0; for (const [f, ps] of Object.entries(fams)) { const to = 'u:' + ps[0].id; if (have.has(to)) continue; await act('card.save', { to, name: S.families[f], address: ps.map(p => p.profile.address).find(Boolean) || '' }); n++; }
  for (const c of S.contacts || []) if (!have.has('c:' + c.id) && c.address) { await act('card.save', { to: 'c:' + c.id, name: c.name, address: c.address }); n++; }
  toast(n ? `Added ${n}` : 'Everyone is already on the list');
}
// ---- meals
function seasonMeals() {
  const ms = (S.meals || []).slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const diet = S.people.filter(p => p.profile.allergies).map(p => `<b>${esc(p.name)}</b>: ${esc(p.profile.allergies)}`).concat((S.contacts || []).filter(c => c.allergies).map(c => `<b>${esc(c.name)}</b>: ${esc(c.allergies)}`));
  let h = ms.map(m => {
    const mine = m.dishes.filter(d => d.who === uid()).length, open = m.dishes.filter(d => !d.who).length, host = m.host === uid() || m.by === uid() || S.me.admin;
    let x = `<div class="card"><div style="display:flex;gap:10px;align-items:flex-start"><div style="flex:1"><b style="font-size:17px">${esc(m.name)}</b><div class="mut">${MK[m.kind] || ''}${m.date ? ' · ' + fmtD(m.date) : ''}${m.time ? ' ' + fmtT(m.time) : ''}${m.place ? ' · ' + esc(m.place) : ''} · host ${esc(pName(m.host))}</div>${m.note ? `<div class="mut">${esc(m.note)}</div>` : ''}</div>${host ? `<button class="btn sm ghost" onclick="mealSheet('${m.id}')">Edit</button>` : ''}</div>
      <div class="sum"><span>${m.dishes.length} dishes · ${open} need someone</span><span>${mine ? "you're bringing " + mine : ''}</span></div>`;
    for (const [cat, lbl] of Object.entries(DC)) { const ds = m.dishes.filter(d => d.cat === cat); if (!ds.length) continue;
      x += `<div class="day">${lbl}</div>` + ds.map(d => `<div class="row">${d.photo ? img(d.photo) : ''}<div class="t" onclick="dishSheet('${m.id}','${d.id}')"><b>${esc(d.name)}</b><small>${d.who ? '👤 ' + esc(who(d.who)) : '🙋 nobody yet'}${d.serves ? ' · serves ' + esc(d.serves) : ''}${d.note ? ' · ' + esc(d.note) : ''}</small></div>
        ${!d.who ? `<button class="btn sm claim" onclick="act('dish.claim',{meal:'${m.id}',id:'${d.id}'},'🍲 You got it!')">I'll bring it</button>` : d.who === uid() ? `<button class="btn sm claimed" onclick="act('dish.claim',{meal:'${m.id}',id:'${d.id}',release:true},'Released')">✓ Mine</button>` : ''}</div>`).join(''); }
    return x + `<button class="btn sm ghost wide" style="margin-top:10px" onclick="dishSheet('${m.id}')">＋ Add a dish</button></div>`;
  }).join('') || `<div class="card">${empty('🍽️', 'No meals planned yet. Start with Christmas Eve dinner!')}</div>`;
  h += `<button class="btn wide" onclick="mealSheet()">＋ Plan a meal</button>`;
  h += `<div class="h">⚠ Dietary notes</div><div class="card">${diet.length ? diet.join('<br>') : '<span class="mut">Nobody has listed allergies. Add yours under your profile.</span>'}</div>`;
  return h;
}
function mealSheet(id) {
  const m = id ? S.meals.find(x => x.id === id) : { kind: 'eve', date: iso(addDays(xmasDate(), -1)), time: '17:00', host: uid() };
  sheet(`<h3><span>${id ? 'Edit meal' : '🍽️ Plan a meal'}</span><button class="x" onclick="closeSheet()">✕</button></h3><label>Name</label><input class="in" id="mN" value="${esc(m.name || '')}" placeholder="Christmas Eve Dinner">
    <label>Which</label>${seg('kind', Object.entries(MK), m.kind)}<div class="two"><div><label>Date</label><input class="in" id="mD" type="date" value="${esc(m.date)}"></div><div><label>Time</label><input class="in" id="mT" type="time" value="${esc(m.time)}"></div></div>
    <div class="two"><div><label>Host</label><select class="in" id="mH">${S.people.filter(p => !p.kid).map(p => `<option value="${p.id}" ${p.id === m.host ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div><div><label>Where</label><input class="in" id="mP" value="${esc(m.place)}" placeholder="Gammy's house"></div></div>
    <label>Notes</label><input class="in" id="mNo" value="${esc(m.note)}" placeholder="Bring a chair, dinner at 5…">
    <div style="display:flex;gap:8px;margin-top:14px">${id ? `<button class="btn ghost" onclick="if(confirm('Remove this meal and its dishes?'))act('meal.del',{id:'${id}'},'Removed').then(closeSheet)">🗑</button>` : ''}<button class="btn wide" id="mGo">Save</button></div>`);
  bindSeg(); $('mGo').onclick = async () => { await act('meal.save', { id, name: $('mN').value, kind: segV('kind'), date: $('mD').value, time: $('mT').value, host: $('mH').value, place: $('mP').value, note: $('mNo').value }, 'Saved'); closeSheet(); };
}
function dishSheet(mid, id) {
  PEND = null; const m = S.meals.find(x => x.id === mid), d = id ? m.dishes.find(x => x.id === id) : { cat: 'side', who: uid() };
  sheet(`<h3><span>${id ? 'Edit dish' : '＋ Add a dish'}</span><button class="x" onclick="closeSheet()">✕</button></h3><label>Dish</label><input class="in" id="dN" value="${esc(d.name || '')}" placeholder="Green bean casserole">
    <label>Kind</label><select class="in" id="dC">${Object.entries(DC).map(([k, v]) => `<option value="${k}" ${k === d.cat ? 'selected' : ''}>${v}</option>`).join('')}</select>
    <label>Who's bringing it</label><select class="in" id="dW"><option value="">🙋 Nobody yet (open)</option>${S.people.filter(p => !p.kid).map(p => `<option value="${p.id}" ${p.id === d.who ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
    <div class="two"><div><label>Serves</label><input class="in" id="dS" value="${esc(d.serves)}" placeholder="8"></div><div><label>Note</label><input class="in" id="dNo" value="${esc(d.note)}" placeholder="gluten free…"></div></div>
    <label>Ingredients (one per line → grocery list)</label><textarea class="in" id="dI" placeholder="green beans\ncream of mushroom\nfried onions">${esc((d.ingredients || []).join('\n'))}</textarea>${phField(d.photo)}
    <div style="display:flex;gap:8px;margin-top:14px">${id ? `<button class="btn ghost" onclick="act('dish.del',{meal:'${mid}',id:'${id}'},'Removed').then(closeSheet)">🗑</button>` : ''}<button class="btn wide" id="dGo">Save</button></div>`);
  $('dGo').onclick = async () => { const r = await act('dish.save', { meal: mid, id, name: $('dN').value, cat: $('dC').value, who: $('dW').value, serves: $('dS').value, note: $('dNo').value, ingredients: $('dI').value }, 'Saved'); await flushPhoto('dish', r); closeSheet(); };
}
// ---- grocery: auto from the dishes I'm bringing + my own items, check-off, share
function groceryItems() {
  const G = S.grocery || { items: [], done: [] }, out = [];
  for (const m of S.meals || []) for (const d of m.dishes) if (d.who === uid()) (d.ingredients || []).forEach((t, i) => out.push({ key: `${d.id}:${i}`, text: t, src: d.name, auto: true }));
  G.items.forEach(i => out.push({ key: i.id, text: i.text, qty: i.qty, store: i.store, src: 'added by you' }));
  return out.map(i => ({ ...i, done: G.done.includes(i.key) }));
}
function seasonGrocery() {
  const items = groceryItems(), done = items.filter(i => i.done).length;
  let h = `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><div><b>${done}/${items.length} in the cart</b><div class="mut">Pulled from dishes you're bringing. Add anything else.</div></div><div style="display:flex;gap:6px"><button class="btn sm ghost" onclick="shareGrocery()">📤</button><button class="btn sm ghost" onclick="printView('grocery')">🖨</button></div></div><div class="bar"><i style="width:${items.length ? done / items.length * 100 : 0}%"></i></div></div>`;
  h += `<div class="card">` + (items.map(i => `<div class="row ${i.done ? 'done' : ''}"><button class="chk ${i.done ? 'on' : ''}" onclick="groceryTick('${esc(i.key)}')">${i.done ? '✓' : ''}</button><div class="t"><b>${esc(i.text)}${i.qty ? ' <span class="mut">× ' + esc(i.qty) + '</span>' : ''}</b><small>${esc(i.src)}${i.store ? ' · ' + esc(i.store) : ''}</small></div>${!i.auto ? `<button class="btn sm ghost" onclick="groceryDel('${esc(i.key)}')">✕</button>` : ''}</div>`).join('') || empty('🛒', 'Claim a dish under Meals (with ingredients) or add items here.')) + `</div>`;
  h += `<div style="display:flex;gap:8px"><input class="in" id="gqT" placeholder="Butter"><input class="in" id="gqQ" style="width:80px" placeholder="qty"><button class="btn" onclick="groceryAdd()">＋</button></div>`;
  if (done) h += `<button class="btn ghost wide" style="margin-top:10px" onclick="act('grocery.save',{items:S.grocery.items,done:[]},'Unchecked all')">Uncheck all</button>`;
  return h;
}
async function groceryTick(k) { const G = S.grocery; await act('grocery.save', { items: G.items, done: G.done.includes(k) ? G.done.filter(x => x !== k) : [...G.done, k] }); }
async function groceryAdd() { const t = $('gqT').value.trim(); if (!t) return; await act('grocery.save', { items: [...S.grocery.items, { text: t, qty: $('gqQ').value }], done: S.grocery.done }); }
async function groceryDel(k) { await act('grocery.save', { items: S.grocery.items.filter(i => i.id !== k), done: S.grocery.done }); }
async function shareGrocery() { const txt = '🛒 Christmas grocery list\n' + groceryItems().map(i => `${i.done ? '☑' : '☐'} ${i.text}${i.qty ? ' × ' + i.qty : ''}`).join('\n'); if (navigator.share) { try { await navigator.share({ title: 'Grocery list', text: txt }); } catch {} } else { await navigator.clipboard.writeText(txt); toast('Copied to clipboard'); } }
// ---- events (+ .ics)
const evRow = (e, ro) => `<div class="row ev"><div class="dt"><b>${new Date(e.date + 'T12:00').getDate()}</b><small>${new Date(e.date + 'T12:00').toLocaleDateString(undefined, { month: 'short' })}</small></div><div class="t" ${ro ? '' : `onclick="eventSheet('${e.id}')"`}><b>${EK[e.kind] || '📌'} ${esc(e.title)}</b><small>${[e.time ? fmtT(e.time) + (e.end ? '–' + fmtT(e.end) : '') : 'all day', e.place, e.priv ? '🔒 private' : '', e.by !== uid() ? 'added by ' + pName(e.by) : ''].filter(Boolean).map(esc).join(' · ')}${e.note ? '<br>' + esc(e.note) : ''}</small></div><button class="btn sm ghost" onclick="downloadIcs(['${e.id}'])" title="Add to calendar">📅</button></div>`;
function seasonEvents() {
  const ev = (S.events || []).slice().sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))), td = todayIso(), up = ev.filter(e => e.date >= td), past = ev.filter(e => e.date < td);
  let h = `<div class="chips"><button onclick="eventSheet()">＋ Add</button><button onclick="downloadIcs()">📅 Download all (.ics)</button></div>`;
  let last = ''; h += `<div class="card">` + (up.map(e => { const wk = fmtD(e.date, { month: 'long' }); const d = wk !== last ? `<div class="day">${wk}</div>` : ''; last = wk; return d + evRow(e); }).join('') || empty('📅', 'Parties, programs, travel: add them so everyone sees the plan.')) + `</div>`;
  if (past.length) h += `<div class="h">Earlier</div><div class="card" style="opacity:.7">${past.slice(-5).map(e => evRow(e)).join('')}</div>`;
  return h;
}
function eventSheet(id) {
  const e = id ? S.events.find(x => x.id === id) : { kind: 'party', date: '', time: '' };
  sheet(`<h3><span>${id ? 'Edit event' : '📅 Add an event'}</span><button class="x" onclick="closeSheet()">✕</button></h3><label>What</label><input class="in" id="eT" value="${esc(e.title || '')}" placeholder="Ben's school program">
    <label>Kind</label>${seg('kind', Object.entries(EK).map(([k, v]) => [k, v + ' ' + k[0].toUpperCase() + k.slice(1)]), e.kind)}
    <div class="two"><div><label>Date</label><input class="in" id="eD" type="date" value="${esc(e.date)}"></div><div><label>Time</label><input class="in" id="eTm" type="time" value="${esc(e.time)}"></div></div>
    <div class="two"><div><label>Ends</label><input class="in" id="eE" type="time" value="${esc(e.end || '')}"></div><div><label>Where</label><input class="in" id="eP" value="${esc(e.place)}" placeholder="Church, Gammy's…"></div></div>
    <label>Notes</label><input class="in" id="eN" value="${esc(e.note)}" placeholder="Wear red, bring a dish…"><label class="ck" style="margin-top:10px"><input type="checkbox" id="ePr" ${e.priv ? 'checked' : ''}> 🔒 Private (just me + who I share with)</label>
    <div style="display:flex;gap:8px;margin-top:14px">${id ? `<button class="btn ghost" onclick="act('event.del',{id:'${id}'},'Removed').then(closeSheet)">🗑</button>` : ''}<button class="btn wide" id="eGo">Save</button></div>`);
  bindSeg(); $('eGo').onclick = async () => { await act('event.save', { id, title: $('eT').value, kind: segV('kind'), date: $('eD').value, time: $('eTm').value, end: $('eE').value, place: $('eP').value, note: $('eN').value, priv: $('ePr').checked }, 'Saved'); closeSheet(); };
}
function icsText(evs) {
  const ics = s => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, m => '\\' + m), stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const vevent = e => { const d = e.date.replace(/-/g, ''); const dt = t => `${d}T${t.replace(':', '')}00`;
    return ['BEGIN:VEVENT', `UID:np-${e.id}@north-pole`, `DTSTAMP:${stamp}`, e.time ? `DTSTART:${dt(e.time)}` : `DTSTART;VALUE=DATE:${d}`, e.time ? `DTEND:${dt(e.end || (String(Math.min(23, +e.time.slice(0, 2) + 2)).padStart(2, '0') + e.time.slice(2)))}` : `DTEND;VALUE=DATE:${iso(addDays(new Date(e.date + 'T12:00'), 1)).replace(/-/g, '')}`,
      `SUMMARY:${ics(e.title)}`, e.place ? `LOCATION:${ics(e.place)}` : '', e.note ? `DESCRIPTION:${ics(e.note)}` : '', 'END:VEVENT'].filter(Boolean).join('\r\n'); };
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//North Pole//Family Christmas//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:North Pole', ...evs.map(vevent), 'END:VCALENDAR'].join('\r\n') + '\r\n';
}
function downloadIcs(ids) {
  const evs = (S.events || []).filter(e => !ids || ids.includes(e.id)); if (!evs.length) return toast('No events yet');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([icsText(evs)], { type: 'text/calendar' })); a.download = (evs.length === 1 ? evs[0].title.replace(/[^\w]+/g, '-') : 'north-pole') + '.ics'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); toast('📅 Open the file to add to your calendar');
}
// ---- secret santa
function drawCards() {
  return (S.draws || []).map(d => `<div class="card"><b>🎅 ${esc(d.name)}</b><div class="mut">${d.budget ? 'Spend about ' + money(d.budget) : ''}${d.date ? ' · exchange ' + esc(d.date) : ''}${d.members ? ' · ' + d.members.length + ' people' : ''}</div>
    ${d.mine ? `<div style="margin-top:10px;font-size:15px">You're shopping for…</div><div class="big" style="color:var(--r)">🎁 ${esc(pName(d.mine))}</div>${d.hint ? `<div class="card" style="margin:6px 0;background:var(--soft)">💬 Their hint: “${esc(d.hint)}”</div>` : ''}<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm g" onclick="openP('${d.mine}')">See their wish list</button><button class="btn sm ghost" onclick="hintSheet('${d.id}')">${d.myhint ? '✏️ My hint' : '💬 Leave a hint for my Santa'}</button></div>` : '<div class="mut" style="margin-top:6px">You set this one up (not in it). Only each person sees who they drew.</div>'}
    ${d.by === uid() ? `<div style="margin-top:8px"><a class="lk" href="#" onclick="delDraw('${d.id}');return false">Delete this draw</a></div>` : ''}</div>`).join('') || `<div class="card">${empty('🎅', 'No Secret Santa yet.')}</div>`;
}
function seasonSanta() { return drawCards() + (kid() ? '' : `<button class="btn g wide" onclick="newDraw()">＋ Start a Secret Santa / White Elephant</button>`); }
function hintSheet(id) { const d = S.draws.find(x => x.id === id); sheet(`<h3><span>💬 Hint for my Secret Santa</span><button class="x" onclick="closeSheet()">✕</button></h3><div class="mut">Only the person who drew you will see this.</div><input class="in" id="hT" value="${esc(d.myhint)}" placeholder="I love cozy socks and dark chocolate" style="margin-top:8px"><button class="btn wide" id="hGo" style="margin-top:12px">Save</button>`); $('hGo').onclick = async () => { await act('draw.hint', { id, text: $('hT').value }, 'Hint saved'); closeSheet(); }; }
function newDraw() {
  const ppl = S.people; let EX = [];
  sheet(`<h3><span>🎅 New Secret Santa</span><button class="x" onclick="closeSheet()">✕</button></h3>
    <label>Name</label><input class="in" id="dN" value="Cousins Secret Santa"><div class="two"><div><label>Spend about</label><input class="in" id="dB" inputmode="decimal" placeholder="$25"></div><div><label>Exchange day</label><input class="in" id="dD" placeholder="Dec 24"></div></div>
    <label>Who's in?</label><div class="ppl">${ppl.map(p => `<button type="button" class="pp" data-m="${p.id}" style="opacity:.45">${av(p, 38)}${esc(p.name)}</button>`).join('')}</div>
    <label class="ck" style="margin-top:10px"><input type="checkbox" id="dF" checked> Don't draw your own family</label>
    <label>Can't draw each other (spouses…)</label><div id="exList" class="mut">none</div><div class="two" style="margin-top:6px"><select class="in" id="exA">${ppl.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select><select class="in" id="exB">${ppl.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div><button type="button" class="btn sm ghost" id="exAdd" style="margin-top:6px">＋ Add exclusion</button>
    <button class="btn wide" id="dGo" style="margin-top:12px">🎲 Draw names</button><div class="mut" style="margin-top:8px">Drawn on the server. Everyone only sees who THEY got. Not even you see the others.</div>`);
  document.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { b.classList.toggle('in'); b.style.opacity = b.classList.contains('in') ? 1 : .45; });
  $('exAdd').onclick = () => { const a = $('exA').value, b = $('exB').value; if (a === b) return; EX.push([a, b]); $('exList').innerHTML = EX.map(([x, y]) => `${esc(pName(x))} ↔ ${esc(pName(y))}`).join('<br>'); };
  $('dGo').onclick = async () => { const m = [...document.querySelectorAll('[data-m].in')].map(b => b.dataset.m);
    await act('draw.create', { name: $('dN').value, budget: $('dB').value, date: $('dD').value, members: m, nofamily: $('dF').checked, excl: EX }, '🎲 Names drawn!'); closeSheet(); };
}
async function delDraw(id) { if (confirm('Delete this Secret Santa?')) await act('draw.del', { id }, 'Deleted'); }
// ---- memories
function seasonMemories() {
  const ms = (S.memories || []).slice().sort((a, b) => (b.date || b.at).localeCompare(a.date || a.at));
  let h = `<div class="chips"><button onclick="memorySheet()">📸 Add a memory</button></div>`;
  h += ms.length ? `<div class="gal">${ms.map(m => `<figure onclick="${m.by === uid() || S.me.admin ? `memorySheet('${m.id}')` : ''}">${m.photo ? img(m.photo, '') : '<div style="aspect-ratio:1;display:grid;place-items:center;font-size:40px;background:var(--soft)">🎄</div>'}<figcaption>${esc(m.caption || '')}<small>${esc(pName(m.by))} · ${fmtD(m.date || m.at)}</small></figcaption></figure>`).join('')}</div>` : `<div class="card">${empty('📸', 'The season gallery. Tree day, cookie day, Christmas morning: everyone in the family can add photos.')}</div>`;
  return h;
}
function memorySheet(id) {
  PEND = null; const m = id ? S.memories.find(x => x.id === id) : { date: todayIso() };
  sheet(`<h3><span>${id ? 'Edit memory' : '📸 Add a memory'}</span><button class="x" onclick="closeSheet()">✕</button></h3>${phField(m.photo, 'Photo')}<label>Caption</label><input class="in" id="mC" value="${esc(m.caption || '')}" placeholder="Tree is up! 🎄"><label>When</label><input class="in" id="mD" type="date" value="${esc(m.date)}">
    <div style="display:flex;gap:8px;margin-top:14px">${id ? `<button class="btn ghost" onclick="if(confirm('Delete this memory?'))act('memory.del',{id:'${id}'},'Deleted').then(closeSheet)">🗑</button>` : ''}<button class="btn wide" id="mGo">Save</button></div>`);
  $('mGo').onclick = async () => { if (!id && !PEND && !$('mC').value.trim()) return toast('Add a photo or a caption'); const r = await act('memory.save', { id, caption: $('mC').value, date: $('mD').value }, 'Saved'); await flushPhoto('memory', r); closeSheet(); };
}
// ---- recipes
function seasonRecipes() {
  const all = [...C.recipes, ...(S.recipes || [])];
  let h = `<div class="chips"><button onclick="recipeSheet()">＋ Add a recipe</button></div>`;
  return h + all.map(r => `<div class="card">${r.photo ? img(r.photo, 'thumb lg') + '<div style="height:8px"></div>' : ''}<div style="display:flex;gap:8px;align-items:flex-start"><div style="flex:1"><b style="font-size:17px">${esc(r.title)}</b><div class="mut">${[r.time, r.serves, r.builtin ? 'North Pole favorite' : 'by ' + pName(r.by)].filter(Boolean).map(esc).join(' · ')}</div></div>${!r.builtin && (r.by === uid() || S.me.admin) ? `<button class="btn sm ghost" onclick="recipeSheet('${r.id}')">Edit</button>` : ''}</div>
    <details style="margin-top:8px"><summary style="font-weight:800;cursor:pointer">Ingredients + steps</summary><ul style="padding-left:18px;margin:6px 0">${r.ingredients.map(i => `<li>${esc(i)}</li>`).join('')}</ul><ol style="padding-left:18px;margin:6px 0">${r.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>${r.note ? `<div class="mut">${esc(r.note)}</div>` : ''}</details></div>`).join('');
}
function recipeSheet(id) {
  PEND = null; const r = id ? S.recipes.find(x => x.id === id) : { kind: 'cookie' };
  sheet(`<h3><span>${id ? 'Edit recipe' : '🍪 Add a recipe'}</span><button class="x" onclick="closeSheet()">✕</button></h3><label>Name</label><input class="in" id="rT" value="${esc(r.title || '')}" placeholder="Gammy's gingerbread"><div class="two"><div><label>Time</label><input class="in" id="rTm" value="${esc(r.time)}" placeholder="45 min"></div><div><label>Makes</label><input class="in" id="rS" value="${esc(r.serves)}" placeholder="24 cookies"></div></div>
    <label>Ingredients (one per line)</label><textarea class="in" id="rI">${esc((r.ingredients || []).join('\n'))}</textarea><label>Steps (one per line)</label><textarea class="in" id="rSt">${esc((r.steps || []).join('\n'))}</textarea>${phField(r.photo)}
    <div style="display:flex;gap:8px;margin-top:14px">${id ? `<button class="btn ghost" onclick="act('recipe.del',{id:'${id}'},'Deleted').then(closeSheet)">🗑</button>` : ''}<button class="btn wide" id="rGo">Save</button></div>`);
  $('rGo').onclick = async () => { const x = await act('recipe.save', { id, title: $('rT').value, time: $('rTm').value, serves: $('rS').value, ingredients: $('rI').value, steps: $('rSt').value }, 'Saved'); await flushPhoto('recipe', x); closeSheet(); };
}
// ---- letters (grown-ups read the kids' letters and reply as the North Pole)
function seasonLetters() {
  const ls = (S.letters || []).filter(l => l.by !== uid());
  return `<div class="card"><div class="mut">Letters your kids write in the app show up here (only for grown-ups in their family). You can write a reply “from the North Pole”. 🤫</div></div>` + (ls.map(l => `<div class="card"><b>✉️ From ${esc(pName(l.by))}</b> <span class="mut">${fmtD(l.at)}</span>${l.photo ? '<div style="height:8px"></div>' + img(l.photo, 'thumb lg') : ''}<div class="letter" style="margin-top:8px">${esc(l.text)}</div>
    ${l.reply ? `<div class="card" style="margin-top:8px;background:var(--soft)"><b>🎅 Reply:</b> ${esc(l.reply)}</div>` : ''}<button class="btn sm g" style="margin-top:8px" onclick="replySheet('${l.id}')">${l.reply ? 'Edit reply' : '🎅 Write a reply'}</button></div>`).join('') || `<div class="card">${empty('✉️', 'No letters yet.')}</div>`);
}
function replySheet(id) { const l = S.letters.find(x => x.id === id); sheet(`<h3><span>🎅 Reply from the North Pole</span><button class="x" onclick="closeSheet()">✕</button></h3><textarea class="in" id="rpT" placeholder="Ho ho ho ${esc(pName(l.by))}! The elves loved your letter…">${esc(l.reply)}</textarea><button class="btn wide" id="rpGo" style="margin-top:12px">Send</button>`); $('rpGo').onclick = async () => { await act('letter.reply', { id, text: $('rpT').value }, 'Sent from the North Pole 🎅'); closeSheet(); }; }

// ---------- 🎄 kids' Fun tab
function vFun() {
  const sub = SUB.fun || 'advent'; $('ttl').textContent = { advent: 'Advent calendar', letter: 'Letter to Santa', cookies: 'Cookie recipes', memories: 'Memories', events: 'Coming up', santa: 'Secret Santa' }[sub];
  let h = chips('fun', [['advent', '🗓️ Advent'], ['letter', '✉️ Santa'], ['cookies', '🍪 Cookies'], ['memories', '📸 Memories'], ['events', '📅 Events'], ...((S.draws || []).length ? [['santa', '🎅 Secret Santa']] : [])]);
  h += ({ advent: funAdvent, letter: funLetter, cookies: seasonRecipes, memories: seasonMemories, events: () => { const ev = (S.events || []).filter(e => e.date >= todayIso()); return `<div class="card">${ev.map(e => evRow(e, true)).join('') || empty('📅', 'Nothing on the calendar yet.')}</div>`; }, santa: drawCards })[sub]();
  $('view').innerHTML = h;
}
function funAdvent() {
  const d = adventDay(), opened = (S.advent || {}).opened || [];
  let h = `<div class="card"><b>${d ? `Door ${d} is ready!` : 'The calendar opens December 1'}</b><div class="mut">One door a day: an activity, a joke and a kindness challenge.</div></div><div class="adv">`;
  for (let i = 1; i <= 24; i++) { const open = opened.includes(i), can = i <= d; h += `<button class="door ${open ? 'open' : ''} ${i === d && !open ? 'today' : ''} ${!can ? 'lock' : ''}" onclick="openDoor(${i},${can})">${open ? '🎁' : i}</button>`; }
  h += `</div>`;
  const last = opened.filter(x => x <= 24).sort((a, b) => b - a)[0];
  if (last) { const [a, j, k] = C.advent[last - 1]; h += `<div class="h">Door ${last}</div><div class="card"><div class="row"><span style="font-size:24px">🎄</span><div class="t"><b>Today's activity</b><small>${esc(a)}</small></div></div><div class="row"><span style="font-size:24px">😄</span><div class="t"><b>Joke</b><small>${esc(j)}</small></div></div><div class="row"><span style="font-size:24px">💛</span><div class="t"><b>Kindness challenge</b><small>${esc(k)}</small></div></div></div>`; }
  return h;
}
async function openDoor(i, can) { if (!can) return toast(i === 25 ? '🎄' : `Not yet! Door ${i} opens December ${i}.`); const [a, j, k] = C.advent[i - 1]; await act('advent.open', { day: i }); sheet(`<h3><span>🎁 Door ${i}</span><button class="x" onclick="closeSheet()">✕</button></h3><div class="card"><b>🎄 Today's activity</b><div>${esc(a)}</div></div><div class="card"><b>😄 Joke</b><div>${esc(j)}</div></div><div class="card"><b>💛 Kindness challenge</b><div>${esc(k)}</div></div><button class="btn wide" onclick="closeSheet()">Yay!</button>`); }
function funLetter() {
  const ls = (S.letters || []).filter(l => l.by === uid());
  return `<div class="chips"><button onclick="letterSheet()">✍️ Write a letter</button></div>` + (ls.map(l => `<div class="card">${l.photo ? img(l.photo, 'thumb lg') + '<div style="height:8px"></div>' : ''}<div class="letter">${esc(l.text)}</div><div class="sum"><span>${fmtD(l.at)}</span><a class="lk" href="#" onclick="letterSheet('${l.id}');return false">Edit</a></div>
    ${l.reply ? `<div class="card" style="margin-top:10px;border-color:var(--gold);background:#fffbeb;color:#3b2a00"><b>📬 A reply from the North Pole!</b><div style="margin-top:4px;white-space:pre-wrap">${esc(l.reply)}</div></div>` : '<div class="mut" style="margin-top:8px">Sent to the North Pole ✈️ Check back for a reply!</div>'}</div>`).join('') || `<div class="card">${empty('✉️', 'Write your letter to Santa! Pick a template, fill it in, add a drawing or a photo.')}</div>`);
}
function letterSheet(id) {
  PEND = null; const l = id ? S.letters.find(x => x.id === id) : { text: C.letters.classic.replace(/NAME/g, S.me.name), template: 'classic' };
  sheet(`<h3><span>✍️ Letter to Santa</span><button class="x" onclick="closeSheet()">✕</button></h3><label>Start from</label><div class="chips">${Object.keys(C.letters).map(k => `<button type="button" onclick="$('lT').value=C.letters['${k}'].replace(/NAME/g,S.me.name)">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div>
    <textarea class="in letter" id="lT" style="min-height:260px">${esc(l.text)}</textarea>${phField(l.photo, 'Add a drawing or photo')}<div style="display:flex;gap:8px;margin-top:14px">${id ? `<button class="btn ghost" onclick="if(confirm('Delete this letter?'))act('letter.del',{id:'${id}'},'Deleted').then(closeSheet)">🗑</button>` : ''}<button class="btn wide" id="lGo">${id ? 'Save' : '📮 Send to the North Pole'}</button></div>`);
  $('lGo').onclick = async () => { const r = await act('letter.save', { id, text: $('lT').value, template: l.template }, id ? 'Saved' : '📮 Sent! Santa reads every letter.'); await flushPhoto('letter', r); closeSheet(); };
}

// ---------- ⭐ more / me
function vMore() {
  $('ttl').textContent = kid() ? 'Me' : 'More';
  let h = `<div class="card" style="display:flex;gap:12px;align-items:center">${av(S.me, 54)}<div style="flex:1"><b>${esc(S.me.name)}</b><div class="mut">${esc(S.families[S.me.family] || '')}${S.me.admin ? ' · admin' : ''}</div></div><button class="btn sm ghost" onclick="profileSheet()">Edit profile</button></div>`;
  if (!kid()) {
    const sh = (S.shares || {}).mine || [], wm = (S.shares || {}).withme || [];
    h += `<div class="h">🤝 Plan together</div><div class="card"><div class="mut">Share your planner, budget, people + cards with another grown-up (like your spouse). Kids can never see it.</div>
      <div style="margin:8px 0"><b>Shared with:</b> ${sh.length ? sh.map(pName).map(esc).join(', ') : 'nobody'}</div>${wm.length ? `<div class="mut">You can also see ${wm.map(pName).map(esc).join(', ')}'s planner.</div>` : ''}<button class="btn sm ghost" onclick="shareSheet()">Choose who</button></div>`;
    h += `<div class="h">👨‍👩‍👧 Families + people</div><div class="card"><div class="mut">Bring your own family into the app, or add a person to yours. Each person picks a 4-number code.</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"><button class="btn sm ghost" onclick="familySheet()">＋ Add a family</button><button class="btn sm ghost" onclick="personSheet()">＋ Add a person to my family</button><button class="btn sm ghost" onclick="contactSheet()">＋ Add to my people</button></div></div>`;
    h += `<div class="h">🖨 Print</div><div class="card"><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm ghost" onclick="printView('gifts')">Gift list</button><button class="btn sm ghost" onclick="printView('wrap')">Wrapping schedule</button><button class="btn sm ghost" onclick="printView('grocery')">Grocery list</button><button class="btn sm ghost" onclick="printView('cards')">Card labels</button></div></div>`;
  }
  h += `<div class="h">🎨 Look</div><div class="card"><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm ${PREF.theme === 'dark' ? 'g' : 'ghost'}" onclick="savePref('theme','${PREF.theme === 'dark' ? '' : 'dark'}');render()">${PREF.theme === 'dark' ? '🌙 Dark on' : '☀️ Light'}</button><button class="btn sm ${PREF.snow ? 'g' : 'ghost'}" onclick="savePref('snow',${!PREF.snow});render()">${PREF.snow ? '❄️ Snow on' : '❄️ Let it snow'}</button></div></div>`;
  h += `<div class="h">🔐 My code</div><div class="card"><button class="btn sm ghost" onclick="pinSheet()">Change my 4-number code</button>${!kid() ? ` <button class="btn sm ghost" onclick="resetSheet()">Reset a kid's code</button>` : ''}</div>`;
  h += `<div class="h">📲 Put it on your phone</div><div class="card mut">iPhone/iPad: Safari → <b>Share</b> → <b>Add to Home Screen</b>. Android: <b>⋮</b> → <b>Add to Home screen</b>. It opens like an app and remembers what you saw last, even offline.</div>`;
  h += `<button class="btn wide" onclick="signOut()">🔒 Sign out</button><div class="mut" style="text-align:center;margin-top:10px">North Pole v2 · made with 🎄 for the family</div>`;
  $('view').innerHTML = h;
}
function profileSheet() {
  PEND = null; const p = S.me.profile || {};
  sheet(`<h3><span>👤 My profile</span><button class="x" onclick="closeSheet()">✕</button></h3><div class="mut">Sizes + likes help everyone shop for you. ${kid() ? '' : 'Your address is only shown to grown-ups (for cards).'}</div>${phField(S.me.avatar, 'My picture')}
    <div class="two"><div><label>Birthday</label><input class="in" id="pB" value="${esc(p.bday)}" placeholder="MM-DD"></div><div><label>Sizes</label><input class="in" id="pS" value="${esc(p.sizes)}" placeholder="M shirt, 10 shoe"></div></div>
    <label>Likes / hobbies / favorite stores</label><input class="in" id="pL" value="${esc(p.likes)}" placeholder="LEGO, fishing, Target…"><label>Allergies / dietary</label><input class="in" id="pA" value="${esc(p.allergies)}" placeholder="none">
    ${kid() ? '' : `<label>Address</label><input class="in" id="pAd" value="${esc(p.address)}" placeholder="For Christmas cards">`}<button class="btn wide" id="pGo" style="margin-top:14px">Save</button>`);
  $('pGo').onclick = async () => { await act('me.profile', { bday: $('pB').value, sizes: $('pS').value, likes: $('pL').value, allergies: $('pA').value, address: kid() ? '' : $('pAd').value }, 'Saved'); await flushPhoto('user', uid()); closeSheet(); };
}
function shareSheet() {
  const cur = (S.shares || {}).mine || [];
  sheet(`<h3><span>🤝 Share my planner</span><button class="x" onclick="closeSheet()">✕</button></h3><div class="ppl">${S.people.filter(p => !p.kid && p.id !== uid()).map(p => `<button type="button" class="pp ${cur.includes(p.id) ? 'in' : ''}" data-s="${p.id}" style="opacity:${cur.includes(p.id) ? 1 : .45}">${av(p, 38)}${esc(p.name)}</button>`).join('')}</div><button class="btn wide" id="sGo" style="margin-top:12px">Save</button>`);
  document.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { b.classList.toggle('in'); b.style.opacity = b.classList.contains('in') ? 1 : .45; });
  $('sGo').onclick = async () => { await act('share', { with: [...document.querySelectorAll('[data-s].in')].map(b => b.dataset.s) }, 'Sharing updated'); closeSheet(); };
}
const personRow = i => `<div class="three" style="margin-top:6px"><input class="in" data-pn placeholder="Name"><input class="in" data-pp inputmode="numeric" maxlength="4" placeholder="4-digit code"><label class="ck" style="margin:0"><input type="checkbox" data-pk> Kid</label></div>`;
function familySheet() {
  sheet(`<h3><span>👨‍👩‍👧 Add a family</span><button class="x" onclick="closeSheet()">✕</button></h3><div class="mut">They'll show up on the sign-in screen. Each person signs in with their own 4-number code (you can change it later).</div><label>Family name</label><input class="in" id="fN" placeholder="The Smiths"><label>People</label><div id="fP">${personRow()}${personRow()}</div><button type="button" class="btn sm ghost" style="margin-top:6px" onclick="$('fP').insertAdjacentHTML('beforeend',personRow())">＋ Another person</button><button class="btn wide" id="fGo" style="margin-top:14px">Create family</button>`);
  $('fGo').onclick = async () => { const people = [...$('fP').children].map(r => ({ name: r.querySelector('[data-pn]').value, pin: r.querySelector('[data-pp]').value, kid: r.querySelector('[data-pk]').checked })).filter(p => p.name.trim()); if (!people.length) return toast('Add at least one person'); await act('family.create', { name: $('fN').value, people }, '🎉 Welcome to the North Pole!'); PEOPLE0 = null; closeSheet(); };
}
function personSheet() {
  const fams = Object.entries(S.families).filter(([k]) => S.me.admin || k === S.me.family || S.familyOwners[k] === uid());
  sheet(`<h3><span>＋ Add a person</span><button class="x" onclick="closeSheet()">✕</button></h3><label>Family</label><select class="in" id="aF">${fams.map(([k, v]) => `<option value="${k}" ${k === S.me.family ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select><div id="aP">${personRow()}</div><button class="btn wide" id="aGo" style="margin-top:14px">Add</button>`);
  $('aGo').onclick = async () => { const r = $('aP').firstElementChild; await act('person.add', { family: $('aF').value, name: r.querySelector('[data-pn]').value, pin: r.querySelector('[data-pp]').value, kid: r.querySelector('[data-pk]').checked }, 'Added'); PEOPLE0 = null; closeSheet(); };
}
function pinSheet() {
  sheet(`<h3><span>🔐 Change my code</span><button class="x" onclick="closeSheet()">✕</button></h3><label>Current code</label><input class="in" id="p1" inputmode="numeric" maxlength="4" type="password"><label>New code</label><input class="in" id="p2" inputmode="numeric" maxlength="4" type="password"><div style="height:10px"></div><button class="btn wide" id="pGo">Save</button>`);
  $('pGo').onclick = async () => { await act('pin', { old: $('p1').value, new: $('p2').value }, 'Code changed. Sign in with the new one.'); signOut(true); };
}
function resetSheet() {
  const can = S.people.filter(p => p.id !== uid() && (S.me.admin || (p.kid && p.family === S.me.family) || S.familyOwners[p.family] === uid()));
  sheet(`<h3><span>🔐 Reset a code</span><button class="x" onclick="closeSheet()">✕</button></h3><label>Who</label><select class="in" id="r1">${can.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select><label>New code</label><input class="in" id="r2" inputmode="numeric" maxlength="4"><div style="height:10px"></div><button class="btn wide" id="rGo">Reset</button>`);
  $('rGo').onclick = async () => { await act('pin.reset', { user: $('r1').value, new: $('r2').value }, 'Code reset'); closeSheet(); };
}

// ---------- 🖨 print views
function printView(kind) {
  const G = (S.gifts || []).filter(g => g.owner === uid()), by = {}; G.forEach(g => (by[g.to] = by[g.to] || []).push(g));
  let h = `<h1>🎄 North Pole · ${esc(S.me.name)}</h1><div class="mut">${new Date().toLocaleDateString()} · ${days()} days till Christmas</div>`;
  if (kind === 'gifts') h += Object.entries(by).map(([rk, gs]) => `<h2>${esc(rName(rk))} <span class="mut">${money(gs.reduce((a, g) => a + g.cost, 0))}</span></h2><table>${gs.map(g => `<tr><td><span class="box"></span>${esc(g.title)}</td><td>${ST[g.status]}</td><td>${FR[g.from][1]}</td><td>${esc(g.store)}</td><td style="text-align:right">${money(g.cost)}</td></tr>`).join('')}</table>`).join('') || '<p>No gifts yet.</p>';
  if (kind === 'wrap') { const todo = G.filter(g => g.status !== 'idea'); h += `<h2>Wrapping schedule</h2><p class="mut">${todo.filter(g => g.status === 'wrapped').length}/${todo.length} wrapped</p><table><tr><th></th><th>Gift</th><th>For</th><th>From</th><th>Hidden</th><th>Status</th></tr>${todo.sort((a, b) => rName(a.to).localeCompare(rName(b.to))).map(g => `<tr><td><span class="box"></span></td><td>${esc(g.title)}</td><td>${esc(rName(g.to))}</td><td>${FR[g.from][1]}</td><td>${esc(g.hide)}</td><td>${ST[g.status]}</td></tr>`).join('')}</table>`; }
  if (kind === 'grocery') h += `<h2>Grocery list</h2><table>${groceryItems().map(i => `<tr><td><span class="box"></span>${esc(i.text)}${i.qty ? ' × ' + esc(i.qty) : ''}</td><td class="mut">${esc(i.src)}</td></tr>`).join('') || '<tr><td>Nothing yet</td></tr>'}</table>`;
  if (kind === 'cards') h += `<h2>Christmas cards</h2><table>${(S.cards || []).map(c => `<tr><td><span class="box"></span>${c.sent ? '✓ ' : ''}${esc(c.name || rName(c.to))}</td><td>${esc(c.address || addrFor(c.to)).replace(/\n/g, '<br>')}</td></tr>`).join('') || '<tr><td>Nobody on the list yet</td></tr>'}</table>`;
  $('print').innerHTML = h; setTimeout(() => window.print(), 50);
}

// ---------- sheets, snow, boot
function sheet(h) { $('sh').innerHTML = h; $('sheet').classList.add('on'); hydrate(); }
function closeSheet() { $('sheet').classList.remove('on'); PEND = null; }
$('sheet').onclick = e => { if (e.target.id === 'sheet') closeSheet(); };
(() => { const c = $('snow'), x = c.getContext('2d'); const fit = () => { c.width = c.offsetWidth; c.height = c.offsetHeight; }; fit(); addEventListener('resize', fit);
  const F = Array.from({ length: 40 }, () => ({ x: Math.random() * 800, y: Math.random() * 120, r: Math.random() * 1.8 + .6, s: Math.random() * .5 + .2 }));
  (function t() { x.clearRect(0, 0, c.width, c.height); x.fillStyle = 'rgba(255,255,255,.8)'; for (const f of F) { f.y += f.s; if (f.y > c.height) { f.y = -3; f.x = Math.random() * c.width; } x.beginPath(); x.arc(f.x % c.width, f.y, f.r, 0, 7); x.fill(); } requestAnimationFrame(t); })(); })();
let SNOWING = false;
function snowAll() { if (SNOWING || !PREF.snow) return; SNOWING = true; const c = $('snowAll'), x = c.getContext('2d'); const fit = () => { c.width = innerWidth; c.height = innerHeight; }; fit(); addEventListener('resize', fit);
  const F = Array.from({ length: 90 }, () => ({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, r: Math.random() * 2.2 + .8, s: Math.random() * .7 + .3, w: Math.random() * 2 }));
  (function t() { if (!PREF.snow) { SNOWING = false; x.clearRect(0, 0, c.width, c.height); return; } x.clearRect(0, 0, c.width, c.height); x.fillStyle = 'rgba(255,255,255,.85)'; for (const f of F) { f.y += f.s; f.x += Math.sin((f.y + f.w * 100) / 40) * .3; if (f.y > c.height) { f.y = -3; f.x = Math.random() * c.width; } x.beginPath(); x.arc(f.x, f.y, f.r, 0, 7); x.fill(); } requestAnimationFrame(t); })(); }
applyPrefs();
if ('serviceWorker' in navigator && !localStorage.getItem('np.nosw')) navigator.serviceWorker.register('sw.js').catch(() => {});
(async () => {
  const go0 = new URLSearchParams(location.search).get('go');
  if (TOK) {
    try { setState(await call('/api/state')); $('login').style.display = 'none'; render(); if (go0 === 'snap' && !kid()) snapIdea(); if (go0 === 'lists') go('lists'); return; }
    catch (e) { if (TOK && /connection|napping/i.test(e.message)) { const c = localStorage.getItem('np.state'); if (c) { S = JSON.parse(c); OFFLINE = true; $('offline').style.display = 'block'; $('login').style.display = 'none'; render(); return; } } }
  }
  showLogin();
})();

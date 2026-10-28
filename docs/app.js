"use strict";
/* Next Fest AI Explorer — static, no dependencies. All text from data goes through textContent. */

const T = {
  scopes: {in_game_art:"Arte en el juego",store_art:"Arte de tienda",marketing_art:"Marketing",textures:"Texturas",
    "3d_models":"Modelos 3D",animation:"Animación",code:"Código",dialogue:"Diálogo",narrative:"Narrativa",
    general_text:"Texto general",localization:"Localización",voice:"Voz",music:"Música",sound_effects:"Efectos de sonido",
    video:"Video",live_generated_content:"Contenido en vivo",other:"Otro",unknown:"No especificado",ui_art:"Arte de UI"},
  gen: {pre_generated:"Pre-generado",live_generated:"En vivo",both:"Ambos",unclear:"No claro"},
  genColor: {pre_generated:"var(--s1)",live_generated:"var(--s2)",both:"var(--s3)",unclear:"var(--neutral)"},
  platforms: {windows:"Windows",mac:"macOS",linux:"Linux"},
};
const SPECIFIC = s => s !== "unknown" && s !== "other";
const PAGE = 50;
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v; else if (k === "text") e.textContent = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k.startsWith("aria-") && typeof v === "boolean") e.setAttribute(k, String(v));
    else if (v !== false && v != null) e.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids) if (k != null) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
};
const fmt = n => n.toLocaleString("es", {useGrouping: "always"});
const pct = (a, b) => b ? (100 * a / b) : 0;
const pctStr = (a, b) => b ? pct(a, b).toFixed(1).replace(".", ",") + " %" : "—";

let DATA, G = [], BASE = {ai: 0, n: 0}, FILTERED = [];
const periodOf = g => g.ry ? (g.rq ? `${g.ry} T${g.rq}` : `${g.ry} (año)`) : "Sin fecha";
const periodKey = g => g.ry ? g.ry * 10 + (g.rq || 0) : 99999;
const nSpecific = g => g.a ? g.a.sc.filter(SPECIFIC).length : 0;

/* ---------- state ---------- */
const blank = () => ({q:"", studio:"", ai:"all", gt:new Set(), live:"any", sc:new Set(), scMode:"any", genre:new Set(), tag:new Set(),
  period:new Set(), plat:new Set(), minLang:0, minCats:0, demo:false, page:0, sort:"cats", dir:-1, metric:"share", dim:"genre"});
let S = blank();
const SETS = ["gt", "sc", "genre", "tag", "period", "plat"];
const NUM = ["minLang", "minCats", "page", "dir"];

function saveHash() {
  const p = new URLSearchParams();
  const d = blank();
  for (const k of Object.keys(S)) {
    if (SETS.includes(k)) { if (S[k].size) p.set(k, [...S[k]].join("|")); }
    else if (S[k] !== d[k]) p.set(k, S[k] === true ? "1" : String(S[k]));
  }
  try { history.replaceState(null, "", p.toString() ? "#" + p.toString() : location.pathname + location.search); } catch (e) {}
}
function loadHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  const d = blank(); S = blank();
  for (const [k, v] of p) {
    if (!(k in d)) continue;
    if (SETS.includes(k)) S[k] = new Set(v.split("|").filter(Boolean));
    else if (NUM.includes(k)) S[k] = Number(v) || 0;
    else if (typeof d[k] === "boolean") S[k] = v === "1";
    else S[k] = v;
  }
  if (S.dir !== 1) S.dir = -1;
}

/* ---------- filtering ---------- */
function aiFilterActive() { return S.gt.size || S.sc.size || S.live !== "any" || S.minCats > 0; }
function matches(g) {
  if (S.ai !== "all") { const want = S.ai === "null" ? null : Number(S.ai); if (g.ai !== want) return false; }
  if (aiFilterActive() && g.ai !== 1) return false;
  if (S.q) { const q = S.q.toLowerCase(); if (!(g.n.toLowerCase().includes(q) || String(g.id) === q)) return false; }
  if (S.studio) { const q = S.studio.toLowerCase(); if (!g._studios.includes(q)) return false; }
  if (S.genre.size && !g.gen.some(x => S.genre.has(x))) return false;
  if (S.tag.size && ![...S.tag].every(t => g.tag.includes(t))) return false;
  if (S.period.size && !S.period.has(periodOf(g))) return false;
  if (S.plat.size && ![...S.plat].every(p => g.pl.includes(p))) return false;
  if (S.minLang && g.lang < S.minLang) return false;
  if (S.demo && !g.demo) return false;
  if (g.ai === 1) {
    const a = g.a;
    if (S.gt.size && !a.gt.some(x => S.gt.has(x))) return false;
    if (S.live !== "any" && String(a.live === true ? 1 : a.live === false ? 0 : "n") !== S.live) return false;
    if (S.sc.size) {
      const has = x => a.sc.includes(x);
      if (S.scMode === "all" ? ![...S.sc].every(has) : ![...S.sc].some(has)) return false;
    }
    if (S.minCats && nSpecific(g) < S.minCats) return false;
  }
  return true;
}

/* ---------- tooltip ---------- */
const tip = $("#tip");
function showTip(html, x, y) {
  tip.replaceChildren(...html);
  tip.style.opacity = 1;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = Math.min(innerWidth - w - 8, Math.max(8, x + 12)) + "px";
  tip.style.top = Math.min(innerHeight - h - 8, Math.max(8, y + 14)) + "px";
}
const hideTip = () => { tip.style.opacity = 0; };
function tipOn(node, make) {
  const show = e => {
    const r = node.getBoundingClientRect();
    const x = e.clientX ?? r.left + r.width / 2, y = e.clientY ?? r.top;
    showTip(make(), x, y);
  };
  node.addEventListener("pointermove", show);
  node.addEventListener("focus", show);
  node.addEventListener("pointerleave", hideTip);
  node.addEventListener("blur", hideTip);
}
const tipLines = (value, label, extra) => [el("b", {text: value}), el("div", {text: label}), extra ? el("div", {text: extra}) : null].filter(Boolean);

/* ---------- pickers ---------- */
function picker(label, options, set, onChange, opts = {}) {
  const sorted = options;
  const details = el("details", {class: "picker"});
  const count = el("span", {class: "count"});
  const sum = el("summary", {}, el("span", {text: label}), count);
  const search = el("input", {type: "search", placeholder: "Buscar…", "aria-label": "Buscar en " + label});
  const list = el("div", {class: "opts", role: "listbox", "aria-multiselectable": "true"});
  const foot = el("div", {class: "foot"}, el("span", {text: ""}),
    el("button", {type: "button", text: "Limpiar", onclick: () => { set.clear(); render(); onChange(); }}));
  const refreshCount = () => { count.textContent = set.size; count.style.display = set.size ? "" : "none"; };
  function render() {
    const q = search.value.trim().toLowerCase();
    list.replaceChildren();
    let shown = 0;
    for (const o of sorted) {
      if (q && !o.text.toLowerCase().includes(q)) continue;
      if (++shown > 120) break;
      const cb = el("input", {type: "checkbox"}); cb.checked = set.has(o.v);
      cb.addEventListener("change", () => { cb.checked ? set.add(o.v) : set.delete(o.v); refreshCount(); onChange(); });
      list.append(el("label", {class: "opt"}, cb, el("span", {text: o.text}), el("span", {class: "n", text: o.n != null ? fmt(o.n) : ""})));
    }
    if (!shown) list.append(el("div", {class: "empty", text: "Sin resultados"}));
    foot.firstChild.textContent = sorted.length > 120 && !q ? `Mostrando 120 de ${fmt(sorted.length)} — usa la búsqueda` : "";
    refreshCount();
  }
  search.addEventListener("input", render);
  details.append(sum, el("div", {class: "panel"}, search, list, foot));
  details.addEventListener("toggle", () => { if (details.open) { render(); search.focus(); } });
  render();
  return {node: el("div", {class: "field"}, el("span", {class: "lbl", text: opts.title || label}), details), refresh: render, details};
}
document.addEventListener("click", e => { document.querySelectorAll("details.picker[open]").forEach(d => { if (!d.contains(e.target)) d.open = false; }); });
document.addEventListener("keydown", e => { if (e.key === "Escape") document.querySelectorAll("details.picker[open]").forEach(d => d.open = false); });

/* ---------- filter UI ---------- */
let pickers = {};
function countBy(fn, games = G) { const m = new Map(); for (const g of games) for (const k of fn(g)) m.set(k, (m.get(k) || 0) + 1); return m; }
const toOpts = (m, textFn = x => x) => [...m].sort((a, b) => b[1] - a[1]).map(([v, n]) => ({v, text: textFn(v), n}));

function buildFilters() {
  const f = $("#filters"); f.replaceChildren();
  const field = (label, node, id) => el("div", {class: "field"}, el("label", {for: id, text: label}), node);
  const q = el("input", {type: "search", id: "f-q", placeholder: "Nombre o AppID", value: S.q});
  q.addEventListener("input", () => { S.q = q.value; S.page = 0; update(); });
  const studio = el("input", {type: "search", id: "f-studio", placeholder: "Developer o publisher", value: S.studio});
  studio.addEventListener("input", () => { S.studio = studio.value; S.page = 0; update(); });
  const select = (id, opts, key, extra) => {
    const s = el("select", {id}, ...opts.map(([v, t]) => el("option", {value: v, text: t})));
    s.value = String(S[key]);
    s.addEventListener("change", () => { S[key] = s.value; if (key === "minLang" || key === "minCats") S[key] = Number(s.value); S.page = 0; update(); });
    return s;
  };
  const aiSel = select("f-ai", [["all", "Todos"], ["1", "Declara IA"], ["0", "Sin disclosure"], ["null", "Desconocido"]], "ai");
  const liveSel = select("f-live", [["any", "Cualquiera"], ["1", "Genera en vivo"], ["0", "No genera en vivo"], ["n", "No indicado"]], "live");
  const modeSel = select("f-mode", [["any", "Cualquiera de las elegidas"], ["all", "Todas las elegidas"]], "scMode");
  const langSel = select("f-lang", [[0, "Cualquiera"], [2, "2 o más"], [4, "4 o más"], [9, "9 o más"], [20, "20 o más"]], "minLang");
  const catSel = select("f-cats", [[0, "Cualquiera"], [2, "2 o más"], [4, "4 o más"], [6, "6 o más"], [8, "8 o más"]], "minCats");
  const demo = el("input", {type: "checkbox", id: "f-demo"}); demo.checked = S.demo;
  demo.addEventListener("change", () => { S.demo = demo.checked; S.page = 0; update(); });

  const change = () => { S.page = 0; update(); };
  const aiGames = G.filter(g => g.ai === 1);
  const scopeOpts = toOpts(countBy(g => g.a.sc, aiGames), s => T.scopes[s] || s);
  const genOpts = toOpts(countBy(g => g.a.gt, aiGames), s => T.gen[s] || s);
  const genreOpts = toOpts(countBy(g => g.gen));
  const tagOpts = toOpts(countBy(g => g.tag));
  const periodMap = countBy(g => [periodOf(g)]);
  const periodOpts = [...periodMap].map(([v, n]) => ({v, text: v, n})).sort((a, b) => {
    const ka = a.v === "Sin fecha" ? 99999 : parseInt(a.v) * 10 + (/T(\d)/.test(a.v) ? +a.v.match(/T(\d)/)[1] : 0);
    const kb = b.v === "Sin fecha" ? 99999 : parseInt(b.v) * 10 + (/T(\d)/.test(b.v) ? +b.v.match(/T(\d)/)[1] : 0);
    return ka - kb;
  });
  const platOpts = toOpts(countBy(g => g.pl), p => T.platforms[p] || p);

  pickers = {
    sc: picker("Usos de IA", scopeOpts, S.sc, change, {title: "Para qué usan IA"}),
    gt: picker("Tipo de generación", genOpts, S.gt, change),
    genre: picker("Género", genreOpts, S.genre, change),
    tag: picker("Tags (todos)", tagOpts, S.tag, change, {title: "Tags de Steam"}),
    period: picker("Lanzamiento", periodOpts, S.period, change, {title: "Fecha de lanzamiento"}),
    plat: picker("Plataforma", platOpts, S.plat, change),
  };
  f.append(field("Buscar juego", q, "f-q"), field("Estado de IA", aiSel, "f-ai"), pickers.sc.node, field("Combinar usos", modeSel, "f-mode"),
    pickers.gt.node, field("Generación en vivo", liveSel, "f-live"), field("Mín. categorías de IA", catSel, "f-cats"),
    pickers.genre.node, pickers.tag.node, pickers.period.node, pickers.plat.node, field("Idiomas soportados", langSel, "f-lang"),
    field("Estudio", studio, "f-studio"),
    el("div", {class: "field"}, el("span", {class: "lbl", text: "Otros"}),
      el("label", {class: "check"}, demo, "Con demo")),
    el("div", {class: "field"}, el("span", {class: "lbl", text: " "}),
      el("button", {class: "btn", type: "button", text: "Reiniciar filtros", onclick: () => { S = Object.assign(blank(), {sort: S.sort, dir: S.dir}); buildFilters(); update(); }})));
}

function renderChips() {
  const c = $("#chips"); c.replaceChildren();
  const add = (label, remove) => c.append(el("span", {class: "chip"}, label, el("button", {type: "button", "aria-label": "Quitar filtro " + label, text: "×", onclick: () => { remove(); S.page = 0; buildFilters(); update(); }})));
  if (S.q) add("Nombre: " + S.q, () => S.q = "");
  if (S.studio) add("Estudio: " + S.studio, () => S.studio = "");
  if (S.ai !== "all") add("IA: " + ({1: "declara", 0: "sin disclosure", null: "desconocido"}[S.ai] ?? S.ai), () => S.ai = "all");
  S.sc.forEach(v => add((T.scopes[v] || v), () => S.sc.delete(v)));
  S.gt.forEach(v => add("Generación: " + (T.gen[v] || v), () => S.gt.delete(v)));
  S.genre.forEach(v => add("Género: " + v, () => S.genre.delete(v)));
  S.tag.forEach(v => add("Tag: " + v, () => S.tag.delete(v)));
  S.period.forEach(v => add("Lanz.: " + v, () => S.period.delete(v)));
  S.plat.forEach(v => add(T.platforms[v] || v, () => S.plat.delete(v)));
  if (S.live !== "any") add("En vivo: " + ({1: "sí", 0: "no", n: "no indicado"}[S.live]), () => S.live = "any");
  if (S.minCats) add(`≥ ${S.minCats} categorías`, () => S.minCats = 0);
  if (S.minLang) add(`≥ ${S.minLang} idiomas`, () => S.minLang = 0);
  if (S.demo) add("Con demo", () => S.demo = false);
  $("#fcount").textContent = c.children.length ? c.children.length + " activos" : "";
  $("#filter-hint").textContent = aiFilterActive()
    ? "Los filtros de uso, tipo de generación, “en vivo” y categorías mínimas solo aplican a juegos que declaran IA, así que excluyen al resto."
    : "";
}

/* ---------- chart primitives ---------- */
function card(title, sub, headRight) {
  const c = el("div", {class: "card"}, el("div", {class: "card-head"}, el("div", {}, el("h2", {text: title}), el("p", {class: "sub", text: sub})), headRight || null));
  return c;
}
function tableToggle(c, body, tableRows, cols) {
  const btn = el("button", {class: "tbl-toggle", type: "button", "aria-pressed": "false", text: "Ver como tabla"});
  const tbl = el("table", {class: "mini-table"}, el("thead", {}, el("tr", {}, ...cols.map((h, i) => el("th", {class: i ? "num" : "", text: h})))),
    el("tbody", {}, ...tableRows.map(r => el("tr", {}, ...r.map((v, i) => el("td", {class: i ? "num" : "", text: v}))))));
  tbl.hidden = true;
  btn.addEventListener("click", () => { const on = tbl.hidden; tbl.hidden = !on; body.hidden = on; btn.setAttribute("aria-pressed", on); btn.textContent = on ? "Ver como gráfico" : "Ver como tabla"; });
  c.append(el("div", {}, btn), tbl);
}
function barChart(c, rows, {max, onClick, valueText, tipLabel}) {
  const body = el("div", {class: "bars"});
  if (!rows.length) body.append(el("div", {class: "empty", text: "Sin datos para esta selección"}));
  const mx = max ?? Math.max(1, ...rows.map(r => r.value));
  for (const r of rows) {
    const row = el("div", {class: "brow", tabindex: "0", role: "button", "aria-label": `${r.label}: ${valueText(r)}`},
      el("div", {class: "bl", text: r.label, title: r.label}),
      el("div", {class: "btrack"}, el("div", {class: "bar", style: `width:calc(${(100 * r.value / mx).toFixed(2)}% * .78)`}), el("span", {class: "bv", text: valueText(r)})));
    tipOn(row, () => tipLines(valueText(r), r.label, r.sub));
    if (onClick) { row.addEventListener("click", () => onClick(r)); row.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(r); } }); }
    body.append(row);
  }
  c.append(body);
  tableToggle(c, body, rows.map(r => [r.label, valueText(r), r.sub || ""]), ["", "Valor", "Detalle"]);
}
function colChart(c, rows, {max, valueText, onClick}) {
  const body = el("div");
  if (!rows.length) body.append(el("div", {class: "empty", text: "Sin datos para esta selección"}));
  else {
    const mx = max ?? Math.max(1, ...rows.map(r => r.value));
    const cols = el("div", {class: "cols"}), xl = el("div", {class: "xl"});
    for (const r of rows) {
      const col = el("div", {class: "col", tabindex: "0", role: "button", "aria-label": `${r.label}: ${valueText(r)}`},
        el("div", {class: "cv", text: valueText(r)}), el("div", {class: "cb", style: `height:${Math.max(1, 100 * r.value / mx * .82).toFixed(2)}%`}));
      tipOn(col, () => tipLines(valueText(r), r.label, r.sub));
      if (onClick) col.addEventListener("click", () => onClick(r));
      cols.append(col); xl.append(el("span", {text: r.label}));
    }
    body.append(cols, xl);
  }
  c.append(body);
  tableToggle(c, body, rows.map(r => [r.label, valueText(r), r.sub || ""]), ["", "Valor", "Detalle"]);
}

/* ---------- charts ---------- */
function renderKpis(list) {
  const ai = list.filter(g => g.ai === 1), aiKnown = list.filter(g => g.ai !== null);
  const share = pct(ai.length, aiKnown.length), base = pct(BASE.ai, BASE.known);
  const studios = new Set(); ai.forEach(g => g.dev.forEach(d => studios.add(d)));
  const avgCats = ai.length ? ai.reduce((s, g) => s + nSpecific(g), 0) / ai.length : 0;
  const live = ai.filter(g => g.a.live === true).length;
  const diff = share - base;
  const delta = !aiKnown.length ? "" : list.length === G.length ? `del total comprobado (${fmt(aiKnown.length)} juegos)`
    : Math.abs(diff) < 0.05 ? `igual que todo el evento (${base.toFixed(1).replace(".", ",")} %)`
    : `${diff >= 0 ? "+" : "−"}${Math.abs(diff).toFixed(1).replace(".", ",")} pts vs. todo el evento (${base.toFixed(1).replace(".", ",")} %)`;
  // when a filter already restricts the selection by AI status, a share would be a tautology (0 % or 100 %): show a count instead
  const restricted = S.ai !== "all" || aiFilterActive();
  const k = (cls, label, value, d) => el("div", {class: "card kpi " + cls}, el("div", {class: "label", text: label}), el("div", {class: "value", text: value}), el("div", {class: "delta", text: d || ""}));
  $("#kpis").replaceChildren(
    restricted ? k("hero", S.ai === "0" ? "Juegos sin disclosure" : S.ai === "null" ? "Juegos con estado desconocido" : "Juegos que declaran IA", fmt(list.length),
        `de ${fmt(G.length)} en el evento (${pctStr(list.length, G.length)})`)
      : k("hero", "Declaran IA generativa", aiKnown.length ? share.toFixed(1).replace(".", ",") + " %" : "—", delta),
    k("", "Juegos en la selección", fmt(list.length), `${fmt(ai.length)} declaran IA`),
    k("", "Estudios con IA declarada", fmt(studios.size), "developers distintos"),
    k("", "Categorías de uso por juego", avgCats ? avgCats.toFixed(1).replace(".", ",") : "—", "promedio entre los que declaran"),
    k("", "Generación en vivo", fmt(live), "juegos que lo declaran"));
}

function renderCharts(list) {
  const root = $("#charts"); root.replaceChildren();
  const ai = list.filter(g => g.ai === 1);

  // 1. genre / tag
  {
    const forced = S.ai !== "all";
    const metric = forced ? "count" : S.metric;
    const dimFn = S.dim === "genre" ? g => g.gen : g => g.tag;
    const total = countBy(dimFn, list), withAi = countBy(dimFn, ai);
    const minN = Math.max(8, Math.min(30, Math.round(list.length * .004)));
    let rows = [...total].filter(([k, n]) => metric === "count" ? n >= 1 : n >= minN).map(([k, n]) => ({key: k, label: k, n, ai: withAi.get(k) || 0}));
    rows.forEach(r => r.value = metric === "share" ? pct(r.ai, r.n) : (S.ai === "1" ? r.ai : r.n));
    rows.sort((a, b) => b.value - a.value); rows = rows.slice(0, 12);
    const seg = el("div", {class: "seg", role: "group", "aria-label": "Métrica"},
      el("button", {type: "button", text: "% con IA", "aria-pressed": metric === "share", disabled: forced, onclick: () => { S.metric = "share"; update(); }}),
      el("button", {type: "button", text: "Juegos", "aria-pressed": metric === "count", onclick: () => { S.metric = "count"; update(); }}));
    const seg2 = el("div", {class: "seg", role: "group", "aria-label": "Dimensión"},
      el("button", {type: "button", text: "Género", "aria-pressed": S.dim === "genre", onclick: () => { S.dim = "genre"; update(); }}),
      el("button", {type: "button", text: "Tag", "aria-pressed": S.dim === "tag", onclick: () => { S.dim = "tag"; update(); }}));
    const c = card(`${S.dim === "genre" ? "Géneros" : "Tags"} ${metric === "share" ? "con mayor % de juegos con IA" : "con más juegos"}`,
      metric === "share" ? `Solo categorías con al menos ${minN} juegos en la selección. Clic en una barra para filtrar.` : "Clic en una barra para filtrar.",
      el("div", {style: "display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end"}, seg2, seg));
    barChart(c, rows, {
      valueText: r => metric === "share" ? `${r.value.toFixed(1).replace(".", ",")} % (${r.ai}/${r.n})` : fmt(r.value),
      onClick: r => { S[S.dim === "genre" ? "genre" : "tag"].add(r.key); S.page = 0; buildFilters(); update(); }});
    root.append(c);
  }

  // 2. usage categories
  {
    const m = countBy(g => g.a.sc, ai);
    const rows = [...m].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, n]) => ({key: k, label: T.scopes[k] || k, value: n, sub: `${pctStr(n, ai.length)} de los que declaran`}));
    const c = card("Para qué usan IA", "Juegos que mencionan cada uso (un juego puede tener varios). Clic para filtrar.");
    barChart(c, rows, {valueText: r => `${fmt(r.value)} · ${pctStr(r.value, ai.length)}`, onClick: r => { S.sc.add(r.key); S.page = 0; buildFilters(); update(); }});
    root.append(c);
  }

  // 3. generation type (100% bar)
  {
    const m = countBy(g => [g.a.gt[0] || "unclear"], ai);
    const order = ["pre_generated", "live_generated", "both", "unclear"];
    const c = card("Tipo de generación declarado", "¿El contenido se generó antes del lanzamiento o durante el juego? “No claro” = el texto no lo dice.");
    const body = el("div");
    if (!ai.length) body.append(el("div", {class: "empty", text: "Sin juegos que declaren IA en la selección"}));
    else {
      const stack = el("div", {class: "stack"}), legend = el("div", {class: "legend"});
      for (const k of order) {
        const n = m.get(k) || 0; if (!n) continue;
        const seg = el("div", {style: `flex:${n};background:${T.genColor[k]}`, tabindex: "0", role: "button", "aria-label": `${T.gen[k]}: ${n}`, text: pct(n, ai.length) >= 9 ? pct(n, ai.length).toFixed(0) + " %" : ""});
        tipOn(seg, () => tipLines(fmt(n), `${T.gen[k]} · ${pctStr(n, ai.length)}`));
        seg.addEventListener("click", () => { S.gt.add(k); S.page = 0; buildFilters(); update(); });
        stack.append(seg);
        const key = el("span", {class: "k"}, el("i", {style: `background:${T.genColor[k]}`}), `${T.gen[k]}: ${fmt(n)} (${pctStr(n, ai.length)})`);
        legend.append(key);
      }
      body.append(stack, legend);
      const liveN = ai.filter(g => g.a.live === true).length, noLive = ai.filter(g => g.a.live === false).length;
      body.append(el("p", {class: "sub", style: "margin-top:12px", text: `${fmt(noLive)} juegos afirman expresamente que no generan contenido durante el juego; ${fmt(liveN)} sí lo hacen.`}));
    }
    c.append(body);
    tableToggle(c, body, order.map(k => [T.gen[k], fmt(m.get(k) || 0), pctStr(m.get(k) || 0, ai.length)]), ["Tipo", "Juegos", "%"]);
    root.append(c);
  }

  // 4. release period
  {
    const total = countBy(g => [periodOf(g)], list), withAi = countBy(g => [periodOf(g)], ai);
    const keyOf = p => p === "Sin fecha" ? 99999 : parseInt(p) * 10 + (/T(\d)/.test(p) ? +p.match(/T(\d)/)[1] : 0);
    const share = S.ai === "all";
    let rows = [...total].map(([p, n]) => ({key: p, label: p, n, ai: withAi.get(p) || 0}));
    rows = rows.sort((a, b) => b.n - a.n).slice(0, 10).sort((a, b) => keyOf(a.key) - keyOf(b.key));
    rows.forEach(r => { r.value = share ? pct(r.ai, r.n) : r.n; r.sub = `${r.ai} de ${r.n} juegos declaran IA`; });
    const c = card(share ? "% con IA por fecha de lanzamiento" : "Juegos por fecha de lanzamiento", "Los 10 periodos con más juegos, en orden cronológico. T = trimestre; “año” = solo se indica el año.");
    colChart(c, rows, {max: share ? Math.max(60, ...rows.map(r => r.value)) : undefined, valueText: r => share ? r.value.toFixed(0) + "%" : fmt(r.value),
      onClick: r => { S.period.add(r.key); S.page = 0; buildFilters(); update(); }});
    root.append(c);
  }

  // 5. languages
  {
    const bins = [["1", 0, 1], ["2–3", 2, 3], ["4–8", 4, 8], ["9–19", 9, 19], ["20+", 20, 999]];
    const share = S.ai === "all";
    const rows = bins.map(([label, lo, hi]) => {
      const inBin = list.filter(g => g.lang >= lo && g.lang <= hi);
      const n = inBin.length, a = inBin.filter(g => g.ai === 1).length;
      return {key: lo, label, n, ai: a, value: share ? pct(a, n) : n, sub: `${a} de ${n} juegos declaran IA`};
    });
    const c = card(share ? "% con IA según número de idiomas" : "Juegos según número de idiomas", "Cantidad de idiomas con soporte en la tienda (de interfaz, audio o subtítulos).");
    colChart(c, rows, {max: share ? Math.max(60, ...rows.map(r => r.value)) : undefined, valueText: r => share ? r.value.toFixed(0) + "%" : fmt(r.value),
      onClick: r => { S.minLang = r.key; S.page = 0; buildFilters(); update(); }});
    root.append(c);
  }

  // 6. studios
  {
    const m = new Map(), tot = new Map();
    for (const g of list) for (const d of g.dev) { tot.set(d, (tot.get(d) || 0) + 1); if (g.ai === 1) m.set(d, (m.get(d) || 0) + 1); }
    const rows = [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10).map(([k, n]) => ({key: k, label: k, value: n, sub: `${pctStr(n, tot.get(k))} de sus juegos en la selección declaran IA`}));
    const c = card("Estudios con más juegos con IA", "Developers con más juegos que declaran IA. Clic para filtrar por estudio.");
    barChart(c, rows, {valueText: r => `${r.value} de ${tot.get(r.key)}`, onClick: r => { S.studio = r.key; S.page = 0; buildFilters(); update(); }});
    root.append(c);
  }
}

/* ---------- table ---------- */
const cols = [["", null], ["Juego", "n"], ["Estudio", "studio"], ["Lanzamiento", "rel"], ["Género", null], ["IA declarada", "cats"], ["Tipo", null], ["Idiomas", "lang"]];
const sortVal = {n: g => g.n.toLowerCase(), studio: g => (g.dev[0] || "").toLowerCase(), rel: g => periodKey(g), cats: g => g.ai === 1 ? nSpecific(g) : -1, lang: g => g.lang};
const openRows = new Set();

function renderTable(list) {
  const sorted = [...list].sort((a, b) => { const f = sortVal[S.sort] || sortVal.n; const x = f(a), y = f(b); return (x < y ? -1 : x > y ? 1 : a.n.localeCompare(b.n)) * (S.sort === "n" ? S.dir : S.dir); });
  FILTERED = sorted;
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE));
  S.page = Math.min(S.page, pages - 1);
  const slice = sorted.slice(S.page * PAGE, (S.page + 1) * PAGE);
  $("#table-title").textContent = `Juegos (${fmt(sorted.length)})`;
  const t = $("#games"); t.replaceChildren();
  t.append(el("thead", {}, el("tr", {}, ...cols.map(([h, key]) => el("th", {scope: "col", "aria-sort": key && S.sort === key ? (S.dir === 1 ? "ascending" : "descending") : null},
    key ? el("button", {type: "button", text: h + (S.sort === key ? (S.dir === 1 ? " ▲" : " ▼") : ""), onclick: () => { if (S.sort === key) S.dir *= -1; else { S.sort = key; S.dir = key === "n" || key === "studio" ? 1 : -1; } S.page = 0; update(); }}) : h)))));
  const tb = el("tbody");
  for (const g of slice) {
    const open = openRows.has(g.id);
    const btn = el("button", {class: "expand", type: "button", "aria-expanded": open, "aria-label": "Ver detalle de " + g.n, text: open ? "−" : "+"});
    const img = g.img ? (() => { const [h, tt] = g.img.split(":"); return el("img", {class: "cap", loading: "lazy", alt: "", referrerpolicy: "no-referrer", width: 116, height: 44,
      src: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${g.id}/${h}/capsule_231x87.jpg?t=${tt}`}); })() : el("div", {class: "cap"});
    const aiCell = el("td");
    if (g.ai === 1) {
      g.a.sc.filter(SPECIFIC).slice(0, 6).forEach(s => aiCell.append(el("span", {class: "pill", text: T.scopes[s] || s})));
      if (nSpecific(g) > 6) aiCell.append(el("span", {class: "pill", text: `+${nSpecific(g) - 6}`}));
      if (!nSpecific(g)) aiCell.append(el("span", {class: "small", text: "Uso no especificado"}));
      if (g.a.live === true) aiCell.append(el("span", {class: "pill live", text: "En vivo"}));
    } else aiCell.append(el("span", {class: "small", text: g.ai === 0 ? "Sin disclosure" : "Desconocido"}));
    const gen = g.ai === 1 ? (g.a.gt.map(x => T.gen[x] || x).join(", ") || "—") : "—";
    const tr = el("tr", {class: "main"}, el("td", {}, btn, " "), el("td", {}, img,
      el("div", {class: "gname"}, el("a", {href: `https://store.steampowered.com/app/${g.id}/`, target: "_blank", rel: "noopener", text: g.n})), el("div", {class: "small", text: "AppID " + g.id})),
      el("td", {text: g.dev.join(", ") || "—"}, g.pub.length && g.pub.join() !== g.dev.join() ? el("div", {class: "small", text: "Pub: " + g.pub.join(", ")}) : null),
      el("td", {text: g.rel || "—"}), el("td", {text: g.gen.join(", ") || "—"}), aiCell, el("td", {text: gen}), el("td", {text: g.lang || "—"}));
    tb.append(tr);
    const toggle = () => { openRows.has(g.id) ? openRows.delete(g.id) : openRows.add(g.id); renderTable(list); };
    btn.addEventListener("click", toggle);
    if (open) tb.append(detailRow(g));
  }
  if (!slice.length) tb.append(el("tr", {}, el("td", {colspan: cols.length, class: "empty", text: "Ningún juego coincide con estos filtros."})));
  t.append(tb);
  const pg = $("#pager"); pg.replaceChildren(
    el("button", {class: "btn", type: "button", text: "← Anterior", disabled: S.page === 0, onclick: () => { S.page--; update(false); $("#games").scrollIntoView({block: "start"}); }}),
    el("span", {text: `Página ${S.page + 1} de ${pages}`}),
    el("button", {class: "btn", type: "button", text: "Siguiente →", disabled: S.page >= pages - 1, onclick: () => { S.page++; update(false); $("#games").scrollIntoView({block: "start"}); }}));
}
function detailRow(g) {
  const td = el("td", {colspan: cols.length});
  const left = el("div", {}, el("h3", {text: "Hecho · Disclosure publicado en Steam (literal)"}), el("p", {text: g.ai === 1 ? (g.raw || "—") : g.ai === 0 ? "Esta página no muestra la sección de IA." : "La página no pudo comprobarse."}));
  const right = el("div");
  if (g.ai === 1) {
    right.append(el("h3", {text: "Análisis · interpretación del modelo" + (g.a.m ? ` (${g.a.m === "haiku" ? "Claude Haiku 5.5" : "Claude, sesión manual"})` : "")}),
      el("p", {text: g.a.sum || "Sin interpretación."}),
      el("p", {class: "small", style: "margin-top:6px", text: `Usos: ${g.a.sc.map(s => T.scopes[s] || s).join(", ") || "—"} · Generación: ${g.a.gt.map(x => T.gen[x] || x).join(", ") || "—"} · En vivo: ${g.a.live === true ? "sí" : g.a.live === false ? "no" : "no indicado"}${g.a.conf != null ? " · Confianza: " + g.a.conf : ""}`}));
  }
  td.append(el("div", {class: "cols2"}, left, right, el("div", {}, el("h3", {text: "Tags de Steam"}), el("p", {text: g.tag.join(", ") || "—"}))));
  return el("tr", {class: "detail"}, td);
}

/* ---------- csv / share ---------- */
const csvCell = v => { let s = String(v ?? ""); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
function downloadCsv() {
  const head = ["appid", "nombre", "developers", "publishers", "lanzamiento", "generos", "tags", "ia_declarada", "usos_ia", "tipo_generacion", "en_vivo", "resumen_modelo", "disclosure_literal", "url"];
  const rows = FILTERED.map(g => [g.id, g.n, g.dev.join("; "), g.pub.join("; "), g.rel, g.gen.join("; "), g.tag.join("; "),
    g.ai === 1 ? "si" : g.ai === 0 ? "no" : "desconocido", g.ai === 1 ? g.a.sc.join("; ") : "", g.ai === 1 ? g.a.gt.join("; ") : "",
    g.ai === 1 ? (g.a.live === true ? "si" : g.a.live === false ? "no" : "") : "", g.ai === 1 ? g.a.sum : "", g.ai === 1 ? g.raw : "", `https://store.steampowered.com/app/${g.id}/`]);
  const blob = new Blob(["﻿" + [head, ...rows].map(r => r.map(csvCell).join(",")).join("\n")], {type: "text/csv;charset=utf-8"});
  const a = el("a", {href: URL.createObjectURL(blob), download: "nextfest_seleccion.csv"}); document.body.append(a); a.click(); a.remove();
}

/* ---------- main ---------- */
let first = true;
function update(full = true) {
  saveHash();
  const list = G.filter(matches);
  renderChips();
  if (full) { renderKpis(list); renderCharts(list); }
  renderTable(list);
  $("#main").classList.remove("loading");
}

function setup() {
  const m = DATA.meta;
  G = DATA.games;
  for (const g of G) g._studios = (g.dev.concat(g.pub)).join("\u0001").toLowerCase();
  const known = G.filter(g => g.ai !== null);
  BASE = {ai: G.filter(g => g.ai === 1).length, n: G.length, known: known.length};
  $("#subtitle").textContent = `Steam Next Fest, octubre 2026 (19–26 oct). ${fmt(G.length)} juegos analizados; ${fmt(BASE.ai)} (${pctStr(BASE.ai, known.length)}) declaran uso de IA generativa en Steam. Filtra para explorar patrones por género, estudio, uso y más.`;
  $("#about-meta").textContent = `Recolección: ${m.collected.slice(0, 10)} · Steam mostraba ${fmt(m.steam_reported)} resultados; se descubrieron ${fmt(m.discovered)} · idioma ${m.language}, país ${m.country} · datos generados el ${m.generated}.`;
  $("#foot").replaceChildren("Datos: Roca Bruja Interactive · ",
    el("a", {href: "https://creativecommons.org/licenses/by/4.0/", rel: "noopener", text: "CC BY 4.0"}),
    " · Fuente: páginas públicas de Steam; nombres, textos e imágenes pertenecen a sus dueños (",
    el("a", {href: "https://github.com/rocabrujainteractive/nextfest-ai-dashboard/blob/main/THIRD_PARTY.md", rel: "noopener", text: "aviso y retirada"}),
    "). Interpretaciones automáticas con modelos de lenguaje; no representan afirmaciones sobre calidad ni sobre la originalidad de ningún juego.");
  loadHash(); buildFilters(); update();
  $("#fbox").open = innerWidth >= 700;
}

$("#btn-csv").addEventListener("click", downloadCsv);
$("#btn-share").addEventListener("click", async e => {
  try { await navigator.clipboard.writeText(location.href); e.target.textContent = "¡Enlace copiado!"; } catch (err) { e.target.textContent = "Copia la URL de la barra"; }
  setTimeout(() => e.target.textContent = "Copiar enlace con filtros", 1800);
});
$("#btn-about").addEventListener("click", () => $("#about").showModal());
$("#about-close").addEventListener("click", () => $("#about").close());
window.addEventListener("hashchange", () => { if (G.length) { loadHash(); buildFilters(); update(); } });

$("#main").classList.add("loading");
fetch("data/games.json").then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(d => { DATA = d; setup(); })
  .catch(err => { $("#subtitle").textContent = "No se pudieron cargar los datos (" + err.message + "). Si abriste el archivo con doble clic, sírvelo con un servidor local: python -m http.server --directory docs"; });

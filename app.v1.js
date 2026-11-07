/*!
 * app.v1.js - the printer finder: the conditions, the list cheapest first, and each printer's page
 *
 * Data, read on the printers' own pages:
 *   papers.v1.js / printers.v1.js  names, papers, settings and spine formulas (shared with the
 *                                  cover print maker, which loads them from this folder)
 *   facts.v1.js                    what each printer's pages say, with the page and its words
 *   prices.v1.js                   each printer's base set (full-color cover, black-and-white text)
 *                                  and its full-color text set ("body": "color")
 * index.html has two tabs: the search (conditions, cheapest first) and all printers (in name
 * order, with what sets each apart and its papers); a printer's page is index.html?p=<id>.
 * The conditions and the open tab are kept in localStorage. Nothing leaves the browser.
 */
(function () {
  "use strict";

  const t = (text, vars) => (window.I18n ? window.I18n.t(text, vars) : text);
  const lang = window.I18n ? window.I18n.lang : "ja";
  const P = window.DoujinPrinters, F = window.DoujinFacts, PRICES = window.DoujinPrices;
  const $ = sel => document.querySelector(sel);
  const STORE = "doujin-printer-finder.state", TAB = "doujin-printer-finder.tab";
  const COVER_MAKER = "https://shiki365.github.io/cover-print-maker/";

  // ---------------------------------------------------------------- what the facts are called

  const LABELS = {
    novel: "小説（文庫・新書）のセット",
    allcolor: "本文フルカラーの本",
    kuchie: "カラー口絵が無料",
    asobi: "遊び紙が無料",
    a4: "A4 の本",
    square: "正方形の本",
    landscape: "横長の本",
    foil: "表紙に箔押し",
    surface: "ホログラムなどの特殊な表面加工",
    paper: "表紙を特殊紙に",
    rgb: "表紙を RGB のまま入稿",
    web: "注文から入稿まで Web で",
    word: "Word のファイルのまま入稿",
    analog: "紙の原稿（アナログ）で入稿",
    card: "クレジットカードで払える",
    later: "届いてから払える（後払い・代金引換）",
    event: "イベント会場へ直接搬入",
    storage: "在庫を預かってもらえる",
    split: "分納（届け先を分けられる）",
    tora: "とらのあなへ直接納品",
    melon: "メロンブックスへ直接納品",
  };

  // the check boxes of the list, and the sections of a printer's page
  const GROUPS = [
    ["表紙と本文", ["foil", "surface", "paper", "rgb", "kuchie", "asobi"]],
    ["入稿と支払い", ["web", "word", "analog", "card", "later"]],
    ["納品", ["event", "storage", "split", "tora", "melon"]],
  ];
  const SECTIONS = [
    ["本の形と中身", ["a4", "square", "landscape", "novel", "allcolor", "kuchie", "asobi"]],
    ["表紙の加工", ["foil", "surface", "paper"]],
    ["入稿と支払い", ["rgb", "web", "word", "analog", "card", "later"]],
    ["納品", ["event", "storage", "split", "tora", "melon"]],
  ];
  const WANTS = GROUPS.flatMap(([, keys]) => keys);

  // Formats that only some printers make: the facts a printer needs for them
  const FORMAT_NEEDS = {
    A4: ["a4"], A4yoko: ["a4", "landscape"], A5yoko: ["landscape"], B5yoko: ["landscape"],
    sq182: ["square"], sq148: ["square"],
  };
  const FORMATS = P.FORMATS.filter(f => f.id !== "custom");
  const SHORT = { B5: "B5", A5: "A5", A4: "A4", B6: "B6", A6: "文庫", shinsho: "新書",
    A5yoko: "A5 横長", B5yoko: "B5 横長", A4yoko: "A4 横長", sq182: "正方形 182mm", sq148: "正方形 148mm" };

  // ---------------------------------------------------------------- the conditions (state)

  function defaults() {
    return { format: "B5", pages: 40, copies: 50, budget: null, kind: "", want: [] };
  }

  const whole = (v, lo, hi, d) => (Number.isFinite(+v) && v !== "" && v != null ? Math.min(hi, Math.max(lo, Math.round(+v))) : d);

  function normalize(saved) {
    const s = defaults();
    if (!saved || typeof saved !== "object") return s;
    if (FORMATS.some(f => f.id === saved.format)) s.format = saved.format;
    s.pages = whole(saved.pages, 4, 1000, s.pages);
    s.copies = whole(saved.copies, 1, 1000, s.copies);
    s.budget = saved.budget == null || saved.budget === "" ? null : whole(saved.budget, 0, 10000000, null);
    if (saved.kind === "novel" || saved.kind === "allcolor") s.kind = saved.kind;
    if (Array.isArray(saved.want)) s.want = WANTS.filter(k => saved.want.includes(k));
    return s;
  }

  let state = defaults();

  function load() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORE) || "null"); } catch (e) { saved = null; }
    state = normalize(saved);
  }

  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
  }

  // ---------------------------------------------------------------- printers, facts, prices

  // Printer names are proper nouns kept as the printers write them (papers.v1.js); the English
  // and Korean pages show the latin name and list the printers in that order.
  const printerName = pr => (lang === "ja" ? pr.label : pr.latin || pr.label);
  const PRINTERS = lang === "ja" ? P.PRINTERS : [...P.PRINTERS].sort((a, b) => printerName(a).localeCompare(printerName(b), "en"));
  const byId = id => P.PRINTERS.find(p => p.id === id);
  const facts = id => F.printers[id];
  const fact = (id, key) => (facts(id) || {})[key];
  const yes = (id, key) => !!(fact(id, key) && fact(id, key).v);

  // What sets a printer apart, counted from the facts (no opinions): a yes that fewer than half of
  // the printers have, and a stated no where nearly all the others say yes. "1冊から" counts as one.
  const ALL = Object.keys(F.printers).length;
  const COUNT = {};
  for (const f of Object.values(F.printers)) {
    for (const k of F.keys) if (f[k] && f[k].v) COUNT[k] = (COUNT[k] || 0) + 1;
    if (f.min.n === 1) COUNT.one = (COUNT.one || 0) + 1;
  }
  const RARE = n => n < ALL / 2;
  const COMMON = n => n >= ALL * 0.75;

  function traits(id) {
    const f = facts(id), good = [], bad = [];
    if (f.min.n === 1 && RARE(COUNT.one)) good.push({ label: t("1冊から"), n: COUNT.one, url: f.min.url });
    for (const k of F.keys) {
      const x = f[k];
      if (x && x.v && RARE(COUNT[k] || 0)) good.push({ label: t(LABELS[k]), n: COUNT[k], url: x.url });
      if (x && x.v === false && COMMON(COUNT[k] || 0)) bad.push({ label: t(LABELS[k]), n: COUNT[k], url: x.url });
    }
    return { good, bad };
  }

  // 新書 differs from printer to printer: its size only where a printer publishes one.
  function formatName(f, pr) {
    if (f.id !== "shinsho") return t(f.label);
    if (!pr || !pr.shinsho) return t("新書（大きさは印刷所ごとに違う）");
    return t(f.label, { w: pr.shinsho[0], h: pr.shinsho[1] });
  }

  const tableOf = (set, format) => {
    const g = set.formats[format];
    return typeof g === "string" ? set.formats[g] : g;
  };

  // The price of one set from its table: the first row and column at or above the book (the
  // printers' own rule: a page count or number of copies not in the table costs as the next one up).
  function setPrice(set, format, pages, copies) {
    const g = tableOf(set, format);
    if (!g) return null;
    if (copies < g.c[0] || copies > g.c[g.c.length - 1] || pages > g.p[g.p.length - 1]) return null;
    const i = g.p.findIndex(p => p >= pages), j = g.c.findIndex(c => c >= copies);
    const yen = g.y[i][j];
    return yen == null ? null : { yen, set };
  }

  // Printers left out of the prices, and why (checked on their pages on 2026-11-06).
  // (Graphic and Chokotto were added on 2026-11-07 from their price selector / estimate.)
  const NO_PRICES = {
    starbooks: "料金は発注フォームの計算だけで、納品日ごとの早割で変わり、ひとつの通常料金に決められないので比べていません",
    tsukuyomi: "料金は見積もりフォームだけで、料金表が無いので比べていません",
  };
  // Printers with base set prices but none for a full-color text, and why (checked on 2026-11-07).
  const NO_COLOR_PRICES = {
    chokotto: "本文フルカラーの料金表が、印刷所の自動見積りの値段と合わないので比べていません",
  };

  // Formats a printer makes but whose prices this site did not read (Graphic's landscape and square
  // books cost differently from the portrait ones, and were not fetched).
  const NOT_READ = { graphic: ["A5yoko", "B5yoko", "A4yoko", "sq148", "sq182"] };

  // A full-color text ("本文もフルカラー") is priced with the printers' full-color text sets,
  // every other book with the base sets (full-color cover, black-and-white text).
  const bodyOf = kind => (kind === "allcolor" ? "color" : "mono");
  const setsOf = (id, body) => (PRICES.printers[id] || []).filter(set => (set.body || "mono") === body);
  const WHY = {
    mono: {
      format: "この判型の基本のセットの料金表がありません",
      fewest: "基本のセットは {n} 冊からです",
      most: "基本のセットの料金表は {n} 冊までです",
      thickest: "基本のセットの料金表は表紙込み {n} ページまでです",
      other: "この組み合わせは基本のセットの料金表にありません",
    },
    color: {
      format: "この判型の本文フルカラーのセットの料金表がありません",
      fewest: "本文フルカラーのセットは {n} 冊からです",
      most: "本文フルカラーのセットの料金表は {n} 冊までです",
      thickest: "本文フルカラーのセットの料金表は表紙込み {n} ページまでです",
      other: "この組み合わせは本文フルカラーのセットの料金表にありません",
    },
  };
  const noPrices = (id, body) => (!PRICES.printers[id] || body === "mono"
    ? NO_PRICES[id] || "料金表が無いので比べていません"
    : NO_COLOR_PRICES[id] || "本文フルカラーの料金表が無いので比べていません");

  // The cheapest of a printer's sets for this book (the base sets, or the full-color text ones
  // for s.kind "allcolor"), or { why } when there is none.
  function basePrice(id, s) {
    const body = bodyOf(s.kind), sets = setsOf(id, body), why = WHY[body];
    if (!sets.length) return { why: t(noPrices(id, body)) };
    const pages = s.pages + 4; // the tables count the cover's 4 pages
    const tables = sets.map(set => tableOf(set, s.format)).filter(Boolean);
    if (!tables.length && (NOT_READ[id] || []).includes(s.format)) return { why: t("この判型の値段は、このサイトでは取っていません（印刷所の料金表示で確かめてください）") };
    if (!tables.length) return { why: t(why.format) };
    let best = null;
    for (const set of sets) {
      const p = setPrice(set, s.format, pages, s.copies);
      if (p && (!best || p.yen < best.yen)) best = p;
    }
    if (best) return best;
    const fewest = Math.min(...tables.map(g => g.c[0])), most = Math.max(...tables.map(g => g.c[g.c.length - 1]));
    const thickest = Math.max(...tables.map(g => g.p[g.p.length - 1]));
    if (s.copies < fewest) return { why: t(why.fewest, { n: fewest }) };
    if (s.copies > most) return { why: t(why.most, { n: most }) };
    if (pages > thickest) return { why: t(why.thickest, { n: thickest }) };
    return { why: t(why.other) };
  }

  const KIND_NAMES = { od: "オンデマンド", offset: "オフセット", mix: "表紙オンデマンド・本文オフセット" };
  const yen = n => t("{n}円", { n: n.toLocaleString("ja-JP") });

  // Does the printer meet the conditions (and the extra fact, for the counts next to the boxes)?
  function meets(id, s, extra) {
    const f = facts(id);
    if (!f) return false;
    if (f.min.n != null && f.min.n > s.copies) return false;
    for (const k of FORMAT_NEEDS[s.format] || []) if (!yes(id, k)) return false;
    if (s.kind && !yes(id, s.kind)) return false;
    for (const k of s.want) if (!yes(id, k)) return false;
    return !extra || yes(id, extra);
  }

  // The prices of every printer for a kind of book; a novel set has none here (no prices read).
  const pricesFor = s => new Map(PRINTERS.map(pr => [pr.id, s.kind === "novel" ? null : basePrice(pr.id, s)]));

  function search(s) {
    const prices = pricesFor(s);
    // only a price can be over the budget: a printer without one stays in the list
    const overIn = (map, id) => {
      const p = map.get(id);
      return s.budget != null && !!p && p.yen != null && p.yen > s.budget;
    };
    const over = id => overIn(prices, id);
    const pass = (id, extra) => meets(id, s, extra) && !over(id);
    const hits = PRINTERS.filter(pr => pass(pr.id)).map(pr => ({ pr, price: prices.get(pr.id) }));
    // cheapest first; printers with no price keep their order after them
    const cost = h => (h.price && h.price.yen != null ? h.price.yen : Infinity);
    hits.sort((a, b) => cost(a) - cost(b));
    const counts = {};
    for (const k of WANTS) counts[k] = PRINTERS.filter(pr => pass(pr.id, k)).length;
    // the kinds of book: what the list would show (the budget applies where that kind has prices)
    for (const k of ["novel", "allcolor"]) {
      const other = { ...s, kind: k }, map = k === s.kind ? prices : pricesFor(other);
      counts[k] = PRINTERS.filter(pr => meets(pr.id, other) && !overIn(map, pr.id)).length;
    }
    return { hits, counts, overBudget: PRINTERS.filter(pr => meets(pr.id, s) && over(pr.id)).length };
  }

  // ---------------------------------------------------------------- small helpers

  function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else e.setAttribute(k, v === true ? "" : v);
    }
    for (const c of children) if (c != null && c !== false) e.append(c);
    return e;
  }

  const outLink = (href, text, cls) => el("a", { href, target: "_blank", rel: "noopener", class: cls, text });
  // the printers' own words: proper nouns and quotes stay Japanese in every language
  const own = (text, cls) => el("span", { class: cls, translate: "no", lang: "ja", text });

  // A link to this page with some parameters changed (keeps ?lang= and the like).
  function hrefWith(changes) {
    const q = new URLSearchParams(location.search);
    for (const [k, v] of Object.entries(changes)) { if (v == null) q.delete(k); else q.set(k, v); }
    const s = q.toString();
    return location.pathname + (s ? "?" + s : "");
  }

  const joinSentences = list => list.filter(Boolean).join(lang === "ja" ? "" : " ");

  // ---------------------------------------------------------------- the list

  function buildForm() {
    const sel = $("#format");
    sel.innerHTML = "";
    for (const f of FORMATS) sel.append(el("option", { value: f.id, text: formatName(f) }));
    const box = $("#wantGroups");
    box.innerHTML = "";
    for (const [legend, keys] of GROUPS) {
      const choice = el("div", { class: "choice" });
      for (const k of keys) {
        choice.append(el("label", { "data-want": k },
          el("input", { type: "checkbox", name: "want", value: k }), " ",
          el("span", { class: "text", text: t(LABELS[k]) }), " ",
          el("span", { class: "count", "data-count": k })));
      }
      box.append(el("fieldset", {}, el("legend", { text: t(legend) }), choice));
    }
  }

  function syncForm() {
    $("#format").value = state.format;
    $("#pages").value = state.pages;
    $("#copies").value = state.copies;
    $("#budget").value = state.budget == null ? "" : state.budget;
    for (const r of document.querySelectorAll("input[name=kind]")) r.checked = r.value === state.kind;
    for (const c of document.querySelectorAll("input[name=want]")) c.checked = state.want.includes(c.value);
  }

  function readForm() {
    state = normalize({
      format: $("#format").value,
      pages: $("#pages").value,
      copies: $("#copies").value,
      budget: $("#budget").value,
      kind: (document.querySelector("input[name=kind]:checked") || {}).value || "",
      want: [...document.querySelectorAll("input[name=want]:checked")].map(c => c.value),
    });
  }

  function renderList() {
    const { hits, counts, overBudget } = search(state);
    for (const span of document.querySelectorAll("[data-count]")) {
      const n = counts[span.dataset.count];
      span.textContent = t("{n} 社", { n });
      span.closest("label").classList.toggle("zero", n === 0);
    }
    const priced = hits.filter(h => h.price && h.price.yen != null).length;
    const unpriced = hits.length - priced;
    $("#summary").textContent = !hits.length
      ? joinSentences([t("当てはまる印刷所がありません。条件を減らしてみてください。"),
        overBudget ? t("予算を超える {n} 社は外しています。", { n: overBudget }) : ""])
      : joinSentences([
        state.kind === "novel"
          ? t("{n} 社が当てはまります。値段の目安は基本のセット（本文モノクロ）と本文フルカラーのセットだけなので、小説のセットでは出していません。", { n: hits.length })
          : state.kind === "allcolor"
            ? priced
              ? t("{n} 社が当てはまります。本文フルカラーのセットの値段の目安が出せた {m} 社を安い順に並べています。", { n: hits.length, m: priced })
              : t("{n} 社が当てはまります。この本では本文フルカラーのセットの値段の目安が出せませんでした（理由は各社の欄に）。", { n: hits.length })
            : priced
              ? t("{n} 社が当てはまります。値段の目安が出せた {m} 社を安い順に並べています。", { n: hits.length, m: priced })
              : t("{n} 社が当てはまります。この本では値段の目安が出せませんでした（理由は各社の欄に）。", { n: hits.length }),
        state.kind === "novel" && state.budget != null ? t("予算は、値段の目安を出すときだけ使います。") : "",
        overBudget ? t("予算を超える {n} 社は外しています。", { n: overBudget }) : "",
        state.kind !== "novel" && state.budget != null && unpriced ? t("値段の目安が出せない印刷所は、予算に収まるか分からないので残しています。") : "",
      ]);
    $("#jump").textContent = t("当てはまる {n} 社を見る ↓", { n: hits.length });

    const list = $("#list");
    list.innerHTML = "";
    hits.forEach(({ pr, price }, i) => list.append(card(pr, price, i)));
  }

  function card(pr, price, index) {
    const id = pr.id, f = facts(id);
    const li = el("li", { class: "card" });
    const head = el("div", { class: "head" });
    if (price && price.yen != null && index < 3) {
      head.append(el("span", { class: "rank", text: t("安い順 {n}", { n: index + 1 }) }));
      li.classList.add("top");
    }
    head.append(el("a", { class: "name", href: hrefWith({ p: id }), translate: "no", text: printerName(pr) }));
    head.append(el("a", { class: "more", href: hrefWith({ p: id }), text: t("紹介を見る ›") }));
    li.append(head);
    if (price) li.append(priceLine(price));
    const chips = el("div", { class: "chips" });
    chips.append(f.min.n != null ? outLink(f.min.url, t("{n}冊から", { n: f.min.n })) : el("span", { text: t("最少部数は案内に無し") }));
    // the facts the conditions asked for, each to its page
    const asked = [...(FORMAT_NEEDS[state.format] || []), ...(state.kind ? [state.kind] : []), ...state.want];
    for (const k of asked) {
      const x = fact(id, k);
      if (x && x.v) chips.append(outLink(x.url, t(LABELS[k]), "want"));
    }
    li.append(chips);
    return li;
  }

  function priceLine(price) {
    if (price.yen == null) return el("div", { class: "price why", text: price.why });
    const line = el("div", { class: "price" });
    const a = outLink(price.set.url, "");
    a.append(own(price.set.set)); // the printer's own name for the set
    // Japanese puts no space before full-width brackets
    line.append(el("b", { text: yen(price.yen) }), lang === "ja" ? "" : " ", t("（{kind}、税込）", { kind: t(KIND_NAMES[price.set.kind]) }), " ", a);
    if (price.set.ship === "extra") line.append(" ", t("送料は別"));
    return line;
  }

  // ---------------------------------------------------------------- a printer's page

  function answer(x) {
    if (!x) return el("span", { class: "ans none", text: t("案内に無し") });
    return el("span", { class: "ans " + (x.v ? "yes" : "no"), text: x.v ? t("はい") : t("いいえ") });
  }

  function factRow(label, x) {
    const dd = el("dd", {}, answer(x));
    // the brackets around the quote come from CSS (.quote::before / ::after)
    if (x && x.q) dd.append(own(x.q, "quote"), " ");
    if (x && x.url) dd.append(outLink(x.url, t("根拠のページ"), "src"));
    return el("div", { class: "fact" }, el("dt", { text: label }), dd);
  }

  function section(title, ...children) {
    return el("section", {}, el("h3", { text: title }), ...children);
  }

  function renderDetail(pr) {
    const id = pr.id, f = facts(id), box = $("#detail");
    // after i18n.v1.js has translated the page's own title (it looks the title up once loaded)
    const title = () => { document.title = t("{name} | 同人誌の印刷所さがし", { name: printerName(pr) }); };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", title);
    else title();
    box.innerHTML = "";
    box.append(el("h2", { translate: "no", text: printerName(pr) }));
    const cover = COVER_MAKER + "?" + new URLSearchParams({ printer: id, format: state.format, pages: state.pages });
    box.append(el("div", { class: "buttons" },
      el("a", { class: "button primary", href: cover, text: t("この印刷所で表紙を作る") }),
      outLink(f.site, t("印刷所の公式サイト"), "button")));
    box.append(el("p", { class: "lead", text: t("「この印刷所で表紙を作る」は、表紙入稿メーカー（同じ作者の別のツール）を、この印刷所の塗り足し・背幅の式に合わせて開きます。") }));
    box.append(...traitRows(id));

    // copies and the base sets
    const minRow = factRow(t("最少部数"), null);
    minRow.querySelector("dd").replaceChildren(f.min.n != null
      ? el("span", {}, el("span", { class: "ans yes", text: t("{n}冊から", { n: f.min.n }) }), outLink(f.min.url, t("根拠のページ"), "src"))
      : el("span", { class: "ans none", text: t("案内に無し") }));
    const fmt = FORMATS.find(x => x.id === state.format);
    // the book of the list's conditions, with the base sets and with the full-color text sets
    const priceRow = (label, kind, desc) => el("div", { class: "fact" },
      el("dt", { text: label }),
      el("dd", {}, priceLine(basePrice(id, { ...state, kind })), el("div", { class: "desc", text: desc })));
    const rows = [minRow, priceRow(t("値段の目安"), "",
      t("{format}・本文 {pages} ページ・{copies} 冊で、表紙フルカラー・本文モノクロの基本のセット（一覧で入れた条件）", { format: formatName(fmt, pr), pages: state.pages, copies: state.copies }))];
    if (PRICES.printers[id]) rows.push(priceRow(t("本文フルカラーの値段の目安"), "allcolor", t("同じ本の本文もフルカラーにしたとき（本文フルカラーのセット）")));
    box.append(section(t("部数と値段"), el("dl", { class: "fact-list" }, ...rows), setsTable(id)));

    for (const [title, keys] of SECTIONS) {
      const dl = el("dl", { class: "fact-list" });
      for (const k of keys) dl.append(factRow(t(LABELS[k]), fact(id, k)));
      if (title === "本の形と中身") {
        dl.append(el("div", { class: "fact" }, el("dt", { text: t("新書の大きさ") }),
          el("dd", {}, pr.shinsho ? el("span", { class: "ans", text: t("{w}×{h}mm", { w: pr.shinsho[0], h: pr.shinsho[1] }) }) : el("span", { class: "ans none", text: t("案内に無し") }))));
      }
      box.append(section(t(title), dl));
    }

    box.append(rulesSection(pr));
    box.append(papersSection(pr));
    box.append(spineSection(pr));
    box.append(sourcesSection(pr));
    // a set read on another day carries its own date (Graphic and Chokotto, from their estimates;
    // the full-color text sets)
    const dayOf = sets => ((sets.find(s => s.checked) || {}).checked || PRICES.checked);
    const color = setsOf(id, "color");
    box.append(el("p", { class: "desc", text: color.length
      ? t("確かめた日: 事実 {a}、料金 {b}、本文フルカラーの料金 {c}（各社の公式ページ）", { a: F.checked, b: dayOf(setsOf(id, "mono")), c: dayOf(color) })
      : t("確かめた日: 事実 {a}、料金 {b}（各社の公式ページ）", { a: F.checked, b: dayOf(setsOf(id, "mono")) }) }));
  }

  // "ほかではあまり見ないこと" / "多くの社と違ってできないこと", each fact to its page
  function traitRows(id) {
    const { good, bad } = traits(id);
    const chip = (x, cls) => {
      const label = t("{what}（{n}/{all} 社）", { what: x.label, n: x.n, all: ALL });
      return x.url ? outLink(x.url, label, cls) : el("span", { class: cls, text: label });
    };
    const rows = [];
    if (good.length) rows.push(el("div", { class: "traits" }, el("span", { class: "k", text: t("ほかではあまり見ないこと") }),
      el("div", { class: "chips" }, ...good.map(x => chip(x, "good")))));
    if (bad.length) rows.push(el("div", { class: "traits" }, el("span", { class: "k", text: t("多くの社と違ってできないこと") }),
      el("div", { class: "chips" }, ...bad.map(x => chip(x, "bad")))));
    return rows;
  }

  // The papers in the printer's spine calculator (the values are what its formula uses).
  const paperLabel = item => item.label + (item.mm != null ? t("（{n}mm）", { n: item.mm }) : "");

  function paperList(items) {
    return el("ul", { translate: "no", lang: "ja" }, ...items.map(item => el("li", { text: paperLabel(item) })));
  }

  function papersSection(pr) {
    const sec = section(t("紙の種類"));
    const f = facts(pr.id);
    if (!pr.body.length) {
      sec.append(el("p", { class: "desc", text: t("この印刷所は背幅の計算フォームを公開していないので、紙の一覧はこのサイトに入れていません。印刷所のページで確かめてください。") }));
    } else {
      sec.append(el("p", { class: "desc", text: t("印刷所の背幅の計算フォームにある紙です（括弧の中は、その計算に使う厚さの値）。ほかにも選べる紙があることがあります。") }));
      sec.append(el("div", { class: "papers" }, el("b", { text: t("本文の紙（{n} 種）", { n: pr.body.length }) }), paperList(pr.body)));
      if (pr.cover.length) sec.append(el("div", { class: "papers" }, el("b", { text: t("表紙の紙（{n} 種）", { n: pr.cover.length }) }), paperList(pr.cover)));
      else sec.append(el("p", { class: "desc", text: t("表紙の紙は、この印刷所の背幅の式に使わないので一覧がありません。") }));
    }
    if (f.paper && f.paper.v && f.paper.url) sec.append(el("p", { class: "desc" }, outLink(f.paper.url, t("表紙の特殊紙の案内（印刷所のページ）"))));
    return sec;
  }

  // ---------------------------------------------------------------- all printers

  function renderDirectory() {
    const box = $("#directory");
    box.innerHTML = "";
    for (const pr of PRINTERS) {
      const id = pr.id, f = facts(id);
      if (!f) continue;
      const card = el("article", { class: "entry" });
      card.append(el("div", { class: "head" },
        el("a", { class: "name", href: hrefWith({ p: id }), translate: "no", text: printerName(pr) }),
        el("a", { class: "more", href: hrefWith({ p: id }), text: t("紹介を見る ›") })));
      const line = (label, ...value) => el("div", { class: "line" }, el("span", { class: "k", text: label }), ...value);
      card.append(line(t("最少部数"), f.min.n != null ? t("{n}冊から", { n: f.min.n }) : t("案内に無し")));
      // the sets by name and how they are printed (or why there are none)
      const setLine = (label, body) => {
        const sets = setsOf(id, body);
        if (!sets.length) return line(label, t(noPrices(id, body)));
        const kinds = [...new Set(sets.map(s => t(KIND_NAMES[s.kind])))].join(t("、"));
        return line(label, ...sets.flatMap((s, i) => {
          const a = outLink(s.url, "");
          a.append(own(s.set));
          return i ? [t("、"), a] : [a];
        }), lang === "ja" ? "" : " ", t("（{kinds}）", { kinds }));
      };
      card.append(setLine(t("基本のセット"), "mono"));
      if (PRICES.printers[id]) card.append(setLine(t("本文フルカラー"), "color"));
      card.append(...traitRows(id));
      if (pr.body.length) {
        const summary = pr.cover.length
          ? t("紙: 本文 {a} 種・表紙 {b} 種（背幅の計算フォームから）", { a: pr.body.length, b: pr.cover.length })
          : t("紙: 本文 {a} 種（背幅の計算フォームから）", { a: pr.body.length });
        const details = el("details", { class: "papers" }, el("summary", { text: summary }), paperList(pr.body));
        if (pr.cover.length) details.append(el("b", { text: t("表紙の紙（{n} 種）", { n: pr.cover.length }) }), paperList(pr.cover));
        card.append(details);
      } else {
        card.append(el("div", { class: "papers", text: t("紙: 一覧は印刷所のページで（背幅の計算フォームが無いため）") }));
      }
      box.append(card);
    }
  }

  // ---------------------------------------------------------------- tabs (as in the other tools)

  // remember = false when the page opens: showing the saved tab writes nothing
  function selectTab(name, focus, remember = true) {
    for (const b of document.querySelectorAll("[role=tab]")) {
      const on = b.dataset.tab === name;
      b.setAttribute("aria-selected", on);
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    }
    for (const p of document.querySelectorAll("[data-panel]")) p.hidden = p.dataset.panel !== name;
    if (remember) {
      try { localStorage.setItem(TAB, name); } catch (e) { /* storage unavailable */ }
    }
  }

  function setupTabs() {
    const tabs = [...document.querySelectorAll("[role=tab]")];
    tabs.forEach((b, i) => {
      b.addEventListener("click", () => selectTab(b.dataset.tab));
      b.addEventListener("keydown", ev => {
        const k = ev.key;
        let j = null;
        if (k === "ArrowRight") j = (i + 1) % tabs.length;
        else if (k === "ArrowLeft") j = (i - 1 + tabs.length) % tabs.length;
        else if (k === "Home") j = 0;
        else if (k === "End") j = tabs.length - 1;
        if (j != null) { ev.preventDefault(); selectTab(tabs[j].dataset.tab, true); }
      });
    });
    let saved = null;
    try { saved = localStorage.getItem(TAB); } catch (e) { /* storage unavailable */ }
    selectTab(tabs.some(b => b.dataset.tab === saved) ? saved : "search", false, false);
  }

  function setsTable(id) {
    const sets = PRICES.printers[id];
    if (!sets) return el("p", { class: "desc", text: t(NO_PRICES[id] || "料金表が無いので比べていません") });
    const ship = { incl: "送料込み", extra: "送料は別", unknown: "送料の記載なし" };
    const body = { mono: "モノクロ", color: "フルカラー" };
    const tbody = el("tbody");
    // the base sets first, then the full-color text ones
    for (const set of [...setsOf(id, "mono"), ...setsOf(id, "color")]) {
      // formats that share a table are shown together
      const groups = new Map();
      for (const [fid, g] of Object.entries(set.formats)) {
        const key = typeof g === "string" ? g : fid;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(fid);
      }
      for (const [key, fids] of groups) {
        const g = set.formats[key];
        const a = outLink(set.url, "");
        a.append(own(set.set));
        tbody.append(el("tr", {},
          el("td", {}, a),
          el("td", { text: t(body[set.body || "mono"]) }),
          el("td", { text: t(KIND_NAMES[set.kind]) }),
          el("td", { text: fids.map(x => t(SHORT[x] || x)).join(t("、")) }),
          el("td", { text: t("{a}〜{b} 冊", { a: g.c[0], b: g.c[g.c.length - 1] }) }),
          el("td", { text: t("{a}〜{b} ページ", { a: g.p[0], b: g.p[g.p.length - 1] }) }),
          el("td", { text: t(ship[set.ship]) })));
      }
    }
    const head = el("tr", {}, ...["セット", "本文", "印刷", "判型", "部数", "表紙込みのページ", "送料"].map(h => el("th", { text: t(h) })));
    // (a printer without full-color text sets: the price row above says why)
    return el("div", { class: "table-wrap" }, el("table", {}, el("thead", {}, head), tbody));
  }

  function rulesSection(pr) {
    const assumed = pr.assumed || [];
    const dl = el("dl", { class: "fact-list" });
    const row = (label, value) => dl.append(el("div", { class: "fact" }, el("dt", { text: label }), el("dd", {}, value)));
    const none = text => el("span", { class: "ans none", text });
    row(t("塗り足し"), el("span", { class: "ans", text: t("{n}mm", { n: pr.bleed }) }));
    row(t("安全域（文字や顔は仕上がりから内側に）"), assumed.includes("safe") ? none(t("案内に数値なし")) : el("span", { class: "ans", text: t("{n}mm", { n: pr.safe }) }));
    row(t("解像度"), el("span", { class: "ans", text: t("{n}dpi", { n: pr.dpi }) }));
    row(t("インク総量"), assumed.includes("tac") ? none(t("案内に数値なし")) : el("span", { class: "ans", text: t("{n}% まで", { n: pr.tac }) }));
    const sec = section(t("原稿の決まり"), dl);
    // the notes were written for the cover print maker ("this tool" is that tool)
    if (pr.note) sec.append(el("p", { class: "desc" }, el("b", { text: t("表紙入稿メーカーでの注意:") }), " ", t(pr.note)));
    const links = el("p", { class: "desc" }, outLink(pr.url, t("印刷所の原稿作成の案内")));
    if (pr.spineUrl) links.append(" / ", outLink(pr.spineUrl, t("印刷所の背幅の計算")));
    sec.append(links);
    return sec;
  }

  function spineSection(pr) {
    const sec = section(t("背幅の計算"));
    if (!pr.body.length || !pr.spine) {
      sec.append(el("p", { class: "desc", text: t("この印刷所は背幅の式を公開していません。注文の画面か印刷所に確かめてください。") }));
      return sec;
    }
    const paper = item => item.label + (item.mm != null ? t("（{n}mm）", { n: item.mm }) : "");
    const pages = el("input", { type: "number", id: "spinePages", min: 4, max: 1000, step: 2, value: state.pages });
    const body = el("select", { id: "spineBody", translate: "no" });
    for (const b of pr.body) body.append(el("option", { value: b.id, text: paper(b) }));
    const cover = el("select", { id: "spineCover", translate: "no" });
    for (const c of pr.cover) cover.append(el("option", { value: c.id, text: paper(c) }));
    const calc = el("div", { class: "calc" },
      el("div", { class: "row" }, el("label", { for: "spinePages", text: t("本文") }), el("span", { class: "unit" }, pages, " ", t("ページ"))),
      el("div", { class: "row" }, el("label", { for: "spineBody", text: t("本文の紙") }), body));
    if (pr.cover.length) calc.append(el("div", { class: "row" }, el("label", { for: "spineCover", text: t("表紙の紙") }), cover));
    const out = el("p", { class: "result", role: "status" });
    const update = () => {
      const n = whole(pages.value, 4, 1000, state.pages);
      const b = pr.body.find(x => x.id === body.value), c = pr.cover.find(x => x.id === cover.value);
      const r = pr.spine(n, b, c);
      out.replaceChildren();
      if (!r) { out.textContent = t("このページ数は印刷所の早見表にありません。"); return; }
      const how = [r.text, r.note && t(r.note)].filter(Boolean).join(t("、"));
      out.append(t("背幅"), " ", el("b", { text: t("{n}mm", { n: r.mm }) }), how ? (lang === "ja" ? "" : " ") + t("（{how}）", { how }) : "");
    };
    for (const e of [pages, body, cover]) e.addEventListener(e === pages ? "change" : "input", update);
    pages.addEventListener("input", () => { if (pages.value !== "") update(); });
    update();
    sec.append(calc, out);
    sec.append(el("p", { class: "desc", text: t("背幅は、印刷所の注文画面（最終確認）に出る値が正式です。") }));
    return sec;
  }

  function sourcesSection(pr) {
    const id = pr.id, f = facts(id);
    const what = new Map();
    const add = (url, label) => {
      if (!url) return;
      if (!what.has(url)) what.set(url, []);
      if (!what.get(url).includes(label)) what.get(url).push(label);
    };
    add(f.site, t("公式サイト"));
    if (f.min.url) add(f.min.url, t("最少部数"));
    for (const k of F.keys) { const x = f[k]; if (x && x.url) add(x.url, t(LABELS[k])); }
    for (const set of PRICES.printers[id] || []) add(set.url, set.body === "color" ? t("本文フルカラーの料金") : t("料金"));
    add(pr.url, t("原稿の決まり"));
    if (pr.spineUrl) add(pr.spineUrl, t("背幅の計算"));
    const ul = el("ul", { class: "links" });
    for (const [url, labels] of what) {
      ul.append(el("li", {}, outLink(url, url), el("br"), el("span", { class: "what", text: labels.join(t("、")) })));
    }
    return section(t("根拠のページ"), ul);
  }

  // ---------------------------------------------------------------- start

  function start() {
    load();
    const asked = new URLSearchParams(location.search).get("p");
    const pr = asked && facts(asked) && byId(asked);
    if (pr) {
      $("#listView").hidden = true;
      $("#detailView").hidden = false;
      $("#back").href = hrefWith({ p: null });
      renderDetail(pr);
      return;
    }
    setupTabs();
    renderDirectory();
    buildForm();
    syncForm();
    renderList();
    const form = $("#conditions");
    form.addEventListener("submit", ev => ev.preventDefault());
    // "change" only: numbers wait until typed in, so "120" does not search for "1" first
    form.addEventListener("change", () => { readForm(); save(); renderList(); });
    $("#reset").addEventListener("click", () => {
      state = defaults();
      save();
      syncForm();
      renderList();
    });
  }

  start();
})();

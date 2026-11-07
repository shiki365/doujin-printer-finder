/*!
 * printers.v1.js - book sizes, and each printer's settings and spine formula (data only)
 *
 * Shared by the printer finder (this folder) and the cover print maker, which loads it from
 * ../doujin-printer-finder/ and adds its own "another printer" entry. Change the shape of the
 * data only together with both pages. The facts for the finder are in facts.v1.js.
 *
 * Each printer's spine(pages, body, cover) follows that printer's own published
 * formula, calculator or table; "pages" is the body's page count without the cover.
 * It returns { mm, text, note } or null when the page count is outside the printer's
 * table. Where a printer's calculator rounds, the same arithmetic is used here so
 * the result matches it. The order screen's value is the official one.
 * text is the formula with numbers and + = only, the same in every language;
 * note is a Japanese text that the page translates.
 *
 * "assumed" lists the values the printer's guide does not state; the tool's
 * defaults are used for those and the screen says so.
 */
(function () {
  "use strict";

  // names and paper lists (kept in Japanese): papers.v1.js
  const D = window.DoujinPapers;

  // Trim sizes in mm (width x height of one cover). 新書 differs from printer to printer:
  // a printer's own size is its "shinsho"; the size here is used when it publishes none.
  // Landscape books are bound on the short side, so the spine runs along the height.
  const FORMATS = [
    { id: "B5", label: "B5（182×257mm）", w: 182, h: 257 },
    { id: "A5", label: "A5（148×210mm）", w: 148, h: 210 },
    { id: "A4", label: "A4（210×297mm）", w: 210, h: 297 },
    { id: "B6", label: "B6（128×182mm）", w: 128, h: 182 },
    { id: "A6", label: "文庫・A6（105×148mm）", w: 105, h: 148 },
    { id: "shinsho", label: "新書（{w}×{h}mm）", w: 105, h: 173 },
    { id: "A5yoko", label: "A5 横長（210×148mm）", w: 210, h: 148 },
    { id: "B5yoko", label: "B5 横長（257×182mm）", w: 257, h: 182 },
    { id: "A4yoko", label: "A4 横長（297×210mm）", w: 297, h: 210 },
    { id: "sq182", label: "正方形（182×182mm）", w: 182, h: 182 },
    { id: "sq148", label: "正方形（148×148mm）", w: 148, h: 148 },
    { id: "custom", label: "大きさを入力", w: 182, h: 257 },
  ];

  const r2 = v => Math.round(v * 100) / 100;

  // Spine formulas shared by several printers, named by what they count
  const SPINE = {
    // pages x paper per page + cover x 2
    perPage: (n, b, c) => ({ mm: r2(n * b.mm + c.mm * 2), text: `${n} × ${b.mm} + ${c.mm} × 2` }),
    // pages / 2 (sheets) x paper per sheet + cover x 2
    perSheet: (n, b, c) => ({ mm: r2(n / 2 * b.mm + c.mm * 2), text: `${n} ÷ 2 × ${b.mm} + ${c.mm} × 2` }),
    // pages / 2 (sheets) x paper per sheet; the cover is not added
    sheetsOnly: (n, b) => ({ mm: +(n / 2 * b.mm).toFixed(2), text: `${n} ÷ 2 × ${b.mm}` }),
  };

  // Each printer: bleed and safe margin (mm), resolution, total ink limit (%), papers,
  // and its 新書 size [w, h] when the printer publishes one.
  // Sorted in Japanese syllabary order.
  const PRINTERS = [
    {
      id: "eikou",
      ...D.NAMES.eikou,
      url: "https://www.eikou.com/making/printglossary/refill/",
      spineUrl: "https://www.eikou.com/making/printglossary/backwidth/",
      bleed: 3, safe: 5, dpi: 350, tac: 300, assumed: ["safe", "tac"],
      spine: SPINE.perSheet,
      // per sheet
      body: D.PAPERS.eikou.body,
      cover: D.PAPERS.eikou.cover,
    },
    {
      id: "orange",
      ...D.NAMES.orange,
      url: "https://www.orangekoubou.com/making/making.php",
      spineUrl: "https://www.orangekoubou.com/booklet/template.php",
      bleed: 3, safe: 5, dpi: 350, tac: 300, assumed: ["tac"],
      note: "RGBビビッドカラーのセットは、表紙を RGB のまま入稿します（このツールの CMYK の PDF は使いません）。",
      // pages / 2 x paper per sheet, rounded up to whole mm (the printer's form
      // computes on the server; this follows its paper values and stated rounding)
      spine: (n, b) => {
        const raw = n / 2 * b.mm;
        return { mm: Math.ceil(raw - 1e-9), text: `${n} ÷ 2 × ${b.mm} = ${r2(raw)}`, note: "小数点以下を切り上げ" };
      },
      body: D.PAPERS.orange.body,
      cover: D.PAPERS.orange.cover,
    },
    {
      id: "kanazawa",
      ...D.NAMES.kanazawa,
      url: "https://www.kanazawa-p.co.jp/howtodata/photoshop.html",
      spineUrl: "https://www.kanazawa-p.co.jp/howtodata/sehaba_form.html",
      shinsho: [105, 173],
      bleed: 3, safe: 10, dpi: 350, tac: 350, assumed: [],
      note: "安全域は印刷所の「せめて1cm以上内側に」に合わせています。オンデマンド印刷のカラー表紙は RGB での入稿を勧めています。遊び紙を入れるときは印刷所の計算フォームで背幅を確かめてください。",
      // the printer's form: cover + pages / 2 x paper per sheet, rounded to whole mm
      spine: (n, b, c) => {
        const raw = c.mm * 2 + n / 2 * b.mm;
        return { mm: Math.round(raw), text: `${c.mm} × 2 + ${n} ÷ 2 × ${b.mm} = ${r2(raw)}`, note: "1mm 単位に四捨五入" };
      },
      body: D.PAPERS.kanazawa.body,
      cover: D.PAPERS.kanazawa.cover,
    },
    {
      id: "kanbi",
      ...D.NAMES.kanbi,
      url: "https://comic.kanbi-comic.com/data-guide/making/basic/",
      spineUrl: "https://comic.kanbi-comic.com/data-guide/making/basic/#ab",
      bleed: 3, safe: 3, dpi: 350, tac: 350, assumed: [],
      note: "背幅は基本の表紙（アート紙180kg）での値です。特殊紙の表紙では ±0.5mm ほど変わります。",
      // cover x 2 + pages / 2 x paper per sheet, rounded up to whole mm (the printer's calculator)
      spine: (n, b, c) => {
        const raw = ((n / 2) * b.mm) + c.mm * 2;
        return { mm: Math.ceil(raw), text: `${n} ÷ 2 × ${b.mm} + ${c.mm} × 2 = ${r2(raw)}`, note: "小数点以下を切り上げ" };
      },
      body: D.PAPERS.kanbi.body,
      cover: D.PAPERS.kanbi.cover,
    },
    {
      id: "graphic",
      ...D.NAMES.graphic,
      url: "https://www.graphic.jp/data_guide/product/booklet/perfect_bind/printing_area",
      spineUrl: "https://www.graphic.jp/data_guide/product/booklet/perfect_bind",
      bleed: 3, safe: 3, dpi: 350, tac: 300, assumed: [],
      note: "インク総量はマットコート紙・上質紙の目安（300%）です。コート紙なら 350% まで、と案内しています。",
      // cover x 2 + paper per sheet x pages / 2; drop below 0.1mm, then round up to 0.5mm
      spine: (n, b, c) => {
        const raw = c.mm * 2 + b.mm * n / 2;
        const mm = Math.ceil(Math.floor(raw * 10 + 1e-9) / 10 * 2 - 1e-9) / 2;
        return { mm, text: `${c.mm} × 2 + ${b.mm} × ${n} ÷ 2 = ${r2(raw)}`, note: "0.5mm 単位に切り上げ" };
      },
      // one table for body and cover; a selection of it
      body: D.PAPERS.graphic.body,
      cover: D.PAPERS.graphic.cover,
    },
    {
      id: "kosin",
      ...D.NAMES.kosin,
      url: "https://www.ko-sin.co.jp/syindex/download/",
      spineUrl: "https://www.ko-sin.co.jp/syindex/sehaba/",
      bleed: 3, safe: 5, dpi: 350, tac: 300, assumed: ["safe", "tac"],
      // pages / divisor (or pages / 2 x paper per sheet), rounded up to 0.5mm
      spine: (n, b) => {
        const raw = b.div ? n / b.div : n / 2 * b.mm;
        return {
          mm: Math.ceil(raw * 2) / 2,
          text: (b.div ? `${n} ÷ ${b.div}` : `${n} ÷ 2 × ${b.mm}`) + ` = ${r2(raw)}`,
          note: "0.5mm 単位に切り上げ",
        };
      },
      body: D.PAPERS.kosin.body,
      cover: D.PAPERS.kosin.cover,
    },
    {
      id: "sunrise",
      ...D.NAMES.sunrise,
      url: "https://www.sunrisep.co.jp/genkou/create-genko-kiso/",
      spineUrl: "https://www.sunrisep.co.jp/useful/auto-sehabakeisan/",
      shinsho: [110, 173],
      bleed: 3, safe: 3, dpi: 350, tac: 300, assumed: ["tac"],
      // (total pages - 4) x 0.05 x factor (+ 0.5), to 0.1mm; the cover is not added
      spine: (n, b) => ({
        mm: +(n * 0.05 * b.k + b.add).toFixed(1),
        text: `${n} × 0.05 × ${b.k}` + (b.add ? ` + ${b.add}` : ""),
      }),
      body: D.PAPERS.sunrise.body,
      cover: D.PAPERS.sunrise.cover,
    },
    {
      id: "shimaya",
      ...D.NAMES.shimaya,
      url: "https://www.shimaya.net/howto/data-genkou.html",
      spineUrl: "https://www.shimaya.net/howto/sehaba.html",
      bleed: 3, safe: 5, dpi: 350, tac: 300, assumed: ["safe", "tac"],
      // the printer's table (2024-06): body pages 16-500 in steps of 2. first is the
      // 16-page spine in 0.1mm; each digit of steps is the next row's increase.
      spine: (n, b) => {
        const i = Math.ceil((Math.max(n, 16) - 16) / 2);
        if (n < 16 || i > b.steps.length) return null;
        let v = b.first;
        for (let k = 0; k < i; k++) v += +b.steps[k];
        return { mm: v / 10, text: null, note: "印刷所の早見表の値" };
      },
      body: D.PAPERS.shimaya.body,
      cover: D.PAPERS.shimaya.cover,
    },
    {
      id: "starbooks",
      ...D.NAMES.starbooks,
      url: "https://www.starbooks.jp/manual/data.php",
      shinsho: [105, 175],
      bleed: 3, safe: 5, dpi: 350, tac: 300, assumed: ["tac"],
      note: "背幅は発注フォームで確かめた値を入力してください（式は公開されていません）。",
      body: [], cover: [],
    },
    {
      id: "taiyo",
      ...D.NAMES.taiyo,
      url: "https://www.taiyoushuppan.co.jp/doujin/howto/data.php",
      spineUrl: "https://www.taiyoushuppan.co.jp/doujin/howto/thickness.php",
      shinsho: [110, 175],
      bleed: 3, safe: 3, dpi: 350, tac: 230, assumed: [],
      note: "インク総量は、印刷所が「これより多くならないように」と示す黒ベタ（C50 M40 Y40 K100）の合計に合わせています。背幅に表紙の紙は含みません。",
      spine: SPINE.sheetsOnly,
      body: D.PAPERS.taiyo.body,
      cover: D.PAPERS.taiyo.cover,
    },
    {
      id: "chokotto",
      ...D.NAMES.chokotto,
      url: "https://www.chokotto.jp/howto.html",
      bleed: 3, safe: 5, dpi: 350, tac: 300,
      spine: SPINE.perPage,
      // per page of the body (the formula counts pages, not sheets)
      body: D.PAPERS.chokotto.body,
      // one cover sheet
      cover: D.PAPERS.chokotto.cover,
    },
    {
      id: "tsukuyomi",
      ...D.NAMES.tsukuyomi,
      url: "https://www.tsuku-yomi.com/tsukuyomi/manual/manual-data/",
      bleed: 3, safe: 5, dpi: 350, tac: 300, assumed: ["safe", "tac"],
      note: "背幅は注文時にお客さまページに出る値を入力してください。小数点は繰り上げて整数にする、と案内しています（1.1mm なら 2mm）。",
      body: [], cover: [],
    },
    {
      id: "tom",
      ...D.NAMES.tom,
      url: "https://www.tomshuppan.co.jp/manual/hyoshi.html",
      spineUrl: "https://www.tomshuppan.co.jp/manual/sehaba.html",
      shinsho: [105, 173],
      bleed: 3, safe: 5, dpi: 350, tac: 300, assumed: ["tac"],
      note: "黒ベタは C50 M50 Y50 K90 を勧めています。",
      // pages / 2 x paper per sheet + 0.4 for the cover
      spine: (n, b) => ({ mm: r2(n / 2 * b.mm + 0.4), text: `${n} ÷ 2 × ${b.mm} + 0.4` }),
      body: D.PAPERS.tom.body,
      cover: D.PAPERS.tom.cover,
    },
    {
      id: "nishimura",
      ...D.NAMES.nishimura,
      url: "https://nishimura-p.jp/making/",
      bleed: 3, safe: 5, dpi: 350, tac: 300, assumed: ["safe", "tac"],
      note: "背幅の式は公開されていません。印刷所に確かめた値を入力してください。",
      body: [], cover: [],
    },
    {
      id: "nikko",
      ...D.NAMES.nikko,
      url: "https://www.nikko-pc.com/site/home-hd-2/home-qa/",
      spineUrl: "https://www.nikko-pc.com/site/home-hd-2/home-sehaba/",
      bleed: 3, safe: 5, dpi: 350, tac: 300, assumed: ["safe", "tac"],
      // pages including the cover's 4 x paper per page
      spine: (n, b) => ({ mm: r2((n + 4) * b.mm), text: `(${n} + 4) × ${b.mm}` }),
      body: D.PAPERS.nikko.body,
      cover: D.PAPERS.nikko.cover,
    },
    {
      id: "neko",
      ...D.NAMES.neko,
      url: "https://www.shippo.co.jp/neko/making/digital.shtml",
      spineUrl: "https://www.shippo.co.jp/neko/calc_thick.shtml",
      shinsho: [112, 176],
      bleed: 3, safe: 5, dpi: 350, tac: 300, assumed: ["tac"],
      note: "色は Japan Color 2011 Coated で刷られます。インク量は印刷所のシステムで適正に保たれます。",
      // the printer's calculator: pages / 2 x paper per sheet + cover x 2, rounded up to 0.1mm
      spine: (n, b, c) => {
        const raw = ((n / 2) * b.mm) + (c.mm * 2);
        return { mm: Math.ceil(raw * 10) / 10, text: `${n} ÷ 2 × ${b.mm} + ${c.mm} × 2 = ${r2(raw)}`, note: "0.1mm 単位に切り上げ" };
      },
      body: D.PAPERS.neko.body,
      cover: D.PAPERS.neko.cover,
    },
    {
      id: "pico",
      ...D.NAMES.pico,
      url: "https://www.pico-net.com/doujinshi/doujinshi_manual/cover/007.html",
      spineUrl: "https://www.pico-net.com/doujinshi/calculation.html",
      bleed: 3, safe: 5, dpi: 350, tac: 300, assumed: ["tac"],
      // the printer's calculator: cover x 2 + paper per sheet x pages / 2, to 0.01mm
      spine: (n, b, c) => ({
        mm: Math.round((c.mm * 2 * 100) + (b.mm * n / 2 * 100)) / 100,
        text: `${c.mm} × 2 + ${b.mm} × ${n} ÷ 2`,
      }),
      body: D.PAPERS.pico.body,
      cover: D.PAPERS.pico.cover,
    },
    {
      id: "bros",
      ...D.NAMES.bros,
      url: "https://www.bros-comic.co.jp/nyukou/manual/make_method.html",
      spineUrl: "https://www.bros-comic.co.jp/nyukou/sehaba.php",
      shinsho: [106, 173],
      bleed: 3, safe: 5, dpi: 350, tac: 300, assumed: ["safe", "tac"],
      note: "PP 加工をするなら、ふちと背の折り目の近くは CMYK の合計 250% 未満に、と案内しています。",
      // the printer's calculator: paper per sheet / 2 x pages, rounded up to 0.01mm
      spine: (n, b) => ({ mm: Math.ceil(b.mm / 2 * n * 100) / 100, text: `${n} ÷ 2 × ${b.mm}` }),
      body: D.PAPERS.bros.body,
      cover: D.PAPERS.bros.cover,
    },
    {
      id: "hope",
      ...D.NAMES.hope,
      url: "https://hope21.jp/creative-guide/data-guide/",
      spineUrl: "https://hope21.jp/creative-guide/data-guide/",
      shinsho: [106, 173],
      bleed: 3, safe: 2, dpi: 350, tac: 300, assumed: ["tac"],
      // pages / 20 x factor (the printer's calculator, to 0.01mm)
      spine: (n, b) => ({ mm: +((n / 20) * b.k).toFixed(2), text: `${n} ÷ 20 × ${b.k}` }),
      body: D.PAPERS.hope.body,
      cover: D.PAPERS.hope.cover,
    },
    {
      id: "popls",
      ...D.NAMES.popls,
      url: "https://www2.popls.co.jp/pop/genkou/kihon.html",
      spineUrl: "https://www2.popls.co.jp/pop/genkou/hyoushi.html",
      bleed: 3, safe: 3, dpi: 350, tac: 300, assumed: ["tac"],
      note: "POPLS はフルカラーを sRGB のまま入稿するのを勧めています。",
      // pages including the cover's 4 / divisor
      spine: (n, b) => ({ mm: r2((n + 4) / b.div), text: `(${n} + 4) ÷ ${b.div}` }),
      body: D.PAPERS.popls.body,
      cover: D.PAPERS.popls.cover,
    },
    {
      id: "marusho",
      ...D.NAMES.marusho,
      url: "https://www.marusho-ink.co.jp/howto/data.html",
      spineUrl: "https://www.marusho-ink.co.jp/howto/genkihon.html",
      bleed: 3, safe: 5, dpi: 350, tac: 300, assumed: ["tac"],
      note: "背幅に表紙の紙は含みません（印刷所の式）。",
      spine: SPINE.sheetsOnly,
      body: D.PAPERS.marusho.body,
      cover: D.PAPERS.marusho.cover,
    },
    {
      id: "ryokuyou",
      ...D.NAMES.ryokuyou,
      url: "https://www.ryokuyou.co.jp/doujin/manual/basic.html",
      spineUrl: "https://www.ryokuyou.co.jp/doujin/sehaba",
      bleed: 3, safe: 5, dpi: 350, tac: 300, assumed: ["tac"],
      // the printer's calculator: 0.05 x pages x factor + 0.4, cut below 0.01mm
      spine: (n, b) => ({
        mm: Math.floor(((0.05 * n * b.k + 0.4) * 100) + 0.05) / 100,
        text: `0.05 × ${n} × ${b.k} + 0.4`,
      }),
      body: D.PAPERS.ryokuyou.body,
      cover: D.PAPERS.ryokuyou.cover,
    },
  ];

  window.DoujinPrinters = { FORMATS, PRINTERS };
})();

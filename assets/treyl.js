/* ВсОШ по ИИ — страница трейлов: задачи текстом, по трейлу за раз.

   Сборки нет, как у главной: страница читает data/treyly.json. Его пишет
   скрипт выкладки в knowledge из условий трейлов — одного markdown
   на трейл; здесь он только показывается. Что показать, задаёт адрес:
     #mat         трейл
     #ml/pandas   трейл, задачи с меткой
     #ml17        трейл, задача раскрыта и в поле зрения
   Формулы — KaTeX, разметка — marked, так же, как в заметках
   «Лучезарности»: формулы вынимаются до разбора markdown, иначе
   подчёркивания в них marked принял бы за курсив. */
(function () {
  "use strict";

  var DATA = null;
  var state = { trail: null, tag: null };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function plural(n, one, few, many) {
    var d = n % 10, h = n % 100;
    if (d === 1 && h !== 11) return one;
    if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return few;
    return many;
  }

  function tasksWord(n) {
    return n + " " + plural(n, "задача", "задачи", "задач");
  }

  /* ── markdown с формулами ────────────────────────────────

     Как на «Лучезарности»: код в обратных кавычках и ограждённые блоки
     отдаются marked нетронутыми, в остальном тексте формулы $…$ и $$…$$
     заменяются метками и после разбора рисуются KaTeX. */
  function splitCode(src) {
    return src.split(/(```[\s\S]*?```|`[^`\n]*`)/);
  }

  function extractMath(text, store) {
    text = text.replace(/\$\$([\s\S]+?)\$\$/g, function (_, tex) {
      store.push({ tex: tex, display: true });
      return '<span class="math" data-i="' + (store.length - 1) + '"></span>';
    });
    return text.replace(/\$([^\$\n]+?)\$/g, function (_, tex) {
      store.push({ tex: tex, display: false });
      return '<span class="math" data-i="' + (store.length - 1) + '"></span>';
    });
  }

  function renderMath(host, math) {
    host.querySelectorAll("span.math").forEach(function (node) {
      var m = math[+node.dataset.i];
      if (!window.katex) {
        node.textContent = (m.display ? "$$" : "$") + m.tex + (m.display ? "$$" : "$");
        return;
      }
      try {
        window.katex.render(m.tex, node, { displayMode: m.display, throwOnError: false });
      } catch (e) {
        node.textContent = "$" + m.tex + "$";
      }
    });
  }

  /* Пример к программе в условии — два блока подряд, «```ввод» и «```вывод».
     Здесь они встают рядом под подписями; в самом markdown это просто
     два блока кода с понятными пометками. */
  function pairExamples(host) {
    host.querySelectorAll("pre > code.language-ввод").forEach(function (code) {
      var pre = code.parentNode;
      var next = pre.nextElementSibling;
      var box = el("div", "primer");
      pre.parentNode.insertBefore(box, pre);
      var left = el("div", "primer-col");
      left.appendChild(el("span", "primer-label", "Ввод"));
      left.appendChild(pre);
      box.appendChild(left);
      if (next && next.tagName === "PRE" && next.querySelector("code.language-вывод")) {
        var right = el("div", "primer-col");
        right.appendChild(el("span", "primer-label", "Вывод"));
        right.appendChild(next);
        box.appendChild(right);
      }
    });
  }

  function md(src, cls) {
    var host = el("div", cls || "md");
    if (!window.marked) {
      host.appendChild(el("pre", "md-raw", src));
      return host;
    }
    var math = [];
    var parts = splitCode(src);
    for (var i = 0; i < parts.length; i += 2) parts[i] = extractMath(parts[i], math);
    host.innerHTML = window.marked.parse(parts.join(""), { gfm: true, breaks: false });
    renderMath(host, math);
    pairExamples(host);
    /* Широкая таблица прокручивается внутри своей рамки, страница вбок
       не едет. */
    host.querySelectorAll("table").forEach(function (t) {
      var wrap = el("div", "tbl");
      t.parentNode.insertBefore(wrap, t);
      wrap.appendChild(t);
    });
    host.querySelectorAll("a[href^='http']").forEach(function (a) {
      a.target = "_blank";
      a.rel = "noopener";
    });
    return host;
  }

  /* ── что раскрыто, помнит браузер читателя ──────────────── */
  function isOpen(id) {
    try { return localStorage.getItem("open:zad:" + id) === "1"; } catch (e) { return false; }
  }

  function remember(id, on) {
    try {
      if (on) localStorage.setItem("open:zad:" + id, "1");
      else localStorage.removeItem("open:zad:" + id);
    } catch (e) { /* хранилище недоступно — помнить просто нечем */ }
  }

  /* ── адрес ───────────────────────────────────────────────── */
  function parseHash() {
    var h = decodeURIComponent(location.hash.replace(/^#/, ""));
    var ids = DATA.treyly.map(function (t) { return t.id; });
    var m = /^([a-z]+?)(\d+)$/.exec(h);
    if (m && ids.indexOf(m[1]) >= 0) return { trail: m[1], tag: null, task: h };
    var slash = h.indexOf("/");
    var trail = slash >= 0 ? h.slice(0, slash) : h;
    var tag = slash >= 0 ? h.slice(slash + 1) : null;
    if (ids.indexOf(trail) < 0) trail = ids[0];
    return { trail: trail, tag: tag || null, task: null };
  }

  function setHash() {
    var h = "#" + state.trail + (state.tag ? "/" + encodeURIComponent(state.tag) : "");
    if (location.hash !== h) history.replaceState(null, "", h);
  }

  /* ── карточка задачи ─────────────────────────────────────── */
  function taskCard(z) {
    var box = el("details", "set zad");
    box.id = z.id;
    box.dataset.tags = JSON.stringify(z.metki);
    var head = el("summary", "set-head zad-head");
    var label = el("span", "set-label");
    var top = el("span", "zad-top");
    top.appendChild(el("span", "zad-id", z.id));
    top.appendChild(el("span", "set-title", z.title));
    label.appendChild(top);
    if (z.metki.length) label.appendChild(el("span", "zad-tags", z.metki.join(" · ")));
    head.appendChild(label);
    head.appendChild(el("span", "chev"));
    box.appendChild(head);

    /* Тело рисуется при первом раскрытии: формулы и таблицы трейла целиком
       сразу не нужны. */
    var filled = false;
    function fill() {
      if (filled) return;
      filled = true;
      var body = el("div", "zad-body");
      if (z.body) body.appendChild(md(z.body));
      if (z.chasti.length) {
        var ol = el("ol", "punkty");
        z.chasti.forEach(function (p) {
          var li = el("li", "punkt");
          li.appendChild(el("span", "punkt-bukva", p.bukva + ")"));
          var text = md(p.md, "md punkt-text");
          var code = el("code", "sdat", p.id);
          code.title = "так этот пункт сдаётся в kontest.py";
          var last = text.lastElementChild;
          (last && last.tagName === "P" ? last : text).appendChild(code);
          li.appendChild(text);
          ol.appendChild(li);
        });
        body.appendChild(ol);
      }
      if (z.files.length) {
        var files = el("div", "zad-files");
        files.appendChild(el("span", "zad-files-label", "Файлы"));
        z.files.forEach(function (f) {
          var a = el("a", "file-pill");
          a.href = f.href;
          a.setAttribute("download", f.name);
          a.appendChild(el("span", "file-name", f.name));
          a.appendChild(el("span", "file-size", f.size));
          files.appendChild(a);
        });
        body.appendChild(files);
      }
      box.appendChild(body);
    }

    box.addEventListener("toggle", function () {
      if (box.open) fill();
      remember(z.id, box.open);
    });
    if (isOpen(z.id)) {
      fill();
      box.open = true;
    }
    box.fillNow = fill;
    return box;
  }

  /* ── трейл ───────────────────────────────────────────────── */
  function switcher() {
    var nav = el("nav", "trail-switch");
    nav.setAttribute("aria-label", "Трейлы");
    DATA.treyly.forEach(function (t) {
      var a = el("a", "pill");
      a.href = "#" + t.id;
      a.appendChild(el("span", null, t.title));
      a.appendChild(el("span", "pill-count", String(t.zadachi.length)));
      if (t.id === state.trail) a.setAttribute("aria-current", "page");
      nav.appendChild(a);
    });
    return nav;
  }

  function downloadsPanel(items) {
    var panel = el("div", "panel");
    items.forEach(function (item) {
      var a = el("a", "row");
      a.href = item.href;
      if (item.file) a.setAttribute("download", item.file);
      a.appendChild(el("span", "nothumb"));
      var label = el("span", "row-label");
      label.appendChild(el("span", "row-title", item.title));
      if (item.kind) label.appendChild(el("span", "row-sub", item.kind));
      a.appendChild(label);
      panel.appendChild(a);
    });
    return panel;
  }

  function about(t) {
    var box = el("details", "set");
    box.open = (function () {
      try { return localStorage.getItem("open:o-treyle") === "1"; } catch (e) { return false; }
    })();
    var head = el("summary", "set-head");
    var name = el("span", "set-label");
    name.appendChild(el("span", "set-title", "Как сдавать и что скачать"));
    head.appendChild(name);
    head.appendChild(el("span", "chev"));
    box.appendChild(head);
    var body = el("div", "md");
    /* Вступление — здесь же, а не на муаре над карточкой: текст на узоре
       читается хуже, чем на листе. */
    if (t.intro) body.appendChild(md(t.intro, "md-in"));
    t.razdely.forEach(function (r) {
      body.appendChild(el("h2", null, r.title));
      body.appendChild(md(r.md, "md-in"));
    });
    body.appendChild(el("h2", null, "Скачать"));
    box.appendChild(body);
    body.appendChild(downloadsPanel(t.skachat));
    box.addEventListener("toggle", function () {
      try {
        if (box.open) localStorage.setItem("open:o-treyle", "1");
        else localStorage.removeItem("open:o-treyle");
      } catch (e) { /* ничего */ }
    });
    return box;
  }

  function render(focusTask) {
    var t = DATA.treyly.filter(function (x) { return x.id === state.trail; })[0];
    var main = document.getElementById("main");
    main.textContent = "";
    document.title = t.title + " · Трейлы · ВсОШ по ИИ";

    main.appendChild(switcher());

    var sec = el("section", "block");
    var plate = el("div", "block-head");
    plate.appendChild(el("h2", null, t.title));
    plate.appendChild(el("span", "block-count", String(t.zadachi.length)));
    sec.appendChild(plate);

    var stack = el("div", "stack");
    stack.appendChild(about(t));

    /* Метки — кнопки: одна выбрана или ни одной. Под ними — что метка
       значит: так в трейл перешли вступления прежних блоков серий. */
    var known = t.metki.map(function (m) { return m.name; });
    if (state.tag && known.indexOf(state.tag) < 0) state.tag = null;
    var chips = el("div", "chips");
    chips.setAttribute("role", "group");
    chips.setAttribute("aria-label", "Метки");
    function chip(name, count, value) {
      var b = el("button", "pill pill-sm");
      b.type = "button";
      b.appendChild(el("span", null, name));
      b.appendChild(el("span", "pill-count", String(count)));
      b.setAttribute("aria-pressed", String(state.tag === value));
      b.addEventListener("click", function () {
        state.tag = state.tag === value ? null : value;
        setHash();
        applyFilter();
      });
      return b;
    }
    chips.appendChild(chip("все", t.zadachi.length, null));
    t.metki.forEach(function (m) { chips.appendChild(chip(m.name, m.n, m.name)); });
    stack.appendChild(chips);
    var opis = el("p", "tag-opis");
    stack.appendChild(opis);

    var bar = el("div", "list-bar");
    var count = el("span", "list-count");
    bar.appendChild(count);
    var toggle = el("button", "link-btn", "Раскрыть все");
    toggle.type = "button";
    bar.appendChild(toggle);
    stack.appendChild(bar);

    var list = el("div", "stack zad-list");
    var cards = t.zadachi.map(taskCard);
    cards.forEach(function (c) { list.appendChild(c); });
    stack.appendChild(list);
    sec.appendChild(stack);
    main.appendChild(sec);

    function visible() {
      return cards.filter(function (c) { return !c.hidden; });
    }

    function syncToggle() {
      var vis = visible();
      var allOpen = vis.length && vis.every(function (c) { return c.open; });
      toggle.textContent = allOpen ? "Свернуть все" : "Раскрыть все";
    }

    function applyFilter() {
      chips.querySelectorAll("button").forEach(function (b, i) {
        var value = i === 0 ? null : t.metki[i - 1].name;
        b.setAttribute("aria-pressed", String(state.tag === value));
      });
      var meta = t.metki.filter(function (m) { return m.name === state.tag; })[0];
      opis.textContent = "";
      if (meta) {
        opis.appendChild(el("strong", null, meta.name));
        opis.appendChild(document.createTextNode(" — " + meta.opis));
      }
      opis.hidden = !meta;
      cards.forEach(function (c) {
        c.hidden = !!state.tag && JSON.parse(c.dataset.tags).indexOf(state.tag) < 0;
      });
      var n = visible().length;
      count.textContent = state.tag ? n + " из " + tasksWord(t.zadachi.length) : tasksWord(n);
      syncToggle();
    }

    toggle.addEventListener("click", function () {
      var vis = visible();
      var open = !vis.every(function (c) { return c.open; });
      vis.forEach(function (c) {
        if (open) c.fillNow();
        c.open = open;
        remember(c.id, open);
      });
      syncToggle();
    });
    list.addEventListener("toggle", syncToggle, true);

    applyFilter();

    if (focusTask) {
      var card = document.getElementById(focusTask);
      if (card) {
        if (card.hidden) {
          state.tag = null;
          setHash();
          applyFilter();
        }
        card.fillNow();
        card.open = true;
        card.scrollIntoView({ block: "start" });
      }
    }
  }

  function route() {
    var r = parseHash();
    state.trail = r.trail;
    state.tag = r.tag;
    render(r.task);
    if (!r.task) setHash();
  }

  function fail() {
    var main = document.getElementById("main");
    main.textContent = "";
    main.appendChild(el("p", "empty", "Трейлы не загрузились. Обновите страницу."));
  }

  /* Знаки в шапке — как на главной: нажатие запускает только анимацию. */
  document.querySelectorAll(".logo").forEach(function (btn) {
    btn.addEventListener("click", function () {
      btn.classList.remove("tap");
      void btn.offsetWidth;
      btn.classList.add("tap");
    });
    btn.addEventListener("animationend", function () {
      btn.classList.remove("tap");
    });
  });

  fetch("data/treyly.json", { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) {
      DATA = data;
      if (!DATA.treyly || !DATA.treyly.length) {
        var main = document.getElementById("main");
        main.textContent = "";
        main.appendChild(el("p", "empty", "Трейлов пока нет."));
        return;
      }
      route();
      window.addEventListener("hashchange", route);
    })
    .catch(fail);
})();

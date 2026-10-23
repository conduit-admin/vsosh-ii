/* ВсОШ по ИИ — страница задачников: задачи текстом, по задачнику за раз.

   Сборки нет, как у главной: страница читает data/treyly.json. Его пишет
   скрипт выкладки в knowledge из условий задачников — одного markdown
   на задачник; здесь он только показывается. Что показать, задаёт адрес:
     #mat         задачник
     #ml/pandas   задачник, задачи с меткой
     #ml17        задачник, задача раскрыта и в поле зрения
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

    /* Тело рисуется при первом раскрытии: формулы и таблицы задачника целиком
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

  /* ── задачник ───────────────────────────────────────────────── */
  function switcher() {
    var nav = el("nav", "trail-switch");
    nav.setAttribute("aria-label", "Задачники");
    DATA.treyly.forEach(function (t) {
      var a = el("a", "pill");
      a.href = "#" + t.id;
      /* Картинка задачника — кружком в начале пилюли, та же, что миниатюрой
         на главной. Нет её — пилюля просто без картинки. */
      if (t.thumb) {
        var img = el("img", "pill-img");
        img.src = t.thumb;
        img.alt = "";
        img.decoding = "async";
        a.appendChild(img);
        a.classList.add("pill-with-img");
      }
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
    document.title = t.title + " · Задачники · ВсОШ по ИИ";

    main.appendChild(switcher());

    var sec = el("section", "block");
    var plate = el("div", "block-head");
    plate.appendChild(el("h2", null, t.title));
    plate.appendChild(el("span", "block-count", String(t.zadachi.length)));
    sec.appendChild(plate);

    var stack = el("div", "stack");
    stack.appendChild(about(t));

    /* Метки — кнопки: одна выбрана или ни одной. Под ними — что метка
       значит: так в задачник перешли вступления прежних блоков серий. */
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

    /* «Раскрыть все» — пилюля с шевроном в одной строке с метками,
       у правого края; не хватает места — уходит под них, тоже вправо.
       Сколько задач видно, говорит выбранная метка — отдельной строки
       со счётом нет. */
    var tools = el("div", "tools");
    tools.appendChild(chips);
    var toggle = el("button", "pill pill-sm toggle");
    toggle.type = "button";
    var toggleText = el("span", null, "Раскрыть все");
    toggle.appendChild(toggleText);
    toggle.appendChild(el("span", "chev"));
    tools.appendChild(toggle);
    stack.appendChild(tools);
    var opis = el("p", "tag-opis");
    stack.appendChild(opis);

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
      toggleText.textContent = allOpen ? "Свернуть все" : "Раскрыть все";
      toggle.setAttribute("aria-expanded", String(!!allOpen));
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
        /* Описание — строка markdown: в нём бывает код, `.npz`, `for`. */
        var rest = el("span");
        if (window.marked) rest.innerHTML = window.marked.parseInline(" — " + meta.opis);
        else rest.textContent = " — " + meta.opis;
        opis.appendChild(rest);
      }
      opis.hidden = !meta;
      cards.forEach(function (c) {
        c.hidden = !!state.tag && JSON.parse(c.dataset.tags).indexOf(state.tag) < 0;
      });
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

  /* ── движение, как на «Лучезарности» ─────────────────────── */

  /* Смена экрана: содержимое уходит (80 мс), подменяется на погасшем
     экране и приходит (см. «движение» в style.css). Метка — на случай
     двух быстрых нажатий подряд: рисует только последнее. */
  var swapToken = 0;

  function enter(main, dy) {
    main.style.setProperty("--in-dy", dy);
    main.classList.remove("entering");
    void main.offsetWidth;
    main.classList.add("entering");
  }

  /* Другой задачник — уход и приход, движение нейтральное: соседний
     экран не глубже и не выше. Та же страница с другой меткой или
     задачей — без движения, как на «Лучезарности». */
  function onHash() {
    if (parseHash().trail === state.trail) { route(); return; }
    var main = document.getElementById("main");
    var mine = ++swapToken;
    main.style.setProperty("--out-dy", "-4px");
    main.classList.remove("entering");
    main.classList.add("leaving");
    setTimeout(function () {
      if (mine !== swapToken) return;
      window.scrollTo(0, 0);
      main.classList.remove("leaving");
      route();
      enter(main, "8px");
    }, 80);
  }

  /* Пришли с главной этого же сайта — задачник приходит снизу, будто
     шагнули вглубь. Открыли по ссылке — без движения: первая загрузка
     и на «Лучезарности» не анимируется. */
  function fromHome() {
    try {
      var r = new URL(document.referrer);
      var dir = function (p) { return p.replace(/[^/]*$/, ""); };
      return r.origin === location.origin && dir(r.pathname) === dir(location.pathname) &&
        !/treyl\.html$/.test(r.pathname);
    } catch (e) { return false; }
  }

  /* Отклик на касание: класс ставится на pointerdown, анимация доигрывает
     сама. */
  document.addEventListener("pointerdown", function (e) {
    var node = e.target.closest && e.target.closest(".pill, .file-pill, a.row, .set-head");
    if (!node) return;
    node.classList.remove("tap");
    void node.offsetWidth;
    node.classList.add("tap");
  }, { passive: true });

  (function () {
    var main = document.getElementById("main");
    /* Класс держится только на время движения: чужое движение изнутри
       всплывает сюда же, поэтому проверяем, что доиграло наше. */
    main.addEventListener("animationend", function (e) {
      if (e.target === main) main.classList.remove("entering");
    });
  })();

  function fail() {
    var main = document.getElementById("main");
    main.textContent = "";
    main.appendChild(el("p", "empty", "Задачники не загрузились. Обновите страницу."));
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
        main.appendChild(el("p", "empty", "Задачников пока нет."));
        return;
      }
      route();
      if (fromHome()) enter(document.getElementById("main"), "12px");
      window.addEventListener("hashchange", onHash);
    })
    .catch(fail);
})();

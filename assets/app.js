/* ВсОШ по ИИ — главная: задачники, разделы с листками и проверка решений.

   Сборки нет: страница читает data/index.json прямо в браузере. Индекс,
   PDF, миниатюры и архив проверки пишет скрипт выкладки в knowledge
   (.claude/meta/push-vsosh-ii.py) — руками здесь правится только код.
   Строки, группы и разделы устроены как на 11-1, откуда взят этот код.
   Сами задачи — на странице задачников, treyl.html. */
(function () {
  "use strict";

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

  /* Даты — числами, как на «Лучезарности»: «2026-10-20» → «20.10»,
     в подсказке — с годом. */
  function shortDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
    return m ? m[3] + "." + m[2] : "";
  }

  function longDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
    return m ? m[3] + "." + m[2] + "." + m[1] : "";
  }

  function files(n) {
    return n + " " + plural(n, "файл", "файла", "файлов");
  }

  /* Миниатюра — иллюстрация с обложки или, у архива, значок «>_».
     Нет её — точка на том же месте, чтобы названия стояли в линию. */
  function thumbOf(item) {
    if (!item.thumb) return el("span", "nothumb");
    var img = el("img", "thumb");
    img.src = item.thumb;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    return img;
  }

  /* Строка ведёт прямо в PDF, в новой вкладке. Под названием — подпись:
     у задачника число задач и метки. В группе название уже стоит в её шапке,
     и строка подписана одной подписью. */
  function row(item, inSet) {
    var a = el("a", "row");
    a.href = item.href;
    a.target = "_blank";
    a.rel = "noopener";

    a.appendChild(thumbOf(item));

    var label = el("span", "row-label");
    if (inSet) {
      label.appendChild(el("span", "row-title", item.kind || item.title));
    } else {
      label.appendChild(el("span", "row-title", item.title));
      if (item.kind) label.appendChild(el("span", "row-sub", item.kind));
    }
    if (label.childNodes.length === 1) a.classList.add("row-one");
    a.appendChild(label);

    var day = shortDate(item.date);
    if (day) {
      var aside = el("span", "row-aside", day);
      aside.title = "обновлено " + longDate(item.date);
      a.appendChild(aside);
    }
    return a;
  }

  /* ── группа: листок и то, что к нему ─────────────────────

     Как на 11-1: родной <details>, раскрывается без скрипта, клавиатурой
     и читалкой экрана. Какие группы открыты, помнит браузер читателя:
     это его удобство, а не данные, и в приватном окне всё закрыто. */
  function isOpen(id) {
    try { return localStorage.getItem("open:" + id) === "1"; } catch (e) { return false; }
  }

  function remember(id, on) {
    try {
      if (on) localStorage.setItem("open:" + id, "1");
      else localStorage.removeItem("open:" + id);
    } catch (e) { /* хранилище недоступно — помнить просто нечем */ }
  }

  /* Раскрывающаяся карточка: шапка с названием и шевроном, под ней —
     что угодно. Общая для групп листков и для инструкции. */
  function details(id, title, meta, body) {
    var box = el("details", "set");
    box.open = isOpen(id);
    var head = el("summary", "set-head");
    var name = el("span", "set-label");
    name.appendChild(el("span", "set-title", title));
    head.appendChild(name);
    if (meta) head.appendChild(el("span", "set-meta", meta));
    head.appendChild(el("span", "chev"));
    box.appendChild(head);
    box.appendChild(body);
    box.addEventListener("toggle", function () { remember(id, box.open); });
    return box;
  }

  function set(entry) {
    var meta = [files(entry.items.length)];
    if (entry.date) meta.push(shortDate(entry.date));
    var body = el("div", "set-body");
    entry.items.forEach(function (item) { body.appendChild(row(item, true)); });
    return details(entry.id, entry.title, meta.join(" · "), body);
  }

  function blockHead(title, count) {
    var head = el("div", "block-head");
    head.appendChild(el("h2", null, title));
    if (count != null) head.appendChild(el("span", "block-count", String(count)));
    return head;
  }

  /* Раздел — плашка и под ней по порядку: одиночные строки подряд
     собираются на один лист, каждая группа — своей карточкой. Число
     на плашке — файлы, а не строки. */
  function block(group) {
    var sec = el("section", "block");
    var count = group.items.reduce(function (n, e) {
      return n + (e.items ? e.items.length : 1);
    }, 0);
    sec.appendChild(blockHead(group.title, count));
    var stack = el("div", "stack");
    var panel = null;
    group.items.forEach(function (entry) {
      if (entry.items) {
        panel = null;
        stack.appendChild(set(entry));
        return;
      }
      if (!panel) {
        panel = el("div", "panel");
        stack.appendChild(panel);
      }
      panel.appendChild(row(entry));
    });
    sec.appendChild(stack);
    return sec;
  }

  /* ── задачники ──────────────────────────────────────────────

     Задачник — длинный список задач; на главной он одной строкой: название,
     число задач и метки. Строка ведёт на его страницу treyl.html#<задачник>
     в той же вкладке — это часть сайта, а не файл. Число на плашке —
     задачи всех задачников. */
  function trailsBlock(trails) {
    var sec = el("section", "block");
    var total = trails.reduce(function (n, t) { return n + (parseInt(t.kind, 10) || 0); }, 0);
    sec.appendChild(blockHead("Задачники", total || null));
    var stack = el("div", "stack");
    var panel = el("div", "panel");
    trails.forEach(function (t) {
      var a = row(t);
      a.removeAttribute("target");
      a.removeAttribute("rel");
      panel.appendChild(a);
    });
    stack.appendChild(panel);
    sec.appendChild(stack);
    return sec;
  }

  /* ── проверка решений ────────────────────────────────────

     Строка архива — скачивание, а не переход: kontest.zip сразу
     сохраняется. Ниже — README проверки из того же архива: установка,
     как сдавать, правила. Он пишется в knowledge одним файлом, и здесь
     показывается он же, разобранный marked. Свёрнут, пока не откроют:
     нужен он при первой установке, а дальше мешал бы. */
  function readme(md) {
    var body = el("div", "md");
    if (window.marked) {
      body.innerHTML = window.marked.parse(md, { gfm: true, breaks: false });
      body.querySelectorAll("a[href^='http']").forEach(function (a) {
        a.target = "_blank";
        a.rel = "noopener";
      });
    } else {
      body.appendChild(el("pre", "md-raw", md));
    }
    return body;
  }

  function kontestBlock(k) {
    var sec = el("section", "block");
    sec.id = "proverka";
    sec.appendChild(blockHead(k.section || "Проверка решений"));
    var stack = el("div", "stack");
    var panel = el("div", "panel");
    var a = row(k);
    a.removeAttribute("target");
    a.removeAttribute("rel");
    a.setAttribute("download", "kontest.zip");
    panel.appendChild(a);
    stack.appendChild(panel);
    if (k.readme) stack.appendChild(details("ustanovka", "Установка и сдача", "", readme(k.readme)));
    sec.appendChild(stack);
    return sec;
  }

  function render(data) {
    var main = document.getElementById("main");
    main.textContent = "";
    var groups = (data.groups || []).filter(function (g) { return g.items && g.items.length; });
    var trails = data.treyly || [];
    if (!groups.length && !trails.length && !data.kontest) {
      main.appendChild(el("p", "empty", "Пока здесь ничего нет."));
    }
    if (trails.length) main.appendChild(trailsBlock(trails));
    groups.forEach(function (g) { main.appendChild(block(g)); });
    if (data.kontest) main.appendChild(kontestBlock(data.kontest));
  }

  function fail() {
    var main = document.getElementById("main");
    main.textContent = "";
    main.appendChild(el("p", "empty", "Список не загрузился. Обновите страницу."));
  }

  /* Знак в шапке — кнопка: нажатие только запускает вспышку лучей.
     Класс снимается и ставится заново, чтобы она повторялась и при
     нажатии подряд. */
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

  /* no-cache — сверяться с сервером при каждом открытии: список меняется,
     а Pages держит файлы в кэше по десять минут. */
  fetch("data/index.json", { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(render)
    .catch(fail);
})();

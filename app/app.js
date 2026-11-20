/* Vice City Platinum — GTA 6 trophy tracker.
 * Loads data/trophies.json, renders the checklist, persists earned trophies
 * in localStorage, and provides filters, spoiler hiding, a detail pane,
 * a road-to-platinum roadmap, and progress export/import. */
(function () {
  "use strict";

  var STORAGE_KEY = "gta6-trophies-v1";
  var DATA_URL = "data/trophies.json";

  var trophies = [];
  var earned = loadEarned();
  var selectedId = null;

  var state = {
    kind: "all",
    grade: "all",
    search: "",
    hideSpoilers: false,
    hideEarned: false,
  };

  var els = {};

  function $(id) { return document.getElementById(id); }

  function loadEarned() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      var out = {};
      if (parsed && typeof parsed === "object") {
        Object.keys(parsed).forEach(function (k) {
          if (parsed[k]) out[String(k)] = true;
        });
      }
      return out;
    } catch (e) {
      return {};
    }
  }

  function saveEarned() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(earned));
    } catch (e) {
      /* Storage unavailable (private mode, quota) — progress still works in-memory. */
    }
  }

  function isEarned(t) { return !!earned[String(t.id)]; }

  function setEarned(t, value) {
    if (value) {
      earned[String(t.id)] = true;
    } else {
      delete earned[String(t.id)];
    }
    saveEarned();
  }

  function gradeLabel(grade) {
    return grade.charAt(0).toUpperCase() + grade.slice(1);
  }

  function trophyById(id) {
    var wanted = String(id);
    for (var i = 0; i < trophies.length; i++) {
      if (String(trophies[i].id) === wanted) return trophies[i];
    }
    return null;
  }

  /* Spoiler handling: when the toggle is on, unearned story trophies hide
   * their real name and description until earned. */
  function isSpoilerHidden(t) {
    return state.hideSpoilers && t.category === "story" && !isEarned(t);
  }

  function displayName(t) {
    return isSpoilerHidden(t) ? "???" : t.name;
  }

  function displayDescription(t) {
    return isSpoilerHidden(t)
      ? "Story spoiler hidden — earn this trophy to reveal it."
      : t.description;
  }

  /* A story trophy's guide text is itself a spoiler: hide it in the detail
   * pane under the same conditions as the name and description. */
  function displayGuide(t) {
    return isSpoilerHidden(t)
      ? "Story spoiler hidden — earn this trophy to reveal it."
      : (t.guide || "No guide yet.");
  }

  function matchesFilters(t) {
    if (state.kind === "missable") {
      if (!t.missable) return false;
    } else if (state.kind !== "all" && t.category !== state.kind) {
      return false;
    }
    if (state.grade !== "all" && t.grade !== state.grade) return false;
    if (state.hideEarned && isEarned(t)) return false;
    if (state.search) {
      /* Search across name, description, guide, grade, and category, so
       * queries like "gold" or "collectibles" work as well as names. */
      var hay = (t.name + " " + t.description + " " + (t.guide || "") +
        " " + t.grade + " " + t.category).toLowerCase();
      if (hay.indexOf(state.search) === -1) return false;
    }
    return true;
  }

  /* Roadmap order: story in chapter order (by id), then missable,
   * then collectibles, then activities/online. */
  function roadmapOrder() {
    var story = [];
    var missable = [];
    var collectibles = [];
    var rest = [];
    trophies.forEach(function (t) {
      if (t.category === "story") story.push(t);
      else if (t.missable) missable.push(t);
      else if (t.category === "collectibles") collectibles.push(t);
      else rest.push(t);
    });
    function byId(a, b) { return Number(a.id) - Number(b.id); }
    story.sort(byId); missable.sort(byId); collectibles.sort(byId); rest.sort(byId);
    return [
      { phase: "Story", items: story },
      { phase: "Missable", items: missable },
      { phase: "Collectibles", items: collectibles },
      { phase: "Activities & Online", items: rest },
    ];
  }

  function renderProgress() {
    var total = trophies.length;
    var count = trophies.filter(isEarned).length;
    var pct = total ? Math.round((count / total) * 100) : 0;
    els.progressCount.textContent = count + " / " + total + " earned";
    els.progressPct.textContent = pct + "%";
    els.progressFill.style.width = pct + "%";
    els.progressBar.setAttribute("aria-valuenow", String(pct));
    var byGrade = {};
    trophies.forEach(function (t) {
      if (isEarned(t)) byGrade[t.grade] = (byGrade[t.grade] || 0) + 1;
    });
    var parts = ["platinum", "gold", "silver", "bronze"].map(function (g) {
      var totalG = trophies.filter(function (t) { return t.grade === g; }).length;
      return gradeLabel(g) + " " + (byGrade[g] || 0) + "/" + totalG;
    });
    els.progressCount.title = parts.join(" · ");
  }

  function renderRoadmap() {
    var html = "";
    var n = 0;
    roadmapOrder().forEach(function (group) {
      group.items.forEach(function (t) {
        n += 1;
        var cls = isEarned(t) ? "roadmap-step earned" : "roadmap-step";
        html += '<li class="' + cls + '">' +
          '<span class="roadmap-num">' + n + "</span>" +
          '<span><span class="roadmap-phase">' + group.phase + "</span>" +
          '<span class="roadmap-name">' + escapeHtml(displayName(t)) + "</span> " +
          '<span class="roadmap-meta">' + escapeHtml(gradeLabel(t.grade)) +
          (isEarned(t) ? " · earned" : "") + "</span></span></li>";
      });
    });
    els.roadmapList.innerHTML = html;
  }

  function renderList() {
    var visible = trophies.filter(matchesFilters);
    var html = "";
    visible.forEach(function (t) {
      var idStr = String(t.id);
      var earnedClass = isEarned(t) ? " earned" : "";
      html += '<li class="trophy' + earnedClass + '" data-id="' + escapeAttr(idStr) + '">' +
        '<input type="checkbox"' + (isEarned(t) ? " checked" : "") +
        ' aria-label="Mark ' + escapeAttr(displayName(t)) + ' as earned" data-id="' + escapeAttr(idStr) + '">' +
        '<div class="trophy-body">' +
        '<div class="trophy-name">' + escapeHtml(displayName(t)) + "</div>" +
        '<p class="trophy-desc">' + escapeHtml(displayDescription(t)) + "</p>" +
        '<div class="trophy-tags">' +
        '<span class="tag tag-' + escapeAttr(t.grade) + '">' + escapeHtml(gradeLabel(t.grade)) + "</span>" +
        '<span class="tag">' + escapeHtml(t.category) + "</span>" +
        (t.missable ? '<span class="tag tag-missable">Missable</span>' : "") +
        "</div></div></li>";
    });
    els.trophyList.innerHTML = html;
    els.emptyState.hidden = visible.length !== 0;
    els.resultsLine.textContent =
      "Showing " + visible.length + " of " + trophies.length + " trophies" +
      (state.kind === "missable" ? " — no missable trophies have been confirmed yet." : "") +
      ".";
  }

  function renderDetail() {
    var t = selectedId === null ? null : trophyById(selectedId);
    if (!t) {
      els.detail.hidden = true;
      els.detailBody.innerHTML = "";
      return;
    }
    var html = "<h3>" + escapeHtml(displayName(t)) + "</h3>" +
      '<div class="trophy-tags">' +
      '<span class="tag tag-' + escapeAttr(t.grade) + '">' + escapeHtml(gradeLabel(t.grade)) + "</span>" +
      '<span class="tag">' + escapeHtml(t.category) + "</span>" +
      (t.missable ? '<span class="tag tag-missable">Missable</span>' : "") +
      "</div>" +
      '<p><span class="label">Description:</span> ' + escapeHtml(displayDescription(t)) + "</p>" +
      '<p><span class="label">Guide:</span> ' + escapeHtml(displayGuide(t)) + "</p>" +
      "<p><span class=\"label\">Missable:</span> " + (t.missable ? "Yes — do this before it is too late." : "No") + "</p>" +
      '<p class="source"><span class="label">Source:</span> ' + escapeHtml(t.source || "—") +
      (t.source_url ? ' — <a href="' + escapeAttr(t.source_url) + '" target="_blank" rel="noopener">' + escapeHtml(t.source_url) + "</a>" : "") + "</p>" +
      '<p><button type="button" id="detail-toggle-earned">' +
      (isEarned(t) ? "Mark as not earned" : "Mark as earned") + "</button></p>";
    els.detailBody.innerHTML = html;
    els.detail.hidden = false;
    var btn = $("detail-toggle-earned");
    if (btn) {
      btn.addEventListener("click", function () {
        setEarned(t, !isEarned(t));
        renderAll();
      });
    }
  }

  function renderAll() {
    renderProgress();
    renderRoadmap();
    renderList();
    renderDetail();
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(s) { return escapeHtml(s).replace(/'/g, "&#39;"); }

  function exportProgress() {
    var data = {
      app: "gta6-trophy-guide",
      version: 1,
      exportedAt: new Date().toISOString(),
      earned: Object.keys(earned).sort(function (a, b) { return Number(a) - Number(b); }),
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "gta6-trophy-progress.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function importProgress(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(String(reader.result));
        var list = Array.isArray(data) ? data : data.earned;
        if (!Array.isArray(list)) throw new Error("bad file");
        var next = {};
        list.forEach(function (rawId) {
          var t = trophyById(rawId);
          if (t) next[String(t.id)] = true;
        });
        earned = next;
        saveEarned();
        renderAll();
      } catch (e) {
        window.alert("Could not import that file: it is not a valid progress export.");
      }
    };
    reader.readAsText(file);
  }

  function bindEvents() {
    els.search.addEventListener("input", function () {
      state.search = els.search.value.trim().toLowerCase();
      renderList();
    });

    els.kindFilters.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-kind]");
      if (!btn) return;
      state.kind = btn.getAttribute("data-kind");
      els.kindFilters.querySelectorAll(".chip").forEach(function (c) {
        var on = c.getAttribute("data-kind") === state.kind;
        c.classList.toggle("active", on);
        c.setAttribute("aria-pressed", String(on));
      });
      renderList();
    });

    els.gradeFilters.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-grade]");
      if (!btn) return;
      state.grade = btn.getAttribute("data-grade");
      els.gradeFilters.querySelectorAll(".chip").forEach(function (c) {
        var on = c.getAttribute("data-grade") === state.grade;
        c.classList.toggle("active", on);
        c.setAttribute("aria-pressed", String(on));
      });
      renderList();
    });

    els.spoilerToggle.addEventListener("change", function () {
      state.hideSpoilers = els.spoilerToggle.checked;
      renderAll();
    });

    els.hideEarnedToggle.addEventListener("change", function () {
      state.hideEarned = els.hideEarnedToggle.checked;
      renderList();
    });

    /* Event delegation: checkbox toggles earned, clicking the row opens detail. */
    els.trophyList.addEventListener("click", function (e) {
      var row = e.target.closest(".trophy");
      if (!row) return;
      var t = trophyById(row.getAttribute("data-id"));
      if (!t) return;
      if (e.target.tagName === "INPUT") {
        setEarned(t, e.target.checked);
        renderAll();
        return;
      }
      selectedId = String(t.id);
      renderDetail();
    });

    els.detailClose.addEventListener("click", function () {
      selectedId = null;
      renderDetail();
    });

    els.exportBtn.addEventListener("click", exportProgress);
    els.importBtn.addEventListener("click", function () { els.importFile.click(); });
    els.importFile.addEventListener("change", function () {
      if (els.importFile.files && els.importFile.files[0]) {
        importProgress(els.importFile.files[0]);
      }
      els.importFile.value = "";
    });
    els.resetBtn.addEventListener("click", function () {
      if (window.confirm("Clear all earned trophies?")) {
        earned = {};
        saveEarned();
        selectedId = null;
        renderAll();
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !els.detail.hidden) {
        selectedId = null;
        renderDetail();
      }
      /* "/" focuses the search box (unless already typing in an input). */
      if (e.key === "/" && document.activeElement !== els.search &&
          document.activeElement.tagName !== "INPUT" &&
          document.activeElement.tagName !== "TEXTAREA") {
        e.preventDefault();
        els.search.focus();
      }
    });
  }

  function init() {
    els = {
      progressCount: $("progress-count"),
      progressPct: $("progress-pct"),
      progressFill: $("progress-fill"),
      progressBar: $("progress-bar"),
      exportBtn: $("export-btn"),
      importBtn: $("import-btn"),
      importFile: $("import-file"),
      resetBtn: $("reset-btn"),
      search: $("search"),
      kindFilters: $("kind-filters"),
      gradeFilters: $("grade-filters"),
      spoilerToggle: $("spoiler-toggle"),
      hideEarnedToggle: $("hide-earned-toggle"),
      resultsLine: $("results-line"),
      roadmapList: $("roadmap-list"),
      trophyList: $("trophy-list"),
      emptyState: $("empty-state"),
      detail: $("detail"),
      detailBody: $("detail-body"),
      detailClose: $("detail-close"),
    };

    bindEvents();

    fetch(DATA_URL)
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load " + DATA_URL + ": " + res.status);
        return res.json();
      })
      .then(function (data) {
        trophies = Array.isArray(data) ? data : data.trophies || [];
        renderAll();
      })
      .catch(function (err) {
        els.trophyList.innerHTML = "";
        els.emptyState.hidden = false;
        els.emptyState.textContent = "Could not load the trophy list: " + err.message;
        els.resultsLine.textContent = "";
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

(() => {
  const LS_KEY = "knitting-counter.v1";
  const SEGMENT_LIMIT = 32;
  const ID_OK = /^[A-Za-z0-9_\-.~:@+]{1,120}$/;

  const app = document.getElementById("app");
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const newId = () => (self.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
  const toInt = (v, min, max) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min; };

  const state = { projects: [], openId: null };

  // ---------- Model ----------

  function makeProject(fields) {
    const now = Date.now();
    return {
      id: newId(), name: "", rows: 0, stitches: 0,
      rowsPerRepeat: null, totalRepeats: null,
      resetStitchesOnNewRow: true, showSides: false, notes: "",
      createdAt: now, updatedAt: now, ...fields,
    };
  }

  function normalize(id, d) {
    const opt = (v) => (v == null || !(Number(v) >= 1) ? null : toInt(v, 1, 999));
    return {
      id,
      name: typeof d.name === "string" && d.name.trim() ? d.name.trim().slice(0, 80) : "Untitled project",
      rows: toInt(d.rows, 0, 99999),
      stitches: toInt(d.stitches, 0, 99999),
      rowsPerRepeat: opt(d.rowsPerRepeat),
      totalRepeats: opt(d.rowsPerRepeat) ? opt(d.totalRepeats) : null,
      resetStitchesOnNewRow: d.resetStitchesOnNewRow !== false,
      showSides: d.showSides === true,
      notes: typeof d.notes === "string" ? d.notes.slice(0, 2000) : "",
      createdAt: toInt(d.createdAt, 0, 1e15),
      updatedAt: toInt(d.updatedAt, 0, 1e15),
    };
  }

  // Both `current` and `row` are 1-based and describe the row about to be knitted.
  function repeatProgress(p) {
    const per = p.rowsPerRepeat;
    if (!per) return null;
    const total = p.totalRepeats || null;
    if (total && p.rows >= per * total) return { current: total, row: per, per, total, complete: true };
    return { current: Math.floor(p.rows / per) + 1, row: (p.rows % per) + 1, per, total, complete: false };
  }

  const find = (id) => state.projects.find((p) => p.id === id);
  const sorted = () => [...state.projects].sort((a, b) => b.createdAt - a.createdAt);
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

  // ---------- Saving ----------
  // Every change lands in localStorage at once, then goes to the viewer's private
  // db subtree after a short pause, so rapid taps become one write.

  const sync = {
    col: null, mode: "connecting", message: "",
    timers: new Map(), dirty: new Set(), inflight: new Set(), attempts: new Map(),
    deleted: new Set(), synced: new Set(),
  };

  function saveLocal() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ projects: state.projects, openId: state.openId, synced: [...sync.synced] }));
    } catch {}
  }

  function loadLocal() {
    try {
      const raw = JSON.parse(localStorage.getItem(LS_KEY) || "null");
      if (!raw || !Array.isArray(raw.projects)) return;
      state.projects = raw.projects
        .filter((p) => p && typeof p.id === "string" && ID_OK.test(p.id))
        .map((p) => normalize(p.id, p));
      state.openId = find(raw.openId) ? raw.openId : null;
      (raw.synced || []).forEach((id) => sync.synced.add(id));
    } catch {}
  }

  function setSync(mode, message = "") {
    sync.mode = mode;
    sync.message = message;
    const el = $("sync-status");
    if (!el) return;
    const text = {
      connecting: window.claude ? "Connecting to your Claude account…" : "",
      device: "Saved on this phone. Add the app to your Home Screen, and save a backup now and then.",
      cloud: "Saved to your Claude account. Open this page on any device to carry on.",
      local: "Saved on this device only. Sign in to claude.ai to keep projects across devices.",
    }[mode] || message;
    el.textContent = mode === "error" ? message : text;
    el.classList.toggle("error", mode === "error");
  }

  function queueWrite(id) {
    sync.dirty.add(id);
    if (!sync.col) return;
    clearTimeout(sync.timers.get(id));
    sync.timers.set(id, setTimeout(() => flush(id), 600));
  }

  async function flush(id) {
    sync.timers.delete(id);
    if (!sync.col || sync.inflight.has(id) || !sync.dirty.has(id)) return;
    sync.dirty.delete(id);
    sync.inflight.add(id);
    const p = find(id);
    try {
      if (p) {
        const { id: _omit, ...body } = p;
        await sync.col.doc(id).set(body);
        sync.synced.add(id);
      } else {
        await sync.col.doc(id).delete();
        sync.synced.delete(id);
      }
      sync.attempts.delete(id);
      saveLocal();
      if (sync.mode === "error") setSync("cloud");
    } catch (e) {
      sync.dirty.add(id);
      onWriteError(e, id);
    } finally {
      sync.inflight.delete(id);
      if (sync.col && sync.dirty.has(id) && !sync.timers.has(id) && (sync.attempts.get(id) || 0) === 0) {
        sync.timers.set(id, setTimeout(() => flush(id), 600));
      }
    }
  }

  function onWriteError(e, id) {
    const code = e && e.code;
    if (code === "unavailable" || code === "resource_exhausted") {
      const n = (sync.attempts.get(id) || 0) + 1;
      sync.attempts.set(id, n);
      if (n <= 3) {
        sync.timers.set(id, setTimeout(() => flush(id), 1500 * n + Math.random() * 500));
      } else {
        sync.attempts.delete(id);
        setSync("error", "Couldn't reach your Claude account. Your counts are safe on this device and will save on your next change.");
      }
    } else if (code === "quota_exceeded") {
      setSync("error", "Your project storage is full. Delete a finished project to keep saving to your account.");
    } else {
      // Not allowed or not available in this view: keep working on this device.
      stopCloud();
      setSync("local");
    }
  }

  function flushAll() {
    for (const id of [...sync.dirty]) { clearTimeout(sync.timers.get(id)); flush(id); }
  }

  function stopCloud() {
    if (sync.unsub) { try { sync.unsub(); } catch {} }
    sync.unsub = null;
    sync.col = null;
  }

  function onRemote(snap) {
    const byId = new Map(state.projects.map((p) => [p.id, p]));
    const remoteIds = new Set();
    let changed = false;

    for (const d of snap.docs) {
      if (!d.exists || !ID_OK.test(d.id)) continue;
      remoteIds.add(d.id);
      if (sync.deleted.has(d.id)) continue;
      sync.synced.add(d.id);
      const busy = sync.dirty.has(d.id) || sync.inflight.has(d.id);
      if (busy) continue;
      const remote = normalize(d.id, d.data() || {});
      const local = byId.get(d.id);
      if (local && local.updatedAt > remote.updatedAt) { queueWrite(d.id); continue; }
      if (!local || JSON.stringify(local) !== JSON.stringify(remote)) { byId.set(d.id, remote); changed = true; }
    }

    if (!snap.metadata.fromCache) {
      for (const id of [...byId.keys()]) {
        if (remoteIds.has(id) || sync.dirty.has(id) || sync.inflight.has(id)) continue;
        if (sync.synced.has(id)) {
          // Saved before, gone now: deleted on another device.
          byId.delete(id);
          sync.synced.delete(id);
          changed = true;
        } else {
          // Only ever lived on this device: upload it.
          queueWrite(id);
        }
      }
      if (sync.mode !== "error") setSync("cloud");
    }

    if (changed) {
      state.projects = [...byId.values()];
      if (state.openId && !byId.has(state.openId)) state.openId = null;
      saveLocal();
      render();
    } else {
      saveLocal();
    }
  }

  let connecting = false;
  async function connect() {
    if (connecting || sync.col) return;
    if (!window.claude || typeof window.claude.use !== "function") return false;
    connecting = true;
    try {
      const [db, user] = await Promise.all([window.claude.use("db"), window.claude.use("user")]);
      const uid = user ? await user.id() : null;
      if (!db || !uid) { setSync("local"); return true; }
      sync.col = db.collection("data/users/" + uid);
      sync.unsub = sync.col.onSnapshot(onRemote, () => { stopCloud(); setSync("local"); });
      for (const id of [...sync.dirty]) queueWrite(id);
    } catch {
      stopCloud();
      setSync("local");
    } finally {
      connecting = false;
    }
    return true;
  }

  // ---------- Changes ----------

  function commit(id) {
    saveLocal();
    queueWrite(id);
    render();
  }

  function change(id, fn) {
    const p = find(id);
    if (!p) return;
    fn(p);
    p.updatedAt = Date.now();
    commit(id);
  }

  function addProject(fields) {
    const p = makeProject(fields);
    state.projects.push(p);
    state.openId = p.id;
    commit(p.id);
  }

  function deleteProject(id) {
    state.projects = state.projects.filter((p) => p.id !== id);
    sync.deleted.add(id);
    if (state.openId === id) state.openId = null;
    commit(id);
  }

  function bump(elId) {
    const el = $(elId);
    if (!el) return;
    el.classList.remove("bump");
    void el.offsetWidth;
    el.classList.add("bump");
  }

  // ---------- Rendering ----------

  function progressBar(rp, small) {
    if (rp.complete) return `<div class="track done${small ? " pbar" : ""}"><span style="width:100%"></span></div>`;
    if (!small && rp.per <= SEGMENT_LIMIT) {
      const segs = Array.from({ length: rp.per }, (_, i) =>
        `<span class="${i < rp.row - 1 ? "on" : i === rp.row - 1 ? "here" : ""}"></span>`).join("");
      return `<div class="segments" aria-hidden="true">${segs}</div>`;
    }
    const frac = rp.total ? ((rp.current - 1) * rp.per + rp.row - 1) / (rp.total * rp.per) : (rp.row - 1) / rp.per;
    return `<div class="track${small ? " pbar" : ""}"><span style="width:${(frac * 100).toFixed(1)}%"></span></div>`;
  }

  function projectMeta(p) {
    const rp = repeatProgress(p);
    if (!rp) return p.stitches ? `${p.stitches} ${p.stitches === 1 ? "stitch" : "stitches"} on this row` : "Rows done";
    if (rp.complete) return `All ${rp.total} repeats done`;
    return `Repeat ${rp.current}${rp.total ? ` of ${rp.total}` : ""} · row ${rp.row} of ${rp.per}`;
  }

  function renderList() {
    const ps = sorted();
    const cards = ps.map((p) => {
      const rp = repeatProgress(p);
      return `<li><button class="project" data-act="open" data-id="${esc(p.id)}">
        <span class="pname">${esc(p.name)}</span>
        <span class="pcount" aria-label="${plural(p.rows, "row")} done">${p.rows}</span>
        <span class="pmeta">${esc(projectMeta(p))}</span>
        ${rp && rp.total ? progressBar(rp, true) : ""}
      </button></li>`;
    }).join("");

    app.innerHTML = `
      <header class="list-head">
        <div><p class="label" style="margin:0 0 6px">Rows · stitches · repeats</p><h1>Knitting Counter</h1></div>
        ${ps.length ? `<button class="btn primary" data-act="new">New project</button>` : ""}
      </header>
      ${ps.length ? `<ul class="projects">${cards}</ul>` : `
        <section class="empty">
          <h2>Start your first project</h2>
          <p>Count rows with one big tap, keep a stitch count, and track where you are in a pattern repeat. Each project keeps its own counts.</p>
          <div class="actions">
            <button class="btn primary" data-act="new">New project</button>
            <button class="btn" data-act="example">Try an example</button>
          </div>
        </section>`}
      <section class="backup" aria-labelledby="backup-h">
        <h2 class="label" id="backup-h">Backup</h2>
        <p>Save all your projects to a file. Restore it after clearing Safari, or to move your projects to another phone.</p>
        <div class="actions">
          <button class="btn" data-act="export" ${ps.length ? "" : "disabled"}>Save backup</button>
          <button class="btn" data-act="import">Restore backup</button>
        </div>
        <p class="msg" id="backup-msg" role="status">${esc(state.backupMsg || "")}</p>
      </section>
      <p class="sync" id="sync-status"></p>`;
    setSync(sync.mode, sync.message);
  }

  function renderCounter(p) {
    const rp = repeatProgress(p);
    const next = p.rows + 1;
    const rs = next % 2 === 1;
    const hint = p.showSides
      ? `Next: row ${next} <span class="side${rs ? "" : " ws"}">${rs ? "RS" : "WS"}</span> ${rs ? "right side" : "wrong side"}`
      : "Tap to add a row";
    // With repeats on, the big number counts rows in the current repeat and starts
    // again at 0 when a repeat is finished. The running total is shown underneath.
    const inRepeat = !!rp && !rp.complete;
    const shown = inRepeat ? rp.row - 1 : p.rows;
    const justFinished = inRepeat && shown === 0 && rp.current > 1;
    const totalLine = inRepeat
      ? `<span class="hint">${justFinished ? `Repeat ${rp.current - 1} finished. ` : ""}Total: ${plural(p.rows, "row")}</span>`
      : "";

    let repeat = "";
    if (rp) {
      repeat = rp.complete
        ? `<section class="repeat complete"><div class="repeat-top"><strong>All ${rp.total} repeats done</strong><span>${plural(p.rows, "row")}</span></div></section>`
        : `<section class="repeat" aria-label="Pattern repeat">
            <div class="repeat-top">
              <strong>Repeat ${rp.current}${rp.total ? ` of ${rp.total}` : ""}</strong>
              <span>Row ${rp.row} of ${rp.per}</span>
            </div>
            ${progressBar(rp, false)}
            ${rp.total ? `<small>${(rp.current - 1) * rp.per + rp.row - 1} of ${rp.total * rp.per} pattern rows knitted</small>` : ""}
          </section>`;
    }

    app.innerHTML = `
      <header class="bar">
        <button class="btn ghost" data-act="back">‹ Projects</button>
        <h1>${esc(p.name)}</h1>
        <button class="btn ghost" data-act="edit">Edit</button>
      </header>
      ${repeat}
      <button class="rows-tap" data-act="row+" aria-label="${inRepeat ? `Rows done this repeat: ${shown}. Total ${p.rows}.` : `Rows done: ${p.rows}.`} Tap to add a row.">
        <span class="label">${inRepeat ? "Rows done this repeat" : "Rows done"}</span>
        <span class="big" id="rows-num">${shown}</span>
        <span class="hint">${hint}</span>
        ${totalLine}
      </button>
      <div class="row-tools">
        <button class="btn" data-act="row-" ${p.rows ? "" : "disabled"}>− Undo row</button>
      </div>
      <section class="stitches" aria-label="Stitch counter">
        <button class="round" data-act="st-" aria-label="Remove a stitch" ${p.stitches ? "" : "disabled"}>−</button>
        <div class="st-mid"><span class="label">Stitches</span><span class="mid" id="st-num">${p.stitches}</span></div>
        <button class="round primary" data-act="st+" aria-label="Add a stitch">+</button>
      </section>
      ${p.notes ? `<details class="notes"><summary>Notes</summary><p>${esc(p.notes)}</p></details>` : ""}`;
  }

  function render() {
    const p = state.openId && find(state.openId);
    if (p) renderCounter(p);
    else { state.openId = null; renderList(); }
    keepAwake(!!p);
  }

  // ---------- Screen wake lock ----------

  let wake = null;
  async function keepAwake(on) {
    try {
      if (on && !wake && navigator.wakeLock && document.visibilityState === "visible") {
        wake = await navigator.wakeLock.request("screen");
        wake.addEventListener("release", () => { wake = null; });
      } else if (!on && wake) {
        const w = wake; wake = null; await w.release();
      }
    } catch { wake = null; }
  }

  // ---------- Events ----------

  app.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const act = btn.dataset.act;
    const id = state.openId;
    switch (act) {
      case "new": openEditor(null); break;
      case "example":
        addProject({ name: "Cabled scarf (example)", rows: 13, stitches: 4, rowsPerRepeat: 8, totalRepeats: 12,
          showSides: true, notes: "Example project. Edit or delete it any time.\n4.5 mm needles, 8-row cable repeat." });
        break;
      case "open": state.openId = btn.dataset.id; state.backupMsg = ""; saveLocal(); render(); break;
      case "back": state.openId = null; saveLocal(); render(); break;
      case "edit": openEditor(find(id)); break;
      case "row+":
        change(id, (p) => { p.rows = Math.min(99999, p.rows + 1); if (p.resetStitchesOnNewRow) p.stitches = 0; });
        bump("rows-num");
        break;
      case "row-": change(id, (p) => { p.rows = Math.max(0, p.rows - 1); }); break;
      case "st+": change(id, (p) => { p.stitches = Math.min(99999, p.stitches + 1); }); bump("st-num"); break;
      case "st-": change(id, (p) => { p.stitches = Math.max(0, p.stitches - 1); }); break;
      case "export": exportBackup(); break;
      case "import": $("import-file").click(); break;
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") keepAwake(!!state.openId);
    else flushAll();
  });
  window.addEventListener("pagehide", flushAll);

  // ---------- Backup ----------

  function say(msg) {
    state.backupMsg = msg;
    const el = $("backup-msg");
    if (el) el.textContent = msg;
  }

  const isLifecycle = (code) => !code || code === "unavailable" || code === "not_granted" || String(code).startsWith("capability_");

  async function exportBackup() {
    const data = JSON.stringify({
      app: "knitting-counter", version: 1, exportedAt: new Date().toISOString(), projects: state.projects,
    }, null, 2);
    const filename = `knitting-backup-${new Date().toISOString().slice(0, 10)}.json`;

    // Inside Claude the page can't download by itself; the viewer offers the file.
    if (window.claude && typeof window.claude.use === "function") {
      try {
        const downloads = await window.claude.use("downloads");
        if (downloads) {
          await downloads.save({ filename, data });
          return say("Backup saved.");
        }
      } catch (e) {
        if (e && e.code === "declined") return say("Backup not saved.");
        if (!isLifecycle(e && e.code)) return say("Couldn't save the backup. Try again in a moment.");
      }
    }

    const file = new File([data], filename, { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Knitting Counter backup" });
        return say("Backup shared. Pick Save to Files to keep it on your phone.");
      } catch (e) {
        if (e && e.name === "AbortError") return say("Backup not saved.");
      }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    say("Backup downloaded.");
  }

  // Restoring merges: new projects are added, and a project already here is
  // replaced only when the backup's copy was changed more recently.
  $("import-file").addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    try {
      const raw = JSON.parse(await f.text());
      const list = Array.isArray(raw) ? raw : raw && raw.projects;
      if (!Array.isArray(list)) throw new Error("not a backup");
      let added = 0, updated = 0;
      for (const item of list.slice(0, 500)) {
        if (!item || typeof item.id !== "string" || !ID_OK.test(item.id)) continue;
        const p = normalize(item.id, item);
        const cur = find(p.id);
        if (!cur) {
          state.projects.push(p);
          sync.deleted.delete(p.id);
          queueWrite(p.id);
          added++;
        } else if (p.updatedAt > cur.updatedAt) {
          Object.assign(cur, p);
          queueWrite(p.id);
          updated++;
        }
      }
      saveLocal();
      state.backupMsg = added || updated
        ? `Restored ${added} new and ${updated} updated ${added + updated === 1 ? "project" : "projects"}.`
        : "Nothing new in that backup. Your projects are already up to date.";
      render();
    } catch {
      say("That file isn't a Knitting Counter backup.");
    }
  });

  // ---------- Editor ----------

  const dlg = $("editor");
  const form = $("editor-form");
  let editingId = null;

  function syncEditorFields() {
    const on = $("f-repeat").checked;
    $("repeat-fields").hidden = !on;
    $("repeat-help").hidden = !on;
  }

  function disarm() {
    for (const b of dlg.querySelectorAll("[data-armed-text]")) {
      if (b.dataset.label) b.textContent = b.dataset.label;
      b.classList.remove("armed");
      clearTimeout(b._t);
    }
  }

  // First tap arms a destructive button; a second tap within 4 seconds runs it.
  function armOrRun(btn, run) {
    if (btn.classList.contains("armed")) { disarm(); run(); return; }
    disarm();
    btn.dataset.label = btn.textContent;
    btn.textContent = btn.dataset.armedText;
    btn.classList.add("armed");
    btn._t = setTimeout(disarm, 4000);
  }

  function openEditor(p) {
    editingId = p ? p.id : null;
    disarm();
    $("editor-title").textContent = p ? "Edit project" : "New project";
    $("editor-save").textContent = p ? "Save" : "Create";
    $("f-name").value = p ? p.name : "";
    $("f-name-err").hidden = true;
    $("f-repeat").checked = !!(p && p.rowsPerRepeat);
    $("f-per").value = (p && p.rowsPerRepeat) || 8;
    $("f-total").value = (p && p.totalRepeats) || "";
    $("f-reset").checked = p ? p.resetStitchesOnNewRow : true;
    $("f-sides").checked = p ? p.showSides : false;
    $("count-fields").hidden = !p;
    $("f-rows").value = p ? p.rows : 0;
    $("f-stitches").value = p ? p.stitches : 0;
    $("f-notes").value = p ? p.notes : "";
    $("danger-zone").hidden = !p;
    syncEditorFields();
    dlg.showModal();
    if (!p) $("f-name").focus();
  }

  $("f-repeat").addEventListener("change", syncEditorFields);
  $("editor-cancel").addEventListener("click", () => dlg.close());
  dlg.addEventListener("close", disarm);
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });

  $("reset-counts").addEventListener("click", (e) => armOrRun(e.currentTarget, () => {
    change(editingId, (p) => { p.rows = 0; p.stitches = 0; });
    dlg.close();
  }));
  $("delete-project").addEventListener("click", (e) => armOrRun(e.currentTarget, () => {
    const id = editingId;
    dlg.close();
    deleteProject(id);
  }));

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("f-name").value.trim();
    if (!name) { $("f-name-err").hidden = false; $("f-name").focus(); return; }
    const repeat = $("f-repeat").checked;
    const totalRaw = $("f-total").value.trim();
    const fields = {
      name: name.slice(0, 80),
      rowsPerRepeat: repeat ? toInt($("f-per").value, 1, 999) : null,
      totalRepeats: repeat && totalRaw && Number(totalRaw) >= 1 ? toInt(totalRaw, 1, 999) : null,
      resetStitchesOnNewRow: $("f-reset").checked,
      showSides: $("f-sides").checked,
      notes: $("f-notes").value.trim().slice(0, 2000),
    };
    if (editingId) {
      change(editingId, (p) => {
        Object.assign(p, fields);
        p.rows = toInt($("f-rows").value, 0, 99999);
        p.stitches = toInt($("f-stitches").value, 0, 99999);
      });
    } else {
      addProject(fields);
    }
    dlg.close();
  });

  // ---------- Start ----------

  loadLocal();
  render();
  // The viewer may attach window.claude a moment after this script runs.
  (async () => {
    for (const wait of [0, 300, 1000, 3000]) {
      if (wait) await new Promise((r) => setTimeout(r, wait));
      if ((await connect()) !== false) return;
    }
    // No Claude page around this one (for example the GitHub Pages copy).
    setSync("device");
  })();
})();

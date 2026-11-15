// 資料層：有 Firebase 設定就用 Firestore，沒有就用瀏覽器的試用模式
//
// Firestore 結構
//   students/{卡號}      { seat, name, cardNo, design, balance, createdAt }
//   transactions/{自動}  { cardNo, name, amount, reason, type, balanceAfter, ts, batchId, undone }
//   settings/main        { drawPrice, drawDate, lastInterestAt }

const Store = (() => {
  const FB = "https://www.gstatic.com/firebasejs/10.12.2/";
  let impl;
  const api = { mode: "demo" };

  function readConfig() {
    let cfg = window.FIREBASE_CONFIG;
    // 若老師把整段 const firebaseConfig = {...} 貼上，也能讀到
    if (!cfg) { try { cfg = firebaseConfig; } catch (e) {} } // eslint-disable-line no-undef
    return cfg;
  }

  function loadScript(src) {
    return new Promise((ok, fail) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = ok;
      s.onerror = () => fail(new Error("無法載入 " + src));
      document.head.appendChild(s);
    });
  }

  api.init = async function () {
    const cfg = readConfig();
    if (!cfg) {
      throw new Error("讀不到 <b>js/firebase-config.js</b>。可能是檔案沒有上傳，或貼上設定時格式打錯了（例如多貼了 import 開頭的行、少了逗號或引號）。請對照「設定步驟.md」第 4 步重新貼一次。");
    }
    if (cfg.apiKey && cfg.projectId) {
      await loadScript(FB + "firebase-app-compat.js");
      await loadScript(FB + "firebase-firestore-compat.js");
      const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(cfg);
      impl = firestoreImpl(app.firestore());
      api.mode = "firebase";
    } else {
      impl = demoImpl();
      api.mode = "demo";
    }
    return api.mode;
  };

  api.watchStudents = (cb) => impl.watchStudents(cb);
  api.watchSettings = (cb) => impl.watchSettings(cb);
  api.getStudentTx = (cardNo) => impl.getStudentTx(cardNo);
  api.getRecentTx = (n) => impl.getRecentTx(n);
  api.getAllTx = () => impl.getAllTx();
  // ops = { students:[{id,data}], deleteStudents:[id], txs:[data], txUpdates:[{id,data}], settings:{} }
  api.commit = (ops) => impl.commit(ops);
  api.newBatchId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  function dbError(err) {
    console.error(err);
    const hint = /permission/i.test(err.message)
      ? "資料庫拒絕讀寫：請確認 Firestore 的「規則」已貼上並按下「發布」（設定步驟第 3 步）。"
      : "連不上資料庫：" + err.message;
    showFatal(hint);
  }

  /* ---------------- Firestore ---------------- */
  function firestoreImpl(db) {
    const settingsRef = db.collection("settings").doc("main");
    const rows = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return {
      watchStudents: (cb) => db.collection("students").onSnapshot((s) => cb(rows(s)), dbError),
      watchSettings: (cb) => settingsRef.onSnapshot((d) => cb(d.exists ? d.data() : {}), dbError),
      async getStudentTx(cardNo) {
        return rows(await db.collection("transactions").where("cardNo", "==", cardNo).get()).sort((a, b) => b.ts - a.ts);
      },
      async getRecentTx(n = 150) {
        return rows(await db.collection("transactions").orderBy("ts", "desc").limit(n).get());
      },
      async getAllTx() {
        return rows(await db.collection("transactions").get()).sort((a, b) => a.ts - b.ts);
      },
      async commit(ops) {
        const all = [];
        (ops.students || []).forEach((s) => all.push((b) => b.set(db.collection("students").doc(s.id), s.data, { merge: true })));
        (ops.deleteStudents || []).forEach((id) => all.push((b) => b.delete(db.collection("students").doc(id))));
        (ops.txs || []).forEach((t) => all.push((b) => b.set(db.collection("transactions").doc(), t)));
        (ops.txUpdates || []).forEach((t) => all.push((b) => b.update(db.collection("transactions").doc(t.id), t.data)));
        if (ops.settings) all.push((b) => b.set(settingsRef, ops.settings, { merge: true }));
        for (let i = 0; i < all.length; i += 450) {
          const b = db.batch();
          all.slice(i, i + 450).forEach((fn) => fn(b));
          await b.commit();
        }
      },
    };
  }

  /* ---------------- 試用模式（localStorage） ---------------- */
  function demoImpl() {
    const KEY = "crocbank-demo-v1";
    const load = () => {
      try { return JSON.parse(localStorage.getItem(KEY)) || { students: {}, txs: {}, settings: {} }; }
      catch (e) { return { students: {}, txs: {}, settings: {} }; }
    };
    let data = load();
    const subs = new Set();
    const save = () => {
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
      subs.forEach((fn) => fn());
    };
    window.addEventListener("storage", (e) => { if (e.key === KEY) { data = load(); subs.forEach((fn) => fn()); } });
    const list = () => Object.entries(data.students).map(([id, v]) => ({ id, ...v }));
    const txs = () => Object.entries(data.txs).map(([id, v]) => ({ id, ...v }));
    return {
      watchStudents(cb) { const f = () => cb(list()); subs.add(f); f(); return () => subs.delete(f); },
      watchSettings(cb) { const f = () => cb({ ...data.settings }); subs.add(f); f(); return () => subs.delete(f); },
      async getStudentTx(cardNo) { return txs().filter((t) => t.cardNo === cardNo).sort((a, b) => b.ts - a.ts); },
      async getRecentTx(n = 150) { return txs().sort((a, b) => b.ts - a.ts).slice(0, n); },
      async getAllTx() { return txs().sort((a, b) => a.ts - b.ts); },
      async commit(ops) {
        (ops.students || []).forEach((s) => (data.students[s.id] = { ...(data.students[s.id] || {}), ...s.data }));
        (ops.deleteStudents || []).forEach((id) => delete data.students[id]);
        (ops.txs || []).forEach((t) => (data.txs[Math.random().toString(36).slice(2)] = t));
        (ops.txUpdates || []).forEach((t) => (data.txs[t.id] = { ...data.txs[t.id], ...t.data }));
        if (ops.settings) data.settings = { ...data.settings, ...ops.settings };
        save();
      },
    };
  }

  return api;
})();

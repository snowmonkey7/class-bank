(() => {

const $ = (id) => document.getElementById(id);
let students = [];
let settings = {};
const selected = new Set();
let editingId = null;
let busy = false;

/* ---------- 密碼 ---------- */
$("logo").innerHTML = CROC_LOGO;
$("lockIc").innerHTML = icon("lock");
document.querySelectorAll("[data-ic]").forEach((el) => (el.innerHTML = icon(el.dataset.ic)));
if (sessionStorage.getItem("crocbank-teacher") === "ok") start();
$("lockForm").addEventListener("submit", (e) => {
  e.preventDefault();
  if (normDigits($("pwd").value) === TEACHER_PASSWORD) {
    sessionStorage.setItem("crocbank-teacher", "ok");
    start();
  } else {
    $("pwdError").textContent = "密碼不對，請再輸入一次";
    $("pwd").value = "";
    $("pwd").focus();
  }
});

let started = false;
async function start() {
  if (started) return;
  started = true;
  $("lockView").hidden = true;
  $("appView").hidden = false;
  buildDesignPick();
  try {
    await Store.init();
  } catch (err) {
    showFatal(err.message);
    return;
  }
  if (Store.mode === "demo") $("demoNote").hidden = false;
  Store.watchStudents((list) => {
    students = list.sort(bySeat);
    [...selected].forEach((id) => { if (!students.some((s) => s.id === id)) selected.delete(id); });
    renderPick(); renderOverview(); renderCardRows();
  });
  Store.watchSettings((s) => { settings = s; renderSettings(); });
}

/* ---------- 分頁 ---------- */
document.querySelector(".tabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tab]");
  if (!b) return;
  document.querySelectorAll(".tabs [data-tab]").forEach((t) => t.setAttribute("aria-selected", t === b));
  document.querySelectorAll("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== b.dataset.tab));
  if (b.dataset.tab === "log") renderLog();
});

/* ---------- 選學生 ---------- */
function renderPick() {
  $("pickGrid").innerHTML = students.length
    ? students.map((s) => `
      <button type="button" class="pick ${selected.has(s.id) ? "on" : ""}" data-id="${esc(s.id)}" aria-pressed="${selected.has(s.id)}">
        <span class="pk-seat">${esc(s.seat)}</span>
        <span class="pk-name">${esc(s.name)}</span>
        <span class="pk-bal">${fmt(s.balance || 0)} 張</span>
        <span class="pk-check" aria-hidden="true"></span>
      </button>`).join("")
    : `<p class="empty">還沒有銀行卡。請到「銀行卡管理」按「匯入班級名單」。</p>`;
  $("selCount").textContent = `已選 ${selected.size} 人`;
}
$("pickGrid").addEventListener("click", (e) => {
  const b = e.target.closest(".pick");
  if (!b) return;
  selected.has(b.dataset.id) ? selected.delete(b.dataset.id) : selected.add(b.dataset.id);
  renderPick();
});
$("selAll").onclick = () => { students.forEach((s) => selected.add(s.id)); renderPick(); };
$("selNone").onclick = () => { selected.clear(); renderPick(); };

function pickedStudents() {
  const list = students.filter((s) => selected.has(s.id));
  if (!list.length) toast("請先在左邊點選學生", "err");
  return list;
}

/* ---------- 共用：套用加減 ---------- */
// changes: [{ s, amount }]
async function apply(changes, reason, type) {
  if (busy || !changes.length) return false;
  busy = true;
  const batchId = Store.newBatchId();
  const ts = Date.now();
  const ops = { students: [], txs: [] };
  changes.forEach(({ s, amount }) => {
    const after = round2((s.balance || 0) + amount);
    ops.students.push({ id: s.id, data: { balance: after } });
    ops.txs.push({ cardNo: s.cardNo, name: s.name, amount: round2(amount), reason, type, balanceAfter: after, ts, batchId, undone: false });
  });
  try {
    await Store.commit(ops);
    return true;
  } catch (err) {
    alert("儲存失敗：" + err.message);
    return false;
  } finally { busy = false; }
}

// 扣款：餘額不足的人會被跳過
async function deduct(list, n, reason, type) {
  const ok = list.filter((s) => (s.balance || 0) >= n);
  const short = list.filter((s) => (s.balance || 0) < n);
  if (short.length) {
    const names = short.map((s) => `${s.name}（剩 ${fmt(s.balance || 0)}）`).join("、");
    if (!ok.length) { alert(`餘額不足，無法扣除 ${fmt(n)} 張：\n${names}`); return; }
    if (!confirm(`以下同學餘額不足，這次不會扣款：\n${names}\n\n其他 ${ok.length} 位同學繼續扣除 ${fmt(n)} 張嗎？`)) return;
  }
  if (await apply(ok.map((s) => ({ s, amount: -n })), reason, type)) {
    toast(`已扣除 ${ok.length} 位同學各 ${fmt(n)} 張`);
    return true;
  }
}

/* ---------- 新增 ---------- */
document.querySelectorAll("[data-give]").forEach((b) =>
  b.addEventListener("click", async () => {
    const list = pickedStudents();
    if (!list.length) return;
    const n = Number(b.dataset.n);
    let reason = b.dataset.give;
    if (reason === "其他" && $("otherNote").value.trim()) reason = `其他：${$("otherNote").value.trim()}`;
    if (await apply(list.map((s) => ({ s, amount: n })), reason, "add")) {
      toast(`${list.length} 位同學各 +${n} 張（${reason}）`);
      $("otherNote").value = "";
    }
  })
);

/* ---------- 扣除 ---------- */
$("deductForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const list = pickedStudents();
  if (!list.length) return;
  const n = round2($("deductN").value);
  const reason = $("deductReason").value.trim();
  if (!(n > 0) || !reason) return;
  if (await deduct(list, n, `扣除：${reason}`, "deduct")) { $("deductN").value = ""; $("deductReason").value = ""; }
});

/* ---------- 抽卡 ---------- */
function renderSettings() {
  const today = todayStr();
  if (settings.drawDate === today && settings.drawPrice != null) {
    $("drawStatus").textContent = `今天已公布：抽一次 ${fmt(settings.drawPrice)} 張`;
    $("drawCharge").disabled = false;
    $("drawCharge").textContent = `幫選到的同學抽卡扣款（每人 ${fmt(settings.drawPrice)} 張）`;
  } else {
    $("drawStatus").textContent = "今天還沒公布抽卡金額，學生端會顯示「老師還沒公布」。";
    $("drawCharge").disabled = true;
    $("drawCharge").textContent = "幫選到的同學抽卡扣款";
  }
  if (settings.lastInterestAt) {
    $("interestStatus").textContent = `上次發放：${dateTimeStr(settings.lastInterestAt)}。全班餘額增加 5%，保留到小數第二位。`;
  }
}
$("drawForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const v = $("drawPrice").value;
  if (v === "" || Number(v) < 0) return;
  await Store.commit({ settings: { drawPrice: round2(v), drawDate: todayStr() } });
  $("drawPrice").value = "";
  toast(`已公布今日抽卡金額：${fmt(v)} 張`);
});
$("drawCharge").addEventListener("click", async () => {
  const list = pickedStudents();
  if (!list.length) return;
  await deduct(list, round2(settings.drawPrice), "抽卡", "draw");
});

/* ---------- 利息 ---------- */
$("interestBtn").addEventListener("click", async () => {
  const days = settings.lastInterestAt ? (Date.now() - settings.lastInterestAt) / 86400000 : 99;
  if (days < 6 && !confirm(`上次發放利息是 ${dateTimeStr(settings.lastInterestAt)}，還不到一週。確定要再發一次嗎？`)) return;
  const list = students.filter((s) => (s.balance || 0) > 0);
  const changes = list.map((s) => ({ s, amount: round2((s.balance || 0) * 0.05) })).filter((c) => c.amount > 0);
  if (!changes.length) return toast("目前沒有人有餘額", "err");
  if (!confirm(`要幫全班 ${changes.length} 位有存款的同學發放 5% 利息嗎？`)) return;
  if (await apply(changes, "每週利息 5%", "interest")) {
    await Store.commit({ settings: { lastInterestAt: Date.now() } });
    toast(`已發放利息給 ${changes.length} 位同學`);
  }
});

/* ---------- 全班餘額 ---------- */
function renderOverview() {
  const sort = $("sortSel").value;
  const list = [...students];
  if (sort === "desc") list.sort((a, b) => (b.balance || 0) - (a.balance || 0));
  if (sort === "asc") list.sort((a, b) => (a.balance || 0) - (b.balance || 0));
  const total = round2(students.reduce((t, s) => t + (s.balance || 0), 0));
  const avg = students.length ? total / students.length : 0;
  const zero = students.filter((s) => !(s.balance > 0)).length;
  $("stats").innerHTML = `
    <div class="stat"><span class="st-num">${students.length}</span><span class="st-lbl">張銀行卡</span></div>
    <div class="stat"><span class="st-num">${fmt(total)}</span><span class="st-lbl">全班總存款（張）</span></div>
    <div class="stat"><span class="st-num">${fmt(avg)}</span><span class="st-lbl">平均每人（張）</span></div>
    <div class="stat"><span class="st-num">${zero}</span><span class="st-lbl">位同學餘額是 0</span></div>`;
  const max = Math.max(1, ...students.map((s) => s.balance || 0));
  $("overviewBody").innerHTML = list.map((s) => `<tr>
      <td>${esc(s.seat)}</td><td>${esc(s.name)}</td><td class="mono">${esc(spaceCard(s.cardNo))}</td>
      <td><span class="dtag" style="--dc:${DESIGNS[s.design]?.color}">${esc(s.design)}</span></td>
      <td class="bar-cell"><span class="bar"><span style="width:${((s.balance || 0) / max) * 100}%"></span></span></td>
      <td class="num strong">${fmt(s.balance || 0)}</td></tr>`).join("")
    || `<tr><td colspan="6" class="empty">還沒有銀行卡</td></tr>`;
}
$("sortSel").addEventListener("change", renderOverview);

/* ---------- 銀行卡管理 ---------- */
function buildDesignPick() {
  $("cfDesign").insertAdjacentHTML("beforeend", DESIGN_KEYS.map((k, i) => `
    <label class="dp"><input type="radio" name="design" value="${k}" ${i === 0 ? "checked" : ""}>
      <img src="${DESIGNS[k].img}" alt=""><span>${DESIGNS[k].label}</span></label>`).join(""));
}

function renderCardRows() {
  $("cardRows").innerHTML = students.map((s) => `
    <li class="card-row">
      <img src="${DESIGNS[s.design]?.img || ""}" alt="${esc(s.design)}">
      <div class="cr-info"><b>${esc(s.seat)} 號 ${esc(s.name)}</b><span class="mono">${esc(spaceCard(s.cardNo))}</span></div>
      <span class="cr-bal">${fmt(s.balance || 0)} 張</span>
      <button type="button" class="btn btn-soft sm" data-edit="${esc(s.id)}">修改</button>
      <button type="button" class="btn btn-soft sm danger" data-del="${esc(s.id)}">刪除</button>
    </li>`).join("") || `<li class="empty">還沒有銀行卡</li>`;
}

$("cardRows").addEventListener("click", async (e) => {
  const ed = e.target.closest("[data-edit]");
  const del = e.target.closest("[data-del]");
  if (ed) {
    const s = students.find((x) => x.id === ed.dataset.edit);
    editingId = s.id;
    $("cfSeat").value = s.seat; $("cfName").value = s.name; $("cfNo").value = s.cardNo; $("cfNo").disabled = true;
    $("cfBal").value = s.balance || 0;
    document.querySelector(`#cfDesign input[value="${s.design}"]`).checked = true;
    $("cardFormTitle").textContent = `修改 ${s.name} 的銀行卡`;
    $("cfSubmit").textContent = "儲存修改";
    $("cfCancel").hidden = false;
    $("cfName").focus();
  }
  if (del) {
    const s = students.find((x) => x.id === del.dataset.del);
    if (!confirm(`確定要刪除 ${s.name} 的銀行卡嗎？（餘額 ${fmt(s.balance || 0)} 張，舊紀錄會保留在備份裡）`)) return;
    await Store.commit({ deleteStudents: [s.id] });
    toast(`已刪除 ${s.name} 的銀行卡`);
  }
});

function resetCardForm() {
  editingId = null;
  $("cardForm").reset();
  $("cfNo").disabled = false;
  $("cardFormTitle").textContent = "新增銀行卡";
  $("cfSubmit").textContent = "新增銀行卡";
  $("cfCancel").hidden = true;
}
$("cfCancel").onclick = resetCardForm;

$("cardForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const seat = Number($("cfSeat").value);
  const name = $("cfName").value.trim();
  const cardNo = $("cfNo").value.trim();
  const balance = round2($("cfBal").value || 0);
  const design = document.querySelector("#cfDesign input:checked").value;
  if (balance < 0) return alert("餘額不能小於 0");
  const ts = Date.now();

  if (editingId) {
    const s = students.find((x) => x.id === editingId);
    const ops = { students: [{ id: s.id, data: { seat, name, design, balance } }], txs: [] };
    const diff = round2(balance - (s.balance || 0));
    if (diff !== 0) ops.txs.push({ cardNo: s.cardNo, name, amount: diff, reason: "老師修正餘額", type: "edit", balanceAfter: balance, ts, batchId: Store.newBatchId(), undone: false });
    await Store.commit(ops);
    toast(`已儲存 ${name} 的銀行卡`);
    resetCardForm();
    return;
  }
  if (!/^\d{8}$/.test(cardNo)) return alert("卡號要是 8 位數字");
  if (students.some((s) => s.cardNo === cardNo)) return alert("這個卡號已經有人用了");
  const ops = { students: [{ id: cardNo, data: { seat, name, cardNo, design, balance, createdAt: ts } }], txs: [] };
  if (balance > 0) ops.txs.push({ cardNo, name, amount: balance, reason: "開戶存入", type: "open", balanceAfter: balance, ts, batchId: Store.newBatchId(), undone: false });
  await Store.commit(ops);
  toast(`已新增 ${name} 的銀行卡`);
  resetCardForm();
});

$("importRoster").addEventListener("click", async () => {
  const missing = ROSTER.filter(([, , no]) => !students.some((s) => s.cardNo === no));
  if (!missing.length) return toast("名單上的同學都已經有銀行卡了");
  if (!confirm(`要新增 ${missing.length} 張銀行卡嗎？（餘額先設為 0，之後可在「修改」調整）`)) return;
  const ts = Date.now();
  await Store.commit({ students: missing.map(([seat, name, cardNo, design]) => ({ id: cardNo, data: { seat, name, cardNo, design, balance: 0, createdAt: ts } })) });
  toast(`已匯入 ${missing.length} 張銀行卡`);
});

/* ---------- 紀錄、復原、匯出 ---------- */
const TYPE_LABEL = { add: "新增", deduct: "扣除", draw: "抽卡", interest: "利息", open: "開戶", edit: "修正" };
let recent = [];

async function renderLog() {
  $("logBody").innerHTML = `<tr><td colspan="5" class="empty">讀取中…</td></tr>`;
  recent = await Store.getRecentTx(150);
  $("logBody").innerHTML = recent.map((t) => `<tr class="${t.undone ? "undone" : ""}">
      <td>${dateTimeStr(t.ts)}</td><td>${esc(t.name)}</td>
      <td>${esc(t.reason)}${t.undone ? "（已復原）" : ""}</td>
      <td class="num ${t.amount >= 0 ? "in" : "out"}">${t.amount > 0 ? "+" : ""}${fmt(t.amount)}</td>
      <td class="num">${fmt(t.balanceAfter)}</td></tr>`).join("")
    || `<tr><td colspan="5" class="empty">還沒有紀錄</td></tr>`;
}

$("undoBtn").addEventListener("click", async () => {
  const txs = await Store.getRecentTx(200);
  const last = txs.find((t) => !t.undone && ["add", "deduct", "draw", "interest"].includes(t.type));
  if (!last) return toast("沒有可以復原的操作", "err");
  const group = txs.filter((t) => t.batchId === last.batchId && !t.undone);
  const who = group.length > 3 ? `${group.slice(0, 3).map((t) => t.name).join("、")} 等 ${group.length} 人` : group.map((t) => t.name).join("、");
  if (!confirm(`要復原這筆操作嗎？\n${dateTimeStr(last.ts)}　${last.reason}　${last.amount > 0 ? "+" : ""}${fmt(last.amount)} 張\n對象：${who}`)) return;
  const ops = { students: [], txUpdates: [] };
  group.forEach((t) => {
    const s = students.find((x) => x.cardNo === t.cardNo);
    if (s) ops.students.push({ id: s.id, data: { balance: round2((s.balance || 0) - t.amount) } });
    ops.txUpdates.push({ id: t.id, data: { undone: true } });
  });
  if (last.type === "interest") ops.settings = { lastInterestAt: null };
  await Store.commit(ops);
  toast("已復原上一筆操作");
  renderLog();
});

function download(name, rows) {
  const csv = "﻿" + rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
$("exportBal").addEventListener("click", () => {
  download(`一班銀行_全班餘額_${todayStr()}.csv`, [["座號", "姓名", "卡號", "圖案", "餘額"],
    ...students.map((s) => [s.seat, s.name, `'${s.cardNo}`, s.design, fmt(s.balance || 0)])]);
});
$("exportTx").addEventListener("click", async () => {
  const all = await Store.getAllTx();
  download(`一班銀行_所有紀錄_${todayStr()}.csv`, [["時間", "姓名", "卡號", "類別", "摘要", "張數", "餘額", "已復原"],
    ...all.map((t) => [new Date(t.ts).toLocaleString("zh-TW"), t.name, `'${t.cardNo}`, TYPE_LABEL[t.type] || t.type, t.reason, fmt(t.amount), fmt(t.balanceAfter), t.undone ? "是" : ""])]);
});

})();

// 共用設定與小工具

const TEACHER_PASSWORD = "0424";

// 四款卡片圖案
const DESIGNS = {
  "小小正": { label: "小小正銀行卡", img: "images/xiao-xiao-zheng.jpg", color: "#3C8DCB" },
  "王小正": { label: "王小正銀行卡", img: "images/wang-xiao-zheng.jpg", color: "#E0A526" },
  "王阿凱": { label: "王阿凱銀行卡", img: "images/wang-a-kai.jpg", color: "#4E9A5B" },
  "正小凱": { label: "正小凱銀行卡", img: "images/zheng-xiao-kai.jpg", color: "#C27A3A" },
};
const DESIGN_KEYS = Object.keys(DESIGNS);

// 班級名單（座號、姓名、卡號、圖案），教師端可一鍵匯入
const ROSTER = [
  [1, "張大程", "00010168", "王阿凱"],
  [2, "張彥翰", "00008888", "王小正"],
  [3, "郜宇顓", "00501601", "正小凱"],
  [5, "賴寬典", "00050188", "王小正"],
  [6, "李睿洋", "00000001", "王小正"],
  [7, "方廷睿", "16816888", "小小正"],
  [8, "曾程宥", "00666168", "王小正"],
  [11, "廖志穎", "16888888", "王小正"],
  [12, "林宸頤", "00000666", "正小凱"],
  [14, "許元禎", "01680501", "王阿凱"],
  [15, "周宥廷", "16800168", "王阿凱"],
  [16, "林妡柔", "00050168", "王小正"],
  [18, "吳佳萓", "00000168", "正小凱"],
  [19, "梁永秀", "00501168", "王小正"],
  [20, "傅晨溱", "00000888", "小小正"],
  [21, "陳品璇", "00666888", "王阿凱"],
];

// 鱷魚卡保留到小數第二位
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function fmt(n) {
  const v = round2(n);
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0$/, "");
}

function maskCard(no) {
  return `${no.slice(0, 4)} ••••`;
}
function spaceCard(no) {
  return `${no.slice(0, 4)} ${no.slice(4)}`;
}

function todayStr(d = new Date()) {
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function dateTimeStr(ts) {
  const d = new Date(ts);
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function dateStr(ts) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function bySeat(a, b) {
  return (Number(a.seat) || 999) - (Number(b.seat) || 999);
}

function toast(msg, kind = "ok") {
  let box = document.getElementById("toast");
  if (!box) {
    box = document.createElement("div");
    box.id = "toast";
    box.setAttribute("role", "status");
    document.body.appendChild(box);
  }
  box.textContent = msg;
  box.className = `show ${kind}`;
  clearTimeout(box._t);
  box._t = setTimeout(() => (box.className = ""), 2600);
}

// 數字全形轉半形、去空白（避免平板輸入法打出全形數字）
function normDigits(s) {
  return String(s ?? "").replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/\s/g, "");
}

// 原創小鱷魚標誌
const CROC_LOGO = `<svg class="croc-logo" viewBox="0 0 72 56" aria-hidden="true">
  <circle cx="22" cy="16" r="11" fill="#43A66C"/><circle cx="46" cy="16" r="11" fill="#43A66C"/>
  <rect x="4" y="16" width="64" height="34" rx="17" fill="#43A66C"/>
  <rect x="4" y="30" width="64" height="20" rx="10" fill="#7CC69A"/>
  <circle cx="22" cy="15" r="6.5" fill="#fff"/><circle cx="23.5" cy="15.5" r="3.2" fill="#1E2B45"/>
  <circle cx="46" cy="15" r="6.5" fill="#fff"/><circle cx="47.5" cy="15.5" r="3.2" fill="#1E2B45"/>
  <circle cx="55" cy="25" r="1.8" fill="#24663F"/><circle cx="61" cy="25" r="1.8" fill="#24663F"/>
  <circle cx="14" cy="33" r="3.5" fill="#F7A3B5" opacity=".8"/>
  <path d="M12 38 Q36 44 64 35" stroke="#24663F" stroke-width="2.6" fill="none" stroke-linecap="round"/>
  <path d="M20 39.6 l2.6 4.4 l2.6-3.9z M31 41 l2.6 4.4 l2.6-4.3z M42 40.6 l2.6 4.3 l2.6-4.6z M53 38.4 l2.6 4.2 l2.6-5z" fill="#fff"/>
</svg>`;

// 線條圖示（Lucide 風格）
const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15v3M12 10v8M17 6v12"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
  dice: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  sprout: '<path d="M7 20h10M12 20V10"/><path d="M12 10C12 6 9 4 5 4c0 4 3 6 7 6zM12 10c0-3 2.5-5 6-5 0 3.5-2.5 5-6 5z"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
  hand: '<path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.4l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2"/>',
};
function icon(name, cls = "") {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
}

// 嚴重錯誤：畫面上方顯示紅色說明
function showFatal(msg) {
  let el = document.getElementById("fatal");
  if (!el) {
    el = document.createElement("div");
    el.id = "fatal";
    el.setAttribute("role", "alert");
    document.body.prepend(el);
  }
  el.innerHTML = msg;
}

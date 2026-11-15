(() => {
  let students = [];
  let current = null;
  let pin = "";
  let idleTimer;
  const $ = (id) => document.getElementById(id);

  $("logo").innerHTML = CROC_LOGO;
  $("backIc").innerHTML = icon("back");

  // 通用卡面（不透露圖案）
  function cardFace(s, cls = "") {
    return `<span class="bank-card ${cls}">
      <span class="bc-top"><span class="bc-bank">一班銀行</span><span class="bc-chip"></span></span>
      <span class="bc-name">${esc(s.name)}</span>
      <span class="bc-bottom"><span class="bc-no">${esc(maskCard(s.cardNo))}</span><span class="bc-seat">${esc(s.seat)} 號</span></span>
    </span>`;
  }

  async function boot() {
    try {
      await Store.init();
    } catch (err) {
      showFatal(err.message);
      $("cardList").innerHTML = "";
      return;
    }
    if (Store.mode === "demo") $("demoNote").hidden = false;

    Store.watchSettings((s) => {
      const d = new Date();
      const wd = "日一二三四五六"[d.getDay()];
      $("drawDate").textContent = `${d.getMonth() + 1} 月 ${d.getDate()} 日・星期${wd}`;
      const ready = s.drawDate === todayStr() && s.drawPrice != null;
      $("drawPrice").textContent = ready ? fmt(s.drawPrice) : "?";
      $("coin").classList.toggle("waiting", !ready);
      $("drawSub").textContent = ready ? "抽一次卡要付的鱷魚卡張數" : "老師還沒公布今天的金額";
    });

    Store.watchStudents((list) => {
      students = list.sort(bySeat);
      const box = $("cardList");
      if (!students.length) {
        box.innerHTML = `<p class="empty">還沒有銀行卡，請老師到教師端新增。</p>`;
        return;
      }
      box.innerHTML = students.map((s) =>
        `<button type="button" class="card-btn" data-id="${esc(s.id)}" aria-label="${esc(s.seat)} 號 ${esc(s.name)} 的銀行卡">${cardFace(s)}</button>`
      ).join("");
      if (current && $("cardDialog").open) {
        const fresh = students.find((s) => s.id === current.id);
        if (fresh) { current = fresh; renderCard(false); }
      }
    });
  }

  $("cardList").addEventListener("click", (e) => {
    const btn = e.target.closest(".card-btn");
    if (!btn) return;
    current = students.find((s) => s.id === btn.dataset.id);
    pin = "";
    $("pinCard").innerHTML = cardFace(current, "small") + `<span id="pinName" class="sr-only">${esc(current.name)} 的銀行卡</span>`;
    $("pinError").textContent = "";
    drawDots();
    $("pinDialog").showModal();
  });

  function press(k) {
    if (k === "close") return $("pinDialog").close();
    if (k === "back") { pin = pin.slice(0, -1); return drawDots(); }
    if (pin.length >= 4) return;
    pin += k;
    $("pinError").textContent = "";
    drawDots();
    if (pin.length === 4) setTimeout(checkPin, 150);
  }
  $("keypad").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b) press(b.dataset.k || b.textContent);
  });
  document.addEventListener("keydown", (e) => {
    if (!$("pinDialog").open) return;
    const k = normDigits(e.key);
    if (/^\d$/.test(k)) press(k);
    else if (e.key === "Backspace") press("back");
  });

  function drawDots() {
    [...$("pinDots").children].forEach((el, i) => el.classList.toggle("on", i < pin.length));
  }

  function checkPin() {
    if (pin === current.cardNo.slice(-4)) {
      $("pinDialog").close();
      openCard();
    } else {
      pin = "";
      drawDots();
      $("pinError").textContent = "後四碼不對，再試一次";
      const dots = $("pinDots");
      dots.classList.remove("shake"); void dots.offsetWidth; dots.classList.add("shake");
    }
  }

  async function openCard() {
    renderCard(true);
    $("cvLedger").innerHTML = `<li class="empty">讀取中…</li>`;
    $("cardDialog").showModal();
    resetIdle();
    // 翻牌：先看到卡背，再翻到卡片圖案
    const flip = $("flip");
    flip.classList.remove("open");
    requestAnimationFrame(() => setTimeout(() => flip.classList.add("open"), 250));

    const txs = (await Store.getStudentTx(current.cardNo)).filter((t) => !t.undone);
    $("cvLedger").innerHTML = txs.length
      ? txs.map((t) => {
          const up = t.amount >= 0;
          return `<li class="entry ${up ? "up" : "down"}">
            <span class="en-ic">${icon(up ? "plus" : "minus")}</span>
            <span class="en-main"><span class="en-reason">${esc(t.reason)}</span><span class="en-date">${dateTimeStr(t.ts)}</span></span>
            <span class="en-amt">${up ? "+" : "−"}${fmt(Math.abs(t.amount))}</span>
            <span class="en-bal">餘 ${fmt(t.balanceAfter)}</span>
          </li>`;
        }).join("")
      : `<li class="empty">還沒有紀錄，加油賺第一張鱷魚卡！</li>`;
  }

  function renderCard(animate) {
    const d = DESIGNS[current.design] || DESIGNS["小小正"];
    $("cvBack").innerHTML = cardFace(current, "big");
    $("cvImg").src = d.img;
    $("cvImg").alt = d.label;
    $("cvNo").textContent = spaceCard(current.cardNo);
    $("cvName").textContent = `${current.seat} 號 ${current.name}`;
    $("cvSub").textContent = d.label;
    const target = round2(current.balance || 0);
    const el = $("cvBalance");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!animate || reduce || target === 0) { el.textContent = fmt(target); return; }
    const t0 = performance.now(), dur = 900;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = p < 1 ? fmt(Math.round(target * eased * 100) / 100) : fmt(target);
      if (p < 1) requestAnimationFrame(step);
    };
    el.textContent = "0";
    setTimeout(() => requestAnimationFrame(step), 450);
  }

  function closeCard() { $("cardDialog").close(); current = null; clearTimeout(idleTimer); }
  $("closeCard").addEventListener("click", closeCard);
  $("cardDialog").addEventListener("cancel", () => { current = null; clearTimeout(idleTimer); });

  // 共用平板：90 秒沒動作就自動回到名單
  function resetIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if ($("cardDialog").open) closeCard(); }, 90000);
  }
  ["pointerdown", "scroll", "keydown"].forEach((ev) => $("cardDialog").addEventListener(ev, resetIdle, true));

  boot();
})();

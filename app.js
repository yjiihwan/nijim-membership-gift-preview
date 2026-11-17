(function () {
  const E = window.GiftEngine, S = window.GiftSeed, TODAY = S.TODAY;
  const qs = new URLSearchParams(location.search);
  const GIFT_ON = qs.get("gift") !== "0"; // ?gift=0 = 수정 전 화면(증정 기능 없음) 대조용
  const KEY = GIFT_ON ? "mg_state_v1" : "mg_state_before_v1";
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const won = (n) => Number(n).toLocaleString("ko-KR");
  const ME = "u1";

  let st = load();
  let view = qs.get("v") || "admin";
  let open = {}; // 관리자 증정 칸 펼침 상태
  let done = null; // 결제 완료 화면 데이터
  // 옵션선택·결제진행에서 고른 상품 (주소 ?buy=p_pt_event:e12&start=2026-11-27 로 바로 열 수 있음)
  let cart = { key: qs.get("buy") || "p_pt_event:e12", start: qs.get("start") || S.START, extras: {} };

  function fresh(exist) { return { exist, data: S.seed({ withGifts: GIFT_ON, withExistingHealth: exist }) }; }
  function load() {
    if (qs.has("reset")) return fresh(qs.get("exist") !== "0");
    try { const v = JSON.parse(localStorage.getItem(KEY)); if (v && v.data) return v; } catch (e) {}
    return fresh(qs.get("exist") !== "0");
  }
  const save = () => localStorage.setItem(KEY, JSON.stringify(st));
  const D = () => st.data;
  const prod = (id) => D().products.find((p) => p.id === id);

  function toast(t) { const d = document.createElement("div"); d.className = "saved"; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 1600); }

  // ───────── 관리자 판매설정 ─────────
  const USE_KO = { unlimited: "무제한", period: "기간내", daily: "하루", weekly: "주", monthly: "월" };
  const PAY_KO = { sub: "구독결제", contract: "약정구독결제", normal: "일반결제" };
  const rd = (on, t) => `<span class="rd ${on ? "on" : ""}"><i></i>${t}</span>`;

  function giftSummary(p, o) {
    const res = E.resolveGifts(D().products, p, o);
    if (!res.length) return "";
    return res.map((r) => (r.error ? "⚠️ 설정 확인 필요" : `${r.label}${r.gift.periodMode === "same" ? "(구매 기간과 동일)" : ""} · ${r.choice.label}`)).join(" / ");
  }

  function giftPanel(p, o) {
    if (!GIFT_ON) return "";
    const key = `${p.id}:${o.id}`;
    if (!E.canGift(p)) {
      return `<div class="gf dis"><div class="gf-h"><button class="sw" disabled></button><span class="t">🎁 구매 시 멤버십 증정</span>
        <span class="sum muted">${PAY_KO[p.payType]}는 자동 증정 추후 지원 — 지금은 회원상세 «수동 증정»을 써 주세요</span></div></div>`;
    }
    const on = o.gifts.length > 0;
    const isOpen = open[key] ?? false;
    const others = D().products.filter((x) => x.id !== p.id);
    const items = o.gifts.map((g, i) => {
      const t = prod(g.targetProductId);
      const ch = t ? E.resolveChoice(t, g.usageKey) : null;
      const samePer = `${o.period}${o.unit}`;
      const val = t && ch ? `${t.id}|${ch.key}` : "";
      // 증정할 멤버십 목록 = (멤버십 · 그 멤버십 가격 줄에 걸린 이용횟수). 이용횟수는 여기서 새로 정할 수 없다.
      const opts = others.flatMap((x) => E.usageChoices(x).map((c) => {
        const nm = `${E.productLabel(x)}${E.productLabel(x) === x.category ? "" : ` (${x.category})`}${x.visible ? "" : " · 감춤"}`;
        return `<option value="${x.id}|${c.key}" ${`${x.id}|${c.key}` === val ? "selected" : ""}>${esc(nm)} — 이용횟수 ${esc(c.label)}</option>`;
      })).join("");
      return `<div class="gi" data-gi="${i}">
        ${o.gifts.length > 1 ? `<button class="del" data-act="gdel" data-k="${key}" data-i="${i}">삭제 ✕</button>` : ""}
        <div class="row"><span class="k">증정할 멤버십</span>
          <select class="tgt" data-act="gtgt" data-k="${key}" data-i="${i}">
            <option value="">선택하세요</option>${opts}
          </select>${t ? "" : `<span class="err">증정할 멤버십을 고르세요</span>`}${t && !ch ? `<span class="err">이용횟수가 바뀌었어요 — 다시 고르세요</span>` : ""}</div>
        <div class="row"><span class="k">이용횟수</span>
          ${ch ? `<span class="lim-ro">${esc(ch.label)}</span><span class="note">${esc(E.productLabel(t))} 판매설정 그대로 · 여기서 바꿀 수 없어요</span>` : `<span class="note">증정할 멤버십을 고르면 그 멤버십의 이용횟수가 그대로 들어가요</span>`}</div>
        <div class="row"><span class="k">증정 기간</span>
          <label><input type="radio" name="pm_${key}_${i}" data-act="gpm" data-k="${key}" data-i="${i}" value="same" ${g.periodMode === "same" ? "checked" : ""}> 구매 상품 기간과 동일 (${samePer})</label>
          <label><input type="radio" name="pm_${key}_${i}" data-act="gpm" data-k="${key}" data-i="${i}" value="custom" ${g.periodMode === "custom" ? "checked" : ""}> 직접 입력</label>
          <input type="number" min="1" value="${esc(g.periodValue || 1)}" data-act="gpv" data-k="${key}" data-i="${i}" ${g.periodMode === "custom" ? "" : "disabled"}>
          <select data-act="gpu" data-k="${key}" data-i="${i}" ${g.periodMode === "custom" ? "" : "disabled"}>
            <option ${g.periodUnit === "일" ? "selected" : ""}>일</option><option ${g.periodUnit !== "일" ? "selected" : ""}>개월</option></select></div>
      </div>`;
    }).join("");
    return `<div class="gf ${on ? "" : "off"}" data-gf="${key}">
      <div class="gf-h"><button class="sw ${on ? "on" : ""}" data-act="gsw" data-k="${key}" aria-label="구매 시 멤버십 증정"></button>
        <span class="t">🎁 구매 시 멤버십 증정</span>
        <span class="sum ${on ? "" : "muted"}">${on ? esc(giftSummary(p, o)) : "꺼짐"}</span>
        ${on ? `<button class="tg" data-act="gtog" data-k="${key}">${isOpen ? "접기 ▴" : "설정 ▾"}</button>` : ""}</div>
      ${on && isOpen ? `<div class="gf-b">${items}<button class="gadd" data-act="gadd" data-k="${key}" ${o.gifts.length >= 3 ? "disabled" : ""}>+ 증정 멤버십 추가 (최대 3개)</button></div>` : ""}
    </div>`;
  }

  function adminView() {
    const blocks = D().products.map((p, bi) => `
      <section class="blk">
        <div class="blk-h">☰ 입장이용 멤버십 ${bi + 1} <span class="x">✕</span></div>
        <div class="grid2">
          <div class="fld"><span class="lb">멤버십 종목 선택</span><div class="box">${esc(p.category)} <span>⌄</span></div></div>
          <div class="fld w"><span class="lb">멤버십 이름 개별 설정(선택)</span><div class="box">${esc(p.name)}</div></div>
        </div>
        <div class="sec"><span class="lb red">온라인판매 노출 여부 선택(admin only)</span><div class="radios">${rd(p.visible, "노출")}${rd(!p.visible, "감추기")}</div></div>
        <div class="sec"><span class="lb">그룹멤버십(여러명 사용가능) 여부 선택</span><div class="radios">${rd(p.group, "그룹멤버십")}${rd(!p.group, "1인멤버십")}</div></div>
        <div class="sec"><span class="lb">이용가능시간 제한 여부 선택</span><div class="radios">${rd(!p.timeLimit, "없음")}${rd(p.timeLimit, "제한")}</div></div>
        <div class="sec"><div class="lb b">멤버십 기간, 이용횟수, 가격설정</div><div class="lb" style="margin-top:8px">결제방식 선택</div>
          <div class="radios">${rd(p.payType === "sub", "구독결제")}${rd(p.payType === "contract", "약정구독결제")}${rd(p.payType === "normal", "일반결제")}</div></div>
        ${p.options.map((o) => `
          <div class="prow" data-row="${p.id}:${o.id}">
            <div class="pline"><span class="hd">☰</span><span class="inp w-per">${o.period}</span><span class="inp sel w-unit">${o.unit}</span>
              <span class="inp sel w-use">${USE_KO[o.usage]}</span><span class="inp w-cnt">${o.usage === "unlimited" ? "-" : o.count}</span><span class="unit">회 이용 가능</span></div>
            <div class="pline b2"><span class="inp w-pr strike">${won(o.listPrice)}</span><span class="unit">원</span><span class="inp w-pr">${won(o.price)}</span><span class="unit">원</span><span class="xx">✕</span></div>
            ${giftPanel(p, o)}
          </div>`).join("")}
      </section>`).join("");
    return `<div class="adm"><h2>멤버십 판매 설정(필수)</h2><p class="desc">판매할 센터 멤버십 종류 및 가격 설정을 합니다. 최소 1개 이상의 멤버십 정보를 입력해주세요.</p>${blocks}</div>`;
  }

  function findOpt(key) { const [pid, oid] = key.split(":"); const p = prod(pid); return { p, o: p.options.find((x) => x.id === oid) }; }
  function onAdmin(e) {
    const el = e.target.closest("[data-act]"); if (!el) return;
    const act = el.dataset.act, key = el.dataset.k, i = Number(el.dataset.i);
    if (!key) return;
    const { p, o } = findOpt(key);
    const g = o.gifts[i];
    if (e.type === "click") {
      if (act === "gsw") {
        if (o.gifts.length) o.gifts = [];
        else { const t = D().products.find((x) => x.id !== p.id && x.category !== p.category) || D().products.find((x) => x.id !== p.id);
          o.gifts = [{ targetProductId: t ? t.id : "", periodMode: "same", periodValue: 1, periodUnit: "개월", usageKey: t ? E.usageChoices(t)[0]?.key : "" }]; open[key] = true; }
      } else if (act === "gtog") open[key] = !open[key];
      else if (act === "gadd" && o.gifts.length < 3) o.gifts.push({ targetProductId: "", periodMode: "same", periodValue: 1, periodUnit: "개월", usageKey: "" });
      else if (act === "gdel") o.gifts.splice(i, 1);
      else return;
    } else {
      if (act === "gtgt") { const [tid, uk] = el.value.split("|"); g.targetProductId = tid || ""; g.usageKey = uk || ""; }
      else if (act === "gpm") g.periodMode = el.value;
      else if (act === "gpv") g.periodValue = Math.max(1, Number(el.value) || 1);
      else if (act === "gpu") g.periodUnit = el.value;
      else return;
    }
    save(); setTimeout(render); // change→재그리기가 blur 중에 노드를 지우면 오류가 나서 한 박자 늦춘다
  }

  // ───────── 고객 구매 ─────────
  function giftCardLabel(p, o) {
    const res = E.resolveGifts(D().products, p, o).filter((r) => !r.error);
    if (!res.length) return "";
    const first = `${res[0].target.category} ${E.periodLabel(res[0].per.n, res[0].per.unit)}`;
    return res.length > 1 ? `${first} 외 ${res.length - 1}` : first;
  }
  function cardHead(p, o) {
    if (o.usage === "period") return [`${o.count}회`, `${o.period}${o.unit}`];
    return [`${o.period}${o.unit}`, `${E.usageLabel(o)} 이용`];
  }
  function cardBody(o) {
    const ev = o.listPrice > o.price;
    let per = "";
    if (o.usage === "period" && o.count > 1) per = `회당 ${won(Math.round(o.price / o.count / 100) * 100)}원`;
    else if (o.unit === "개월" && o.period > 1) per = `월 ${won(Math.round(o.price / o.period))}원`;
    if (!ev && !per) return `<span class="one">${won(o.price)}원</span>`;
    return `${ev ? `<span class="lp">${won(o.listPrice)}원</span>` : ""}<span class="p">${won(o.price)}원</span>${per ? `<span class="big">${per}</span>` : ""}`;
  }
  const NOTICE = {
    p_health: "🎁헬스 2, 5개월 11월 특별상품<br>🎁헬스 6개월, 1년 할인 이벤트!",
    p_pt_event: "⭐1개월 회원권=신규 전용<br>⭐12, 22, 32, 42회 회원권=신규&재등록",
    p_pt: "🔥언제든 레슨 받을 수 있는 기간 제한 없는 PT🔥",
  };
  function shopView() {
    const secs = D().products.filter((p) => p.visible).map((p) => {
      const anyGift = GIFT_ON && p.options.some((o) => giftCardLabel(p, o));
      const cards = p.options.map((o) => {
        const [h1, h2] = cardHead(p, o), ev = o.listPrice > o.price, gl = GIFT_ON ? giftCardLabel(p, o) : "";
        return `<div class="card ${ev ? "ev" : ""}" data-buy="${p.id}:${o.id}">
          ${ev ? `<span class="ebadge">이벤트<br>할인가</span>` : ""}
          <div class="c1">${h1}</div><div class="c2">${h2}</div><div class="c3">${cardBody(o)}</div>
          ${anyGift ? (gl ? `<div class="gift">🎁<span>${esc(gl)} 증정</span></div>` : `<div class="gift empty"></div>`) : ""}
        </div>`;
      }).join("");
      return `<h4>${esc(E.productLabel(p))}</h4><div class="cards">${cards}</div>${NOTICE[p.id] ? `<div class="notice">${NOTICE[p.id]}</div>` : ""}`;
    }).join("");
    return `<div class="phone shop"><div class="ph-top"><span class="bk">‹</span>${esc(S.CENTER)}</div>
      <div class="ins"><i></i>최대 <b>7개월</b> 무이자 할부</div><h3>멤버십 구매</h3>${secs}<div style="height:40px"></div></div>`;
  }

  // ───────── 실결제 화면 재현: 옵션선택 → 결제진행 (형 캡처 구조 그대로, 증정 줄만 끼워 넣음) ─────────
  const ICON_TAG = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="8" cy="8" r="1.4" fill="currentColor"/></svg>`;
  const ICON_GIFT = (w = 13, sw = 2.4) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"><rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v8h14v-8M12 8v13M12 8S10.5 3 7.5 3.8C5.6 4.3 6.5 8 12 8zm0 0s1.5-5 4.5-4.2C18.4 4.3 17.5 8 12 8z"/></svg>`;
  const ICON_LOCK = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M7 10V8a5 5 0 0 1 10 0v2h1.5a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1zm2.5 0h5V8a2.5 2.5 0 0 0-5 0z"/></svg>`;
  const nw = (t) => `<span class="nw">${t}</span>`; // 이용횟수·금액 같은 짧은 표기는 중간에서 안 끊기게

  function checkout(key) {
    const { p, o } = findOpt(key);
    const start = cart.start || S.START;
    const months = o.unit === "개월" ? Number(o.period) : 1;
    const extras = S.EXTRAS.map((x) => ({ ...x, on: !!cart.extras[x.id], price: x.monthly * months }));
    const extraSum = extras.filter((x) => x.on).reduce((a, x) => a + x.price, 0);
    const list = Number(o.listPrice) + extraSum, sale = Number(o.price) + extraSum, disc = list - sale;
    const gifts = GIFT_ON ? E.previewGifts(D(), ME, p, o, start) : [];
    return { p, o, start, end: E.endOf(start, o.period, o.unit), extras, list, sale, disc, pct: Math.floor((disc / list) * 100),
      point: Math.round(sale * S.POINT_RATE), gifts };
  }
  const giftName = (g) => E.productLabel(g.target);
  const giftShort = (g) => `${g.target.category} ${E.periodLabel(g.per.n, g.per.unit)}`; // 혜택 줄은 종목명(D4)

  function rxHead(title) {
    return `${qs.has("clean") ? `<div class="sb"><b>1:12</b><span>▮▮▮▮ LTE ▭</span></div>` : ""}<div class="rx-hd"><span class="rx-bk" data-go="${title === "옵션선택" ? "shop" : "opt"}"></span><h1>${title}</h1></div>`;
  }
  function rxBar(c, label, btn, act) {
    return `<div class="rx-bar">
      ${c.disc > 0 ? `<div class="b1"><s>${won(c.list)}원</s><span class="pill">${won(c.disc)}원 할인 · ${c.pct}%↓</span></div>` : ""}
      <div class="b2"><span class="${label === "합계총액" ? "pk" : ""}">${label}</span><b>${won(c.sale)}<small>원</small></b></div>
      <div class="b3"><i>P<sup>+</sup></i>결제하면 <b>${won(c.point)}P</b> 적립돼요</div>
      <button class="rx-btn" ${act}>${btn}</button></div>`;
  }

  function optView() {
    const c = checkout(cart.key);
    const { p, o } = c;
    const gifts = c.gifts.map((g) => `<div class="rx-row gift" data-gift="${g.target.id}">
        <span class="ic g">${ICON_GIFT()}</span>
        <div class="gx"><div class="g1"><span class="gt">함께 드려요</span> · <span class="gn">${esc(giftName(g))} ${nw(E.periodLabel(g.per.n, g.per.unit) + " ·")}</span> ${nw(`<span class="lim">${esc(g.choice.label)}</span>`)}</div>
          <div class="g2">${g.start} ~ ${g.end}</div>
          ${g.chained ? `<div class="g2 ch">보유 중인 ${esc(g.target.category)}(~${g.after})이 끝난 다음 날부터 시작해요</div>` : ""}
          <div class="lock">${ICON_LOCK}결제하면 자동으로 함께 들어가요 · 뺄 수 없어요</div></div>
        <span class="z">0원</span></div>`).join("");
    const ex = c.extras.map((x, i) => `<div class="rx-ex ${i ? "bt" : ""}">
        <label class="h"><input type="checkbox" data-extra="${x.id}" ${x.on ? "checked" : ""}><i></i><span class="n">${x.name}</span><span class="s">${x.on ? "선택함" : "선택 안 함"}</span></label>
        <div class="obox"><span>${o.period}${o.unit} · 멤버십과 동일</span><span>${won(x.price)}원</span></div>
        <div class="lock">${ICON_LOCK}멤버십 기간과 같은 기간만 선택할 수 있어요</div></div>`).join("");
    const nOn = c.extras.filter((x) => x.on).length;
    return `<div class="phone rx">${rxHead("옵션선택")}<div class="rx-body">
      <div class="rx-row ms"><span class="k">멤버십</span>
        <span class="v"><span class="nm">${esc(E.productLabel(p))}</span>${GIFT_ON ? `<span class="lim">${nw(esc(E.usageLabel(o)))}</span>` : ""}</span>
        <span class="pr">${o.listPrice > o.price ? `<s>${won(o.listPrice)}원</s>` : ""}<b>${won(o.price)}원</b></span></div>
      ${o.listPrice > o.price ? `<div class="rx-row ev"><span class="ic t">${ICON_TAG}</span><span class="et">이벤트 할인</span><span class="pill">${won(o.listPrice - o.price)}원 할인 · ${Math.floor(((o.listPrice - o.price) / o.listPrice) * 100)}%↓</span></div>` : ""}
      ${gifts}
      <div class="rx-row"><span class="k">이용기간</span><span class="v d">${c.start} ~ ${c.end}</span></div>
      <div class="rx-exh"><b>기타옵션 ${c.extras.length}</b><span>${nOn ? `${nOn}개 선택` : "선택 안 함"}</span></div>
      <p class="rx-exd">체크해서 옵션을 넣거나 뺄 수 있어요</p>
      ${ex}
    </div>${rxBar(c, "합계총액", "선택완료", `data-go="pay"`)}</div>`;
  }

  function payView() {
    const c = checkout(cart.key);
    const { p, o } = c;
    const title = `${E.productLabel(p)} ${o.period}${o.unit}`;
    const ticketGifts = c.gifts.map((g) => `<div class="tg">${ICON_GIFT(13)}<span>${esc(giftName(g))} ${nw(E.periodLabel(g.per.n, g.per.unit) + " 증정 ·")} ${nw(esc(g.choice.label) + " · 0원")}</span></div>`).join("");
    const items = [
      `<div class="it"><div class="t">${esc(title)}</div><div class="r"><span>${c.start} ~ ${c.end}</span><b>${won(o.listPrice)}원</b></div>${GIFT_ON ? `<div class="u">이용횟수 ${nw(esc(E.usageLabel(o)))}</div>` : ""}</div>`,
      ...c.gifts.map((g) => `<div class="it gi2"><div class="t"><span class="chipg">${ICON_GIFT(11)}증정</span>${esc(giftName(g))} ${nw(E.periodLabel(g.per.n, g.per.unit))}</div>
        <div class="r"><span>${g.start} ~ ${g.end}</span><b>0원</b></div><div class="u">이용횟수 ${nw(esc(g.choice.label))} · 결제하면 자동으로 들어가요</div>
        ${g.chained ? `<div class="u ch">보유 중인 ${esc(g.target.category)}(~${g.after})이 끝난 다음 날부터</div>` : ""}</div>`),
      ...c.extras.filter((x) => x.on).map((x) => `<div class="it"><div class="t">${x.name} ${o.period}${o.unit}</div><div class="r"><span>${c.start} ~ ${c.end}</span><b>${won(x.price)}원</b></div></div>`),
    ].join("");
    const giftBenefit = c.gifts.length ? ` <span class="nw">+ <em class="gfb">${c.gifts.map(giftShort).map(esc).join(" · ")} 증정</em></span>` : "";
    return `<div class="phone rx pay">${rxHead("결제진행")}<div class="rx-body">
      <div class="rx-row"><span class="k b">이용센터</span><span class="v b">${esc(S.CENTER)}</span></div>
      <div class="rx-row tk"><span class="k b">이용권</span><span class="v"><span class="b">${esc(title)}</span>${GIFT_ON ? `<span class="tu">${nw(esc(E.usageLabel(o)))}</span>` : ""}${ticketGifts}</span></div>
      <div class="rx-row"><span class="k b">이용기간</span><span class="v d">${c.start} ~ ${c.end}</span></div>
      <div class="rx-hist"><div class="h">결제내역</div>${items}</div>
      <div class="rx-row sum"><span class="k g">상품 금액</span><b>${won(c.list)}원</b></div>
      <div class="rx-row"><span class="k b">쿠폰</span><span class="rt">적용가능 쿠폰 0장</span></div>
      <div class="rx-in"><div class="k b">쿠폰 코드</div><div class="f"><input placeholder="쿠폰 코드 입력" aria-label="쿠폰 코드"><button>코드확인</button></div></div>
      <div class="rx-in pt"><div class="hh"><span class="k b">포인트</span><span class="pv">90,372,373 P</span></div><div class="f"><input placeholder="0 원" aria-label="포인트"><button>전액사용</button></div></div>
      ${c.disc > 0 ? `<div class="rx-disc"><div class="h">할인 내역</div>
        <div class="l"><span class="ic t">${ICON_TAG}</span><span class="et">이벤트 할인</span><b>-${won(c.disc)}원</b></div>
        <div class="tot"><b>총 <em>${won(c.disc)}원</em> 아꼈어요</b><span>${won(c.list)}원에서 ${c.pct}% 할인</span></div></div>` : ""}
      <div class="rx-ben">${ICON_GIFT(19, 1.8)}<p><span class="g">이번 결제 혜택</span> ${c.disc > 0 ? `<em class="pk">할인 ${won(c.disc)}원</em> + ` : ""}<em class="gr">적립 ${won(c.point)}P</em>${giftBenefit}</p></div>
      <p class="rx-note">※ 포인트로 결제한 금액은 적립에서 제외돼요</p>
      <div class="rx-hr"></div>
      <div class="rx-pm"><b>결제수단 선택</b>${["신용카드", "카드 간편결제", "Npay"].map((t, i) => `<label><input type="radio" name="pm" ${i ? "" : "checked"}><i></i>${t}</label>`).join("")}</div>
      <p class="rx-agree">※ 주문 내용을 확인하였으며, <u>환불규정, 서비스 이용약관</u> 및 결제에 동의합니다.</p>
    </div>${rxBar(c, "최종 결제금액", "결제하기", `data-pay="${cart.key}"`)}</div>`;
  }

  function pay(key) {
    const { p, o } = findOpt(key);
    const r = E.completePayment(D(), { memberId: ME, productId: p.id, optionId: o.id, start: cart.start || S.START, today: TODAY });
    save();
    done = { r, p, o };
    view = "done"; render(); scrollTo(0, 0);
  }

  function giftLines(list) {
    return list.map((g) => `<div class="gl">🎁 <b>${esc(g.name)} ${esc(g.perLabel)}</b> · ${esc(E.usageLabel(g))} <span class="z">0원</span><br>
      <span class="d">${g.start} ~ ${g.end} · 내 멤버십에 들어갔어요</span>
      ${g.gift.chainedAfter ? `<br><span class="chain">보유 중인 ${esc(g.category)}(~${g.gift.chainedAfter})이 끝난 다음 날부터 시작해요</span>` : ""}</div>`).join("");
  }
  function doneView() {
    const { r, p, o } = done;
    const res = E.resolveGifts(D().products, p, o).filter((x) => !x.error);
    const gifts = r.gifts.map((g) => { const x = res.find((y) => y.target.id === g.productId); return { ...g, perLabel: x ? E.periodLabel(x.per.n, x.per.unit) : "" }; });
    return `<div class="phone"><div class="ph-top">결제 완료</div><div class="done">
      <div class="ok">✓</div><h5>결제가 완료됐어요</h5><p class="sub">${esc(r.payment.title)} · ${won(r.payment.amount)}원</p>
      <div class="kv" style="margin-top:22px"><span class="k">구매 멤버십</span><span class="v">${esc(E.productLabel(p))}<br><span style="font-weight:400;color:#6B7280;font-size:12.5px">${r.purchase.start} ~ ${r.purchase.end} · ${esc(E.usageLabel(r.purchase))}</span></span></div>
      ${gifts.length ? `<div class="gbox"><div class="gt">🎁 증정 멤버십이 함께 발급됐어요</div>${giftLines(gifts)}</div>` : ""}
      <button class="paybtn" data-go="my">내 멤버십 보기</button><button class="ghost" data-go="shop">계속 둘러보기</button>
    </div></div>`;
  }

  // ───────── 내 멤버십 / 관리자 ─────────
  const sourceChip = (m) => m.source === "gift_auto" ? `<span class="chip gift">🎁 ${esc(m.gift.sourceCategory)} 구매 증정</span>`
    : m.source === "gift_manual" ? `<span class="chip man">수동 증정</span>` : `<span class="chip">구매</span>`;
  const stChip = (s) => `<span class="chip st-${s}">${E.STATUS_KO[s]}</span>`;
  const usageTxt = (m) => E.usageLabel(m);
  // 내 멤버십·회원상세용: 제한 + 지금 창에서 쓴 횟수
  function usageNow(m) {
    const u = E.usageState(m, TODAY > m.start ? TODAY : m.start);
    if (m.status === "revoked" && m.revokeUsage) return `${u.label} · 회수 전 ${m.revokeUsage.used}회 사용`;
    if (m.status === "scheduled") return `${u.label} · ${m.start}부터`;
    if (!["active"].includes(m.status)) return `${u.label} · ${u.used}회 사용`;
    if (!u.limited) return `${u.label} · 지금까지 ${u.used}회 이용`;
    if (m.usage === "period") return `${u.label} · ${u.inWin}회 사용 · ${u.left}회 남음`;
    return `${u.label} · ${u.win} ${u.inWin}/${m.count}회 사용`;
  }

  function myView() {
    const ms = D().memberships.filter((m) => m.memberId === ME);
    const live = ms.filter((m) => ["active", "scheduled"].includes(m.status)).sort((a, b) => (a.start < b.start ? -1 : 1));
    const dead = ms.filter((m) => !["active", "scheduled"].includes(m.status));
    const card = (m) => `<div class="mc ${["active", "scheduled"].includes(m.status) ? "" : "dead"}">
      <div class="r1"><span class="nm">${esc(m.name)}</span>${GIFT_ON || m.source !== "gift_auto" ? sourceChip(m) : ""}${stChip(m.status)}</div>
      <div class="r2">${m.start} ~ ${m.end}</div>
      <div class="r4"><span class="ut">이용횟수</span><span class="uv">${esc(usageNow(m))}</span></div>
      ${m.source === "gift_auto" ? `<div class="r3">${esc(m.gift.sourceTitle)} 결제로 받은 증정 · 0원${m.status === "revoked" ? ` · 회수됨(${esc(m.revokeReason)})` : ""}</div>` : ""}
      ${m.source === "gift_manual" ? `<div class="r3">센터에서 드린 증정 · 0원</div>` : ""}
    </div>`;
    return `<div class="phone"><div class="ph-top"><span class="bk">‹</span>내 멤버십</div><div class="my">
      <h6>이용 중 · 시작 전 (${live.length})</h6>${live.map(card).join("") || `<p class="mi">없음</p>`}
      ${dead.length ? `<h6>지난 멤버십 (${dead.length})</h6>${dead.map(card).join("")}` : ""}</div></div>`;
  }

  function memberView() {
    const u = D().members[0];
    const ms = D().memberships.filter((m) => m.memberId === u.id);
    const pays = D().payments.filter((p) => p.memberId === u.id);
    const logs = D().logs.filter((l) => l.memberId === u.id);
    const dead = (s) => !["active", "scheduled", "paid"].includes(s);
    return `<div class="ad2"><h2>회원 상세 · ${esc(u.name)}</h2><p class="mi">${u.phone} · 엔짐 상도점</p>
      <h3>보유 멤버십 <button class="btn" data-manual="1">+ 수동 증정</button></h3>
      <div class="tw"><table><thead><tr><th>멤버십</th><th>구분</th><th>기간</th><th>이용횟수</th><th>금액</th><th>상태</th><th>출처</th></tr></thead><tbody>
      ${ms.map((m) => `<tr class="${dead(m.status) ? "dead" : ""}"><td><b>${esc(m.name)}</b></td><td>${sourceChip(m)}</td><td>${m.start} ~ ${m.end}</td><td><b>${esc(usageTxt(m))}</b><br><span class="src">${esc(usageNow(m).split(" · ").slice(1).join(" · "))}</span>${["active", "scheduled"].includes(m.status) ? `<br><button class="btn sm" data-use="${m.id}" title="시안 조작: 그 멤버십 첫 이용 가능일(오늘 또는 시작일)에 입장 1회 기록">입장 +1 (시안)</button>` : ""}</td>
        <td>${m.price ? won(m.price) + "원" : "0원"}</td><td>${stChip(m.status)}</td>
        <td>${m.source === "gift_auto" ? `<span class="src">결제 ${esc(m.gift.paymentId)}<br>${esc(m.gift.sourceTitle)}${m.gift.chainedAfter ? `<br>기존 ${esc(m.category)} 종료(${m.gift.chainedAfter}) 다음 날 시작` : ""}${m.status === "revoked" ? `<br>${m.revokedAt} 회수 · ${esc(m.revokeReason)}${m.revokeUsage ? ` · 회수 전 ${m.revokeUsage.used}회 사용(${esc(E.usageLabel(m))})` : ""}` : ""}</span>` : m.paymentId ? `<span class="src">결제 ${esc(m.paymentId)}</span>` : `<span class="src">관리자 수동</span>`}</td></tr>`).join("")}
      </tbody></table></div>
      <h3>결제 내역</h3>
      <div class="tw"><table><thead><tr><th>결제번호</th><th>결제일</th><th>상품</th><th>금액</th><th>상태</th><th>증정</th><th></th></tr></thead><tbody>
      ${pays.map((p) => { const gs = D().memberships.filter((m) => m.source === "gift_auto" && m.gift.paymentId === p.id);
        return `<tr class="${dead(p.status) ? "dead" : ""}"><td>${esc(p.id)}</td><td>${p.paidAt}</td><td>${esc(p.title)}</td><td>${won(p.amount)}원</td><td>${stChip(p.status)}</td>
        <td>${gs.map((g) => `${esc(g.name)} ${stChip(g.status)}`).join("<br>") || "-"}</td>
        <td>${p.status === "paid" ? `<button class="btn red" data-refund="${p.id}">환불·취소</button>` : ""}</td></tr>`; }).join("")}
      </tbody></table></div>
      <h3>증정 기록</h3><ul class="log">${logs.slice().reverse().map((l) => `<li class="${l.type}"><b>${{ gift_grant: "자동 발급", gift_revoke: "자동 회수", gift_skip: "건너뜀", manual: "수동 증정" }[l.type]}</b>${l.at} · ${esc(l.text)}</li>`).join("") || `<li>기록 없음</li>`}</ul>
    </div>`;
  }

  function refundModal(pid) {
    const p = D().payments.find((x) => x.id === pid);
    const gs = D().memberships.filter((m) => m.source === "gift_auto" && m.gift.paymentId === pid && m.status !== "revoked");
    $("#modal").innerHTML = `<div class="dim c" data-close="1"><div class="mdl"><h5>환불·취소</h5>
      <p>${esc(p.title)} · ${won(p.amount)}원</p>
      <label class="mi">처리 구분<select id="rf-r"><option value="환불">환불</option><option value="결제취소">결제취소</option></select></label>
      ${gs.length ? `<div class="warn">이 결제로 자동 발급된 증정 멤버십도 함께 회수됩니다.<br>${gs.map((g) => `🎁 <b>${esc(g.name)}</b> ${g.start}~${g.end} (${E.STATUS_KO[g.status]} · 이용횟수 ${esc(E.usageLabel(g))} 중 ${(g.uses || []).length}회 사용)`).join("<br>")}<br><span class="mi">사용 횟수는 회수 기록에 남습니다.</span></div>` : ""}
      <div class="acts"><button class="btn" data-close="1">닫기</button><button class="btn pri" data-dorefund="${pid}">확인</button></div></div></div>`;
  }

  function manualModal() {
    $("#modal").innerHTML = `<div class="dim c" data-close="1"><div class="mdl"><h5>수동 증정 (기존 기능 그대로)</h5>
      <label class="mi">멤버십<select id="mn-p">${D().products.map((p) => `<option value="${p.id}">${esc(E.productLabel(p))}</option>`).join("")}</select></label>
      <label class="mi">시작일<input type="date" id="mn-s" value="${TODAY}"></label>
      <label class="mi">기간(개월)<input type="number" id="mn-n" value="1" min="1"></label>
      <div class="acts"><button class="btn" data-close="1">닫기</button><button class="btn pri" data-domanual="1">증정</button></div></div></div>`;
  }

  function salesView() {
    const v = E.sales(D());
    return `<div class="ad2"><h2>매출 (11월 · 엔짐 상도점)</h2>
      <div class="tiles" style="margin-top:16px">
        <div class="tile"><div class="k">결제 매출</div><div class="v">${won(v.gross)}원</div></div>
        <div class="tile"><div class="k">환불·취소</div><div class="v">-${won(v.refund)}원</div></div>
        <div class="tile"><div class="k">순매출</div><div class="v">${won(v.net)}원</div></div>
        <div class="tile g"><div class="k">자동 증정 발급 (매출 제외)</div><div class="v">${v.giftCount}건 · 0원</div></div>
      </div>
      <p class="hint">증정 멤버십은 결제가 없는 0원 발급이라 매출·정산·수수료 집계에 들어가지 않습니다. 건수만 따로 셉니다.</p>
      <h3>결제 목록</h3><div class="tw"><table><thead><tr><th>결제번호</th><th>결제일</th><th>상품</th><th>금액</th><th>상태</th></tr></thead><tbody>
      ${D().payments.map((p) => `<tr><td>${esc(p.id)}</td><td>${p.paidAt}</td><td>${esc(p.title)}</td><td>${won(p.amount)}원</td><td>${stChip(p.status)}</td></tr>`).join("")}
      </tbody></table></div></div>`;
  }

  // ───────── 공통 ─────────
  function render() {
    document.querySelectorAll("#nav a").forEach((a) => a.classList.toggle("on", a.dataset.v === view || (["done", "opt", "pay"].includes(view) && a.dataset.v === "shop")));
    $("#o-exist").checked = st.exist;
    $("#o-start").value = cart.start;
    if (view === "done" && !done) view = "shop";
    const V = { admin: adminView, shop: shopView, opt: optView, pay: payView, done: doneView, my: myView, member: memberView, sales: salesView }[view] || adminView;
    $("#app").innerHTML = V();
    document.body.dataset.view = view;
  }

  document.addEventListener("click", (e) => {
    const t = e.target;
    const nav = t.closest("#nav a"); if (nav) { view = nav.dataset.v; done = null; render(); scrollTo(0, 0); return; }
    if (t.dataset.close && (t.classList.contains("dim") ? t === e.target : true)) { $("#modal").innerHTML = ""; return; }
    const buy = t.closest("[data-buy]"); if (buy) { cart = { ...cart, key: buy.dataset.buy, extras: {} }; view = "opt"; render(); scrollTo(0, 0); return; }
    const use = t.closest("[data-use]"); if (use) {
      const m = D().memberships.find((x) => x.id === use.dataset.use);
      const r = E.recordUse(m, TODAY > m.start ? TODAY : m.start);
      save(); render(); toast(r.ok ? `입장 1회 기록 · ${E.usageLabel(m)}` : `막힘 — ${r.why}`); return;
    }
    const pb = t.closest("[data-pay]"); if (pb) return pay(pb.dataset.pay);
    const go = t.closest("[data-go]"); if (go) { view = go.dataset.go; done = null; render(); scrollTo(0, 0); return; }
    const rf = t.closest("[data-refund]"); if (rf) return refundModal(rf.dataset.refund);
    const drf = t.closest("[data-dorefund]"); if (drf) {
      const r = E.refundPayment(D(), drf.dataset.dorefund, { today: TODAY, reason: $("#rf-r").value });
      save(); $("#modal").innerHTML = ""; render(); toast(`처리 완료 · 증정 ${r.revoked.length}건 회수`); return;
    }
    if (t.closest("[data-manual]")) return manualModal();
    if (t.closest("[data-domanual]")) {
      const p = prod($("#mn-p").value), s = $("#mn-s").value || TODAY, n = Math.max(1, Number($("#mn-n").value) || 1), o = p.options[0];
      const m = { id: "ms_m" + Date.now().toString(36), memberId: ME, productId: p.id, category: p.category, name: E.productLabel(p), usage: o.usage, count: Number(o.count),
        start: s, end: E.endOf(s, n, "개월"), price: 0, source: "gift_manual", paymentId: null, gift: null };
      m.status = E.statusOf(m.start, m.end, TODAY);
      D().memberships.push(m); D().logs.push({ at: TODAY, type: "manual", memberId: ME, text: `수동 증정 — ${m.name} ${n}개월 (${m.start}~${m.end})` });
      save(); $("#modal").innerHTML = ""; render(); return;
    }
    if (view === "admin") onAdmin(e);
  });
  document.addEventListener("change", (e) => {
    if (e.target.dataset.extra) { cart.extras[e.target.dataset.extra] = e.target.checked; render(); return; }
    if (e.target.id === "o-start") { cart.start = e.target.value < TODAY ? TODAY : e.target.value; render(); return; }
    if (view === "admin") onAdmin(e);
  });
  $("#o-reset").addEventListener("click", () => { st = fresh(st.exist); open = {}; done = null; save(); render(); toast("처음 상태로 돌렸어요"); });
  $("#o-exist").addEventListener("change", (e) => { st = fresh(e.target.checked); done = null; save(); render(); toast(e.target.checked ? "헬스(~12-20) 보유 상태로 처음부터" : "헬스 없는 상태로 처음부터"); });
  if (!GIFT_ON) $(".demo-opt").insertAdjacentHTML("afterbegin", `<span class="mode">수정 전 화면 (증정 기능 없음)</span>`);
  if (qs.get("open")) qs.get("open").split(",").forEach((k) => (open[k] = true));
  save(); render();
})();

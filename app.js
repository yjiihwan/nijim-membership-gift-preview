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
  const USE_KO = { unlimited: "무제한", period: "기간내", daily: "하루" };
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
      const choices = t ? E.usageChoices(t) : [];
      const samePer = `${o.period}${o.unit}`;
      return `<div class="gi" data-gi="${i}">
        ${o.gifts.length > 1 ? `<button class="del" data-act="gdel" data-k="${key}" data-i="${i}">삭제 ✕</button>` : ""}
        <div class="row"><span class="k">증정할 멤버십</span>
          <select class="tgt" data-act="gtgt" data-k="${key}" data-i="${i}">
            <option value="">선택하세요</option>
            ${others.map((x) => `<option value="${x.id}" ${x.id === g.targetProductId ? "selected" : ""}>${esc(E.productLabel(x))}${E.productLabel(x) === x.category ? "" : ` · ${esc(x.category)}`}${x.visible ? "" : " (감춤)"}</option>`).join("")}
          </select>${t ? "" : `<span class="err">증정할 멤버십을 고르세요</span>`}</div>
        <div class="row"><span class="k">증정 기간</span>
          <label><input type="radio" name="pm_${key}_${i}" data-act="gpm" data-k="${key}" data-i="${i}" value="same" ${g.periodMode === "same" ? "checked" : ""}> 구매 상품 기간과 동일 (${samePer})</label>
          <label><input type="radio" name="pm_${key}_${i}" data-act="gpm" data-k="${key}" data-i="${i}" value="custom" ${g.periodMode === "custom" ? "checked" : ""}> 직접 입력</label>
          <input type="number" min="1" value="${esc(g.periodValue || 1)}" data-act="gpv" data-k="${key}" data-i="${i}" ${g.periodMode === "custom" ? "" : "disabled"}>
          <select data-act="gpu" data-k="${key}" data-i="${i}" ${g.periodMode === "custom" ? "" : "disabled"}>
            <option ${g.periodUnit === "일" ? "selected" : ""}>일</option><option ${g.periodUnit !== "일" ? "selected" : ""}>개월</option></select></div>
        <div class="row"><span class="k">이용 조건</span>
          <select data-act="guse" data-k="${key}" data-i="${i}" ${t ? "" : "disabled"}>
            ${choices.map((c) => `<option value="${c.key}" ${c.key === g.usageKey ? "selected" : ""}>${c.label}</option>`).join("")}
          </select><span class="note">증정 멤버십 판매설정의 무제한/횟수 조건 중에서 고릅니다</span></div>
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
              <span class="inp sel w-use">${USE_KO[o.usage]}</span><span class="inp w-cnt">${o.count}</span><span class="unit">회 이용 가능</span></div>
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
      if (act === "gtgt") { g.targetProductId = el.value; const t = prod(el.value); g.usageKey = t ? E.usageChoices(t)[0]?.key : ""; }
      else if (act === "gpm") g.periodMode = el.value;
      else if (act === "gpv") g.periodValue = Math.max(1, Number(el.value) || 1);
      else if (act === "gpu") g.periodUnit = el.value;
      else if (act === "guse") g.usageKey = el.value;
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
    if (o.usage === "daily") return [`${o.period}${o.unit}`, `하루 ${o.count}회 이용`];
    return [`${o.period}${o.unit}`, "무제한 이용"];
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
    return `<div class="phone shop"><div class="ph-top"><span class="bk">‹</span>엔짐 상도점</div>
      <div class="ins"><i></i>최대 <b>7개월</b> 무이자 할부</div><h3>멤버십 구매</h3>${secs}<div style="height:40px"></div></div>`;
  }

  function giftLines(list, mode) {
    return list.map((g) => `<div class="gl">🎁 <b>${esc(g.name || E.productLabel(g.target))} ${esc(E.periodLabel(g.per ? g.per.n : 0, g.per ? g.per.unit : ""))}</b> · ${esc(g.choice ? g.choice.label : E.usageLabel(g))} <span class="z">0원</span><br>
      <span class="d">${g.start} ~ ${g.end}${mode === "done" ? " · 내 멤버십에 들어갔어요" : ""}</span>
      ${g.chained ? `<br><span class="chain">보유 중인 ${esc(g.target ? g.target.category : g.category)}(~${g.after})이 끝난 다음 날부터 시작해요</span>` : ""}</div>`).join("");
  }

  function openConfirm(key, start) {
    const { p, o } = findOpt(key);
    start = start || TODAY;
    const pv = GIFT_ON ? E.previewGifts(D(), ME, p, o, start) : [];
    const [h1, h2] = cardHead(p, o);
    $("#modal").innerHTML = `<div class="dim" data-close="1"><div class="sheet" role="dialog" aria-label="결제 확인">
      <h5>결제 확인</h5>
      <div class="kv"><span class="k">상품</span><span class="v">${esc(E.productLabel(p))} · ${h1} / ${h2}</span></div>
      <div class="kv"><span class="k">이용 시작일</span><span class="v"><input type="date" id="cf-start" value="${start}" min="${TODAY}"></span></div>
      <div class="kv"><span class="k">이용 기간</span><span class="v">${start} ~ ${E.endOf(start, o.period, o.unit)}</span></div>
      <div class="kv"><span class="k">결제 금액</span><span class="v" style="font-size:17px;font-weight:800">${won(o.price)}원</span></div>
      ${pv.length ? `<div class="gbox"><div class="gt">함께 받는 증정 멤버십</div>${giftLines(pv.map((x) => ({ ...x, name: E.productLabel(x.target), category: x.target.category })), "confirm")}</div>` : ""}
      <button class="paybtn" data-pay="${key}">${won(o.price)}원 결제하기</button><button class="ghost" data-close="1">닫기</button>
    </div></div>`;
    $("#cf-start").addEventListener("change", (e) => openConfirm(key, e.target.value < TODAY ? TODAY : e.target.value));
  }

  function pay(key) {
    const { p, o } = findOpt(key);
    const start = $("#cf-start").value || TODAY;
    const r = E.completePayment(D(), { memberId: ME, productId: p.id, optionId: o.id, start, today: TODAY });
    save();
    $("#modal").innerHTML = "";
    done = { r, p, o };
    view = "done"; render(); scrollTo(0, 0);
  }

  function doneView() {
    const { r, p, o } = done;
    const gifts = r.gifts.map((g) => ({ ...g, per: { n: 0, unit: "" }, choice: null }));
    return `<div class="phone"><div class="ph-top">결제 완료</div><div class="done">
      <div class="ok">✓</div><h5>결제가 완료됐어요</h5><p class="sub">${esc(r.payment.title)} · ${won(r.payment.amount)}원</p>
      <div class="kv" style="margin-top:22px"><span class="k">구매 멤버십</span><span class="v">${esc(E.productLabel(p))}<br><span style="font-weight:400;color:#6B7280;font-size:12.5px">${r.purchase.start} ~ ${r.purchase.end}</span></span></div>
      ${gifts.length ? `<div class="gbox"><div class="gt">🎁 증정 멤버십이 함께 발급됐어요</div>${r.gifts.map((g) => {
        const res = E.resolveGifts(D().products, p, o).filter((x) => !x.error && x.target.id === g.productId)[0];
        return giftLines([{ ...g, per: res ? res.per : { n: 0, unit: "" }, choice: { label: E.usageLabel(g) }, chained: !!g.gift.chainedAfter, after: g.gift.chainedAfter, target: { category: g.category } }], "done");
      }).join("")}</div>` : ""}
      <button class="paybtn" data-go="my">내 멤버십 보기</button><button class="ghost" data-go="shop">계속 둘러보기</button>
    </div></div>`;
  }

  // ───────── 내 멤버십 / 관리자 ─────────
  const sourceChip = (m) => m.source === "gift_auto" ? `<span class="chip gift">🎁 ${esc(m.gift.sourceCategory)} 구매 증정</span>`
    : m.source === "gift_manual" ? `<span class="chip man">수동 증정</span>` : `<span class="chip">구매</span>`;
  const stChip = (s) => `<span class="chip st-${s}">${E.STATUS_KO[s]}</span>`;
  const usageTxt = (m) => E.usageLabel(m);

  function myView() {
    const ms = D().memberships.filter((m) => m.memberId === ME);
    const live = ms.filter((m) => ["active", "scheduled"].includes(m.status)).sort((a, b) => (a.start < b.start ? -1 : 1));
    const dead = ms.filter((m) => !["active", "scheduled"].includes(m.status));
    const card = (m) => `<div class="mc ${["active", "scheduled"].includes(m.status) ? "" : "dead"}">
      <div class="r1"><span class="nm">${esc(m.name)}</span>${GIFT_ON || m.source !== "gift_auto" ? sourceChip(m) : ""}${stChip(m.status)}</div>
      <div class="r2">${m.start} ~ ${m.end} · ${usageTxt(m)}</div>
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
      <div class="tw"><table><thead><tr><th>멤버십</th><th>구분</th><th>기간</th><th>이용 조건</th><th>금액</th><th>상태</th><th>출처</th></tr></thead><tbody>
      ${ms.map((m) => `<tr class="${dead(m.status) ? "dead" : ""}"><td><b>${esc(m.name)}</b></td><td>${sourceChip(m)}</td><td>${m.start} ~ ${m.end}</td><td>${usageTxt(m)}</td>
        <td>${m.price ? won(m.price) + "원" : "0원"}</td><td>${stChip(m.status)}</td>
        <td>${m.source === "gift_auto" ? `<span class="src">결제 ${esc(m.gift.paymentId)}<br>${esc(m.gift.sourceTitle)}${m.gift.chainedAfter ? `<br>기존 ${esc(m.category)} 종료(${m.gift.chainedAfter}) 다음 날 시작` : ""}${m.status === "revoked" ? `<br>${m.revokedAt} 회수 · ${esc(m.revokeReason)}` : ""}</span>` : m.paymentId ? `<span class="src">결제 ${esc(m.paymentId)}</span>` : `<span class="src">관리자 수동</span>`}</td></tr>`).join("")}
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
      ${gs.length ? `<div class="warn">이 결제로 자동 발급된 증정 멤버십도 함께 회수됩니다.<br>${gs.map((g) => `🎁 <b>${esc(g.name)}</b> ${g.start}~${g.end} (${E.STATUS_KO[g.status]})`).join("<br>")}</div>` : ""}
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
    document.querySelectorAll("#nav a").forEach((a) => a.classList.toggle("on", a.dataset.v === view || (view === "done" && a.dataset.v === "shop")));
    $("#o-exist").checked = st.exist;
    if (view === "done" && !done) view = "shop";
    const V = { admin: adminView, shop: shopView, done: doneView, my: myView, member: memberView, sales: salesView }[view] || adminView;
    $("#app").innerHTML = V();
    document.body.dataset.view = view;
  }

  document.addEventListener("click", (e) => {
    const t = e.target;
    const nav = t.closest("#nav a"); if (nav) { view = nav.dataset.v; done = null; render(); scrollTo(0, 0); return; }
    if (t.dataset.close && (t.classList.contains("dim") ? t === e.target : true)) { $("#modal").innerHTML = ""; return; }
    const buy = t.closest("[data-buy]"); if (buy) return openConfirm(buy.dataset.buy);
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
  document.addEventListener("change", (e) => { if (view === "admin") onAdmin(e); });
  $("#o-reset").addEventListener("click", () => { st = fresh(st.exist); open = {}; done = null; save(); render(); toast("처음 상태로 돌렸어요"); });
  $("#o-exist").addEventListener("change", (e) => { st = fresh(e.target.checked); done = null; save(); render(); toast(e.target.checked ? "헬스(~12-20) 보유 상태로 처음부터" : "헬스 없는 상태로 처음부터"); });
  if (!GIFT_ON) $(".demo-opt").insertAdjacentHTML("afterbegin", `<span class="mode">수정 전 화면 (증정 기능 없음)</span>`);
  if (qs.get("open")) qs.get("open").split(",").forEach((k) => (open[k] = true));
  save(); render();
})();

/* 멤버십 자동 증정 — 발급·회수 로직 (화면과 분리된 순수 함수, node 시험 가능) */
(function (root) {
  const pad = (n) => String(n).padStart(2, "0");
  const fmt = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const parse = (s) => new Date(s + "T00:00:00Z");
  const addDays = (s, n) => { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return fmt(d); };
  function addMonthsClamp(s, n) {
    const d = parse(s), day = d.getUTCDate();
    const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
    const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
    t.setUTCDate(Math.min(day, last));
    return fmt(t);
  }
  // 종료일 = 시작일 + 기간 - 1일 (1개월: 11-17 → 12-16)
  const endOf = (start, n, unit) => addDays(unit === "개월" ? addMonthsClamp(start, n) : addDays(start, n), -1);

  const LIVE = ["active", "scheduled"];
  const productLabel = (p) => (p.name && p.name.trim()) || p.category;
  const periodLabel = (n, unit) => `${n}${unit}`;

  // 이용횟수 제한 5종. 증정 멤버십은 대상 멤버십(판매설정 가격 줄)에 걸린 제한을 그대로 복사한다.
  const USAGE_KO = { unlimited: "무제한", daily: "하루", weekly: "주", monthly: "월", period: "기간 내" };
  const usageLabel = (u) => (u.usage === "unlimited" ? "무제한" : `${USAGE_KO[u.usage]} ${u.count}회`);
  const usageKey = (u) => `${u.usage}:${u.usage === "unlimited" ? 0 : Number(u.count)}`;

  // 증정 대상 멤버십에 실제로 있는 (제한 종류·n) 조합들 — 관리자가 고를 수 있는 건 이것뿐(새 제한을 만들 수 없음)
  function usageChoices(target) {
    const seen = new Map();
    for (const o of target.options) {
      const k = usageKey(o);
      if (!seen.has(k)) seen.set(k, { key: k, usage: o.usage, count: o.usage === "unlimited" ? 0 : Number(o.count), label: usageLabel(o) });
    }
    return [...seen.values()];
  }

  // 저장된 조합이 대상에 그대로 있으면 그것, 대상 조합이 하나뿐이면 그 값을 따라감, 아니면 다시 골라야 함
  function resolveChoice(target, key) {
    const cs = usageChoices(target);
    return cs.find((c) => c.key === key) || (cs.length === 1 ? cs[0] : null);
  }

  // 사용 기록(uses = 입장 날짜 목록)으로 남은 횟수 계산. 주=월~일, 월=1일~말일(달력 기준, D5 확정)
  function usageWindow(m, day) {
    if (m.usage === "daily") return [day, day, "오늘"];
    if (m.usage === "weekly") { const dow = (parse(day).getUTCDay() + 6) % 7; const a = addDays(day, -dow); return [a, addDays(a, 6), "이번 주"]; }
    if (m.usage === "monthly") { const a = day.slice(0, 8) + "01"; return [a, addDays(addMonthsClamp(a, 1), -1), "이번 달"]; }
    return [m.start, m.end, "기간 내"];
  }
  function usageState(m, day) {
    const uses = m.uses || [];
    if (m.usage === "unlimited") return { limited: false, used: uses.length, label: usageLabel(m) };
    const [a, b, win] = usageWindow(m, day);
    const inWin = uses.filter((d) => d >= a && d <= b).length;
    return { limited: true, used: uses.length, inWin, left: Math.max(0, Number(m.count) - inWin), win, label: usageLabel(m) };
  }
  // 입장 1회 기록. 기간 밖·회수/환불·제한 초과면 막는다 (증정분도 같은 규칙)
  function recordUse(m, day) {
    if (!LIVE.includes(m.status) && m.status !== "expired") return { ok: false, why: `${STATUS_KO[m.status]} 멤버십은 쓸 수 없어요` };
    if (day < m.start || day > m.end) return { ok: false, why: "이용기간이 아니에요" };
    const u = usageState(m, day);
    if (u.limited && u.left <= 0) return { ok: false, why: `${u.win} 이용횟수(${u.label})를 다 썼어요` };
    (m.uses = m.uses || []).push(day);
    return { ok: true };
  }

  function giftPeriod(gift, option) {
    return gift.periodMode === "same"
      ? { n: Number(option.period), unit: option.unit }
      : { n: Number(gift.periodValue), unit: gift.periodUnit };
  }

  const canGift = (product) => product.payType === "normal";

  // 같은 종목의 살아 있는 멤버십이 시작일 이후까지 남아 있으면 그 다음 날부터
  function giftStart(memberships, memberId, category, purchaseStart) {
    let last = null;
    for (const m of memberships) {
      if (m.memberId !== memberId || m.category !== category || !LIVE.includes(m.status)) continue;
      if (m.end >= purchaseStart && (!last || m.end > last)) last = m.end;
    }
    return last ? { start: addDays(last, 1), chained: true, after: last } : { start: purchaseStart, chained: false };
  }

  function resolveGifts(products, product, option) {
    if (!canGift(product)) return [];
    return (option.gifts || [])
      .map((g) => {
        const target = products.find((p) => p.id === g.targetProductId);
        if (!target || target.id === product.id) return { gift: g, error: "증정 대상 멤버십이 없거나 자기 자신입니다" };
        if (!target.options.length) return { gift: g, error: "증정 대상 멤버십에 가격 줄이 없습니다" };
        const choice = resolveChoice(target, g.usageKey);
        if (!choice) return { gift: g, error: "증정 이용횟수를 다시 골라야 합니다(대상 판매설정의 제한이 바뀜)" };
        const per = giftPeriod(g, option);
        if (!(per.n > 0)) return { gift: g, error: "증정 기간이 비어 있습니다" };
        return { gift: g, target, choice, per, label: `${productLabel(target)} ${periodLabel(per.n, per.unit)}` };
      });
  }

  // 결제 확인 창 미리보기 (실제 발급과 같은 함수로 시작일을 계산)
  function previewGifts(state, memberId, product, option, purchaseStart) {
    const tmp = state.memberships.slice();
    const out = [];
    for (const r of resolveGifts(state.products, product, option)) {
      if (r.error) continue;
      const s = giftStart(tmp, memberId, r.target.category, purchaseStart);
      const end = endOf(s.start, r.per.n, r.per.unit);
      tmp.push({ memberId, category: r.target.category, status: "scheduled", end });
      out.push({ ...r, start: s.start, end, chained: s.chained, after: s.after });
    }
    return out;
  }

  const statusOf = (start, end, today) => (today < start ? "scheduled" : today > end ? "expired" : "active");
  let seq = 0;
  const nid = (p) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

  // 결제 완료 → 구매 멤버십 발급 + 증정 멤버십 0원 자동 발급. 같은 결제로 두 번 부르면 아무것도 안 한다(멱등).
  function completePayment(state, { memberId, productId, optionId, start, today, paymentId }) {
    const product = state.products.find((p) => p.id === productId);
    const option = product && product.options.find((o) => o.id === optionId);
    if (!product || !option) throw new Error("상품 없음");
    const pid = paymentId || nid("pay_");
    if (state.payments.some((p) => p.id === pid)) return { payment: state.payments.find((p) => p.id === pid), gifts: [], duplicate: true };

    const payment = {
      id: pid, memberId, productId, optionId, amount: Number(option.price), status: "paid", paidAt: today,
      title: `${productLabel(product)} ${optionTitle(option)}`,
    };
    state.payments.push(payment);
    const purchase = {
      id: nid("ms_"), memberId, productId, category: product.category, name: productLabel(product),
      usage: option.usage, count: Number(option.count), start, end: endOf(start, Number(option.period), option.unit),
      price: payment.amount, source: "purchase", paymentId: pid, gift: null, uses: [],
    };
    purchase.status = statusOf(purchase.start, purchase.end, today);
    state.memberships.push(purchase);

    const gifts = [];
    for (const r of resolveGifts(state.products, product, option)) {
      if (r.error) {
        state.logs.push({ at: today, type: "gift_skip", paymentId: pid, memberId, text: `증정 건너뜀 — ${r.error} (${payment.title})` });
        continue;
      }
      const s = giftStart(state.memberships, memberId, r.target.category, start);
      const g = {
        id: nid("ms_"), memberId, productId: r.target.id, category: r.target.category, name: productLabel(r.target),
        usage: r.choice.usage, count: r.choice.count, start: s.start, end: endOf(s.start, r.per.n, r.per.unit),
        price: 0, source: "gift_auto", paymentId: null, uses: [],
        gift: { paymentId: pid, productId: product.id, optionId: option.id, sourceCategory: product.category, sourceTitle: payment.title, chainedAfter: s.after || null },
      };
      g.status = statusOf(g.start, g.end, today);
      state.memberships.push(g);
      gifts.push(g);
      state.logs.push({ at: today, type: "gift_grant", paymentId: pid, memberId, membershipId: g.id,
        text: `자동 증정 발급 — ${g.name} ${periodLabel(r.per.n, r.per.unit)} · ${usageLabel(g)} (${g.start}~${g.end})${s.chained ? ` · 기존 ${g.category} 종료(${s.after}) 다음 날부터` : ""} · 출처 ${payment.title}` });
    }
    return { payment, purchase, gifts };
  }

  // 환불·취소 → 원 결제 멤버십 + 그 결제로 나간 증정분 회수. 이미 회수된 건은 다시 회수하지 않는다.
  function refundPayment(state, paymentId, { today, reason = "환불", by = "관리자" }) {
    const pay = state.payments.find((p) => p.id === paymentId);
    if (!pay || pay.status !== "paid") return { revoked: [] };
    pay.status = reason === "결제취소" ? "cancelled" : "refunded";
    pay.refundedAt = today;
    for (const m of state.memberships) if (m.paymentId === paymentId && LIVE.concat("expired").includes(m.status)) m.status = "refunded";
    const revoked = [];
    for (const m of state.memberships) {
      if (m.source !== "gift_auto" || !m.gift || m.gift.paymentId !== paymentId || m.status === "revoked") continue;
      const was = m.status;
      const u = usageState(m, today);
      // 회수 시점 사용 횟수를 남겨 분쟁 대비 (D2: 쓰기 시작한 증정도 회수)
      m.revokeUsage = { usage: m.usage, count: m.count, used: u.used, lastUse: (m.uses || []).slice(-1)[0] || null };
      m.status = "revoked"; m.revokedAt = today; m.revokeReason = `원 결제 ${reason}`; m.revokedFrom = was;
      revoked.push(m);
      state.logs.push({ at: today, type: "gift_revoke", paymentId, memberId: m.memberId, membershipId: m.id,
        text: `자동 증정 회수 — ${m.name} (${m.start}~${m.end}, 회수 전 상태 ${STATUS_KO[was]}, 이용횟수 ${usageLabel(m)} 중 ${u.used}회 사용) · 사유 원 결제 ${reason} · 처리 ${by}` });
    }
    return { payment: pay, revoked };
  }

  // 매출 = 결제 금액 합 − 환불. 증정은 결제가 없으므로 들어갈 길이 없지만, 막아 두려고 source로 한 번 더 거른다.
  function sales(state) {
    const paid = state.payments.filter((p) => p.status === "paid");
    const refunded = state.payments.filter((p) => p.status !== "paid");
    const giftCount = state.memberships.filter((m) => m.source === "gift_auto" && m.status !== "revoked").length;
    const msRevenue = state.memberships.filter((m) => m.source === "purchase" && m.status !== "refunded").reduce((a, m) => a + m.price, 0);
    return { gross: paid.reduce((a, p) => a + p.amount, 0) + refunded.reduce((a, p) => a + p.amount, 0),
      refund: refunded.reduce((a, p) => a + p.amount, 0), net: paid.reduce((a, p) => a + p.amount, 0), msRevenue, giftCount };
  }

  function optionTitle(o) {
    if (o.usage === "period") return `${o.count}회 · ${o.period}${o.unit}`;
    return `${o.period}${o.unit} · ${usageLabel(o)}`;
  }

  const STATUS_KO = { active: "이용 중", scheduled: "시작 전", expired: "만료", refunded: "환불", cancelled: "결제취소", revoked: "회수", paid: "결제완료" };

  root.GiftEngine = { endOf, addDays, usageChoices, usageLabel, usageKey, resolveChoice, usageState, recordUse, USAGE_KO, giftPeriod, canGift, giftStart, resolveGifts, previewGifts,
    completePayment, refundPayment, sales, productLabel, periodLabel, optionTitle, STATUS_KO, statusOf };
})(typeof module !== "undefined" ? module.exports : window);

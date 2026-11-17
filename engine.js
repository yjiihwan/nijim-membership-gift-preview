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

  function usageLabel(u) {
    if (u.usage === "unlimited") return "무제한 이용";
    if (u.usage === "daily") return `하루 ${u.count}회 이용`;
    return `${u.count}회 이용`;
  }

  // 증정 대상 멤버십의 «이용 조건» 후보 = 대상 판매설정의 가격 줄들에 있는 (유형·횟수) 조합
  function usageChoices(target) {
    const seen = new Map();
    for (const o of target.options) {
      const k = `${o.usage}:${o.count}`;
      if (!seen.has(k)) seen.set(k, { key: k, usage: o.usage, count: Number(o.count), label: usageLabel(o) });
    }
    return [...seen.values()];
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
        const choice = usageChoices(target).find((c) => c.key === g.usageKey) || usageChoices(target)[0];
        if (!choice) return { gift: g, error: "증정 대상 멤버십에 가격 줄이 없습니다" };
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
      price: payment.amount, source: "purchase", paymentId: pid, gift: null,
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
        price: 0, source: "gift_auto", paymentId: null,
        gift: { paymentId: pid, productId: product.id, optionId: option.id, sourceCategory: product.category, sourceTitle: payment.title, chainedAfter: s.after || null },
      };
      g.status = statusOf(g.start, g.end, today);
      state.memberships.push(g);
      gifts.push(g);
      state.logs.push({ at: today, type: "gift_grant", paymentId: pid, memberId, membershipId: g.id,
        text: `자동 증정 발급 — ${g.name} ${periodLabel(r.per.n, r.per.unit)} (${g.start}~${g.end})${s.chained ? ` · 기존 ${g.category} 종료(${s.after}) 다음 날부터` : ""} · 출처 ${payment.title}` });
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
      m.status = "revoked"; m.revokedAt = today; m.revokeReason = `원 결제 ${reason}`;
      revoked.push(m);
      state.logs.push({ at: today, type: "gift_revoke", paymentId, memberId: m.memberId, membershipId: m.id,
        text: `자동 증정 회수 — ${m.name} (${m.start}~${m.end}, 회수 전 상태 ${STATUS_KO[was]}) · 사유 원 결제 ${reason} · 처리 ${by}` });
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
    if (o.usage === "daily") return `${o.period}${o.unit} · 하루 ${o.count}회`;
    return `${o.period}${o.unit} · 무제한`;
  }

  const STATUS_KO = { active: "이용 중", scheduled: "시작 전", expired: "만료", refunded: "환불", cancelled: "결제취소", revoked: "회수", paid: "결제완료" };

  root.GiftEngine = { endOf, addDays, usageChoices, usageLabel, giftPeriod, canGift, giftStart, resolveGifts, previewGifts,
    completePayment, refundPayment, sales, productLabel, periodLabel, optionTitle, STATUS_KO, statusOf };
})(typeof module !== "undefined" ? module.exports : window);

/* 시안용 더미 데이터 — 형 캡처(판매설정 헬스·PT, 고객 구매 화면) 값을 그대로 옮김 */
(function (root) {
  const opt = (id, period, unit, usage, count, listPrice, price, gifts) => ({ id, period, unit, usage, count, listPrice, price, gifts: gifts || [] });
  const SAME_HEALTH = [{ targetProductId: "p_health", periodMode: "same", periodValue: 1, periodUnit: "개월", usageKey: "unlimited:2" }];

  function seed({ withGifts = true, withExistingHealth = true } = {}) {
    const g = (x) => (withGifts ? JSON.parse(JSON.stringify(x)) : []);
    const products = [
      { id: "p_health", category: "헬스", name: "", visible: true, group: false, timeLimit: false, payType: "normal", options: [
        opt("h1", 1, "개월", "unlimited", 2, 90000, 90000),
        opt("h2", 2, "개월", "unlimited", 2, 170000, 140000),
        opt("h3", 3, "개월", "unlimited", 2, 190000, 190000),
        opt("h5", 5, "개월", "unlimited", 2, 280000, 250000),
      ] },
      { id: "p_pt_event", category: "PT", name: "1:1 PT(막판 질주 이벤트)", visible: true, group: false, timeLimit: false, payType: "normal", options: [
        opt("e6", 1, "개월", "period", 6, 510000, 390000, g(SAME_HEALTH)),
        opt("e12", 2, "개월", "period", 12, 1020000, 760000, g(SAME_HEALTH)),
        opt("e18", 3, "개월", "period", 18, 1530000, 1110000, g(SAME_HEALTH)),
      ] },
      { id: "p_pt", category: "PT", name: "1:1 PT", visible: true, group: false, timeLimit: false, payType: "normal", options: [
        opt("t1", 1, "일", "daily", 1, 85000, 85000),
        opt("t10", 1, "개월", "period", 10, 650000, 650000, g(SAME_HEALTH)),
        opt("t20", 2, "개월", "period", 20, 1200000, 1200000, g(SAME_HEALTH)),
        opt("t30", 3, "개월", "period", 30, 1650000, 1650000, g(SAME_HEALTH)),
      ] },
      { id: "p_pila", category: "필라테스", name: "그룹 필라테스 정기구독", visible: true, group: false, timeLimit: false, payType: "sub", options: [
        opt("s1", 1, "개월", "period", 8, 99000, 99000),
      ] },
    ];
    const members = [{ id: "u1", name: "김니짐", phone: "010-****-1234" }];
    const memberships = [], payments = [], logs = [];
    if (withExistingHealth) {
      payments.push({ id: "pay_seed1", memberId: "u1", productId: "p_health", optionId: "h2", amount: 140000, status: "paid", paidAt: "2026-10-21", title: "헬스 2개월 · 무제한" });
      memberships.push({ id: "ms_seed1", memberId: "u1", productId: "p_health", category: "헬스", name: "헬스", usage: "unlimited", count: 2,
        start: "2026-10-21", end: "2026-12-20", price: 140000, source: "purchase", paymentId: "pay_seed1", gift: null, status: "active" });
    }
    return { products, members, memberships, payments, logs };
  }

  root.GiftSeed = { seed, TODAY: "2026-11-17" };
})(typeof module !== "undefined" ? module.exports : window);

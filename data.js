/* 시안용 더미 데이터 — 형 캡처(판매설정, 옵션선택·결제진행) 값을 옮김.
   이용횟수 제한 usage: unlimited(무제한) / daily(하루 n회) / weekly(주 n회) / monthly(월 n회) / period(기간 내 n회) */
(function (root) {
  const opt = (id, period, unit, usage, count, listPrice, price, gifts) => ({ id, period, unit, usage, count: usage === "unlimited" ? 0 : count, listPrice, price, gifts: gifts || [] });
  const SAME_HEALTH = [{ targetProductId: "p_health", periodMode: "same", periodValue: 1, periodUnit: "개월", usageKey: "daily:1" }];
  const LONG_GIFTS = [
    { targetProductId: "p_premium", periodMode: "same", periodValue: 1, periodUnit: "개월", usageKey: "unlimited:0" },
    { targetProductId: "p_gx", periodMode: "custom", periodValue: 1, periodUnit: "개월", usageKey: "weekly:2" },
  ];

  function seed({ withGifts = true, withExistingHealth = true } = {}) {
    const g = (x) => (withGifts ? JSON.parse(JSON.stringify(x)) : []);
    const products = [
      { id: "p_health", category: "헬스", name: "", visible: true, group: false, timeLimit: false, payType: "normal", options: [
        opt("h1", 1, "개월", "daily", 1, 90000, 90000),
        opt("h2", 2, "개월", "daily", 1, 170000, 140000),
        opt("h3", 3, "개월", "unlimited", 0, 190000, 190000),
        opt("h5", 5, "개월", "unlimited", 0, 280000, 250000),
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
      // 긴 이름·«기간 내 20회»·무제한/주 n회 증정 2개를 한 번에 보려는 시험용 상품
      { id: "p_long", category: "PT", name: "바디프로필 집중 케어 PT + 체형분석 패키지(재등록 고객 전용)", visible: true, group: false, timeLimit: false, payType: "normal", options: [
        opt("L20", 2, "개월", "period", 20, 1600000, 1280000, g(LONG_GIFTS)),
      ] },
      { id: "p_premium", category: "헬스", name: "헬스+사우나 프리미엄 무제한 이용권(운동복·개인락카 포함)", visible: false, group: false, timeLimit: false, payType: "normal", options: [
        opt("pm1", 1, "개월", "unlimited", 0, 150000, 150000),
        opt("pm3", 3, "개월", "unlimited", 0, 390000, 390000),
      ] },
      { id: "p_gx", category: "GX", name: "GX 그룹수업(요가·스피닝)", visible: true, group: false, timeLimit: false, payType: "normal", options: [
        opt("g1", 1, "개월", "weekly", 2, 80000, 80000),
        opt("g3", 3, "개월", "monthly", 12, 210000, 210000),
      ] },
      { id: "p_pila", category: "필라테스", name: "그룹 필라테스 정기구독", visible: true, group: false, timeLimit: false, payType: "sub", options: [
        opt("s1", 1, "개월", "monthly", 8, 99000, 99000),
      ] },
    ];
    const members = [{ id: "u1", name: "김니짐", phone: "010-****-1234" }];
    const memberships = [], payments = [], logs = [];
    if (withExistingHealth) {
      payments.push({ id: "pay_seed1", memberId: "u1", productId: "p_health", optionId: "h2", amount: 140000, status: "paid", paidAt: "2026-10-21", title: "헬스 2개월 · 하루 1회" });
      memberships.push({ id: "ms_seed1", memberId: "u1", productId: "p_health", category: "헬스", name: "헬스", usage: "daily", count: 1,
        start: "2026-10-21", end: "2026-12-20", price: 140000, source: "purchase", paymentId: "pay_seed1", gift: null, status: "active", uses: ["2026-11-14", "2026-11-16"] });
    }
    return { products, members, memberships, payments, logs };
  }

  // 옵션선택 «기타옵션» (형 캡처: 운동복·개인락카 — 멤버십 기간과 같은 기간, 월 5,000원)
  const EXTRAS = [{ id: "wear", name: "운동복", monthly: 5000 }, { id: "locker", name: "개인락카", monthly: 5000 }];

  root.GiftSeed = { seed, TODAY: "2026-11-17", START: "2026-11-27", CENTER: "엔짐 답십리점", POINT_RATE: 0.012, EXTRAS };
})(typeof module !== "undefined" ? module.exports : window);

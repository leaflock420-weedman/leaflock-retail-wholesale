(function () {
  if (document.body.dataset.admin === "true") return;

  const KEY = "ll_analytics_sid";
  let sessionId = sessionStorage.getItem(KEY);
  if (!sessionId) {
    sessionId = (crypto.randomUUID && crypto.randomUUID()) || `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(KEY, sessionId);
  }

  function payload(type, extra) {
    const params = new URLSearchParams(location.search);
    const utm = {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach((k) => {
      if (params.get(k)) utm[k] = params.get(k);
    });
    return {
      type,
      path: location.pathname + location.search,
      referrer: document.referrer || "",
      utm,
      sessionId,
      ts: Date.now(),
      ...extra,
    };
  }

  function send(data) {
    const body = JSON.stringify(data);
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/analytics/collect", blob);
      return;
    }
    fetch("/api/analytics/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  }

  send(payload("pageview"));

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-track]");
    if (!target) return;
    send(payload("event", { eventName: target.dataset.track }));
  });
})();
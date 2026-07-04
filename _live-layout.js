(function () {
  const active = document.body.dataset.nav || "";

  function link(href, label, key) {
    const current = active === key ? ' aria-current="page"' : "";
    return `<a href="${href}"${current}>${label}</a>`;
  }

  window.renderLeafLockLayout = function renderLeafLockLayout() {
    const header = document.getElementById("site-header");
    const footer = document.getElementById("site-footer");
    if (!header || !footer) return;

    if (!document.querySelector('link[rel="icon"]')) {
      const icon = document.createElement("link");
      icon.rel = "icon";
      icon.type = "image/svg+xml";
      icon.href = "assets/brand/favicon.svg";
      document.head.appendChild(icon);
    }

    header.innerHTML = `
      <a class="brand" href="index.html" aria-label="LeafLock Retail Stockist Wholesale home">
        <img class="brand-logo" src="assets/brand/leaflock-logo.png" alt="" width="120" height="32">
        <span class="brand-text"><strong>LeafLock</strong><small>Retail Stockist Wholesale</small></span>
      </a>
      <nav class="main-nav" aria-label="Primary navigation">
        ${link("index.html", "Home", "home")}
        ${link("humidity-packs.html", "Humidity Packs", "humidity")}
        ${link("gummies.html", "Gummies", "gummies")}
        ${link("request-access.html", "Request Access", "access")}
        ${link("portal.html", "Wholesale Portal", "portal")}
        ${link("lab-disclosure.html", "Lab Disclosure", "lab")}
      </nav>
      <a class="header-action" href="portal.html">Retail stockist login</a>`;

    footer.innerHTML = `
      <div class="footer-col">
        <strong>LeafLock Retail Stockist Wholesale</strong>
        <p>Surfers Paradise, QLD 4217</p>
      </div>
      <div class="footer-col">
        <a href="humidity-packs.html">Humidity Packs</a>
        <a href="gummies.html">DIY Gummy Mix</a>
        <a href="request-access.html">Request wholesale access</a>
        <a href="portal.html">Approved retail stockist portal</a>
      </div>
      <div class="footer-col">
        <a href="lab-disclosure.html">Laboratory disclosure</a>
        <a href="mailto:info@leaflock.com.au">info@leaflock.com.au</a>
        <a href="tel:+61431295201">0431 295 201</a>
      </div>
      <p class="footer-disclaimer">
        General product information only. Not medical advice. Wholesale pricing and ordering available to approved Australian retail stockist accounts.
        See <a href="lab-disclosure.html">lab disclosure</a> for testing data and limitations.
      </p>`;
  };

  renderLeafLockLayout();

  if (document.body.dataset.admin !== "true") {
    const script = document.createElement("script");
    script.src = "assets/analytics.js";
    script.defer = true;
    document.body.appendChild(script);

    const gaId = window.LEAFLOCK_WHOLESALE?.GA_MEASUREMENT_ID;
    if (gaId) {
      const loader = document.createElement("script");
      loader.async = true;
      loader.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
      document.head.appendChild(loader);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function gtag() { window.dataLayer.push(arguments); };
      window.gtag("js", new Date());
      window.gtag("config", gaId, { anonymize_ip: true });
    }
  }
})();
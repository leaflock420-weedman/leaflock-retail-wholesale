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
      <div class="header-brand-wrap">
        <a class="brand" href="index.html" aria-label="Pharmacy Wholesale home">
          <img class="brand-logo" src="assets/brand/leaflock-logo.png" alt="" width="120" height="32">
          <span class="brand-text">Pharmacy Wholesale</span>
        </a>
      </div>
      <nav class="main-nav" aria-label="Primary navigation">
        ${link("index.html", "Home", "home")}
        ${link("humidity-packs.html", "<span class=\"nav-long\">Humidity Packs</span><span class=\"nav-short\">Humidity</span>", "humidity")}
        ${link("gummies.html", "Gummies", "gummies")}
        ${link("request-access.html", "<span class=\"nav-long\">Request Access</span><span class=\"nav-short\">Access</span>", "access")}
        ${link("portal.html", "<span class=\"nav-long\">Wholesale Portal</span><span class=\"nav-short\">Portal</span>", "portal")}
        ${link("lab-disclosure.html", "<span class=\"nav-long\">Lab Disclosure</span><span class=\"nav-short\">Lab</span>", "lab")}
      </nav>
      <a class="header-action" href="portal.html">Pharmacy login</a>`;

    footer.innerHTML = `
      <div class="footer-col">
        <strong>LeafLock Pharmacy Wholesale</strong>
        <p>Surfers Paradise, QLD 4217</p>
      </div>
      <div class="footer-col">
        <a href="humidity-packs.html">Humidity Packs</a>
        <a href="gummies.html">DIY Gummy Mix</a>
        <a href="request-access.html">Request wholesale access</a>
        <a href="portal.html">Approved pharmacy portal</a>
      </div>
      <div class="footer-col">
        <a href="lab-disclosure.html">Laboratory disclosure</a>
        <a href="mailto:med@leaflock.com.au">med@leaflock.com.au</a>
        <a href="tel:+61431295201">0431 295 201</a>
      </div>
      <p class="footer-tm">LeafLock<sup class="tm-mark">TM</sup> No. 2594215 (Classes 5 &amp; 16) · LeafLock &amp; Co Pty Ltd ACN 676 132 531</p>
      <p class="footer-disclaimer">
        General product information only. Not medical advice. Wholesale pricing and ordering available to approved Australian pharmacy accounts.
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
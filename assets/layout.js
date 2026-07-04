(function () {
  const active = document.body.dataset.nav || "";

  function link(href, label, key) {
    const current = active === key ? ' aria-current="page"' : "";
    return `<a href="${href}"${current}>${label}</a>`;
  }

  function ensureMarquee(header) {
    let marquee = document.getElementById("site-marquee");
    if (!marquee) {
      marquee = document.createElement("div");
      marquee.id = "site-marquee";
      marquee.className = "site-marquee";
      header.parentNode.insertBefore(marquee, header);
    }
    marquee.setAttribute("aria-hidden", "true");
    marquee.innerHTML = `
      <div class="site-marquee__track">
        <span class="site-marquee__item">Approved retail store accounts only</span>
        <span class="site-marquee__item">Request access for wholesale pricing</span>
        <span class="site-marquee__item">Portal ordering after verification</span>
        <span class="site-marquee__item">Bulk supply available on request</span>
        <span class="site-marquee__item">Approved retail store accounts only</span>
        <span class="site-marquee__item">Request access for wholesale pricing</span>
        <span class="site-marquee__item">Portal ordering after verification</span>
        <span class="site-marquee__item">Bulk supply available on request</span>
      </div>`;
  }

  function removeCategories() {
    const categories = document.getElementById("site-categories");
    if (categories) categories.remove();
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

    ensureMarquee(header);
    removeCategories();

    header.innerHTML = `
      <a class="brand" href="index.html" aria-label="LeafLock Retail Store Wholesale">
        <img class="brand-logo" src="assets/demo/leaflock-logo-main.png" alt="LeafLock" width="240" height="64">
      </a>
      <nav class="main-nav" aria-label="Primary navigation">
        ${link("index.html", "Home", "home")}
        ${link("request-access.html", "<span class=\"nav-long\">Request Access</span><span class=\"nav-short\">Access</span>", "access")}
        ${link("portal.html", "<span class=\"nav-long\">Wholesale Portal</span><span class=\"nav-short\">Portal</span>", "portal")}
      </nav>
      <a class="header-action" href="portal.html">Retail store login</a>`;

    footer.innerHTML = `
      <div class="footer-col">
        <strong>LeafLock Retail Store Wholesale</strong>
        <p>Surfers Paradise, QLD 4217</p>
      </div>
      <div class="footer-col">
        <a href="request-access.html">Request wholesale access</a>
        <a href="portal.html">Approved retail store portal</a>
      </div>
      <div class="footer-col">
        <a href="mailto:info@leaflock.com.au">info@leaflock.com.au</a>
        <a href="tel:+61431295201">0431 295 201</a>
      </div>
      <div class="footer-col footer-col--legal">
        <a href="wholesale-terms.html">Wholesale terms</a>
        <a href="credit-application.html">Credit application</a>
        <a href="privacy-policy.html">Privacy</a>
        <a href="refunds-returns.html">Refunds &amp; returns</a>
        <a href="help.html">Owner guide</a>
      </div>
      <p class="footer-disclaimer">
        General product information only. Not medical advice. Wholesale pricing and ordering available to approved Australian retail store accounts. Goods remain property of LeafLock™ until paid in full.
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
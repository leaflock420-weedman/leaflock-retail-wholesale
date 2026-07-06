const TOKEN_KEY = "ll_analytics_token";

const loginScreen = document.getElementById("loginScreen");
const dashboard = document.getElementById("dashboard");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");

function token() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(value) {
  if (value) localStorage.setItem(TOKEN_KEY, value);
  else localStorage.removeItem(TOKEN_KEY);
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token()}`,
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (res.status === 204) return null;
  return res.json();
}

function fmtDate(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-AU");
}

function fmtMoney(n) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n || 0);
}

function renderTable(tbody, rows, mapRow) {
  tbody.innerHTML = rows.length
    ? rows.map(mapRow).join("")
    : '<tr><td colspan="6">No records yet.</td></tr>';
}

function renderDailyChart(container, daily) {
  const max = Math.max(...daily.map((d) => d.count), 1);
  container.innerHTML = daily
    .map((d) => {
      const height = Math.max(8, Math.round((d.count / max) * 120));
      return `<div class="bar-col"><strong>${d.count}</strong><div class="bar" style="height:${height}px"></div><span>${d.label}</span></div>`;
    })
    .join("");
}

function setupPasswordUrl(token) {
  const base = window.location.origin;
  return `${base}/set-password.html?token=${encodeURIComponent(token)}`;
}

function showLinkModal(url, label = "Link", description = "Copy this link and email it to the retail stockist if SMTP did not send automatically.") {
  const modal = document.getElementById("codeModal");
  const codeEl = document.getElementById("generatedCode");
  const title = modal?.querySelector("h2");
  const desc = modal?.querySelector("p");
  const copyBtn = document.getElementById("copyCodeBtn");
  if (title) title.textContent = label;
  if (desc) desc.textContent = description;
  if (codeEl) codeEl.textContent = url;
  if (copyBtn) copyBtn.textContent = "Copy link";
  if (modal) modal.hidden = false;
}

function showSetupLinkModal(token, label = "Password setup link") {
  showLinkModal(
    setupPasswordUrl(token),
    label,
    "Copy this one-time password setup link and email it to the retail stockist if SMTP did not send automatically.",
  );
}

function showCheckoutLinkModal(checkoutLink, businessName = "Retail stockist") {
  showLinkModal(
    checkoutLink,
    `Gummy checkout link — ${businessName}`,
    "Each stockist has a unique private link. Copy and paste into gummy campaign emails. Regenerating invalidates the old link.",
  );
}

document.getElementById("closeCodeModal")?.addEventListener("click", () => {
  document.getElementById("codeModal").hidden = true;
});

document.getElementById("copyCodeBtn")?.addEventListener("click", async () => {
  const code = document.getElementById("generatedCode")?.textContent || "";
  try {
    await navigator.clipboard.writeText(code);
    const btn = document.getElementById("copyCodeBtn");
    btn.textContent = "Copied ✓";
    setTimeout(() => { btn.textContent = "Copy code"; }, 2000);
  } catch {
    alert("Copy failed — select the code and copy manually.");
  }
});

function renderSetupStatus(status) {
  const list = document.getElementById("setupStatus");
  if (!list) return;
  const items = [
    { ok: status.paypal, label: status.paypal ? `PayPal ${status.paypalMode} checkout enabled` : "PayPal not configured" },
    { ok: status.paypalMode === "live", label: status.paypalMode === "live" ? "PayPal LIVE (real payments)" : "PayPal sandbox — set PAYPAL_MODE=live + live credentials for production" },
    { ok: status.email, label: status.email ? "Email notifications enabled" : "SMTP not set — approve codes shown in popup only" },
    { ok: status.smtpConfigured, label: status.smtpConfigured ? "SMTP credentials configured" : "Set SMTP_PASS on Render for info@ sending" },
    { ok: status.portalSalt, label: status.portalSalt ? "Portal code encryption active" : "Set PORTAL_CODE_SALT on Render" },
    { ok: status.adminPasswordFromEnv, label: status.adminPasswordFromEnv ? "Admin password from env var" : "Using default admin password" },
    { ok: status.portalSessionSecret, label: status.portalSessionSecret ? "Portal sessions secured" : "Set PORTAL_SESSION_SECRET on Render" },
    { ok: status.adminSessionSecret, label: status.adminSessionSecret ? "Admin sessions signed (survive restarts)" : "Set ADMIN_SESSION_SECRET on Render" },
    { ok: status.httpsOnly, label: status.httpsOnly ? "HTTPS security headers active" : "Dev mode" },
    { ok: status.complianceDocuments, label: status.complianceDocuments ? "Compliance PDFs ready (NDA + pack + TM cert)" : "Compliance PDFs missing on server" },
    { ok: (status.catalogItems || 0) > 0, label: `Order form catalogue: ${status.catalogItems || 0} products (${status.catalogSource || "unknown"})` },
    { ok: status.auspostPac, label: status.auspostPac ? `Australia Post PAC connected (from ${status.auspostFromPostcode || "4217"})` : "Australia Post PAC not set" },
    { ok: true, label: "Secrets: Render env only — never paste keys in chat or GitHub" },
    { ok: true, label: "Wholesale prices: portal login & private checkout links only (not public SEO)" },
  ];
  list.innerHTML = items
    .map((i) => `<li><span class="${i.ok ? "setup-ok" : "setup-warn"}">${i.ok ? "✓" : "!"}</span> ${i.label}</li>`)
    .join("");
}

async function refreshTraffic() {
  const live = await api("/api/analytics/live");
  const week = await api("/api/analytics/summary?days=7");

  document.getElementById("liveVisitors").textContent = live.liveVisitors;
  document.getElementById("pageviewsToday").textContent = live.pageviews;
  document.getElementById("sessionsToday").textContent = live.uniqueSessions;
  document.getElementById("portalViews").textContent = live.portalViews;
  document.getElementById("accessViews").textContent = live.accessRequests;
  document.getElementById("lastUpdated").textContent = `Updated ${new Date().toLocaleString("en-AU")}`;

  document.getElementById("highlights").innerHTML = week.highlights.map((h) => `<li>${h}</li>`).join("");

  renderTable(
    document.getElementById("topPages"),
    week.topPages,
    (r) => `<tr><td>${r.path}</td><td>${r.count}</td></tr>`,
  );
  renderTable(
    document.getElementById("topSources"),
    week.topSources,
    (r) => `<tr><td>${r.source}</td><td>${r.count}</td></tr>`,
  );
  renderDailyChart(document.getElementById("dailyChart"), week.daily);
}

async function approveApplication(id) {
  if (!confirm("Approve this stockist? They will get an email to set their password, then can log in and order anytime.")) return;
  const result = await api(`/api/admin/applications/${id}/approve`, { method: "POST" });
  await refreshWholesale();
  if (result.setupToken) showSetupLinkModal(result.setupToken, "Account approved — password setup link");
  await showOrderFormPreviewForStockist({
    businessName: result.application?.businessName,
    email: result.application?.email,
    emailSent: result.emailSent,
    needsManualSetup: !result.emailSent && Boolean(result.setupToken),
  });
}

async function rejectApplication(id) {
  if (!confirm("Reject this application?")) return;
  await api(`/api/admin/applications/${id}/reject`, { method: "POST" });
  await refreshWholesale();
}

async function sendPasswordReset(id) {
  if (!confirm("Send a password reset link to this retail stockist?")) return;
  const result = await api(`/api/admin/pharmacies/${id}/send-password-reset`, { method: "POST" });
  if (result.setupToken) showSetupLinkModal(result.setupToken, "Password reset link");
  if (result.emailSent) {
    alert(`Reset link emailed to ${result.retailStockist?.email || result.pharmacy?.email}`);
  } else {
    alert("Copy the reset link and email it manually (SMTP not configured).");
  }
  await refreshWholesale();
}

async function toggleRetailStockistStatus(id, currentStatus) {
  const next = currentStatus === "active" ? "inactive" : "active";
  await api(`/api/admin/pharmacies/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: next }),
  });
  await refreshWholesale();
}

async function updateOrderStatus(id, status) {
  await api(`/api/admin/orders/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  await refreshWholesale();
}

function openAddStockistModal() {
  const modal = document.getElementById("addStockistModal");
  const form = document.getElementById("addStockistForm");
  form?.reset();
  if (modal) modal.hidden = false;
}

function closeAddStockistModal() {
  const modal = document.getElementById("addStockistModal");
  if (modal) modal.hidden = true;
}

async function submitAddStockistForm(event) {
  event.preventDefault();
  const form = event.target;
  const businessName = form.businessName?.value?.trim();
  const email = form.email?.value?.trim();
  if (!businessName || !email) return;
  const result = await api("/api/admin/pharmacies", {
    method: "POST",
    body: JSON.stringify({
      businessName,
      email,
      contactName: form.contactName?.value?.trim() || "",
      abn: form.abn?.value?.trim() || "",
      phone: form.phone?.value?.trim() || "",
    }),
  });
  closeAddStockistModal();
  await refreshWholesale();
  if (result.setupToken) showSetupLinkModal(result.setupToken, "New account — password setup link");
  await showOrderFormPreviewForStockist({
    businessName,
    email,
    emailSent: result.emailSent,
    needsManualSetup: !result.emailSent && Boolean(result.setupToken),
  });
}

async function refreshWholesale() {
  const [summary, setup, apps] = await Promise.all([
    api("/api/admin/wholesale/summary"),
    api("/api/admin/setup-status"),
    api("/api/admin/applications"),
  ]);
  renderSetupStatus(setup);
  const postagePanel = document.getElementById("postagePanel");
  if (postagePanel) postagePanel.hidden = !setup.auspostPac;
  renderCatalogStatus({
    items: setup.catalogItems,
    categories: setup.catalogCategories,
    source: setup.catalogSource,
    updatedAt: null,
  });
  try {
    const catalogInfo = await api("/api/admin/catalog/info");
    renderCatalogStatus(catalogInfo);
  } catch {
    /* keep setup-status summary */
  }
  const stockistList = await api("/api/admin/pharmacies");
  const orders = await api("/api/admin/orders");
  const loginLog = await api("/api/admin/login-log?limit=50");

  document.getElementById("pendingApps").textContent = summary.pendingApplications;
  document.getElementById("activePharmacies").textContent = summary.activePharmacies;
  document.getElementById("ordersToday").textContent = summary.orders.ordersToday;
  document.getElementById("loginsToday").textContent = summary.loginsToday;

  const appsBody = document.getElementById("applicationsTable");
  renderTable(
    appsBody,
    apps.applications,
    (a) => {
      const actions =
        a.status === "pending"
          ? `<button class="btn-inline" data-action="approve-app" data-id="${a.id}">Approve</button>
             <button class="btn-inline btn-muted" data-action="reject-app" data-id="${a.id}">Reject</button>`
          : "";
      const extras = a.bulk === "yes" ? "bulk supply" : "";
      return `<tr>
        <td>${fmtDate(a.createdAt)}</td>
        <td>${a.businessName}${extras ? `<br><small>${extras}</small>` : ""}</td>
        <td>${a.fullName}<br><small>${a.abn} · ${a.pharmacyReg}</small></td>
        <td>${a.email}</td>
        <td><span class="badge badge--${a.status}">${a.status}</span></td>
        <td>${actions}</td>
      </tr>`;
    },
  );

  const pharmBody = document.getElementById("pharmaciesTable");
  renderTable(
    pharmBody,
    stockistList.retailStockists || stockistList.pharmacies || [],
    (p) => `<tr>
      <td>${p.businessName}</td>
      <td>${p.email}</td>
      <td><span class="badge badge--${p.status}">${p.status}</span></td>
      <td>${p.loginCount || 0}</td>
      <td>${fmtDate(p.lastLoginAt)}</td>
      <td class="actions-cell">
        <button class="btn-inline" data-action="reset-password" data-id="${p.id}">Reset password</button>
        <button class="btn-inline btn-muted" data-action="toggle-status" data-id="${p.id}" data-status="${p.status}">${p.status === "active" ? "Deactivate" : "Activate"}</button>
      </td>
    </tr>`,
  );

  const ordersBody = document.getElementById("ordersTable");
  renderTable(
    ordersBody,
    orders.orders,
    (o) => `<tr>
      <td>${fmtDate(o.createdAt)}</td>
      <td>${o.pharmacyName || o.contact?.businessName || "—"}</td>
      <td>${fmtMoney(o.totals?.total)}</td>
      <td>${o.paymentMethod || "—"} / ${o.paymentStatus || "—"}</td>
      <td><span class="badge badge--${o.status}">${o.status}</span></td>
      <td>
        <select class="status-select" data-action="order-status" data-id="${o.id}">
          <option value="submitted" ${o.status === "submitted" ? "selected" : ""}>submitted</option>
          <option value="awaiting_payment" ${o.status === "awaiting_payment" ? "selected" : ""}>awaiting_payment</option>
          <option value="paid" ${o.status === "paid" ? "selected" : ""}>paid</option>
          <option value="processing" ${o.status === "processing" ? "selected" : ""}>processing</option>
          <option value="shipped" ${o.status === "shipped" ? "selected" : ""}>shipped</option>
          <option value="cancelled" ${o.status === "cancelled" ? "selected" : ""}>cancelled</option>
        </select>
      </td>
    </tr>`,
  );

  const logBody = document.getElementById("loginLogTable");
  renderTable(
    logBody,
    loginLog.entries,
    (e) => `<tr>
      <td>${fmtDate(e.ts)}</td>
      <td>${e.businessName || "—"}</td>
      <td>${e.success ? "✓ Success" : "✗ Failed"}</td>
    </tr>`,
  );
}

document.getElementById("tabWholesale")?.addEventListener("click", async (event) => {
  const btn = event.target.closest("[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;

  try {
    if (action === "approve-app") await approveApplication(id);
    else if (action === "reject-app") await rejectApplication(id);
    else if (action === "reset-password") await sendPasswordReset(id);
    else if (action === "toggle-status") await toggleRetailStockistStatus(id, btn.dataset.status);
  } catch (err) {
    alert(err.message || "Action failed");
  }
});

document.getElementById("tabWholesale")?.addEventListener("change", async (event) => {
  const select = event.target.closest('[data-action="order-status"]');
  if (!select) return;
  try {
    await updateOrderStatus(select.dataset.id, select.value);
  } catch (err) {
    alert(err.message || "Could not update order");
  }
});

function setOrderPreviewContext({ businessName, email, emailSent, needsManualSetup } = {}) {
  const el = document.getElementById("orderPreviewContext");
  if (!el) return;
  if (!businessName) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  const lines = [
    `<strong>${businessName}</strong>${email ? ` (${email})` : ""} approved — preview below is the order form they see after portal login.`,
  ];
  if (emailSent) lines.push("Password setup link emailed.");
  else if (needsManualSetup) lines.push("Copy the password setup link from the popup and email it to them.");
  el.innerHTML = lines.join(" ");
  el.hidden = false;
}

async function showOrderFormPreviewForStockist(ctx) {
  setOrderPreviewContext(ctx);
  switchTab("orderform");
  await refreshOrderPreview();
  document.getElementById("tabOrderform")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function refreshOrderPreview() {
  const body = document.getElementById("orderPreviewBody");
  const tiers = document.getElementById("volumePreviewBody");
  if (!body) return;
  body.innerHTML = '<tr><td colspan="6">Loading…</td></tr>';
  try {
    const pricing = await api("/api/admin/order-form-preview");
    const rows = [];
    for (const section of pricing.orderSheet || []) {
      rows.push(`<tr class="pricing-table__category"><td colspan="6"><strong>${section.label}</strong></td></tr>`);
      for (const item of section.items) {
        const img = item.image?.startsWith("http")
          ? item.image
          : `/${String(item.image || "").replace(/^\//, "")}`;
        rows.push(`<tr>
          <td>${item.sku}</td>
          <td class="portal-order-table__product"><img src="${img}" alt="" width="40" height="40" loading="lazy"><span>${item.name}</span></td>
          <td>${fmtMoney(item.wholesale)}</td>
          <td>${fmtMoney(item.rrp)}</td>
          <td>${item.moqLabel || "—"}</td>
          <td>${item.bulkNote || "—"}</td>
        </tr>`);
      }
    }
    body.innerHTML = rows.length ? rows.join("") : '<tr><td colspan="6">No products in catalogue.</td></tr>';
    if (tiers) {
      tiers.innerHTML = (pricing.volumeTiers || [])
        .map(
          (t) => `<tr>
            <td>${t.product}</td>
            <td>${fmtMoney(t.standard)}</td>
            <td>${t.threshold}</td>
            <td>${fmtMoney(t.volumePrice)}</td>
            <td>${t.applies}</td>
          </tr>`,
        )
        .join("");
    }
  } catch (err) {
    body.innerHTML = `<tr><td colspan="6">${err.message || "Could not load preview"}</td></tr>`;
  }
}

function switchTab(name) {
  document.querySelectorAll(".dash-tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.tab === name);
  });
  document.getElementById("tabTraffic").hidden = name !== "traffic";
  document.getElementById("tabWholesale").hidden = name !== "wholesale";
  document.getElementById("tabOrderform").hidden = name !== "orderform";
}

document.querySelectorAll(".dash-tab").forEach((tab) => {
  tab.addEventListener("click", async () => {
    switchTab(tab.dataset.tab);
    if (tab.dataset.tab === "wholesale") await refreshWholesale();
    if (tab.dataset.tab === "orderform") await refreshOrderPreview();
  });
});

function showDashboard() {
  loginScreen.hidden = true;
  dashboard.hidden = false;
}

function showLogin() {
  loginScreen.hidden = false;
  dashboard.hidden = true;
}

async function checkHost() {
  const warn = document.getElementById("hostWarning");

  try {
    const res = await fetch("/api/analytics/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "__ping__" }),
    });
    if ((res.status === 404 || res.status === 403) && warn) {
      warn.hidden = false;
      warn.innerHTML = `Admin API not available at <strong>${location.host}</strong>. DNS may still be propagating.`;
    }
  } catch {
    if (warn) {
      warn.hidden = false;
      warn.textContent = "Cannot reach admin API on this host.";
    }
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = document.getElementById("adminPassword").value;
  try {
    const res = await fetch("/api/analytics/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      loginError.hidden = false;
      if (res.status === 401) {
        loginError.textContent = "Incorrect password.";
      } else if (res.status === 404 || res.status === 403) {
        loginError.textContent = `Admin API unavailable on ${location.host}.`;
      } else {
        loginError.textContent = `Login failed (${res.status}).`;
      }
      return;
    }
    const data = await res.json();
    setToken(data.token);
    loginError.hidden = true;
    showDashboard();
    await refreshTraffic();
  } catch {
    loginError.hidden = false;
    loginError.textContent = "Cannot reach admin API.";
  }
});

checkHost();

document.getElementById("logoutBtn").addEventListener("click", () => {
  setToken(null);
  showLogin();
});

document.getElementById("sendReportBtn").addEventListener("click", async () => {
  const btn = document.getElementById("sendReportBtn");
  btn.disabled = true;
  btn.textContent = "Sending…";
  try {
    const res = await api("/api/analytics/send-report", { method: "POST" });
    btn.textContent = res.sent ? "Report emailed ✓" : "Email not configured";
  } catch {
    btn.textContent = "Failed to send";
  }
  setTimeout(() => {
    btn.disabled = false;
    btn.textContent = "Email report now";
  }, 3000);
});

function renderCatalogStatus(info) {
  const el = document.getElementById("catalogStatus");
  if (!el || !info) return;
  const sourceLabel =
    info.source === "uploaded"
      ? "saved spreadsheet on server"
      : info.source === "bundled"
        ? "default template"
        : "built-in fallback";
  const updated = info.updatedAt ? ` · last upload ${fmtDate(new Date(info.updatedAt).getTime())}` : "";
  el.textContent = `${info.items} products in ${info.categories} categories · ${sourceLabel}${updated}`;
  el.className = "foot-note catalog-status--ok";
}

document.getElementById("downloadCatalogBtn")?.addEventListener("click", async () => {
  const btn = document.getElementById("downloadCatalogBtn");
  btn.disabled = true;
  btn.textContent = "Downloading…";
  try {
    const res = await fetch("/api/admin/catalog/download", {
      headers: { Authorization: `Bearer ${token()}` },
    });
    if (!res.ok) throw new Error("download failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wholesale-catalog-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    alert("Could not download spreadsheet. Log in again and retry.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Download spreadsheet";
  }
});

document.getElementById("catalogFileInput")?.addEventListener("change", async (event) => {
  const input = event.target;
  const file = input.files?.[0];
  if (!file) return;
  const statusEl = document.getElementById("catalogStatus");
  if (statusEl) {
    statusEl.textContent = `Uploading ${file.name}…`;
    statusEl.className = "foot-note";
  }
  try {
    const csv = await file.text();
    const res = await fetch("/api/admin/catalog/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`,
      },
      body: JSON.stringify({ csv }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = Array.isArray(body.details) ? body.details.join(" ") : body.error || "Upload failed";
      throw new Error(detail);
    }
    if (statusEl) {
      statusEl.textContent = `Updated — ${body.itemCount} products live on the order form.`;
      statusEl.className = "foot-note catalog-status--ok";
    }
    await refreshWholesale();
  } catch (err) {
    if (statusEl) {
      statusEl.textContent = err.message || "Upload failed";
      statusEl.className = "foot-note catalog-status--err";
    }
  } finally {
    input.value = "";
  }
});

document.getElementById("postageQuoteBtn")?.addEventListener("click", async () => {
  const resultEl = document.getElementById("postageResult");
  const btn = document.getElementById("postageQuoteBtn");
  const toPostcode = document.getElementById("postageTo")?.value?.trim();
  if (!toPostcode) {
    if (resultEl) resultEl.textContent = "Enter a destination postcode.";
    return;
  }
  btn.disabled = true;
  btn.textContent = "Calculating…";
  try {
    const res = await fetch("/api/admin/postage/quote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`,
      },
      body: JSON.stringify({
        toPostcode,
        weight: Number(document.getElementById("postageWeight")?.value || 2),
        length: Number(document.getElementById("postageLength")?.value || 30),
        width: Number(document.getElementById("postageWidth")?.value || 25),
        height: Number(document.getElementById("postageHeight")?.value || 15),
      }),
    });
    const quote = await res.json();
    if (!res.ok) throw new Error(quote.error || "Quote failed");
    if (resultEl) {
      resultEl.textContent = `${quote.service}: $${quote.totalCost?.toFixed(2)} to ${quote.toPostcode}${quote.deliveryTime ? ` · ${quote.deliveryTime}` : ""}`;
      resultEl.className = "foot-note catalog-status--ok";
    }
  } catch (err) {
    if (resultEl) {
      resultEl.textContent = err.message || "Could not get postage estimate.";
      resultEl.className = "foot-note catalog-status--err";
    }
  } finally {
    btn.disabled = false;
    btn.textContent = "Get estimate";
  }
});

document.getElementById("refreshWholesaleBtn")?.addEventListener("click", refreshWholesale);
document.getElementById("refreshOrderPreviewBtn")?.addEventListener("click", refreshOrderPreview);
document.getElementById("addRetailStockistBtn")?.addEventListener("click", openAddStockistModal);
document.getElementById("addStockistForm")?.addEventListener("submit", submitAddStockistForm);
document.getElementById("closeAddStockistModal")?.addEventListener("click", closeAddStockistModal);

async function boot() {
  if (!token()) {
    showLogin();
    return;
  }
  try {
    showDashboard();
    await refreshTraffic();
    setInterval(refreshTraffic, 30000);
  } catch {
    setToken(null);
    showLogin();
  }
}

boot();
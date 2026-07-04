(function () {
  const TOKEN_KEY = "leaflock_portal_token";
  const PENDING_KEY = "leaflock_pharmacy_pending";
  let sessionPharmacy = null;

  function token() {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  function setToken(value) {
    if (value) sessionStorage.setItem(TOKEN_KEY, value);
    else sessionStorage.removeItem(TOKEN_KEY);
  }

  function isApproved() {
    return Boolean(token());
  }

  function pharmacy() {
    return sessionPharmacy;
  }

  function isPending() {
    return localStorage.getItem(PENDING_KEY) === "yes";
  }

  function setPending() {
    localStorage.setItem(PENDING_KEY, "yes");
  }

  function clearPending() {
    localStorage.removeItem(PENDING_KEY);
  }

  async function portalFetch(path, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };
    const t = token();
    if (t) headers.Authorization = `Bearer ${t}`;

    const res = await fetch(path, { ...options, headers });
    if (res.status === 401) {
      setToken(null);
      sessionPharmacy = null;
      throw new Error("unauthorized");
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Request failed");
    }
    if (res.status === 204) return null;
    return res.json();
  }

  async function loginWithCode(code) {
    const res = await fetch("/api/portal/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.error || "Invalid access code");
    }
    setToken(body.token);
    sessionPharmacy = body.pharmacy;
    clearPending();
    return body.pharmacy;
  }

  async function checkPortalApi() {
    const hint = document.getElementById("portalHostHint");
    try {
      const res = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "__probe__" }),
      });
      if (res.status === 401 || res.status === 400) return true;
      if (hint) {
        hint.hidden = false;
        hint.textContent = "Portal service unavailable on this URL. Contact LeafLock wholesale support.";
      }
      return false;
    } catch {
      if (hint) {
        hint.hidden = false;
        hint.textContent = "Cannot reach the portal service. Try again shortly or contact med@leaflock.com.au.";
      }
      return false;
    }
  }

  async function restoreSession() {
    if (!token()) return null;
    try {
      const data = await portalFetch("/api/portal/session");
      sessionPharmacy = data.pharmacy;
      return data.pharmacy;
    } catch {
      return null;
    }
  }

  async function logout() {
    try {
      await portalFetch("/api/portal/logout", { method: "POST" });
    } catch {
      /* session already invalid */
    }
    setToken(null);
    sessionPharmacy = null;
  }

  function protectGatedContent() {
    const gate = document.getElementById("accessGate");
    const content = document.getElementById("gatedContent");
    const pendingNote = document.getElementById("pendingNote");
    const sessionLabel = document.getElementById("portalSessionLabel");
    if (!gate || !content) return;

    if (isApproved() && sessionPharmacy) {
      gate.hidden = true;
      content.hidden = false;
      if (sessionLabel) {
        sessionLabel.textContent = `Logged in as ${sessionPharmacy.businessName}`;
      }
      return;
    }

    gate.hidden = false;
    content.hidden = true;
    if (pendingNote) pendingNote.hidden = !isPending();
  }

  function bindAccessForm() {
    const form = document.getElementById("accessLoginForm");
    const error = document.getElementById("accessError");
    if (!form) return;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const code = document.getElementById("accessCode")?.value || "";
      const btn = form.querySelector('button[type="submit"]');
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Signing in…";
      }
      try {
        await loginWithCode(code);
        if (error) error.hidden = true;
        protectGatedContent();
        document.dispatchEvent(new CustomEvent("leaflock:portal-login"));
      } catch (err) {
        if (error) {
          error.hidden = false;
          error.textContent =
            err.message === "Invalid access code" || err.message === "Unauthorized"
              ? "Invalid access code. Use the code from your approval email, or request access if you have not applied."
              : err.message || "Login failed. Please try again or email med@leaflock.com.au.";
        }
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = "Enter portal";
        }
      }
    });

    document.getElementById("accessLogout")?.addEventListener("click", async () => {
      await logout();
      protectGatedContent();
      document.dispatchEvent(new CustomEvent("leaflock:portal-logout"));
    });
  }

  async function boot() {
    await checkPortalApi();
    await restoreSession();
    protectGatedContent();
  }

  window.LeafLockAccess = {
    isApproved,
    isPending,
    setPending,
    pharmacy,
    portalFetch,
    loginWithCode,
    restoreSession,
    logout,
    protectGatedContent,
    bindAccessForm,
    boot,
  };
})();
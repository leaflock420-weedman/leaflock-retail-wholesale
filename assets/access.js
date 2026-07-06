(function () {
  const TOKEN_KEY = "leaflock_portal_token";
  const PENDING_KEY = "leaflock_retail_stockist_pending";
  let sessionRetailStockist = null;

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

  function retailStockist() {
    return sessionRetailStockist;
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

  function stockistFromBody(body) {
    return body?.retailStockist  || null;
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
      sessionRetailStockist = null;
      throw new Error("unauthorized");
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Request failed");
    }
    if (res.status === 204) return null;
    return res.json();
  }

  async function loginWithCredentials(email, password) {
    const res = await fetch("/api/portal/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.error || "Invalid email or password");
    }
    setToken(body.token);
    sessionRetailStockist = stockistFromBody(body);
    clearPending();
    return sessionRetailStockist;
  }

  async function checkPortalApi() {
    const hint = document.getElementById("portalHostHint");
    try {
      const res = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "__probe__", password: "__probe__" }),
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
        hint.textContent = "Cannot reach the portal service. Try again shortly or contact info@leaflock.com.au.";
      }
      return false;
    }
  }

  async function restoreSession() {
    if (!token()) return null;
    try {
      const data = await portalFetch("/api/portal/session");
      sessionRetailStockist = stockistFromBody(data);
      return sessionRetailStockist;
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
    sessionRetailStockist = null;
  }

  function protectGatedContent() {
    const gate = document.getElementById("accessGate");
    const content = document.getElementById("gatedContent");
    const pendingNote = document.getElementById("pendingNote");
    const sessionLabel = document.getElementById("portalSessionLabel");
    const accountPanel = document.getElementById("portalAccountPanel");
    if (!gate || !content) return;

    if (isApproved() && sessionRetailStockist) {
      gate.hidden = true;
      content.hidden = false;
      if (sessionLabel) {
        sessionLabel.textContent = `Logged in as ${sessionRetailStockist.businessName} (${sessionRetailStockist.email})`;
      }
      if (accountPanel) accountPanel.hidden = false;
      return;
    }

    gate.hidden = false;
    content.hidden = true;
    if (accountPanel) accountPanel.hidden = true;
    if (pendingNote) pendingNote.hidden = !isPending();
  }

  function bindAccessForm() {
    const form = document.getElementById("accessLoginForm");
    const error = document.getElementById("accessError");
    if (!form) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("passwordSet") === "1" && error) {
      error.hidden = false;
      error.classList.add("form-success");
      error.textContent = "Password saved. Sign in with your email and new password.";
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = document.getElementById("portalEmail")?.value || "";
      const password = document.getElementById("portalPassword")?.value || "";
      const btn = form.querySelector('button[type="submit"]');
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Signing in…";
      }
      try {
        await loginWithCredentials(email, password);
        if (error) error.hidden = true;
        protectGatedContent();
        document.dispatchEvent(new CustomEvent("leaflock:portal-login"));
      } catch (err) {
        if (error) {
          error.hidden = false;
          error.classList.remove("form-success");
          error.textContent =
            err.message === "Invalid email or password"
              ? "Invalid email or password. Use the email from your approval message. Forgot password?"
              : err.message || "Login failed. Please try again or email info@leaflock.com.au.";
        }
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = "Sign in";
        }
      }
    });

    document.getElementById("accessLogout")?.addEventListener("click", async () => {
      await logout();
      protectGatedContent();
      document.dispatchEvent(new CustomEvent("leaflock:portal-logout"));
    });
  }

  function bindAccountPanel() {
    const changeForm = document.getElementById("changePasswordForm");
    const deleteForm = document.getElementById("deleteAccountForm");
    const changeError = document.getElementById("changePasswordError");
    const deleteError = document.getElementById("deleteAccountError");

    changeForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const currentPassword = document.getElementById("currentPassword")?.value || "";
      const newPassword = document.getElementById("accountNewPassword")?.value || "";
      const confirm = document.getElementById("accountConfirmPassword")?.value || "";
      if (newPassword !== confirm) {
        if (changeError) {
          changeError.hidden = false;
          changeError.textContent = "New passwords do not match.";
        }
        return;
      }
      try {
        const data = await portalFetch("/api/portal/change-password", {
          method: "POST",
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        if (data.token) setToken(data.token);
        if (changeError) {
          changeError.hidden = false;
          changeError.classList.add("form-success");
          changeError.textContent = "Password updated.";
        }
        changeForm.reset();
      } catch (err) {
        if (changeError) {
          changeError.hidden = false;
          changeError.classList.remove("form-success");
          changeError.textContent = err.message || "Could not change password.";
        }
      }
    });

    deleteForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!confirm("Delete your wholesale account permanently? You will need to re-apply for access.")) {
        return;
      }
      const password = document.getElementById("deleteAccountPassword")?.value || "";
      try {
        await portalFetch("/api/portal/delete-account", {
          method: "POST",
          body: JSON.stringify({ password }),
        });
        await logout();
        protectGatedContent();
        if (deleteError) {
          deleteError.hidden = false;
          deleteError.classList.add("form-success");
          deleteError.textContent = "Account deleted.";
        }
        document.dispatchEvent(new CustomEvent("leaflock:portal-logout"));
      } catch (err) {
        if (deleteError) {
          deleteError.hidden = false;
          deleteError.classList.remove("form-success");
          deleteError.textContent = err.message || "Could not delete account.";
        }
      }
    });
  }

  async function boot() {
    await checkPortalApi();
    await restoreSession();
    protectGatedContent();
    bindAccountPanel();
  }

  window.LeafLockAccess = {
    isApproved,
    isPending,
    setPending,
    retailStockist,
    portalFetch,
    loginWithCredentials,
    restoreSession,
    logout,
    protectGatedContent,
    bindAccessForm,
    boot,
  };
})();
(function () {
  const params = new URLSearchParams(window.location.search);

  function normalizeToken(raw) {
    let value = String(raw || "").trim();
    value = value.replace(/[\s\r\n]+/g, "");
    value = value.replace(/[.,;)>]+$/g, "");
    try {
      value = decodeURIComponent(value);
    } catch {
      /* keep raw */
    }
    return value.trim();
  }

  const token = normalizeToken(params.get("token") || "");
  const prefilledEmail = (params.get("email") || "").trim().toLowerCase();
  const form = document.getElementById("setPasswordForm");
  const error = document.getElementById("setPasswordError");
  const account = document.getElementById("setPasswordAccount");
  const lead = document.getElementById("setPasswordLead");
  const emailInput = document.getElementById("setupEmail");
  const codeInput = document.getElementById("setupCode");
  const manualFields = document.getElementById("manualFields");

  let linkMode = Boolean(token);
  let accountEmail = prefilledEmail;

  function showSupportResetMode(message) {
    linkMode = false;
    if (manualFields) manualFields.hidden = false;
    if (lead) {
      lead.textContent =
        "Enter your account email, the support reset code from LeafLock, and a new password (at least 10 characters).";
    }
    if (error && message) {
      error.hidden = false;
      error.textContent = message;
    }
  }

  async function loadStatus() {
    if (!token) {
      if (prefilledEmail && emailInput) emailInput.value = prefilledEmail;
      return;
    }

    if (manualFields) manualFields.hidden = true;
    linkMode = true;
    if (lead) {
      lead.textContent = "Choose a new password for your wholesale portal (at least 10 characters).";
    }

    try {
      const res = await fetch(`/api/portal/password-token-status?token=${encodeURIComponent(token)}`);
      const body = await res.json();
      if (!body.valid) {
        showSupportResetMode("This reset link is no longer valid. Use the support reset code from LeafLock below.");
        return;
      }
      accountEmail = body.email || accountEmail;
      if (account) {
        account.hidden = false;
        account.textContent = `Setting password for ${body.businessName} (${body.email})`;
      }
      if (lead) {
        lead.textContent = `Choose a new password for ${body.businessName}. At least 10 characters.`;
      }
    } catch {
      /* keep password-only link mode */
    }
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = (accountEmail || emailInput?.value || "").trim().toLowerCase();
    const code = (codeInput?.value || "").trim();
    const newPassword = document.getElementById("newPassword")?.value || "";
    const confirmPassword = document.getElementById("confirmPassword")?.value || "";

    if (!linkMode && !email) {
      if (error) {
        error.hidden = false;
        error.textContent = "Enter your wholesale account email.";
      }
      return;
    }
    if (!linkMode && !code) {
      if (error) {
        error.hidden = false;
        error.textContent = "Enter the support reset code from LeafLock.";
      }
      return;
    }
    if (newPassword.length < 10) {
      if (error) {
        error.hidden = false;
        error.textContent = "Password must be at least 10 characters.";
      }
      return;
    }
    if (newPassword !== confirmPassword) {
      if (error) {
        error.hidden = false;
        error.textContent = "Passwords do not match.";
      }
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Saving…";
    }
    try {
      const payload = { password: newPassword };
      if (linkMode && token) {
        payload.token = token;
      } else {
        payload.email = email;
        payload.code = code;
      }

      const res = await fetch("/api/portal/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = body.error || "Could not save password";
        if (token && /invalid|expired|support reset/i.test(message)) {
          showSupportResetMode("This reset link did not work. Use the support reset code from LeafLock below.");
        }
        throw new Error(message);
      }
      if (body.token) {
        sessionStorage.setItem("leaflock_portal_token", body.token);
      }
      if (account) {
        account.hidden = false;
        account.classList.add("form-success");
        account.textContent = `Password saved for ${body.retailStockist?.email}. Opening portal…`;
      }
      window.setTimeout(() => {
        window.location.href = "portal.html";
      }, 800);
    } catch (err) {
      if (error) {
        error.hidden = false;
        error.textContent = err.message || "Could not save password.";
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Save password";
      }
    }
  });

  loadStatus();
})();
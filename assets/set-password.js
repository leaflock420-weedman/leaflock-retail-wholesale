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
  const form = document.getElementById("setPasswordForm");
  const error = document.getElementById("setPasswordError");
  const account = document.getElementById("setPasswordAccount");
  const lead = document.getElementById("setPasswordLead");
  const eyebrow = document.getElementById("setPasswordEyebrow");
  const title = document.getElementById("setPasswordTitle");
  const noToken = document.getElementById("setPasswordNoToken");
  const submitBtn = document.getElementById("setPasswordSubmit");

  function applySetupCopy(businessName) {
    if (eyebrow) eyebrow.textContent = "Welcome";
    if (title) title.textContent = "Create your portal password";
    if (lead) {
      lead.textContent = businessName
        ? `Choose a password for ${businessName} (at least 10 characters).`
        : "Choose a password for your wholesale portal (at least 10 characters).";
    }
    if (submitBtn) submitBtn.textContent = "Create password";
  }

  function applyResetCopy(businessName) {
    if (eyebrow) eyebrow.textContent = "Password reset";
    if (title) title.textContent = "Create your new password";
    if (lead) {
      lead.textContent = businessName
        ? `Choose a new password for ${businessName} (at least 10 characters).`
        : "Choose a new password for your wholesale portal (at least 10 characters).";
    }
    if (submitBtn) submitBtn.textContent = "Save password";
  }

  async function loadStatus() {
    if (!token) {
      if (noToken) noToken.hidden = false;
      if (form) {
        form.querySelectorAll("label").forEach((el) => {
          el.hidden = true;
        });
      }
      if (submitBtn) submitBtn.hidden = true;
      if (lead) {
        lead.textContent = "Use the reset link from your email, or request a new one.";
      }
      return;
    }

    try {
      const res = await fetch(`/api/portal/password-token-status?token=${encodeURIComponent(token)}`);
      const body = await res.json();
      if (!body.valid) {
        if (noToken) {
          noToken.hidden = false;
          noToken.textContent =
            "This reset link has expired. Request a new one from the forgot password page.";
        }
        if (form) {
          form.querySelectorAll("label").forEach((el) => {
            el.hidden = true;
          });
        }
        if (submitBtn) submitBtn.hidden = true;
        return;
      }
      if (account) {
        account.hidden = false;
        account.textContent =
          body.purpose === "setup"
            ? `Setting up access for ${body.businessName} (${body.email})`
            : `Resetting password for ${body.businessName} (${body.email})`;
      }
      if (body.purpose === "setup") applySetupCopy(body.businessName);
      else applyResetCopy(body.businessName);
    } catch {
      /* allow submit attempt */
    }
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!token) return;

    const newPassword = document.getElementById("newPassword")?.value || "";
    const confirmPassword = document.getElementById("confirmPassword")?.value || "";

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
      const res = await fetch("/api/portal/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword, password: newPassword }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Could not save password");
      }
      if (account) {
        account.hidden = false;
        account.classList.add("form-success");
        account.textContent = `Password saved for ${body.retailStockist?.email}. Redirecting to sign in…`;
      }
      window.setTimeout(() => {
        const email = body.retailStockist?.email || "";
        const qs = email ? `?email=${encodeURIComponent(email)}&passwordSet=1` : "?passwordSet=1";
        window.location.href = `portal.html${qs}`;
      }, 900);
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
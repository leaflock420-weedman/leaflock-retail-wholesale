(function () {
  const params = new URLSearchParams(window.location.search);
  const token = (params.get("token") || "").trim();
  const prefilledEmail = (params.get("email") || "").trim().toLowerCase();
  const form = document.getElementById("setPasswordForm");
  const error = document.getElementById("setPasswordError");
  const account = document.getElementById("setPasswordAccount");
  const emailInput = document.getElementById("setupEmail");
  const codeInput = document.getElementById("setupCode");
  const codeField = document.getElementById("setupCodeField");

  if (prefilledEmail && emailInput) emailInput.value = prefilledEmail;

  async function loadStatus() {
    if (!token) return;
    try {
      const res = await fetch(`/api/portal/password-token-status?token=${encodeURIComponent(token)}`);
      const body = await res.json();
      if (!body.valid) {
        if (error) {
          error.hidden = false;
          error.textContent =
            "This link is invalid or expired. Use the setup code from your latest email instead.";
        }
        return;
      }
      if (emailInput && body.email) emailInput.value = body.email;
      if (codeField) codeField.hidden = true;
      if (account) {
        account.hidden = false;
        account.textContent = `Setting password for ${body.businessName} (${body.email})`;
      }
    } catch {
      if (error) {
        error.hidden = false;
        error.textContent = "Could not verify link. Enter your email and setup code from the email.";
      }
    }
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = (emailInput?.value || "").trim().toLowerCase();
    const code = (codeInput?.value || "").trim();
    const newPassword = document.getElementById("newPassword")?.value || "";
    const confirmPassword = document.getElementById("confirmPassword")?.value || "";

    if (!email) {
      if (error) {
        error.hidden = false;
        error.textContent = "Enter the account email from your reset email.";
      }
      return;
    }
    if (!token && !code) {
      if (error) {
        error.hidden = false;
        error.textContent = "Enter the 8-character setup code from your email, or use the reset link.";
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
      const payload = { password: newPassword, email };
      if (token) payload.token = token;
      else payload.code = code;

      const res = await fetch("/api/portal/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not save password");
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
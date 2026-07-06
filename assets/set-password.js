(function () {
  const params = new URLSearchParams(window.location.search);
  const token = (params.get("token") || "").trim();
  const form = document.getElementById("setPasswordForm");
  const error = document.getElementById("setPasswordError");
  const account = document.getElementById("setPasswordAccount");

  async function loadStatus() {
    if (!token) {
      if (error) {
        error.hidden = false;
        error.textContent = "Missing reset link. Request a new one from forgot password.";
      }
      form?.querySelector("button")?.setAttribute("disabled", "disabled");
      return;
    }
    try {
      const res = await fetch(`/api/portal/password-token-status?token=${encodeURIComponent(token)}`);
      const body = await res.json();
      if (!body.valid) {
        if (error) {
          error.hidden = false;
          error.textContent = "This link is invalid or has expired. Request a new reset link.";
        }
        form?.querySelector("button")?.setAttribute("disabled", "disabled");
        return;
      }
      if (account) {
        account.hidden = false;
        account.textContent = `Setting password for ${body.businessName} (${body.email})`;
      }
    } catch {
      if (error) {
        error.hidden = false;
        error.textContent = "Could not verify link. Try again shortly.";
      }
    }
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const newPassword = document.getElementById("newPassword")?.value || "";
    const confirmPassword = document.getElementById("confirmPassword")?.value || "";
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
        body: JSON.stringify({ token, password: newPassword }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not save password");
      if (body.token) {
        sessionStorage.setItem("leaflock_portal_token", body.token);
      }
      if (account) {
        account.hidden = false;
        account.classList.add("form-success");
        account.textContent = `Password saved for ${body.retailStockist?.businessName || "your account"} (${body.retailStockist?.email || ""}). Opening portal…`;
      }
      window.setTimeout(() => {
        window.location.href = body.token ? "portal.html" : "portal.html?passwordSet=1";
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
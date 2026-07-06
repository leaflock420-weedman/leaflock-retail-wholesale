(function () {
  const form = document.getElementById("forgotPasswordForm");
  const message = document.getElementById("forgotPasswordMessage");
  const error = document.getElementById("forgotPasswordError");

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("forgotEmail")?.value || "";
    const btn = form.querySelector('button[type="submit"]');
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Sending email…";
    }
    if (error) error.hidden = true;
    try {
      const res = await fetch("/api/portal/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Request failed");
      if (message) {
        message.hidden = false;
        message.textContent =
          body.message ||
          "If that email has an active account, a temporary password has been emailed. Sign in, then choose your new password.";
      }
      form.reset();
    } catch (err) {
      if (error) {
        error.hidden = false;
        error.textContent = err.message || "Could not send reset link.";
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Email temporary password";
      }
    }
  });
})();
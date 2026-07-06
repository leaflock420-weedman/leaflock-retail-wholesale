(function () {
  const form = document.getElementById("signupForm");
  const success = document.getElementById("signupSuccess");
  const closeBtn = document.getElementById("closeSignupSuccess");

  function ensurePasswordFields() {
    if (!form || form.querySelector('input[name="password"]')) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    const block = document.createElement("fieldset");
    block.className = "form-block";
    block.id = "portalPasswordFields";
    block.innerHTML = `
      <legend>Portal password</legend>
      <p class="pending-note">Choose the password you will use to sign in after approval (at least 10 characters).</p>
      <div class="form-grid">
        <label><span>Password *</span><input type="password" name="password" required minlength="10" autocomplete="new-password"></label>
        <label><span>Confirm password *</span><input type="password" name="password_confirm" required minlength="10" autocomplete="new-password"></label>
      </div>`;
    if (submitBtn) form.insertBefore(block, submitBtn);
    else form.appendChild(block);
  }

  function closeModal() {
    if (success) success.hidden = true;
    document.body.style.overflow = "";
  }

  ensurePasswordFields();

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    ensurePasswordFields();
    if (!form.reportValidity()) return;

    const fd = new FormData(form);
    const password = String(fd.get("password") || "");
    const passwordConfirm = String(fd.get("password_confirm") || "");
    if (password.length < 10) {
      alert("Enter a portal password (at least 10 characters) in the Portal password section below.");
      form.querySelector('input[name="password"]')?.focus();
      return;
    }
    if (password !== passwordConfirm) {
      alert("Passwords do not match.");
      form.querySelector('input[name="password_confirm"]')?.focus();
      return;
    }

    const payload = {
      businessName: fd.get("business_name"),
      fullName: fd.get("full_name"),
      role: fd.get("role"),
      abn: fd.get("abn"),
      storeReg: fd.get("store_reg") || fd.get("store_reg"),
      email: fd.get("email"),
      phone: fd.get("phone"),
      address: fd.get("address"),
      compounding: fd.get("compounding"),
      bulk: fd.get("bulk"),
      notes: fd.get("notes"),
      password,
      passwordConfirm,
    };

    const btn = form.querySelector('button[type="submit"]');
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Submitting…";
    }

    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const message = err.error || "Submission failed";
        if (/missing field:\s*password/i.test(message)) {
          ensurePasswordFields();
          throw new Error(
            "This page was out of date. Password fields are now shown — scroll down, choose a password, and submit again.",
          );
        }
        throw new Error(message);
      }

      window.LeafLockAccess?.setPending();
      if (success) {
        success.hidden = false;
        document.body.style.overflow = "hidden";
      }
      form.reset();
    } catch (err) {
      alert(err.message || "Could not submit application. Please try again or email info@leaflock.com.au");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Submit access request";
      }
    }
  });

  closeBtn?.addEventListener("click", closeModal);
  success?.addEventListener("click", (e) => {
    if (e.target === success) closeModal();
  });
  if (success) success.hidden = true;
})();
(function () {
  const form = document.getElementById("signupForm");
  const success = document.getElementById("signupSuccess");
  const closeBtn = document.getElementById("closeSignupSuccess");

  function closeModal() {
    if (success) success.hidden = true;
    document.body.style.overflow = "";
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const fd = new FormData(form);
    const payload = {
      businessName: fd.get("business_name"),
      fullName: fd.get("full_name"),
      role: fd.get("role"),
      abn: fd.get("abn"),
      pharmacyReg: fd.get("pharmacy_reg"),
      email: fd.get("email"),
      phone: fd.get("phone"),
      address: fd.get("address"),
      compounding: fd.get("compounding"),
      bulk: fd.get("bulk"),
      notes: fd.get("notes"),
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
        throw new Error(err.error || "Submission failed");
      }

      window.LeafLockAccess?.setPending();
      if (success) {
        success.hidden = false;
        document.body.style.overflow = "hidden";
      }
      form.reset();
    } catch (err) {
      alert(err.message || "Could not submit application. Please try again or email med@leaflock.com.au");
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
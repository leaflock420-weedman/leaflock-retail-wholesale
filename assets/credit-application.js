(function () {
  const accessForm = document.querySelector("#creditAccessForm");
  const accessEmail = document.querySelector("#creditAccessEmail");
  const accessPassword = document.querySelector("#creditAccessPassword");
  const accessError = document.querySelector("#creditAccessError");
  const accessGate = document.querySelector("#creditAccessGate");
  const appSection = document.querySelector("#creditApplicationSection");
  const appForm = document.querySelector("#creditApplicationForm");
  const successModal = document.querySelector("#creditSuccess");
  const closeSuccess = document.querySelector("#closeCreditSuccess");

  function showApplication() {
    if (accessGate) accessGate.hidden = true;
    if (appSection) appSection.hidden = false;
    const stockist = window.LeafLockAccess?.retailStockist?.();
    if (stockist) {
      const name = document.querySelector("#creditBusinessName");
      const email = document.querySelector("#creditDirectorEmail");
      if (name && !name.value) name.value = stockist.businessName || "";
      if (email && !email.value) email.value = stockist.email || "";
    }
  }

  accessForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (accessError) accessError.hidden = true;
    try {
      await window.LeafLockAccess.loginWithCredentials(
        accessEmail?.value || "",
        accessPassword?.value || "",
      );
      showApplication();
    } catch (err) {
      if (accessError) {
        accessError.textContent = err.message || "Invalid email or password";
        accessError.hidden = false;
      }
    }
  });

  appForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!appForm.reportValidity()) return;
    const btn = appForm.querySelector('button[type="submit"]');
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Submitting…";
    }
    try {
      await window.LeafLockAccess.portalFetch("/api/credit-applications", {
        method: "POST",
        body: JSON.stringify({
          businessName: document.querySelector("#creditBusinessName")?.value || "",
          abn: document.querySelector("#creditAbn")?.value || "",
          directorName: document.querySelector("#creditDirectorName")?.value || "",
          directorEmail: document.querySelector("#creditDirectorEmail")?.value || "",
          requestedTerms: document.querySelector("#creditRequestedTerms")?.value || "",
          tradeReference1: document.querySelector("#creditTradeRef1")?.value || "",
          tradeReference2: document.querySelector("#creditTradeRef2")?.value || "",
          notes: document.querySelector("#creditNotes")?.value || "",
          signatureName: document.querySelector("#creditSignatureName")?.value || "",
          termsAccepted: true,
        }),
      });
      if (successModal) successModal.hidden = false;
    } catch (err) {
      alert(err.message || "Could not submit application. Try again.");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Submit credit application";
      }
    }
  });

  closeSuccess?.addEventListener("click", () => {
    if (successModal) successModal.hidden = true;
  });

  window.LeafLockAccess.boot().then(() => {
    if (window.LeafLockAccess.isApproved()) showApplication();
  });
})();
/** Legacy helper — wholesale pricing is only available via the approved portal. */
(function () {
  const WHOLESALE_EMAIL = "info@leaflock.com.au";

  function openAccountRequest() {
    const subject = encodeURIComponent("LeafLock retail store wholesale account request");
    const body = encodeURIComponent(
      [
        "LeafLock retail store wholesale account request",
        "",
        "Business name:",
        "ABN:",
        "Contact name:",
        "Email:",
        "Phone:",
        "Products interested in:",
      ].join("\n"),
    );
    window.location.href = `mailto:${WHOLESALE_EMAIL}?subject=${subject}&body=${body}`;
  }

  const accountLink = document.querySelector("#accountLink");
  accountLink?.addEventListener("click", (event) => {
    event.preventDefault();
    openAccountRequest();
  });
})();
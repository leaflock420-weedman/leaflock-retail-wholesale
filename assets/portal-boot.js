window.LeafLockAccess.boot().then(() => {
  window.LeafLockAccess.bindAccessForm();
  if (window.LeafLockAccess.isApproved()) {
    document.dispatchEvent(new CustomEvent("leaflock:portal-login"));
  }
});

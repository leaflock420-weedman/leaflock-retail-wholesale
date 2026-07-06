const TERMS_VERSION = "2026-07-05";

function siteUrl() {
  return process.env.SITE_URL || "https://www.wholesale.leaflock.com.au";
}

function termsUrl() {
  return `${siteUrl()}/wholesale-terms.html`;
}

function privacyUrl() {
  return `${siteUrl()}/privacy-policy.html`;
}

function refundsUrl() {
  return `${siteUrl()}/refunds-returns.html`;
}

function creditApplicationUrl() {
  return `${siteUrl()}/credit-application.html`;
}

function paymentTermsLabel(retailStockist, { paymentMethod } = {}) {
  if (paymentMethod === "paypal") return "Prepaid — paid via PayPal at checkout";
  const approved = retailStockist?.creditTerms;
  if (approved) return approved;
  return "Prepaid — payment in full before dispatch";
}

function countCompletedOrders(retailStockistId) {
  if (!retailStockistId) return 0;
  try {
    const { loadOrders } = require("./order-store");
    return loadOrders().orders.filter(
      (o) => o.retailStockistId === retailStockistId && o.status !== "cancelled",
    ).length;
  } catch {
    return 0;
  }
}

module.exports = {
  TERMS_VERSION,
  siteUrl,
  termsUrl,
  privacyUrl,
  refundsUrl,
  creditApplicationUrl,
  paymentTermsLabel,
  countCompletedOrders,
};
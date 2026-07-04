import { createRequire } from "module";

const require = createRequire(import.meta.url);
const nodemailer = require("nodemailer");

const host = process.env.SMTP_HOST || "smtp.gmail.com";
const user = process.env.SMTP_USER || "med@leaflock.com.au";
const pass = process.env.SMTP_PASS;
const to = process.env.WHOLESALE_EMAIL_TO || "med@leaflock.com.au";

if (!pass) {
  console.error("Set SMTP_PASS (Google App Password for med@)");
  process.exit(1);
}

const tx = nodemailer.createTransport({
  host,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: { user, pass },
});

try {
  await tx.verify();
  console.log("SMTP connection OK");
  await tx.sendMail({
    from: process.env.ANALYTICS_EMAIL_FROM || user,
    to,
    subject: "LeafLock med@ SMTP test",
    text: "If you received this, approval emails will work.",
  });
  console.log(`Test email sent to ${to}`);
} catch (err) {
  console.error("SMTP failed:", err.message);
  process.exit(1);
}
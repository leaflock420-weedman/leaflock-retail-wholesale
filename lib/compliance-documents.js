const fs = require("fs");
const path = require("path");
const { PUBLIC_COMPANY } = require("./company-public");

const DOCS_DIR = path.join(__dirname, "..", "private", "documents");

const CATALOG = [
  {
    id: "stockist-nda",
    title: "Stockist NDA & Confidentiality Agreement",
    summary: "Required confidentiality terms for wholesale stockists.",
    filename: "stockist-nda.pdf",
    emailLabel: "LeafLock Stockist NDA — Confidentiality Agreement",
  },
  {
    id: "compliance-pack-gummy-mix",
    title: "Master Compliance Pack — DIY Gummy Mix",
    summary: "Product compliance, handling, and wholesale obligations.",
    filename: "compliance-pack-gummy-mix.pdf",
    emailLabel: "LeafLock Master Compliance Pack — DIY Gummy Mix",
  },
  {
    id: "trademark-registration",
    title: "Australian trade mark registration",
    summary: "Official IP Australia certificate of registration.",
    filename: "trademark-registration.pdf",
    emailLabel: "LeafLock — Australian Trade Mark Registration Certificate",
  },
];

const ON_FILE_CREDENTIALS = [
  {
    id: "nda",
    label: "Stockist confidentiality terms",
    status: "On file",
    docId: "stockist-nda",
  },
  {
    id: "compliance",
    label: "Master compliance pack — DIY Gummy Mix",
    status: "On file",
    docId: "compliance-pack-gummy-mix",
  },
];

function credentialsForPortal() {
  const ready = documentsReady();
  const tm = PUBLIC_COMPANY.trademark;
  return {
    company: PUBLIC_COMPANY.legalName,
    acn: PUBLIC_COMPANY.acn,
    trademark: {
      mark: tm.mark,
      number: tm.number,
      registeredDate: tm.registeredDate,
      headline: tm.headline,
      classes: tm.classes.map((c) => ({
        class: c.class,
        description: c.description,
        note: c.publicNote,
      })),
    },
    onFile: ON_FILE_CREDENTIALS.map((cred) => ({
      id: cred.id,
      label: cred.label,
      status: cred.status,
      verified: ready && Boolean(resolveDocument(cred.docId)),
    })),
  };
}

function resolveDocument(docId) {
  const doc = CATALOG.find((d) => d.id === docId);
  if (!doc) return null;
  const filePath = path.join(DOCS_DIR, doc.filename);
  if (!fs.existsSync(filePath)) return null;
  return { ...doc, filePath };
}

function attachmentPaths() {
  return CATALOG.map((doc) => {
    const filePath = path.join(DOCS_DIR, doc.filename);
    if (!fs.existsSync(filePath)) return null;
    return { filename: doc.filename, path: filePath, label: doc.emailLabel };
  }).filter(Boolean);
}

function documentsReady() {
  return attachmentPaths().length === CATALOG.length;
}

module.exports = {
  CATALOG,
  ON_FILE_CREDENTIALS,
  credentialsForPortal,
  resolveDocument,
  attachmentPaths,
  documentsReady,
};
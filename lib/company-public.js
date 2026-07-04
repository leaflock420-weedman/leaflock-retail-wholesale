/** Public company & trade mark facts — safe to show on the website. */
const PUBLIC_COMPANY = {
  legalName: "LeafLock & Co Pty Ltd",
  acn: "676 132 531",
  state: "Queensland",
  registered: "March 2024",
  trademark: {
    mark: "LeafLock™",
    number: "2594215",
    registeredDate: "20 May 2026",
    classes: [
      {
        class: 5,
        description: "Medical cannabis",
        publicNote: "Storage products and related goods",
      },
      {
        class: 16,
        description: "Humidity control sheets of paper or plastic for foodstuff packaging",
        publicNote: "Humidity control packaging for retail stockist storage",
      },
    ],
    headline: "Registered Australian trade mark for humidity control packaging and storage products",
  },
  productCerts: [
    "RoHS compliant",
    "REACH compliant",
    "DMF certified",
    "ISO 9001:2015",
    "UKAS & SGS testing",
  ],
};

function publicCredentialsPayload() {
  return {
    company: PUBLIC_COMPANY.legalName,
    acn: PUBLIC_COMPANY.acn,
    state: PUBLIC_COMPANY.state,
    registered: PUBLIC_COMPANY.registered,
    trademark: PUBLIC_COMPANY.trademark,
    productCerts: PUBLIC_COMPANY.productCerts,
  };
}

module.exports = { PUBLIC_COMPANY, publicCredentialsPayload };
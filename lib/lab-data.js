/** Cannalysis COA comparison — Month 3 sample set (from supplied lab data). */
const LAB_LABELS = [
  "Ambient, no pack",
  "Ambient, with LeafLock",
  "Refrigerated, no pack",
  "Refrigerated, with LeafLock",
];

const LAB_SAMPLES = [
  {
    id: "ambient-no",
    label: "Ambient, no pack",
    moisture: 12.06,
    totalThc: 174.0,
    totalCannabinoids: 201.2,
    d9Thc: 14.47,
    thca: 181.9,
    totalTerpenes: 0.4283,
    microbial: "Pass",
  },
  {
    id: "ambient-with",
    label: "Ambient, with LeafLock",
    moisture: 13.97,
    totalThc: 176.2,
    totalCannabinoids: 201.9,
    d9Thc: 14.77,
    thca: 184.1,
    totalTerpenes: 0.3513,
    microbial: "Pass",
  },
  {
    id: "refrigerated-no",
    label: "Refrigerated, no pack",
    moisture: 11.94,
    totalThc: 173.0,
    totalCannabinoids: 199.9,
    d9Thc: 11.68,
    thca: 183.9,
    totalTerpenes: 0.0115,
    microbial: "Pass",
  },
  {
    id: "refrigerated-with",
    label: "Refrigerated, with LeafLock",
    moisture: 13.65,
    totalThc: 183.1,
    totalCannabinoids: 211.4,
    d9Thc: 13.04,
    thca: 193.9,
    totalTerpenes: 0.3756,
    microbial: "Pass",
  },
];

const TERPENE_ANALYTES = [
  "Limonene",
  "Linalool",
  "Alpha-pinene",
  "Beta-pinene",
  "Beta-caryophyllene",
  "Alpha-humulene",
  "Beta-myrcene",
  "Geraniol",
  "Nerolidol",
  "P-cymene",
  "Alpha-bisabolol",
  "Camphene",
];

const MICROBIAL_PANEL = [
  "Aspergillus fumigatus, niger, flavus, terreus",
  "Salmonella spp",
  "STEC",
];

module.exports = {
  LAB_LABELS,
  LAB_SAMPLES,
  TERPENE_ANALYTES,
  MICROBIAL_PANEL,
};
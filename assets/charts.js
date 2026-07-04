(function () {
  const LABELS = [
    "Ambient, no pack",
    "Ambient, with LeafLock",
    "Refrigerated, no pack",
    "Refrigerated, with LeafLock",
  ];

  const DATA = {
    moisture: [12.06, 13.97, 11.94, 13.65],
    d9Thc: [14.47, 14.77, 11.68, 13.04],
    thca: [181.9, 184.1, 183.9, 193.9],
    totalThc: [174.0, 176.2, 173.0, 183.1],
    totalCannabinoids: [201.2, 201.9, 199.9, 211.4],
    totalTerpenes: [0.4283, 0.3513, 0.0115, 0.3756],
  };

  const COLORS = {
    moisture: { bg: "rgba(45, 122, 68, 0.55)", border: "#2d7a44" },
    d9: { bg: "rgba(76, 175, 80, 0.65)", border: "#388e3c" },
    thca: { bg: "rgba(30, 136, 229, 0.55)", border: "#1e88e5" },
    totalThc: { bg: "rgba(25, 92, 142, 0.55)", border: "#195c8e" },
    terpenes: { bg: "rgba(251, 192, 45, 0.7)", border: "#f9a825" },
    refNo: { bg: "rgba(198, 40, 40, 0.45)", border: "#c62828" },
    refWith: { bg: "rgba(45, 122, 68, 0.65)", border: "#1d5730" },
  };

  function chartDefaults() {
    if (!window.Chart) return;
    Chart.defaults.font.family = "Inter, system-ui, sans-serif";
    Chart.defaults.color = "#5c6963";
  }

  function baseOptions(title, extra = {}) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 8, bottom: 4 } },
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 14, padding: 14 } },
        title: {
          display: Boolean(title),
          text: title,
          font: { size: 15, weight: "600" },
          color: "#17211d",
          padding: { bottom: 14 },
        },
        tooltip: { mode: "index", intersect: false },
      },
      interaction: { mode: "index", intersect: false },
      ...extra,
    };
  }

  function initMainChart() {
    const el = document.getElementById("leafLockChart");
    if (!el) return;

    new Chart(el.getContext("2d"), {
      type: "bar",
      data: {
        labels: LABELS,
        datasets: [
          {
            label: "Moisture (%)",
            data: DATA.moisture,
            backgroundColor: COLORS.moisture.bg,
            borderColor: COLORS.moisture.border,
            borderWidth: 1,
            yAxisID: "y",
          },
          {
            label: "D9-THC (mg/g)",
            data: DATA.d9Thc,
            backgroundColor: COLORS.d9.bg,
            borderColor: COLORS.d9.border,
            borderWidth: 1,
            yAxisID: "y1",
          },
          {
            label: "THCa (mg/g)",
            data: DATA.thca,
            backgroundColor: COLORS.thca.bg,
            borderColor: COLORS.thca.border,
            borderWidth: 1,
            yAxisID: "y1",
          },
          {
            label: "Total THC (mg/g)",
            data: DATA.totalThc,
            backgroundColor: COLORS.totalThc.bg,
            borderColor: COLORS.totalThc.border,
            borderWidth: 1,
            yAxisID: "y1",
          },
        ],
      },
      options: baseOptions("Moisture & cannabinoids — Month 3 COA comparison", {
        scales: {
          x: {
            title: { display: true, text: "Storage condition" },
            grid: { display: false },
            ticks: { maxRotation: 25, minRotation: 0, font: { size: 11 } },
          },
          y: {
            type: "linear",
            position: "left",
            title: { display: true, text: "Moisture (%)" },
            suggestedMin: 10,
            suggestedMax: 16,
            grid: { color: "#e8efe9" },
          },
          y1: {
            type: "linear",
            position: "right",
            title: { display: true, text: "Cannabinoids (mg/g)" },
            suggestedMin: 0,
            suggestedMax: 220,
            grid: { drawOnChartArea: false },
          },
        },
      }),
    });
  }

  function initTerpeneChart() {
    const el = document.getElementById("terpeneChart");
    if (!el) return;

    new Chart(el.getContext("2d"), {
      type: "bar",
      data: {
        labels: LABELS,
        datasets: [
          {
            label: "Total terpenes (mg/g)",
            data: DATA.totalTerpenes,
            backgroundColor: COLORS.terpenes.bg,
            borderColor: COLORS.terpenes.border,
            borderWidth: 1,
          },
        ],
      },
      options: baseOptions("Total terpenes — separate scale", {
        scales: {
          x: {
            grid: { display: false },
            ticks: { maxRotation: 25, minRotation: 0, font: { size: 11 } },
          },
          y: {
            title: { display: true, text: "Total terpenes (mg/g)" },
            suggestedMin: 0,
            suggestedMax: 0.5,
            grid: { color: "#e8efe9" },
          },
        },
      }),
    });
  }

  function initRefrigeratedChart() {
    const el = document.getElementById("refrigeratedChart");
    if (!el) return;

    new Chart(el.getContext("2d"), {
      type: "bar",
      data: {
        labels: ["Moisture", "Total THC", "Total cannabinoids", "D9-THC", "THCa"],
        datasets: [
          {
            label: "% change with pack (refrigerated)",
            data: [14.3, 5.8, 5.8, 11.6, 5.4],
            backgroundColor: COLORS.refWith.bg,
            borderColor: COLORS.refWith.border,
            borderWidth: 1,
          },
        ],
      },
      options: baseOptions("Refrigerated — improvement with LeafLock vs without pack", {
        plugins: {
          ...baseOptions().plugins,
          tooltip: {
            callbacks: {
              label(context) {
                return `${context.parsed.y}% higher with pack`;
              },
            },
          },
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            title: { display: true, text: "% change vs no pack" },
            suggestedMin: 0,
            suggestedMax: 18,
            grid: { color: "#e8efe9" },
            ticks: { callback: (v) => `${v}%` },
          },
        },
      }),
    });
  }

  function initMoistureChart() {
    const el = document.getElementById("moistureChart");
    if (!el) return;

    new Chart(el.getContext("2d"), {
      type: "bar",
      data: {
        labels: ["Ambient", "Refrigerated"],
        datasets: [
          {
            label: "Without pack",
            data: [12.06, 11.94],
            backgroundColor: COLORS.refNo.bg,
            borderColor: COLORS.refNo.border,
            borderWidth: 1,
          },
          {
            label: "With LeafLock pack",
            data: [13.97, 13.65],
            backgroundColor: COLORS.refWith.bg,
            borderColor: COLORS.refWith.border,
            borderWidth: 1,
          },
        ],
      },
      options: baseOptions("Moisture content comparison", {
        scales: {
          y: {
            title: { display: true, text: "Moisture (%)" },
            suggestedMin: 11,
            suggestedMax: 15,
            grid: { color: "#e8efe9" },
          },
          x: { grid: { display: false } },
        },
      }),
    });
  }

  function initAll() {
    if (!window.Chart) return;
    chartDefaults();
    initMainChart();
    initTerpeneChart();
    initRefrigeratedChart();
    initMoistureChart();
  }

  function boot() {
    if (window.Chart) initAll();
    else window.addEventListener("load", initAll);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
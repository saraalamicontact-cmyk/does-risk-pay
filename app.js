// "Does Risk Pay?" website - fills the page from window.SITE_DATA (data/site.js, rewritten every trading morning)

const DATA = window.SITE_DATA;
const COLOURS = {
  text: "#F1F5FA", muted: "#A9B8CB", line: "#24476E",
  gold: "#F2C14E", sky: "#5DADE2", teal: "#4ECDC4", coral: "#EF6F6C", grey: "#7F92AB",
};
const SIGNAL_COLOURS = { Overweight: COLOURS.teal, Neutral: COLOURS.grey, Underweight: COLOURS.coral };
const REGIME_NOTES = {
  "Risk-on": "Above the 200-day average, less than 10% below the high",
  "Caution": "Below the 200-day average",
  "Correction": "10% to 20% below the 12-month high",
  "Bear market": "More than 20% below the 12-month high",
};


// ==== 1. Small helpers ====

function setText(selector, value) {
  document.querySelectorAll(selector).forEach((element) => { element.textContent = value; });
}

function formatPct(value) {
  return (value > 0 ? "+" : "") + value.toFixed(1) + "%";
}

function formatDate(isoDate) {
  const date = new Date(isoDate + "T12:00:00");
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function pageUrl() {
  return location.href.split("#")[0];
}


// ==== 2. Text and numbers ====

function fillNumbers() {
  const capm = DATA.capm;
  const d1 = capm.deciles[0];
  setText(".js-months", capm.months);
  setText(".js-sml-slope", capm.sml_slope.toFixed(1));
  setText(".js-market-premium", capm.market_premium.toFixed(1));
  setText(".js-intercept", capm.sml_intercept.toFixed(1));
  setText(".js-d1-alpha", d1.alpha.toFixed(1));
  setText(".js-grs", capm.grs.toFixed(2));
  setText(".js-grs-p", capm.grs_p.toFixed(3));
  setText(".js-period", capm.period);
  setText(".js-rec-months", DATA.cycles.recession_months);
  setText(".js-rec-premium", Math.abs(DATA.cycles.market_premium_recession).toFixed(1));
  setText(".js-updated", DATA.updated);

  // Recession returns of three industries, for the verdict of prediction 3
  DATA.cycles.sectors.forEach((s) => {
    if (s.sector === "Energy") setText(".js-energy-rec", s.recession.toFixed(1));
    if (s.sector === "Manufacturing") setText(".js-manuf-rec", s.recession.toFixed(1));
    if (s.sector === "Retail") setText(".js-retail-rec", "+" + s.recession.toFixed(1));
  });

  const monitor = DATA.monitor;
  setText(".js-as-of", formatDate(monitor.as_of));
  setText(".js-regime", monitor.regime);
  document.querySelector(".js-regime").dataset.regime = monitor.regime;
  setText(".js-regime-note", REGIME_NOTES[monitor.regime] || "");
  setText(".js-drawdown", monitor.spy_drawdown.toFixed(1) + "%");
  setText(".js-overweight", monitor.overweight);
  setText(".js-underweight", monitor.underweight);
}

function fillSignalTable() {
  const rows = DATA.monitor.sectors.map((s) => `
    <tr>
      <td>${s.sector}</td>
      <td class="ticker">${s.ticker}</td>
      <td class="num">${formatPct(s.return_1m)}</td>
      <td class="num">${formatPct(s.return_3m)}</td>
      <td class="num">${formatPct(s.relative_3m)}</td>
      <td class="num">${s.beta.toFixed(2)}</td>
      <td>${s.style}</td>
      <td><span class="pill" data-signal="${s.signal}">${s.signal}</span></td>
    </tr>`);
  document.querySelector(".js-signals").innerHTML = rows.join("");
}


// ==== 3. Sharing ====

function setupSharing() {
  const message = `Does risk pay? A 63-year test of the CAPM on US stocks, with a sector monitor updated every trading day: ${pageUrl()}`;
  document.querySelectorAll(".js-whatsapp").forEach((link) => {
    link.href = "https://wa.me/?text=" + encodeURIComponent(message);
  });
  document.querySelectorAll(".js-copy").forEach((button) => {
    button.addEventListener("click", copyLink);
  });
}

function copyLink(event) {
  const toast = event.target.parentElement.querySelector(".js-toast");
  navigator.clipboard.writeText(pageUrl())
    .then(() => { toast.textContent = "Link copied"; })
    .catch(() => { toast.textContent = pageUrl(); });
}


// ==== 4. Charts (Chart.js) ====

function chartDefaults() {
  Chart.defaults.color = COLOURS.muted;
  Chart.defaults.borderColor = COLOURS.line;
  Chart.defaults.font.family = '"IBM Plex Sans", "Segoe UI", sans-serif';
  Chart.defaults.maintainAspectRatio = false;
  // English number format on the axes (797.1, not 797,1), whatever the visitor's language
  Chart.defaults.locale = "en-US";
  Chart.defaults.plugins.legend.labels.boxWidth = 12;
}

function regimeChart() {
  const history = DATA.monitor.history;
  const top = Math.max(...history.map((p) => p.spy)) * 1.03;
  new Chart(document.getElementById("chart-regime"), {
    data: {
      labels: history.map((p) => p.date),
      datasets: [
        { type: "bar", label: "Not risk-on", data: history.map((p) => (p.risk_on ? null : top)),
          backgroundColor: "rgba(239, 111, 108, 0.18)", barPercentage: 1, categoryPercentage: 1, order: 3 },
        { type: "line", label: "S&P 500 (SPY)", data: history.map((p) => p.spy), borderColor: COLOURS.sky, pointRadius: 0, borderWidth: 2, order: 1 },
        { type: "line", label: "200-day average", data: history.map((p) => p.ma200), borderColor: COLOURS.gold, pointRadius: 0, borderWidth: 2, order: 2 },
      ],
    },
    options: {
      scales: {
        x: { ticks: { maxTicksLimit: 6 }, grid: { display: false } },
        y: { min: Math.min(...history.map((p) => p.ma200)) * 0.95, max: top },
      },
    },
  });
}

function sectorsChart() {
  const sectors = DATA.monitor.sectors;
  new Chart(document.getElementById("chart-sectors"), {
    type: "bar",
    data: {
      labels: sectors.map((s) => s.sector),
      datasets: [{ label: "3-month return (%)", data: sectors.map((s) => s.return_3m),
        backgroundColor: sectors.map((s) => SIGNAL_COLOURS[s.signal]) }],
    },
    options: { indexAxis: "y", plugins: { legend: { display: false } }, scales: { y: { grid: { display: false } } } },
  });
}

function smlChart() {
  const capm = DATA.capm;
  const xs = [0.4, 1.8];
  new Chart(document.getElementById("chart-sml"), {
    data: {
      datasets: [
        { type: "scatter", label: "Beta deciles (actual)", data: capm.deciles.map((d) => ({ x: d.beta, y: d.actual })),
          backgroundColor: COLOURS.text, pointRadius: 5 },
        { type: "line", label: "Estimated SML", data: xs.map((x) => ({ x: x, y: capm.sml_intercept + capm.sml_slope * x })),
          borderColor: COLOURS.gold, pointRadius: 0, borderWidth: 2 },
        { type: "line", label: "CAPM SML", data: xs.map((x) => ({ x: x, y: capm.market_premium * x })),
          borderColor: COLOURS.teal, borderDash: [6, 5], pointRadius: 0, borderWidth: 2 },
      ],
    },
    options: {
      scales: {
        x: { type: "linear", min: 0.4, max: 1.8, title: { display: true, text: "Beta" } },
        y: { title: { display: true, text: "Excess return (% per year)" } },
      },
    },
  });
}

function decilesChart() {
  const deciles = DATA.capm.deciles;
  new Chart(document.getElementById("chart-deciles"), {
    type: "bar",
    data: {
      labels: deciles.map((d) => d.portfolio),
      datasets: [
        { label: "Actual", data: deciles.map((d) => d.actual), backgroundColor: COLOURS.sky },
        { label: "CAPM prediction", data: deciles.map((d) => d.capm), backgroundColor: COLOURS.gold },
      ],
    },
    options: { scales: { x: { grid: { display: false } } } },
  });
}

function cyclesChart() {
  const sectors = DATA.cycles.sectors;
  new Chart(document.getElementById("chart-cycles"), {
    type: "bar",
    data: {
      labels: sectors.map((s) => s.sector),
      datasets: [
        { label: "Expansion", data: sectors.map((s) => s.expansion), backgroundColor: "#CBD5E1" },
        { label: "Recession", data: sectors.map((s) => s.recession), backgroundColor: COLOURS.coral },
      ],
    },
    options: { indexAxis: "y", scales: { y: { grid: { display: false } } } },
  });
}


// ==== 5. Start ====

fillNumbers();
fillSignalTable();
setupSharing();
if (window.Chart) {
  chartDefaults();
  regimeChart();
  sectorsChart();
  smlChart();
  decilesChart();
  cyclesChart();
}

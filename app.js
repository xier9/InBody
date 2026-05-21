const STORAGE_KEY = "inbody-health-records-v1";

const metrics = [
  { key: "weight", label: "體重", unit: "kg", step: "0.1", direction: "neutral", sample: 68.4 },
  { key: "bodyFat", label: "體脂肪", unit: "%", step: "0.1", direction: "lower", sample: 23.1 },
  { key: "visceralFat", label: "內臟脂肪", unit: "level", step: "0.5", direction: "lower", sample: 7 },
  { key: "bmr", label: "基礎代謝", unit: "kcal", step: "1", direction: "higher", sample: 1458 },
  { key: "bmi", label: "BMI", unit: "", step: "0.1", direction: "neutral", sample: 22.4 },
  { key: "bodyAge", label: "體年齡", unit: "歲", step: "1", direction: "lower", sample: 36 },
  { key: "subFatTotal", label: "全身皮下脂肪", unit: "%", step: "0.1", direction: "lower", sample: 20.6 },
  { key: "subFatTrunk", label: "體幹皮下脂肪", unit: "%", step: "0.1", direction: "lower", sample: 18.9 },
  { key: "subFatArms", label: "兩腕皮下脂肪", unit: "%", step: "0.1", direction: "lower", sample: 28.2 },
  { key: "subFatLegs", label: "兩腳皮下脂肪", unit: "%", step: "0.1", direction: "lower", sample: 31.8 },
  { key: "skeletalTotal", label: "全身骨胳肌", unit: "kg", step: "0.1", direction: "higher", sample: 28.7 },
  { key: "skeletalTrunk", label: "體幹骨胳肌", unit: "kg", step: "0.1", direction: "higher", sample: 21.2 },
  { key: "skeletalArms", label: "兩腕骨胳肌", unit: "kg", step: "0.1", direction: "higher", sample: 4.9 },
  { key: "skeletalLegs", label: "兩腳骨胳肌", unit: "kg", step: "0.1", direction: "higher", sample: 17.6 },
];

const state = {
  records: [],
};

const $ = (selector) => document.querySelector(selector);
const metricInputs = $("#metricInputs");
const entryForm = $("#entryForm");
const recordIdInput = $("#recordId");
const recordDateInput = $("#recordDate");
const recordList = $("#recordList");
const baseSelect = $("#baseSelect");
const targetSelect = $("#targetSelect");
const comparisonGrid = $("#comparisonGrid");
const deltaOverview = $("#deltaOverview");
const trendMetricSelect = $("#trendMetricSelect");
const trendChart = $("#trendChart");
const trendStats = $("#trendStats");
const toast = $("#toast");

function todayString() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-TW", {
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${value}T00:00:00`));
}

function formatValue(value, metric) {
  if (!Number.isFinite(value)) return "--";
  const precision = metric.step === "1" ? 0 : 1;
  return `${value.toFixed(precision)}${metric.unit ? ` ${metric.unit}` : ""}`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 1800);
}

function loadRecords() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    state.records = Array.isArray(saved) ? saved : [];
  } catch {
    state.records = [];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
}

function sortedRecords() {
  return [...state.records].sort((a, b) => b.date.localeCompare(a.date));
}

function createMetricInputs() {
  metricInputs.innerHTML = metrics.map((metric) => `
    <label class="metric-card" for="${metric.key}">
      <span class="metric-label">
        <strong>${metric.label}</strong>
        <small>${metric.unit || "數值"}</small>
      </span>
      <input id="${metric.key}" name="${metric.key}" inputmode="decimal" type="number" min="0" step="${metric.step}" required>
    </label>
  `).join("");

  trendMetricSelect.innerHTML = metrics.map((metric) => `
    <option value="${metric.key}">${metric.label}</option>
  `).join("");
  trendMetricSelect.value = "weight";
}

function getMetric(key) {
  return metrics.find((metric) => metric.key === key);
}

function renderSummary() {
  const latest = sortedRecords()[0];
  $("#recordCount").textContent = `${state.records.length} 筆紀錄`;
  if (!latest) {
    $("#latestWeight").textContent = "-- kg";
    $("#latestMeta").textContent = "尚未建立紀錄";
    return;
  }

  $("#latestWeight").textContent = formatValue(latest.weight, getMetric("weight"));
  $("#latestMeta").textContent = `${formatDate(latest.date)} · 體脂肪 ${formatValue(latest.bodyFat, getMetric("bodyFat"))}`;
}

function renderRecords() {
  const template = $("#recordTemplate");
  recordList.innerHTML = "";

  const records = sortedRecords();
  if (!records.length) {
    recordList.innerHTML = '<div class="empty-state">還沒有紀錄</div>';
    return;
  }

  records.forEach((record) => {
    const card = template.content.firstElementChild.cloneNode(true);
    card.dataset.id = record.id;
    card.querySelector(".record-date").textContent = formatDate(record.date);
    card.querySelector(".record-weight").textContent = formatValue(record.weight, getMetric("weight"));
    card.querySelector(".record-detail").textContent = `體脂肪 ${formatValue(record.bodyFat, getMetric("bodyFat"))} · 骨胳肌 ${formatValue(record.skeletalTotal, getMetric("skeletalTotal"))}`;
    recordList.append(card);
  });
}

function renderSelects() {
  const records = sortedRecords();
  const options = records.map((record) => `
    <option value="${record.id}">${formatDate(record.date)} · ${formatValue(record.weight, getMetric("weight"))}</option>
  `).join("");

  baseSelect.innerHTML = options || '<option value="">無紀錄</option>';
  targetSelect.innerHTML = options || '<option value="">無紀錄</option>';

  if (records.length > 1) {
    baseSelect.value = records[1].id;
    targetSelect.value = records[0].id;
  }
}

function deltaClass(delta, metric) {
  if (Math.abs(delta) < 0.0001) return "neutral";
  if (metric.direction === "lower") return delta < 0 ? "good" : "bad";
  if (metric.direction === "higher") return delta > 0 ? "good" : "bad";
  return "neutral";
}

function renderComparison() {
  const base = state.records.find((record) => record.id === baseSelect.value);
  const target = state.records.find((record) => record.id === targetSelect.value);

  if (!base || !target || base.id === target.id) {
    deltaOverview.innerHTML = "";
    comparisonGrid.innerHTML = '<div class="empty-state">請選擇兩筆不同日期的紀錄</div>';
    return;
  }

  const overviewKeys = ["weight", "bodyFat", "skeletalTotal"];
  deltaOverview.innerHTML = overviewKeys.map((key) => {
    const metric = getMetric(key);
    const delta = target[key] - base[key];
    return `
      <div class="overview-chip">
        <small>${metric.label}</small>
        <strong>${delta > 0 ? "+" : ""}${formatValue(delta, metric)}</strong>
      </div>
    `;
  }).join("");

  comparisonGrid.innerHTML = metrics.map((metric) => {
    const delta = target[metric.key] - base[metric.key];
    return `
      <article class="delta-card">
        <div>
          <strong>${metric.label}</strong>
          <small>${formatValue(base[metric.key], metric)} → ${formatValue(target[metric.key], metric)}</small>
        </div>
        <span class="delta-value ${deltaClass(delta, metric)}">${delta > 0 ? "+" : ""}${formatValue(delta, metric)}</span>
      </article>
    `;
  }).join("");
}

function renderTrend() {
  const metric = getMetric(trendMetricSelect.value);
  const records = [...state.records].sort((a, b) => a.date.localeCompare(b.date));
  const values = records.map((record) => Number(record[metric.key])).filter(Number.isFinite);

  if (records.length < 2 || values.length < 2) {
    trendChart.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="#6b746e" font-size="14">需要至少 2 筆紀錄</text>';
    trendStats.innerHTML = "";
    return;
  }

  const width = 340;
  const height = 230;
  const pad = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const points = records.map((record, index) => {
    const x = pad + (index / Math.max(records.length - 1, 1)) * (width - pad * 2);
    const y = height - pad - ((record[metric.key] - min) / span) * (height - pad * 2);
    return { x, y, record };
  });

  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const area = `${path} L ${points.at(-1).x} ${height - pad} L ${points[0].x} ${height - pad} Z`;
  const first = values[0];
  const last = values.at(-1);
  const change = last - first;

  trendChart.setAttribute("viewBox", `0 0 ${width} ${height}`);
  trendChart.innerHTML = `
    <path d="M ${pad} ${pad} H ${width - pad} M ${pad} ${height / 2} H ${width - pad} M ${pad} ${height - pad} H ${width - pad}" stroke="#e1ded5" stroke-width="1"/>
    <path d="${area}" fill="#dcefe6"/>
    <path d="${path}" fill="none" stroke="#2f7d61" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    ${points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="5" fill="#26312d"/>`).join("")}
    <text x="${pad}" y="${height - 8}" fill="#6b746e" font-size="12">${formatDate(records[0].date)}</text>
    <text x="${width - pad}" y="${height - 8}" text-anchor="end" fill="#6b746e" font-size="12">${formatDate(records.at(-1).date)}</text>
  `;

  trendStats.innerHTML = `
    <div class="stat-card"><small>最低</small><strong>${formatValue(min, metric)}</strong></div>
    <div class="stat-card"><small>最高</small><strong>${formatValue(max, metric)}</strong></div>
    <div class="stat-card"><small>總變化</small><strong>${change > 0 ? "+" : ""}${formatValue(change, metric)}</strong></div>
  `;
}

function renderAll() {
  renderSummary();
  renderRecords();
  renderSelects();
  renderComparison();
  renderTrend();
}

function formRecord() {
  const record = {
    id: recordIdInput.value || crypto.randomUUID(),
    date: recordDateInput.value,
  };

  metrics.forEach((metric) => {
    record[metric.key] = Number($(`#${metric.key}`).value);
  });

  return record;
}

function resetForm() {
  entryForm.reset();
  recordIdInput.value = "";
  recordDateInput.value = todayString();
  $("#saveButton").textContent = "儲存";
}

function fillForm(record) {
  recordIdInput.value = record.id;
  recordDateInput.value = record.date;
  metrics.forEach((metric) => {
    $(`#${metric.key}`).value = record[metric.key];
  });
  $("#saveButton").textContent = "更新";
  document.querySelector('[data-view="entryView"]').click();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

entryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const record = formRecord();
  const existingIndex = state.records.findIndex((item) => item.id === record.id);
  const sameDateIndex = state.records.findIndex((item) => item.date === record.date && item.id !== record.id);

  if (sameDateIndex >= 0) {
    record.id = state.records[sameDateIndex].id;
    state.records[sameDateIndex] = record;
  } else if (existingIndex >= 0) {
    state.records[existingIndex] = record;
  } else {
    state.records.push(record);
  }

  saveRecords();
  resetForm();
  renderAll();
  showToast("紀錄已儲存");
});

recordList.addEventListener("click", (event) => {
  const card = event.target.closest(".record-card");
  if (!card) return;
  const record = state.records.find((item) => item.id === card.dataset.id);
  if (!record) return;

  if (event.target.closest(".delete-record")) {
    state.records = state.records.filter((item) => item.id !== record.id);
    saveRecords();
    renderAll();
    showToast("紀錄已刪除");
    return;
  }

  fillForm(record);
});

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab, .view").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    $(`#${button.dataset.view}`).classList.add("active");
    renderComparison();
    renderTrend();
  });
});

baseSelect.addEventListener("change", renderComparison);
targetSelect.addEventListener("change", renderComparison);
trendMetricSelect.addEventListener("change", renderTrend);

$("#sampleButton").addEventListener("click", () => {
  recordDateInput.value = todayString();
  metrics.forEach((metric, index) => {
    const drift = index % 2 === 0 ? 0.4 : -0.3;
    $(`#${metric.key}`).value = Number(metric.sample + drift).toFixed(metric.step === "1" ? 0 : 1);
  });
});

$("#clearFormButton").addEventListener("click", resetForm);

$("#exportButton").addEventListener("click", async () => {
  if (!state.records.length) {
    showToast("目前沒有可匯出的紀錄");
    return;
  }

  const payload = JSON.stringify(sortedRecords(), null, 2);
  try {
    await navigator.clipboard.writeText(payload);
    showToast("JSON 已複製");
  } catch {
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "inbody-records.json";
    link.click();
    URL.revokeObjectURL(url);
  }
});

createMetricInputs();
loadRecords();
resetForm();
renderAll();

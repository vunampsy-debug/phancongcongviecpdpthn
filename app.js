/*
  PDP Task Manager
  - Frontend tĩnh: HTML/CSS/JS, deploy được trên Netlify.
  - Database: Google Spreadsheet thông qua Google Apps Script Web App.
  - Cấu trúc bảng: mỗi sheet = một tuần, hàng 2 = header, data từ hàng 3.
*/

const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbxw_V9fW5EwP_dZvwl113ewDqYHdDX-yurb2FH8OgxIlHYnzVvU-OyVtRRf8RUjYU19iw/exec"; // URL Google Apps Script Web App mặc định.

const DEFAULT_HEADERS = [
  "STT",
  "Họ và tên",
  "Hạng mục công việc",
  "Chi tiết công việc",
  "Ngày hoàn thành",
  "Số ngày còn lại",
  "Mức độ ưu tiên",
  "Trạng thái công việc",
  "Nhân sự phối hợp",
  "Link minh chứng",
  "Kết quả công việc của tuần trước",
  "Công việc của tuần sau",
  "Ghi chú"
];

const state = {
  apiUrl: "",
  meta: null,
  tasks: [],
  filteredTasks: [],
  editingTask: null
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const els = {
  apiUrl: $("#apiUrl"),
  statusBox: $("#statusBox"),
  pageTitle: $("#pageTitle"),
  dashboardView: $("#dashboardView"),
  tasksView: $("#tasksView"),
  settingsView: $("#settingsView"),
  filterWeek: $("#filterWeek"),
  dashboardBreakdownWeek: $("#dashboardBreakdownWeek"),
  filterPerson: $("#filterPerson"),
  filterCategory: $("#filterCategory"),
  filterPriority: $("#filterPriority"),
  filterProgress: $("#filterProgress"),
  searchInput: $("#searchInput"),
  taskTableBody: $("#taskTableBody"),
  taskCount: $("#taskCount"),
  taskEmpty: $("#taskEmpty"),
  settingsWeek: $("#settingsWeek"),
  applyHeaderMode: $("#applyHeaderMode"),
  headerEditor: $("#headerEditor"),
  categoryChips: $("#categoryChips"),
  newCategoryInput: $("#newCategoryInput"),
  taskDialog: $("#taskDialog"),
  taskForm: $("#taskForm"),
  taskDialogTitle: $("#taskDialogTitle"),
  deleteTaskBtn: $("#deleteTaskBtn"),
  taskSheetName: $("#taskSheetName"),
  taskPerson: $("#taskPerson"),
  personList: $("#personList"),
  taskCategory: $("#taskCategory"),
  categoryList: $("#categoryList"),
  taskPriority: $("#taskPriority"),
  taskDueDate: $("#taskDueDate"),
  taskProgress: $("#taskProgress"),
  taskCollaborators: $("#taskCollaborators"),
  taskDetail: $("#taskDetail"),
  taskEvidenceLink: $("#taskEvidenceLink"),
  taskPreviousResult: $("#taskPreviousResult"),
  taskNextWork: $("#taskNextWork"),
  taskRowNumber: $("#taskRowNumber"),
  taskOriginalSheet: $("#taskOriginalSheet")
};

init();

function init() {
  state.apiUrl = localStorage.getItem("PDP_API_URL") || DEFAULT_API_URL;
  els.apiUrl.value = state.apiUrl;

  bindEvents();
  renderHeaderEditor(DEFAULT_HEADERS);

  if (state.apiUrl) {
    loadAllData();
  } else {
    showStatus("Vào chức năng Nhúng URL và dán Google Apps Script Web App URL dạng /exec để bắt đầu kết nối dữ liệu.", "info");
  }
}

function bindEvents() {
  $("#saveApiUrlBtn").addEventListener("click", () => {
    state.apiUrl = els.apiUrl.value.trim();
    localStorage.setItem("PDP_API_URL", state.apiUrl);
    showStatus("Đã lưu URL API trên trình duyệt này.", "success");
  });

  $("#testApiBtn").addEventListener("click", async () => {
    state.apiUrl = els.apiUrl.value.trim();
    localStorage.setItem("PDP_API_URL", state.apiUrl);
    await loadAllData();
  });

  $("#refreshBtn").addEventListener("click", () => loadAllData({ refresh: true }));
  $("#openCreateTaskBtn").addEventListener("click", () => openTaskDialog());
  $("#closeDialogBtn").addEventListener("click", closeTaskDialog);
  $("#cancelTaskBtn").addEventListener("click", closeTaskDialog);

  $$(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  [els.filterWeek, els.filterPerson, els.filterCategory, els.filterPriority, els.filterProgress, els.searchInput]
    .forEach((el) => el.addEventListener("input", applyFilters));

  els.dashboardBreakdownWeek.addEventListener("input", renderDashboard);

  els.settingsWeek.addEventListener("change", () => {
    const sheet = getSelectedSettingsSheet();
    renderHeaderEditor(sheet?.headers?.length ? sheet.headers : DEFAULT_HEADERS);
  });

  $("#loadDefaultHeadersBtn").addEventListener("click", () => renderHeaderEditor(DEFAULT_HEADERS));
  $("#saveHeadersBtn").addEventListener("click", saveHeaders);
  $("#addCategoryBtn").addEventListener("click", addCategory);

  els.taskForm.addEventListener("submit", saveTask);
  els.deleteTaskBtn.addEventListener("click", deleteTask);
}

function switchView(view) {
  $$(".nav-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.view === view));
  $$(".view").forEach((section) => section.classList.remove("active"));

  const titles = {
    dashboard: "Tổng quan công việc tổ PDP",
    tasks: "Danh sách công việc theo tuần",
    settings: "Thiết lập database Google Sheet",
    embed: "Nhúng URL kết nối Google Spreadsheet"
  };

  $(`#${view}View`).classList.add("active");
  els.pageTitle.textContent = titles[view];
}

async function loadAllData(options = {}) {
  if (!state.apiUrl) {
    showStatus("Chưa có URL API. Hãy dán URL /exec từ Google Apps Script.", "error");
    return;
  }

  const refresh = options && options.refresh === true;
  setSyncing(true);
  showStatus(refresh ? "Đang đọc lại dữ liệu mới nhất từ Google Spreadsheet..." : "Đang tải dữ liệu từ Google Spreadsheet...", "info");

  try {
    const data = await apiGet("bootstrap", refresh ? { refresh: "1" } : {});

    state.meta = {
      spreadsheetName: data.spreadsheetName,
      spreadsheetId: data.spreadsheetId,
      timezone: data.timezone,
      sheets: Array.isArray(data.sheets) ? data.sheets : [],
      people: Array.isArray(data.people) ? data.people : [],
      categories: Array.isArray(data.categories) ? data.categories : []
    };
    state.tasks = normalizeTasks(data.tasks);

    hydrateControls();
    applyFilters();
    renderDashboard();
    showStatus(`Đã đồng bộ: ${state.meta.spreadsheetName || "Google Spreadsheet"}. Đọc ${state.tasks.length} công việc.`, "success");
  } catch (err) {
    console.error(err);
    showStatus(`Không thể kết nối API: ${err.message}`, "error");
  } finally {
    setSyncing(false);
  }
}

async function reloadSheets(sheetNames = []) {
  const names = unique(sheetNames.filter(Boolean));
  if (!names.length) {
    await loadAllData({ refresh: true });
    return;
  }

  setSyncing(true);
  showStatus(`Đang đồng bộ nhanh ${names.length} tab vừa thay đổi...`, "info");

  try {
    const results = await Promise.all(names.map((sheetName) => apiGet("tasks", { sheetName, refresh: "1" })));
    state.tasks = state.tasks.filter((task) => !names.includes(task.sheetName));
    results.forEach((result) => {
      state.tasks.push(...normalizeTasks(result.tasks));
    });

    hydrateControls();
    applyFilters();
    renderDashboard();
    showStatus(`Đã đồng bộ nhanh ${names.join(", ")}.`, "success");
  } catch (err) {
    console.error(err);
    showStatus(`Đồng bộ nhanh không thành công, đang tải lại toàn bộ dữ liệu: ${err.message}`, "error");
    await loadAllData({ refresh: true });
  } finally {
    setSyncing(false);
  }
}

async function apiGet(action, params = {}) {
  const url = new URL(state.apiUrl);
  url.searchParams.set("action", action);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const res = await fetch(url.toString(), { method: "GET", redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "API trả về lỗi không xác định");
  return data;
}

async function apiPost(action, payload = {}) {
  const res = await fetch(state.apiUrl, {
    method: "POST",
    redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, ...payload })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "API trả về lỗi không xác định");
  return data;
}

function hydrateControls() {
  const sheets = state.meta?.sheets || [];
  const people = unique([
    ...(state.meta?.people || []),
    ...state.tasks.map((task) => task.person)
  ].filter(Boolean));
  const categories = unique([
    ...(state.meta?.categories || []),
    ...state.tasks.map((task) => task.category)
  ].filter(Boolean));

  fillSelect(els.filterWeek, ["", ...sheets.map((s) => s.name)], "Tất cả");
  fillSelect(els.dashboardBreakdownWeek, ["", ...sheets.map((s) => s.name)], "Tất cả tuần");
  fillSelect(els.filterPerson, ["", ...people], "Tất cả");
  fillSelect(els.filterCategory, ["", ...categories], "Tất cả");
  fillSelect(els.settingsWeek, sheets.map((s) => s.name));
  fillSelect(els.taskSheetName, sheets.map((s) => s.name));

  fillDatalist(els.personList, people);
  fillDatalist(els.categoryList, categories);
  renderCategoryChips(categories);

  const selected = getSelectedSettingsSheet();
  renderHeaderEditor(selected?.headers?.length ? selected.headers : DEFAULT_HEADERS);
}

function fillSelect(select, values, emptyLabel = "") {
  const current = select.value;
  select.innerHTML = "";
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value || emptyLabel;
    select.appendChild(option);
  });
  if (values.includes(current)) select.value = current;
}

function fillDatalist(datalist, values) {
  datalist.innerHTML = values.map((value) => `<option value="${escapeAttr(value)}"></option>`).join("");
}

function renderCategoryChips(categories) {
  if (!categories.length) {
    els.categoryChips.innerHTML = `<div class="empty-state">Chưa có hạng mục công việc.</div>`;
    return;
  }
  els.categoryChips.innerHTML = categories.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join("");
}

function renderHeaderEditor(headers) {
  const normalized = [...headers];
  while (normalized.length < DEFAULT_HEADERS.length) normalized.push("");
  normalized[1] = "Họ và tên";
  normalized[2] = "Hạng mục công việc";

  els.headerEditor.innerHTML = normalized.map((header, index) => {
    const col = columnName(index + 1);
    const locked = index === 1 || index === 2;
    return `
      <label class="header-field ${locked ? "locked" : ""}">
        <span>Cột ${col}${locked ? " · cố định" : ""}</span>
        <input data-header-index="${index}" value="${escapeAttr(header || "")}" ${locked ? "readonly" : ""} />
      </label>
    `;
  }).join("");
}

async function saveHeaders() {
  if (!state.apiUrl) return showStatus("Chưa có URL API.", "error");

  const headers = $$('[data-header-index]').map((input) => input.value.trim());
  headers[1] = "Họ và tên";
  headers[2] = "Hạng mục công việc";

  try {
    const response = await apiPost("saveHeaders", {
      sheetName: els.settingsWeek.value,
      mode: els.applyHeaderMode.value,
      headers
    });
    showStatus("Đã lưu hàng 2 của bảng.", "success");
    await reloadSheets(response.result?.updatedSheets || [els.settingsWeek.value]);
  } catch (err) {
    showStatus(`Không lưu được header: ${err.message}`, "error");
  }
}

async function addCategory() {
  const category = els.newCategoryInput.value.trim();
  if (!category) return showStatus("Nhập tên hạng mục trước khi thêm.", "error");

  try {
    const response = await apiPost("addCategory", { category });
    els.newCategoryInput.value = "";
    state.meta.categories = unique([...(state.meta?.categories || []), response.result?.category || category]);
    hydrateControls();
    showStatus(response.result?.created === false ? "Hạng mục này đã có trong danh sách." : "Đã thêm hạng mục công việc.", "success");
  } catch (err) {
    showStatus(`Không thêm được hạng mục: ${err.message}`, "error");
  }
}

function applyFilters() {
  const week = els.filterWeek.value;
  const person = els.filterPerson.value;
  const category = els.filterCategory.value;
  const priority = els.filterPriority.value;
  const progress = els.filterProgress.value;
  const keyword = normalizeText(els.searchInput.value);

  state.filteredTasks = state.tasks.filter((task) => {
    const haystack = normalizeText([
      task.sheetName,
      task.person,
      task.category,
      task.detail,
      task.priority,
      task.progress,
      task.collaborators,
      task.link,
      task.previousResult,
      task.nextWork,
      task.note
    ].join(" "));

    return (!week || task.sheetName === week)
      && (!person || task.person === person)
      && (!category || task.category === category)
      && (!priority || task.priority === priority)
      && (!progress || task.progress === progress)
      && (!keyword || haystack.includes(keyword));
  });

  renderTaskTable();
  renderDashboard();
}

function renderTaskTable() {
  els.taskCount.textContent = `${state.filteredTasks.length} mục`;
  els.taskEmpty.classList.toggle("hidden", state.filteredTasks.length > 0);

  els.taskTableBody.innerHTML = state.filteredTasks.map((task) => {
    const dayLabel = getDaysLeftLabel(task);
    const priorityClass = task.priority === "Cao" ? "high" : task.priority === "Trung Bình" ? "medium" : "low";
    const progressClass = task.progress === "Hoàn thành" ? "done" : "";

    return `
      <tr class="task-main-row">
        <td><strong>${escapeHtml(task.sheetName || "")}</strong></td>
        <td>${escapeHtml(task.person || "")}</td>
        <td>${escapeHtml(task.category || "")}</td>
        <td class="detail-cell">${escapeHtml(task.detail || "")}</td>
        <td>${escapeHtml(formatDate(task.dueDate) || "")}</td>
        <td>${escapeHtml(dayLabel)}</td>
        <td><span class="badge ${priorityClass}">${escapeHtml(task.priority || "")}</span></td>
        <td><span class="badge ${progressClass}">${escapeHtml(task.progress || "")}</span></td>
        <td>${escapeHtml(task.collaborators || "")}</td>
        <td class="row-actions">
          <button class="btn ghost compact" data-toggle-task="${escapeAttr(task.uid)}">Mở rộng</button>
          <button class="btn ghost compact" data-edit-task="${escapeAttr(task.uid)}">Sửa</button>
        </td>
      </tr>
      <tr class="task-extra-row hidden" data-extra-task="${escapeAttr(task.uid)}">
        <td colspan="10">
          <div class="task-extra-card">
            <div class="extra-item">
              <span>Link minh chứng</span>
              ${renderEvidenceLink(task.link)}
            </div>
            <div class="extra-item">
              <span>Kết quả công việc của tuần trước</span>
              <p>${escapeHtml(task.previousResult || "Chưa có dữ liệu")}</p>
            </div>
            <div class="extra-item">
              <span>Công việc của tuần sau</span>
              <p>${escapeHtml(task.nextWork || "Chưa có dữ liệu")}</p>
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  $$('[data-edit-task]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const task = state.tasks.find((item) => item.uid === btn.dataset.editTask);
      if (task) openTaskDialog(task);
    });
  });

  $$('[data-toggle-task]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const row = $$('[data-extra-task]').find((item) => item.dataset.extraTask === btn.dataset.toggleTask);
      if (!row) return;
      const isHidden = row.classList.toggle("hidden");
      btn.textContent = isHidden ? "Mở rộng" : "Thu gọn";
    });
  });
}

function renderDashboard() {
  const tasks = state.tasks;
  const high = tasks.filter((task) => task.priority === "Cao").length;
  const done = tasks.filter((task) => task.progress === "Hoàn thành").length;
  const dueSoon = tasks.filter((task) => {
    const days = getDaysLeft(task);
    return Number.isFinite(days) && days >= 0 && days <= 2 && task.progress !== "Hoàn thành";
  }).length;

  $("#statTotal").textContent = tasks.length;
  $("#statDueSoon").textContent = dueSoon;
  $("#statHigh").textContent = high;
  $("#statDone").textContent = done;

  const attention = tasks
    .filter((task) => {
      const days = getDaysLeft(task);
      const isOverdue = Number.isFinite(days) && days < 0;
      const isDueSoon = Number.isFinite(days) && days >= 0 && days <= 2;

      return !isOverdue
        && task.progress !== "Hoàn thành"
        && (task.priority === "Cao" || isDueSoon);
    })
    .slice(0, 8);

  $("#attentionCount").textContent = `${attention.length} mục`;
  $("#attentionList").classList.toggle("empty-state", attention.length === 0);
  $("#attentionList").innerHTML = attention.length
    ? attention.map((task) => `
      <div class="compact-item">
        <strong>${escapeHtml(task.category || "Chưa có hạng mục")}</strong>
        <span>${escapeHtml(task.person || "Chưa có nhân sự")} · ${escapeHtml(task.sheetName || "")} · ${escapeHtml(getDaysLeftLabel(task))}</span>
      </div>
    `).join("")
    : "Chưa có dữ liệu.";

  const selectedBreakdownWeek = els.dashboardBreakdownWeek.value;
  const breakdownTasks = selectedBreakdownWeek
    ? tasks.filter((task) => task.sheetName === selectedBreakdownWeek)
    : tasks;

  renderPersonBreakdown(breakdownTasks);
}

function renderPersonBreakdown(tasks) {
  const counts = new Map();
  tasks.forEach((task) => {
    if (!task.person) return;
    counts.set(task.person, (counts.get(task.person) || 0) + 1);
  });

  const rows = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...rows.map((row) => row[1]), 1);
  const container = $("#personBreakdown");

  container.classList.toggle("empty-state", rows.length === 0);
  container.innerHTML = rows.length
    ? rows.map(([person, count]) => `
      <div class="bar-row">
        <div class="bar-meta"><span>${escapeHtml(person)}</span><span>${count}</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round(count / max * 100)}%"></div></div>
      </div>
    `).join("")
    : "Chưa có dữ liệu.";
}

function openTaskDialog(task = null) {
  if (!state.meta?.sheets?.length) {
    showStatus("Cần kết nối API và tải danh sách tab trước khi tạo công việc.", "error");
    return;
  }

  state.editingTask = task;
  els.taskDialogTitle.textContent = task ? "Sửa nhãn công việc" : "Tạo nhãn công việc mới";
  els.deleteTaskBtn.classList.toggle("hidden", !task);

  const firstSheet = state.meta.sheets[0]?.name || "";
  els.taskOriginalSheet.value = task?.sheetName || "";
  els.taskRowNumber.value = task?.rowNumber || "";
  els.taskSheetName.value = task?.sheetName || els.filterWeek.value || firstSheet;
  els.taskPerson.value = task?.person || "";
  els.taskCategory.value = task?.category || "";
  els.taskPriority.value = task?.priority || "Trung Bình";
  els.taskDueDate.value = toInputDate(task?.dueDate || "");
  els.taskProgress.value = task?.progress || "0%";
  els.taskCollaborators.value = task?.collaborators || "";
  els.taskDetail.value = task?.detail || "";
  els.taskEvidenceLink.value = task?.link || "";
  els.taskPreviousResult.value = task?.previousResult || "";
  els.taskNextWork.value = task?.nextWork || "";

  els.taskDialog.showModal();
}

function closeTaskDialog() {
  els.taskDialog.close();
  els.taskForm.reset();
  state.editingTask = null;
}

async function saveTask(event) {
  event.preventDefault();
  if (!state.apiUrl) return showStatus("Chưa có URL API.", "error");

  const task = {
    sheetName: els.taskSheetName.value,
    originalSheetName: els.taskOriginalSheet.value,
    rowNumber: Number(els.taskRowNumber.value) || null,
    person: els.taskPerson.value.trim(),
    category: els.taskCategory.value.trim(),
    detail: els.taskDetail.value.trim(),
    dueDate: els.taskDueDate.value,
    priority: els.taskPriority.value,
    progress: els.taskProgress.value,
    collaborators: els.taskCollaborators.value.trim(),
    link: els.taskEvidenceLink.value.trim(),
    previousResult: els.taskPreviousResult.value.trim(),
    nextWork: els.taskNextWork.value.trim()
  };

  if (!task.person) {
    showStatus("Chỉ lưu nhãn công việc khi có tên người thực hiện.", "error");
    return;
  }

  const originalTask = state.editingTask ? { ...state.editingTask } : null;

  try {
    const response = await apiPost(task.rowNumber ? "updateTask" : "createTask", { task });
    const savedTask = response.result?.task;
    closeTaskDialog();
    showStatus("Đã lưu công việc vào Google Spreadsheet.", "success");

    if (savedTask) {
      upsertTaskLocally(savedTask, originalTask);
    } else {
      const changedSheets = [task.sheetName];
      if (task.originalSheetName && task.originalSheetName !== task.sheetName) changedSheets.push(task.originalSheetName);
      await reloadSheets(changedSheets);
    }
  } catch (err) {
    showStatus(`Không lưu được công việc: ${err.message}`, "error");
  }
}

async function deleteTask() {
  if (!state.editingTask) return;
  const ok = confirm("Xóa nội dung nhãn công việc này khỏi Google Sheet?");
  if (!ok) return;

  const deletedTask = { ...state.editingTask };

  try {
    await apiPost("deleteTask", {
      sheetName: deletedTask.sheetName,
      rowNumber: deletedTask.rowNumber
    });
    closeTaskDialog();
    state.tasks = state.tasks.filter((task) => !isSameTaskLocation(task, deletedTask.sheetName, deletedTask.rowNumber));
    refreshLocalViews();
    showStatus("Đã xóa nhãn công việc.", "success");
  } catch (err) {
    showStatus(`Không xóa được công việc: ${err.message}`, "error");
  }
}

function upsertTaskLocally(savedTask, originalTask) {
  if (originalTask?.rowNumber) {
    state.tasks = state.tasks.filter((task) => !isSameTaskLocation(task, originalTask.sheetName, originalTask.rowNumber));
  }

  state.tasks = state.tasks.filter((task) => !isSameTaskLocation(task, savedTask.sheetName, savedTask.rowNumber));
  state.tasks.push(savedTask);

  const sheetMeta = state.meta?.sheets?.find((sheet) => sheet.name === savedTask.sheetName);
  if (sheetMeta) sheetMeta.lastRow = Math.max(Number(sheetMeta.lastRow) || 0, Number(savedTask.rowNumber) || 0);
  refreshLocalViews();
}

function isSameTaskLocation(task, sheetName, rowNumber) {
  return task?.sheetName === sheetName && Number(task?.rowNumber) === Number(rowNumber);
}

function refreshLocalViews() {
  hydrateControls();
  applyFilters();
  renderDashboard();
}


function normalizeTasks(tasks) {
  return (Array.isArray(tasks) ? tasks : []).filter((task) => String(task?.person || "").trim());
}


function getDaysLeft(task) {
  const byDueDate = calculateDaysLeftFromDate(task?.dueDate);
  if (Number.isFinite(byDueDate)) return byDueDate;

  const fromSheet = Number(task?.daysLeft);
  return Number.isFinite(fromSheet) ? fromSheet : NaN;
}

function getDaysLeftLabel(task) {
  const days = getDaysLeft(task);

  if (!task?.dueDate && task?.daysLeftLabel) return task.daysLeftLabel;
  if (!task?.dueDate || !Number.isFinite(days)) return "Chưa có deadline";
  if (days < 0) return "Hết hạn";
  if (days === 0) return "Hôm nay là deadline";
  return `Còn ${days} ngày`;
}

function calculateDaysLeftFromDate(value) {
  if (!value) return NaN;

  const inputDate = toInputDate(value);
  if (!inputDate) return NaN;

  const [year, month, day] = inputDate.split("-").map(Number);
  const due = new Date(year, month - 1, day);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return Math.ceil((due.getTime() - today.getTime()) / 86400000);
}

function renderEvidenceLink(value) {
  const text = String(value || "").trim();
  if (!text) return `<p>Chưa có dữ liệu</p>`;

  const safeText = escapeHtml(text);
  const href = /^https?:\/\//i.test(text) ? text : "";
  if (!href) return `<p>${safeText}</p>`;

  return `<a class="evidence-link" href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">Mở minh chứng</a><p class="link-preview">${safeText}</p>`;
}

function getSelectedSettingsSheet() {
  const name = els.settingsWeek.value;
  return (state.meta?.sheets || []).find((sheet) => sheet.name === name);
}

function setSyncing(isSyncing) {
  const refreshBtn = $("#refreshBtn");
  const testBtn = $("#testApiBtn");
  const saveBtn = $("#saveApiUrlBtn");

  [refreshBtn, testBtn, saveBtn].filter(Boolean).forEach((button) => {
    button.disabled = isSyncing;
    button.classList.toggle("is-loading", isSyncing);
  });

  if (refreshBtn) refreshBtn.textContent = isSyncing ? "Đang đồng bộ..." : "Làm mới dữ liệu";
}

function showStatus(message, type = "info") {
  els.statusBox.textContent = message;
  els.statusBox.className = `status-box ${type === "error" ? "error" : type === "success" ? "success" : ""}`;
}

function unique(values) {
  return Array.from(new Set(values.map((value) => String(value).trim()).filter(Boolean)));
}

function normalizeText(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function formatDate(value) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(String(value))) {
    const [y, m, d] = String(value).slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
  }
  return String(value);
}

function toInputDate(value) {
  if (!value) return "";
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  return "";
}

function columnName(index) {
  let name = "";
  while (index > 0) {
    const rem = (index - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    index = Math.floor((index - 1) / 26);
  }
  return name;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

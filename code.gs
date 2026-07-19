/**
 * PDP Task Manager API for Google Apps Script
 *
 * Bản tối ưu đồng bộ:
 * - Frontend dùng action=bootstrap để đọc meta + task trong một lượt quét spreadsheet.
 * - Sau khi tạo/sửa/xóa công việc, frontend chỉ đọc lại tab/sheet vừa thay đổi thay vì đọc toàn bộ workbook.
 * - Chỉ những dòng có tên người thực hiện ở cột B mới được trả về thành nhãn công việc.
 * - Cột Số ngày còn lại dùng công thức tự động tính từ Ngày hoàn thành - TODAY().
 * - Cột Mức độ ưu tiên và Trạng thái công việc được thiết lập dropdown trong Google Sheet.
 * - Lưu thêm Link minh chứng, Kết quả tuần trước và Công việc tuần sau vào nhãn công việc.
 *
 * Cách dùng:
 * 1) Mở Google Spreadsheet thật cần dùng làm database.
 * 2) Extensions > Apps Script.
 * 3) Dán toàn bộ file này vào Code.gs.
 * 4) Nếu script được tạo trực tiếp từ spreadsheet, có thể để SPREADSHEET_ID = "".
 *    Nếu script là standalone, dán ID spreadsheet vào SPREADSHEET_ID.
 * 5) Deploy > Manage deployments > Edit deployment > New version > Deploy.
 */

const SPREADSHEET_ID = ""; // Dán ID spreadsheet nếu không dùng script bound với spreadsheet.
const HEADER_ROW = 2;
const DATA_START_ROW = 3;
const MIN_COLUMNS = 13;
const CONFIG_SHEET_NAME = "_PDP_Config";
const PRIORITY_OPTIONS = ["Thấp", "Trung Bình", "Cao"];
const PROGRESS_OPTIONS = ["0%", "25%", "50%", "75%", "Hoàn thành"];

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

const FIELD_ALIASES = {
  stt: ["stt", "số thứ tự"],
  person: ["họ và tên", "ten nguoi thuc hien", "tên người thực hiện", "người thực hiện", "nhân sự phụ trách"],
  category: ["hạng mục công việc", "hang muc cong viec", "hạng mục", "nhãn công việc", "nhom cong viec", "nhóm công việc"],
  detail: ["chi tiết công việc", "chi tiet cong viec", "mô tả chi tiết", "mo ta chi tiet", "mô tả công việc"],
  dueDate: ["ngày hoàn thành", "ngay hoan thanh", "deadline", "hạn hoàn thành"],
  daysLeft: ["số ngày còn lại", "so ngay con lai", "còn lại"],
  priority: ["mức độ ưu tiên", "muc do uu tien", "ưu tiên"],
  progress: ["trạng thái công việc", "trang thai cong viec", "tiến độ", "tien do", "trạng thái", "trang thai"],
  collaborators: ["nhân sự phối hợp", "nhan su phoi hop", "người phối hợp", "nguoi phoi hop"],
  link: ["link minh chứng", "link minh chung", "link", "đường dẫn", "duong dan", "minh chứng", "minh chung"],
  previousResult: ["kết quả công việc của tuần trước", "ket qua cong viec cua tuan truoc"],
  nextWork: ["công việc của tuần sau", "cong viec cua tuan sau"],
  note: ["ghi chú", "ghi chu"]
};

function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    const action = String(params.action || "bootstrap").trim();

    const applyAutomation = String(params.force || "") === "1";

    if (action === "bootstrap") return json_({ ok: true, ...getBootstrap_(applyAutomation) });
    if (action === "meta") return json_({ ok: true, ...getMeta_() });
    if (action === "tasks") {
      const sheetName = String(params.sheetName || "").trim();
      return json_({ ok: true, tasks: sheetName ? getTasksForSheet_(sheetName, applyAutomation) : getAllTasks_(applyAutomation) });
    }
    if (action === "ping") return json_({ ok: true, message: "PDP API is ready" });

    return json_({ ok: false, error: "Unknown GET action: " + action });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function doPost(e) {
  try {
    const body = parseBody_(e);
    const action = body.action;

    if (action === "createTask") return json_({ ok: true, result: createTask_(body.task) });
    if (action === "updateTask") return json_({ ok: true, result: updateTask_(body.task) });
    if (action === "deleteTask") return json_({ ok: true, result: deleteTask_(body.sheetName, body.rowNumber) });
    if (action === "saveHeaders") return json_({ ok: true, result: saveHeaders_(body.sheetName, body.headers, body.mode) });
    if (action === "addCategory") return json_({ ok: true, result: addCategory_(body.category) });

    return json_({ ok: false, error: "Unknown POST action: " + action });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function getBootstrap_(applyAutomation) {
  return readWorkbook_(applyAutomation);
}

function getMeta_() {
  const data = readWorkbook_();
  return {
    spreadsheetName: data.spreadsheetName,
    spreadsheetId: data.spreadsheetId,
    timezone: data.timezone,
    sheets: data.sheets,
    people: data.people,
    categories: data.categories
  };
}

function getAllTasks_(applyAutomation) {
  return readWorkbook_(applyAutomation).tasks;
}

function getTasksForSheet_(sheetName, applyAutomation) {
  return readSingleSheet_(getSheetByName_(sheetName), applyAutomation).tasks;
}

function readWorkbook_(applyAutomation) {
  const ss = getSpreadsheet_();
  const tasks = [];
  const people = [];
  const categories = [];
  const sheets = [];

  getWorkSheets_().forEach(sheet => {
    const data = readSingleSheet_(sheet, applyAutomation);
    sheets.push(data.sheetMeta);
    tasks.push(...data.tasks);
    data.people.forEach(value => people.push(value));
    data.categories.forEach(value => categories.push(value));
  });

  getConfigCategories_().forEach(value => categories.push(value));

  return {
    spreadsheetName: ss.getName(),
    spreadsheetId: ss.getId(),
    timezone: Session.getScriptTimeZone(),
    sheets,
    people: unique_(people),
    categories: unique_(categories),
    tasks
  };
}

function readSingleSheet_(sheet, applyAutomation) {
  ensureHeaders_(sheet);

  const sheetName = sheet.getName();
  const headers = getHeaders_(sheet);
  const columnMap = getColumnMap_(headers);
  if (applyAutomation) applySheetAutomation_(sheet, columnMap);
  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(sheet.getLastColumn(), MIN_COLUMNS);
  const tasks = [];
  const people = [];
  const categories = [];

  if (lastRow >= DATA_START_ROW) {
    const values = sheet.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, lastCol).getValues();

    values.forEach((row, index) => {
      const rowNumber = DATA_START_ROW + index;
      const task = rowToTask_(sheetName, rowNumber, row, headers, columnMap);
      if (isBlankTask_(task)) return;
      tasks.push(task);
      if (task.person) people.push(task.person);
      if (task.category) categories.push(task.category);
    });
  }

  return {
    sheetMeta: {
      name: sheetName,
      lastRow,
      lastColumn: lastCol,
      headers
    },
    tasks,
    people,
    categories
  };
}

function createTask_(task) {
  validateTask_(task);
  const sheet = getSheetByName_(task.sheetName);
  ensureHeaders_(sheet);
  const headers = getHeaders_(sheet);
  const columnMap = getColumnMap_(headers);
  const rowNumber = findWritableRow_(sheet, task.person);

  writeTaskToRow_(sheet, rowNumber, task, headers, columnMap, false);
  SpreadsheetApp.flush();
  return { sheetName: sheet.getName(), rowNumber };
}

function updateTask_(task) {
  validateTask_(task);
  if (!task.rowNumber) throw new Error("Thiếu rowNumber để cập nhật công việc.");

  const originalSheetName = task.originalSheetName || task.sheetName;

  if (originalSheetName !== task.sheetName) {
    deleteTask_(originalSheetName, task.rowNumber);
    return createTask_(task);
  }

  const sheet = getSheetByName_(task.sheetName);
  ensureHeaders_(sheet);
  const headers = getHeaders_(sheet);
  const columnMap = getColumnMap_(headers);
  writeTaskToRow_(sheet, Number(task.rowNumber), task, headers, columnMap, true);
  SpreadsheetApp.flush();

  return { sheetName: sheet.getName(), rowNumber: Number(task.rowNumber) };
}

function deleteTask_(sheetName, rowNumber) {
  const sheet = getSheetByName_(sheetName);
  const row = Number(rowNumber);
  if (!row || row < DATA_START_ROW) throw new Error("rowNumber không hợp lệ.");

  const lastCol = Math.max(sheet.getLastColumn(), MIN_COLUMNS);
  sheet.getRange(row, 1, 1, lastCol).clearContent();

  SpreadsheetApp.flush();
  return { sheetName, rowNumber: row };
}

function saveHeaders_(sheetName, headers, mode) {
  if (!Array.isArray(headers) || !headers.length) throw new Error("Danh sách header không hợp lệ.");
  const outputHeaders = headers.slice(0, Math.max(headers.length, MIN_COLUMNS));
  while (outputHeaders.length < MIN_COLUMNS) outputHeaders.push("");
  outputHeaders[1] = "Họ và tên";
  outputHeaders[2] = "Hạng mục công việc";

  const targetSheets = mode === "all" ? getWorkSheets_() : [getSheetByName_(sheetName)];
  targetSheets.forEach(sheet => {
    sheet.getRange(HEADER_ROW, 1, 1, outputHeaders.length).setValues([outputHeaders]);
    sheet.setFrozenRows(HEADER_ROW);
    sheet.setFrozenColumns(3);
    applySheetAutomation_(sheet, getColumnMap_(outputHeaders));
  });

  SpreadsheetApp.flush();
  return { updatedSheets: targetSheets.map(sheet => sheet.getName()), headers: outputHeaders };
}

function addCategory_(category) {
  const value = String(category || "").trim();
  if (!value) throw new Error("Tên hạng mục đang trống.");

  const sheet = getConfigSheet_();
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const values = lastRow >= 2 ? sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat().map(String) : [];
  const exists = values.some(item => normalize_(item) === normalize_(value));

  if (!exists) sheet.appendRow([value]);
  SpreadsheetApp.flush();
  return { category: value, created: !exists };
}

function getSpreadsheet_() {
  if (SPREADSHEET_ID && SPREADSHEET_ID.trim()) {
    return SpreadsheetApp.openById(SPREADSHEET_ID.trim());
  }
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error("Không tìm thấy active spreadsheet. Hãy dán SPREADSHEET_ID vào Code.gs.");
  return active;
}

function getWorkSheets_() {
  return getSpreadsheet_().getSheets().filter(sheet => !sheet.getName().startsWith("_"));
}

function getSheetByName_(sheetName) {
  const sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) throw new Error("Không tìm thấy sheet: " + sheetName);
  return sheet;
}

function getHeaders_(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), MIN_COLUMNS);
  return sheet.getRange(HEADER_ROW, 1, 1, lastCol).getValues()[0].map(value => String(value || "").trim());
}

function ensureHeaders_(sheet) {
  const headers = getHeaders_(sheet);
  const hasAnyHeader = headers.some(Boolean);
  if (!hasAnyHeader) {
    sheet.getRange(HEADER_ROW, 1, 1, DEFAULT_HEADERS.length).setValues([DEFAULT_HEADERS]);
    sheet.setFrozenRows(HEADER_ROW);
    sheet.setFrozenColumns(3);
  }
}

function getColumnMap_(headers) {
  const map = {};
  Object.keys(FIELD_ALIASES).forEach(field => {
    map[field] = findColumn_(headers, FIELD_ALIASES[field]);
  });

  // Fallback theo cấu trúc mẫu nếu header bị sửa lệch.
  map.stt = map.stt || 1;
  map.person = map.person || 2;
  map.category = map.category || 3;
  map.detail = map.detail || 4;
  map.dueDate = map.dueDate || 5;
  map.daysLeft = map.daysLeft || 6;
  map.priority = map.priority || 7;
  map.progress = map.progress || 8;
  map.collaborators = map.collaborators || 9;
  map.link = map.link || 10;
  map.previousResult = map.previousResult || 11;
  map.nextWork = map.nextWork || 12;
  map.note = map.note || 13;

  return map;
}

function findColumn_(headers, aliases) {
  const normalizedHeaders = headers.map(normalize_);
  for (let i = 0; i < aliases.length; i++) {
    const index = normalizedHeaders.indexOf(normalize_(aliases[i]));
    if (index >= 0) return index + 1;
  }
  return null;
}

function rowToTask_(sheetName, rowNumber, row, headers, columnMap) {
  const get = field => {
    const col = columnMap[field];
    return col ? row[col - 1] : "";
  };

  const raw = {};
  headers.forEach((header, index) => {
    if (header) raw[header] = formatCellValue_(row[index]);
  });

  const dueDate = formatDateForJson_(get("dueDate"));
  const daysLeftNumber = calculateDaysLeft_(get("dueDate"));
  const daysLeftLabel = makeDaysLeftLabel_(get("dueDate"));

  return {
    uid: [sheetName, rowNumber].join("::"),
    sheetName,
    rowNumber,
    stt: formatCellValue_(get("stt")),
    person: formatCellValue_(get("person")),
    category: formatCellValue_(get("category")),
    detail: formatCellValue_(get("detail")),
    dueDate,
    daysLeft: daysLeftNumber === "" ? "" : daysLeftNumber,
    daysLeftLabel,
    priority: formatCellValue_(get("priority")) || "Trung Bình",
    progress: formatCellValue_(get("progress")) || "0%",
    collaborators: formatCellValue_(get("collaborators")),
    link: formatCellValue_(get("link")),
    previousResult: formatCellValue_(get("previousResult")),
    nextWork: formatCellValue_(get("nextWork")),
    note: formatCellValue_(get("note")),
    raw
  };
}

function writeTaskToRow_(sheet, rowNumber, task, headers, columnMap, isUpdate) {
  const lastCol = Math.max(sheet.getLastColumn(), MIN_COLUMNS);
  const current = rowNumber <= sheet.getLastRow()
    ? sheet.getRange(rowNumber, 1, 1, lastCol).getValues()[0]
    : new Array(lastCol).fill("");

  setByCol_(current, columnMap.stt, current[columnMap.stt - 1] || makeStt_(sheet, rowNumber));
  setByCol_(current, columnMap.person, task.person);
  setByCol_(current, columnMap.category, task.category);
  setByCol_(current, columnMap.detail, task.detail);
  setByCol_(current, columnMap.dueDate, task.dueDate ? new Date(task.dueDate + "T00:00:00") : "");
  setByCol_(current, columnMap.daysLeft, "");
  setByCol_(current, columnMap.priority, task.priority || "Trung Bình");
  setByCol_(current, columnMap.progress, task.progress || "0%");
  setByCol_(current, columnMap.collaborators, task.collaborators || "");
  setByCol_(current, columnMap.link, task.link || "");
  setByCol_(current, columnMap.previousResult, task.previousResult || "");
  setByCol_(current, columnMap.nextWork, task.nextWork || "");

  sheet.getRange(rowNumber, 1, 1, lastCol).setValues([current]);

  if (columnMap.dueDate) sheet.getRange(rowNumber, columnMap.dueDate).setNumberFormat("yyyy-mm-dd");
  setDaysLeftFormulaForRow_(sheet, rowNumber, columnMap);
  applyDropdownValidation_(sheet, columnMap);
  return { sheetName: sheet.getName(), rowNumber, isUpdate };
}

function findWritableRow_(sheet, person) {
  const lastRow = Math.max(sheet.getLastRow(), DATA_START_ROW - 1);
  const lastCol = Math.max(sheet.getLastColumn(), MIN_COLUMNS);

  // Chỉ tái sử dụng những dòng hoàn toàn trống trong vùng dữ liệu.
  // Dòng đã có tên người thực hiện được xem là một nhãn công việc hợp lệ,
  // kể cả khi chưa có hạng mục công việc, nên không được ghi đè.
  if (lastRow >= DATA_START_ROW) {
    const columnMap = columnMapFromSheet_(sheet);
    const rows = sheet.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, lastCol).getValues();
    for (let i = 0; i < rows.length; i++) {
      const isEmptyRow = isWritableEmptyRow_(rows[i], columnMap);
      if (isEmptyRow) return DATA_START_ROW + i;
    }
  }

  return lastRow + 1;
}

function isBlankTask_(task) {
  // Quy tắc lọc dữ liệu chính:
  // - Chỉ tạo nhãn công việc trên website khi dòng có tên người thực hiện ở cột B.
  // - Dòng trắng hoàn toàn hoặc dòng có dữ liệu khác nhưng thiếu tên người thực hiện đều bị bỏ qua.
  // - Dòng có tên người thực hiện nhưng chưa có hạng mục công việc vẫn được giữ lại.
  return !String(task.person || "").trim();
}

function validateTask_(task) {
  if (!task) throw new Error("Thiếu dữ liệu công việc.");
  if (!task.sheetName) throw new Error("Thiếu tên tab tuần.");
  if (!String(task.person || "").trim()) throw new Error("Thiếu tên người thực hiện.");
}

function getConfigCategories_() {
  const categories = [];
  const configSheet = getConfigSheet_(false);
  if (configSheet && configSheet.getLastRow() >= 2) {
    const configValues = configSheet.getRange(2, 1, configSheet.getLastRow() - 1, 1).getValues().flat();
    configValues.forEach(value => {
      const category = String(value || "").trim();
      if (category) categories.push(category);
    });
  }
  return categories;
}

function getPeople_() {
  return readWorkbook_().people;
}

function getCategories_() {
  return readWorkbook_().categories;
}

function getConfigSheet_(createIfMissing) {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(CONFIG_SHEET_NAME);
  if (!sheet && createIfMissing === false) return null;
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG_SHEET_NAME);
    sheet.getRange(1, 1).setValue("Hạng mục công việc");
    sheet.hideSheet();
  }
  return sheet;
}

function applySheetAutomation_(sheet, columnMap) {
  applyDropdownValidation_(sheet, columnMap);
  syncDaysLeftFormulasForExistingTasks_(sheet, columnMap);
}

function applyDropdownValidation_(sheet, columnMap) {
  const maxRows = Math.max(sheet.getMaxRows() - DATA_START_ROW + 1, 1);

  if (columnMap.priority) {
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(PRIORITY_OPTIONS, true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(DATA_START_ROW, columnMap.priority, maxRows, 1).setDataValidation(rule);
  }

  if (columnMap.progress) {
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(PROGRESS_OPTIONS, true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(DATA_START_ROW, columnMap.progress, maxRows, 1).setDataValidation(rule);
  }
}

function syncDaysLeftFormulasForExistingTasks_(sheet, columnMap) {
  if (!columnMap.person || !columnMap.dueDate || !columnMap.daysLeft) return;

  const lastRow = sheet.getLastRow();
  if (lastRow < DATA_START_ROW) return;

  const rowCount = lastRow - DATA_START_ROW + 1;
  const people = sheet.getRange(DATA_START_ROW, columnMap.person, rowCount, 1).getValues();
  const formulas = people.map((row, index) => {
    const rowNumber = DATA_START_ROW + index;
    const hasPerson = String(row[0] || "").trim() !== "";
    return [hasPerson ? makeDaysLeftFormula_(rowNumber, columnMap.dueDate) : ""];
  });

  sheet.getRange(DATA_START_ROW, columnMap.daysLeft, rowCount, 1).setFormulas(formulas);
}

function setDaysLeftFormulaForRow_(sheet, rowNumber, columnMap) {
  if (!columnMap.dueDate || !columnMap.daysLeft) return;
  sheet.getRange(rowNumber, columnMap.daysLeft).setFormula(makeDaysLeftFormula_(rowNumber, columnMap.dueDate));
}

function makeDaysLeftFormula_(rowNumber, dueDateCol) {
  const dueRef = columnLetter_(dueDateCol) + rowNumber;
  const sep = getFormulaSeparator_();
  return '=IF(' + dueRef + '=""' + sep + '"Chưa có deadline"' + sep +
    'IF(' + dueRef + '<TODAY()' + sep + '"Hết hạn"' + sep +
    'IF(' + dueRef + '=TODAY()' + sep + '"Hôm nay là deadline"' + sep +
    '"Còn "&(' + dueRef + '-TODAY())&" ngày")))';
}

function getFormulaSeparator_() {
  const locale = String(getSpreadsheet_().getSpreadsheetLocale() || "").toLowerCase();
  const semicolonLocales = [
    "vi", "fr", "de", "es", "it", "pt", "ru", "nl", "pl", "tr",
    "id", "da", "sv", "fi", "no", "cs", "hu", "ro", "uk", "el"
  ];
  return semicolonLocales.some(prefix => locale === prefix || locale.startsWith(prefix + "_") || locale.startsWith(prefix + "-")) ? ";" : ",";
}

function makeDaysLeftLabel_(value) {
  if (!value) return "Chưa có deadline";
  const days = calculateDaysLeft_(value);
  if (days === "") return "Chưa có deadline";
  if (days < 0) return "Hết hạn";
  if (days === 0) return "Hôm nay là deadline";
  return "Còn " + days + " ngày";
}

function columnLetter_(index) {
  let name = "";
  let value = Number(index);
  while (value > 0) {
    const rem = (value - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function columnMapFromSheet_(sheet) {
  return getColumnMap_(getHeaders_(sheet));
}

function isWritableEmptyRow_(row, columnMap) {
  return row.every((cell, index) => {
    const col = index + 1;
    if (col === columnMap.daysLeft) return true;
    return String(cell || "").trim() === "";
  });
}

function makeStt_(sheet, rowNumber) {
  return rowNumber - DATA_START_ROW + 1;
}

function setByCol_(row, col, value) {
  if (!col) return;
  row[col - 1] = value;
}

function calculateDaysLeft_(value) {
  if (!value) return "";
  const due = value instanceof Date ? value : new Date(value);
  if (isNaN(due.getTime())) return "";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  return Math.ceil((dueDay.getTime() - today.getTime()) / 86400000);
}

function formatDateForJson_(value) {
  if (!value) return "";
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  const date = new Date(value);
  if (!isNaN(date.getTime())) return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd");
  return String(value);
}

function formatCellValue_(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return String(value).trim();
}

function normalize_(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

function unique_(values) {
  const seen = {};
  const result = [];
  values.forEach(value => {
    const text = String(value || "").trim();
    const key = normalize_(text);
    if (!text || seen[key]) return;
    seen[key] = true;
    result.push(text);
  });
  return result;
}

function parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) throw new Error("POST body trống.");
  return JSON.parse(e.postData.contents);
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

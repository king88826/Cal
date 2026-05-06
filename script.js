const displayZone = document.getElementById("display-zone");
const historyList = document.getElementById("history-list");
const previewDisplay = document.getElementById("preview-display");
const expressionDisplay = document.getElementById("expression-display");
const versionBadge = document.getElementById("version-badge");
const settingsVersionFooter = document.getElementById("settings-version-footer");
const settingsScreen = document.getElementById("settings-screen");
const settingsHistoryToggle = document.getElementById("settings-history-toggle");
const settingsPreviewToggle = document.getElementById("settings-preview-toggle");
const settingsHistoryFontValue = document.getElementById("settings-history-font-value");
const settingsHistoryLinesValue = document.getElementById("settings-history-lines-value");
const settingsKeyColorDot = document.getElementById("settings-key-color-dot");
const settingsThousandColorDot = document.getElementById("settings-thousand-color-dot");
const settingsMillionColorDot = document.getElementById("settings-million-color-dot");
const settingsBillionColorDot = document.getElementById("settings-billion-color-dot");
const settingsDecimalsValue = document.getElementById("settings-decimals-value");
const settingsGroupingToggle = document.getElementById("settings-grouping-toggle");
const tripleZeroKey = document.getElementById("triple-zero-key");
const clearHistoryButtons = Array.from(document.querySelectorAll("[data-action='clear-history']"));
const operatorButtons = Array.from(document.querySelectorAll(".key-operator[data-action='operator']"));

const HISTORY_UNDO_HOLD_MS = 2000;
const APP_VERSION = window.APP_VERSION || "v01.00";
const APP_BUILD_STAMP = window.APP_BUILD_STAMP || "14:15 060526";
const APP_AUTHOR = window.APP_AUTHOR || "Ti\u1ebfn \u0110\u1ee9c";
const DEFAULT_DIVISION_PRECISION = 18;

const HISTORY_FONT_LABELS = {
  sm: "Nhỏ",
  md: "Vừa",
  lg: "Lớn",
};

const HISTORY_VISIBLE_ROWS = [5, 8, 12, 20];
const DECIMAL_MODES = [2, 3, 4, 5, 6, 7, 8, 9];

const THEME_COLORS = [
  { name: "orange", hex: "#f59a00", rgb: "245, 154, 0" },
  { name: "green", hex: "#30d158", rgb: "48, 209, 88" },
  { name: "blue", hex: "#0a84ff", rgb: "10, 132, 255" },
  { name: "purple", hex: "#bf5af2", rgb: "191, 90, 242" },
];

const NUMBER_HIGHLIGHT_COLORS = [
  { name: "green", hex: "#34c759" },
  { name: "orange", hex: "#ff9f0a" },
  { name: "blue", hex: "#0a84ff" },
  { name: "pink", hex: "#ff375f" },
  { name: "purple", hex: "#bf5af2" },
];

const state = {
  displayValue: "0",
  decimalPlaces: 2,
  firstOperand: null,
  billionColorIndex: 1,
  groupThousands: true,
  highlightLargeNumbers: true,
  history: [],
  historyFontSize: "md",
  historyVisibleRows: 5,
  historyVisible: true,
  justEvaluated: false,
  lastClearedHistory: [],
  millionColorIndex: 2,
  operator: null,
  settingsOpen: false,
  showTripleZero: true,
  showPreview: true,
  themeColorIndex: 3,
  thousandColorIndex: 0,
  waitingForSecondOperand: false,
};

let clearHistoryHoldTimer = null;
let lastPointerActionTime = 0;
let suppressClearHistoryClick = false;
let lockedOrientation = null;

function addThousandsSeparators(integerPart) {
  let output = "";

  for (let index = 0; index < integerPart.length; index += 1) {
    output += integerPart[index];
    const remaining = integerPart.length - index - 1;

    if (remaining > 0 && remaining % 3 === 0) {
      output += ".";
    }
  }

  return output || "0";
}

function normalizeDecimalString(value) {
  let input = String(value).trim();

  if (!input) {
    return "0";
  }

  let sign = "";

  if (input.startsWith("-")) {
    sign = "-";
    input = input.slice(1);
  } else if (input.startsWith("+")) {
    input = input.slice(1);
  }

  const parts = input.split(".");

  if (parts.length > 2) {
    return "Error";
  }

  let [integerPart = "0", decimalPart = ""] = parts;
  integerPart = integerPart.replace(/^0+(?=\d)/, "") || "0";
  decimalPart = decimalPart.replace(/0+$/, "");

  if (!/^\d+$/.test(integerPart) || (decimalPart && !/^\d+$/.test(decimalPart))) {
    return "Error";
  }

  if (integerPart === "0" && decimalPart === "") {
    return "0";
  }

  return `${sign}${integerPart}${decimalPart ? `.${decimalPart}` : ""}`;
}

function isZeroString(value) {
  return normalizeDecimalString(value) === "0";
}

function decimalToParts(value) {
  const normalized = normalizeDecimalString(value);

  if (normalized === "Error") {
    return null;
  }

  const negative = normalized.startsWith("-");
  const unsignedValue = negative ? normalized.slice(1) : normalized;
  const [integerPart = "0", decimalPart = ""] = unsignedValue.split(".");

  return {
    negative,
    integerPart,
    decimalPart,
    scale: decimalPart.length,
    digits: BigInt(`${integerPart}${decimalPart}` || "0"),
  };
}

function partsToDecimalString(negative, digits, scale) {
  const sign = negative && digits !== 0n ? "-" : "";
  const digitString = digits.toString();

  if (scale === 0) {
    return normalizeDecimalString(`${sign}${digitString}`);
  }

  const padded = digitString.padStart(scale + 1, "0");
  const integerPart = padded.slice(0, -scale) || "0";
  const decimalPart = padded.slice(-scale);
  return normalizeDecimalString(`${sign}${integerPart}.${decimalPart}`);
}

function alignDecimalParts(a, b) {
  const maxScale = Math.max(a.scale, b.scale);
  const factorA = 10n ** BigInt(maxScale - a.scale);
  const factorB = 10n ** BigInt(maxScale - b.scale);

  return {
    scale: maxScale,
    aDigits: (a.negative ? -a.digits : a.digits) * factorA,
    bDigits: (b.negative ? -b.digits : b.digits) * factorB,
  };
}

function negateDecimalString(value) {
  const normalized = normalizeDecimalString(value);

  if (normalized === "Error") {
    return "Error";
  }

  if (normalized === "0") {
    return "0";
  }

  return normalized.startsWith("-") ? normalized.slice(1) : `-${normalized}`;
}

function addDecimalStrings(a, b) {
  const partsA = decimalToParts(a);
  const partsB = decimalToParts(b);

  if (!partsA || !partsB) {
    return "Error";
  }

  const { scale, aDigits, bDigits } = alignDecimalParts(partsA, partsB);
  const sum = aDigits + bDigits;
  return partsToDecimalString(sum < 0n, sum < 0n ? -sum : sum, scale);
}

function subtractDecimalStrings(a, b) {
  return addDecimalStrings(a, negateDecimalString(b));
}

function multiplyDecimalStrings(a, b) {
  const partsA = decimalToParts(a);
  const partsB = decimalToParts(b);

  if (!partsA || !partsB) {
    return "Error";
  }

  return partsToDecimalString(
    partsA.negative !== partsB.negative,
    partsA.digits * partsB.digits,
    partsA.scale + partsB.scale
  );
}

function divideDecimalStrings(a, b, precision) {
  const partsA = decimalToParts(a);
  const partsB = decimalToParts(b);

  if (!partsA || !partsB || partsB.digits === 0n) {
    return "Error";
  }

  const scaledNumerator = partsA.digits * 10n ** BigInt(precision + partsB.scale);
  const scaledDenominator = partsB.digits * 10n ** BigInt(partsA.scale);
  const quotient = scaledNumerator / scaledDenominator;

  return partsToDecimalString(partsA.negative !== partsB.negative, quotient, precision);
}

function shiftDecimalLeft(value, places) {
  const parts = decimalToParts(value);

  if (!parts) {
    return "Error";
  }

  return partsToDecimalString(parts.negative, parts.digits, parts.scale + places);
}

function roundDecimalString(value, places) {
  const normalized = normalizeDecimalString(value);

  if (normalized === "Error" || !normalized.includes(".")) {
    return normalized;
  }

  const negative = normalized.startsWith("-");
  const unsignedValue = negative ? normalized.slice(1) : normalized;
  const [integerPart, decimalPart] = unsignedValue.split(".");

  if (places === 0) {
    let roundedInteger = BigInt(integerPart);

    if (Number(decimalPart[0] || "0") >= 5) {
      roundedInteger += 1n;
    }

    return normalizeDecimalString(`${negative ? "-" : ""}${roundedInteger}`);
  }

  if (decimalPart.length <= places) {
    return normalized;
  }

  const kept = decimalPart.slice(0, places);
  let roundedDigits = BigInt(`${integerPart}${kept}` || "0");

  if (Number(decimalPart[places] || "0") >= 5) {
    roundedDigits += 1n;
  }

  return partsToDecimalString(negative, roundedDigits, places);
}

function formatNumber(value) {
  if (value === "Error") {
    return "Error";
  }

  const normalized = normalizeDecimalString(value);

  if (normalized === "Error") {
    return "Error";
  }

  const rounded = state.decimalPlaces !== null
    ? roundDecimalString(normalized, state.decimalPlaces)
    : normalized;

  return isZeroString(rounded) ? "0" : rounded;
}

function parseDisplayValue() {
  return normalizeDecimalString(state.displayValue);
}

function formatDisplayText(value) {
  if (value === "Error" || value.includes("e")) {
    return value;
  }

  const normalized = normalizeDecimalString(value);

  if (normalized === "Error") {
    return "Error";
  }

  const isNegative = normalized.startsWith("-");
  const unsignedValue = isNegative ? normalized.slice(1) : normalized;
  const [integerPart = "0", decimalPart] = unsignedValue.split(".");
  const formattedInteger = state.groupThousands ? addThousandsSeparators(integerPart) : integerPart;
  const sign = isNegative ? "-" : "";

  if (decimalPart === undefined) {
    return `${sign}${formattedInteger}`;
  }

  return `${sign}${formattedInteger},${decimalPart}`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function splitIntoDigitGroups(integerPart) {
  if (state.groupThousands) {
    return integerPart.split(".");
  }

  const reversedGroups = [];

  for (let index = integerPart.length; index > 0; index -= 3) {
    reversedGroups.push(integerPart.slice(Math.max(0, index - 3), index));
  }

  return reversedGroups.reverse();
}

function buildMagnitudeSegments(groups) {
  if (groups.length <= 1) {
    return [{ groups, className: "" }];
  }

  if (groups.length === 2) {
    return [{ groups, className: "number-scale-thousand" }];
  }

  if (groups.length === 3) {
    return [{ groups, className: "number-scale-million" }];
  }

  if (groups.length === 4) {
    return [
      { groups: groups.slice(0, 1), className: "number-scale-billion" },
      { groups: groups.slice(1), className: "number-scale-billion" },
    ];
  }

  return [
    ...buildMagnitudeSegments(groups.slice(0, -3)),
    { groups: groups.slice(-3), className: "number-scale-billion" },
  ];
}

function renderNumberToken(token) {
  if (token.includes("e") || token.includes("E")) {
    return escapeHtml(token);
  }

  const isNegative = token.startsWith("-");
  const unsignedToken = isNegative ? token.slice(1) : token;
  const [integerPart, decimalPart] = unsignedToken.split(",");
  const groups = splitIntoDigitGroups(integerPart);
  const segments = buildMagnitudeSegments(groups);
  const separator = state.groupThousands ? "." : "";
  const segmentTexts = segments.map((segment) => ({
    className: segment.className,
    groupCount: segment.groups.length,
    text: segment.groups.join(separator),
  }));

  if (segmentTexts.length > 0) {
    segmentTexts[0].text = `${isNegative ? "-" : ""}${segmentTexts[0].text}`;

    if (decimalPart !== undefined) {
      segmentTexts[segmentTexts.length - 1].text += `,${decimalPart}`;
    }
  }

  return segmentTexts
    .map((segment, index) => {
      const escaped = escapeHtml(segment.text);
      const renderedSegment = segment.className
        ? `<span class="${segment.className}">${escaped}</span>`
        : escaped;

      if (index === 0) {
        return renderedSegment;
      }

      const previousSegment = segmentTexts[index - 1];
      const boundarySeparator =
        separator && previousSegment.groupCount === 3 && segment.groupCount === 3 ? "*" : separator;

      return `${boundarySeparator}${renderedSegment}`;
    })
    .join("");
}

function renderStyledMath(text) {
  if (!state.highlightLargeNumbers) {
    return escapeHtml(text);
  }

  const escapedText = escapeHtml(text);
  return escapedText.replace(/-?\d[\d.,]*(?:e[+-]?\d+)?/gi, (token) => renderNumberToken(token));
}

function getOperatorSymbol(operator) {
  const operatorMap = {
    add: "+",
    subtract: "\u2212",
    multiply: "\u00d7",
    divide: "\u00f7",
  };

  return operatorMap[operator] || "";
}

function calculate(firstOperand, secondOperand, operator) {
  switch (operator) {
    case "add":
      return addDecimalStrings(firstOperand, secondOperand);
    case "subtract":
      return subtractDecimalStrings(firstOperand, secondOperand);
    case "multiply":
      return multiplyDecimalStrings(firstOperand, secondOperand);
    case "divide":
      return divideDecimalStrings(
        firstOperand,
        secondOperand,
        Math.max(state.decimalPlaces ?? DEFAULT_DIVISION_PRECISION, DEFAULT_DIVISION_PRECISION)
      );
    default:
      return secondOperand;
  }
}

function getExpressionText() {
  if (state.operator && state.firstOperand !== null) {
    const firstText = formatDisplayText(state.firstOperand);
    const operatorText = getOperatorSymbol(state.operator);

    if (state.waitingForSecondOperand) {
      return `${firstText}${operatorText}`;
    }

    return `${firstText}${operatorText}${formatDisplayText(state.displayValue)}`;
  }

  return formatDisplayText(state.displayValue);
}

function getPreviewText() {
  if (!state.operator || state.firstOperand === null || state.waitingForSecondOperand) {
    return "";
  }

  const previewValue = formatNumber(calculate(state.firstOperand, parseDisplayValue(), state.operator));
  return previewValue === "Error" ? "Error" : formatDisplayText(previewValue);
}

function renderHistory() {
  const recentStartIndex = Math.max(0, state.history.length - 3);
  historyList.innerHTML = state.history
    .map((entry, index) => {
      const recentClass = index >= recentStartIndex ? " history-item-recent" : "";
      return `<li class="history-item${recentClass}">${renderStyledMath(entry.expression)}=<strong>${renderStyledMath(entry.result)}</strong></li>`;
    })
    .join("");

  displayZone.classList.toggle("is-history-hidden", !state.historyVisible);
  historyList.dataset.fontSize = state.historyFontSize;
  displayZone.scrollTop = displayZone.scrollHeight;
}

function renderSettings() {
  settingsScreen.hidden = !state.settingsOpen;
  settingsHistoryToggle.classList.toggle("is-on", state.historyVisible);
  settingsPreviewToggle.classList.toggle("is-on", state.showPreview);
  settingsGroupingToggle.classList.toggle("is-on", state.groupThousands);
  settingsHistoryFontValue.textContent = HISTORY_FONT_LABELS[state.historyFontSize];
  settingsHistoryLinesValue.textContent = `${state.historyVisibleRows} dong`;
  settingsKeyColorDot.style.backgroundColor = THEME_COLORS[state.themeColorIndex].hex;
  settingsThousandColorDot.style.backgroundColor = NUMBER_HIGHLIGHT_COLORS[state.thousandColorIndex].hex;
  settingsMillionColorDot.style.backgroundColor = NUMBER_HIGHLIGHT_COLORS[state.millionColorIndex].hex;
  settingsBillionColorDot.style.backgroundColor = NUMBER_HIGHLIGHT_COLORS[state.billionColorIndex].hex;
  settingsDecimalsValue.textContent = `${state.decimalPlaces} chữ số`;
  tripleZeroKey.hidden = !state.showTripleZero;
}

function addHistoryEntry(firstOperand, operator, secondOperand, result) {
  state.history.push({
    expression: `${formatDisplayText(firstOperand)}${getOperatorSymbol(operator)}${formatDisplayText(secondOperand)}`,
    result: formatDisplayText(result),
  });
  renderHistory();
}

function updateDisplay() {
  expressionDisplay.innerHTML = renderStyledMath(getExpressionText());
  previewDisplay.innerHTML = state.showPreview ? renderStyledMath(getPreviewText()) : "";

  operatorButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.value === state.operator);
  });
}

function resetIfError() {
  if (state.displayValue !== "Error") {
    return;
  }

  state.displayValue = "0";
  state.firstOperand = null;
  state.operator = null;
  state.justEvaluated = false;
  state.waitingForSecondOperand = false;
}

function inputDigit(digit) {
  resetIfError();

  if (state.waitingForSecondOperand) {
    state.displayValue = digit;
    state.waitingForSecondOperand = false;
    updateDisplay();
    return;
  }

  if (state.justEvaluated && !state.operator) {
    state.displayValue = digit;
    state.justEvaluated = false;
    updateDisplay();
    return;
  }

  state.displayValue = state.displayValue === "0" ? digit : `${state.displayValue}${digit}`;
  state.justEvaluated = false;
  updateDisplay();
}

function inputTripleZero() {
  resetIfError();

  if (state.waitingForSecondOperand) {
    state.displayValue = "0";
    state.waitingForSecondOperand = false;
    state.justEvaluated = false;
    updateDisplay();
    return;
  }

  if (state.justEvaluated && !state.operator) {
    state.displayValue = "0";
    state.justEvaluated = false;
    updateDisplay();
    return;
  }

  if (state.displayValue === "0") {
    updateDisplay();
    return;
  }

  state.displayValue += "000";
  state.justEvaluated = false;
  updateDisplay();
}

function inputDecimal() {
  resetIfError();

  if (state.waitingForSecondOperand) {
    state.displayValue = "0.";
    state.waitingForSecondOperand = false;
    updateDisplay();
    return;
  }

  if (state.justEvaluated && !state.operator) {
    state.displayValue = "0.";
    state.justEvaluated = false;
    updateDisplay();
    return;
  }

  if (!state.displayValue.includes(".")) {
    state.displayValue += ".";
    state.justEvaluated = false;
    updateDisplay();
  }
}

function clearCalculator() {
  state.displayValue = "0";
  state.firstOperand = null;
  state.operator = null;
  state.justEvaluated = false;
  state.waitingForSecondOperand = false;
  updateDisplay();
}

function clearHistory() {
  if (!state.history.length) {
    return;
  }

  state.lastClearedHistory = [...state.history];
  state.history = [];
  renderHistory();
}

function undoClearHistory() {
  if (!state.lastClearedHistory.length) {
    return;
  }

  state.history = [...state.lastClearedHistory];
  state.lastClearedHistory = [];
  renderHistory();
}

function toggleHistory() {
  state.historyVisible = !state.historyVisible;
  renderHistory();
  renderSettings();
}

function toggleSettings() {
  state.settingsOpen = !state.settingsOpen;
  renderSettings();
}

function closeSettings() {
  if (!state.settingsOpen) {
    return;
  }

  state.settingsOpen = false;
  renderSettings();
}

function toggleColorSetting() {
  state.highlightLargeNumbers = !state.highlightLargeNumbers;
  renderSettings();
  updateDisplay();
  renderHistory();
}

function toggleTripleZeroSetting() {
  state.showTripleZero = !state.showTripleZero;
  renderSettings();
}

function togglePreviewSetting() {
  state.showPreview = !state.showPreview;
  renderSettings();
  updateDisplay();
}

function cycleHistoryFont() {
  const nextMap = { sm: "md", md: "lg", lg: "sm" };
  state.historyFontSize = nextMap[state.historyFontSize];
  renderHistory();
  renderSettings();
}

function cycleHistoryLines() {
  const currentIndex = HISTORY_VISIBLE_ROWS.indexOf(state.historyVisibleRows);
  state.historyVisibleRows = HISTORY_VISIBLE_ROWS[(currentIndex + 1) % HISTORY_VISIBLE_ROWS.length];
  renderHistory();
  renderSettings();
}

function cycleThemeColor() {
  state.themeColorIndex = (state.themeColorIndex + 1) % THEME_COLORS.length;
  const theme = THEME_COLORS[state.themeColorIndex];
  document.documentElement.style.setProperty("--operator", theme.hex);
  document.documentElement.style.setProperty("--operator-rgb", theme.rgb);
  renderSettings();
}

function cycleThousandColor() {
  state.thousandColorIndex = (state.thousandColorIndex + 1) % NUMBER_HIGHLIGHT_COLORS.length;
  document.documentElement.style.setProperty("--thousand-color", NUMBER_HIGHLIGHT_COLORS[state.thousandColorIndex].hex);
  renderSettings();
  updateDisplay();
  renderHistory();
}

function cycleMillionColor() {
  state.millionColorIndex = (state.millionColorIndex + 1) % NUMBER_HIGHLIGHT_COLORS.length;
  document.documentElement.style.setProperty("--million-color", NUMBER_HIGHLIGHT_COLORS[state.millionColorIndex].hex);
  renderSettings();
  updateDisplay();
  renderHistory();
}

function cycleBillionColor() {
  state.billionColorIndex = (state.billionColorIndex + 1) % NUMBER_HIGHLIGHT_COLORS.length;
  document.documentElement.style.setProperty("--billion-color", NUMBER_HIGHLIGHT_COLORS[state.billionColorIndex].hex);
  renderSettings();
  updateDisplay();
  renderHistory();
}

function applyThemeState() {
  const theme = THEME_COLORS[state.themeColorIndex];
  const thousandColor = NUMBER_HIGHLIGHT_COLORS[state.thousandColorIndex];
  const millionColor = NUMBER_HIGHLIGHT_COLORS[state.millionColorIndex];
  const billionColor = NUMBER_HIGHLIGHT_COLORS[state.billionColorIndex];
  document.documentElement.style.setProperty("--operator", theme.hex);
  document.documentElement.style.setProperty("--operator-rgb", theme.rgb);
  document.documentElement.style.setProperty("--thousand-color", thousandColor.hex);
  document.documentElement.style.setProperty("--million-color", millionColor.hex);
  document.documentElement.style.setProperty("--billion-color", billionColor.hex);
}

function formatBuildStamp(date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${hours}:${minutes} ${day}${month}${year}`;
}

function getBuildStamp() {
  const lastModified = document.lastModified ? new Date(document.lastModified) : null;

  if (lastModified && !Number.isNaN(lastModified.getTime())) {
    return formatBuildStamp(lastModified);
  }

  return formatBuildStamp(new Date());
}

function getCurrentOrientationLock() {
  return window.innerWidth > window.innerHeight ? "landscape" : "portrait";
}

async function lockCurrentOrientation() {
  if (!screen.orientation || typeof screen.orientation.lock !== "function") {
    return;
  }

  const nextLock = getCurrentOrientationLock();

  if (lockedOrientation === nextLock) {
    return;
  }

  try {
    await screen.orientation.lock(nextLock);
    lockedOrientation = nextLock;
  } catch {
    lockedOrientation = null;
  }
}

function updateVersionBadge() {
  const versionText = `${APP_VERSION} ${APP_BUILD_STAMP} by ${APP_AUTHOR}`;
  versionBadge.textContent = versionText;
  settingsVersionFooter.textContent = versionText;
}

function cycleDecimalsSetting() {
  const currentIndex = DECIMAL_MODES.indexOf(state.decimalPlaces);
  state.decimalPlaces = DECIMAL_MODES[(currentIndex + 1) % DECIMAL_MODES.length];
  renderSettings();
  updateDisplay();
  renderHistory();
}

function toggleGroupingSetting() {
  state.groupThousands = !state.groupThousands;
  renderSettings();
  updateDisplay();
  renderHistory();
}

function stopClearHistoryHold() {
  if (clearHistoryHoldTimer) {
    clearTimeout(clearHistoryHoldTimer);
    clearHistoryHoldTimer = null;
  }
}

function startClearHistoryHold(event) {
  if (event.pointerType === "mouse" && event.button !== 0) {
    return;
  }

  stopClearHistoryHold();
  suppressClearHistoryClick = false;

  clearHistoryHoldTimer = setTimeout(() => {
    suppressClearHistoryClick = true;
    undoClearHistory();
    clearHistoryHoldTimer = null;
  }, HISTORY_UNDO_HOLD_MS);
}

function backspace() {
  resetIfError();

  if (state.waitingForSecondOperand && state.firstOperand !== null) {
    state.displayValue = formatNumber(state.firstOperand);
    state.firstOperand = null;
    state.operator = null;
    state.justEvaluated = false;
    state.waitingForSecondOperand = false;
    updateDisplay();
    return;
  }

  if (state.displayValue.length === 1 || (state.displayValue.startsWith("-") && state.displayValue.length === 2)) {
    state.displayValue = "0";
    updateDisplay();
    return;
  }

  state.displayValue = state.displayValue.slice(0, -1);
  updateDisplay();
}

function toggleSign() {
  resetIfError();

  if (parseDisplayValue() === "0") {
    return;
  }

  state.displayValue = formatNumber(negateDecimalString(parseDisplayValue()));
  state.justEvaluated = false;
  updateDisplay();
}

function convertPercent() {
  resetIfError();
  state.displayValue = formatNumber(shiftDecimalLeft(parseDisplayValue(), 2));
  state.justEvaluated = false;
  updateDisplay();
}

function handleOperator(nextOperator) {
  resetIfError();

  const inputValue = parseDisplayValue();

  if (state.operator && !state.waitingForSecondOperand) {
    const result = formatNumber(calculate(state.firstOperand, inputValue, state.operator));
    state.displayValue = result;

    if (result === "Error") {
      state.firstOperand = null;
      state.operator = null;
      state.justEvaluated = false;
      state.waitingForSecondOperand = false;
      updateDisplay();
      return;
    }

    state.firstOperand = result;
  } else {
    state.firstOperand = inputValue;
  }

  state.operator = nextOperator;
  state.justEvaluated = false;
  state.waitingForSecondOperand = true;
  updateDisplay();
}

function handleEquals() {
  resetIfError();

  if (!state.operator || state.firstOperand === null || state.waitingForSecondOperand) {
    return;
  }

  const secondOperand = parseDisplayValue();
  const result = formatNumber(calculate(state.firstOperand, secondOperand, state.operator));
  state.displayValue = result;

  if (result === "Error") {
    state.firstOperand = null;
    state.operator = null;
    state.justEvaluated = false;
    state.waitingForSecondOperand = false;
    updateDisplay();
    return;
  }

  addHistoryEntry(state.firstOperand, state.operator, secondOperand, result);
  state.firstOperand = null;
  state.operator = null;
  state.justEvaluated = true;
  state.waitingForSecondOperand = false;
  updateDisplay();
}

function runButtonAction(action, value) {
  switch (action) {
    case "digit":
      inputDigit(value);
      break;
    case "decimal":
      inputDecimal();
      break;
    case "triple-zero":
      inputTripleZero();
      break;
    case "clear":
      clearCalculator();
      break;
    case "toggle-sign":
      toggleSign();
      break;
    case "percent":
      convertPercent();
      break;
    case "backspace":
      backspace();
      break;
    case "operator":
      handleOperator(value);
      break;
    case "equals":
      handleEquals();
      break;
    case "clear-history":
      if (suppressClearHistoryClick) {
        suppressClearHistoryClick = false;
        break;
      }

      clearHistory();
      break;
    case "toggle-history":
      toggleHistory();
      break;
    case "toggle-settings":
      toggleSettings();
      break;
    case "close-settings":
      closeSettings();
      break;
    case "toggle-history-setting":
      toggleHistory();
      break;
    case "toggle-preview-setting":
      togglePreviewSetting();
      break;
    case "cycle-history-font":
      cycleHistoryFont();
      break;
    case "cycle-history-lines":
      cycleHistoryLines();
      break;
    case "cycle-theme-color":
      cycleThemeColor();
      break;
    case "cycle-thousand-color":
      cycleThousandColor();
      break;
    case "cycle-million-color":
      cycleMillionColor();
      break;
    case "cycle-billion-color":
      cycleBillionColor();
      break;
    case "cycle-decimals-setting":
      cycleDecimalsSetting();
      break;
    case "toggle-grouping-setting":
      toggleGroupingSetting();
      break;
    case "toggle-color-setting":
      toggleColorSetting();
      break;
    case "toggle-triple-zero-setting":
      toggleTripleZeroSetting();
      break;
    default:
      break;
  }
}

document.addEventListener("pointerup", (event) => {
  const button = event.target.closest("button");

  if (!button || (event.pointerType === "mouse" && event.button !== 0)) {
    return;
  }

  lastPointerActionTime = Date.now();
  const { action, value } = button.dataset;
  runButtonAction(action, value);
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("button");

  if (!button) {
    return;
  }

  if (Date.now() - lastPointerActionTime < 400) {
    return;
  }

  const { action, value } = button.dataset;
  runButtonAction(action, value);
});

clearHistoryButtons.forEach((button) => {
  button.addEventListener("pointerdown", startClearHistoryHold);
  button.addEventListener("pointerup", stopClearHistoryHold);
  button.addEventListener("pointerleave", stopClearHistoryHold);
  button.addEventListener("pointercancel", stopClearHistoryHold);
});

document.addEventListener("gesturestart", (event) => {
  event.preventDefault();
});

document.addEventListener("gesturechange", (event) => {
  event.preventDefault();
});

document.addEventListener("gestureend", (event) => {
  event.preventDefault();
});

document.addEventListener(
  "touchmove",
  (event) => {
    if (event.touches.length > 1) {
      event.preventDefault();
    }
  },
  { passive: false }
);

window.addEventListener(
  "wheel",
  (event) => {
    if (event.ctrlKey) {
      event.preventDefault();
    }
  },
  { passive: false }
);

window.addEventListener("load", () => {
  lockCurrentOrientation();
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    lockCurrentOrientation();
  }
});

window.addEventListener("keydown", (event) => {
  const key = event.key;

  if (state.settingsOpen && key === "Escape") {
    closeSettings();
    return;
  }

  if (/^\d$/.test(key)) {
    inputDigit(key);
    return;
  }

  if (key === "." || key === ",") {
    inputDecimal();
    return;
  }

  if (key === "+" || key === "-" || key === "*" || key === "/") {
    const operatorMap = {
      "+": "add",
      "-": "subtract",
      "*": "multiply",
      "/": "divide",
    };

    handleOperator(operatorMap[key]);
    return;
  }

  if (key === "Backspace") {
    event.preventDefault();
    backspace();
    return;
  }

  if (key === "Enter" || key === "=") {
    event.preventDefault();
    handleEquals();
    return;
  }

  if (key === "Escape" || key.toLowerCase() === "c") {
    clearCalculator();
  }
});

HISTORY_FONT_LABELS.sm = "Nhỏ";
HISTORY_FONT_LABELS.md = "Vừa";
HISTORY_FONT_LABELS.lg = "Lớn";

if (!HISTORY_VISIBLE_ROWS.includes(null)) {
  HISTORY_VISIBLE_ROWS.push(null);
}

function renderHistory() {
  const visibleEntries = state.historyVisibleRows === null
    ? state.history
    : state.history.slice(-state.historyVisibleRows);
  const recentStartIndex = Math.max(0, visibleEntries.length - 3);

  historyList.innerHTML = visibleEntries
    .map((entry, index) => {
      const recentClass = index >= recentStartIndex ? " history-item-recent" : "";
      return `<li class="history-item${recentClass}">${renderStyledMath(entry.expression)}=<strong>${renderStyledMath(entry.result)}</strong></li>`;
    })
    .join("");

  displayZone.classList.toggle("is-history-hidden", !state.historyVisible);
  historyList.dataset.fontSize = state.historyFontSize;
  historyList.style.minHeight = state.historyVisibleRows === null ? "0" : "";
  historyList.style.maxHeight = state.historyVisibleRows === null ? "none" : "";
  historyList.style.overflow = "visible";
  displayZone.scrollTop = displayZone.scrollHeight;
}

function renderSettings() {
  settingsScreen.hidden = !state.settingsOpen;
  settingsHistoryToggle.classList.toggle("is-on", state.historyVisible);
  settingsPreviewToggle.classList.toggle("is-on", state.showPreview);
  settingsGroupingToggle.classList.toggle("is-on", state.groupThousands);
  settingsHistoryFontValue.textContent = HISTORY_FONT_LABELS[state.historyFontSize];
  settingsHistoryLinesValue.textContent = state.historyVisibleRows === null
    ? "Không giới hạn"
    : `${state.historyVisibleRows} dòng`;
  settingsKeyColorDot.style.backgroundColor = THEME_COLORS[state.themeColorIndex].hex;
  settingsThousandColorDot.style.backgroundColor = NUMBER_HIGHLIGHT_COLORS[state.thousandColorIndex].hex;
  settingsMillionColorDot.style.backgroundColor = NUMBER_HIGHLIGHT_COLORS[state.millionColorIndex].hex;
  settingsBillionColorDot.style.backgroundColor = NUMBER_HIGHLIGHT_COLORS[state.billionColorIndex].hex;
  settingsDecimalsValue.textContent = `${state.decimalPlaces} chữ số`;
  tripleZeroKey.hidden = !state.showTripleZero;
}

function updateVersionBadge() {
  const versionText = `${APP_VERSION} ${getBuildStamp()} by Tiến Đức`;
  versionBadge.textContent = versionText;
  settingsVersionFooter.textContent = versionText;
}

HISTORY_FONT_LABELS.sm = "Nhỏ";
HISTORY_FONT_LABELS.md = "Vừa";
HISTORY_FONT_LABELS.lg = "Lớn";

if (!HISTORY_VISIBLE_ROWS.includes(null)) {
  HISTORY_VISIBLE_ROWS.push(null);
}

function canRecallHistoryIntoEditor() {
  return (
    state.firstOperand === null &&
    state.operator === null &&
    !state.waitingForSecondOperand &&
    (state.displayValue === "0" || state.justEvaluated)
  );
}

function parseFormattedNumber(text) {
  return text.replaceAll(".", "").replace(",", ".");
}

function parseHistoryExpression(expression) {
  const match = expression.match(/^(.*?)([+\u2212\u00d7\u00f7])(.*)$/);

  if (!match) {
    return null;
  }

  const [, firstOperandText, operatorSymbol, secondOperandText] = match;
  const operatorMap = {
    "+": "add",
    "\u2212": "subtract",
    "\u00d7": "multiply",
    "\u00f7": "divide",
  };

  return {
    firstOperand: parseFormattedNumber(firstOperandText),
    operator: operatorMap[operatorSymbol] || null,
    secondOperand: parseFormattedNumber(secondOperandText),
  };
}

function restoreHistoryEntry(historyIndex) {
  if (!canRecallHistoryIntoEditor()) {
    return;
  }

  const entry = state.history[historyIndex];

  if (!entry) {
    return;
  }

  const parsedEntry =
    entry.rawFirstOperand && entry.rawOperator && entry.rawSecondOperand
      ? {
          firstOperand: entry.rawFirstOperand,
          operator: entry.rawOperator,
          secondOperand: entry.rawSecondOperand,
        }
      : parseHistoryExpression(entry.expression);

  if (!parsedEntry || !parsedEntry.operator) {
    return;
  }

  state.firstOperand = normalizeDecimalString(parsedEntry.firstOperand);
  state.operator = parsedEntry.operator;
  state.displayValue = normalizeDecimalString(parsedEntry.secondOperand);
  state.justEvaluated = false;
  state.waitingForSecondOperand = false;
  updateDisplay();
}

function syncHistoryRecallState() {
  historyList.dataset.recallEnabled = canRecallHistoryIntoEditor() ? "true" : "false";
}

function addHistoryEntry(firstOperand, operator, secondOperand, result) {
  state.history.push({
    expression: `${formatDisplayText(firstOperand)}${getOperatorSymbol(operator)}${formatDisplayText(secondOperand)}`,
    result: formatDisplayText(result),
    rawFirstOperand: normalizeDecimalString(firstOperand),
    rawOperator: operator,
    rawSecondOperand: normalizeDecimalString(secondOperand),
    rawResult: normalizeDecimalString(result),
  });
  renderHistory();
}

function renderHistory() {
  const visibleEntries = state.historyVisibleRows === null
    ? state.history
    : state.history.slice(-state.historyVisibleRows);
  const startIndex = state.history.length - visibleEntries.length;
  const recentStartIndex = Math.max(0, visibleEntries.length - 3);

  historyList.innerHTML = visibleEntries
    .map((entry, index) => {
      const recentClass = index >= recentStartIndex ? " history-item-recent" : "";
      return `<li class="history-item${recentClass}" data-history-index="${startIndex + index}">${renderStyledMath(entry.expression)}=<strong>${renderStyledMath(entry.result)}</strong></li>`;
    })
    .join("");

  displayZone.classList.toggle("is-history-hidden", !state.historyVisible);
  historyList.dataset.fontSize = state.historyFontSize;
  historyList.style.minHeight = state.historyVisibleRows === null ? "0" : "";
  historyList.style.maxHeight = state.historyVisibleRows === null ? "none" : "";
  historyList.style.overflow = "visible";
  syncHistoryRecallState();
  displayZone.scrollTop = displayZone.scrollHeight;
}

function renderSettings() {
  settingsScreen.hidden = !state.settingsOpen;
  settingsHistoryToggle.classList.toggle("is-on", state.historyVisible);
  settingsPreviewToggle.classList.toggle("is-on", state.showPreview);
  settingsGroupingToggle.classList.toggle("is-on", state.groupThousands);
  settingsHistoryFontValue.textContent = HISTORY_FONT_LABELS[state.historyFontSize];
  settingsHistoryLinesValue.textContent = state.historyVisibleRows === null
    ? "Không giới hạn"
    : `${state.historyVisibleRows} dòng`;
  settingsKeyColorDot.style.backgroundColor = THEME_COLORS[state.themeColorIndex].hex;
  settingsThousandColorDot.style.backgroundColor = NUMBER_HIGHLIGHT_COLORS[state.thousandColorIndex].hex;
  settingsMillionColorDot.style.backgroundColor = NUMBER_HIGHLIGHT_COLORS[state.millionColorIndex].hex;
  settingsBillionColorDot.style.backgroundColor = NUMBER_HIGHLIGHT_COLORS[state.billionColorIndex].hex;
  settingsDecimalsValue.textContent = `${state.decimalPlaces} chữ số`;
  tripleZeroKey.hidden = !state.showTripleZero;
}

function updateDisplay() {
  expressionDisplay.innerHTML = renderStyledMath(getExpressionText());
  previewDisplay.innerHTML = state.showPreview ? renderStyledMath(getPreviewText()) : "";

  operatorButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.value === state.operator);
  });

  syncHistoryRecallState();
}

function updateVersionBadge() {
  const versionText = `${APP_VERSION} ${getBuildStamp()} by Tiến Đức`;
  versionBadge.textContent = versionText;
  settingsVersionFooter.textContent = versionText;
}

historyList.addEventListener("pointerup", (event) => {
  const item = event.target.closest(".history-item");

  if (!item || (event.pointerType === "mouse" && event.button !== 0)) {
    return;
  }

  restoreHistoryEntry(Number(item.dataset.historyIndex));
});

historyList.addEventListener("click", (event) => {
  const item = event.target.closest(".history-item");

  if (!item) {
    return;
  }

  if (Date.now() - lastPointerActionTime < 400) {
    return;
  }

  restoreHistoryEntry(Number(item.dataset.historyIndex));
});

updateDisplay();
renderHistory();
applyThemeState();
renderSettings();
updateVersionBadge();

function renderSettings() {
  settingsScreen.hidden = !state.settingsOpen;
  settingsHistoryToggle.classList.toggle("is-on", state.historyVisible);
  settingsPreviewToggle.classList.toggle("is-on", state.showPreview);
  settingsGroupingToggle.classList.toggle("is-on", state.groupThousands);
  settingsHistoryFontValue.textContent = HISTORY_FONT_LABELS[state.historyFontSize];
  settingsHistoryLinesValue.textContent = state.historyVisibleRows === null
    ? "Không giới hạn"
    : `${state.historyVisibleRows} dòng`;
  settingsKeyColorDot.style.backgroundColor = THEME_COLORS[state.themeColorIndex].hex;
  settingsThousandColorDot.style.backgroundColor = NUMBER_HIGHLIGHT_COLORS[state.thousandColorIndex].hex;
  settingsMillionColorDot.style.backgroundColor = NUMBER_HIGHLIGHT_COLORS[state.millionColorIndex].hex;
  settingsBillionColorDot.style.backgroundColor = NUMBER_HIGHLIGHT_COLORS[state.billionColorIndex].hex;
  settingsDecimalsValue.textContent = `${state.decimalPlaces} chữ số`;
  tripleZeroKey.hidden = !state.showTripleZero;
}

function updateVersionBadge() {
  const versionText = `${APP_VERSION} ${APP_BUILD_STAMP} by Tiến Đức`;
  versionBadge.textContent = versionText;
  settingsVersionFooter.textContent = versionText;
}

renderSettings();
updateVersionBadge();

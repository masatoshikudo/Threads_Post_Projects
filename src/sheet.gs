/** ========= sheet.gs ========= */
function getSheet_() {
  const ss = getSpreadsheet_();
  const sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) throw new Error(`Sheet "${SHEET_NAME}" not found`);
  return sh;
}

// A:H をまとめて取得（2行目から）
function readRows_() {
  const sh = getSheet_();
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, 8).getValues(); // [ [A,B,C,D,E,F,G,H], ... ]
}

// まとめて書き戻す（値更新済みのvaluesをそのまま反映）
function writeRows_(values) {
  if (!values.length) return;
  const sh = getSheet_();
  sh.getRange(2, 1, values.length, 8).setValues(values);
}


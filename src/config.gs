/** ========= config.gs ========= */
// シート名とタイムゾーン
const SHEET_NAME = 'Posts';
const JPN_TZ = 'Asia/Tokyo';

// スクリプトプロパティから認証情報を読む
function getAuthProps_() {
  const p = PropertiesService.getScriptProperties().getProperties();
  const required = ['THREADS_ACCESS_TOKEN', 'THREADS_USER_ID'];
  required.forEach(k => { if (!p[k]) throw new Error(`Script Property ${k} is missing`); });
  return {
    ACCESS_TOKEN: p.THREADS_ACCESS_TOKEN,
    USER_ID:      p.THREADS_USER_ID,
  };
}

// Threads投稿先エンドポイント
const THREADS_ENDPOINT_BASE = 'https://graph.threads.net/v1.0';

// 再実行/二重起動ガード
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try { fn(); } finally { lock.releaseLock(); }
}

// スロット→時刻(JST)のマッピング（必要に応じて編集）
// 例: morning/noon/evening/night など
const SLOT_TO_TIME = {
  morning: '06:30:00',
  noon:    '11:55:00',
  evening: '17:30:00',
  night:   '19:55:00',
};

// インサイト取得待機時間（時間単位、投稿後この時間経過後に取得）
const INSIGHT_DELAY_HOURS = 24; // デフォルト24時間後（スクリプトプロパティ INSIGHT_DELAY_HOURS で上書き可）

// インサイト取得待機時間を取得（スクリプトプロパティ優先、なければデフォルト）
function getInsightDelayHours_() {
  const prop = PropertiesService.getScriptProperties().getProperty('INSIGHT_DELAY_HOURS');
  return prop ? parseInt(prop, 10) : INSIGHT_DELAY_HOURS;
}

// 対象スプレッドシートを開く（スタンドアロン/トリガーでも確実に取得）
function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Script Property SPREADSHEET_ID is missing');
  return SpreadsheetApp.openById(id);
}


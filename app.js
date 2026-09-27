'use strict';

/* =========================================================
   SubMonitor — P0 動作確認版
   確認すること:
   1. ホーム画面から起動して全画面（standalone）になるか
   2. 画面スリープ防止（Wake Lock）が取れて、保たれるか
   3. 長時間つけっぱなしでも止まらないか（連続稼働の表示）
   ========================================================= */

const $ = (id) => document.getElementById(id);
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const startedAt = Date.now();

/* ---------- 時計（分単位で更新） ---------- */
function renderClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  $('time').textContent = `${hh}:${mm}`;
  $('date').textContent =
    `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日（${WEEKDAYS[now.getDay()]}）`;
}

// 分が切り替わる瞬間に合わせて更新する（毎秒描き直さない＝省電力）
function scheduleClock() {
  renderClock();
  const now = new Date();
  const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
  setTimeout(scheduleClock, msToNextMinute + 50);
}

/* ---------- 画面スリープ防止（Wake Lock） ---------- */
let wakeLock = null;

function setWakeStatus(text, ok) {
  const el = $('d-wake');
  el.textContent = text;
  el.className = ok ? 'ok' : 'ng';
}

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) {
    setWakeStatus('非対応（自動ロック「なし」で代用）', false);
    return;
  }
  if (wakeLock && !wakeLock.released) return; // すでに取得済み
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    setWakeStatus('有効', true);
    wakeLock.addEventListener('release', () => setWakeStatus('解除された', false));
  } catch (err) {
    setWakeStatus(`失敗（${err.name}）`, false);
  }
}

// アプリが裏に回ると解除されるので、表に戻ったら取り直す
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    requestWakeLock();
    renderClock();
  }
});

// 端末によってはタップが必要なので、タップでも取り直す
document.addEventListener('click', requestWakeLock);

/* ---------- 検証用の表示 ---------- */
function renderDiag() {
  const standalone =
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;
  const mode = $('d-mode');
  mode.textContent = standalone ? '全画面（ホーム画面から起動）' : 'ブラウザ内';
  mode.className = standalone ? 'ok' : 'ng';

  $('d-size').textContent = `${window.innerWidth} × ${window.innerHeight}`;
}

function renderUptime() {
  const s = Math.floor((Date.now() - startedAt) / 1000);
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  $('d-uptime').textContent = `${h}:${m}:${sec}`;
}

window.addEventListener('resize', renderDiag);

/* ---------- 起動 ---------- */
scheduleClock();
renderDiag();
renderUptime();
setInterval(renderUptime, 1000); // P0の検証用。P1で消す
requestWakeLock();

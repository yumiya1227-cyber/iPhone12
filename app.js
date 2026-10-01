'use strict';

/* =========================================================
   SubMonitor — P1
   - 時計・日付
   - 天気（Open-Meteo / 石川県野々市市）：朝・昼・夕・夜の4コマ＋明日
   - 楽曲（P2でSpotify接続）・予定（P3でGoogleカレンダー接続）は仮表示
   - 操作なしで動き続けるための仕組み（画面スリープ防止・毎日の再読み込み）
   URLの末尾に ?demo を付けると、楽曲と予定にサンプルを表示する
   ========================================================= */

const CONFIG = {
  lat: 36.5194,               // 野々市市
  lon: 136.6097,
  weatherEveryMin: 30,        // 天気の更新間隔
  weatherRetryMin: 5,         // 失敗したときの再試行
  dailyReload: { h: 3, m: 30 } // 毎日この時刻に再読み込み（長時間稼働の安定化）
};

/* 朝・昼・夕・夜：現在の時間帯の判定（from〜to）と、表示する予報の時刻（rep） */
const SLOTS = [
  { name: '朝', from: 5,  to: 10, rep: 7  },
  { name: '昼', from: 10, to: 15, rep: 12 },
  { name: '夕', from: 15, to: 19, rep: 17 },
  { name: '夜', from: 19, to: 5,  rep: 21 }
];

const DEMO = new URLSearchParams(location.search).has('demo');
const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, '0');
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const WEEKDAYS = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

/* ---------- 画面サイズに合わせて拡大縮小 ---------- */
function fitStage() {
  const s = Math.min(window.innerWidth / 844, window.innerHeight / 390);
  document.documentElement.style.setProperty('--scale', s.toFixed(4));
}
window.addEventListener('resize', fitStage);

/* ---------- 時計・日付 ---------- */
function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function currentSlot(hour) {
  return SLOTS.findIndex((s) => (s.from < s.to ? hour >= s.from && hour < s.to : hour >= s.from || hour < s.to));
}

function renderClock() {
  const now = new Date();
  $('clock').textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  $('d-mon').textContent = MONTHS[now.getMonth()];
  $('d-day').textContent = String(now.getDate());
  $('d-wd').textContent = WEEKDAYS[now.getDay()];
  renderWeather(); // 時間帯が変わったら強調するコマも変える
}

function scheduleClock() {
  renderClock();
  const now = new Date();
  const ms = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
  setTimeout(scheduleClock, ms + 50);
}

/* ---------- 天気アイコン（SVG） ---------- */
const CLOUD = (x = 0, y = 0, s = 1) =>
  `<path class="c-main" transform="translate(${x} ${y}) scale(${s})" d="M8 32h26a9 9 0 0 0 1-18 12 12 0 0 0-23 2 8 8 0 0 0-4 16z"/>`;
const RAYS = (cx, cy, r1, r2) => {
  let out = '';
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i;
    const x1 = cx + Math.cos(a) * r1, y1 = cy + Math.sin(a) * r1;
    const x2 = cx + Math.cos(a) * r2, y2 = cy + Math.sin(a) * r2;
    out += `<line class="c-ray" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke-width="2.6" stroke-linecap="round"/>`;
  }
  return out;
};
const MOON = (x = 0, y = 0, s = 1) =>
  `<path class="c-main" transform="translate(${x} ${y}) scale(${s})" d="M27 5a15 15 0 1 0 14 22 12 12 0 0 1-14-22z"/>`;
const STAR = (x, y, r) =>
  `<path class="c-main" d="M${x} ${y - r}l${r * .3} ${r * .7} ${r * .7} ${r * .3}-${r * .7} ${r * .3}-${r * .3} ${r * .7}-${r * .3}-${r * .7}-${r * .7}-${r * .3} ${r * .7}-${r * .3}z" style="stroke:none"/>`;

const ICONS = {
  sun: () => `<g class="sun-wrap">${RAYS(24, 20, 12, 16)}</g><circle class="c-sun" cx="24" cy="20" r="8"/>`,
  moon: () => MOON(2, 1, 1) + STAR(9, 8, 3.5) + STAR(42, 6, 2.6) + STAR(12, 31, 2.4),
  partlyDay: () => `<g class="sun-wrap">${RAYS(31, 15, 9.5, 12.5)}</g><circle class="c-sun" cx="31" cy="15" r="6.5"/>` + CLOUD(-2, 6, .92),
  partlyNight: () => MOON(16, -2, .7) + STAR(9, 9, 3) + CLOUD(-2, 6, .92),
  cloudy: () => `<g opacity=".55">${CLOUD(14, -6, .7)}</g>` + CLOUD(0, 3, 1),
  fog: () => CLOUD(2, -4, .9) + `<rect class="c-main" x="8" y="33" width="32" height="3" rx="1.5" style="stroke:none"/><rect class="c-main" x="14" y="38" width="22" height="3" rx="1.5" style="stroke:none"/>`,
  rain: () => CLOUD(2, -6, .92) +
    `<g stroke-width="2.6" stroke-linecap="round"><line class="c-accent" x1="17" y1="31" x2="15" y2="37"/><line class="c-accent" x1="25" y1="31" x2="23" y2="37"/><line class="c-accent" x1="33" y1="31" x2="31" y2="37"/></g>`,
  snow: () => CLOUD(2, -6, .92) +
    `<circle class="c-accent" cx="16" cy="33" r="2.2" style="stroke:none"/><circle class="c-accent" cx="24" cy="37" r="2.2" style="stroke:none"/><circle class="c-accent" cx="32" cy="33" r="2.2" style="stroke:none"/>`,
  thunder: () => CLOUD(2, -6, .92) +
    `<path class="c-sun" d="M25 27l-6 8h5l-3 6 8-9h-5l3-5z"/>`
};

/* WMO 天気コード → アイコンの種類 */
function iconKind(code, isDay) {
  if (code === 0 || code === 1) return isDay ? 'sun' : 'moon';
  if (code === 2) return isDay ? 'partlyDay' : 'partlyNight';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'thunder';
  return 'cloudy';
}
function iconSVG(kind) {
  return `<svg viewBox="0 0 48 40" aria-hidden="true">${(ICONS[kind] || ICONS.cloudy)()}</svg>`;
}

/* ---------- 天気の取得と表示 ---------- */
let weather = null; // Open-Meteo の応答

function weatherURL() {
  const p = new URLSearchParams({
    latitude: CONFIG.lat,
    longitude: CONFIG.lon,
    hourly: 'temperature_2m,precipitation_probability,weather_code,is_day',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
    timezone: 'Asia/Tokyo',
    forecast_days: '3'
  });
  return `https://api.open-meteo.com/v1/forecast?${p}`;
}

async function fetchWeather() {
  try {
    const res = await fetch(weatherURL(), { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    weather = await res.json();
    try { localStorage.setItem('wx-cache', JSON.stringify({ at: Date.now(), data: weather })); } catch (e) {}
    renderWeather();
    setTimeout(fetchWeather, CONFIG.weatherEveryMin * 60 * 1000);
  } catch (err) {
    console.warn('天気の取得に失敗', err);
    setTimeout(fetchWeather, CONFIG.weatherRetryMin * 60 * 1000);
  }
}

function loadCachedWeather() {
  try {
    const c = JSON.parse(localStorage.getItem('wx-cache') || 'null');
    if (c && Date.now() - c.at < 6 * 3600 * 1000) weather = c.data;
  } catch (e) {}
}

function hourIndex(dateStr, hour) {
  return weather.hourly.time.indexOf(`${dateStr}T${pad(hour)}:00`);
}

function renderWeather() {
  const now = new Date();
  const active = currentSlot(now.getHours());
  const slotEls = document.querySelectorAll('.slot');
  slotEls.forEach((el, i) => el.classList.toggle('active', i === active));
  if (!weather || !weather.hourly) return;

  const h = weather.hourly;
  const today = ymd(now);

  slotEls.forEach((el, i) => {
    // 現在の時間帯は「今」の予報、それ以外は今日のその時間帯の代表時刻
    const idx = i === active ? hourIndex(today, now.getHours()) : hourIndex(today, SLOTS[i].rep);
    if (idx < 0) return;
    const kind = iconKind(h.weather_code[idx], h.is_day[idx] === 1);
    const icon = el.querySelector('.ic');
    if (icon.dataset.kind !== kind) { icon.innerHTML = iconSVG(kind); icon.dataset.kind = kind; }
    el.querySelector('.tmp').textContent = `${Math.round(h.temperature_2m[idx])}°`;
    const pop = h.precipitation_probability[idx];
    el.querySelector('.pop span').textContent = pop == null ? '--%' : `${pop}%`;
  });

  // 明日
  const d = weather.daily;
  const tmr = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const j = d.time.indexOf(ymd(tmr));
  if (j >= 0) {
    const kind = iconKind(d.weather_code[j], true);
    const icon = $('n-icon');
    if (icon.dataset.kind !== kind) { icon.innerHTML = iconSVG(kind); icon.dataset.kind = kind; }
    $('n-max').textContent = `${Math.round(d.temperature_2m_max[j])}°`;
    $('n-min').textContent = `${Math.round(d.temperature_2m_min[j])}°`;
    const pop = d.precipitation_probability_max[j];
    $('n-pop').textContent = pop == null ? '--%' : `${pop}%`;
  }
}

/* ---------- 楽曲（P2でSpotifyと接続） ---------- */
function buildWave() {
  const wave = $('m-wave');
  for (let i = 0; i < 44; i++) {
    const x = i / 43;
    const env = 0.35 + 0.65 * Math.exp(-Math.pow((x - 0.5) / 0.28, 2));
    const h = Math.max(.12, env * (0.45 + 0.55 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * .6))));
    const b = document.createElement('i');
    b.style.setProperty('--h', h.toFixed(3));
    wave.appendChild(b);
  }
}

/* 文字が枠より長いときだけ、ゆっくり横に流す */
function setMarquee(el, text) {
  el.classList.remove('is-scrolling');
  el.innerHTML = '';
  const span = document.createElement('span');
  span.textContent = text;
  el.appendChild(span);
  const w1 = span.offsetWidth;               // 拡大縮小の影響を受けない幅
  if (w1 <= el.clientWidth) return;
  span.textContent = `${text}\u2003\u2003\u2003${text}`; // 2つ並べて途切れずにループさせる
  const dist = span.offsetWidth - w1;        // 1つ分＋すき間
  span.style.setProperty('--dist', `-${dist}px`);
  span.style.setProperty('--dur', `${Math.max(8, dist / 28).toFixed(1)}s`); // 約28px/秒
  el.classList.add('is-scrolling');
}

function setMusic(track) {
  const m = $('music');
  if (!track) {
    m.classList.add('is-idle');
    $('m-jacket').style.backgroundImage = '';
    setMarquee($('m-title'), '再生停止中');
    setMarquee($('m-artist'), 'Spotify');
    return;
  }
  m.classList.remove('is-idle');
  $('m-jacket').style.backgroundImage = track.art ? `url("${track.art}")` : '';
  setMarquee($('m-title'), track.title);
  setMarquee($('m-artist'), track.artist);
}

/* ---------- 予定（P3でGoogleカレンダーと接続） ---------- */
function setSchedule(today, tomorrow) {
  const list = $('t-list');
  list.innerHTML = '';
  if (!today) {
    list.innerHTML = '<div class="ev empty"><span class="n">カレンダー未接続</span></div>';
    $('t-count').textContent = '';
  } else if (today.length === 0) {
    list.innerHTML = '<div class="ev empty"><span class="n">予定なし</span></div>';
    $('t-count').textContent = '';
  } else {
    today.slice(0, 3).forEach((e) => {
      const row = document.createElement('div');
      row.className = 'ev';
      row.innerHTML = '<span class="t"></span><span class="n"></span>';
      row.querySelector('.t').textContent = e.time;
      row.querySelector('.n').textContent = e.title;
      list.appendChild(row);
    });
    $('t-count').textContent = `${today.length}件`;
  }
  const n = $('n-list');
  if (tomorrow && tomorrow.length) {
    n.textContent = tomorrow.map((e) => e.title).join(' ・ ');
    n.classList.remove('empty');
  } else {
    n.textContent = tomorrow ? '予定なし' : 'カレンダー未接続';
    n.classList.add('empty');
  }
}

/* ---------- 操作なしで動き続けるための仕組み ---------- */
let wakeLock = null;
async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  if (wakeLock && !wakeLock.released) return;
  try { wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {}
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { requestWakeLock(); renderClock(); }
});

function scheduleDailyReload() {
  const now = new Date();
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate(), CONFIG.dailyReload.h, CONFIG.dailyReload.m);
  if (t <= now) t.setDate(t.getDate() + 1);
  setTimeout(() => location.reload(), t - now);
}

/* ---------- 起動 ---------- */
fitStage();
buildWave();
loadCachedWeather();
scheduleClock();
fetchWeather();
requestWakeLock();
scheduleDailyReload();

if (DEMO) {
  setMusic({ title: '曲名がここに入ります — 長いタイトルは流れて表示', artist: 'アーティスト名', art: '' });
  $('m-jacket').style.background = 'linear-gradient(145deg,#8fd3f4 0%,#5aa9e6 45%,#3f6fd8 100%)';
  setSchedule(
    [{ time: '9:00', title: 'バイト' }, { time: '15:00', title: '筋トレ' }, { time: '21:00', title: '外食' }],
    [{ title: 'バイト' }, { title: '1限 講義' }]
  );
} else {
  setMusic(null);
  setSchedule(null, null);
}

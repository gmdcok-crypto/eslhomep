const CATEGORY_LABELS = {
  hospital: "병원 병상 네임텍",
  meeting: "회의실 전자명패",
  reservation: "예약 룸·테이블",
  office: "관공서·사무실 명패",
  mixed: "복합/기타",
};

const STORAGE_KEY = "epaper-admin";
const POLL_MS = window.ADMIN_CONFIG?.pollIntervalMs || 30000;

const loginPanel = document.getElementById("login-panel");
const dashboard = document.getElementById("dashboard");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const apiKeyInput = document.getElementById("api-key-input");
const apiUrlInput = document.getElementById("api-url-input");
const loginStatus = document.getElementById("login-status");
const dashboardStatus = document.getElementById("dashboard-status");
const inquiryList = document.getElementById("inquiry-list");
const totalCount = document.getElementById("total-count");
const latestId = document.getElementById("latest-id");
const notifyState = document.getElementById("notify-state");
const refreshBtn = document.getElementById("refresh-btn");
const notifyBtn = document.getElementById("notify-btn");

let pollTimer = null;
let lastSeenId = 0;

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveState(next) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function getConfig() {
  const saved = loadState();
  return {
    apiBaseUrl: saved.apiBaseUrl || window.ADMIN_CONFIG?.apiBaseUrl || "",
    apiKey: saved.apiKey || "",
    lastSeenId: saved.lastSeenId || 0,
  };
}

function setStatus(el, message, type = "") {
  el.textContent = message;
  el.classList.remove("is-ok", "is-err");
  if (type) el.classList.add(type);
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/admin/sw.js");
}

async function apiFetch(path, options = {}) {
  const { apiBaseUrl, apiKey } = getConfig();
  const res = await fetch(`${apiBaseUrl.replace(/\/$/, "")}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      "X-Admin-Key": apiKey,
      ...(options.headers || {}),
    },
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.detail || payload.message || "요청에 실패했습니다.");
  }
  return payload;
}

function formatDate(value) {
  return new Date(value).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderInquiries(items) {
  inquiryList.innerHTML = "";
  if (!items.length) {
    inquiryList.innerHTML = '<li class="empty">문의가 없습니다.</li>';
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "inquiry-card";
    li.innerHTML = `
      <div class="inquiry-head">
        <strong>#${item.id} ${item.name}</strong>
        <time>${formatDate(item.created_at)}</time>
      </div>
      <p class="inquiry-meta">
        <span>${CATEGORY_LABELS[item.category] || item.category}</span>
        ${item.company ? `<span>${item.company}</span>` : ""}
      </p>
      <p class="inquiry-contact">
        <a href="mailto:${item.email}">${item.email}</a>
        ${item.phone ? `<a href="tel:${item.phone}">${item.phone}</a>` : ""}
      </p>
      <p class="inquiry-message">${item.message.replace(/\n/g, "<br>")}</p>
    `;
    inquiryList.appendChild(li);
  });
}

async function notifyNewInquiries(items) {
  if (!items.length) return;
  const title = items.length === 1 ? "새 문의 1건" : `새 문의 ${items.length}건`;
  const body = `${items[0].name} · ${CATEGORY_LABELS[items[0].category] || items[0].category}`;

  if (Notification.permission === "granted") {
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "notify", title, body });
    } else {
      new Notification(title, { body, icon: "/admin/icons/icon-192.png" });
    }
  }
}

async function refreshInquiries({ notify = false, sinceOnly = false } = {}) {
  const config = getConfig();
  const path = sinceOnly && config.lastSeenId
    ? `/api/admin/inquiries?since_id=${config.lastSeenId}&limit=50`
    : "/api/admin/inquiries?limit=50";

  const data = await apiFetch(path);
  totalCount.textContent = String(data.total);
  latestId.textContent = String(data.latest_id);

  if (sinceOnly && data.items.length) {
    await notifyNewInquiries(data.items);
    const nextLastSeen = Math.max(config.lastSeenId, data.latest_id);
    saveState({ ...config, lastSeenId: nextLastSeen });
    lastSeenId = nextLastSeen;
    await refreshInquiries({ notify: false, sinceOnly: false });
    return;
  }

  renderInquiries(data.items);
  if (notify && data.latest_id > config.lastSeenId) {
    const newItems = data.items.filter((item) => item.id > config.lastSeenId);
    if (newItems.length) await notifyNewInquiries(newItems);
  }

  const nextLastSeen = Math.max(config.lastSeenId, data.latest_id);
  saveState({ ...config, lastSeenId: nextLastSeen });
  lastSeenId = nextLastSeen;
  setStatus(dashboardStatus, `마지막 확인: ${new Date().toLocaleTimeString("ko-KR")}`, "is-ok");
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(() => {
    refreshInquiries({ sinceOnly: true }).catch(() => {
      setStatus(dashboardStatus, "자동 확인 중 오류가 발생했습니다.", "is-err");
    });
  }, POLL_MS);
}

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

function showDashboard() {
  loginPanel.hidden = true;
  dashboard.hidden = false;
  logoutBtn.hidden = false;
}

function showLogin() {
  loginPanel.hidden = false;
  dashboard.hidden = true;
  logoutBtn.hidden = true;
  stopPolling();
}

async function handleLogin() {
  const apiKey = apiKeyInput.value.trim();
  const apiBaseUrl = apiUrlInput.value.trim() || window.ADMIN_CONFIG?.apiBaseUrl || "";
  if (!apiKey || !apiBaseUrl) {
    setStatus(loginStatus, "API 키와 주소를 입력해 주세요.", "is-err");
    return;
  }

  saveState({ apiKey, apiBaseUrl, lastSeenId: 0 });
  setStatus(loginStatus, "연결 확인 중...", "");

  try {
    await apiFetch("/api/admin/inquiries?limit=1");
    setStatus(loginStatus, "", "");
    showDashboard();
    await refreshInquiries();
    startPolling();
  } catch (err) {
    saveState({});
    setStatus(loginStatus, err.message, "is-err");
  }
}

async function enableNotifications() {
  if (!("Notification" in window)) {
    setStatus(dashboardStatus, "이 브라우저는 알림을 지원하지 않습니다.", "is-err");
    return;
  }
  const permission = await Notification.requestPermission();
  notifyState.textContent = permission === "granted" ? "켜짐" : "꺼짐";
  if (permission === "granted") {
    setStatus(dashboardStatus, "새 문의 알림이 활성화되었습니다.", "is-ok");
  } else {
    setStatus(dashboardStatus, "알림 권한이 필요합니다.", "is-err");
  }
}

function restoreSession() {
  const config = getConfig();
  if (config.apiKey && config.apiBaseUrl) {
    apiKeyInput.value = config.apiKey;
    apiUrlInput.value = config.apiBaseUrl;
    lastSeenId = config.lastSeenId || 0;
    showDashboard();
    refreshInquiries().then(startPolling).catch(showLogin);
  } else {
    apiUrlInput.value = window.ADMIN_CONFIG?.apiBaseUrl || "";
  }
}

loginBtn.addEventListener("click", handleLogin);
logoutBtn.addEventListener("click", () => {
  saveState({});
  showLogin();
  setStatus(loginStatus, "로그아웃되었습니다.", "is-ok");
});
refreshBtn.addEventListener("click", () => refreshInquiries().catch((err) => {
  setStatus(dashboardStatus, err.message, "is-err");
}));
notifyBtn.addEventListener("click", enableNotifications);

registerServiceWorker();
restoreSession();

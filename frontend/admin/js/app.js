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
const notifyBtn = document.getElementById("notify-btn");
const refreshBtn = document.getElementById("refresh-btn");

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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
    li.dataset.id = String(item.id);
    li.innerHTML = `
      <div class="inquiry-head">
        <strong>#${item.id} ${escapeHtml(item.name)}</strong>
        <div class="inquiry-actions">
          <time>${formatDate(item.created_at)}</time>
          <button class="btn btn-danger btn-sm" type="button" data-delete="${item.id}">삭제</button>
        </div>
      </div>
      <p class="inquiry-meta">
        <span>${CATEGORY_LABELS[item.category] || item.category}</span>
        ${item.company ? `<span>${escapeHtml(item.company)}</span>` : ""}
      </p>
      <p class="inquiry-contact">
        <a href="mailto:${escapeHtml(item.email)}">${escapeHtml(item.email)}</a>
        ${item.phone ? `<a href="tel:${escapeHtml(item.phone)}">${escapeHtml(item.phone)}</a>` : ""}
      </p>
      <p class="inquiry-message">${escapeHtml(item.message).replace(/\n/g, "<br>")}</p>
    `;
    inquiryList.appendChild(li);
  });
}

async function deleteInquiry(id) {
  if (!window.confirm(`문의 #${id}을(를) 삭제할까요?`)) return;
  try {
    await apiFetch(`/api/admin/inquiries/${id}`, { method: "DELETE" });
    setStatus(dashboardStatus, `문의 #${id}을(를) 삭제했습니다.`, "is-ok");
    await refreshInquiries();
  } catch (err) {
    setStatus(dashboardStatus, err.message || "삭제에 실패했습니다.", "is-err");
  }
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
  syncNotifyState();
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
  syncNotifyState();
  if (permission === "granted") {
    setStatus(dashboardStatus, "새 문의 알림이 활성화되었습니다.", "is-ok");
  } else {
    setStatus(dashboardStatus, "알림 권한이 필요합니다.", "is-err");
  }
}

function syncNotifyState() {
  if (!notifyBtn) return;
  if (!("Notification" in window)) {
    notifyBtn.hidden = true;
    return;
  }
  // 권한이 켜져 있으면 버튼 숨김, 풀리거나 미설정이면 다시 표시
  notifyBtn.hidden = Notification.permission === "granted";
  notifyBtn.disabled = Notification.permission === "denied";
  notifyBtn.textContent =
    Notification.permission === "denied" ? "알림 차단됨" : "알림 켜기";
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

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") syncNotifyState();
});

inquiryList.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-delete]");
  if (!btn) return;
  deleteInquiry(btn.dataset.delete);
});

registerServiceWorker();
restoreSession();

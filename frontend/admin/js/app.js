const CATEGORY_LABELS = {
  hospital: "병원 병상 네임텍",
  meeting: "회의실 전자명패",
  reservation: "예약 룸·테이블",
  office: "관공서·사무실 명패",
  mixed: "복합/기타",
};

const STORAGE_KEY = "epaper-admin";
const POLL_MS = window.ADMIN_CONFIG?.pollIntervalMs || 15000;

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
const testPushBtn = document.getElementById("test-push-btn");
const mobileTip = document.getElementById("mobile-tip");

let pollTimer = null;
let lastSeenId = 0;
let pushReady = false;

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function updateMobileTip() {
  if (!mobileTip) return;
  if (isIos() && !isStandalone()) {
    mobileTip.hidden = false;
    mobileTip.textContent =
      "아이폰/아이패드는 Safari에서 공유 → '홈 화면에 추가' 후, 홈 화면 앱으로 열고 알림 켜기를 눌러야 푸시가 옵니다.";
    return;
  }
  if (!("PushManager" in window)) {
    mobileTip.hidden = false;
    mobileTip.textContent =
      "이 브라우저에서는 푸시 알림을 지원하지 않습니다. Chrome/Safari(홈 화면 앱)를 사용해 주세요.";
    return;
  }
  mobileTip.hidden = true;
}

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
  if (!apiBaseUrl || !apiKey) {
    throw new Error("로그인이 필요합니다.");
  }
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
    const detail = payload.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d) => d.msg || d).join(", ")
          : payload.message || `요청 실패 (${res.status})`;
    throw new Error(message);
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
  if (Notification.permission !== "granted") return;
  const title = items.length === 1 ? "새 문의 1건" : `새 문의 ${items.length}건`;
  const body = `${items[0].name} · ${CATEGORY_LABELS[items[0].category] || items[0].category}`;

  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {
      body,
      icon: "/admin/icons/icon-192.png",
      badge: "/admin/icons/icon-192.png",
      tag: "epaper-inquiry",
      renotify: true,
      data: { url: "/admin/" },
    });
  } catch (_) {
    try {
      new Notification(title, { body, icon: "/admin/icons/icon-192.png" });
    } catch (_) {
      // ignore notification failures so polling continues
    }
  }
}

function urlBase64ToUint8Array(base64String) {
  const cleaned = String(base64String || "")
    .trim()
    .replace(/^"|"$/g, "")
    .replace(/^'|'$/g, "")
    .replace(/\s+/g, "");
  const padding = "=".repeat((4 - (cleaned.length % 4)) % 4);
  const base64 = (cleaned + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  if (output.length !== 65 || output[0] !== 0x04) {
    throw new Error("서버 VAPID 공개키 형식이 올바르지 않습니다. Railway 환경변수를 확인해 주세요.");
  }
  return output;
}

async function subscribeWebPush() {
  if (isIos() && !isStandalone()) {
    throw new Error("아이폰은 홈 화면에 추가한 앱에서만 알림을 켤 수 있습니다.");
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("이 브라우저는 푸시 알림을 지원하지 않습니다.");
  }
  const { publicKey } = await apiFetch("/api/admin/push/vapid-public-key");
  const applicationServerKey = urlBase64ToUint8Array(publicKey);
  const reg = await navigator.serviceWorker.register("/admin/sw.js");
  await navigator.serviceWorker.ready;

  // Old/invalid subscription can block resubscribe with a new VAPID key
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    try {
      await existing.unsubscribe();
    } catch (_) {
      // ignore
    }
  }

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });
  await apiFetch("/api/admin/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  pushReady = true;
  saveState({ ...getConfig(), pushReady: true });
}

async function hasLocalPushSubscription() {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch (_) {
    return false;
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

  // Polling with since_id only returns NEW items.
  // Empty result means "no new inquiries", not "no inquiries at all".
  if (sinceOnly) {
    if (data.items.length) {
      await notifyNewInquiries(data.items);
      const nextLastSeen = Math.max(config.lastSeenId, data.latest_id);
      saveState({ ...config, lastSeenId: nextLastSeen });
      lastSeenId = nextLastSeen;
      await refreshInquiries({ notify: false, sinceOnly: false });
      return;
    }
    setStatus(dashboardStatus, `마지막 확인: ${new Date().toLocaleTimeString("ko-KR")}`, "is-ok");
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
    refreshInquiries({ sinceOnly: true }).catch((err) => {
      setStatus(
        dashboardStatus,
        err?.message || "자동 확인 중 오류가 발생했습니다.",
        "is-err"
      );
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
  ensurePushSubscription();
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
  updateMobileTip();
  if (isIos() && !isStandalone()) {
    setStatus(
      dashboardStatus,
      "아이폰은 홈 화면에 추가한 뒤, 그 앱에서 알림 켜기를 눌러 주세요.",
      "is-err"
    );
    return;
  }
  if (!("Notification" in window)) {
    setStatus(dashboardStatus, "이 브라우저는 알림을 지원하지 않습니다.", "is-err");
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    await syncNotifyState();
    setStatus(dashboardStatus, "알림 권한이 필요합니다.", "is-err");
    return;
  }
  try {
    await subscribeWebPush();
    await syncNotifyState();
    setStatus(dashboardStatus, "이 휴대폰 알림이 켜졌습니다. 앱을 닫아도 알림이 옵니다.", "is-ok");
  } catch (err) {
    pushReady = false;
    await syncNotifyState();
    setStatus(dashboardStatus, err.message || "푸시 구독에 실패했습니다.", "is-err");
  }
}

async function ensurePushSubscription() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (isIos() && !isStandalone()) return;
  try {
    await subscribeWebPush();
    await syncNotifyState();
  } catch (_) {
    // ignore until user taps again
  }
}

async function syncNotifyState() {
  if (!notifyBtn) return;
  updateMobileTip();

  if (!("Notification" in window)) {
    notifyBtn.hidden = true;
    return;
  }

  const subscribed = await hasLocalPushSubscription();
  pushReady = subscribed;

  // Hide button only when this device is fully subscribed
  if (Notification.permission === "granted" && subscribed) {
    notifyBtn.hidden = true;
    if (testPushBtn) testPushBtn.hidden = false;
    return;
  }

  notifyBtn.hidden = false;
  if (testPushBtn) testPushBtn.hidden = true;
  notifyBtn.disabled = Notification.permission === "denied";
  notifyBtn.textContent =
    Notification.permission === "denied" ? "알림 차단됨" : "알림 켜기";
}

async function sendTestPush() {
  try {
    const result = await apiFetch("/api/admin/push/test", { method: "POST" });
    setStatus(dashboardStatus, `테스트 푸시 발송: ${result.sent || 0}건`, "is-ok");
  } catch (err) {
    setStatus(dashboardStatus, err.message || "테스트 푸시 실패", "is-err");
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
testPushBtn?.addEventListener("click", sendTestPush);

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

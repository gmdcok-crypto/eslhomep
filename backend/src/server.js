const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const nodemailer = require("nodemailer");

const PORT = Number(process.env.PORT) || 8080;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const INQUIRY_FILE = path.join(DATA_DIR, "inquiries.jsonl");

const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5500,http://127.0.0.1:5500,http://localhost:8888")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const app = express();
app.set("trust proxy", 1);

app.use(helmet());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        return cb(null, true);
      }
      return cb(new Error("Not allowed by CORS"));
    },
  })
);
app.use(express.json({ limit: "32kb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "signet-esl-api" });
});

const inquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
});

function validateInquiry(body) {
  const errors = [];
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim();
  const message = String(body.message || "").trim();
  const category = String(body.category || "").trim();
  const company = String(body.company || "").trim();
  const phone = String(body.phone || "").trim();

  if (name.length < 2 || name.length > 80) errors.push("이름을 확인해 주세요.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("이메일 형식이 올바르지 않습니다.");
  if (message.length < 5 || message.length > 4000) errors.push("문의 내용을 확인해 주세요.");
  const allowed = new Set(["hospital", "meeting", "reservation", "office", "mixed"]);
  if (!allowed.has(category)) errors.push("관심 분야를 선택해 주세요.");
  if (company.length > 120) errors.push("회사명이 너무 깁니다.");
  if (phone.length > 40) errors.push("연락처가 너무 깁니다.");

  return {
    errors,
    data: {
      name,
      email,
      message,
      category,
      company,
      phone,
      createdAt: new Date().toISOString(),
    },
  };
}

async function ensureDataDir() {
  await fs.promises.mkdir(DATA_DIR, { recursive: true });
}

async function persistInquiry(record) {
  await ensureDataDir();
  await fs.promises.appendFile(INQUIRY_FILE, `${JSON.stringify(record)}\n`, "utf8");
}

async function maybeEmail(record) {
  const host = process.env.SMTP_HOST;
  const to = process.env.INQUIRY_TO;
  if (!host || !to) return;

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });

  const categoryLabel = {
    hospital: "병원 병상 네임텍",
    meeting: "회의실 전자명패",
    reservation: "예약 룸·테이블",
    office: "관공서·사무실 명패",
    mixed: "복합/기타",
  };

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@signet-esl.local",
    to,
    replyTo: record.email,
    subject: `[SIGNET ESL] 문의 — ${categoryLabel[record.category] || record.category}`,
    text: [
      `이름: ${record.name}`,
      `회사/기관: ${record.company || "-"}`,
      `이메일: ${record.email}`,
      `연락처: ${record.phone || "-"}`,
      `분야: ${categoryLabel[record.category] || record.category}`,
      `접수: ${record.createdAt}`,
      "",
      record.message,
    ].join("\n"),
  });
}

app.post("/api/inquiry", inquiryLimiter, async (req, res) => {
  const { errors, data } = validateInquiry(req.body || {});
  if (errors.length) {
    return res.status(400).json({ message: errors[0], errors });
  }

  try {
    await persistInquiry(data);
    try {
      await maybeEmail(data);
    } catch (mailErr) {
      console.error("email failed:", mailErr.message);
    }
    return res.status(201).json({ ok: true, message: "accepted" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "서버 오류로 접수에 실패했습니다." });
  }
});

app.use((err, _req, res, _next) => {
  if (err && err.message === "Not allowed by CORS") {
    return res.status(403).json({ message: "CORS: origin not allowed" });
  }
  console.error(err);
  return res.status(500).json({ message: "Unexpected error" });
});

app.listen(PORT, () => {
  console.log(`SIGNET ESL API listening on :${PORT}`);
});

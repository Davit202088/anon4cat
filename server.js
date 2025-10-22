// server.js — Express + WebSocket signaling server with SQLite
// PRODUCTION VERSION FOR TIMEWEB DEPLOYMENT

const fs = require("fs");
const express = require("express");
const http = require("http");
const https = require("https");
const WebSocket = require("ws");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const helmet = require("helmet");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();

// Trust proxy (important for Timeweb/Nginx)
app.set('trust proxy', 1);

// Helmet with WebSocket-friendly CSP
app.use(helmet({
  contentSecurityPolicy: false,
}));

app.use(bodyParser.json({ limit: "64kb" }));
app.use(express.static(path.join(__dirname, "public")));

const BOT_TOKEN = process.env.BOT_TOKEN || "";
if (!BOT_TOKEN) console.warn("⚠️ BOT_TOKEN not set! Telegram validation disabled.");

// ==================== DATABASE SETUP ====================
const db = new Database("users.db");

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    userId INTEGER PRIMARY KEY,
    username TEXT,
    firstName TEXT,
    lastName TEXT,
    role TEXT DEFAULT 'user',
    createdAt TEXT,
    lastActive TEXT
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL UNIQUE,
    status TEXT DEFAULT 'free',
    tier TEXT DEFAULT 'free',
    expiresAt TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS admin_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    adminId INTEGER,
    userId INTEGER,
    action TEXT,
    oldValue TEXT,
    newValue TEXT,
    timestamp TEXT
  );
`);

console.log("✅ Database initialized");

const ADMIN_IDS = (process.env.ADMIN_IDS || "").split(",").filter(Boolean);

// ==================== DATABASE FUNCTIONS ====================

// Get or create user
function getOrCreateUser(telegramData) {
  const userId = telegramData.id;
  const now = new Date().toISOString();

  let user = db.prepare("SELECT * FROM users WHERE userId = ?").get(userId);

  if (!user) {
    const isAdminUser = ADMIN_IDS.includes(String(userId));
    db.prepare(`
      INSERT INTO users (userId, username, firstName, lastName, role, createdAt, lastActive)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      telegramData.username || '',
      telegramData.first_name || '',
      telegramData.last_name || '',
      isAdminUser ? 'admin' : 'user',
      now,
      now
    );

    // Create subscription record
    db.prepare(`
      INSERT INTO subscriptions (userId, status, tier, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, 'free', 'free', now, now);

    console.log(`👤 New user created: ${userId}`);
    user = db.prepare("SELECT * FROM users WHERE userId = ?").get(userId);
  } else {
    // Update last active
    db.prepare("UPDATE users SET lastActive = ? WHERE userId = ?").run(now, userId);
  }

  return user;
}

// Check if admin
function isAdmin(userId) {
  const user = db.prepare("SELECT role FROM users WHERE userId = ?").get(userId);
  return user && (user.role === 'admin' || ADMIN_IDS.includes(String(userId)));
}

// Get user with subscription
function getUserWithSubscription(userId) {
  const user = db.prepare("SELECT * FROM users WHERE userId = ?").get(userId);
  if (!user) return null;

  const subscription = db.prepare("SELECT * FROM subscriptions WHERE userId = ?").get(userId);

  return {
    ...user,
    subscription: subscription || { status: 'free', tier: 'free' }
  };
}

// Log admin action
function logAdminAction(adminId, userId, action, oldValue, newValue) {
  db.prepare(`
    INSERT INTO admin_actions (adminId, userId, action, oldValue, newValue, timestamp)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(adminId, userId, action, oldValue, newValue, new Date().toISOString());
}

// ==================== HTTPS SETUP ====================
let server;
if (fs.existsSync("cert.pem") && fs.existsSync("key.pem")) {
  const options = {
    cert: fs.readFileSync("cert.pem"),
    key: fs.readFileSync("key.pem"),
  };
  server = https.createServer(options, app);
  console.log("✅ HTTPS mode enabled");
} else {
  server = http.createServer(app);
  console.log("⚠️ HTTP mode - use reverse proxy with SSL");
}

// ==================== API ENDPOINTS ====================

// Telegram init
app.post("/api/init", async (req, res) => {
  try {
    const initData = req.body.initData || "";
    if (!initData) return res.status(400).send({ ok: false, error: "missing initData" });

    const params = new URLSearchParams(initData);
    const userParam = params.get("user");

    if (!userParam) {
      return res.status(400).send({ ok: false, error: "no user data" });
    }

    let telegramUser;
    try {
      telegramUser = JSON.parse(userParam);
    } catch (e) {
      return res.status(400).send({ ok: false, error: "invalid user data" });
    }

    // Verify hash if BOT_TOKEN is set
    let verified = false;
    if (BOT_TOKEN) {
      const hash = params.get("hash");
      if (hash) {
        params.delete("hash");
        const checkString = [...params.entries()]
          .map(([k, v]) => `${k}=${v}`)
          .sort()
          .join("\n");
        const secret = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
        const calcHash = crypto.createHmac("sha256", secret).update(checkString).digest("hex");
        verified = (calcHash === hash);
      }
    }

    const user = getOrCreateUser(telegramUser);
    const subscription = db.prepare("SELECT * FROM subscriptions WHERE userId = ?").get(user.userId);

    // Format response to match client expectations
    const premiumStatus = subscription && subscription.status === 'active' ? 'premium' : 'free';
    const isPremium = premiumStatus === 'premium';

    res.send({
      ok: true,
      verified: verified,
      user: {
        id: user.userId,
        userId: user.userId,
        first_name: user.firstName,
        firstName: user.firstName,
        last_name: user.lastName,
        lastName: user.lastName,
        username: user.username,
        is_premium: isPremium,
        is_bot: false,
        role: user.role,
        premiumStatus: premiumStatus,
        subscription: subscription
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).send({ ok: false, error: "server error" });
  }
});

// Get profile
app.get("/api/profile/:userId", (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const userWithSub = getUserWithSubscription(userId);

    if (!userWithSub) {
      return res.status(404).send({ ok: false, error: "User not found" });
    }

    res.send({
      ok: true,
      user: {
        userId: userWithSub.userId,
        username: userWithSub.username,
        firstName: userWithSub.firstName,
        role: userWithSub.role,
        createdAt: userWithSub.createdAt
      },
      subscription: userWithSub.subscription
    });
  } catch (e) {
    console.error(e);
    res.status(500).send({ ok: false, error: "server error" });
  }
});

// Get subscription
app.get("/api/subscription/:userId", (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const subscription = db.prepare("SELECT * FROM subscriptions WHERE userId = ?").get(userId);

    if (!subscription) {
      return res.status(404).send({ ok: false, error: "Subscription not found" });
    }

    const isExpired = subscription.expiresAt && new Date(subscription.expiresAt) < new Date();

    res.send({
      ok: true,
      subscription: {
        ...subscription,
        isExpired: isExpired,
        daysRemaining: subscription.expiresAt ?
          Math.max(0, Math.floor((new Date(subscription.expiresAt) - new Date()) / (1000 * 60 * 60 * 24))) :
          null
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).send({ ok: false, error: "server error" });
  }
});

// Admin: Get users
app.get("/api/admin/users", (req, res) => {
  try {
    const adminId = parseInt(req.query.adminId);

    if (!isAdmin(adminId)) {
      return res.status(403).send({ ok: false, error: "Access denied" });
    }

    const users = db.prepare(`
      SELECT u.*, s.status, s.tier, s.expiresAt
      FROM users u
      LEFT JOIN subscriptions s ON u.userId = s.userId
    `).all();

    // Format users to match client expectations
    const formattedUsers = users.map(user => ({
      ...user,
      premiumStatus: user.status === 'active' ? 'premium' : 'free'
    }));

    res.send({ ok: true, users: formattedUsers || [] });
  } catch (e) {
    console.error(e);
    res.status(500).send({ ok: false, error: "server error" });
  }
});

// Admin: Update subscription
app.post("/api/admin/update-subscription", (req, res) => {
  try {
    const { adminId, userId, tier, daysValid } = req.body;

    if (!isAdmin(adminId)) {
      return res.status(403).send({ ok: false, error: "Access denied" });
    }

    const user = db.prepare("SELECT * FROM users WHERE userId = ?").get(userId);
    if (!user) {
      return res.status(404).send({ ok: false, error: "User not found" });
    }

    const validTiers = ['free', 'premium_1month', 'premium_3month', 'premium_6month'];
    if (!validTiers.includes(tier)) {
      return res.status(400).send({ ok: false, error: "Invalid tier" });
    }

    const now = new Date();
    let expiresAt = null;

    if (tier !== 'free' && daysValid && daysValid > 0) {
      const expiresDate = new Date(now.getTime() + daysValid * 24 * 60 * 60 * 1000);
      expiresAt = expiresDate.toISOString();
    }

    const oldSub = db.prepare("SELECT * FROM subscriptions WHERE userId = ?").get(userId);

    db.prepare(`
      UPDATE subscriptions
      SET status = ?, tier = ?, expiresAt = ?, updatedAt = ?
      WHERE userId = ?
    `).run(
      tier !== 'free' ? 'active' : 'free',
      tier,
      expiresAt,
      now.toISOString(),
      userId
    );

    logAdminAction(
      adminId,
      userId,
      'subscription_update',
      oldSub ? JSON.stringify(oldSub) : null,
      JSON.stringify({ tier, expiresAt })
    );

    console.log(`Admin ${adminId} updated ${userId} subscription to: ${tier}`);

    const subscription = db.prepare("SELECT * FROM subscriptions WHERE userId = ?").get(userId);

    res.send({
      ok: true,
      message: "Subscription updated",
      subscription: subscription
    });
  } catch (e) {
    console.error(e);
    res.status(500).send({ ok: false, error: "server error" });
  }
});

// Admin: Update premium status (simpler version)
app.post("/api/admin/update-premium", (req, res) => {
  try {
    const { adminId, userId, premiumStatus } = req.body;

    if (!isAdmin(adminId)) {
      return res.status(403).send({ ok: false, error: "Access denied" });
    }

    const user = db.prepare("SELECT * FROM users WHERE userId = ?").get(userId);
    if (!user) {
      return res.status(404).send({ ok: false, error: "User not found" });
    }

    const now = new Date();
    const oldSub = db.prepare("SELECT * FROM subscriptions WHERE userId = ?").get(userId);

    const newStatus = premiumStatus === 'premium' ? 'active' : 'free';
    const newTier = premiumStatus === 'premium' ? 'premium_1month' : 'free';
    let expiresAt = null;

    if (premiumStatus === 'premium') {
      // Set premium for 30 days by default
      const expiresDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      expiresAt = expiresDate.toISOString();
    }

    db.prepare(`
      UPDATE subscriptions
      SET status = ?, tier = ?, expiresAt = ?, updatedAt = ?
      WHERE userId = ?
    `).run(newStatus, newTier, expiresAt, now.toISOString(), userId);

    logAdminAction(
      adminId,
      userId,
      'premium_update',
      oldSub ? oldSub.status : 'free',
      newStatus
    );

    console.log(`Admin ${adminId} updated ${userId} premium status to: ${premiumStatus}`);

    res.send({
      ok: true,
      message: "Premium status updated"
    });
  } catch (e) {
    console.error(e);
    res.status(500).send({ ok: false, error: "server error" });
  }
});

// Admin: Update role
app.post("/api/admin/update-role", (req, res) => {
  try {
    const { adminId, userId, role } = req.body;

    if (!isAdmin(adminId)) {
      return res.status(403).send({ ok: false, error: "Access denied" });
    }

    const user = db.prepare("SELECT * FROM users WHERE userId = ?").get(userId);
    if (!user) {
      return res.status(404).send({ ok: false, error: "User not found" });
    }

    const validRoles = ['user', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).send({ ok: false, error: "Invalid role" });
    }

    const oldRole = user.role;

    db.prepare(`
      UPDATE users
      SET role = ?
      WHERE userId = ?
    `).run(role, userId);

    logAdminAction(
      adminId,
      userId,
      'role_update',
      oldRole,
      role
    );

    console.log(`Admin ${adminId} updated ${userId} role to: ${role}`);

    res.send({
      ok: true,
      message: "Role updated"
    });
  } catch (e) {
    console.error(e);
    res.status(500).send({ ok: false, error: "server error" });
  }
});

// Admin: Get logs
app.get("/api/admin/logs", (req, res) => {
  try {
    const adminId = parseInt(req.query.adminId);

    if (!isAdmin(adminId)) {
      return res.status(403).send({ ok: false, error: "Access denied" });
    }

    const logs = db.prepare(`
      SELECT * FROM admin_actions ORDER BY timestamp DESC LIMIT 100
    `).all();

    res.send({ ok: true, logs: logs || [] });
  } catch (e) {
    console.error(e);
    res.status(500).send({ ok: false, error: "server error" });
  }
});

// Health check
app.get("/health", (req, res) => {
  try {
    const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
    const premiumUsers = db.prepare("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active'").get().count;

    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      connections: wss ? wss.clients.size : 0,
      queue: queue.length,
      totalUsers: totalUsers,
      premiumUsers: premiumUsers
    });
  } catch (e) {
    res.status(500).json({ status: "error", message: e.message });
  }
});

// ==================== WEBSOCKET ====================
const wss = new WebSocket.Server({
  server,
  verifyClient: (info, callback) => {
    callback(true);
  },
  clientTracking: true,
  maxPayload: 100 * 1024
});

let queue = [];

wss.on("connection", (ws, req) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.log(`Connected from ${clientIp}`);

  ws.partner = null;
  ws.isAlive = true;
  ws.connectionTime = Date.now();

  try {
    ws.send(JSON.stringify({ type: "waiting" }));
  } catch (e) {}

  queue = queue.filter(client => client.readyState === WebSocket.OPEN);

  if (queue.length > 0) {
    const partner = queue.shift();

    if (partner.readyState === WebSocket.OPEN && !partner.partner) {
      partner.partner = ws;
      ws.partner = partner;

      try {
        partner.send(JSON.stringify({ type: "match", initiator: true }));
        ws.send(JSON.stringify({ type: "match", initiator: false }));
      } catch (e) {
        queue.push(ws);
      }
    } else {
      queue.push(ws);
    }
  } else {
    queue.push(ws);
  }

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());

      if (data.type === "signal") {
        if (ws.partner && ws.partner.readyState === WebSocket.OPEN) {
          ws.partner.send(JSON.stringify({ type: "signal", data: data.data }));
        }
      } else if (data.type === "leave") {
        if (ws.partner && ws.partner.readyState === WebSocket.OPEN) {
          ws.partner.send(JSON.stringify({ type: "partner_disconnected" }));
          ws.partner.partner = null;
        }
        ws.partner = null;
        queue = queue.filter((c) => c !== ws);
      }
    } catch (error) {
      console.error("Message error:", error);
    }
  });

  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.on("close", () => {
    if (ws.partner && ws.partner.readyState === WebSocket.OPEN) {
      try {
        ws.partner.send(JSON.stringify({ type: "partner_disconnected" }));
        ws.partner.partner = null;
      } catch (e) {}
    }
    queue = queue.filter((c) => c !== ws);
  });

  ws.on("error", (error) => {
    console.error("WS error:", error.message);
    if (ws.partner && ws.partner.readyState === WebSocket.OPEN) {
      try {
        ws.partner.send(JSON.stringify({ type: "partner_disconnected" }));
        ws.partner.partner = null;
      } catch (e) {}
    }
    queue = queue.filter((c) => c !== ws);
  });
});

const heartbeat = setInterval(() => {
  let terminated = 0;
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      if (ws.partner && ws.partner.readyState === WebSocket.OPEN) {
        try {
          ws.partner.send(JSON.stringify({ type: "partner_disconnected" }));
          ws.partner.partner = null;
        } catch (e) {}
      }
      queue = queue.filter((c) => c !== ws);
      ws.terminate();
      terminated++;
      return;
    }
    ws.isAlive = false;
    try {
      ws.ping();
    } catch (e) {}
  });
  queue = queue.filter(client => client.readyState === WebSocket.OPEN && !client.partner);
}, 30000);

wss.on("close", () => {
  clearInterval(heartbeat);
});

// Serve index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ==================== SERVER START ====================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("═══════════════════════════════════════════");
  console.log("🚀 Server running on port " + PORT);
  console.log("📡 WebSocket server ready");
  console.log("💾 Database: users.db");
  console.log("═══════════════════════════════════════════");
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received: closing server');
  db.close();
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received: closing server');
  db.close();
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});
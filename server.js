import "dotenv/config";
import express from "express";
import path from "node:path";
import { loadStore } from "./src/store.js";
import { buildDashboard } from "./src/aggregate.js";
import { startSync, syncStatus } from "./src/sync.js";
import { demoStore } from "./src/demo-data.js";

const DEMO = process.env.DEMO === "1";
const PORT = Number(process.env.PORT || 3000);
const app = express();
app.use(express.json());

// Chats contain customer data: protect the dashboard with a password when one is set.
const PASSWORD = process.env.DASHBOARD_PASSWORD;
if (PASSWORD) {
  app.use((req, res, next) => {
    const [, b64 = ""] = (req.headers.authorization || "").split(" ");
    const [, pass] = Buffer.from(b64, "base64").toString().split(":");
    if (pass === PASSWORD) return next();
    res.set("WWW-Authenticate", 'Basic realm="Agent review dashboard"').status(401).send("Authentication required");
  });
}

const getStore = () => (DEMO ? demoStore() : loadStore());

app.get("/api/dashboard", (req, res) => {
  const { from, to, days, agents } = req.query;
  let fromDate, toDate;
  if (from || to) {
    if (from) fromDate = new Date(from);
    if (to) toDate = new Date(new Date(to).getTime() + 86400_000 - 1); // inclusive end of day
  } else if (days) {
    fromDate = new Date(Date.now() - Number(days) * 86400_000);
  }
  const agentIds = agents ? String(agents).split(",").filter(Boolean) : undefined;
  const store = getStore();
  const dashboard = buildDashboard(store, { from: fromDate, to: toDate, agentIds });

  // Period-over-period: same-length window immediately before `from`, for the trend arrows on
  // the Overview exec summary. Skipped for "all time" (fromDate unset) - there's no "before" that.
  let previous = null;
  if (fromDate) {
    const windowMs = (toDate ? toDate.getTime() : Date.now()) - fromDate.getTime();
    const prevTo = new Date(fromDate.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - windowMs);
    previous = buildDashboard(store, { from: prevFrom, to: prevTo, agentIds }).summary;
  }

  res.json({ demo: DEMO, ...dashboard, previous });
});

app.get("/api/conversations/:sid", (req, res) => {
  const c = getStore().conversations[req.params.sid];
  if (!c) return res.status(404).json({ error: "Not found" });
  res.json(c);
});

app.post("/api/sync", (req, res) => {
  if (DEMO) return res.status(400).json({ error: "Demo mode: set Crisp and Anthropic credentials in .env and restart without DEMO=1 to sync real chats." });
  const days = Math.min(90, Math.max(1, Number(req.body?.days) || 7));
  const reanalyze = Boolean(req.body?.reanalyze);
  startSync({
    days,
    reanalyze,
    maxConversations: Number(process.env.SYNC_MAX_CONVERSATIONS || 200),
    concurrency: Number(process.env.SYNC_CONCURRENCY || 3),
  }).catch((err) => {
    console.error("[sync] failed:", err);
    syncStatus.message = `Sync failed: ${err.message}`;
  });
  res.status(202).json(syncStatus);
});

app.get("/api/sync/status", (_req, res) => res.json(syncStatus));

app.use(express.static(path.resolve("public")));

app.listen(PORT, () => {
  console.log(`Agent review dashboard on http://localhost:${PORT}${DEMO ? " (demo data)" : ""}`);
});

const every = Number(process.env.SYNC_INTERVAL_MINUTES || 0);
if (!DEMO && every > 0) {
  const run = () => startSync({ days: Number(process.env.SYNC_DAYS || 2) }).catch((e) => console.error("[sync]", e.message));
  setInterval(run, every * 60_000);
  run();
}

// Pulls conversations from Crisp, reviews new/changed ones with Claude, and stores the results.
import { CrispClient, fetchKnowledgeBase, fetchRatings } from "./crisp.js";
import { analyzeConversation, formatTranscript } from "./analyzer.js";
import { loadStore, saveStore } from "./store.js";

const isBot = (m) => m.automated || m.user?.type === "bot" || String(m.origin || "").startsWith("urn:");

/** The human operator who wrote most of the agent replies in the chat. */
export function pickAgent(messages) {
  const counts = new Map();
  for (const m of messages) {
    if (m.from !== "operator" || m.type === "note" || isBot(m)) continue;
    const id = m.user?.user_id || m.user?.nickname || "unknown";
    const cur = counts.get(id) || { id, name: m.user?.nickname || "Unknown agent", n: 0 };
    cur.n++;
    counts.set(id, cur);
  }
  const best = [...counts.values()].sort((a, b) => b.n - a.n)[0];
  return best ? { id: best.id, name: best.name } : null;
}

let running = null;
export const syncStatus = { running: false, total: 0, done: 0, failed: 0, skipped: 0, message: "", startedAt: null, finishedAt: null };

export function startSync(opts) {
  if (running) return running;
  running = runSync(opts).finally(() => {
    running = null;
    syncStatus.running = false;
    syncStatus.finishedAt = new Date().toISOString();
  });
  return running;
}

async function runSync({ days = 7, maxConversations = 200, concurrency = 3, reanalyze = false } = {}) {
  Object.assign(syncStatus, { running: true, total: 0, done: 0, failed: 0, skipped: 0, message: "Connecting to Crisp…", startedAt: new Date().toISOString(), finishedAt: null });

  const crisp = new CrispClient({
    identifier: process.env.CRISP_IDENTIFIER || process.env.CRISP_API_IDENTIFIER,
    key: process.env.CRISP_KEY || process.env.CRISP_API_KEY,
    websiteId: process.env.CRISP_WEBSITE_ID,
  });
  const store = loadStore();
  const dateEnd = new Date();
  const dateStart = new Date(Date.now() - days * 86400_000);

  syncStatus.message = "Loading knowledge base…";
  const locale = process.env.CRISP_KB_LOCALE || "en-us";
  const kb = await fetchKnowledgeBase(crisp, locale);
  if (kb.length) store.knowledgeBase = kb;
  const articles = store.knowledgeBase || [];

  syncStatus.message = "Loading user ratings…";
  const ratings = await fetchRatings(crisp, { dateStart, dateEnd });

  syncStatus.message = "Listing conversations…";
  const list = [];
  for (let page = 1; list.length < maxConversations && page <= 50; page++) {
    const batch = await crisp.listConversations({ page, dateStart, dateEnd });
    if (!Array.isArray(batch) || batch.length === 0) break;
    list.push(...batch);
  }
  const todo = list.slice(0, maxConversations);
  syncStatus.total = todo.length;
  syncStatus.message = `Reviewing ${todo.length} conversations…`;

  let idx = 0;
  const worker = async () => {
    while (idx < todo.length) {
      const conv = todo[idx++];
      const sid = conv.session_id;
      const prev = store.conversations[sid];
      const updatedAt = conv.updated_at || conv.last_message_at || conv.created_at;
      const rating = ratings.get(sid) || prev?.userRating || null;
      if (!reanalyze && prev?.analysis && prev.updatedAt === updatedAt) {
        if (rating && !prev.userRating) prev.userRating = rating;
        syncStatus.skipped++;
        syncStatus.done++;
        continue;
      }
      try {
        const messages = await crisp.getAllMessages(sid);
        const agent = pickAgent(messages);
        const userMsgs = messages.filter((m) => m.from === "user" && m.type === "text").length;
        const base = {
          sessionId: sid,
          updatedAt,
          createdAt: conv.created_at,
          state: conv.state,
          user: { name: conv.meta?.nickname || "Visitor", email: conv.meta?.email || "" },
          agent,
          userRating: rating,
          messageCount: messages.length,
          transcript: formatTranscript(messages),
          crispUrl: `https://app.crisp.chat/website/${crisp.websiteId}/inbox/${sid}/`,
        };
        if (!agent || userMsgs === 0) {
          // Nothing to grade: no human agent replied, or the visitor never wrote.
          store.conversations[sid] = { ...base, analysis: null, skippedReason: !agent ? "No human agent replied" : "User sent no message" };
          syncStatus.skipped++;
        } else {
          const analysis = await analyzeConversation({ transcript: base.transcript, agentName: agent.name, userRating: rating, articles });
          store.conversations[sid] = { ...base, analysis, analyzedAt: new Date().toISOString() };
        }
      } catch (err) {
        console.error(`[sync] ${sid}: ${err.message}`);
        syncStatus.failed++;
        if (prev) prev.lastError = err.message;
      }
      syncStatus.done++;
      if (syncStatus.done % 5 === 0) saveStore(store);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));

  store.lastSync = new Date().toISOString();
  saveStore(store);
  syncStatus.message = `Done: ${syncStatus.done - syncStatus.skipped - syncStatus.failed} reviewed, ${syncStatus.skipped} skipped, ${syncStatus.failed} failed.`;
  return syncStatus;
}

// Turns stored per-chat reviews into the numbers the dashboard shows.

export const SCORE_KEYS = [
  "overall",
  "response",
  "user_satisfaction",
  "communication",
  "knowledge",
  "query_understanding",
  "guidance",
  "instructions",
  "kb_usage",
];

const DAY = 86400_000;
const avg = (xs) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
const pct = (n, d) => (d ? Math.round((n / d) * 100) : null);
const dayKey = (t) => new Date(t).toISOString().slice(0, 10);

export const isNegativeRating = (r) => r && r.stars <= 2;
/** A chat counts as a "negative outcome" whether or not Crisp exposes a star rating for it. */
const isNegativeOutcome = (c) => isNegativeRating(c.userRating) || !c.analysis.user_satisfied;

/**
 * @param {{from?: Date, to?: Date, agentIds?: string[]}} opts
 *   from/to bound the window (inclusive); agentIds, if given, restricts to those agent ids.
 */
export function buildDashboard(store, { from, to, agentIds } = {}) {
  const lo = from ? from.getTime() : 0;
  const hi = to ? to.getTime() : Date.now() + DAY;
  const agentFilter = agentIds && agentIds.length ? new Set(agentIds) : null;

  const inWindow = (c) => {
    const t = c.updatedAt || c.createdAt || 0;
    return t >= lo && t <= hi;
  };
  const all = Object.values(store.conversations || {}).filter(inWindow);
  const reviewed = all.filter((c) => c.analysis && (!agentFilter || agentFilter.has(c.agent?.id)));

  const scoreAvg = (list) => Object.fromEntries(SCORE_KEYS.map((k) => [k, avg(list.map((c) => c.analysis.scores[k]))]));
  const rated = (list) => list.filter((c) => c.userRating);

  // Every agent seen in the whole store (not just this window) so the filter dropdown is stable.
  const allAgentsEver = new Map();
  for (const c of Object.values(store.conversations || {})) {
    if (!c.analysis || !c.agent) continue;
    if (!allAgentsEver.has(c.agent.id)) allAgentsEver.set(c.agent.id, c.agent.name);
  }

  const agentsInWindow = new Map();
  for (const c of all.filter((c) => c.analysis)) {
    const key = c.agent.id;
    if (!agentsInWindow.has(key)) agentsInWindow.set(key, { id: key, name: c.agent.name, chats: [] });
    agentsInWindow.get(key).chats.push(c);
  }

  const agentRows = [...agentsInWindow.values()]
    .map((a) => {
      const r = rated(a.chats);
      const flagged = a.chats.filter((c) => c.analysis.needs_manager_review).sort((x, y) => (y.updatedAt || 0) - (x.updatedAt || 0));
      const worst = [...a.chats].sort((x, y) => x.analysis.scores.overall - y.analysis.scores.overall)[0];
      return {
        id: a.id,
        name: a.name,
        chats: a.chats.length,
        scores: scoreAvg(a.chats),
        satisfiedPct: pct(a.chats.filter((c) => c.analysis.user_satisfied).length, a.chats.length),
        resolvedPct: pct(a.chats.filter((c) => c.analysis.query_resolved).length, a.chats.length),
        missedKb: a.chats.filter((c) => c.analysis.kb.missed_article).length,
        needsReview: flagged.length,
        lastFlaggedAt: flagged[0]?.updatedAt || null,
        negativeOutcomes: a.chats.filter(isNegativeOutcome).length,
        worstChat: worst ? { sessionId: worst.sessionId, overall: worst.analysis.scores.overall, updatedAt: worst.updatedAt, query: worst.analysis.user_query } : null,
        userStarsAvg: avg(r.map((c) => c.userRating.stars)),
        ratedChats: r.length,
        negativeRatings: r.filter((c) => isNegativeRating(c.userRating)).length,
      };
    })
    .sort((a, b) => (b.scores.overall ?? 0) - (a.scores.overall ?? 0));

  const r = rated(reviewed);
  const summary = {
    totalConversations: all.length,
    reviewed: reviewed.length,
    skipped: all.filter((c) => !c.analysis).length,
    scores: scoreAvg(reviewed),
    satisfiedPct: pct(reviewed.filter((c) => c.analysis.user_satisfied).length, reviewed.length),
    resolvedPct: pct(reviewed.filter((c) => c.analysis.query_resolved).length, reviewed.length),
    knowledgeTransferredPct: pct(reviewed.filter((c) => c.analysis.knowledge_transferred).length, reviewed.length),
    missedKb: reviewed.filter((c) => c.analysis.kb.missed_article).length,
    needsReview: reviewed.filter((c) => c.analysis.needs_manager_review).length,
    userStarsAvg: avg(r.map((c) => c.userRating.stars)),
    ratedChats: r.length,
    negativeRatings: r.filter((c) => isNegativeRating(c.userRating)).length,
    negativeOutcomes: reviewed.filter(isNegativeOutcome).length,
  };

  const conversations = reviewed
    .map((c) => ({
      sessionId: c.sessionId,
      updatedAt: c.updatedAt,
      user: c.user,
      agent: c.agent,
      userRating: c.userRating,
      crispUrl: c.crispUrl,
      query: c.analysis.user_query,
      category: c.analysis.query_category,
      summary: c.analysis.summary,
      overall: c.analysis.scores.overall,
      satisfied: c.analysis.user_satisfied,
      resolved: c.analysis.query_resolved,
      needsReview: c.analysis.needs_manager_review,
      missedKb: c.analysis.kb.missed_article,
    }))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  const negativeRatings = reviewed
    .filter(isNegativeOutcome)
    .map((c) => ({
      sessionId: c.sessionId,
      updatedAt: c.updatedAt,
      agent: c.agent,
      user: c.user,
      stars: c.userRating?.stars ?? null,
      comment: c.userRating?.comment ?? "",
      query: c.analysis.user_query,
      aiOverall: c.analysis.scores.overall,
      recommendedRating: c.analysis.manager_review.recommended_rating,
      verdict: c.analysis.manager_review.verdict,
      crispUrl: c.crispUrl,
    }))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  // Group requests for the same missing article together.
  const suggestions = new Map();
  for (const c of reviewed) {
    const s = c.analysis.suggested_article;
    if (!s?.needed) continue;
    const key = s.suggested_title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!suggestions.has(key)) {
      suggestions.set(key, { title: s.suggested_title, category: c.analysis.query_category, questions: [], whatUserWants: s.what_user_wants, sessions: [] });
    }
    const g = suggestions.get(key);
    g.questions.push(s.user_question);
    g.sessions.push({ sessionId: c.sessionId, user: c.user.name, crispUrl: c.crispUrl });
  }
  const suggestedArticles = [...suggestions.values()].sort((a, b) => b.sessions.length - a.sessions.length);

  const categories = {};
  for (const c of reviewed) categories[c.analysis.query_category] = (categories[c.analysis.query_category] || 0) + 1;

  // Per-day trend: chat volume + average score, for the Overview chart. Capped to the last 90 buckets.
  const days = new Map();
  for (const c of reviewed) {
    const k = dayKey(c.updatedAt || c.createdAt);
    if (!days.has(k)) days.set(k, []);
    days.get(k).push(c);
  }
  const trend = [...days.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-90)
    .map(([date, list]) => ({
      date,
      chats: list.length,
      overall: avg(list.map((c) => c.analysis.scores.overall)),
      flagged: list.filter((c) => c.analysis.needs_manager_review).length,
    }));

  // Leaderboards for the "who's doing worst, and when" requirement.
  const mostFlagged = [...agentRows].filter((a) => a.needsReview > 0).sort((a, b) => b.needsReview - a.needsReview).slice(0, 10);
  const mostNegative = [...agentRows].filter((a) => a.negativeOutcomes > 0).sort((a, b) => b.negativeOutcomes - a.negativeOutcomes).slice(0, 10);
  const lowestScoring = [...agentRows].filter((a) => a.chats >= 2).sort((a, b) => (a.scores.overall ?? 10) - (b.scores.overall ?? 10)).slice(0, 10);

  return {
    lastSync: store.lastSync,
    knowledgeBaseSize: (store.knowledgeBase || []).length,
    allAgents: [...allAgentsEver.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
    summary,
    agents: agentRows,
    conversations,
    negativeRatings,
    suggestedArticles,
    categories: Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 12),
    trend,
    leaderboards: { mostFlagged, mostNegative, lowestScoring },
  };
}

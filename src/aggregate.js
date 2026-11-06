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

const avg = (xs) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
const pct = (n, d) => (d ? Math.round((n / d) * 100) : null);

export const isNegativeRating = (r) => r && r.stars <= 2;

export function buildDashboard(store, { days, agentId } = {}) {
  const since = days ? Date.now() - days * 86400_000 : 0;
  const all = Object.values(store.conversations || {}).filter((c) => (c.updatedAt || c.createdAt || 0) >= since);
  const reviewed = all.filter((c) => c.analysis && (!agentId || c.agent?.id === agentId));

  const scoreAvg = (list) => Object.fromEntries(SCORE_KEYS.map((k) => [k, avg(list.map((c) => c.analysis.scores[k]))]));
  const rated = (list) => list.filter((c) => c.userRating);

  const agents = new Map();
  for (const c of all.filter((c) => c.analysis)) {
    const key = c.agent.id;
    if (!agents.has(key)) agents.set(key, { id: key, name: c.agent.name, chats: [] });
    agents.get(key).chats.push(c);
  }

  const agentRows = [...agents.values()]
    .map((a) => {
      const r = rated(a.chats);
      return {
        id: a.id,
        name: a.name,
        chats: a.chats.length,
        scores: scoreAvg(a.chats),
        satisfiedPct: pct(a.chats.filter((c) => c.analysis.user_satisfied).length, a.chats.length),
        resolvedPct: pct(a.chats.filter((c) => c.analysis.query_resolved).length, a.chats.length),
        missedKb: a.chats.filter((c) => c.analysis.kb.missed_article).length,
        needsReview: a.chats.filter((c) => c.analysis.needs_manager_review).length,
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
    .filter((c) => isNegativeRating(c.userRating))
    .map((c) => ({
      sessionId: c.sessionId,
      updatedAt: c.updatedAt,
      agent: c.agent,
      user: c.user,
      stars: c.userRating.stars,
      comment: c.userRating.comment,
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

  return {
    lastSync: store.lastSync,
    knowledgeBaseSize: (store.knowledgeBase || []).length,
    summary,
    agents: agentRows,
    conversations,
    negativeRatings,
    suggestedArticles,
    categories: Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 12),
  };
}

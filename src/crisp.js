// Minimal Crisp REST API client (https://docs.crisp.chat/references/rest-api/v1/).
// Auth uses a Crisp plugin token: identifier + key, sent as HTTP Basic auth with the plugin tier header.

const API = "https://api.crisp.chat/v1";

export class CrispClient {
  constructor({ identifier, key, websiteId }) {
    if (!identifier || !key || !websiteId) {
      throw new Error("CRISP_IDENTIFIER, CRISP_KEY and CRISP_WEBSITE_ID are required");
    }
    this.websiteId = websiteId;
    this.auth = "Basic " + Buffer.from(`${identifier}:${key}`).toString("base64");
  }

  async request(path, query = {}) {
    const url = new URL(API + path);
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetch(url, {
        headers: { Authorization: this.auth, "X-Crisp-Tier": "plugin", Accept: "application/json" },
      });
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        continue;
      }
      // Crisp answers 404 for an empty page on list routes.
      if (res.status === 404) return [];
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.error) {
        throw new Error(`Crisp ${res.status} ${path}: ${body.reason || res.statusText}`);
      }
      return body.data;
    }
    throw new Error(`Crisp request failed after retries: ${path}`);
  }

  w(path) {
    return `/website/${this.websiteId}${path}`;
  }

  /** Conversations, newest first. dateStart/dateEnd are Date objects (optional). */
  async listConversations({ page = 1, dateStart, dateEnd } = {}) {
    return this.request(this.w(`/conversations/${page}`), {
      filter_date_start: dateStart?.toISOString(),
      filter_date_end: dateEnd?.toISOString(),
    });
  }

  async getConversation(sessionId) {
    return this.request(this.w(`/conversation/${sessionId}`));
  }

  /** All messages of a conversation, oldest first (walks back with timestamp_before). */
  async getAllMessages(sessionId, maxBatches = 20) {
    let all = [];
    let before;
    for (let i = 0; i < maxBatches; i++) {
      const batch = await this.request(this.w(`/conversation/${sessionId}/messages`), {
        timestamp_before: before,
      });
      if (!Array.isArray(batch) || batch.length === 0) break;
      all = batch.concat(all);
      const oldest = Math.min(...batch.map((m) => m.timestamp));
      if (before !== undefined && oldest >= before) break;
      before = oldest;
      if (batch.length < 20) break;
    }
    const seen = new Set();
    return all
      .filter((m) => (seen.has(m.fingerprint) ? false : seen.add(m.fingerprint)))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  async listOperators() {
    return this.request(this.w(`/operators/list`));
  }

  /** User ratings (stars 1-5 + optional comment) left at the end of conversations. */
  async listRatings({ page = 1, dateStart, dateEnd } = {}) {
    return this.request(this.w(`/rating/sessions/list/${page}`), {
      filter_date_start: dateStart?.toISOString(),
      filter_date_end: dateEnd?.toISOString(),
    });
  }

  async listHelpdeskArticles(locale, page = 1) {
    return this.request(this.w(`/helpdesk/locale/${locale}/articles/${page}`));
  }

  async getHelpdeskArticle(locale, articleId) {
    return this.request(this.w(`/helpdesk/locale/${locale}/article/${articleId}`));
  }
}

/** Fetch every published KB article title/description/url for a locale. */
export async function fetchKnowledgeBase(crisp, locale, maxPages = 30) {
  const articles = [];
  for (let page = 1; page <= maxPages; page++) {
    const batch = await crisp.listHelpdeskArticles(locale, page).catch(() => []);
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const a of batch) {
      if (a.status && a.status !== "published") continue;
      articles.push({
        id: a.article_id,
        title: a.title,
        description: a.description || "",
        url: a.url || "",
        category: a.category?.name || "",
      });
    }
  }
  return articles;
}

/** Ratings indexed by session_id. Tolerates workspaces/plans where the route is unavailable. */
export async function fetchRatings(crisp, { dateStart, dateEnd, maxPages = 30 } = {}) {
  const map = new Map();
  for (let page = 1; page <= maxPages; page++) {
    let batch;
    try {
      batch = await crisp.listRatings({ page, dateStart, dateEnd });
    } catch (err) {
      console.warn(`[crisp] ratings unavailable: ${err.message}`);
      break;
    }
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const r of batch) {
      const sid = r.session_id;
      const stars = r.stars ?? r.rating?.stars;
      if (!sid || stars == null) continue;
      map.set(sid, { stars, comment: r.comment ?? r.rating?.comment ?? "", at: r.created_at ?? r.updated_at });
    }
  }
  return map;
}

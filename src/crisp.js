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

  /** One page of a Helpdesk content tree directory (type: articles|guides|references|news). */
  async listHelpdeskTree(locale, type, { page = 1, subPath } = {}) {
    return this.request(this.w(`/helpdesk/tree/list/${locale}/${type}/${page}`), { sub_path: subPath });
  }
}

/**
 * Fetch every published article in a Helpdesk locale by recursively walking the content tree
 * (Crisp's REST API has no flat "list articles" route - articles live in a folder tree:
 * GET /helpdesk/tree/list/{locale}/{type}/{page}?sub_path=... returns {type:"file"|"directory", slug, title, state}).
 */
export async function fetchKnowledgeBase(crisp, locale, { type = "articles", maxArticles = 5000, maxDirs = 500 } = {}) {
  const articles = [];
  const base = `https://knowledgebase.xtenav.com/${locale}`;
  let dirsVisited = 0;

  async function walk(subPath, categoryTitle) {
    if (dirsVisited++ > maxDirs || articles.length > maxArticles) return;
    for (let page = 1; page <= 50; page++) {
      const batch = await crisp.listHelpdeskTree(locale, type, { page, subPath }).catch(() => []);
      if (!Array.isArray(batch) || batch.length === 0) break;
      for (const entry of batch) {
        const fullPath = subPath ? `${subPath}/${entry.slug}` : entry.slug;
        if (entry.type === "directory") {
          await walk(fullPath, categoryTitle || entry.title);
        } else if (entry.type === "file" && entry.state?.published && !entry.state?.hidden) {
          articles.push({
            title: entry.title,
            description: "",
            url: `${base}/${fullPath.replace(/\.md$/, "")}`,
            category: categoryTitle || "",
          });
        }
      }
      if (batch.length < 100) break;
    }
  }

  await walk(undefined, "");
  return articles;
}

/**
 * Crisp's REST API v1 does not expose per-conversation CSAT/star ratings (only Helpdesk
 * article-helpfulness feedback exists: /helpdesk/feedback/*). There is no route to call here;
 * this always returns an empty map so the dashboard runs without the "user rating" fields.
 */
export async function fetchRatings() {
  return new Map();
}

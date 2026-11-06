# Crisp Agent Review Dashboard

Pulls your support chats from **Crisp**, has **Claude** review each one the way a QA manager would, and shows the results in a dashboard.

## What it shows

| Tab | Contents |
|---|---|
| **Overview** | Chats reviewed, overall score, % users satisfied, % queries resolved, % knowledge transferred, average user star rating, negative ratings, chats needing manager review, missed KB articles, team scores, top query topics |
| **Agents** | Per-agent scorecard, each out of 10: Overall, Response, User satisfaction, Communication, Product knowledge, Query understanding, Guidance, Instructions, KB article usage — plus satisfied %, resolved %, average user rating (out of 5) and number of negative ratings |
| **Manager review** | Every chat where the user was not satisfied, the query was not handled, knowledge was not transferred, or a relevant KB article existed but was not shared. Each one shows **the rating the manager should give** and **the reply the agent should have sent** |
| **Negative ratings** | Each 1–2★ rating users left, grouped by agent, with the user's comment, the query and the AI verdict |
| **All conversations** | Searchable list of every reviewed chat; click to see full scores, strengths, issues, KB articles and transcript |
| **Suggested articles** | Questions that no existing KB article answers: the user's question, a short paragraph on **what the user actually wants**, and a suggested title, grouped and counted, so the docs team can write them |

## How it works

1. `Sync from Crisp` (or `npm run sync`) lists conversations from the chosen period via the Crisp REST API, loads your published knowledge-base articles and user ratings.
2. For each new or changed conversation it fetches the full transcript, finds the human agent, and sends the transcript + KB article list + user rating to Claude with a structured-output schema.
3. Results are cached in `data/reviews.json`; unchanged chats are never re-analysed. Chats with no human agent reply or no user message are skipped.

## Setup

```bash
npm install
cp .env.example .env     # fill in Crisp + Anthropic credentials
npm start                # http://localhost:3000
```

Preview with sample (fictional) data, no credentials needed:

```bash
npm run demo
```

### Crisp credentials
Create a plugin in the [Crisp Marketplace](https://marketplace.crisp.chat/), generate a **production token** (identifier + key) with read scopes for conversations, messages, operators, helpdesk and ratings, and install the plugin on your website. Put the token and your website ID in `.env`.

### Scheduled sync
Set `SYNC_INTERVAL_MINUTES` to sync automatically while the server runs, or call `npm run sync -- --days 1` from cron. Use `--reanalyze` to re-review chats already in the cache.

## Notes
- Ratings come from Crisp's rating sessions endpoint; if your plan doesn't expose it the dashboard still works, just without user stars.
- Set `DASHBOARD_PASSWORD` before exposing the dashboard: it shows customer chat content.
- Cost: one Claude request per chat. The KB list is prompt-cached across a sync.

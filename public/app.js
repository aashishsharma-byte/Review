const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const LABELS = {
  overall: "Overall",
  response: "Response",
  user_satisfaction: "User satisfaction",
  communication: "Communication",
  knowledge: "Product knowledge",
  query_understanding: "Query understanding",
  guidance: "Guidance",
  instructions: "Instructions",
  kb_usage: "KB article usage",
};
const PALETTE = ["#3669d9", "#5c86e8", "#8aa9ef", "#16a34a", "#d97706", "#dc2626", "#9333ea", "#0891b2", "#be185d", "#65a30d", "#737373", "#111013"];

let data = null;
let sort = { key: "overall", dir: "desc" };
let selectedAgentIds = null; // null = all

const cls = (v) => (v == null ? "" : v >= 8 ? "s-good" : v >= 5 ? "s-warn" : "s-bad");
const sc = (v) => `<span class="score ${cls(v)}">${v ?? "–"}</span>`;
const stars = (n) => (n == null ? '<span class="muted">–</span>' : `<span class="stars" title="${n}/5">${"★".repeat(n)}${"☆".repeat(5 - n)}</span>`);
const when = (t) => (t ? new Date(t).toLocaleString() : "");
const dateOnly = (t) => (t ? new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "–");
const yesNo = (b, yes = "Yes", no = "No") => `<span class="tag ${b ? "s-good" : "s-bad"}">${b ? yes : no}</span>`;
const pct = (v) => (v == null ? "–" : `${v}%`);
const initials = (name) => (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
const avatarColor = (name) => PALETTE[[...String(name)].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];

function bars(scores) {
  return Object.keys(LABELS)
    .map((k) => `<div class="bar-row"><span>${LABELS[k]}</span><div class="bar"><span style="width:${(scores[k] ?? 0) * 10}%"></span></div><span class="n">${scores[k] ?? "–"}</span></div>`)
    .join("");
}

// ---------------- Date range state ----------------
const fmt = (d) => d.toISOString().slice(0, 10);
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

function periodRange(period) {
  const now = new Date();
  switch (period) {
    case "today": return { from: fmt(startOfDay(now)), to: fmt(now) };
    case "7": return { from: fmt(new Date(now - 7 * 86400_000)), to: fmt(now) };
    case "30": return { from: fmt(new Date(now - 30 * 86400_000)), to: fmt(now) };
    case "week": { const d = startOfDay(now); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return { from: fmt(d), to: fmt(now) }; }
    case "month": return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: fmt(now) };
    case "quarter": return { from: fmt(new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)), to: fmt(now) };
    case "year": return { from: fmt(new Date(now.getFullYear(), 0, 1)), to: fmt(now) };
    default: return { from: "", to: "" };
  }
}

let range = periodRange("30");

function setPeriod(period) {
  document.querySelectorAll("#period-chips .chip").forEach((b) => b.classList.toggle("active", b.dataset.period === period));
  $("#daterange").classList.toggle("show", period === "custom");
  if (period !== "custom") {
    range = periodRange(period);
    load();
  }
}

document.querySelectorAll("#period-chips .chip").forEach((b) => b.addEventListener("click", () => setPeriod(b.dataset.period)));
$("#apply-range").addEventListener("click", () => {
  range = { from: $("#d-from").value, to: $("#d-to").value };
  load();
});

// ---------------- Agent filter ----------------
function agentQueryParam() {
  if (selectedAgentIds === null) return "";
  if (selectedAgentIds.size === 0) return "__none__";
  return [...selectedAgentIds].join(",");
}

function renderAgentMenu() {
  const all = data?.allAgents || [];
  $("#agent-checks").innerHTML = all
    .map((a) => `<label><input type="checkbox" data-agent="${esc(a.id)}" ${selectedAgentIds === null || selectedAgentIds.has(a.id) ? "checked" : ""}/> ${esc(a.name)}</label>`)
    .join("") || '<p class="muted" style="padding:6px 8px">No agents yet</p>';
  const label = selectedAgentIds === null ? "All" : selectedAgentIds.size === 0 ? "None" : selectedAgentIds.size === 1 ? all.find((a) => selectedAgentIds.has(a.id))?.name || "1" : `${selectedAgentIds.size} selected`;
  $("#agent-label").textContent = label;
  $("#agent-checks").querySelectorAll("input[type=checkbox]").forEach((cb) =>
    cb.addEventListener("change", () => {
      const all2 = data.allAgents.map((a) => a.id);
      let set = selectedAgentIds === null ? new Set(all2) : new Set(selectedAgentIds);
      if (cb.checked) set.add(cb.dataset.agent); else set.delete(cb.dataset.agent);
      selectedAgentIds = set.size === all2.length ? null : set;
      renderAgentMenu();
      load();
    })
  );
}
$("#agent-btn").addEventListener("click", (e) => { e.stopPropagation(); $("#agent-menu").classList.toggle("open"); });
document.addEventListener("click", (e) => { if (!e.target.closest(".agentfilter")) $("#agent-menu").classList.remove("open"); });
$("#agent-all").addEventListener("click", () => { selectedAgentIds = null; renderAgentMenu(); load(); });
$("#agent-none").addEventListener("click", () => { selectedAgentIds = new Set(); renderAgentMenu(); load(); });

// ---------------- Data load ----------------
async function load() {
  const p = new URLSearchParams();
  if (range.from) p.set("from", range.from);
  if (range.to) p.set("to", range.to);
  const agentsParam = agentQueryParam();
  if (agentsParam) p.set("agents", agentsParam);
  const res = await fetch(`/api/dashboard?${p}`);
  data = await res.json();
  renderAgentMenu();
  render();
}

// ---------------- Charts ----------------
function trendChart(trend) {
  if (!trend.length) return '<p class="empty">No data in this period.</p>';
  const W = 760, H = 220, padL = 34, padR = 10, padT = 14, padB = 28;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const maxChats = Math.max(1, ...trend.map((d) => d.chats));
  const n = trend.length;
  const x = (i) => padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const barW = Math.max(2, Math.min(28, (innerW / n) * 0.55));
  const yBar = (v) => padT + innerH - (v / maxChats) * innerH;
  const yScore = (v) => padT + innerH - ((v ?? 0) / 10) * innerH;
  const step = Math.max(1, Math.ceil(n / 10));

  const bars = trend
    .map((d, i) => `<rect class="tooltip-dot" x="${x(i) - barW / 2}" y="${yBar(d.chats)}" width="${barW}" height="${Math.max(1, innerH - (yBar(d.chats) - padT))}" rx="3" fill="var(--brand-light)" opacity="${d.flagged ? 0.9 : 0.55}"><title>${d.date}: ${d.chats} chats, avg ${d.overall ?? "–"}/10${d.flagged ? `, ${d.flagged} flagged` : ""}</title></rect>`)
    .join("");
  const line = trend.map((d, i) => `${x(i)},${yScore(d.overall)}`).join(" ");
  const dots = trend
    .map((d, i) => `<circle class="tooltip-dot" cx="${x(i)}" cy="${yScore(d.overall)}" r="3.5" fill="var(--brand-dark)"><title>${d.date}: avg score ${d.overall ?? "–"}/10</title></circle>`)
    .join("");
  const xlabels = trend
    .map((d, i) => (i % step === 0 || i === n - 1 ? `<text x="${x(i)}" y="${H - 8}" font-size="10" fill="var(--muted)" text-anchor="middle">${d.date.slice(5)}</text>` : ""))
    .join("");
  const ylabels = [0, 5, 10]
    .map((v) => `<text x="${padL - 8}" y="${yScore(v) + 3}" font-size="10" fill="var(--muted)" text-anchor="end">${v}</text><line x1="${padL}" x2="${W - padR}" y1="${yScore(v)}" y2="${yScore(v)}" stroke="var(--border)" stroke-dasharray="2,3"/>`)
    .join("");

  return `<svg viewBox="0 0 ${W} ${H}">${ylabels}${bars}<polyline points="${line}" fill="none" stroke="var(--brand-dark)" stroke-width="2.5"/>${dots}${xlabels}</svg>
    <div class="chart-legend"><span><span class="dot" style="background:var(--brand-light)"></span>Chats per day</span><span><span class="dot" style="background:var(--brand-dark)"></span>Avg overall score (0–10)</span></div>`;
}

function donutChart(categories) {
  if (!categories.length) return '<p class="empty">No data in this period.</p>';
  const total = categories.reduce((a, [, n]) => a + n, 0);
  const cx = 90, cy = 90, r = 70, rInner = 42;
  let angle = -Math.PI / 2;
  const toXY = (a, radius) => [cx + radius * Math.cos(a), cy + radius * Math.sin(a)];
  const slices = categories
    .map(([name, n], i) => {
      const frac = n / total;
      const a0 = angle;
      const a1 = angle + frac * Math.PI * 2;
      angle = a1;
      const large = frac > 0.5 ? 1 : 0;
      const [x0, y0] = toXY(a0, r), [x1, y1] = toXY(a1, r);
      const [ix1, iy1] = toXY(a1, rInner), [ix0, iy0] = toXY(a0, rInner);
      const d = `M${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} L${ix1},${iy1} A${rInner},${rInner} 0 ${large} 0 ${ix0},${iy0} Z`;
      return `<path class="tooltip-dot" d="${d}" fill="${PALETTE[i % PALETTE.length]}"><title>${name}: ${n} (${Math.round(frac * 100)}%)</title></path>`;
    })
    .join("");
  const legend = categories
    .map(([name, n], i) => `<span><span class="dot" style="background:${PALETTE[i % PALETTE.length]}"></span>${esc(name)} (${n})</span>`)
    .join("");
  return `<div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap"><svg viewBox="0 0 180 180" style="width:180px;flex-shrink:0">${slices}<text x="90" y="85" text-anchor="middle" font-size="20" font-weight="700" fill="var(--text)">${total}</text><text x="90" y="102" text-anchor="middle" font-size="10" fill="var(--muted)">chats</text></svg><div class="chart-legend" style="flex-direction:column;gap:6px">${legend}</div></div>`;
}

// ---------------- Leaderboards ----------------
function lbRow(i, name, meta, count) {
  return `<div class="lb-row"><div class="rank">${i + 1}</div><div><div class="name">${esc(name)}</div><div class="meta">${meta}</div></div><div class="count">${count}</div></div>`;
}
function renderLeaderboard(el, rows, build) {
  $(el).innerHTML = rows.length ? rows.map((a, i) => build(a, i)).join("") : '<p class="empty">Nothing to show 🎉</p>';
}

// ---------------- Render ----------------
function render() {
  const s = data.summary;
  $("#sync-info").innerHTML = `Last sync: <b>${data.lastSync ? when(data.lastSync) : "never"}</b> · <b>${data.knowledgeBaseSize}</b> KB articles indexed${data.demo ? " · <b>DEMO DATA</b>" : ""}`;

  $("#kpis").innerHTML = [
    ["info", "💬", s.reviewed, "Chats reviewed"],
    ["info", "⭐", s.scores.overall != null ? `${s.scores.overall}/10` : "–", "Overall score"],
    ["good", "🙂", pct(s.satisfiedPct), "User satisfied"],
    ["info", "✅", pct(s.resolvedPct), "Query resolved"],
    ["info", "🎓", pct(s.knowledgeTransferredPct), "Knowledge transferred"],
    ["warn", "📚", s.missedKb, "Missed KB article"],
    ["bad", "😟", s.negativeOutcomes, "Negative / unsatisfied"],
    ["bad", "🚩", s.needsReview, "Need manager review"],
  ]
    .map(([tone, icon, v, l]) => `<div class="kpi ${tone}"><span class="icon">${icon}</span><div class="v">${esc(v)}</div><div class="l">${l}</div></div>`)
    .join("");

  $("#trend-chart").innerHTML = trendChart(data.trend);
  $("#category-chart").innerHTML = donutChart(data.categories);

  renderLeaderboard("#lb-flagged", data.leaderboards.mostFlagged, (a, i) =>
    lbRow(i, a.name, `last flagged ${dateOnly(a.lastFlaggedAt)}`, a.needsReview)
  );
  renderLeaderboard("#lb-negative", data.leaderboards.mostNegative, (a, i) =>
    lbRow(i, a.name, `${a.negativeRatings ? `${a.negativeRatings} low star rating(s), ` : ""}of ${a.chats} chats`, a.negativeOutcomes)
  );
  renderLeaderboard("#lb-lowest", data.leaderboards.lowestScoring, (a, i) =>
    lbRow(i, a.name, a.worstChat ? `worst: ${dateOnly(a.worstChat.updatedAt)} · "${esc((a.worstChat.query || "").slice(0, 44))}"` : "", `${a.scores.overall ?? "–"}/10`)
  );

  $("#team-scores").innerHTML = s.reviewed ? bars(s.scores) : '<p class="empty">No reviewed chats yet. Click "Sync from Crisp".</p>';

  renderAgentsTable();

  // Manager review queue
  const review = data.conversations.filter((c) => c.needsReview);
  $("#count-review").textContent = review.length || "";
  $("#review-list").innerHTML = review.length ? review.map(convItem).join("") : '<p class="empty">Nothing needs review 🎉</p>';

  // Negative / unsatisfied grouped by agent
  $("#count-negative").textContent = data.negativeRatings.length || "";
  const byAgent = {};
  for (const n of data.negativeRatings) (byAgent[n.agent.name] ??= []).push(n);
  $("#negative-list").innerHTML = Object.keys(byAgent).length
    ? Object.entries(byAgent)
        .sort((a, b) => b[1].length - a[1].length)
        .map(
          ([name, list]) =>
            `<div class="agent-group"><h2><span class="avatar" style="background:${avatarColor(name)}">${initials(name)}</span>${esc(name)} <span class="muted">— ${list.length} case${list.length > 1 ? "s" : ""}</span></h2><div class="list">${list
              .map(
                (n) => `<div class="item"><div class="item-head"><span>${n.stars != null ? `${stars(n.stars)} <strong>${n.stars}/5</strong> from ${esc(n.user.name)}` : `Unsatisfied — ${esc(n.user.name)} <span class="muted">(no star rating from Crisp)</span>`}</span><span class="muted">${when(n.updatedAt)}</span></div>
              ${n.comment ? `<p>User comment: “${esc(n.comment)}”</p>` : ""}
              <p><strong>Query:</strong> ${esc(n.query)}</p>
              <p>AI overall: ${sc(n.aiOverall)} · Manager-recommended rating: ${sc(n.recommendedRating)} · ${esc(n.verdict)}</p>
              <button data-open="${esc(n.sessionId)}">Open review</button></div>`
              )
              .join("")}</div></div>`
        )
        .join("")
    : '<p class="empty">No negative or unsatisfied chats in this period.</p>';

  renderConvTable();

  // Suggested articles
  $("#count-articles").textContent = data.suggestedArticles.length || "";
  $("#articles-list").innerHTML = data.suggestedArticles.length
    ? data.suggestedArticles
        .map(
          (a) => `<div class="item"><div class="item-head"><h2>${esc(a.title)}</h2><span class="muted">${esc(a.category)} · asked ${a.sessions.length}×</span></div>
          <h3>User question${a.questions.length > 1 ? "s" : ""}</h3><ul>${[...new Set(a.questions)].map((q) => `<li>${esc(q)}</li>`).join("")}</ul>
          <h3>What the user actually wants</h3><p>${esc(a.whatUserWants)}</p>
          <p class="muted">From: ${a.sessions.map((s) => `<a href="#" data-open="${esc(s.sessionId)}">${esc(s.user)}</a>`).join(", ")}</p></div>`
        )
        .join("")
    : '<p class="empty">No missing articles detected.</p>';
}

const AGENT_COLS = [
  { key: "name", label: "Agent" },
  { key: "chats", label: "Chats", num: true },
  ...Object.keys(LABELS).map((k) => ({ key: `scores.${k}`, label: LABELS[k], num: true })),
  { key: "satisfiedPct", label: "Satisfied", num: true },
  { key: "resolvedPct", label: "Resolved", num: true },
  { key: "userStarsAvg", label: "User rating", num: true },
  { key: "negativeOutcomes", label: "Negative", num: true },
  { key: "needsReview", label: "Need review", num: true },
  { key: "missedKb", label: "Missed KB", num: true },
];
const getPath = (o, path) => path.split(".").reduce((x, k) => x?.[k], o);

function renderAgentsTable() {
  const rows = [...data.agents].sort((a, b) => {
    const va = getPath(a, sort.key), vb = getPath(b, sort.key);
    if (typeof va === "string") return sort.dir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    return sort.dir === "asc" ? (va ?? -1) - (vb ?? -1) : (vb ?? -1) - (va ?? -1);
  });
  $("#agents-table").innerHTML =
    `<thead><tr>${AGENT_COLS.map((c) => `<th class="${c.num ? "num" : ""}" data-sort="${c.key}">${c.label}${sort.key === c.key ? `<span class="arrow">${sort.dir === "asc" ? "▲" : "▼"}</span>` : ""}</th>`).join("")}</tr></thead><tbody>` +
    (rows.length
      ? rows
          .map(
            (a) =>
              `<tr class="click" data-agent="${esc(a.id)}"><td><div class="agent-cell"><span class="avatar" style="background:${avatarColor(a.name)}">${initials(a.name)}</span><strong>${esc(a.name)}</strong></div></td><td class="num">${a.chats}</td>${Object.keys(LABELS)
                .map((k) => `<td class="num">${sc(a.scores[k])}</td>`)
                .join("")}<td class="num">${pct(a.satisfiedPct)}</td><td class="num">${pct(a.resolvedPct)}</td><td class="num">${a.userStarsAvg != null ? `${a.userStarsAvg}/5 <span class="muted">(${a.ratedChats})</span>` : '<span class="muted">–</span>'}</td><td class="num">${a.negativeOutcomes ? `<span class="score s-bad">${a.negativeOutcomes}</span>` : 0}</td><td class="num">${a.needsReview || 0}</td><td class="num">${a.missedKb}</td></tr>`
          )
          .join("")
      : `<tr><td colspan="${AGENT_COLS.length}" class="empty">No agents in this period.</td></tr>`) +
    "</tbody>";
  document.querySelectorAll("#agents-table th[data-sort]").forEach((th) =>
    th.addEventListener("click", () => {
      if (sort.key === th.dataset.sort) sort.dir = sort.dir === "asc" ? "desc" : "asc";
      else sort = { key: th.dataset.sort, dir: "desc" };
      renderAgentsTable();
    })
  );
  document.querySelectorAll("#agents-table tr[data-agent]").forEach((tr) =>
    tr.addEventListener("click", () => {
      selectedAgentIds = new Set([tr.dataset.agent]);
      renderAgentMenu();
      load().then(() => showTab("review"));
    })
  );
}

function convItem(c) {
  const flags = [!c.satisfied && "Not satisfied", !c.resolved && "Not resolved", c.missedKb && "Missed KB article", c.userRating && c.userRating.stars <= 2 && `User gave ${c.userRating.stars}★`].filter(Boolean);
  return `<div class="item"><div class="item-head"><span><span class="avatar" style="background:${avatarColor(c.agent.name)}">${initials(c.agent.name)}</span> <strong>${esc(c.agent.name)}</strong> ↔ ${esc(c.user.name)} · ${sc(c.overall)}</span><span class="muted">${when(c.updatedAt)}</span></div>
    <p><strong>${esc(c.query)}</strong> <span class="muted">· ${esc(c.category)}</span></p>
    <p>${flags.map((f) => `<span class="tag s-bad">${esc(f)}</span>`).join("")}</p>
    <p class="muted">${esc(c.summary)}</p>
    <button data-open="${esc(c.sessionId)}">Open manager review</button></div>`;
}

function renderConvTable() {
  const q = $("#search").value.toLowerCase();
  const rows = data.conversations.filter((c) => !q || [c.user.name, c.agent.name, c.query, c.category].join(" ").toLowerCase().includes(q));
  $("#conv-table").innerHTML =
    `<thead><tr><th>When</th><th>Agent</th><th>User</th><th>Query</th><th class="num">AI score</th><th>User rating</th><th>Satisfied</th><th>Resolved</th></tr></thead><tbody>` +
    (rows.length
      ? rows
          .map(
            (c) => `<tr class="click" data-open="${esc(c.sessionId)}"><td>${when(c.updatedAt)}</td><td><div class="agent-cell"><span class="avatar" style="background:${avatarColor(c.agent.name)}">${initials(c.agent.name)}</span>${esc(c.agent.name)}</div></td><td>${esc(c.user.name)}</td><td>${esc(c.query)}<br><span class="muted">${esc(c.category)}</span></td><td class="num">${sc(c.overall)}</td><td>${stars(c.userRating?.stars)}</td><td>${yesNo(c.satisfied)}</td><td>${yesNo(c.resolved)}</td></tr>`
          )
          .join("")
      : `<tr><td colspan="8" class="empty">No conversations match.</td></tr>`) +
    "</tbody>";
}

async function openDetail(sid) {
  const c = await (await fetch(`/api/conversations/${encodeURIComponent(sid)}`)).json();
  const a = c.analysis;
  const m = a.manager_review;
  $("#d-title").textContent = `${c.agent?.name ?? "Agent"} ↔ ${c.user.name}`;
  $("#d-body").innerHTML = `
    <p class="muted">${when(c.updatedAt)} · ${esc(a.query_category)} · ${esc(a.language)} ${c.crispUrl && c.crispUrl !== "#" ? `· <a href="${esc(c.crispUrl)}" target="_blank" rel="noopener">Open in Crisp</a>` : ""}</p>
    <p><strong>User query:</strong> ${esc(a.user_query)}</p>
    <p>${esc(a.summary)}</p>
    <p>User rating: ${c.userRating ? `${stars(c.userRating.stars)} ${c.userRating.stars}/5 ${c.userRating.comment ? `— “${esc(c.userRating.comment)}”` : ""}` : '<span class="muted">not provided by Crisp</span>'}</p>
    <p>Satisfied ${yesNo(a.user_satisfied)} Resolved ${yesNo(a.query_resolved)} Knowledge transferred ${yesNo(a.knowledge_transferred)} KB article shared ${yesNo(a.kb.agent_shared_article)}</p>
    <p class="muted">Satisfaction evidence: ${esc(a.satisfaction_evidence)}</p>
    <div class="grid2">
      <div><h3>Scores (out of 10)</h3>${bars(a.scores)}</div>
      <div>
        ${a.strengths.length ? `<h3>Strengths</h3><ul>${a.strengths.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
        ${a.issues.length ? `<h3>Issues</h3><ul>${a.issues.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
        <h3>Relevant KB articles</h3>
        ${a.kb.relevant_articles.length ? `<ul>${a.kb.relevant_articles.map((k) => `<li><a href="${esc(k.url)}" target="_blank" rel="noopener">${esc(k.title)}</a></li>`).join("")}</ul>` : '<p class="muted">None in the knowledge base.</p>'}
        ${a.kb.missed_article ? '<p><span class="tag s-bad">Agent did not share the relevant article</span></p>' : ""}
      </div>
    </div>
    <h3>Manager review</h3>
    <p>Recommended rating: ${sc(m.recommended_rating)} <strong>${esc(m.verdict)}</strong></p>
    ${m.what_went_wrong ? `<div class="wrong"><strong>What should have been done:</strong> ${esc(m.what_went_wrong)}</div>` : ""}
    ${m.ideal_reply ? `<h3>Reply the agent should have sent</h3><div class="ideal">${esc(m.ideal_reply)}</div>` : ""}
    ${a.suggested_article?.needed ? `<h3>Suggested new KB article</h3><p><strong>${esc(a.suggested_article.suggested_title)}</strong></p><p>${esc(a.suggested_article.what_user_wants)}</p>` : ""}
    <h3>Transcript</h3><pre class="transcript">${esc(c.transcript)}</pre>`;
  $("#detail").showModal();
}

function showTab(name) {
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.id === `tab-${name}`));
}

document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-open]");
  if (el) {
    e.preventDefault();
    openDetail(el.dataset.open);
  }
});
$("#d-close").addEventListener("click", () => $("#detail").close());
$("#search").addEventListener("input", renderConvTable);

$("#btn-sync").addEventListener("click", async () => {
  const days = range.from ? Math.max(1, Math.ceil((Date.now() - new Date(range.from).getTime()) / 86400_000)) : 90;
  const res = await fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ days }) });
  const body = await res.json();
  if (!res.ok) return banner(body.error);
  pollSync();
});

function banner(msg) {
  const b = $("#banner");
  b.hidden = !msg;
  b.textContent = msg || "";
}

async function pollSync() {
  const btn = $("#btn-sync");
  btn.disabled = true;
  const st = await (await fetch("/api/sync/status")).json();
  banner(`${st.message} ${st.total ? `(${st.done}/${st.total})` : ""}`);
  if (st.running) return setTimeout(pollSync, 2000);
  btn.disabled = false;
  await load();
}

load();
fetch("/api/sync/status").then((r) => r.json()).then((st) => st.running && pollSync());

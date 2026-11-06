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

let data = null;

const cls = (v) => (v == null ? "" : v >= 8 ? "s-good" : v >= 5 ? "s-warn" : "s-bad");
const sc = (v) => `<span class="score ${cls(v)}">${v ?? "–"}</span>`;
const stars = (n) => (n == null ? '<span class="muted">–</span>' : `<span class="stars" title="${n}/5">${"★".repeat(n)}${"☆".repeat(5 - n)}</span>`);
const when = (t) => (t ? new Date(t).toLocaleString() : "");
const yesNo = (b, yes = "Yes", no = "No") => `<span class="tag ${b ? "s-good" : "s-bad"}">${b ? yes : no}</span>`;
const pct = (v) => (v == null ? "–" : `${v}%`);

function bars(scores) {
  return Object.keys(LABELS)
    .map((k) => `<div class="bar-row"><span>${LABELS[k]}</span><div class="bar"><span style="width:${(scores[k] ?? 0) * 10}%"></span></div><span class="n">${scores[k] ?? "–"}</span></div>`)
    .join("");
}

async function load() {
  const p = new URLSearchParams();
  if ($("#f-days").value) p.set("days", $("#f-days").value);
  if ($("#f-agent").value) p.set("agent", $("#f-agent").value);
  const res = await fetch(`/api/dashboard?${p}`);
  data = await res.json();
  render();
}

function render() {
  const s = data.summary;
  $("#sync-info").textContent = `${data.demo ? "DEMO DATA · " : ""}Last sync: ${data.lastSync ? when(data.lastSync) : "never"} · ${data.knowledgeBaseSize} KB articles indexed`;

  const agentSel = $("#f-agent");
  const current = agentSel.value;
  agentSel.innerHTML = '<option value="">All agents</option>' + data.agents.map((a) => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join("");
  agentSel.value = current;

  $("#kpis").innerHTML = [
    ["Chats reviewed", s.reviewed],
    ["Overall score", s.scores.overall != null ? `${s.scores.overall}/10` : "–"],
    ["User satisfied", pct(s.satisfiedPct)],
    ["Query resolved", pct(s.resolvedPct)],
    ["Knowledge transferred", pct(s.knowledgeTransferredPct)],
    ["Avg user rating", s.userStarsAvg != null ? `${s.userStarsAvg}/5` : "–"],
    ["Negative ratings", s.negativeRatings],
    ["Need manager review", s.needsReview],
    ["Missed KB article", s.missedKb],
  ]
    .map(([l, v]) => `<div class="kpi"><div class="v">${esc(v)}</div><div class="l">${l}</div></div>`)
    .join("");

  $("#team-scores").innerHTML = s.reviewed ? bars(s.scores) : '<p class="muted">No reviewed chats yet. Click “Sync from Crisp”.</p>';
  const maxCat = Math.max(1, ...data.categories.map((c) => c[1]));
  $("#categories").innerHTML = data.categories.length
    ? data.categories.map(([c, n]) => `<div class="bar-row"><span>${esc(c)}</span><div class="bar"><span style="width:${(n / maxCat) * 100}%"></span></div><span class="n">${n}</span></div>`).join("")
    : '<p class="muted">–</p>';

  // Agents
  const cols = ["overall", "response", "user_satisfaction", "communication", "knowledge", "query_understanding", "guidance", "instructions", "kb_usage"];
  $("#agents-table").innerHTML =
    `<thead><tr><th>Agent</th><th class="num">Chats</th>${cols.map((c) => `<th class="num">${LABELS[c]}</th>`).join("")}<th class="num">Satisfied</th><th class="num">Resolved</th><th>User rating</th><th class="num">Negative</th><th class="num">Need review</th><th class="num">Missed KB</th></tr></thead><tbody>` +
    data.agents
      .map(
        (a) =>
          `<tr class="click" data-agent="${esc(a.id)}"><td><strong>${esc(a.name)}</strong></td><td class="num">${a.chats}</td>${cols.map((c) => `<td class="num">${sc(a.scores[c])}</td>`).join("")}<td class="num">${pct(a.satisfiedPct)}</td><td class="num">${pct(a.resolvedPct)}</td><td>${a.userStarsAvg != null ? `${a.userStarsAvg}/5 <span class="muted">(${a.ratedChats})</span>` : '<span class="muted">–</span>'}</td><td class="num">${a.negativeRatings ? `<span class="score s-bad">${a.negativeRatings}</span>` : 0}</td><td class="num">${a.needsReview}</td><td class="num">${a.missedKb}</td></tr>`
      )
      .join("") +
    "</tbody>";
  document.querySelectorAll("#agents-table tr[data-agent]").forEach((tr) =>
    tr.addEventListener("click", () => {
      $("#f-agent").value = tr.dataset.agent;
      load().then(() => showTab("review"));
    })
  );

  // Manager review queue
  const review = data.conversations.filter((c) => c.needsReview);
  $("#count-review").textContent = review.length || "";
  $("#review-list").innerHTML = review.length
    ? review.map(convItem).join("")
    : '<p class="muted">Nothing needs review 🎉</p>';

  // Negative ratings grouped by agent
  $("#count-negative").textContent = data.negativeRatings.length || "";
  const byAgent = {};
  for (const n of data.negativeRatings) (byAgent[n.agent.name] ??= []).push(n);
  $("#negative-list").innerHTML = Object.keys(byAgent).length
    ? Object.entries(byAgent)
        .map(
          ([name, list]) =>
            `<div class="agent-group"><h2>${esc(name)} <span class="muted">— ${list.length} negative rating${list.length > 1 ? "s" : ""}</span></h2><div class="list">${list
              .map(
                (n) => `<div class="item"><div class="item-head"><span>${stars(n.stars)} <strong>${n.stars}/5</strong> from ${esc(n.user.name)}</span><span class="muted">${when(n.updatedAt)}</span></div>
              ${n.comment ? `<p>User comment: “${esc(n.comment)}”</p>` : ""}
              <p><strong>Query:</strong> ${esc(n.query)}</p>
              <p>AI overall: ${sc(n.aiOverall)} · Manager-recommended rating: ${sc(n.recommendedRating)} · ${esc(n.verdict)}</p>
              <button data-open="${esc(n.sessionId)}">Open review</button></div>`
              )
              .join("")}</div></div>`
        )
        .join("")
    : '<p class="muted">No negative user ratings in this period.</p>';

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
    : '<p class="muted">No missing articles detected.</p>';
}

function convItem(c) {
  const flags = [!c.satisfied && "Not satisfied", !c.resolved && "Not resolved", c.missedKb && "Missed KB article", c.userRating && c.userRating.stars <= 2 && `User gave ${c.userRating.stars}★`].filter(Boolean);
  return `<div class="item"><div class="item-head"><span><strong>${esc(c.agent.name)}</strong> ↔ ${esc(c.user.name)} · ${sc(c.overall)}</span><span class="muted">${when(c.updatedAt)}</span></div>
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
    rows
      .map(
        (c) => `<tr class="click" data-open="${esc(c.sessionId)}"><td>${when(c.updatedAt)}</td><td>${esc(c.agent.name)}</td><td>${esc(c.user.name)}</td><td>${esc(c.query)}<br><span class="muted">${esc(c.category)}</span></td><td class="num">${sc(c.overall)}</td><td>${stars(c.userRating?.stars)}</td><td>${yesNo(c.satisfied)}</td><td>${yesNo(c.resolved)}</td></tr>`
      )
      .join("") +
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
    <p>User rating: ${c.userRating ? `${stars(c.userRating.stars)} ${c.userRating.stars}/5 ${c.userRating.comment ? `— “${esc(c.userRating.comment)}”` : ""}` : '<span class="muted">not given</span>'}</p>
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
$("#f-days").addEventListener("change", load);
$("#f-agent").addEventListener("change", load);
$("#search").addEventListener("input", renderConvTable);

$("#btn-sync").addEventListener("click", async () => {
  const days = $("#f-days").value || 30;
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

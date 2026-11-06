// Fictional sample data used when DEMO=1, so the dashboard can be previewed without credentials.
// None of these people or chats are real.

const H = 3600_000;
const now = Date.now();

const agents = {
  priya: { id: "op-priya", name: "Priya" },
  rahul: { id: "op-rahul", name: "Rahul" },
  sam: { id: "op-sam", name: "Sam" },
};

const kb = [
  { id: "a1", title: "How to create a floor plan design", description: "Start a new floor plan and place devices", url: "https://example.com/kb/floor-plan", category: "Design" },
  { id: "a2", title: "Connect QuickBooks integration", description: "Sync invoices with QuickBooks", url: "https://example.com/kb/quickbooks", category: "Integrations" },
  { id: "a3", title: "Customise proposal templates", description: "Edit sections, terms and branding of proposals", url: "https://example.com/kb/proposal-templates", category: "Proposals" },
  { id: "a4", title: "Import a price list into My Library", description: "Upload vendor pricing via CSV", url: "https://example.com/kb/price-list", category: "Library" },
];

function scores(o, r, s, c, k, q, g, i, kbu) {
  return { overall: o, response: r, user_satisfaction: s, communication: c, knowledge: k, query_understanding: q, guidance: g, instructions: i, kb_usage: kbu };
}

const noSuggestion = { needed: false, user_question: "", what_user_wants: "", suggested_title: "" };

const rows = [
  {
    sid: "demo-1", hoursAgo: 3, agent: agents.priya, user: "Alex Morgan", email: "alex.morgan@acme-av.com", respMin: 2, durMin: 6, rating: { stars: 5, comment: "Super quick, thanks!" },
    transcript: "USER: How do I connect QuickBooks?\nAGENT Priya: Go to Settings > Integrations > QuickBooks and click Connect. Here is the guide: https://example.com/kb/quickbooks\nUSER: Done, it works. Thanks!",
    a: {
      user_query: "How to connect the QuickBooks integration", query_category: "Integrations - QuickBooks",
      summary: "User wanted to link QuickBooks. Agent gave the exact navigation path and the KB article; user confirmed it worked.",
      scores: scores(9, 9, 10, 9, 9, 10, 9, 9, 10), user_satisfied: true, query_resolved: true, knowledge_transferred: true,
      satisfaction_evidence: "\"Done, it works. Thanks!\"",
      kb: { relevant_articles: [{ title: "Connect QuickBooks integration", url: "https://example.com/kb/quickbooks" }], agent_shared_article: true, missed_article: false },
      strengths: ["Precise navigation path", "Shared the right article"], issues: [], needs_manager_review: false,
      manager_review: { recommended_rating: 9, verdict: "Model answer.", what_went_wrong: "", ideal_reply: "" },
      suggested_article: noSuggestion,
    },
  },
  {
    sid: "demo-2", hoursAgo: 6, agent: agents.rahul, user: "Jordan Lee", email: "jordan.lee@brightview-systems.com", respMin: 14, durMin: 22, rating: { stars: 1, comment: "Didn't answer my question" },
    transcript: "USER: My proposal PDF cuts off the terms section, how do I fix it?\nAGENT Rahul: Please try again later.\nUSER: That doesn't help.\nAGENT Rahul: Is there anything else I can help you with?",
    a: {
      user_query: "Proposal PDF truncates the Terms & Conditions section", query_category: "Proposals - PDF export",
      summary: "User reported a PDF formatting issue. Agent gave no troubleshooting, no escalation and closed with a canned line.",
      scores: scores(2, 2, 1, 3, 2, 2, 1, 1, 2), user_satisfied: false, query_resolved: false, knowledge_transferred: false,
      satisfaction_evidence: "\"That doesn't help.\" and a 1-star rating",
      kb: { relevant_articles: [{ title: "Customise proposal templates", url: "https://example.com/kb/proposal-templates" }], agent_shared_article: false, missed_article: true },
      strengths: [], issues: ["Did not investigate or ask for a screenshot", "No escalation to the technical team", "Ignored the user's frustration", "Missed the proposal templates article"],
      needs_manager_review: true,
      manager_review: {
        recommended_rating: 2, verdict: "Query not handled; user left unhappy.",
        what_went_wrong: "Agent should have acknowledged the problem, asked which template and a screenshot, checked the Terms section length/format, shared the template article and escalated if it was a bug.",
        ideal_reply: "Sorry about that — let's fix it. Could you tell me which proposal template you're using and share a screenshot of the cut-off page? Meanwhile, long Terms sections can overflow if they're pasted with fixed formatting; open X-DOC > Templates > Terms, paste the text as plain text and re-export. Guide: https://example.com/kb/proposal-templates. If it still cuts off, I'll escalate to our technical team right away and update you here.",
      },
      suggested_article: { needed: true, user_question: "Why does my proposal PDF cut off the Terms & Conditions section?", what_user_wants: "The user wants their full Terms & Conditions to appear in the exported proposal PDF exactly as on screen. An article should explain page-break and formatting causes (pasted rich text, fixed heights), how to clean the text, and how to preview before export.", suggested_title: "Fix cut-off or misformatted Terms & Conditions in proposal PDFs" },
    },
  },
  {
    sid: "demo-3", hoursAgo: 12, agent: agents.sam, user: "Taylor Kim", email: "taylor.kim@kim-integrations.com", respMin: 4, durMin: 9, rating: null,
    transcript: "USER: Can I add speakers and see their coverage?\nAGENT Sam: Yes, use the Floor Plan feature, place speakers from the library and enable coverage view.\nUSER: ok where is coverage view\nAGENT Sam: In the right panel.",
    a: {
      user_query: "How to visualise speaker coverage on a floor plan", query_category: "Design - Floor Plan",
      summary: "Agent pointed to the right feature but instructions were vague and no article was shared.",
      scores: scores(6, 6, 5, 7, 7, 7, 5, 4, 3), user_satisfied: false, query_resolved: true, knowledge_transferred: false,
      satisfaction_evidence: "User had to ask a follow-up; no confirmation at the end.",
      kb: { relevant_articles: [{ title: "How to create a floor plan design", url: "https://example.com/kb/floor-plan" }], agent_shared_article: false, missed_article: true },
      strengths: ["Correct feature identified"], issues: ["Steps were not given in order", "\"In the right panel\" is too vague", "Floor plan article not shared"],
      needs_manager_review: true,
      manager_review: {
        recommended_rating: 6, verdict: "Right answer, weak instructions.",
        what_went_wrong: "Give numbered steps, name the exact toggle, and share the floor plan article so the user can self-serve.",
        ideal_reply: "Yes! Here's how: 1. Open your project and create a Floor Plan design. 2. Drag speakers from the Library onto the plan. 3. Select a speaker and turn on \"Show coverage\" in the right-hand Properties panel. Step-by-step guide: https://example.com/kb/floor-plan. Would you like me to stay on while you try it?",
      },
      suggested_article: { needed: true, user_question: "How do I show speaker coverage areas on my floor plan?", what_user_wants: "The user wants to place speakers on a floor plan and see each speaker's coverage area to check the room is fully covered. The article should cover enabling coverage view, adjusting angle/height, and reading overlaps.", suggested_title: "Show speaker coverage on a floor plan" },
    },
  },
  {
    sid: "demo-4", hoursAgo: 20, agent: agents.priya, user: "Casey Rivera", email: "casey.rivera@riveratech.com", respMin: 19, durMin: 31, rating: { stars: 2, comment: "Took too long" },
    transcript: "USER: Pricing in my library is wrong\nAGENT Priya: Could you share your registered email?\nUSER: casey@example.com\nAGENT Priya: Thanks, our team will look into this and update you.",
    a: {
      user_query: "Product prices in My Library are incorrect", query_category: "Library - Pricing",
      summary: "Agent collected the email and escalated, but did not ask which products or offer the price-list import guide.",
      scores: scores(5, 5, 3, 7, 5, 5, 4, 4, 3), user_satisfied: false, query_resolved: false, knowledge_transferred: false,
      satisfaction_evidence: "2-star rating: \"Took too long\"",
      kb: { relevant_articles: [{ title: "Import a price list into My Library", url: "https://example.com/kb/price-list" }], agent_shared_article: false, missed_article: true },
      strengths: ["Polite", "Escalated"], issues: ["No clarifying questions about which products/vendor", "No ETA given", "Missed price-list article"],
      needs_manager_review: true,
      manager_review: {
        recommended_rating: 5, verdict: "Escalation without diagnosis.",
        what_went_wrong: "Ask for the product names and expected vs. shown price, set an ETA, and share the import guide in case the user maintains their own list.",
        ideal_reply: "Thanks, Casey. Could you tell me which products (or vendor) show the wrong price and what price you expect? If you maintain your own price list you can re-import it here: https://example.com/kb/price-list. Otherwise I'll pass the details to our pricing team now — they usually update within 1 business day and I'll confirm here once done.",
      },
      suggested_article: noSuggestion,
    },
  },
  {
    sid: "demo-5", hoursAgo: 30, agent: agents.rahul, user: "Morgan Patel", email: "morgan.patel@patel-av.com", respMin: 3, durMin: 7, rating: { stars: 4, comment: "" },
    transcript: "USER: Can I export my BOM to Excel?\nAGENT Rahul: Yes — open the BOM, click Export > Excel. Columns follow your current view.\nUSER: great, thanks",
    a: {
      user_query: "Export a bill of materials to Excel", query_category: "BOM - Export",
      summary: "Clear, correct answer; no KB article exists for BOM export.",
      scores: scores(8, 8, 8, 8, 8, 9, 8, 8, 10), user_satisfied: true, query_resolved: true, knowledge_transferred: true,
      satisfaction_evidence: "\"great, thanks\" and 4 stars",
      kb: { relevant_articles: [], agent_shared_article: false, missed_article: false },
      strengths: ["Concise", "Explained column behaviour"], issues: [], needs_manager_review: false,
      manager_review: { recommended_rating: 8, verdict: "Good handling.", what_went_wrong: "", ideal_reply: "" },
      suggested_article: { needed: true, user_question: "How do I export my BOM to Excel?", what_user_wants: "The user wants a spreadsheet of their bill of materials to share or edit outside the platform. The article should show the export button, which columns are included and how to customise them.", suggested_title: "Export a BOM to Excel" },
    },
  },
  {
    sid: "demo-6", hoursAgo: 40, agent: agents.sam, user: "Riley Chen", email: "riley.chen@chen-solutions.com", respMin: 11, durMin: 18, rating: { stars: 1, comment: "Agent didn't understand" },
    transcript: "USER: I need to send invoices to my accountant's email, not mine\nAGENT Sam: You can download invoices from Billing.\nUSER: I asked about sending them to another email\nAGENT Sam: Please check Billing.",
    a: {
      user_query: "Send subscription invoices to a different email address", query_category: "Billing - Invoices",
      summary: "Agent misread the request twice and repeated the same answer.",
      scores: scores(2, 2, 1, 4, 3, 1, 2, 2, 5), user_satisfied: false, query_resolved: false, knowledge_transferred: false,
      satisfaction_evidence: "User restated the question; 1-star rating.",
      kb: { relevant_articles: [], agent_shared_article: false, missed_article: false },
      strengths: [], issues: ["Did not understand the query", "Repeated the same answer", "Did not explain the limitation or offer a workaround"],
      needs_manager_review: true,
      manager_review: {
        recommended_rating: 2, verdict: "Query misunderstood.",
        what_went_wrong: "Read the question carefully, explain that invoices go to the Super Admin email, and offer the workaround (forwarding rule or adding the accountant as Super Admin).",
        ideal_reply: "Got it — you'd like invoices to go straight to your accountant. At the moment invoices are sent only to the account's Super Admin email. Two options: set up an email forwarding rule for invoice emails, or download them anytime from Billing > Invoices and share them. I've also logged your request to allow a separate billing email.",
      },
      suggested_article: { needed: true, user_question: "Can invoices be sent to my accountant's email?", what_user_wants: "The user wants billing invoices delivered automatically to someone other than the account owner (e.g. an accountant). An article should state who receives invoices, how to download them, and current workarounds.", suggested_title: "Who receives invoices and how to send them to your accountant" },
    },
  },
  {
    // Same customer as demo-2, contacting again - this is what the "Customers at risk" leaderboard is for.
    sid: "demo-7", hoursAgo: 2, agent: agents.sam, user: "Jordan Lee", email: "jordan.lee@brightview-systems.com", respMin: 9, durMin: 15, rating: { stars: 2, comment: "Still not fixed" },
    transcript: "USER: The Terms section is STILL cut off in my PDF, this is the second time I'm asking\nAGENT Sam: Let me check that for you.\nUSER: It's been 6 hours\nAGENT Sam: I've escalated it again, sorry for the delay.",
    a: {
      user_query: "Proposal PDF Terms & Conditions section is still cut off, reported previously and not fixed",
      query_category: "Proposals - PDF export",
      summary: "Second contact from the same customer about an unresolved issue first raised the day before; still no fix or workaround offered.",
      scores: scores(3, 3, 2, 5, 3, 4, 2, 2, 2), user_satisfied: false, query_resolved: false, knowledge_transferred: false,
      satisfaction_evidence: '"this is the second time I\'m asking" and a 2-star rating',
      kb: { relevant_articles: [{ title: "Customise proposal templates", url: "https://example.com/kb/proposal-templates" }], agent_shared_article: false, missed_article: true },
      strengths: ["Acknowledged the delay"],
      issues: ["No recognition this was a repeat, unresolved issue from the same customer", "No workaround offered while the bug is pending", "No ETA given a second time"],
      needs_manager_review: true,
      manager_review: {
        recommended_rating: 3, verdict: "Repeat unresolved issue - should have been fast-tracked.",
        what_went_wrong: "A second contact about the same open issue should be flagged as a priority bug, given a concrete ETA, and offered the manual workaround immediately rather than re-escalated with no update.",
        ideal_reply: "Sorry, Jordan - I can see this is your second time reporting this and it's still not fixed, that's on us. I've flagged it as a priority bug with engineering (ref from your first chat). In the meantime, here's a workaround so you're not blocked: export the Terms as plain text first, then re-paste before exporting the proposal. I'll personally follow up with an update by end of day tomorrow.",
      },
      suggested_article: noSuggestion,
    },
  },
];

export function demoStore() {
  const conversations = {};
  for (const r of rows) {
    const at = now - r.hoursAgo * H;
    conversations[r.sid] = {
      sessionId: r.sid,
      updatedAt: at,
      createdAt: at - H / 2,
      state: "resolved",
      user: { name: r.user, email: r.email || "" },
      agent: r.agent,
      userRating: r.rating ? { ...r.rating, at } : null,
      messageCount: r.transcript.split("\n").length,
      transcript: r.transcript,
      crispUrl: "#",
      firstResponseMinutes: r.respMin ?? null,
      durationMinutes: r.durMin ?? null,
      analysis: { language: "English", ...r.a, model: "demo", costUsd: 0.018, usage: { input_tokens: 3400, output_tokens: 850 } },
      analyzedAt: new Date(at).toISOString(),
    };
  }
  return { conversations, knowledgeBase: kb, lastSync: new Date(now - H).toISOString() };
}

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getHistory, TraceStep, Campaign, Confidence } from "@/lib/purchaseHistories";

const SYSTEM_PROMPT = `You are an ad-personalization reasoning agent for an Amazon Prime Day campaign. You will be given a customer's recent purchase history. Work through it step by step using the tools provided.

CRITICAL RULES:
1. Never infer or output a demographic / life-stage / identity label about the customer (no "parent", "baby", "pregnant", "elderly", "male", "female", "single", "pet owner" framed as an identity, etc). A single product is compatible with many different identities, and guessing wrong is worse than not guessing at all.
2. Treat each notable item (or tightly related small group of items) as either an AMBIGUOUS single-point signal — many possible explanations, nothing else reinforces it, so discard it and do not build conclusions on it — or part of a CONVERGENT group — multiple independent items reinforcing the same specific, concrete need. Only draw conclusions via identify_need from convergent groups.
3. A "need" is a concrete problem / situation / goal (e.g. "frequent 3am waking", "lower back pain likely from prolonged sitting"), never an identity category.
4. Each campaign must focus on exactly ONE identified need. Never blend two different needs into a single headline or product list — for example, do NOT write something like "Tackle odor control, pet hair cleanup, and back support all in one place," which mixes unrelated problems and reads as disjointed. If you found multiple needs you're confident about, call propose_campaign once per need (high or medium confidence only — skip low-confidence needs), each with its own focused headline, subheadline, and 2-3 products addressing only that one need.
5. Every product you recommend must be a REAL, currently-sold product — never invent a product name or brand. Before calling propose_campaign for a need, use the web_search tool to find real products matching what that need requires. Brand does not need to be prestigious or well-known, it just needs to actually exist. Use the exact product title from the search result you found (or a faithful shortening of it), and pass the exact URL of that listing as source_url. One search can surface more than one usable product, so you don't need a separate search per product. If a search doesn't turn up a good match, broaden the query (drop specifics, search by category + key feature) rather than fabricating a listing — never call propose_campaign with a product you have not verified this way.
6. Call evaluate_signal for the notable items/groups first, then identify_need for each concrete need, then web_search to find real products for each need you're proposing a campaign for, then propose_campaign once per need. Do not call any tool after your last propose_campaign call.`;

const tools: Anthropic.ToolUnion[] = [
  {
    type: "web_search_20250305",
    name: "web_search",
    max_uses: 8,
  },
  {
    name: "evaluate_signal",
    description:
      "Log a judgment on one purchased item (or a tightly related small group of items): is it an ambiguous single-point signal that should be discarded on its own, or does it belong to a convergent group of items that reinforce the same specific need? Call this for the notable items before drawing conclusions.",
    input_schema: {
      type: "object",
      properties: {
        item: { type: "string", description: "The item(s) being evaluated, in plain text." },
        verdict: { type: "string", enum: ["ambiguous_discard", "convergent_keep"] },
        group: {
          type: "string",
          description:
            "Short label for the convergent group this belongs to, if verdict is convergent_keep (e.g. 'sleep_stack', 'back_pain'). Omit if ambiguous_discard.",
        },
        reasoning: { type: "string", description: "One or two sentences explaining the verdict." },
      },
      required: ["item", "verdict", "reasoning"],
    },
  },
  {
    name: "identify_need",
    description:
      "Declare one concrete NEED or PROBLEM inferred from a convergent group of signals. Never declare a demographic or identity label — only a concrete need/problem/goal the person likely has right now.",
    input_schema: {
      type: "object",
      properties: {
        need: { type: "string", description: "A concrete need/problem, phrased as a situation, not an identity label." },
        confidence: { type: "string", enum: ["high", "medium", "low"] },
        supporting_items: { type: "array", items: { type: "string" } },
        considered_but_avoided_labels: {
          type: "array",
          items: { type: "string" },
          description: "Identity labels that were tempting but deliberately NOT used.",
        },
      },
      required: ["need", "confidence", "supporting_items"],
    },
  },
  {
    name: "propose_campaign",
    description:
      "Propose ONE Prime Day campaign focused on exactly one identified need. Call this once per need you're confident about (high or medium confidence only) — never combine multiple needs into one campaign. Every product must have been verified as real via a prior web_search call in this conversation.",
    input_schema: {
      type: "object",
      properties: {
        need: { type: "string", description: "The exact need text this campaign addresses (should match a prior identify_need call)." },
        confidence: { type: "string", enum: ["high", "medium", "low"] },
        headline: { type: "string" },
        subheadline: { type: "string" },
        products: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "The real product title, taken from a web_search result." },
              reason: { type: "string", description: "One sentence tying this product to this one need, not an identity." },
              source_url: { type: "string", description: "The exact URL of the web_search result that confirms this product is real." },
            },
            required: ["name", "reason", "source_url"],
          },
        },
      },
      required: ["need", "confidence", "headline", "subheadline", "products"],
    },
  },
];

const CONFIDENCE_RANK: Record<Confidence, number> = { high: 0, medium: 1, low: 2 };

export async function POST(req: NextRequest) {
  const { historyId } = (await req.json()) as { historyId: "A" | "B" };
  const history = getHistory(historyId);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, reason: "no_api_key" }, { status: 200 });
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const messages: Anthropic.MessageParam[] = [
      {
        role: "user",
        content: `Customer's recent purchase history:\n${history.items.map((i) => `- ${i}`).join("\n")}`,
      },
    ];

    const trace: TraceStep[] = [];
    const campaigns: Campaign[] = [];
    const pendingSearchQueries = new Map<string, string>();

    for (let i = 0; i < 30; i++) {
      const resp = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        temperature: 0.7,
        system: SYSTEM_PROMPT,
        tools,
        messages,
      });

      messages.push({ role: "assistant", content: resp.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      let sawClientToolUse = false;

      for (const block of resp.content) {
        if (block.type === "text" && block.text.trim()) {
          trace.push({ kind: "thought", text: block.text.trim() });
        } else if (block.type === "server_tool_use" && block.name === "web_search") {
          pendingSearchQueries.set(block.id, String((block.input as { query?: string })?.query ?? ""));
        } else if (block.type === "web_search_tool_result") {
          const query = pendingSearchQueries.get(block.tool_use_id) ?? "";
          pendingSearchQueries.delete(block.tool_use_id);
          if (Array.isArray(block.content)) {
            trace.push({
              kind: "web_search",
              query,
              results: block.content.map((r) => ({ title: r.title, url: r.url })),
            });
          } else {
            trace.push({ kind: "web_search", query, results: [], error: block.content.error_code });
          }
        } else if (block.type === "tool_use") {
          sawClientToolUse = true;
          const input = block.input as Record<string, unknown>;
          if (block.name === "evaluate_signal") {
            trace.push({
              kind: "evaluate_signal",
              item: String(input.item ?? ""),
              verdict: input.verdict as "ambiguous_discard" | "convergent_keep",
              group: input.group ? String(input.group) : undefined,
              reasoning: String(input.reasoning ?? ""),
            });
          } else if (block.name === "identify_need") {
            trace.push({
              kind: "identify_need",
              need: String(input.need ?? ""),
              confidence: input.confidence as Confidence,
              supporting_items: (input.supporting_items as string[]) ?? [],
              considered_but_avoided_labels: (input.considered_but_avoided_labels as string[]) ?? [],
            });
          } else if (block.name === "propose_campaign") {
            const rawProducts = (input.products as Array<{ name: string; reason: string; source_url?: string }>) ?? [];
            campaigns.push({
              need: String(input.need ?? ""),
              confidence: input.confidence as Confidence,
              headline: String(input.headline ?? ""),
              subheadline: String(input.subheadline ?? ""),
              products: rawProducts.map((p) => ({ name: p.name, reason: p.reason, sourceUrl: p.source_url })),
            });
          }
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: "logged" });
        }
      }

      if (toolResults.length > 0) {
        messages.push({ role: "user", content: toolResults });
      }
      if (!sawClientToolUse && resp.stop_reason !== "pause_turn") break;
    }

    if (campaigns.length === 0) {
      return NextResponse.json({ ok: false, reason: "no_campaign_produced" }, { status: 200 });
    }

    campaigns.sort((a, b) => CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence]);
    trace.push({
      kind: "capstone",
      text:
        campaigns.length === 1
          ? "Proposed 1 single-theme campaign with web-search-verified products."
          : `Proposed ${campaigns.length} single-theme campaigns with web-search-verified products — kept separate rather than blended into one headline.`,
    });

    return NextResponse.json({ ok: true, trace, campaigns });
  } catch (err) {
    return NextResponse.json({ ok: false, reason: "generation_failed", detail: String(err) }, { status: 200 });
  }
}

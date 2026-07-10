"use client";

import { useState, useEffect } from "react";
import { PURCHASE_HISTORIES, getHistory, TraceStep, Campaign } from "@/lib/purchaseHistories";
import { productIcon } from "@/lib/productIcon";

type Mode = "cached" | "live";
type HistoryId = "A" | "B";

type VisualStage = "loading" | "image" | "favicon" | "emoji";

function ProductVisual({ name, sourceUrl }: { name: string; sourceUrl?: string }) {
  const icon = productIcon(name);
  const [stage, setStage] = useState<VisualStage>(sourceUrl ? "loading" : "emoji");
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    setImageUrl(null);
    if (!sourceUrl) {
      setStage("emoji");
      return;
    }
    setStage("loading");
    let cancelled = false;
    fetch(`/api/product-image?url=${encodeURIComponent(sourceUrl)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.ok && data.imageUrl) {
          setImageUrl(data.imageUrl);
          setStage("image");
        } else {
          setStage("favicon");
        }
      })
      .catch(() => {
        if (!cancelled) setStage("favicon");
      });
    return () => {
      cancelled = true;
    };
  }, [sourceUrl]);

  if (stage === "image" && imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name}
        className="shrink-0 w-12 h-12 rounded-lg object-cover border border-slate-100"
        onError={() => setStage("favicon")}
      />
    );
  }

  if ((stage === "favicon" || stage === "loading") && sourceUrl) {
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(sourceUrl).hostname}&sz=128`;
    return (
      <div className={`shrink-0 w-12 h-12 rounded-lg ${icon.bg} flex items-center justify-center p-2.5`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={faviconUrl} alt={name} className="w-full h-full object-contain" onError={() => setStage("emoji")} />
      </div>
    );
  }

  return (
    <div className={`shrink-0 w-12 h-12 rounded-lg ${icon.bg} flex items-center justify-center text-2xl`} aria-hidden>
      {icon.emoji}
    </div>
  );
}

const VERDICT_STYLE: Record<string, string> = {
  ambiguous_discard: "border-slate-300 text-slate-500 bg-slate-50",
  convergent_keep: "border-emerald-300 text-emerald-700 bg-emerald-50",
};

const CONFIDENCE_STYLE: Record<string, string> = {
  high: "border-sky-300 text-sky-700 bg-sky-50",
  medium: "border-amber-300 text-amber-700 bg-amber-50",
  low: "border-slate-300 text-slate-500 bg-slate-50",
};

function TraceStepView({ step }: { step: TraceStep }) {
  if (step.kind === "thought") {
    return (
      <div className="text-sm text-slate-500 italic pl-4 border-l-2 border-slate-200">
        Thought: {step.text}
      </div>
    );
  }
  if (step.kind === "evaluate_signal") {
    return (
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-4 text-sm">
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="font-medium text-slate-800">{step.item}</span>
          <span
            className={`shrink-0 text-xs uppercase tracking-wide border rounded-full px-2 py-0.5 ${VERDICT_STYLE[step.verdict]}`}
          >
            {step.verdict === "convergent_keep" ? "keep · convergent" : "discard · ambiguous"}
          </span>
        </div>
        {step.group && <div className="text-xs text-emerald-600 mb-1">group: {step.group}</div>}
        <p className="text-slate-500">{step.reasoning}</p>
      </div>
    );
  }
  if (step.kind === "identify_need") {
    return (
      <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm">
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="font-medium text-sky-900">Need identified: {step.need}</span>
          <span
            className={`shrink-0 text-xs uppercase tracking-wide border rounded-full px-2 py-0.5 ${CONFIDENCE_STYLE[step.confidence]}`}
          >
            {step.confidence} confidence
          </span>
        </div>
        <p className="text-slate-500 mb-1">Supported by: {step.supporting_items.join(" · ")}</p>
        {step.considered_but_avoided_labels && step.considered_but_avoided_labels.length > 0 && (
          <p className="text-slate-400">
            Identity labels considered and deliberately avoided:{" "}
            {step.considered_but_avoided_labels.map((l, i) => (
              <span key={i} className="line-through mr-2">
                {l}
              </span>
            ))}
          </p>
        )}
      </div>
    );
  }
  if (step.kind === "web_search") {
    return (
      <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 text-sm">
        <div className="font-medium text-violet-900 mb-2">🔎 Searched: &quot;{step.query}&quot;</div>
        {step.error ? (
          <p className="text-violet-500">Search error: {step.error}</p>
        ) : step.results.length === 0 ? (
          <p className="text-violet-500">No results.</p>
        ) : (
          <ul className="space-y-1">
            {step.results.slice(0, 4).map((r, i) => (
              <li key={i} className="truncate">
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-700 underline decoration-dotted hover:text-violet-900"
                >
                  {r.title}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  return (
    <div className="text-sm text-emerald-700 pl-4 border-l-2 border-emerald-300">✓ {step.text}</div>
  );
}

export default function Home() {
  const [historyId, setHistoryId] = useState<HistoryId>("A");
  const [mode, setMode] = useState<Mode>("cached");
  const [liveResult, setLiveResult] = useState<{ trace: TraceStep[]; campaigns: Campaign[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [campaignIndex, setCampaignIndex] = useState(0);

  const history = getHistory(historyId);

  async function selectHistory(id: HistoryId) {
    setHistoryId(id);
    setLiveResult(null);
    setLiveError(null);
    setCampaignIndex(0);
    if (mode === "live") await fetchLive(id);
  }

  async function switchMode(m: Mode) {
    setMode(m);
    setLiveError(null);
    setCampaignIndex(0);
    if (m === "live" && !liveResult) await fetchLive(historyId);
  }

  async function fetchLive(id: HistoryId) {
    setLoading(true);
    setLiveError(null);
    setCampaignIndex(0);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ historyId: id }),
      });
      const data = await res.json();
      if (data.ok) {
        setLiveResult({ trace: data.trace, campaigns: data.campaigns });
      } else if (data.reason === "no_api_key") {
        setLiveError(
          "No ANTHROPIC_API_KEY found in the environment. Add one to .env.local to enable live agent runs — showing the cached trace instead.",
        );
      } else {
        setLiveError("Live agent run failed, showing cached trace instead.");
      }
    } catch {
      setLiveError("Live agent run failed, showing cached trace instead.");
    } finally {
      setLoading(false);
    }
  }

  const trace = mode === "live" && liveResult ? liveResult.trace : history.cached.trace;
  const campaigns = mode === "live" && liveResult ? liveResult.campaigns : history.cached.campaigns;
  const campaign = campaigns[campaignIndex % campaigns.length];

  function nextAngle() {
    setCampaignIndex((i) => (i + 1) % campaigns.length);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-sky-400 via-cyan-400 to-blue-500">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.35),transparent_45%)]" />
        <div className="relative max-w-4xl mx-auto px-6 py-20 text-center">
          <span className="inline-block text-xs tracking-widest uppercase bg-white/90 text-sky-700 font-semibold rounded-full px-4 py-1 mb-6">
            Prime Day · Personalized for you
          </span>
          <h1 className="text-4xl md:text-5xl font-semibold leading-tight mb-4 text-white transition-all duration-300">
            {campaign.headline}
          </h1>
          <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto transition-all duration-300">
            {campaign.subheadline}
          </p>
          {campaigns.length > 1 && (
            <button
              onClick={nextAngle}
              className="mt-6 inline-flex items-center gap-2 bg-white/90 hover:bg-white text-sky-700 text-sm font-medium rounded-full px-4 py-2 transition-colors"
            >
              🔁 Try another reliable angle ({campaignIndex + 1}/{campaigns.length})
            </button>
          )}
          {loading && <p className="mt-4 text-sm text-white/90 animate-pulse">Agent is thinking…</p>}
        </div>
      </section>

      {/* Recommended products */}
      <section className="max-w-4xl mx-auto px-6 pt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm uppercase tracking-widest text-slate-400">Recommended for you</h2>
          <span
            className={`text-xs uppercase tracking-wide border rounded-full px-2 py-0.5 ${CONFIDENCE_STYLE[campaign.confidence]}`}
          >
            {campaign.confidence} confidence · {campaign.need}
          </span>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {campaign.products.map((p, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 flex gap-4">
              <ProductVisual name={p.name} sourceUrl={p.sourceUrl} />
              <div>
                <div className="font-medium text-slate-900 mb-1">{p.name}</div>
                <div className="text-sm text-slate-500 mb-1">{p.reason}</div>
                {p.sourceUrl && (
                  <a
                    href={p.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800"
                  >
                    ✓ Verified real product — {new URL(p.sourceUrl).hostname.replace("www.", "")}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Controls */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="text-sm uppercase tracking-widest text-slate-400 mb-3">
          1 · Choose a purchase history
        </h2>
        <div className="flex flex-wrap gap-3 mb-3">
          {PURCHASE_HISTORIES.map((h) => (
            <button
              key={h.id}
              onClick={() => selectHistory(h.id)}
              className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                h.id === historyId
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white border-slate-300 text-slate-600 hover:border-slate-400"
              }`}
            >
              {h.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowRaw((s) => !s)}
          className="text-xs text-slate-500 underline decoration-dotted mb-8"
        >
          {showRaw ? "Hide" : "Show"} raw order history fed to the agent
        </button>
        {showRaw && (
          <ul className="mb-8 -mt-4 rounded-lg border border-slate-200 bg-white p-4 text-xs text-slate-500 space-y-1 list-disc list-inside">
            {history.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        )}

        <h2 className="text-sm uppercase tracking-widest text-slate-400 mb-3">2 · Content source</h2>
        <div className="flex flex-wrap gap-3 mb-10">
          <button
            onClick={() => switchMode("cached")}
            className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
              mode === "cached"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white border-slate-300 text-slate-600 hover:border-slate-400"
            }`}
          >
            📦 Pre-generated (cached)
          </button>
          <button
            onClick={() => switchMode("live")}
            className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
              mode === "live"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white border-slate-300 text-slate-600 hover:border-slate-400"
            }`}
          >
            ⚡ Live agent (Claude reasons now)
          </button>
          {mode === "live" && (
            <button
              onClick={() => fetchLive(historyId)}
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-600 hover:border-slate-400 disabled:opacity-40"
            >
              🔄 Re-run agent from scratch
            </button>
          )}
        </div>

        {liveError && (
          <div className="mb-8 text-sm bg-amber-50 border border-amber-300 text-amber-800 rounded-lg px-4 py-3">
            {liveError}
          </div>
        )}

        {/* Agent trace */}
        <h2 className="text-sm uppercase tracking-widest text-slate-400 mb-4">
          Agent reasoning trace (ReAct: thought → action → observation)
        </h2>
        <div className="space-y-3">
          {trace.map((step, i) => (
            <div
              key={i}
              className="animate-[fadein_0.4s_ease-out_both]"
              style={{ animationDelay: `${Math.min(i * 60, 600)}ms` }}
            >
              <TraceStepView step={step} />
            </div>
          ))}
        </div>

        <p className="mt-10 text-xs text-slate-400 leading-relaxed">
          Demo only. The two purchase histories above are real examples worked through in conversation
          first. The agent&apos;s prompt bans demographic/identity labels (no &quot;parent&quot;,
          &quot;pet owner&quot;, etc.) and requires every campaign to stay single-theme — if it finds
          multiple reliable needs, it proposes one focused campaign per need instead of blending them
          into one disjointed headline. The highest-confidence campaign shows by default; &quot;Try
          another reliable angle&quot; cycles only through the needs the agent already confirmed, never
          a freshly invented or merged topic. In live mode, the agent must use Anthropic&apos;s
          web_search tool to find a real, currently-sold product before it&apos;s allowed to recommend
          it — every live-mode product links to the actual listing it found as proof, rather than a
          name Claude made up. &quot;Live&quot; mode runs this as a real multi-step Claude tool-use loop
          and requires <code className="bg-slate-100 rounded px-1">ANTHROPIC_API_KEY</code> in{" "}
          <code className="bg-slate-100 rounded px-1">.env.local</code>.
        </p>
      </section>
    </div>
  );
}

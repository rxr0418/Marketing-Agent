import { NextRequest, NextResponse } from "next/server";

// In-memory cache for the life of this server process — same source_url is
// requested repeatedly (cached campaigns, re-renders), no need to re-fetch.
const cache = new Map<string, string | null>();

function extractMetaImage(html: string): string | null {
  for (const key of ["og:image", "twitter:image"]) {
    const propFirst = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`, "i");
    const contentFirst = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`, "i");
    const match = html.match(propFirst) ?? html.match(contentFirst);
    if (match) return match[1];
  }
  return null;
}

function parseSafeUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    if (["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(host)) return null;
    return url;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) return NextResponse.json({ ok: false }, { status: 400 });

  const url = parseSafeUrl(raw);
  if (!url) return NextResponse.json({ ok: false }, { status: 400 });

  if (cache.has(raw)) {
    const cached = cache.get(raw) ?? null;
    return NextResponse.json(cached ? { ok: true, imageUrl: cached } : { ok: false });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      cache.set(raw, null);
      return NextResponse.json({ ok: false });
    }

    const html = await res.text();
    const imageUrl = extractMetaImage(html);
    cache.set(raw, imageUrl);
    return imageUrl ? NextResponse.json({ ok: true, imageUrl }) : NextResponse.json({ ok: false });
  } catch {
    cache.set(raw, null);
    return NextResponse.json({ ok: false });
  }
}

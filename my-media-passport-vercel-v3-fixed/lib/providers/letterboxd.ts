import "server-only";
import type { ExternalRating } from "../types";

const BASE = "https://api.letterboxd.com/api/v0";
let tokenCache: { token: string; expiresAt: number } | null = null;

function credentials() {
  const clientId = (process.env.LETTERBOXD_CLIENT_ID || "").trim();
  const clientSecret = (process.env.LETTERBOXD_CLIENT_SECRET || "").trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

async function token() {
  const creds = credentials();
  if (!creds) return "";
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60000) return tokenCache.token;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: creds.clientId,
    client_secret: creds.clientSecret
  });
  const res = await fetch(`${BASE}/auth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body,
    cache: "no-store"
  });
  if (!res.ok) return "";
  const json = await res.json();
  const accessToken = String(json?.access_token || "");
  if (!accessToken) return "";
  tokenCache = { token: accessToken, expiresAt: Date.now() + Math.max(60, Number(json?.expires_in || 3600)) * 1000 };
  return accessToken;
}

async function lb(path: string) {
  const access = await token();
  if (!access) return null;
  const res = await fetch(`${BASE}${path}`, {
    headers: { authorization: `Bearer ${access}`, accept: "application/json" },
    next: { revalidate: 21600 }
  });
  if (!res.ok) return null;
  return res.json();
}

export async function getLetterboxdRating(opts: { tmdbId?: string; imdbId?: string; type?: string }): Promise<ExternalRating | null> {
  if (!credentials()) return null;
  // Letterboxd's documented film endpoints are reliable for films. We avoid guessing for TV series.
  if (opts.type === "Series") return null;
  const lookupId = opts.tmdbId ? `tmdb:${opts.tmdbId}` : opts.imdbId ? `imdb:${opts.imdbId}` : "";
  if (!lookupId) return null;

  try {
    const film = await lb(`/film/${encodeURIComponent(lookupId)}`);
    const lid = String(film?.id || "");
    if (!lid) return null;
    const stats = await lb(`/film/${encodeURIComponent(lid)}/statistics`);
    if (!stats) return null;
    const rating = stats?.rating;
    const reviews = Number(stats?.counts?.reviews);
    const ratings = Number(stats?.counts?.ratings);
    return {
      provider: "Letterboxd",
      score: rating !== undefined && rating !== null ? Number(rating).toFixed(2) : "",
      scale: "/5",
      reviews: Number.isFinite(reviews) ? reviews : undefined,
      votes: Number.isFinite(ratings) ? ratings : undefined,
      url: film?.link || undefined,
      sourceNote: "Datos oficiales de Letterboxd"
    };
  } catch {
    return null;
  }
}

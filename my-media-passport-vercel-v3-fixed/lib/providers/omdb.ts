import "server-only";
import type { ExternalRating } from "../types";

function key() {
  return (process.env.OMDB_API_KEY || "").trim();
}

function cleanNumber(value: unknown) {
  const n = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

export async function getOmdbRatings(imdbId?: string): Promise<ExternalRating[]> {
  const apiKey = key();
  if (!apiKey || !imdbId) return [];

  try {
    const url = new URL("https://www.omdbapi.com/");
    url.searchParams.set("apikey", apiKey);
    url.searchParams.set("i", imdbId);
    url.searchParams.set("plot", "short");
    const res = await fetch(url, { next: { revalidate: 21600 } });
    if (!res.ok) return [];
    const data = await res.json();
    if (data?.Response === "False") return [];

    const out: ExternalRating[] = [];
    if (data?.imdbRating && data.imdbRating !== "N/A") {
      out.push({
        provider: "IMDb",
        score: String(data.imdbRating),
        scale: "/10",
        votes: cleanNumber(data.imdbVotes),
        url: `https://www.imdb.com/title/${encodeURIComponent(imdbId)}/`,
        sourceNote: "IMDb vía OMDb"
      });
    }

    const rt = Array.isArray(data?.Ratings)
      ? data.Ratings.find((r: any) => String(r?.Source || "").toLowerCase().includes("rotten"))
      : null;
    if (rt?.Value) {
      out.push({
        provider: "Rotten Tomatoes",
        score: String(rt.Value),
        scale: "",
        url: undefined,
        sourceNote: "Puntuación vía OMDb; conteo de reseñas no disponible"
      });
    }
    return out;
  } catch {
    return [];
  }
}

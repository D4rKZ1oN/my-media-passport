import { NextRequest, NextResponse } from "next/server";
import { getAnimeDetails } from "@/lib/providers/anilist";
import { getTMDbDetails } from "@/lib/providers/tmdb";
import { getOmdbRatings } from "@/lib/providers/omdb";
import { getLetterboxdRating } from "@/lib/providers/letterboxd";
import type { ExternalRating, MediaDetails } from "@/lib/types";

export const dynamic = "force-dynamic";

async function enrich(details: MediaDetails) {
  const ratings: ExternalRating[] = [...(details.externalRatings || [])];
  const [omdb, letterboxd] = await Promise.all([
    getOmdbRatings(details.imdbId),
    getLetterboxdRating({ tmdbId: details.tmdbId, imdbId: details.imdbId, type: details.type })
  ]);
  ratings.push(...omdb);
  if (letterboxd) ratings.push(letterboxd);

  const deduped = ratings.filter((r, idx, arr) => arr.findIndex(x => x.provider === r.provider) === idx);
  return { ...details, externalRatings: deduped };
}

export async function GET(req: NextRequest) {
  try {
    const source = (req.nextUrl.searchParams.get("source") || "").trim();
    const id = (req.nextUrl.searchParams.get("id") || "").trim();
    const type = (req.nextUrl.searchParams.get("type") || "").trim();

    if (!source || !id) {
      return NextResponse.json({ error: "Faltan datos para cargar los detalles." }, { status: 400 });
    }

    if (source === "AniList") {
      return NextResponse.json(await enrich(await getAnimeDetails(id)));
    }

    if (source === "TMDb" && (type === "Movie" || type === "Series")) {
      return NextResponse.json(await enrich(await getTMDbDetails(id, type)));
    }

    return NextResponse.json({ error: "Esta fuente no ofrece detalles adicionales compatibles." }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No pudimos cargar los detalles." }, { status: 500 });
  }
}

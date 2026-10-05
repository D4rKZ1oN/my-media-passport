import "server-only";
import type { SearchItem, UpdateItem } from "../types";

const BASE = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p/w500";
const BACKDROP = "https://image.tmdb.org/t/p/w1280";
const LANG = "es-MX";

function key() {
  const k = process.env.TMDB_API_KEY;
  if (!k) throw new Error("Falta TMDB_API_KEY");
  return k;
}

async function tmdb(path: string, params: Record<string,string> = {}, revalidate = 0) {
  const url = new URL(BASE + path);
  url.searchParams.set("api_key", key());
  url.searchParams.set("language", LANG);
  Object.entries(params).forEach(([k,v]) => url.searchParams.set(k,v));
  const res = await fetch(url, { cache: revalidate ? "force-cache" : "no-store", ...(revalidate ? { next: { revalidate } } : {}) });
  if (!res.ok) throw new Error(`TMDb respondió ${res.status}`);
  return res.json();
}

function mapItem(r: any, type: "Movie"|"Series"): SearchItem {
  const movie = type === "Movie";
  const date = movie ? r.release_date : r.first_air_date;
  return {
    title: (movie ? r.title : r.name) || "Sin título",
    type,
    source: "TMDb",
    externalId: String(r.id),
    year: date ? String(date).slice(0,4) : "",
    posterUrl: r.poster_path ? IMG + r.poster_path : "",
    backdropUrl: r.backdrop_path ? BACKDROP + r.backdrop_path : "",
    overview: r.overview || "",
    total: movie ? 1 : "",
    rating: r.vote_average ? Math.round(r.vote_average * 10) / 10 : "",
    voteCount: r.vote_count || ""
  };
}

export async function searchTMDb(query: string, type: "Movie"|"Series") {
  const data = await tmdb(type === "Movie" ? "/search/movie" : "/search/tv", { query });
  return (data.results || []).slice(0,10).map((r:any) => mapItem(r, type));
}

export async function discoveryTMDb() {
  const [movies, series] = await Promise.all([
    tmdb("/movie/now_playing", {}, 1800),
    tmdb("/tv/on_the_air", {}, 1800)
  ]);
  return [
    ...(movies.results || []).slice(0,6).map((r:any) => mapItem(r,"Movie")),
    ...(series.results || []).slice(0,6).map((r:any) => mapItem(r,"Series"))
  ];
}

export async function tvEpisodeCount(id: string) {
  try { const d = await tmdb(`/tv/${encodeURIComponent(id)}`, {}, 3600); return d.number_of_episodes || ""; }
  catch { return ""; }
}

export async function getSeriesUpdate(id: string, fallback: { id:string; title:string; type:string; status:string; posterUrl:string }): Promise<UpdateItem> {
  const base: UpdateItem = { ...fallback, message: "Sin próximo episodio confirmado por TMDb.", ok: false };
  if (!id) return base;
  try {
    const d = await tmdb(`/tv/${encodeURIComponent(id)}`, {}, 900);
    base.title = d.name || base.title;
    base.posterUrl = d.poster_path ? IMG + d.poster_path : base.posterUrl;
    const next = d.next_episode_to_air;
    if (next?.air_date) {
      const time = new Date(`${next.air_date}T12:00:00`).getTime();
      base.ok = true;
      base.dateKind = "exact";
      base.airingAt = time;
      base.episode = next.episode_number || "";
      base.season = next.season_number || "";
      base.label = `Temporada ${base.season || "-"} · Episodio ${base.episode || "-"}`;
      base.message = next.name || "Próximo episodio confirmado.";
      return base;
    }
    const future = (d.seasons || []).filter((s:any) => s.air_date && new Date(`${s.air_date}T12:00:00`).getTime() >= Date.now()).sort((a:any,b:any) => a.air_date.localeCompare(b.air_date));
    if (future.length) {
      const s = future[0];
      const time = new Date(`${s.air_date}T12:00:00`).getTime();
      base.dateKind = "approx";
      base.approxSortAt = time;
      base.approxDateText = `Aprox. ${new Date(time).toLocaleDateString("es", { day:"numeric", month:"short", year:"numeric" })}`;
      base.label = `Temporada ${s.season_number ?? "-"}`;
      base.message = "TMDb muestra una fecha de temporada, no un episodio exacto.";
    } else if (d.status === "Ended") {
      base.message = "Serie terminada. No hay próximo episodio confirmado.";
    } else if (d.status === "Returning Series" || d.in_production) {
      base.message = "La serie sigue activa, pero TMDb no tiene fecha confirmada todavía.";
    }
  } catch {
    base.message = "No se pudo cargar la novedad ahora.";
  }
  return base;
}

function pickTrailer(videos: any[]) {
  const yt = (videos || []).filter((v:any) => v?.site === "YouTube" && v?.key);
  const score = (v:any) => {
    const type = String(v.type || "");
    if (type === "Trailer" && v.official) return 4;
    if (type === "Trailer") return 3;
    if (type === "Teaser" && v.official) return 2;
    if (type === "Teaser") return 1;
    return 0;
  };
  const chosen = [...yt].sort((a:any,b:any) => score(b) - score(a))[0];
  if (!chosen) return null;
  return { site: "YouTube" as const, key: String(chosen.key), name: String(chosen.name || "Trailer"), official: Boolean(chosen.official) };
}

export async function getTMDbDetails(id: string, type: "Movie"|"Series") {
  const path = type === "Movie" ? `/movie/${encodeURIComponent(id)}` : `/tv/${encodeURIComponent(id)}`;
  const [detailsEs, videosEs] = await Promise.all([
    tmdb(path, {}, 1800),
    tmdb(`${path}/videos`, {}, 1800)
  ]);

  let details = detailsEs;
  let trailer = pickTrailer(videosEs.results || []);

  if (!detailsEs.overview || !trailer) {
    const [detailsEn, videosEn] = await Promise.all([
      !detailsEs.overview ? tmdb(path, { language: "en-US" }, 1800) : Promise.resolve(null),
      !trailer ? tmdb(`${path}/videos`, { language: "en-US" }, 1800) : Promise.resolve(null)
    ]);
    if (!details.overview && detailsEn) details = { ...details, overview: detailsEn.overview || "" };
    if (!trailer && videosEn) trailer = pickTrailer(videosEn.results || []);
  }

  const movie = type === "Movie";
  const date = movie ? details.release_date : details.first_air_date;
  const runtime = movie ? details.runtime : (Array.isArray(details.episode_run_time) ? details.episode_run_time[0] : "");
  return {
    title: (movie ? details.title : details.name) || "Sin título",
    type,
    source: "TMDb",
    externalId: String(details.id || id),
    year: date ? String(date).slice(0,4) : "",
    posterUrl: details.poster_path ? IMG + details.poster_path : "",
    backdropUrl: details.backdrop_path ? BACKDROP + details.backdrop_path : "",
    overview: details.overview || "",
    rating: details.vote_average ? Math.round(details.vote_average * 10) / 10 : "",
    voteCount: details.vote_count || "",
    genres: Array.isArray(details.genres) ? details.genres.map((g:any) => String(g.name)).filter(Boolean) : [],
    runtime: runtime || "",
    episodes: movie ? 1 : (details.number_of_episodes || ""),
    trailer
  };
}

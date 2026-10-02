import "server-only";
import type { SearchItem, UpdateItem } from "../types";

const URL = "https://graphql.anilist.co";

async function gql<T>(query: string, variables: Record<string, unknown>, revalidate = 0): Promise<T> {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
    cache: revalidate ? "force-cache" : "no-store",
    ...(revalidate ? { next: { revalidate } } : {})
  });
  if (!res.ok) throw new Error(`AniList respondió ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0]?.message || "Error de AniList");
  return json.data as T;
}

function mediaToSearch(m: any): SearchItem {
  return {
    title: m.title?.english || m.title?.romaji || "Sin título",
    type: "Anime",
    source: "AniList",
    externalId: String(m.id),
    year: m.startDate?.year || "",
    posterUrl: m.coverImage?.extraLarge || m.coverImage?.large || m.coverImage?.medium || "",
    backdropUrl: m.bannerImage || "",
    overview: String(m.description || "").replace(/<[^>]*>/g, "").trim(),
    total: m.episodes || "",
    rating: m.averageScore ? Math.round(m.averageScore) / 10 : "",
    voteCount: m.popularity || m.favourites || ""
  };
}

export async function searchAnime(search: string): Promise<SearchItem[]> {
  const query = `query ($search:String,$perPage:Int){Page(perPage:$perPage){media(search:$search,type:ANIME,sort:SEARCH_MATCH){id title{romaji english} startDate{year} coverImage{extraLarge large medium} bannerImage description(asHtml:false) episodes averageScore popularity favourites}}}`;
  const data = await gql<any>(query, { search, perPage: 10 });
  return (data.Page?.media || []).map(mediaToSearch);
}

export async function trendingAnime(): Promise<SearchItem[]> {
  const query = `query ($perPage:Int){Page(perPage:$perPage){media(type:ANIME,status:RELEASING,sort:TRENDING_DESC){id title{romaji english} startDate{year} coverImage{extraLarge large medium} bannerImage description(asHtml:false) episodes averageScore popularity favourites}}}`;
  const data = await gql<any>(query, { perPage: 10 }, 1800);
  return (data.Page?.media || []).map(mediaToSearch);
}

export async function getAnimeUpdate(id: string, fallback: { id:string; title:string; type:string; status:string; posterUrl:string }): Promise<UpdateItem> {
  const base: UpdateItem = { ...fallback, message: "Sin fecha confirmada por la fuente.", ok: false };
  if (!id) return base;
  const query = `query ($id:Int){Media(id:$id,type:ANIME){status episodes season seasonYear startDate{year month day} title{romaji english} coverImage{extraLarge large medium} nextAiringEpisode{episode airingAt timeUntilAiring}}}`;
  try {
    const data = await gql<any>(query, { id: Number(id) }, 600);
    const m = data.Media;
    if (!m) return base;
    base.title = m.title?.english || m.title?.romaji || base.title;
    base.posterUrl = m.coverImage?.extraLarge || m.coverImage?.large || base.posterUrl;
    if (m.nextAiringEpisode?.airingAt) {
      base.ok = true;
      base.dateKind = "exact";
      base.airingAt = Number(m.nextAiringEpisode.airingAt) * 1000;
      base.episode = m.nextAiringEpisode.episode || "";
      base.label = `Episodio ${base.episode || "-"}`;
      base.message = "Próximo episodio confirmado por AniList.";
      return base;
    }
    const y = Number(m.startDate?.year || m.seasonYear || 0);
    const mo = Number(m.startDate?.month || 0);
    const d = Number(m.startDate?.day || 0);
    if (y) {
      let date: Date;
      let text: string;
      if (mo && d) { date = new Date(y, mo - 1, d, 12); text = date.toLocaleDateString("es", { day:"numeric", month:"short", year:"numeric" }); }
      else if (mo) { date = new Date(y, mo - 1, 1, 12); text = date.toLocaleDateString("es", { month:"long", year:"numeric" }); }
      else { date = new Date(y, 0, 1, 12); text = String(y); }
      if (date.getTime() >= Date.now() - 86400000) {
        base.dateKind = "approx";
        base.approxSortAt = date.getTime();
        base.approxDateText = `Aprox. ${text}`;
        base.label = "Próximo estreno";
        base.message = "AniList tiene una ventana aproximada, no un episodio exacto.";
      }
    }
    if (m.status === "FINISHED") base.message = "Anime finalizado. No hay próximo episodio confirmado.";
  } catch {
    base.message = "No se pudo cargar la novedad ahora.";
  }
  return base;
}

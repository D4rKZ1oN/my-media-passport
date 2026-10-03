import "server-only";
import { appendMedia, deleteMediaRow, findExistingMedia, findMediaRowById, readMedia, readProfile, updateFavoriteRanks, updateMediaRow } from "./sheets";
import { isTruthy, safeStatus, STATUS_VALUES } from "./status";
import type { HomeData, MediaItem, SearchItem, UpdateItem } from "./types";
import { tvEpisodeCount } from "./providers/tmdb";
import { getAnimeUpdate } from "./providers/anilist";
import { getSeriesUpdate } from "./providers/tmdb";

function num(v: unknown) { const n = Number(v || 0); return Number.isFinite(n) ? n : 0; }
function now() { return new Date().toISOString(); }

export async function homeData(): Promise<HomeData> {
  const [items, profile] = await Promise.all([readMedia(), readProfile()]);
  const counts: Record<string,number> = Object.fromEntries(STATUS_VALUES.map(s => [s,0]));
  items.forEach(i => { if (i.Status in counts) counts[i.Status]++; });
  const sortUpdated = (a:MediaItem,b:MediaItem) => String(b.UpdatedAt||"").localeCompare(String(a.UpdatedAt||""));
  const sortCreated = (a:MediaItem,b:MediaItem) => String(b.CreatedAt||"").localeCompare(String(a.CreatedAt||""));
  return {
    total: items.length,
    counts,
    watching: items.filter(i => i.Status === "Watching").sort(sortUpdated).slice(0,8),
    favorites: items.filter(i => isTruthy(i.Favorite)).sort((a,b) => {
      const ar = num(a.FavoriteRank), br = num(b.FavoriteRank);
      if (ar && br) return ar - br;
      if (ar) return -1;
      if (br) return 1;
      return sortUpdated(a,b);
    }).slice(0,5),
    recent: [...items].sort(sortCreated).slice(0,4),
    profile
  };
}

export async function addMedia(item: SearchItem, statusInput: string) {
  const status = safeStatus(statusInput);
  const existing = await findExistingMedia(item.source, item.externalId);
  if (existing) {
    return updateStatus(existing.ID, status);
  }
  let total: number|string = item.total || "";
  if (item.type === "Movie") total = 1;
  if (item.type === "Series" && !total) total = await tvEpisodeCount(item.externalId);
  let progress = 0;
  let startDate = "";
  let finishDate = "";
  if (status === "Watching") { progress = 1; startDate = now(); }
  if (status === "Completed") { progress = num(total) || 1; finishDate = now(); }
  const t = now();
  return appendMedia({
    Title: item.title || "Sin título", Type: item.type, Status: status, Progress: progress, Total: total,
    Score: "", Year: item.year || "", PosterURL: item.posterUrl || "", BackdropURL: item.backdropUrl || "",
    Overview: item.overview || "", Source: item.source, ExternalID: item.externalId,
    AniListID: item.source === "AniList" ? item.externalId : "", TMDbID: item.source === "TMDb" ? item.externalId : "",
    MALID: "", StartDate: startDate, FinishDate: finishDate, Notes: "", Favorite: false, FavoriteRank: "",
    TrackUpdates: false, TrackPlanNews: false, CreatedAt: t, UpdatedAt: t
  });
}

export async function updateStatus(id: string, statusInput: string) {
  const found = await findMediaRowById(id); if (!found) throw new Error("Título no encontrado");
  const status = safeStatus(statusInput); const item = found.item; const total = num(item.Total); let progress = num(item.Progress);
  const patch: Record<string,unknown> = { Status: status, UpdatedAt: now() };
  if (status === "Completed") { progress = total || 1; patch.Progress = progress; patch.FinishDate = now(); }
  if (status === "Watching") { progress = progress > 0 ? progress : 1; patch.Progress = progress; patch.StartDate = item.StartDate || now(); patch.FinishDate = ""; }
  if (status === "Plan to Watch") { patch.Progress = 0; patch.StartDate = ""; patch.FinishDate = ""; }
  if (status === "On Hold" || status === "Dropped") { patch.Progress = Math.max(0,progress); patch.FinishDate = ""; }
  return updateMediaRow(id, patch);
}

export async function editMedia(id:string, changes:{Status?:string;Progress?:number|string;Score?:number|string}) {
  const found = await findMediaRowById(id); if (!found) throw new Error("Título no encontrado");
  const total = num(found.item.Total); const status = safeStatus(changes.Status || found.item.Status);
  let progress = num(changes.Progress ?? found.item.Progress); let score: number|string = changes.Score === "" || changes.Score === undefined ? "" : num(changes.Score);
  if (typeof score === "number" && (score < 1 || score > 10)) score = "";
  const patch: Record<string,unknown> = { Status: status, Score: score, UpdatedAt: now() };
  if (status === "Completed") { progress = total || 1; patch.FinishDate = now(); }
  else if (status === "Watching") { progress = progress > 0 ? progress : 1; patch.StartDate = found.item.StartDate || now(); patch.FinishDate = ""; }
  else if (status === "Plan to Watch") { progress = 0; patch.StartDate = ""; patch.FinishDate = ""; }
  else { progress = Math.max(0,progress); patch.FinishDate = ""; }
  if (total > 0 && progress > total) progress = total;
  patch.Progress = progress;
  return updateMediaRow(id, patch);
}

export async function changeProgress(id:string, direction:1|-1) {
  const found = await findMediaRowById(id); if (!found) throw new Error("Título no encontrado");
  const item = found.item; let progress = num(item.Progress); let total = num(item.Total); let status = String(item.Status); const patch:Record<string,unknown> = { UpdatedAt: now() };
  if (item.Type === "Movie") {
    total = total || 1; progress = direction === 1 ? 1 : 0; status = direction === 1 ? "Completed" : "Plan to Watch";
    Object.assign(patch, { Total: total, Progress: progress, Status: status, StartDate: direction === 1 ? item.StartDate : "", FinishDate: direction === 1 ? now() : "" });
    return updateMediaRow(id, patch);
  }
  progress = direction === 1 ? progress + 1 : Math.max(0, progress - 1);
  if (direction === 1) {
    if (total > 0 && progress >= total) { progress = total; status = "Completed"; patch.FinishDate = now(); }
    else if (status === "Plan to Watch") { status = "Watching"; patch.StartDate = item.StartDate || now(); }
  } else {
    if (progress === 0) { if (status === "Watching" || status === "Completed") status = "Plan to Watch"; patch.StartDate = ""; patch.FinishDate = ""; }
    else { if (status === "Completed") { status = "Watching"; patch.FinishDate = ""; } if (status === "Plan to Watch") { status = "Watching"; patch.StartDate = item.StartDate || now(); } }
  }
  Object.assign(patch, { Progress: progress, Status: status });
  return updateMediaRow(id, patch);
}

export async function setFavorite(id:string, value:boolean) {
  const items = await readMedia();
  const target = items.find(i => String(i.ID) === String(id));
  if (!target) throw new Error("Título no encontrado");

  const currentFavorites = items
    .filter(i => isTruthy(i.Favorite) && String(i.ID) !== String(id))
    .sort((a,b) => {
      const ar = num(a.FavoriteRank), br = num(b.FavoriteRank);
      if (ar && br) return ar - br;
      if (ar) return -1;
      if (br) return 1;
      return String(b.UpdatedAt||"").localeCompare(String(a.UpdatedAt||""));
    });

  if (value) {
    if (!isTruthy(target.Favorite) && currentFavorites.length >= 5) throw new Error("Solo puedes tener 5 favoritos.");
    const order = [...currentFavorites, target].slice(0,5).map(i=>String(i.ID));
    await updateFavoriteRanks(order);
    return updateMediaRow(id, { Favorite: true, FavoriteRank: order.indexOf(String(id)) + 1, UpdatedAt: now() });
  }

  const updated = await updateMediaRow(id, { Favorite: false, FavoriteRank: "", UpdatedAt: now() });
  await updateFavoriteRanks(currentFavorites.map(i=>String(i.ID)));
  return updated;
}

export async function reorderFavorites(ids:string[]) {
  const clean = [...new Set(ids.map(String))].slice(0,5);
  const items = await readMedia();
  const favoriteIds = new Set(items.filter(i=>isTruthy(i.Favorite)).map(i=>String(i.ID)));
  if (clean.some(id=>!favoriteIds.has(id))) throw new Error("Solo puedes ordenar títulos que están en tu Top 5.");
  await updateFavoriteRanks(clean);
  const refreshed = await readMedia();
  return refreshed
    .filter(i=>isTruthy(i.Favorite))
    .sort((a,b)=>num(a.FavoriteRank)-num(b.FavoriteRank))
    .slice(0,5);
}

export async function toggleTracking(id:string, mode:"watching"|"plan") {
  const found = await findMediaRowById(id); if (!found) throw new Error("Título no encontrado");
  const key = mode === "plan" ? "TrackPlanNews" : "TrackUpdates";
  const next = !isTruthy(found.item[key]);
  return updateMediaRow(id, { [key]: next, UpdatedAt: now() });
}

export async function removeMedia(id:string) { await deleteMediaRow(id); return { deleted:true }; }

export async function updatesData() {
  const items = await readMedia();
  const watching = items.filter(i => i.Status === "Watching" && isTruthy(i.TrackUpdates) && (i.Type === "Anime" || i.Type === "Series"));
  const plan = items.filter(i => i.Status === "Plan to Watch" && isTruthy(i.TrackPlanNews) && (i.Type === "Anime" || i.Type === "Series"));
  const get = (item:MediaItem):Promise<UpdateItem> => {
    const base = { id:String(item.ID), title:String(item.Title||"Sin título"), type:String(item.Type||""), status:String(item.Status||""), posterUrl:String(item.PosterURL||"") };
    if (item.Type === "Anime") return getAnimeUpdate(String(item.AniListID || (item.Source === "AniList" ? item.ExternalID : "")), base);
    return getSeriesUpdate(String(item.TMDbID || (item.Source === "TMDb" ? item.ExternalID : "")), base);
  };
  const [calendar, planNews] = await Promise.all([Promise.all(watching.slice(0,20).map(get)), Promise.all(plan.slice(0,20).map(get))]);
  const sort = (a:UpdateItem,b:UpdateItem) => Number(a.airingAt || a.approxSortAt || 9e15) - Number(b.airingAt || b.approxSortAt || 9e15);
  return { calendar: calendar.sort(sort), planNews: planNews.sort(sort), trackedWatchingCount: watching.length, trackedPlanCount: plan.length };
}

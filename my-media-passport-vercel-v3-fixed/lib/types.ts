export type MediaType = "Anime" | "Movie" | "Series";
export type MediaStatus = "Watching" | "Completed" | "Plan to Watch" | "On Hold" | "Dropped";

export interface MediaItem {
  ID: string;
  Title: string;
  Type: MediaType | string;
  Status: MediaStatus | string;
  Progress: number | string;
  Total: number | string;
  Score: number | string;
  Year: number | string;
  PosterURL: string;
  BackdropURL: string;
  Overview: string;
  Source: string;
  ExternalID: string;
  AniListID: string;
  TMDbID: string;
  MALID: string;
  StartDate: string;
  FinishDate: string;
  Notes: string;
  Favorite: boolean | string;
  FavoriteRank?: number | string;
  TrackUpdates?: boolean | string;
  TrackPlanNews?: boolean | string;
  CreatedAt: string;
  UpdatedAt: string;
  [key: string]: string | number | boolean | undefined;
}

export interface Profile {
  Username: string;
  Handle: string;
  AvatarURL: string;
  Bio: string;
  NowWatchingID: string;
  ThemeColor: string;
}

export interface HomeData {
  total: number;
  counts: Record<string, number>;
  watching: MediaItem[];
  favorites: MediaItem[];
  recent: MediaItem[];
  profile: Profile | null;
}

export interface SearchItem {
  title: string;
  type: MediaType;
  source: "AniList" | "TMDb";
  externalId: string;
  year: number | string;
  posterUrl: string;
  backdropUrl: string;
  overview: string;
  total: number | string;
  rating: number | string;
  voteCount: number | string;
  inList?: boolean;
  existingId?: string;
  existingStatus?: string;
  existingProgress?: number | string;
  existingTotal?: number | string;
  existingScore?: number | string;
  existingFavorite?: boolean | string;
}

export interface UpdateItem {
  id: string;
  title: string;
  type: string;
  status: string;
  posterUrl: string;
  airingAt?: number;
  approxSortAt?: number;
  approxDateText?: string;
  dateKind?: string;
  episode?: number | string;
  season?: number | string;
  label?: string;
  message: string;
  ok: boolean;
}

export interface DetailSeed {
  title: string;
  type: string;
  source: string;
  externalId: string;
  year?: number | string;
  posterUrl?: string;
  backdropUrl?: string;
  overview?: string;
  rating?: number | string;
  voteCount?: number | string;
  libraryId?: string;
  status?: string;
  progress?: number | string;
  total?: number | string;
  score?: number | string;
}

export interface TrailerInfo {
  site: "YouTube";
  key: string;
  name: string;
  official?: boolean;
}

export interface MediaDetails extends DetailSeed {
  genres?: string[];
  runtime?: number | string;
  episodes?: number | string;
  trailer?: TrailerInfo | null;
}

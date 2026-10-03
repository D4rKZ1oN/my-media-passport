import "server-only";
import { google } from "googleapis";
import type { MediaItem, Profile } from "./types";
import { isTruthy } from "./status";

const MEDIA_SHEET = "Media";
const PROFILE_SHEET = "Profile";
const OPTIONAL_MEDIA_HEADERS = ["TrackUpdates", "TrackPlanNews"];

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

function privateKey() {
  return env("GOOGLE_PRIVATE_KEY").replace(/^"|"$/g, "").replace(/\\n/g, "\n");
}

const auth = new google.auth.JWT({
  email: env("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
  key: privateKey(),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

const sheets = google.sheets({ version: "v4", auth });
const spreadsheetId = env("GOOGLE_SHEET_ID");

function columnLetter(index: number) {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

async function readRange(range: string) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return (res.data.values || []) as unknown[][];
}

async function getSheetId(title: string) {
  const res = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
  const found = res.data.sheets?.find(s => s.properties?.title === title);
  if (found?.properties?.sheetId === undefined || found.properties.sheetId === null) {
    throw new Error(`No existe la pestaña ${title}`);
  }
  return found.properties.sheetId;
}

export async function ensureMediaHeaders() {
  const rows = await readRange(`${MEDIA_SHEET}!1:1`);
  const headers = (rows[0] || []).map(v => String(v));
  const missing = OPTIONAL_MEDIA_HEADERS.filter(h => !headers.includes(h));
  if (!missing.length) return headers;
  const start = headers.length;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${MEDIA_SHEET}!${columnLetter(start)}1`,
    valueInputOption: "RAW",
    requestBody: { values: [missing] }
  });
  return headers.concat(missing);
}

function normalizeCell(value: unknown) {
  if (value === undefined || value === null) return "";
  return value;
}

export async function readMedia(): Promise<MediaItem[]> {
  const headers = await ensureMediaHeaders();
  const rows = await readRange(`${MEDIA_SHEET}!A2:ZZ`);
  return rows
    .map((row) => {
      const obj: Record<string, unknown> = {};
      headers.forEach((h, i) => { obj[h] = normalizeCell(row[i]); });
      obj.Favorite = isTruthy(obj.Favorite);
      obj.TrackUpdates = isTruthy(obj.TrackUpdates);
      obj.TrackPlanNews = isTruthy(obj.TrackPlanNews);
      return obj as MediaItem;
    })
    .filter(item => String(item.Title || "").trim() !== "");
}

export async function readProfile(): Promise<Profile | null> {
  const rows = await readRange(`${PROFILE_SHEET}!A1:ZZ2`);
  if (rows.length < 2) return null;
  const headers = rows[0].map(v => String(v));
  const row = rows[1];
  const obj: Record<string, string> = {};
  headers.forEach((h, i) => { obj[h] = String(row[i] ?? ""); });
  return {
    Username: obj.Username || "DK04",
    Handle: obj.Handle || "@dk04",
    AvatarURL: obj.AvatarURL || "",
    Bio: obj.Bio || "",
    NowWatchingID: obj.NowWatchingID || "",
    ThemeColor: obj.ThemeColor || "#00d999"
  };
}

async function mediaTable() {
  const headers = await ensureMediaHeaders();
  const rows = await readRange(`${MEDIA_SHEET}!A2:ZZ`);
  return { headers, rows };
}

export async function findMediaRowById(id: string) {
  const { headers, rows } = await mediaTable();
  const idIndex = headers.indexOf("ID");
  const idx = rows.findIndex(r => String(r[idIndex] ?? "") === String(id));
  if (idx < 0) return null;
  const obj: Record<string, unknown> = {};
  headers.forEach((h, i) => { obj[h] = normalizeCell(rows[idx][i]); });
  obj.Favorite = isTruthy(obj.Favorite);
  obj.TrackUpdates = isTruthy(obj.TrackUpdates);
  obj.TrackPlanNews = isTruthy(obj.TrackPlanNews);
  return { rowNumber: idx + 2, headers, item: obj as MediaItem };
}

export async function findExistingMedia(source: string, externalId: string) {
  const items = await readMedia();
  return items.find(i => String(i.Source) === source && String(i.ExternalID) === externalId) || null;
}

export async function updateMediaRow(id: string, patch: Record<string, unknown>) {
  const found = await findMediaRowById(id);
  if (!found) throw new Error("Título no encontrado");
  const data = Object.entries(patch)
    .filter(([key]) => found.headers.includes(key))
    .map(([key, value]) => {
      const col = found.headers.indexOf(key);
      return { range: `${MEDIA_SHEET}!${columnLetter(col)}${found.rowNumber}`, values: [[value ?? ""]] };
    });
  if (data.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "USER_ENTERED", data }
    });
  }
  return { ...found.item, ...patch } as MediaItem;
}

export async function appendMedia(values: Record<string, unknown>) {
  const headers = await ensureMediaHeaders();
  const items = await readMedia();
  const maxId = items.reduce((m, i) => Math.max(m, Number(i.ID || 0) || 0), 0);
  const complete: Record<string, unknown> = { ...values, ID: String(maxId + 1) };
  const row = headers.map((h) => complete[h] ?? "");
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${MEDIA_SHEET}!A:ZZ`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] }
  });
  return complete as MediaItem;
}

export async function deleteMediaRow(id: string) {
  const found = await findMediaRowById(id);
  if (!found) throw new Error("Título no encontrado");
  const sheetId = await getSheetId(MEDIA_SHEET);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: found.rowNumber - 1, endIndex: found.rowNumber } } }]
    }
  });
}

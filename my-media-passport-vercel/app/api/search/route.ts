import { NextRequest, NextResponse } from "next/server";
import { searchAnime } from "@/lib/providers/anilist";
import { searchTMDb } from "@/lib/providers/tmdb";
import { readMedia } from "@/lib/sheets";
export const dynamic = "force-dynamic";
export async function GET(req:NextRequest){
  try{
    const q=(req.nextUrl.searchParams.get("q")||"").trim(); const type=req.nextUrl.searchParams.get("type")||"All";
    if(!q) return NextResponse.json([]);
    const jobs:Promise<any[]>[]=[];
    if(type==="All"||type==="Anime") jobs.push(searchAnime(q));
    if(type==="All"||type==="Movie") jobs.push(searchTMDb(q,"Movie"));
    if(type==="All"||type==="Series") jobs.push(searchTMDb(q,"Series"));
    const [parts, existing]=await Promise.all([Promise.all(jobs),readMedia()]);
    const map=new Map(existing.map(i=>[`${i.Source}|${i.ExternalID}`,i]));
    const results=parts.flat().map(item=>{ const e=map.get(`${item.source}|${item.externalId}`); return e?{...item,inList:true,existingId:e.ID,existingStatus:e.Status,existingProgress:e.Progress,existingTotal:e.Total,existingScore:e.Score,existingFavorite:e.Favorite}:{...item,inList:false}; });
    return NextResponse.json(results);
  }catch(e){ return NextResponse.json({error:e instanceof Error?e.message:"Error"},{status:500}); }
}

import { NextResponse } from "next/server";
import { trendingAnime } from "@/lib/providers/anilist";
import { discoveryTMDb } from "@/lib/providers/tmdb";
import { readMedia } from "@/lib/sheets";
export const dynamic = "force-dynamic";
export async function GET(){
  try{
    const [anime,moviesSeries,existing]=await Promise.all([trendingAnime(),discoveryTMDb(),readMedia()]);
    const map=new Map(existing.map(i=>[`${i.Source}|${i.ExternalID}`,i]));
    const annotate=(items:any[])=>items.map(item=>{const e=map.get(`${item.source}|${item.externalId}`);return e?{...item,inList:true,existingId:e.ID,existingStatus:e.Status,existingProgress:e.Progress,existingTotal:e.Total,existingScore:e.Score,existingFavorite:e.Favorite}:{...item,inList:false};});
    return NextResponse.json({anime:annotate(anime),moviesSeries:annotate(moviesSeries)});
  }catch(e){ return NextResponse.json({error:e instanceof Error?e.message:"Error"},{status:500}); }
}

import { NextResponse } from "next/server";
import { updatesData } from "@/lib/media-service";
export const dynamic = "force-dynamic";
export async function GET(){ try{return NextResponse.json(await updatesData());}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Error"},{status:500});} }

import { NextResponse } from "next/server";
import { readMedia } from "@/lib/sheets";
export const dynamic = "force-dynamic";
export async function GET(){ try { return NextResponse.json(await readMedia()); } catch(e){ return NextResponse.json({error:e instanceof Error?e.message:"Error"},{status:500}); } }

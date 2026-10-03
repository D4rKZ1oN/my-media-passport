import { NextRequest, NextResponse } from "next/server";
import { addMedia } from "@/lib/media-service";
import { z } from "zod";
const schema=z.object({item:z.any(),status:z.string().optional()});
export async function POST(req:NextRequest){try{const body=schema.parse(await req.json());return NextResponse.json(await addMedia(body.item,body.status||"Plan to Watch"));}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Error"},{status:400});}}

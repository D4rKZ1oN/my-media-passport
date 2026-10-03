import { NextRequest, NextResponse } from "next/server";
import { reorderFavorites } from "@/lib/media-service";
import { z } from "zod";

const schema = z.object({ ids: z.array(z.string()).max(5) });

export async function POST(req: NextRequest) {
  try {
    const { ids } = schema.parse(await req.json());
    return NextResponse.json(await reorderFavorites(ids));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 400 });
  }
}

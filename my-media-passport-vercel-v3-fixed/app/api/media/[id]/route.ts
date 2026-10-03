import { NextRequest, NextResponse } from "next/server";
import { changeProgress, editMedia, removeMedia, setFavorite, toggleTracking, updateStatus } from "@/lib/media-service";
export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  try{
    const {id}=await params; const body=await req.json();
    let result;
    if(body.action==="increment") result=await changeProgress(id,1);
    else if(body.action==="decrement") result=await changeProgress(id,-1);
    else if(body.action==="favorite") result=await setFavorite(id,Boolean(body.value));
    else if(body.action==="tracking") result=await toggleTracking(id,body.mode==="plan"?"plan":"watching");
    else if(body.action==="status") result=await updateStatus(id,String(body.status||"Plan to Watch"));
    else result=await editMedia(id,body);
    return NextResponse.json(result);
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Error"},{status:400});}
}
export async function DELETE(_req:NextRequest,{params}:{params:Promise<{id:string}>}){try{const {id}=await params;return NextResponse.json(await removeMedia(id));}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Error"},{status:400});}}

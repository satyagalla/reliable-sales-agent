import { NextRequest,NextResponse } from 'next/server';
import { verify,ingest } from '@/lib/ingest';
export const runtime='nodejs';
export async function POST(req:NextRequest){
  const raw=await req.text();if(raw.length>40000)return NextResponse.json({error:'Payload too large'},{status:413});
  try{verify(raw,req.headers.get('x-trust-timestamp'),req.headers.get('x-trust-signature'));}catch{return NextResponse.json({error:'Signature rejected'},{status:401});}
  try{return NextResponse.json(ingest(JSON.parse(raw),'signed_webhook'),{status:202});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Invalid event'},{status:400});}
}

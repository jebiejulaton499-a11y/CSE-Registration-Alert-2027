import type { VercelRequest,VercelResponse } from '@vercel/node';
import { db, ipBucket } from '../src/server/shared';
export function reply(res:VercelResponse,status:number,body:unknown) {res.setHeader('Cache-Control','no-store');return res.status(status).json(body);}
export async function limit(req:VercelRequest,res:VercelResponse,route:string,max=20) {
  const ip=String(req.headers['x-real-ip']||req.headers['x-forwarded-for']||'unknown').split(',')[0].trim();
  const {data,error}=await db().rpc('consume_api_limit',{p_bucket:ipBucket(ip,route),p_max:max,p_window_seconds:3600});
  if(error) throw error;
  if(!data){reply(res,429,{error:'Rate limit exceeded'});return false;}
  return true;
}

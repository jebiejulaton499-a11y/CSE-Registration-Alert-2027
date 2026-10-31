import type { VercelRequest,VercelResponse } from '@vercel/node';
import { db,settingsSchema,tokenHash,tokenSchema } from '../src/server/shared';
import { limit,reply } from './_common';
import { messaging } from '../src/server/firebase';
import { z } from 'zod';
const bodySchema=z.object({token:tokenSchema,settings:settingsSchema.optional()});
export default async function handler(req:VercelRequest,res:VercelResponse) {
  if(!['POST','PATCH','DELETE'].includes(req.method||'')) return reply(res,405,{error:'Method not allowed'});
  try {
    if(!await limit(req,res,'subscription',15)) return;
    const input=bodySchema.parse(req.body);
    const client=db(), hash=tokenHash(input.token);
    if(req.method==='DELETE') {
      const {error}=await client.from('notification_subscriptions').delete().eq('token_hash',hash);
      if(error) throw error;
      return reply(res,200,{enabled:false});
    }
    if(req.method==='PATCH') {
      if(!input.settings) return reply(res,400,{error:'Settings required'});
      const {data,error}=await client.from('notification_subscriptions').update({...input.settings,updated_at:new Date().toISOString()}).eq('token_hash',hash).select('id').maybeSingle();
      if(error) throw error;
      return reply(res,data?200:404,{enabled:!!data});
    }
    if(!input.settings) return reply(res,400,{error:'Settings required'});
    // FCM validates the token by attempting a dry-run send; no message is delivered.
    await messaging().send({token:input.token,data:{kind:'validation'}},true);
    const {error}=await client.from('notification_subscriptions').upsert({token_hash:hash,device_token:input.token,...input.settings,enabled:true,updated_at:new Date().toISOString()},{onConflict:'token_hash'});
    if(error) throw error;
    return reply(res,200,{enabled:true});
  } catch(error) {
    if(error instanceof z.ZodError) return reply(res,400,{error:'Invalid subscription request'});
    console.error(error); return reply(res,503,{error:'Subscription unavailable or token invalid'});
  }
}

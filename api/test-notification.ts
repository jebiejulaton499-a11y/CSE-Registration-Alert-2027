import type { VercelRequest,VercelResponse } from '@vercel/node';
import { db,tokenHash,tokenSchema } from '../src/server/shared';
import { limit,reply } from './_common';
import { messaging } from '../src/server/firebase';
export default async function handler(req:VercelRequest,res:VercelResponse) {
  if(req.method!=='POST') return reply(res,405,{error:'Method not allowed'});
  try {
    if(!await limit(req,res,'test',3)) return;
    const token=tokenSchema.parse(req.body?.token),client=db();
    const {data:sub}=await client.from('notification_subscriptions').select('id,device_token').eq('token_hash',tokenHash(token)).eq('enabled',true).maybeSingle();
    if(!sub) return reply(res,404,{error:'Subscription not found'});
    const day=new Date().toISOString().slice(0,10);
    const {data:claim,error}=await client.from('notification_history').upsert({subscription_id:sub.id,event_key:`test:${day}`,event_type:'test',notification_title:'CSE Alert test',notification_message:'Your notifications are working.',delivery_status:'pending'},{onConflict:'subscription_id,event_key',ignoreDuplicates:true}).select('id').maybeSingle();
    if(error) throw error;
    if(!claim) return reply(res,429,{error:'One test notification per day'});
    await messaging().send({token:sub.device_token,data:{title:'CSE Alert test',body:'Your notifications are working.',url:process.env.PUBLIC_BASE_URL||'/'}});
    await client.from('notification_history').update({delivery_status:'sent',delivered_at:new Date().toISOString()}).eq('id',claim.id);
    return reply(res,200,{sent:true});
  } catch(error) {console.error(error);return reply(res,503,{error:'Could not send test notification'});}
}

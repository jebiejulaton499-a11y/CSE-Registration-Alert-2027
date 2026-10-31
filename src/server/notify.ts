import { db } from './shared.js';
import { messaging } from './firebase.js';

export type Event = {key:string;type:'opening'|'slots'|'announcement'|'closing';title:string;message:string;sourceUrl:string;level?:string};
export async function sendEvent(event:Event) {
  const client=db();
  const {data:subs,error}=await client.from('notification_subscriptions').select('*').eq('enabled',true).eq('region','Region V').eq('testing_location','Masbate');
  if(error) throw error;
  for(const sub of subs ?? []) {
    if(event.level && !sub[event.level]) continue;
    if(!sub[`${event.type === 'slots' ? 'slot' : event.type}_alerts`]) continue;
    const {data:claim,error:claimError}=await client.from('notification_history').upsert({subscription_id:sub.id,event_key:event.key,event_type:event.type,notification_title:event.title,notification_message:event.message,source_url:event.sourceUrl},{onConflict:'subscription_id,event_key',ignoreDuplicates:true}).select('id').maybeSingle();
    if(claimError) throw claimError;
    if(!claim) continue;
    try {
      await messaging().send({token:sub.device_token,data:{title:event.title,body:event.message,url:event.sourceUrl}});
      await client.from('notification_history').update({delivery_status:'sent',delivered_at:new Date().toISOString()}).eq('id',claim.id);
    } catch(e) {
      await client.from('notification_history').update({delivery_status:'failed'}).eq('id',claim.id);
      console.error('FCM delivery failed',e);
    }
  }
}

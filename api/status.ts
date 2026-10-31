import type { VercelRequest,VercelResponse } from '@vercel/node';
import { db,EXAM_DATE,LOCATION,REGION } from '../src/server/shared.js';
import { reply } from './_common.js';
export default async function handler(req:VercelRequest,res:VercelResponse) {
  if(req.method!=='GET') return reply(res,405,{error:'Method not allowed'});
  try {
    const client=db();
    const [statuses,announcements,logs]=await Promise.all([
      client.from('registration_status').select('exam_date,region,testing_location,exam_level,status,opening_at,verified_source_url,verification_method,evidence,checked_at').eq('exam_date',EXAM_DATE).eq('region',REGION).eq('testing_location',LOCATION),
      client.from('announcements').select('title,source_url,published_at,discovered_at').eq('relevant',true).order('discovered_at',{ascending:false}).limit(10),
      client.from('monitoring_logs').select('checked_at,source_url,detected_status,verification_result').order('checked_at',{ascending:false}).limit(20)
    ]);
    if(statuses.error||announcements.error||logs.error) throw statuses.error||announcements.error||logs.error;
    return reply(res,200,{statuses:statuses.data,announcements:announcements.data,history:logs.data,serverTime:new Date().toISOString()});
  } catch(error) {console.error(error);return reply(res,503,{error:'Status temporarily unavailable'});}
}

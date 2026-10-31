import { db, EXAM_DATE, LEVELS, LOCATION, REGION, officialUrl, contentDigest } from './shared.js';
import { classifyPublicPage, type Evidence } from './verify.js';
import { sendEvent } from './notify.js';

const sources=['https://www.csc.gov.ph/','https://services.csc.gov.ph/'];
async function permitted(url:string) {
  const u=new URL(url); const robots=await fetch(`${u.origin}/robots.txt`,{signal:AbortSignal.timeout(10000)});
  if(!robots.ok) return false;
  const text=await robots.text();
  let applies=false;
  for(const raw of text.split(/\r?\n/)) {
    const line=raw.split('#')[0].trim();
    if(/^user-agent:/i.test(line)) applies=/^user-agent:\s*\*/i.test(line);
    if(applies && /^disallow:/i.test(line)) {
      const path=line.replace(/^disallow:\s*/i,'').trim();
      if(path && u.pathname.startsWith(path)) return false;
    }
  }
  return true;
}
async function readOfficial(url:string):Promise<{evidence:Evidence;httpStatus:number|null}> {
  if(!officialUrl(url)) throw new Error('Nonofficial URL rejected');
  if(!await permitted(url)) throw new Error('robots.txt unavailable or disallows path');
  const response=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{'User-Agent':'CSERegistrationAlert/1.0 (+independent monitoring; one hourly request)'}});
  if(!response.ok) throw new Error(`HTTP ${response.status}`);
  const html=(await response.text()).slice(0,1_000_000);
  return {evidence:classifyPublicPage(url,html),httpStatus:response.status};
}
export async function runCheck() {
  const client=db(); const evidence:Evidence[]=[]; let success=0;
  for(const url of sources) {
    try {
      const result=await readOfficial(url); evidence.push(result.evidence); success++;
      await client.from('monitoring_logs').insert({source_url:url,http_status:result.httpStatus,detected_status:result.evidence.status,verification_result:result.evidence.detail});
      const page=result.evidence;
      if(page.status==='announced'||page.status==='verification_required') {
        const key=contentDigest(`${EXAM_DATE}:${page.sourceUrl}:${page.detail}`);
        const {data}=await client.from('announcements').upsert({title:'CSC page mentions the target CSE',source_url:url,relevant:true},{onConflict:'source_url',ignoreDuplicates:true}).select('id').maybeSingle();
        if(data) await sendEvent({key:`announcement:${key}`,type:'announcement',title:'New CSC Announcement',message:'An official CSC page mentions the 2027 Civil Service Examination. Review the source for details.',sourceUrl:url});
      }
    } catch(error) {
      await client.from('monitoring_logs').insert({source_url:url,verification_result:'failed',error_message:String(error).slice(0,500)});
      console.error(url,error);
    }
    await new Promise(resolve=>setTimeout(resolve,1500));
  }
  if(!success) return;
  const chosen=evidence.find(e=>e.status==='closed') ?? evidence.find(e=>e.status==='verification_required') ?? evidence.find(e=>e.status==='announced');
  if(!chosen) return;
  for(const level of LEVELS) {
    const match={exam_date:EXAM_DATE,region:REGION,testing_location:LOCATION,exam_level:level};
    const {data:old}=await client.from('registration_status').select('status').match(match).maybeSingle();
    const status=chosen.status==='closed' ? 'verification_required' : chosen.status; // closure cannot be inferred per level from a generic page
    const {error}=await client.from('registration_status').upsert({...match,status,verified_source_url:chosen.sourceUrl,verification_method:chosen.method,evidence:chosen.detail,checked_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:'exam_date,region,testing_location,exam_level'});
    if(error) throw error;
    if(old?.status!==status && status==='open') await sendEvent({key:`open:${EXAM_DATE}:${level}`,type:'opening',title:'CSE 2027 REGISTRATION IS OPEN!',message:'Verified CSC registration is accepting applications. Check Masbate availability through the official portal.',sourceUrl:chosen.sourceUrl!,level});
  }
}
if(process.argv[1]?.endsWith('checker.ts')) runCheck().catch(e=>{console.error(e);process.exitCode=1;});

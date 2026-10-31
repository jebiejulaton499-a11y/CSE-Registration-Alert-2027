import { EXAM_DATE, LOCATION, REGION, officialUrl } from './shared.js';

export type Status = 'not_verified'|'announced'|'opening_soon'|'open'|'closed'|'verification_failed'|'verification_required';
export type Evidence = { status:Status; sourceUrl:string|null; method:string; detail:string; openingAt?:string|null };
const target = /(?:march\s+14,?\s+2027|14\s+march\s+2027|2027[-/]03[-/]14)/i;
const exam = /(?:civil service examination|cse[- ]?ppt|career service examination)/i;
const location = /(?:masbate|region\s*(?:v|5)|bicol)/i;
const active = /(?:applications?\s+(?:are\s+)?(?:now\s+)?open|accepting\s+applications?|registration\s+(?:is\s+)?open)/i;
const closed = /(?:registration\s+(?:is\s+)?closed|slots?\s+(?:are\s+)?full|no\s+(?:available\s+)?slots?)/i;
export function classifyPublicPage(url:string, html:string):Evidence {
  if (!officialUrl(url)) return {status:'verification_failed',sourceUrl:null,method:'URL validation',detail:'Untrusted source'};
  const text=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ');
  if (!target.test(text) || !exam.test(text) || !location.test(text)) return {status:'not_verified',sourceUrl:url,method:'public page text',detail:'Target exam and location not all present'};
  if (closed.test(text)) return {status:'closed',sourceUrl:url,method:'public page text',detail:'Official page states closed or full'};
  if (active.test(text)) return {status:'verification_required',sourceUrl:url,method:'public announcement',detail:'Open wording found, but live application and Masbate slot availability are not independently verifiable'};
  return {status:'announced',sourceUrl:url,method:'public announcement',detail:'Relevant official announcement found; availability unverified'};
}
export function verifiedOpenFromStructuredSlot(input:{sourceUrl:string;examDate:string;region:string;location:string;level:string;available:boolean;acceptingApplications:boolean}):Evidence {
  if (!officialUrl(input.sourceUrl)||input.examDate!==EXAM_DATE||input.region!==REGION||input.location!==LOCATION||!['professional','subprofessional'].includes(input.level)||!input.available||!input.acceptingApplications)
    return {status:'verification_required',sourceUrl:officialUrl(input.sourceUrl)?input.sourceUrl:null,method:'structured slot check',detail:'No verified matching live slot'};
  return {status:'open',sourceUrl:input.sourceUrl,method:'structured slot check',detail:'Official public interface confirms accepting applications and available matching slot'};
}

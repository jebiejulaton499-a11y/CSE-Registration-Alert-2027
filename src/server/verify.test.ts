import {describe,it,expect} from 'vitest';
import {classifyPublicPage,verifiedOpenFromStructuredSlot} from './verify';
const url='https://www.csc.gov.ph/';
const page='Civil Service Examination March 14, 2027 Region V Masbate Professional registration is open';
describe('official evidence gate',()=>{
 it('does not call an announcement an available slot',()=>expect(classifyPublicPage(url,page).status).toBe('verification_required'));
 it('rejects unrelated and untrusted pages',()=>{expect(classifyPublicPage(url,'General news').status).toBe('not_verified');expect(classifyPublicPage('https://example.com',page).status).toBe('verification_failed')});
 it('requires a live matching structured slot',()=>{const base={sourceUrl:'https://services.csc.gov.ph/',examDate:'2027-03-14',region:'Region V',location:'Masbate',level:'professional',available:true,acceptingApplications:true};expect(verifiedOpenFromStructuredSlot(base).status).toBe('open');expect(verifiedOpenFromStructuredSlot({...base,available:false}).status).toBe('verification_required');expect(verifiedOpenFromStructuredSlot({...base,location:'Legazpi'}).status).toBe('verification_required')});
});

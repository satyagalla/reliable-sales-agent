import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import fc from 'fast-check';
import { createHmac } from 'node:crypto';
import { db,one,all,tx } from '../src/lib/db';
import { ingest,verify } from '../src/lib/ingest';
import { catalogue,tenant,trust } from '../src/lib/catalogue';
import { fixture } from '../src/lib/fixtures';
import { priceDraft,decide,renderReply } from '../src/lib/policy';
import { draftSchema,ChannelEvent,normalize } from '../src/lib/domain';
import { claim,persistDraft,review,dispatchOne,recover } from '../src/lib/workflow';
import { setTrust,calibration,runEvaluation } from '../src/lib/quality';
process.env.TRUST_DESK_DB=join(mkdtempSync(join(tmpdir(),'trust-desk-test-')),'test.sqlite');
const tenants=JSON.parse(readFileSync('Seed Kit/tenants.json','utf8')).tenants;
for(const t of tenants){db().prepare('INSERT INTO tenants(id,config) VALUES(?,?)').run(t.id,JSON.stringify(t));const prices=JSON.parse(readFileSync(`Seed Kit/prices-${t.id}.json`,'utf8'));for(const r of prices.rows)db().prepare('INSERT INTO prices(tenant,row_id,version,data) VALUES(?,?,?,?)').run(t.id,r.id,prices.version,JSON.stringify(r));}
let seq=0;
function event(patch:Partial<ChannelEvent>={}):ChannelEvent{seq++;return {event_id:'test'+seq,channel:'email',to:'sales@qamar.example',from:'customer'+seq+'@example.test',message_id:'msg'+seq,sent_at:new Date(Date.now()+seq*1000).toISOString(),received_at:new Date().toISOString(),text:'Please quote a MacBook for 3 months in Dubai',...patch};}
function child(mode:string,input:unknown){return new Promise<number|null>((resolve,reject)=>{const p=spawn(process.execPath,['--import','tsx','tests/helpers/child.ts',mode,JSON.stringify(input)],{env:process.env,stdio:'pipe'});let stderr='';p.stderr.on('data',d=>stderr+=d);p.on('error',reject);p.on('exit',code=>{if(code!==0&&code!==2)reject(Error(stderr));else resolve(code);});});}
test('signature fails closed, expires, and binds every byte',()=>{
 process.env.WEBHOOK_SECRET='unit-test-secret';const raw=JSON.stringify(event()),ts=String(Date.now());const sig=createHmac('sha256',process.env.WEBHOOK_SECRET).update(ts+'.'+raw).digest('hex');
 assert.doesNotThrow(()=>verify(raw,ts,sig));assert.throws(()=>verify(raw,null,null));assert.throws(()=>verify(raw+' ',ts,sig));assert.throws(()=>verify(raw,'1',sig));delete process.env.WEBHOOK_SECRET;assert.throws(()=>verify(raw,ts,sig));
});
test('four simultaneous processes dedupe using the database constraint',async()=>{
 const e=event();assert.deepEqual(await Promise.all(Array.from({length:4},()=>child('ingest',e))),[0,0,0,0]);
 assert.equal(one<{n:number}>('SELECT count(*) n FROM events WHERE message_id=?',e.message_id)!.n,1);
});
test('tenant derives from channel recipient, ignores spoofed metadata and rejects unknown recipients',()=>{
 const e=event({to:'events@rimal.example',metadata:{tenant_id:'qamar'}});const r=ingest(e,'seed_cli');assert.equal(r.tenant,'rimal');assert.throws(()=>ingest(event({to:'unknown@example.test'}),'seed_cli'));
 assert.throws(()=>priceDraft(tenant('rimal'),catalogue('rimal'),fixture('evt_0001')));
});
test('minor-unit money holds for random quantities and durations; service is once, VAT half-up',()=>{
 fc.assert(fc.property(fc.integer({min:1,max:10000}),fc.integer({min:1,max:12}),fc.integer({min:0,max:100}),(q,p,discount)=>{
   const d=fixture('evt_0001');d.lines[0].quantity=q;d.lines[0].periods=p;d.discount_pct=discount;const priced=priceDraft(tenant('qamar'),catalogue('qamar'),d);
   const subtotal=18000*q*p+15000,off=Math.floor((subtotal*discount+50)/100),net=subtotal-off;
   assert.equal(priced.subtotal,subtotal);assert.equal(priced.discount,off);assert.equal(priced.vat,Math.floor((net*500+5000)/10000));assert.equal(priced.total,priced.net+priced.vat);assert.ok(Number.isSafeInteger(priced.total));assert.equal(priced.lines.filter(l=>l.row_id==='Q-SVC-001').length,1);
 }),{numRuns:500});
});
test('strict draft schema rejects invented fields, fractional and negative quantities',()=>{
 const d=fixture('evt_0001');assert.throws(()=>draftSchema.parse({...d,decision:'auto_send'}));assert.throws(()=>draftSchema.parse({...d,lines:[{...d.lines[0],quantity:-1}]}));assert.throws(()=>draftSchema.parse({...d,lines:[{...d.lines[0],quantity:1.5}]}));
});
test('Rimal 15% VAT, minimum, and crew area boundaries are deterministic',()=>{
 const t=tenant('rimal');const d=fixture('evt_0009'),p=priceDraft(t,catalogue(t.id),d);assert.equal(p.total,1260400);assert.equal(p.lines.filter(l=>l.row_id==='R-CRW-001').length,1);
 d.lines=[{row_id:'R-MIC-001',quantity:1,periods:1,mode:'rent'}];const low=priceDraft(t,catalogue(t.id),d);assert.equal(decide(t,d,low,'autonomous').decision,'hand_off');
 d.lines=[{row_id:'R-LED-001',quantity:6,periods:1,mode:'rent'}];assert.equal(priceDraft(t,catalogue(t.id),d).lines.length,1);d.lines[0].quantity=7;assert.equal(priceDraft(t,catalogue(t.id),d).lines.length,2);
});
test('autonomous requires all three conditions; quotes and commitments always need approval',()=>{
 const t=tenant('qamar'),d=fixture('evt_0001');d.intent='faq';d.lines=[];d.missing=[];d.risk='low';const p=priceDraft(t,catalogue(t.id),d);
 assert.equal(decide(t,d,p,'supervised').decision,'needs_approval');assert.equal(decide(t,d,p,'autonomous').decision,'auto_send');assert.equal(decide({...t,auto_send:'off'},d,p,'autonomous').decision,'needs_approval');
 d.commitments=['delivery'];assert.equal(decide(t,d,p,'autonomous').decision,'needs_approval');d.commitments=[];d.discount_pct=10;assert.equal(decide(t,d,p,'autonomous').decision,'needs_approval');
 const rt=tenant('rimal');d.discount_pct=0;assert.equal(decide(rt,d,priceDraft(rt,catalogue(rt.id),d),'autonomous').decision,'needs_approval');
});
test('Arabic/Persian digits normalize and outbound totals stay in RTL-friendly Arabic',()=>{
 assert.equal(normalize('٥ × ۳\u202e'),'5 × 3');const d=fixture('evt_0002'),t=tenant('qamar'),p=priceDraft(t,catalogue(t.id),d);assert.equal(p.total,1800225);assert.match(renderReply(t,d,p),/ضريبة القيمة المضافة/);
});
test('superseded worker result cannot create a draft or be approved',()=>{
 const older=event({from:'correction@example.test'}),r=ingest(older,'seed_cli');const job=claim();assert.ok(job); // Other queued test events may be claimed first.
 db().prepare("UPDATE events SET state='processing',token='old-token' WHERE id=?").run(r.id);
 ingest(event({from:older.from,sent_at:new Date(new Date(older.sent_at).getTime()+10000).toISOString()}),'seed_cli');
 assert.equal(persistDraft({id:r.id,tenant:r.tenant,token:'old-token'},fixture('evt_0001'),'fixture'),undefined);
 assert.equal(one<{n:number}>('SELECT count(*) n FROM drafts WHERE event_id=?',r.id)!.n,0);
});
test('concurrent approvals commit one decision and exactly one outbox record',async()=>{
 const r=ingest(event(),'seed_cli'),draftId=persistDraft(r,fixture('evt_0001'),'fixture')!;
 const request={tenant:'qamar',draftId,version:0,approver:'u_aisha',action:'approve'};
 const statuses=await Promise.all([child('review',request),child('review',request)]);assert.deepEqual(statuses.sort(),[0,2]);assert.equal(one<{n:number}>('SELECT count(*) n FROM outbox WHERE draft_id=?',draftId)!.n,1);
 assert.throws(()=>review({...request,action:'approve',tenant:'rimal',approver:'u_faisal'}));
});
test('uncertain outbound delivery never retries after a transport error',async()=>{
 let sends=0;await dispatchOne(async()=>{sends++;throw Error('Connection lost after write');});while(await dispatchOne(async()=>{sends++;return 'ok';})){}assert.equal(sends,1);assert.equal(one<{n:number}>("SELECT count(*) n FROM outbox WHERE state='uncertain'")!.n,1);
});
test('new customer message cancels pending outbound before dispatch',()=>{
 const e=event(),r=ingest(e,'seed_cli'),draftId=persistDraft(r,fixture('evt_0001'),'fixture')!;review({tenant:'qamar',draftId,version:0,approver:'u_aisha',action:'approve'});
 ingest(event({from:e.from,sent_at:new Date(new Date(e.sent_at).getTime()+1000).toISOString()}),'seed_cli');assert.equal(one<{state:string}>('SELECT state FROM outbox WHERE draft_id=?',draftId)!.state,'cancelled');
});
test('expired lease becomes dead letter after bounded attempts',()=>{
 const r=ingest(event(),'seed_cli');db().prepare("UPDATE events SET state='processing',attempts=3,lease_until=0,token='expired' WHERE id=?").run(r.id);recover();assert.equal(one<{state:string}>('SELECT state FROM events WHERE id=?',r.id)!.state,'dead');
});
test('trust cannot promote without live evidence; calibration excludes not assessable dimensions',()=>{
 assert.throws(()=>setTrust('qamar','autonomous','system','not human'));assert.throws(()=>setTrust('qamar','autonomous','u_aisha','missing live evidence'));assert.equal(trust('qamar'),'supervised');
 const j=JSON.stringify({grounding:{score:2},instruction_resistance:{score:null},language_helpfulness:{score:1}}),h=JSON.stringify({scores:{grounding:2,instruction_resistance:2,language_helpfulness:0}});
 assert.deepEqual(calibration([{human:h,judge:j}]),{labelled:1,assessed:2,matched:1,notAssessable:1,agreement:0.5});
 db().prepare("UPDATE tenants SET trust='autonomous' WHERE id='qamar'").run();setTrust('qamar','supervised','system','regression');assert.equal(trust('qamar'),'supervised');
});
test('36 versioned baseline cases pass; deliberately degraded run is rejected',async()=>{
 const baseline=await runEvaluation('baseline','fixture'),degraded=await runEvaluation('degraded','fixture');
 const b=JSON.parse(one<{summary:string}>('SELECT summary FROM runs WHERE id=?',baseline)!.summary),d=JSON.parse(one<{summary:string}>('SELECT summary FROM runs WHERE id=?',degraded)!.summary);
 assert.equal(b.total,36);assert.equal(b.failed,0,JSON.stringify(all('SELECT case_id,checks FROM results WHERE run_id=?',baseline)));assert.equal(b.gate_pass,true);assert.equal(d.gate_pass,false);assert.equal(d.failed,36);
});

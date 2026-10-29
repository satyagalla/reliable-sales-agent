import { createHmac, timingSafeEqual, createHash } from 'node:crypto';
import { all, audit, db, id, one, tx } from './db';
import { eventSchema, ChannelEvent, Tenant } from './domain';
export function verify(raw:string,timestamp:string|null,signature:string|null){
  const secret=process.env.WEBHOOK_SECRET;
  if(!secret||!timestamp||!signature||!/^\d{10,13}$/.test(timestamp))throw Error('Missing signature configuration or headers');
  const time=Number(timestamp)*(timestamp.length===10?1000:1);
  if(Math.abs(Date.now()-time)>300000)throw Error('Expired signature');
  const expected=createHmac('sha256',secret).update(timestamp+'.'+raw).digest('hex');
  if(!/^[a-f0-9]{64}$/.test(signature)||!timingSafeEqual(Buffer.from(expected),Buffer.from(signature)))throw Error('Invalid signature');
}
export function ingest(input:unknown,source:'signed_webhook'|'seed_cli'){
  const e=eventSchema.parse(input);e.sent_at=new Date(e.sent_at).toISOString();e.received_at=new Date(e.received_at).toISOString();
  const matches=all<{id:string;config:string}>('SELECT id,config FROM tenants').filter(r=>(JSON.parse(r.config) as Tenant).channels.some(c=>c.channel===e.channel&&c.address.toLowerCase()===e.to.toLowerCase()));
  if(matches.length!==1)throw Error('Recipient does not resolve to exactly one tenant');
  const tenant=matches[0].id;
  const thread=createHash('sha256').update(JSON.stringify([tenant,e.channel,e.from])).digest('hex');
  return tx(()=>{
    const existing=one<{id:string}>('SELECT id FROM events WHERE tenant=? AND channel=? AND message_id=?',tenant,e.channel,e.message_id);
    if(existing){audit(tenant,existing.id,'duplicate',{event_id:e.event_id,source});return {id:existing.id,duplicate:true,tenant};}
    const key=id();
    const newer=one('SELECT id FROM events WHERE tenant=? AND thread=? AND sent_at>=?',tenant,thread,e.sent_at);
    db().prepare('INSERT INTO events(id,tenant,channel,message_id,thread,sent_at,payload,state) VALUES(?,?,?,?,?,?,?,?)').run(key,tenant,e.channel,e.message_id,thread,e.sent_at,JSON.stringify(e),newer?'superseded':'queued');
    if(!newer){
      db().prepare("UPDATE outbox SET state='cancelled' WHERE state='pending' AND draft_id IN (SELECT d.id FROM drafts d JOIN events e ON e.id=d.event_id WHERE e.tenant=? AND e.thread=? AND e.sent_at<?)").run(tenant,thread,e.sent_at);
      db().prepare("UPDATE drafts SET status='superseded',version=version+1 WHERE status IN ('needs_approval','hand_off','auto_send') AND event_id IN (SELECT id FROM events WHERE tenant=? AND thread=? AND sent_at<?)").run(tenant,thread,e.sent_at);
      db().prepare("UPDATE events SET state='superseded',token=NULL WHERE tenant=? AND thread=? AND sent_at<? AND state IN ('queued','processing','retry')").run(tenant,thread,e.sent_at);
    }
    audit(tenant,key,'received',{source,recipient:e.to,ignored_metadata:e.metadata||null,state:newer?'superseded':'queued'});
    return {id:key,duplicate:false,tenant};
  });
}
export function history(thread:string,before:string):ChannelEvent[]{return all<{payload:string}>('SELECT payload FROM events WHERE thread=? AND sent_at<=? ORDER BY sent_at LIMIT 20',thread,before).map(r=>JSON.parse(r.payload));}

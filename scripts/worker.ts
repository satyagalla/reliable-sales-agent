import { all,db,tx,audit } from '../src/lib/db';
import { workOne,dispatchOne } from '../src/lib/workflow';
async function main(){
  if(process.argv.includes('--redraft'))tx(()=>{
    for(const d of all<{id:string;event_id:string;tenant:string}>("SELECT * FROM drafts WHERE source='fixture' AND status IN ('needs_approval','hand_off','drop')")){
      db().prepare("UPDATE drafts SET status='superseded',version=version+1 WHERE id=?").run(d.id);
      db().prepare("UPDATE events SET state='queued',attempts=0 WHERE id=? AND state='done'").run(d.event_id);
      audit(d.tenant,d.event_id,'live_redraft_requested',{});
    }
  });
  if(!process.env.OPENAI_API_KEY){console.error('No OPENAI_API_KEY. Stored inbox and quality pages still work.');process.exitCode=1;return;}
  let count=0;while(await workOne()){count++;if(count>100)break;}
  while(await dispatchOne()){}console.log('Worker pass completed:',count,'jobs. Retry jobs become eligible after backoff; run again or use --watch.');
}
if(process.argv.includes('--watch')){main();setInterval(()=>{main().catch(console.error);},10000);}else main().catch(e=>{console.error(e);process.exitCode=1;});

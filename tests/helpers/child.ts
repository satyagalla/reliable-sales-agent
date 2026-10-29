import { ingest } from '../../src/lib/ingest';
import { review } from '../../src/lib/workflow';
const input=JSON.parse(process.argv[3]);
try{if(process.argv[2]==='ingest')ingest(input,'seed_cli');else review(input);}catch(e){console.error((e as Error).message);process.exitCode=2;}

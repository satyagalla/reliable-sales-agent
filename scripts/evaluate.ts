import { runEvaluation } from '../src/lib/quality';
runEvaluation(process.argv.includes('--degraded')?'degraded':'baseline',process.argv.includes('--fixture')?'fixture':'live_llm').then(id=>console.log('Stored evaluation:',id)).catch(e=>{console.error(e);process.exitCode=1;});

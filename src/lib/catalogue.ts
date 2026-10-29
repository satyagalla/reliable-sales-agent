import { all, one } from './db';
import type { Tenant, Price, Trust } from './domain';
export function tenant(id:string):Tenant {const row=one<{config:string}>('SELECT config FROM tenants WHERE id=?',id);if(!row)throw Error('Unknown tenant');return JSON.parse(row.config);}
export function catalogue(id:string):Price[]{return all<{data:string}>('SELECT data FROM prices WHERE tenant=? ORDER BY row_id',id).map(r=>JSON.parse(r.data));}
export function trust(id:string):Trust{return one<{trust:Trust}>('SELECT trust FROM tenants WHERE id=?',id)!.trust;}

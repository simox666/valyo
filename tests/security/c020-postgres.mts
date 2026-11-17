// Recette C020 : vrai PostgreSQL LOCAL, schéma jetable. Aucun appel fournisseur.
// DATABASE_URL_TEST=postgres://... node tests/security/c020-postgres.mts
// Assertions C020-01/02 inversées après correction (CL023) : PASS signifie comportement sécurisé.
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { MIGRATIONS } from '../../lib/migrations.ts';
import { developPost, getSyntheses, type Summarizer } from '../../lib/actus/synthesis.ts';
import type { Db, Query } from '../../lib/editorial/types.ts';
import type { Transport } from '../../lib/editorial/fetch.ts';
const url = process.env.DATABASE_URL_TEST;
if (!url || !['localhost','127.0.0.1'].includes(new URL(url).hostname) || url === process.env.DATABASE_URL) throw new Error('Base PostgreSQL locale de recette distincte obligatoire.');
const schema = 'c020_' + randomUUID().replaceAll('-','');
const admin = new pg.Pool({connectionString:url});
await admin.query(`CREATE SCHEMA ${schema}`);
const pool = new pg.Pool({connectionString:url, max:12, options:`-c search_path=${schema} -c statement_timeout=15000`});
const pids = new Set<number>();
const db: Db = {
  query: async (sql,params) => (await pool.query(sql,params)).rows,
  transaction: async fn => {
    const c = await pool.connect();
    try { await c.query('BEGIN'); pids.add((await c.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
      const q: Query = async (sql,params) => (await c.query(sql,params)).rows;
      const result = await fn(q); await c.query('COMMIT'); return result;
    } catch(e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  }
};
const transport = { get: async () => ({body:'<article>'+ '<p>Des chercheurs étudient les batteries au sodium et leurs limites.</p>'.repeat(30)+'</article>'}) } as unknown as Transport;
const content = {essentiel:'Texte retiré',points:[],contexte:'',limites:''};
let seq=0;
async function fixture() {
  const h='c020_'+seq++;
  const [u]=await db.query<{id:string}>("INSERT INTO users(handle,display_name,rules_accepted_at) VALUES($1,$1,now()) RETURNING id",[h]);
  const [p]=await db.query<{id:string}>("INSERT INTO posts(author_id,kind,title,body) VALUES($1,'news','Titre','Texte') RETURNING id",[u.id]);
  await db.query('INSERT INTO post_sources(post_id,position,url,normalized_url) VALUES($1,0,$2,$2)',[p.id,'https://example.test/'+h]);
  return {userId:u.id,postId:p.id};
}
async function reset() { await db.query('DELETE FROM synthesis_attempts'); await db.query('DELETE FROM post_syntheses'); }
async function round(n:number, expected:number, cost:number, same=false, estimate?:number) {
  const fixtures=await Promise.all(Array.from({length:n},fixture));
  let release!:()=>void; const gate=new Promise<void>(r=>release=r);
  let observed=0, calls=0; let ready!:()=>void; const allObserved=new Promise<void>(r=>ready=r);
  const observe=()=>{if(++observed===n) ready();};
  const summarize:Summarizer=async()=>{calls++;observe();await gate;return {readable:true,model:'fixture',costMicros:cost,synthesis:content};};
  const jobs=fixtures.map(async(f)=>{const result=await developPost({db,transport,summarize,...(same?fixtures[0]:f),...(estimate===undefined?{}:{estimateMicros:estimate})}); if(!result.ok || result.state.status==='pending') observe(); return result;});
  const timer=setTimeout(()=>{release();ready();},12000);
  try { await allObserved; assert.equal(observed,n,'toutes les demandes ont atteint réservation/refus'); assert.equal(calls,expected); }
  finally {clearTimeout(timer);release();await Promise.all(jobs);}
  return calls;
}
try {
  for(const m of MIGRATIONS) for(const s of m.statements) await db.query(s);
  console.log('PostgreSQL', (await db.query<{v:string}>('SHOW server_version')).map(Object.values));
  process.env.VALYO_SYNTHESES_PAR_JOUR='2'; process.env.VALYO_SYNTHESES_BUDGET_JOUR='100';
  await round(8,2,0); assert.equal((await db.query<{n:number}>('SELECT count(*)::int n FROM synthesis_attempts'))[0].n,2);
  console.log('PASS plafond global : 2 fournisseurs / 8 demandes concurrentes');
  await reset();process.env.VALYO_SYNTHESES_PAR_JOUR='100';await round(8,3,0);
  console.log('PASS concurrence : 3 fournisseurs / 8 demandes');
  await reset();await round(8,1,0,true);console.log('PASS même publication : 1 fournisseur / 8 demandes');
  assert.ok(pids.size>=2);console.log('Connexions PostgreSQL distinctes observées :',pids.size);
  await reset();process.env.VALYO_SYNTHESES_BUDGET_JOUR='1';await round(3,1,600000,false,600000);
  const spent=BigInt((await db.query<{s:string}>('SELECT COALESCE(sum(cost_micros),0)::text s FROM synthesis_attempts WHERE finished_at IS NOT NULL'))[0].s);
  assert.ok(spent<=1_000_000n,`coût total ${spent} ≤ plafond 1,00`);
  console.log('PASS C020-01 : budget 1,00, réservation 0,60 : 1 seul appel concurrent autorisé, coût final', spent.toString());
  await reset();process.env.VALYO_SYNTHESES_BUDGET_JOUR='100';const f=await fixture();
  const result=await developPost({db,transport,...f,summarize:async()=>{await db.query("UPDATE posts SET status='removed' WHERE id=$1",[f.postId]);return {readable:true,model:'fixture',synthesis:content};}});
  assert.ok(result.ok && result.state.status==='unavailable' && !('content' in result.state),'POST initial sans texte après retrait');
  assert.equal((await getSyntheses(db.query,[f.postId])).size,0);
  console.log('PASS C020-02 : retrait pendant génération : POST initial sans contenu, GET ultérieur protégé');
} finally {await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();}

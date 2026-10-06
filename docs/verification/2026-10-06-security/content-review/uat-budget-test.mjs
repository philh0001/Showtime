import assert from 'node:assert/strict';
import {createWorkBudget,fetchTmdbJson,parseApiRequest} from './uat-api-under-test.mjs';
let dispatches=0,reservations=0;
const budget=createWorkBudget({cost:13},{WORK_LIMITER:{limit:async()=>({success:++reservations<=2})}},'test',async()=>{dispatches++;return {};});
const results=await Promise.allSettled(Array.from({length:13},()=>budget.fetch({endpoint:'/3/tv/1'})));
assert.equal(dispatches,2);assert.ok(budget.denied);assert.equal(results.filter(r=>r.status==='fulfilled').length,2);
for(const endpoint of ['/3/../admin','//evil.invalid/3/a','https://evil.invalid/3/a'])await assert.rejects(fetchTmdbJson({endpoint,token:'dummy',fetchImpl:()=>{throw Error('Must not fetch')}}));
assert.equal(parseApiRequest({method:'GET',url:'https://api.example/search?query=x&type=movie&type=tv'}).ok,false);
console.log(JSON.stringify({dispatches,reservations,metrics:budget.metrics,throttleStopsDispatch:true}));

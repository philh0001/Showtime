import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
const raw=fs.readFileSync(new URL('../deployed/showtime-api-index.js', import.meta.url),'utf8');
const code=raw.slice(0,raw.indexOf('export {'));
const ctx=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,Headers,Request,Response,URL,AbortController,setTimeout,clearTimeout,console,btoa,atob,performance});
vm.runInContext(code,ctx);
const oldHash=await ctx.hashPassword('OldPassword123');
let user={id:'local-user-A',email:'local@example.invalid',email_verified:1,password_hash:oldHash};
const sessions=new Map();
let entered; const reached=new Promise(r=>entered=r); let resume; const gate=new Promise(r=>resume=r);
const db={prepare(sql){return {bind(...args){return {
 async first(){if(sql.includes('users WHERE email'))return {...user};if(sql.includes('sessions WHERE token_hash'))return sessions.get(args[0])??null;if(sql.includes('users WHERE id'))return {...user};throw Error(sql)},
 async run(){if(sql.startsWith('INSERT INTO sessions')){entered();await gate;sessions.set(args[2],{user_id:args[1],expires_at:args[4]});return {success:true}}throw Error(sql)}
}}}},async batch(statements){throw Error('unused')}};
// Pause actual deployed login at INSERT, after it verifies old password.
const login=ctx.handleLogin({email:user.email,password:'OldPassword123'},{db,now:Date.now});
await reached;
// Model the committed result of completePasswordReset's atomic D1 batch.
user.password_hash=await ctx.hashPassword('ResetPassword456');sessions.clear();
resume();const result=await login;
assert.equal(result.status,200);
const session=await ctx.resolveSession(result.body.sessionToken,{db,now:Date.now});
assert.equal(session.id,user.id);
console.log(JSON.stringify({probe:'deployed login/reset race',oldPasswordLoginStatus:result.status,sessionValidAfterReset:!!session,sessionTTLdays:30}));
// Read/write tenant key cannot be supplied by request payload.
const calls=[];const scopeDb={prepare(sql){return {bind(...args){calls.push({sql,args});return {async first(){return {revision:1}},async all(){return {results:[]}}}}}}};
const pushed=await ctx.handleSyncPush(user,{collection:'watchlist',data:[],expectedRevision:null,userId:'local-user-B'},{db:scopeDb,now:Date.now});
assert.equal(pushed.status,200);assert.equal(calls[0].args[0],'local-user-A');
console.log(JSON.stringify({probe:'sync tenant isolation',status:pushed.status,boundOwner: calls[0].args[0],attackerRequestedOwner:'local-user-B'}));
// Enumeration via signup duplicate path does not mutate or send email.
const exists=await ctx.handleSignup({email:user.email,password:'OldPassword123'},{db,now:Date.now});
assert.equal(exists.status,409);
console.log(JSON.stringify({probe:'signup enumeration',registeredEmailStatus:exists.status,response:exists.body}));

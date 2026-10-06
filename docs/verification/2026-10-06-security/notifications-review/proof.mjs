import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
const modules = await Promise.all(['showtime-notifications','showtime-uat-notifications'].map(n=>import(`./${n}.mjs`)));
const kp=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
const key=Buffer.from(await crypto.subtle.exportKey('raw',kp.publicKey)).toString('base64url');
const prefs={version:1,enabled:true,showIds:[1],timing:'release-day',dailyDigest:false,dateAnnouncements:false,hour:12,timezone:'UTC'};
class MockDB {
 constructor(){this.rows=new Map();this.bucket=0;this.sql=[];}
 prepare(sql){this.sql.push(sql);let args;const db=this;return {bind(...a){args=a;return this;},async first(){if(sql.startsWith('SELECT auth_hash')||sql.startsWith('SELECT * FROM devices WHERE id='))return db.rows.get(args[0])??null;if(sql.includes("json_extract(subscription,'$.endpoint')"))return null;if(sql.startsWith('INSERT INTO registration_limits'))return {count:++db.bucket};if(sql.startsWith('SELECT count(*)'))return {total:db.rows.size};throw Error('unexpected first '+sql);},async run(){if(sql.startsWith('INSERT INTO devices')){if(db.rows.size>=args[5]&&!db.rows.has(args[0]))return {meta:{changes:0}};db.rows.set(args[0],{id:args[0],auth_hash:args[1],subscription:args[2],preferences:args[3],updated_at:args[4]});return {meta:{changes:1}};}if(sql.startsWith('DELETE FROM show_dates'))return {meta:{changes:0}};throw Error('unexpected run '+sql);}};}
 async batch(ss){const out=[];for(const s of ss)out.push(await s.run());return out;}
}
function request(i,valid=true){return new Request('https://local.invalid/notifications/device',{method:'PUT',headers:{'X-Device-Id':i.toString(16).padStart(32,'0'),Authorization:'Bearer '+'b'.repeat(64),'CF-Connecting-IP':'192.0.2.1'},body:JSON.stringify({preferences:prefs,subscription:{endpoint:`https://fcm.googleapis.com/fcm/send/local-test-${i}`,keys:{p256dh:valid?key:'A'.repeat(87),auth:'A'.repeat(22)}}})});}
for(let m=0;m<modules.length;m++){
 const db=new MockDB();const env=m===0?{DB:db,MAX_DEVICES:"20",MAX_DISTINCT_SHOWS:"60",MAX_SCHEDULE_READS:"7"}:{DB:db};
 const cap=m===0?20:4;
 const statuses=[];for(let i=1;i<=cap+1;i++){if(i===11||i===21)db.bucket=0;statuses.push((await modules[m].handleRequest(request(i),env)).status);}
 assert.deepEqual(statuses,[...Array(cap).fill(200),503]);
 const malformed=(await modules[m].handleRequest(request(9,false),{DB:new MockDB()})).status;
 assert.equal(malformed,m===0?200:400);
 console.log(JSON.stringify({environment:m===0?'production':'uat',configuredCapacity:cap,bucketExplanation:'mock resets after ten registrations to model distinct hourly/IP buckets; no rate-limit bypass claimed',capacityRegistrationStatuses:statuses,malformedECKeyStatus:malformed,networkRequests:0}));
}

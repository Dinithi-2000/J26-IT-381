import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTelemetryMonitor, hardwareStatus} from '../src/services/module02Telemetry.js';
import {createQualityService} from '../src/services/qualityService.js';
const now = Date.parse('2026-10-21T10:00:00Z');
const sampleId = 'TEST-CIN001';
const real = (changes={}) => ({_id:'000000000000000000000001',sampleId,deviceId:'ESP32S3-WEIGHT-01',
  dataOrigin:'REAL_SENSOR',recordedAt:new Date(now-1000).toISOString(),createdAt:new Date(now-500).toISOString(),
  weightGrams:42.75,sensorStatus:{weight:'online',color:'offline'},...changes});
const body = row => ({data:row,deviceStatus:{status:'recent',offlineAfterSeconds:60}});
const status = (row,changes={}) => hardwareStatus({sampleId,phase:'ready',reading:row,deviceStatus:{offlineAfterSeconds:60},now,...changes});
const tick = () => new Promise(resolve=>setImmediate(resolve));

function clock() {
  let time=now,sequence=0;
  const tasks=new Map();
  const add=(fn,ms,interval)=>{const id=++sequence;tasks.set(id,{fn,at:time+ms,interval});return id;};
  return {now:()=>time,timers:{setInterval:(fn,ms)=>add(fn,ms,ms),clearInterval:id=>tasks.delete(id),
    setTimeout:(fn,ms)=>add(fn,ms,0),clearTimeout:id=>tasks.delete(id)},
    size:()=>tasks.size,
    async advance(ms) {
      const target=time+ms;
      for(;;) {
        const next=[...tasks].filter(([,job])=>job.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];
        if(!next)break;
        const [id,job]=next;time=job.at;
        if(job.interval)job.at+=job.interval;else tasks.delete(id);
        job.fn();await tick();
      }
      time=target;await tick();
    }};
}

test('only fresh expected-device REAL_SENSOR telemetry establishes ESP32 and HX711 status',()=>{
  const good=status(real());assert.equal(good.esp32,'Connected');assert.equal(good.hx711,'Online');assert.equal(good.rgb,'Offline');assert.equal(good.weight,42.75);
  for(const row of [null,real({dataOrigin:'DEMO_DATA'}),real({dataOrigin:undefined}),real({deviceId:'OTHER-DEVICE'}),
    real({sampleId:'OTHER-SAMPLE'}),real({recordedAt:'not-a-date'}),real({createdAt:undefined}),
    real({recordedAt:new Date(now+1).toISOString()}),real({createdAt:new Date(now+1).toISOString()})]) {
    assert.equal(status(row).connected,false);
  }
  assert.equal(status(real({sensorStatus:{weight:'offline',color:'offline'},weightGrams:null})).hx711,'Offline');
  assert.equal(status(real({weightGrams:NaN})).hx711,'Offline');
  assert.equal(status(real(),{phase:'error'}).esp32,'Disconnected');
});

test('RGB goes online only with recent real color readings and raw sensor evidence',()=>{
  const row=real({sensorStatus:{weight:'online',color:'online'},red:128,green:90,blue:50,rgbRaw:{red:500,green:350,blue:200,clear:1000}});
  assert.equal(status(row).rgb,'Online');
  assert.equal(status({...row,rgbRaw:null}).rgb,'Offline');
  assert.equal(status({...row,dataOrigin:'DEMO_DATA'}).rgb,'Offline');
});

test('capture and receipt ages both expire; successful API responses cannot refresh hardware age',async()=>{
  const time=clock();let calls=0;
  const monitor=createTelemetryMonitor({getLatestReading:async()=>{calls++;return body(real());}},time);
  monitor.selectSample(sampleId);assert.equal(hardwareStatus(monitor.getSnapshot()).esp32,'Checking');await tick();
  assert.equal(hardwareStatus(monitor.getSnapshot()).esp32,'Connected');
  await time.advance(60000);
  assert.equal(calls,13);assert.equal(hardwareStatus(monitor.getSnapshot()).esp32,'Stale');
  assert.equal(hardwareStatus(monitor.getSnapshot()).hx711,'Stale');
  assert.equal(monitor.getSnapshot().observations.length,1,'Repeated polling does not duplicate measurements');
  assert.equal(status(real({createdAt:new Date(now-61000).toISOString()})).esp32,'Stale');
  monitor.dispose();assert.equal(time.size(),0);
});

test('polling avoids overlap, times out, recovers and cancels every timer/request on disposal',async()=>{
  const time=clock();let active=0,maxActive=0,calls=0,signal;
  const monitor=createTelemetryMonitor({getLatestReading:(_id,options)=>{
    calls++;active++;maxActive=Math.max(maxActive,active);signal=options.signal;
    assert.equal(options.cache,'no-store');
    if(calls===1)return new Promise(()=>{signal.addEventListener('abort',()=>active--,{once:true});});
    active--;return Promise.resolve(body(real()));
  }},time);
  monitor.selectSample(sampleId);monitor.selectSample(sampleId);assert.equal(calls,1);
  await time.advance(4000);assert.equal(calls,1);
  await time.advance(500);assert.equal(monitor.getSnapshot().phase,'error');assert(signal.aborted);
  await time.advance(500);assert.equal(calls,2);assert.equal(maxActive,1);
  assert.equal(hardwareStatus(monitor.getSnapshot()).esp32,'Connected');
  monitor.dispose();assert.equal(time.size(),0);
  await time.advance(15000);assert.equal(calls,2);
});

test('switching samples aborts the old request and late responses cannot replace the new selection',async()=>{
  const time=clock();let resolveFirst,oldSignal;
  const monitor=createTelemetryMonitor({getLatestReading:(id,{signal})=>{
    if(id===sampleId){oldSignal=signal;return new Promise(resolve=>{resolveFirst=resolve;});}
    return Promise.resolve(body(real({sampleId:id,_id:'000000000000000000000002'})));
  }},time);
  monitor.selectSample(sampleId);monitor.selectSample('TEST-CIN002');assert(oldSignal.aborted);
  await tick();resolveFirst(body(real()));await tick();
  assert.equal(monitor.getSnapshot().sampleId,'TEST-CIN002');
  assert.equal(monitor.getSnapshot().reading.sampleId,'TEST-CIN002');
  assert(monitor.getSnapshot().observations.every(row=>row.sampleId==='TEST-CIN002'));
  assert.equal(hardwareStatus(monitor.getSnapshot(),sampleId).connected,false);
  monitor.dispose();
});

test('outages clear Connected while retaining the last actual weight, then recover without invented telemetry',async()=>{
  const time=clock();let fail=false;
  const monitor=createTelemetryMonitor({getLatestReading:async()=>{if(fail)throw Error('API unavailable');return body(real());}},time);
  monitor.selectSample(sampleId);await tick();fail=true;await time.advance(5000);
  const unavailable=hardwareStatus(monitor.getSnapshot());assert.equal(unavailable.esp32,'Disconnected');assert.equal(unavailable.weight,42.75);
  fail=false;await time.advance(5000);assert.equal(hardwareStatus(monitor.getSnapshot()).esp32,'Connected');
  monitor.dispose();
});

test('empty data and a cross-sample API response never assert hardware connection',async()=>{
  const time=clock();let response=body(null);
  const monitor=createTelemetryMonitor({getLatestReading:async()=>response},time);
  monitor.selectSample(sampleId);await tick();assert.equal(hardwareStatus(monitor.getSnapshot()).esp32,'Disconnected');
  response=body(real({sampleId:'WRONG'}));await time.advance(5000);
  assert.equal(monitor.getSnapshot().phase,'error');assert.equal(monitor.getSnapshot().reading,null);
  monitor.dispose();
});

test('detail loading can reuse the provider poller without issuing a duplicate latest-reading request',async()=>{
  const requests=[];
  const service=createQualityService({fetcher:async url=>{
    requests.push(url);
    return Response.json({data:url.includes('/readings?')?[real()]:[],pagination:{total:url.includes('/readings?')?1:0,pages:1}});
  }});
  const result=await service.getSampleData({id:sampleId,storageStartTimestamp:'2026-10-20T00:00:00Z',deviceStatus:{status:'offline'}},{skipLatest:true});
  assert.equal(requests.length,4);assert(!requests.some(url=>url.includes('/readings/latest')));
  assert.equal(result.records[0].weight,42.75);assert.equal(result.records[0].timestamp,real().recordedAt);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { importWindow, collectCircuit, validateReplacement } from './sync-itf.mjs';

const item = id => ({tournamentKey:id,startDate:'2026-09-01',endDate:'2026-09-07',hostNation:'France',name:'Test event'});
const response = data => ({ status:200, headers:new Headers({'content-type':'application/json'}), text: async()=>JSON.stringify(data) });
test('rolling six-month window crosses year boundary',()=>{
  assert.deepEqual(importWindow(new Date('2026-09-18T12:00:00Z')), {dateFrom:'2026-09-01',dateTo:'2027-02-28'});
});
test('pagination advances by actual returned length and retains cancellation',async()=>{
  const offsets=[];
  const rows=await collectCircuit('MT',importWindow(),async url=>{
    const skip=Number(url.searchParams.get('skip')); offsets.push(skip);
    return response({totalItems:3,items:skip===0?[item('a'),item('b')]:[{...item('c'),tourStatusDesc:'Cancelled'}]});
  },async()=>{});
  assert.deepEqual(offsets,[0,2]);
  assert.equal(rows.length,3); assert.equal(rows[2].tourStatusDesc,'Cancelled');
});
test('changing pagination totals and repeated pages are rejected',async()=>{
  let n=0;
  await assert.rejects(collectCircuit('MT',importWindow(),async()=>response({totalItems:++n===1?2:3,items:[item(String(n))]}),async()=>{}),/total changed/);
  await assert.rejects(collectCircuit('MT',importWindow(),async()=>response({totalItems:2,items:[item('same')]}),async()=>{}),/repeated event/);
});
test('incomplete events and empty results never become snapshots',async()=>{
  await assert.rejects(collectCircuit('MT',importWindow(),async()=>response({totalItems:1,items:[{id:1}]}),async()=>{}),/incomplete/);
  await assert.rejects(collectCircuit('MT',importWindow(),async()=>response({totalItems:0,items:[]}),async()=>{}),/No records/);
});
test('large count drops preserve the previous snapshot',()=>{
  const previous={dateFrom:'2026-09-01',tournaments:Array.from({length:10},()=>({circuit:'MT'}))};
  assert.throws(()=>validateReplacement(previous,{dateFrom:'2026-09-01',tournaments:[{circuit:'MT'}]}),/suspicious drop/);
});
test('unpublished future month may be empty only when explicitly allowed',async()=>{
  const rows=await collectCircuit('MT',importWindow(),async()=>response({totalItems:0,items:[]}),async()=>{},true);
  assert.deepEqual(rows,[]);
});

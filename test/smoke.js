'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const noop=()=>{},store=new Map(),scenes={},events={};
const context=new Proxy({},{get(t,k){if(k in t)return t[k];if(k==='measureText')return s=>({width:String(s).length*10});if(k==='createLinearGradient'||k==='createRadialGradient')return()=>({addColorStop:noop});return noop;},set(t,k,v){t[k]=v;return true;}});
const elements={};function element(id){return elements[id]||(elements[id]={style:{},classList:{add:noop,remove:noop,toggle:noop,contains:()=>false},getContext:()=>context,addEventListener:noop,getBoundingClientRect:()=>({left:0,top:0}),focus:noop,blur:noop,select:noop});}
const sandbox={console,Math,Date,JSON,innerWidth:1280,innerHeight:720,devicePixelRatio:2,performance:{now:()=>0},navigator:{},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},document:{hidden:false,getElementById:element,documentElement:{},addEventListener:(n,f)=>events[n]=f},addEventListener:(n,f)=>events[n]=f,requestAnimationFrame:noop,setTimeout:noop,clearTimeout:noop,setInterval:noop,matchMedia:()=>({matches:false}),speechSynthesis:{getVoices:()=>[],speak:noop,cancel:noop,addEventListener:noop},SpeechSynthesisUtterance:function(){}};
sandbox.window=sandbox;vm.createContext(sandbox);
const dir=path.join(__dirname,'../src');
for(const file of fs.readdirSync(dir).filter(f=>f.endsWith('.js')).sort()){
  vm.runInContext(fs.readFileSync(path.join(dir,file),'utf8'),sandbox,{filename:file});
  if(file==='00-core.js'){const original=sandbox.G.scene;sandbox.G.scene=(name,s)=>{scenes[name]=s;original(name,s);};}
}
const G=sandbox.G,p=G.accounts.create({name:'Prova',level:1});G.accounts.login(p.id);
function tick(){G.t+=1/60;scenes.run.update(1/60);}
for(const level of [1,2]){
  G.level=level;scenes.run.enter();G.runStart();
  for(let n=0;n<30000&&G.runState().phase!=='over';n++){
    const s=G.runState();assert(s.rows.every(r=>r.cells.includes('fruit')),'unsolvable row');
    if(s.phase==='camp'){G.runCampChoice(s.target);continue;}
    const row=s.rows.find(r=>!r.hit);if(row){const lane=row.cells.findIndex(k=>k!=='fruit');G.runAction(lane<s.lane?'left':lane>s.lane?'right':'none');}
    tick();
  }
  assert.equal(G.runState().phase,'over');assert.equal(G.runState().lives,0);
}
assert.equal(G.save.run.runs,2);
for(const age of [1,2]){
  G.level=age;scenes.run.enter();G.runStart();const initial=G.runState().speed;
  for(let n=0;n<10000;n++){
    const s=G.runState();if(s.phase==='camp'){G.runCampChoice(s.target);continue;}
    assert.equal(s.phase,'run');const row=s.rows.find(r=>!r.hit);
    if(row){const lane=row.cells.indexOf('fruit');G.runAction(lane<s.lane?'left':lane>s.lane?'right':'none');}tick();
  }
  assert(G.runState().speed>initial);assert(Math.abs(G.runState().speed-(age===1?.38:.49))<.0001);assert.equal(G.runState().lives,3);
}
scenes.run.enter();G.runStart();G.runAction('pause');const before=G.runState().distance;scenes.run.update(30);assert.equal(G.runState().distance,before);
G.runAction('pause');for(let i=0;i<10;i++)G.runAction('left');assert.equal(G.runState().lane,0);for(let i=0;i<10;i++)G.runAction('right');assert.equal(G.runState().lane,2);
G.runAction('jump');assert(G.runState().jump>0);G.runAction('duck');assert(G.runState().duck>0&&G.runState().jump===0);
const sibling=G.accounts.create({name:'Fratello'});G.accounts.login(sibling.id);assert.equal(G.save.run,undefined);G.accounts.login(p.id);assert.equal(G.save.run.runs,2);
for(const name of ['accesso','menu','run']){if(scenes[name].enter)scenes[name].enter();scenes[name].draw(context);}
console.log('PASS Dino Run: both ages, safe paths, three lives, retry, pause, controls and separate records');

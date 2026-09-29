/* Dino Run — collaudo. `node test/smoke.js`
   A search bot runs two minutes at both ages and must keep all three hearts:
   that is the proof that every pattern, mirrored and chained at top speed,
   has a way through. For Piccolo the bot may only change lane — the 3-year-old
   never HAS to jump or roll. The passive player must lose, and the screen must
   never be empty (the flaw of the first Dino Run). */
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
const G=sandbox.G,R=G.run,S=()=>G.runState();
const kid=G.accounts.create({name:'Prova',level:1});G.accounts.login(kid.id);
const quick=process.argv[2]==='quick';
R.quiet(true);

// ---- the rules have their own dice
const rules=fs.readFileSync(path.join(dir,'10-run.js'),'utf8').split('/* ================================================================ drawing */')[0].replace(/\/\*[\s\S]*?\*\//g,'');
assert(!/Math\.random|G\.rnd|G\.pick|G\.shuffle/.test(rules),'the rules must use the seeded rnd()');

function frames(n,a){for(let i=0;i<n;i++){if(a&&i===0)G.runAction(a);R.step();}}
function fresh(level,seed){G.level=level;R.reset(seed);G.runStart();}

// ---- the bot
function survive(level,seed,seconds,acts){
  fresh(level,seed);
  let beam=[R.snap()],fullScreen=0,samples=0;
  const gens=Math.round(seconds*60/6);
  for(let g=0;g<gens;g++){
    const next=new Map();
    for(const snap of beam)for(const a of acts){
      R.load(snap);frames(6,a);const s=S();
      if(s.phase!=='run')continue;
      const key=[s.p.lane,Math.round(s.p.x*4),Math.round(s.p.y*3),s.p.roll>0,s.hearts].join();
      const sc=s.hearts*1e6+s.dist+s.fruit*2;
      if(!next.has(key)||next.get(key).sc<sc)next.set(key,{snap:R.snap(),sc});
    }
    beam=[...next.values()].sort((a,b)=>b.sc-a.sc).slice(0,24).map(n=>n.snap);
    if(!beam.length)return {alive:false,t:g*6/60};
    R.load(beam[0]);const s=S();
    const ahead=s.obs.filter(o=>!o.got&&o.z>s.z&&o.z<s.z+40).length;samples++;if(ahead>=5)fullScreen++;
  }
  R.load(beam[0]);const s=S();
  return {alive:true,hearts:s.hearts,dist:Math.round(s.dist),fruit:s.fruit,v:+s.v.toFixed(1),full:+(fullScreen/samples).toFixed(2)};
}
if(!quick){
  for(const [level,acts,label] of [[1,[null,'left','right'],'Piccolo, solo cambi di binario'],[2,[null,'left','right','jump','duck'],'Grande']])
    for(const seed of [7,1234]){
      const t0=Date.now(),r=survive(level,seed,120,acts);
      console.log(`  ${label.padEnd(30)} seed ${String(seed).padEnd(5)} ${JSON.stringify(r)}  ${Date.now()-t0}ms`);
      assert(r.alive&&r.hearts===3,label+': two minutes must be possible without a single bump');
      assert(r.full>.9,'the screen is too empty: '+r.full);
      assert(r.fruit>150,'too little fruit on the way: '+r.fruit);
    }
}

// ---- the passive player loses
for(const level of [1,2]){fresh(level,99);frames(60*120);assert.notEqual(S().phase,'run','standing still for two minutes must end the run at level '+level);}
assert(G.save.run.runs>=2&&G.save.run.bestM>0,'the run is saved');

// ---- mechanics on a hand-made track
function track(level,obs){fresh(level,5);const s=S();s.obs=obs;s.nextZ=1e9;return s;}
track(2,[{k:'L',lane:1,z:14,len:.7,h:.7,hit:false}]);frames(90);assert.equal(S().hearts,2,'running into a log costs a heart');
track(2,[{k:'L',lane:1,z:14,len:.7,h:.7,hit:false}]);for(let i=0;i<90;i++){const q=S();if(q.p.vy===0&&q.obs[0].z-q.z<2.2&&q.obs[0].z-q.z>0)G.runAction('jump');R.step();}assert.equal(S().hearts,3,'jumping clears a log');
track(2,[{k:'A',lane:1,z:14,len:.6,h:1.7,hit:false}]);for(let i=0;i<90;i++){const q=S();if(q.p.roll===0&&q.obs[0].z-q.z<2&&q.obs[0].z-q.z>0)G.runAction('duck');R.step();}assert.equal(S().hearts,3,'rolling passes under a branch');
track(1,[{k:'W',lane:1,z:14,len:20,h:1.8,ramp:true,hit:false,col:0}]);let top=0;for(let i=0;i<180;i++){R.step();top=Math.max(top,S().p.y);}assert(top>1.7,'the ramp takes the dino on top of the wagon');assert.equal(S().hearts,3);
track(1,[{k:'W',lane:0,z:-5,len:40,h:1.8,hit:false,col:0}]);frames(10);G.runAction('left');frames(30);assert.equal(S().p.lane,1,'a wagon alongside blocks the lane change');assert.equal(S().hearts,3,'...without costing a heart');
track(1,[{k:'power',lane:1,z:10,y:.8,got:false,type:'magnet'}].concat([0,2].flatMap(l=>[14,17,20,23].map(z=>({k:'fruit',lane:l,z,y:.55,got:false,kind:0})))));frames(150);assert(S().fruit>=6,'the magnet pulls fruit from the other lanes: '+S().fruit);
track(1,[{k:'power',lane:1,z:10,y:.8,got:false,type:'ptero'}]);frames(150);assert(S().p.y>3,'the pterodactyl flies');frames(60*6);assert(S().p.y<.1,'and lands again');
fresh(2,3);G.runAction('pause');const z0=S().z;frames(200);assert.equal(S().z,z0,'pause freezes the run');G.runAction('pause');
fresh(2,3);for(let i=0;i<5;i++)G.runAction('left');assert.equal(S().p.lane,0);

// ---- Piccolo is slower and never meets Grande-only patterns
fresh(1,11);for(let i=0;i<60*90;i++){S().shield=5;R.step();assert(!S().obs.some(o=>o.k==='M'),'no oncoming wagons for Piccolo');}
assert(S().v<=14.01);

// ---- profiles stay apart
const sib=G.accounts.create({name:'Fratello',level:2});G.accounts.login(sib.id);assert.equal(G.save.run,undefined,'sibling save leaked');G.accounts.login(kid.id);assert(G.save.run.runs>=2);

// ---- scenes draw
for(const name of ['accesso','menu','run']){if(scenes[name].enter)scenes[name].enter();scenes[name].draw(context);}
['ready','run','pause','dying','over'].forEach(ph=>{S().phase=ph;scenes.run.draw(context);});
console.log('PASS Dino Run: two minutes clean at both ages (Piccolo by lane changes only), screen always full, passive player loses, logs, arches, ramps, side bumps, magnet, pterodactyl, pause, separate saves');

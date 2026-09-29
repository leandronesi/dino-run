/* Real Chrome: screenshots of every world and real multi-touch on the pads.
   node test/look.js  -> test/frames/*.png  (not published, see deploy.yml) */
'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),os=require('os'),assert=require('assert');
const {spawn}=require('child_process');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'frames');
const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let child,ws,server;
async function main(){
  assert(chrome,'Chrome required');fs.mkdirSync(out,{recursive:true});
  server=http.createServer((req,res)=>{let f=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)){res.writeHead(403).end();return;}if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(!fs.existsSync(f)){res.writeHead(404).end();return;}res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':f.endsWith('.svg')?'image/svg+xml':'application/octet-stream');res.end(fs.readFileSync(f));});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  child=spawn(chrome,['--headless=new','--remote-debugging-port=0','--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'dino-run-')),'--no-first-run','--mute-audio','--hide-scrollbars','--window-size=1280,720','about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
  let endpoint='';child.stderr.on('data',b=>{const m=b.toString().match(/DevTools listening on (ws:\/\/\S+)/);if(m)endpoint=m[1];});
  for(let i=0;i<100&&!endpoint;i++)await delay(100);assert(endpoint,'Chrome startup timeout');
  const targets=await fetch('http://127.0.0.1:'+new URL(endpoint).port+'/json/list').then(r=>r.json());
  ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
  let seq=0;const pending=new Map(),errors=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(p)m.error?p.reject(m.error):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);else if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args.map(a=>a.value||a.description).join(' '));};
  const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  async function run(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;}
  async function shot(name){await delay(250);const s=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(s.data,'base64'));}
  const touch=(type,pts)=>call('Input.dispatchTouchEvent',{type,touchPoints:pts});
  await call('Runtime.enable');await call('Page.enable');
  // silence: speech goes through the OS voice and ignores --mute-audio
  await call('Page.addScriptToEvaluateOnNewDocument',{source:'try{speechSynthesis.speak=function(){};}catch(e){}window.AudioContext=window.webkitAudioContext=undefined;'});
  await call('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
  await call('Page.navigate',{url:origin+'/'});
  for(let i=0;i<100;i++){await delay(50);if(await run("!!(window.G && G.current==='accesso')"))break;}
  await run("const a=G.accounts.create({name:'Leo',color:G.C.dino,level:2});G.accounts.login(a.id);G.go('menu')");await delay(900);await shot('menu');
  await run("G.go('run')");await delay(600);await shot('ready');
  await run('G.runStart()');await delay(2500);await shot('running');
  // real touch: a tap on the right half moves right, swipes left / up / down
  await run('G.runState().obs=G.runState().obs.filter(o=>o.k==="fruit");G.runState().nextZ=1e9');const lane0=await run('G.runState().p.lane');
  await touch('touchStart',[{x:1000,y:500,id:1}]);await delay(40);await touch('touchEnd',[]);await delay(150);
  assert.equal(await run('G.runState().p.lane'),Math.min(2,lane0+1),'tap on the right half');
  for(const [dx,dy,check] of [[-160,0,'G.runState().p.lane<'+Math.min(2,lane0+1)],[0,-140,'G.runState().p.vy>0||G.runState().p.y>0'],[0,140,'G.runState().p.roll>0']]){
    await run('G.runState().shield=3');
    await touch('touchStart',[{x:640,y:420,id:2}]);for(let i=1;i<=5;i++){await touch('touchMove',[{x:640+dx*i/5,y:420+dy*i/5,id:2}]);await delay(16);}await touch('touchEnd',[]);await delay(60);
    assert(await run(check),'swipe '+dx+','+dy);
  }
  console.log('touch: tap and three swipes pass');
  await run("G.go('run')");await delay(500);await run('G.runStart()');await delay(1000);
  const fps=()=>run('new Promise(r=>{let t=[],l=performance.now();function f(n){t.push(n-l);l=n;if(t.length<120)requestAnimationFrame(f);else{t.sort((a,b)=>a-b);r({median:+t[60].toFixed(1),p95:+t[114].toFixed(1)});}}requestAnimationFrame(f);})');
  console.log('frame ms desktop',JSON.stringify(await fps()));await call('Emulation.setCPUThrottlingRate',{rate:4});console.log('frame ms CPU x4',JSON.stringify(await fps()));await call('Emulation.setCPUThrottlingRate',{rate:1});
  // scripted situations, drawn by the real renderer
  const setups={
    ramp:"s.obs=s.obs.filter(o=>o.z>s.z+30);s.obs.push({k:'W',lane:1,z:s.z+4,len:20,h:1.8,ramp:true,hit:false,col:1},{k:'W',lane:0,z:s.z+2,len:26,h:1.8,hit:false,col:0},{k:'R',lane:2,z:s.z+14,len:1.3,h:1.5,hit:false});for(let i=0;i<9;i++)s.obs.push({k:'fruit',lane:1,z:s.z+8+i*2.2,y:2.25,got:false,kind:i%4});",
    obstacles:"s.obs=s.obs.filter(o=>o.z>s.z+45);s.obs.push({k:'L',lane:0,z:s.z+12,len:.7,h:.7,hit:false},{k:'A',lane:1,z:s.z+14,len:.6,h:1.7,hit:false},{k:'R',lane:2,z:s.z+16,len:1.3,h:1.5,hit:false},{k:'M',lane:2,z:s.z+38,len:12,h:1.8,moving:true,hit:false,col:0},{k:'power',lane:1,z:s.z+24,y:.8,got:false,type:'magnet'});",
    ptero:"s.obs.push({k:'power',lane:s.p.lane,z:s.z+3,y:.8,got:false,type:'ptero'});"
  };
  for(const [name,code] of Object.entries(setups)){
    await run("G.go('run')");await delay(500);await run('G.runStart();(()=>{const s=G.runState();s.time=60;s.shield=0;'+code+'})()');
    if(name==='ramp'){for(const d of [300,300,300]){await delay(d);console.log('ramp',JSON.stringify(await run('(()=>{const s=G.runState();return {y:+s.p.y.toFixed(2),lane:s.p.lane,t:+(s.obs.find(o=>o.ramp)||{z:0}).z.toFixed(1)-s.z}})()')));await shot('ramp'+d+Math.random().toString(36).slice(2,4));}}else{await delay(name==='ptero'?1500:400);await shot(name);}
  }
  await run("G.runState().hearts=1;G.runState().shield=0;G.runState().obs.push({k:'R',lane:G.runState().p.lane,z:G.runState().z+3,len:1.3,h:1.5,hit:false})");await delay(2200);await shot('over');
  await call('Emulation.setDeviceMetricsOverride',{width:960,height:600,deviceScaleFactor:2,mobile:true});await run("G.go('run')");await delay(500);await run('G.runStart()');await delay(1500);await shot('tablet');
  assert.deepEqual(errors,[],'console errors: '+JSON.stringify(errors).slice(0,800));
  console.log('PASS look: frames in test/frames');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{try{ws&&ws.close();}catch(e){}try{child&&child.kill();}catch(e){}try{server&&server.close();}catch(e){}});

/* Three lanes, three hearts. Every obstacle row has a safe route. */
(function(){'use strict';
  var C=G.C,W=G.W,H=G.H,S={},touch=null;
  function saved(){var s=G.save.run||(G.save.run={best:0,runs:0});return s;}
  function reset(){S={phase:'ready',lane:1,x:1,lives:3,score:0,distance:0,rows:[],timer:.52,jump:0,duck:0,shield:0,passed:0,reason:'',elapsed:0,speed:G.level===1?.40:.52,combo:0,heartFlash:0};}
  function start(){
    S.phase='run';
    /* The first, harmless row makes the game feel alive instantly while still
       giving a child a moment to understand the three lanes. */
    S.rows.push({z:.24,cells:['fruit','fruit','fruit'],hit:false,warmup:true});
    G.sfx('win');G.say('Via! Raccogli i frutti, evita i sassi e prendi i cuori.');
  }
  function action(a){
    if(a==='pause'){if(S.phase==='run'){S.phase='pause';G.hush();}else if(S.phase==='pause')S.phase='run';return;}
    if(S.phase!=='run')return;
    if(a==='left')S.lane=Math.max(0,S.lane-1);
    if(a==='right')S.lane=Math.min(2,S.lane+1);
    if(a==='jump'&&S.jump<=0){S.jump=1.15;S.duck=0;G.sfx('pop');}
    if(a==='duck'&&S.duck<=0){S.duck=1.25;S.jump=0;G.sfx('tap');}
  }
  function end(){S.phase='over';var s=saved();s.best=Math.max(s.best,S.score);s.runs++;G.saveNow();G.say('Bella corsa! Vuoi riprovare?');}
  function spawn(){
    var safe=G.rndi(0,2),blocked=(safe+1+G.rndi(0,1))%3;
    var kinds=['rock','log','branch'];
    var cells=['fruit','fruit','fruit'];cells[blocked]=kinds[G.rndi(0,2)];
    if(G.level===2&&S.passed>5)cells[(safe+2)%3]=kinds[G.rndi(0,2)];
    /* A heart appears on the path only after a real bump. It stays on a
       passable lane, so recovering a life is a short decision, never a pause. */
    if(S.lives<3&&S.passed>0&&S.passed%7===0)cells[safe]='heart';
    else cells[safe]='fruit';
    S.rows.push({z:0,cells:cells,hit:false});
  }
  function update(dt){
    if(S.phase!=='run')return;
    S.x+=(S.lane-S.x)*(1-Math.exp(-dt*14));
    S.jump=Math.max(0,S.jump-dt);S.duck=Math.max(0,S.duck-dt);S.shield=Math.max(0,S.shield-dt);S.heartFlash=Math.max(0,S.heartFlash-dt);
    S.elapsed+=dt;
    /* The previous ramp needed 150 seconds before it felt quick. The race now
       starts with intent and reaches its cap in less than a minute. */
    var baseSpeed=G.level===1?.40:.52,maxSpeed=G.level===1?.62:.76;
    S.speed=baseSpeed+(maxSpeed-baseSpeed)*Math.min(1,S.elapsed/55);
    S.distance+=dt*S.speed*42;S.timer-=dt;
    if(S.timer<=0){spawn();S.timer=(G.level===1?2.15:1.72)*Math.max(.72,baseSpeed/S.speed);}
    for(var i=S.rows.length-1;i>=0;i--){
      var row=S.rows[i];row.z+=dt*S.speed;
      if(!row.hit&&row.z>=.93){
        row.hit=true;S.passed++;
        var lane=Math.round(S.x),kind=row.cells[lane];
        var good=kind==='fruit'||kind==='heart'||(kind==='log'&&S.jump>.15)||(kind==='branch'&&S.duck>.1);
        if(good){
          if(kind==='heart'){S.lives=Math.min(3,S.lives+1);S.heartFlash=1.2;S.reason='Hai recuperato un cuore!';G.sfx('good');}
          else {S.combo++;S.score+=(kind==='fruit'?3:1)+(S.combo>=5?1:0);G.sfx('coin');}
        }
        else if(S.shield<=0){S.combo=0;S.lives--;S.heartFlash=1;S.shield=2.8;S.reason=kind==='log'?'Salta il tronco':kind==='branch'?'Passa sotto il ramo':'Cambia corsia';G.say(S.reason);G.sfx('bad');if(S.lives<=0){end();return;}}
      }
      if(row.z>1.15)S.rows.splice(i,1);
    }
  }
  function polygon(c,points,col){c.fillStyle=col;c.beginPath();points.forEach(function(p,i){if(i)c.lineTo(p[0],p[1]);else c.moveTo(p[0],p[1]);});c.closePath();c.fill();}
  function ground(z,lane){var p=z*z;return{x:640+(lane-1)*(30+280*p),y:262+405*p,s:.15+1.1*p};}
  function world(c){
    c.fillStyle='#c5e9dd';c.fillRect(0,0,W,H);
    c.fillStyle='#fff0b8';c.beginPath();c.arc(1000,130,60,0,7);c.fill();
    polygon(c,[[0,290],[160,110],[310,262],[490,142],[780,290]],'#80b8a3');
    polygon(c,[[650,290],[910,155],[1070,242],[1210,130],[1280,280]],'#6da88e');
    c.fillStyle='#639671';c.fillRect(0,276,W,444);
    c.fillStyle='#b8b697';G.roundRect(c,559,170,162,120,12);c.fill();
    c.fillStyle='#ded8b0';c.fillRect(550,164,180,18);c.fillRect(576,145,128,20);
    c.fillStyle='#30594b';G.roundRect(c,614,221,52,65,20);c.fill();
    polygon(c,[[599,270],[681,270],[1180,720],[100,720]],'#e5c591');
    polygon(c,[[591,270],[599,270],[100,720],[70,720]],'#efdcb5');
    polygon(c,[[681,270],[689,270],[1210,720],[1180,720]],'#efdcb5');
    c.strokeStyle='#c3a474';c.lineWidth=3;
    for(var lane=0;lane<2;lane++){c.beginPath();c.moveTo(626+lane*28,270);c.lineTo(460+lane*360,720);c.stroke();}
    for(var mark=0;mark<11;mark++){var z=((mark/11+S.distance*.042)%1),p=z*z;c.fillStyle='#c7ab7f';c.fillRect(640-(40+460*p),262+458*p,80+920*p,2+p*3);}
    for(var side=-1;side<=1;side+=2)for(var tree=0;tree<6;tree++){
      var tz=(tree/6+S.distance*.021)%1,scale=.2+tz*1.3,x=640+side*(126+tz*620),y=270+tz*450;
      c.fillStyle='#73533b';c.fillRect(x-9*scale,y-140*scale,18*scale,140*scale);
      c.fillStyle=tree%2?'#286952':'#397c55';c.beginPath();c.ellipse(x,y-156*scale,65*scale,82*scale,side*.35,0,7);c.fill();
      c.fillStyle='#519767';c.beginPath();c.ellipse(x-side*18*scale,y-187*scale,33*scale,40*scale,0,0,7);c.fill();
    }
  }
  function obstacle(c,kind,p){
    c.save();c.translate(p.x,p.y);c.scale(p.s,p.s);c.lineWidth=5;c.strokeStyle='#3d4f3d';
    c.fillStyle='#26473444';c.beginPath();c.ellipse(0,5,46,12,0,0,7);c.fill();
    if(kind==='fruit'){A.fruit(c,0,-28,23);}
    else if(kind==='heart'){A.SHAPES.cuore(c,0,-45,34,C.pinkPop);}
    else if(kind==='rock'){polygon(c,[[-48,0],[-40,-48],[-8,-74],[32,-58],[50,0]],'#899789');c.stroke();polygon(c,[[-8,-74],[32,-58],[50,0],[4,-12]],'#6c8074');}
    else if(kind==='log'){c.fillStyle='#aa7649';G.roundRect(c,-55,-39,110,39,14);c.fill();c.stroke();c.fillStyle='#e7bd7d';c.beginPath();c.ellipse(43,-20,15,18,0,0,7);c.fill();c.stroke();}
    else {c.fillStyle='#82653d';c.fillRect(-57,-130,13,130);c.fillRect(44,-130,13,130);G.roundRect(c,-67,-137,134,32,12);c.fill();c.stroke();c.fillStyle='#78a953';c.beginPath();c.ellipse(34,-145,47,20,-.2,0,7);c.fill();}
    c.restore();
  }
  function runner(c){
    var p=ground(.88,S.x),hop=S.jump>0?Math.sin(Math.PI*S.jump/1.15)*110:0,duck=S.duck>0;
    c.save();c.translate(p.x,610);c.fillStyle='#254d4844';c.beginPath();c.ellipse(0,12,44,13,0,0,7);c.fill();
    c.translate(0,-hop);if(duck){c.translate(0,6);c.scale(1,.58);}
    if(S.shield>0)c.globalAlpha=.65+.25*Math.sin(G.t*18);
    c.strokeStyle='#234b3c';c.lineWidth=6;c.lineJoin='round';c.fillStyle=(G.account&&G.account.color)||C.dino;
    var stride=S.phase==='run'?Math.sin(G.t*14)*9:0;
    G.roundRect(c,-32,-9+stride,24,28,10);c.fill();c.stroke();G.roundRect(c,8,-9-stride,24,28,10);c.fill();c.stroke();
    c.beginPath();c.ellipse(0,-40,40,49,0,0,7);c.fill();c.stroke();
    c.beginPath();c.ellipse(0,-100,46,39,0,0,7);c.fill();c.stroke();
    c.beginPath();c.moveTo(0,-32);c.quadraticCurveTo(68,-20,59,10);c.quadraticCurveTo(24,6,2,-1);c.fill();c.stroke();
    for(var spike=0;spike<4;spike++)polygon(c,[[-7,-119+spike*22],[7,-126+spike*22],[8,-105+spike*22]],'#ffe080');
    c.restore();
  }
  function sign(c,i,x,y,r){A.SHAPES[['stella','fiore','cuore'][i]](c,x,y,r,[C.sun,C.plum,C.pinkPop][i]);}
  function panel(c,title,sub){c.fillStyle='#163f35df';c.fillRect(0,0,W,H);c.fillStyle=C.cream;G.roundRect(c,290,140,700,420,36);c.fill();G.text(title,640,217,{size:52,color:C.leafDeep});G.text(sub,640,282,{size:26,color:C.ink,maxWidth:650});}
  function draw(c){
    world(c);
    for(var row=0;row<S.rows.length;row++)for(var lane=0;lane<3;lane++)if(!S.rows[row].hit)obstacle(c,S.rows[row].cells[lane],ground(S.rows[row].z,lane));
    runner(c);
    c.fillStyle='#173f37e8';G.roundRect(c,24,18,1232,88,25);c.fill();
    c.fillStyle='rgba(255,246,224,.16)';G.roundRect(c,42,28,260,64,22);c.fill();
    G.text('VITE',56,60,{size:19,align:'left',color:C.cream,weight:900});
    for(var heart=0;heart<3;heart++){
      var alive=heart<S.lives, pulse=alive&&S.heartFlash>0?1+Math.sin(G.t*38)*.22:1;
      c.save();c.translate(125+heart*55,60);c.scale(pulse,pulse);A.SHAPES.cuore(c,0,0,28,alive?C.pinkPop:'#637c70');c.restore();
    }
    G.text('Frutti '+S.score,390,60,{size:30,color:C.cream});
    G.text(Math.floor(S.distance)+' m',610,60,{size:28,color:C.cream});
    if(S.combo>=3)G.text('SUPER '+S.combo,840,60,{size:25,color:C.sun,stroke:C.leafDeep,strokeWidth:5});
    G.ui.button({id:'run-pause',x:1040,y:12,w:208,h:96,r:25,color:C.water,label:'Ⅱ',onTap:function(){action('pause');}});
    if(S.phase==='run'){
      [['left','←',26,570],['right','→',1098,570],['jump','SALTA',220,600],['duck','GIÙ',842,600]].forEach(function(b){G.ui.button({id:'run-'+b[0],x:b[2],y:b[3],w:156,h:104,r:26,color:C.leaf,label:b[1],fontSize:30,onTap:function(){action(b[0]);}});});
      if(S.shield>0&&S.reason)G.text(S.reason,640,150,{size:30,color:C.cream,stroke:C.leafDeep,strokeWidth:8});
    } else if(S.phase==='ready'){
      panel(c,'Dino Run','Tre cuori e una giungla da esplorare');
      G.text('← → cambia strada   ↑ salta   ↓ passa sotto',640,343,{size:27,color:C.ink});
      G.ui.button({id:'run-start',x:440,y:410,w:400,h:112,r:28,color:C.leaf,label:'VIA!',onTap:start});
    } else {
      panel(c,S.phase==='over'?'Bella corsa!':'Facciamo una pausa',S.phase==='over'?'Frutti '+S.score+' · Record '+saved().best:'Riparti quando vuoi');
      G.ui.button({id:'run-again',x:345,y:391,w:280,h:112,r:26,color:C.leaf,label:S.phase==='over'?'Riprova':'Continua',onTap:function(){if(S.phase==='over'){reset();start();}else action('pause');}});
      G.ui.button({id:'run-menu',x:655,y:391,w:280,h:112,r:26,color:C.tangerine,label:'Menu',onTap:function(){G.go('menu');}});
    }
  }
  G.scene('run',{hud:false,back:false,enter:reset,update:update,draw:draw,
    onDown:function(p){if(!touch&&S.phase==='run')touch=p;},onUp:function(p){if(!touch||p.id!==touch.id)return;var dx=p.x-touch.x,dy=p.y-touch.y;touch=null;if(Math.max(Math.abs(dx),Math.abs(dy))<35)return;action(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy<0?'jump':'duck'));},onCancel:function(){touch=null;},exit:function(){touch=null;var save=saved();save.best=Math.max(save.best,S.score||0);G.saveNow();}});
  window.addEventListener('keydown',function(e){if(G.current!=='run'||e.repeat)return;var a={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'jump',ArrowDown:'duck',' ':'jump',Escape:'pause'}[e.key];if(a){e.preventDefault();action(a);}});
  document.addEventListener('visibilitychange',function(){if(document.hidden){touch=null;if(G.current==='run'&&S.phase==='run')S.phase='pause';}});
  G.scene('menu',{hud:false,back:false,draw:function(c){if(!S.phase)reset();world(c);G.text('DINO RUN',640,155,{size:88,color:C.cream,stroke:C.leafDeep,strokeWidth:14});A.dino(c,640,440,230,{color:G.account.color,t:G.t});G.text('Il tuo record: '+saved().best+' frutti',640,490,{size:29,color:C.cream,stroke:C.leafDeep});G.ui.button({id:'play',x:430,y:555,w:420,h:116,r:30,color:C.leaf,label:'CORRI!',onTap:function(){G.go('run');}});G.ui.button({id:'profiles',x:24,y:566,w:300,h:100,color:C.water,label:'Cambia dino',onTap:function(){G.accounts.logout();G.go('accesso');}});G.ui.button({id:'parents',x:975,y:566,w:280,h:100,color:C.bark,label:'Genitori',onTap:function(){G.go('gate');}});}});
  G.runState=function(){return JSON.parse(JSON.stringify(S));};G.runAction=action;G.runStart=start;
})();

(() => {
  'use strict';
  // Song nach dieser Sekunde wiederholen; null spielt den gesamten Song ab.
  const SONG_RESTART_AT_SECONDS = 50;
  const $ = id => document.getElementById(id);
  const body=document.body, canvas=$('world'), audio=$('audio');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let paused=reduced, entered=false, warp=false, speed=1, travel=0, clock=0, pointerX=0, pointerY=0, lookX=0, lookY=0, warpMix=0;
  let scene=0, sceneMix=0, frame=0, last=0, slowFrames=0, scale=innerWidth<700?.65:.8, lastDistance=-1;
  let objectUrl, audioContext, analyser, bins, bass=0, noticeTimer, dragId=null, lost=false;
  const scenes=[{name:'THE THRESHOLD',description:'Zwischen hier und irgendwo.',accent:'#ff6d3a'},{name:'DEEP WATER',description:'Unter der Oberfläche des Unmöglichen.',accent:'#67e3ed'},{name:'SOLAR DRIFT',description:'Ein letzter Gedanke vor dem Licht.',accent:'#d7b0ff'}];
  const gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'high-performance',depth:false,stencil:false});
  const vertex=`attribute vec2 position;void main(){gl_Position=vec4(position,0.,1.);}`;
  const fragment=`
  precision highp float;
  uniform vec2 resolution;uniform vec2 look;uniform float travel;uniform float time;uniform float scene;uniform float warp;uniform float bass;uniform float entered;
  vec3 glow;float material;
  mat2 rot(float a){return mat2(cos(a),-sin(a),sin(a),cos(a));}
  vec2 bend(float z){return vec2(sin(z*.075)*1.2+sin(z*.023)*2.,cos(z*.055)*.9);}
  float box(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.);}
  float map(vec3 p){
    vec2 q=p.xy-bend(p.z);q=rot(p.z*.035+sin(p.z*.016)*.5)*q;
    float period=3.4;float rz=mod(p.z+period*.5,period)-period*.5;
    float radius=mix(length(q),max(abs(q.x),abs(q.y)),.62+.18*sin(p.z*.012));
    float frame=length(vec2(radius-3.5,rz))-.055;
    float frame2=length(vec2(radius-3.62,rz-.15))-.018;
    float rails=min(length(q-vec2(2.5,2.5)),length(q-vec2(-2.5,-2.5)))-.022;
    rails=min(rails,min(length(q-vec2(-2.5,2.5)),length(q-vec2(2.5,-2.5)))-.015);
    float panels=box(vec3(q.x,abs(q.y)-3.64,mod(p.z+1.7,3.4)-1.7),vec3(2.45,.045,1.22));
    float d=min(min(frame,frame2),min(rails,panels));material=panels<min(min(frame,frame2),rails)?1.:0.;
    return d;
  }
  vec3 palette(float s){if(s<1.)return mix(vec3(1.,.24,.07),vec3(.12,.75,1.),s);return mix(vec3(.12,.75,1.),vec3(.65,.32,1.),s-1.);}
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  void main(){
    vec2 uv=(gl_FragCoord.xy-.5*resolution)/resolution.y;
    uv.x-=mix(.19,0.,entered);
    float zoom=1.18-warp*.28;vec3 rd=normalize(vec3(uv,zoom));
    rd.xz=rot(-look.x*.17)*rd.xz;rd.yz=rot(look.y*.13)*rd.yz;
    vec3 ro=vec3(bend(travel),travel);ro.xy+=look*vec2(.48,.3);
    vec3 primary=palette(scene);vec3 secondary=mix(vec3(.12,.4,.66),vec3(1.,.55,.15),scene*.35);
    float t=.05;vec3 light=vec3(0.);float hit=0.;float mat=0.;
    for(int i=0;i<84;i++){
      vec3 p=ro+rd*t;float d=map(p);mat=material;
      float pulse=.72+.28*sin(p.z*.35-time*.4);
      vec3 color=mix(primary,secondary,.5+.5*sin(p.z*.16));
      if(mat<.5)light+=color*(.0026+.0015*bass)*exp(-t*.022)/(.025+d*d*9.);
      if(d<.008){hit=1.;break;}t+=max(d*.78,.012);if(t>95.)break;
    }
    vec3 color=vec3(.006,.009,.018)+light*.55;
    if(hit>.5){float fog=exp(-t*.025);if(mat>.5){vec3 p=ro+rd*t;float stripes=pow(max(0.,sin(p.z*3.7)),20.);color+=mix(vec3(.013,.023,.035),primary*.12,stripes)*fog;}else{color+=mix(primary,secondary,.5+.5*sin((ro.z+rd.z*t)*.16))*(1.4+bass*.5)*fog;}}
    color+=primary*.035/(.1+length(uv)*2.);
    float angle=atan(uv.y,uv.x);float streak=pow(max(0.,sin(angle*95.+floor(angle*13.))),80.);color+=primary*streak*warp*pow(min(length(uv),1.),2.)*.65;
    color*=.78+.22*(1.-smoothstep(.1,1.3,length(uv)));
    color=vec3(1.)-exp(-color*1.2);color=pow(color,vec3(.86));
    color+=(hash(gl_FragCoord.xy+time)-.5)*.012;gl_FragColor=vec4(color,1.);
  }`;
  let program,uniforms={},buffer;
  function notify(text){$('notice').textContent=text;$('notice').classList.add('show');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').classList.remove('show'),4500);}
  function fallback(){body.classList.add('no-webgl');$('fallback').hidden=false;$('pause').disabled=true;$('speed').disabled=true;cancelAnimationFrame(frame);frame=0;}
  function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
  function initialize(){if(!gl){fallback();return;}try{const vs=shader(gl.VERTEX_SHADER,vertex),fs=shader(gl.FRAGMENT_SHADER,fragment);program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));gl.useProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const position=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);for(const name of ['resolution','look','travel','time','scene','warp','bass','entered'])uniforms[name]=gl.getUniformLocation(program,name);lost=false;body.classList.remove('no-webgl');$('fallback').hidden=true;$('pause').disabled=false;$('speed').disabled=false;resize();}catch(error){console.error('WebGL:',error);fallback();}}
  function resize(){if(!program||lost)return;const dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.max(1,Math.round(innerWidth*dpr*scale));canvas.height=Math.max(1,Math.round(innerHeight*dpr*scale));gl.viewport(0,0,canvas.width,canvas.height);render();schedule();}
  function render(){if(!program||lost)return;gl.useProgram(program);gl.uniform2f(uniforms.resolution,canvas.width,canvas.height);gl.uniform2f(uniforms.look,lookX,lookY);gl.uniform1f(uniforms.travel,travel);gl.uniform1f(uniforms.time,clock);gl.uniform1f(uniforms.scene,sceneMix);gl.uniform1f(uniforms.warp,warpMix);gl.uniform1f(uniforms.bass,bass);gl.uniform1f(uniforms.entered,entered?1:0);gl.drawArrays(gl.TRIANGLES,0,6);}
  function schedule(){if(!frame&&!paused&&!document.hidden&&program&&!lost)frame=requestAnimationFrame(tick);}
  function tick(now){frame=0;const raw=last?(now-last)/1000:1/60,dt=Math.min(raw,.05);last=now;if(raw>.035)slowFrames++;else slowFrames=Math.max(0,slowFrames-1);if(slowFrames>50&&scale>.4){scale=Math.max(.4,scale-.1);slowFrames=0;resize();}const smooth=1-Math.exp(-dt*5);lookX+=(pointerX-lookX)*smooth;lookY+=(pointerY-lookY)*smooth;warpMix+=((warp?1:0)-warpMix)*smooth;sceneMix+=(scene-sceneMix)*smooth;clock+=dt;travel+=dt*(entered?speed*4:1.2)*(1+warpMix*5);if(analyser&&!audio.paused){analyser.getByteFrequencyData(bins);let sum=0;for(let i=1;i<12;i++)sum+=bins[i];bass+=(sum/(11*255)-bass)*smooth;}else bass*=.95;const distance=Math.floor(travel*10);if(distance!==lastDistance){$('distance').textContent=String(distance).padStart(5,'0');lastDistance=distance;}render();schedule();}
  function setPaused(value){paused=value;body.classList.toggle('paused',value);$('pause').setAttribute('aria-pressed',String(value));$('pause').textContent=value?'Bewegung fortsetzen':'Bewegung pausieren';if(value){stopWarp();cancelAnimationFrame(frame);frame=0;warpMix=0;render();}else{last=0;schedule();}}
  function stopWarp(){warp=false;body.classList.remove('warping');}
  canvas.addEventListener('pointermove',e=>{pointerX=(e.clientX/innerWidth-.5)*2;pointerY=(.5-e.clientY/innerHeight)*2;});
  canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;dragId=e.pointerId;canvas.setPointerCapture(e.pointerId);if(entered&&!paused){warp=true;body.classList.add('warping');}});
  function release(e){if(e.pointerId===dragId){dragId=null;stopWarp();}}
  canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',stopWarp);
  function setSpeed(value){speed=Math.min(3,Math.max(.2,value));$('speed').value=speed.toFixed(1);$('speed-value').textContent=`${speed.toFixed(1)}×`;}
  canvas.addEventListener('wheel',e=>{e.preventDefault();setSpeed(speed-e.deltaY*.001);},{passive:false});
  $('speed').addEventListener('input',e=>setSpeed(Number(e.target.value)));
  $('enter').addEventListener('click',()=>{entered=true;body.classList.add('immersed');$('intro').inert=true;$('hint').textContent='HALTEN FÜR WARP · SCROLLEN FÜR TEMPO';canvas.focus({preventScroll:true});if(paused)notify('Bewegung ist reduziert. In Mission Control kannst du sie aktivieren.');render();if(audio.paused)playMusic();});
  document.querySelectorAll('[data-scene]').forEach(button=>button.addEventListener('click',()=>{scene=Number(button.dataset.scene);document.querySelectorAll('[data-scene]').forEach(b=>{const active=b===button;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});const current=scenes[scene];$('chapter-number').textContent=`0${scene+1} / 03`;$('chapter-title').textContent=current.name;$('chapter-description').textContent=current.description;document.documentElement.style.setProperty('--accent',current.accent);if(paused){sceneMix=scene;render();}}));
  function menu(open){$('settings').hidden=!open;$('menu-toggle').setAttribute('aria-expanded',String(open));if(open){stopWarp();$('close-settings').focus();}else $('menu-toggle').focus();}
  $('menu-toggle').addEventListener('click',()=>menu($('settings').hidden));$('close-settings').addEventListener('click',()=>menu(false));$('pause').addEventListener('click',()=>setPaused(!paused));
  $('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else notify('Vollbild wird von diesem Browser nicht unterstützt.');}catch{notify('Vollbild ist hier leider nicht verfügbar.');}});
  document.addEventListener('fullscreenchange',()=>{$('fullscreen').textContent=document.fullscreenElement?'Vollbild verlassen ↙':'Vollbild ↗';});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('settings').hidden)menu(false);setPaused(true);return;}if(/INPUT|BUTTON|SELECT|TEXTAREA|A/.test(e.target.tagName)||e.target.isContentEditable||e.ctrlKey||e.metaKey||e.altKey)return;if(e.code==='Space'&&entered&&!paused){e.preventDefault();warp=true;body.classList.add('warping');}});
  document.addEventListener('keyup',e=>{if(e.code==='Space')stopWarp();});window.addEventListener('blur',stopWarp);
  audio.volume=.55;
  async function audioReactive(){if(location.protocol==='file:'&&!audio.src.startsWith('blob:'))return;try{if(!audioContext){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;audioContext=new Audio();const source=audioContext.createMediaElementSource(audio);analyser=audioContext.createAnalyser();analyser.fftSize=256;bins=new Uint8Array(analyser.frequencyBinCount);source.connect(analyser);analyser.connect(audioContext.destination);}if(audioContext.state==='suspended')await audioContext.resume();}catch{analyser=null;}}
  function updatePlayer(){body.classList.toggle('playing',!audio.paused);$('play').textContent=audio.paused?'▶':'Ⅱ';$('play').setAttribute('aria-label',audio.paused?'Musik abspielen':'Musik pausieren');$('sound-state').textContent=audio.paused?'TRANSMISSION PAUSED':'TRANSMISSION LIVE';}
  async function playMusic(){try{await audioReactive();await audio.play();}catch(error){if(error.name!=='AbortError')notify(error.name==='NotAllowedError'?'Bitte den Play-Button drücken.':'Song fehlt oder ist nicht lesbar. In Mission Control eine Audiodatei wählen.');}updatePlayer();}
  $('play').addEventListener('click',()=>{if(audio.paused)playMusic();else audio.pause();});audio.addEventListener('play',updatePlayer);audio.addEventListener('pause',updatePlayer);audio.addEventListener('error',()=>{updatePlayer();notify('Musik nicht gefunden: music/track.mp3 ablegen oder eigenen Song wählen.');});
  audio.addEventListener('timeupdate',()=>{if(Number.isFinite(SONG_RESTART_AT_SECONDS)&&SONG_RESTART_AT_SECONDS>0&&!audio.paused&&audio.currentTime>=SONG_RESTART_AT_SECONDS)audio.currentTime=0;});
  $('volume').addEventListener('input',e=>{audio.volume=Number(e.target.value);$('volume-value').textContent=`${Math.round(audio.volume*100)}%`;});$('choose').addEventListener('click',()=>$('file').click());
  $('file').addEventListener('change',e=>{const file=e.target.files[0];if(!file)return;audio.pause();if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=URL.createObjectURL(file);audio.src=objectUrl;$('track-name').textContent=file.name;audio.load();playMusic();});
  document.addEventListener('visibilitychange',()=>{stopWarp();if(document.hidden){cancelAnimationFrame(frame);frame=0;}else{last=0;schedule();}});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;cancelAnimationFrame(frame);frame=0;notify('Grafik wird wiederhergestellt …');});canvas.addEventListener('webglcontextrestored',()=>{program=null;initialize();});
  window.addEventListener('resize',resize);initialize();setPaused(paused);
})();

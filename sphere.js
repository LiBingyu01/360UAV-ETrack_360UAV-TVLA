'use strict';
(() => {
  const dialog=document.querySelector('#sphere-dialog'),canvas=document.querySelector('#sphere-canvas');
  const video=document.querySelector('#sphere-video'),selector=document.querySelector('#sphere-scene');
  const seek=document.querySelector('#sphere-seek'),speed=document.querySelector('#sphere-speed');
  let yaw=0,pitch=-18,fov=90,drag=null,raf=0,program,texture;
  const gl=canvas.getContext('webgl',{antialias:false,alpha:false});
  canvas.tabIndex=0;
  for(const s of scenes){const option=document.createElement('option');option.value=s.id;option.textContent=`${s.id.toUpperCase()} · ${s.name}`;selector.append(option);}
  const clock=t=>window.sceneClock?window.sceneClock(t):String(t||0);
  function shader(type,src){const sh=gl.createShader(type);gl.shaderSource(sh,src);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh));return sh;}
  if(gl){
    const vertex=shader(gl.VERTEX_SHADER,'attribute vec2 a_position; varying vec2 v_position; void main(){v_position=a_position;gl_Position=vec4(a_position,0.,1.);}');
    const fragment=shader(gl.FRAGMENT_SHADER,`precision highp float;
      varying vec2 v_position; uniform sampler2D u_video;uniform float u_aspect,u_yaw,u_pitch,u_fov;
      void main(){float t=tan(u_fov*.5);vec3 r=normalize(vec3(v_position.x*t*u_aspect,v_position.y*t,1.));
      float cp=cos(u_pitch),sp=sin(u_pitch);r=vec3(r.x,cp*r.y+sp*r.z,-sp*r.y+cp*r.z);
      float cy=cos(u_yaw),sy=sin(u_yaw);r=vec3(cy*r.x+sy*r.z,r.y,-sy*r.x+cy*r.z);
      vec2 uv=vec2(fract(.5+atan(r.x,r.z)/6.283185307),.5-asin(clamp(r.y,-1.,1.))/3.141592654);
      gl_FragColor=texture2D(u_video,uv);}`);
    program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));gl.useProgram(program);
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    const position=gl.getAttribLocation(program,'a_position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.uniform1i(gl.getUniformLocation(program,'u_video'),0);
  } else {canvas.hidden=true;video.hidden=false;video.controls=true;document.querySelector('#sphere-fallback').hidden=false;}
  function render(){
    if(!dialog.open)return;
    if(gl&&video.readyState>=2){
      const box=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,1.5);
      const w=Math.max(1,Math.round(box.width*dpr)),h=Math.max(1,Math.round(box.height*dpr));
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
      gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,video);
      gl.uniform1f(gl.getUniformLocation(program,'u_aspect'),w/h);gl.uniform1f(gl.getUniformLocation(program,'u_yaw'),yaw*Math.PI/180);gl.uniform1f(gl.getUniformLocation(program,'u_pitch'),pitch*Math.PI/180);gl.uniform1f(gl.getUniformLocation(program,'u_fov'),fov*Math.PI/180);gl.drawArrays(gl.TRIANGLES,0,6);
    }
    document.querySelector('#sphere-orientation').textContent=`Heading ${Math.round(yaw)}° · Pitch ${Math.round(pitch)}° · FoV ${Math.round(fov)}°`;
    seek.value=String(video.duration?video.currentTime/video.duration*1000:0);
    document.querySelector('#sphere-time').textContent=`${clock(video.currentTime)} / ${clock(video.duration)}`;
    raf=requestAnimationFrame(render);
  }
  function reset(){yaw=0;pitch=-18;fov=90;}
  function choose(id,time=0){
    const s=scenes.find(s=>s.id===id);if(!s)return;selector.value=id;reset();video.pause();video.poster=`assets/posters/${id}.jpg`;video.src=`assets/videos/${id}.mp4?v=uav-action1s-final`;video.load();video.playbackRate=Number(speed.value);
    if(time)video.addEventListener('loadedmetadata',()=>{video.currentTime=Math.min(time,video.duration-.1);},{once:true});
    document.querySelector('#sphere-title').textContent=`${id.toUpperCase()} · ${s.name}`;
    video.play().catch(()=>{});
  }
  function open(){
    const main=document.querySelector('#scene-video');main.pause();for(const v of document.querySelectorAll('.video-wall video'))v.pause();
    dialog.showModal();document.body.classList.add('sphere-open');choose(selectedScene,main.currentTime);cancelAnimationFrame(raf);render();
  }
  for(const id of ['#open-sphere','#open-sphere-secondary'])document.querySelector(id).addEventListener('click',open);
  document.querySelector('#sphere-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  dialog.addEventListener('close',()=>{video.pause();cancelAnimationFrame(raf);document.body.classList.remove('sphere-open');});
  selector.addEventListener('change',()=>choose(selector.value));
  function next(delta){const i=scenes.findIndex(s=>s.id===selector.value);choose(scenes[(i+delta+scenes.length)%scenes.length].id);}
  document.querySelector('#sphere-prev').addEventListener('click',()=>next(-1));document.querySelector('#sphere-next').addEventListener('click',()=>next(1));
  document.querySelector('#sphere-reset').addEventListener('click',reset);
  document.querySelector('#sphere-play').addEventListener('click',()=>video.paused?video.play().catch(()=>{}):video.pause());
  for(const event of ['play','pause','ended'])video.addEventListener(event,()=>{const b=document.querySelector('#sphere-play');b.textContent=video.paused?'▶':'Ⅱ';b.setAttribute('aria-label',video.paused?'Play panoramic video':'Pause panoramic video');});
  speed.addEventListener('change',()=>video.playbackRate=Number(speed.value));seek.addEventListener('input',()=>{if(video.duration)video.currentTime=Number(seek.value)/1000*video.duration;});
  function clamp(){yaw=((yaw+180)%360+360)%360-180;pitch=Math.max(-80,Math.min(80,pitch));fov=Math.max(40,Math.min(110,fov));}
  canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,yaw,pitch};canvas.setPointerCapture(e.pointerId);canvas.focus();});
  canvas.addEventListener('pointermove',e=>{if(!drag)return;yaw=drag.yaw-(e.clientX-drag.x)*.16;pitch=drag.pitch+(e.clientY-drag.y)*.16;clamp();});
  for(const event of ['pointerup','pointercancel'])canvas.addEventListener(event,()=>drag=null);
  canvas.addEventListener('wheel',e=>{e.preventDefault();fov+=e.deltaY*.035;clamp();},{passive:false});
  canvas.addEventListener('keydown',e=>{const actions={ArrowLeft:()=>yaw-=5,ArrowRight:()=>yaw+=5,ArrowUp:()=>pitch+=5,ArrowDown:()=>pitch-=5,'+':()=>fov-=5,'-':()=>fov+=5};if(actions[e.key]){e.preventDefault();actions[e.key]();clamp();}});
})();

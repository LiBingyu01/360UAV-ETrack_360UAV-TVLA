'use strict';
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const scenes = window.SCENES || [];
let selectedScene = 'a1';
let wallPaused = reducedMotion.matches;

function mediaError(video) {
  video.addEventListener('error', () => {
    if (video.id === 'scene-video') $('.scene-footnote').textContent = 'Video could not be loaded. Please use the supplied local preview server and reload.';
  });
}

const wallObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    const video = entry.target;
    if (entry.isIntersecting && !wallPaused && !document.hidden) video.play().catch(() => {});
    else video.pause();
  }
}, {threshold: .05});

for (const video of $$('.video-wall video')) {
  video.poster = `assets/posters/${video.dataset.scene}.jpg`;
  video.src = `assets/videos/hero-composited/${video.dataset.scene}.mp4`;
  video.playbackRate = 4;
  mediaError(video);
  wallObserver.observe(video);
}

function updateWallControl() {
  $('#wall-toggle').textContent = wallPaused ? '▶' : 'Ⅱ';
  $('#wall-toggle').setAttribute('aria-label', wallPaused ? 'Play background videos' : 'Pause background videos');
  $('#wall-toggle').title = wallPaused ? 'Play background videos' : 'Pause background videos';
  for (const video of $$('.video-wall video')) {
    if (wallPaused || document.hidden) video.pause();
    else if (video.getBoundingClientRect().bottom > 0) video.play().catch(() => {});
  }
}
$('#wall-toggle').addEventListener('click', () => { wallPaused = !wallPaused; updateWallControl(); });
document.addEventListener('visibilitychange', () => { updateWallControl(); if(document.hidden) $('#scene-video').pause(); });
updateWallControl();

$('.menu-toggle').addEventListener('click', () => {
  const open = $('.menu-toggle').getAttribute('aria-expanded') !== 'true';
  $('.menu-toggle').setAttribute('aria-expanded', String(open));
  $('.menu-toggle').setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  $('.site-header nav').classList.toggle('open', open);
});
for (const link of $$('.site-header nav a')) link.addEventListener('click', () => {
  $('.site-header nav').classList.remove('open');
  $('.menu-toggle').setAttribute('aria-expanded', 'false');
  $('.menu-toggle').setAttribute('aria-label', 'Open navigation');
});

for (const scene of scenes) {
  const button = document.createElement('button');
  button.className = 'scene-card';
  button.dataset.id = scene.id;
  button.dataset.group = scene.group;
  button.setAttribute('aria-label', `${scene.id.toUpperCase()}: ${scene.name}`);
  const duration=scene.duration_s?`${Math.floor(scene.duration_s/60)}:${String(Math.floor(scene.duration_s%60)).padStart(2,'0')} · FULL`:'';
  button.innerHTML = `<img src="assets/posters/${scene.id}.jpg" alt="${scene.name} expert demonstration" loading="lazy" width="960" height="480"><span class="duration-badge">${duration}</span><span class="card-label"><strong>${scene.id.toUpperCase()}</strong><span>${scene.name}</span></span>`;
  button.addEventListener('click', () => selectScene(scene.id, true));
  $('#scene-grid').append(button);
}
function selectScene(id, play = false) {
  const scene = scenes.find(s => s.id === id);
  if (!scene) return;
  selectedScene = id;
  const video = $('#scene-video');
  video.pause();
  video.poster = `assets/posters/${id}.jpg`;
  video.src = `assets/videos/${id}.mp4?v=uav-action1s-final`;
  video.load();
  video.playbackRate = Number($('#playback-speed').value);
  if(play) video.play().catch(() => {});
  $('#scene-id').textContent = id.toUpperCase();
  $('#scene-group').textContent = `TASK ${scene.group}`;
  $('#scene-title').textContent = scene.name;
  $('#scene-description').textContent = scene.description;
  $('#scene-duration').textContent = `${Math.floor((scene.duration_s||0)/60)}:${String(Math.floor((scene.duration_s||0)%60)).padStart(2,'0')} · complete · 10 Hz`;
  $('#download-video').href = `assets/videos/${id}.mp4?v=uav-action1s-final`;
  $('#download-trajectory').href = `assets/trajectories/${id}.json`;
  $('#download-trajectory-figure').href = `assets/trajectory-figures/${id}.pdf`;
  $('#scene-town').textContent = scene.town;
  $('#scene-weather').textContent = scene.weather.replace(/([a-z])([A-Z])/g, '$1 $2');
  for (const button of $$('.scene-card')) {
    const selected = button.dataset.id === id;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  }
  document.dispatchEvent(new CustomEvent('scenechange',{detail:{id}}));
}
for (const button of $$('.task-filter button')) button.addEventListener('click', () => {
  const filter = button.dataset.filter;
  for(const sibling of $$('.task-filter button')) {
    sibling.classList.toggle('active', sibling === button);
    sibling.setAttribute('aria-pressed', String(sibling === button));
  }
  for(const card of $$('.scene-card')) card.hidden = filter !== 'all' && card.dataset.group !== filter;
  if(filter !== 'all' && scenes.find(s => s.id === selectedScene)?.group !== filter) selectScene(scenes.find(s => s.group === filter).id);
});
selectScene('a1');
mediaError($('#scene-video'));

// The image explorer changes only viewing direction, using the same recorded ERP.
const canvas = $('#perspective-canvas');
const panorama = $('#interactive-panorama');
const headingSlider = $('#heading');
const pitchSlider = $('#view-pitch');
const fovSlider = $('#view-fov');
const view = {yaw:0,pitch:0,fov:90};
const gl = canvas.getContext('webgl', {alpha:false,antialias:false});
let renderPending=false, panoramaReady=false, viewProgram, viewTexture;
const radians = degrees => degrees*Math.PI/180;
const wrapHeading = angle => ((angle+180)%360+360)%360-180;
if(gl){
  function compileViewShader(type,source){
    const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }
  const vertex=compileViewShader(gl.VERTEX_SHADER,'attribute vec2 position; varying vec2 ray; void main(){ray=position;gl_Position=vec4(position,0.,1.);}');
  const fragment=compileViewShader(gl.FRAGMENT_SHADER,`precision highp float;
    varying vec2 ray;uniform sampler2D panorama;uniform float yaw,pitch,fov,aspect;
    void main(){float t=tan(fov*.5);vec3 r=normalize(vec3(ray.x*t,ray.y*t/aspect,1.));
      float cp=cos(pitch),sp=sin(pitch);r=vec3(r.x,cp*r.y+sp*r.z,-sp*r.y+cp*r.z);
      float cy=cos(yaw),sy=sin(yaw);r=vec3(cy*r.x+sy*r.z,r.y,-sy*r.x+cy*r.z);
      vec2 uv=vec2(fract(.5+atan(r.x,r.z)/6.283185307),.5-asin(clamp(r.y,-1.,1.))/3.141592654);
      gl_FragColor=texture2D(panorama,uv);}`);
  viewProgram=gl.createProgram();gl.attachShader(viewProgram,vertex);gl.attachShader(viewProgram,fragment);gl.linkProgram(viewProgram);
  if(!gl.getProgramParameter(viewProgram,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(viewProgram));
  gl.useProgram(viewProgram);
  const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const position=gl.getAttribLocation(viewProgram,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
  viewTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,viewTexture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.uniform1i(gl.getUniformLocation(viewProgram,'panorama'),0);
}else{
  $('#canvas-hint').textContent='Interactive graphics are unavailable. Use the ERP panorama to explore the full scene.';
}
function viewRay(x,y){
  const t=Math.tan(radians(view.fov)/2),aspect=canvas.width/canvas.height;
  let rx=x*t,ry=y*t/aspect,rz=1;
  const cp=Math.cos(radians(view.pitch)),sp=Math.sin(radians(view.pitch));
  [ry,rz]=[cp*ry+sp*rz,-sp*ry+cp*rz];
  const cy=Math.cos(radians(view.yaw)),sy=Math.sin(radians(view.yaw));
  [rx,rz]=[cy*rx+sy*rz,-sy*rx+cy*rz];
  return [((.5+Math.atan2(rx,rz)/(2*Math.PI))%1+1)%1,.5-Math.asin(ry/Math.hypot(rx,ry,rz))/Math.PI];
}
function renderPerspective(){
  renderPending=false;
  if(gl&&panoramaReady){
    const box=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.max(1,Math.round(box.width*dpr));canvas.height=Math.max(1,Math.round(box.height*dpr));
    gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(viewProgram);
    for(const [key,value] of Object.entries({yaw:radians(view.yaw),pitch:radians(view.pitch),fov:radians(view.fov),aspect:canvas.width/canvas.height}))gl.uniform1f(gl.getUniformLocation(viewProgram,key),value);
    gl.drawArrays(gl.TRIANGLES,0,6);
  }
  headingSlider.value=String(Math.round(view.yaw));pitchSlider.value=String(Math.round(view.pitch));fovSlider.value=String(Math.round(view.fov));
  $('#heading-value').value=`${Math.round(view.yaw)}°`;$('#pitch-value').value=`${Math.round(view.pitch)}°`;$('#fov-value').value=`${Math.round(view.fov)}°`;
  $('#view-angle').textContent=`${Math.round(view.fov)}° FoV`;
  // Project all four frustum edges, splitting strokes at the ERP seam.
  const points=[];
  for(let i=0;i<=32;i++)points.push(viewRay(-1+i/16,1));
  for(let i=1;i<=32;i++)points.push(viewRay(1,1-i/16));
  for(let i=1;i<=32;i++)points.push(viewRay(1-i/16,-1));
  for(let i=1;i<=32;i++)points.push(viewRay(-1,-1+i/16));
  let path='',previous;
  for(const [u,v] of points){
    if(previous&&Math.abs(u-previous[0])>.5){
      const shifted=u+(u<previous[0]?1:-1),edge=shifted>previous[0]?1:0;
      const edgeV=previous[1]+(v-previous[1])*(edge-previous[0])/(shifted-previous[0]);
      path+=` L${edge*1000},${edgeV*500} M${(1-edge)*1000},${edgeV*500} L${u*1000},${v*500}`;
    }else path+=`${previous?' L':'M'}${u*1000},${v*500}`;
    previous=[u,v];
  }
  $('#fov-window path').setAttribute('d',path);
}
function requestRender(){if(!renderPending){renderPending=true;requestAnimationFrame(renderPerspective);}}
function updateView(){view.yaw=wrapHeading(view.yaw);view.pitch=Math.max(-89,Math.min(89,view.pitch));view.fov=Math.max(35,Math.min(120,view.fov));requestRender();}
function loadPanorama(){
  if(gl){gl.bindTexture(gl.TEXTURE_2D,viewTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,panorama);}
  panoramaReady=true;requestRender();
}
panorama.addEventListener('load',loadPanorama);if(panorama.complete&&panorama.naturalWidth)loadPanorama();
headingSlider.addEventListener('input',()=>{view.yaw=Number(headingSlider.value);updateView();});
pitchSlider.addEventListener('input',()=>{view.pitch=Number(pitchSlider.value);updateView();});
fovSlider.addEventListener('input',()=>{view.fov=Number(fovSlider.value);updateView();});
$('#reset-view').addEventListener('click',()=>{Object.assign(view,{yaw:0,pitch:0,fov:90});updateView();});
const viewPointers=new Map();let viewGesture;
function startGesture(){
  const points=[...viewPointers.values()];
  viewGesture=points.length===1?{x:points[0].x,y:points[0].y,yaw:view.yaw,pitch:view.pitch}:points.length===2?{distance:Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y),fov:view.fov}:null;
}
for(const surface of [canvas,$('.erp-frame')]){
  surface.addEventListener('pointerdown',e=>{viewPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});surface.setPointerCapture(e.pointerId);startGesture();if(surface===canvas)canvas.focus({preventScroll:true});});
  surface.addEventListener('pointermove',e=>{
    if(!viewPointers.has(e.pointerId)||!viewGesture)return;
    viewPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const points=[...viewPointers.values()];
    if(points.length===2&&viewGesture.distance){view.fov=viewGesture.fov*viewGesture.distance/Math.max(1,Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y));}
    else if(points.length===1){const scale=view.fov/surface.getBoundingClientRect().width;view.yaw=viewGesture.yaw-(e.clientX-viewGesture.x)*scale;view.pitch=viewGesture.pitch+(e.clientY-viewGesture.y)*scale;}
    updateView();
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture'])surface.addEventListener(event,e=>{viewPointers.delete(e.pointerId);startGesture();});
  surface.addEventListener('wheel',e=>{e.preventDefault();view.fov+=e.deltaY*.04;updateView();},{passive:false});
}
canvas.addEventListener('keydown',e=>{const actions={ArrowLeft:()=>view.yaw-=5,ArrowRight:()=>view.yaw+=5,ArrowUp:()=>view.pitch+=5,ArrowDown:()=>view.pitch-=5,'+':()=>view.fov-=5,'=':()=>view.fov-=5,'-':()=>view.fov+=5,Home:()=>Object.assign(view,{yaw:0,pitch:0,fov:90})};if(actions[e.key]){e.preventDefault();actions[e.key]();updateView();}});
$('#view-fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('.perspective-stage').requestFullscreen();}catch{ $('#canvas-hint').textContent='Fullscreen is unavailable in this browser. Drag or zoom within the viewer.';}});
new ResizeObserver(requestRender).observe(canvas);

const results=[
  {name:'Temporal BC',overall:[115.81,12.08,1.33],taskI:[149.10,12.62,0],taskII:[98.67,11.80,2.02]},
  {name:'D-VAT-BC',overall:[114.79,11.95,1.33],taskI:[171.33,14.00,1.96],taskII:[85.66,10.90,1.01]},
  {name:'Fast-WAM',overall:[175.77,18.60,2.67],taskI:[170.16,14.54,1.96],taskII:[178.66,20.69,3.03]},
  {name:'π₀ · fine-tuned',overall:[229.93,22.56,5.33],taskI:[310.73,23.90,3.92],taskII:[188.30,21.87,6.06]},
  {name:'π₀.₅ · fine-tuned',overall:[244.21,25.68,6.67],taskI:[305.55,24.40,5.88],taskII:[212.61,26.34,7.07]},
  {name:'360UAV-TVLA · π₀',ours:true,overall:[375.29,35.28,10.67],taskI:[537.84,39.21,7.84],taskII:[291.56,33.25,12.12]},
  {name:'360UAV-TVLA · π₀.₅',ours:true,overall:[337.21,33.64,10.67],taskI:[393.14,30.17,9.80],taskII:[308.39,35.42,11.11]}
];
function renderResults(task) {
  const ranks=[0,1,2].map(col=>[...new Set(results.map(row=>row[task][col]))].sort((a,b)=>b-a));
  $('#results-body').innerHTML=results.map(row=>`<tr class="${row.ours?'ours':''}"><td>${row.name}</td>${row[task].map((value,i)=>`<td class="${value===ranks[i][0]?'best':value===ranks[i][1]?'second':''}">${value.toFixed(2)}</td>`).join('')}</tr>`).join('');
  $('#results-count').textContent = `${task==='taskI'?51:task==='taskII'?99:150} evaluation episodes`;
}
for(const button of $$('[data-result]')) button.addEventListener('click',()=>{
  for(const sibling of $$('[data-result]')){sibling.classList.toggle('active',sibling===button);sibling.setAttribute('aria-pressed',String(sibling===button));}
  renderResults(button.dataset.result);
});
renderResults('overall');

$('#copy-citation').addEventListener('click', async()=>{
  try {
    await navigator.clipboard.writeText($('#citation').textContent);
    $('#copy-status').textContent='Copied';
  } catch(error) {
    const selection=window.getSelection();const range=document.createRange();range.selectNodeContents($('#citation'));selection.removeAllRanges();selection.addRange(range);
    $('#copy-status').textContent='Select and copy the citation below';
  }
});

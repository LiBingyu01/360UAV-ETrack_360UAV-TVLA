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
  video.src = `assets/videos/hero/${video.dataset.scene}.mp4`;
  video.playbackRate = 4;
  mediaError(video);
  wallObserver.observe(video);
}

function updateWallControl() {
  $('#wall-toggle').innerHTML = wallPaused ? '▶ <span>Play motion</span>' : 'Ⅱ <span>Pause motion</span>';
  $('#wall-toggle').setAttribute('aria-label', wallPaused ? 'Play background videos' : 'Pause background videos');
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

// Reproject a real recorded ERP frame into a virtual 90-degree perspective camera.
// No target position, predicted trajectory, or learned action is involved here.
const canvas = $('#perspective-canvas');
const context = canvas.getContext('2d', {alpha:false});
const panorama = $('#interactive-panorama');
const headingSlider = $('#heading');
let sourcePixels, sourceWidth, sourceHeight, renderPending = false;
const outputPixels = context.createImageData(canvas.width, canvas.height);
const rayYaw = new Float32Array(canvas.width * canvas.height);
const rayV = new Float32Array(canvas.width * canvas.height);
for(let y=0; y<canvas.height; y++) for(let x=0; x<canvas.width; x++) {
  const rx = (2*(x+.5)/canvas.width-1);
  const ry = (1-2*(y+.5)/canvas.height) * canvas.height / canvas.width;
  const index = y*canvas.width+x;
  rayYaw[index] = Math.atan2(rx,1);
  rayV[index] = .5 - Math.atan2(ry, Math.hypot(rx,1))/Math.PI;
}
function renderPerspective() {
  renderPending = false;
  if(!sourcePixels) return;
  const degrees = Number(headingSlider.value);
  const angle = degrees*Math.PI/180;
  const output = outputPixels.data;
  for(let i=0; i<rayYaw.length; i++) {
    const u = ((.5 + (rayYaw[i]+angle)/(2*Math.PI))%1 + 1)%1;
    const sx = Math.min(sourceWidth-1,Math.floor(u*sourceWidth));
    const sy = Math.max(0,Math.min(sourceHeight-1,Math.floor(rayV[i]*sourceHeight)));
    const sourceIndex = (sy*sourceWidth+sx)*4;
    const targetIndex=i*4;
    output[targetIndex]=sourcePixels[sourceIndex];
    output[targetIndex+1]=sourcePixels[sourceIndex+1];
    output[targetIndex+2]=sourcePixels[sourceIndex+2];
    output[targetIndex+3]=255;
  }
  context.putImageData(outputPixels,0,0);
  $('#heading-value').value = `${degrees>0?'+':''}${degrees}°`;
  $('#fov-window').style.left = `${37.5+degrees/360*100}%`;
}
function requestRender() {if(!renderPending) {renderPending=true;requestAnimationFrame(renderPerspective);}}
function loadPanorama() {
  const offscreen = document.createElement('canvas');
  sourceWidth=panorama.naturalWidth;sourceHeight=panorama.naturalHeight;
  offscreen.width=sourceWidth;offscreen.height=sourceHeight;
  const c=offscreen.getContext('2d',{willReadFrequently:true});
  c.drawImage(panorama,0,0);sourcePixels=c.getImageData(0,0,sourceWidth,sourceHeight).data;
  requestRender();
}
panorama.addEventListener('load',loadPanorama);
if(panorama.complete && panorama.naturalWidth) loadPanorama();
headingSlider.addEventListener('input',requestRender);
$('#reset-view').addEventListener('click',()=>{headingSlider.value='0';requestRender();});
let dragStart=null;
canvas.addEventListener('pointerdown',e=>{dragStart={x:e.clientX,angle:Number(headingSlider.value)};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{
  if(!dragStart)return;
  const angle=dragStart.angle-(e.clientX-dragStart.x)*.3;
  headingSlider.value=String(Math.round(((angle+180)%360+360)%360-180));requestRender();
});
canvas.addEventListener('pointerup',()=>dragStart=null);
canvas.addEventListener('pointercancel',()=>dragStart=null);

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

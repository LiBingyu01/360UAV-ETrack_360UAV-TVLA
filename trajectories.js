'use strict';
(() => {
  const video=document.querySelector('#scene-video');
  const route=document.querySelector('#route-canvas'),forecast=document.querySelector('#forecast-canvas');
  const status=document.querySelector('#trajectory-status');
  const colors={uav:'#2d7fac',target:'#368153',prediction:'#c7569e',grid:'#e1e7de',text:'#63716b'};
  const cache=new Map();let data=null,sceneId='',lastFrame=-1;
  const clock=t=>`${String(Math.floor((t||0)/60)).padStart(2,'0')}:${String(Math.floor((t||0)%60)).padStart(2,'0')}`;
  window.sceneClock=clock;
  function prepare(canvas){
    const box=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
    const w=Math.max(280,box.width),h=Math.max(230,box.height);
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.lineCap='round';ctx.lineJoin='round';ctx.font='10px Arial';return {ctx,w,h};
  }
  function line(ctx,points,project,color,width=2,alpha=1,dashed=false){
    if(!points.length)return;ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.globalAlpha=alpha;if(dashed)ctx.setLineDash([3,5]);ctx.beginPath();points.forEach((p,i)=>{const q=project(p);if(i)ctx.lineTo(...q);else ctx.moveTo(...q);});ctx.stroke();ctx.restore();
  }
  function marker(ctx,q,color,r=4){ctx.fillStyle=color;ctx.beginPath();ctx.arc(...q,r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='white';ctx.lineWidth=1.5;ctx.stroke();}
  function fit(points,w,h,pad=40){
    const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);let x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
    const scale=Math.min((w-pad*2)/Math.max(x1-x0,2),(h-pad*2)/Math.max(y1-y0,2));
    const xc=(x0+x1)/2,yc=(y0+y1)/2;
    return {project:p=>[w/2+(p[0]-xc)*scale,h/2-(p[1]-yc)*scale],x0,x1,y0,y1,scale,xc,yc};
  }
  function drawRoute(frame){
    const {ctx,w,h}=prepare(route);const all=[...data.tracker,...data.target];const bounds=fit(all,w,h,39),project=bounds.project;
    const step=Math.pow(10,Math.floor(Math.log10(Math.max(bounds.x1-bounds.x0,bounds.y1-bounds.y0,2))))/2;
    ctx.strokeStyle=colors.grid;ctx.fillStyle=colors.text;ctx.lineWidth=.7;
    for(let x=Math.ceil(bounds.x0/step)*step;x<=bounds.x1;x+=step){let a=project([x,bounds.y0]),b=project([x,bounds.y1]);ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();ctx.fillText(`${x.toFixed(0)}`,a[0]-8,h-13);}
    for(let y=Math.ceil(bounds.y0/step)*step;y<=bounds.y1;y+=step){let a=project([bounds.x0,y]),b=project([bounds.x1,y]);ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();ctx.fillText(`${y.toFixed(0)}`,8,a[1]+3);}
    const stride=Math.max(1,Math.ceil(data.frames/1200)),thin=a=>a.filter((_,i)=>i%stride===0);
    line(ctx,thin(data.tracker),project,'#9aa5a0',1,.3,true);line(ctx,thin(data.target),project,colors.target,1,.25,true);
    line(ctx,thin(data.tracker.slice(0,frame+1)).concat([data.tracker[frame]]),project,'#9aa5a0',1.8);
    line(ctx,thin(data.target.slice(0,frame+1)).concat([data.target[frame]]),project,colors.target,2.2);
    const yaw=data.initial_yaw_rad,c=Math.cos(yaw),s=Math.sin(yaw),origin=data.tracker[frame];
    const predicted=data.predictions[frame].map(p=>[origin[0]+c*p[0]-s*p[1],origin[1]+s*p[0]+c*p[1],origin[2]+p[2]]);
    line(ctx,predicted,project,colors.prediction,3);
    if(data.predicted_uav_displacements_m){const planned=[origin,...data.predicted_uav_displacements_m[frame].map(p=>[origin[0]+c*p[0]-s*p[1],origin[1]+s*p[0]+c*p[1],origin[2]+p[2]])];line(ctx,planned,project,colors.uav,3);marker(ctx,project(planned[planned.length-1]),colors.uav,2.8);}
    marker(ctx,project(origin),colors.uav);marker(ctx,project(data.target[frame]),colors.target);
    ctx.fillStyle=colors.text;ctx.fillText('Y (m)',9,18);ctx.fillText('X (m)',w-37,h-13);
    const dz=(data.target[frame][2]-origin[2]).toFixed(1);ctx.fillText(`Target relative altitude: ${dz} m`,w-190,18);
  }
  function drawForecast(frame){
    const {ctx,w,h}=prepare(forecast),origin=data.tracker[frame],yaw=data.initial_yaw_rad,c=Math.cos(yaw),s=Math.sin(yaw);
    const gt=data.target.slice(frame+1,Math.min(frame+11,data.frames)).map(p=>{const x=p[0]-origin[0],y=p[1]-origin[1];return[c*x+s*y,-s*x+c*y,p[2]-origin[2]];});
    const pred=data.predictions[frame];const iso=p=>[.85*p[0]-.65*p[1],.3*p[0]+.38*p[1]+p[2]];
    const all=[...pred,...gt],bounds=fit(all.map(iso),w,h,48),project=p=>bounds.project(iso(p));
    // A local XY floor provides depth cues; axes retain the fixed control frame.
    const mins=[0,1,2].map(k=>Math.min(...all.map(p=>p[k]))),maxs=[0,1,2].map(k=>Math.max(...all.map(p=>p[k])));
    const z=mins[2]-.1;
    for(let i=0;i<5;i++){const x=mins[0]+(maxs[0]-mins[0])*i/4,y=mins[1]+(maxs[1]-mins[1])*i/4;line(ctx,[[x,mins[1],z],[x,maxs[1],z]],project,colors.grid,.8);line(ctx,[[mins[0],y,z],[maxs[0],y,z]],project,colors.grid,.8);}
    line(ctx,gt,project,colors.target,2.6);line(ctx,pred,project,colors.prediction,2.6,1,true);
    for(const p of gt)marker(ctx,project(p),colors.target,2.4);for(const p of pred)marker(ctx,project(p),colors.prediction,2.4);
    ctx.fillStyle=colors.text;ctx.fillText(`Forward ${mins[0].toFixed(1)}–${maxs[0].toFixed(1)} m`,15,18);ctx.fillText(`Right ${mins[1].toFixed(1)}–${maxs[1].toFixed(1)} m`,15,33);
    ctx.fillText(`Up ${mins[2].toFixed(1)}–${maxs[2].toFixed(1)} m`,15,48);
    // Orientation triad, independent of the local zoom used for the forecast.
    const o=[w-61,h-36];for(const [label,delta,color] of [['Forward',[27,-10],colors.uav],['Right',[-22,-13],colors.target],['Up',[0,-32],colors.text]]){ctx.strokeStyle=color;ctx.beginPath();ctx.moveTo(...o);ctx.lineTo(o[0]+delta[0],o[1]+delta[1]);ctx.stroke();ctx.fillStyle=color;ctx.font='8px Arial';ctx.fillText(label,o[0]+delta[0]-12,o[1]+delta[1]-4);}
    document.querySelector('#forecast-time').textContent=`Frame ${frame+1} · next 1.0 s`;
  }
  function draw(force=false){
    document.querySelector('#scene-time').textContent=`${clock(video.currentTime)} / ${clock(video.duration)}`;
    if(!data)return;const frame=Math.max(0,Math.min(data.frames-1,Math.floor(video.currentTime*data.fps)));
    if(frame===lastFrame&&!force)return;lastFrame=frame;drawRoute(frame);drawForecast(frame);
    status.textContent=`${sceneId.toUpperCase()} · frame ${frame+1} / ${data.frames.toLocaleString()} · native forecasts at every 10 Hz observation`;
  }
  async function load(id){
    sceneId=id;data=null;lastFrame=-1;status.textContent='Loading synchronized trajectory data…';
    try {if(!cache.has(id))cache.set(id,fetch(`assets/trajectories/${id}.json`).then(r=>{if(!r.ok)throw new Error(r.status);return r.json();}));const next=await cache.get(id);if(sceneId!==id)return;data=next;draw(true);}
    catch(e){cache.delete(id);if(sceneId===id)status.textContent='Trajectory data could not be loaded. Reload the page through the local preview server.';}
  }
  document.querySelector('#playback-speed').addEventListener('change',e=>video.playbackRate=Number(e.target.value));
  for(const event of ['timeupdate','loadedmetadata','seeked'])video.addEventListener(event,()=>draw());
  const resize=new ResizeObserver(()=>draw(true));resize.observe(route);resize.observe(forecast);
  document.addEventListener('scenechange',e=>load(e.detail.id));load(selectedScene);
  function animate(){if(!video.paused&&!document.hidden)draw();requestAnimationFrame(animate);}requestAnimationFrame(animate);
})();

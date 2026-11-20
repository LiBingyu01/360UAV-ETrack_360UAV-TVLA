'use strict';
(() => {
  // One shared GPU renderer serves every inset. Each reads the displayed ERP
  // video itself, so pause, seek, playback speed and scene changes stay in sync.
  const surface = document.createElement('canvas');
  surface.width = 480; surface.height = 270;
  const gl = surface.getContext('webgl', {alpha:false, antialias:false});
  if (!gl) return;
  function shader(type, source) {
    const result = gl.createShader(type);
    gl.shaderSource(result, source); gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(result));
    return result;
  }
  const program = gl.createProgram();
  gl.attachShader(program, shader(gl.VERTEX_SHADER,
    'attribute vec2 position; varying vec2 ray; void main(){ray=position;gl_Position=vec4(position,0.,1.);}'));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, `precision highp float;
    varying vec2 ray; uniform sampler2D image;
    void main(){vec3 r=normalize(vec3(ray.x,ray.y/1.777777778,1.));
      vec2 uv=vec2(.5+atan(r.x,r.z)/6.283185307,.5-asin(r.y)/3.141592654);
      gl_FragColor=texture2D(image,uv);}`));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
  const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,texture);
  for (const axis of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D,axis,gl.CLAMP_TO_EDGE);
  for (const filter of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D,filter,gl.LINEAR);
  gl.uniform1i(gl.getUniformLocation(program,'image'),0);
  gl.viewport(0,0,480,270);

  const entries = new Map();
  function paint(entry, source) {
    if (!entry.visible || document.hidden || !source) return;
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
    gl.drawArrays(gl.TRIANGLES,0,6);
    entry.context.drawImage(surface,0,0,480,270);
    entry.inset.classList.add('ready');
  }
  function draw(entry) {
    if (entry.video.readyState >= 2 && entry.video.videoWidth) paint(entry,entry.video);
    else if (entry.poster?.complete && entry.poster.naturalWidth) paint(entry,entry.poster);
  }
  function loadPoster(entry) {
    entry.inset.classList.remove('ready');
    const poster = new Image(); entry.poster = poster;
    poster.addEventListener('load',()=>{if(entry.poster===poster) draw(entry);},{once:true});
    poster.src = entry.video.poster;
  }
  const observer = new IntersectionObserver(changes=>{
    for (const change of changes) {
      const entry=entries.get(change.target);
      entry.visible=change.isIntersecting;
      if (entry.visible) draw(entry);
    }
  });
  for (const video of document.querySelectorAll('.video-wall video, #scene-video, #sphere-video')) {
    let host;
    if (video.id === 'sphere-video') host=video.closest('.sphere-stage');
    else {
      host=document.createElement('div');
      host.className=video.id==='scene-video'?'video-media':'hero-tile';
      video.before(host); host.append(video);
    }
    const inset=document.createElement('figure'); inset.className='front-view-inset';
    inset.setAttribute('aria-label','Synchronized fixed-heading forward view, 90-degree horizontal field of view');
    const canvas=document.createElement('canvas'); canvas.width=480;canvas.height=270;
    canvas.setAttribute('aria-hidden','true'); inset.append(canvas);
    const label=document.createElement('figcaption');label.textContent='Front view · 90°';inset.append(label);
    host.append(inset);
    const entry={video,inset,context:canvas.getContext('2d',{alpha:false}),poster:null,visible:false,last:-Infinity};
    entries.set(host,entry);observer.observe(host);loadPoster(entry);
    if (video.id === 'scene-video') {
      // Fullscreen the composed player, rather than only the native video.
      video.controlsList.add('nofullscreen');
      const expand=document.createElement('button');expand.className='video-enlarge';
      expand.textContent='⛶';expand.setAttribute('aria-label','Expand video with forward view');
      expand.title='Expand video with forward view';host.append(expand);
      function expanded(){return document.fullscreenElement===host||host.classList.contains('is-expanded');}
      function updateButton(){
        const open=expanded();expand.textContent=open?'×':'⛶';
        expand.setAttribute('aria-label',open?'Close enlarged video':'Expand video with forward view');
        expand.title=open?'Close enlarged video':'Expand video with forward view';draw(entry);
      }
      function closeFallback(){host.classList.remove('is-expanded');document.body.classList.remove('video-expanded');updateButton();}
      expand.addEventListener('click',async()=>{
        if(document.fullscreenElement===host)await document.exitFullscreen();
        else if(host.classList.contains('is-expanded'))closeFallback();
        else {
          try{if(!host.requestFullscreen)throw new Error('Fullscreen unavailable');await host.requestFullscreen();}
          catch{host.classList.add('is-expanded');document.body.classList.add('video-expanded');}
        }
        updateButton();
      });
      document.addEventListener('fullscreenchange',updateButton);
      document.addEventListener('keydown',event=>{if(event.key==='Escape'&&host.classList.contains('is-expanded'))closeFallback();});
    }
    for (const event of ['loadeddata','seeked','pause','resize']) video.addEventListener(event,()=>draw(entry));
    video.addEventListener('emptied',()=>loadPoster(entry));
    if ('requestVideoFrameCallback' in video) {
      function onFrame(now) {
        if (now-entry.last>=33) {draw(entry);entry.last=now;}
        video.requestVideoFrameCallback(onFrame);
      }
      video.requestVideoFrameCallback(onFrame);
    } else video.addEventListener('timeupdate',()=>draw(entry));
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)for(const entry of entries.values())draw(entry);});
})();

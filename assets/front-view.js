'use strict';
(() => {
  // Preprojected 480x270 clips use the browser's native video compositor.
  // No WebGL uploads, GPU-to-CPU copies or per-frame JavaScript are needed.
  const entries=[];
  function sceneKey(video){return (video.getAttribute('src')||'').match(/\/([ab][1-4])\.mp4(?:[?]|$)/)?.[1];}
  function canPlay(entry){return entry.visible&&!document.hidden&&!entry.video.paused&&!entry.video.ended&&!entry.video.seeking&&!entry.waiting;}
  function ensureSource(entry){
    const key=sceneKey(entry.video);if(!key)return false;
    const {forward}=entry;
    if(entry.key!==key){entry.key=key;entry.inset.classList.remove('ready');forward.pause();forward.poster=`assets/posters/front/${key}.jpg`;}
    if(entry.visible&&forward.dataset.scene!==key){
      forward.dataset.scene=key;forward.src=`assets/videos/front/${key}.mp4?v=preprojected1`;
      forward.preload='auto';forward.loop=entry.video.loop;forward.load();
    }
    entry.inset.classList.add('ready');return true;
  }
  function sync(entry,force=false){
    if(!ensureSource(entry))return;
    const {video,forward}=entry;
    if(!entry.visible||document.hidden){forward.pause();return;}
    if(forward.playbackRate!==video.playbackRate)forward.playbackRate=video.playbackRate;
    if(forward.readyState>=1&&Number.isFinite(forward.duration)&&!forward.seeking){
      const time=Math.max(0,Math.min(video.currentTime,forward.duration));
      if(force||Math.abs(forward.currentTime-time)>.18)forward.currentTime=time;
    }
    if(canPlay(entry)){if(forward.paused)forward.play().catch(()=>{});}
    else forward.pause();
  }
  const observer=new IntersectionObserver(changes=>{
    for(const change of changes){const entry=entries.find(item=>item.host===change.target);entry.visible=change.isIntersecting;sync(entry,true);}
  },{threshold:.01});
  for(const video of document.querySelectorAll('#scene-video, #sphere-video')){
    let host;
    if(video.id==='sphere-video')host=video.closest('.sphere-stage');
    else{host=document.createElement('div');host.className='video-media';video.before(host);host.append(video);}
    const inset=document.createElement('figure');inset.className='front-view-inset';
    inset.setAttribute('aria-label','Synchronized fixed-heading forward view, 90-degree horizontal field of view');
    const forward=document.createElement('video');forward.muted=true;forward.playsInline=true;
    forward.preload='none';forward.disablePictureInPicture=true;forward.setAttribute('aria-hidden','true');
    inset.append(forward);
    const label=document.createElement('figcaption');label.textContent='Front view · 90°';inset.append(label);host.append(inset);
    const entry={video,forward,inset,host,key:null,visible:false,waiting:false};entries.push(entry);observer.observe(host);ensureSource(entry);
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
        expand.title=open?'Close enlarged video':'Expand video with forward view';sync(entry,true);
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
    forward.addEventListener('loadedmetadata',()=>sync(entry,true));
    forward.addEventListener('loadeddata',()=>sync(entry));
    video.addEventListener('emptied',()=>{entry.waiting=false;sync(entry,true);});
    video.addEventListener('waiting',()=>{entry.waiting=true;forward.pause();});
    video.addEventListener('playing',()=>{entry.waiting=false;sync(entry,true);});
    video.addEventListener('seeking',()=>forward.pause());
    for(const event of ['loadeddata','seeked','ratechange','ended'])video.addEventListener(event,()=>sync(entry,true));
    for(const event of ['play','pause','timeupdate'])video.addEventListener(event,()=>sync(entry));
  }
  document.addEventListener('visibilitychange',()=>{for(const entry of entries)sync(entry,true);});
})();

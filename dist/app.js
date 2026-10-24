const PLAYLIST_URL = 'https://soundcloud.com/kratexmusic/sets/house-this-101-house-music';
document.fonts.load('700 16px "House This Logo"').then(faces => {
  document.documentElement.classList.toggle('logo-font-fallback', faces.length === 0);
}).catch(() => document.documentElement.classList.add('logo-font-fallback'));
const REFRESH_MS = 5 * 60 * 1000;
const $ = (selector) => document.querySelector(selector);
const icon = (name) => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shortTitle = (title) => title.replace(/\s*\b(TECH HOUSE|HOUSE MUSIC|HOUSE REMIX)\s*$/i, '').replace(/\s*\(?Kratex Remix\)?\s*/i, ' ').trim();
const time = (ms) => `${Math.floor((ms || 0) / 60000)}:${String(Math.floor((ms || 0) / 1000) % 60).padStart(2, '0')}`;
const assetURL = (name) => new URL(name, import.meta.url).href;
const artURL = (url) => /^https:\/\/i\d+\.sndcdn\.com\//.test(url || '') ? url.replace(/-(large|t300x300)\./, '-t500x500.') : assetURL('fallback.svg');
const trackURL = (url) => { try { const u = new URL(url); return u.protocol === 'https:' && /(^|\.)soundcloud\.com$/.test(u.hostname) ? u.href : PLAYLIST_URL; } catch { return PLAYLIST_URL; } };
const normalize = (track) => ({ id: String(track.id), title: track.title, artist: (track.publisher_metadata?.artist || track.artist || track.user?.username || 'Kratex').trim(), artwork: artURL(track.artwork_url || track.artwork), url: trackURL(track.permalink_url || track.url), duration: Number(track.duration) || 0 });
const palette = ['#4f6b70','#8a4336','#d9b881','#57776a','#333d54','#9f513a','#bca268','#4e686e'];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const hoverDevice = matchMedia('(hover: hover) and (pointer: fine)');
const compactScreen = matchMedia('(max-width: 800px)');
let tracks = [], slots = [], view = 'stack', openId = null, currentId = null;
let widget, widgetReady = false, playing = false, playerIds = [], singleMode = false;
let pendingId = null, restartId = null, lastSync = 0, refreshBusy = false, playTimeout, toastTimeout;
let selectedDuration = 0, isSeeking = false, framePending = false, closeTimer, syncFrame;

function toast(message) {
  clearTimeout(toastTimeout);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimeout = setTimeout(() => { $('#toast').hidden = true; }, 6500);
}
function syncStatus(live, message) {
  $('#sync-status').classList.toggle('is-live', live);
  $('#sync-status').replaceChildren(Object.assign(document.createElement('span'), {}), document.createTextNode(message));
}
function countTracks(count) {
  $('#track-count').innerHTML = `${String(count).padStart(3,'0')}<span>TRACKS</span>`;
  $('#collection-counter').textContent = `01 — ${String(count).padStart(2,'0')}`;
}
function render() {
  const fragment = document.createDocumentFragment();
  tracks.forEach((track, index) => {
    const slot = document.createElement('article');
    slot.className = 'record-slot';
    slot.dataset.id = track.id;
    slot.dataset.trackUrl = track.url;
    slot.dataset.duration = track.duration;
    slot.style.setProperty('--sleeve', palette[index % palette.length]);
    slot.style.setProperty('--sleeve-ink', [2,6].includes(index % palette.length) ? '#262825' : '#fff');
    const title = escapeHTML(shortTitle(track.title));
    const spine = `<strong>${title}</strong><small>Kratex Remix</small>`;
    slot.innerHTML = `<span class="record-index" aria-hidden="true">${String(index + 1).padStart(2,'0')}</span><button class="record-button" aria-label="Open ${escapeHTML(track.title)}" aria-expanded="false"><span class="record-object"><span class="record-back"><img src="${escapeHTML(track.artwork)}" alt="" aria-hidden="true" loading="lazy" decoding="async"></span><span class="cover"><img src="${escapeHTML(track.artwork)}" alt="${escapeHTML(shortTitle(track.title))} artwork" ${index > 5 ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async" crossorigin="anonymous"><span class="cover-play"><span>${icon('play')}</span></span></span><span class="spine spine-top" aria-hidden="true">${spine}</span><span class="spine spine-bottom" aria-hidden="true">${spine}</span></span><span class="record-caption"><span><span class="caption-title">${title}</span><span class="caption-artist">${escapeHTML(track.artist)} · Kratex Remix</span></span><span class="caption-action">${time(track.duration)} ↗</span></span></button>`;
    const button = slot.querySelector('button');
    slot.addEventListener('pointerenter', (event) => { if (event.pointerType !== 'touch' && hoverDevice.matches && !compactScreen.matches && view === 'stack') { clearTimeout(closeTimer); openRecord(track.id); } });
    slot.addEventListener('pointerleave', (event) => { if (event.pointerType !== 'touch' && hoverDevice.matches && !compactScreen.matches) closeTimer = setTimeout(() => { if (openId === track.id && !slot.contains(document.activeElement)) openRecord(null); }, 180); });
    button.addEventListener('click', (event) => {
      if (view === 'list' || (hoverDevice.matches && !compactScreen.matches && event.pointerType !== 'touch') || openId === track.id) { selectTrack(track.id); return; }
      openRecord(track.id);
      setTimeout(() => { if (openId === track.id) slot.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block:'center' }); }, reducedMotion.matches ? 0 : 320);
    });
    button.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { openRecord(null); button.blur(); }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const target = slots[index + (event.key === 'ArrowDown' ? 1 : -1)];
        if (target) { target.querySelector('button').focus(); openRecord(target.dataset.id); }
      }
    });
    const img = slot.querySelector('.cover img');
    img.addEventListener('load', () => sampleColor(img, slot));
    img.addEventListener('error', () => { if (!img.src.endsWith('/fallback.svg')) img.src = assetURL('fallback.svg'); });
    fragment.append(slot);
  });
  $('#records').replaceChildren(fragment);
  if (!tracks.length) $('#records').innerHTML = '<p class="empty-collection">The next record is on its way.<br>Check back for a new groove.</p>';
  slots = [...document.querySelectorAll('.record-slot')];
  if (openId && tracks.some(t => t.id === openId)) openRecord(openId);
  updateCurrent();
  updateAngles();
}
function sampleColor(img, slot) {
  try {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 8;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, 8, 8);
    const pixels = ctx.getImageData(0, 0, 8, 3).data;
    let r=0,g=0,b=0;
    for(let i=0;i<pixels.length;i+=4){ r+=pixels[i]; g+=pixels[i+1]; b+=pixels[i+2]; }
    const n = pixels.length/4; r=Math.round(r/n*.86); g=Math.round(g/n*.86); b=Math.round(b/n*.86);
    slot.style.setProperty('--sleeve',`rgb(${r} ${g} ${b})`);
    slot.style.setProperty('--sleeve-ink', r*.299+g*.587+b*.114 > 145 ? '#171c1f' : '#fff');
  } catch { /* Cross-origin artwork still has its curated fallback sleeve color. */ }
}
function updateAngles() {
  framePending = false;
  if (view !== 'stack') return;
  const middle = innerHeight * .53;
  slots.forEach((slot, index) => {
    if (slot.classList.contains('is-open')) return;
    const rect = slot.getBoundingClientRect();
    if (rect.bottom < -450 || rect.top > innerHeight+450) return;
    const delta = Math.max(-1,Math.min(1, (rect.top+rect.height/2-middle)/(innerHeight*.64)));
    const angle = -90-delta*36;
    slot.style.setProperty('--angle', `${angle.toFixed(2)}deg`);
    slot.style.setProperty('--layer', String(tracks.length - index));
  });
  const visible = slots.findIndex(s => s.getBoundingClientRect().bottom > 140);
  if (visible >= 0) $('#collection-counter').textContent = `${String(visible+1).padStart(2,'0')} — ${String(tracks.length).padStart(2,'0')}`;
}
function scheduleAngles() { if (!framePending) { framePending = true; requestAnimationFrame(updateAngles); } }
function openRecord(id) {
  openId = id;
  slots.forEach(slot => {
    const opened = slot.dataset.id === id;
    slot.classList.toggle('is-open', opened);
    const button = slot.querySelector('button');
    button.setAttribute('aria-expanded', String(opened));
    const track = tracks.find(t => t.id === slot.dataset.id);
    button.setAttribute('aria-label',`${opened || view === 'list' ? 'Play' : 'Open'} ${track.title}`);
  });
  // Keep perspective aligned while the expanded record changes the shelf spacing.
  let started;
  function animate(now) { started ??= now; updateAngles(); if(now-started<760&&!reducedMotion.matches) requestAnimationFrame(animate); }
  requestAnimationFrame(animate);
}
function updateCurrent() {
  for (const slot of slots) {
    const current = slot.dataset.id === currentId;
    slot.classList.toggle('is-current',current);
    slot.classList.toggle('is-playing',current && playing);
    slot.querySelector('.cover-play>span').innerHTML = icon(current && playing ? 'pause' : 'play');
  }
}
function setPlaying(value) {
  playing = value;
  $('#play-pause').innerHTML = icon(value ? 'pause' : 'play');
  $('#play-pause').setAttribute('aria-label',value ? 'Pause' : 'Play');
  $('#player-state').textContent = value ? 'NOW PLAYING' : 'PAUSED';
  updateCurrent();
  if (value) clearTimeout(playTimeout);
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = value ? 'playing' : 'paused';
}
function displayTrack(track) {
  currentId = track.id;
  selectedDuration = track.duration;
  $('#mini-player').hidden = false;
  document.body.classList.add('has-player');
  $('#player-art').src = track.artwork;
  $('#player-title').textContent = shortTitle(track.title);
  $('#player-title').href = track.url;
  $('#player-artist').textContent = track.artist;
  $('#duration').textContent = time(track.duration);
  $('#elapsed').textContent = '0:00';
  $('#seek').value = 0;
  $('#seek').style.setProperty('--progress','0%');
  updateCurrent();
  if ('mediaSession' in navigator && 'MediaMetadata' in window) {
    navigator.mediaSession.metadata = new MediaMetadata({title:shortTitle(track.title),artist:track.artist,album:'HOUSE THIS. — Kratex',artwork:[{src:track.artwork,sizes:'500x500',type:'image/jpeg'}]});
  }
}
function selectTrack(id, force = false) {
  const track = tracks.find(t => t.id === id);
  if (!track) return;
  if (currentId === id && !force && widgetReady) { widget.toggle(); return; }
  displayTrack(track);
  setPlaying(false);
  $('#player-state').textContent = 'LOADING';
  if (!widgetReady) { pendingId = id; toast('Connecting to SoundCloud. Your record will start when the player is ready.'); return; }
  pendingId = null;
  restartId = id;
  const index = playerIds.indexOf(id);
  if (index >= 0 && !singleMode) { widget.skip(index); widget.play(); }
  else { singleMode = true; widget.load(track.url,{auto_play:true,show_artwork:false,callback:()=>widget.play()}); }
  clearTimeout(playTimeout);
  playTimeout = setTimeout(() => {
    if (!playing) { $('#player-state').textContent = 'READY TO PLAY'; toast('Press play to start. If SoundCloud is unavailable, open the track from its title.'); }
  }, 12000);
}
function skip(direction) {
  if (!tracks.length) return;
  const index = tracks.findIndex(t=>t.id===currentId);
  selectTrack(tracks[(index+direction+tracks.length)%tracks.length].id,true);
}
async function acceptTracks(sounds, initial = false) {
  // SoundCloud returns ID-only placeholders after the first five records.
  // Resolve only new placeholders through official, nonplaying single-track widgets.
  const raw = sounds.filter(t=>t && t.id);
  if(!raw.length){tracks=[];playerIds=[];countTracks(0);render();syncStatus(true,'The crate is waiting');lastSync=Date.now();try{localStorage.removeItem('house-this-playlist');}catch{}return;}
  if (initial) playerIds = raw.map(t=>String(t.id));
  const known = new Map(tracks.map(t=>[t.id,t]));
  const results = raw.map(t=>typeof t.title==='string' ? normalize(t) : known.get(String(t.id)));
  const missing = raw.map((t,i)=>results[i] ? -1 : i).filter(i=>i>=0);
  countTracks(raw.length);
  if(missing.length)syncStatus(false,'Updating the collection');
  let cursor=0;
  await Promise.all(Array.from({length:Math.min(3,missing.length)},async()=>{
    while(cursor<missing.length){
      const index=missing[cursor++];
      const sound=await resolveTrack(raw[index].id);
      if(sound)results[index]=normalize(sound);
    }
  }));
  const next = results.filter(Boolean);
  if (!next.length) { syncStatus(false,'No playable records found'); return; }
  const changed = JSON.stringify(next)!==JSON.stringify(tracks);
  tracks = next;
  lastSync = Date.now();
  try { localStorage.setItem('house-this-playlist',JSON.stringify({tracks:next,updated:lastSync})); } catch {}
  countTracks(next.length);
  if (changed) render();
  syncStatus(next.length===raw.length,next.length===raw.length?'Live from SoundCloud':`${next.length} of ${raw.length} records available`);
}
function resolveTrack(id) {
  return new Promise(resolve=>{
    const frame=makeFrame(`metadata-${id}`,`https://api.soundcloud.com/tracks/${encodeURIComponent(id)}`);
    const metadata=SC.Widget(frame);
    let settled=false;
    const finish=sound=>{if(settled)return;settled=true;clearTimeout(timeout);frame.remove();resolve(sound?.title?sound:null);};
    const timeout=setTimeout(()=>finish(null),14000);
    metadata.bind(SC.Widget.Events.READY,()=>metadata.getCurrentSound(finish));
    metadata.bind(SC.Widget.Events.ERROR,()=>finish(null));
  });
}
function makeFrame(id, url) {
  const frame = document.createElement('iframe');
  frame.id = id; frame.title = 'SoundCloud audio player'; frame.allow = 'autoplay'; frame.tabIndex = -1;
  frame.setAttribute('aria-hidden','true');
  frame.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=false&show_artwork=false&show_comments=false&show_user=true&buying=false&sharing=false&download=false&visual=false`;
  $('#audio-host').append(frame);
  return frame;
}
function connectPlayer() {
  if (!window.SC?.Widget) { syncStatus(false,'SoundCloud connection unavailable'); return; }
  const frame = makeFrame('soundcloud-player', PLAYLIST_URL);
  widget = SC.Widget(frame);
  const events = SC.Widget.Events;
  const connectTimeout = setTimeout(()=>{if(!widgetReady)syncStatus(false,'Showing saved collection');},18000);
  widget.bind(events.READY,()=>{
    clearTimeout(connectTimeout);
    widgetReady = true;
    if (!singleMode) widget.getSounds(sounds=>acceptTracks(sounds,true));
    if (pendingId) selectTrack(pendingId,true);
  });
  widget.bind(events.PLAY,()=>{
    setPlaying(true);
    widget.getCurrentSound(sound=>{
      const id=String(sound?.id);
      const track=tracks.find(t=>t.id===id);
      if(id===restartId){restartId=null;widget.seekTo(0);}
      if(track && id!==currentId) { displayTrack(track); setPlaying(true); }
    });
    widget.getDuration(ms=>{selectedDuration=ms;$('#duration').textContent=time(ms);});
  });
  widget.bind(events.PAUSE,()=>setPlaying(false));
  widget.bind(events.PLAY_PROGRESS,event=>{
    if(isSeeking)return;
    $('#elapsed').textContent=time(event.currentPosition);
    const progress=Math.min(1000,Math.round((event.relativePosition||0)*1000));
    $('#seek').value=progress;$('#seek').style.setProperty('--progress',`${progress/10}%`);
  });
  widget.bind(events.FINISH,()=>{
    if (singleMode || playerIds.at(-1)===currentId) skip(1);
  });
  widget.bind(events.ERROR,()=>{
    clearTimeout(playTimeout); setPlaying(false); pendingId=null;
    $('#player-state').textContent='UNAVAILABLE';
    toast('SoundCloud could not play this record. Try the next track or open it from its title.');
  });
}
function refreshPlaylist() {
  if (refreshBusy || !window.SC?.Widget || document.hidden || Date.now()-lastSync<REFRESH_MS) return;
  refreshBusy=true;
  syncFrame?.remove();
  syncFrame=makeFrame('soundcloud-sync',PLAYLIST_URL);
  const sync=SC.Widget(syncFrame);
  const cleanup=()=>{syncFrame?.remove();syncFrame=null;refreshBusy=false;};
  const timeout=setTimeout(()=>{cleanup();syncStatus(false,'Showing saved collection');},20000);
  sync.bind(SC.Widget.Events.READY,()=>sync.getSounds(async sounds=>{clearTimeout(timeout);await acceptTracks(sounds);cleanup();}));
  sync.bind(SC.Widget.Events.ERROR,()=>{clearTimeout(timeout);cleanup();syncStatus(false,'Showing saved collection');});
}

for(const button of document.querySelectorAll('[data-view]')) button.addEventListener('click',()=>{
  if(view===button.dataset.view)return;
  view=button.dataset.view;openRecord(null);
  document.body.classList.toggle('is-list',view==='list');
  document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('is-selected',b===button);b.setAttribute('aria-pressed',String(b===button));});
  slots.forEach(slot=>slot.querySelector('button').setAttribute('aria-label',`${view==='list'?'Play':'Open'} ${tracks.find(t=>t.id===slot.dataset.id).title}`));
  updateAngles();
});
$('#play-collection').addEventListener('click',()=>{if(tracks.length)selectTrack(tracks[0].id);});
$('#shuffle').addEventListener('click',()=>{
  const choices=tracks.filter(t=>t.id!==currentId);
  if(!choices.length)return;
  const track=choices[Math.floor(Math.random()*choices.length)];
  openRecord(track.id);selectTrack(track.id);
  setTimeout(()=>slots.find(s=>s.dataset.id===track.id)?.scrollIntoView({behavior:reducedMotion.matches?'instant':'smooth',block:'center'}),350);
});
$('#play-pause').addEventListener('click',()=>{if(widgetReady)widget.toggle();else if(currentId)selectTrack(currentId,true);});
$('#next').addEventListener('click',()=>skip(1));
$('#previous').addEventListener('click',()=>skip(-1));
$('#close-player').addEventListener('click',()=>{widget?.pause();pendingId=null;restartId=null;clearTimeout(playTimeout);setPlaying(false);$('#mini-player').hidden=true;document.body.classList.remove('has-player');});
$('#seek').addEventListener('input',()=>{isSeeking=true;$('#seek').style.setProperty('--progress',`${$('#seek').value/10}%`);$('#elapsed').textContent=time(selectedDuration*$('#seek').value/1000);});
$('#seek').addEventListener('change',()=>{if(widgetReady)widget.seekTo(selectedDuration*$('#seek').value/1000);isSeeking=false;});
$('#about-button').addEventListener('click',()=>$('#about-dialog').showModal());
$('#close-about').addEventListener('click',()=>$('#about-dialog').close());
$('#about-dialog').addEventListener('click',event=>{if(event.target===$('#about-dialog')){const rect=event.target.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)event.target.close();}});
document.addEventListener('pointerdown',event=>{if(!event.target.closest('.record-slot')&&!event.target.closest('.mini-player'))openRecord(null);});
document.addEventListener('keydown',event=>{if(event.key==='Escape')openRecord(null);});
window.addEventListener('scroll',scheduleAngles,{passive:true});
window.addEventListener('resize',scheduleAngles);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshPlaylist();});
window.addEventListener('online',()=>{lastSync=0;refreshPlaylist();});
setInterval(refreshPlaylist,REFRESH_MS);
if('mediaSession' in navigator){
  for(const [action,handler] of Object.entries({play:()=>widget?.play(),pause:()=>widget?.pause(),previoustrack:()=>skip(-1),nexttrack:()=>skip(1)})){
    try{navigator.mediaSession.setActionHandler(action,handler);}catch{}
  }
}
async function init(){
  try{
    const response=await fetch(assetURL('playlist.json'));if(!response.ok)throw new Error('Playlist unavailable');
    const fallback=await response.json();
    tracks=fallback.tracks.map(normalize);
    let initialCount=fallback.total;
    try{const cached=JSON.parse(localStorage.getItem('house-this-playlist'));if(cached?.tracks?.length){tracks=cached.tracks.filter(t=>t?.id&&typeof t.title==='string').map(normalize);initialCount=tracks.length;}}catch{}
    countTracks(initialCount);render();
  }catch{syncStatus(false,'Collection unavailable');$('#records').innerHTML='<p class="load-error">The collection could not load. <a href="'+PLAYLIST_URL+'" target="_blank" rel="noopener">Listen on SoundCloud ↗</a></p>';}
  if(document.readyState==='complete')connectPlayer();else window.addEventListener('load',connectPlayer,{once:true});
}
init();

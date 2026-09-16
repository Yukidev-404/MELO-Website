(()=>{'use strict';
const status=document.getElementById('sourceStatus');
const content=document.getElementById('content');
const title=document.getElementById('trackTitle');
const artist=document.getElementById('trackArtist');

function polishStatus(){
 if(!status)return;
 const text=(status.textContent||'').trim();
 if(/^CONNECTED/i.test(text)){status.textContent='• SPOTIFY CONNECTED';status.dataset.state='connected'}
 else if(/SESSION EXPIRED/i.test(text)){status.textContent='• SPOTIFY SESSION EXPIRED';status.dataset.state='expired'}
 else if(/OFFLINE/i.test(text)){status.textContent='• SPOTIFY OFFLINE';status.dataset.state='offline'}
}
function markSelected(){
 if(!content)return;
 const wanted=(title?.textContent||'').trim();
 content.querySelectorAll('.track-row').forEach(row=>{
  const name=row.querySelector('b')?.textContent?.trim()||'';
  const on=!!wanted&&name===wanted;
  row.classList.toggle('selected',on);
  let label=row.querySelector('.reference-select');
  if(on&&!label){label=document.createElement('span');label.className='reference-select';label.textContent='SELECT';row.appendChild(label)}
  if(!on&&label)label.remove();
 });
}
function watch(){polishStatus();markSelected()}
new MutationObserver(watch).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']});
setInterval(watch,400);
watch();
})();

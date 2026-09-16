(()=>{
  const PROXY='https://wsrv.nl/?url=';
  const seen=new WeakMap();
  const isRemote=u=>/^https?:\/\//i.test(String(u||''));
  const proxy=u=>isRemote(u)?PROXY+encodeURIComponent(u)+'&w=640&h=360&fit=cover':'';
  const parse=img=>{let a=[];try{a=JSON.parse(img.dataset.artSources||'[]')}catch{}return [img.dataset.artOriginal||img.currentSrc||img.src,...a].filter(Boolean)};
  const prepare=img=>{
    if(!img||!img.matches('img[data-art-sources]')||seen.has(img))return;
    const originals=[...new Set(parse(img))];
    const candidates=[];
    originals.forEach(u=>{
      if(/^https:\/\//i.test(u))candidates.push(u);
      const p=proxy(u);if(p)candidates.push(p);
    });
    seen.set(img,candidates);
    img.dataset.artOriginal=originals[0]||'';
    img.style.visibility='hidden';
    try{img.dataset.artSources=JSON.stringify(candidates.slice(1))}catch{}
    if(candidates[0])img.src=candidates[0];
  };
  const advance=img=>{
    const list=seen.get(img)||[];
    if(!list.length){img.style.display='none';return}
    list.shift();
    seen.set(img,list);
    if(list[0]){
      img.style.visibility='hidden';
      img.src=list[0];
    }else img.style.display='none';
  };
  window.addEventListener('load',e=>{
    const img=e.target;
    if(!(img instanceof HTMLImageElement))return;
    if(img.matches('img[data-art-sources]')||seen.has(img))img.style.visibility='visible';
  },true);
  window.addEventListener('error',e=>{
    const img=e.target;
    if(!(img instanceof HTMLImageElement))return;
    if(img.matches('img[data-art-sources]')||seen.has(img)){
      e.stopImmediatePropagation();
      prepare(img);
      advance(img);
    }
  },true);
  const scan=()=>document.querySelectorAll('img[data-art-sources]').forEach(prepare);
  new MutationObserver(scan).observe(document.documentElement,{subtree:true,childList:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scan,{once:true});else scan();
})();
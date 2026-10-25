/* 谷雨说明卡：叠加于原三维地图，不接管原页面、导航或地图控制。 */
(function(){
 'use strict';
 const overview=document.getElementById('view-overview'),mobile=matchMedia('(max-width:760px)');
 const regions=[
  ['northwest','西北',87,43,'春雨润田，绿洲新垦，','棉花玉米，陆续下种。'],
  ['northeast','东北',126,46,'黑土回暖，水田整备，','玉米大豆，适时播种。'],
  ['north','华北',116,36,'小麦拔节，田畴渐丰，','牡丹吐蕊，春播正忙。'],
  ['plateau','青藏高原',92,33,'河谷返绿，青稞下地，','高寒牧草，渐次铺青。'],
  ['southwest','西南',103,25,'山雨新歇，春茶正盛，','梯田蓄满，秧苗葱茏。'],
  ['jiangnan','江南',118,29,'雨生百谷，早稻插秧，','池塘浮萍，桑绿莺啼。'],
  ['south','华南',113,23,'暖湿充沛，早稻旺长，','瓜果繁茂，荔枝抽梢。']
 ];
 const layer=document.createElement('div');layer.className='guyu-notes';layer.id='guyuNotes';layer.setAttribute('aria-label','谷雨地域景观说明');
 layer.innerHTML='<svg class="guyu-leaders" aria-hidden="true">'+regions.map(()=>'<g><polyline/><circle r="4"/></g>').join('')+'</svg>'+regions.map(r=>
  '<article class="guyu-map-card '+r[0]+'"><div class="guyu-card-art"><canvas width="320" height="130" aria-hidden="true"></canvas><h3>'+r[1]+'</h3></div><p>'+r[4]+'<br>'+r[5]+'</p></article>').join('')+
  '<aside class="guyu-info-note"><h3>谷雨物候手札</h3><section><h4>❀ 全国物候特征</h4><p>暮春雨润，百谷生长；气温升高，田畴丰润；插秧播种，万物繁盛。</p></section><section><h4>❧ 作物 / 植被</h4><p>小麦、早稻、玉米、棉花、春茶、瓜果。</p></section><section><h4>❀ 农事</h4><p>春播春种、插秧移栽、田间管理。</p></section></aside>';
 overview.appendChild(layer);
 const button=document.createElement('button');button.type='button';button.className='guyu-notes-toggle';button.id='guyuNotesToggle';button.setAttribute('aria-controls','guyuNotes');button.hidden=true;
 document.querySelector('.term-summary').appendChild(button);
 let expanded=!mobile.matches,frame=0,last=0;
 function enabled(){return currentTerm==='谷雨'&&document.body.dataset.terrainLevel!=='province';}
 function sync(){
  const active=currentTerm==='谷雨';document.body.classList.toggle('guyu-scene',active);
  button.hidden=!enabled();button.setAttribute('aria-expanded',String(expanded));button.textContent=expanded?'地域手札 · 收起':'地域手札 · 展开';
  layer.classList.toggle('is-collapsed',!expanded);layer.setAttribute('aria-hidden',String(!enabled()||!expanded));
  if(active)document.getElementById('seasonPoem').innerHTML='雨生百谷，<br>万物丰茂。';
  if(active&&expanded&&!frame)frame=requestAnimationFrame(updateLeaders);
 }
 button.onclick=function(){expanded=!expanded;sync();};
 const oldSelect=selectTerm;selectTerm=function(name){oldSelect(name);sync();};
 function updateLeaders(time){
  frame=0;if(currentTerm!=='谷雨'||!expanded)return;
  if(!mobile.matches&&enabled()&&window.Terrain3D?.isReady&&time-last>100){
   last=time;const map=document.querySelector('#mainMap').getBoundingClientRect(),bounds=overview.getBoundingClientRect();
   const svg=layer.querySelector('svg');svg.setAttribute('viewBox','0 0 '+bounds.width+' '+bounds.height);
   regions.forEach((r,i)=>{
    const p=Terrain3D.project(r[2],r[3]),x=p.x+map.x-bounds.x,y=p.y+map.y-bounds.y;
    const mark=svg.children[i],card=layer.querySelectorAll('.guyu-map-card')[i].getBoundingClientRect();
    if(!Number.isFinite(x+y)||x<map.x-bounds.x||x>map.right-bounds.x||y<map.y-bounds.y||y>map.bottom-bounds.y){mark.style.display='none';return;}
    mark.style.display='';const left=card.left-bounds.left,right=card.right-bounds.left,top=card.top-bounds.top,bottom=card.bottom-bounds.top;
    const sx=Math.max(left+8,Math.min(right-8,x)),sy=y<(top+bottom)/2?top:bottom;
    mark.children[0].setAttribute('points',sx+','+sy+' '+sx+','+y+' '+x+','+y);mark.children[1].setAttribute('cx',x);mark.children[1].setAttribute('cy',y);
   });
  }
  frame=requestAnimationFrame(updateLeaders);
 }
 const painting=new Image();painting.onload=function(){regions.forEach((r,i)=>{
  const detail={northwest:[.24,.17],plateau:[.24,.48]}[r[0]];
  const cx=detail?detail[0]:(r[2]-73)/62.5,cy=detail?detail[1]:(54-r[3])/36.5,canvas=layer.querySelectorAll('canvas')[i];
  const w=painting.width*.20,h=painting.height*.14,x=Math.max(0,Math.min(painting.width-w,cx*painting.width-w/2)),y=Math.max(0,Math.min(painting.height-h,cy*painting.height-h/2));
  canvas.getContext('2d').drawImage(painting,x,y,w,h,0,0,canvas.width,canvas.height);
 });};painting.src=window.GUYU_TERRAIN_PAINT;
 mobile.addEventListener('change',()=>{expanded=!mobile.matches;sync();});
 window.addEventListener('resize',()=>requestAnimationFrame(sync));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&mobile.matches&&currentTerm==='谷雨'&&expanded){expanded=false;sync();}});
 new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['data-terrain-level']});
 sync();
})();

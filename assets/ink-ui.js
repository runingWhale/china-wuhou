(function () {
    'use strict';
    const overview = document.getElementById('view-overview');
    document.querySelector('.header-left').insertAdjacentHTML('beforeend','<p class="brand-subtitle">二十四节气 · 立体山水</p>');
    overview.insertAdjacentHTML('beforeend', `
        <aside class="term-rail" aria-label="二十四节气选择"><p class="rail-label">岁 时 流 转</p><div class="term-list"></div><p class="rail-foot">滚动 · 观四时</p></aside>
        <div class="poem-note"><p id="seasonPoem"></p><small>观山河 · 知时序</small></div>
        <div class="compass" aria-label="北方指示"></div>
        <aside class="landform-legend" aria-label="地形概览"><h2>地形概览</h2>
            <p><i style="--swatch:#a3b0b1"></i><span>青藏高原</span><em>雪山高耸 · 第一阶梯</em></p>
            <p><i style="--swatch:#b0a17b"></i><span>西北山地</span><em>山脉连绵 · 盆地相间</em></p>
            <p><i style="--swatch:#aca681"></i><span>黄土高原</span><em>沟壑纵横 · 第二阶梯</em></p>
            <p><i style="--swatch:#7b946d"></i><span>四川盆地</span><em>群山环抱 · 沃野千里</em></p>
            <p><i style="--swatch:#91ab8b"></i><span>东部平原</span><em>地势平缓 · 第三阶梯</em></p>
            <p><i style="--swatch:#507b6a"></i><span>东南丘陵</span><em>山水相依 · 草木葱茏</em></p>
        </aside>
        <section class="term-summary" aria-live="polite"><p class="term-eyebrow">一 岁 一 轮 回</p><div class="term-heading"><strong id="summaryTerm"></strong><span id="summaryDate"></span></div><p class="term-hou-line" id="summaryHou"></p><button class="crop-toggle" id="cropToggle" aria-pressed="false">水墨作物 · 示意</button><button class="province-open" id="provinceOpen">浙江省 · 物候手札 ↗</button></section>
        <div class="mini-map" aria-label="中国地图缩略图"><canvas width="240" height="175" id="miniMapCanvas"></canvas></div>
        <p class="map-instruction">拖动旋转 · 滚轮缩放 · 点选省份观物候 · 双击深入市县</p>
        <div class="winter-regions" aria-label="冬至地域景观">
            <article class="winter-region northwest"><h3><span>◇</span> 西北</h3><p>朔风掠野，草木枯黄<br>雪覆群峰，天寒地冻</p></article>
            <article class="winter-region north"><h3><span>❄</span> 北方</h3><p>枯树覆霜，松林披雪<br>万物冬藏，静候阳生</p></article>
            <article class="winter-region southwest"><h3><span>✿</span> 西南</h3><p>林密谷幽，草木未凋<br>金叶映山，暖意犹存</p></article>
            <article class="winter-region southeast"><h3><span>✳</span> 东南</h3><p>冬日少暖，田畴相依<br>麦苗油菜，常绿山林</p></article>
        </div>
        <div class="summer-regions" aria-label="夏至地域景观">
            <article class="summer-region northwest" data-crop=".20,.25"><canvas aria-hidden="true"></canvas><h3><span>◇</span> 西北</h3><p>绿洲瓜果，棉田新绿<br>大漠骄阳，长夏日盛</p></article>
            <article class="summer-region northeast" data-crop=".86,.22"><canvas aria-hidden="true"></canvas><h3><span>♧</span> 东北</h3><p>黑土沃野，玉米大豆<br>林海湿地，万物葱茏</p></article>
            <article class="summer-region north" data-crop=".72,.46"><canvas aria-hidden="true"></canvas><h3><span>♧</span> 华北</h3><p>麦浪金黄，夏收正忙<br>夏种玉米，骄阳似火</p></article>
            <article class="summer-region plateau" data-crop=".22,.61"><canvas aria-hidden="true"></canvas><h3><span>△</span> 青藏高原</h3><p>高山草甸，百花盛开<br>雪峰映湖，牧野青绿</p></article>
            <article class="summer-region southwest" data-crop=".48,.74"><canvas aria-hidden="true"></canvas><h3><span>❧</span> 西南</h3><p>梯田叠翠，茶山飘香<br>云雾缭绕，生机盎然</p></article>
            <article class="summer-region jiangnan" data-crop=".80,.66"><canvas aria-hidden="true"></canvas><h3><span>❀</span> 江南</h3><p>江淮入梅，稻田葱茏<br>荷开水乡，烟雨江南</p></article>
            <article class="summer-region south" data-crop=".73,.91"><canvas aria-hidden="true"></canvas><h3><span>✳</span> 华南</h3><p>雨热充沛，双季稻旺<br>荔枝飘香，南国繁茂</p></article>
        </div>
    `);
    const panel = document.querySelector('.info-panel');
    panel.setAttribute('aria-label','省份物候手札');
    panel.setAttribute('aria-hidden','true');
    panel.insertAdjacentHTML('afterbegin','<button class="panel-close" aria-label="关闭物候手札">×</button>');
    function openPanel() { panel.classList.add('open');panel.setAttribute('aria-hidden','false'); }
    function closePanel() { panel.classList.remove('open');panel.setAttribute('aria-hidden','true'); }
    document.querySelector('.panel-close').onclick = closePanel;
    document.getElementById('provinceOpen').onclick = openPanel;
    document.addEventListener('keydown',e=>{ if(e.key==='Escape')closePanel(); });
    const oldSelect = selectProvince;
    selectProvince = function(name) { oldSelect(name);document.getElementById('provinceOpen').textContent = name+' · 物候手札 ↗';openPanel(); };
    const oldTerm = selectTerm;
    selectTerm = function(name) { oldTerm(name);syncTerm(); };
    const oldSwitch = switchView;
    switchView = function(view) { oldSwitch(view);closePanel();if(view==='overview')setTimeout(()=>Terrain3D.resize(),120); };
    const rail=document.querySelector('.term-list');
    solarTerms24.forEach(t=>{
        const b=document.createElement('button');b.className='rail-term';b.textContent=t.name;b.dataset.term=t.name;
        b.onclick=()=>selectTerm(t.name);rail.appendChild(b);
    });
    const poems={ spring:'东风解冻，<br>草木次第醒来。',summer:'万物并秀，<br>风过稻花生香。',autumn:'露白风清，<br>山河渐染秋色。',winter:'冬至阳生，<br>万物藏而后发。' };
    function syncTerm() {
        document.body.classList.toggle('dongzhi-scene',currentTerm==='冬至');
        document.body.classList.toggle('xiazhi-scene',currentTerm==='夏至');
        const term=solarTerms24.find(t=>t.name===currentTerm);
        document.getElementById('summaryTerm').textContent=currentTerm;
        document.getElementById('summaryDate').textContent=term.month+'月 · '+term.day+'日前后';
        document.getElementById('summaryHou').textContent=term.hou.join(' · ');
        document.getElementById('seasonPoem').innerHTML=currentTerm==='夏至'?'夏至日长，<br>万物向阳而盛。':currentTerm==='春分'?'春分雨足，<br>万物竞发。':poems[currentSeason];
        document.querySelectorAll('.rail-term,.term-card').forEach(b=>{
            b.classList.toggle('active',b.dataset.term===currentTerm);
            if(b.classList.contains('rail-term'))b.setAttribute('aria-pressed',b.dataset.term===currentTerm?'true':'false');
        });
        requestAnimationFrame(()=>{const active=rail.querySelector('.active');if(window.innerWidth<=760)rail.scrollTo({left:active.offsetLeft-rail.clientWidth/2+32});else rail.scrollTo({top:active.offsetTop-rail.clientHeight/2+18});});
    }
    let autoplay=null;
    document.getElementById('autoPlayBtn').onclick=function() {
        if(autoplay) { clearInterval(autoplay);autoplay=null;this.classList.remove('active');this.textContent='自动巡览';return; }
        this.classList.add('active');this.textContent='暂停巡览';
        autoplay=setInterval(()=>{
            const i=solarTerms24.findIndex(t=>t.name===currentTerm);
            selectTerm(solarTerms24[(i+1)%24].name);
            const active=rail.querySelector('.active');
            if(window.innerWidth<=760)rail.scrollTo({left:active.offsetLeft-rail.clientWidth/2+32,behavior:'smooth'});
            else rail.scrollTo({top:active.offsetTop-rail.clientHeight/2+18,behavior:'smooth'});
        },5000);
    };
    document.getElementById('cropToggle').onclick=function() {
        const show=this.getAttribute('aria-pressed')!=='true';this.setAttribute('aria-pressed',String(show));
        this.textContent=show?'水墨作物 · 已展开':'水墨作物 · 示意';Terrain3D.setCropsVisible(show);
    };
    const controls=document.querySelector('.terrain-controls');
    controls.insertAdjacentHTML('beforeend','<button id="terrainZoomIn" aria-label="放大地图" title="放大">＋</button><button id="terrainZoomOut" aria-label="缩小地图" title="缩小">−</button>');
    document.getElementById('terrainZoomIn').onclick=()=>Terrain3D.zoom(.82);
    document.getElementById('terrainZoomOut').onclick=()=>Terrain3D.zoom(1.22);
    document.getElementById('terrainReset').textContent='⌂';
    // 小地图沿用同一份国界数据，避免再引入额外数据包。
    const ctx=document.getElementById('miniMapCanvas').getContext('2d');
    ctx.strokeStyle='#7b8066';ctx.lineWidth=.75;
    CHINA_GEOJSON.features.forEach(f=>{
        if(!f.geometry || !/Polygon/.test(f.geometry.type))return;
        const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
        polys.forEach(p=>p.forEach(r=>{ctx.beginPath();r.forEach((v,i)=>{const x=(v[0]-73)/62.5*230+5,y=(54-v[1])/36.5*163+6;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();}));
    });
    // 开卷即见山河；原来的四立物候、时序、对照与七十二候照常初始化。
    const summerPreview=new Image();
    summerPreview.onload=()=>document.querySelectorAll('.summer-region').forEach(card=>{
        const xy=card.dataset.crop.split(',').map(Number),canvas=card.querySelector('canvas');
        canvas.width=320;canvas.height=150;
        canvas.getContext('2d').drawImage(summerPreview,(xy[0]-.10)*summerPreview.width,(xy[1]-.075)*summerPreview.height,.20*summerPreview.width,.15*summerPreview.height,0,0,320,150);
    });
    summerPreview.src=window.XIAZHI_TERRAIN_PAINT;
    // 夏至海面的水墨碎波。原有宣纸背景在其他节气中照常使用。
    const waterCanvas=document.createElement('canvas');waterCanvas.width=1200;waterCanvas.height=800;
    const waterCtx=waterCanvas.getContext('2d');
    let waterSeed=621;
    const waterRandom=()=>{waterSeed=(Math.imul(waterSeed,1664525)+1013904223)>>>0;return waterSeed/4294967296;};
    for(let i=0;i<700;i++){
        const x=waterRandom()*1200,y=waterRandom()*800,len=5+waterRandom()*27;
        waterCtx.beginPath();waterCtx.moveTo(x,y);waterCtx.bezierCurveTo(x+len*.3,y-1.4,x+len*.65,y+1.4,x+len,y);
        waterCtx.strokeStyle='rgba(183,235,238,'+(.03+waterRandom()*.11)+')';waterCtx.lineWidth=.4+waterRandom()*.6;waterCtx.stroke();
    }
    document.documentElement.style.setProperty('--summer-water','url("'+waterCanvas.toDataURL('image/png')+'")');
    window.addEventListener('resize',()=>requestAnimationFrame(syncTerm));
    currentTerm='冬至';currentSeason='winter';initApp();syncTerm();
})();

/* 内置地形意象。只依赖经纬度与国界；高度为艺术化示意，不是测绘高程。 */
(function () {
    'use strict';
    var bounds = { w: 73, s: 17.5, e: 135.5, n: 54 };
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function smooth(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
    function hash(x, y) { var v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); }
    function noise(x, y) {
        var ix = Math.floor(x), iy = Math.floor(y), u = x - ix, v = y - iy;
        u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
        return (hash(ix, iy) * (1-u) + hash(ix+1, iy) * u) * (1-v) +
            (hash(ix, iy+1) * (1-u) + hash(ix+1, iy+1) * u) * v;
    }
    function ellipse(x, y, cx, cy, rx, ry) { return Math.exp(-2 * (Math.pow((x-cx)/rx, 2) + Math.pow((y-cy)/ry, 2))); }
    var ranges = [
        { name:'喜马拉雅山', points:[[76,35],[81,31],[86,28.8],[91,28],[96,28.8]], width:0.65, height:2200 },
        { name:'昆仑山', points:[[76,36],[83,36],[89,36],[95,35.5],[100,34.8]], width:0.85, height:1800 },
        { name:'天山', points:[[75,42],[81,43],[86,43.4],[92,42.8]], width:0.8, height:2600 },
        { name:'阿尔泰山', points:[[83,48],[88,48],[91,46.5]], width:0.65, height:2100 },
        { name:'祁连山', points:[[94,39],[99,38.5],[103,36.7]], width:0.65, height:1600 },
        { name:'横断山', points:[[98,33],[99,30],[99.5,27],[100,25]], width:1.2, height:1600 },
        { name:'秦岭', points:[[103,33.7],[108,33.8],[112,33.4]], width:0.45, height:1500 },
        { name:'太行山', points:[[112.5,39.8],[113.5,37.5],[113.5,35.5]], width:0.48, height:1000 },
        { name:'大兴安岭', points:[[121,50],[121,47],[119,44],[117,41]], width:0.65, height:950 },
        { name:'长白山', points:[[128,43],[127,41],[124,40]], width:0.65, height:1150 },
        { name:'武夷山', points:[[118,29],[117,27],[116,25]], width:0.6, height:1100 },
        { name:'南岭', points:[[109,25],[112,25],[115,25]], width:0.55, height:900 },
        { name:'台湾山地', points:[[121,25],[121,23],[120.7,22]], width:0.35, height:1900 }
    ];
    function distance(x, y, points) {
        var best = 1e4;
        for (var i=1;i<points.length;i++) {
            var a=points[i-1], b=points[i], dx=b[0]-a[0], dy=b[1]-a[1];
            var t=clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy),0,1);
            best=Math.min(best,Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy));
        }
        return best;
    }
    function sample(lon, lat) {
        var edge = 112 + (lat-35)*0.25;
        var second = 1-smooth(edge-3, edge+3, lon);
        var plateau = (1-smooth(99,105,lon))*smooth(26,30,lat)*(1-smooth(35,39,lat))*smooth(74,80,lon);
        var rough = noise(lon*1.1,lat*1.3)*0.60+noise(lon*2.8,lat*3.2)*0.28+noise(lon*5.4,lat*6.1)*0.12;
        var h = 120 + 1250*second + 3300*plateau;
        h += 500*ellipse(lon,lat,106,37,5,4)+900*ellipse(lon,lat,103,25,6,4);
        h += (rough-0.35)*(70+240*second+330*plateau);
        ranges.forEach(function(r) {
            var d=distance(lon,lat,r.points);
            if(d<r.width*3) h+=r.height*Math.exp(-d*d/(r.width*r.width))*(0.40+rough*1.05);
        });
        // 盆地与冲积平原压低地形；不能用随机噪声覆盖地貌骨架。
        h=h*(1-0.74*ellipse(lon,lat,83,40,7,3.5));
        h=h*(1-0.64*ellipse(lon,lat,86,45.5,5,2.5));
        h=h*(1-0.82*ellipse(lon,lat,105,30.5,3.5,2.8));
        h=h*(1-0.80*ellipse(lon,lat,117,35.5,4,5));
        h=h*(1-0.85*ellipse(lon,lat,122,46,4.5,5));
        h=h*(1-0.78*ellipse(lon,lat,116,30.5,5,1.5));
        return clamp(h,55,6900);
    }
    var mask=null, maskData=null, width=1400, height=820;
    function xy(lon,lat) { return [(lon-bounds.w)/(bounds.e-bounds.w)*width,(bounds.n-lat)/(bounds.n-bounds.s)*height]; }
    function isLand(lon,lat) {
        if(!maskData) return false;
        var p=xy(lon,lat), x=Math.floor(p[0]), y=Math.floor(p[1]);
        return x>=0 && y>=0 && x<width && y<height && maskData[(y*width+x)*4+3]>120;
    }
    function build(features) {
        mask=document.createElement('canvas');mask.width=width;mask.height=height;
        var mc=mask.getContext('2d');mc.fillStyle='#fff';mc.strokeStyle='#fff';mc.lineWidth=0.8;
        features.forEach(function(f) {
            var g=f.geometry;if(!g || !/Polygon/.test(g.type) || !f.properties.code)return;
            var polygons=g.type==='Polygon'?[g.coordinates]:g.coordinates;
            polygons.forEach(function(poly) {
                mc.beginPath();poly.forEach(function(ring) {ring.forEach(function(p,i) {var q=xy(p[0],p[1]);if(i)mc.lineTo(q[0],q[1]);else mc.moveTo(q[0],q[1]);});mc.closePath();});
                mc.fill('evenodd');mc.stroke();
            });
        });
        maskData=mc.getImageData(0,0,width,height).data;
        var canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
        var ctx=canvas.getContext('2d'), img=ctx.createImageData(width,height), d=img.data;
        for(var y=0;y<height;y++)for(var x=0;x<width;x++) {
            var i=(y*width+x)*4;if(!maskData[i+3])continue;
            var lon=bounds.w+x/width*(bounds.e-bounds.w),lat=bounds.n-y/height*(bounds.n-bounds.s);
            var h=sample(lon,lat), west=sample(lon-0.065,lat+0.045);
            var grain=hash(x,y), brush=noise(lon*24+lat*9,lat*35);
            var shade=clamp(0.78+(west-h)/950+(brush-0.5)*0.28+(grain-0.5)*0.14,0.2,1);
            // 层层皴线：沿等高线形成断续墨痕，而不是贴一张平坦底图。
            var contour=Math.abs((h/155)%1-0.5);
            if(contour<0.055 && brush>0.45)shade*=0.70;
            d[i]=d[i+1]=d[i+2]=Math.round(shade*255);d[i+3]=maskData[i+3];
        }
        ctx.putImageData(img,0,0);return canvas;
    }
    window.TerrainModel={sample:sample,build:build,isLand:isLand,ranges:ranges,bounds:bounds};
})();

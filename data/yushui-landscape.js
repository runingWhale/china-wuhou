/* 雨水：雪岭、初融黑土、杏花、返青麦田、柳岸、油菜与蓄水梯田。
 * 地表和景物均沿原经纬度及高程采样，位置为艺术化物候示意。
 */
(function () {
    'use strict';
    var atlas=null,springAtlas=null,summerAtlas=null;
    window.YushuiLandscape={build:build,useAtlas:function(rain,spring,summer){atlas=rain;springAtlas=spring;summerAtlas=summer;}};
    function build(api) {
        var group=new THREE.Group();group.name='雨水景观';
        var resources=[],batches={},seed=219;
        var scale=Math.min(1,Math.max(.2,(api.bounds.e-api.bounds.w)/35));
        var counts={apricotTrees:0,willows:0,kapokTrees:0,snowTrees:0,evergreens:0,palms:0,
            rapeFields:0,rapeClumps:0,wheatFields:0,wheatClumps:0,teaBushes:0,
            terraceHills:0,terraceBands:0,ricePaddies:0,thawFields:0,highlandMeadows:0,
            villages:0,bridges:0,boats:0,mistBanks:0,raindrops:0};
        function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
        function keep(r){resources.push(r);return r;}
        function accepted(lon,lat){return lon>=api.bounds.w&&lon<=api.bounds.e&&lat>=api.bounds.s&&lat<=api.bounds.n&&api.accepts(lon,lat);}
        function raised(lon,lat,lift){var p=api.position(lon,lat);p[2]+=(lift||0)*scale;return p;}
        var plane=keep(new THREE.PlaneGeometry(1,1));plane.translate(0,.44,0);
        var box=keep(new THREE.BoxGeometry(1,1,1));
        var materials={};
        Object.entries({water:0xb6ceca,bank:0xb2a27d,wheat:0x94ac78,rape:0xd2c66c,
            thaw:0x807c6e,snow:0xe8ede8,soil:0x767461,tea:0x758e5e,
            rice:0x92b196,grass:0xa8ac8b,stone:0xa5a699,boat:0x71624e}).forEach(function(e){
            materials[e[0]]=keep(new THREE.MeshLambertMaterial({color:e[1],side:THREE.DoubleSide,
                transparent:true,opacity:e[0]==='water'?.78:.94}));
        });
        function billboardMaterial(tex,transparent){
            var mat=keep(new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide,
                alphaTest:transparent?0:.10,transparent:!!transparent,depthWrite:!transparent}));
            mat.onBeforeCompile=function(shader){shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',
                'vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.0,0.0,0.0,1.0);\n'+
                'vec2 propSize = vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));\n'+
                'mvPosition.xy += position.xy * propSize;\n'+
                'gl_Position = projectionMatrix * mvPosition;');};
            mat.customProgramCacheKey=function(){return 'yushui-painted-prop-v1';};
            return mat;
        }
        function paintedMaterial(image,index){
            if(!image)return null;
            var canvas=document.createElement('canvas');canvas.width=canvas.height=512;
            canvas.getContext('2d').drawImage(image,index%3*image.width/3,Math.floor(index/3)*image.height/2,
                image.width/3,image.height/2,0,0,512,512);
            return billboardMaterial(keep(new THREE.CanvasTexture(canvas)),false);
        }
        var plants=[];for(var i=0;i<6;i++)plants.push(paintedMaterial(atlas,i));
        var teaMaterial=paintedMaterial(springAtlas,4),wheatMaterial=paintedMaterial(springAtlas,5);
        var evergreenMaterial=paintedMaterial(summerAtlas,0),pineMaterial=paintedMaterial(summerAtlas,1),palmMaterial=paintedMaterial(summerAtlas,3);
        function add(key,geometry,material,p,s){
            if(!material)return;
            if(!batches[key])batches[key]={geometry:geometry,material:material,items:[]};
            batches[key].items.push({p:p,s:s});
        }
        function prop(lon,lat,key,material,height,width){
            if(!accepted(lon,lat)||!material)return false;
            add(key,plane,material,api.position(lon,lat),[height*(width||1)*scale,height*scale,1]);return true;
        }
        function geo(positions){var g=keep(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();return g;}
        function triangle(a,p,q,r){a.push.apply(a,p.concat(q,r));}
        function grove(lon,lat,dx,dy,n,index,count,height){
            for(var j=0;j<n;j++)if(prop(lon+(random()-.5)*dx*2,lat+(random()-.5)*dy*2,
                'plant'+index,plants[index],height*(.9+random()*.3),.9))counts[count]++;
        }
        // 西北绿洲杏花初绽；北方花树疏落，东北仍以积雪与枯枝为主。
        [[86,43,3.4,1.4,45],[93,40.5,2.4,1.2,28],[103.5,36.5,2,1,20],
            [113.5,35.5,2.2,1.6,30],[117.7,36,1.8,1.4,28],[117.6,30,2,1.2,32],
            [106.3,27,2,1.2,20]].forEach(function(r){grove(r[0],r[1],r[2],r[3],r[4],0,'apricotTrees',1.03);});
        [[126,46,4.2,3.2,30],[129,48,3.5,2.8,26],[123.6,43.8,2.2,1.7,18]].forEach(function(r){grove(r[0],r[1],r[2],r[3],r[4],4,'snowTrees',.88);});
        [[111.1,22.6,2,1.3,27],[113.5,23.3,2,1.2,30],[116,23.8,1.5,1,24],[110.2,19.5,.7,.6,12]].forEach(function(r){grove(r[0],r[1],r[2],r[3],r[4],2,'kapokTrees',1.18);});
        [[119.1,30.2],[117.1,29],[113,28],[120,31],[106.7,26.6]].forEach(function(c){
            for(var j=0;j<8;j++)if(prop(c[0]+(j-3.5)*.16,c[1]-.14,'willows',plants[1],1.08,.84))counts.willows++;
        });
        [[101,29,3,2,45],[105,27,3,2,45],[111,26,3,2,36],[118,26,1.7,2,35],
            [121,24,1,1.8,16],[127,48,3,2,26]].forEach(function(r){
            for(var j=0;j<r[4];j++)if(prop(r[0]+(random()-.5)*r[2]*2,r[1]+(random()-.5)*r[3]*2,
                r[1]>40?'pines':'evergreen',r[1]>40?pineMaterial:evergreenMaterial,.9+random()*.4,.85))counts.evergreens++;
        });
        [[112.5,22.3],[110.2,19.4],[116,23.3]].forEach(function(c){for(var j=0;j<9;j++){
            if(prop(c[0]+(random()-.5)*1.8,c[1]+(random()-.5)*.6,'palms',palmMaterial,1.1,.85))counts.palms++;
        }});
        function field(lon,lat,dx,dy,kind){
            if(!accepted(lon,lat))return;
            var top=[],snow=[];
            for(var x=0;x<5;x++)for(var y=0;y<4;y++){
                function at(i,j){var a=lon+(i/5-.5)*dx,b=lat+(j/4-.5)*dy;return accepted(a,b)?raised(a,b,.05):null;}
                var a=at(x,y),b=at(x+1,y),c=at(x+1,y+1),d=at(x,y+1);if(!a||!b||!c||!d)continue;
                var target=kind==='thaw'&&(x+y)%5===0?snow:top;
                triangle(target,a,b,c);triangle(target,a,c,d);
            }
            if(!top.length)return;
            group.add(new THREE.Mesh(geo(top),materials[kind]));
            if(snow.length)group.add(new THREE.Mesh(geo(snow),materials.snow));
            var counter={rape:'rapeFields',wheat:'wheatFields',water:'ricePaddies',thaw:'thawFields',grass:'highlandMeadows'}[kind];counts[counter]++;
            for(var row=0;row<5;row++)for(var col=0;col<7;col++){
                var a=lon+(col/6-.5)*dx*.92,b=lat+(row/4-.5)*dy*.92;
                if(kind==='rape'||kind==='wheat'){
                    if(prop(a,b,kind+'Plants',kind==='rape'?plants[3]:wheatMaterial,
                        kind==='rape'?.32+random()*.09:.25+random()*.06,.95))counts[kind==='rape'?'rapeClumps':'wheatClumps']++;
                }else if(accepted(a,b))add(kind+'Rows',box,kind==='water'?materials.rice:materials.soil,
                    raised(a,b,.085),[.065*scale,.014*scale,.014*scale]);
            }
        }
        [[118.4,30.2],[117.2,29],[114.4,30.4],[112.8,28.4],[106.5,27],[104.1,30.5]].forEach(function(c){for(var j=0;j<3;j++)field(c[0]+(j-1)*.43,c[1],.38,.33,'rape');});
        [[114.8,36],[117,35],[112.8,34],[116,38]].forEach(function(c){for(var j=0;j<4;j++)field(c[0]+(j%2-.5)*.4,c[1]+(Math.floor(j/2)-.5)*.32,.35,.28,'wheat');});
        [[112.6,23],[110.5,22.5],[116.1,24],[110.2,19.5]].forEach(function(c){for(var j=0;j<3;j++)field(c[0]+(j-1)*.32,c[1],.28,.24,'water');});
        [[126,45],[124.4,43.8],[129,47]].forEach(function(c){for(var j=0;j<3;j++)field(c[0]+(j-1)*.43,c[1],.36,.29,'thaw');});
        [[94,35],[99,36],[90,31]].forEach(function(c){field(c[0],c[1],.65,.4,'grass');});
        // 水面、土埂与挡土边缘为独立曲面，保持参考图中层层盘绕的蓄水梯田。
        function terraces(lon,lat,radius,stretch,tea){
            if(!accepted(lon,lat))return;
            var built=0;
            for(var band=0;band<8;band++){
                var outer=radius*(.23+band*.105),inner=outer-radius*.079,top=[],walls=[];
                for(var step=0;step<64;step++){
                    function vertex(r,s){var a=(s/64*1.35-.82)*Math.PI,wiggle=1+.075*Math.sin(a*3+band*.22)+.025*Math.cos(a*5);
                        var x=lon+Math.cos(a)*r*wiggle,y=lat+Math.sin(a)*r*stretch*wiggle;
                        return accepted(x,y)?raised(x,y,.1):null;}
                    var a=vertex(inner,step),b=vertex(outer,step),c=vertex(outer,step+1),d=vertex(inner,step+1);if(!a||!b||!c||!d)continue;
                    triangle(top,a,b,c);triangle(top,a,c,d);
                    var b0=b.slice(),c0=c.slice();b0[2]-=.12*scale;c0[2]-=.12*scale;
                    triangle(walls,b,b0,c0);triangle(walls,b,c0,c);
                }
                if(!top.length)continue;
                group.add(new THREE.Mesh(geo(top),tea?materials.tea:materials.water));
                group.add(new THREE.Mesh(geo(walls),materials.bank));counts.terraceBands++;built++;
            }
            if(built)counts.terraceHills++;
            if(tea)for(var row=0;row<5;row++)for(var col=0;col<9;col++){
                if(prop(lon+(col-4)*radius*.15,lat+(row-2)*radius*.1,'tea',teaMaterial,.3,.95))counts.teaBushes++;
            }
        }
        [[102.4,25.3,1.35,.58,false],[103.4,23.4,1.15,.63,false],[106.6,26.1,1.2,.55,false],
            [110,25.6,1.05,.58,false],[118.3,27.5,.9,.53,true],[105.7,27.8,.85,.55,true]].forEach(function(t){terraces.apply(null,t);});
        [[119.6,30.1],[117.6,29.4],[106.8,26],[104.4,30.3],[113.7,23.2],
            [86.5,43.2],[126,45],[102.7,25.1]].forEach(function(c){for(var j=0;j<3;j++){
            if(prop(c[0]+(j-1)*.25,c[1]+j%2*.15,'houses',plants[5],.68,1.35))counts.villages++;
        }});
        // 小河湾、石拱桥与篷舟同样锚在地表，不阻挡地形省份拾取。
        function riverVillage(lon,lat){
            if(!accepted(lon,lat))return;
            var top=[],waterCenter=raised(lon,lat,.08);
            for(var j=0;j<48;j++){
                function edge(k){var a=k/48*Math.PI*2,x=lon+Math.cos(a)*.52,y=lat+Math.sin(a)*.23;
                    return accepted(x,y)?raised(x,y,.08):null;}
                var a=edge(j),b=edge(j+1);if(a&&b)triangle(top,waterCenter,a,b);
            }
            if(!top.length)return;group.add(new THREE.Mesh(geo(top),materials.water));
            var p=raised(lon,lat,.08),arch=[];
            function archAt(t,side){return [p[0]+(t-.5)*.95*scale,p[1]+side*.11*scale,p[2]+(.10+Math.sin(t*Math.PI)*.25)*scale];}
            for(var j=0;j<20;j++){
                var a=archAt(j/20,-1),b=archAt((j+1)/20,-1),c=archAt((j+1)/20,1),d=archAt(j/20,1);
                triangle(arch,a,b,c);triangle(arch,a,c,d);
                [-1,1].forEach(function(side){var q=archAt(j/20,side),r=archAt((j+1)/20,side),q0=q.slice(),r0=r.slice();q0[2]-=.09*scale;r0[2]-=.09*scale;triangle(arch,q,q0,r0);triangle(arch,q,r0,r);});
            }
            group.add(new THREE.Mesh(geo(arch),materials.stone));counts.bridges++;
            add('boats',box,materials.boat,raised(lon+.22,lat-.08,.13),[.4*scale,.11*scale,.08*scale]);
            add('boatCanopies',box,materials.bank,raised(lon+.22,lat-.08,.22),[.19*scale,.12*scale,.1*scale]);counts.boats++;
        }
        [[119.2,29.7],[117.4,28.7],[113.1,28.2]].forEach(function(c){riverVillage(c[0],c[1]);});
        // 轻薄山岚只出现在大地上，保留原有宣纸与界面。
        if(api.bounds.e-api.bounds.w>20){
            var cv=document.createElement('canvas');cv.width=256;cv.height=128;var ctx=cv.getContext('2d');
            for(var j=0;j<24;j++){
                var x=24+random()*208,y=48+random()*34,r=15+random()*26;
                var g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(246,247,239,.22)');g.addColorStop(.5,'rgba(233,240,234,.10)');g.addColorStop(1,'rgba(233,240,234,0)');
                ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
            }
            var mist=billboardMaterial(keep(new THREE.CanvasTexture(cv)),true);
            [[87,34],[93,33],[98,29],[103,27],[91,42],[127,49],[119,30],[113,23]].forEach(function(c){
                if(!accepted(c[0],c[1]))return;add('mist',plane,mist,raised(c[0],c[1],.5),[6.5,1.8,1]);counts.mistBanks++;
            });
        }
        // 雨丝在地表上空轻落；切换节气后几何、材质和动画同时释放。
        var rainAnchors=[],rainPositions=[];
        for(var j=0;j<180;j++){
            var lon=101+random()*21,lat=22+random()*16;if(!accepted(lon,lat))continue;
            var p=raised(lon,lat,.3);rainAnchors.push({p:p,phase:random(),speed:.16+random()*.1});
            rainPositions.push.apply(rainPositions,p.concat(p));counts.raindrops++;
        }
        if(rainAnchors.length){
            var rainGeo=keep(new THREE.BufferGeometry()),rainAttribute=new THREE.Float32BufferAttribute(rainPositions,3);
            rainAttribute.setUsage(THREE.DynamicDrawUsage);rainGeo.setAttribute('position',rainAttribute);
            var rainMat=keep(new THREE.LineBasicMaterial({color:0xd5e1db,transparent:true,opacity:.25,depthWrite:false}));
            var rainLines=new THREE.LineSegments(rainGeo,rainMat);rainLines.frustumCulled=false;group.add(rainLines);
            group.userData.animate=function(time){rainAnchors.forEach(function(a,i){
                var h=(1-(time*.001*a.speed+a.phase)%1)*2.1*scale;
                rainAttribute.setXYZ(i*2,a.p[0]-.12*scale,a.p[1],a.p[2]+h+.38*scale);
                rainAttribute.setXYZ(i*2+1,a.p[0],a.p[1],a.p[2]+h);
            });rainAttribute.needsUpdate=true;};
        }
        var dummy=new THREE.Object3D();
        Object.values(batches).forEach(function(b){
            var mesh=new THREE.InstancedMesh(b.geometry,b.material,b.items.length);mesh.frustumCulled=false;
            b.items.forEach(function(item,i){dummy.position.set.apply(dummy.position,item.p);dummy.scale.set.apply(dummy.scale,item.s);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
            mesh.instanceMatrix.needsUpdate=true;group.add(mesh);
        });
        group.userData.counts=counts;
        group.userData.dispose=function(){resources.forEach(function(r){r.dispose();});group.children.forEach(function(m){if(m.isInstancedMesh&&m.dispose)m.dispose();});};
        return group;
    }
})();

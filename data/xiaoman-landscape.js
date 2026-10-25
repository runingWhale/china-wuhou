/* 小满：麦穗初满、石榴桑树、荷塘、插秧、梯田与果园。 */
(function(){
    'use strict';
    var atlas=null,summerAtlas=null,birdAtlas=null;
    window.XiaomanLandscape={useAtlas:function(image,summer,birds){atlas=image;summerAtlas=summer;birdAtlas=birds;},build:build};
    function build(api){
        var group=new THREE.Group();group.name='小满景观';
        var resources=[],batches={},seed=521;
        var scale=Math.min(1,Math.max(.2,(api.bounds.e-api.bounds.w)/35));
        var counts={pomegranateTrees:0,willows:0,mulberryTrees:0,wheatClumps:0,lycheeTrees:0,villages:0,riceFarmers:0,ploughTeams:0,yaks:0,pines:0,evergreens:0,swallows:0,poplars:0,bananaPlants:0,lotusClumps:0,lotusPonds:0,wheatFields:0,ricePaddies:0,ploughedFields:0,terraceHills:0,terraceBands:0,bridges:0,boats:0,mistBanks:0};
        function keep(r){resources.push(r);return r;}
        function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
        function accepted(lon,lat){return lon>=api.bounds.w&&lon<=api.bounds.e&&lat>=api.bounds.s&&lat<=api.bounds.n&&api.accepts(lon,lat);}
        var plane=keep(new THREE.PlaneGeometry(1,1));plane.translate(0,.43,0);
        var materials={};
        Object.entries({wheat:0xc6c978,water:0xa8c9bc,earth:0xa89b7a,bank:0x9e9670,tea:0x6b8956,stone:0xa0a498,boat:0x756650}).forEach(function(e){materials[e[0]]=keep(new THREE.MeshLambertMaterial({color:e[1],side:THREE.DoubleSide,transparent:true,opacity:e[0]==='water'?.73:.88}));});
        var props=[];
        for(var index=0;index<15;index++){
            var source=index<12?atlas:index<14?summerAtlas:birdAtlas,cell=index<12?index:index===12?3:index===13?0:1,rows=index<12?3:2,cols=index<12?4:3;
            if(!source){props.push(null);continue;}
            var cv=document.createElement('canvas');cv.width=cv.height=512;
            cv.getContext('2d').drawImage(source,cell%cols*source.width/cols,Math.floor(cell/cols)*source.height/rows,source.width/cols,source.height/rows,0,0,512,512);
            var tex=keep(new THREE.CanvasTexture(cv));
            var mat=keep(new THREE.MeshBasicMaterial({map:tex,alphaTest:.10,side:THREE.DoubleSide}));
            mat.onBeforeCompile=function(shader){shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',
                'vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.0,0.0,0.0,1.0);\n'+
                'vec2 propSize = vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));\n'+
                'mvPosition.xy += position.xy * propSize;\n'+
                'gl_Position = projectionMatrix * mvPosition;');};
            mat.customProgramCacheKey=function(){return 'xiaoman-painted-prop-v1';};props.push(mat);
        }
        var keys=['pomegranateTrees','willows','mulberryTrees','wheatClumps','lycheeTrees','villages','riceFarmers','ploughTeams','yaks','poplars','bananaPlants','lotusClumps','pines','evergreens','swallows'];
        function prop(lon,lat,index,height,width,lift){
            if(!accepted(lon,lat)||!props[index])return;
            if(!batches[index])batches[index]=[];
            var anchor=api.position(lon,lat);anchor[2]+=(lift||0)*scale;
            batches[index].push({p:anchor,s:[height*(width||1)*scale,height*scale,1]});counts[keys[index]]++;
        }
        function geo(vertices){var g=keep(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();return g;}
        function tri(out,a,b,c){out.push.apply(out,a.concat(b,c));}
        function position(lon,lat,lift){if(!accepted(lon,lat))return null;var p=api.position(lon,lat);p[2]+=lift*scale;return p;}
        function field(lon,lat,dx,dy,kind){
            if(!accepted(lon,lat))return;
            var out=[];
            for(var x=0;x<5;x++)for(var y=0;y<4;y++){
                function at(i,j){return position(lon+(i/5-.5)*dx,lat+(j/4-.5)*dy,.055);}
                var a=at(x,y),b=at(x+1,y),c=at(x+1,y+1),d=at(x,y+1);if(a&&b&&c&&d){tri(out,a,b,c);tri(out,a,c,d);}
            }
            if(!out.length)return;
            group.add(new THREE.Mesh(geo(out),materials[kind]));counts[kind==='wheat'?'wheatFields':kind==='water'?'ricePaddies':'ploughedFields']++;
            if(kind==='wheat')for(var row=0;row<4;row++)for(var col=0;col<7;col++)prop(lon+(col/6-.5)*dx*.9,lat+(row/3-.5)*dy*.9,3,.29+random()*.07,.95);
            if(kind==='water')prop(lon,lat,6,.58,.90);
            if(kind==='earth')prop(lon,lat,7,.74,1.65);
        }
        // 初夏黑土苗垄、绿洲农田与华北灌浆麦田，水田集中在江南及华南。
        [[115,35.5],[117,36.3],[113,34.4],[116,38]].forEach(function(c){for(var i=0;i<4;i++)field(c[0]+(i%2-.5)*.48,c[1]+(Math.floor(i/2)-.5)*.38,.43,.33,'wheat');});
        [[126,45],[124,43.8],[128,46],[86.5,43.5],[94,40]].forEach(function(c){for(var i=0;i<3;i++)field(c[0]+(i-1)*.47,c[1],.40,.32,'earth');});
        [[119,30],[117,29],[113,28],[112.7,23],[110,22.5],[116,24],[110.2,19.5]].forEach(function(c){for(var i=0;i<3;i++)field(c[0]+(i-1)*.42,c[1],.36,.30,'water');});
        [[115,36,3.2,2,65],[110,34.8,2.8,1.7,35],[118,39,2,1.4,35],[118,30,2,1.8,40],[106,27,2.8,1.5,30],[87,43,2,1.3,18]].forEach(function(r){for(var i=0;i<r[4];i++)prop(r[0]+(random()-.5)*r[2]*2,r[1]+(random()-.5)*r[3]*2,0,1.02+random()*.30,.9);});
        [[119.3,30],[117,29],[113,28],[120,31],[114,30.5]].forEach(function(c){for(var i=0;i<10;i++)prop(c[0]+(i-4.5)*.17,c[1]+Math.sin(i)*.13,1,1.10,.83);});
        [[112.5,23],[115,23.5],[110.6,21.8],[108.6,22.5],[110.1,19.5]].forEach(function(c){for(var i=0;i<9;i++)prop(c[0]+(random()-.5)*1.7,c[1]+(random()-.5)*1.1,4,1.0,.90);});
        [[89,32],[93,34],[97,33],[100,35]].forEach(function(c){for(var i=0;i<5;i++)prop(c[0]+(random()-.5)*2,c[1]+(random()-.5),8,.72,1.20);});
        [[126.5,47,3.8,2.5,60],[129,48.5,2,2,35],[123.5,43.5,2,1.2,25]].forEach(function(c){for(var i=0;i<c[4];i++)prop(c[0]+(random()-.5)*c[2]*2,c[1]+(random()-.5)*c[3]*2,12,.88+random()*.3,.82);});
        [[101,29,2.6,1.7,30],[106,27,2.6,1.7,35],[113,25,2.5,1.4,30],[118,26,1.5,2.5,30],[121,24,1,1.7,16]].forEach(function(c){for(var i=0;i<c[4];i++)prop(c[0]+(random()-.5)*c[2]*2,c[1]+(random()-.5)*c[3]*2,13,.85+random()*.35,.84);});
        [[104,35],[112,33],[118,30],[110,25]].forEach(function(c){prop(c[0],c[1],14,.65,1.5,2.0);});
        // 逐点贴合原地表的茶山与蓄水梯田；田埂独立成面，旋转后保留起伏。
        function terraces(lon,lat,radius,stretch,tea){
            if(!accepted(lon,lat))return;var built=0;
            for(var band=0;band<8;band++){
                var outer=radius*(.20+band*.10),inner=outer-radius*.075,top=[],walls=[];
                for(var step=0;step<60;step++){
                    function v(r,i){var a=i/60*Math.PI*2,w=1+.07*Math.sin(a*3+band*.25);return position(lon+Math.cos(a)*r*w,lat+Math.sin(a)*r*stretch*w,.10);}
                    var a=v(inner,step),b=v(outer,step),c=v(outer,step+1),d=v(inner,step+1);if(!a||!b||!c||!d)continue;
                    tri(top,a,b,c);tri(top,a,c,d);var b0=b.slice(),c0=c.slice();b0[2]-=.13*scale;c0[2]-=.13*scale;tri(walls,b,b0,c0);tri(walls,b,c0,c);
                }
                if(!top.length)continue;group.add(new THREE.Mesh(geo(top),materials[tea?'tea':'water']));group.add(new THREE.Mesh(geo(walls),materials.bank));counts.terraceBands++;built++;
            }
            if(built)counts.terraceHills++;
            if(tea)for(var row=0;row<6;row++)for(var col=0;col<10;col++)prop(lon+(col-4.5)*radius*.15,lat+(row-2.5)*radius*.10,2,.34,.95);
            prop(lon,lat,6,.52,.9);
        }
        [[102.5,25.2,1.25,.58,false],[103.4,23.4,1.12,.62,false],[106.5,26.2,1.12,.55,false],[110,25.5,1.05,.58,false],[118.2,27.5,.90,.53,true],[106,27.8,.95,.55,true],[119.6,29.2,.75,.55,true]].forEach(function(t){terraces.apply(null,t);});
        [[119.4,30.2],[117.5,29.4],[113,28],[106.6,26],[104.4,30.3],[113.7,23.2],[86.5,43.2],[126,45],[110.2,22.5]].forEach(function(c){for(var i=0;i<3;i++)prop(c[0]+(i-1)*.29,c[1]+i%2*.14,5,.69,1.35);});
        // Water villages use real ground-following water faces and raised arch bridges.
        var boatGeometry=keep(new THREE.BoxGeometry(1,1,1));
        [[119.2,29.7],[117.4,28.7],[113.1,28.2]].forEach(function(c){
            var lon=c[0],lat=c[1],center=position(lon,lat,.08);if(!center)return;
            var water=[],arch=[];
            for(var j=0;j<48;j++){
                function edge(k){var a=k/48*Math.PI*2;return position(lon+Math.cos(a)*.52,lat+Math.sin(a)*.23,.08);}
                var a=edge(j),b=edge(j+1);if(a&&b)tri(water,center,a,b);
            }
            if(water.length)group.add(new THREE.Mesh(geo(water),materials.water));
            function archAt(t,side){return[center[0]+(t-.5)*1.05*scale,center[1]+side*.12*scale,center[2]+(.1+Math.sin(t*Math.PI)*.28)*scale];}
            for(var j=0;j<20;j++){
                var a=archAt(j/20,-1),b=archAt((j+1)/20,-1),d=archAt(j/20,1),e=archAt((j+1)/20,1);tri(arch,a,b,e);tri(arch,a,e,d);
                [-1,1].forEach(function(side){var a=archAt(j/20,side),b=archAt((j+1)/20,side),a0=a.slice(),b0=b.slice();a0[2]-=.09*scale;b0[2]-=.09*scale;tri(arch,a,a0,b0);tri(arch,a,b0,b);});
            }
            group.add(new THREE.Mesh(geo(arch),materials.stone));counts.bridges++;
            var p=position(lon+.22,lat-.08,.13);if(p){
                var hull=new THREE.Mesh(boatGeometry,materials.boat);hull.position.set.apply(hull.position,p);hull.scale.set(.46*scale,.13*scale,.08*scale);group.add(hull);
                var canopy=new THREE.Mesh(boatGeometry,materials.bank);canopy.position.set(p[0],p[1],p[2]+.11*scale);canopy.scale.set(.22*scale,.14*scale,.12*scale);group.add(canopy);counts.boats++;
            }
        });

        // 西北绿洲杨林、江南桑林与荷塘、华南蕉林。
        [[86.7,43.5],[81.3,43.8],[94,40.2]].forEach(function(c){for(var i=0;i<9;i++)prop(c[0]+(i-4)*.20,c[1]+Math.sin(i)*.10,9,1.55,.65);});
        [[119.2,30.4],[120,31.1],[117.5,29.6]].forEach(function(c){for(var i=0;i<8;i++)prop(c[0]+(random()-.5)*1.4,c[1]+(random()-.5)*.9,2,.85,1.05);});
        [[113.4,23.3],[110.5,21.8],[108.5,22.4],[110.1,19.5]].forEach(function(c){for(var i=0;i<9;i++)prop(c[0]+(random()-.5)*1.5,c[1]+(random()-.5)*.9,10,1.05,1.1);});
        [[120,30.4],[118,29.4],[114.1,29],[112.6,28]].forEach(function(c){
            var center=position(c[0],c[1],.10);if(!center)return;var water=[];
            for(var j=0;j<48;j++){
                function edge(k){var a=k/48*Math.PI*2;return position(c[0]+Math.cos(a)*.48,c[1]+Math.sin(a)*.26,.10);}
                var a=edge(j),b=edge(j+1);if(a&&b)tri(water,center,a,b);
            }
            if(!water.length)return;group.add(new THREE.Mesh(geo(water),materials.water));counts.lotusPonds++;
            for(var j=0;j<8;j++)prop(c[0]+(random()-.5)*.66,c[1]+(random()-.5)*.32,11,.46,1.65);
        });
        if(api.bounds.e-api.bounds.w>20){
            var fog=document.createElement('canvas');fog.width=256;fog.height=96;var ctx=fog.getContext('2d');
            var gradient=ctx.createRadialGradient(128,48,0,128,48,128);gradient.addColorStop(0,'rgba(246,247,238,.32)');gradient.addColorStop(.5,'rgba(240,244,234,.12)');gradient.addColorStop(1,'rgba(240,244,234,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,256,96);
            var fogMat=keep(new THREE.SpriteMaterial({map:keep(new THREE.CanvasTexture(fog)),transparent:true,depthWrite:false}));
            [[96,32],[100,29],[103,27],[106,26],[118,29],[126,46]].forEach(function(c){var p=position(c[0],c[1],.55);if(!p)return;var mist=new THREE.Sprite(fogMat);mist.position.set.apply(mist.position,p);mist.scale.set(7.5*scale,1.4*scale,1);group.add(mist);counts.mistBanks++;});
        }
        var dummy=new THREE.Object3D();Object.keys(batches).forEach(function(key){var items=batches[key],mesh=new THREE.InstancedMesh(plane,props[key],items.length);mesh.frustumCulled=false;items.forEach(function(item,i){dummy.position.set.apply(dummy.position,item.p);dummy.scale.set.apply(dummy.scale,item.s);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.instanceMatrix.needsUpdate=true;group.add(mesh);});
        group.userData.counts=counts;
        group.userData.dispose=function(){resources.forEach(function(r){r.dispose();});group.children.forEach(function(m){if(m.isInstancedMesh&&m.dispose)m.dispose();});};
        return group;
    }
})();

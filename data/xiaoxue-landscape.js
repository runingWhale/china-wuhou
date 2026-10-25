/* 小雪：初雪疏林、覆雪村落、雪岭牦牛、白芦水乡、冬闲梯田与南方柑橘。 */
(function(){
    'use strict';
    var atlas=null,summer=null;
    window.XiaoxueLandscape={useAtlas:function(image,trees){atlas=image;summer=trees;},build:build};
    function build(api){
        var group=new THREE.Group();group.name='小雪景观';
        var owned=[],batches={},seed=1122;
        var scale=Math.min(1,Math.max(.2,(api.bounds.e-api.bounds.w)/35));
        var counts={reedClumps:0,bareTrees:0,citrusTrees:0,poplars:0,yaks:0,cottages:0,birches:0,evergreens:0,winterTrees:0,palms:0,villages:0,stubbleFields:0,ricePaddies:0,meadowFields:0,terraceHills:0,terraceBands:0,reedPonds:0,bridges:0,boats:0,mistBanks:0,frostFields:0,winterVegetables:0,snowPines:0};
        function keep(r){owned.push(r);return r;}
        function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
        function accepted(lon,lat){return lon>=api.bounds.w&&lon<=api.bounds.e&&lat>=api.bounds.s&&lat<=api.bounds.n&&api.accepts(lon,lat);}
        function position(lon,lat,lift){if(!accepted(lon,lat))return null;var p=api.position(lon,lat);p[2]+=(lift||0)*scale;return p;}
        var plane=keep(new THREE.PlaneGeometry(1,1));plane.translate(0,.43,0);
        var keys=['reedClumps','bareTrees','citrusTrees','poplars','yaks','cottages','birches','evergreens','winterTrees','palms','villages','winterVegetables','snowPines'];
        var props=[];
        for(var index=0;index<keys.length;index++){
            var own=index!==7&&index!==9,source=own?atlas:summer,cell=own?[0,1,2,3,4,5,6,0,1,0,5,8,7][index]:({7:0,9:3})[index],rows=own?3:2;
            if(!source){props.push(null);continue;}
            var cv=document.createElement('canvas');cv.width=cv.height=512;
            cv.getContext('2d').drawImage(source,cell%3*source.width/3,Math.floor(cell/3)*source.height/rows,source.width/3,source.height/rows,0,0,512,512);
            var mat=keep(new THREE.MeshBasicMaterial({map:keep(new THREE.CanvasTexture(cv)),transparent:true,depthWrite:false,alphaTest:.10,side:THREE.DoubleSide}));
            mat.onBeforeCompile=function(shader){shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',
                'vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.0,0.0,0.0,1.0);\n'+
                'vec2 propSize = vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));\n'+
                'mvPosition.xy += position.xy * propSize;\n'+
                'gl_Position = projectionMatrix * mvPosition;');};
            mat.customProgramCacheKey=function(){return 'xiaoxue-painted-prop-v1';};props.push(mat);
        }
        function prop(lon,lat,index,height,width,lift){
            var p=position(lon,lat,lift||.03);if(!p||!props[index])return;
            if(!batches[index])batches[index]=[];
            batches[index].push({p:p,s:[height*(width||1)*scale,height*scale,1]});counts[keys[index]]++;
        }
        var materials={};
        Object.entries({corn:0xc6b99d,rice:0xb7ba8d,water:0xa8c2cc,meadow:0xd3d4cc,frost:0xe8edf1,bank:0xada18b,stone:0xaaa994,boat:0x71634b}).forEach(function(e){materials[e[0]]=keep(new THREE.MeshLambertMaterial({color:e[1],side:THREE.DoubleSide,transparent:true,opacity:e[0]==='water'?.80:.90}));});
        function geo(v){var g=keep(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.computeVertexNormals();return g;}
        function tri(out,a,b,c){out.push.apply(out,a.concat(b,c));}
        function field(lon,lat,dx,dy,kind){
            if(!accepted(lon,lat))return;var vertices=[];
            for(var x=0;x<5;x++)for(var y=0;y<4;y++){
                function at(i,j){return position(lon+(i/5-.5)*dx,lat+(j/4-.5)*dy,.055);}
                var a=at(x,y),b=at(x+1,y),c=at(x+1,y+1),d=at(x,y+1);if(a&&b&&c&&d){tri(vertices,a,b,c);tri(vertices,a,c,d);}
            }
            if(!vertices.length)return;group.add(new THREE.Mesh(geo(vertices),materials[kind]));counts[kind==='corn'?'stubbleFields':kind==='rice'?'ricePaddies':kind==='frost'?'frostFields':'meadowFields']++;

        }
        [[115,35.5],[117,36.3],[113,34.4],[116,38],[126,45],[124,44],[86.5,43.5],[94,40]].forEach(function(c){for(var i=0;i<4;i++)field(c[0]+(i%2-.5)*.51,c[1]+(Math.floor(i/2)-.5)*.40,.46,.35,'corn');});
        [[119,30],[117,29],[113,28],[112.7,23],[110,22.5],[116,24],[110.2,19.5]].forEach(function(c){for(var i=0;i<3;i++)field(c[0]+(i-1)*.43,c[1],.38,.31,'rice');});
        [[89,32],[93,34],[97,33],[100,35]].forEach(function(c){field(c[0],c[1],.85,.5,'meadow');for(var i=0;i<6;i++)prop(c[0]+(random()-.5)*2,c[1]+(random()-.5),4,.65,1.35);});
        [[86.5,43.5],[89,44],[94,40]].forEach(function(c){for(var i=0;i<13;i++)prop(c[0]+(i-6)*.20,c[1]+Math.sin(i)*.14,3,1.15+random()*.2,.7);});
        [[126.5,47,3.8,2.5,70],[129,48.5,2,2,40],[123.5,43.5,2,1.2,30]].forEach(function(c){for(var i=0;i<c[4];i++)prop(c[0]+(random()-.5)*c[2]*2,c[1]+(random()-.5)*c[3]*2,i%3===0?12:6,1.00+random()*.3,.78);});
        [[101,29,2.6,1.7,30],[106,27,2.6,1.7,35],[113,25,2.5,1.4,30],[118,26,1.5,2.5,30],[121,24,1,1.7,16]].forEach(function(c){for(var i=0;i<c[4];i++)prop(c[0]+(random()-.5)*c[2]*2,c[1]+(random()-.5)*c[3]*2,i%3===0?7:1,.90+random()*.3,.86);});
        [[119.3,30],[117,29],[113,28],[120,31],[114,30.5]].forEach(function(c){for(var i=0;i<10;i++)prop(c[0]+(i-4.5)*.17,c[1]+Math.sin(i)*.13,8,1.12,.87);});
        [[112.5,23],[115,23.5],[110.6,21.8],[108.6,22.5]].forEach(function(c){for(var x=0;x<6;x++)for(var y=0;y<3;y++)prop(c[0]+(x-2.5)*.23,c[1]+(y-1)*.22,2,1.03,.95);});
        [[112,22],[110.2,19.5],[108.5,22.5]].forEach(function(c){for(var i=0;i<14;i++)prop(c[0]+(random()-.5)*1.6,c[1]+(random()-.5)*.8,9,1.12,.95);});
        function terraces(lon,lat,radius,stretch){
            if(!accepted(lon,lat))return;var built=0;
            for(var band=0;band<8;band++){
                var outer=radius*(.20+band*.10),inner=outer-radius*.075,top=[],walls=[];
                for(var step=0;step<60;step++){
                    function v(r,i){var a=i/60*Math.PI*2,w=1+.07*Math.sin(a*3+band*.25);return position(lon+Math.cos(a)*r*w,lat+Math.sin(a)*r*stretch*w,.10);}
                    var a=v(inner,step),b=v(outer,step),c=v(outer,step+1),d=v(inner,step+1);if(!a||!b||!c||!d)continue;
                    tri(top,a,b,c);tri(top,a,c,d);var b0=b.slice(),c0=c.slice();b0[2]-=.13*scale;c0[2]-=.13*scale;tri(walls,b,b0,c0);tri(walls,b,c0,c);
                }
                if(!top.length)continue;group.add(new THREE.Mesh(geo(top),materials[band%4===0?'water':band%3===0?'corn':'rice']));group.add(new THREE.Mesh(geo(walls),materials.bank));counts.terraceBands++;built++;
            }
            if(built)counts.terraceHills++;prop(lon,lat,5,.52,1);
        }
        [[102.5,25.2,1.4,.58],[103.4,23.4,1.2,.62],[106.5,26.2,1.25,.55],[110,25.5,1.15,.58],[118.2,27.5,.9,.53],[106,27.8,.95,.55]].forEach(function(t){terraces.apply(null,t);});
        [[119.4,30.2],[117.5,29.4],[113,28],[106.6,26],[104.4,30.3],[113.7,23.2],[86.5,43.2],[126,45],[110.2,22.5]].forEach(function(c){for(var i=0;i<3;i++)prop(c[0]+(i-1)*.29,c[1]+i%2*.14,10,.70,1.35);});
        var boat=keep(new THREE.BoxGeometry(1,1,1));
        [[119.2,29.7],[117.4,28.7],[113.1,28.2],[115.6,29.2]].forEach(function(c){
            var lon=c[0],lat=c[1],center=position(lon,lat,.08);if(!center)return;var water=[],arch=[];
            for(var j=0;j<48;j++){
                function edge(k){var a=k/48*Math.PI*2;return position(lon+Math.cos(a)*.62,lat+Math.sin(a)*.28,.08);}
                var a=edge(j),b=edge(j+1);if(a&&b)tri(water,center,a,b);
            }
            if(water.length){group.add(new THREE.Mesh(geo(water),materials.water));counts.reedPonds++;}
            function archAt(t,side){return[center[0]+(t-.5)*1.05*scale,center[1]+side*.12*scale,center[2]+(.1+Math.sin(t*Math.PI)*.28)*scale];}
            for(var j=0;j<20;j++){
                var a=archAt(j/20,-1),b=archAt((j+1)/20,-1),d=archAt(j/20,1),e=archAt((j+1)/20,1);tri(arch,a,b,e);tri(arch,a,e,d);
                [-1,1].forEach(function(side){var a=archAt(j/20,side),b=archAt((j+1)/20,side),a0=a.slice(),b0=b.slice();a0[2]-=.09*scale;b0[2]-=.09*scale;tri(arch,a,a0,b0);tri(arch,a,b0,b);});
            }
            group.add(new THREE.Mesh(geo(arch),materials.stone));counts.bridges++;
            var p=position(lon+.22,lat-.08,.13);if(p){var hull=new THREE.Mesh(boat,materials.boat);hull.position.set.apply(hull.position,p);hull.scale.set(.46*scale,.13*scale,.08*scale);group.add(hull);counts.boats++;}
        });
        if(api.bounds.e-api.bounds.w>20){
            var fog=document.createElement('canvas');fog.width=256;fog.height=96;var ctx=fog.getContext('2d');
            var gradient=ctx.createRadialGradient(128,48,0,128,48,128);gradient.addColorStop(0,'rgba(246,249,238,.28)');gradient.addColorStop(.5,'rgba(240,246,234,.10)');gradient.addColorStop(1,'rgba(240,244,234,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,256,96);
            var fogMat=keep(new THREE.SpriteMaterial({map:keep(new THREE.CanvasTexture(fog)),transparent:true,depthWrite:false}));
            [[96,32],[100,29],[103,27],[106,26],[118,29],[126,46]].forEach(function(c){var p=position(c[0],c[1],.55);if(!p)return;var mist=new THREE.Sprite(fogMat);mist.position.set.apply(mist.position,p);mist.scale.set(7.5*scale,1.4*scale,1);group.add(mist);counts.mistBanks++;});
        }
        
        // Silvery reeds line the water rather than floating in the middle of it.
        [[119.2,29.7],[117.4,28.7],[113.1,28.2],[115.6,29.2]].forEach(function(c){
            for(var i=0;i<22;i++){var a=i/22*Math.PI*2;prop(c[0]+Math.cos(a)*.66,c[1]+Math.sin(a)*.31,0,.60+random()*.17,1.08);}
        });
        // First snow on northern fields; southern orchards and terraces remain green.
        [[125,46],[127,47.5],[129,46],[124,44],[116,40],[113,39],[87,44],[94,40],[121,42],[118,39]].forEach(function(c){
            field(c[0],c[1],1.05,.66,'frost');
            for(var i=0;i<5;i++)prop(c[0]+(i-2)*.30,c[1]+.35,12,1.02,.90);
        });
        [[119,30],[117,29],[113,28],[106.5,26.2],[113,23]].forEach(function(c){
            for(var i=0;i<8;i++)prop(c[0]+(i%4-1.5)*.25,c[1]+Math.floor(i/4)*.25,1,1.02,.94);
            for(var i=0;i<6;i++)prop(c[0]+(i-2.5)*.16,c[1]-.30,11,.44,1.22);
            prop(c[0]+.40,c[1]-.15,5,.48,1.0);
        });
        // Snow-roof villages and pine belts extend the northeast winter landscape.
        [[126,45],[128,47],[123,43],[116,40],[87,43.5]].forEach(function(c){
            for(var i=0;i<3;i++)prop(c[0]+(i-1)*.25,c[1],5,.69,1.35);
            for(var i=0;i<14;i++)prop(c[0]+(random()-.5)*2.0,c[1]+.5+(random()-.5),12,1.12+random()*.20,.86);
        });
        var dummy=new THREE.Object3D();Object.keys(batches).forEach(function(key){var items=batches[key],mesh=new THREE.InstancedMesh(plane,props[key],items.length);mesh.frustumCulled=false;items.forEach(function(item,i){dummy.position.set.apply(dummy.position,item.p);dummy.scale.set.apply(dummy.scale,item.s);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.instanceMatrix.needsUpdate=true;group.add(mesh);});
        group.userData.counts=counts;
        group.userData.dispose=function(){owned.forEach(function(r){r.dispose();});group.children.forEach(function(m){if(m.isInstancedMesh&&m.dispose)m.dispose();});};
        return group;
    }
})();

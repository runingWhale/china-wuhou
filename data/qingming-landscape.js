/* 清明：花树、油菜、返青麦田、春茶与蓄水梯田。地表锚点复用原地图。 */
(function () {
    'use strict';
    var plantAtlas=null,houseAtlas=null,qingmingAtlas=null;
    window.QingmingLandscape={build:build,useAtlas:function(qingming,plants,houses){qingmingAtlas=qingming;plantAtlas=plants;houseAtlas=houses;}};
    function build(api) {
        var group=new THREE.Group();group.name='清明景观';
        var resources=[],batches={},seed=405;
        var scale=Math.min(1,Math.max(.2,(api.bounds.e-api.bounds.w)/35));
        var counts={blossomTrees:0,pearTrees:0,willows:0,rapeFields:0,rapeClumps:0,wheatFields:0,wheatClumps:0,teaBushes:0,terraceHills:0,terraceBands:0,ricePaddies:0,ploughedFields:0,villages:0,lycheeTrees:0,palms:0,buffalo:0,ploughTeams:0,riceFarmers:0,bridges:0,mistBanks:0};
        function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
        function keep(r){resources.push(r);return r;}
        function accepted(lon,lat){return lon>=api.bounds.w&&lon<=api.bounds.e&&lat>=api.bounds.s&&lat<=api.bounds.n&&api.accepts(lon,lat);}
        var plane=keep(new THREE.PlaneGeometry(1,1));plane.translate(0,.44,0);
        var box=keep(new THREE.BoxGeometry(1,1,1));
        var materials={};
        Object.entries({water:0xb5d2ca,bank:0xa89e78,wheat:0xa2b982,rape:0xd6ca75,earth:0xaba18b,soil:0x817f67,tea:0x7b9a64,rice:0x99b49a}).forEach(function(e){
            materials[e[0]]=keep(new THREE.MeshLambertMaterial({color:e[1],side:THREE.DoubleSide,transparent:true,opacity:e[0]==='water'?.74:.90}));
        });
        function paintedMaterial(image,index,key,columns,rows){
            columns=columns||3;rows=rows||2;
            if(!image)return null;
            var canvas=document.createElement('canvas');canvas.width=canvas.height=512;
            canvas.getContext('2d').drawImage(image,index%columns*image.width/columns,Math.floor(index/columns)*image.height/rows,image.width/columns,image.height/rows,0,0,512,512);
            var tex=keep(new THREE.CanvasTexture(canvas));
            var mat=keep(new THREE.MeshBasicMaterial({map:tex,alphaTest:.10,side:THREE.DoubleSide}));
            mat.onBeforeCompile=function(shader){shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',
                'vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.0,0.0,0.0,1.0);\n'+
                'vec2 propSize = vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));\n'+
                'mvPosition.xy += position.xy * propSize;\n'+
                'gl_Position = projectionMatrix * mvPosition;');};
            mat.customProgramCacheKey=function(){return 'qingming-painted-prop-v1';};
            return mat;
        }
        var plants=[];for(var i=0;i<6;i++)plants.push(paintedMaterial(plantAtlas,i));
        var houseMaterial=paintedMaterial(houseAtlas,5);
        var qprops=[];for(var qi=0;qi<9;qi++)qprops.push(paintedMaterial(qingmingAtlas,qi,null,3,3));
        plants[0]=qprops[2];plants[1]=qprops[1];plants[2]=qprops[0];
        function add(key,geometry,material,p,s){if(!material)return;if(!batches[key])batches[key]={geometry:geometry,material:material,items:[]};batches[key].items.push({p:p,s:s});}
        function prop(lon,lat,index,height,width){
            if(!accepted(lon,lat)||!plants[index])return false;
            add('plant'+index,plane,plants[index],api.position(lon,lat),[height*(width||1)*scale,height*scale,1]);return true;
        }
        function geo(positions){var g=keep(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();return g;}
        function triangle(a,p,q,r){a.push.apply(a,p.concat(q,r));}
        // 桃杏花与梨花分区安排，东北仍保留初醒黑土而非盛夏成熟作物。
        [[115,36.8,4,2.5,65,0],[110,35,3,2,45,0],[118,39,2.5,2,40,0],[119,36,2,1.5,35,0],[106,27,3,2,35,0],[117.5,30,3,2,45,0],[114,23.5,3,1.5,30,1],[86,43,4,2,35,1],[94,40.5,3,1.5,24,1]].forEach(function(r){
            for(var j=0;j<r[4];j++){
                var lon=r[0]+(random()-.5)*r[2]*2,lat=r[1]+(random()-.5)*r[3]*2;
                if(prop(lon,lat,r[5],1.05+random()*.38,.88))counts[r[5]===0?'blossomTrees':'pearTrees']++;
            }
        });
        [[118.8,30.3],[116.8,29],[112.5,28],[120.2,31]].forEach(function(c){for(var j=0;j<7;j++)if(prop(c[0]+(j-3)*.16,c[1]-.14,2,1.12,.85))counts.willows++;});
        function field(lon,lat,dx,dy,kind){
            if(!accepted(lon,lat))return;
            var arr=[];
            for(var x=0;x<4;x++)for(var y=0;y<3;y++){
                function at(i,j){var a=lon+(i/4-.5)*dx,b=lat+(j/3-.5)*dy;if(!accepted(a,b))return null;var p=api.position(a,b);p[2]+=.055*scale;return p;}
                var a=at(x,y),b=at(x+1,y),c=at(x+1,y+1),d=at(x,y+1);if(a&&b&&c&&d){triangle(arr,a,b,c);triangle(arr,a,c,d);}
            }
            if(!arr.length)return;
            group.add(new THREE.Mesh(geo(arr),materials[kind]));
            if(kind==='rape'||kind==='wheat'){
                counts[kind==='rape'?'rapeFields':'wheatFields']++;
                for(var row=0;row<5;row++)for(var col=0;col<7;col++){
                    var a=lon+(col/6-.5)*dx*.94,b=lat+(row/4-.5)*dy*.94;
                    if(prop(a,b,kind==='rape'?3:5,kind==='rape'?.36+random()*.08:.29+random()*.06,.95))counts[kind==='rape'?'rapeClumps':'wheatClumps']++;
                }
            }else{
                counts[kind==='earth'?'ploughedFields':'ricePaddies']++;
                for(var row=0;row<6;row++)for(var col=0;col<8;col++){
                    var a=lon+(col/7-.5)*dx*.95,b=lat+(row/5-.5)*dy*.95;if(!accepted(a,b))continue;
                    var p=api.position(a,b);p[2]+=.085*scale;
                    add(kind+'Rows',box,kind==='earth'?materials.soil:materials.rice,p,[.065*scale,.018*scale,.016*scale]);
                }
            }
        }
        // 江南与西南油菜，华北返青麦，华南早稻；全国图均为艺术化物候示意。
        [[118.6,30.3],[117.3,29],[114.7,30.4],[113,28.4],[106.6,27],[104.1,30.5]].forEach(function(c){for(var j=0;j<3;j++)field(c[0]+(j-1)*.42,c[1],.37,.32,'rape');});
        [[114.8,36],[117.1,35],[112.8,34],[116.1,38]].forEach(function(c){for(var j=0;j<4;j++)field(c[0]+(j%2-.5)*.40,c[1]+(Math.floor(j/2)-.5)*.32,.35,.28,'wheat');});
        [[112.6,23],[110.5,22.5],[116.1,24],[110.2,19.5]].forEach(function(c){for(var j=0;j<3;j++)field(c[0]+(j-1)*.32,c[1],.28,.24,'water');});
        [[126,45],[124.4,43.8],[129,47]].forEach(function(c){for(var j=0;j<3;j++)field(c[0]+(j-1)*.42,c[1],.35,.28,'earth');});
        // 曲面梯田的蓝绿水面和细土埂独立于底图，旋转后仍有清晰边缘。
        function terraces(lon,lat,radius,stretch,tea){
            if(!accepted(lon,lat))return;
            var built=0;
            for(var band=0;band<7;band++){
                var outer=radius*(.23+band*.11),inner=outer-radius*.085,top=[],walls=[];
                for(var step=0;step<56;step++){
                    function vertex(r,s){var a=s/56*Math.PI*2,wiggle=1+.07*Math.sin(a*3+band*.25);var x=lon+Math.cos(a)*r*wiggle,y=lat+Math.sin(a)*r*stretch*wiggle;if(!accepted(x,y))return null;var p=api.position(x,y);p[2]+=.10*scale;return p;}
                    var a=vertex(inner,step),b=vertex(outer,step),c=vertex(outer,step+1),d=vertex(inner,step+1);if(!a||!b||!c||!d)continue;
                    triangle(top,a,b,c);triangle(top,a,c,d);var b0=b.slice(),c0=c.slice();b0[2]-=.12*scale;c0[2]-=.12*scale;triangle(walls,b,b0,c0);triangle(walls,b,c0,c);
                }
                if(!top.length)continue;
                group.add(new THREE.Mesh(geo(top),tea?materials.tea:materials.water));group.add(new THREE.Mesh(geo(walls),materials.bank));counts.terraceBands++;built++;
            }
            if(built)counts.terraceHills++;
            if(tea)for(var row=0;row<5;row++)for(var col=0;col<9;col++){
                var x=lon+(col-4)*radius*.15,y=lat+(row-2)*radius*.10;
                if(prop(x,y,4,.33,.95))counts.teaBushes++;
            }
        }
        [[102.4,25.3,1.2,.58,false],[103.4,23.4,1.1,.63,false],[106.6,26.1,1.15,.55,false],[110,25.6,1.05,.58,false],[118.3,27.5,.85,.53,true],[105.7,27.8,.8,.55,true]].forEach(function(t){terraces.apply(null,t);});
        [[119.6,30.1],[117.6,29.4],[106.8,26],[104.4,30.3],[113.7,23.2],[86.5,43.2],[126,45]].forEach(function(c){
            for(var j=0;j<3;j++){
                var lon=c[0]+(j-1)*.25,lat=c[1]+j%2*.15;if(!accepted(lon,lat)||!houseMaterial)continue;
                var h=.66*scale;add('houses',plane,houseMaterial,api.position(lon,lat),[h*1.4,h,1]);counts.villages++;
            }
        });
        
        function qprop(lon,lat,index,h,w,count){
            if(!accepted(lon,lat)||!qprops[index])return;
            add('qingming'+index,plane,qprops[index],api.position(lon,lat),[h*(w||1)*scale,h*scale,1]);counts[count]++;
        }
        // Newly green northwest willows and willow-lined Jiangnan waterways.
        [[85.8,43.1,3,1.3,32],[94.5,40.2,2,1,18],[119.8,30.2,2,1.2,38],[116.4,28.9,2.4,1.2,30],[113.1,28,1.8,1,24]].forEach(function(r){
            for(var j=0;j<r[4];j++)qprop(r[0]+(random()-.5)*r[2]*2,r[1]+(random()-.5)*r[3]*2,0,1.22+random()*.4,.78,'willows');
        });
        // Lychee blossoms, palms and early-rice planting in the warm south.
        [[113.4,23.1],[110.4,21.8],[116.2,24],[110.2,19.4]].forEach(function(c){
            for(var j=0;j<15;j++)qprop(c[0]+(random()-.5)*2.3,c[1]+(random()-.5)*1.4,3,1.02+random()*.28,.94,'lycheeTrees');
            for(var j=0;j<7;j++)qprop(c[0]+(random()-.5)*1.8,c[1]+(random()-.5)*1.2,4,1.32,.74,'palms');
            for(var j=0;j<3;j++)qprop(c[0]+(j-1)*.33,c[1]-.2,7,.45,.7,'riceFarmers');
        });
        [[119.1,30.2],[117.2,29],[113,28.3],[104.1,25.1]].forEach(function(c){qprop(c[0],c[1],5,.64,1.58,'buffalo');});
        [[126,45],[124.4,43.8],[129,47],[86.5,43.2],[115.2,36.1]].forEach(function(c){qprop(c[0],c[1],6,.58,1.8,'ploughTeams');});
        [[119.2,29.9],[117.5,29.1],[112.3,28.1]].forEach(function(c){qprop(c[0],c[1],8,.67,1.9,'bridges');});
        // Soft spring mountain mist in world space, leaving all controls clickable.
        if(api.bounds.e-api.bounds.w>20){
            var cv=document.createElement('canvas');cv.width=256;cv.height=128;var ctx=cv.getContext('2d');
            for(var puff=0;puff<28;puff++){
                var x=24+random()*208,y=49+random()*30,r=14+random()*27;
                var grad=ctx.createRadialGradient(x,y,0,x,y,r);grad.addColorStop(0,'rgba(245,248,244,.30)');grad.addColorStop(.5,'rgba(237,244,239,.13)');grad.addColorStop(1,'rgba(237,244,239,0)');ctx.fillStyle=grad;ctx.fillRect(x-r,y-r,r*2,r*2);
            }
            var mistTexture=keep(new THREE.CanvasTexture(cv));
            var mist=keep(new THREE.MeshBasicMaterial({map:mistTexture,transparent:true,opacity:.64,depthWrite:false,side:THREE.DoubleSide}));
            if(houseMaterial)mist.onBeforeCompile=houseMaterial.onBeforeCompile;mist.customProgramCacheKey=function(){return 'qingming-mist-v1';};
            [[98,30],[103,28],[107,27],[110,29],[114,29],[118,28.5],[120,31],[94,35]].forEach(function(c){
                if(!accepted(c[0],c[1]))return;var p=api.position(c[0],c[1]);p[2]+=.4;add('mist',plane,mist,p,[5.8,1.65,1]);counts.mistBanks++;
            });
        }
        var dummy=new THREE.Object3D();
        Object.values(batches).forEach(function(b){
            var mesh=new THREE.InstancedMesh(b.geometry,b.material,b.items.length);mesh.frustumCulled=false;
            b.items.forEach(function(item,i){dummy.position.set.apply(dummy.position,item.p);dummy.scale.set.apply(dummy.scale,item.s);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.instanceMatrix.needsUpdate=true;group.add(mesh);
        });
        group.userData.counts=counts;
        group.userData.dispose=function(){resources.forEach(function(r){r.dispose();});group.children.forEach(function(m){if(m.isInstancedMesh&&m.dispose)m.dispose();});};
        return group;
    }
})();

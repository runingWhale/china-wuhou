/* 夏至微缩景物：梯田、麦田、林木、果园、村落与水乡。 */
(function () {
    'use strict';
    var atlasImage=null;
    window.XiazhiLandscape={build:build,useAtlas:function(img){atlasImage=img;}};
    function build(api) {
        var group=new THREE.Group();group.name='夏至景观';
        var owned=[],batches={},seed=621;
        var detailScale=Math.min(1,Math.max(.2,(api.bounds.e-api.bounds.w)/35));
        var counts={trees:0,palms:0,orchardTrees:0,terraceHills:0,terraceBands:0,wheatFields:0,ricePaddies:0,villages:0,pagodas:0,lotus:0};
        function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
        function keep(r){owned.push(r);return r;}
        function accepted(lon,lat){return lon>=api.bounds.w&&lon<=api.bounds.e&&lat>=api.bounds.s&&lat<=api.bounds.n&&api.accepts(lon,lat);}
        var materials={};
        Object.entries({bark:0x655238,forest:0x315d40,jade:0x517648,leaf:0x7d9b45,palm:0x558544,fruit:0xbc4439,wall:0xf0e5cd,roof:0x344b49,door:0x824632,embankment:0xb5a058,rice:0xa9c950,riceDeep:0x80ac46,flooded:0x76bfa3,wheat:0xdac078,wheatLight:0xebd594,water:0x62bcc3,lotus:0x588e60,flower:0xe6a7af}).forEach(function(e){materials[e[0]]=keep(new THREE.MeshLambertMaterial({color:e[1],side:THREE.DoubleSide}));});
        var sphere=keep(new THREE.IcosahedronGeometry(1,1));
        var cone=keep(new THREE.ConeGeometry(1,1,8));cone.rotateX(Math.PI/2);cone.translate(0,0,.5);
        var trunk=keep(new THREE.CylinderGeometry(.065,.085,1,6));trunk.rotateX(Math.PI/2);trunk.translate(0,0,.5);
        var box=keep(new THREE.BoxGeometry(1,1,1));
        var paintedPlane=keep(new THREE.PlaneGeometry(1,1));paintedPlane.translate(0,.44,0);
        var propMaterials=atlasImage ? [] : null;
        if(atlasImage)for(var tile=0;tile<6;tile++){
            var canvas=document.createElement('canvas');canvas.width=canvas.height=512;
            canvas.getContext('2d').drawImage(atlasImage,(tile%3)*atlasImage.width/3,Math.floor(tile/3)*atlasImage.height/2,atlasImage.width/3,atlasImage.height/2,0,0,512,512);
            var texture=keep(new THREE.CanvasTexture(canvas));
            var material=keep(new THREE.MeshBasicMaterial({map:texture,alphaTest:.12,side:THREE.DoubleSide}));
            // 每类植物一次实例绘制：面对相机的画片，根部仍锚在三维地表。
            material.onBeforeCompile=function(shader){shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',
                'vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.0,0.0,0.0,1.0);\n'+
                'vec2 propSize = vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));\n'+
                'mvPosition.xy += position.xy * propSize;\n'+
                'gl_Position = projectionMatrix * mvPosition;');};
            material.customProgramCacheKey=function(){return 'xiazhi-painted-prop-v1';};
            propMaterials.push(material);
        }
        function add(key,geometry,material,p,s,angle){
            if(!batches[key])batches[key]={geometry:geometry,material:material,items:[]};
            batches[key].items.push({p:p,s:s,r:angle||0});
        }
        function geometry(positions,uvs){var g=keep(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));if(uvs)g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.computeVertexNormals();return g;}
        function triangle(arr,a,b,c){arr.push.apply(arr,a.concat(b,c));}
        // 羽状棕榈叶片沿三维曲线舒展，树冠不是平面图标。
        var leafPositions=[];
        for(var l=0;l<8;l++){
            var t=l/8,u=(l+1)/8;
            function point(q,side){return [q*.8,side*Math.sin(q*Math.PI)*.14,Math.sin(q*Math.PI)*.2-q*q*.26];}
            triangle(leafPositions,point(t,-1),point(u,-1),point(u,1));triangle(leafPositions,point(t,-1),point(u,1),point(t,1));
        }
        var palmLeaf=geometry(leafPositions);
        function tree(lon,lat,kind){
            if(!accepted(lon,lat))return;
            var p=api.position(lon,lat),h=(.55+random()*.5)*detailScale,w=(.27+random()*.15)*detailScale;
            if(kind==='palm')h*=1.35;
            if(propMaterials){
                var index=kind==='pine'?1:kind==='palm'?3:kind==='orchard'?4:0;
                add('paintedTree'+index,paintedPlane,propMaterials[index],p,[h*1.1,h*1.5,1]);counts.trees++;
                if(kind==='palm')counts.palms++;if(kind==='orchard')counts.orchardTrees++;
                return;
            }
            add('trunks',trunk,materials.bark,p,[1,1,h]);counts.trees++;
            if(kind==='pine'){
                for(var i=0;i<3;i++)add('pines',cone,materials.forest,[p[0],p[1],p[2]+h*(.15+i*.19)],[w*(1-i*.23),w*(1-i*.23),h*.65]);
            }else if(kind==='palm'){
                counts.palms++;
                for(var f=0;f<7;f++)add('palmLeaves',palmLeaf,materials.palm,[p[0],p[1],p[2]+h],[h,h,h],f*Math.PI*2/7);
            }else{
                var orchard=kind==='orchard';if(orchard)counts.orchardTrees++;
                for(var k=0;k<4;k++){
                    var a=k*Math.PI/2+random()*.5,r=w*(.85+random()*.25);
                    var mat=k===0?materials.leaf:k===1?materials.jade:materials.forest;
                    add('canopy'+k,sphere,mat,[p[0]+Math.cos(a)*w*.32,p[1]+Math.sin(a)*w*.32,p[2]+h*.78],[r,r,r*(.85+random()*.4)],a);
                }
                if(orchard)for(var fruit=0;fruit<5;fruit++){
                    var a=fruit*1.26;add('lychees',sphere,materials.fruit,[p[0]+Math.cos(a)*w*.78,p[1]+Math.sin(a)*w*.78,p[2]+h*.73],[.055,.055,.055]);
                }
            }
        }
        [[128,47,5,5,145,'pine'],[121,43,3,3,75,'pine'],[101,30,4,3,80,'broad'],[105,27,4,3,95,'broad'],[111,27,4,2,80,'broad'],[118,26,2,3,85,'broad'],[112,23,4,2,65,'palm'],[110,19.4,1.5,.8,20,'palm'],[121,24,1,1.8,25,'broad']].forEach(function(r){for(var i=0;i<r[4];i++)tree(r[0]+(random()-.5)*r[2]*2,r[1]+(random()-.5)*r[3]*2,r[5]);});
        // 荔枝果园按行排列，华南的叶色与东北雪松完全不同。
        [[111.3,23.1],[113.6,23.5],[116.4,24.1]].forEach(function(c){for(var x=0;x<6;x++)for(var y=0;y<4;y++)tree(c[0]+(x-2.5)*.22,c[1]+(y-1.5)*.20,'orchard');});
        if(propMaterials)[[118.6,30.1],[117.3,29.1],[114.2,28.3]].forEach(function(c){
            for(var i=0;i<6;i++){
                var lon=c[0]+(i-2.5)*.12,lat=c[1]-.15;if(!accepted(lon,lat))continue;
                var p=api.position(lon,lat),h=(.9+random()*.15)*detailScale;
                add('paintedWillows',paintedPlane,propMaterials[2],p,[h,h*1.25,1]);counts.trees++;
            }
        });
        // 梯田每条曲带都独立建模：绿色田面、赭色田埂、垂直挡土边缘。
        function terraces(lon,lat,radius,stretch){
            if(!accepted(lon,lat))return;
            var built=0;
            for(var band=0;band<8;band++){
                var outer=radius*(.22+band*.105),inner=outer-radius*.078,top=[],wall=[];
                for(var s=0;s<64;s++){
                    function vertex(r,step){
                        var a=step/64*Math.PI*2,meander=1+.07*Math.sin(a*3+band*.2)+.03*Math.cos(a*5);
                        var x=lon+Math.cos(a)*r*meander,y=lat+Math.sin(a)*r*stretch*meander;
                        if(!accepted(x,y))return null;
                        var p=api.position(x,y);p[2]+=.12*detailScale;return p;
                    }
                    var a=vertex(inner,s),b=vertex(outer,s),c=vertex(outer,s+1),d=vertex(inner,s+1);
                    if(!a||!b||!c||!d)continue;
                    triangle(top,a,b,c);triangle(top,a,c,d);
                    var b0=b.slice(),c0=c.slice();b0[2]-=.14*detailScale;c0[2]-=.14*detailScale;
                    triangle(wall,b,b0,c0);triangle(wall,b,c0,c);
                }
                if(!top.length)continue;
                var m=band%3===0?materials.flooded:band%2===0?materials.rice:materials.riceDeep;
                group.add(new THREE.Mesh(geometry(top),m));group.add(new THREE.Mesh(geometry(wall),materials.embankment));
                counts.terraceBands++;built++;
            }
            if(built)counts.terraceHills++;
        }
        [[102.4,25.3,1.4,.56],[103.5,23.5,1.1,.66],[106.5,26.2,1.25,.58],[110,25.7,1.2,.52],[107.8,28.4,.85,.62],[118.2,27.1,.8,.55]].forEach(function(t){terraces.apply(null,t);});
        // 地表田块沿经纬度网格采样高度，避免悬空或穿入山体。
        function field(lon,lat,dx,dy,wheat){
            if(!accepted(lon,lat))return;
            var top=[],rows=[];
            for(var x=0;x<4;x++)for(var y=0;y<3;y++){
                function p(i,j){var a=lon+(i/4-.5)*dx,b=lat+(j/3-.5)*dy;if(!accepted(a,b))return null;var q=api.position(a,b);q[2]+=.08;return q;}
                var a=p(x,y),b=p(x+1,y),c=p(x+1,y+1),d=p(x,y+1);if(!a||!b||!c||!d)continue;
                triangle(top,a,b,c);triangle(top,a,c,d);
            }
            if(!top.length)return;
            group.add(new THREE.Mesh(geometry(top),wheat?materials.wheat:materials.flooded));
            for(var i=0;i<7;i++){
                var y=lat+(i/6-.5)*dy;
                for(var j=0;j<10;j++){
                    var x=lon+(j/9-.5)*dx;if(!accepted(x,y))continue;
                    var p=api.position(x,y);p[2]+=.12;
                    add(wheat?'wheatRows':'riceRows',box,wheat?materials.wheatLight:materials.riceDeep,p,[.075,.021,.025],0);
                }
            }
            counts[wheat?'wheatFields':'ricePaddies']++;
        }
        [[115,36],[117,35],[113,34],[116.5,38]].forEach(function(c){for(var i=0;i<6;i++)field(c[0]+(i%3-1)*.42,c[1]+(Math.floor(i/3)-.5)*.36,.36,.27,true);});
        [[119,30],[117,29],[113,28],[120,31]].forEach(function(c){for(var i=0;i<6;i++)field(c[0]+(i%3-1)*.30,c[1]+(Math.floor(i/3)-.5)*.27,.27,.23,false);});
        // 传统屋宇：粉墙、黛瓦、重檐；村落与田畴相邻。
        var rp=[],roofPoints=[[-.63,-.44,.10],[.63,-.44,.10],[.63,.44,.10],[-.63,.44,.10],[-.5,0,.4],[.5,0,.4]];
        [[0,1,5],[0,5,4],[3,4,5],[3,5,2],[0,4,3],[1,2,5]].forEach(function(t){triangle(rp,roofPoints[t[0]],roofPoints[t[1]],roofPoints[t[2]]);});
        var roof=geometry(rp);
        function house(lon,lat,size,pagoda){
            if(!accepted(lon,lat))return;
            size*=detailScale;
            var p=api.position(lon,lat);counts[pagoda?'pagodas':'villages']++;
            if(propMaterials && !pagoda){add('paintedHouses',paintedPlane,propMaterials[5],p,[size*1.6,size*1.25,1]);return;}
            var levels=pagoda?4:1;
            for(var level=0;level<levels;level++){
                var z=p[2]+level*size*.6,s=size*(1-level*.13);
                add('houses',box,materials.wall,[p[0],p[1],z+s*.2],[s,s*.68,s*.4]);
                add('roofs',roof,materials.roof,[p[0],p[1],z+s*.4],[s,s,s]);
                add('doors',box,materials.door,[p[0],p[1]-s*.345,z+s*.17],[s*.14,.03,s*.32]);
            }
        }
        [[102.5,25.1],[106.8,26],[109.7,25.5],[104,30.5],[118.6,30],[117,29.3],[113,28],[115.5,23.5],[119,26],[121,24.5],[126,45]].forEach(function(c){for(var i=0;i<3;i++)house(c[0]+(i-1)*.3,c[1]+(i%2)*.15,.58,false);});
        [[119.5,30.2],[117.7,29.4],[104.3,25.5]].forEach(function(c){house(c[0],c[1],.75,true);});
        // 池塘的椭圆水面、荷叶与粉色花点，整体贴合江南地形。
        [[119.3,29.5],[117.4,28.5],[114.1,28.2]].forEach(function(c){
            var arr=[],center=api.position(c[0],c[1]);center[2]+=.07;
            for(var i=0;i<48;i++){
                function edge(j){var a=j/48*Math.PI*2,lon=c[0]+Math.cos(a)*.4,lat=c[1]+Math.sin(a)*.2;if(!accepted(lon,lat))return null;var p=api.position(lon,lat);p[2]+=.07;return p;}
                var a=edge(i),b=edge(i+1);if(a&&b)triangle(arr,center,a,b);
            }
            if(arr.length)group.add(new THREE.Mesh(geometry(arr),materials.water));
            for(var k=0;k<15;k++){
                var lon=c[0]+(random()-.5)*.65,lat=c[1]+(random()-.5)*.25;if(!accepted(lon,lat))continue;
                var p=api.position(lon,lat);p[2]+=.10;
                add('lotusLeaves',sphere,materials.lotus,p,[.085,.085,.015]);
                if(k%3===0){p=p.slice();p[2]+=.06;add('lotusFlowers',sphere,materials.flower,p,[.035,.035,.035]);}counts.lotus++;
            }
        });
        // 轻薄山岚，保留田畴和省份轮廓的可读性。
        if(api.bounds.e-api.bounds.w>20){
            var cloudCanvas=document.createElement('canvas');cloudCanvas.width=256;cloudCanvas.height=128;
            var ctx=cloudCanvas.getContext('2d');
            for(var puff=0;puff<28;puff++){
                var x=28+random()*200,y=48+random()*34,r=14+random()*28;
                var grad=ctx.createRadialGradient(x,y,0,x,y,r);grad.addColorStop(0,'rgba(245,250,246,.21)');grad.addColorStop(.45,'rgba(228,243,242,.10)');grad.addColorStop(1,'rgba(225,241,242,0)');ctx.fillStyle=grad;ctx.fillRect(x-r,y-r,r*2,r*2);
            }
            var cloudTexture=keep(new THREE.CanvasTexture(cloudCanvas));
            var cloudMaterial=keep(new THREE.MeshBasicMaterial({map:cloudTexture,transparent:true,opacity:.62,depthWrite:false,side:THREE.DoubleSide}));
            cloudMaterial.onBeforeCompile=function(shader){shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',
                'vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.0,0.0,0.0,1.0);\n'+
                'vec2 propSize = vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));\n'+
                'mvPosition.xy += position.xy * propSize;\n'+
                'gl_Position = projectionMatrix * mvPosition;');};
            cloudMaterial.customProgramCacheKey=function(){return 'xiazhi-cloud-v1';};
            [[85,34],[93,33],[98,29],[102,27],[91,42],[127,49],[122,30],[113,22]].forEach(function(c){
                if(!accepted(c[0],c[1]))return;var p=api.position(c[0],c[1]);p[2]+=.45;
                add('mist',paintedPlane,cloudMaterial,p,[6.5,2,1]);
            });
        }
        var dummy=new THREE.Object3D();
        Object.values(batches).forEach(function(b){
            var mesh=new THREE.InstancedMesh(b.geometry,b.material,b.items.length);mesh.frustumCulled=false;
            b.items.forEach(function(item,i){dummy.position.set.apply(dummy.position,item.p);dummy.scale.set.apply(dummy.scale,item.s);dummy.rotation.set(0,0,item.r);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
            mesh.instanceMatrix.needsUpdate=true;group.add(mesh);
        });
        group.userData.counts=counts;
        group.userData.dispose=function(){owned.forEach(function(r){r.dispose();});group.children.forEach(function(m){if(m.isInstancedMesh&&m.dispose)m.dispose();});};
        return group;
    }
})();

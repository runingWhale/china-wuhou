/* 惊蛰：水墨春耕、桃梨花、燕归、春雷与东北退雪。 */
(function () {
    'use strict';
    var atlas = null, summerAtlas = null;
    window.JingzheLandscape = {
        useAtlas: function (image, summer) { atlas = image; summerAtlas = summer; },
        build: build
    };
    function build(api) {
        var group = ChunfenLandscape.build(api);
        group.name = '惊蛰景观';
        var baseDispose = group.userData.dispose;
        var counts = group.userData.counts;
        Object.assign(counts, { thunderclouds: 0, swallows: 0, ploughTeams: 0, farmers: 0, frostTrees: 0, palms: 0 });
        var resources = [], batches = {}, birds = [], seed = 305;
        var scale = Math.min(1, Math.max(.2, (api.bounds.e - api.bounds.w) / 35));
        function keep(value) { resources.push(value); return value; }
        function random() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
        function accepts(lon, lat) {
            return lon >= api.bounds.w && lon <= api.bounds.e && lat >= api.bounds.s && lat <= api.bounds.n && api.accepts(lon, lat);
        }
        var plane = keep(new THREE.PlaneGeometry(1, 1));
        plane.translate(0, .44, 0);
        function material(image, index) {
            if (!image) return null;
            var canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
            canvas.getContext('2d').drawImage(image, index % 3 * image.width / 3, Math.floor(index / 3) * image.height / 2, image.width / 3, image.height / 2, 0, 0, 512, 512);
            var texture = keep(new THREE.CanvasTexture(canvas));
            var mat = keep(new THREE.MeshBasicMaterial({ map: texture, alphaTest: .06, side: THREE.DoubleSide }));
            mat.onBeforeCompile = function (shader) {
                shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>',
                    'vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.0,0.0,0.0,1.0);\n' +
                    'vec2 propSize = vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));\n' +
                    'mvPosition.xy += position.xy * propSize;\n' +
                    'gl_Position = projectionMatrix * mvPosition;');
            };
            mat.customProgramCacheKey = function () { return 'jingzhe-painted-prop-v1'; };
            return mat;
        }
        var props = [];
        for (var i = 0; i < 6; i++) props.push(material(atlas, i));
        var palm = material(summerAtlas, 3);
        function add(lon, lat, index, height, width, lift, count) {
            var mat = index === 6 ? palm : props[index];
            if (!mat || !accepts(lon, lat)) return;
            var p = api.position(lon, lat); p[2] += (lift || 0) * scale;
            if (!batches[index]) batches[index] = { material: mat, items: [] };
            var item = { p: p, s: [height * width * scale, height * scale, 1] };
            batches[index].items.push(item); counts[count]++;
            if (index === 1) birds.push(item);
        }
        // 透明雷雨云悬于川鄂山地，跟随同一三维地图。
        add(106.6, 30.5, 0, 5.3, 1.65, 1.6, 'thunderclouds');
        add(110.4, 30.9, 0, 3.7, 1.65, 1.8, 'thunderclouds');
        [[103, 35, 2.8], [112.5, 33, 2.6], [117, 30.2, 2.8], [119, 28.3, 2.4], [112, 24.5, 2.5], [106, 27.5, 2.3], [119, 36.5, 2.7]].forEach(function (p, i) {
            add(p[0], p[1], 1, .9 + (i % 3) * .14, 1.45, p[2], 'swallows');
        });
        [[86.5, 43.1], [93.6, 40.2], [113.9, 36], [116.7, 35], [112.6, 34.3], [117, 38], [104.1, 30.5], [106.7, 27], [117.3, 29], [114.7, 30.4], [112.6, 23], [110.3, 19.7]].forEach(function (p) {
            add(p[0], p[1], 2, .63, 1.8, .06, 'ploughTeams');
        });
        [[118.7, 30.3], [117.2, 29.3], [113.1, 28.4], [102.4, 25.3], [103.5, 23.5], [106.6, 26.1], [112.6, 23.2], [110.7, 22.6], [116.1, 24], [110.3, 19.5], [126, 45], [124.4, 43.8]].forEach(function (p) {
            add(p[0], p[1], 3, .62, .72, .03, 'farmers');
        });
        [[125, 46.3], [128.3, 47], [127.4, 44.8], [130, 46.7], [123.8, 43.3]].forEach(function (center) {
            for (var j = 0; j < 14; j++) add(center[0] + (random() - .5) * 2.4, center[1] + (random() - .5) * 1.5, j % 3 === 0 ? 5 : 4, 1.0 + random() * .65, .8, 0, 'frostTrees');
        });
        [[112.5, 22.5], [114.6, 23.4], [110, 19.5]].forEach(function (center) {
            for (var j = 0; j < 6; j++) add(center[0] + (random() - .5) * 1.8, center[1] + (random() - .5) * .8, 6, 1.3 + random() * .35, .85, 0, 'palms');
        });
        var dummy = new THREE.Object3D();
        Object.keys(batches).forEach(function (index) {
            var batch = batches[index], mesh = new THREE.InstancedMesh(plane, batch.material, batch.items.length);
            mesh.frustumCulled = false;
            batch.items.forEach(function (item, k) {
                dummy.position.set.apply(dummy.position, item.p); dummy.scale.set.apply(dummy.scale, item.s); dummy.updateMatrix(); mesh.setMatrixAt(k, dummy.matrix);
            });
            mesh.instanceMatrix.needsUpdate = true;
            batch.mesh = mesh; group.add(mesh);
        });
        group.userData.animate = function (time) {
            var batch = batches[1]; if (!batch) return;
            birds.forEach(function (item, index) {
                dummy.position.set(item.p[0], item.p[1], item.p[2] + Math.sin(time / 1300 + index * 1.7) * .13 * scale);
                dummy.scale.set.apply(dummy.scale, item.s); dummy.updateMatrix(); batch.mesh.setMatrixAt(index, dummy.matrix);
            });
            batch.mesh.instanceMatrix.needsUpdate = true;
        };
        group.userData.dispose = function () { baseDispose(); resources.forEach(function (resource) { resource.dispose(); }); };
        return group;
    }
})();

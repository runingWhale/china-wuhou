/* terrain3d.js — 三维地形地图引擎（Three.js）
 * 数据来源：内置 terrain-model.js 的地貌骨架与程序皴染，不依赖 DEM 数据包
 * 高度图编码：R = 高程高 8 位，G = 低 8 位，归一化值 * 6500m；A = 陆地掩膜
 */
(function () {
    'use strict';

    // ========== 常量 ==========
    var NATIONAL_BOUNDS = { w: 73.0, s: 17.5, e: 135.5, n: 54.0 };
    var LON_SPAN = NATIONAL_BOUNDS.e - NATIONAL_BOUNDS.w;   // 62.5
    var LAT_SPAN = NATIONAL_BOUNDS.n - NATIONAL_BOUNDS.s;   // 36.5
    var MAP_W = 100;                 // 全国地图世界宽度
    var MAP_H = 58;                  // 全国地图世界高度
    var ELEV_RANGE = 6500;           // 高程图归一化对应的米数
    var Z_MAX = 8.4;                 // 最高海拔对应的世界高度（克制的立体感）
    var Z_SCALE = Z_MAX / ELEV_RANGE;
    var HCW = 720, HCH = 420;        // 高亮画布尺寸
    var FOV = 38;

    // ========== 节气主题系统（青绿水墨山水） ==========
    // 颜色全部集中在这里：高程色带由 6 个主色自动派生，
    // "南方墨绿 / 西北土黄" 这类地理倾向也作为主题参数参与着色。
    // 色彩语言：青绿为山，墨色为阴影，淡蓝为水，土黄为高原裸地，白为积雪。
    var RAMP_H = [-100, 200, 800, 1800, 3000, 4200, 5400];   // 色带高程节点（米）

    var INK_BASE = {
        paperCss: '#f4ecdd',            // 宣纸底：米白偏暖，绝不是纯白
        fogColor: 0xf4ecdd,
        fogNear: 170, fogFar: 380,

        terrainLow: '#b2cbb0',          // 低地 / 东部平原  青绿
        terrainBase: '#8ba997',         // 中部山地        青灰绿
        terrainHigh: '#b0b7ab',         // 高原面          青灰
        vegetationBase: '#6b9779',      // 南方植被        墨绿
        earthOchre: '#c0b499',          // 西北 / 裸地     淡黄褐
        water: '#b4ccd0',               // 水域            淡蓝青
        snow: '#ecece6',                // 积雪            冷白
        inkShadow: '#4b5954',           // 墨色阴影        青墨（非纯黑）

        snowLine: 1.0,                  // 雪线系数（<1 雪线下降）
        vegSouth: 0.46,                 // 南方墨绿倾向强度
        aridWest: 0.44,                 // 西北土黄倾向强度
        inkStrength: 0.26,              // 墨色阴影强度
        terrainTint: [1.0, 1.0, 1.0],   // 整体微调

        borderColor: 0x6d7a70,          // 省界：低对比墨灰绿细线
        borderOpacity: 0.30,
        skirtColor: 0x5b6156,           // 裙墙：墨灰
        highlight: { r: 0.60, g: 0.32, b: 0.28, a: 0.30 },   // 悬停：朱砂

        // 光照：柔和低反差，不出现强烈白色高光，立体感交给墨色明暗
        sunColor: 0xfff8ec, sunIntensity: 0.30,
        hemiSky: 0xf7f2e6, hemiGround: 0x9a9884, hemiIntensity: 0.90
    };

    // 四季倾向（未单独精配的节气自动继承对应季节）
    var SEASON_LEAN = {
        spring: {
            paperCss: '#f4eddf', fogColor: 0xf4eddf,
            terrainLow: '#a3bd8d', terrainBase: '#688866', terrainHigh: '#a9ad8d',
            vegetationBase: '#477955', earthOchre: '#c1b69b',
            water: '#b3cdd1', snow: '#eef0e9', inkShadow: '#4b5a55',
            snowLine: 1.05, vegSouth: 0.50, aridWest: 0.40, inkStrength: 0.24
        },
        summer: {
            paperCss: '#f1f0e1', fogColor: 0xf1f0e1,
            terrainLow: '#8eaf80', terrainBase: '#557a5c', terrainHigh: '#aeb7a8',
            vegetationBase: '#3a6952', earthOchre: '#c4b79a',
            water: '#b0ccd1', snow: '#f0f4f4', inkShadow: '#4a5951',
            snowLine: 1.15, vegSouth: 0.54, aridWest: 0.40, inkStrength: 0.20
        },
        autumn: {
            paperCss: '#f5edda', fogColor: 0xf5edda,
            terrainLow: '#b3b285', terrainBase: '#878c66', terrainHigh: '#b4b6a2',
            vegetationBase: '#697f55', earthOchre: '#c8b28f',
            water: '#b6c8cb', snow: '#ecefe9', inkShadow: '#52564c',
            snowLine: 1.08, vegSouth: 0.40, aridWest: 0.52, inkStrength: 0.26
        },
        winter: {
            paperCss: '#f3ecdd', fogColor: 0xf3ecdd,
            terrainLow: '#92ab96', terrainBase: '#648776', terrainHigh: '#a5ad9d',
            vegetationBase: '#497361', earthOchre: '#bcb08b',
            water: '#b2cad0', snow: '#eef0e9', inkShadow: '#4a5656',
            snowLine: 0.94, vegSouth: 0.40, aridWest: 0.42, inkStrength: 0.30
        }
    };

    // 二十四节气主题：本阶段只精配"冬至"，其余节气预留接口，
    // 未来在 solarTermThemes 中逐个覆写即可（缺省 = 青绿墨底 + 季节倾向）。
    var solarTermThemes = {
        dahan: {name:'大寒',terrainLow:'#dce7ec',terrainBase:'#a4b7c8',vegetationBase:'#658273',earthOchre:'#bfb39b',water:'#b3d3e1',snow:'#f6faff',snowLine:.88,inkStrength:.07,borderColor:0x8b9eab,borderOpacity:.18,skirtColor:0x929e9d,paintWeight:.99,hemiSky:0xf8fcff,hemiGround:0xd8e2e8,hemiIntensity:1.00,sunIntensity:.23},
        xiaohan: {name:'小寒',terrainLow:'#d3dfe5',terrainBase:'#9aaec1',vegetationBase:'#617d70',earthOchre:'#bdb29b',water:'#abcbd9',snow:'#f5f8fc',snowLine:.82,inkStrength:.08,borderColor:0x899aa6,borderOpacity:.18,skirtColor:0x919b99,paintWeight:.99,hemiSky:0xf7fbff,hemiGround:0xd2dce3,hemiIntensity:1.00,sunIntensity:.23},
        daxue: {name:'大雪',terrainLow:'#d4dfe0',terrainBase:'#a4b2bf',vegetationBase:'#658174',earthOchre:'#c1b799',water:'#a3c8d8',snow:'#f3f7fc',snowLine:.86,inkStrength:.08,borderColor:0x8898a2,borderOpacity:.18,skirtColor:0x969d97,paintWeight:.99,hemiSky:0xf8fbff,hemiGround:0xd2dce0,hemiIntensity:1.00,sunIntensity:.23},
        xiaoxue: {name:'小雪',terrainLow:'#c5c5b4',terrainBase:'#929da1',vegetationBase:'#7e8d76',earthOchre:'#c5b492',water:'#a8c4ce',snow:'#f3f6f7',snowLine:.79,inkStrength:.10,borderColor:0x8a9596,borderOpacity:.18,skirtColor:0x8b8c80,paintWeight:.98,hemiSky:0xf9fcff,hemiGround:0xd5d6cd,hemiIntensity:1.00,sunIntensity:.23},
        lidong: {name:'立冬',terrainLow:'#c5b58f',terrainBase:'#89958e',vegetationBase:'#6d8261',earthOchre:'#c6b18a',water:'#b0cbd2',snow:'#eff3f3',snowLine:.84,inkStrength:.10,borderColor:0x8c9088,borderOpacity:.18,skirtColor:0x998c72,paintWeight:.98,hemiSky:0xfffcf6,hemiGround:0xd3d9d5,hemiIntensity:1.00,sunIntensity:.23},
        shuangjiang: {name:'霜降',terrainLow:'#d8be88',terrainBase:'#9b927e',vegetationBase:'#877e50',earthOchre:'#d3b68d',water:'#a6c6ce',snow:'#f0f3f2',snowLine:.90,inkStrength:.10,borderColor:0x958875,borderOpacity:.18,skirtColor:0x9e8767,paintWeight:.98,hemiSky:0xfffcf6,hemiGround:0xd7d3c7,hemiIntensity:1.00,sunIntensity:.23},
        hanlu: {name:'寒露',terrainLow:'#d8b467',terrainBase:'#a08b5e',vegetationBase:'#a67a43',earthOchre:'#c8a16d',water:'#9dbfc4',snow:'#f2f3f0',inkStrength:.10,borderColor:0x967d58,borderOpacity:.17,skirtColor:0x99805a,paintWeight:.98,hemiSky:0xfffcf5,hemiGround:0xd7c9b4,hemiIntensity:1.00,sunIntensity:.24},
        chushu: {name:'处暑',terrainLow:'#d6c17c',terrainBase:'#939564',vegetationBase:'#6f8552',earthOchre:'#cbb17c',water:'#9fc9c8',snow:'#f3f4f0',inkStrength:.10,borderColor:0x91876a,borderOpacity:.18,skirtColor:0x9c8961,paintWeight:.98,hemiSky:0xfffcf4,hemiGround:0xd4d3bd,hemiIntensity:1.00,sunIntensity:.24},
        liqiu: {name:'立秋',terrainLow:'#d6c589',terrainBase:'#9b9b68',vegetationBase:'#78834f',earthOchre:'#c8ad78',water:'#9bc7c8',snow:'#f2f3ef',inkStrength:.10,borderColor:0x948568,borderOpacity:.18,skirtColor:0xa18a61,paintWeight:.98,hemiSky:0xfffcf4,hemiGround:0xd6d1bb,hemiIntensity:1.00,sunIntensity:.24},
        qiufen: {name:'秋分',terrainLow:'#d9bc71',terrainBase:'#a38c59',vegetationBase:'#a17f43',earthOchre:'#ccac77',water:'#93c1c9',snow:'#f2f3ef',inkStrength:.10,borderColor:0x99825a,borderOpacity:.17,skirtColor:0xa48b60,paintWeight:.98,hemiSky:0xfffcf4,hemiGround:0xd8cbb1,hemiIntensity:1.00,sunIntensity:.24},
        bailu: {name:'白露',terrainLow:'#d2bd79',terrainBase:'#8f9869',vegetationBase:'#718157',earthOchre:'#c9b183',water:'#a5c9cb',snow:'#f2f3ee',inkStrength:.10,borderColor:0x8d8d73,borderOpacity:.18,skirtColor:0x978763,paintWeight:.97,hemiSky:0xfffcf3,hemiGround:0xd2d4c3,hemiIntensity:1.0,sunIntensity:.24},
        lixia: {name:'立夏',terrainLow:'#c2c78b',terrainBase:'#71926a',vegetationBase:'#508358',earthOchre:'#c8b181',water:'#91c8bd',snow:'#f1f4ef',inkStrength:.10,borderColor:0x7c8c6b,borderOpacity:.18,skirtColor:0x918565,paintWeight:.97,hemiSky:0xfffcf4,hemiGround:0xcbd5c3,hemiIntensity:1.0,sunIntensity:.24},
        xiaoman: {name:'小满',terrainLow:'#c5cc87',terrainBase:'#6e9569',vegetationBase:'#568454',earthOchre:'#c9b283',water:'#b0cebf',snow:'#f3f4f0',inkStrength:.10,borderColor:0x7b8b6b,borderOpacity:.18,skirtColor:0x958967,paintWeight:.97,hemiSky:0xfffcf2,hemiGround:0xd0d6c5,hemiIntensity:1.00,sunIntensity:.25},
        xiaoshu: {name:'小暑',terrainLow:'#b6cb80',terrainBase:'#658a63',vegetationBase:'#487c52',earthOchre:'#c9b285',water:'#83bfc0',snow:'#f1f4ef',inkStrength:.11,borderColor:0x7b9072,borderOpacity:.18,skirtColor:0x918465,paintWeight:.97,hemiSky:0xfffcf4,hemiGround:0xcbd5c3,hemiIntensity:1.0,sunIntensity:.25},
        mangzhong: {name:'芒种',terrainLow:'#c8c68b',terrainBase:'#74936b',vegetationBase:'#588356',earthOchre:'#c9b07c',water:'#a5c9be',snow:'#f2f3ef',inkStrength:.10,borderColor:0x81866b,borderOpacity:.18,skirtColor:0x99865e,paintWeight:.97,hemiSky:0xfffcf4,hemiGround:0xcfd5c5,hemiIntensity:1.00,sunIntensity:.24},
        dashu: {
            name:'大暑',terrainLow:'#c0cc7a',terrainBase:'#6c9562',vegetationBase:'#468154',
            earthOchre:'#d1b57c',water:'#87c9c0',snow:'#f4f6f4',inkStrength:.10,
            borderColor:0x7c956e,borderOpacity:.17,skirtColor:0x98885e,paintWeight:.97,
            hemiSky:0xfffcf4,hemiGround:0xd1dac6,hemiIntensity:1.0,sunIntensity:.24
        },
        guyu: {name:'谷雨',terrainLow:'#b9c58b',terrainBase:'#6c8e6e',vegetationBase:'#588359',earthOchre:'#c0ad85',water:'#a8c8bc',snow:'#f0f1e8',inkStrength:.12,borderColor:0x7c896b,borderOpacity:.18,skirtColor:0x8f8b65,paintWeight:.96,hemiSky:0xfffcf4,hemiGround:0xc4ccbe,hemiIntensity:1.00,sunIntensity:.26},
        lichun: {
            name:'立春',terrainLow:'#b6c094',terrainBase:'#7a8c7b',terrainHigh:'#bac0bf',
            vegetationBase:'#69866b',earthOchre:'#c5b493',water:'#b0c9cb',snow:'#f0f1ed',
            snowLine:.91,inkStrength:.10,borderColor:0x7c8576,borderOpacity:.18,skirtColor:0x8f856c,
            paintWeight:.97,hemiSky:0xfffcf4,hemiGround:0xd6dbd4,hemiIntensity:1.00,sunIntensity:.22
        },
        qingming: {
            name:'清明',terrainLow:'#b8c694',terrainBase:'#748a7d',terrainHigh:'#b6bdbe',
            vegetationBase:'#6c9168',earthOchre:'#c8b797',water:'#b9d1ce',snow:'#f0f2ee',
            snowLine:.97,inkStrength:.18,borderColor:0x7e8975,borderOpacity:.19,skirtColor:0x948974
        },
        jingzhe: {
            name:'惊蛰', terrainLow:'#b9c18b', terrainBase:'#748875', vegetationBase:'#65825b',
            earthOchre:'#c9b48d', water:'#b9d1c8', snow:'#eef0e9', inkStrength:.20,
            borderColor:0x7b826b, borderOpacity:.20, skirtColor:0x7b7a62
        },
        yushui: {
            name:'雨水', terrainLow:'#b5c18e',terrainBase:'#738578',terrainHigh:'#b4babc',
            vegetationBase:'#65866a',earthOchre:'#c2b08c',water:'#b7cdca',snow:'#eef0ec',
            snowLine:.96,inkStrength:.20,borderColor:0x798571,borderOpacity:.22,skirtColor:0x827e62
        },
        chunfen: {
            name:'春分', terrainLow:'#b5c58a',terrainBase:'#718778',vegetationBase:'#638f62',
            earthOchre:'#c6b491',water:'#b6cec6',snow:'#edf0e8',inkStrength:.20,
            borderColor:0x7b8a6f,borderOpacity:.22,skirtColor:0x667564
        },
        xiazhi: {
            name:'夏至', paperCss:'#123f50', fogColor:0x123f50, fogNear:170, fogFar:380,
            terrainLow:'#bedc73', terrainBase:'#6b9b53', vegetationBase:'#327355', earthOchre:'#d8bc77',
            snow:'#f1f7f6', water:'#61c2c5', inkShadow:'#355e53', inkStrength:.20,
            borderColor:0xa6c8b0, borderOpacity:.13, skirtColor:0x9e8b59,
            sunColor:0xfff3d2, sunIntensity:.35, hemiSky:0xf5fbef, hemiGround:0xa7aa83, hemiIntensity:1.00
        },
        dongzhi: {
            name: '冬至',
            paperCss: '#082c40',
            fogColor: 0x082c40,
            fogNear: 150, fogFar: 350,
            terrainLow: '#d7e1e5',       // 东部平原：青绿转灰绿
            terrainBase: '#a1b1bf',      // 中部山地：青灰
            terrainHigh: '#a5ad9d',      // 青藏高原：灰青
            vegetationBase: '#497361',   // 南方：墨绿偏灰
            earthOchre: '#bcb08b',       // 西北：淡黄褐
            water: '#b2cad0',            // 水域：冷调淡蓝青
            snow: '#eef0e9',
            inkShadow: '#49565a',
            snowLine: 0.90,              // 雪线略降
            vegSouth: 0.40,
            aridWest: 0.44,
            inkStrength: 0.08, paintWeight: .99,
            terrainTint: [0.99, 1.0, 1.03],
            borderColor: 0x6a7670,
            borderOpacity: 0.12,
            skirtColor: 0xa07b45,
            highlight: { r: 0.55, g: 0.34, b: 0.30, a: 0.30 },
            sunColor: 0xf8fbff, sunIntensity: 0.23,
            hemiSky: 0xf7fbff, hemiGround: 0xd2dce3, hemiIntensity: 1.00
        }
        // lichun: {...}, yushui: {...}, ... dahan: {...}  ← 未来逐个添加
    };

    var TERM_KEYS = ['lichun', 'yushui', 'jingzhe', 'chunfen', 'qingming', 'guyu',
        'lixia', 'xiaoman', 'mangzhong', 'xiazhi', 'xiaoshu', 'dashu',
        'liqiu', 'chushu', 'bailu', 'qiufen', 'hanlu', 'shuangjiang',
        'lidong', 'xiaoxue', 'daxue', 'dongzhi', 'xiaohan', 'dahan'];
    var TERM_SEASON = {};
    (function () {
        var seasons = ['spring', 'summer', 'autumn', 'winter'];
        for (var i = 0; i < TERM_KEYS.length; i++) TERM_SEASON[TERM_KEYS[i]] = seasons[Math.floor(i / 6)];
    })();

    function getTheme(key) {
        var season = TERM_SEASON[key] || 'winter';
        var t = {};
        var k;
        for (k in INK_BASE) t[k] = INK_BASE[k];
        var lean = SEASON_LEAN[season];
        for (k in lean) t[k] = lean[k];
        var over = solarTermThemes[key];
        if (over) for (k in over) t[k] = over[k];
        t.terrainTint = {spring:[1.01,1.03,.94],summer:[.95,1.04,.98],autumn:[1.09,1.01,.85],winter:[.95,.99,1.02]}[season];
        if (key === 'dongzhi') t.terrainTint = [1.04, 1.03, 1.02];
        if (key === 'lixia') t.terrainTint = [1.02,1.03,1.00];
        if (key === 'xiaoshu') t.terrainTint = [1.02,1.03,1.00];
        if (key === 'xiazhi') t.terrainTint = [1.02, 1.04, .99];
        if (key === 'liqiu') t.terrainTint = [1.02,1.03,1.00];
        if (key === 'chushu') t.terrainTint = [1.02,1.03,1.00];
        if (key === 'hanlu') t.terrainTint = [1.03,1.02,1.00];
        if (key === 'lidong') t.terrainTint = [1.01,1.02,1.02];
        if (key === 'xiaoxue') t.terrainTint = [1.01,1.02,1.03];
        if (key === 'xiaohan') t.terrainTint = [1.02,1.03,1.05];
        if (key === 'dahan') t.terrainTint = [1.02,1.04,1.06];
        if (key === 'daxue') t.terrainTint = [1.02,1.03,1.05];
        if (key === 'shuangjiang') t.terrainTint = [1.02,1.02,1.01];
        if (key === 'qiufen') t.terrainTint = [1.03,1.02,.99];
        if (key === 'dashu') t.terrainTint = [1.02,1.03,1.00];
        if (key === 'chunfen') t.terrainTint = [1.02,1.03,.98];
        if (key === 'mangzhong') t.terrainTint = [1.03,1.02,.98];
        if (key === 'lichun') t.terrainTint = [1.02,1.02,1.00];
        if (key === 'yushui') t.terrainTint = [1.02,1.02,.99];
        if (key === 'qingming') t.terrainTint = [1.02,1.03,1.00];
        return t;
    }

    // ========== 由主题派生高程色带 ==========
    function buildRampColors(theme) {
        var low = new THREE.Color(theme.terrainLow);
        var base = new THREE.Color(theme.terrainBase);
        var high = new THREE.Color(theme.terrainHigh);
        var snow = new THREE.Color(theme.snow);
        var water = new THREE.Color(theme.water);
        return [
            water.clone().lerp(low, 0.74),      // 0 滨海 / 水网：淡蓝青转青绿
            low.clone(),                        // 1 东部平原：青绿
            low.clone().lerp(base, 0.78),       // 2 丘陵：青绿转青灰
            base.clone(),                       // 3 中部山地：青灰绿
            base.clone().lerp(high, 0.7),       // 4 高原边缘：青灰
            high.clone(),                       // 5 高原面：青灰（再叠浅土黄）
            snow.clone()                        // 6 雪线以上：冷白
        ];
    }

    function buildRampH(theme) {
        var f = theme.snowLine || 1;
        return RAMP_H.map(function (h) { return h > 2500 ? h * f : h; });
    }

    // ========== 青绿水墨地形材质 ==========
    // 不动几何、不动 DEM：贴图只作为"墨韵明暗"，颜色由主题色带在着色器里实时生成。
    var INK_VERT_HEAD =
        'varying float vElevM;\n' +
        'varying vec2 vInkUv;\n' +
        'uniform float uElevScale;\n';

    var INK_FRAG_HEAD =
        'varying float vElevM;\n' +
        'varying vec2 vInkUv;\n' +
        'uniform vec3 uRamp[7];\n' +
        'uniform float uRampH[7];\n' +
        'uniform vec3 uVeg;\n' +
        'uniform vec3 uOchre;\n' +
        'uniform vec3 uInk;\n' +
        'uniform float uVegW;\n' +
        'uniform float uAridW;\n' +
        'uniform float uInkW;\n' +
        'uniform vec3 uTint;\n' +
        'uniform sampler2D uPaint;\n' +
        'uniform float uPaintWeight;\n' +
        'uniform vec4 uBounds;\n' +    // x=lon0 y=lat0 z=lonSpan w=latSpan
        'vec3 inkRamp(float h){\n' +
        '  vec3 c = uRamp[0];\n' +
        '  for (int i = 1; i < 7; i++) {\n' +
        '    float t = clamp((h - uRampH[i - 1]) / max(uRampH[i] - uRampH[i - 1], 1.0), 0.0, 1.0);\n' +
        '    c = mix(c, uRamp[i], t);\n' +
        '  }\n' +
        '  return c;\n' +
        '}\n';

    var INK_FRAG_BODY =
        '#ifdef USE_MAP\n' +
        '  vec4 inkTexel = texture2D( map, vInkUv );\n' +
        '  diffuseColor.a *= inkTexel.a;\n' +
        '  float inkLum = dot( inkTexel.rgb, vec3( 0.299, 0.587, 0.114 ) );\n' +
        '#else\n' +
        '  float inkLum = 0.82;\n' +
        '#endif\n' +
        'float hM = vElevM;\n' +
        'vec3 col = inkRamp( hM );\n' +
        'float lon = uBounds.x + vInkUv.x * uBounds.z;\n' +
        'float lat = uBounds.y + vInkUv.y * uBounds.w;\n' +
        'float lowMask = 1.0 - smoothstep( 1200.0, 2800.0, hM );\n' +
        // 南方：纬度低 + 偏东 → 墨绿更浓
        'float south = clamp( (31.0 - lat) / 12.0, 0.0, 1.0 ) * clamp( (lon - 98.0) / 14.0, 0.0, 1.0 ) * lowMask;\n' +
        // 西北：偏西 + 偏北 → 淡黄褐 / 土色；北方针叶草原带另加一点土色
        'float aridW = clamp( (108.0 - lon) / 22.0, 0.0, 1.0 ) * clamp( (lat - 28.0) / 16.0, 0.0, 1.0 );\n' +
        'float aridN = clamp( (lat - 38.0) / 14.0, 0.0, 1.0 ) * 0.22;\n' +
        'float arid = clamp( aridW + aridN, 0.0, 1.0 ) * lowMask;\n' +
        // 高原裸地：浅土黄
        'float highMask = smoothstep( 2600.0, 4300.0, hM );\n' +
        'col = mix( col, uVeg, south * uVegW );\n' +
        'col = mix( col, uOchre, arid * uAridW * 1.6 );\n' +
        'col = mix( col, uOchre, highMask * 0.20 );\n' +
        // 墨色明暗：阴影处偏青墨而非纯黑，亮部不带高光
        'float sh = smoothstep( 0.42, 0.92, inkLum );\n' +
        'vec3 pigment = texture2D(uPaint, vec2((lon-73.0)/62.5,(lat-17.5)/36.5)).rgb;\n' +
        'col = mix(col, pigment, uPaintWeight);\n' +
        'col *= mix( 0.86, 1.06, sh );\n' +
        'float shd = smoothstep( 0.35, 0.85, inkLum );\n' +
        'col = mix( col, uInk, (1.0 - shd) * uInkW * 0.45 );\n' +
        'diffuseColor.rgb = col * uTint;\n';

    function makeInkTerrainMaterial(tex, theme, bounds) {
        var uniforms = {
            uRamp: { value: buildRampColors(theme) },
            uRampH: { value: buildRampH(theme) },
            uVeg: { value: new THREE.Color(theme.vegetationBase) },
            uOchre: { value: new THREE.Color(theme.earthOchre) },
            uInk: { value: new THREE.Color(theme.inkShadow) },
            uVegW: { value: theme.vegSouth },
            uAridW: { value: theme.aridWest },
            uInkW: { value: theme.inkStrength },
            uTint: { value: new THREE.Vector3(theme.terrainTint[0], theme.terrainTint[1], theme.terrainTint[2]) },
            uBounds: { value: new THREE.Vector4(bounds.w, bounds.s, bounds.e - bounds.w, bounds.n - bounds.s) },
            uPaint: { value: activePaintTexture() },
            uPaintWeight: { value: theme.paintWeight || .86 },
            uElevScale: { value: 1 / Z_SCALE }
        };
        var mat = new THREE.MeshLambertMaterial({
            map: tex, alphaTest: 0.35, side: THREE.FrontSide
        });
        mat.onBeforeCompile = function (shader) {
            Object.keys(uniforms).forEach(function (k) { shader.uniforms[k] = uniforms[k]; });
            shader.vertexShader = shader.vertexShader
                .replace('#include <common>', '#include <common>\n' + INK_VERT_HEAD)
                .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vInkUv = uv;\n  vElevM = position.z * uElevScale;');
            shader.fragmentShader = shader.fragmentShader
                .replace('#include <common>', '#include <common>\n' + INK_FRAG_HEAD)
                .replace('#include <map_fragment>', INK_FRAG_BODY);
        };
        mat.customProgramCacheKey = function () { return 'ink-terrain-v1'; };
        mat.userData.ink = uniforms;
        return mat;
    }

    function updateInkUniforms(mat, theme) {
        if (!mat || !mat.userData || !mat.userData.ink) return;
        var u = mat.userData.ink;
        var ramp = buildRampColors(theme);
        for (var i = 0; i < 7; i++) u.uRamp.value[i].copy(ramp[i]);
        var hs = buildRampH(theme);
        for (var j = 0; j < 7; j++) u.uRampH.value[j] = hs[j];
        u.uVeg.value.set(theme.vegetationBase);
        u.uOchre.value.set(theme.earthOchre);
        u.uInk.value.set(theme.inkShadow);
        u.uVegW.value = theme.vegSouth;
        u.uAridW.value = theme.aridWest;
        u.uInkW.value = theme.inkStrength;
        u.uTint.value.set(theme.terrainTint[0], theme.terrainTint[1], theme.terrainTint[2]);
        u.uPaint.value = activePaintTexture();
        u.uPaintWeight.value = theme.paintWeight || .86;
    }

    // ========== 状态 ==========
    var container = null;
    var renderer = null, scene = null, camera = null;
    var hemi = null, sun = null;
    var mapGroup = null;
    var terrainMat = null;
    var terrainMesh = null;
    var borderMat = null, skirtMat = null;
    var elevation = null, elevW = 0, elevH = 0;
    var reliefImg = null;
    var nationalTexture = null;
    var paintTexture = null;
    var winterTexture = null;
    var summerTexture = null;
    var springTexture = null;
    var jingzheTexture = null;
    var rainTexture = null;
    var qingmingTexture=null;
    var lichunTexture=null;
    var xiaomanTexture=null, xiaomanAtlasImage=null;
    var guyuTexture=null;
    var dashuTexture=null;
    var mangzhongTexture=null;
    var xiaoshuTexture=null;
    var lixiaTexture=null,lixiaAtlasImage=null;
    var bailuTexture=null,bailuAtlasImage=null;
    var qiufenTexture=null,qiufenAtlasImage=null;
    var liqiuTexture=null,liqiuAtlasImage=null;
    var chushuTexture=null,chushuAtlasImage=null;
    var hanluTexture=null,hanluAtlasImage=null;
    var shuangjiangTexture=null,shuangjiangAtlasImage=null;
    var lidongTexture=null,lidongAtlasImage=null;
    var xiaoxueTexture=null,xiaoxueAtlasImage=null;
    var daxueTexture=null,daxueAtlasImage=null;
    var xiaohanTexture=null,xiaohanAtlasImage=null;
    var dahanTexture=null,dahanAtlasImage=null;
    function activePaintTexture() {
        if(currentTermKey==='dahan' && dahanTexture)return dahanTexture;
        if(currentTermKey==='xiaohan' && xiaohanTexture)return xiaohanTexture;
        if(currentTermKey==='daxue' && daxueTexture)return daxueTexture;
        if(currentTermKey==='xiaoxue' && xiaoxueTexture)return xiaoxueTexture;
        if(currentTermKey==='lidong' && lidongTexture)return lidongTexture;
        if(currentTermKey==='shuangjiang' && shuangjiangTexture)return shuangjiangTexture;
        if(currentTermKey==='hanlu' && hanluTexture)return hanluTexture;
        if(currentTermKey==='chushu' && chushuTexture)return chushuTexture;
        if(currentTermKey==='liqiu' && liqiuTexture)return liqiuTexture;
        if(currentTermKey==='qiufen' && qiufenTexture)return qiufenTexture;
        if(currentTermKey==='bailu' && bailuTexture)return bailuTexture;
        if(currentTermKey==='lixia' && lixiaTexture)return lixiaTexture;
        if(currentTermKey==='xiaoman' && xiaomanTexture)return xiaomanTexture;
        if(currentTermKey==='xiaoshu' && xiaoshuTexture)return xiaoshuTexture;
        if(currentTermKey==='mangzhong' && mangzhongTexture)return mangzhongTexture;
        if(currentTermKey==='dashu' && dashuTexture)return dashuTexture;
        if(currentTermKey==='guyu' && guyuTexture)return guyuTexture;
        if(currentTermKey==='lichun' && lichunTexture)return lichunTexture;
        if(currentTermKey==='qingming' && qingmingTexture)return qingmingTexture;
        if(currentTermKey==='yushui' && rainTexture)return rainTexture;
        if(currentTermKey==='dongzhi' && winterTexture)return winterTexture;
        if(currentTermKey==='xiazhi' && summerTexture)return summerTexture;
        if(currentTermKey==='chunfen' && springTexture)return springTexture;
        if(currentTermKey==='jingzhe' && jingzheTexture)return jingzheTexture;
        return paintTexture;
    }
    var seaTexture = null;
    var seaMat = null;
    var highlightCanvas = null, highlightCtx = null, highlightTexture = null;
    var prepared = [];
    var view = null;             // 当前视图 {bounds, centerX, centerY, worldW, worldH}
    var currentLevel = null;
    var ready = false;
    var inited = false;
    var currentTheme = null;
    var currentTermKey = 'dongzhi';

    var callbacks = { single: null, double: null, tooltip: null };
    var provinceTooltip=null;
    var raycaster = null, pointerNDC = null;
    var hoverName = null;
    var clickTimer = null;

    // 相机轨道状态（目标值 + 当前值，逐帧插值）
    var camGoal = { radius: 150, theta: 0, phi: 0.92, tx: 0, ty: 0, tz: 1.0 };
    var camCur = { radius: 175, theta: 0, phi: 1.12, tx: 0, ty: 0, tz: 1.0 };
    var riseStart = 0;

    var dragState = null;
    var hoverPending = false;
    var tracked = [];            // 需要释放的 geometry/material/texture

    // ========== 对外接口 ==========
    window.Terrain3D = {
        init: init,
        showNational: showNational,
        showProvince: showProvince,
        setSolarTerm: setSolarTerm,
        setSeason: setSeason,
        setView: setView,
        zoom: function(factor) { camGoal.radius = Math.max(8,Math.min(240,camGoal.radius*factor)); },
        setCropsVisible: function(show) { cropsVisible=show;rebuildCrops(); },
        project: function(lon,lat) {
            var p=lonLatToWorld(lon,lat),v=new THREE.Vector3(p[0],p[1],sampleElevation(lon,lat)*Z_SCALE);
            v.project(camera);return {x:(v.x+1)/2*container.clientWidth,y:(1-v.y)/2*container.clientHeight};
        },
        sampleElevation: sampleElevation,
        get landscapeState() { return {term:currentTermKey, dahanVisible:!!dahanGroup, xiaohanVisible:!!xiaohanGroup, daxueVisible:!!daxueGroup, xiaoxueVisible:!!xiaoxueGroup, lidongVisible:!!lidongGroup, shuangjiangVisible:!!shuangjiangGroup, hanluVisible:!!hanluGroup, chushuVisible:!!chushuGroup, liqiuVisible:!!liqiuGroup, qiufenVisible:!!qiufenGroup, bailuVisible:!!bailuGroup, lixiaVisible:!!lixiaGroup, xiaomanVisible:!!xiaomanGroup, xiaoshuVisible:!!xiaoshuGroup, mangzhongVisible:!!mangzhongGroup, dashuVisible:!!dashuGroup, guyuVisible:!!guyuGroup, lichunVisible:!!lichunGroup, winterVisible:!!winterGroup, summerVisible:!!summerGroup, springVisible:!!springGroup, rainVisible:!!rainGroup, jingzheVisible:!!jingzheGroup, qingmingVisible:!!qingmingGroup, counts:dahanGroup ? dahanGroup.userData.counts : xiaohanGroup ? xiaohanGroup.userData.counts : daxueGroup ? daxueGroup.userData.counts : xiaoxueGroup ? xiaoxueGroup.userData.counts : lidongGroup ? lidongGroup.userData.counts : shuangjiangGroup ? shuangjiangGroup.userData.counts : hanluGroup ? hanluGroup.userData.counts : chushuGroup ? chushuGroup.userData.counts : liqiuGroup ? liqiuGroup.userData.counts : qiufenGroup ? qiufenGroup.userData.counts : bailuGroup ? bailuGroup.userData.counts : lixiaGroup ? lixiaGroup.userData.counts : xiaomanGroup ? xiaomanGroup.userData.counts : xiaoshuGroup ? xiaoshuGroup.userData.counts : mangzhongGroup ? mangzhongGroup.userData.counts : dashuGroup ? dashuGroup.userData.counts : guyuGroup ? guyuGroup.userData.counts : lichunGroup ? lichunGroup.userData.counts : qingmingGroup ? qingmingGroup.userData.counts : winterGroup ? winterGroup.userData.counts : summerGroup ? summerGroup.userData.counts : springGroup ? springGroup.userData.counts : rainGroup ? rainGroup.userData.counts : jingzheGroup ? jingzheGroup.userData.counts : null}; },
        resize: resize,
        get isReady() { return ready; }
    };

    // ========== 初始化 ==========
    function init(containerEl, cbs) {
        if (inited) return Promise.resolve();
        container = containerEl;
        if (cbs) callbacks = cbs;

        try {
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        } catch (e) {
            return Promise.reject(e);
        }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(container.clientWidth || 800, container.clientHeight || 500);
        renderer.domElement.style.display = 'block';
        renderer.domElement.style.touchAction = 'none';
        container.appendChild(renderer.domElement);

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(FOV, (container.clientWidth || 800) / (container.clientHeight || 500), 0.5, 600);
        camera.up.set(0, 0, 1);

        // 光照：刻意压低的柔和光（墨色明暗由着色器负责，灯光只做轻微立体修正）
        hemi = new THREE.HemisphereLight(0xf7f2e6, 0x8a8a78, 0.62);
        sun = new THREE.DirectionalLight(0xfff8ec, 0.26);
        sun.position.set(-70, 60, 90);
        scene.add(hemi);
        scene.add(sun);

        mapGroup = new THREE.Group();
        scene.add(mapGroup);

        raycaster = new THREE.Raycaster();
        pointerNDC = new THREE.Vector2();

        // 高亮覆盖层画布
        highlightCanvas = document.createElement('canvas');
        highlightCanvas.width = HCW;
        highlightCanvas.height = HCH;
        highlightCtx = highlightCanvas.getContext('2d');
        highlightTexture = new THREE.CanvasTexture(highlightCanvas);

        // 提示框
        var tip = document.createElement('div');
        tip.id = 'terrainTooltip';
        tip.style.cssText = 'position:absolute;display:none;z-index:20;pointer-events:none;' +
            'background:rgba(250,247,238,0.95);border:1px solid #8a8577;border-radius:3px;' +
            'box-shadow:0 3px 12px rgba(60,60,50,0.22);padding:2px 4px;max-width:260px;';
        container.appendChild(tip);

        bindEvents();
        wireButtons();
        observeResize();
        applyTheme(getTheme('dongzhi'));

        // 以国界裁出内置地形；全国与市级视图复用同一坐标系。
        // file:// 的外部 PNG 在普通浏览器中不是 origin-clean；图片能显示，
        // 却不能交给 texSubImage2D。内嵌 data URL 在文件和 HTTP 两种入口均可用。
        return Promise.all([
            loadImage(window.INK_TERRAIN_PAINT || 'assets/ink-terrain-paint.png'),
            loadImage(window.DONGZHI_TERRAIN_PAINT || window.INK_TERRAIN_PAINT),
            loadImage(window.XIAZHI_TERRAIN_PAINT || window.INK_TERRAIN_PAINT),
            loadImage(window.XIAZHI_PROP_PAINT || window.INK_TERRAIN_PAINT),
            loadImage(window.CHUNFEN_TERRAIN_PAINT || window.INK_TERRAIN_PAINT),
            loadImage(window.CHUNFEN_PROP_PAINT || window.INK_TERRAIN_PAINT),
            loadImage(window.YUSHUI_TERRAIN_PAINT || window.INK_TERRAIN_PAINT),
            loadImage(window.YUSHUI_PROP_PAINT || window.INK_TERRAIN_PAINT),
            loadImage(window.JINGZHE_TERRAIN_PAINT || window.INK_TERRAIN_PAINT),
            loadImage(window.JINGZHE_PROP_PAINT || window.INK_TERRAIN_PAINT),
            loadImage(window.QINGMING_TERRAIN_PAINT || window.INK_TERRAIN_PAINT),
            loadImage(window.QINGMING_PROP_PAINT || window.INK_TERRAIN_PAINT),
            loadImage(window.LICHUN_TERRAIN_PAINT || window.INK_TERRAIN_PAINT),
            loadImage(window.LICHUN_PROP_PAINT || window.INK_TERRAIN_PAINT),
            loadImage(window.GUYU_TERRAIN_PAINT || window.INK_TERRAIN_PAINT),
            loadImage(window.GUYU_PROP_PAINT || window.INK_TERRAIN_PAINT),
            loadImage(window.DASHU_TERRAIN_PAINT || window.INK_TERRAIN_PAINT),
            loadImage(window.DASHU_PROP_PAINT || window.INK_TERRAIN_PAINT),
            loadImage(window.MANGZHONG_TERRAIN_PAINT || window.INK_TERRAIN_PAINT),
            loadImage(window.MANGZHONG_PROP_PAINT || window.INK_TERRAIN_PAINT),
            loadImage(window.XIAOSHU_TERRAIN_PAINT || window.INK_TERRAIN_PAINT),
            loadImage(window.XIAOSHU_PROP_PAINT || window.INK_TERRAIN_PAINT),
            loadImage(window.LIXIA_TERRAIN_PAINT || window.INK_TERRAIN_PAINT).then(function(image){lixiaTexture=makeTexture(image);return image;}),
            loadImage(window.LIXIA_PROP_PAINT || window.INK_TERRAIN_PAINT).then(function(image){lixiaAtlasImage=image;return image;})
            ,loadImage(window.XIAOMAN_TERRAIN_PAINT || window.INK_TERRAIN_PAINT).then(function(image){xiaomanTexture=makeTexture(image);return image;})
            ,loadImage(window.XIAOMAN_PROP_PAINT || window.INK_TERRAIN_PAINT).then(function(image){xiaomanAtlasImage=image;return image;})
            ,loadImage(window.BAILU_TERRAIN_PAINT || window.INK_TERRAIN_PAINT).then(function(image){bailuTexture=makeTexture(image);return image;})
            ,loadImage(window.BAILU_PROP_PAINT || window.INK_TERRAIN_PAINT).then(function(image){bailuAtlasImage=image;return image;})
            ,loadImage(window.QIUFEN_TERRAIN_PAINT || window.INK_TERRAIN_PAINT).then(function(image){qiufenTexture=makeTexture(image);return image;})
            ,loadImage(window.QIUFEN_PROP_PAINT || window.INK_TERRAIN_PAINT).then(function(image){qiufenAtlasImage=image;return image;})
            ,loadImage(window.LIQIU_TERRAIN_PAINT || window.INK_TERRAIN_PAINT).then(function(image){liqiuTexture=makeTexture(image);return image;})
            ,loadImage(window.LIQIU_PROP_PAINT || window.INK_TERRAIN_PAINT).then(function(image){liqiuAtlasImage=image;return image;})
            ,loadImage(window.CHUSHU_TERRAIN_PAINT || window.INK_TERRAIN_PAINT).then(function(image){chushuTexture=makeTexture(image);return image;})
            ,loadImage(window.CHUSHU_PROP_PAINT || window.INK_TERRAIN_PAINT).then(function(image){chushuAtlasImage=image;return image;})
            ,loadImage(window.HANLU_TERRAIN_PAINT || window.INK_TERRAIN_PAINT).then(function(image){hanluTexture=makeTexture(image);return image;})
            ,loadImage(window.HANLU_PROP_PAINT || window.INK_TERRAIN_PAINT).then(function(image){hanluAtlasImage=image;return image;})
            ,loadImage(window.SHUANGJIANG_TERRAIN_PAINT || window.INK_TERRAIN_PAINT).then(function(image){shuangjiangTexture=makeTexture(image);return image;})
            ,loadImage(window.SHUANGJIANG_PROP_PAINT || window.INK_TERRAIN_PAINT).then(function(image){shuangjiangAtlasImage=image;return image;})
            ,loadImage(window.LIDONG_TERRAIN_PAINT || window.INK_TERRAIN_PAINT).then(function(image){lidongTexture=makeTexture(image);return image;})
            ,loadImage(window.LIDONG_PROP_PAINT || window.INK_TERRAIN_PAINT).then(function(image){lidongAtlasImage=image;return image;})
            ,loadImage(window.XIAOXUE_TERRAIN_PAINT || window.INK_TERRAIN_PAINT).then(function(image){xiaoxueTexture=makeTexture(image);return image;})
            ,loadImage(window.XIAOXUE_PROP_PAINT || window.INK_TERRAIN_PAINT).then(function(image){xiaoxueAtlasImage=image;return image;})
            ,loadImage(window.DAXUE_TERRAIN_PAINT || window.INK_TERRAIN_PAINT).then(function(image){daxueTexture=makeTexture(image);return image;})
            ,loadImage(window.DAXUE_PROP_PAINT || window.INK_TERRAIN_PAINT).then(function(image){daxueAtlasImage=image;return image;})
            ,loadImage(window.XIAOHAN_TERRAIN_PAINT || window.INK_TERRAIN_PAINT).then(function(image){xiaohanTexture=makeTexture(image);return image;})
            ,loadImage(window.XIAOHAN_PROP_PAINT || window.INK_TERRAIN_PAINT).then(function(image){xiaohanAtlasImage=image;return image;})
            ,loadImage(window.DAHAN_TERRAIN_PAINT || window.INK_TERRAIN_PAINT).then(function(image){dahanTexture=makeTexture(image);return image;})
            ,loadImage(window.DAHAN_PROP_PAINT || window.INK_TERRAIN_PAINT).then(function(image){dahanAtlasImage=image;return image;})
            ,loadImage(window.DONGZHI_PROP_PAINT || window.INK_TERRAIN_PAINT).then(function(image){if(window.DONGZHI_PROP_PAINT && window.DongzhiLandscape) DongzhiLandscape.useAtlas(image);return image;})
        ]).then(function (images) {
            if(window.DAHAN_PROP_PAINT && window.DahanLandscape) DahanLandscape.useAtlas(dahanAtlasImage);
            if(window.XIAOHAN_PROP_PAINT && window.XiaohanLandscape) XiaohanLandscape.useAtlas(xiaohanAtlasImage);
            if(window.DAXUE_PROP_PAINT && window.DaxueLandscape) DaxueLandscape.useAtlas(daxueAtlasImage);
            if(window.XIAOXUE_PROP_PAINT && window.XiaoxueLandscape) XiaoxueLandscape.useAtlas(xiaoxueAtlasImage,images[3]);
            if(window.LIDONG_PROP_PAINT && window.LidongLandscape) LidongLandscape.useAtlas(lidongAtlasImage,images[3]);
            if(window.SHUANGJIANG_PROP_PAINT && window.ShuangjiangLandscape) ShuangjiangLandscape.useAtlas(shuangjiangAtlasImage,images[3]);
            if(window.HANLU_PROP_PAINT && window.HanluLandscape) HanluLandscape.useAtlas(hanluAtlasImage,images[3]);
            if(window.CHUSHU_PROP_PAINT && window.ChushuLandscape) ChushuLandscape.useAtlas(chushuAtlasImage,images[3]);
            if(window.LIQIU_PROP_PAINT && window.LiqiuLandscape) LiqiuLandscape.useAtlas(liqiuAtlasImage,images[3]);
            if(window.QIUFEN_PROP_PAINT && window.QiufenLandscape) QiufenLandscape.useAtlas(qiufenAtlasImage,images[3]);
            if(window.BAILU_PROP_PAINT && window.BailuLandscape) BailuLandscape.useAtlas(bailuAtlasImage,images[3]);
            if(window.LIXIA_PROP_PAINT && window.LixiaLandscape) LixiaLandscape.useAtlas(lixiaAtlasImage,images[3],images[9],images[17]);
            if(window.XIAOMAN_PROP_PAINT && window.XiaomanLandscape) XiaomanLandscape.useAtlas(xiaomanAtlasImage,images[3],images[9]);
            xiaoshuTexture=makeTexture(images[20]);
            if(window.XIAOSHU_PROP_PAINT && window.XiaoshuLandscape) XiaoshuLandscape.useAtlas(images[21],images[3]);
            dashuTexture=makeTexture(images[16]);
            if(window.DASHU_PROP_PAINT && window.DashuLandscape) DashuLandscape.useAtlas(images[17],images[3]);
            qingmingTexture = makeTexture(images[10]);
            if(window.QINGMING_PROP_PAINT && window.QingmingLandscape) QingmingLandscape.useAtlas(images[11],images[5],images[3]);
            lichunTexture = makeTexture(images[12]);
            if(window.LICHUN_PROP_PAINT && window.LichunLandscape) LichunLandscape.useAtlas(images[13],images[5],images[3]);
            guyuTexture=makeTexture(images[14]);
            if(window.GUYU_PROP_PAINT && window.GuyuLandscape) GuyuLandscape.useAtlas(images[15],images[3],images[9]);
            mangzhongTexture=makeTexture(images[18]);
            if(window.MANGZHONG_PROP_PAINT && window.MangzhongLandscape) MangzhongLandscape.useAtlas(images[19],images[3],images[9]);
            paintTexture = makeTexture(images[0]);
            winterTexture = makeTexture(images[1]);
            summerTexture = makeTexture(images[2]);
            if(window.XIAZHI_PROP_PAINT && window.XiazhiLandscape) XiazhiLandscape.useAtlas(images[3]);
            springTexture = makeTexture(images[4]);
            if(window.CHUNFEN_PROP_PAINT && window.ChunfenLandscape) ChunfenLandscape.useAtlas(images[5],images[3]);
            rainTexture = makeTexture(images[6]);
            if(window.YUSHUI_PROP_PAINT && window.YushuiLandscape) YushuiLandscape.useAtlas(images[7],images[5],images[3]);
            jingzheTexture = makeTexture(images[8]);
            if(window.JINGZHE_PROP_PAINT && window.JingzheLandscape) JingzheLandscape.useAtlas(images[9],images[3]);
            return new Promise(function(resolve, reject) {
            requestAnimationFrame(function() {
                try {
                    reliefImg = TerrainModel.build(window.CHINA_GEOJSON.features);
                    nationalTexture = makeTexture(new THREE.CanvasTexture(reliefImg));
                    elevW = 620; elevH = 362;
                    elevation = new Float32Array(elevW * elevH);
                    for(var y=0;y<elevH;y++) for(var x=0;x<elevW;x++) {
                        elevation[y*elevW+x] = TerrainModel.sample(NATIONAL_BOUNDS.w+x/(elevW-1)*LON_SPAN,
                            NATIONAL_BOUNDS.n-y/(elevH-1)*LAT_SPAN);
                    }
                    inited=true;ready=true;animate();resolve();
                } catch(e) { reject(e); }
            });
            });
        });
    }

    // 海面：高程图 A 通道是陆地掩膜，取反即"淡蓝青"水域范围
    function buildSeaMask(img) {
        var cv = document.createElement('canvas');
        cv.width = img.width;
        cv.height = img.height;
        var ctx = cv.getContext('2d');
        ctx.drawImage(img, 0, 0);
        var id = ctx.getImageData(0, 0, cv.width, cv.height);
        var d = id.data;
        for (var i = 0; i < d.length; i += 4) {
            d[i] = 255; d[i + 1] = 255; d[i + 2] = 255;
            d[i + 3] = 255 - d[i + 3];
        }
        ctx.putImageData(id, 0, 0);
        return cv;
    }

    // ========== 主题应用 ==========
    function applyTheme(theme) {
        currentTheme = theme;
        if (renderer) renderer.setClearColor(theme.fogColor, 0);
        if (scene) {
            if (!scene.fog) scene.fog = new THREE.Fog(theme.fogColor, theme.fogNear, theme.fogFar);
            else {
                scene.fog.color.setHex(theme.fogColor);
                scene.fog.near = theme.fogNear;
                scene.fog.far = theme.fogFar;
            }
        }
        if (sun) { sun.color.setHex(theme.sunColor); sun.intensity = theme.sunIntensity; }
        if (hemi) {
            hemi.color.setHex(theme.hemiSky);
            hemi.groundColor.setHex(theme.hemiGround);
            hemi.intensity = theme.hemiIntensity;
        }
        if (terrainMat) updateInkUniforms(terrainMat, theme);
        if (seaMat) seaMat.color.set(theme.water);
        if (borderMat) { borderMat.color.setHex(theme.borderColor); borderMat.opacity = theme.borderOpacity; }
        if (skirtMat) skirtMat.color.setHex(theme.skirtColor);
        // 同步宣纸底色给页面 CSS（HTML 端用 var(--paper) 引用）
        if (typeof document !== 'undefined') {
            document.documentElement.style.setProperty('--paper', theme.paperCss);
        }
    }

    function setSolarTerm(key) {
        currentTermKey = TERM_KEYS.indexOf(key) >= 0 ? key : 'dongzhi';
        applyTheme(getTheme(currentTermKey));
        rebuildCrops();
        rebuildWinterLandscape();
        rebuildSummerLandscape();
        rebuildSpringLandscape();
        rebuildJingzheLandscape();
        rebuildRainLandscape();
        rebuildLichunLandscape();
        rebuildBailuLandscape();
        rebuildLixiaLandscape();
        rebuildXiaoshuLandscape();
        rebuildGuyuLandscape();
        rebuildXiaomanLandscape();
        rebuildMangzhongLandscape();
        rebuildDashuLandscape();
        rebuildQiufenLandscape();
        rebuildHanluLandscape();
        rebuildChushuLandscape();
        rebuildShuangjiangLandscape();
        rebuildDaxueLandscape();
        rebuildDahanLandscape();
        rebuildXiaohanLandscape();
        rebuildXiaoxueLandscape();
        rebuildLidongLandscape();
        rebuildLiqiuLandscape();
        rebuildQingmingLandscape();
    }

    function setSeason(season) {
        var map = { spring: 'lichun', summer: 'lixia', autumn: 'liqiu', winter: 'dongzhi' };
        setSolarTerm(map[season] || 'dongzhi');
    }

    function loadImage(src) {
        return new Promise(function (resolve, reject) {
            var img = new Image();
            // HTTP images must remain origin-clean when uploaded to WebGL.
            // Skip embedded artwork to preserve the offline file:// entry.
            if (typeof src === 'string' && !/^(?:data|blob):/i.test(src)) {
                var imageUrl = new URL(src, document.baseURI);
                if (/^https?:$/.test(imageUrl.protocol)) img.crossOrigin = 'anonymous';
            }
            img.onload = function () { resolve(img); };
            img.onerror = function () { reject(new Error('地形贴图加载失败')); };
            img.src = src;
        });
    }

    function decodeHeight(img) {
        // 降采样到 720×420：浏览器双线性缩小天然滤掉高频 DEM 噪声
        var DW = 720, DH = 420;
        var cv = document.createElement('canvas');
        cv.width = DW;
        cv.height = DH;
        var ctx = cv.getContext('2d');
        ctx.drawImage(img, 0, 0, DW, DH);
        var data = ctx.getImageData(0, 0, DW, DH).data;
        elevW = DW;
        elevH = DH;
        elevation = new Float32Array(DW * DH);
        for (var i = 0, n = DW * DH; i < n; i++) {
            elevation[i] = ((data[i * 4] * 256 + data[i * 4 + 1]) / 65535) * ELEV_RANGE;
        }
        smoothElevation();
    }

    // 3×3 盒式滤波 ×2 ≈ 高斯平滑：宏观地形保留，局部尖刺柔和
    function smoothElevation() {
        var w = elevW, h = elevH, n = w * h;
        var tmp = new Float32Array(n), out = new Float32Array(n);
        var src, dst, pass, y, x, i;
        for (pass = 0; pass < 2; pass++) {
            src = pass === 0 ? elevation : out;
            // 水平
            for (y = 0; y < h; y++) {
                for (x = 0; x < w; x++) {
                    i = y * w + x;
                    var l = src[y * w + Math.max(x - 1, 0)];
                    var r = src[y * w + Math.min(x + 1, w - 1)];
                    tmp[i] = (l + src[i] * 2 + r) * 0.25;
                }
            }
            // 垂直
            for (y = 0; y < h; y++) {
                var u = Math.max(y - 1, 0) * w, d = Math.min(y + 1, h - 1) * w;
                for (x = 0; x < w; x++) {
                    i = y * w + x;
                    out[i] = (tmp[u + x] + tmp[i] * 2 + tmp[d + x]) * 0.25;
                }
            }
        }
        elevation.set(out);
    }

    function makeTexture(source) {
        var tex = source.isTexture ? source : new THREE.Texture(source);
        tex.needsUpdate = true;
        var maxAniso = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1;
        tex.anisotropy = Math.min(8, maxAniso);
        if (renderer.capabilities.isWebGL2) {
            tex.minFilter = THREE.LinearMipmapLinearFilter;
        } else {
            tex.minFilter = THREE.LinearFilter;
            tex.generateMipmaps = false;
        }
        return tex;
    }

    // ========== 坐标换算 ==========
    function lonLatToWorld(lon, lat) {
        var b = view.bounds;
        var x = (lon - b.w) / (b.e - b.w) * view.worldW - view.worldW / 2 + view.centerX;
        var y = (lat - b.s) / (b.n - b.s) * view.worldH - view.worldH / 2 + view.centerY;
        return [x, y];
    }

    function worldToLonLat(x, y) {
        var b = view.bounds;
        var u = (x - view.centerX) / view.worldW + 0.5;   // 0 西 → 1 东
        var v = (y - view.centerY) / view.worldH + 0.5;   // 0 南 → 1 北
        return [b.w + u * (b.e - b.w), b.s + v * (b.n - b.s)];
    }

    function sampleElevation(lon, lat) {
        if (!elevation) return 0;
        var gx = (lon - NATIONAL_BOUNDS.w) / LON_SPAN * (elevW - 1);
        var gy = (NATIONAL_BOUNDS.n - lat) / LAT_SPAN * (elevH - 1);
        if (gx < 0 || gy < 0 || gx > elevW - 1 || gy > elevH - 1) return 0;
        var x0 = Math.floor(gx), y0 = Math.floor(gy);
        var x1 = Math.min(x0 + 1, elevW - 1), y1 = Math.min(y0 + 1, elevH - 1);
        var fx = gx - x0, fy = gy - y0;
        var a = elevation[y0 * elevW + x0], b = elevation[y0 * elevW + x1];
        var c = elevation[y1 * elevW + x0], d = elevation[y1 * elevW + x1];
        return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
    }

    // ========== GeoJSON 处理 ==========
    function prepareFeatures(features) {
        return (features || []).filter(function (f) { return f && f.geometry; }).map(function (f) {
            var polys = [];
            var g = f.geometry;
            if (g.type === 'Polygon') polys.push(g.coordinates);
            else if (g.type === 'MultiPolygon') polys = polys.concat(g.coordinates);
            return {
                name: (f.properties && (f.properties.name || f.properties.fullname)) || '',
                props: f.properties || {},
                polys: polys
            };
        });
    }

    function pointInRings(lon, lat, rings) {
        var inside = false;
        for (var r = 0; r < rings.length; r++) {
            var ring = rings[r];
            if (!ring || ring.length < 3) continue;
            for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
                var xi = ring[i][0], yi = ring[i][1];
                var xj = ring[j][0], yj = ring[j][1];
                if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
                    inside = !inside;
                }
            }
        }
        return inside;
    }

    function pickFeature(lon, lat) {
        for (var i = 0; i < prepared.length; i++) {
            var f = prepared[i];
            for (var p = 0; p < f.polys.length; p++) {
                if (pointInRings(lon, lat, f.polys[p])) return f;
            }
        }
        return null;
    }

    function computeBounds(polys) {
        var w = 180, s = 90, e = -180, n = -90;
        polys.forEach(function (poly) {
            poly.forEach(function (ring) {
                ring.forEach(function (pt) {
                    if (pt[0] < w) w = pt[0];
                    if (pt[0] > e) e = pt[0];
                    if (pt[1] < s) s = pt[1];
                    if (pt[1] > n) n = pt[1];
                });
            });
        });
        // 留 3% 边距
        var padX = (e - w) * 0.03, padY = (n - s) * 0.03;
        return { w: w - padX, s: s - padY, e: e + padX, n: n + padY };
    }

    // ========== 场景构建 ==========
    function track(obj) { tracked.push(obj); return obj; }

    function clearGroup() {
        clearDahanLandscape();
        clearXiaohanLandscape();
        clearDaxueLandscape();
        clearLiqiuLandscape();
        clearBailuLandscape();
        clearLixiaLandscape();
        clearXiaoshuLandscape();
        clearWinterLandscape();
        clearSummerLandscape();
        clearSpringLandscape();
        clearJingzheLandscape();
        clearRainLandscape();
        clearLichunLandscape();
        clearGuyuLandscape();
        clearXiaomanLandscape();
        clearMangzhongLandscape();
        clearDashuLandscape();
        clearQiufenLandscape();
        clearHanluLandscape();
        clearChushuLandscape();
        clearShuangjiangLandscape();
        clearXiaoxueLandscape();
        clearLidongLandscape();
        clearQingmingLandscape();
        if(cropGroup)cropGroup.children.forEach(function(s){s.material.map.dispose();s.material.dispose();});
        while (mapGroup.children.length) mapGroup.remove(mapGroup.children[0]);
        tracked.forEach(function (obj) {
            if (obj.dispose) obj.dispose();
        });
        tracked = [];
        terrainMesh = null;
        terrainMat = null;
        borderMat = null;
        skirtMat = null;
        seaMat = null;
        cropGroup = null;
    }

    function buildTerrainMesh(mat, segX, segY, zLift) {
        var geo = new THREE.PlaneGeometry(view.worldW, view.worldH, segX, segY);
        geo.translate(view.centerX, view.centerY, 0);
        var pos = geo.attributes.position;
        for (var i = 0; i < pos.count; i++) {
            var ll = worldToLonLat(pos.getX(i), pos.getY(i));
            pos.setZ(i, sampleElevation(ll[0], ll[1]) * Z_SCALE + (zLift || 0));
        }
        geo.computeVertexNormals();
        track(geo);
        return new THREE.Mesh(geo, mat);
    }

    function appendSegment(arr, a, b, zLift) {
        var dx = b[0] - a[0], dy = b[1] - a[1];
        var dist = Math.sqrt(dx * dx + dy * dy);
        var steps = Math.max(1, Math.ceil(dist / 0.3));
        var prev = null;
        for (var s = 0; s <= steps; s++) {
            var lon = a[0] + dx * s / steps;
            var lat = a[1] + dy * s / steps;
            var w = lonLatToWorld(lon, lat);
            var z = sampleElevation(lon, lat) * Z_SCALE + zLift;
            if (prev) arr.push(prev[0], prev[1], prev[2], w[0], w[1], z);
            prev = [w[0], w[1], z];
        }
    }

    function buildBorders(zLift) {
        var positions = [];
        prepared.forEach(function (f) {
            for (var pi = 0; pi < f.polys.length; pi++) {
                var poly = f.polys[pi];
                for (var ri = 0; ri < poly.length; ri++) {
                    var ring = poly[ri];
                    if (!ring || ring.length < 2) continue;
                    for (var i = 1; i < ring.length; i++) {
                        appendSegment(positions, ring[i - 1], ring[i], zLift);
                    }
                    if (ring.length > 2) appendSegment(positions, ring[ring.length - 1], ring[0], zLift);
                }
            }
        });
        if (!positions.length) return null;
        var geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        var theme = currentTheme || getTheme('dongzhi');
        var mat = new THREE.LineBasicMaterial({
            color: theme.borderColor, transparent: true, opacity: theme.borderOpacity
        });
        borderMat = mat;
        track(geo); track(mat);
        var lines = new THREE.LineSegments(geo, mat);
        lines.renderOrder = 1;
        return lines;
    }

    function buildSkirt(bottomZ) {
        var positions = [];
        prepared.forEach(function (f) {
            for (var pi = 0; pi < f.polys.length; pi++) {
                var poly = f.polys[pi];
                for (var ri = 0; ri < poly.length; ri++) {
                    var ring = poly[ri];
                    if (!ring || ring.length < 3) continue;
                    for (var i = 0; i < ring.length; i++) {
                        var a = ring[i], b = ring[(i + 1) % ring.length];
                        if(currentLevel === 'national') {
                            var dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1;
                            var mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2,off=0.09;
                            if(TerrainModel.isLand(mx-dy/len*off,my+dx/len*off) &&
                               TerrainModel.isLand(mx+dy/len*off,my-dx/len*off)) continue;
                        }
                        var wa = lonLatToWorld(a[0], a[1]);
                        var wb = lonLatToWorld(b[0], b[1]);
                        var za = sampleElevation(a[0], a[1]) * Z_SCALE;
                        var zb = sampleElevation(b[0], b[1]) * Z_SCALE;
                        // 两个三角形组成竖直墙
                        var floorA=Math.max(bottomZ,za-1.25),floorB=Math.max(bottomZ,zb-1.25);
                        positions.push(wa[0], wa[1], za, wa[0], wa[1], floorA, wb[0], wb[1], floorB);
                        positions.push(wa[0], wa[1], za, wb[0], wb[1], floorB, wb[0], wb[1], zb);
                    }
                }
            }
        });
        if (!positions.length) return null;
        var geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.computeVertexNormals();
        var theme = currentTheme || getTheme('dongzhi');
        var mat = new THREE.MeshLambertMaterial({ color: theme.skirtColor, side: THREE.DoubleSide });
        skirtMat = mat;
        track(geo); track(mat);
        return new THREE.Mesh(geo, mat);
    }

    function buildOverlay(segX, segY) {
        var mat = new THREE.MeshBasicMaterial({
            map: highlightTexture, transparent: true, depthWrite: false
        });
        mat.polygonOffset = true;
        mat.polygonOffsetFactor = -2;
        mat.polygonOffsetUnits = -2;
        track(mat);
        var mesh = buildTerrainMesh(mat, segX, segY, 0.05);
        mesh.renderOrder = 2;
        return mesh;
    }

    function makeLabelSprite(text, worldH) {
        var fontPx = 46, pad = 14;
        var cv = document.createElement('canvas');
        var ctx = cv.getContext('2d');
        ctx.font = fontPx + 'px "KaiTi","STKaiti",serif';
        var tw = Math.ceil(ctx.measureText(text).width);
        cv.width = tw + pad * 2;
        cv.height = fontPx + pad * 2;
        ctx = cv.getContext('2d');
        ctx.font = fontPx + 'px "KaiTi","STKaiti",serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(248,244,232,0.85)';
        ctx.lineWidth = 8;
        ctx.strokeText(text, cv.width / 2, cv.height / 2);
        ctx.fillStyle = '#2e3230';
        ctx.fillText(text, cv.width / 2, cv.height / 2);
        var tex = makeTexture(new THREE.CanvasTexture(cv));
        track(tex);
        var mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
        track(mat);
        var sprite = new THREE.Sprite(mat);
        sprite.scale.set(worldH * cv.width / cv.height, worldH, 1);
        sprite.renderOrder = 3;
        return sprite;
    }

    function buildLabels() {
        var labelH = Math.min(Math.max(view.worldW * 0.055, 0.4), 1.8);
        prepared.forEach(function (f) {
            if (!f.name) return;
            // 取最长的外环求中心
            var best = null;
            f.polys.forEach(function (poly) {
                var ring = poly[0];
                if (ring && (!best || ring.length > best.length)) best = ring;
            });
            if (!best || best.length < 3) return;
            var slon = 0, slat = 0;
            best.forEach(function (pt) { slon += pt[0]; slat += pt[1]; });
            var lon = slon / best.length, lat = slat / best.length;
            var w = lonLatToWorld(lon, lat);
            var sprite = makeLabelSprite(f.name, labelH);
            sprite.position.set(w[0], w[1], sampleElevation(lon, lat) * Z_SCALE + labelH * 0.7 + 0.1);
            mapGroup.add(sprite);
        });
    }

    function drawHighlight(hit) {
        var ctx = highlightCtx;
        ctx.clearRect(0, 0, HCW, HCH);
        if (hit) {
            var b = view.bounds;
            ctx.beginPath();
            hit.polys.forEach(function (poly) {
                poly.forEach(function (ring) {
                    if (!ring || ring.length < 3) return;
                    for (var i = 0; i < ring.length; i++) {
                        var x = (ring[i][0] - b.w) / (b.e - b.w) * HCW;
                        var y = (b.n - ring[i][1]) / (b.n - b.s) * HCH;
                        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                    }
                    ctx.closePath();
                });
            });
        var hl = (currentTheme || getTheme(currentTermKey)).highlight;
        var hr = Math.round(hl.r * 255), hg = Math.round(hl.g * 255), hb = Math.round(hl.b * 255);
        ctx.fillStyle = 'rgba(' + hr + ',' + hg + ',' + hb + ',' + hl.a + ')';
        ctx.fill('evenodd');
        ctx.strokeStyle = 'rgba(' + hr + ',' + hg + ',' + hb + ',0.85)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        }
        highlightTexture.needsUpdate = true;
    }

    function frameView() {
        var halfW = view.worldW / 2, halfH = view.worldH / 2;
        var tanY = Math.tan(FOV * Math.PI / 360);
        var fitH = halfH / tanY;
        var fitW = halfW / (tanY * camera.aspect);
        camGoal.radius = Math.min(Math.max(Math.max(fitH, fitW) * .94, 6), 240);
        camGoal.tx = view.centerX;
        camGoal.ty = view.centerY - view.worldH * .035;
        camGoal.tz = 2.2;
        camGoal.theta = 0;
    }

    function showNational(features) {
        if (!ready) return;
        currentLevel = 'national';
        provinceTooltip=null;
        prepared = prepareFeatures(features.filter(function(f){return currentLevel !== 'national' || f.properties.code;}));
        view = { bounds: NATIONAL_BOUNDS, centerX: 0, centerY: 0, worldW: MAP_W, worldH: MAP_H };

        clearGroup();
        var theme = currentTheme || getTheme(currentTermKey);
        terrainMat = makeInkTerrainMaterial(nationalTexture, theme, view.bounds);
        track(terrainMat);
        terrainMesh = buildTerrainMesh(terrainMat, 620, 362);
        mapGroup.add(terrainMesh);
        // 水域：淡蓝青，压在陆地之下（陆地掩膜处完全透明）
        if (seaTexture) {
            seaMat = new THREE.MeshBasicMaterial({
                map: seaTexture, color: new THREE.Color(theme.water),
                transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide
            });
            track(seaMat);
            var seaGeo = new THREE.PlaneGeometry(view.worldW, view.worldH);
            seaGeo.translate(view.centerX, view.centerY, -0.03);
            track(seaGeo);
            var sea = new THREE.Mesh(seaGeo, seaMat);
            sea.renderOrder = -1;
            mapGroup.add(sea);
        }
        mapGroup.add(buildSkirt(-0.75));
        buildRivers();
        rebuildCrops();
        rebuildWinterLandscape();
        rebuildSummerLandscape();
        rebuildSpringLandscape();
        rebuildJingzheLandscape();
        rebuildRainLandscape();
        rebuildLichunLandscape();
        rebuildBailuLandscape();
        rebuildLixiaLandscape();
        rebuildXiaoshuLandscape();
        rebuildGuyuLandscape();
        rebuildXiaomanLandscape();
        rebuildMangzhongLandscape();
        rebuildDashuLandscape();
        rebuildQiufenLandscape();
        rebuildHanluLandscape();
        rebuildChushuLandscape();
        rebuildShuangjiangLandscape();
        rebuildDaxueLandscape();
        rebuildDahanLandscape();
        rebuildXiaohanLandscape();
        rebuildXiaoxueLandscape();
        rebuildLidongLandscape();
        rebuildLiqiuLandscape();
        rebuildQingmingLandscape();
        var borders = buildBorders(0.06);
        if (borders) mapGroup.add(borders);
        mapGroup.add(buildOverlay(620, 362));
        applyTheme(theme);

        hideTooltip();
        hoverName = null;
        frameView();
        camGoal.phi = 0.60;
        startRise();
    }

    function showProvince(features, cityData, options) {
        if (!ready) return;
        currentLevel = 'province';
        provinceTooltip=options && options.tooltip;
        prepared = prepareFeatures(features.filter(function(f){return currentLevel !== 'national' || f.properties.code;}));
        var bounds = computeBounds(prepared.reduce(function (acc, f) {
            return acc.concat(f.polys);
        }, []));

        // 世界坐标与全国图保持同一比例
        var centerLon = (bounds.w + bounds.e) / 2;
        var centerLat = (bounds.s + bounds.n) / 2;
        var nationalCenter = natLonLatToWorld(centerLon, centerLat);
        view = {
            bounds: bounds,
            centerX: nationalCenter[0],
            centerY: nationalCenter[1],
            worldW: (bounds.e - bounds.w) / LON_SPAN * MAP_W,
            worldH: (bounds.n - bounds.s) / LAT_SPAN * MAP_H
        };

        clearGroup();

        // 裁剪地貌贴图并用省份轮廓做掩膜
        var texCanvas = cropRelief(bounds, prepared);
        var tex = makeTexture(new THREE.CanvasTexture(texCanvas));
        track(tex);
        var theme = currentTheme || getTheme(currentTermKey);
        terrainMat = makeInkTerrainMaterial(tex, theme, view.bounds);
        track(terrainMat);

        var segX = Math.min(Math.max(Math.round(view.worldW * 24), 60), 900);
        var segY = Math.min(Math.max(Math.round(view.worldH * 24), 60), 900);
        terrainMesh = buildTerrainMesh(terrainMat, segX, segY);
        mapGroup.add(terrainMesh);
        mapGroup.add(buildSkirt(-0.4));
        buildRivers();
        rebuildCrops();
        rebuildWinterLandscape();
        rebuildSummerLandscape();
        rebuildSpringLandscape();
        rebuildJingzheLandscape();
        rebuildRainLandscape();
        rebuildLichunLandscape();
        rebuildBailuLandscape();
        rebuildLixiaLandscape();
        rebuildXiaoshuLandscape();
        rebuildGuyuLandscape();
        rebuildXiaomanLandscape();
        rebuildMangzhongLandscape();
        rebuildDashuLandscape();
        rebuildQiufenLandscape();
        rebuildHanluLandscape();
        rebuildChushuLandscape();
        rebuildShuangjiangLandscape();
        rebuildDaxueLandscape();
        rebuildDahanLandscape();
        rebuildXiaohanLandscape();
        rebuildXiaoxueLandscape();
        rebuildLidongLandscape();
        rebuildLiqiuLandscape();
        rebuildQingmingLandscape();
        var borders = buildBorders(0.05);
        if (borders) mapGroup.add(borders);
        mapGroup.add(buildOverlay(segX, segY));
        buildLabels();
        applyTheme(theme);

        // 保存城市数据供 tooltip 使用
        prepared.forEach(function (f) {
            var d = (cityData || []).filter(function (c) { return c.name === f.name; })[0];
            f.cityData = d || null;
        });

        hideTooltip();
        hoverName = null;
        frameView();
        startRise();
    }

    function natLonLatToWorld(lon, lat) {
        return [
            (lon - NATIONAL_BOUNDS.w) / LON_SPAN * MAP_W - MAP_W / 2,
            (lat - NATIONAL_BOUNDS.s) / LAT_SPAN * MAP_H - MAP_H / 2
        ];
    }

    function cropRelief(bounds, preparedFeatures) {
        var iw = reliefImg.width, ih = reliefImg.height;
        var sx = (bounds.w - NATIONAL_BOUNDS.w) / LON_SPAN * iw;
        var sw = (bounds.e - bounds.w) / LON_SPAN * iw;
        var sy = (NATIONAL_BOUNDS.n - bounds.n) / LAT_SPAN * ih;
        var sh = (bounds.n - bounds.s) / LAT_SPAN * ih;
        var dw = Math.min(Math.round(sw), 1600);
        var dh = Math.max(2, Math.round(sh * dw / sw));
        var cv = document.createElement('canvas');
        cv.width = dw; cv.height = dh;
        var ctx = cv.getContext('2d');
        ctx.drawImage(reliefImg, sx, sy, sw, sh, 0, 0, dw, dh);
        // 省份轮廓掩膜：保留省内区域
        ctx.globalCompositeOperation = 'destination-in';
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        preparedFeatures.forEach(function (f) {
            f.polys.forEach(function (poly) {
                poly.forEach(function (ring) {
                    if (!ring || ring.length < 3) return;
                    for (var i = 0; i < ring.length; i++) {
                        var x = (ring[i][0] - bounds.w) / (bounds.e - bounds.w) * dw;
                        var y = (bounds.n - ring[i][1]) / (bounds.n - bounds.s) * dh;
                        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                    }
                    ctx.closePath();
                });
            });
        });
        ctx.fill('evenodd');
        ctx.globalCompositeOperation = 'source-over';
        return cv;
    }

    function startRise() {
        riseStart = performance.now();
        mapGroup.scale.z = 0.02;
    }

    // ========== 交互 ==========
    function bindEvents() {
        var el = renderer.domElement;
        el.style.cursor = 'grab';

        el.addEventListener('contextmenu', function (e) { e.preventDefault(); });

        el.addEventListener('pointerdown', function (e) {
            el.setPointerCapture && el.setPointerCapture(e.pointerId);
            dragState = {
                x: e.clientX, y: e.clientY,
                button: e.button,
                panning: e.button === 2 || e.button === 1 || e.shiftKey,
                moved: false, time: performance.now()
            };
        });

        el.addEventListener('pointermove', function (e) {
            if (dragState) {
                var dx = e.clientX - dragState.x;
                var dy = e.clientY - dragState.y;
                if (Math.abs(dx) + Math.abs(dy) > 4) dragState.moved = true;
                if (dragState.moved) {
                    if (dragState.panning) panCamera(dx, dy);
                    else rotateCamera(dx, dy);
                    dragState.x = e.clientX;
                    dragState.y = e.clientY;
                }
                hideTooltip();
            } else {
                scheduleHover(e);
            }
        });

        el.addEventListener('pointerup', function (e) {
            if (!dragState) return;
            var wasTap = !dragState.moved && e.button === 0;
            dragState = null;
            el.style.cursor = 'grab';
            if (wasTap) handleTap(e);
        });

        el.addEventListener('pointerleave', function () {
            hideTooltip();
            if (hoverName) { hoverName = null; drawHighlight(null); }
        });

        el.addEventListener('wheel', function (e) {
            e.preventDefault();
            camGoal.radius *= Math.exp(e.deltaY * 0.0011);
            camGoal.radius = Math.min(Math.max(camGoal.radius, 4), 260);
        }, { passive: false });
    }

    function rotateCamera(dx, dy) {
        camGoal.theta -= dx * 0.005;
        camGoal.phi -= dy * 0.005;
        camGoal.phi = Math.min(Math.max(camGoal.phi, 0.06), 1.45);
        renderer.domElement.style.cursor = 'grabbing';
    }

    function panCamera(dx, dy) {
        var k = camCur.radius * 0.0016;
        var sinT = Math.sin(camCur.theta), cosT = Math.cos(camCur.theta);
        // 屏幕右方向 / 屏幕上方向（在地图平面上的投影）
        var rightX = cosT, rightY = sinT;
        var upX = sinT, upY = -cosT;
        camGoal.tx -= (dx * rightX - dy * upX) * k;
        camGoal.ty -= (dx * rightY - dy * upY) * k;
        camGoal.tx = Math.min(Math.max(camGoal.tx, -60), 60);
        camGoal.ty = Math.min(Math.max(camGoal.ty, -30), 30);
        renderer.domElement.style.cursor = 'grabbing';
    }

    function scheduleHover(e) {
        lastPointerEvent = e;
        if (hoverPending) return;
        hoverPending = true;
        requestAnimationFrame(function () {
            hoverPending = false;
            if (lastPointerEvent) { handleHover(lastPointerEvent); lastPointerEvent = null; }
        });
    }
    var lastPointerEvent = null;

    function eventToNDC(e) {
        var rect = renderer.domElement.getBoundingClientRect();
        pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        return rect;
    }

    function handleHover(e) {
        if (!terrainMesh) return;
        eventToNDC(e);
        raycaster.setFromCamera(pointerNDC, camera);
        var hits = raycaster.intersectObject(terrainMesh, false);
        var hit = null;
        if (hits.length) {
            var p = hits[0].point;
            var ll = worldToLonLat(p.x, p.y);
            hit = pickFeature(ll[0], ll[1]);
        }
        var name = hit ? hit.name : null;
        if (name !== hoverName) {
            hoverName = name;
            drawHighlight(hit);
            renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
        }
        var tooltipFn=currentLevel==='province'&&provinceTooltip?provinceTooltip:callbacks.tooltip;
        if (hit && tooltipFn) {
            var html = tooltipFn(hit.name, hit.props, hit.cityData || null);
            if (html) showTooltip(html, e);
            else hideTooltip();
        } else {
            hideTooltip();
        }
    }

    function handleTap(e) {
        if (!terrainMesh) return;
        eventToNDC(e);
        raycaster.setFromCamera(pointerNDC, camera);
        var hits = raycaster.intersectObject(terrainMesh, false);
        var hit = null;
        if (hits.length) {
            var p = hits[0].point;
            var ll = worldToLonLat(p.x, p.y);
            hit = pickFeature(ll[0], ll[1]);
        }
        if (!hit) return;

        var tapped = hit;
        if (clickTimer) {
            clearTimeout(clickTimer);
            clickTimer = null;
            if (callbacks.double) callbacks.double(tapped.name, tapped.props);
        } else {
            clickTimer = setTimeout(function () {
                clickTimer = null;
                if (callbacks.single) callbacks.single(tapped.name, tapped.props);
            }, 270);
        }
    }

    function showTooltip(html, e) {
        var tip = document.getElementById('terrainTooltip');
        if (!tip) return;
        tip.innerHTML = html;
        tip.style.display = 'block';
        var rect = container.getBoundingClientRect();
        var x = e.clientX - rect.left + 16;
        var y = e.clientY - rect.top + 12;
        if (x + 270 > rect.width) x = e.clientX - rect.left - 270;
        if (y + 160 > rect.height) y = e.clientY - rect.top - 150;
        tip.style.left = Math.max(x, 4) + 'px';
        tip.style.top = Math.max(y, 4) + 'px';
    }

    function hideTooltip() {
        var tip = document.getElementById('terrainTooltip');
        if (tip) tip.style.display = 'none';
    }

    // ========== 相机 ==========
    var cameraFrameTime = 0;
    function updateCamera() {
        var now=performance.now(),dt=cameraFrameTime?now-cameraFrameTime:16;cameraFrameTime=now;
        var t = 1-Math.exp(-Math.min(dt,150)/160);
        camCur.radius += (camGoal.radius - camCur.radius) * t;
        camCur.theta += (camGoal.theta - camCur.theta) * t;
        camCur.phi += (camGoal.phi - camCur.phi) * t;
        camCur.tx += (camGoal.tx - camCur.tx) * t;
        camCur.ty += (camGoal.ty - camCur.ty) * t;
        camCur.tz += (camGoal.tz - camCur.tz) * t;

        var sp = Math.sin(camCur.phi), cp = Math.cos(camCur.phi);
        var st = Math.sin(camCur.theta), ct = Math.cos(camCur.theta);
        camera.position.set(
            camCur.tx + camCur.radius * sp * st,
            camCur.ty - camCur.radius * sp * ct,
            camCur.tz + camCur.radius * cp
        );
        camera.lookAt(camCur.tx, camCur.ty, camCur.tz);
    }

    function setView(mode) {
        if (mode === '3d') {
            camGoal.phi = 0.60;
            camGoal.theta = 0;
        } else if (mode === 'top') {
            camGoal.phi = 0.08;
            camGoal.theta = 0;
        } else if (mode === 'reset') {
            frameView();
            camGoal.phi = 0.60;
        }
    }

    // ========== 视图按钮 / 尺寸 ==========
    function wireButtons() {
        var b3d = document.getElementById('terrainView3d');
        var bTop = document.getElementById('terrainViewTop');
        var bReset = document.getElementById('terrainReset');
        function press(active) {
            if (b3d) b3d.setAttribute('aria-pressed', active === '3d' ? 'true' : 'false');
            if (bTop) bTop.setAttribute('aria-pressed', active === 'top' ? 'true' : 'false');
        }
        if (b3d) b3d.addEventListener('click', function () { setView('3d'); press('3d'); });
        if (bTop) bTop.addEventListener('click', function () { setView('top'); press('top'); });
        if (bReset) bReset.addEventListener('click', function () { setView('reset'); press('3d'); });
    }

    var resizeObserver = null;
    function observeResize() {
        if (typeof ResizeObserver === 'undefined') return;
        resizeObserver = new ResizeObserver(function () { resize(); });
        resizeObserver.observe(container);
    }

    function resize() {
        if (!renderer || !container) return;
        var w = container.clientWidth, h = container.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        if(view)frameView();
    }

    // 水系为示意线，与地形使用同一高程采样，旋转时仍贴合山河。
    function buildRivers() {
        var rivers=[
            [[91,33],[94,33],[96,32],[97,30],[99,28],[100,26.5],[102,26],[103,28],[105,29],[107,29.5],[109,30.7],[111,30.7],[112,29.5],[114,30.5],[116,29.8],[118,31.5],[121.5,31.5]],
            [[96,35],[98,34],[100,34],[102,35],[103,36],[104,36.5],[106,37],[106.5,39],[110,40],[111,39.5],[110.5,36],[111,35],[113,35],[115,35.5],[117,36.5],[119,37.5]],
            [[109,25],[111,24],[112,23.2],[113,23],[113.6,22.8]],
            [[124,49],[126,47],[127,45],[130,47],[133,48]]
        ];
        var arr=[];
        rivers.forEach(function(r){for(var i=1;i<r.length;i++){
            var a=r[i-1],b=r[i],steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])*14),prev=null;
            for(var j=0;j<=steps;j++){
                var lon=a[0]+(b[0]-a[0])*j/steps,lat=a[1]+(b[1]-a[1])*j/steps;
                if(!TerrainModel.isLand(lon,lat)||lon<view.bounds.w||lon>view.bounds.e||lat<view.bounds.s||lat>view.bounds.n){prev=null;continue;}
                var w=lonLatToWorld(lon,lat),p=[w[0],w[1],sampleElevation(lon,lat)*Z_SCALE+.055];
                if(prev)arr.push.apply(arr,prev.concat(p));prev=p;
            }
        }});
        var g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));
        var m=new THREE.LineBasicMaterial({color:0x9dbec0,transparent:true,opacity:.78});
        track(g);track(m);mapGroup.add(new THREE.LineSegments(g,m));
    }

    var cropsVisible=false,cropGroup=null;
    var winterGroup=null;
    var summerGroup=null;
    var springGroup=null;
    var jingzheGroup=null;
    function clearJingzheLandscape() {
        if(!jingzheGroup)return;
        mapGroup.remove(jingzheGroup);jingzheGroup.userData.dispose();jingzheGroup=null;
    }
    function rebuildJingzheLandscape() {
        clearJingzheLandscape();
        if(!mapGroup || !view || currentTermKey!=='jingzhe' || !window.JingzheLandscape)return;
        jingzheGroup=JingzheLandscape.build({
            bounds:view.bounds,
            accepts:function(lon,lat){return TerrainModel.isLand(lon,lat) && (currentLevel!=='province' || !!pickFeature(lon,lat));},
            position:function(lon,lat){var w=lonLatToWorld(lon,lat);return [w[0],w[1],sampleElevation(lon,lat)*Z_SCALE+.04];}
        });
        mapGroup.add(jingzheGroup);
    }
    var liqiuGroup=null;
    function clearLiqiuLandscape(){
        if(!liqiuGroup)return;
        mapGroup.remove(liqiuGroup);liqiuGroup.userData.dispose();liqiuGroup=null;
    }
    function rebuildLiqiuLandscape(){
        clearLiqiuLandscape();
        if(!mapGroup||!view||currentTermKey!=='liqiu'||!window.LiqiuLandscape)return;
        liqiuGroup=LiqiuLandscape.build({bounds:view.bounds,
            accepts:function(lon,lat){return TerrainModel.isLand(lon,lat)&&(currentLevel!=='province'||!!pickFeature(lon,lat));},
            position:function(lon,lat){var w=lonLatToWorld(lon,lat);return [w[0],w[1],sampleElevation(lon,lat)*Z_SCALE+.04];}
        });mapGroup.add(liqiuGroup);
    }
    var lidongGroup=null;
    function clearLidongLandscape(){
        if(!lidongGroup)return;
        mapGroup.remove(lidongGroup);lidongGroup.userData.dispose();lidongGroup=null;
    }
    function rebuildLidongLandscape(){
        clearLidongLandscape();
        if(!mapGroup||!view||currentTermKey!=='lidong'||!window.LidongLandscape)return;
        lidongGroup=LidongLandscape.build({bounds:view.bounds,
            accepts:function(lon,lat){return TerrainModel.isLand(lon,lat)&&(currentLevel!=='province'||!!pickFeature(lon,lat));},
            position:function(lon,lat){var w=lonLatToWorld(lon,lat);return [w[0],w[1],sampleElevation(lon,lat)*Z_SCALE+.04];}
        });mapGroup.add(lidongGroup);
    }
    var xiaoxueGroup=null;
    function clearXiaoxueLandscape(){
        if(!xiaoxueGroup)return;
        mapGroup.remove(xiaoxueGroup);xiaoxueGroup.userData.dispose();xiaoxueGroup=null;
    }
    function rebuildXiaoxueLandscape(){
        clearXiaoxueLandscape();
        if(!mapGroup||!view||currentTermKey!=='xiaoxue'||!window.XiaoxueLandscape)return;
        xiaoxueGroup=XiaoxueLandscape.build({bounds:view.bounds,
            accepts:function(lon,lat){return TerrainModel.isLand(lon,lat)&&(currentLevel!=='province'||!!pickFeature(lon,lat));},
            position:function(lon,lat){var w=lonLatToWorld(lon,lat);return [w[0],w[1],sampleElevation(lon,lat)*Z_SCALE+.04];}
        });mapGroup.add(xiaoxueGroup);
    }
    var xiaohanGroup=null;
    function clearXiaohanLandscape(){
        if(!xiaohanGroup)return;
        mapGroup.remove(xiaohanGroup);xiaohanGroup.userData.dispose();xiaohanGroup=null;
    }
    function rebuildXiaohanLandscape(){
        clearXiaohanLandscape();
        if(!mapGroup||!view||currentTermKey!=='xiaohan'||!window.XiaohanLandscape)return;
        xiaohanGroup=XiaohanLandscape.build({bounds:view.bounds,
            accepts:function(lon,lat){return TerrainModel.isLand(lon,lat)&&(currentLevel!=='province'||!!pickFeature(lon,lat));},
            position:function(lon,lat){var w=lonLatToWorld(lon,lat);return [w[0],w[1],sampleElevation(lon,lat)*Z_SCALE+.04];}
        });mapGroup.add(xiaohanGroup);
    }
    var dahanGroup=null;
    function clearDahanLandscape(){
        if(!dahanGroup)return;
        mapGroup.remove(dahanGroup);dahanGroup.userData.dispose();dahanGroup=null;
    }
    function rebuildDahanLandscape(){
        clearDahanLandscape();
        if(!mapGroup||!view||currentTermKey!=='dahan'||!window.DahanLandscape)return;
        dahanGroup=DahanLandscape.build({bounds:view.bounds,
            accepts:function(lon,lat){return TerrainModel.isLand(lon,lat)&&(currentLevel!=='province'||!!pickFeature(lon,lat));},
            position:function(lon,lat){var w=lonLatToWorld(lon,lat);return [w[0],w[1],sampleElevation(lon,lat)*Z_SCALE+.04];}
        });mapGroup.add(dahanGroup);
    }
    var daxueGroup=null;
    function clearDaxueLandscape(){
        if(!daxueGroup)return;
        mapGroup.remove(daxueGroup);daxueGroup.userData.dispose();daxueGroup=null;
    }
    function rebuildDaxueLandscape(){
        clearDaxueLandscape();
        if(!mapGroup||!view||currentTermKey!=='daxue'||!window.DaxueLandscape)return;
        daxueGroup=DaxueLandscape.build({bounds:view.bounds,
            accepts:function(lon,lat){return TerrainModel.isLand(lon,lat)&&(currentLevel!=='province'||!!pickFeature(lon,lat));},
            position:function(lon,lat){var w=lonLatToWorld(lon,lat);return [w[0],w[1],sampleElevation(lon,lat)*Z_SCALE+.04];}
        });mapGroup.add(daxueGroup);
    }
    var shuangjiangGroup=null;
    function clearShuangjiangLandscape(){
        if(!shuangjiangGroup)return;
        mapGroup.remove(shuangjiangGroup);shuangjiangGroup.userData.dispose();shuangjiangGroup=null;
    }
    function rebuildShuangjiangLandscape(){
        clearShuangjiangLandscape();
        if(!mapGroup||!view||currentTermKey!=='shuangjiang'||!window.ShuangjiangLandscape)return;
        shuangjiangGroup=ShuangjiangLandscape.build({bounds:view.bounds,
            accepts:function(lon,lat){return TerrainModel.isLand(lon,lat)&&(currentLevel!=='province'||!!pickFeature(lon,lat));},
            position:function(lon,lat){var w=lonLatToWorld(lon,lat);return [w[0],w[1],sampleElevation(lon,lat)*Z_SCALE+.04];}
        });mapGroup.add(shuangjiangGroup);
    }
    var chushuGroup=null;
    function clearChushuLandscape(){
        if(!chushuGroup)return;
        mapGroup.remove(chushuGroup);chushuGroup.userData.dispose();chushuGroup=null;
    }
    function rebuildChushuLandscape(){
        clearChushuLandscape();
        if(!mapGroup||!view||currentTermKey!=='chushu'||!window.ChushuLandscape)return;
        chushuGroup=ChushuLandscape.build({bounds:view.bounds,
            accepts:function(lon,lat){return TerrainModel.isLand(lon,lat)&&(currentLevel!=='province'||!!pickFeature(lon,lat));},
            position:function(lon,lat){var w=lonLatToWorld(lon,lat);return [w[0],w[1],sampleElevation(lon,lat)*Z_SCALE+.04];}
        });mapGroup.add(chushuGroup);
    }
    var qiufenGroup=null;
    function clearQiufenLandscape(){
        if(!qiufenGroup)return;
        mapGroup.remove(qiufenGroup);qiufenGroup.userData.dispose();qiufenGroup=null;
    }
    function rebuildQiufenLandscape(){
        clearQiufenLandscape();
        if(!mapGroup||!view||currentTermKey!=='qiufen'||!window.QiufenLandscape)return;
        qiufenGroup=QiufenLandscape.build({bounds:view.bounds,
            accepts:function(lon,lat){return TerrainModel.isLand(lon,lat)&&(currentLevel!=='province'||!!pickFeature(lon,lat));},
            position:function(lon,lat){var w=lonLatToWorld(lon,lat);return [w[0],w[1],sampleElevation(lon,lat)*Z_SCALE+.04];}
        });mapGroup.add(qiufenGroup);
    }
    var dashuGroup=null;
    function clearDashuLandscape(){
        if(!dashuGroup)return;
        mapGroup.remove(dashuGroup);dashuGroup.userData.dispose();dashuGroup=null;
    }
    function rebuildDashuLandscape(){
        clearDashuLandscape();
        if(!mapGroup||!view||currentTermKey!=='dashu'||!window.DashuLandscape)return;
        dashuGroup=DashuLandscape.build({bounds:view.bounds,
            accepts:function(lon,lat){return TerrainModel.isLand(lon,lat)&&(currentLevel!=='province'||!!pickFeature(lon,lat));},
            position:function(lon,lat){var w=lonLatToWorld(lon,lat);return [w[0],w[1],sampleElevation(lon,lat)*Z_SCALE+.04];}
        });mapGroup.add(dashuGroup);
    }
    var mangzhongGroup=null;
    function clearMangzhongLandscape(){
        if(!mangzhongGroup)return;
        mapGroup.remove(mangzhongGroup);mangzhongGroup.userData.dispose();mangzhongGroup=null;
    }
    function rebuildMangzhongLandscape(){
        clearMangzhongLandscape();
        if(!mapGroup||!view||currentTermKey!=='mangzhong'||!window.MangzhongLandscape)return;
        mangzhongGroup=MangzhongLandscape.build({bounds:view.bounds,
            accepts:function(lon,lat){return TerrainModel.isLand(lon,lat)&&(currentLevel!=='province'||!!pickFeature(lon,lat));},
            position:function(lon,lat){var w=lonLatToWorld(lon,lat);return [w[0],w[1],sampleElevation(lon,lat)*Z_SCALE+.04];}
        });mapGroup.add(mangzhongGroup);
    }
    var hanluGroup=null;
    function clearHanluLandscape(){
        if(!hanluGroup)return;
        mapGroup.remove(hanluGroup);hanluGroup.userData.dispose();hanluGroup=null;
    }
    function rebuildHanluLandscape(){
        clearHanluLandscape();
        if(!mapGroup||!view||currentTermKey!=='hanlu'||!window.HanluLandscape)return;
        hanluGroup=HanluLandscape.build({bounds:view.bounds,
            accepts:function(lon,lat){return TerrainModel.isLand(lon,lat)&&(currentLevel!=='province'||!!pickFeature(lon,lat));},
            position:function(lon,lat){var w=lonLatToWorld(lon,lat);return [w[0],w[1],sampleElevation(lon,lat)*Z_SCALE+.04];}
        });mapGroup.add(hanluGroup);
    }
    var bailuGroup=null;
    function clearBailuLandscape(){
        if(!bailuGroup)return;
        mapGroup.remove(bailuGroup);bailuGroup.userData.dispose();bailuGroup=null;
    }
    function rebuildBailuLandscape(){
        clearBailuLandscape();
        if(!mapGroup||!view||currentTermKey!=='bailu'||!window.BailuLandscape)return;
        bailuGroup=BailuLandscape.build({bounds:view.bounds,
            accepts:function(lon,lat){return TerrainModel.isLand(lon,lat)&&(currentLevel!=='province'||!!pickFeature(lon,lat));},
            position:function(lon,lat){var w=lonLatToWorld(lon,lat);return [w[0],w[1],sampleElevation(lon,lat)*Z_SCALE+.04];}
        });mapGroup.add(bailuGroup);
    }
    var lixiaGroup=null;
    function clearLixiaLandscape(){
        if(!lixiaGroup)return;
        mapGroup.remove(lixiaGroup);lixiaGroup.userData.dispose();lixiaGroup=null;
    }
    function rebuildLixiaLandscape(){
        clearLixiaLandscape();
        if(!mapGroup||!view||currentTermKey!=='lixia'||!window.LixiaLandscape)return;
        lixiaGroup=LixiaLandscape.build({bounds:view.bounds,
            accepts:function(lon,lat){return TerrainModel.isLand(lon,lat)&&(currentLevel!=='province'||!!pickFeature(lon,lat));},
            position:function(lon,lat){var w=lonLatToWorld(lon,lat);return [w[0],w[1],sampleElevation(lon,lat)*Z_SCALE+.04];}
        });mapGroup.add(lixiaGroup);
    }
    var xiaoshuGroup=null;
    function clearXiaoshuLandscape(){
        if(!xiaoshuGroup)return;
        mapGroup.remove(xiaoshuGroup);xiaoshuGroup.userData.dispose();xiaoshuGroup=null;
    }
    function rebuildXiaoshuLandscape(){
        clearXiaoshuLandscape();
        if(!mapGroup||!view||currentTermKey!=='xiaoshu'||!window.XiaoshuLandscape)return;
        xiaoshuGroup=XiaoshuLandscape.build({bounds:view.bounds,
            accepts:function(lon,lat){return TerrainModel.isLand(lon,lat)&&(currentLevel!=='province'||!!pickFeature(lon,lat));},
            position:function(lon,lat){var w=lonLatToWorld(lon,lat);return [w[0],w[1],sampleElevation(lon,lat)*Z_SCALE+.04];}
        });mapGroup.add(xiaoshuGroup);
    }
    var xiaomanGroup=null;
    function clearXiaomanLandscape(){
        if(!xiaomanGroup)return;
        mapGroup.remove(xiaomanGroup);xiaomanGroup.userData.dispose();xiaomanGroup=null;
    }
    function rebuildXiaomanLandscape(){
        clearXiaomanLandscape();
        if(!mapGroup||!view||currentTermKey!=='xiaoman'||!window.XiaomanLandscape)return;
        xiaomanGroup=XiaomanLandscape.build({bounds:view.bounds,
            accepts:function(lon,lat){return TerrainModel.isLand(lon,lat)&&(currentLevel!=='province'||!!pickFeature(lon,lat));},
            position:function(lon,lat){var w=lonLatToWorld(lon,lat);return [w[0],w[1],sampleElevation(lon,lat)*Z_SCALE+.04];}
        });mapGroup.add(xiaomanGroup);
    }
    var guyuGroup=null;
    function clearGuyuLandscape(){
        if(!guyuGroup)return;
        mapGroup.remove(guyuGroup);guyuGroup.userData.dispose();guyuGroup=null;
    }
    function rebuildGuyuLandscape(){
        clearGuyuLandscape();
        if(!mapGroup||!view||currentTermKey!=='guyu'||!window.GuyuLandscape)return;
        guyuGroup=GuyuLandscape.build({bounds:view.bounds,
            accepts:function(lon,lat){return TerrainModel.isLand(lon,lat)&&(currentLevel!=='province'||!!pickFeature(lon,lat));},
            position:function(lon,lat){var w=lonLatToWorld(lon,lat);return [w[0],w[1],sampleElevation(lon,lat)*Z_SCALE+.04];}
        });mapGroup.add(guyuGroup);
    }
    var lichunGroup=null;
    function clearLichunLandscape() {
        if(!lichunGroup)return;
        mapGroup.remove(lichunGroup);lichunGroup.userData.dispose();lichunGroup=null;
    }
    function rebuildLichunLandscape() {
        clearLichunLandscape();
        if(!mapGroup || !view || currentTermKey!=='lichun' || !window.LichunLandscape)return;
        lichunGroup=LichunLandscape.build({
            bounds:view.bounds,
            accepts:function(lon,lat){return TerrainModel.isLand(lon,lat) && (currentLevel!=='province' || !!pickFeature(lon,lat));},
            position:function(lon,lat){var w=lonLatToWorld(lon,lat);return [w[0],w[1],sampleElevation(lon,lat)*Z_SCALE+.04];}
        });
        mapGroup.add(lichunGroup);
    }
    var rainGroup=null;
    var qingmingGroup=null;
    function clearQingmingLandscape() {
        if(!qingmingGroup)return;
        mapGroup.remove(qingmingGroup);qingmingGroup.userData.dispose();qingmingGroup=null;
    }
    function rebuildQingmingLandscape() {
        clearQingmingLandscape();
        if(!mapGroup || !view || currentTermKey!=='qingming' || !window.QingmingLandscape)return;
        qingmingGroup=QingmingLandscape.build({
            bounds:view.bounds,
            accepts:function(lon,lat){return TerrainModel.isLand(lon,lat) && (currentLevel!=='province' || !!pickFeature(lon,lat));},
            position:function(lon,lat){var w=lonLatToWorld(lon,lat);return [w[0],w[1],sampleElevation(lon,lat)*Z_SCALE+.04];}
        });
        mapGroup.add(qingmingGroup);
    }
    function clearRainLandscape() {
        if(!rainGroup)return;
        mapGroup.remove(rainGroup);rainGroup.userData.dispose();rainGroup=null;
    }
    function rebuildRainLandscape() {
        clearRainLandscape();
        if(!mapGroup || !view || currentTermKey!=='yushui' || !window.YushuiLandscape)return;
        rainGroup=YushuiLandscape.build({
            bounds:view.bounds,
            accepts:function(lon,lat){return TerrainModel.isLand(lon,lat) && (currentLevel!=='province' || !!pickFeature(lon,lat));},
            position:function(lon,lat){var w=lonLatToWorld(lon,lat);return [w[0],w[1],sampleElevation(lon,lat)*Z_SCALE+.04];}
        });
        mapGroup.add(rainGroup);
    }
    function clearSpringLandscape() {
        if(!springGroup)return;
        mapGroup.remove(springGroup);springGroup.userData.dispose();springGroup=null;
    }
    function rebuildSpringLandscape() {
        clearSpringLandscape();
        if(!mapGroup || !view || currentTermKey!=='chunfen' || !window.ChunfenLandscape)return;
        springGroup=ChunfenLandscape.build({
            bounds:view.bounds,
            accepts:function(lon,lat){return TerrainModel.isLand(lon,lat) && (currentLevel!=='province' || !!pickFeature(lon,lat));},
            position:function(lon,lat){var w=lonLatToWorld(lon,lat);return [w[0],w[1],sampleElevation(lon,lat)*Z_SCALE+.04];}
        });
        mapGroup.add(springGroup);
    }
    function clearSummerLandscape() {
        if(!summerGroup)return;
        mapGroup.remove(summerGroup);summerGroup.userData.dispose();summerGroup=null;
    }
    function rebuildSummerLandscape() {
        clearSummerLandscape();
        if(currentLevel)document.body.dataset.terrainLevel=currentLevel;
        if(!mapGroup || !view || currentTermKey!=='xiazhi' || !window.XiazhiLandscape)return;
        summerGroup=XiazhiLandscape.build({
            bounds:view.bounds,
            accepts:function(lon,lat){return TerrainModel.isLand(lon,lat) && (currentLevel!=='province' || !!pickFeature(lon,lat));},
            position:function(lon,lat){var w=lonLatToWorld(lon,lat);return [w[0],w[1],sampleElevation(lon,lat)*Z_SCALE+.04];}
        });
        mapGroup.add(summerGroup);
    }
    function clearWinterLandscape() {
        if (!winterGroup) return;
        mapGroup.remove(winterGroup);
        winterGroup.userData.dispose();
        winterGroup=null;
    }
    function rebuildWinterLandscape() {
        clearWinterLandscape();
        if (!mapGroup || !view || currentTermKey !== 'dongzhi' || !window.DongzhiLandscape) return;
        winterGroup=DongzhiLandscape.build({
            bounds:view.bounds,
            accepts:function(lon,lat) { return TerrainModel.isLand(lon,lat) && (currentLevel !== 'province' || !!pickFeature(lon,lat)); },
            position:function(lon,lat) { var w=lonLatToWorld(lon,lat);return [w[0],w[1],sampleElevation(lon,lat)*Z_SCALE+.04]; }
        });
        mapGroup.add(winterGroup);
    }
    function rebuildCrops(){
        if(!mapGroup||!view)return;
        if(cropGroup){
            mapGroup.remove(cropGroup);
            cropGroup.children.forEach(function(s){s.material.map.dispose();s.material.dispose();});
            cropGroup=null;
        }
        if(!cropsVisible||!window.InkCrops)return;
        cropGroup=new THREE.Group();mapGroup.add(cropGroup);
        var season=TERM_SEASON[currentTermKey]||'winter';
        CROP_SITES.forEach(function(site){
            if(season==='winter' && ['rice','maize','cotton'].indexOf(site.kind)>=0)return;
            if(site.lon<view.bounds.w||site.lon>view.bounds.e||site.lat<view.bounds.s||site.lat>view.bounds.n||!TerrainModel.isLand(site.lon,site.lat))return;
            if(currentLevel==='province'&&!pickFeature(site.lon,site.lat))return;
            var texture=new THREE.CanvasTexture(InkCrops.draw(site.kind,season));
            var mat=new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false});
            var sprite=new THREE.Sprite(mat),w=lonLatToWorld(site.lon,site.lat);
            sprite.position.set(w[0],w[1],sampleElevation(site.lon,site.lat)*Z_SCALE+.10);
            sprite.center.set(.5,0);sprite.scale.set(3.3,3.7,1);sprite.userData=site;cropGroup.add(sprite);
        });
    }

    // ========== 渲染循环 ==========
    function animate() {
        requestAnimationFrame(animate);
        if (!ready) return;
        // 地形升起动画
        var t = (performance.now() - riseStart) / 1100;
        if (t < 1) {
            var ease = 1 - Math.pow(1 - t, 3);
            mapGroup.scale.z = 0.02 + 0.98 * ease;
        } else {
            mapGroup.scale.z = 1;
        }
        updateCamera();
        if(winterGroup && winterGroup.userData.animate) winterGroup.userData.animate(performance.now());
        if(jingzheGroup && jingzheGroup.userData.animate) jingzheGroup.userData.animate(performance.now());
        if(rainGroup && rainGroup.userData.animate) rainGroup.userData.animate(performance.now());
        var compass=document.querySelector('.compass');if(compass)compass.style.transform='rotate('+(-camCur.theta*180/Math.PI)+'deg)';
        renderer.render(scene, camera);
    }
})();


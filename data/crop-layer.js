/* 水墨作物原型：经纬度锚点 + 季节生长状态。图像可替换为透明水墨 PNG。 */
(function(){
    'use strict';
    window.CROP_SITES=[
        {id:'north-wheat',name:'冬小麦',kind:'wheat',lon:115.2,lat:35.7},
        {id:'central-wheat',name:'冬小麦',kind:'wheat',lon:113.2,lat:33.6},
        {id:'northeast-maize',name:'玉米',kind:'maize',lon:125.1,lat:45.3},
        {id:'northeast-rice',name:'水稻',kind:'rice',lon:128,lat:46.4},
        {id:'northeast-soy',name:'大豆',kind:'maize',lon:123.5,lat:47.5},
        {id:'yangtze-rice',name:'水稻',kind:'rice',lon:116.8,lat:30.1},
        {id:'jiangsu-rice',name:'水稻',kind:'rice',lon:119.1,lat:32.4},
        {id:'hunan-rice',name:'水稻',kind:'rice',lon:112.2,lat:28.7},
        {id:'sichuan-rice',name:'水稻',kind:'rice',lon:104.7,lat:30.5},
        {id:'south-rice',name:'水稻',kind:'rice',lon:111,lat:23.3},
        {id:'jiangxi-rapeseed',name:'油菜',kind:'flower',lon:115.1,lat:29.2},
        {id:'anhui-rapeseed',name:'油菜',kind:'flower',lon:117.8,lat:30.8},
        {id:'zhejiang-tea',name:'茶树',kind:'tea',lon:119.3,lat:29.4},
        {id:'yunnan-tea',name:'茶树',kind:'tea',lon:100.7,lat:23.3},
        {id:'xinjiang-cotton',name:'棉花',kind:'cotton',lon:84,lat:41.1},
        {id:'xinjiang-grape',name:'葡萄',kind:'tea',lon:89.2,lat:42.7},
        {id:'plateau-barley',name:'青稞',kind:'wheat',lon:91.1,lat:29.7}
    ];
    const stages={
        wheat:['返青','抽穗','播种','越冬'],rice:['育秧','生长','成熟','休耕'],
        maize:['播种','生长','成熟','休耕'],flower:['花开','结荚','播种','越冬'],
        tea:['新芽','繁茂','秋茶','休眠'],cotton:['播种','花期','吐絮','休耕']
    };
    window.InkCrops={
        stage:function(kind,season){return stages[kind][['spring','summer','autumn','winter'].indexOf(season)];},
        draw:function(kind,season){
            var cv=document.createElement('canvas');cv.width=160;cv.height=180;var c=cv.getContext('2d');
            var winter=season==='winter',gold=season==='autumn';
            c.lineCap='round';c.lineJoin='round';
            const stem=winter?'#868d77':'#577d52', seed=gold?'#b39450':'#87975d';
            // 六株手绘枝叶；深浅两次落笔，形成淡墨边缘与浓墨中心。
            for(var i=0;i<6;i++){
                const x=32+i*18,y=155,h=kind==='tea'?45:72+(i%3)*15;
                c.strokeStyle=stem;c.globalAlpha=winter?.5:.8;c.lineWidth=2;
                c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x-7,y-h*.55,x+3,y-h);c.stroke();
                for(var j=1;j<4;j++){
                    const yy=y-j*h/4,s=j%2?1:-1;
                    c.fillStyle=stem;c.globalAlpha=.65;c.beginPath();c.moveTo(x,yy);c.quadraticCurveTo(x+s*30,yy-24,x+s*20,yy-30);c.quadraticCurveTo(x+s*9,yy-22,x,yy);c.fill();
                }
                if(kind==='flower'&&season==='spring'){
                    c.fillStyle='#c6b34a';c.globalAlpha=.88;
                    for(var k=0;k<6;k++){c.beginPath();c.ellipse(x+3+Math.sin(k*2)*8,y-h+Math.cos(k*2)*7,4,3,k,0,Math.PI*2);c.fill();}
                }else if(kind==='cotton'&&gold){
                    c.fillStyle='#eeeade';c.globalAlpha=.96;c.beginPath();c.arc(x+3,y-h,9,0,Math.PI*2);c.fill();
                    c.strokeStyle='#827858';c.lineWidth=.7;c.stroke();
                }else if(!winter&&kind!=='tea'&&kind!=='flower'){
                    c.fillStyle=seed;c.globalAlpha=.85;
                    for(var k=0;k<6;k++){c.beginPath();c.ellipse(x+3+(k%2?4:-4),y-h+k*4,2.8,5,k%2?.8:-.8,0,Math.PI*2);c.fill();}
                }
            }
            c.globalAlpha=.75;c.fillStyle='#495a40';c.font='15px KaiTi,serif';c.textAlign='center';
            c.fillText(stages[kind][['spring','summer','autumn','winter'].indexOf(season)],80,176);
            return cv;
        }
    };
})();

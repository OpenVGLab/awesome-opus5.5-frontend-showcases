'use strict';
/* Rigid voxel parts share the static viewer's camera and geometry mesher. */
window.MotionVoxelView=class extends VoxelView {
  constructor(canvas){
    super(canvas);this.parts=null;this.motion=null;this.motionTime=0;this.playing=false;this.speed=1;this.frame=null;
    canvas.addEventListener('keydown',e=>{if(e.code==='Space'&&this.motion){e.preventDefault();this.setPlaying(!this.playing);}});
  }
  identity(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);}
  multiply(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}
  initMotionProgram(){
    if(this.motionProgram)return;const gl=this.gl,compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('动画材质初始化失败');return s;};
    const vs=compile(gl.VERTEX_SHADER,'attribute vec3 p;attribute vec3 c;attribute vec3 n;uniform mat4 m;uniform mat3 r;varying vec3 color;void main(){vec3 normal=normalize(r*n);float shade=.70+.06*abs(normal.y)+.085*abs(normal.z)+.07*normal.x+.24*normal.y+.095*normal.z;color=min(vec3(1.),c*shade+.035);gl_Position=m*vec4(p,1.);}');
    const fs=compile(gl.FRAGMENT_SHADER,'precision mediump float;varying vec3 color;void main(){gl_FragColor=vec4(color,1.);}');
    const program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('动画材质连接失败');
    this.motionProgram=program;this.motionPos=gl.getAttribLocation(program,'p');this.motionCol=gl.getAttribLocation(program,'c');this.motionNormal=gl.getAttribLocation(program,'n');this.motionMatrix=gl.getUniformLocation(program,'m');this.motionRotation=gl.getUniformLocation(program,'r');
  }
  movingMesh(mesh){
    const out=new Float32Array(mesh.length/6*9);let at=0;
    for(let i=0;i<mesh.length;i+=18){const a=[mesh[i+6]-mesh[i],mesh[i+7]-mesh[i+1],mesh[i+8]-mesh[i+2]],b=[mesh[i+12]-mesh[i],mesh[i+13]-mesh[i+1],mesh[i+14]-mesh[i+2]],n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len=Math.hypot(...n);for(let d=0;d<3;d++)n[d]/=len;const axis=n.findIndex(x=>Math.abs(x)>.5),shade=(n[axis]>0?[.77,1,.88]:[.63,.52,.69])[axis];
      for(let v=0;v<3;v++){const j=i+v*6;out.set(mesh.subarray(j,j+3),at);at+=3;for(let c=0;c<3;c++)out[at++]=Math.max(0,Math.min(1,(mesh[j+3+c]-.035)/shade));out.set(n,at);at+=3;}
    }return out;
  }
  validateMotion(spec){
    const finite=x=>typeof x==='number'&&Number.isFinite(x);
    if(spec.version!==1||!finite(spec.duration)||spec.duration<1||spec.duration>60||!Array.isArray(spec.parts)||!spec.parts.length||spec.parts.length>40)throw Error('动画配置无效');
    const ids=new Set();
    for(const part of spec.parts){
      if(!/^[a-z][a-z0-9_-]{0,39}$/.test(part.id)||ids.has(part.id))throw Error('动画部件编号无效');ids.add(part.id);
      if(!Array.isArray(part.box)||part.box.length!==6||!part.box.every(n=>Number.isInteger(n)&&n>=0&&n<=255)||part.box.slice(0,3).some((n,i)=>n>part.box[i+3]))throw Error('动画部件范围无效');
      if(!Array.isArray(part.colors)||!part.colors.every(c=>/^#[0-9a-f]{6}$/i.test(c)))throw Error('动画颜色选择无效');
      if(!Array.isArray(part.channels)||part.channels.length>4)throw Error('动画轨道无效');
      for(const c of part.channels){
        if(!['spin','swing','bob','flow','move_keys','turn_keys'].includes(c.type)||!['x','y','z'].includes(c.axis)||!Array.isArray(c.pivot)||c.pivot.length!==3||!c.pivot.every(n=>finite(n)&&n>=-256&&n<=512)||!finite(c.amount)||Math.abs(c.amount)>768||!finite(c.period)||c.period<.2||c.period>60||!finite(c.phase))throw Error('动画轨道参数无效');
        if(Math.abs(spec.duration/c.period-Math.round(spec.duration/c.period))>.0001)throw Error('动画周期不能无缝循环');
        if(c.type==='spin'&&Math.abs(c.amount/(Math.PI*2)-Math.round(c.amount/(Math.PI*2)))>.0001)throw Error('旋转轨道须完成整圈');
        if(c.type.endsWith('_keys')){
          if(!Array.isArray(c.keys)||c.keys.length<2||c.keys.length>32||c.keys.some((k,i)=>!Array.isArray(k)||k.length!==2||!k.every(finite)||k[0]<0||k[0]>spec.duration||Math.abs(k[1]*c.amount)>768||(i&&k[0]<=c.keys[i-1][0]))||c.keys[0][0]!==0||c.keys[0][1]!==0||c.keys.at(-1)[0]!==spec.duration||c.keys.at(-1)[1]!==0)throw Error('动画关键帧须有序且完整闭合');
        }
      }
    }
    const byId=new Map(spec.parts.map(p=>[p.id,p]));
    for(const part of spec.parts){let p=part;const seen=new Set();while(p){if(seen.has(p.id))throw Error('动画部件不能循环关联');seen.add(p.id);if(p.parent&&!byId.has(p.parent))throw Error('动画父部件不存在');p=p.parent?byId.get(p.parent):null;}}
    return spec;
  }
  releaseParts(){if(this.parts)for(const p of this.parts)this.gl.deleteBuffer(p.buffer);if(this.motionProgram)this.gl.disableVertexAttribArray(this.motionNormal);this.parts=null;}
  async load(url,motionURL=null){
    this.playing=false;this.auto=false;cancelAnimationFrame(this.frame);this.frame=null;this.releaseParts();this.motion=null;this.motionTime=0;this.speed=1;
    const stats=await super.load(url);if(!motionURL)return stats;
    const [mr,vr]=await Promise.all([fetch(motionURL),fetch(url)]);if(!mr.ok||!vr.ok)throw Error('动画资源读取失败');
    const spec=this.validateMotion(await mr.json()),raw=await vr.arrayBuffer(),dv=new DataView(raw);let records,palette;
    for(let o=8;o+12<=raw.byteLength;){const name=String.fromCharCode(...new Uint8Array(raw,o,4)),len=dv.getUint32(o+4,true);if(o+12+len>raw.byteLength)throw Error('动画体素文件不完整');if(name==='XYZI')records=new Uint8Array(raw,o+16,dv.getUint32(o+12,true)*4);if(name==='RGBA')palette=new Uint8Array(raw,o+12,len);o+=12+len;}
    if(!records||!palette)throw Error('动画体素数据缺失');
    const entries=[{id:'_static',indices:[],parent:null,channels:[]},...spec.parts.map(p=>({...p,indices:[],colorSet:new Set(p.colors.map(c=>parseInt(c.slice(1),16)))}))];
    for(let i=0;i<records.length;i+=4){
      const x=records[i],y=records[i+2],z=records[i+1],ci=(records[i+3]-1)*4,rgb=(palette[ci]<<16)|(palette[ci+1]<<8)|palette[ci+2];let selected=0;
      for(let n=1;n<entries.length;n++){const p=entries[n],b=p.box;if(x>=b[0]&&y>=b[1]&&z>=b[2]&&x<=b[3]&&y<=b[4]&&z<=b[5]&&(!p.colorSet.size||p.colorSet.has(rgb))){if(selected)throw Error('动画部件的体素选择重叠');selected=n;}}
      entries[selected].indices.push(i);
    }
    if(entries.slice(1).some(p=>!p.indices.length))throw Error('动画部件没有匹配到体素');
    const gl=this.gl,grid=new Uint32Array(256**3),parts=[];this.initMotionProgram();
    try{
      for(const p of entries){
        if(!p.indices.length)continue;grid.fill(0);const min=[255,255,255],max=[0,0,0];
        for(const i of p.indices){const x=records[i],y=records[i+2],z=records[i+1],ci=(records[i+3]-1)*4;grid[x+256*(y+256*z)]=((palette[ci]<<16)|(palette[ci+1]<<8)|palette[ci+2])+1;for(const [a,v] of [x,y,z].entries()){min[a]=Math.min(min[a],v);max[a]=Math.max(max[a],v);}}
        const mesh=this.movingMesh(this.mesh(grid,min,max)),buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,mesh,gl.STATIC_DRAW);
        parts.push({id:p.id,parent:p.parent,channels:p.channels,buffer,vertices:mesh.length/9,count:p.indices.length,bounds:{min,max}});
      }
    }catch(e){for(const p of parts)gl.deleteBuffer(p.buffer);throw e;}
    this.motion=spec;this.parts=parts;this.partMap=new Map(parts.map(p=>[p.id,p]));this.motionTime=0;
    this.motionStats={parts:parts.filter(p=>p.id!=='_static').map(p=>({id:p.id,voxel_count:p.count,bounds:p.bounds})),animated_voxels:parts.filter(p=>p.id!=='_static').reduce((a,p)=>a+p.count,0),duration:spec.duration};
    this.draw();this.emitMotion();return {...stats,motion:this.motionStats};
  }
  channelMatrix(c,t){
    const m=this.identity(),axis={x:0,y:1,z:2}[c.axis],wave=Math.sin(t/c.period*Math.PI*2+c.phase)-Math.sin(c.phase);
    let value=0;if(c.type.endsWith('_keys')){for(let i=1;i<c.keys.length;i++){if(t<=c.keys[i][0]){const a=c.keys[i-1],b=c.keys[i],u=Math.max(0,Math.min(1,(t-a[0])/(b[0]-a[0]))),s=u*u*(3-2*u);value=(a[1]+(b[1]-a[1])*s)*c.amount;break;}}}
    if(c.type==='move_keys'){m[12+axis]=value;return m;}
    if(c.type==='bob'||c.type==='flow'){m[12+axis]=c.amount*(c.type==='bob'?wave:(t/c.period-Math.floor(t/c.period)));return m;}
    const angle=c.type==='turn_keys'?value:c.type==='spin'?c.amount*t/c.period:c.amount*wave,co=Math.cos(angle),si=Math.sin(angle);
    if(axis===0){m[5]=co;m[6]=si;m[9]=-si;m[10]=co;}else if(axis===1){m[0]=co;m[2]=-si;m[8]=si;m[10]=co;}else{m[0]=co;m[1]=si;m[4]=-si;m[5]=co;}
    for(let i=0;i<3;i++)m[12+i]=c.pivot[i]-(m[i]*c.pivot[0]+m[4+i]*c.pivot[1]+m[8+i]*c.pivot[2]);return m;
  }
  partMatrix(p,t,cache){
    if(cache.has(p.id))return cache.get(p.id);let m=this.identity();for(const c of p.channels)m=this.multiply(this.channelMatrix(c,t),m);
    if(p.parent)m=this.multiply(this.partMatrix(this.partMap.get(p.parent),t,cache),m);cache.set(p.id,m);return m;
  }
  emitMotion(){this.canvas.dispatchEvent(new CustomEvent('voxelmotionchange',{detail:{time:this.motionTime,duration:this.motion?.duration||0,playing:this.playing,speed:this.speed}}));}
  setTime(seconds){if(!this.motion)return;this.motionTime=Math.max(0,Math.min(this.motion.duration,Number(seconds)||0));this.draw();this.emitMotion();}
  setSpeed(speed){this.speed=Math.max(.25,Math.min(3,Number(speed)||1));this.emitMotion();}
  setPlaying(playing){this.playing=Boolean(this.motion&&playing);this.ensureTick();this.emitMotion();return this.playing;}
  toggleRotation(){this.auto=!this.auto;this.ensureTick();return this.auto;}
  ensureTick(){
    if(this.frame!==null||(!this.auto&&!this.playing))return;let previous=null;
    const tick=now=>{this.frame=null;if(!this.auto&&!this.playing)return;const dt=previous===null?0:Math.max(0,Math.min(.12,(now-previous)/1000));previous=now;if(this.auto)this.yaw+=dt*.18;if(this.playing&&this.motion)this.motionTime=(this.motionTime+dt*this.speed)%this.motion.duration;this.draw();if(this.playing)this.emitMotion();this.frame=requestAnimationFrame(tick);};
    this.frame=requestAnimationFrame(tick);
  }
  draw(){
    if(!this.parts)return super.draw();const gl=this.gl,c=this.canvas,dpr=Math.min(window.devicePixelRatio||1,2),w=Math.max(1,Math.round(c.clientWidth*dpr)),h=Math.max(1,Math.round(c.clientHeight*dpr));
    if(c.width!==w||c.height!==h){c.width=w;c.height=h;}gl.viewport(0,0,w,h);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(!this.ready)return;
    const sy=Math.sin(this.yaw),cy=Math.cos(this.yaw),sp=Math.sin(this.pitch),cp=Math.cos(this.pitch),right=[cy,0,-sy],up=[-sy*sp,cp,-cy*sp],forward=[sy*cp,sp,cy*cp];
    const half=this.span*.75*this.zoom*Math.max(1,h/w),width=half*w/h,depth=this.span*8,center=this.center.map((a,i)=>a-right[i]*this.pan[0]-up[i]*this.pan[1]),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
    const m=new Float32Array([right[0]/width,up[0]/half,-forward[0]/depth,0,right[1]/width,up[1]/half,-forward[1]/depth,0,right[2]/width,up[2]/half,-forward[2]/depth,0,-dot(right,center)/width,-dot(up,center)/half,dot(forward,center)/depth,1]),cache=new Map();gl.useProgram(this.motionProgram);
    for(const part of this.parts){const model=this.partMatrix(part,this.motionTime,cache),rotation=new Float32Array([model[0],model[1],model[2],model[4],model[5],model[6],model[8],model[9],model[10]]);gl.bindBuffer(gl.ARRAY_BUFFER,part.buffer);for(const [attr,offset] of [[this.motionPos,0],[this.motionCol,12],[this.motionNormal,24]]){gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,3,gl.FLOAT,false,36,offset);}gl.uniformMatrix4fv(this.motionMatrix,false,this.multiply(m,model));gl.uniformMatrix3fv(this.motionRotation,false,rotation);gl.drawArrays(gl.TRIANGLES,0,part.vertices);}
  }
  dispose(){this.playing=false;cancelAnimationFrame(this.frame);this.frame=null;this.releaseParts();if(this.motionProgram)this.gl.deleteProgram(this.motionProgram);super.dispose();}
};

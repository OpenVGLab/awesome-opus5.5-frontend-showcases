'use strict';
/* A small voxel viewer with no external runtime dependencies. */
window.VoxelView=class {
  constructor(canvas){
    this.canvas=canvas;this.gl=canvas.getContext('webgl',{antialias:true,preserveDrawingBuffer:true,alpha:false});
    if(!this.gl)throw Error('当前浏览器无法开启三维预览，请查看多角度图片。');
    this.yaw=.76;this.pitch=.55;this.zoom=1;this.auto=false;this.drag=null;this.pan=[0,0];this.ready=false;
    this.initProgram();this.bindInput();this.resizeObserver=new ResizeObserver(()=>this.draw());this.resizeObserver.observe(canvas);
  }
  initProgram(){
    const gl=this.gl,compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
    const vs=compile(gl.VERTEX_SHADER,'attribute vec3 p;attribute vec3 c;uniform mat4 m;varying vec3 color;void main(){gl_Position=m*vec4(p,1.0);color=c;}');
    const fs=compile(gl.FRAGMENT_SHADER,'precision mediump float;varying vec3 color;void main(){gl_FragColor=vec4(color,1.0);}');
    this.program=gl.createProgram();gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);
    if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error('无法初始化三维预览');
    gl.useProgram(this.program);this.pos=gl.getAttribLocation(this.program,'p');this.col=gl.getAttribLocation(this.program,'c');this.matrix=gl.getUniformLocation(this.program,'m');
    gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.clearColor(.935,.945,.925,1);
  }
  async load(url){
    const r=await fetch(url);if(!r.ok)throw Error('体素文件读取失败');
    const buffer=await r.arrayBuffer(),dv=new DataView(buffer),str=o=>String.fromCharCode(...new Uint8Array(buffer,o,4));
    if(buffer.byteLength<20||str(0)!=='VOX ')throw Error('体素文件格式无效');
    let records=null,palette=null;
    for(let o=8;o+12<=buffer.byteLength;){const name=str(o),len=dv.getUint32(o+4,true),end=o+12+len;if(end>buffer.byteLength)throw Error('体素文件不完整');
      if(name==='XYZI'){const count=dv.getUint32(o+12,true);if(4+count*4>len)throw Error('体素数量无效');records=new Uint8Array(buffer,o+16,count*4);}
      if(name==='RGBA')palette=new Uint8Array(buffer,o+12,len);o=end;
    }
    if(!records||!palette)throw Error('体素数据或调色板缺失');
    const grid=new Uint32Array(256**3),min=[255,255,255],max=[0,0,0];
    for(let i=0;i<records.length;i+=4){const x=records[i],z=records[i+1],y=records[i+2],ci=(records[i+3]-1)*4;
      const rgb=(palette[ci]<<16)|(palette[ci+1]<<8)|palette[ci+2];grid[x+256*(y+256*z)]=rgb+1;
      min[0]=Math.min(min[0],x);min[1]=Math.min(min[1],y);min[2]=Math.min(min[2],z);max[0]=Math.max(max[0],x);max[1]=Math.max(max[1],y);max[2]=Math.max(max[2],z);
    }
    this.count=records.length/4;this.bounds={min,max};this.center=min.map((a,i)=>(a+max[i]+1)/2);this.span=Math.max(...max.map((a,i)=>a-min[i]+1));
    const mesh=this.mesh(grid,min,max),gl=this.gl;this.vertices=mesh.length/6;
    if(this.buffer)gl.deleteBuffer(this.buffer);this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,mesh,gl.STATIC_DRAW);
    gl.enableVertexAttribArray(this.pos);gl.vertexAttribPointer(this.pos,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(this.col);gl.vertexAttribPointer(this.col,3,gl.FLOAT,false,24,12);
    this.ready=true;this.draw();return {voxel_count:this.count,vertices:this.vertices,bounds:this.bounds};
  }
  mesh(grid,min,max){
    const out=[],get=(a,b,c)=>(a<0||b<0||c<0||a>255||b>255||c>255)?0:grid[a+256*(b+256*c)];
    for(let d=0;d<3;d++){
      const u=(d+1)%3,v=(d+2)%3,w=max[u]-min[u]+1,h=max[v]-min[v]+1,mask=new Int32Array(w*h),p=[0,0,0],q=[0,0,0];q[d]=1;
      for(let s=min[d]-1;s<=max[d];s++){
        p[d]=s;
        for(let j=0;j<h;j++)for(let i=0;i<w;i++){p[u]=min[u]+i;p[v]=min[v]+j;const a=get(...p),b=get(p[0]+q[0],p[1]+q[1],p[2]+q[2]);mask[i+w*j]=a&&!b?a:!a&&b?-b:0;}
        for(let j=0;j<h;j++)for(let i=0;i<w;){const val=mask[i+w*j];if(!val){i++;continue;}let rw=1,rh=1;while(i+rw<w&&mask[i+rw+w*j]===val)rw++;
          grow:while(j+rh<h){for(let k=0;k<rw;k++)if(mask[i+k+w*(j+rh)]!==val)break grow;rh++;}
          const a=[0,0,0];a[d]=s+1;a[u]=min[u]+i;a[v]=min[v]+j;const b=a.slice(),c=a.slice(),e=a.slice();b[u]+=rw;c[u]+=rw;c[v]+=rh;e[v]+=rh;
          const rgb=Math.abs(val)-1,shade=(val>0?[.77,1,.88]:[.63,.52,.69])[d],color=[((rgb>>>16)&255)/255,((rgb>>>8)&255)/255,(rgb&255)/255].map(x=>Math.min(1,x*shade+.035));
          const corners=[a,b,c,e],order=val>0?[0,1,2,0,2,3]:[0,2,1,0,3,2];for(const n of order)out.push(...corners[n],...color);
          for(let y=0;y<rh;y++)for(let x=0;x<rw;x++)mask[i+x+w*(j+y)]=0;i+=rw;
        }
      }
    }
    return new Float32Array(out);
  }
  setView(view){const a={iso:[.76,.55],front:[0,.08],back:[Math.PI,.08],side:[Math.PI/2,.08],top:[0,Math.PI/2-.001]};[this.yaw,this.pitch]=a[view]||a.iso;this.zoom=1;this.pan=[0,0];this.draw();this.canvas.dispatchEvent(new CustomEvent('voxelviewchange',{detail:view}));}
  bindInput(){
    const c=this.canvas;c.style.touchAction='none';this.points=new Map();
    c.addEventListener('pointerdown',e=>{c.setPointerCapture(e.pointerId);this.points.set(e.pointerId,[e.clientX,e.clientY]);this.drag={x:e.clientX,y:e.clientY,pan:e.shiftKey||e.button===2};this.pinch=null;});
    c.addEventListener('pointermove',e=>{
      if(!this.points.has(e.pointerId))return;this.points.set(e.pointerId,[e.clientX,e.clientY]);
      if(this.points.size===2){const [a,b]=[...this.points.values()],dist=Math.hypot(a[0]-b[0],a[1]-b[1]);if(this.pinch)this.zoom=Math.max(.25,Math.min(4,this.zoom*this.pinch/dist));this.pinch=dist;this.draw();return;}
      if(!this.drag)return;const dx=e.clientX-this.drag.x,dy=e.clientY-this.drag.y;
      if(this.drag.pan){this.pan[0]+=dx/c.clientHeight*this.span*this.zoom*1.5;this.pan[1]-=dy/c.clientHeight*this.span*this.zoom*1.5;}else{this.yaw-=dx*.007;this.pitch=Math.max(-1.42,Math.min(1.56,this.pitch+dy*.007));}
      this.drag.x=e.clientX;this.drag.y=e.clientY;this.draw();
    });
    const release=e=>{this.points.delete(e.pointerId);this.drag=null;this.pinch=null;};c.addEventListener('pointerup',release);c.addEventListener('pointercancel',release);
    c.addEventListener('contextmenu',e=>e.preventDefault());c.addEventListener('wheel',e=>{e.preventDefault();this.zoom=Math.max(.25,Math.min(4,this.zoom*Math.exp(e.deltaY*.001)));this.draw();},{passive:false});
    c.addEventListener('dblclick',()=>this.setView('iso'));
    c.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','0'].includes(e.key)){e.preventDefault();if(e.key==='0')return this.setView('iso');if(e.key==='ArrowLeft')this.yaw-=.12;if(e.key==='ArrowRight')this.yaw+=.12;if(e.key==='ArrowUp')this.pitch=Math.min(1.56,this.pitch+.1);if(e.key==='ArrowDown')this.pitch=Math.max(-1.42,this.pitch-.1);if(e.key==='+')this.zoom=Math.max(.25,this.zoom*.9);if(e.key==='-')this.zoom=Math.min(4,this.zoom*1.1);this.draw();}});
  }
  toggleRotation(){this.auto=!this.auto;if(this.auto){let prev=performance.now();const tick=now=>{if(!this.auto)return;this.yaw+=(now-prev)*.00018;prev=now;this.draw();this.animation=requestAnimationFrame(tick);};this.animation=requestAnimationFrame(tick);}return this.auto;}
  draw(){
    const gl=this.gl,c=this.canvas,dpr=Math.min(window.devicePixelRatio||1,2),w=Math.max(1,Math.round(c.clientWidth*dpr)),h=Math.max(1,Math.round(c.clientHeight*dpr));
    if(c.width!==w||c.height!==h){c.width=w;c.height=h;}gl.viewport(0,0,w,h);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(!this.ready)return;
    const sy=Math.sin(this.yaw),cy=Math.cos(this.yaw),sp=Math.sin(this.pitch),cp=Math.cos(this.pitch),right=[cy,0,-sy],up=[-sy*sp,cp,-cy*sp],forward=[sy*cp,sp,cy*cp];
    const half=this.span*.75*this.zoom*Math.max(1,h/w),width=half*w/h,depth=this.span*8,center=this.center.map((a,i)=>a-right[i]*this.pan[0]-up[i]*this.pan[1]);
    const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),m=new Float32Array([right[0]/width,up[0]/half,forward[0]/depth,0,right[1]/width,up[1]/half,forward[1]/depth,0,right[2]/width,up[2]/half,forward[2]/depth,0,-dot(right,center)/width,-dot(up,center)/half,-dot(forward,center)/depth,1]);
    // In clip space smaller z is nearer; the observer sits along +forward.
    m[2]*=-1;m[6]*=-1;m[10]*=-1;m[14]*=-1;
    gl.useProgram(this.program);gl.uniformMatrix4fv(this.matrix,false,m);gl.drawArrays(gl.TRIANGLES,0,this.vertices);
  }
  dispose(){this.auto=false;cancelAnimationFrame(this.animation);this.resizeObserver.disconnect();if(this.buffer)this.gl.deleteBuffer(this.buffer);this.gl.deleteProgram(this.program);}
};

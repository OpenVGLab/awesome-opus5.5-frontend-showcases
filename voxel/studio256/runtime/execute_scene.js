'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),crypto=require('node:crypto');
const [source,output]=process.argv.slice(2),N=256,MAX_VOXELS=1500000;
if(!source||!output)throw Error('Usage: execute_scene.js source.js output_directory');
const grid=new Uint32Array(N*N*N);let occupied=0,calls=0,rejected=0,seed=123456789;
function color(c){if(c===null)return 0;if(typeof c!=='string'||!/^#[\da-f]{6}$/i.test(c))throw Error('Expected a six-digit hex color');return parseInt(c.slice(1),16)+1;}
function set(x,y,z,v){
  if(!Number.isInteger(x)||!Number.isInteger(y)||!Number.isInteger(z)||x<0||y<0||z<0||x>=N||y>=N||z>=N){rejected++;throw Error('Invalid voxel coordinate: '+[x,y,z].join(','));}
  const k=x+N*(z+N*y),old=grid[k];calls++;
  if(!old&&v){occupied++;if(occupied>MAX_VOXELS)throw Error('Voxel capacity exceeded');}else if(old&&!v)occupied--;
  grid[k]=v;
}
function block(x,y,z,c){set(x,y,z,color(c));}
function box(a,b,c,d,e,f,col){
  const v=color(col);if(![a,b,c,d,e,f].every(Number.isInteger)||[a,b,c,d,e,f].some(n=>n<0||n>=N))throw Error('Invalid box corners: '+[a,b,c,d,e,f].join(','));
  for(let y=Math.min(b,e);y<=Math.max(b,e);y++)for(let z=Math.min(c,f);z<=Math.max(c,f);z++)for(let x=Math.min(a,d);x<=Math.max(a,d);x++)set(x,y,z,v);
}
function line(x0,y0,z0,x1,y1,z1,col){
  const s=Math.ceil(Math.max(Math.abs(x1-x0),Math.abs(y1-y0),Math.abs(z1-z0)));if(!Number.isFinite(s)||s>1024)throw Error('Invalid line');
  for(let i=0;i<=s;i++){const t=s?i/s:0;block(Math.round(x0+(x1-x0)*t),Math.round(y0+(y1-y0)*t),Math.round(z0+(z1-z0)*t),col);}
}
function rng(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
function chunk(name,body){const h=Buffer.alloc(12);h.write(name);h.writeUInt32LE(body.length,4);return Buffer.concat([h,body]);}
const started=Date.now();let meta;
try{
  const ctx=vm.createContext({block,box,line,rng,Math},{codeGeneration:{strings:false,wasm:false}});
  new vm.Script(fs.readFileSync(path.join(__dirname,'geometry.js'),'utf8')).runInContext(ctx,{timeout:1000});
  const code=fs.readFileSync(source,'utf8');new vm.Script(code,{filename:'scene.js'}).runInContext(ctx,{timeout:45000});
  if(occupied<1000)throw Error('Build is empty or too small');
  const min=[255,255,255],max=[0,0,0],hist=new Map();
  for(let k=0;k<grid.length;k++){const v=grid[k];if(!v)continue;const x=k&255,z=(k>>>8)&255,y=k>>>16;min[0]=Math.min(min[0],x);min[1]=Math.min(min[1],y);min[2]=Math.min(min[2],z);max[0]=Math.max(max[0],x);max[1]=Math.max(max[1],y);max[2]=Math.max(max[2],z);hist.set(v,(hist.get(v)||0)+1);}
  if(hist.size>255)throw Error('Use no more than 255 distinct colors');
  const palette=[...hist.keys()].sort((a,b)=>a-b),indices=new Map(palette.map((v,i)=>[v,i+1]));
  const xyzi=Buffer.alloc(4+occupied*4);xyzi.writeUInt32LE(occupied);let off=4;
  for(let k=0;k<grid.length;k++)if(grid[k]){xyzi[off++]=k&255;xyzi[off++]=(k>>>8)&255;xyzi[off++]=k>>>16;xyzi[off++]=indices.get(grid[k]);}
  const rgba=Buffer.alloc(1024);palette.forEach((v,i)=>{const rgb=v-1;rgba[i*4]=(rgb>>>16)&255;rgba[i*4+1]=(rgb>>>8)&255;rgba[i*4+2]=rgb&255;rgba[i*4+3]=255;});
  const size=Buffer.alloc(12);size.writeUInt32LE(N,0);size.writeUInt32LE(N,4);size.writeUInt32LE(N,8);
  const children=Buffer.concat([chunk('SIZE',size),chunk('XYZI',xyzi),chunk('RGBA',rgba)]),main=Buffer.alloc(20);main.write('VOX ');main.writeUInt32LE(150,4);main.write('MAIN',8);main.writeUInt32LE(children.length,16);
  const data=Buffer.concat([main,children]);fs.writeFileSync(path.join(output,'model.vox'),data);
  const hashFile=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  meta={ok:true,voxel_count:occupied,color_count:hist.size,bounds:{min,max},grid_size:N,calls,rejected,execution_ms:Date.now()-started,code_sha256:crypto.createHash('sha256').update(code).digest('hex'),voxel_sha256:crypto.createHash('sha256').update(data).digest('hex'),runtime_sha256:hashFile(__filename),geometry_sha256:hashFile(path.join(__dirname,'geometry.js'))};
}catch(e){meta={ok:false,error:String(e.message||e),voxel_count:occupied,calls,rejected,execution_ms:Date.now()-started};}
fs.writeFileSync(path.join(output,'meta.json'),JSON.stringify(meta,null,2));console.log(JSON.stringify(meta));if(!meta.ok)process.exitCode=1;

const P={
 iv:'#efe8d8',iv2:'#e2d9c3',wd:'#6b4428',wd2:'#8a5a34',wdd:'#4a2e1b',
 ce:'#8fb8a8',ce2:'#6e9c8e',ce3:'#a9ccbf',ced:'#4f7d71',au:'#c0924a',au2:'#d9b061',
 st:'#b9b3a6',st2:'#9c9588',st3:'#d2cdc1',jt:'#8a8478',
 ea:'#a89a7c',gr1:'#7d8f5e',gr2:'#6a7d4f',wa:'#5f8f8c',wa2:'#4e7b78',
 lf1:'#5f7d4e',lf2:'#7a9a62',lf3:'#4b6640',pn:'#3f5a42',rk:'#a7a296',rk2:'#8c877b',lo:'#6f9a5a',bl:'#f1e3d3'
};
const R=Math.round;
function rrDist(x,z,x0,x1,z0,z1,r){
  const qx=Math.max(x0+r-x,x-(x1-r),0),qz=Math.max(z0+r-z,z-(z1-r),0);
  if(qx>0&&qz>0) return r-Math.hypot(qx,qz);
  return Math.min(x-x0,x1-x,z-z0,z1-z);
}
function pondQ(x,z){
  const dx=(x-178)/40,dz=(z-72)/30,th=Math.atan2(dz,dx);
  return Math.hypot(dx,dz)/(1+0.08*Math.sin(3*th+1)+0.05*Math.sin(5*th));
}
function segDist(x,z,ax,az,bx,bz){
  const vx=bx-ax,vz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*vx+(z-az)*vz)/(vx*vx+vz*vz)));
  return Math.hypot(x-ax-vx*t,z-az-vz*t);
}
function paved(x,z){
  if(x>=56&&x<=144&&z>=200&&z<=220) return true;
  if(x>=88&&x<=112&&z>=121&&z<=161) return true;
  if(segDist(x,z,100,114,126,86)<=6) return true;
  if(x>=56&&x<=87&&z>=132&&z<=142) return true;
  return false;
}
function paveColor(x,z){
  const row=Math.floor(z/6);
  if(z%6===0||((x+(row%2)*3)%6===0)) return P.jt;
  return ((x*7+z*13)%5===0)?P.st:P.st3;
}
for(let x=30;x<=226;x++) for(let z=32;z<=222;z++){
  const e=rrDist(x,z,30,226,32,222,10); if(e<0) continue;
  const q=pondQ(x,z);
  if(q<1){
    for(let y=4;y<=6;y++) block(x,y,z,y===6?P.rk2:P.st2);
    for(let y=7;y<=8;y++) block(x,y,z,(y===8&&((x+2*z)%9===0))?P.wa2:P.wa);
    continue;
  }
  const full=e<3||q<1.35;
  for(let y=4;y<=9;y++){
    if(!full&&y>4&&y<9) continue;
    block(x,y,z,y<=6?P.st2:P.ea);
  }
  let c;
  if(e<1.5) c=P.st2;
  else if(paved(x,z)) c=paveColor(x,z);
  else {
    const n=Math.sin(x*0.09)*Math.cos(z*0.11)+0.5*Math.sin(x*0.23+z*0.19);
    c=n>0.9?P.gr2:(n>0.35?P.gr1:P.ea);
  }
  block(x,10,z,c);
  if(q<1.12&&rng()<0.55) block(x,11,z,rng()<0.5?P.rk:P.rk2);
}

box(62,11,162,138,15,200,P.st);
box(62,15,162,138,15,162,P.st3); box(62,15,200,138,15,200,P.st3);
box(62,15,162,62,15,200,P.st3); box(138,15,162,138,15,200,P.st3);
for(let k=0;k<4;k++){ box(86,11,201+2*k,114,14-k,202+2*k,P.st3); box(88,11,161-2*k,112,14-k,160-2*k,P.st3); }
for(let z=201;z<=208;z++){ const h=R(15-(z-200)*0.55); box(84,11,z,85,h,z,P.st2); box(115,11,z,116,h,z,P.st2); }
for(let z=153;z<=160;z++){ const h=R(15-(161-z)*0.55); box(86,11,z,87,h,z,P.st2); box(113,11,z,114,h,z,P.st2); }
const CXS=[72,88,112,128];
for(const cz of [172,190]) for(const cx of CXS){ cylinder(cx,16,cz,3.4,2,P.st2); cylinder(cx,18,cz,2.3,32,P.wd); }
box(70,16,172,74,46,190,P.iv); box(126,16,172,130,46,190,P.iv);
box(70,16,173,74,18,189,P.wdd); box(126,16,173,130,18,189,P.wdd);
for(const wx of [[70,69],[130,131]]) for(let y=25;y<=39;y++) for(let z=174;z<=188;z++){
  const d=Math.hypot(y-32,z-181); if(d>5.5) continue;
  if(d>4.5){ block(wx[0],y,z,P.wd); block(wx[1],y,z,P.wd); }
  else block(wx[0],y,z,((y+z)%3===0||(y-z+99)%3===0)?P.wd:P.ce);
}
box(74,16,180,87,46,182,P.iv); box(113,16,180,126,46,182,P.iv);
box(74,16,180,87,18,182,P.wdd); box(113,16,180,126,18,182,P.wdd);
box(87,16,179,89,46,183,P.wd); box(111,16,179,113,46,183,P.wd); box(87,43,179,113,46,183,P.wd);
box(90,16,181,99,42,181,P.wdd); box(101,16,181,110,42,181,P.wdd); box(100,16,181,100,42,181,P.wd);
for(const yy of [20,24,28,32,36,40]) for(const xx of [92,95,98,102,105,108]) block(xx,yy,182,P.au);
ring(98,30,183,1.6,0.5,P.au2,'z'); ring(102,30,183,1.6,0.5,P.au2,'z');
box(89,16,179,111,18,183,P.wdd);
box(83,16,183,87,17,188,P.st2); ellipsoid(85,21.5,185.5,1.6,4,4,P.st3);
box(113,16,183,117,17,188,P.st2); ellipsoid(115,21.5,185.5,1.6,4,4,P.st3);
box(70,45,189,130,48,191,P.wd); box(71,46,192,129,47,192,P.ce);
box(70,45,171,130,48,173,P.wd); box(71,46,170,129,47,170,P.ce);
for(let x=76;x<=124;x+=8){ box(x,46,193,x,47,193,P.au); box(x,46,169,x,47,169,P.au); }
box(70,45,172,74,48,190,P.wd); box(126,45,172,130,48,190,P.wd);
box(68,49,170,132,50,192,P.wd2);
box(94,38,192,106,44,192,P.au); box(95,39,193,105,43,193,P.ce);
for(const lx of [80,120]){
  line(lx,44,193,lx,41,193,P.wdd);
  ellipsoid(lx,37.5,193,2.6,3.2,2.6,P.bl);
  box(lx-1,41,192,lx+1,41,194,P.au); box(lx-1,34,192,lx+1,34,194,P.au);
  block(lx,33,193,P.au2);
}
function dg(sx,sz,dx,dz){
  const M=(u,w)=>[sx+dx*u+(dz!==0?w:0),sz+dz*u+(dx!==0?w:0)];
  const B=(u0,u1,w0,w1,y0,y1,c)=>{ const a=M(u0,w0),b=M(u1,w1); box(a[0],y0,a[1],b[0],y1,b[1],c); };
  B(-2,2,-2,2,51,53,P.ce);
  B(-1,1,-6,6,54,55,P.wd); B(-1,1,-7,-5,56,57,P.ce); B(-1,1,5,7,56,57,P.ce);
  B(-3,5,-1,1,54,55,P.wd); B(4,6,-2,2,56,57,P.ce);
  B(4,6,-5,5,58,59,P.wd); B(4,6,-6,-4,60,61,P.ce); B(4,6,4,6,60,61,P.ce);
  B(-3,9,-1,1,58,59,P.wd2); B(8,10,-2,2,60,61,P.ce);
  B(8,10,-6,6,62,63,P.wd); B(8,10,-6,-4,64,65,P.ce); B(8,10,4,6,64,65,P.ce); B(8,10,-1,1,64,65,P.ce);
  const a=M(-4,0),b=M(12,0),t=M(13,0);
  beam(a[0],64,a[1],b[0],56,b[1],1.0,P.wd2);
  block(t[0],55,t[1],P.au);
}
for(let sx=72;sx<=128;sx+=8){ dg(sx,190,0,1); dg(sx,172,0,-1); }
for(const sz of [172,181,190]){ dg(72,sz,-1,0); dg(128,sz,1,0); }
box(62,66,198,138,69,200,P.wd); box(62,66,162,138,69,164,P.wd);
box(62,66,162,64,69,200,P.wd); box(136,66,162,138,69,200,P.wd);
box(62,66,200,138,66,200,P.au); box(62,66,162,138,66,162,P.au);

const RX0=54,RX1=146,RZ0=154,RZ1=208,EAVE=64,RISE=28,HIPW=12;
const RD=(RZ1-RZ0)/2;
function curveH(d){ return EAVE+RISE*Math.pow(Math.max(0,d)/RD,1.3); }
function roofInfo(x,z){
  if(x<RX0||x>RX1||z<RZ0||z>RZ1) return null;
  const dz=Math.min(z-RZ0,RZ1-z),dx=Math.min(x-RX0,RX1-x);
  const hl=curveH(dz);
  let h=hl,hip=false;
  if(dx<HIPW){ const hh=curveH(dx); if(hh<hl){ h=hh; hip=true; } }
  const lift=7*Math.pow(Math.max(0,1-Math.hypot(dx,dz)/22),2);
  return {h:h+lift,hip,dx,dz};
}
for(let x=RX0;x<=RX1;x++) for(let z=RZ0;z<=RZ1;z++){
  const r=roofInfo(x,z); if(!r) continue;
  const top=Math.floor(r.h);
  const edge=(r.dx===0||r.dz===0);
  const roll=r.hip?(z%3===0):(x%3===0);
  for(let y=top-2;y<=top;y++){
    let c;
    if(y<top) c=P.wd;
    else if(edge) c=((x+z)%3===0)?P.au:P.ced;
    else c=roll?P.ce:P.ce2;
    block(x,y,z,c);
  }
  if(!edge&&roll) block(x,top+1,z,P.ce3);
}
for(const gx of [[66,67,65],[134,133,135]]){
  const yb=Math.floor(curveH(HIPW-1))+1;
  for(let z=RZ0;z<=RZ1;z++){
    const r=roofInfo(gx[0],z); const yt=Math.floor(r.h)-3;
    for(let y=yb;y<=yt;y++){ block(gx[0],y,z,P.iv); block(gx[1],y,z,P.iv2); }
    const h=Math.floor(r.h);
    if(h>yb) for(let y=Math.max(yb,h-3);y<=h;y++) block(gx[2],y,z,P.wd2);
    if(h>=yb+1){ block(gx[0],h+1,z,P.ced); block(gx[0],h+2,z,P.ced); block(gx[1],h+1,z,P.ced); }
  }
  for(let z=174;z<=188;z+=7) for(let y=yb+2;y<=yb+4;y++) block(gx[2],y,z,P.au);
}
box(66,93,179,134,96,183,P.ced); box(66,94,178,134,94,184,P.ce);
box(63,93,179,66,101,183,P.au); box(66,99,180,68,103,182,P.au); box(61,100,180,63,104,182,P.au2);
box(134,93,179,137,101,183,P.au); box(132,99,180,134,103,182,P.au); box(137,100,180,139,104,182,P.au2);
for(const hc of [[66,166,54,154],[66,196,54,208],[134,166,146,154],[134,196,146,208]]){
  for(let i=0;i<=24;i++){
    const t=i/24,x=R(hc[0]+(hc[2]-hc[0])*t),z=R(hc[1]+(hc[3]-hc[1])*t);
    const r=roofInfo(x,z); if(!r) continue;
    const y=Math.floor(r.h)+1;
    block(x,y,z,P.ced); block(x,y+1,z,P.ced);
  }
  const r=roofInfo(hc[2],hc[3]); const y=Math.floor(r.h);
  block(hc[2],y+2,hc[3],P.au); block(hc[2],y+3,hc[3],P.au2);
}
for(let x=RX0+2;x<=RX1-2;x+=2){
  for(const zz of [[RZ1,RZ1+1],[RZ0,RZ0-1]]){ const r=roofInfo(x,zz[0]); block(x,Math.floor(r.h)-1,zz[1],P.wd2); }
}
for(let z=RZ0+2;z<=RZ1-2;z+=2){
  for(const xx of [[RX0,RX0-1],[RX1,RX1+1]]){ const r=roofInfo(xx[0],z); block(xx[1],Math.floor(r.h)-1,z,P.wd2); }
}

function wallX(x0,x1,z0,z1,top){
  box(x0,11,z0,x1,top,z1,P.iv);
  box(x0,11,z0,x1,13,z1,P.st2);
  box(x0,top+1,z0-1,x1,top+2,z1+1,P.ce2);
  box(x0,top+3,z0+1,x1,top+3,z1-1,P.ced);
}
function wallZ(x0,x1,z0,z1,top){
  box(x0,11,z0,x1,top,z1,P.iv);
  box(x0,11,z0,x1,13,z1,P.st2);
  box(x0-1,top+1,z0,x1+1,top+2,z1,P.ce2);
  box(x0+1,top+3,z0,x1-1,top+3,z1,P.ced);
}
function lattice(cx,cy,z0,z1){
  for(let x=cx-5;x<=cx+5;x++) for(let y=cy-5;y<=cy+5;y++) for(let z=z0;z<=z1;z++){
    const ax=Math.abs(x-cx),ay=Math.abs(y-cy);
    if(ax===5||ay===5) block(x,y,z,P.wd);
    else if((x+y)%3===0||(x-y+99)%3===0) block(x,y,z,P.ce);
    else block(x,y,z,null);
  }
}
wallX(56,87,117,121,32); wallX(113,219,117,121,32);
wallX(30,61,194,198,32); wallX(139,224,194,198,32);
wallZ(220,224,122,193,32); wallZ(30,34,157,193,32);
lattice(46,23,194,198); lattice(172,23,194,198); lattice(200,23,194,198); lattice(160,23,117,121); lattice(196,23,117,121);
box(86,11,114,92,44,124,P.iv); box(108,11,114,114,44,124,P.iv);
box(86,11,114,92,14,124,P.st2); box(108,11,114,114,14,124,P.st2);
box(92,11,115,93,42,123,P.wd); box(107,11,115,108,42,123,P.wd);
box(92,40,115,108,43,123,P.wd);
box(93,41,124,107,42,124,P.ce); box(93,41,114,107,42,114,P.ce);
box(94,11,108,94,38,114,P.wdd); box(106,11,108,106,38,114,P.wdd);
for(const y of [16,22,28,34]) for(const z of [110,113]){ block(95,y,z,P.au); block(105,y,z,P.au); }
box(93,11,116,107,12,122,P.wdd);
for(const sx of [90,100,110]){
  box(sx-2,44,117,sx+2,45,121,P.ce);
  box(sx-1,46,111,sx+1,47,127,P.wd);
  box(sx-2,48,111,sx+2,49,113,P.ce); box(sx-2,48,125,sx+2,49,127,P.ce);
  box(sx-4,48,118,sx+4,49,120,P.wd);
}
box(80,50,111,120,51,113,P.wd); box(80,50,125,120,51,127,P.wd);
{
  const X0=78,X1=122,Z0=104,Z1=134,EV=46,RS=14,DD=15;
  const hS=(x,z)=>{ const dz=Math.min(z-Z0,Z1-z),dx=Math.min(x-X0,X1-x); return EV+RS*Math.pow(dz/DD,1.25)+3*Math.pow(Math.max(0,1-Math.hypot(dx,dz)/10),2); };
  for(let x=X0;x<=X1;x++) for(let z=Z0;z<=Z1;z++){
    const top=Math.floor(hS(x,z)),edge=(x===X0||x===X1||z===Z0||z===Z1),roll=(x%3===0);
    for(let y=top-2;y<=top;y++) block(x,y,z,y<top?P.wd:(edge?P.ced:(roll?P.ce:P.ce2)));
    if(!edge&&roll) block(x,top+1,z,P.ce3);
  }
  for(const gx of [86,114]) for(let z=Z0+2;z<=Z1-2;z++){
    const yt=Math.floor(hS(gx,z))-3;
    for(let y=45;y<=yt;y++) block(gx,y,z,P.iv);
    block(gx+(gx<100?-1:1),Math.floor(hS(gx,z))-1,z,P.wd2);
  }
  box(X0,61,117,X1,62,121,P.ced);
  box(X0-1,61,118,X0+1,65,120,P.au); box(X1-1,61,118,X1+1,65,120,P.au);
}

const PVX=140,PVZ=76;
function hexN(dx,dz,R){
  const a=R*Math.cos(Math.PI/6);
  let m=0;
  for(let k=0;k<6;k++){ const t=Math.PI/6+k*Math.PI/3; m=Math.max(m,(dx*Math.cos(t)+dz*Math.sin(t))/a); }
  return m;
}
for(let x=PVX-24;x<=PVX+24;x++) for(let z=PVZ-24;z<=PVZ+24;z++){
  const dx=x-PVX,dz=z-PVZ,n=hexN(dx,dz,19);
  if(n<=1){
    for(let y=5;y<=11;y++) block(x,y,z,(y===11)?P.st:P.st2);
    block(x,12,z,n>0.93?P.st:(((x+z)%4===0)?P.jt:P.st3));
  } else {
    const t=5*Math.PI/6,ne=(dx*Math.cos(t)+dz*Math.sin(t))/(19*Math.cos(Math.PI/6));
    if(n<=1.16&&ne>=n-0.001) for(let y=5;y<=11;y++) block(x,y,z,y===11?P.st3:P.st2);
  }
}
const PV=[];
for(let k=0;k<6;k++){ const a=k*Math.PI/3; PV.push([PVX+15*Math.cos(a),PVZ+15*Math.sin(a)]); }
for(const v of PV){ cylinder(v[0],13,v[1],2.6,1,P.st2); cylinder(v[0],14,v[1],1.8,25,P.wd); }
for(let k=0;k<6;k++){
  const a=PV[k],b=PV[(k+1)%6];
  beam(a[0],37,a[1],b[0],37,b[1],1.3,P.wd);
  beam(a[0],34.5,a[1],b[0],34.5,b[1],0.7,P.ce);
  for(let t=0.15;t<0.9;t+=0.14){ const x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t; line(R(x),33,R(z),R(x),31,R(z),P.wd2); }
  if(k===2) continue;
  const o=1.07;
  const ax=PVX+(a[0]-PVX)*o,az=PVZ+(a[1]-PVZ)*o,bx=PVX+(b[0]-PVX)*o,bz=PVZ+(b[1]-PVZ)*o;
  beam(a[0],17.5,a[1],b[0],17.5,b[1],1.2,P.wd2);
  beam(ax,23,az,bx,23,bz,0.8,P.wd);
  for(let t=0.1;t<0.95;t+=0.12){
    const x0=a[0]+(b[0]-a[0])*t,z0=a[1]+(b[1]-a[1])*t,x1=ax+(bx-ax)*t,z1=az+(bz-az)*t;
    line(R(x0),18,R(z0),R(x1),23,R(z1),P.wd);
  }
}
for(let k=0;k<6;k++){
  const a=k*Math.PI/3,c=Math.cos(a),s=Math.sin(a);
  const v=PV[k];
  box(R(v[0])-2,39,R(v[1])-2,R(v[0])+2,40,R(v[1])+2,P.ce);
  beam(PVX+13*c,41.5,PVZ+13*s,PVX+21*c,41.5,PVZ+21*s,1.0,P.wd);
  ellipsoid(PVX+20.5*c,43,PVZ+20.5*s,1.8,1.2,1.8,P.ce);
}
for(let k=0;k<6;k++){
  const a=k*Math.PI/3,b=(k+1)*Math.PI/3;
  beam(PVX+20.5*Math.cos(a),44,PVZ+20.5*Math.sin(a),PVX+20.5*Math.cos(b),44,PVZ+20.5*Math.sin(b),1.0,P.wd);
}
{
  const EV=44,RS=24,RR=25;
  for(let x=PVX-27;x<=PVX+27;x++) for(let z=PVZ-27;z<=PVZ+27;z++){
    const dx=x-PVX,dz=z-PVZ,n=hexN(dx,dz,RR); if(n>1) continue;
    const phi=Math.atan2(dz,dx),vc=Math.abs(Math.cos(3*phi));
    const lift=5*Math.pow(Math.max(0,n-0.7)/0.3,2)*Math.pow(vc,6);
    const top=Math.floor(EV+RS*Math.pow(1-n,1.7)+lift);
    const r=Math.hypot(dx,dz);
    const hipLine=Math.abs(Math.sin(3*phi))*r<1.3&&r>2;
    const roll=Math.floor((phi+Math.PI)*48/(2*Math.PI))%2===0;
    for(let y=top-2;y<=top;y++) block(x,y,z,y<top?P.wd:(n>0.97?P.ced:(roll?P.ce:P.ce2)));
    if(hipLine) { block(x,top+1,z,P.ced); if(n>0.95) block(x,top+2,z,P.au); }
    else if(roll&&n<0.97) block(x,top+1,z,P.ce3);
  }
  cylinder(PVX,EV+RS+1,PVZ,2.4,2,P.au);
  ellipsoid(PVX,EV+RS+5,PVZ,2.6,2.6,2.6,P.au2);
  cone(PVX,EV+RS+7,PVZ,1.3,0,5,P.au);
}
cylinder(PVX,13,PVZ,2.5,4,P.st2); cylinder(PVX,17,PVZ,5,1,P.st3);
for(let k=0;k<3;k++){ const a=k*2*Math.PI/3+0.5; cylinder(PVX+8*Math.cos(a),13,PVZ+8*Math.sin(a),1.8,3,P.st); }

box(33,11,48,55,11,154,P.st);
for(let x=34;x<=54;x++) for(let z=49;z<=153;z++) block(x,12,z,(z%6===0||x===34||x===54)?P.jt:P.st3);
const CZS=[];
for(let z=52;z<=148;z+=12) CZS.push(z);
for(const z of CZS){
  for(const cx of [38,50]){ cylinder(cx,13,z,2.4,1,P.st2); cylinder(cx,14,z,1.6,21,P.wd); }
  box(38,35,z,50,36,z,P.wd);
  box(31,36,z-1,38,37,z+1,P.wd); box(31,38,z-1,33,39,z+1,P.ce);
  box(50,36,z-1,57,37,z+1,P.wd); box(55,38,z-1,57,39,z+1,P.ce);
  beam(38,28,z,32.5,35.5,z,0.8,P.wd2); beam(50,28,z,55.5,35.5,z,0.8,P.wd2);
}
box(37,33,50,39,35,150,P.wd); box(49,33,50,51,35,150,P.wd);
box(36,33,51,36,34,149,P.ce); box(52,33,51,52,34,149,P.ce);
box(31,40,48,33,41,154,P.wd); box(55,40,48,57,41,154,P.wd);
box(34,16,51,37,17,149,P.wd2);
box(32,23,51,33,24,149,P.wd);
for(let z=51;z<=149;z+=2) line(35,17,z,33,23,z,P.wd);
for(const lz of [76,112,136]){
  line(44,35,lz,44,31,lz,P.wdd);
  ellipsoid(44,27.5,lz,2.2,2.8,2.2,P.bl);
  box(43,31,lz-1,45,31,lz+1,P.au); box(43,24,lz-1,45,24,lz+1,P.au);
}
{
  const X0=26,X1=62,Z0=46,Z1=154,EV=38,RS=12,DD=18;
  const hC=(x,z)=>{ const dx=Math.min(x-X0,X1-x),dz=Math.min(z-Z0,Z1-z); return EV+RS*Math.pow(dx/DD,1.2)+2.5*Math.pow(Math.max(0,1-Math.hypot(dx,dz)/9),2); };
  for(let x=X0;x<=X1;x++) for(let z=Z0;z<=Z1;z++){
    const top=Math.floor(hC(x,z)),edge=(x===X0||x===X1||z===Z0||z===Z1),roll=(z%3===0);
    for(let y=top-2;y<=top;y++) block(x,y,z,y<top?P.wd:(edge?P.ced:(roll?P.ce:P.ce2)));
    if(!edge&&roll) block(x,top+1,z,P.ce3);
  }
  for(const gz of [50,150]) for(let x=34;x<=54;x++){
    const yt=Math.floor(hC(x,gz))-3;
    for(let y=37;y<=yt;y++) block(x,y,gz,P.iv);
  }
  box(43,51,Z0,45,52,Z1,P.ced);
  box(43,51,Z0-1,45,54,Z0+1,P.au); box(43,51,Z1-1,45,54,Z1+1,P.au);
}
box(127,11,121,147,12,132,P.st2);
box(128,13,122,146,38,131,P.wd);
box(129,15,132,136,36,132,P.wd2);
box(130,17,133,135,24,133,P.ce); box(130,27,133,135,34,133,P.ce);
block(129,19,133,P.au); block(129,32,133,P.au); box(135,25,134,135,26,134,P.au);
box(137,15,124,145,36,131,null);
box(137,22,124,145,22,131,P.wd); box(137,29,124,145,29,131,P.wd);
box(146,15,132,146,36,139,P.wd2);
box(147,17,133,147,24,138,P.ce); box(147,27,133,147,34,138,P.ce);
cylinder(139,23,127,1.6,3,P.st); cylinder(143,23,127,1.4,4,P.ce2);
box(139,30,125,144,31,130,P.ce); box(139,32,125,144,33,130,P.iv2);
cylinder(141,15,127,2.2,4,P.au); line(143,17,127,145,19,129,P.au);
box(126,39,120,148,40,133,P.wd2);
box(126,41,120,148,41,134,P.ce2); box(127,42,122,147,42,132,P.ce); box(127,43,125,147,43,129,P.ced);
for(const p of [[152,126,3],[152,131,2.5],[156,128,2.2]]){ cylinder(p[0],11,p[1],p[2],5,P.st); cylinder(p[0],15,p[1],p[2]+0.6,1,P.au); }
line(123,13,134,127,33,129,P.wd2);
ellipsoid(123,13,134,1.6,2.5,2,P.ea);

function carve(cx,cy,cz,r){
  for(let x=Math.floor(cx-r);x<=Math.ceil(cx+r);x++) for(let y=Math.floor(cy-r);y<=Math.ceil(cy+r);y++) for(let z=Math.floor(cz-r);z<=Math.ceil(cz+r);z++)
    if((x-cx)*(x-cx)+(y-cy)*(y-cy)+(z-cz)*(z-cz)<=r*r) block(x,y,z,null);
}
{
  const tr=[[72,11,80],[73,24,79],[76,36,76],[80,46,72],[84,54,70]];
  for(let i=0;i<tr.length-1;i++){ const a=tr[i],b=tr[i+1]; beam(a[0],a[1],a[2],b[0],b[1],b[2],3.2-i*0.5,P.wdd); }
  const pads=[[[74,34,78],[70,42,90,7,2.6,6]],[[77,38,75],[90,44,82,8,2.8,7]],[[79,44,73],[68,52,64,8,2.8,6]],[[82,50,71],[94,56,64,7,2.5,6]],[[84,54,70],[84,61,74,9,3,8]]];
  for(const p of pads){
    const s=p[0],c=p[1];
    beam(s[0],s[1],s[2],c[0],c[1]-1,c[2],1.3,P.wdd);
    ellipsoid(c[0],c[1],c[2],c[3],c[4],c[5],P.pn);
    ellipsoid(c[0],c[1]+0.9,c[2],c[3]-1.5,c[4]-0.9,c[5]-1.5,P.lf3);
  }
}
{
  beam(190,11,150,188,40,148,2.6,P.wdd);
  beam(188,34,148,181,46,143,1.4,P.wdd); beam(188,36,148,198,48,155,1.4,P.wdd); beam(188,38,149,186,46,158,1.2,P.wdd);
  for(const c of [[182,50,144,9,7,9,P.lf1],[198,52,154,9,7,9,P.lf2],[190,58,150,10,7,10,P.lf1],[186,48,159,7,6,7,P.lf2],[194,46,142,6,5,6,P.lf3]])
    ellipsoid(c[0],c[1],c[2],c[3],c[4],c[5],c[6]);
  for(let i=0;i<14;i++){ const a=rng()*Math.PI*2,r=6+rng()*6; block(R(190+Math.cos(a)*r),R(56+rng()*6),R(150+Math.sin(a)*r),P.bl); }
}
for(const b of [[114,46,52],[118,48,44],[122,52,50],[116,54,40],[121,45,58],[125,49,42],[112,51,58]]){
  cylinder(b[0],11,b[1],0.9,b[2]-10,P.lf2);
  for(let y=18;y<b[2];y+=8) block(b[0],y,b[1],P.lf3);
  ellipsoid(b[0]+1,b[2]-2,b[1],3.5,2.5,3,P.lf1);
  ellipsoid(b[0]-2,b[2]-8,b[1]+1,2.5,1.8,2.2,P.lf2);
}
function taihu(cx,cz,h,s){
  for(let i=0;i<6;i++){
    const y=11+i*h/6,ox=(rng()-0.5)*s,oz=(rng()-0.5)*s;
    ellipsoid(cx+ox,y+h/12,cz+oz,s*(0.9-i*0.08),h/7,s*(0.8-i*0.07),i%2?P.rk:P.rk2);
  }
  for(let i=0;i<3;i++) carve(cx+(rng()-0.5)*s*0.8,11+h*(0.3+rng()*0.5),cz+(rng()-0.5)*s*0.8,1.5);
}
taihu(212,98,20,7); taihu(200,44,14,6); taihu(172,150,16,6); taihu(86,100,12,5);
for(let i=0;i<40&&true;i++){
  const x=150+Math.floor(rng()*62),z=48+Math.floor(rng()*50);
  if(pondQ(x,z)>0.8||hexN(x-PVX,z-PVZ,19)<1.15) continue;
  const r=1.8+rng()*1.8;
  cylinder(x,9,z,r,1,P.lo);
  block(x,9,z,P.lf3);
  if(rng()<0.35){ block(x+1,10,z,P.lo); ellipsoid(x+1,12,z,1.2,1.8,1.2,P.bl); block(x+1,13,z,P.au2); }
}
for(const px of [72,128]){
  cylinder(px,11,206,4.2,6,P.ce2); ring(px,16,206,4.2,0.6,P.au,'y');
  ellipsoid(px,20,206,5,3.5,5,P.lf1);
  for(let i=0;i<5;i++) block(px-3+Math.floor(rng()*7),23,206-2+Math.floor(rng()*5),P.bl);
}
for(const s of [[152,189],[186,189],[212,188],[40,186],[210,130]]) ellipsoid(s[0],13,s[1],5,4,3.5,rng()<0.5?P.lf1:P.lf3);

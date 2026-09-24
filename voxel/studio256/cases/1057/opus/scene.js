const P={
 in1:'#1f2a52',in2:'#2e3d6e',in3:'#475a8f',
 pg1:'#1f4d3a',pg2:'#2f6b4e',pg3:'#4d8a63',pg4:'#6fa77a',
 au1:'#d8c07a',au2:'#ebd9a0',au3:'#b89a52',gl1:'#bcd6cf',gl2:'#d6e6de',
 st1:'#c9c3b5',st2:'#a9a396',st3:'#8f8a7f',gv:'#b8b0a0',gr:'#6f8f5c',gr2:'#5c7a4c',so:'#6b5640',
 wa:'#2c4a6e',wa2:'#3d5f86',wd:'#8a6a48',wd2:'#a8845a',fl1:'#e8c860',fl2:'#7b6fb8',fl3:'#f0e6c8',pt:'#7a6650'
};
const CX=112,CZ=118,R=Math.round;
function rrDist(x,z,x0,x1,z0,z1,r){
  const qx=Math.max(x0+r-x,x-(x1-r),0),qz=Math.max(z0+r-z,z-(z1-r),0);
  if(qx>0&&qz>0) return r-Math.hypot(qx,qz);
  return Math.min(x-x0,x1-x,z-z0,z1-z);
}
function angD(a,b){ let d=a-b; while(d>Math.PI) d-=2*Math.PI; while(d<-Math.PI) d+=2*Math.PI; return d; }
function segDist(x,z,ax,az,bx,bz){
  const vx=bx-ax,vz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*vx+(z-az)*vz)/(vx*vx+vz*vz)));
  return Math.hypot(x-ax-vx*t,z-az-vz*t);
}
function groundColor(x,z,rc,e){
  if(e<1.5) return P.st3;
  if(rc>=67&&rc<=71) return P.gv;
  if(Math.hypot(x-192,z-194)<=19||Math.hypot(x-204,z-96)<=15) return ((x+z)%6===0||(x-z+300)%6===0)?P.st2:P.st1;
  if(segDist(x,z,186,160,190,176)<=3.5||segDist(x,z,186,156,203,111)<=3.5) return P.gv;
  const n=Math.sin(x*0.07)*Math.cos(z*0.09)+0.4*Math.sin(x*0.19+z*0.13);
  return n>0.6?P.gr2:P.gr;
}
for(let x=36;x<=226;x++) for(let z=40;z<=224;z++){
  const e=rrDist(x,z,36,226,40,224,12); if(e<0) continue;
  const rc=Math.hypot(x-CX,z-CZ);
  if(rc<=66){
    let top=13;
    if(rc<30) top=rc>=27?13:(rc>=25?12:(rc>=23?11:(rc>=21?10:(rc>=19?9:8))));
    const pond=rc<12&&rc>=4;
    for(let y=4;y<=top;y++){
      if(pond&&y>=6){ if(y<=7) block(x,y,z,(y===7&&((x*3+z)%7===0))?P.wa2:P.wa); continue; }
      let c=P.st2;
      if(y===top){
        if(rc>64.5) c=P.st3;
        else if(rc>=19) c=P.st1;
        else if(rc<4) c=P.gr;
        else if(rc>=12&&rc<13.2) c=P.st2;
        else c=(rc>=15.5&&rc<=17.5)?P.gv:(((x+z)%5===0)?P.gr2:P.gr);
      }
      block(x,y,z,c);
    }
    continue;
  }
  const full=e<3;
  for(let y=4;y<=8;y++){ if(!full&&y>4&&y<8) continue; block(x,y,z,P.so); }
  block(x,9,z,groundColor(x,z,rc,e));
}
const TE=Math.PI/6,CE=Math.cos(TE),SE=Math.sin(TE);
function toUV(x,z){ const dx=x-CX,dz=z-CZ; return [dx*CE+dz*SE,-dx*SE+dz*CE]; }
for(let x=150;x<=200;x++) for(let z=128;z<=176;z++){
  const uv=toUV(x,z),u=uv[0],v=uv[1];
  if(u>=58&&u<=76&&Math.abs(v)<=10){ for(let y=10;y<=13;y++) block(x,y,z,y===13?P.st1:P.st2); }
  else if(u>76&&u<=82&&Math.abs(v)<=6){ const t=u<=78?12:(u<=80?11:10); for(let y=10;y<=t;y++) block(x,y,z,y===t?P.st1:P.st2); }
}

const RIN=30,ROUT=62,FL=14,HW=26,NB=40,DT=2*Math.PI/NB;
function apexH(th){ const c=Math.max(0,Math.cos(th+Math.PI/2)); return 46+16*c*c*c; }
function sOf(r){ return (r-RIN)/(ROUT-RIN); }
function vaultY(r,th){ const s=Math.min(1,Math.max(0,sOf(r))); return HW+(apexH(th)-HW)*Math.pow(Math.sin(Math.PI*s),0.6); }
function ribD(th,r){ const k=Math.round(th/DT); return Math.abs(th-k*DT)*r; }
function bayOf(th){ return ((Math.floor(th/DT)%NB)+NB)%NB; }
function vTop(x,z){ const r=Math.hypot(x-CX,z-CZ); if(r<RIN-0.5||r>ROUT+0.5) return HW; return Math.floor(vaultY(r,Math.atan2(z-CZ,x-CX))); }
for(let x=CX-ROUT-1;x<=CX+ROUT+1;x++) for(let z=CZ-ROUT-1;z<=CZ+ROUT+1;z++){
  const r=Math.hypot(x-CX,z-CZ); if(r<RIN-0.5||r>ROUT+0.5) continue;
  const th=Math.atan2(z-CZ,x-CX),s=sOf(r);
  const top=vTop(x,z);
  const nb=Math.min(vTop(x+1,z),vTop(x-1,z),vTop(x,z+1),vTop(x,z-1));
  const bot=Math.min(top,nb+1);
  const rib=ribD(th,r)<0.75;
  let pur=false; for(const sj of [0.12,0.3,0.7,0.88]) if(Math.abs(s-sj)*32<0.6) pur=true;
  const lantern=Math.abs(r-46)<=1.6;
  for(let y=bot;y<=top;y++){
    let c=null;
    if(rib) c=P.in1;
    else if(pur||lantern) c=P.in2;
    else if(s>0.18&&s<0.82&&bayOf(th)%2===0) c=P.gl1;
    if(c) block(x,y,z,c);
  }
  if(lantern) for(let y=top+1;y<=top+3;y++) block(x,y,z,(y===top+3||rib)?P.au1:P.gl2);
}
for(let x=CX-ROUT-2;x<=CX+ROUT+2;x++) for(let z=CZ-ROUT-2;z<=CZ+ROUT+2;z++){
  const r=Math.hypot(x-CX,z-CZ);
  const outer=Math.abs(r-ROUT)<=0.5,inner=Math.abs(r-RIN)<=0.5;
  if(!outer&&!inner) continue;
  const th=Math.atan2(z-CZ,x-CX),rr=outer?ROUT:RIN;
  const door=Math.abs(angD(th,TE))*rr<=(outer?5:4);
  const mull=ribD(th,rr)<0.75;
  for(let y=FL;y<=HW;y++){
    if(door&&y<=(outer?28:24)) continue;
    let c=null;
    if(y<=FL+1) c=P.in2;
    else if(mull||y===HW||y===FL+7) c=P.in1;
    else if(y>=HW-5&&bayOf(th)%2===1) c=P.gl2;
    if(c) block(x,y,z,c);
  }
  if(!door) block(x,HW+1,z,P.in3);
}
for(let k=0;k<NB;k+=4){
  const th=k*DT; if(Math.abs(angD(th,TE))<0.2) continue;
  const c=Math.cos(th),s=Math.sin(th);
  beam(CX+63*c,23,CZ+63*s,CX+66.5*c,15,CZ+66.5*s,1.1,P.in1);
  box(R(CX+66*c)-1,14,R(CZ+66*s)-1,R(CX+66*c)+1,15,R(CZ+66*s)+1,P.in2);
  block(R(CX+63.5*c),24,R(CZ+63.5*s),P.au1);
}
for(let a=-5;a<=5;a+=0.5){
  const th=TE+a/30,x=R(CX+30*Math.cos(th)),z=R(CZ+30*Math.sin(th));
  if(Math.abs(a)>=4.5) for(let y=14;y<=25;y++) block(x,y,z,P.au1);
  block(x,25,z,P.au1); block(x,26,z,P.au1);
}

for(let x=150;x<=200;x++) for(let z=128;z<=176;z++){
  const uv=toUV(x,z),u=uv[0],v=uv[1];
  if(u<59.5||u>76.5||Math.abs(v)>9.5) continue;
  const av=Math.abs(v),rf=w=>30+6*Math.sqrt(Math.max(0,1-(w/9.5)*(w/9.5)));
  const top=Math.floor(rf(av)),bot=Math.min(top,Math.floor(rf(Math.min(9.5,av+1)))+1);
  const onRib=[60,64,68,72,76].some(q=>Math.abs(u-q)<0.55);
  for(let y=bot;y<=top;y++) block(x,y,z,(onRib||av<0.6||av>9)?P.au1:P.gl1);
  if(av>=8.5) for(let y=14;y<bot;y++){
    const c=y<=15?P.in2:((onRib||y===22||y===29)?P.au1:(y>22?P.gl2:null));
    if(c) block(x,y,z,c);
  }
  if(u>=75.5) for(let y=14;y<bot;y++){
    if(av<=4.5&&y<=26){ if(av>=3.5||y===26) block(x,y,z,P.au1); continue; }
    block(x,y,z,y<=15?P.in2:((av>=8.5||y===22||y===27||av<0.6)?P.au1:P.gl2));
  }
}
function inPath(r,th){ return Math.abs(angD(th,TE))*r<=3.5; }
function bedCell(r,th){ if(inPath(r,th)) return false; return (r>30.8&&r<37.6)||(r>41.4&&r<61.3); }
for(let x=CX-62;x<=CX+62;x++) for(let z=CZ-62;z<=CZ+62;z++){
  const r=Math.hypot(x-CX,z-CZ); if(r<30.5||r>61.5) continue;
  const th=Math.atan2(z-CZ,x-CX);
  if(bedCell(r,th)) block(x,13,z,((x*5+z*3)%7===0)?P.gr2:P.so);
  else if(Math.abs(r-38)<0.6||Math.abs(r-41)<0.6) block(x,13,z,P.st2);
}
const PALM=[-2.5,-2.0,-1.57,-1.14,-0.64];
function nearPalm(th,r){ for(const a of PALM) if(Math.hypot(r*Math.cos(th)-46*Math.cos(a),r*Math.sin(th)-46*Math.sin(a))<11) return true; return false; }
const BENCH_TH=1.3;
function nearBench(th,r){ return Math.abs(angD(th,BENCH_TH))*r<9&&r>41; }
for(let i=0;i<150;i++){
  const th=rng()*Math.PI*2,inner=rng()<0.35;
  const r=inner?32.5+rng()*3.5:43+rng()*16.5;
  if(inPath(r,th)||nearPalm(th,r)||nearBench(th,r)) continue;
  const x=CX+r*Math.cos(th),z=CZ+r*Math.sin(th);
  const lim=vaultY(r,th)-16;
  const h=Math.min(lim,2.5+rng()*4);
  const c=[P.pg1,P.pg2,P.pg3][Math.floor(rng()*3)];
  if(rng()<0.3&&Math.cos(th+Math.PI/2)<0.2){
    ellipsoid(x,14.5,z,2.6,1.6,2.6,P.pg3);
    for(let k=0;k<4;k++) block(R(x+(rng()-0.5)*4),16,R(z+(rng()-0.5)*4),[P.fl1,P.fl2,P.fl3][k%3]);
  } else {
    ellipsoid(x,13.5+h*0.6,z,h*0.8+1,h*0.7,h*0.8+1,c);
    if(rng()<0.5) ellipsoid(x+1,13.5+h*1.1,z-1,h*0.5,h*0.45,h*0.5,P.pg4);
  }
}
for(const a of PALM){
  const px=CX+46*Math.cos(a),pz=CZ+46*Math.sin(a);
  const H=Math.floor(vaultY(46,a))-10;
  for(let y=14;y<=H;y++){
    const t=(y-14)/(H-14),rr=1.9-0.6*t,ox=0.8*Math.sin(t*2.2);
    for(let x=Math.floor(px-2);x<=Math.ceil(px+2);x++) for(let z=Math.floor(pz-2);z<=Math.ceil(pz+2);z++)
      if(Math.hypot(x-px-ox,z-pz)<=rr) block(x,y,z,(y%3===0)?P.au3:P.pt);
  }
  const tx=px+0.8*Math.sin(2.2),L=8;
  for(let j=0;j<9;j++){
    const ph=j*2*Math.PI/9+a;
    let prev=[tx,H,pz];
    for(let d=1;d<=L;d++){
      const f=d/L,p=[tx+d*Math.cos(ph),H+3*f-7*f*f,pz+d*Math.sin(ph)];
      beam(prev[0],prev[1],prev[2],p[0],p[1],p[2],0.6,P.pg2);
      if(d>1&&d<L){ block(R(p[0]-Math.sin(ph)*1.3),R(p[1]-0.6),R(p[2]+Math.cos(ph)*1.3),P.pg3); block(R(p[0]+Math.sin(ph)*1.3),R(p[1]-0.6),R(p[2]-Math.cos(ph)*1.3),P.pg3); }
      prev=p;
    }
  }
  ellipsoid(tx,H+0.5,pz,1.8,1.4,1.8,P.au3);
}
{
  const bx=R(CX+50*Math.cos(BENCH_TH)),bz=R(CZ+50*Math.sin(BENCH_TH));
  box(bx-6,20,bz-3,bx+6,21,bz+3,P.wd2);
  for(const dx of [-5,5]) for(const dz of [-2,2]) box(bx+dx,14,bz+dz,bx+dx,19,bz+dz,P.wd);
  box(bx-5,15,bz-2,bx+5,15,bz+2,P.wd);
  for(let i=0;i<5;i++){ const x=bx-4+i*2; cylinder(x,22,bz-1,0.9,2,P.au3); block(x,24,bz-1,P.pg4); }
  cylinder(bx+3,22,bz+1.5,1.4,3,P.in3); line(bx+4,24,R(bz+1.5),bx+6,25,bz+2,P.in3);
  for(let i=0;i<3;i++) cylinder(bx-4+i*3,16,bz+1,1,2,P.st2);
}
for(const th of [2.2,3.4,4.2]){
  const x=R(CX+39.5*Math.cos(th)),z=R(CZ+39.5*Math.sin(th));
  box(x-2,14,z-2,x+2,15,z+2,P.wd2); box(x-2,16,z-2,x+2,16,z+2,P.wd);
}

{
  const tr=[[112,8,118],[112,24,118],[113,38,117],[113,52,117]];
  for(let i=0;i<tr.length-1;i++){ const a=tr[i],b=tr[i+1]; beam(a[0],a[1],a[2],b[0],b[1],b[2],3.4-i*0.7,P.pt); }
  beam(112,8,118,108,9,121,1.6,P.pt); beam(112,8,118,116,9,115,1.6,P.pt);
  const cl=[];
  for(let i=0;i<7;i++){ const a=i*2*Math.PI/7+0.3; cl.push([112+11*Math.cos(a),64+(i%3)*3,118+11*Math.sin(a)]); }
  cl.push([113,76,117]); cl.push([110,70,121]);
  for(const c of cl){
    beam(113,48,117,c[0],c[1]-3,c[2],1.2,P.pt);
    ellipsoid(c[0],c[1],c[2],8,5.5,8,P.pg2);
    ellipsoid(c[0]+1,c[1]+2,c[2]-1,5.5,3.5,5.5,P.pg3);
  }
  ellipsoid(112,70,118,12,6,12,P.pg1);
  for(let i=0;i<70;i++){
    const c=cl[Math.floor(rng()*cl.length)],a=rng()*Math.PI*2,b=rng()*1.2+0.2;
    const x=R(c[0]+7.6*Math.cos(a)*Math.cos(b)),y=R(c[1]+5.2*Math.sin(b)),z=R(c[2]+7.6*Math.sin(a)*Math.cos(b));
    block(x,y,z,rng()<0.7?P.fl1:P.au2);
  }
}
for(let d=3;d<=14;d++){
  const t=(d-3)/11,y=R(8+3.2*Math.sin(Math.PI*t));
  for(let w=-2;w<=2;w++){
    const x=R(CX+d*CE-w*SE),z=R(CZ+d*SE+w*CE);
    block(x,y,z,(d%2===0)?P.wd:P.wd2);
    if(Math.abs(w)===2){ block(x,y+1,z,P.au3); if(d%3===0) block(x,y+2,z,P.au1); }
  }
}
for(const th of [2.1,3.6,5.0,0.9]){
  const x=R(CX+20*Math.cos(th)),z=R(CZ+20*Math.sin(th));
  cylinder(x,10,z,0.8,14,P.in1); box(x-1,24,z-1,x+1,26,z+1,P.au2); block(x,27,z,P.in1);
}
{
  const X=192,Z=194;
  cylinder(X,10,Z,16,2,P.st1); ring(X,11,Z,15.5,0.6,P.in3,'y');
  cylinder(X,12,Z,2,33,P.in1);
  for(let y=12;y<=28;y++) for(let x=X-6;x<=X+6;x++) for(let z=Z-6;z<=Z+6;z++){
    const r=Math.hypot(x-X,z-Z); if(r>6||r<2.5) continue;
    let c=P.wd;
    if(y%4!==0&&r>5){ const a=Math.atan2(z-Z,x-X),slot=Math.floor((a+Math.PI)*36/(2*Math.PI)); c=(slot%7===0)?P.wd2:[P.au1,P.in2,P.pg2,P.fl3,P.fl2,P.in3][slot%6]; }
    block(x,y,z,c);
  }
  for(let x=X-20;x<=X+20;x++) for(let z=Z-20;z<=Z+20;z++){
    const r=Math.hypot(x-X,z-Z); if(r>19.5) continue;
    const a=Math.atan2(z-Z,x-X),top=R(45-3*(r/19.5)*(r/19.5));
    const edge=r>18.4,rib=Math.abs(Math.sin(6*a))*r<0.8;
    block(x,top,z,edge?P.in2:((Math.floor((a+Math.PI)*12/Math.PI)%2)?P.pg1:P.pg2));
    block(x,top-1,z,edge?P.in2:(rib?P.au1:P.in1));
    if(!edge&&Math.abs(r-14)<0.6&&Math.floor((a+Math.PI)*16/Math.PI)%2===0) block(x,top-2,z,P.au2);
  }
  for(let k=0;k<3;k++){
    const a=k*2*Math.PI/3+0.4,cx=X+11*Math.cos(a),cz=Z+11*Math.sin(a);
    ellipsoid(cx,13.5,cz,2.8,1.6,2.8,P.wd2);
    ellipsoid(cx+1.8*Math.cos(a),16,cz+1.8*Math.sin(a),1.6,2.8,2.6,P.in2);
    cylinder(cx,12,cz,1,1,P.wd);
  }
  cylinder(X-9,12,Z-7,0.6,14,P.au3); ellipsoid(X-9,27,Z-7,1.8,1.4,1.8,P.au2);
  cylinder(X+6,12,Z+11,1.6,4,P.wd); box(X+4,16,Z+10,X+8,16,Z+12,P.fl3);
  for(const a of [0,1.3,2.6,3.9,5.2]){ const px=R(X+15*Math.cos(a)),pz=R(Z+15*Math.sin(a)); cylinder(px,12,pz,1.6,3,P.au3); ellipsoid(px,16.5,pz,2.2,2,2.2,P.pg3); }
}
{
  const X=204,Z=96;
  const oct=(x,z,r)=>{ let m=0; for(let k=0;k<8;k++){ const t=k*Math.PI/4; m=Math.max(m,(x-X)*Math.cos(t)+(z-Z)*Math.sin(t)); } return m<=r; };
  for(let x=X-13;x<=X+13;x++) for(let z=Z-13;z<=Z+13;z++){
    if(oct(x,z,12)) box(x,10,z,x,11,z,P.in2);
    if(oct(x,z,10)) box(x,12,z,x,13,z,P.in1);
    if(oct(x,z,8)) box(x,14,z,x,15,z,P.in2);
  }
  ring(X,16,Z,7,0.6,P.au1,'y'); ring(X,30,Z,7,0.5,P.au1,'y'); ring(X,44,Z,7,0.6,P.au1,'y');
  for(let k=0;k<8;k++){ const a=k*Math.PI/4; cylinder(X+7*Math.cos(a),16,Z+7*Math.sin(a),0.7,29,P.au1); }
  for(let y=33;y<=42;y++) for(let x=X-8;x<=X+8;x++) for(let z=Z-8;z<=Z+8;z++){
    const r=Math.hypot(x-X,z-Z); if(Math.abs(r-7)>0.5) continue;
    const a=Math.atan2(z-Z,x-X); if(Math.floor((a+Math.PI)*4/Math.PI)%2===0) block(x,y,z,P.gl1);
  }
  cylinder(X,16,Z,3,6,P.in1); cylinder(X,22,Z,3.6,1,P.au3);
  beam(X,23,Z,X,33,Z,0.8,P.pg2);
  ellipsoid(X-2.5,27,Z,2.8,0.9,1.6,P.pg3); ellipsoid(X+2.5,29,Z+0.5,2.8,0.9,1.6,P.pg3);
  for(let k=0;k<6;k++){ const a=k*Math.PI/3; ellipsoid(X+2.4*Math.cos(a),35,Z+2.4*Math.sin(a),1.8,1,1.8,P.fl1); }
  ellipsoid(X,35.5,Z,1.3,1.2,1.3,P.fl2);
  ellipsoid(X,45,Z,7.6,3.6,7.6,P.au3); cone(X,48,Z,1.4,0,5,P.au1);
  for(const a of [0.8,2.4,3.9,5.5]){ const px=R(X+10.5*Math.cos(a)),pz=R(Z+10.5*Math.sin(a)); cylinder(px,12,pz,0.9,5,P.in1); block(px,17,pz,P.au2); }
  for(const p of [[X-16,Z+2],[X+15,Z-4]]){ box(p[0]-1,10,p[1]-3,p[0]+1,16,p[1]+3,P.in2); box(p[0]-1,17,p[1]-3,p[0]+1,17,p[1]+3,P.au3); }
}
for(const p of [[176,182],[214,168],[178,108],[214,122],[60,196],[48,70]]){
  cylinder(p[0],10,p[1],0.8,16,P.in1); ellipsoid(p[0],27,p[1],1.6,1.8,1.6,P.au2); block(p[0],29,p[1],P.in1);
}
for(let i=0;i<18;i++){
  const x=40+Math.floor(rng()*184),z=44+Math.floor(rng()*178);
  const rc=Math.hypot(x-CX,z-CZ);
  if(rc<74||Math.hypot(x-192,z-194)<24||Math.hypot(x-204,z-96)<20||rrDist(x,z,36,226,40,224,12)<6) continue;
  if(segDist(x,z,186,160,190,176)<6||segDist(x,z,186,156,203,111)<6) continue;
  ellipsoid(x,11,z,3.5+rng()*2,2.5+rng(),3.5+rng()*2,rng()<0.5?P.pg2:P.pg1);
  if(rng()<0.5) block(x,14,z,P.fl1);
}

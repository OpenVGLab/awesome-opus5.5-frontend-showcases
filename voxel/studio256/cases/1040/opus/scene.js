const C={
 bw1:'#6b4629',bw2:'#8a5d36',bw3:'#a8764a',felt:'#3b3a3e',felt2:'#46444a',trim:'#b0905a',
 sc1:'#2e2f33',sc2:'#4a4c51',sb:'#b8944f',spw:'#7b4f2b',
 o1:'#a8733f',o2:'#7e5230',op:'#cdae70',
 m1:'#35363a',m2:'#595b60',mt:'#b99a5b',
 i1:'#c7a463',i2:'#9b7c44',
 k1:'#dcc79c',k2:'#5a4330',kp:'#e3cf98',
 d1:'#b8864f',d2:'#946439',dc:'#303136',db:'#c9a466',
 bb:'#d9b672',aw:'#7f5634',ac:'#26262a',
 pw:'#c29059',pe:'#8f6139',mar1:'#d0ae6a',mar2:'#3e4045',trk:'#b39255'
};
const R=Math.round;
function rodX(x0,x1,y,z,r,c){
  for(let x=x0;x<=x1;x++) for(let yy=Math.floor(y-r);yy<=Math.ceil(y+r);yy++) for(let zz=Math.floor(z-r);zz<=Math.ceil(z+r);zz++)
    if((yy-y)*(yy-y)+(zz-z)*(zz-z)<=r*r) block(x,yy,zz,c);
}
function rodZ(z0,z1,x,y,r,c){
  for(let z=z0;z<=z1;z++) for(let xx=Math.floor(x-r);xx<=Math.ceil(x+r);xx++) for(let yy=Math.floor(y-r);yy<=Math.ceil(y+r);yy++)
    if((xx-x)*(xx-x)+(yy-y)*(yy-y)<=r*r) block(xx,yy,z,c);
}
function rrDist(x,z,x0,x1,z0,z1,r){
  const qx=Math.max(x0+r-x,x-(x1-r),0),qz=Math.max(z0+r-z,z-(z1-r),0);
  if(qx>0&&qz>0) return r-Math.hypot(qx,qz);
  return Math.min(x-x0,x1-x,z-z0,z1-z);
}
for(let x=32;x<=224;x++) for(let z=46;z<=206;z++){
  const e=rrDist(x,z,32,224,46,206,14); if(e<0) continue;
  for(let y=4;y<=8;y++) block(x,y,z,y===6?C.bw2:C.bw1);
  block(x,9,z,e<5?(e<1?C.bw2:C.bw3):C.felt);
}
for(let x=38;x<=218;x++) for(let z=50;z<=124;z++){
  const e=rrDist(x,z,38,218,50,124,10); if(e<0) continue;
  for(let y=10;y<=16;y++) block(x,y,z,(y===15&&e<1)?C.trim:C.bw2);
  block(x,17,z,e<4?C.bw3:C.felt2);
}

const GX=128,GY=80,GZ=86;
cone(GX,18,GZ,13,10,3,C.sc1);
cylinder(GX,21,GZ,6,8,C.spw);
cylinder(GX,24,GZ,6.8,1,C.sb);
cylinder(GX,29,GZ,8,2,C.sc2);
for(let x=GX-50;x<=GX+50;x++) for(let y=GY-50;y<=GY;y++){
  const r=Math.hypot(x-GX,y-GY); if(r<45||r>49) continue;
  for(let z=GZ-3;z<=GZ+3;z++) block(x,y,z,(Math.abs(z-GZ)===3||r>48.4)?C.sc2:C.sc1);
}
rodX(GX+44,GX+51,GY,GZ,4.5,C.sb); rodX(GX-51,GX-44,GY,GZ,4.5,C.sb);
rodX(GX+52,GX+53,GY,GZ,2.6,C.sc2); rodX(GX-53,GX-52,GY,GZ,2.6,C.sc2);
for(let x=GX-40;x<=GX+40;x++) for(let y=GY-40;y<=GY+40;y++){
  const r=Math.hypot(x-GX,y-GY); if(Math.abs(r-38)>1.25) continue;
  const a=Math.atan2(y-GY,x-GX),k=Math.round(a/(Math.PI/6)),stud=Math.abs(a-k*Math.PI/6)*38<1.1;
  for(let z=GZ-2;z<=GZ+2;z++){
    let c=C.o1;
    if(r>38.4&&z===GZ) c=C.o2;
    if(stud&&Math.abs(z-GZ)===2&&r>37.2&&r<38.8) c=C.op;
    block(x,y,z,c);
  }
}
rodX(GX+39,GX+43,GY,GZ,1.5,C.op); rodX(GX-43,GX-39,GY,GZ,1.5,C.op);
cylinder(GX,GY+39,GZ,2.2,3,C.op); cylinder(GX,GY-41,GZ,2.2,3,C.op);
for(let y=GY-32;y<=GY+32;y++) for(let z=GZ-32;z<=GZ+32;z++){
  const r=Math.hypot(y-GY,z-GZ); if(Math.abs(r-30)>1.25) continue;
  const a=Math.atan2(z-GZ,y-GY),k=Math.round(a/(Math.PI/12)),tick=Math.abs(a-k*Math.PI/12)*30<0.6;
  for(let x=GX-2;x<=GX+2;x++){
    let c=(Math.abs(x-GX)===2)?C.m2:C.m1;
    if(tick&&r>30.3&&Math.abs(x-GX)<=1) c=C.mt;
    block(x,y,z,c);
  }
}
cylinder(GX,GY+31,GZ,1.4,6,C.mt); cylinder(GX,GY-36,GZ,1.4,6,C.mt);
for(let x=GX-24;x<=GX+24;x++) for(let z=GZ-24;z<=GZ+24;z++){
  const r=Math.hypot(x-GX,z-GZ); if(Math.abs(r-22)>1.25) continue;
  for(let y=GY-2;y<=GY+2;y++) block(x,y,z,(y===GY&&r>22.4)?C.i2:C.i1);
}
rodZ(GZ+23,GZ+28,GX,GY,1.4,C.i2); rodZ(GZ-28,GZ-23,GX,GY,1.4,C.i2);
for(let x=GX-11;x<=GX+11;x++) for(let y=GY-11;y<=GY+11;y++) for(let z=GZ-11;z<=GZ+11;z++){
  const d=Math.hypot(x-GX,y-GY,z-GZ); if(d>10.6) continue;
  const a=Math.atan2(z-GZ,y-GY);
  let c=(a>0&&a<Math.PI/2)?C.k2:C.k1;
  if(Math.abs(x-GX)<=1) c=C.kp;
  else if(Math.abs(a+Math.PI*0.75)<0.2) c=C.k2;
  block(x,y,z,c);
}
rodX(GX+11,GX+20,GY,GZ,1.3,C.kp); rodX(GX-20,GX-11,GY,GZ,1.3,C.kp);
rodX(GX+10,GX+11,GY,GZ,2.6,C.k2); rodX(GX-11,GX-10,GY,GZ,2.6,C.k2);

const PX=113,PY=27,DZ=157,S=0.0751;
function dyS(x){ return (x-PX)*S; }
box(66,10,148,84,26,166,C.aw);
box(66,27,148,84,27,166,C.ac);
box(66,24,148,84,24,148,C.bw3); box(66,24,166,84,24,166,C.bw3);
for(let k=0;k<4;k++){ box(62-4*k,10,150,65-4*k,23-4*k,164,C.aw); box(62-4*k,23-4*k,150,65-4*k,23-4*k,164,C.bw3); }
box(142,10,148,160,25,166,C.aw);
box(142,26,148,160,26,166,C.ac);
box(142,23,148,160,23,148,C.bw3); box(142,23,166,160,23,166,C.bw3);
for(let k=0;k<4;k++){ box(161+4*k,10,150,164+4*k,22-4*k,164,C.aw); box(161+4*k,22-4*k,150,164+4*k,22-4*k,164,C.bw3); }
box(102,10,145,124,11,169,C.sc1);
for(const z of [147,167]){
  beam(104,12,z,112,25,z,1.4,C.sc1);
  beam(122,12,z,114,25,z,1.4,C.sc1);
  rodX(107,119,17,z,0.9,C.sc2);
}
box(110,24,145,116,30,148,C.sb); box(110,24,166,116,30,169,C.sb);
rodZ(144,170,PX,PY,1.2,C.sc2);
for(let x=80;x<=146;x++){
  const yb=R(30+dyS(x));
  for(let z=150;z<=164;z++){
    block(x,yb,z,C.d2);
    block(x,yb+1,z,((x-80)%4===3)?C.d2:C.d1);
  }
  if(x>=86&&x<=140){ block(x,yb-1,150,C.dc); block(x,yb-1,164,C.dc); }
}
for(const xs of [80,145]) for(let x=xs;x<=xs+1;x++){ const yb=R(30+dyS(x)); box(x,yb+2,152,x,yb+4,162,C.d2); }
for(const xp of [83,93,103,123,133,143]) for(const z of [150,164]){ const yb=R(30+dyS(xp)); box(xp,yb+2,z,xp,yb+7,z,C.dc); }
for(let x=83;x<=143;x++) for(const z of [150,164]) block(x,R(38+dyS(x)),z,C.d1);
{ const yb=R(30+dyS(PX)); box(PX,yb+2,150,PX,yb+13,150,C.dc); ellipsoid(PX,yb+14.5,150,1.8,1.8,1.8,C.db); }
for(let x=109;x<=117;x++) for(let y=24;y<=29;y++) for(let z=151;z<=163;z++){
  if(Math.hypot(x-PX,y-PY)<1.9) continue;
  if(y<=26&&Math.abs(x-PX)>3) continue;
  block(x,y,z,(z===151||z===163)?C.db:C.dc);
}
ellipsoid(85,32.7,DZ,3,3,3,C.bb);
const FX=200,FZ=170;
cylinder(FX,10,FZ,9,2,C.sc1);
cylinder(FX,12,FZ,5,2,C.sb);
cylinder(FX,14,FZ,1.1,44,C.sb);
block(FX,58,FZ,C.sc2);
box(FX,59,FZ,FX,62,FZ,C.m1);
box(FX,63,FZ-1,FX+1,67,FZ,C.m1);
line(FX+1,66,FZ,FX+7,63,FZ,C.m1);
ellipsoid(FX,72,FZ,3.2,4.8,2.4,C.pw);
box(FX-3,70,FZ-2,FX+3,71,FZ+2,C.mt);
ellipsoid(FX,79.5,FZ,2.8,2.8,2.8,C.k1);
cone(FX,82,FZ,2.6,0,4,C.mt);
line(FX-2,75,FZ+1,FX-3,74,FZ+3,C.pw); line(FX+2,75,FZ+1,FX+3,74,FZ+3,C.pw);
{
  let prev=null;
  for(let i=-10;i<=10;i++){
    const u=i/10,p=[FX+18*u,74-28*u*u,FZ+3];
    if(prev) beam(prev[0],prev[1],prev[2],p[0],p[1],p[2],0.8,C.m1);
    prev=p;
  }
  ellipsoid(FX-18,46,FZ+3,3.2,3.2,3.2,C.mt);
  ellipsoid(FX+18,46,FZ+3,3.2,3.2,3.2,C.mt);
}

box(40,18,66,72,19,88,C.spw);
for(let i=0;i<5;i++){
  const top=30+7*i,x0=42+6*i;
  box(x0-1,20,66,x0+5,top+2,69,C.bw2); box(x0-1,20,85,x0+5,top+2,88,C.bw2);
  box(x0-1,top+2,66,x0+5,top+2,69,C.trim); box(x0-1,top+2,85,x0+5,top+2,88,C.trim);
  box(x0,23,70,x0+4,top-1,84,C.pw);
  box(x0,top,70,x0+4,top,84,C.pe);
  box(x0,23,70,x0+4,23,84,C.pe);
  ellipsoid(x0+2,top+3,77,2.2,2.2,2.2,i%2?C.mar2:C.mar1);
}
box(40,20,66,41,34,88,C.bw2); box(40,34,66,41,34,88,C.trim);
box(71,20,66,72,56,88,C.bw2); box(71,56,66,72,56,88,C.trim);
for(let i=0;i<5;i++){ const x0=42+6*i; for(const z of [66,88]) block(x0+2,20+3*i+4,z,C.sb); }
function trackSeg(xa,ya,xb,yb){
  const n=Math.abs(xb-xa),sg=Math.sign(xb-xa);
  for(let k=0;k<=n;k++){
    const x=xa+sg*k,y=R(ya+(yb-ya)*k/n);
    box(x,y,58,x,y,62,C.trk);
    block(x,y+1,57,C.sc1); block(x,y+2,57,C.sc1);
    block(x,y+1,63,C.sc1); block(x,y+2,63,C.sc1);
  }
}
trackSeg(74,57,44,51); trackSeg(44,45,74,39); trackSeg(74,33,44,27);
box(42,45,57,43,53,63,C.sc1);
box(75,33,57,76,41,63,C.sc1);
box(71,57,58,77,57,80,C.trk);
box(77,58,58,77,59,80,C.sc1); box(71,58,81,77,59,81,C.sc1);
box(42,24,63,44,27,69,C.trk);
box(40,18,54,41,60,56,C.spw); box(76,18,54,77,60,56,C.spw);
for(const y of [25,37,49]) box(42,y,55,75,y+1,56,C.spw);
ellipsoid(60,57.2,60,2.2,2.2,2.2,C.mar1);
ellipsoid(56,46.2,60,2.2,2.2,2.2,C.mar2);
ellipsoid(66,34.2,60,2.2,2.2,2.2,C.mar1);
box(184,18,76,212,20,100,C.d1);
box(184,21,76,212,21,100,C.pe);
cylinder(190,22,88,4,12,C.pe); cylinder(206,22,88,4,12,C.pe);
cylinder(190,27,88,4.3,1,C.trim); cylinder(206,27,88,4.3,1,C.trim);
box(185,34,82,211,36,94,C.d1);
for(let x=190;x<=206;x++) for(let y=37;y<=46;y++) for(let z=83;z<=93;z++){
  if(Math.hypot(x-198,y-37)<5.5) continue;
  block(x,y,z,C.sc2);
}
box(193,47,84,203,57,92,C.d1);
box(193,52,84,203,52,92,C.pe);
for(let y=58;y<=62;y++) box(193+(y-58),y,85,203-(y-58),y,91,C.trim);
box(184,63,86,212,64,90,C.pe);
box(185,65,86,189,69,90,C.sc2); box(207,65,86,211,69,90,C.trim);
ellipsoid(198,67,88,2.4,2.4,2.4,C.mar2);
cylinder(186,18,112,5,3,C.trim); cylinder(186,21,112,4,3,C.d1); cylinder(186,24,112,3,3,C.sc2);
box(200,18,106,206,23,112,C.d1);
for(let x=38;x<=54;x++) for(let y=10;y<=17;y++) for(let z=178;z<=194;z++){
  const d=Math.hypot(x-46,y-16.5,z-186);
  if(d<=7&&d>=5.7&&y<=16) block(x,y,z,C.pe);
}
cylinder(46,10,186,3.5,1,C.pe);
for(const m of [[44,13,185,C.mar1],[48,13,187,C.mar2],[46,13,189,C.mar1],[45,15,183,C.mar2],[47,15.5,186,C.mar1]]) ellipsoid(m[0],m[1],m[2],2,2,2,m[3]);
box(184,10,188,190,16,194,C.d1);
cylinder(204,10,192,3,8,C.pe);
for(let y=10;y<=14;y++) box(193+(y-10),y,196,201-(y-10),y,200,C.trim);

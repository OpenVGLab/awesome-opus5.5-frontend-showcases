const C={ind:'#2B3A67',indD:'#1E2A4D',indL:'#41538C',grn:'#2F6B5B',grnD:'#234F44',grnL:'#4E8C76',gold:'#D9B868',goldL:'#EAD08E',goldD:'#B8964D',goldW:'#CDAA5E',cream:'#F0E6CF',wood:'#8A6242',woodD:'#6B4A33',woodL:'#A67C55',char:'#2A2A30',charL:'#3C3C44',steel:'#9DA3A8',hole:'#15182A'};
function B(a,b,c,d,e,f,col){box(Math.round(a),Math.round(b),Math.round(c),Math.round(d),Math.round(e),Math.round(f),col);}
function discX(x0,x1,cy,cz,r,col){const R=Math.ceil(r);for(let dy=-R;dy<=R;dy++)for(let dz=-R;dz<=R;dz++)if(dy*dy+dz*dz<=r*r+0.3)B(x0,cy+dy,cz+dz,x1,cy+dy,cz+dz,col);}
function discZ(z0,z1,cx,cy,r,col){const R=Math.ceil(r);for(let dx=-R;dx<=R;dx++)for(let dy=-R;dy<=R;dy++)if(dx*dx+dy*dy<=r*r+0.3)B(cx+dx,cy+dy,z0,cx+dx,cy+dy,z1,col);}

// round practice stage with rug
cylinder(128,4,128,100,2,C.woodD);
for(let a=0;a<360;a+=4){const t=a*Math.PI/180;const x=Math.round(128+99.6*Math.cos(t)),z=Math.round(128+99.6*Math.sin(t));B(x,4,z,x,5,z,C.wood);}
cylinder(128,6,128,92,1,C.indD);
for(let dx=-92;dx<=92;dx++)for(let dz=-92;dz<=92;dz++){const r=Math.sqrt(dx*dx+dz*dz);if(r>91.5)continue;let c=null;
  if(r>=86&&r<=89)c=C.grn;else if(r>=81&&r<82)c=C.goldD;else if(r>=58&&r<59&&((Math.round(Math.atan2(dz,dx)*18/Math.PI)+36)%2===0))c=C.goldD;else if(r>=38&&r<40)c=C.grnD;
  if(c)block(128+dx,6,128+dz,c);}

// trough xylophone: trapezoid resonator trough
const ZC=132;
function hwB(x){return 16-6.5*(x-72)/112;}
function Wt(x,y){return Math.round(hwB(x)+(y-40)*0.14);}
for(let x=72;x<=184;x++){
  for(let y=40;y<=55;y++){
    const W=Wt(x,y);
    if(y<=42||x<=74||x>=182){B(x,y,ZC-W,x,y,ZC+W,y===40?C.indD:C.ind);continue;}
    B(x,y,ZC-W,x,y,ZC-W+2,C.ind);B(x,y,ZC+W-2,x,y,ZC+W,C.ind);
  }
  const W2=Wt(x,42);if(x>74&&x<182)B(x,42,ZC-W2+3,x,42,ZC+W2-3,C.hole);
  const W5=Wt(x,55);
  if(x<=74||x>=182)B(x,55,ZC-W5,x,55,ZC+W5,C.gold);else{B(x,55,ZC-W5,x,55,ZC-W5+2,C.gold);B(x,55,ZC+W5-2,x,55,ZC+W5,C.gold);}
  const W9=Wt(x,49);block(x,49,ZC-W9,C.goldD);block(x,49,ZC+W9,C.goldD);
}
B(72,49,ZC-Wt(72,49),72,49,ZC+Wt(72,49),C.goldD);B(184,49,ZC-Wt(184,49),184,49,ZC+Wt(184,49),C.goldD);
for(const [xa,xb] of [[86,104],[114,132],[142,160]])for(let x=xa;x<=xb;x++)for(let y=46;y<=47;y++){const W=Wt(x,y);for(let k=0;k<3;k++){block(x,y,ZC-W+k,null);block(x,y,ZC+W-k,null);}}
for(let dy=-3;dy<=3;dy++)for(let dz=-3;dz<=3;dz++){if(dy*dy+dz*dz<=9.3)for(let x=72;x<=74;x++)block(x,48+dy,ZC+dz,null);if(dy*dy+dz*dz<=4.3)for(let x=182;x<=184;x++)block(x,48+dy,ZC+dz,null);}
// felt rails, bars, pins
for(let x=74;x<=182;x++){const W=Wt(x,55);B(x,56,ZC-W+1,x,56,ZC-W+2,C.grn);B(x,56,ZC+W-2,x,56,ZC+W-1,C.grn);}
for(let i=0;i<13;i++){
  const xa=76+8*i,xb=xa+5,L=Math.round(60-2*i),z0=ZC-Math.floor(L/2),z1=z0+L-1;
  const col=(i%2===0)?C.gold:C.goldW;const arch=i<6?2:1;
  for(let z=z0;z<=z1;z++){const u=(z-z0)/(L-1);const yb=57+(Math.abs(u-0.5)<0.2?arch:0);B(xa,yb,z,xb,60,z,(z===z0||z===z1)?C.goldD:col);}
  B(xa,60,z0+1,xb,60,z1-1,(i%2===0)?C.goldL:C.gold);
}
for(const px of [74,82,90,98,106,114,122,130,138,146,154,162,170,179]){const W=Wt(px,55);B(px,57,ZC-W+2,px,61,ZC-W+2,C.goldL);B(px,57,ZC+W-2,px,61,ZC+W-2,C.goldL);}
function mallet(h,t,headC){beam(h[0],h[1],h[2],t[0],t[1],t[2],0.8,C.goldD);ellipsoid(h[0],h[1],h[2],2.6,2.6,2.6,headC);}
mallet([150,63,148],[171,61.5,116],C.grnL);
mallet([139,63,150],[161,61.5,119],C.grnL);
// trestle stand
for(const fx of [86,170]){
  B(fx-2,38,ZC-12,fx+2,39,ZC+12,C.indD);
  for(const s of [-1,1]){beam(fx,38,ZC+s*9,fx,8,ZC+s*21,1.6,C.indD);B(fx-2,7,ZC+s*21-2,fx+2,7,ZC+s*21+2,C.char);}
  beam(fx,18,ZC-17,fx,18,ZC+17,1.1,C.ind);
}
beam(86,18,ZC,170,18,ZC,1.5,C.ind);

// performance stool
const SX=128,SZ=200;
for(const [dx,dz] of [[-1,-1],[1,-1],[-1,1],[1,1]]){beam(SX+dx*7,37,SZ+dz*7,SX+dx*11,8,SZ+dz*11,1.3,C.woodL);B(SX+dx*11-1,7,SZ+dz*11-1,SX+dx*11+1,7,SZ+dz*11+1,C.char);}
ring(SX,18,SZ,13.5,0.8,C.wood,'y');
cylinder(SX,37,SZ,12,2,C.woodD);
cylinder(SX,39,SZ,13,4,C.grn);
ellipsoid(SX,43,SZ,12.5,1.6,12.5,C.grn);
ring(SX,39,SZ,13,0.8,C.goldD,'y');ring(SX,42,SZ,12.8,0.7,C.goldD,'y');
for(const [bx,bz] of [[0,0],[6,0],[-6,0],[0,6],[0,-6]])block(SX+bx,44,SZ+bz,C.grnD);

// blank music stand with slotted desk
const MX=128,MZ=50;
for(const a of [90,210,330]){const t=a*Math.PI/180;const fx=MX+16*Math.cos(t),fz=MZ+16*Math.sin(t);beam(MX,23,MZ,fx,8,fz,1.1,C.indD);B(Math.round(fx)-1,7,Math.round(fz)-1,Math.round(fx)+1,7,Math.round(fz)+1,C.char);}
cylinder(MX,21,MZ,2.4,6,C.indD);
beam(MX,26,MZ,MX,70,MZ,1.4,C.indD);
beam(MX,70,MZ,MX,86,MZ,1,C.steel);
cylinder(MX,69,MZ,2.2,2,C.goldD);block(MX+3,70,MZ,C.goldD);
function dzs(y){return 53-Math.round((y-88)*0.35);}
for(let y=88;y<=117;y++){const z=dzs(y);B(106,y,z,150,y,z+1,C.ind);B(106,y,z,107,y,z+1,C.indD);B(149,y,z,150,y,z+1,C.indD);block(117,y,z-1,C.indD);block(139,y,z-1,C.indD);}
B(106,117,dzs(117),150,117,dzs(117)+1,C.indD);
for(const yy of [94,100,106,112])for(const [xa,xb] of [[111,126],[130,145]]){const z=dzs(yy);for(let x=xa;x<=xb;x++){block(x,yy,z,null);block(x,yy,z+1,null);}}
B(106,88,dzs(88)+2,150,89,dzs(88)+4,C.indD);
B(126,84,MZ,130,90,dzs(88),C.indD);
discX(131,132,88,MZ+1,1.5,C.goldD);

// wooden speaker cabinet
const KX0=51,KX1=83,KZ0=74,KZ1=98;
for(const [fx,fz] of [[55,78],[79,78],[55,94],[79,94]])cone(fx,7,fz,2.2,1.4,4,C.woodD);
B(KX0,11,KZ0,KX1,52,KZ1,C.wood);
B(KX0,52,KZ0,KX1,52,KZ1,C.woodD);
B(KX0,11,KZ0,KX1,11,KZ1,C.woodD);
B(KX0+1,12,KZ1,KX1-1,51,KZ1,C.ind);
for(let k=0;k<8;k++){const gy=14+Math.floor(rng()*36);const gz=KZ0+2+Math.floor(rng()*10);const gl=6+Math.floor(rng()*8);B(KX0,gy,gz,KX0,gy,gz+gl,C.woodD);B(KX1,gy,gz,KX1,gy,gz+gl,C.woodD);}
discZ(KZ1,KZ1,67,26,9.2,C.char);
discZ(KZ1,KZ1,67,26,6.6,C.charL);discZ(KZ1,KZ1,67,26,5.6,C.char);
ring(67,26,KZ1+1,10,1,C.goldD,'z');
discZ(KZ1+1,KZ1+1,67,26,3,C.indL);block(67,26,KZ1+2,C.indL);
discZ(KZ1,KZ1,67,43,3.6,C.char);ring(67,43,KZ1+1,4.2,0.8,C.goldD,'z');ellipsoid(67,43,KZ1+1,2,2,1.2,C.goldL);
discZ(KZ1,KZ1,77,15,2.5,C.hole);ring(77,15,KZ1+1,2.8,0.6,C.goldD,'z');

// mechanical metronome on the cabinet
const MX2=67,MZ2=86;
B(58,53,79,76,54,93,C.grnD);
function mhx(y){return Math.round(8-5.5*(y-55)/25);}
function mhz(y){return Math.round(6-4*(y-55)/25);}
for(let y=55;y<=80;y++){const hx=mhx(y),hz=mhz(y);B(MX2-hx,y,MZ2-hz,MX2+hx,y,MZ2+hz,C.grn);}
for(let y=58;y<=77;y++){const hz=mhz(y);B(MX2-1,y,MZ2+hz,MX2+1,y,MZ2+hz,C.goldL);if(y%3===0){block(MX2-1,y,MZ2+hz,C.indD);block(MX2+1,y,MZ2+hz,C.indD);}}
B(MX2-3,55,MZ2+6,MX2+3,57,MZ2+6,C.goldD);
line(MX2,58,MZ2+7,MX2+7,83,MZ2+7,C.gold);
B(MX2+3,71,MZ2+7,MX2+5,74,MZ2+8,C.goldD);
B(MX2+mhx(62)+1,61,MZ2,MX2+mhx(62)+2,63,MZ2,C.goldD);B(MX2+mhx(62)+3,60,MZ2,MX2+mhx(62)+3,64,MZ2,C.goldD);
B(MX2-2,81,MZ2-1,MX2+2,81,MZ2+1,C.goldD);block(MX2,82,MZ2,C.goldL);

// small string instrument on its stand
const UX=189,UZ=93,UY=12;
B(180,7,76,181,8,96,C.indD);B(197,7,76,198,8,96,C.indD);
B(180,7,94,198,8,95,C.indD);B(180,7,76,198,8,77,C.indD);
B(181,9,94,182,14,95,C.indD);B(196,9,94,197,14,95,C.indD);
B(181,13,92,182,14,97,C.grnD);B(196,13,92,197,14,97,C.grnD);
B(188,9,76,190,60,77,C.indD);
B(185,60,77,193,61,80,C.indD);
B(185,62,78,186,64,80,C.grnD);B(192,62,78,193,64,80,C.grnD);
function uhw(v){let w=0;const a=(v-8)/8.5;if(Math.abs(a)<=1)w=Math.max(w,10*Math.sqrt(1-a*a));const b=(v-20)/7;if(Math.abs(b)<=1)w=Math.max(w,8*Math.sqrt(1-b*b));return w;}
function uz(v){return UZ-Math.round(0.22*v);}
for(let v=0;v<=57;v++){
  const y=UY+v,zc=uz(v);
  if(v<=27){const w=Math.round(uhw(v));if(w<1)continue;B(UX-w,y,zc-3,UX+w,y,zc+2,C.woodL);B(UX-w,y,zc+3,UX+w,y,zc+3,C.goldD);block(UX-w,y,zc+3,C.cream);block(UX+w,y,zc+3,C.cream);}
  else if(v<=50){B(UX-2,y,zc-1,UX+2,y,zc+1,C.woodL);B(UX-2,y,zc+2,UX+2,y,zc+2,(v%3===0)?C.goldL:C.indD);}
  else B(UX-3,y,zc-1,UX+3,y,zc+1,C.woodD);
}
for(let dv=-4;dv<=4;dv++)for(let dx=-4;dx<=4;dx++){const q=dv*dv+dx*dx;const v=17+dv;if(q<=9.3)block(UX+dx,UY+v,uz(v)+3,C.hole);else if(q<=17.5)block(UX+dx,UY+v,uz(v)+3,C.ind);}
B(UX-4,UY+7,uz(7)+4,UX+4,UY+7,uz(7)+4,C.indD);
for(const sx of [-2,-1,1,2]){for(let v=8;v<=50;v++)block(UX+sx,UY+v,uz(v)+(v<=27?4:3),C.goldL);}
B(UX-2,UY+50,uz(50)+3,UX+2,UY+50,uz(50)+3,C.cream);
for(const v of [53,56]){const y=UY+v,zc=uz(v);B(UX-5,y,zc,UX-4,y,zc,C.gold);B(UX+4,y,zc,UX+5,y,zc,C.gold);block(UX-6,y,zc,C.goldL);block(UX+6,y,zc,C.goldL);}

// snare-style drum on tripod stand
const DX=190,DZ=172;
for(const a of [30,150,270]){const t=a*Math.PI/180;const fx=DX+18*Math.cos(t),fz=DZ+18*Math.sin(t);beam(DX,21,DZ,fx,8,fz,1.1,C.indD);B(Math.round(fx)-1,7,Math.round(fz)-1,Math.round(fx)+1,7,Math.round(fz)+1,C.char);}
cylinder(DX,19,DZ,2.2,5,C.indD);
beam(DX,22,DZ,DX,38,DZ,1.2,C.indD);
for(const a of [90,210,330]){const t=a*Math.PI/180;const ax=DX+13*Math.cos(t),az=DZ+13*Math.sin(t);beam(DX,38,DZ,ax,41,az,0.9,C.indD);B(Math.round(ax)-1,41,Math.round(az)-1,Math.round(ax)+1,42,Math.round(az)+1,C.char);}
ring(DX,43,DZ,15.3,1,C.goldD,'y');
cylinder(DX,43,DZ,15,10,C.grnD);
ring(DX,52,DZ,15.3,1,C.goldD,'y');
cylinder(DX,53,DZ,14.6,1,C.cream);
for(let k=0;k<8;k++){const t=k*Math.PI/4;const lx=Math.round(DX+16*Math.cos(t)),lz=Math.round(DZ+16*Math.sin(t));B(lx,45,lz,lx,50,lz,C.steel);}
B(DX+15,46,DZ-2,DX+17,49,DZ+2,C.steel);
beam(178,54,166,200,54,178,0.8,C.woodL);ellipsoid(200,54,178,1.2,1,1.2,C.woodL);
beam(180,55,180,202,55,166,0.8,C.woodL);ellipsoid(202,55,166,1.2,1,1.2,C.woodL);

// open mallet case
B(51,7,166,77,8,178,C.woodD);
B(51,9,166,77,13,167,C.wood);B(51,9,177,77,13,178,C.wood);B(51,9,168,52,13,176,C.wood);B(76,9,168,77,13,176,C.wood);
B(53,9,168,75,9,176,C.grn);
B(51,14,164,77,26,165,C.grnD);B(51,13,165,77,13,166,C.goldD);B(63,23,166,65,24,166,C.goldD);
beam(58,11,170,73,11,171,0.8,C.goldD);ellipsoid(58,11,170,2.2,2.2,2.2,C.indL);
beam(58,11,174,73,11,175,0.8,C.goldD);ellipsoid(58,11,174,2.2,2.2,2.2,C.indL);

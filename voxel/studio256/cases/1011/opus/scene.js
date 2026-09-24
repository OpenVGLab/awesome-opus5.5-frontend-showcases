const P={
 gDeep:'#3f3226',gClay:'#6e5238',gLoam:'#584230',gTop:'#4a3727',
 grass1:'#6c7a3c',grass2:'#7d8a46',grav1:'#8b8374',grav2:'#77705f',dirt:'#735a40',
 tTop:'#65532f',tBall1:'#4d3926',tBall2:'#6a4f34',tRoot:'#8e6d4b',
 tBark1:'#5a4636',tBark2:'#705845',
 tLeaf1:'#5a6f33',tLeaf2:'#6f8540',tLeaf3:'#48592a',tLeaf4:'#86994c',
 cSteel:'#393b40',cDark:'#26272b',cBrass:'#b9995a',cBrass2:'#9a7d47',cBlade:'#8c8982',cRod:'#d0cbbd',
 sChar:'#2f3135',sChar2:'#46484d',sBrass:'#c4a567',sBrass2:'#a88b53',sRod:'#dcd6c6',
 glass:'#3a4a54',light:'#f1e0ae',tire:'#222326',
 wood1:'#9c6b3e',wood2:'#b9834d',wood3:'#7c522e',
 amber:'#e0a33a',amber2:'#b87a24',burlap:'#a98b5d',twine:'#d2b77f',pine1:'#3f5a34'
};
const R=Math.round;
const BX0=28,BX1=222,BZ0=54,BZ1=202,BR=16;
const SX=58,SZ=124;
const HX=152,HZ=180;
function edgeDist(x,z){
  const qx=Math.max(BX0+BR-x,x-(BX1-BR),0),qz=Math.max(BZ0+BR-z,z-(BZ1-BR),0);
  if(qx>0&&qz>0) return BR-Math.hypot(qx,qz);
  return Math.min(x-BX0,BX1-x,z-BZ0,BZ1-z);
}
function prof(y){ return y<=17 ? 4+10*Math.sqrt(Math.max(0,(y-5)/12)) : 14+(y-17)*0.18; }
function angDiff(a,b){ let d=a-b; while(d>Math.PI) d-=2*Math.PI; while(d<-Math.PI) d+=2*Math.PI; return d; }
function layerColor(x,y,z){
  const w=Math.sin(x*0.11)*0.9+Math.cos(z*0.13)*0.7;
  if(y<=7+w*0.6) return P.gDeep;
  if(y<=11+w) return P.gClay;
  if(y<=15+w*0.5) return P.gLoam;
  return P.gTop;
}
function surfColor(x,z){
  const r=rng();
  const dS=Math.hypot(x-SX,z-SZ);
  if(dS<23) return r<0.6?P.dirt:P.gTop;
  if(x>=88&&z>=97&&z<=151){
    const inRut=(z>=102&&z<=110)||(z>=138&&z<=146);
    if(inRut&&x>=100) return r<0.7?P.grav2:P.gLoam;
    return r<0.55?P.grav1:P.grav2;
  }
  return r<0.5?P.grass1:(r<0.8?P.grass2:P.gTop);
}
for(let x=BX0;x<=BX1;x++) for(let z=BZ0;z<=BZ1;z++){
  const e=edgeDist(x,z); if(e<0) continue;
  const nearPit=Math.hypot(x-SX,z-SZ)<24||Math.hypot(x-HX,z-HZ)<22;
  const solid=e<3||nearPit;
  for(let y=4;y<=16;y++){
    if(!solid&&y>5&&y<11) continue;
    block(x,y,z,layerColor(x,y,z));
  }
  if(e>=0.8) block(x,17,z,surfColor(x,z));
}
for(let x=HX-20;x<=HX+20;x++) for(let z=HZ-20;z<=HZ+20;z++){
  const d=Math.hypot(x-HX,z-HZ);
  for(let y=6;y<=17;y++) if(d<=prof(y)+0.75) block(x,y,z,null);
  if(d>prof(17)+0.75&&d<19.5) block(x,17,z,rng()<0.7?P.dirt:P.gTop);
}
for(let i=0;i<700;i++){
  const x=BX0+4+Math.floor(rng()*(BX1-BX0-8)),z=BZ0+4+Math.floor(rng()*(BZ1-BZ0-8));
  if(edgeDist(x,z)<3) continue;
  if(Math.hypot(x-SX,z-SZ)<27||Math.hypot(x-HX,z-HZ)<21) continue;
  if(x>=86&&z>=95&&z<=153) continue;
  const h=1+Math.floor(rng()*3),c=rng()<0.5?P.grass2:P.grass1;
  for(let k=0;k<h;k++) block(x,18+k,z,c);
  if(h>1&&rng()<0.6) block(x+(rng()<0.5?1:-1),18,z,c);
}
for(let i=0;i<60;i++){
  const x=100+Math.floor(rng()*118),z=97+Math.floor(rng()*54);
  if(edgeDist(x,z)<3) continue;
  block(x,18,z,rng()<0.5?P.grav1:P.sChar2);
  if(rng()<0.4) block(x+1,18,z,P.grav2);
}

const BA=[Math.PI/4,3*Math.PI/4,5*Math.PI/4,7*Math.PI/4];
function bladeAt(phi){ for(const a of BA){ const d=angDiff(phi,a); if(Math.abs(d)<0.66) return d; } return null; }
for(let x=SX-20;x<=SX+20;x++) for(let z=SZ-20;z<=SZ+20;z++){
  const dx=x-SX,dz=z-SZ,d=Math.hypot(dx,dz),phi=Math.atan2(dz,dx);
  const bd=bladeAt(phi);
  for(let y=5;y<=36;y++){
    const f=prof(y);
    if(y<=17&&d<f-0.75){
      let c=y===17?P.tTop:(y>=14?P.tBall1:P.tBall2);
      if(y<17&&d>f-1.9&&rng()<0.12) c=P.tRoot;
      block(x,y,z,c);
    } else if(Math.abs(d-f)<=0.75){
      if(bd!==null){
        const edge=Math.abs(bd)>0.6||y>=35||y<=5;
        block(x,y,z,edge?P.cRod:P.cBlade);
      } else if(y<=17){
        block(x,y,z,y===17?P.tTop:P.tBall2);
      }
    } else if(bd!==null&&Math.abs(bd)<0.08&&d>f+0.75&&d<=f+1.9&&y>=9&&y<=35){
      block(x,y,z,P.cSteel);
    }
  }
}
for(let x=SX-22;x<=SX+22;x++) for(let z=SZ-22;z<=SZ+22;z++){
  const d=Math.hypot(x-SX,z-SZ);
  if(d<18||d>21.2) continue;
  const phi=Math.atan2(z-SZ,x-SX);
  if(Math.abs(angDiff(phi,Math.PI))<0.05) continue;
  for(let y=36;y<=38;y++) block(x,y,z,y===38?P.cBrass:P.cBrass2);
  for(let y=49;y<=51;y++) block(x,y,z,y===51?P.cBrass:P.cBrass2);
}
box(SX-1,37,103,SX+1,50,105,P.cSteel);
box(SX-1,37,143,SX+1,50,145,P.cSteel);
{
  const hx=SX+19.6*Math.cos(Math.PI+0.1),hz=SZ+19.6*Math.sin(Math.PI+0.1);
  cylinder(hx,35,hz,1.3,18,P.cRod);
  for(const y0 of [36,43,49]) cylinder(hx,y0,hz,2.1,3,P.cDark);
  const lx=SX+19.6*Math.cos(Math.PI-0.1),lz=SZ+19.6*Math.sin(Math.PI-0.1);
  box(R(lx)-1,42,R(lz),R(lx)+1,45,R(lz)+1,P.cBrass);
  beam(41,53,114,46,53,108,1.0,P.cSteel);
}
for(const a of BA){
  const cx=SX+17.6*Math.cos(a),cz=SZ+17.6*Math.sin(a);
  box(R(cx)-1,36,R(cz)-1,R(cx)+1,37,R(cz)+1,P.cDark);
  cylinder(cx,37,cz,0.9,7,P.cRod);
  cylinder(cx,44,cz,1.8,15,P.cSteel);
  cylinder(cx,52,cz,2.0,1,P.cBrass);
  cylinder(cx,59,cz,2.2,2,P.cDark);
  line(R(cx),60,R(cz),80,62,cz>SZ?129:119,P.cDark);
}
box(76,36,117,80,38,131,P.cSteel);
box(76,49,117,80,51,131,P.cSteel);
beam(72,51,110,80,60,115,1.1,P.cSteel);
beam(72,51,138,80,60,133,1.1,P.cSteel);
beam(72,37,110,80,33,114,1.1,P.cSteel);
beam(72,37,138,80,33,134,1.1,P.cSteel);
box(80,32,110,83,64,138,P.cBrass2);
box(80,32,110,83,33,138,P.cDark); box(80,63,110,83,64,138,P.cDark);
box(80,32,110,83,64,111,P.cDark); box(80,32,137,83,64,138,P.cDark);
box(79,34,123,79,62,125,P.cDark);
for(let y=38;y<=58;y+=10) for(const z of [114,134]) block(79,y,z,P.cRod);
for(let y=28;y<=61;y++) for(let x=83;x<=89;x++) for(let z=121;z<=127;z++){
  const d=Math.hypot(x-86,z-124);
  if(d>1.2&&d<=2.6) block(x,y,z,(y%9===0)?P.cBrass:P.cSteel);
}
box(83,31,122,84,33,126,P.cDark);
box(83,50,122,84,52,126,P.cDark);
box(80,62,121,88,64,127,P.cDark);
for(let y=17;y<=120;y++){
  const t=(y-17)/103;
  let r=2.9-1.2*t; if(y<21) r+=(21-y)*0.55;
  const cx=SX+0.9*Math.sin(y*0.035),cz=SZ+0.7*Math.sin(y*0.027+1.1);
  for(let x=Math.floor(cx-r);x<=Math.ceil(cx+r);x++) for(let z=Math.floor(cz-r);z<=Math.ceil(cz+r);z++){
    if(Math.hypot(x-cx,z-cz)>r) continue;
    block(x,y,z,((x+z+Math.floor(y/3))%5===0)?P.tBark2:P.tBark1);
  }
}
const brs=[];
for(let i=0;i<6;i++){
  const a=i*1.047+rng()*0.5,y0=92+i*4+rng()*4,len=12+rng()*5;
  const x0=SX+0.9*Math.sin(y0*0.035),z0=SZ+0.7*Math.sin(y0*0.027+1.1);
  const x1=SX+Math.cos(a)*len,z1=SZ+Math.sin(a)*len,y1=y0+14+rng()*8;
  beam(x0,y0,z0,x1,y1,z1,1.2,P.tBark1);
  brs.push([x1,y1,z1]);
}
ellipsoid(SX,134,SZ,15,12,15,P.tLeaf1);
for(let i=0;i<brs.length;i++){
  const b=brs[i];
  ellipsoid(b[0],b[1]+3,b[2],8.5+rng()*2,7+rng()*1.5,8.5+rng()*2,i%2?P.tLeaf2:P.tLeaf3);
}
for(let i=0;i<11;i++){
  const a=rng()*Math.PI*2,rr=rng()*11,h=122+rng()*26;
  const c=h>140?P.tLeaf4:(h>130?P.tLeaf2:P.tLeaf1);
  ellipsoid(SX+Math.cos(a)*rr,h,SZ+Math.sin(a)*rr,7+rng()*3,6+rng()*2,7+rng()*3,c);
}

box(84,22,115,88,96,118,P.sChar); box(84,22,130,88,96,133,P.sChar);
box(84,24,116,84,94,117,P.sBrass2); box(84,24,131,84,94,132,P.sBrass2);
box(84,93,115,88,96,133,P.sChar2); box(84,22,115,88,25,133,P.sChar2);
box(89,58,115,90,61,133,P.sChar2);
box(84,97,114,89,98,119,P.sBrass2); box(84,97,129,89,98,134,P.sBrass2);
for(let y=26;y<=58;y++) for(const [dx,dz] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]) block(86+dx,y,124+dz,P.sRod);
box(85,26,123,87,27,125,P.sChar);
box(88,26,113,92,36,118,P.sChar2); box(88,26,130,92,36,135,P.sChar2);
beam(90,30,111,90,30,137,1.4,P.sBrass);
box(90,31,113,196,36,116,P.sChar); box(90,31,132,196,36,135,P.sChar);
for(const x of [96,121,146,171,192]) box(x,32,117,x+2,35,131,P.sChar2);
box(92,33,98,96,36,150,P.sChar);
for(const z of [100,148]){
  cylinder(94,22,z,2.3,14,P.sBrass2);
  cylinder(94,34,z,2.8,2,P.sChar);
  cylinder(94,19,z,1.2,4,P.sRod);
  box(90,18,z-4,98,19,z+4,P.sChar);
}
function wheel(cx,cy,z0,z1,outer){
  for(let x=cx-11;x<=cx+11;x++) for(let y=cy-11;y<=cy+11;y++){
    const d=Math.hypot(x-cx,y-cy); if(d>10.6) continue;
    const a=Math.atan2(y-cy,x-cx);
    const lug=Math.floor((a+Math.PI)/(2*Math.PI)*24)%2===0;
    for(let z=z0;z<=z1;z++){
      const face=(z===outer);
      if(face&&d<=6.3&&d>2.3) continue;
      let c;
      if(d>7.3) c=(d>9.5&&lug)?P.sChar:P.tire;
      else if(d>6.3) c=P.sChar2;
      else if(d>2.3) c=P.sBrass2;
      else c=P.sBrass;
      block(x,y,z,c);
    }
  }
}
for(const ax of [110,134,182]){
  beam(ax,28,108,ax,28,140,1.6,P.sChar2);
  box(ax-9,29,112,ax+9,30,117,P.sChar2); box(ax-9,29,131,ax+9,30,136,P.sChar2);
  wheel(ax,28,103,109,103); wheel(ax,28,139,145,145);
}
ellipsoid(110,28,124,4,3.5,4,P.sChar); ellipsoid(134,28,124,4,3.5,4,P.sChar);
beam(176,30,124,138,29,124,1.1,P.sChar2); beam(130,29,124,114,29,124,1.1,P.sChar2);
for(const x of [94,122,146,156]) box(x,37,106,x+1,40,142,P.sChar);
for(let z=104;z<=144;z++){
  const seam=((z-104)%5===4);
  const c=seam?P.wood3:((((z-104)/5)|0)%2?P.wood1:P.wood2);
  box(92,41,z,158,42,z,c);
}
box(92,39,104,158,40,104,P.wood3); box(92,39,144,158,40,144,P.wood3);
box(92,39,104,93,42,144,P.sChar);
for(let x=100;x<=156;x+=14){ box(x,39,103,x+1,43,103,P.sChar); box(x,39,145,x+1,43,145,P.sChar); }
box(98,39,102,146,39,110,P.sChar2); box(98,39,138,146,39,146,P.sChar2);
box(97,26,102,98,39,110,P.sChar); box(97,26,138,98,39,146,P.sChar);
box(160,38,106,182,72,142,P.sBrass);
box(161,73,107,181,75,141,P.sBrass);
box(162,76,108,180,76,140,P.sBrass2);
box(160,38,106,182,41,142,P.sChar);
box(160,54,106,182,55,142,P.sBrass2);
box(182,57,110,182,70,138,P.glass);
box(182,57,124,182,70,124,P.sBrass2);
for(const z of [106,142]){
  box(164,57,z,179,70,z,P.glass);
  box(163,42,z,163,72,z,P.sChar2); box(180,42,z,180,72,z,P.sChar2);
  box(175,50,z,177,50,z,P.sChar);
}
box(160,60,114,160,70,134,P.glass);
box(183,38,110,197,57,138,P.sBrass);
box(183,58,112,196,59,136,P.sBrass);
for(const z of [110,138]) for(let x=186;x<=194;x+=2) box(x,46,z,x,53,z,P.sBrass2);
box(198,40,113,199,57,135,P.sChar);
for(let z=114;z<=134;z+=2) box(199,41,z,199,56,z,P.sChar2);
for(const z0 of [106,137]){ box(198,48,z0,200,53,z0+5,P.sChar); box(200,49,z0+1,200,52,z0+4,P.light); }
box(170,40,102,194,41,110,P.sBrass2); box(170,40,138,194,41,146,P.sBrass2);
box(170,32,102,171,39,110,P.sChar); box(170,32,138,171,39,146,P.sChar);
box(193,34,102,194,39,110,P.sChar); box(193,34,138,194,39,146,P.sChar);
box(200,31,103,203,37,145,P.sChar);
box(203,33,115,204,35,117,P.sBrass); box(203,33,131,204,35,133,P.sBrass);
box(162,30,103,169,32,105,P.sChar2); box(162,30,143,169,32,145,P.sChar2);
box(162,35,103,169,36,105,P.sChar2); box(162,35,143,169,36,145,P.sChar2);
cylinder(157,40,110,1.6,48,P.sChar);
cylinder(157,60,110,2.2,14,P.sBrass2);
box(156,88,109,158,88,111,P.sChar2);
cylinder(157,43,138,2.4,33,P.sBrass);
cylinder(157,76,138,3.2,3,P.sChar);
line(182,66,106,185,66,102,P.sChar); box(184,59,99,186,68,101,P.sChar); box(186,60,100,186,67,100,P.glass);
line(182,66,142,185,66,146,P.sChar); box(184,59,147,186,68,149,P.sChar); box(186,60,148,186,67,148,P.glass);
for(let z=112;z<=136;z+=8) block(181,77,z,P.light);
box(169,77,122,173,78,126,P.sChar);
box(169,79,123,173,81,125,P.amber);
box(171,79,123,171,81,125,P.amber2);
block(171,82,124,P.amber2);
beam(128,49,136,152,49,136,6,P.sChar);
box(131,43,131,133,45,141,P.sChar2); box(145,43,131,147,45,141,P.sChar2);
ring(132,49,136,6.3,0.6,P.sBrass,'x'); ring(146,49,136,6.3,0.6,P.sBrass,'x');
cylinder(140,55,136,1.5,3,P.sBrass2);
box(138,43,106,156,51,117,P.sBrass2);
box(138,50,106,156,50,117,P.sChar);
box(145,52,110,149,52,113,P.sChar);
box(100,43,106,108,44,113,P.sChar);
for(const z of [106,113]) for(let x=97;x<=111;x++) for(let y=45;y<=59;y++){ if(Math.hypot(x-104,y-52)<=7) block(x,y,z,P.sBrass2); }
for(let z=107;z<=112;z++) for(let x=98;x<=110;x++) for(let y=46;y<=58;y++){ if(Math.hypot(x-104,y-52)<=5.5) block(x,y,z,((x+y)%3===0)?P.sChar2:P.sChar); }
for(const z of [117,131]){
  box(120,43,z-2,124,46,z+2,P.sChar);
  beam(122,45,z,104,66,z,1.9,P.sChar2);
  beam(104,66,z,91,81,z,1.0,P.sRod);
  box(89,80,z-1,91,83,z+1,P.sChar);
}

function conifer(cx,cz,s){
  ellipsoid(cx,22,cz,7,5,7,P.burlap);
  ring(cx,23,cz,7,0.6,P.twine,'y');
  cylinder(cx,26,cz,1.2,6,P.tBark1);
  cone(cx,30,cz,9*s,3*s,R(11*s),P.pine1);
  cone(cx,R(30+9*s),cz,7.5*s,2*s,R(11*s),P.tLeaf3);
  cone(cx,R(30+18*s),cz,5.5*s,0,R(13*s),P.pine1);
}
conifer(112,76,1.0); conifer(140,70,1.15); conifer(168,78,0.9); conifer(198,72,1.1);
function sapling(cx,cz,h){
  ellipsoid(cx,21,cz,5,4,5,P.burlap);
  ring(cx,22,cz,5,0.5,P.twine,'y');
  beam(cx,24,cz,cx+1,24+h,cz,1.0,P.tBark1);
  ellipsoid(cx+1,24+h,cz,6,5,6,P.tLeaf2);
  ellipsoid(cx-2,21+h,cz+2,4,4,4,P.tLeaf1);
  ellipsoid(cx+3,27+h,cz-1,4,3.5,4,P.tLeaf4);
}
sapling(46,80,26); sapling(74,70,30);
for(const x of [100,111,122]) box(x,18,170,x+2,19,190,P.wood3);
for(let z=170;z<=190;z+=3) box(100,20,z,124,21,z+1,P.wood2);
ellipsoid(112,29,180,9,8,9,P.burlap);
ring(112,29,180,9,0.7,P.twine,'y');
ring(112,33,180,7.2,0.6,P.twine,'y');
beam(112,36,180,113,66,181,1.4,P.tBark1);
ellipsoid(113,66,181,7,6,7,P.tLeaf1);
ellipsoid(108,70,178,5,5,5,P.tLeaf2);
ellipsoid(117,71,184,5,5,5,P.tLeaf3);
ellipsoid(112,75,182,5,4,5,P.tLeaf2);
const sp=[[0,0],[2.4,0],[4.8,0],[7.2,0],[1.2,2.1],[3.6,2.1],[6,2.1]];
for(let i=0;i<sp.length;i++){
  const dz=sp[i][0],dy=sp[i][1];
  beam(52+(i%3),19.2+dy,184+dz,88-(i%2)*2,19.2+dy,184+dz,1.15,i%2?P.wood1:P.wood2);
}
ring(62,20.5,187.6,5.2,0.6,P.twine,'x');
ring(80,20.5,187.6,5.2,0.6,P.twine,'x');
ellipsoid(182,17,186,11,7,8,P.dirt);
ellipsoid(176,20,182,4,3,3,P.gTop);
ellipsoid(186,21,189,3,2.5,3,P.gLoam);
ellipsoid(189,19,181,3,2,3,P.gTop);
box(180,19,184,182,23,186,P.sChar2);
beam(181,23,185,187,45,189,0.8,P.wood1);
beam(185,45,188,189,45,190,0.8,P.wood2);
for(let y=25;y<=32;y++){
  const t=y-25;
  const x0=R(196-t*0.6),x1=R(207+t*0.9),z0=R(160-t*0.5),z1=R(171+t*0.5);
  for(let x=x0;x<=x1;x++) for(let z=z0;z<=z1;z++){
    const wall=(x===x0||x===x1||z===z0||z===z1);
    if(y===25||wall) block(x,y,z,y===32?P.sChar2:P.sBrass);
    else if(y<=30) block(x,y,z,P.dirt);
  }
}
ellipsoid(202,31,165.5,6,2.5,5,P.wood3);
for(let z=164;z<=167;z++) for(let x=211;x<=219;x++) for(let y=18;y<=26;y++){
  const d=Math.hypot(x-215,y-22); if(d<=4.2) block(x,y,z,d>2.6?P.tire:P.sBrass2);
}
beam(207,25,161,215,22,163,0.7,P.sChar2);
beam(207,25,170,215,22,168,0.7,P.sChar2);
box(197,18,161,198,24,162,P.sChar2); box(197,18,169,198,24,170,P.sChar2);
beam(196,27,161,183,31,158,0.8,P.wood1);
beam(196,27,170,183,31,173,0.8,P.wood1);
function tcone(cx,cz){
  box(cx-3,18,cz-3,cx+3,18,cz+3,P.sChar);
  cone(cx,19,cz,2.8,0.6,11,P.amber);
  cone(cx,23,cz,2.1,1.7,2,P.light);
}
tcone(36,194); tcone(214,194); tcone(214,62); tcone(128,158);

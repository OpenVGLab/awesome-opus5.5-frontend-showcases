const C={sand:'#D9C3A0',sandD:'#C4A881',sandDD:'#A88B66',beige:'#E8DCC4',beigeD:'#CDBFA5',terra:'#B5553A',terraD:'#8E3F2B',terraL:'#CF7555',green:'#3F5A45',greenD:'#2C4232',greenL:'#5E7C62',glass:'#2B3136',glassG:'#A9BFB3',plant:'#4E7A4E',metal:'#9EA2A0',metalD:'#5E6362',char:'#2E2F31',lamp:'#F4E3A8',rock:'#B89D78',rockD:'#8F7657'};
function B(a,b,c,d,e,f,col){box(Math.round(a),Math.round(b),Math.round(c),Math.round(d),Math.round(e),Math.round(f),col);}
function discX(x0,x1,cy,cz,r,col){const R=Math.ceil(r);for(let dy=-R;dy<=R;dy++)for(let dz=-R;dz<=R;dz++)if(dy*dy+dz*dz<=r*r+0.3)B(x0,cy+dy,cz+dz,x1,cy+dy,cz+dz,col);}
function discZ(z0,z1,cx,cy,r,col){const R=Math.ceil(r);for(let dx=-R;dx<=R;dx++)for(let dy=-R;dy<=R;dy++)if(dx*dx+dy*dy<=r*r+0.3)B(cx+dx,cy+dy,z0,cx+dx,cy+dy,z1,col);}
function stadiumZ(xa,xb,cy,r,z0,z1,col){for(let x=Math.floor(xa-r);x<=Math.ceil(xb+r);x++)for(let y=Math.floor(cy-r);y<=Math.ceil(cy+r);y++){const px=Math.max(xa,Math.min(xb,x));if(Math.hypot(x-px,y-cy)<=r+0.2)B(x,y,z0,x,y,z1,col);}}

// regolith ground
function inGround(x,z){const cx=Math.min(Math.max(x,54),202),cz=Math.min(Math.max(z,54),202);const dx=x-cx,dz=z-cz;return dx*dx+dz*dz<=900;}
for(let x=24;x<=232;x++){let z0=-1,z1=-1;for(let z=24;z<=232;z++)if(inGround(x,z)){if(z0<0)z0=z;z1=z;}if(z0<0)continue;
  B(x,4,z0,x,5,z1,C.sandDD);B(x,6,z0,x,6,z1,C.sandD);
  let rs=z0,rc=null;for(let z=z0;z<=z1+1;z++){const n=z<=z1?Math.sin(x*0.06+z*0.02)+Math.sin(z*0.07-x*0.03):0;const c=z<=z1?(n>0.9?C.sandD:C.sand):null;if(c!==rc){if(rc)B(x,7,rs,x,7,z-1,rc);rc=c;rs=z;}}}
ellipsoid(34,7,84,9,2.5,16,C.sandD);ellipsoid(90,7,224,16,2.5,6,C.sandD);ellipsoid(170,7,222,14,2.5,7,C.sandD);
for(const r of [[32,204,5,3,4,C.rock],[58,222,4,3,5,C.rockD],[214,214,6,3,5,C.rock],[228,150,3,3,4,C.rockD],[40,44,5,3,5,C.rock],[210,30,4,3,3,C.rockD],[150,30,4,3,3,C.rock]])ellipsoid(r[0],7,r[1],r[2],r[3],r[4],r[5]);
B(26,7,176,44,7,176,C.sandDD);B(26,7,200,44,7,200,C.sandDD);
B(96,7,182,108,7,182,C.sandDD);B(96,7,202,108,7,202,C.sandDD);
for(let t=0;t<=1.0001;t+=0.05){const x=Math.round(114+74*t),z=Math.round(162+16*t);B(x,7,z,x+1,7,z+1,C.beigeD);}

// raised science platform
function inDeck(x,z){if(x<46||x>210||z<34||z>122)return false;const a=x-46,b=210-x,c=z-34,d=122-z;return a+c>=14&&b+c>=14&&a+d>=14&&b+d>=14;}
const LEGX=[54,88,128,168,202],LEGZ=[42,78,114];
for(const lx of LEGX)for(const lz of LEGZ){cylinder(lx,8,lz,3.5,2,C.metalD);beam(lx,10,lz,lx,22,lz,2.2,C.terraD);}
for(const lz of [42,114])for(let i=0;i<4;i++){beam(LEGX[i],11,lz,LEGX[i+1],21,lz,0.8,C.greenD);beam(LEGX[i],21,lz,LEGX[i+1],11,lz,0.8,C.greenD);}
for(const lx of [54,202])for(let j=0;j<2;j++){beam(lx,11,LEGZ[j],lx,21,LEGZ[j+1],0.8,C.greenD);beam(lx,21,LEGZ[j],lx,11,LEGZ[j+1],0.8,C.greenD);}
for(let x=46;x<=210;x++){let z0=-1,z1=-1;for(let z=34;z<=122;z++)if(inDeck(x,z)){if(z0<0)z0=z;z1=z;}if(z0<0)continue;B(x,23,z0,x,25,z1,C.terra);B(x,26,z0,x,26,z1,C.beigeD);}
for(let x=46;x<=210;x++)for(let z=34;z<=122;z++){if(inDeck(x,z)&&((x-46)%12===0||(z-34)%11===0))block(x,26,z,C.sandDD);}
function railSeg(x0,z0,x1,z1){const n=Math.max(1,Math.round(Math.hypot(x1-x0,z1-z0)/7));for(let i=0;i<=n;i++){const x=Math.round(x0+(x1-x0)*i/n),z=Math.round(z0+(z1-z0)*i/n);B(x,27,z,x,31,z,C.greenD);}line(x0,31,z0,x1,31,z1,C.green);line(x0,29,z0,x1,29,z1,C.green);}
railSeg(60,34,196,34);railSeg(46,48,60,34);railSeg(46,48,46,108);railSeg(46,108,60,122);
railSeg(60,122,95,122);railSeg(113,122,139,122);railSeg(161,122,196,122);
railSeg(196,122,210,108);railSeg(210,108,210,48);railSeg(210,48,196,34);
for(let z=123;z<=160;z++){const yt=Math.round(26-(z-122)*18/38);B(96,7,z,112,yt,z,C.terraD);B(97,yt,z,111,yt,z,(z%3===0)?C.metalD:C.beigeD);B(96,yt+1,z,96,yt+1,z,C.terra);B(112,yt+1,z,112,yt+1,z,C.terra);}

// solar sail mast: turntable, housing, triangular truss
cylinder(128,27,62,13,3,C.greenD);
ring(128,28,62,13.4,1,C.terraD,'y');
for(let a=0;a<360;a+=15){const t=a*Math.PI/180;block(Math.round(128+14.6*Math.cos(t)),28,Math.round(62+14.6*Math.sin(t)),C.metalD);}
B(114,27,40,142,38,49,C.beige);B(113,39,39,143,39,50,C.beigeD);for(let x=117;x<=139;x+=4)B(x,30,39,x+1,36,39,C.greenD);
cylinder(128,30,62,8,2,C.terraD);
const LP=[[128,68],[123,59],[133,59]];
for(const [lx,lz] of LP)beam(lx,32,lz,lx,214,lz,1.2,C.terra);
for(let y=36;y<=212;y+=12){for(let i=0;i<3;i++){const a=LP[i],b=LP[(i+1)%3];beam(a[0],y,a[1],b[0],y,b[1],0.8,C.terraD);}}
for(let y=36;y<212;y+=12){for(let i=0;i<3;i++){const a=LP[i],b=LP[(i+1)%3];if((((y-36)/12)+i)%2===0)beam(a[0],y,a[1],b[0],y+12,b[1],0.7,C.terraL);else beam(b[0],y,b[1],a[0],y+12,a[1],0.7,C.terraL);}}
B(124,214,57,132,220,69,C.beigeD);
cylinder(128,221,63,2,3,C.lamp);
B(127,220,69,129,224,71,C.metalD);
for(let dx=-15;dx<=15;dx++)for(let dy=-15;dy<=15;dy++){if(Math.abs(dx)+Math.abs(dy)>15)continue;block(128+dx,222+dy,72,((dx>=0)===(dy>=0))?C.terraL:C.beige);}
beam(113,222,71,143,222,71,0.9,C.metal);beam(128,207,71,128,237,71,0.9,C.metal);
// framed, billowed photovoltaic sails
function sail(xa,xb,yb,yt){
  beam(xa,yt,71,xb,yt,71,1.6,C.terraD);beam(xa,yb,71,xb,yb,71,1.2,C.terraD);
  beam(xa,yb,71,xa,yt,71,1,C.terraD);beam(xb,yb,71,xb,yt,71,1,C.terraD);
  for(let x=xa+1;x<=xb-1;x++){const u=(x-xa)/(xb-xa);for(let y=yb+1;y<=yt-1;y++){const v=(y-yb)/(yt-yb);const b=Math.round(4*Math.sin(Math.PI*u)*Math.sin(Math.PI*v));
    const seam=((x-xa-1)%7===0)||((y-yb-1)%7===0);
    block(x,y,72+b,C.beige);block(x,y,73+b,seam?C.beigeD:(((Math.floor((x-xa)/7)+Math.floor((y-yb)/7))%2===0)?C.greenD:C.green));}}
  for(const yy of [yt,yb])B(126,yy-1,68,130,yy+1,71,C.metalD);
  block(xa,yt,73,C.lamp);block(xb,yt,73,C.lamp);
}
sail(73,183,84,122);sail(86,170,130,166);sail(99,157,174,204);
for(const a of [[70,27,40],[186,27,40],[30,8,62],[226,8,62]]){line(128,208,62,a[0],a[1],a[2],C.metalD);B(a[0]-1,a[1],a[2]-1,a[0]+1,a[1]+1,a[2]+1,C.terraD);}

// spherical habitat
cylinder(84,27,82,14,6,C.terra);
ellipsoid(84,49,82,22,22,22,C.beige);
ring(84,49,82,22,1.2,C.terra,'y');
for(const [yy,rr] of [[60,19.1],[38,19.1],[68,11.5]])ring(84,yy,82,rr,0.6,C.beigeD,'y');
for(let k=0;k<8;k++){const az=k*Math.PI/4+0.2,lat=0.38;ellipsoid(84+22.6*Math.cos(lat)*Math.cos(az),49+22.6*Math.sin(lat),82+22.6*Math.cos(lat)*Math.sin(az),2.2,2.2,2.2,C.glass);}
cylinder(84,70,82,5,3,C.terra);ellipsoid(84,73,82,5,2.5,5,C.glassG);
beam(84,36,100,84,36,112,5,C.beige);ring(84,36,112,4,0.8,C.terra,'z');

// connecting node and tunnels
cylinder(128,27,88,9,18,C.beige);ellipsoid(128,45,88,9,3,9,C.beigeD);
ring(128,36,88,9.3,0.8,C.terra,'y');
B(125,28,97,131,38,97,C.terraD);
beam(106,36,88,119,36,88,4.5,C.beige);beam(137,36,88,159,36,88,4.5,C.beige);
for(const x of [108,118,138,158])ring(x,36,88,4.8,0.8,C.terra,'x');

// cylindrical greenhouse
const GX=176,GY=44;
for(const zc of [60,82,104])for(let x=162;x<=190;x++){const dx=x-GX;const s=Math.sqrt(Math.max(0,256-dx*dx));const top=Math.min(34,Math.floor(GY-s)+1);if(top>=27)B(x,27,zc-2,x,top,zc+2,C.terraD);}
discZ(52,112,GX,GY,16,C.beige);
for(let z=52;z<=112;z++){if(z%8===0)continue;for(let dx=-17;dx<=17;dx++)for(let dy=-17;dy<=17;dy++){const r=Math.sqrt(dx*dx+dy*dy);if(r<15.4||r>16.3||dy<-5)continue;let c=C.glassG;if(dy<=3)c=((z*3+dx*2+dy)%5<3)?C.plant:C.greenL;block(GX+dx,GY+dy,z,c);}}
for(let z=56;z<=108;z+=8)ring(GX,GY,z,16.4,1,C.terra,'z');
discZ(52,52,GX,GY,16,C.beigeD);discZ(112,112,GX,GY,16,C.beigeD);
ring(GX,GY,112,15.5,1,C.terra,'z');ring(GX,GY,52,15.5,1,C.terra,'z');
B(172,29,113,180,42,113,C.terraD);B(174,37,114,178,40,114,C.glass);
B(174,60,54,178,61,110,C.greenD);for(let z=56;z<=108;z+=4)B(174,62,z,178,62,z+1,C.metalD);

// lifting cargo rack at the deck edge
B(138,8,122,162,8,144,C.metalD);
B(140,9,124,142,48,126,C.terraD);B(158,9,124,160,48,126,C.terraD);
B(140,47,124,160,49,126,C.terra);B(146,50,123,154,54,127,C.greenD);discZ(128,128,150,52,2.5,C.metal);
line(141,10,127,141,46,127,C.metalD);line(159,10,127,159,46,127,C.metalD);
B(143,16,127,157,17,141,C.metalD);
for(const [cx,cz] of [[143,127],[157,127],[143,141],[157,141]])B(cx,18,cz,cx,31,cz,C.greenD);
B(143,24,127,157,24,141,C.metalD);B(143,31,127,157,31,141,C.metalD);
B(142,16,126,143,31,127,C.metal);B(157,16,126,158,31,127,C.metal);
line(147,46,127,147,32,127,C.metalD);line(153,46,127,153,32,127,C.metalD);
B(145,18,129,150,22,134,C.terra);B(151,18,130,155,23,136,C.beige);B(145,25,131,152,29,137,C.greenL);B(153,25,128,156,28,133,C.terraL);B(146,32,130,154,35,138,C.beigeD);

// cargo lander
const LX=200,LZ=176;
cone(LX,13,LZ,6,3,8,C.char);
cylinder(LX,21,LZ,12,20,C.beige);
cylinder(LX,21,LZ,12.2,3,C.terraD);
ring(LX,32,LZ,12.3,0.8,C.terra,'y');
cone(LX,41,LZ,12,4.5,8,C.beigeD);
ring(LX,49,LZ,4,1,C.metal,'y');
line(LX+3,49,LZ,LX+3,58,LZ,C.metalD);block(LX+3,59,LZ,C.lamp);
for(const [sx,sz] of [[1,1],[1,-1],[-1,1],[-1,-1]]){const px=LX+sx*18,pz=LZ+sz*18;beam(LX+sx*8,28,LZ+sz*8,px,10,pz,1.3,C.terra);beam(LX+sx*6,22,LZ+sz*6,LX+sx*13,17,LZ+sz*13,0.9,C.terraD);cylinder(px,8,pz,3.5,2,C.metalD);}
B(194,25,187,206,37,188,C.char);
for(let k=0;k<=13;k++){const z=189+k;const y=Math.round(24-k*16/13);B(194,y,z,206,y,z,(k%3===0)?C.terraD:C.terra);}
B(212,34,174,224,35,178,C.greenD);B(176,34,174,188,35,178,C.greenD);
B(211,34,175,212,35,177,C.metalD);B(188,34,175,189,35,177,C.metalD);
for(let x=178;x<=222;x+=4){if(x>188&&x<212)continue;B(x,35,174,x,35,178,C.beigeD);}
B(190,8,204,197,14,211,C.terra);B(191,15,205,196,17,210,C.terraD);B(205,8,206,212,13,212,C.beige);

// wheeled rover
for(const wx of [50,64,78]){discZ(175,177,wx,13,5,C.char);discZ(174,174,wx,13,2,C.metal);discZ(199,201,wx,13,5,C.char);discZ(202,202,wx,13,2,C.metal);}
for(const lz of [178,198]){beam(56,22,lz,50,13,lz,1,C.terraD);beam(56,22,lz,71,18,lz,1,C.terraD);beam(71,18,lz,64,13,lz,0.9,C.terraD);beam(71,18,lz,78,13,lz,0.9,C.terraD);discZ(lz,lz,56,22,1.8,C.metalD);discZ(lz,lz,71,18,1.5,C.metalD);}
B(48,20,179,80,27,197,C.beige);B(48,23,179,80,24,179,C.terra);B(48,23,197,80,24,197,C.terra);
B(46,28,177,82,29,199,C.greenD);for(let x=46;x<=82;x+=6)B(x,29,177,x,29,199,C.beigeD);for(let z=177;z<=199;z+=6)B(46,29,z,82,29,z,C.beigeD);
beam(76,30,184,76,45,184,1,C.metal);B(73,45,182,80,49,187,C.beige);B(81,46,183,81,47,184,C.glass);B(81,46,185,81,47,186,C.glass);
beam(82,22,192,92,18,194,1,C.metalD);beam(92,18,194,96,10,194,0.9,C.metalD);B(95,8,192,98,10,196,C.metal);
line(54,30,186,54,31,186,C.metalD);ellipsoid(54,32,186,3,1,3,C.beigeD);

// tracked sampling vehicle
for(const [z0,z1] of [[180,185],[199,204]]){stadiumZ(115,141,12.5,4.5,z0,z1,C.char);for(let x=115;x<=141;x+=2){block(x,17,z0,C.metalD);block(x,17,z1,C.metalD);}const zf=z0===180?179:205;for(const wx of [116,122,128,134,140])discZ(zf,zf,wx,12,2.2,C.metal);}
B(113,18,186,143,28,198,C.terra);B(112,29,185,144,29,199,C.terraD);
B(116,20,185,140,25,185,C.beige);B(116,20,199,140,25,199,C.beige);
B(141,24,188,146,30,196,C.greenD);B(147,26,189,147,28,190,C.glass);B(147,26,194,147,28,195,C.glass);
for(let k=0;k<5;k++){cylinder(116+5*k,30,192,1.8,5,C.beige);cylinder(116+5*k,35,192,1.8,1,C.terraL);}
for(const [px,pz] of [[106,189],[109,189],[106,195],[109,195]])B(px,18,pz,px,50,pz,C.metalD);
for(let y=20;y<=48;y+=7){B(106,y,189,109,y,189,C.metalD);B(106,y,195,109,y,195,C.metalD);B(106,y,189,106,y,195,C.metalD);B(109,y,189,109,y,195,C.metalD);}
B(105,50,188,110,52,196,C.terraD);B(106,40,190,109,44,194,C.terra);
beam(107.5,8,192,107.5,40,192,0.8,C.metal);
B(110,22,190,112,26,194,C.metalD);
beam(144,26,192,154,16,192,1,C.metalD);B(152,8,189,157,12,195,C.metal);
for(const [fx,fz] of [[150,206],[160,200],[156,212]]){line(fx,8,fz,fx,13,fz,C.metalD);B(fx,13,fz,fx+2,14,fz,C.terraL);}

// standalone communication antenna on a knoll
ellipsoid(40,7,128,15,3.5,13,C.rock);
for(const a of [0,120,240]){const t=a*Math.PI/180;beam(40,26,128,40+9*Math.cos(t),9,128+9*Math.sin(t),0.9,C.terraD);}
beam(40,24,128,40,32,128,1.4,C.terraD);
B(37,32,125,43,36,131,C.greenD);
const AX=[0.4,0.75,0.53],E1=[-0.798,0,0.602],E2=[0.4515,-0.664,0.5985],DC=[40,42,128],FOC=9;
beam(40,36,128,DC[0]-0.9*AX[0],DC[1]-0.9*AX[1],DC[2]-0.9*AX[2],1.3,C.greenD);
for(let u=-13;u<=13;u+=0.5)for(let v=-13;v<=13;v+=0.5){if(u*u+v*v>169)continue;const d=(u*u+v*v)/(4*FOC);const p=[0,1,2].map(i=>DC[i]+u*E1[i]+v*E2[i]+d*AX[i]);block(Math.round(p[0]),Math.round(p[1]),Math.round(p[2]),C.beige);block(Math.round(p[0]-0.9*AX[0]),Math.round(p[1]-0.9*AX[1]),Math.round(p[2]-0.9*AX[2]),C.beigeD);}
const F=[0,1,2].map(i=>DC[i]+FOC*AX[i]);
for(const th of [90,210,330]){const t=th*Math.PI/180,u=13*Math.cos(t),v=13*Math.sin(t),d=169/(4*FOC);const p=[0,1,2].map(i=>DC[i]+u*E1[i]+v*E2[i]+d*AX[i]);line(p[0],p[1],p[2],F[0],F[1],F[2],C.metalD);}
ellipsoid(F[0],F[1],F[2],1.6,1.6,1.6,C.terra);
B(48,10,138,54,15,144,C.greenD);block(51,16,141,C.lamp);
line(51,8,138,54,8,117,C.char);

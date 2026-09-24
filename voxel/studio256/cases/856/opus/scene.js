const C={sand:'#CBBFA4',sandL:'#DDD3BD',sandD:'#B0A386',stone:'#B7B3AA',stoneL:'#CECAC1',stoneD:'#96928A',slate:'#3F4C59',slateD:'#2D3741',slateL:'#5A6977',ochre:'#C18A45',ochreL:'#D9AA68',ochreD:'#9C6B33',ochreDD:'#744F25',cream:'#E8DFCB',star:'#E06A3B',eye:'#4CC4E6',anem:'#EFC94C',grass:'#66704A',grassD:'#4C5536',fin:'#D4D6D2'};
function B(a,b,c,d,e,f,col){box(Math.round(a),Math.round(b),Math.round(c),Math.round(d),Math.round(e),Math.round(f),col);}

// seabed slice with visible sediment strata
const PCX=128,PCZ=128;
function sOut(x,z){const dx=x-PCX,dz=z-PCZ;const th=Math.atan2(dz,dx);const m=1+0.025*Math.sin(3*th+0.4)+0.02*Math.sin(7*th+1.1);return Math.pow(Math.abs(dx)/(88*m),4)+Math.pow(Math.abs(dz)/(72*m),4);}
function inP(x,z){return sOut(x,z)<=1;}
function zPath(x){const s=(x-62)/116;return 150+10*Math.sin(2*Math.PI*0.9*s+0.3);}
const FLAT=[[92,132,174,192],[54,90,172,194],[170,198,166,184],[108,158,100,116]];
function isFlat(x,z){if(x>=46&&x<=194&&Math.abs(z-zPath(x))<18)return true;for(const f of FLAT)if(x>=f[0]&&x<=f[1]&&z>=f[2]&&z<=f[3])return true;return false;}
function ripple(x,z){return Math.sin(0.42*(0.8*x+0.6*z)+0.9*Math.sin(0.045*z));}
function mound(x,z){return Math.round(4*Math.exp(-((x-85)*(x-85)+(z-95)*(z-95))/1800));}
function H(x,z){let h=15+mound(x,z);if(!isFlat(x,z))h+=Math.round(0.8*ripple(x,z));if(sOut(x,z)>0.9)h-=1;return h;}
function strat(x,y,z){const t=y+1.3*Math.sin(x*0.09+z*0.02)+1.0*Math.sin(z*0.11-x*0.03);return t<7?C.slateD:t<9.5?C.slate:t<11.5?C.stoneD:t<13?C.ochreD:C.sandD;}
for(let x=36;x<=220;x++)for(let z=52;z<=204;z++){
  if(!inP(x,z))continue;
  const h=H(x,z);
  const wall=!inP(x-3,z)||!inP(x+3,z)||!inP(x,z-3)||!inP(x,z+3);
  if(wall){for(let y=4;y<h;y++)block(x,y,z,strat(x,y,z));}
  else B(x,h-3,z,x,h-1,z,C.sandD);
  const rp=isFlat(x,z)?0:ripple(x,z);
  block(x,h,z,rp>0.55?C.sandL:(rp<-0.55?C.sandD:C.sand));
}

// reef rock outcrop with a stratum ledge and a front crevice
ellipsoid(78,26,96,30,20,24,C.stone);
ellipsoid(106,22,84,20,15,17,C.stoneD);
ellipsoid(66,46,90,17,13,15,C.stone);
ellipsoid(92,40,104,12,10,11,C.stoneL);
ellipsoid(52,24,112,10,9,9,C.stoneD);
ellipsoid(70,64,86,9,12,9,C.stoneD);
ellipsoid(58,34,80,12,10,12,C.stoneL);
ellipsoid(78,30,96,31.5,2.2,25.5,C.stoneD);
ellipsoid(66,44,90,18,1.6,16,C.slateL);
for(let x=70;x<=98;x++)for(let z=108;z<=128;z++){const hz=H(x,z);for(let y=hz+1;y<=29;y++){const q=((x-84)/14)*((x-84)/14)+((y-22)/7)*((y-22)/7)+((z-118)/10)*((z-118)/10);if(q<=1)block(x,y,z,null);}}
function surf(cx,cy,cz,rx,ry,rz,az,el){return [cx+rx*Math.cos(el)*Math.cos(az),cy+ry*Math.sin(el),cz+rz*Math.cos(el)*Math.sin(az)];}
for(const [az,el] of [[0.6,0.5],[1.4,0.3],[2.4,0.6],[3.6,0.4],[5.0,0.5]]){const p=surf(78,26,96,30,20,24,az,el);ellipsoid(p[0],p[1],p[2],2.5,2,2.5,C.ochreD);}
for(let k=0;k<14;k++){const az=0.3+k*0.23,el=0.15+0.05*(k%4);const p=surf(78,26,96,30.3,20.3,24.3,az,el);cone(Math.round(p[0]),Math.round(p[1]),Math.round(p[2]),1.4,0.5,2,C.stoneL);}
for(const q of [[78,26,96,30,20,24,1.2,0.75],[66,46,90,17,13,15,0.9,0.6],[106,22,84,20,15,17,1.3,0.55]]){const p=surf(q[0],q[1],q[2],q[3],q[4],q[5],q[6],q[7]);const x=Math.round(p[0]),y=Math.round(p[1]),z=Math.round(p[2]);cylinder(x,y,z,1.5,3,C.ochreL);cylinder(x,y+3,z,2,1,C.anem);block(x,y+3,z,C.ochreD);}

// brittle star reaching out of the crevice
const byy=H(84,116)+1;
ellipsoid(84,byy,116,3,1.2,3,C.slateL);
for(let k=0;k<5;k++){const th=(20+k*40)*Math.PI/180;const dx=Math.cos(th),dz=Math.sin(th);let prev=null;for(let t=0;t<=1.0001;t+=0.04){const w=2.2*Math.sin(t*Math.PI*2.2+k);const x=84+t*24*dx-w*dz,z=116+t*24*dz+w*dx;const y=H(Math.round(x),Math.round(z))+1;const p=[x,y,z];if(prev)beam(prev[0],prev[1],prev[2],p[0],p[1],p[2],t<0.35?0.8:0.5,(Math.floor(t*25/3)%2===0)?C.slateL:C.ochreL);prev=p;}}

// flat ledge with starfish and sea whip
ellipsoid(178,20,92,28,8,20,C.stoneD);
ellipsoid(176,28,90,22,5,15,C.stone);
ellipsoid(178,24,92,29,1.4,21,C.slateL);
function e2Top(x,z){const q=1-((x-176)/22)*((x-176)/22)-((z-90)/15)*((z-90)/15);return q>0?28+5*Math.sqrt(q):28;}
for(let k=0;k<5;k++){const th=(k*72+12)*Math.PI/180;for(let t=0;t<=1.0001;t+=0.06){const x=176+13*t*Math.cos(th),z=90+13*t*Math.sin(th);const r=2.8-1.8*t;const y=e2Top(x,z)+r*0.6+(t>0.85?0.8:0);ellipsoid(x,y,z,r,r*0.65,r,C.star);if(Math.round(t*100)%18===0&&t>0.1)block(Math.round(x),Math.floor(y+r*0.65),Math.round(z),C.cream);}}
const sct=e2Top(176,90);
ellipsoid(176,sct+1.6,90,4.2,2,4.2,C.star);block(176,Math.floor(sct+3.5),90,C.ochreD);
beam(190,30,80,191,48,79,1.1,C.ochreD);beam(191,48,79,193,62,77,0.8,C.ochreD);
beam(190.5,40,79.5,184,50,79,0.7,C.ochreD);beam(191,46,79,198,56,80,0.7,C.ochreD);beam(192,54,78,187,62,77,0.6,C.ochreD);

// main sea cucumber: S-curved body, pentaradial ridges, papillae, tube feet, tentacle crown
function pathP(s){return [62+116*s,150+10*Math.sin(2*Math.PI*0.9*s+0.3)];}
function rad(s){return 11*Math.pow(Math.sin(Math.PI*(0.08+0.84*s)),0.6);}
for(let s=0;s<=1.0001;s+=0.012){const [x,z]=pathP(s);const r=rad(s),ry=0.82*r;ellipsoid(x,15+ry,z,r*0.95,ry,r,C.ochre);}
for(let s=0.05;s<=0.95;s+=0.05){const [x,z]=pathP(s);const r=rad(s),ry=0.82*r;ellipsoid(x+(rng()-0.5)*2,15+ry*1.85,z+(rng()-0.5)*4,3,0.9,2.5,C.ochreD);}
const PHI=[90,162,234,306,18];
for(let s=0.02;s<=0.98;s+=0.012){const [x,z]=pathP(s);const r=rad(s),ry=0.82*r;for(const pd of PHI){const f=pd*Math.PI/180;ellipsoid(x,15+ry+ry*1.02*Math.sin(f),z+r*1.02*Math.cos(f),0.9,0.9,0.9,C.ochreD);}}
for(let s=0.06;s<=0.94;s+=0.03){const [x,z]=pathP(s);const r=rad(s),ry=0.82*r;const set=Math.round(s*100)%2===0?[55,125]:[90,20,160];for(const pd of set){const f=(pd+(rng()-0.5)*16)*Math.PI/180;const px=Math.round(x),py=Math.round(15+ry+ry*Math.sin(f)),pz=Math.round(z+r*Math.cos(f));const hh=pd===20||pd===160?2:3;cone(px,py-1,pz,1.7,0.3,hh+1,C.ochreL);block(px,py+hh,pz,C.ochreDD);}}
for(let s=0.04;s<=0.96;s+=0.02){const [x,z]=pathP(s);const r=rad(s),ry=0.82*r;for(const pd of [250,290]){const f=pd*Math.PI/180;ellipsoid(x,Math.max(16,15+ry+ry*Math.sin(f)),z+r*1.02*Math.cos(f),0.9,0.9,0.9,C.ochreL);}}
const [hx,hz]=pathP(0);const hr=rad(0);const hy=15+0.82*hr;const mx=hx-hr*0.9;
ellipsoid(mx,hy,hz,1.5,2.5,2.5,C.slate);
for(let k=0;k<12;k++){const psi=k*Math.PI/6,al=0.95;const d=[-Math.cos(al),Math.sin(al)*Math.sin(psi),Math.sin(al)*Math.cos(psi)];const L=8+(k%3);
  const ex=mx+L*d[0],ez=hz+L*d[2];let ey=hy+L*d[1];const fl=H(Math.round(ex),Math.round(ez))+1;if(ey<fl)ey=fl;
  beam(mx+1.8*d[0],hy+1.8*d[1],hz+1.8*d[2],ex,ey,ez,0.7,C.ochreL);
  ellipsoid(ex,ey,ez,1.4,1.1,1.4,C.cream);
  for(let j=0;j<3;j++){const a=j*2.1+k;line(ex,ey,ez,ex+1.8*Math.cos(a)+d[0],ey+1.2,ez+1.8*Math.sin(a),C.cream);}}
const [tx,tz]=pathP(1);const tr=rad(1);
ellipsoid(tx+tr*0.95,15+0.82*tr,tz,1,1.5,1.5,C.slateD);
for(let x=183;x<=212;x++){const z=146+Math.round(1.5*Math.sin(x*0.2));for(let dz=-1;dz<=1;dz++){if(inP(x,z+dz))block(x,H(x,z+dz),z+dz,C.sandD);}}
for(const [cx,cz] of [[188,146],[195,147],[202,145],[209,147]]){const y0=H(cx,cz)+1;ring(cx,y0,cz,1.8,0.8,C.sandD,'y');ring(cx,y0+1,cz,1.3,0.7,C.sandD,'y');block(cx,y0+2,cz,C.sandD);}

// small dark sea cucumber feeding at the rock foot
function p2(s){return [118+34*s,108+3*Math.sin(2*Math.PI*s+1)];}
function r2(s){return 6*Math.pow(Math.sin(Math.PI*(0.1+0.8*s)),0.6);}
for(let s=0;s<=1.0001;s+=0.02){const [x,z]=p2(s);const r=r2(s),ry=0.8*r;const yb=H(Math.round(x),Math.round(z));ellipsoid(x,yb+ry,z,r*0.95,ry,r,C.slate);}
for(let s=0.1;s<=0.9;s+=0.06){const [x,z]=p2(s);const r=r2(s),ry=0.8*r;const yb=H(Math.round(x),Math.round(z));for(const pd of [60,120]){const f=pd*Math.PI/180;const px=Math.round(x),py=Math.round(yb+ry+ry*Math.sin(f)),pz=Math.round(z+r*Math.cos(f));cone(px,py-1,pz,1.2,0.2,3,C.ochreL);}}
{const [x0,z0]=p2(0);const r=r2(0);const yb=H(Math.round(x0),Math.round(z0));const cy=yb+0.8*r;const m0=x0-r*0.9;
  for(let k=0;k<8;k++){const psi=k*Math.PI/4;const d=[-0.6,0.8*Math.sin(psi),0.8*Math.cos(psi)];const ex=m0+5*d[0],ez=z0+5*d[2];let ey=cy+5*d[1];const fl=H(Math.round(ex),Math.round(ez))+1;if(ey<fl)ey=fl;beam(m0,cy,z0,ex,ey,ez,0.6,C.ochreL);ellipsoid(ex,ey,ez,1,1,1,C.cream);}}

// scallop with bright mantle eyes
const shY=H(184,172)+1;
for(let r=0;r<=11;r+=0.5)for(let a=-65;a<=65;a+=2){const t=a*Math.PI/180;const x=184+r*Math.sin(t),z=170+r*Math.cos(t);const rib=Math.floor((a+65)/11)%2===0;const dome=0.9*Math.sin(Math.PI*r/11.5);
  block(Math.round(x),Math.round(shY+dome*0.5),Math.round(z),rib?C.ochreL:C.cream);
  const op=22*Math.PI/180;block(Math.round(x),Math.round(shY+1+r*Math.cos(t)*Math.sin(op)+dome),Math.round(170+r*Math.cos(t)*Math.cos(op)),rib?C.ochre:C.ochreL);}
B(180,shY,168,188,shY+1,170,C.ochreD);
for(let a=-55;a<=55;a+=14){const t=a*Math.PI/180;block(Math.round(184+10.5*Math.sin(t)),shY+1,Math.round(170+10.5*Math.cos(t)),C.eye);}

// whelk shell lying on its side
const wy=H(70,182)+1;
for(let i=0;i<=40;i++){const t=i/40;const x=80-20*t,z=184-6*t;const r=6.5*(1-t)+1*t;ellipsoid(x,wy+r*0.9+t*2.5,z,r*0.9,r,r,C.cream);}
for(let i=0;i<=60;i++){const t=i/60;const x=80-20*t,z=184-6*t;const r=6.5*(1-t)+1*t;const ps=t*16;ellipsoid(x,wy+r*0.9+t*2.5+r*Math.sin(ps),z+r*Math.cos(ps),1,1,1,C.ochreD);}
ellipsoid(86,wy+6,184,1.2,4.2,3.8,C.slateD);
ring(86,wy+6,184,4.2,1,C.ochreL,'x');

// goby resting on the sand with spread fins
const GZ=183,gy=H(110,183)+1;
const gb=[[98,3.2,3.4],[102,3.8,3.8],[106,3.9,3.6],[110,3.7,3.3],[114,3.2,2.9],[118,2.6,2.3],[121,2.0,1.8],[124,1.5,1.3]];
for(const [x,ry,rz] of gb)ellipsoid(x,gy+ry-0.4,GZ,2.6,ry,rz,C.slateL);
for(const [x,ry,rz] of [[103,3.8,3.8],[108,3.8,3.5],[113,3.3,3.0],[117,2.7,2.4]]){for(const s of [-1,1])ellipsoid(x,gy+ry+0.6,GZ+s*(rz-0.6),0.8,0.8,0.8,C.ochre);}
for(const s of [-1,1]){ellipsoid(99,gy+6.1,GZ+s*1.6,1.3,1.3,1.3,C.cream);block(98,Math.round(gy+6.4),GZ+s*2,C.slateD);}
block(95,gy+2,GZ,C.slateD);
for(let x=104;x<=110;x++){const top=gy+7+Math.round(6*(1-(x-104)/8));for(let y=gy+6;y<=top;y++)block(x,y,GZ,(x%2===0)?C.slate:C.fin);}
for(let x=113;x<=122;x++){const base=gy+Math.round(2*gb[Math.min(7,Math.max(0,Math.round((x-98)/3.7)))][1])-1;const top=gy+10-Math.round((x-113)*0.35);for(let y=base;y<=top;y++)block(x,y,GZ,(x%2===1)?C.slate:C.fin);}
for(let x=125;x<=131;x++){const hh=1.5+(x-125)*0.6;for(let y=Math.max(gy,Math.round(gy+1.1-hh));y<=Math.round(gy+1.1+hh);y++)block(x,y,GZ,((y-gy)%2===0)?C.slate:C.fin);}
for(let x=114;x<=122;x++)block(x,gy,GZ,C.fin);
for(const s of [-1,1]){for(let r=1;r<=6;r+=0.5)for(let a=-50;a<=50;a+=6){const t=a*Math.PI/180;const dxv=0.3*Math.cos(t)+Math.sin(t)*0.95,dzv=Math.cos(t);const x=105+r*dxv,z=GZ+s*(3+r*dzv);block(Math.round(x),gy,Math.round(z),(a%18===0)?C.slate:C.fin);}}

// seagrass tufts, shell fragments, pebbles
function tuft(cx,cz,n,hmax,lean){for(let i=0;i<n;i++){const a=i*2.4+cx*0.1;const bx=cx+Math.round(2.2*Math.cos(a)),bz=cz+Math.round(2.2*Math.sin(a));const y0=H(bx,bz)+1;const hgt=hmax-(i%3)*5;let px=bx,py=y0,pz=bz;const col=(i%2===0)?C.grass:C.grassD;for(let j=1;j<=6;j++){const t=j/6;const nx=bx+lean[0]*t*t*hgt*0.35+Math.sin(a)*t*2,ny=y0+hgt*t,nz=bz+lean[1]*t*t*hgt*0.35+Math.cos(a)*t*2;beam(px,py,pz,nx,ny,nz,0.6,col);px=nx;py=ny;pz=nz;}}}
tuft(212,128,7,26,[-1,0.3]);tuft(48,140,6,22,[0.6,0.6]);tuft(60,68,6,24,[0.5,-0.4]);tuft(150,180,5,18,[0.3,0.7]);
for(const [x,z,c] of [[140,186,C.cream],[165,190,C.cream],[208,116,C.ochreL],[110,136,C.cream]]){const y=H(x,z)+1;ellipsoid(x,y,z,2.6,0.8,2,c);block(x,y,z,C.ochreD);}
for(const [x,z] of [[100,124],[112,118],[60,124],[122,96],[144,98]]){const y=H(x,z)+1;ellipsoid(x,y,z,1.6,1,1.5,C.stoneD);}

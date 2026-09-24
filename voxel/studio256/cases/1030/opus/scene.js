const P={
 ib1:'#cfe3ec',ib2:'#a9cad8',ib3:'#8fb5c7',wh1:'#f4f6f7',wh2:'#e3e9ec',
 gp1:'#8a7f99',gp2:'#a79dba',gp3:'#6c6280',gp4:'#c4bdd0',
 rk1:'#9c93ab',rk2:'#b5aec2',rk3:'#7d7590',rki:'#c9d0da',fl1:'#bdb7c9',fl2:'#aaa3b8',
 oak:'#c08a55',oak2:'#9a6a3e',oakL:'#d9a46a',glow:'#ffd98a',terra:'#c8744a',man:'#e0b877',scr:'#dff4fb',sage:'#9bbdb5'
};
const R=Math.round;
const OX=128,OZ=118,ORX=90,ORZ=76;
function oq(x,z){ const dx=(x-OX)/ORX,dz=(z-OZ)/ORZ,th=Math.atan2(dz,dx); return Math.hypot(dx,dz)/(1+0.05*Math.sin(3*th+0.7)+0.03*Math.sin(7*th)); }
function Hout(x,z){ const q=oq(x,z); if(q>=1) return -1; return 11+100*Math.pow(1-Math.pow(q,2.2),0.55)+2.5*Math.sin(x*0.11+z*0.05)*Math.cos(z*0.13); }
const KX=128,KZ=130,KRX=70,KRY=82,KRZ=62;
function cav(x,y,z){ const a=(x-KX)/KRX,b=(y-11)/KRY,c=(z-KZ)/KRZ; return a*a+b*b+c*c; }
function mouth(x,y,z){ if(z<150) return false; const t=(y-11)/76; if(t>1) return false; return Math.abs(x-128)<=58*Math.sqrt(Math.max(0,1-t*t))+1.2*Math.sin(y*0.5); }
function rockColor(x,y,z,ho,cv){
  if(cv<1.1){ const n=(x*7+y*3+z*5)%11; return n<2?P.rk2:(n<3?P.ib2:P.rki); }
  if(y>=ho-1.5&&oq(x,z)<0.9) return (y>=ho-0.6)?P.wh1:P.wh2;
  const band=((Math.floor((y+2*Math.sin(x*0.07)+2*Math.cos(z*0.06))/7)%3)+3)%3;
  return band===0?P.rk3:(band===1?P.rk1:P.rk2);
}
function rrDist(x,z,x0,x1,z0,z1,r){
  const qx=Math.max(x0+r-x,x-(x1-r),0),qz=Math.max(z0+r-z,z-(z1-r),0);
  if(qx>0&&qz>0) return r-Math.hypot(qx,qz);
  return Math.min(x-x0,x1-x,z-z0,z1-z);
}
for(let x=30;x<=226;x++) for(let z=30;z<=216;z++){
  const e=rrDist(x,z,30,226,30,216,12); if(e<0) continue;
  const full=e<3;
  for(let y=4;y<=10;y++){ if(!full&&y>4&&y<10) continue; block(x,y,z,y<=6?P.rk3:P.rk1); }
  let c;
  const inCave=cav(x,12,z)<1&&oq(x,z)<1;
  if(e<1.5) c=P.rk3;
  else if(inCave) c=(x%12===0||z%12===0)?P.fl2:P.fl1;
  else { const n=Math.sin(x*0.13)*Math.cos(z*0.11)+0.4*Math.sin(x*0.31+z*0.23); c=n>0.7?P.ib1:(n<-0.8?P.wh2:P.wh1); }
  block(x,11,z,c);
}
for(let x=OX-ORX-6;x<=OX+ORX+6;x++) for(let z=OZ-ORZ-6;z<=OZ+ORZ+6;z++){
  const q=oq(x,z); if(q>=1) continue;
  const ho=Hout(x,z);
  for(let y=12;y<=ho;y++){
    const cv=cav(x,y,z);
    if(cv<1||mouth(x,y,z)) continue;
    if(!(ho-y<=5||q>=0.94||cv<1.15||z>=150)) continue;
    block(x,y,z,rockColor(x,y,z,ho,cv));
  }
}

function archTop(x){ const d=x-112; return Math.abs(d)>24?-1:46+Math.sqrt(24*24-d*d); }
function inNiche(x,y,z){ if(x<88||x>136||z<54||y<12) return false; return y<=archTop(x); }
for(let x=82;x<=142;x++) for(let y=12;y<=76;y++) for(let z=44;z<=95;z++){
  const cv=cav(x,y,z); if(cv<1) continue;
  const ho=Hout(x,z); if(y>ho) continue;
  if(inNiche(x,y,z)){ block(x,y,z,null); continue; }
  const near=inNiche(x+2,y,z)||inNiche(x-2,y,z)||inNiche(x,y-2,z)||inNiche(x,y,z+2)||inNiche(x+1,y-1,z)||inNiche(x-1,y-1,z);
  block(x,y,z,near?P.wh1:rockColor(x,y,z,ho,cv));
}
function cubby(x0,x1,y0,y1){
  const cx=(x0+x1)/2,rw=(x1-x0)/2;
  for(let x=x0-1;x<=x1+1;x++) for(let y=y0-1;y<=y1+1;y++) for(let z=49;z<=53;z++){
    const top=y1-rw+Math.sqrt(Math.max(0,rw*rw-(x-cx)*(x-cx)));
    const inside=x>=x0&&x<=x1&&y>=y0&&y<=top&&z>=50;
    block(x,y,z,inside?null:P.wh2);
  }
}
cubby(96,104,53,63); cubby(108,116,53,63); cubby(120,128,53,63); cubby(90,97,37,47); cubby(127,134,37,47);
{
  const bc=[P.ib3,P.gp1,P.wh1,P.oak,P.gp2,P.ib2,P.gp3];
  for(let x=97;x<=103;x++){ const h=5+((x*3)%3); box(x,53,50,x,53+h,52,bc[x-97]); }
  for(let x=109;x<=115;x++) for(let y=55;y<=61;y++) if(Math.hypot(x-112,y-58)<=3.2) block(x,y,50,P.wh1);
  ring(112,58,50,3.4,0.6,P.gp3,'z');
  line(112,58,51,112,61,51,P.gp3); line(112,58,51,114,58,51,P.gp3);
  cylinder(123,53,51.5,2,3,P.wh1); ellipsoid(123,58,51.5,2.5,2.2,1.6,P.sage);
  cylinder(127,53,51.5,1.2,4,P.ib2);
  box(91,37,50,96,38,53,P.gp1); box(91,39,50,95,40,53,P.ib3); box(92,41,50,96,42,53,P.oak); box(91,43,50,95,44,53,P.wh2);
  cylinder(130.5,37,51.5,2,4,P.ib1); box(130,41,51,131,41,52,P.glow);
  box(132,37,50,134,38,53,P.wh1);
}
box(86,32,54,138,34,70,P.oak);
box(88,32,70,136,34,76,P.oak);
box(88,32,76,136,34,76,P.oak2);
box(119,34,66,129,34,75,P.oakL);
box(90,27,56,108,31,74,P.wh2); box(91,28,75,107,30,75,P.ib2); block(99,29,76,P.oak2);
box(110,12,54,134,14,60,P.rki);
box(88,50,54,136,51,62,P.wh1);
box(89,49,58,135,49,59,P.glow);
cylinder(92,52,58,1.5,5,P.ib2);
box(131,52,57,135,57,57,P.gp3); box(132,53,58,134,56,58,P.ib1);
box(104,35,59,118,35,68,P.gp3);
for(let x=105;x<=117;x+=2) for(let z=60;z<=64;z+=2) block(x,35,z,P.gp1);
box(109,35,66,113,35,67,P.gp1);
for(let y=36;y<=47;y++){
  const zz=R(59-(y-36)*0.25);
  box(104,y,zz,118,y,zz,P.gp3);
  if(y>=37&&y<=46) box(105,y,zz,117,y,zz,P.scr);
}
box(90,35,64,95,35,72,P.wh1); box(97,35,64,102,35,72,P.wh2); box(96,35,64,96,35,72,P.gp2);
line(92,36,66,99,36,70,P.oak2);
cylinder(126,35,71,2.2,5,P.terra); ring(128.8,37,71,1.2,0.5,P.terra,'z');
cylinder(134,35,65,1.8,5,P.wh2);
line(134,40,65,133,44,64,P.oak2); line(134,40,65,135,44,66,P.ib3); line(134,40,65,134,45,65,P.gp3);
cylinder(130,35,57,3,1,P.gp3);
beam(130,36,57,131,45,65,0.8,P.gp3); beam(131,45,65,126,46,70,0.8,P.gp3);
ellipsoid(131,45,65,1.3,1.3,1.3,P.gp1);
cone(125,42,71,3.2,1.2,4,P.terra); ellipsoid(125,42,71,1.8,0.8,1.8,P.glow);
box(110,35,70,116,36,75,P.wh1);
cylinder(93,35,58,1.8,3,P.wh2); ellipsoid(93,39,58,2.2,1.6,2.2,P.sage);
for(let x=64;x<=84;x++){
  const a=(x-KX)/KRX,wz=KZ-KRZ*Math.sqrt(Math.max(0,1-a*a-0.004));
  for(let z=R(wz)-2;z<=R(wz)+6;z++) for(let y=12;y<=17;y++) block(x,y,z,y===17?P.wh2:P.rki);
}

for(let x=96;x<=140;x++) for(let z=78;z<=122;z++){
  const r=Math.hypot(x-118,z-100); if(r>22) continue;
  block(x,11,z,r>21?P.gp2:(r<6?P.ib2:((Math.floor(r/3.5)%2)?P.wh1:P.ib1)));
}
const CHX=124,CHZ=98,PH=0.45,CPH=Math.cos(PH),SPH=Math.sin(PH);
function cw(lx,lz){ return [CHX+lx*CPH-lz*SPH,CHZ+lx*SPH+lz*CPH]; }
function chairCell(lx,y,lz){
  const se=Math.pow(Math.abs(lx)/11,4)+Math.pow(Math.abs(lz)/11,4);
  if(y>=25&&y<=26&&se<=1) return P.gp1;
  if(y>=27&&y<=28&&Math.pow(Math.abs(lx)/10.2,4)+Math.pow(Math.abs(lz)/10.2,4)<=1) return P.ib2;
  if(y>=25&&y<=31&&Math.abs(lx)<=1.2&&lz>=8&&lz<=11.5) return P.gp3;
  if(y>=30&&y<=52){
    const off=(y-30)*0.18,t=(y-30)/22,w=9+2.5*Math.sin(Math.PI*t);
    if(lz>=10.5+off&&lz<=12.5+off&&Math.abs(lx)<=w){
      const edge=Math.abs(lx)>w-1.2||y===30||y===52;
      return edge?P.gp3:(lz<11.5+off?P.ib1:P.gp1);
    }
  }
  for(const s of [-1,1]){
    if(y>=27&&y<=33&&Math.abs(lx-12*s)<=0.8&&lz>=-1.5&&lz<=0.5) return P.gp3;
    if(y>=34&&y<=35&&Math.abs(lx-12*s)<=1.5&&lz>=-7&&lz<=5) return P.wh1;
  }
  return null;
}
for(let k=0;k<5;k++){
  const a=Math.PI/2+k*2*Math.PI/5,t=cw(11*Math.cos(a),11*Math.sin(a));
  beam(CHX,15,CHZ,t[0],13.5,t[1],1.1,P.gp3);
  ellipsoid(t[0],12.6,t[1],1.4,1.2,1.4,P.gp3);
}
cylinder(CHX,14,CHZ,2.2,5,P.gp1); cylinder(CHX,19,CHZ,1.2,6,P.wh2);
for(let x=CHX-18;x<=CHX+18;x++) for(let z=CHZ-18;z<=CHZ+18;z++){
  const dx=x-CHX,dz=z-CHZ,lx=dx*CPH+dz*SPH,lz=-dx*SPH+dz*CPH;
  for(let y=25;y<=53;y++){ const c=chairCell(lx,y,lz); if(c) block(x,y,z,c); }
}
for(let x=162;x<=198;x++) for(let z=100;z<=162;z++) for(let y=12;y<=17;y++){
  if(cav(x,y,z)>=1) continue;
  block(x,y,z,y===17?((x%8===0||z%8===0)?P.fl2:P.fl1):P.fl2);
}
box(156,12,130,158,13,138,P.fl2); box(159,12,130,161,15,138,P.fl2);
box(156,13,130,158,13,138,P.fl1); box(159,15,130,161,15,138,P.fl1);
box(175,18,112,188,47,128,P.gp1);
box(175,18,112,188,19,128,P.gp3);
box(174,47,111,189,47,129,P.gp3);
const DR=[[20,25],[27,32],[34,39],[41,46]];
for(let i=0;i<4;i++){
  const y0=DR[i][0],y1=DR[i][1];
  if(i===2){
    box(174,y0,113,176,y1,127,null);
    box(164,y0,113,173,y1,127,P.gp2);
    box(165,y0+1,114,172,y1,126,null);
    for(let x=165;x<=172;x+=2){ box(x,y0+1,115,x,y1+1,125,(x%4===1)?P.man:P.ib1); block(x,y1+2,116+((x*3)%8),P.ib3); }
    box(163,y0+2,118,163,y0+2,122,P.wh1);
    continue;
  }
  box(174,y0,113,174,y1,127,P.gp2);
  box(173,y0+3,117,173,y0+3,123,P.wh1);
  box(174,y1-1,119,174,y1-1,121,P.ib1);
}
cylinder(178,48,116,1.8,3,P.wh1); ellipsoid(178,52,116,2.4,2,2.4,P.sage);
box(182,48,120,187,49,127,P.ib3); box(182,50,121,186,50,126,P.gp2); box(177,48,122,180,48,127,P.wh2);
for(let x=184;x<=218;x++) for(let y=34;y<=58;y++) for(let z=134;z<=158;z++){
  const d=Math.hypot(y-46,z-146); if(d>11) continue;
  const cv=cav(x,y,z); if(cv<1) continue;
  const ho=Hout(x,z); if(y>ho) continue;
  block(x,y,z,d<=7?null:rockColor(x,y,z,ho,cv));
}
ring(189,46,146,7.6,0.9,P.wh1,'x');
box(178,18,138,190,24,156,P.wh2);
box(179,25,139,189,26,155,P.gp2);
ellipsoid(187,29,141,1.6,2.6,3,P.ib2); ellipsoid(187,29,153,1.6,2.6,3,P.terra);
box(182,27,145,185,27,150,P.wh1);
for(let x=82;x<=174;x+=4){
  if(Math.abs(x-128)>48) continue;
  let ya=-1; for(let y=95;y>=12;y--) if(mouth(x,y,162)){ ya=y; break; }
  if(ya<0) continue;
  if(cav(x,ya+1,162)<1||ya+1>Hout(x,162)) continue;
  const L=4+((x*7)%6);
  cone(x,ya-L+1,162,0.45,1.4,L,P.ib1);
}
for(const s of [[80,110,7],[170,150,6],[150,92,8],[88,152,5],[168,108,6]]){
  const a=(s[0]-KX)/KRX,c=(s[1]-KZ)/KRZ,yc=Math.floor(11+KRY*Math.sqrt(Math.max(0,1-a*a-c*c)));
  cone(s[0],yc-s[2]+1,s[1],0,1.8,s[2],P.rki); block(s[0],yc-s[2],s[1],P.ib1);
}
box(112,11,178,144,11,188,P.gp3); box(114,11,180,142,11,186,P.gp1);
box(148,12,174,150,17,177,P.gp3); box(148,12,178,150,13,179,P.gp3);
box(152,12,175,154,17,178,P.gp3); box(152,12,179,154,13,180,P.gp3);
ellipsoid(80,15,132,5,3.5,5,P.gp2); box(78,19,130,82,19,134,P.wh1);
for(const m of [[58,206,9,4,6],[196,204,10,4,7],[40,190,6,3,5],[214,192,7,3,6]]) ellipsoid(m[0],11,m[1],m[2],m[3],m[4],P.wh1);
for(let i=0;i<8;i++){ const z=200+i*2,x=126+(i%2)*6; box(x,11,z,x+1,11,z,P.ib2); }

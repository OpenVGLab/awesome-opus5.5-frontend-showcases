const P={
 ring1:'#b07b48',ring2:'#9a6a3c',pith:'#7a5230',crack:'#4e3624',bark1:'#3e3024',bark2:'#54402e',sap:'#c89662',
 st1:'#8b8174',st2:'#7a7166',st3:'#655d54',
 ms1:'#5d6b31',ms2:'#71803c',ms3:'#4a5627',ms4:'#8a9650',li1:'#cbb98a',
 sp1:'#9a5a2e',sp2:'#b8904f',sp3:'#3a3530',
 sc1:'#232326',sc2:'#34343a',sb1:'#c8a86a',sb2:'#e3d4a8',eye:'#0f0f12',rim:'#6b5836',glint:'#f0e2b8',chel:'#8f8a4a',
 pl:'#2a2a2e',ptip:'#e8dcc2',la:'#26262a',lb:'#c4a466',lc:'#3a3a40',
 fb:'#4a4436',feye:'#9c5a33',fab:'#b39258',wg1:'#c9c2b0',wg2:'#8d8676',silk:'#d9d6cc'
};
const R=Math.round;
const LX=128,LZ=128,LR=90;
for(let x=LX-LR;x<=LX+LR;x++) for(let z=LZ-LR;z<=LZ+LR;z++){
  const r=Math.hypot(x-LX,z-LZ); if(r>LR) continue;
  const a=Math.atan2(z-LZ,x-LX);
  const rr=r+1.5*Math.sin(a*3+r*0.05)+0.8*Math.sin(a*7);
  const bark=r>LR-4,full=r>LR-6;
  for(let y=4;y<=16;y++){
    if(!full&&y>6&&y<14) continue;
    let c;
    if(bark){ const f=Math.floor((a+Math.PI)*40/Math.PI+y*0.35)%3; c=f===0?P.bark2:P.bark1; }
    else if(y<16) c=P.ring2;
    else if(r>LR-9) c=P.sap;
    else if(r<3) c=P.pith;
    else c=(Math.floor(rr/4.5)%2===0)?P.ring1:P.ring2;
    block(x,y,z,c);
  }
  if(r>LR-3) block(x,17,z,P.bark1);
}
for(const a0 of [0.7,2.5,3.9,5.3]) for(let r=4;r<=84;r++){
  const w=1.2*Math.sin(r*0.21+a0);
  block(R(LX+r*Math.cos(a0)+w*Math.sin(a0)),16,R(LZ+r*Math.sin(a0)-w*Math.cos(a0)),P.crack);
}
const BXc=124,BZc=128,BRX=74,BRZ=66;
function bq(x,z){
  const dx=(x-BXc)/BRX,dz=(z-BZc)/BRZ,th=Math.atan2(dz,dx);
  const k=1+0.06*Math.sin(3*th+0.6)+0.03*Math.sin(5*th+2.1)+0.015*Math.sin(9*th);
  return Math.hypot(dx,dz)/k;
}
function topAt(x,z){
  const q=bq(x,z); if(q>=1) return -1;
  let t=14+37*Math.sqrt(1-Math.pow(q,8));
  t+=1.2*Math.sin(x*0.13+z*0.07)+0.8*Math.cos(z*0.19-x*0.05);
  return Math.floor(t);
}
function surfAt(x,z){ const t=topAt(x,z); return t<17?(Math.hypot(x-LX,z-LZ)>LR-3?17:16):t; }
for(let x=BXc-84;x<=BXc+84;x++) for(let z=BZc-76;z<=BZc+76;z++){
  const q=bq(x,z); if(q>=1) continue;
  const t=topAt(x,z); if(t<15) continue;
  const y0=q>0.86?14:Math.max(14,t-5);
  const band=Math.floor(2*Math.sin(x*0.05)+2*Math.cos(z*0.06));
  for(let y=y0;y<=t;y++){
    const n=Math.sin(x*0.083+z*0.061)+0.6*Math.cos(x*0.21-z*0.17);
    let c=n>0.45?P.st2:P.st1;
    if(y<t&&((y+band)%7===0)) c=P.st3;
    if(y===t&&n<-0.9) c=P.st3;
    block(x,y,z,c);
  }
}

const FEET=[[155,180],[169,162],[172,121],[164,86],[93,180],[79,162],[76,121],[84,86]];
function nearFoot(x,z,d){ for(const f of FEET) if(Math.hypot(x-f[0],z-f[1])<d) return true; return false; }
function cushion(cx,cz,rc,n){
  for(let i=0;i<n;i++){
    const a=rng()*Math.PI*2,rr=Math.sqrt(rng())*rc;
    const x=cx+Math.cos(a)*rr,z=cz+Math.sin(a)*rr;
    const s=surfAt(R(x),R(z));
    const r=1.8+rng()*1.8;
    const c=[P.ms1,P.ms2,P.ms3][Math.floor(rng()*3)];
    ellipsoid(x,s+r*0.5,z,r,r*0.75,r,c);
    if(rng()<0.5) block(R(x),R(s+r*1.25)+1,R(z),P.ms4);
  }
}
for(let i=0;i<18;i++){
  const th=i/18*Math.PI*2+0.13;
  if(Math.abs(th-Math.PI/2)<0.3) continue;
  const x=BXc+69*Math.cos(th),z=BZc+61*Math.sin(th);
  if(nearFoot(x,z,15)) continue;
  cushion(x,z,5+rng()*4,11+Math.floor(rng()*6));
}
for(let i=0;i<14;i++){
  const th=i/14*Math.PI*2+0.4;
  if(Math.abs(th-Math.PI/2)<0.25) continue;
  const x=BXc+80*Math.cos(th),z=BZc+72*Math.sin(th);
  if(Math.hypot(x-LX,z-LZ)>82) continue;
  cushion(x,z,4+rng()*4,9+Math.floor(rng()*5));
}
for(const c of [[104,74],[146,72],[184,110],[66,108],[64,94],[200,172],[58,172]]) cushion(c[0],c[1],5,12);
function lichen(cx,cz,rad){
  for(let x=cx-rad-1;x<=cx+rad+1;x++) for(let z=cz-rad-1;z<=cz+rad+1;z++){
    const d=Math.hypot(x-cx,z-cz),a=Math.atan2(z-cz,x-cx);
    const edge=rad*(0.85+0.15*Math.sin(a*7));
    if(d>edge) continue;
    const t=topAt(x,z); if(t<15) continue;
    block(x,t,z,P.li1);
    if(d>edge-1.2&&rng()<0.7) block(x,t+1,z,P.li1);
  }
}
for(const l of [[98,104,4],[150,104,3],[102,152,3],[180,96,4],[70,140,3],[120,70,4],[186,146,3]]) if(!nearFoot(l[0],l[1],8)) lichen(l[0],l[1],l[2]);
{
  let prev=null;
  for(let i=0;i<=24;i++){
    const u=i/24;
    const p=[70-22*u*u,17+72*u-10*u*u,76-12*u];
    if(prev) beam(prev[0],prev[1],prev[2],p[0],p[1],p[2],1.1,P.bark2);
    if(i>=4&&i<=23&&i%1===0){
      const L=12*(1-u)+3;
      for(const s of [-1,1]){
        const tx=p[0]+0.4*L*s-1.5*u,ty=p[1]-0.18*L+2,tz=p[2]+0.92*L*s;
        beam(p[0],p[1],p[2],tx,ty,tz,0.9+0.5*(1-u),i%2?P.ms2:P.ms1);
      }
    }
    prev=p;
  }
  ring(prev[0]-1,prev[1]+2.5,prev[2],2.6,1.0,P.ms3,'z');
}
function mushroom(x,z,h,r){
  cylinder(x,17,z,1.5,h,P.li1);
  cylinder(x,16+h,z,r-0.8,1,P.sap);
  ellipsoid(x,17+h,z,r,2.4,r,P.ring1);
}
mushroom(190,78,8,5); mushroom(199,90,6,4);
for(const p of [[205,140,5,3,4],[100,204,4,2.5,5],[160,205,5,3,4],[60,150,3,2.5,3]]){
  if(topAt(p[0],p[1])>16) continue;
  ellipsoid(p[0],17,p[1],p[2],p[3],p[4],P.st2);
  ellipsoid(p[0]-1,17.5,p[1]+1,p[2]*0.6,p[3]*0.8,p[4]*0.6,P.st1);
}

const X0=124;
function inHead(x,y,z){ return Math.pow(Math.abs(x-X0)/14,3)+Math.pow(Math.abs(y-73)/10,3)+Math.pow(Math.abs(z-143)/9.5,3)<=1; }
function inThx(x,y,z){ return Math.pow(Math.abs(x-X0)/13,2.4)+Math.pow(Math.abs(y-70)/8,2.4)+Math.pow(Math.abs(z-129)/9,2.4)<=1; }
function inCara(x,y,z){ return inHead(x,y,z)||inThx(x,y,z); }
for(let x=X0-15;x<=X0+15;x++) for(let y=61;y<=84;y++) for(let z=119;z<=153;z++){
  if(!inCara(x,y,z)) continue;
  const surf=!inCara(x+1,y,z)||!inCara(x-1,y,z)||!inCara(x,y+1,z)||!inCara(x,y-1,z)||!inCara(x,y,z+1)||!inCara(x,y,z-1);
  let c=rng()<0.3?P.sc2:P.sc1;
  if(surf){
    const top=!inCara(x,y+1,z);
    if(y>=64&&y<=65&&Math.abs(x-X0)>6) c=P.sb1;
    else if(top&&z<=134&&z>=121&&Math.abs(x-X0)<=1) c=P.sb1;
  }
  block(x,y,z,c);
}
ellipsoid(X0,62.5,136,9,2.5,12,P.sc2);
for(const s of [-1,1]){
  const ex=X0+6*s;
  ellipsoid(ex,74,151.5,5.9,5.9,5.9,P.rim);
  ellipsoid(ex,74,152,5.3,5.3,5.3,P.eye);
  block(ex-2,76,156,P.glint);
  ellipsoid(X0+12*s,76,149,3.2,3.2,3.2,P.rim);
  ellipsoid(X0+12*s,76,149.4,2.7,2.7,2.7,P.eye);
  block(X0+12*s-1,77,151,P.glint);
  ellipsoid(X0+11*s,82.5,141,1.3,1.3,1.3,P.eye);
  ellipsoid(X0+12*s,81.5,133.5,2.7,2.7,2.7,P.rim);
  ellipsoid(X0+12*s,82,133.5,2.2,2.2,2.2,P.eye);
  line(X0+12*s,80,148,X0+13*s,84,147,P.sc2);
  line(X0+11*s,80,147,X0+11*s,85,146,P.sc2);
  ellipsoid(X0+3.8*s,62,151,3.3,5,3,P.chel);
  block(R(X0+3.8*s),56,152,P.sc1);
}
ellipsoid(X0,67.5,152,9,1.8,1.5,P.sb2);
for(let x=X0-16;x<=X0+16;x++) for(let y=55;y<=83;y++) for(let z=76;z<=120;z++){
  const e=((x-X0)/15)**2+((y-69)/12.5)**2+((z-98)/21)**2; if(e>1) continue;
  let c=rng()<0.3?P.sc2:P.sc1;
  if(y>73){
    const ax=Math.abs(x-X0);
    if(z>=113) c=P.sb1;
    else if(Math.hypot(ax-6,z-104)<2.8||Math.hypot(ax-5,z-91)<2.6) c=P.sb2;
    else if(z>=94&&z<=101&&ax<(z-93)*0.45) c=P.sb1;
    else if(ax<=7&&Math.abs(z-(84+ax*0.6))<0.8) c=P.sb1;
  }
  block(x,y,z,c);
}
ellipsoid(X0,65,77.5,2.2,2,1.8,P.sc2);
{
  const at=topAt(X0,66),ay=(at>16?at:16)+1;
  line(X0,64,76,X0,ay,66,P.silk);
  ellipsoid(X0,ay,66,1.4,0.8,1.4,P.silk);
}
function mir(p,s){ return [s>0?p[0]:2*X0-p[0],p[1],p[2]]; }
function drawLeg(p,rs,cF,cT,cBand,cTip){
  beam(p[0][0],p[0][1],p[0][2],p[1][0],p[1][1],p[1][2],rs[0],cF);
  beam(p[1][0],p[1][1],p[1][2],p[2][0],p[2][1],p[2][2],rs[1],cT);
  beam(p[2][0],p[2][1],p[2][2],p[3][0],p[3][1],p[3][2],rs[2],cT);
  ellipsoid(p[0][0],p[0][1],p[0][2],rs[0],rs[0],rs[0],cF);
  ellipsoid(p[1][0],p[1][1],p[1][2],rs[0]+0.4,rs[0]+0.4,rs[0]+0.4,cBand);
  ellipsoid(p[2][0],p[2][1],p[2][2],rs[1]+0.4,rs[1]+0.4,rs[1]+0.4,cBand);
  ellipsoid(p[3][0],p[3][1]+0.3,p[3][2],rs[2]+0.2,rs[2]+0.2,rs[2]+0.2,cTip);
  for(const t of [0.3,0.6]){
    const q0=[p[0][0]+(p[1][0]-p[0][0])*t,p[0][1]+(p[1][1]-p[0][1])*t,p[0][2]+(p[1][2]-p[0][2])*t];
    block(R(q0[0]),R(q0[1]+rs[0]+0.6),R(q0[2]),cF);
  }
}
const LEGS=[
  [[135.5,64,139],[154,79,148],[164,13,158],[169,0,162],[2.2,1.9,1.3]],
  [[135.5,64,132],[155,79,129],[166,12,125],[172,0,121],[2.2,1.9,1.3]],
  [[133.5,64,125],[151,77,112],[160,13,98],[164,0,86],[2.3,2.0,1.4]]
];
for(const s of [-1,1]){
  for(const L of LEGS){
    const fx=s>0?L[3][0]:2*X0-L[3][0],fz=L[3][2];
    const fy=topAt(fx,fz)+1;
    const pts=[mir(L[0],s),mir(L[1],s),mir([L[2][0],fy+L[2][1],L[2][2]],s),mir([L[3][0],fy,L[3][2]],s)];
    drawLeg(pts,L[4],P.sc1,P.sc2,P.sb1,P.sc2);
  }
  ellipsoid(s>0?132.5:2*X0-132.5,63.5,145,3,2.4,2.6,P.sc1);
  const fx1=s>0?155:2*X0-155,fy1=topAt(fx1,180)+1;
  const p1=[mir([137,63.5,145.5],s),mir([148,77,160],s),mir([153,fy1+13,172],s),mir([155,fy1,180],s)];
  drawLeg(p1,[2.4,2.6,1.7],P.la,P.lc,P.lb,P.lc);
  const bx=X0+9*s;
  beam(bx,63,151,bx+0.5*s,60.5,155,1.5,P.pl);
  beam(bx+0.5*s,60.5,155,bx+0.5*s,59.5,158,1.6,P.pl);
  ellipsoid(bx+0.5*s,59.8,158.8,2.4,2.3,2.5,P.ptip);
}

const FXc=132,FZc=205;
ellipsoid(FXc,17,207,8,3.5,7,P.st2);
ellipsoid(FXc-3,18.5,210,3,2,3,P.st1);
for(const s of [-1,1]) for(const [dz,sp] of [[-3,4.5],[0,5.5],[3,5]]){
  line(FXc+R(1.5*s),23,FZc+dz,FXc+R(sp*s),20,FZc+R(dz*1.6),P.fb);
}
ellipsoid(FXc,25.5,FZc,3.6,3.2,4.2,P.fb);
ellipsoid(FXc,25,FZc-5,3,2.8,2.3,P.fb);
ellipsoid(FXc-2.4,25.6,FZc-5.2,2.1,2.5,2.1,P.feye);
ellipsoid(FXc+2.4,25.6,FZc-5.2,2.1,2.5,2.1,P.feye);
for(let x=FXc-4;x<=FXc+4;x++) for(let y=21;y<=28;y++) for(let z=FZc+3;z<=FZc+13;z++){
  const e=((x-FXc)/3.4)**2+((y-24.8)/2.8)**2+((z-(FZc+7.5))/4.8)**2; if(e>1) continue;
  block(x,y,z,(Math.floor((z-FZc)/2)%2===0)?P.fab:P.fb);
}
function wing(s){
  const rx=FXc+1.5*s,rz=FZc+0.5,dx=0.42*s,dz=0.91;
  for(let x=FXc-12;x<=FXc+12;x++) for(let z=FZc-2;z<=FZc+16;z++){
    const px=x-rx,pz=z-rz;
    const u=px*dx+pz*dz,v=-px*dz+pz*dx;
    if(u<0||u>12) continue;
    const half=2.9*Math.sin(Math.PI*Math.min(1,u/12+0.08));
    if(Math.abs(v)>half) continue;
    block(x,29,z,(Math.abs(v)<0.5||Math.abs(u-7)<0.5)?P.wg2:P.wg1);
  }
}
wing(-1); wing(1);
function sporo(bx,bz,h,lean){
  const by=surfAt(bx,bz)+2;
  const pts=[[bx,by,bz],[bx+lean*0.3,by+h*0.45,bz+0.4],[bx+lean*0.8,by+h*0.8,bz+0.7],[bx+lean,by+h,bz+1]];
  for(let i=0;i<3;i++) line(R(pts[i][0]),R(pts[i][1]),R(pts[i][2]),R(pts[i+1][0]),R(pts[i+1][1]),R(pts[i+1][2]),P.sp1);
  const t=pts[3];
  ellipsoid(t[0]+lean*0.1,t[1]+2.6,t[2],1.8,3.2,1.8,P.sp2);
  block(R(t[0]+lean*0.1),R(t[1]+6),R(t[2]),P.sp3);
  return by;
}
const SPOR=[[64,94,20,2],[200,172,18,-2],[56,174,16,-2]];
for(const s of SPOR) sporo(s[0],s[1],s[2],s[3]);
ellipsoid(104,surfAt(104,74)+4,74,1.7,1.7,1.7,P.silk);

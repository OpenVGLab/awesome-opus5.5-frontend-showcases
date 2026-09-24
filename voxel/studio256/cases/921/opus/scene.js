const C={coral:'#E57F5E',coralDeep:'#C8634A',coralLight:'#F2A184',cream:'#F5ECDC',creamShade:'#E3D5BD',mask:'#3E4C56',antler:'#EEE3CB',antlerTip:'#D8C3A0',eye:'#1E262C',stoneL:'#C7D4D3',stone:'#9EB3B6',stoneM:'#86A0A5',stoneD:'#607A80',moss:'#4FA392',mossD:'#3C897B',mossL:'#7CC5B2',water:'#6FCBCD',waterL:'#A6E2DF',waterD:'#4EA9B1',soil:'#CDB293',soilD:'#8F7A66',straw:'#EBCB9C',strawL:'#F4E2BE',birch:'#F0EBE0',ring1:'#E6CFA8',cap:'#EE6F55',capL:'#F59A7E',fern:'#5BB39E',fernD:'#3F9483'};
const R=Math.round;
function put(x,y,z,c){x=R(x);y=R(y);z=R(z);if(x<10||x>245||z<10||z>245||y<4||y>245)return;block(x,y,z,c);}
function archIn(u,y,w,yc){return Math.abs(u)<=w&&(y<=yc||u*u+(y-yc)*(y-yc)<=w*w);}
const LAT=[];for(let i=0;i<289;i++)LAT.push(rng());
function vn(x,z,sc){const fx=x/sc,fz=z/sc,ix=Math.floor(fx),iz=Math.floor(fz),tx=fx-ix,tz=fz-iz,sx=tx*tx*(3-2*tx),sz=tz*tz*(3-2*tz);const g=(i,j)=>LAT[(((i%17)+17)%17)*17+(((j%17)+17)%17)];const a=g(ix,iz),b=g(ix+1,iz),c=g(ix,iz+1),d=g(ix+1,iz+1);return a+(b-a)*sx+(c-a)*sz+(a-b-c+d)*sx*sz;}

// two mossy terraces split by a spring gully
const CX=126,CZ=126,RX=98,RZ=82;
function sup(x,z){const u=(x-CX)/RX,v=(z-CZ)/RZ;return u*u*u*u+v*v*v*v;}
function chX(z){return 124+7*Math.sin(z/21);}
function chW(z){return 7+2.5*Math.sin(z/13+1);}
function wet(x,z){if(z>=56&&z<=184&&Math.abs(x-chX(z))<chW(z))return true;const px=(x-128)/19,pz=(z-182)/16;return px*px+pz*pz<1;}
const HMA=new Array(65536).fill(-1);
function HM(x,z){x=R(x);z=R(z);if(x<0||x>255||z<0||z>255)return -1;return HMA[x*256+z];}
for(let x=20;x<=236;x++)for(let z=36;z<=216;z++){
  const s=sup(x,z)+0.1*(vn(x,z,11)-0.5);if(s>1)continue;
  let h=(x<chX(z))?31:23;
  h+=2.2*(vn(x,z,16)-0.5)+1.2*(vn(x+37,z+71,6)-0.5);
  const s2=s+0.08*(vn(x+11,z+5,7)-0.5);
  if(s2>0.78)h-=4;
  if(s2>0.91)h-=5;
  if(wet(x,z))h=7;
  HMA[x*256+z]=Math.max(5,R(h));
}
function nb(x,z){const v=HM(x,z);return v<0?3:v;}
for(let x=20;x<=236;x++)for(let z=36;z<=216;z++){
  const h=HMA[x*256+z];if(h<0)continue;
  const mn=Math.min(nb(x-1,z),nb(x+1,z),nb(x,z-1),nb(x,z+1));
  const y0=Math.max(4,Math.min(h-3,mn+1)),w=wet(x,z);
  const nearWet=!w&&(wet(x-2,z)||wet(x+2,z)||wet(x,z-2)||wet(x,z+2));
  for(let y=y0;y<=h;y++){
    let c;
    if(y===h){if(w)c=C.stoneM;else if(nearWet)c=C.stoneL;else{const n=vn(x+3,z+9,9);c=n>0.74?C.creamShade:(n>0.56?C.mossL:(n<0.3?C.mossD:C.moss));}}
    else if(y>=h-2&&!w)c=(y===h-1)?C.mossD:C.soilD;
    else{const b=Math.floor((y+3*vn(x,z,20))/3.5)%5;c=[C.stoneM,C.stone,C.stoneL,C.stone,C.stoneD][b];}
    put(x,y,z,c);
  }
  if(w)for(let y=h+1;y<=10;y++)put(x,y,z,y===10?((Math.floor(z*0.5+Math.sin(x*0.7)*1.5)%5===0)?C.waterL:C.water):C.waterD);
}
function boulder(cx,cy,cz,rx,ry,rz,mossy){for(let x=Math.floor(cx-rx-1);x<=Math.ceil(cx+rx+1);x++)for(let y=Math.floor(cy-ry-1);y<=Math.ceil(cy+ry+1);y++)for(let z=Math.floor(cz-rz-1);z<=Math.ceil(cz+rz+1);z++){const u=(x-cx)/rx,v=(y-cy)/ry,w=(z-cz)/rz;if(u*u+v*v+w*w>1+0.16*(vn(x*2+y,z*2,5)-0.5))continue;let c;if(mossy&&v>0.3+0.3*(vn(x+9,z+13,4)-0.5))c=v>0.78?C.mossL:C.moss;else{const b=Math.floor((y+x*0.3+40)/3)%3;c=b===0?C.stoneL:(b===1?C.stone:C.stoneM);}put(x,y,z,c);}}

// spring cascade, stone slab bridge, pool stones
boulder(117,30,50,9,10,7,true);boulder(131,27,49,8,8,6,true);boulder(124,40,48,7,6,5,true);
for(let y=11;y<=35;y++)for(let x=123;x<=125;x++){put(x,y,55,C.water);put(x,y,56,(y%3===0&&x===124)?C.waterL:C.water);}
ellipsoid(125,10,58,3,1,2,C.waterL);
boulder(137,25,124,6,3.5,6,false);boulder(138,25,138,6,3.5,6,false);
for(let x=104;x<=143;x++)for(let z=119;z<=143;z++){const u=(x-123.5)/20.5,v=(z-131)/12.5,e=u*u*u*u+v*v*v*v;if(e>1)continue;for(let y=27;y<=31;y++){let c;if(y===31)c=vn(x,z,5)>0.6?C.mossL:(e>0.6?C.moss:C.stoneL);else c=((y+Math.floor(x/5))%3===0)?C.stoneM:C.stone;put(x,y,z,c);}}
boulder(116,10,178,4.5,3,4,true);boulder(141,10,189,3.8,2.6,3.2,true);
for(let i=0;i<70;i++){const a=rng()*6.283,rr=19.5+rng()*2.5,x=R(128+rr*Math.cos(a)),z=R(182+rr*16/19*Math.sin(a)),g=HM(x,z);if(g>7)put(x,g+1,z,rng()<0.5?C.stoneL:C.stone);}

// sett den with stone ring, bedding and spoil heap
const DXc=58,DZc=82,dg=HM(58,82),ex=Math.SQRT1_2,ez=Math.SQRT1_2;
for(let k=0;k<12;k++){const a=k*Math.PI/6+0.15;let d=a-Math.PI/4;d=Math.atan2(Math.sin(d),Math.cos(d));if(Math.abs(d)<0.55)continue;boulder(DXc+21*Math.cos(a),dg+1,DZc+19*Math.sin(a),5.5,4.5,5,true);}
for(let x=DXc-23;x<=DXc+23;x++)for(let z=DZc-21;z<=DZc+21;z++)for(let y=dg-2;y<=dg+18;y++){
  const X1=(x-DXc)/22,Y1=(y-dg+2)/19,Z1=(z-DZc)/20;
  if(X1*X1+Y1*Y1+Z1*Z1+0.08*(vn(x*2,z*2+y,5)-0.5)>1)continue;
  const X2=(x-DXc)/16.5,Y2=(y-dg+2)/14,Z2=(z-DZc)/14.5,ei=X2*X2+Y2*Y2+Z2*Z2;
  if(ei<1&&y>dg)continue;
  const a=(x-DXc)*ex+(z-DZc)*ez,b=-(x-DXc)*ez+(z-DZc)*ex;
  if(y>dg&&a>6&&archIn(b,y-dg,5,5))continue;
  const va=-(x-DXc)*ex-(z-DZc)*ez,vb=(x-DXc)*ex-(z-DZc)*ez,vy=y-dg-7;
  if(va>10&&vb*vb+vy*vy<6.5)continue;
  const rho=(y-dg<=5)?Math.abs(b):Math.sqrt(b*b+(y-dg-5)*(y-dg-5));
  let c;
  if(a>9&&y>dg&&rho<=7.8)c=((Math.floor(y-dg>5?Math.atan2(y-dg-5,b)*4:y/2)%2)===0)?C.stoneL:C.stone;
  else if(ei<1.3)c=C.soilD;
  else if(y>dg+7+3*(vn(x+5,z+7,6)-0.5))c=vn(x,z+y,4)>0.62?C.mossL:C.moss;
  else c=((Math.floor(x/3)+Math.floor(y/3)+Math.floor(z/3))%3===0)?C.stoneM:(vn(x,y*2+z,3)>0.5?C.soil:C.stone);
  put(x,y,z,c);
}
for(let x=DXc-15;x<=DXc+15;x++)for(let z=DZc-14;z<=DZc+14;z++){const X2=(x-DXc)/15,Z2=(z-DZc)/13.5;if(X2*X2+Z2*Z2>1)continue;put(x,dg+1,z,((x*3+z*5)%4===0)?C.straw:C.strawL);}
{const hx=DXc+31*ex,hz=DZc+31*ez,g=HM(hx,hz);for(let x=R(hx)-10;x<=R(hx)+10;x++)for(let z=R(hz)-10;z<=R(hz)+10;z++){const d=Math.sqrt((x-hx)*(x-hx)+(z-hz)*(z-hz));if(d>9.5)continue;const top=g+R(3.2*(1-d/9.5)+0.6*vn(x,z,3));for(let y=g-1;y<=top;y++)put(x,y,z,(y===top&&((x*7+z*3)%11===0))?C.stoneL:C.soil);}}
for(let i=0;i<46;i++){const t=10+rng()*22,l=(rng()-0.5)*(6+t*0.4),x=DXc+t*ex-l*ez,z=DZc+t*ez+l*ex,g=HM(x,z);line(x,g+1,z,x+(rng()-0.5)*4,g+1,z+(rng()-0.5)*4,rng()<0.5?C.straw:C.strawL);}

// lookout mesa
const OX=70,OZ=168,og=HM(OX,OZ);
for(let x=OX-21;x<=OX+21;x++)for(let z=OZ-21;z<=OZ+21;z++){const dx=x-OX,dz=z-OZ,a=Math.atan2(dz,dx),d=Math.sqrt(dx*dx+dz*dz),rt=15.5+2*Math.sin(3*a+0.5)+1.2*Math.sin(5*a+1.3);for(let y=og-2;y<=40;y++){const r=rt+(40-y)*0.22;if(d>r)continue;let c;if(y===40)c=d>rt-1.5?C.creamShade:(vn(x,z,4)>0.55?C.mossL:C.moss);else if(y>=38&&d>r-1.2)c=C.mossD;else c=[C.stone,C.stoneL,C.stoneM][Math.floor((y+Math.sin(a*2)*1.5)/2.5+30)%3];put(x,y,z,c);}}
boulder(OX+19,og+3,OZ+11,6,5,6,true);

// birch stump with mushroom cluster
const SX=194,SZ=84,sg=HM(SX,SZ);
for(let dx=-12;dx<=12;dx++)for(let dz=-12;dz<=12;dz++){const d=Math.sqrt(dx*dx+dz*dz);if(d>10.4)continue;const a=Math.atan2(dz,dx),top=sg+17+R(2.5*Math.sin(3*a)+1.5*Math.sin(5*a+1));for(let y=sg-3;y<=top;y++){let c;if(y===top&&d<9.4)c=(Math.floor(d*1.3)%2)?C.ring1:C.soil;else if(d>9.3)c=((y%4===0)&&(Math.floor((a+Math.PI)*5+y*0.37)%3===0))?C.mask:C.birch;else c=C.ring1;put(SX+dx,y,SZ+dz,c);}}
for(let k=0;k<5;k++){const a=k*1.2566+0.4;beam(SX+8*Math.cos(a),sg+3,SZ+8*Math.sin(a),SX+17*Math.cos(a),sg-1,SZ+17*Math.sin(a),2.6,C.birch);}
function shroom(x,y,z,sh,cr,ch,lx,lz,col){const tx=x+lx,tz=z+lz,ty=y+sh;beam(x,y,z,tx,ty,tz,Math.max(1,cr*0.26),C.cream);const m=Math.ceil(cr);for(let dx=-m;dx<=m;dx++)for(let dz=-m;dz<=m;dz++)for(let dy=0;dy<=Math.ceil(ch);dy++){const e=(dx*dx+dz*dz)/(cr*cr)+(dy*dy)/(ch*ch);if(e>1)continue;let c=col;if(dy===0)c=(dx*dx+dz*dz<(cr-1.1)*(cr-1.1))?C.creamShade:col;else if(e>0.5&&((dx*7+dz*13+dy*5+100)%9===0))c=C.cream;put(tx+dx,ty+dy,tz+dz,c);}}
function bracket(a,y,len,wid,col){const ux=Math.cos(a),uz=Math.sin(a);for(let i=0;i<=len;i++)for(let j=-wid;j<=wid;j++){const e=(i*i)/(len*len)+(j*j)/(wid*wid);if(e>1)continue;const px=SX+(10+i)*ux-j*uz,pz=SZ+(10+i)*uz+j*ux;put(px,y,pz,C.creamShade);put(px,y+1,pz,e>0.6?C.cream:col);}}
shroom(SX-3,sg+14,SZ-3,12,8.5,4.5,-1,-1,C.cap);
shroom(SX+5,sg+14,SZ+3,8,6,3.5,2,2,C.capL);
shroom(SX-4,sg+14,SZ+6,6.5,4.5,3,-1,3,C.cap);
bracket(2.0,sg+6,4,5,C.cap);bracket(2.6,sg+10,3,4,C.capL);bracket(1.4,sg+12,3,4,C.cap);bracket(3.6,sg+7,4,5,C.capL);bracket(5.2,sg+11,3,4,C.cap);
for(const [a,rr,sh,cr,ch,col] of [[0.5,15,6,4.5,3,C.cap],[1.3,16,8,5.5,3.5,C.capL],[3.3,15,5,4,2.8,C.cap],[4.4,16,7,5,3.2,C.cap],[5.4,14,4,3.2,2.2,C.capL],[6.0,17,5,3.6,2.5,C.cap]]){const x=SX+rr*Math.cos(a),z=SZ+rr*Math.sin(a);shroom(x,HM(x,z),z,sh,cr,ch,1.5*Math.cos(a),1.5*Math.sin(a),col);}
for(const [x,z,cr] of [[183.5,100,2.3],[186,103,1.9],[182,97.5,2.0],[185,98,1.6]])shroom(x,HM(x,z),z,1.5,cr,1.8,0,0,C.capL);

// deer-badger builder: local u forward, v up, w side
function beast(X,Y,Z,yaw,s,kind){
  const cy=Math.cos(yaw),sy=Math.sin(yaw);
  const W=(p)=>[X+(p[0]*cy-p[2]*sy)*s,Y+p[1]*s,Z+(p[0]*sy+p[2]*cy)*s];
  const L=(x,y,z)=>{const dx=(x-X)/s,dz=(z-Z)/s;return [dx*cy+dz*sy,(y-Y)/s,-dx*sy+dz*cy];};
  function seg(p0,r0,p1,r1,kw,col){
    const A=W(p0),B=W(p1),rm=Math.max(r0,r1)*Math.max(1,kw)*s+1.5;
    const du=p1[0]-p0[0],dv=p1[1]-p0[1],dw=(p1[2]-p0[2])/kw,LL=du*du+dv*dv+dw*dw;
    for(let x=Math.floor(Math.min(A[0],B[0])-rm);x<=Math.ceil(Math.max(A[0],B[0])+rm);x++)
    for(let y=Math.floor(Math.min(A[1],B[1])-rm);y<=Math.ceil(Math.max(A[1],B[1])+rm);y++)
    for(let z=Math.floor(Math.min(A[2],B[2])-rm);z<=Math.ceil(Math.max(A[2],B[2])+rm);z++){
      const q=L(x,y,z),qu=q[0]-p0[0],qv=q[1]-p0[1],qw=(q[2]-p0[2])/kw;
      let t=LL>0?(qu*du+qv*dv+qw*dw)/LL:0;t=t<0?0:(t>1?1:t);
      const ou=qu-t*du,ov=qv-t*dv,ow=qw-t*dw,r=r0+(r1-r0)*t,d=Math.sqrt(ou*ou+ov*ov+ow*ow);
      if(d<=r)put(x,y,z,typeof col==='function'?col(t,ou/r,ov/r,ow/r,q):col);
    }
  }
  let P;
  if(kind==='walk')P={H:[-16,21,0],M:[0,22,0],S:[14,22,0],N0:[20,25,0],N1:[26,30,0],Hd:[31,32,0],Sn:[39,30,0],Ns:[44,29,0],ven:[0,-1],
    legsF:[[[14,17,7.5],[18,10,8.5],[21,4,8.5],[23.5,1.6,8.5]],[[14,17,-7.5],[13,10,-8.5],[11.5,4,-8.5],[14,1.6,-8.5]]],
    legsH:[[[-16,17,8],[-12,11,8.5],[-22,6,8.5],[-20.5,1.5,8.5]],[[-16,17,-8],[-8,11,-8.5],[-17,6,-8.5],[-15,1.5,-8.5]]],
    tail:[[-25,24,0],[-31,28,0],[-33.5,30,0]]};
  else if(kind==='feed')P={H:[-16,22,0],M:[0,20.5,0],S:[13,18.5,0],N0:[19,16,0],N1:[25,11,0],Hd:[29,7.2,0],Sn:[34,3,0],Ns:[37.5,1.6,0],ven:[0,-1],
    legsF:[[[13,14,7.5],[16,8,9.5],[18,3.5,10],[20.5,1.6,10]],[[13,14,-7.5],[15,8,-9.5],[16.5,3.5,-10],[19,1.6,-10]]],
    legsH:[[[-16,18,8],[-12,12,8.5],[-21,6.5,8.5],[-19.5,1.5,8.5]],[[-16,18,-8],[-13,12,-8.5],[-22.5,6.5,-8.5],[-21,1.5,-8.5]]],
    tail:[[-25,23,0],[-30,20.5,0],[-32.5,19,0]]};
  else P={H:[0,11.5,0],M:[2,25,0],S:[4,38,0],N0:[5,45,0],N1:[6,50.5,0],Hd:[9,55,0],Sn:[16.5,54,0],Ns:[21.5,53.3,0],ven:[1,0],
    legsF:[[[6,39,7],[11,32.5,7.5],[13.5,36.5,5.8],[15,38,5.2]],[[6,39,-7],[11,32.5,-7.5],[13.5,36.5,-5.8],[15,38,-5.2]]],
    legsH:[[[0,10,8],[8,7,10],[-3,3,10],[3,1.3,10]],[[0,10,-8],[8,7,-10],[-3,3,-10],[3,1.3,-10]]],
    tail:[[-9,9,0],[-16,3.2,0],[-19.5,2.6,0]]};
  const ven=P.ven;
  for(const p of P.legsH){seg(p[0],4.4,p[1],3.4,1,C.coralDeep);seg(p[1],3.1,p[2],2.3,1,C.coral);seg(p[2],2.1,p[3],1.7,1,C.mask);seg(p[3],1.9,[p[3][0]+1.8,p[3][1]-0.4,p[3][2]],1.6,1,C.eye);}
  for(const p of P.legsF){seg(p[0],3.8,p[1],3.2,1,C.coralDeep);seg(p[1],3.2,p[2],2.7,1,C.mask);seg([p[2][0],p[3][1]+0.4,p[2][2]],2.6,p[3],2.3,1.25,C.mask);for(let k=-1;k<=1;k++)seg([p[3][0]+1.8,p[3][1],p[3][2]+k*1.3],0.62,[p[3][0]+4.6,p[3][1]-1,p[3][2]+k*1.6],0.45,1,C.cream);}
  const bodyCol=(t,nu,nv,nw,q)=>{const vd=nu*ven[0]+nv*ven[1];if(vd>0.5)return C.cream;if(vd<-0.62&&Math.abs(nw)<0.36)return C.coralDeep;if(vd<0.1&&Math.abs(nw)>0.45&&((Math.floor(q[0]/3.2)*7+Math.floor(q[1]/3.2)*5+(q[2]>0?3:0)+600)%6===0))return C.coralLight;return C.coral;};
  seg(P.H,10.5,P.M,12,1.15,bodyCol);
  seg(P.M,12,P.S,11,1.15,bodyCol);
  seg([P.H[0]-3,P.H[1]+0.5,0],10.8,[P.H[0]+3,P.H[1]+0.5,0],11,1.22,bodyCol);
  seg(P.S,11,P.N0,8,1.05,bodyCol);
  const tailCol=(t,nu,nv)=>(nv<-0.1||t>0.8)?C.cream:C.coral;
  seg(P.tail[0],4.6,P.tail[1],3.4,1.1,tailCol);
  seg(P.tail[1],3.4,P.tail[2],2.1,1,C.cream);
  const neckCol=(t,nu,nv,nw)=>{const vd=nu*ven[0]+nv*ven[1];return vd>0.35?C.cream:(vd<-0.6&&Math.abs(nw)<0.35?C.coralDeep:C.coral);};
  const headCol=(t,nu,nv,nw,q)=>{const aw=Math.abs(q[2]);if(nv<-0.4)return C.cream;if(aw<1.4)return C.cream;if(aw<4.3)return C.mask;return C.cream;};
  seg(P.N0,8,P.N1,6.5,1,neckCol);
  seg(P.N1,6.5,P.Hd,7,1,(t,nu,nv,nw,q)=>t<0.45?neckCol(t,nu,nv,nw):headCol(t,nu,nv,nw,q));
  seg(P.Hd,7,P.Sn,4.2,1,headCol);
  seg(P.Sn,4.2,P.Ns,2.4,1,headCol);
  seg(P.Ns,2.3,[P.Ns[0]+(P.Ns[0]-P.Sn[0])*0.25,P.Ns[1]+(P.Ns[1]-P.Sn[1])*0.25,0],1.9,1,C.eye);
  const fu=P.Sn[0]-P.Hd[0],fv=P.Sn[1]-P.Hd[1],fl=Math.sqrt(fu*fu+fv*fv),f=[fu/fl,fv/fl],up=[-f[1],f[0]];
  const HF=(a,b,w)=>[P.Hd[0]+a*f[0]+b*up[0],P.Hd[1]+a*f[1]+b*up[1],w];
  for(const sd of [-1,1]){
    seg(HF(-3,5,4.2*sd),2.5,HF(-4.2,8.6,5.4*sd),1.5,1,(t)=>t>0.6?C.cream:C.coralDeep);
    seg(HF(-2,6,3*sd),1.25,HF(-5,14,5.6*sd),1.0,1,C.antler);
    seg(HF(-3.4,9.6,4.2*sd),0.95,HF(1,13,4.9*sd),0.7,1,(t)=>t>0.6?C.antlerTip:C.antler);
    seg(HF(-5,14,5.6*sd),1.0,HF(-9,18.5,6.8*sd),0.7,1,(t)=>t>0.55?C.antlerTip:C.antler);
    seg(HF(-5,14,5.6*sd),1.0,HF(-2.6,19.5,6.1*sd),0.7,1,(t)=>t>0.55?C.antlerTip:C.antler);
    seg(HF(3.2,2.0,5.4*sd),0.8,HF(3.4,2.1,5.9*sd),0.7,1,C.eye);
  }
  if(kind==='walk')for(let k=0;k<6;k++){const A=W(HF(7.2+k*0.3,-3.6+(k%3)*0.4,-8.5+k*0.4)),B=W(HF(8.2-k*0.2,-3.0-(k%2)*0.6,8.5-k*0.3));line(A[0],A[1],A[2],B[0],B[1],B[2],k%2?C.straw:C.strawL);}
  return P.legsF.concat(P.legsH).map(l=>W(l[3]));
}
function footing(p){const x=R(p[0]),z=R(p[2]),top=R(p[1]-1.2);for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){if(dx*dx+dz*dz>5)continue;const g=HM(x+dx,z+dz);if(g<0)continue;for(let y=g+1;y<=top;y++)put(x+dx,y,z+dz,y===top?C.mossL:C.moss);}}

// bedding carrier crossing the bridge, lookout on the mesa, forager at the mushrooms
beast(124,32,131,Math.PI,0.9,'walk');
beast(OX,41,OZ,Math.PI/4,0.85,'rear');
const FYAW=-1.07,FS=0.82,FXo=166.6,FZo=130;
let FY=0;{const cy=Math.cos(FYAW),sy=Math.sin(FYAW);for(const p of [[20.5,10],[19,-10],[-19.5,8.5],[-21,-8.5]]){const x=FXo+(p[0]*cy-p[1]*sy)*FS,z=FZo+(p[0]*sy+p[1]*cy)*FS;FY=Math.max(FY,HM(x,z));}FY+=1;}
beast(FXo,FY,FZo,FYAW,FS,'feed').forEach(footing);

// ground cover
function fern(cx,cz,n,len,rot){const g=HM(cx,cz);if(g<0)return;const b=g+1;for(let i=0;i<n;i++){const a=rot+i*2*Math.PI/n;let px=cx,py=b,pz=cz;for(let k=1;k<=len;k++){const t=k/len,nx=cx+Math.cos(a)*len*t*0.85,nz=cz+Math.sin(a)*len*t*0.85,ny=b+len*0.6*Math.sin(Math.PI*t*0.75);line(px,py,pz,nx,ny,nz,C.fernD);if(k%2===0&&k<len){const la=a+Math.PI/2,ll=2.4*(1-t)+0.8;line(nx,ny,nz,nx+Math.cos(la)*ll,ny-0.4,nz+Math.sin(la)*ll,C.fern);line(nx,ny,nz,nx-Math.cos(la)*ll,ny-0.4,nz-Math.sin(la)*ll,C.fern);}px=nx;py=ny;pz=nz;}}}
function tuft(x,z,n){const g=HM(x,z);if(g<0)return;for(let i=0;i<n;i++){const a=rng()*6.283,l=4+rng()*4;line(x,g+1,z,x+Math.cos(a)*l*0.45,g+1+l,z+Math.sin(a)*l*0.45,rng()<0.5?C.straw:C.strawL);}}
function flower(x,z,col){const g=HM(x,z);if(g<0)return;const h=3+R(rng()*3);line(x,g+1,z,x,g+h,z,C.fernD);put(x,g+h+1,z,col);put(x+1,g+h,z,col);put(x-1,g+h,z,col);put(x,g+h,z+1,col);put(x,g+h,z-1,col);put(x,g+h,z,C.strawL);}
boulder(36,HM(36,150)+2,150,6,5,6,true);
boulder(150,HM(150,52)+2,52,7,5.5,6,true);
boulder(218,HM(218,118)+2,118,6,5,6.5,true);
boulder(188,HM(188,196)+2,196,6.5,5,6,true);
boulder(92,HM(92,116)+2,116,5,4,5,true);
fern(38,132,6,10,0.2);fern(100,58,6,11,0.9);fern(98,196,5,9,0.4);fern(160,192,6,10,1.1);fern(210,150,5,9,0.5);fern(166,66,6,10,0.3);fern(52,192,5,9,1.4);
tuft(44,110,7);tuft(90,96,6);tuft(104,160,6);tuft(176,176,6);tuft(146,60,5);tuft(206,140,6);
for(const [x,z,c] of [[200,172,C.cap],[204,176,C.cream],[209,171,C.capL],[206,182,C.cap],[198,180,C.cream],[213,178,C.capL],[90,146,C.cap],[94,150,C.cream],[86,151,C.capL],[40,118,C.cream],[44,114,C.cap]])flower(x,z,c);

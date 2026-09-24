const C={sand:'#E3CFA6',sandL:'#F1E4C8',sandD:'#C8AD82',terra:'#B85C3C',terraL:'#D27A55',terraD:'#8E4330',green:'#3F5F3F',greenD:'#2A4230',greenM:'#4D7049',greenL:'#6A8C5C',ochre:'#DDA84F',talon:'#2B2E2A',eye:'#1D2620',bronze:'#9C7A45',energy:'#9FE0A8',energyL:'#D8F7D6',crystal:'#5DBB78',crystalD:'#3D955B',wood:'#7A5638',woodD:'#5C3F29',root:'#8A6848'};
const R=Math.round;
function put(x,y,z,c){x=R(x);y=R(y);z=R(z);if(x<10||x>245||z<10||z>245||y<4||y>245)return;block(x,y,z,c);}
const LAT=[];for(let i=0;i<289;i++)LAT.push(rng());
function vn(x,z,sc){const fx=x/sc,fz=z/sc,ix=Math.floor(fx),iz=Math.floor(fz),tx=fx-ix,tz=fz-iz,sx=tx*tx*(3-2*tx),sz=tz*tz*(3-2*tz);const g=(i,j)=>LAT[(((i%17)+17)%17)*17+(((j%17)+17)%17)];const a=g(ix,iz),b=g(ix+1,iz),c=g(ix,iz+1),d=g(ix+1,iz+1);return a+(b-a)*sx+(c-a)*sz+(a-b-c+d)*sx*sz;}

// two-lobed sandstone ground
function e1(x,z){const u=(x-78)/56,v=(z-118)/70;return u*u+v*v;}
function e2(x,z){const u=(x-170)/58,v=(z-136)/62;return u*u+v*v;}
const HMA=new Array(65536).fill(-1);
function HM(x,z){x=R(x);z=R(z);if(x<0||x>255||z<0||z>255)return -1;return HMA[x*256+z];}
for(let x=18;x<=232;x++)for(let z=42;z<=204;z++){
  const n=0.1*(vn(x,z,12)-0.5),a1=e1(x,z)+n,a2=e2(x,z)+n;
  if(a1>1&&a2>1)continue;
  let h=-1;
  if(a1<=1){let t=26;if(a1>0.8)t-=5;if(a1>0.93)t-=9;h=Math.max(h,t);}
  if(a2<=1){let t=18;if(a2>0.8)t-=4;if(a2>0.93)t-=7;h=Math.max(h,t);}
  h+=1.6*(vn(x+40,z+17,14)-0.5)+0.8*(vn(x,z+90,5)-0.5);
  HMA[x*256+z]=Math.max(5,R(h));
}
function nb(x,z){const v=HM(x,z);return v<0?3:v;}
const STR=[C.sandD,C.sand,C.terraL,C.sandL,C.terra,C.sand];
for(let x=18;x<=232;x++)for(let z=42;z<=204;z++){
  const h=HMA[x*256+z];if(h<0)continue;
  const mn=Math.min(nb(x-1,z),nb(x+1,z),nb(x,z-1),nb(x,z+1)),y0=Math.max(4,Math.min(h-3,mn+1));
  for(let y=y0;y<=h;y++){let c;if(y===h){const g=vn(x+7,z+3,10),s2=vn(x*3,z*3,4);c=g>0.66?(s2>0.5?C.greenM:C.green):(g>0.58?C.greenL:(s2>0.72?C.sandL:C.sand));}else c=STR[Math.floor((y+2.5*vn(x,z,18))/3)%6];put(x,y,z,c);}
}
function boulder(cx,cy,cz,rx,ry,rz,mossy){for(let x=Math.floor(cx-rx-1);x<=Math.ceil(cx+rx+1);x++)for(let y=Math.floor(cy-ry-1);y<=Math.ceil(cy+ry+1);y++)for(let z=Math.floor(cz-rz-1);z<=Math.ceil(cz+rz+1);z++){const u=(x-cx)/rx,v=(y-cy)/ry,w=(z-cz)/rz;if(u*u+v*v+w*w>1+0.16*(vn(x*2+y,z*2,5)-0.5))continue;let c;if(mossy&&v>0.45+0.3*(vn(x+9,z+13,4)-0.5))c=v>0.8?C.greenL:C.greenM;else c=STR[Math.floor((y+x*0.2+60)/2.5)%6];put(x,y,z,c);}}

// lookout crag
const GX=70,GZ=116,gg=HM(GX,GZ);
for(let x=GX-33;x<=GX+33;x++)for(let z=GZ-27;z<=GZ+27;z++){const dx=x-GX,dz=z-GZ,a=Math.atan2(dz,dx),nA=1+0.08*Math.sin(3*a+0.7)+0.05*Math.sin(5*a+2.1);for(let y=gg-2;y<=60;y++){const k=(60-y)/(62-gg),rx=(24+6*k)*nA,rz=(18+6*k)*nA,e=dx*dx/(rx*rx)+dz*dz/(rz*rz);if(e>1)continue;if(e<0.5&&y<58)continue;let c;if(y===60)c=e>0.82?C.sandL:(vn(x,z,4)>0.5?C.greenM:C.green);else if(y>=58&&e>0.86)c=C.greenD;else c=STR[Math.floor((y+1.5*Math.sin(a*3))/3+20)%6];put(x,y,z,c);}}
boulder(GX-20,44,GZ+16,8,4,7,true);boulder(GX+22,38,GZ-12,7,4,6,true);boulder(GX-4,33,GZ+23,7,5,6,true);

// energy urn on its plinth
const EX=174,EZ=110,eg=HM(EX,EZ),ub=eg+4;
for(let dx=-12;dx<=12;dx++)for(let dz=-12;dz<=12;dz++){const ax=Math.abs(dx),az=Math.abs(dz);if(Math.max(ax,az)*0.92+Math.min(ax,az)*0.38>11.2)continue;for(let y=eg-1;y<=eg+3;y++)put(EX+dx,y,EZ+dz,y===eg+3&&Math.max(ax,az)<10?C.sand:C.sandD);}
for(let y=ub;y<=ub+26;y++){const k=y-ub,ro=k<=2?6:(k<=20?6+5*Math.sin(Math.PI*(k-2)/18):(k<=24?5:7)),ri=k<2?-1:ro-1.8,band=(k===4||k===18),m=Math.ceil(ro)+1;for(let dx=-m;dx<=m;dx++)for(let dz=-m;dz<=m;dz++){const d=Math.sqrt(dx*dx+dz*dz);if(d>(band?ro+1:ro)||d<=ri)continue;const a=Math.atan2(dz,dx);let c=C.terra;if(band&&d>ro-0.5)c=C.bronze;else if(k===7||k===8||k===15)c=C.sand;else if(k>=10&&k<=13&&((Math.floor((a+Math.PI)*8/Math.PI)+k)%4===0))c=C.terraD;else if(k>=25)c=C.terraL;put(EX+dx,y,EZ+dz,c);}}
for(const sd of [-1,1]){const pts=[[EX+sd*9.5,ub+17,EZ],[EX+sd*13.5,ub+15,EZ],[EX+sd*13.5,ub+12,EZ],[EX+sd*10.8,ub+9.5,EZ]];for(let i=0;i<3;i++)beam(pts[i][0],pts[i][1],pts[i][2],pts[i+1][0],pts[i+1][1],pts[i+1][2],1.3,C.terraL);}
for(const q of [[0,0,0,1,0,20,3.2],[3,-1,0.35,1,-0.1,15,2.4],[-3,1,-0.4,1,0.15,14,2.4],[0,3,0.05,1,0.4,12,2.1],[-1,-3,-0.1,1,-0.45,13,2.2],[2.5,2.5,0.45,1,0.4,10,1.8]]){const bx=EX+q[0],by=ub+22,bz=EZ+q[1],l=Math.sqrt(q[2]*q[2]+q[3]*q[3]+q[4]*q[4]),d=[q[2]/l,q[3]/l,q[4]/l],L=q[5],r=q[6],m=[bx+d[0]*(L-3),by+d[1]*(L-3),bz+d[2]*(L-3)],tp=[bx+d[0]*L,by+d[1]*L,bz+d[2]*L];beam(bx,by,bz,m[0],m[1],m[2],r,(q[0]===0&&q[1]===0)?C.crystal:C.crystalD);beam(m[0],m[1],m[2],tp[0],tp[1],tp[2],r*0.5,C.energyL);}
ring(EX,ub+27,EZ,7.5,0.9,C.energy,'y');

// floating island house
const IX=172,IZ=104,ITop=128,ITip=92;
for(let x=IX-40;x<=IX+40;x++)for(let z=IZ-40;z<=IZ+40;z++){const dx=x-IX,dz=z-IZ,d=Math.sqrt(dx*dx+dz*dz),a=Math.atan2(dz,dx),nA=1+0.1*Math.sin(4*a+0.3)+0.06*Math.sin(7*a+1.9),rT=34*nA;if(d>rT)continue;const yb=R(ITip+(ITop-ITip)*Math.pow(d/rT,1/0.7)+2*(vn(x,z,5)-0.5)),yt=ITop+R(1.2*(vn(x+20,z+20,8)-0.5));for(let y=yb;y<=yt;y++){let c;if(y===yt)c=d>rT-1.5?C.greenD:(vn(x*2,z*2,5)>0.6?C.greenL:(vn(x,z,7)>0.45?C.green:C.greenM));else if(y>=yt-1)c=C.terraD;else c=STR[Math.floor((y+2*Math.sin(a*3))/2.6+40)%6];put(x,y,z,c);}}
{const b0=[EX,ub+42,EZ],b1=[IX,ITip+1,IZ],nS=9;for(let i=0;i<nS;i++){const t0=i/nS,t1=(i+1)/nS;beam(b0[0]+(b1[0]-b0[0])*t0,b0[1]+(b1[1]-b0[1])*t0,b0[2]+(b1[2]-b0[2])*t0,b0[0]+(b1[0]-b0[0])*t1,b0[1]+(b1[1]-b0[1])*t1,b0[2]+(b1[2]-b0[2])*t1,i%2?2.2:1.5,i%2?C.energy:C.energyL);}}
for(const q of [[4,0,0.5,-1,0.2],[-3,3,-0.5,-1,0.4],[1,-4,0.2,-1,-0.5],[-4,-2,-0.6,-1,-0.2]]){const bx=IX+q[0],by=ITip+7,bz=IZ+q[1],l=Math.sqrt(q[2]*q[2]+q[3]*q[3]+q[4]*q[4]);beam(bx,by,bz,bx+q[2]/l*9,by+q[3]/l*9,bz+q[4]/l*9,1.6,C.crystalD);beam(bx+q[2]/l*9,by+q[3]/l*9,bz+q[4]/l*9,bx+q[2]/l*11,by+q[3]/l*11,bz+q[4]/l*11,0.8,C.energyL);}
for(let k=0;k<9;k++){const a=k*0.698+0.2,rr=12+(k%3)*6,x0=IX+rr*Math.cos(a),z0=IZ+rr*Math.sin(a),yb=ITip+(ITop-ITip)*Math.pow(rr/34,1/0.7)+2;let px=x0,py=yb,pz=z0;const len=12+(k%4)*4;for(let j=2;j<=len;j+=2){const nx=x0+Math.sin(j*0.5+k)*1.5,nz=z0+Math.cos(j*0.4+k)*1.5,ny=yb-j;line(px,py,pz,nx,ny,nz,C.root);px=nx;py=ny;pz=nz;}}
const HX=180,HZ=98,hy=129;
for(let dx=-11;dx<=11;dx++)for(let dz=-11;dz<=11;dz++)if(dx*dx+dz*dz<=121)put(HX+dx,hy,HZ+dz,C.sandD);
for(let y=hy+1;y<=hy+13;y++)for(let dx=-11;dx<=11;dx++)for(let dz=-11;dz<=11;dz++){const d=Math.sqrt(dx*dx+dz*dz);if(d>11||d<=9.4)continue;const a=Math.atan2(dz,dx),course=Math.floor((y-hy-1)/3),st=Math.floor((a+Math.PI)*(12/Math.PI)+course*0.5);put(HX+dx,y,HZ+dz,((y-hy-1)%3===2)?C.sandD:((st+course)%2?C.sandL:C.sand));}
for(let x=HX-5;x<=HX+5;x++)for(let y=hy+1;y<=hy+12;y++)for(let z=HZ+7;z<=HZ+12;z++){const u=x-HX,v=y-hy-1,d=Math.sqrt(u*u+(z-HZ)*(z-HZ));if(d<=9.4||d>11.8)continue;const rho=v<=6?Math.abs(u):Math.sqrt(u*u+(v-6)*(v-6));if(rho<=3)put(x,y,z,d<10.2?((u===2&&v===4)?C.bronze:C.wood):null);else if(rho<=4.5)put(x,y,z,C.sandD);}
for(const wa of [0.47,2.67,-1.9]){const wx=HX+10.6*Math.cos(wa),wz=HZ+10.6*Math.sin(wa),wy=hy+8;for(let x=R(wx)-3;x<=R(wx)+3;x++)for(let y=wy-3;y<=wy+3;y++)for(let z=R(wz)-3;z<=R(wz)+3;z++){const dd=Math.sqrt((x-wx)*(x-wx)+(y-wy)*(y-wy)+(z-wz)*(z-wz)),d=Math.sqrt((x-HX)*(x-HX)+(z-HZ)*(z-HZ));if(d<=9.4||d>11.8)continue;if(dd<=1.9)put(x,y,z,C.ochre);else if(dd<=2.9)put(x,y,z,C.wood);}}
for(let y=hy+14;y<=hy+31;y++){const r=15*(1-(y-hy-14)/17.5);if(r<0.6){put(HX,y,HZ,C.terraD);continue;}const row=y-hy-14;for(let dx=-15;dx<=15;dx++)for(let dz=-15;dz<=15;dz++){const d=Math.sqrt(dx*dx+dz*dz);if(d>r||(d<r-2.5&&y<hy+29))continue;const a=Math.atan2(dz,dx),sc=(Math.floor((a+Math.PI)*r/2.2)+row)%2===0;put(HX+dx,y,HZ+dz,row%2===0?(sc?C.terraD:C.terra):(d>r-0.8?C.terraL:C.terra));}}
{const ca=-0.8,cx=R(HX+8*Math.cos(ca)),cz=R(HZ+8*Math.sin(ca));box(cx-2,hy+18,cz-2,cx+2,hy+30,cz+2,C.sandD);box(cx-3,hy+31,cz-3,cx+3,hy+31,cz+3,C.sand);box(cx-1,hy+31,cz-1,cx+1,hy+31,cz+1,C.talon);}
beam(158,128,88,157,141,87,1.8,C.wood);
ellipsoid(157,144,87,7,5,7,C.green);ellipsoid(152,147,90,5,4,5,C.greenM);ellipsoid(162,148,85,5,4,5,C.greenL);ellipsoid(157,150,88,4.5,3.5,4.5,C.greenL);
{const dvx=-0.722,dvz=0.692,pvx=-0.692,pvz=-0.722,P=(i,j)=>[IX+dvx*i+pvx*j,IZ+dvz*i+pvz*j];
for(let i=24;i<=46;i+=0.5)for(let j=-6;j<=6;j+=0.5){const p=P(i,j);put(p[0],129,p[1],(Math.floor(i)%3===0)?C.woodD:C.wood);put(p[0],128,p[1],C.woodD);}
for(const j of [-6,6]){for(let i=26;i<=46;i+=5){const p=P(i,j);box(R(p[0]),130,R(p[1]),R(p[0]),133,R(p[1]),C.woodD);}const a=P(26,j),b=P(46,j);line(a[0],133,a[1],b[0],133,b[1],C.wood);const s0=P(42,j*0.8),s1=P(20,j*0.8);beam(s0[0],127,s0[1],s1[0],112,s1[1],1,C.woodD);}
const l0=P(47,-8),l1=P(47,8);beam(l0[0],131,l0[1],l1[0],131,l1[1],1.9,C.wood);put(l0[0],131,l0[1],C.sandD);put(l1[0],131,l1[1],C.sandD);}
{const px=196,pz=112;for(let y=129;y<=134;y++){const r=y<=132?2.5+(y-129)*0.5:4.2;for(let dx=-5;dx<=5;dx++)for(let dz=-5;dz<=5;dz++){const d=Math.sqrt(dx*dx+dz*dz);if(d<=r&&(d>r-1.2||y===129))put(px+dx,y,pz+dz,C.terraL);}}ellipsoid(196,137,112,3.5,3,3.5,C.greenM);}

// mooring chains
function chain(a,b){const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],Ln=Math.sqrt(dx*dx+dy*dy+dz*dz),n=Math.ceil(Ln/3.2);for(let i=0;i<=n;i++){const t=i/n;ring(a[0]+dx*t,a[1]+dy*t,a[2]+dz*t,1.7,0.6,C.bronze,i%2?'x':'z');}}
function bollard(bx,bz){const g=HM(bx,bz);box(bx-2,g-1,bz-2,bx+2,g+6,bz+2,C.sandD);box(bx-3,g+7,bz-3,bx+3,g+7,bz+3,C.sand);return g+9;}
{const t1=bollard(140,92);chain([IX-20*0.94,114,IZ-20*0.34],[140,t1,92]);const t2=bollard(212,96);chain([IX+20*0.94,114,IZ-20*0.34],[212,t2,96]);}

// kite-beast builder: local u forward, v up, w side
function kite(X,Y,Z,yaw,s,P){
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
  const lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
  const nrm=(a)=>{const l=Math.sqrt(a[0]*a[0]+a[1]*a[1]+a[2]*a[2]);return [a[0]/l,a[1]/l,a[2]/l];};
  const ven=P.ven;
  for(const p of P.legsH){seg(p[0],5.6,p[1],4.3,1,C.terra);seg(p[1],3.3,p[2],2.6,1,C.terraL);seg(p[2],2.5,p[3],2.9,1.1,C.sandD);for(let k=-1;k<=1;k++)seg([p[3][0]+2.4,p[3][1]-0.6,p[3][2]+k*1.4],0.6,[p[3][0]+4,p[3][1]-1.6,p[3][2]+k*1.6],0.45,1,C.talon);}
  for(const p of P.legsF){seg(p[0],4.6,p[1],3.9,1,C.sand);seg(p[1],2.4,p[2],2.1,1,C.ochre);seg(p[2],2.1,p[3],1.9,1,C.ochre);for(let k=-1;k<=1;k++){const tp=[p[3][0]+6,p[3][1]-0.8,p[3][2]+k*2.3];seg(p[3],1.2,tp,1.0,1,C.ochre);seg(tp,0.8,[tp[0]+1.6,tp[1]-0.9,tp[2]],0.5,1,C.talon);}const bt=[p[3][0]-4,p[3][1]-0.8,p[3][2]];seg(p[3],1.1,bt,0.9,1,C.ochre);seg(bt,0.7,[bt[0]-1.4,bt[1]-0.8,bt[2]],0.45,1,C.talon);}
  const bodyCol=(t,nu,nv,nw,q)=>{const vd=nu*ven[0]+nv*ven[1];if(vd>0.45)return ((Math.floor(q[0]/2.5)+Math.floor(q[2]/2.5)+400)%3===0)?C.terraL:C.sandL;if(vd<-0.55)return (Math.abs(nw)<0.3&&(Math.floor(q[0]/3)+200)%2===0)?C.terraD:C.terra;return vd>0.1?C.sand:C.terraL;};
  const ruffCol=(t,nu,nv,nw,q)=>{const k=(Math.floor(q[1]/1.8)+Math.floor(q[2]/2.2)+300)%3;return k===0?C.sandL:(k===1?C.sand:C.terraL);};
  seg(P.H,P.rH,P.M,P.rM,1.12,bodyCol);
  seg(P.M,P.rM,P.S,P.rS,1.12,bodyCol);
  seg(P.S,P.rS*0.85,P.N0,P.rN0,1.05,ruffCol);
  const T=P.tail;
  seg(T.base,4.8,T.split,3.6,1.15,(t,nu,nv)=>nv<-0.3?C.sandL:C.terra);
  for(const tip of T.tips)for(let j=-1;j<=1;j++){const tp=[tip[0]+Math.abs(j)*2.5,tip[1]-Math.abs(j)*0.5,tip[2]+j*2.8];seg([T.split[0],T.split[1],T.split[2]+j*1.2],1.5,tp,1.0,1,(t)=>t>0.85?C.sandL:((Math.floor(t*6)%2)?C.terraD:C.terra));}
  const G=P.wing;
  for(const sd of [-1,1]){
    const f=(p)=>[p[0],p[1],p[2]*sd],w0=f(G.W0),w1=f(G.W1),w2=f(G.W2),w3=f(G.W3),ds=nrm(f(G.dSec)),dt=nrm(f(G.dTip));
    for(let i=0;i<G.nSec;i++){const t=(i+0.5)/G.nSec,A=t<0.5?lerp(w0,w1,t*2):lerp(w1,w2,(t-0.5)*2),Ln=G.lSec[0]+(G.lSec[1]-G.lSec[0])*t;seg(A,1.6,[A[0]+ds[0]*Ln,A[1]+ds[1]*Ln,A[2]+ds[2]*Ln],1.0,1,(tt)=>tt>0.82?C.greenD:((Math.floor(tt*5)%2)?C.terra:C.terraL));}
    for(let i=0;i<G.nPri;i++){const t=i/(G.nPri-1),A=lerp(w2,w3,t),dd=nrm(lerp(ds,dt,t)),Ln=G.lPri[0]+(G.lPri[1]-G.lPri[0])*t;seg(A,1.5,[A[0]+dd[0]*Ln,A[1]+dd[1]*Ln,A[2]+dd[2]*Ln],0.9,1,(tt)=>tt>0.75?C.greenD:(tt<0.2?C.sandD:C.green));}
    const cov=(t,nu,nv,nw,q)=>((Math.floor(q[0]/2)+Math.floor(q[1]/2)+300)%3===0)?C.sand:C.terra;
    seg(w0,4.5*G.k,w1,3.8*G.k,1,cov);seg(w1,3.8*G.k,w2,3.0*G.k,1,cov);seg(w2,3.0*G.k,w3,2.2*G.k,1,cov);
  }
  seg(P.N0,P.rN0,P.N1,P.rN1,1,ruffCol);
  const headCol=(t,nu,nv,nw,q)=>{if(nv>0.5)return C.terra;const aw=Math.abs(q[2]-P.Hd[2]);if(nv<-0.05&&aw>3&&aw<5.8)return C.terraD;return C.sandL;};
  seg(P.N1,P.rN1,P.Hd,P.rHd,1,(t,nu,nv,nw,q)=>t<0.4?ruffCol(t,nu,nv,nw,q):headCol(t,nu,nv,nw,q));
  seg(P.Hd,P.rHd,P.B0,P.rHd*0.55,1,headCol);
  seg(P.B0,P.kb*4,P.B1,P.kb*2,1,(t)=>t<0.22?C.ochre:C.greenD);
  seg(P.B1,P.kb*2,P.B2,P.kb*1.1,1,C.greenD);
  const fu=P.B0[0]-P.Hd[0],fv=P.B0[1]-P.Hd[1],fl=Math.sqrt(fu*fu+fv*fv),fx=[fu/fl,fv/fl],up=[-fx[1],fx[0]];
  const HF=(a,b,w)=>[P.Hd[0]+a*fx[0]+b*up[0],P.Hd[1]+a*fx[1]+b*up[1],P.Hd[2]+w];
  const eS=P.rHd/7.8;
  for(const sd of [-1,1]){
    if(P.eyeOpen){seg(HF(2.3*eS,2.6*eS,5.6*eS*sd),1.3*eS,HF(2.6*eS,2.7*eS,6.1*eS*sd),1.1*eS,1,C.ochre);const e=W(HF(2.7*eS,2.8*eS,6.9*eS*sd));put(e[0],e[1],e[2],C.eye);}
    else{const a1=W(HF(1.2*eS,2.3*eS,6.7*eS*sd)),a2=W(HF(3.8*eS,2.1*eS,6.4*eS*sd));line(a1[0],a1[1],a1[2],a2[0],a2[1],a2[2],C.greenD);}
  }
  const K=P.crest,n=K.angles.length;
  const plateCol=(t)=>[C.sandL,C.sand,C.sandD,C.sand,C.terraL,C.terra][Math.min(5,Math.floor(t*6))];
  for(let k=0;k<n;k++){const th=K.angles[k]*Math.PI/180,base=HF(K.base[0]*eS-4*eS+k*8*eS/(n-1),K.base[1]*eS+0.3*k,0),d=[-fx[0]*Math.cos(th)+up[0]*Math.sin(th),-fx[1]*Math.cos(th)+up[1]*Math.sin(th)],Ln=K.len[k];seg(base,K.r,[base[0]+d[0]*Ln,base[1]+d[1]*Ln,base[2]],K.r*0.45,0.45,plateCol);}
  if(K.side)for(const sd of [-1,1]){const th=35*Math.PI/180,base=HF(-2*eS,5*eS,3.2*eS*sd),d=[-fx[0]*Math.cos(th)+up[0]*Math.sin(th),-fx[1]*Math.cos(th)+up[1]*Math.sin(th)];seg(base,K.r*0.8,[base[0]+d[0]*K.side,base[1]+d[1]*K.side,base[2]+4*sd*eS],K.r*0.35,0.5,plateCol);}
  return P.legsF.concat(P.legsH).map(l=>W(l[3]));
}
const ALERT={H:[-18,26,0],M:[-3,28,0],S:[12,31,0],rH:11,rM:12.5,rS:12.5,N0:[19,38,0],N1:[24,47,0],rN0:9,rN1:7.2,Hd:[28,53,0],rHd:7.8,B0:[35.5,52,0],B1:[40.5,49.5,0],B2:[41.5,46.8,0],kb:1,ven:[0,-1],
  legsF:[[[12,26,8],[14,15,9],[14,5.5,9],[14,2,9]],[[12,26,-8],[14,15,-9],[14,5.5,-9],[14,2,-9]]],
  legsH:[[[-18,22,8.5],[-12,13,9.5],[-21,7,9.5],[-18.5,2.2,9.5]],[[-18,22,-8.5],[-12,13,-9.5],[-21,7,-9.5],[-18.5,2.2,-9.5]]],
  tail:{base:[-28,30,0],split:[-36,31,0],tips:[[-54,35,8],[-54,35,-8]]},
  wing:{W0:[12,40,8],W1:[4,52,20],W2:[8,64,30],W3:[-2,76,37],dSec:[-1,-0.45,0.12],dTip:[-0.5,0.8,0.25],lSec:[19,15],lPri:[25,18],nSec:12,nPri:6,k:1},
  crest:{base:[-1,6],angles:[15,38,60,85,108],len:[11,15,17,14,10],r:2.8,side:10},eyeOpen:true};
const REST={H:[-18,13,0],M:[-3,13.5,0],S:[12,14.5,0],rH:11,rM:12.5,rS:12,N0:[19,18,0],N1:[25,20,2],rN0:8.5,rN1:7,Hd:[30,12.5,3],rHd:7.5,B0:[37,11,3],B1:[41.5,9,3],B2:[42,6.8,3],kb:1,ven:[0,-1],
  legsF:[[[12,10,8],[8,4,10],[16,3,9.5],[18,2,9.5]],[[12,10,-8],[8,4,-10],[16,3,-9.5],[18,2,-9.5]]],
  legsH:[[[-18,10,9],[-8,5,12],[-24,3.5,11],[-19,2.2,10]],[[-18,10,-9],[-8,5,-12],[-24,3.5,-11],[-19,2.2,-10]]],
  tail:{base:[-28,15,0],split:[-36,12,0],tips:[[-52,6,7.5],[-52,6,-7.5]]},
  wing:{W0:[12,22,10],W1:[0,21.5,13.5],W2:[-10,20.5,13],W3:[-18,20,12],dSec:[-1,-0.2,-0.05],dTip:[-1,-0.05,-0.12],lSec:[13,10],lPri:[24,18],nSec:8,nPri:5,k:1},
  crest:{base:[-1,6],angles:[6,18,30,42,55],len:[10,13,14,12,9],r:2.6,side:8},eyeOpen:false};
const PUP={H:[-14,20,0],M:[-3,17.5,0],S:[8,14.5,0],rH:10,rM:11.5,rS:10.5,N0:[14,19,0],N1:[17,22,0],rN0:8,rN1:7.5,Hd:[20,25.5,0],rHd:9.5,B0:[28,24,0],B1:[31.5,22,0],B2:[32,20,0],kb:1.05,ven:[0,-1],
  legsF:[[[8,11,7],[13,6,8],[14,2.5,8],[14,1.8,8]],[[8,11,-7],[12,6,-8],[13,2.5,-8],[13,1.8,-8]]],
  legsH:[[[-14,16,8],[-10,10,9],[-17,5,9],[-14.5,2.2,9]],[[-14,16,-8],[-10,10,-9],[-17,5,-9],[-14.5,2.2,-9]]],
  tail:{base:[-22,22,0],split:[-26,24,0],tips:[[-33,28,4],[-33,28,-4]]},
  wing:{W0:[8,21,7],W1:[3,28,13],W2:[-1,33,16],W3:[-4,36,17],dSec:[-1,-0.3,0.1],dTip:[-0.6,0.7,0.2],lSec:[9,7],lPri:[11,8],nSec:5,nPri:4,k:0.7},
  crest:{base:[-1,7],angles:[30,62,95],len:[5,6.5,5],r:1.8,side:0},eyeOpen:true};
function footing(p){const x=R(p[0]),z=R(p[2]),top=R(p[1]-1.2);for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){if(dx*dx+dz*dz>5)continue;const g=HM(x+dx,z+dz);if(g<0)continue;for(let y=g+1;y<=top;y++)put(x+dx,y,z+dz,y===top?C.greenL:C.greenM);}}

// watcher on the crag
kite(GX,61,GZ,0.3,0.8,ALERT);
// resting adult on a grass bed
{const X=170,Z=166,yaw=Math.PI-0.35,s=0.75,cy=Math.cos(yaw),sy=Math.sin(yaw),Wp=(u,w)=>[X+(u*cy-w*sy)*s,Z+(u*sy+w*cy)*s];let Y=0;for(let u=-30;u<=30;u+=10){const p=Wp(u,0);Y=Math.max(Y,HM(p[0],p[1]));}Y+=1;
 for(let u=-36;u<=36;u+=0.5)for(let w=-17;w<=17;w+=0.5){const e=(u/36)*(u/36)+(w/17)*(w/17);if(e>1)continue;const p=Wp(u,w),g=HM(p[0],p[1]);if(g<0)continue;const top=e>0.72?Y+1:Y;for(let y=g+1;y<=top;y++)put(p[0],y,p[1],(e>0.72&&((R(p[0])+R(p[1]))%3===0))?C.sandD:((R(p[0])*3+R(p[1]))%4===0?C.sand:C.sandL));}
 kite(X,Y,Z,yaw,s,REST);}
// juvenile with a crystal toy
{const X=132,Z=152,yaw=0.35,s=0.45,cy=Math.cos(yaw),sy=Math.sin(yaw);let Y=0;for(const p of [[14,8],[13,-8],[-14.5,9],[-14.5,-9]]){Y=Math.max(Y,HM(X+(p[0]*cy-p[1]*sy)*s,Z+(p[0]*sy+p[1]*cy)*s));}Y+=1;kite(X,Y,Z,yaw,s,PUP).forEach(footing);
 const g=HM(147,158);beam(145,g+1.5,160,150,g+2.5,157,1.5,C.crystal);beam(150,g+2.5,157,152,g+3,156,0.8,C.energyL);}

// ground dressing
function shrub(x,z,r){const g=HM(x,z);if(g<0)return;const cols=[C.green,C.greenM,C.greenD];for(let i=0;i<4;i++){const a=i*1.7+x*0.1,ox=Math.cos(a)*r*0.45,oz=Math.sin(a)*r*0.45;ellipsoid(x+ox,g+r*0.55,z+oz,r*(0.55+0.1*(i%2)),r*0.62,r*(0.55+0.1*((i+1)%2)),cols[i%3]);}ellipsoid(x,g+r*0.95,z,r*0.45,r*0.35,r*0.45,C.greenL);}
function tuft(x,z,n){const g=HM(x,z);if(g<0)return;for(let i=0;i<n;i++){const a=rng()*6.283,l=3+rng()*4;line(x,g+1,z,x+Math.cos(a)*l*0.45,g+1+l,z+Math.sin(a)*l*0.45,rng()<0.5?C.sandL:C.sandD);}}
function shard(x,z,dx,dz,l,r){const g=HM(x,z);if(g<0)return;const tx=x+dx*l,tz=z+dz*l,ty=g+1+l*0.8;beam(x,g+1,z,tx,ty,tz,r,C.crystalD);beam(tx,ty,tz,tx+dx*2,ty+2,tz+dz*2,r*0.5,C.energyL);}
function spire(x,z,h,r){const g=HM(x,z);for(let y=g-1;y<=g+h;y++){const rr=r*(1-0.6*(y-g)/h);for(let dx=-Math.ceil(rr);dx<=Math.ceil(rr);dx++)for(let dz=-Math.ceil(rr);dz<=Math.ceil(rr);dz++)if(dx*dx+dz*dz<=rr*rr)put(x+dx,y,z+dz,STR[Math.floor((y+40)/2.5)%6]);}put(x,g+h+1,z,C.greenM);}
shrub(36,150,7);shrub(46,76,6);shrub(102,170,6.5);shrub(116,74,5.5);shrub(156,186,6);shrub(204,172,6.5);shrub(214,126,6);shrub(136,120,5);
boulder(30,HM(30,118)+2,118,6,5,6,true);boulder(188,HM(188,186)+2,186,6,4.5,5.5,true);boulder(156,HM(156,90)+2,90,5.5,4,5,true);
spire(104,64,28,5);spire(224,150,22,4.5);
tuft(58,160,6);tuft(92,82,5);tuft(150,140,6);tuft(196,196,5);tuft(120,186,6);tuft(226,110,5);tuft(84,178,5);
shard(158,120,0.6,0.3,6,1.4);shard(190,124,-0.5,0.5,5,1.2);shard(162,98,0.3,-0.6,5,1.2);shard(96,146,0.5,0.6,5,1.3);shard(40,90,-0.6,0.4,4,1.1);shard(146,100,0.4,-0.5,4,1.1);

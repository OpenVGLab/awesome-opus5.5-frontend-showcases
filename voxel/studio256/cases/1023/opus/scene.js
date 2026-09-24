const C={rockA:'#9C5B45',rockB:'#B4715A',rockC:'#84483A',rockD:'#C88D70',rockDeep:'#5E3A30',snow:'#F5F2EB',snowS:'#E4DED3',iceP:'#D3E8DE',ice:'#A9CFBF',iceD:'#86B7A3',water:'#7FB3A0',waterL:'#B5D8C9',tree:'#6F9E8A'};
const R=Math.round;
function put(x,y,z,c){x=R(x);y=R(y);z=R(z);if(x<10||x>245||z<10||z>245||y<4||y>245)return;block(x,y,z,c);}
const LAT=[];for(let i=0;i<289;i++)LAT.push(rng());
function vn(x,z,sc){const fx=x/sc,fz=z/sc,ix=Math.floor(fx),iz=Math.floor(fz),tx=fx-ix,tz=fz-iz,sx=tx*tx*(3-2*tx),sz=tz*tz*(3-2*tz);const g=(i,j)=>LAT[(((i%17)+17)%17)*17+(((j%17)+17)%17)];const a=g(ix,iz),b=g(ix+1,iz),c=g(ix,iz+1),d=g(ix+1,iz+1);return a+(b-a)*sx+(c-a)*sz+(a-b-c+d)*sx*sz;}

// snow massif cut open at x=XC: stone gate, passage, domed ice chamber with pool and skylight
const MX=122,MZ=104,MRX=96,MRZ=72,XC=170;
function zFront(x){return 158+5*Math.sin(x/13)+3*Math.sin(x/5.3);}
function mountH(x,z){const u=(x-MX)/MRX,v=(z-MZ)/MRZ,e=u*u+v*v;if(e>=1)return 0;return 12+118*Math.pow(1-e,0.85)+22*Math.exp(-((x-98)*(x-98)+(z-84)*(z-84))/700)+5*(vn(x,z,13)-0.5)+2*(vn(x+50,z,5)-0.5);}
function apronIn(x,z){const u=(x-112)/90,v=(z-152)/64;return u*u+v*v<=1+0.06*(vn(x,z,8)-0.5);}
const PP=[[104,176],[106,138],[150,100]],SEG=[];let TOT=0;
for(let i=0;i<PP.length-1;i++){const dx=PP[i+1][0]-PP[i][0],dz=PP[i+1][1]-PP[i][1],l=Math.sqrt(dx*dx+dz*dz);SEG.push({x:PP[i][0],z:PP[i][1],dx:dx,dz:dz,l:l,acc:TOT});TOT+=l;}
function passage(x,z){let best=null;for(const s of SEG){let t=((x-s.x)*s.dx+(z-s.z)*s.dz)/(s.l*s.l);t=Math.max(0,Math.min(1,t));const px=s.x+s.dx*t,pz=s.z+s.dz*t,off=Math.sqrt((x-px)*(x-px)+(z-pz)*(z-pz)),g=(s.acc+t*s.l)/TOT,hw=15-5*g;if(off>hw)continue;const top=R(14+(28-8*g)+(14-4*g)*Math.sqrt(1-(off/hw)*(off/hw)));if(!best||top>best.top)best={top:top,off:off,g:g};}return best;}
function chamber(x,z){const q=((x-156)/30)*((x-156)/30)+((z-96)/34)*((z-96)/34);if(q>=1)return null;return {top:R(13+48*Math.sqrt(1-q)),q:q};}
function streamD(x,z){let best=99;for(let t=0;t<=1;t+=0.02){const sx=104-32*t+5*Math.sin(Math.PI*t*2),sz=162+32*t,d=Math.sqrt((x-sx)*(x-sx)+(z-sz)*(z-sz));if(d<best)best=d;}return best;}
const IA=new Array(65536).fill(null);
for(let x=16;x<=210;x++)for(let z=26;z<=222;z++){
  const zf=zFront(x),inM=x<=XC&&z<=zf,mh=inM?mountH(x,z):0,inA=apronIn(x,z);
  if(mh<=0&&!inA)continue;
  let H=Math.max(mh,inA?12+R(1.2*(vn(x,z,10)-0.5)):0),zone=mh>13?1:0;
  if(!inM&&inA&&x<=XC&&z<=zf+9){const bL=(x>=38&&x<=70)?Math.sin(Math.PI*(x-38)/32):((x>=150&&x<=168)?Math.sin(Math.PI*(x-150)/18):0);if(bL>0.05&&z<=zf+9*bL){H=Math.max(H,24+12*bL+3*(vn(x,z,4)-0.5));zone=1;}}
  H=R(H);
  let iv=[[4,H]];iv.zone=zone;iv.kind=0;iv.water=null;
  if(inM&&mh>0){
    const ps=passage(x,z),ch=chamber(x,z);
    if(ps||ch){
      let fl=ch?(ch.q<0.33?9:12):13,vc=Math.max(ps?ps.top:0,ch?ch.top:0),wt=null;
      if(ch&&ch.q<0.33)wt=[10,13];
      else if(ps&&ps.off<3.5){fl=Math.min(fl,11);wt=[12,13];}
      if(ch&&(x-150)*(x-150)+(z-94)*(z-94)<49)vc=999;
      if(fl<H){iv=[[4,fl]];if(vc+1<=H)iv.push([vc+1,H]);iv.zone=zone;iv.kind=1;iv.water=wt;}
    }
  }
  if(!inM&&inA&&iv.kind===0){
    const pd=((x-70)/18)*((x-70)/18)+((z-196)/11)*((z-196)/11);
    if(pd<1){iv[0][1]=8;iv.water=[9,12];iv.pd=pd;}
    else if(x>=58&&x<=114&&z>=160&&z<=200&&streamD(x,z)<3.8){iv[0][1]=10;iv.water=[11,12];}
  }
  IA[x*256+z]=iv;
}
function topAt(x,z){const iv=IA[R(x)*256+R(z)];return iv?iv[iv.length-1][1]:-1;}
function solidIn(x,z,y){const iv=IA[x*256+z];if(!iv)return false;for(let i=0;i<iv.length;i++)if(y>=iv[i][0]&&y<=iv[i][1])return true;return false;}
const BANDS=[[7,C.rockA],[1,C.ice],[4,C.rockB],[6,C.rockC],[2,C.rockD],[1,C.snowS],[6,C.rockA],[3,C.rockB],[1,C.ice],[5,C.rockC],[3,C.rockD]];
let BT=0;for(const b of BANDS)BT+=b[0];
function strata(x,y,z){let yy=y+0.06*x+0.02*z;yy=((yy%BT)+BT)%BT;for(const b of BANDS){if(yy<b[0])return b[1];yy-=b[0];}return C.rockA;}
function vcol(x,y,z,iv,k,a,b){
  if(y===b){if(k===0&&iv.kind===1)return C.iceP;if(iv.zone===1)return (y>30||((x*3+z*7)%5!==0))?C.snow:C.snowS;return ((x*5+z*3)%9===0)?C.snowS:C.snow;}
  if(k>0&&y===a)return ((x*3+z*5)%7===0)?C.iceD:C.rockDeep;
  return strata(x,y,z);
}
const NB=[[1,0],[-1,0],[0,1],[0,-1],[2,0],[-2,0],[0,2],[0,-2]];
for(let x=16;x<=210;x++)for(let z=26;z<=222;z++){
  const iv=IA[x*256+z];if(!iv)continue;
  let simple=iv.length===1,minT=999;
  for(const nb of NB){const n=IA[(x+nb[0])*256+z+nb[1]];if(!n){minT=3;continue;}if(n.length>1)simple=false;const t=n[n.length-1][1];if(t<minT)minT=t;}
  for(let k=0;k<iv.length;k++){const a=iv[k][0],b=iv[k][1],y0=simple?Math.max(a,Math.min(b-3,minT+1)):a;
    for(let y=y0;y<=b;y++){
      if(!simple&&y<=b-3&&!(a>4&&y<a+3)){let ex=false;for(const nb of NB)if(!solidIn(x+nb[0],z+nb[1],y)){ex=true;break;}if(!ex)continue;}
      put(x,y,z,vcol(x,y,z,iv,k,a,b));
    }
  }
  if(iv.water){const w=iv.water;for(let y=w[0];y<=w[1];y++)put(x,y,z,y===w[1]?((iv.pd!==undefined&&iv.pd>0.72)?C.iceP:((Math.floor(x*0.5+z*0.3)%5===0)?C.waterL:C.water)):C.iceD);}
}

// icicle curtain on the gate, chamber icicles, ice stalagmites, skylight fringe
for(let xx=88;xx<=121;xx+=1.5){const x=R(xx),z=R(zFront(x))-1,iv=IA[x*256+z];if(!iv||iv.length<2)continue;const yT=iv[1][0]-1,len=4+((x*7)%11)+(Math.abs(x-104)<8?4:0);if(yT-len<15)continue;cone(x,yT-len+1,z,0,1.1+len*0.06,len,(x%3===0)?C.iceP:C.ice);}
for(const [x,z,L] of [[140,86,14],[146,106,18],[154,78,12],[160,112,16],[164,90,10],[136,100,12],[167,102,14],[150,118,10],[142,94,20],[160,80,12],[132,110,8],[166,82,9]]){const iv=IA[x*256+z];if(!iv||iv.length<2)continue;const yT=iv[1][0]-1;if(yT-L<16)continue;cone(x,yT-L+1,z,0,1.3+L*0.05,L,(L%3===0)?C.iceP:C.ice);}
for(const [x,z,h] of [[138,82,8],[146,118,6],[158,122,10],[168,114,7],[166,78,9],[134,104,6],[152,70,7],[142,72,5]]){const ch=chamber(x,z);if(!ch||ch.q<0.36)continue;cone(x,13,z,1.8+h*0.08,0,h,(h%2)?C.iceP:C.snow);}
for(let a=0;a<6.28;a+=0.55){const x=R(150+8.5*Math.cos(a)),z=R(94+8.5*Math.sin(a));if(x>XC)continue;const iv=IA[x*256+z];if(!iv||iv.length<2)continue;const yT=iv[1][0]-1,L=5+R(3*Math.sin(a*3)+3);cone(x,yT-L+1,z,0,1.2,L,C.iceP);}

// frozen cascade beside the gate
for(let x=132;x<=144;x+=2){const zf=zFront(x);let yt=0;for(let dz=0;dz<=3;dz++)yt=Math.max(yt,topAt(x,R(zf)-dz));const r=1.2+((x*3)%4)*0.3;beam(x,13,zf+1.2,x+0.5*Math.sin(x),yt-1,zf+0.6,r,(x%4===0)?C.iceP:C.ice);}
cone(138,13,R(zFront(138))+3,7,2,7,C.iceP);

// stepping stones into the gate, boulders, celadon firs, pond floe
for(let i=0;i<6;i++){const t=i/5,x=114+4*Math.sin(t*3),z=206-t*34,g=topAt(x,z);if(g<0)continue;for(let dx=-4;dx<=4;dx++)for(let dz=-3;dz<=3;dz++){if(dx*dx/16+dz*dz/9>1)continue;put(x+dx,g+1,z+dz,C.rockB);if(dx*dx/9+dz*dz/4<=1)put(x+dx,g+2,z+dz,C.snow);}}
function boulder(cx,cz,rx,ry,rz){const g=topAt(cx,cz);if(g<0)return;for(let x=R(cx-rx);x<=R(cx+rx);x++)for(let y=g-1;y<=R(g+ry*1.6);y++)for(let z=R(cz-rz);z<=R(cz+rz);z++){const u=(x-cx)/rx,v=(y-g)/(ry*1.6),w=(z-cz)/rz;if(u*u+v*v+w*w>1)continue;put(x,y,z,v>0.55?C.snow:((y+x)%5===0?C.rockC:C.rockB));}}
boulder(48,184,7,5,6);boulder(158,196,6,4,5);boulder(186,150,7,5,6);boulder(132,206,5,3.5,4);boulder(28,150,5,4,5);
function fir(x,z,h){const g=topAt(x,z);if(g<0)return;beam(x,g+1,z,x,g+4,z,1.2,C.rockC);for(let k=0;k<3;k++){const y0=g+3+k*h*0.28,r=h*0.34*(1-k*0.24);cone(x,R(y0),z,r,0.6,R(h*0.38),C.tree);cone(x,R(y0+h*0.3),z,r*0.45,0,R(h*0.12)+1,C.snow);}}
fir(40,172,20);fir(176,184,18);fir(196,168,22);fir(160,176,15);
for(let dx=-4;dx<=4;dx++)for(let dz=-3;dz<=3;dz++)if(dx*dx/16+dz*dz/9<=1){put(76+dx,12,194+dz,C.snow);if(dx*dx/9+dz*dz/4<=1)put(76+dx,13,194+dz,C.snowS);}

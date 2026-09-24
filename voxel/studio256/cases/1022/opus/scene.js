const C={white:'#F4F5F7',offw:'#DEE2EA',lav:'#B7B0C8',gp:'#8F87A3',gpD:'#6D6582',steel:'#56506A',ice:'#BFDCEA',iceL:'#DDEFF6',water:'#A5D5EA',waterL:'#D3EDF6',waterD:'#79B8D4',orange:'#E8743B',red:'#C9483A',yellow:'#F2B541',glass:'#9CC7DC',tire:'#3E3A4A'};
const R=Math.round;
function put(x,y,z,c){x=R(x);y=R(y);z=R(z);if(x<10||x>245||z<10||z>245||y<4||y>245)return;block(x,y,z,c);}
const LAT=[];for(let i=0;i<289;i++)LAT.push(rng());
function vn(x,z,sc){const fx=x/sc,fz=z/sc,ix=Math.floor(fx),iz=Math.floor(fz),tx=fx-ix,tz=fz-iz,sx=tx*tx*(3-2*tx),sz=tz*tz*(3-2*tz);const g=(i,j)=>LAT[(((i%17)+17)%17)*17+(((j%17)+17)%17)];const a=g(ix,iz),b=g(ix+1,iz),c=g(ix,iz+1),d=g(ix+1,iz+1);return a+(b-a)*sx+(c-a)*sz+(a-b-c+d)*sx*sz;}

// entrenched meander block: outer plateau with undercut cut-bank, terraced inner spur
function inBlock(x,z){const u=(x-128)/104,v=(z-128)/94,u2=u*u,v2=v*v;return u2*u2*u2+v2*v2*v2<=1+0.12*(vn(x,z,9)-0.5);}
function riv(x){const q=(x-128)/104;return {zc:80+70*q*q+4*Math.sin(x/17),dz:140*q/104+(4/17)*Math.cos(x/17),w:10+2*Math.sin(x/23),bell:Math.max(0,1-((x-124)/46)*((x-124)/46))};}
function hSpur(u,x,z){const uu=u+3*Math.sin(x/19)+2*Math.sin(z/13);let h;if(uu<12)h=25.5+uu*0.1;else if(uu<16)h=26.7+(uu-12)*3.3;else if(uu<34)h=40+(uu-16)*0.1;else if(uu<38)h=41.8+(uu-34)*3.6;else if(uu<60)h=56+(uu-38)*0.08;else if(uu<64)h=57.8+(uu-60)*3.2;else h=70.6+(uu-64)*0.03;return h+1.2*(vn(x,z,11)-0.5);}
const IA=new Array(65536).fill(null);
for(let x=20;x<=236;x++)for(let z=30;z<=226;z++){
  if(!inBlock(x,z))continue;
  const r=riv(x),s=(z-r.zc)/Math.sqrt(1+r.dz*r.dz),HO=R(108+2.4*(vn(x,z,15)-0.5)),lip=R(64+2*(1-r.bell));
  let iv;
  if(Math.abs(s)<r.w){const bed=18+R(2*(vn(x,z,6)-0.5)),v=-s-r.w;iv=(r.bell>0.15&&v>=-5*r.bell)?[[4,bed],[lip,HO]]:[[4,bed]];iv.zone=0;}
  else if(s>=r.w){iv=[[4,R(hSpur(s-r.w,x,z))]];iv.zone=1;iv.u=s-r.w;}
  else{const v=-s-r.w;iv=(r.bell>0.15&&v<15*r.bell)?[[4,25],[lip,HO]]:[[4,HO]];iv.zone=2;}
  IA[x*256+z]=iv;
}
function topAt(x,z){const iv=IA[R(x)*256+R(z)];return iv?iv[iv.length-1][1]:-1;}
function solidIn(x,z,y){const iv=IA[x*256+z];if(!iv)return false;for(let i=0;i<iv.length;i++)if(y>=iv[i][0]&&y<=iv[i][1])return true;return false;}
const BANDS=[[4,C.white],[3,C.lav],[6,C.gp],[2,C.gpD],[5,C.offw],[3,C.ice],[7,C.gp],[2,C.white],[4,C.lav],[3,C.gpD],[6,C.offw],[4,C.gp]];
let BT=0;for(const b of BANDS)BT+=b[0];
function strata(x,y,z){let yy=y+0.05*x-0.03*z+1.5*vn(x,z,14);yy=((yy%BT)+BT)%BT;for(const b of BANDS){if(yy<b[0])return b[1];yy-=b[0];}return C.gp;}
function topCol(x,z,iv,k){const n=vn(x+5,z+9,8);
  if(k===0&&iv.length>1)return iv.zone===0?C.gp:(n>0.5?C.iceL:C.offw);
  if(iv.zone===0&&iv.length===1)return C.gp;
  if(iv.zone===1&&iv.u<12)return ((x*7+z*13)%5===0)?C.gp:(((x+z)%3===0)?C.lav:C.offw);
  if(n>0.7)return C.iceL;if(n<0.22)return iv.zone===1?C.offw:C.lav;return C.white;}
const NB=[[1,0],[-1,0],[0,1],[0,-1],[2,0],[-2,0],[0,2],[0,-2]];
for(let x=20;x<=236;x++)for(let z=30;z<=226;z++){
  const iv=IA[x*256+z];if(!iv)continue;
  let simple=iv.length===1,minT=999;
  for(const nb of NB){const n=IA[(x+nb[0])*256+z+nb[1]];if(!n){minT=3;continue;}if(n.length>1)simple=false;const t=n[n.length-1][1];if(t<minT)minT=t;}
  for(let k=0;k<iv.length;k++){const a=iv[k][0],b=iv[k][1],y0=simple?Math.max(a,Math.min(b-3,minT+1)):a;
    for(let y=y0;y<=b;y++){
      if(!simple&&y<=b-3&&!(a>4&&y<a+3)){let ex=false;for(const nb of NB)if(!solidIn(x+nb[0],z+nb[1],y)){ex=true;break;}if(!ex)continue;}
      put(x,y,z,y===b?topCol(x,z,iv,k):strata(x,y,z));
    }
  }
  if(iv.zone===0){const bed=iv[0][1];for(let y=bed+1;y<=24;y++)put(x,y,z,y===24?((Math.floor(x*0.4+Math.sin(z*0.5)*2+60)%6===0)?C.waterL:C.water):C.waterD);}
}
for(let i=0;i<8;i++){const x=40+i*22+rng()*8,r=riv(x),z=r.zc+(rng()-0.5)*r.w,rr=2+rng()*3;for(let dx=-5;dx<=5;dx++)for(let dz=-5;dz<=5;dz++){if(dx*dx+dz*dz>rr*rr)continue;const iv=IA[R(x+dx)*256+R(z+dz)];if(!iv||iv.zone!==0||iv.length>1)continue;put(x+dx,25,z+dz,((dx+dz+10)%3===0)?C.iceL:C.white);}}
for(let x=90;x<=160;x+=2){const r=riv(x);if(r.bell<0.3)continue;const lip=R(64+2*(1-r.bell));for(let k=0;k<3;k++){const v=-5*r.bell+0.6+k*2.2,s=-r.w-v,z=R(r.zc+s*Math.sqrt(1+r.dz*r.dz));if(!solidIn(x,z,lip))continue;const L=3+((x*7+k*5)%8);for(let j=1;j<=L;j++)put(x,lip-j,z,j>L-2?C.iceL:C.ice);}}

// observation tower with ladder on the overhang
const TWX=108,TWZ=66;
let tb=0;for(const [sx,sz] of [[-7,-7],[7,-7],[-7,7],[7,7]])tb=Math.max(tb,topAt(TWX+sx,TWZ+sz));tb+=1;
const tt=tb+36,hs=(y)=>7-2*(y-tb)/36;
for(const [sx,sz] of [[-1,-1],[1,-1],[-1,1],[1,1]]){beam(TWX+7*sx,tb,TWZ+7*sz,TWX+5*sx,tt,TWZ+5*sz,1.1,C.steel);box(TWX+7*sx-2,tb-1,TWZ+7*sz-2,TWX+7*sx+2,tb,TWZ+7*sz+2,C.gpD);}
for(let k=0;k<3;k++){const y0=tb+k*12,y1=y0+12,h0=hs(y0),h1=hs(y1);for(let f=0;f<4;f++){const P=(y,h,sd)=>f<2?[TWX+sd*h,y,TWZ+(f===0?-h:h)]:[TWX+(f===2?-h:h),y,TWZ+sd*h];const a=P(y0,h0,-1),b=P(y1,h1,1),c=P(y0,h0,1),d=P(y1,h1,-1),e=P(y1,h1,-1),g=P(y1,h1,1);line(a[0],a[1],a[2],b[0],b[1],b[2],C.steel);line(c[0],c[1],c[2],d[0],d[1],d[2],C.steel);line(e[0],e[1],e[2],g[0],g[1],g[2],C.steel);}
  for(const lx of [TWX-2,TWX+2])line(lx,y1,TWZ+h1,lx,y1,TWZ+8.5-2*(y1-tb)/40,C.steel);}
for(const lx of [TWX-2,TWX+2])line(lx,tb,TWZ+8.5,lx,tt+4,TWZ+6.5,C.yellow);
for(let y=tb+2;y<=tt+3;y+=3){const z=TWZ+8.5-2*(y-tb)/40;line(TWX-2,y,z,TWX+2,y,z,C.yellow);}
box(TWX-8,tt,TWZ-8,TWX+8,tt+1,TWZ+8,C.offw);
for(let x=TWX-2;x<=TWX+2;x++)for(let z=TWZ+5;z<=TWZ+7;z++){put(x,tt,z,null);put(x,tt+1,z,null);}
for(let i=-8;i<=8;i+=4){box(TWX+i,tt+2,TWZ-8,TWX+i,tt+5,TWZ-8,C.steel);box(TWX-8,tt+2,TWZ+i,TWX-8,tt+5,TWZ+i,C.steel);box(TWX+8,tt+2,TWZ+i,TWX+8,tt+5,TWZ+i,C.steel);}
box(TWX-8,tt+2,TWZ+8,TWX-8,tt+5,TWZ+8,C.steel);box(TWX+8,tt+2,TWZ+8,TWX+8,tt+5,TWZ+8,C.steel);
line(TWX-8,tt+5,TWZ-8,TWX+8,tt+5,TWZ-8,C.white);line(TWX-8,tt+5,TWZ-8,TWX-8,tt+5,TWZ+8,C.white);line(TWX+8,tt+5,TWZ-8,TWX+8,tt+5,TWZ+8,C.white);line(TWX-8,tt+5,TWZ+8,TWX-3,tt+5,TWZ+8,C.white);line(TWX+3,tt+5,TWZ+8,TWX+8,tt+5,TWZ+8,C.white);
for(const sx of [-6,6])for(const sz of [-6,6])box(TWX+sx,tt+2,TWZ+sz,TWX+sx,tt+10,TWZ+sz,C.steel);
for(let y=tt+11;y<=tt+17;y++){const h=9-(y-tt-11)*1.45;for(let dx=-9;dx<=9;dx++)for(let dz=-9;dz<=9;dz++){const m=Math.max(Math.abs(dx),Math.abs(dz));if(m<=h&&(m>h-1.6||y===tt+17))put(TWX+dx,y,TWZ+dz,C.red);}}
line(TWX,tt+18,TWZ,TWX,tt+25,TWZ,C.steel);put(TWX+1,tt+24,TWZ,C.yellow);put(TWX+2,tt+24,TWZ,C.yellow);put(TWX+1,tt+23,TWZ,C.yellow);
box(TWX+2,tt+2,TWZ+1,TWX+2,tt+5,TWZ+1,C.steel);box(TWX+1,tt+6,TWZ,TWX+3,tt+6,TWZ+4,C.white);put(TWX+2,tt+6,TWZ+5,C.glass);

// survey tent and theodolite
const TEX=64,TEZ=56;
let teY=0;for(const [dx,dz] of [[-12,-8],[12,-8],[-12,8],[12,8],[0,0]])teY=Math.max(teY,topAt(TEX+dx,TEZ+dz));teY+=1;
for(let x=TEX-12;x<=TEX+12;x++)for(let y=teY;y<=teY+12;y++){const hw=8.5*(1-(y-teY)/12.5);for(let z=TEZ-9;z<=TEZ+9;z++){const d=Math.abs(z-TEZ);if(d>hw)continue;const end=Math.abs(x-TEX)>=11;if(!(d>hw-1.6||end))continue;if(x>=TEX+11&&d<hw-2.2&&y<teY+8)continue;put(x,y,z,y>=teY+11?C.red:(end?C.orange:((x-TEX+60)%6===0?C.red:C.orange)));}}
for(let x=TEX-10;x<=TEX+10;x++)for(let z=TEZ-7;z<=TEZ+7;z++){const g=topAt(x,z);for(let y=g+1;y<=teY;y++)put(x,y,z,C.gpD);}
for(const s of [-1,1]){line(TEX+s*12,teY+12,TEZ,TEX+s*18,teY,TEZ,C.white);put(TEX+s*18,teY,TEZ,C.steel);for(const t of [-1,1]){line(TEX+s*6,teY+5,TEZ+t*5.5,TEX+s*8,teY,TEZ+t*13,C.white);put(TEX+s*8,teY,TEZ+t*13,C.steel);}}
{const THX=86,THZ=64,thY=topAt(86,64)+1;for(const a of [0.3,2.4,4.5])line(THX+5*Math.cos(a),thY,THZ+5*Math.sin(a),THX,thY+11,THZ,C.yellow);box(THX-1,thY+12,THZ-1,THX+1,thY+14,THZ+1,C.steel);box(THX-1,thY+15,THZ-2,THX+1,thY+16,THZ+2,C.white);put(THX,thY+15,THZ+3,C.glass);}

// sample cabinet with core boxes
{const SCX=132,SCZ=44;let sy=0;for(const [dx,dz] of [[-6,-4],[6,-4],[-6,4],[6,4]])sy=Math.max(sy,topAt(SCX+dx,SCZ+dz));sy+=1;
 box(SCX-6,sy,SCZ-4,SCX+6,sy+1,SCZ+4,C.steel);box(SCX-6,sy+2,SCZ-4,SCX+6,sy+21,SCZ+4,C.iceL);box(SCX-7,sy+22,SCZ-5,SCX+7,sy+22,SCZ+5,C.offw);
 for(let k=0;k<5;k++){const y=sy+3+4*k;box(SCX-5,y,SCZ+5,SCX+5,y+2,SCZ+5,C.white);box(SCX-1,y+1,SCZ+6,SCX+1,y+1,SCZ+6,C.orange);}
 for(let y=sy+4;y<=sy+19;y+=3){line(SCX-7,y,SCZ-3,SCX-7,y,SCZ+3,C.gp);line(SCX+7,y,SCZ-3,SCX+7,y,SCZ+3,C.gp);}
 for(let k=0;k<3;k++){let g=0;for(let x=112;x<=124;x+=4)g=Math.max(g,topAt(x,41));const y=g+1+k*3;box(112,y,38,124,y+1,45,C.offw);for(let r=0;r<3;r++)for(let x=113;x<=123;x++)put(x,y+2,39+r*2,((x+r*3)%5<2)?C.lav:C.white);}}

// cableway: upper station, span with cargo cabin, lower station
const UX=152,UZ=58;let uy=0;for(const [dx,dz] of [[-6,-4],[6,-4],[-6,4],[6,4]])uy=Math.max(uy,topAt(UX+dx,UZ+dz));uy+=1;
for(const sx of [-1,1])for(const sz of [-1,1])beam(UX+6*sx,uy,UZ+4*sz,UX+sx,uy+22,UZ,1.2,C.steel);
box(UX-2,uy+22,UZ-2,UX+2,uy+24,UZ+2,C.gpD);ring(UX,uy+26,UZ,3,0.7,C.yellow,'x');
box(UX-3,uy,UZ-10,UX+3,uy+6,UZ-6,C.gpD);line(UX,uy+26,UZ-3,UX,uy+6,UZ-8,C.steel);
const LX=156,LZ=140;let ly=0;for(let dx=-6;dx<=6;dx+=3)for(let dz=-6;dz<=6;dz+=3)ly=Math.max(ly,topAt(LX+dx,LZ+dz));ly+=1;
for(let x=LX-6;x<=LX+6;x++)for(let z=LZ-6;z<=LZ+6;z++){const g=topAt(x,z);for(let y=g+1;y<=ly;y++)put(x,y,z,y===ly?C.gp:C.gpD);}
for(const sx of [-1,1])for(const sz of [-1,1])beam(LX+5*sx,ly+1,LZ+4*sz,LX+sx,ly+20,LZ,1.1,C.steel);
box(LX-2,ly+20,LZ-2,LX+2,ly+22,LZ+2,C.gpD);ring(LX,ly+24,LZ,3,0.7,C.yellow,'x');
{const g=topAt(LX+10,LZ);box(LX+8,g+1,LZ-2,LX+12,g+1,LZ+2,C.gpD);for(let x=LX+8;x<=LX+12;x++)for(let dy=-4;dy<=4;dy++)for(let dz=-4;dz<=4;dz++){const d=Math.sqrt(dy*dy+dz*dz);if(d>4.2)continue;if(x===LX+8||x===LX+12)put(x,g+6+dy,LZ+dz,C.yellow);else if(d<=3)put(x,g+6+dy,LZ+dz,C.steel);}}
const U0=[UX,uy+29,UZ],L0=[LX,ly+27,LZ];
const cab=(t)=>[U0[0]+(L0[0]-U0[0])*t,U0[1]+(L0[1]-U0[1])*t-20*t*(1-t),U0[2]+(L0[2]-U0[2])*t];
{let p=cab(0);for(let i=1;i<=40;i++){const q=cab(i/40);line(p[0],p[1],p[2],q[0],q[1],q[2],C.steel);p=q;}}
{const P=cab(0.36).map(R);box(P[0]-1,P[1]-1,P[2]-3,P[0]+1,P[1],P[2]+3,C.gpD);put(P[0],P[1]+1,P[2]-2,C.yellow);put(P[0],P[1]+1,P[2]+2,C.yellow);
 line(P[0]-1,P[1]-2,P[2],P[0]-4,P[1]-8,P[2],C.steel);line(P[0]+1,P[1]-2,P[2],P[0]+4,P[1]-8,P[2],C.steel);box(P[0]-5,P[1]-9,P[2]-5,P[0]+5,P[1]-9,P[2]+5,C.yellow);
 box(P[0]-5,P[1]-19,P[2]-5,P[0]+5,P[1]-10,P[2]+5,C.orange);box(P[0]-4,P[1]-15,P[2]-5,P[0]+4,P[1]-12,P[2]-5,C.glass);box(P[0]-4,P[1]-15,P[2]+5,P[0]+4,P[1]-12,P[2]+5,C.glass);box(P[0]-5,P[1]-19,P[2]-5,P[0]+5,P[1]-19,P[2]+5,C.gpD);
 for(const sx of [-5,5])box(P[0]+sx,P[1]-18,P[2]-3,P[0]+sx,P[1]-11,P[2]+3,C.white);}

// drilling rig on the second terrace
const RGX=96,RGZ=147;let rg=0;for(let dx=-11;dx<=11;dx+=2)for(let dz=-9;dz<=9;dz+=2)rg=Math.max(rg,topAt(RGX+dx,RGZ+dz));
const dy=rg+3,DXc=RGX-4;
for(const [sx,sz] of [[-10,-8],[10,-8],[-10,8],[10,8],[0,-8],[0,8]]){const g=topAt(RGX+sx,RGZ+sz);box(RGX+sx-1,g+1,RGZ+sz-1,RGX+sx+1,dy-1,RGZ+sz+1,C.steel);}
for(let x=RGX-11;x<=RGX+11;x++)for(let z=RGZ-9;z<=RGZ+9;z++)put(x,dy,z,(Math.abs(x-RGX)===11||Math.abs(z-RGZ)===9)?C.yellow:(((x+z)%3===0)?C.gpD:C.gp));
for(const [sx,sz] of [[-1,-1],[1,-1],[-1,1],[1,1]])beam(DXc+6*sx,dy+1,RGZ+6*sz,DXc+2*sx,dy+46,RGZ+2*sz,0.9,C.steel);
for(let k=1;k<=5;k++){const y=dy+1+k*9,h=6-4*k/5,y0=y-9,h0=6-4*(k-1)/5;for(const [a,b] of [[[-h,-h],[h,-h]],[[h,-h],[h,h]],[[h,h],[-h,h]],[[-h,h],[-h,-h]]])line(DXc+a[0],y,RGZ+a[1],DXc+b[0],y,RGZ+b[1],C.steel);line(DXc-h0,y0,RGZ-h0,DXc+h,y,RGZ-h,C.steel);line(DXc+h0,y0,RGZ+h0,DXc-h,y,RGZ+h,C.steel);line(DXc-h0,y0,RGZ+h0,DXc-h,y,RGZ-h,C.steel);line(DXc+h0,y0,RGZ-h0,DXc+h,y,RGZ+h,C.steel);}
box(DXc-3,dy+46,RGZ-3,DXc+3,dy+49,RGZ+3,C.yellow);ring(DXc,dy+51,RGZ,2.2,0.6,C.steel,'z');
{const g=topAt(DXc,RGZ);box(DXc-1,g+1,RGZ-1,DXc+1,dy+42,RGZ+1,C.offw);for(let x=-3;x<=3;x++)for(let z=-3;z<=3;z++){const d=x*x+z*z;if(d<=10&&d>2)put(DXc+x,dy+1,RGZ+z,C.steel);}}
box(RGX+4,dy+1,RGZ-9,RGX+11,dy+9,RGZ-3,C.red);box(RGX+4,dy+10,RGZ-9,RGX+11,dy+10,RGZ-3,C.white);line(RGX+9,dy+11,RGZ-5,RGX+9,dy+17,RGZ-5,C.steel);
line(DXc+2,dy+47,RGZ,RGX+6,dy+9,RGZ-4,C.steel);
for(let i=0;i<3;i++)for(let j=0;j<3-i;j++){const x=RGX+5+j*2+i,y=dy+2+i*2;beam(x,y,RGZ,x,y,RGZ+8,0.8,C.white);}
box(RGX+4,dy+1,RGZ-1,RGX+4,dy+2,RGZ+9,C.gpD);box(RGX+11,dy+1,RGZ-1,RGX+11,dy+2,RGZ+9,C.gpD);

// off-road survey vehicle on the upland with tracks
const VX=160,VZ=192;let vg=0;for(const [sx,sz] of [[-11,-8],[11,-8],[-11,8],[11,8]])vg=Math.max(vg,topAt(VX+sx,VZ+sz));
const wc=vg+5;
for(const sx of [-11,11])for(const sz of [-1,1]){const cz=VZ+sz*8;for(let dx=-5;dx<=5;dx++)for(let d2=-5;d2<=5;d2++){const d=Math.sqrt(dx*dx+d2*d2);if(d>5.2)continue;for(let k=-1;k<=1;k++)put(VX+sx+dx,wc+d2,cz+k,d<2.2?(k===sz?C.offw:C.gpD):C.tire);}}
box(VX-16,wc,VZ-6,VX+16,wc+2,VZ+6,C.gpD);
box(VX-16,wc+3,VZ-7,VX+16,wc+7,VZ+7,C.orange);
for(const sx of [-11,11])for(const sz of [-1,1])box(VX+sx-6,wc+6,Math.min(VZ+sz*7,VZ+sz*9),VX+sx+6,wc+7,Math.max(VZ+sz*7,VZ+sz*9),C.gpD);
box(VX-16,wc+8,VZ-7,VX-5,wc+15,VZ+7,C.orange);box(VX-16,wc+16,VZ-7,VX-5,wc+16,VZ+7,C.white);
box(VX-16,wc+10,VZ-5,VX-16,wc+14,VZ+5,C.glass);for(const sz of [-7,7])box(VX-14,wc+10,VZ+sz,VX-7,wc+14,VZ+sz,C.glass);
box(VX-4,wc+8,VZ-7,VX+16,wc+18,VZ+7,C.white);box(VX-4,wc+12,VZ-7,VX+16,wc+13,VZ+7,C.orange);
for(let x=VX-3;x<=VX+15;x+=3)line(x,wc+19,VZ-6,x,wc+19,VZ+6,C.steel);line(VX-3,wc+20,VZ-6,VX+15,wc+20,VZ-6,C.steel);line(VX-3,wc+20,VZ+6,VX+15,wc+20,VZ+6,C.steel);
box(VX+2,wc+20,VZ-4,VX+8,wc+22,VZ+2,C.gp);
box(VX-18,wc+2,VZ-6,VX-17,wc+4,VZ+6,C.steel);put(VX-17,wc+6,VZ-5,C.yellow);put(VX-17,wc+6,VZ+5,C.yellow);
line(VX+13,wc+19,VZ-5,VX+13,wc+33,VZ-5,C.steel);put(VX+13,wc+34,VZ-5,C.yellow);
line(VX+10,wc+21,VZ+4,VX+10,wc+26,VZ+4,C.steel);ellipsoid(VX+10,wc+27,VZ+4,2.2,1.2,2.2,C.white);
for(let dz=-4;dz<=4;dz++)for(let d2=-4;d2<=4;d2++){const q=dz*dz+d2*d2;if(q<=16)put(VX+17,wc+11+d2,VZ+dz,q<=4?C.gp:C.tire);}
for(let x=VX+18;x<=232;x++)for(const tz of [VZ-9,VZ-8,VZ+8,VZ+9]){const t=topAt(x,tz);if(t>0)put(x,t,tz,C.lav);}

// markers and outcrops
function flag(x,z,col){const t=topAt(x,z);if(t<0)return;line(x,t+1,z,x,t+8,z,C.steel);put(x+1,t+8,z,col);put(x+2,t+8,z,col);put(x+1,t+7,z,col);}
flag(44,100,C.orange);flag(200,86,C.orange);flag(130,176,C.red);flag(186,160,C.orange);flag(62,170,C.red);
function tor(x,z,r,h){const t=topAt(x,z);if(t<0)return;for(let y=t-1;y<=t+h;y++){const rr=r*(1-0.5*(y-t)/h);for(let dx=-Math.ceil(r);dx<=Math.ceil(r);dx++)for(let dz=-Math.ceil(r);dz<=Math.ceil(r);dz++){if(dx*dx+dz*dz>rr*rr*(1+0.3*(vn(x+dx,z+dz+y,3)-0.5)))continue;put(x+dx,y,z+dz,y>=t+h-1?C.white:strata(x+dx,y,z+dz));}}}
tor(36,50,5,7);tor(206,46,6,8);tor(182,64,4,5);tor(60,200,5,6);tor(212,176,4,5);

const C={ivory:'#F3EEE2',ivoryS:'#E1D8C4',celadon:'#9FC9B5',celadonD:'#77A993',wood:'#8B6440',woodL:'#B08556',woodD:'#624528',deckA:'#A47A50',deckB:'#BE956A',copper:'#B87D4B',gold:'#D4A95F',soil:'#5B4636',soilL:'#7A604A',leafD:'#4E8C73',leaf:'#6FA88D',leafL:'#9CCBB3',leafY:'#C4E3D2',under:'#5E9A80',root:'#A68A68',rootTip:'#DCCBAE',moss:'#6F8F6B',spadix:'#E6D8A8',spadixD:'#CDBB84'};
const R=Math.round;
function put(x,y,z,c){x=R(x);y=R(y);z=R(z);if(x<10||x>245||z<10||z>245||y<4||y>245)return;block(x,y,z,c);}
function disc(cx,cz,y0,y1,r0,r1,col){const m=Math.ceil(r1);for(let y=y0;y<=y1;y++)for(let dx=-m;dx<=m;dx++)for(let dz=-m;dz<=m;dz++){const d=Math.sqrt(dx*dx+dz*dz);if(d<=r1&&d>r0)put(cx+dx,y,cz+dz,typeof col==='function'?col(dx,y,dz,d):col);}}
function lathe(cx,cz,y0,y1,rf,t,fl,col){for(let y=y0;y<=y1;y++){const ro=rf(y),ri=y<y0+fl?-1:ro-t,m=Math.ceil(ro);for(let dx=-m;dx<=m;dx++)for(let dz=-m;dz<=m;dz++){const d=Math.sqrt(dx*dx+dz*dz);if(d<=ro&&d>ri)put(cx+dx,y,cz+dz,typeof col==='function'?col(dx,y,dz,d,ro):col);}}}

// plank deck with a tiled plant stage
const DX0=24,DX1=226,DZ0=40,DZ1=214,DR=36;
function inDeck(x,z){if(x<DX0||x>DX1||z<DZ0||z>DZ1)return false;const qx=Math.min(Math.max(x,DX0+DR),DX1-DR),qz=Math.min(Math.max(z,DZ0+DR),DZ1-DR);return (x-qx)*(x-qx)+(z-qz)*(z-qz)<=DR*DR;}
for(let x=DX0;x<=DX1;x++)for(let z=DZ0;z<=DZ1;z++){
  if(!inDeck(x,z))continue;
  const edge=!inDeck(x-1,z)||!inDeck(x+1,z)||!inDeck(x,z-1)||!inDeck(x,z+1);
  const inner=inDeck(x-3,z-3)&&inDeck(x+3,z+3)&&inDeck(x-3,z+3)&&inDeck(x+3,z-3);
  const p=Math.floor((x-DX0)/7),base=[C.woodL,C.deckA,C.deckB][p%3];
  for(let y=inner?7:4;y<=8;y++){let c=edge?C.woodD:(y<=5?C.woodD:base);if(y===8&&!edge&&(((x-DX0)%7===6)||(((z+p*29)%48)===0)))c=C.woodD;put(x,y,z,c);}
}
const PX=118,PZ=92;
for(let x=PX-31;x<=PX+31;x++)for(let z=PZ-31;z<=PZ+31;z++){const dx=x-PX,dz=z-PZ,d=Math.sqrt(dx*dx+dz*dz);if(d>30.5)continue;const g=((dx+300)%6===0)||((dz+300)%6===0);put(x,9,z,d>29.2?C.woodD:(g?C.celadonD:(((Math.floor((dx+300)/6)+Math.floor((dz+300)/6))%2)?C.ivory:C.ivoryS)));}

// planter, moss pole, trellis
const py0=10;
lathe(PX,PZ,py0,py0+26,(y)=>{const k=y-py0;return k<=1?14:(k>=25?21.8:16+k*0.19);},2,2,(dx,y,dz,d,ro)=>{const k=y-py0;if(k<=1||k>=25)return C.ivoryS;if(k===24)return C.copper;if(k>=15&&k<=19)return C.celadon;if(k===20)return C.gold;return C.ivory;});
disc(PX,PZ,py0+22,py0+23,-1,18.8,(dx,y,dz)=>((dx*7+dz*3+100)%9===0)?C.soilL:C.soil);
for(let y=33;y<=146;y++)for(let dx=-4;dx<=4;dx++)for(let dz=-4;dz<=4;dz++){const d=Math.sqrt(dx*dx+dz*dz);if(d>4.2)continue;const a=Math.atan2(dz,dx);put(PX+dx,y,PZ+dz,(d<3.2||Math.floor(a*3+y*0.45+30)%3===0)?C.root:C.moss);}
disc(PX,PZ,147,147,-1,4.4,C.copper);
for(const y of [60,96,132])ring(PX,y,PZ+2.5,7.5,0.6,C.copper,'y');
const TZ=62;
box(96,9,TZ-1,99,160,TZ+1,C.wood);box(137,9,TZ-1,140,160,TZ+1,C.wood);
box(92,9,TZ-9,103,11,TZ+9,C.woodD);box(133,9,TZ-9,144,11,TZ+9,C.woodD);
for(const y of [30,50,70,90,110,130,150])box(100,y,TZ-1,136,y+1,TZ+1,C.woodL);
{let p=null;for(let i=0;i<=16;i++){const a=Math.PI*i/16,q=[118-20.5*Math.cos(a),160+12*Math.sin(a),TZ];if(p)beam(p[0],p[1],p[2],q[0],q[1],q[2],1.5,C.wood);p=q;}}
for(const [y0,y1] of [[31,50],[71,90],[111,130]]){line(100,y0+1,TZ,136,y1-1,TZ,C.woodL);line(136,y0+1,TZ,100,y1-1,TZ,C.woodL);}
for(const [x,y] of [[112,50],[124,90],[132,110],[106,130]])ring(x,y+0.5,TZ,2.6,0.6,C.copper,'x');
line(PX,90,PZ-5,PX,90,TZ+2,C.copper);line(PX,130,PZ-5,PX,130,TZ+2,C.copper);

// monstera: climbing stem, fenestrated leaves, aerial roots, spathe
function stemP(y){return [PX+1.5*Math.sin(y/9),y,PZ+6];}
for(let y=33;y<150;y+=2){const a=stemP(y),b=stemP(y+2);beam(a[0],a[1],a[2],b[0],b[1],b[2],2.4,C.leafD);}
function leafShape(s,tt,L,Wd,sp){
  const s0=0.42*L,a=0.58*L,e=(s-s0)/a;if(e<-1||e>1)return 0;
  const w=Wd*Math.sqrt(1-e*e)*(1-0.28*Math.max(0,e)),at=Math.abs(tt);if(at>w)return 0;
  if(s<0.07*L&&at<(0.07*L-s)*1.1)return 0;
  if(at<0.85&&s>-0.02*L&&s<0.94*L)return 2;
  if(sp>0&&s>0.1*L&&s<0.9*L){const q=(s-at*0.55)/(L/7.5),f=q-Math.floor(q);
    if(at>w*(1-0.5*sp)&&f>0.36&&f<0.64)return 0;
    if(sp>0.5&&at>w*0.17&&at<w*0.36&&f>0.3&&f<0.7)return 0;
    if(f<0.07||f>0.93)return 2;}
  return 1;
}
function leaf(B,phi,L,Wd,beta,sp,tint,gam){
  const o=[Math.cos(phi),0,Math.sin(phi)],t=[-Math.sin(phi),0,Math.cos(phi)],cb=Math.cos(beta),sb=Math.sin(beta);
  const D=[o[0]*cb,-sb,o[2]*cb],N=[o[0]*sb,cb,o[2]*sb],cg=Math.cos(gam),sg=Math.sin(gam),T=[t[0]*cg+N[0]*sg,N[1]*sg,t[2]*cg+N[2]*sg];
  const pal=[[C.leafD,C.leaf,C.under],[C.leaf,C.leafL,C.leafD],[C.leafL,C.leafY,C.leaf]][tint],pts=[];
  for(let s=-0.16*L;s<=L;s+=0.45)for(let tt=-Wd;tt<=Wd;tt+=0.45){const r=leafShape(s,tt,L,Wd,sp);if(!r)continue;const dr=0.24*s*s/L,cup=0.13*tt*tt/Wd;pts.push([B[0]+D[0]*s+T[0]*tt+N[0]*cup,B[1]+D[1]*s+T[1]*tt+N[1]*cup-dr,B[2]+D[2]*s+T[2]*tt+N[2]*cup,r]);}
  for(const p of pts)put(p[0]-N[0]*0.8,p[1]-N[1]*0.8,p[2]-N[2]*0.8,pal[2]);
  for(const p of pts)put(p[0],p[1],p[2],p[3]===2?pal[1]:pal[0]);
}
function petiole(Nd,B,r0,r1,col){const C1=[Nd[0]+(B[0]-Nd[0])*0.15,Nd[1]+(B[1]-Nd[1])*0.9+3,Nd[2]+(B[2]-Nd[2])*0.15];let p=Nd;for(let i=1;i<=12;i++){const t=i/12,a=(1-t)*(1-t),b=2*(1-t)*t,c=t*t,q=[a*Nd[0]+b*C1[0]+c*B[0],a*Nd[1]+b*C1[1]+c*B[1],a*Nd[2]+b*C1[2]+c*B[2]];beam(p[0],p[1],p[2],q[0],q[1],q[2],r0+(r1-r0)*t,col);p=q;}}
const LV=[[46,200,30,42,19,22,1.0,0,0.12],[58,15,32,44,20,20,1.0,0,-0.1],[72,140,30,40,18,18,0.9,0,0.15],[86,-20,28,38,17,18,0.9,1,-0.12],[100,85,26,36,16,15,0.8,1,0.08],[114,175,24,32,14.5,14,0.6,1,-0.1],[128,40,20,27,12,12,0.3,2,0.1],[140,115,16,21,9.5,10,0,2,-0.08]];
for(const l of LV){const Nd=stemP(l[0]),ph=l[1]*Math.PI/180,o=[Math.cos(ph),0,Math.sin(ph)],Lp=l[2],B=[Nd[0]+o[0]*Lp*0.75,Nd[1]+Lp*0.45,Nd[2]+o[2]*Lp*0.75];ellipsoid(Nd[0],Nd[1],Nd[2],3.2,1.8,3.2,C.root);petiole(Nd,B,1.4,1.0,C.leaf);leaf(B,ph,l[3],l[4],l[5]*Math.PI/180,l[6],l[7],l[8]);}
ellipsoid(PX+1,148,PZ+6,2.8,2,2.8,C.root);
beam(PX+1,148,PZ+6,PX+2,158,PZ+7,2.2,C.leafY);beam(PX+2,158,PZ+7,PX+2.5,165,PZ+7.5,1.1,C.leafY);line(PX-0.5,150,PZ+8,PX+2.5,160,PZ+9,C.leafL);
{const Nd=stemP(93),o=[0.5,0,0.866],Q=[Nd[0]+o[0]*8,Nd[1]+6,Nd[2]+o[2]*8];beam(Nd[0],Nd[1],Nd[2],Q[0],Q[1],Q[2],1.2,C.leafD);
 const a=[0.249,0.867,0.431],e1=[-0.866,0,0.5],e2=[0.4335,-0.4975,0.751];
 for(let s=0;s<=12;s+=0.4)for(let ps=0;ps<6.283;ps+=0.25){const r=2.2,q=[Q[0]+a[0]*s+(e1[0]*Math.sin(ps)+e2[0]*Math.cos(ps))*r,Q[1]+a[1]*s+(e1[1]*Math.sin(ps)+e2[1]*Math.cos(ps))*r,Q[2]+a[2]*s+(e1[2]*Math.sin(ps)+e2[2]*Math.cos(ps))*r];put(q[0],q[1],q[2],(Math.floor(s/1.4)+Math.floor(ps*1.3))%2?C.spadix:C.spadixD);}
 beam(Q[0],Q[1],Q[2],Q[0]+a[0]*12,Q[1]+a[1]*12,Q[2]+a[2]*12,1.4,C.spadixD);
 for(let s=-1;s<=15;s+=0.4)for(let ps=0;ps<6.283;ps+=0.12){if(Math.cos(ps)>0.3)continue;const r=4.4*Math.pow(Math.max(0.05,Math.sin(Math.PI*(s+1.5)/17.5)),0.6),sh=s>11?(s-11)*0.7:0;for(const [rr,col] of [[r-0.8,C.ivoryS],[r,C.ivory]])put(Q[0]+a[0]*s+(e1[0]*Math.sin(ps)+e2[0]*Math.cos(ps))*rr+e2[0]*sh,Q[1]+a[1]*s+(e1[1]*Math.sin(ps)+e2[1]*Math.cos(ps))*rr+e2[1]*sh,Q[2]+a[2]*s+(e1[2]*Math.sin(ps)+e2[2]*Math.cos(ps))*rr+e2[2]*sh,col);}}
function rootPath(pts){for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1],tip=i>=pts.length-2;beam(a[0],a[1],a[2],b[0],b[1],b[2],tip?0.7:0.95,tip?C.rootTip:C.root);}}
function wrapRung(x0,y0,turns,xs){const pts=[];for(let i=0;i<=turns*10;i++){const a=i/10*2*Math.PI;pts.push([x0+i*xs*0.1,y0+0.5+2.5*Math.sin(a),TZ+2.5*Math.cos(a)]);}return pts;}
rootPath([stemP(52),[119,46,102],[121,40,104],[122,33,104]]);
{const w=wrapRung(109,50,1.2,1.5),l=w[w.length-1];rootPath([stemP(66),[110,62,94],[108,58,84],[109,54,70],[109,53,TZ+2.5]].concat(w).concat([[l[0]+1,l[1]-5,TZ+2],[l[0]+1.5,l[1]-11,TZ+2]]));}
rootPath([stemP(80),[112,76,104],[104,66,110],[100,50,114],[99,34,115],[98,20,116],[98,10,117],[94,9,120],[90,9,121]]);
{const w=wrapRung(127,90,1.3,-1.5),l=w[w.length-1];rootPath([stemP(94),[126,90,94],[128,90,80],[127,92,68],[127,93,TZ+2.5]].concat(w).concat([[l[0],l[1]-6,TZ+2],[l[0]-0.5,l[1]-12,TZ+2]]));}
rootPath([stemP(108),[110,104,100],[104,96,104],[102,84,105],[102,72,104],[103,64,103]]);
{const w=wrapRung(132,110,1,1.5),l=w[w.length-1];rootPath([stemP(122),[126,118,94],[132,114,82],[132,111,68],[132,113,TZ+2.5]].concat(w).concat([[l[0],l[1]-5,TZ+2],[l[0]+0.5,l[1]-10,TZ+2]]));}
rootPath([stemP(136),[114,130,96],[113.5,120,94],[113.5,110,93],[113.8,104,93]]);

// standing tool rack
box(28,9,117,30,98,119,C.wood);box(58,9,117,60,98,119,C.wood);
box(26,9,108,32,11,128,C.woodD);box(56,9,108,62,11,128,C.woodD);
for(const y of [40,70,94])box(31,y,117,57,y+1,119,C.woodL);
box(26,99,113,62,100,123,C.woodL);
for(const x of [32,44,54])lathe(x,118,101,105,(y)=>2.6+(y-101)*0.35,0.9,1,(dx,y)=>y===104?C.celadon:C.ivory);
box(34,92,120,34,95,120,C.copper);line(34,92,121,34,17,121,C.woodL);box(28,14,120,40,16,122,C.copper);for(let x=28;x<=40;x+=2)box(x,10,121,x,13,121,C.copper);
box(45,69,120,45,71,120,C.copper);box(45,60,121,46,68,122,C.wood);box(45,58,121,46,59,122,C.gold);for(let k=0;k<3;k++)line(44.5+k,57,121.5,44+k*1.5,50,121.5,C.copper);
box(53,69,120,53,71,120,C.copper);line(53,62,121,52,69,121,C.copper);line(53,62,121,54,69,121,C.copper);put(53,62,121,C.gold);beam(53,61,121,50,53,121,0.8,C.celadonD);beam(53,61,121,56,53,121,0.8,C.celadonD);
line(40,41,120,40,41,124,C.copper);for(let z=121;z<=124;z++)for(let dx=-4;dx<=4;dx++)for(let dy=-4;dy<=4;dy++){const d=Math.sqrt(dx*dx+dy*dy);if(z===121||z===124){if(d<=3.9&&d>1)put(40+dx,41+dy,z,C.wood);}else if(d<=3.1&&d>1)put(40+dx,41+dy,z,C.ivoryS);}

// low-legged care table with seedling tray and young monstera
const TX0=156,TX1=208,TZ0=135,TZ1=165;
for(let z=TZ0;z<=TZ1;z+=4)box(TX0,28,z,TX1,29,Math.min(z+2,TZ1),C.woodL);
box(TX0,26,TZ0,TX1,27,TZ0+1,C.wood);box(TX0,26,TZ1-1,TX1,27,TZ1,C.wood);box(TX0,26,TZ0,TX0+1,27,TZ1,C.wood);box(TX1-1,26,TZ0,TX1,27,TZ1,C.wood);
for(const [lx,lz,fx,fz] of [[TX0+3,TZ0+3,TX0+1,TZ0+1],[TX1-3,TZ0+3,TX1-1,TZ0+1],[TX0+3,TZ1-3,TX0+1,TZ1-1],[TX1-3,TZ1-3,TX1-1,TZ1-1]])beam(lx,26,lz,fx,9.5,fz,1.7,C.woodD);
box(TX0+3,14,TZ0+3,TX1-3,14,TZ0+4,C.wood);box(TX0+3,14,TZ1-4,TX1-3,14,TZ1-3,C.wood);
for(let x=TX0+4;x<=TX1-4;x+=4)box(x,15,TZ0+3,x+2,15,TZ1-3,C.woodL);
for(let k=0;k<2;k++)lathe(168,150,16+k*3,22+k*3,(y)=>5+(y-16-k*3)*0.3,1,k===0?1:0,(dx,y)=>y===22+k*3?C.celadon:C.ivory);
ellipsoid(194,20,150,7,4.5,8,C.ivoryS);ring(194,24,150,3,0.8,C.copper,'y');ellipsoid(194,25.5,150,2.5,1.5,2.5,C.ivoryS);
box(161,30,141,181,30,156,C.celadonD);
for(let i=0;i<=4;i++)box(161+5*i,31,141,161+5*i,34,156,C.celadon);
for(let j=0;j<=3;j++)box(161,31,141+5*j,181,34,141+5*j,C.celadon);
for(let i=0;i<4;i++)for(let j=0;j<3;j++){box(162+5*i,31,142+5*j,165+5*i,33,145+5*j,C.soil);if(i===3&&j===0)continue;const cx=163+5*i,cz=143+5*j,h=2+((i+2*j)%4);line(cx,34,cz,cx,33+h,cz,C.leaf);if((i+j)%2){put(cx-1,34+h,cz,C.leafL);put(cx+1,34+h,cz,C.leafL);put(cx-2,34+h,cz,C.leafY);put(cx+2,34+h,cz,C.leafY);}else{box(cx-1,34+h,cz-1,cx+1,34+h,cz+1,C.leafL);put(cx,35+h,cz,C.leafY);put(cx,34+h,cz+2,C.leaf);}}
lathe(198,150,30,40,(y)=>6+(y-30)*0.12,1.3,2,(dx,y)=>(y===35||y===36)?C.celadon:(y===40?C.copper:C.ivory));
disc(198,150,38,38,-1,5.6,C.soil);
line(199,38,147,199,57,147,C.woodL);ring(199,49,148.5,1.7,0.5,C.copper,'y');
beam(198,38,150,198.5,47,150.5,1.1,C.leafD);
for(const j of [[42,30,9,12,6,0.1],[44,150,8,11,5.5,-0.1],[46,260,10,13,6.3,0.08],[45,335,8,10,5,-0.06]]){const Nd=[198.3,j[0],150.3],ph=j[1]*Math.PI/180,o=[Math.cos(ph),0,Math.sin(ph)],B=[Nd[0]+o[0]*j[2]*0.75,Nd[1]+j[2]*0.45,Nd[2]+o[2]*j[2]*0.75];petiole(Nd,B,0.9,0.7,C.leaf);leaf(B,ph,j[3],j[4],0.3,0,2,j[5]);}
beam(197,41,151,195,36,153,0.6,C.root);

// ceramic watering can
const WX=68,WZ=176,wy=9;
lathe(WX,WZ,wy,wy+20,(y)=>{const k=y-wy;return k<=16?11+2.2*Math.sin(Math.PI*k/16):11-(k-16)*1.6;},1.6,2,(dx,y)=>{const k=y-wy;if(k===9)return C.gold;return k>=10?C.celadon:C.ivory;});
ring(WX,wy+21,WZ,4.2,0.7,C.copper,'y');
beam(WX+10,wy+5,WZ,WX+18,wy+14,WZ,2.1,C.ivory);beam(WX+18,wy+14,WZ,WX+25,wy+22,WZ,1.6,C.celadon);
{const E=[WX+25,wy+22,WZ],d=[0.66,0.75,0],e1=[-0.75,0.66,0];beam(E[0],E[1],E[2],E[0]+d[0]*2,E[1]+d[1]*2,E[2],2.4,C.copper);const F=[E[0]+d[0]*2.6,E[1]+d[1]*2.6,E[2]];for(let u=-3.6;u<=3.6;u+=0.5)for(let v=-3.6;v<=3.6;v+=0.5){if(u*u+v*v>13)continue;put(F[0]+e1[0]*u,F[1]+e1[1]*u,F[2]+v,C.copper);put(F[0]+e1[0]*u+d[0]*0.8,F[1]+e1[1]*u+d[1]*0.8,F[2]+v,((R(u)+R(v))%2===0)?C.gold:C.copper);}}
{const A=[WX-9,wy+15,WZ],Bc=[WX-4,wy+34,WZ],E=[WX+3,wy+20,WZ];let p=A;for(let i=1;i<=12;i++){const t=i/12,a=(1-t)*(1-t),b=2*(1-t)*t,c=t*t,q=[a*A[0]+b*Bc[0]+c*E[0],a*A[1]+b*Bc[1]+c*E[1],WZ];beam(p[0],p[1],p[2],q[0],q[1],q[2],1.5,C.ivory);p=q;}}

// soil crate with a handled trowel
box(106,9,176,138,17,196,C.woodD);
for(let x=107;x<=137;x+=5)box(x,10,197,x+2,16,197,C.woodL);
{const T0=[122,14,190],d=[0.465,0.814,-0.349],w=[0.6,0,0.8],n=[-0.651,0.581,0.488],P=(s)=>[T0[0]+d[0]*s,T0[1]+d[1]*s,T0[2]+d[2]*s];
 for(let s=0;s<=13;s+=0.4)for(let u=-3.6;u<=3.6;u+=0.4){const hw=3.6*Math.min(1,s/5)*(1-0.12*s/13);if(Math.abs(u)>hw)continue;const c=0.1*u*u,px=T0[0]+d[0]*s+w[0]*u+n[0]*c,py=T0[1]+d[1]*s+w[1]*u+n[1]*c,pz=T0[2]+d[2]*s+w[2]*u+n[2]*c;put(px,py,pz,C.copper);put(px-n[0]*0.7,py-n[1]*0.7,pz-n[2]*0.7,Math.abs(u)>hw-0.8?C.gold:C.copper);}
 const a=P(13),b=P(16.5),c2=P(18),e=P(29),f=P(30.5);beam(a[0],a[1],a[2],b[0],b[1],b[2],0.8,C.copper);beam(b[0],b[1],b[2],c2[0],c2[1],c2[2],1.7,C.gold);beam(c2[0],c2[1],c2[2],e[0],e[1],e[2],1.8,C.wood);beam(e[0],e[1],e[2],f[0],f[1],f[2],1.5,C.celadonD);}
for(let x=107;x<=137;x++)for(let z=177;z<=195;z++){const u=(x-122)/15.5,v=(z-186)/9.5,top=15+R(Math.max(0,3.2*(1-u*u-v*v)));for(let y=10;y<=top;y++)put(x,y,z,(y===top&&((x*5+z*3)%7===0))?C.soilL:C.soil);}
for(let k=0;k<3;k++)lathe(148,190,9+k*3,15+k*3,(y)=>4.5+(y-9-k*3)*0.3,1,k===0?1:0,(dx,y)=>y===15+k*3?C.celadon:C.ivory);

// potting sack and spare pots
lathe(200,84,9,29,(y)=>{const k=y-9;return k<=14?9+1.6*Math.sin(Math.PI*k/14):(k<=18?9-(k-14)*1.6:3.2+(k-18)*0.6);},1.5,2,(dx,y,dz)=>{const k=y-9;if(k===16)return C.copper;if(k>=19)return C.ivoryS;return (Math.floor(Math.atan2(dz,dx)*4+10)%5===0)?C.woodL:C.ivoryS;});
for(let k=0;k<3;k++)lathe(214,110,9+k*3,15+k*3,(y)=>4.5+(y-9-k*3)*0.3,1,k===0?1:0,(dx,y)=>y===15+k*3?C.celadonD:C.ivory);

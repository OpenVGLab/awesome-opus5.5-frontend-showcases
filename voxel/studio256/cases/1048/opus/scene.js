const R=Math.round,S3=Math.sqrt(3);
function B(x0,y0,z0,x1,y1,z1,c){box(R(x0),R(y0),R(z0),R(x1),R(y1),R(z1),c);}
function P(x,y,z,c){block(R(x),R(y),R(z),c);}
function cylY(y0,y1,cx,cz,r,c,ri){const n=Math.ceil(r);for(let a=-n;a<=n;a++)for(let b=-n;b<=n;b++){const d=a*a+b*b;if(d<=r*r&&(ri===undefined||d>ri*ri))B(cx+a,y0,cz+b,cx+a,y1,cz+b,c);}}
function cylX(x0,x1,cy,cz,r,c,ri){const n=Math.ceil(r);for(let a=-n;a<=n;a++)for(let b=-n;b<=n;b++){const d=a*a+b*b;if(d<=r*r&&(ri===undefined||d>ri*ri))B(x0,cy+a,cz+b,x1,cy+a,cz+b,c);}}
function hexPrismZ(cx,cy,z0,z1,s,c){const n=Math.ceil(s);for(let a=-n;a<=n;a++)for(let b=-n;b<=n;b++){const ax=Math.abs(a),ay=Math.abs(b);if(ax<=s*S3/2&&S3*ay+ax<=S3*s)B(cx+a,cy+b,z0,cx+a,cy+b,z1,c);}}
function hexPrismY(cx,y0,y1,cz,s,c){const n=Math.ceil(s);for(let a=-n;a<=n;a++)for(let b=-n;b<=n;b++){const ax=Math.abs(a),az=Math.abs(b);if(az<=s*S3/2&&S3*ax+az<=S3*s)B(cx+a,y0,cz+b,cx+a,y1,cz+b,c);}}
function hexRound(q,r){let rq=Math.round(q),rr=Math.round(r);const rs=Math.round(-q-r);const dq=Math.abs(rq-q),dr=Math.abs(rr-r),ds=Math.abs(rs+q+r);if(dq>dr&&dq>ds)rq=-rr-rs;else if(dr>ds)rr=-rq-rs;return [rq,rr];}
function hexFlat(x,z,s){const h=hexRound((2/3*x)/s,(-x/3+S3/3*z)/s);const hx=s*1.5*h[0],hz=s*S3*(h[1]+h[0]/2);const ax=Math.abs(x-hx),az=Math.abs(z-hz);return [h[0],h[1],Math.max(az/(s*S3/2),(S3*ax+az)/(S3*s))];}
function hexPointy(x,y,s){const h=hexRound((S3/3*x-y/3)/s,(2/3*y)/s);const hx=s*S3*(h[0]+h[1]/2),hy=s*1.5*h[1];const ax=Math.abs(x-hx),ay=Math.abs(y-hy);return [h[0],h[1],Math.max(ax/(s*S3/2),(S3*ay+ax)/(S3*s))];}
const K={wood:'#B37B4B',woodL:'#D2A474',woodD:'#8A5935',woodX:'#65402A',
char:'#3B3B40',charD:'#28282C',charL:'#5A5A61',charM:'#78787F',
brass:'#C9A45F',brassD:'#9F7E41',brassL:'#E8CF95',amber:'#E7A03A',amberL:'#F7CA68',glass:'#243238',lens:'#8CC0C8'};

// honeycomb-tiled deck
function ins(z,z0,z1,r){let d=0;if(z<z0+r)d=z0+r-z;else if(z>z1-r)d=z-(z1-r);return d>0?r-Math.floor(Math.sqrt(r*r-d*d)):0;}
for(let z=34;z<=200;z++){const i=ins(z,34,200,14),x0=26+i,x1=230-i;B(x0,4,z,x1,6,z,K.charD);B(x0,7,z,x1,7,z,K.brassD);
 if(z>34&&z<200){const j=ins(z,35,199,13);for(let x=27+j;x<=229-j;x++){const h=hexFlat(x-128,z-117,9);let c;
  if(h[2]>0.86)c=K.char;else{const m=((h[0]-h[1])%3+3)%3;c=m===0?K.wood:(m===1?K.woodL:K.woodD);}P(x,8,z,c);}}}

// pod awaiting assembly, lying on its cradle
const AY=46,AZ=76;
function podR(x){if(x<38)return 0;if(x<=47)return 12-(x-38)*5/9;if(x<=61)return 14+(x-48)*8/13;if(x<=123)return 22;if(x<=146){const u=(x-124)/23;return 22*Math.sqrt(Math.max(0,1-u*u));}return 3;}
for(let x=38;x<=148;x++){const r=podR(x);const t=(x<=47)?1.6:((x>=138)?r:3.2);const n=Math.ceil(r);
 for(let a=-n;a<=n;a++)for(let b=-n;b<=n;b++){const d=Math.sqrt(a*a+b*b);if(d>r||d<=r-t)continue;
  const y=AY+a,z=AZ+b;if(x>=74&&x<=113&&z>88)continue;let c;
  if(x<=47)c=(x<=39)?K.brassD:K.charL;
  else if(x>=147)c=K.brassL;
  else if(x<=61)c=((x-48)%4<2)?K.char:K.charL;
  else if(x>=124)c=(x>=141)?K.brassD:K.brass;
  else{const ang=Math.atan2(a,b);c=((x-62)%12<2)?K.char:(Math.abs(Math.sin(ang*4))<0.12?K.brassD:K.brass);}
  if(x>=73&&x<=114&&z>=87&&(x===73||x===114||z<=88))c=K.brassL;
  P(x,y,z,c);}}
cylX(47,47,AY,AZ,5,K.charD);
cylX(48,49,AY,AZ,14,K.char);
for(let x=74;x<=113;x++)for(let y=AY-16;y<=AY+16;y++){const dy=y-AY;if(dy*dy+144>380)continue;
 const h=hexPointy(x-94,dy,4.6);const f=((h[0]*5+h[1]*11)%7+7)%7;
 B(x,y,83,x,y,85,K.charD);
 if(h[2]>0.64){B(x,y,86,x,y,88,K.woodL);P(x,y,86,K.woodD);}
 else if(f!==0&&f!==4){B(x,y,86,x,y,87,K.amber);if(h[2]<0.22)P(x,y,87,K.brassL);}}
for(const sx of [70,112]){B(sx-2,9,58,sx+7,11,94,K.charD);
 for(let z=60;z<=92;z++){const dz=z-AZ;const yt=R(AY-Math.sqrt(Math.max(0,484-dz*dz)))-1;B(sx,12,z,sx+5,yt,z,K.char);P(sx,yt,z,K.brassD);P(sx+5,yt,z,K.brassD);}}
B(76,12,73,111,15,79,K.charL);
for(let k=0;k<2;k++){const yb=9+k*2;for(let x=32;x<=52;x++)for(let z=102;z<=122;z++){const dz=z-112;const y=yb+R(dz*dz/40);const c=((x-32)%10<2)?K.char:K.brass;P(x,y,z,c);P(x,y+1,z,c);}}

// standing tool cabinet
B(172,9,46,214,13,72,K.charD);
B(172,14,46,174,90,72,K.char);B(212,14,46,214,90,72,K.char);
B(175,14,46,211,90,48,K.woodD);
B(175,14,49,211,50,69,K.woodX);
for(let i=0;i<4;i++){const y0=15+i*9;B(175,y0,70,211,y0+7,72,K.wood);B(176,y0+1,72,210,y0+6,72,K.woodL);B(177,y0+2,72,209,y0+5,72,K.wood);B(189,y0+3,73,197,y0+4,73,K.brass);}
B(170,51,46,216,53,75,K.woodL);B(170,51,75,216,51,75,K.brassD);
B(193,54,49,194,90,71,K.char);
B(175,66,49,192,67,71,K.wood);B(175,78,49,192,79,71,K.wood);
B(195,54,71,211,90,72,K.wood);B(196,55,73,210,89,73,K.woodL);B(197,56,73,209,88,73,K.wood);B(197,70,74,198,74,74,K.brass);
B(172,54,73,173,90,91,K.wood);B(171,55,74,171,89,90,K.woodL);B(171,56,75,171,88,89,K.wood);
B(173,58,72,174,60,72,K.brass);B(173,84,72,174,86,72,K.brass);
for(let k=0;k<4;k++){const z=76+k*4;B(174,60,z,174,70,z,k%2?K.charM:K.brassD);B(174,71,z,174,73,z,K.charD);}
B(174,78,76,174,79,88,K.brassD);
hexPrismY(181,54,61,60,3.2,K.amber);hexPrismY(181,62,62,60,2.4,K.brassL);
B(186,54,56,190,56,66,K.brassD);
cylY(68,72,180,60,2.5,K.lens);cylY(73,73,180,60,2.5,K.brass);cylY(68,71,187,64,2,K.lens);cylY(72,72,187,64,2,K.brass);
ring(183,81,60,4,1.2,K.charL,'y');
B(178,56,49,179,63,49,K.brass);ring(178,65,49,2,0.7,K.brass,'z');
B(170,91,44,216,93,74,K.char);B(172,94,46,214,95,72,K.charL);
for(const p of [[181,60],[191,57],[201,62]]){hexPrismY(p[0],96,104,p[1],3.4,K.amber);hexPrismY(p[0],105,105,p[1],2.6,K.brassL);}
ring(216,70,60,5,1.2,K.charL,'x');B(215,76,60,216,77,60,K.brassD);

// micro honeycomb carrier: chassis, head, legs, arm, carousel rack
const CX=94,CZ=150;
ellipsoid(CX,26,CZ,15,8,22,K.char);
for(let z=131;z<=169;z++){const u=(z-CZ)/22;const xs=15*Math.sqrt(Math.max(0,1-u*u));B(CX-xs,25,z,CX-xs,26,z,K.brassL);B(CX+xs,25,z,CX+xs,26,z,K.brassL);}
P(CX,26,173,K.amberL);P(CX-3,26,172,K.amberL);P(CX+3,26,172,K.amberL);
for(const side of [-1,1])for(const hz of [136,150,164]){
 const u=(hz-CZ)/22,xs=15*Math.sqrt(1-u*u);const hx=R(CX+side*(xs+1));const kx=hx+side*14,fx=hx+side*22;
 const fz=hz+(hz===136?-4:(hz===164?4:0)),kz=R((hz+fz)/2);
 ellipsoid(hx,25,hz,2.5,2.5,2.5,K.brassL);
 beam(hx+side*2,26,hz,kx,38,kz,1.3,K.brass);
 ellipsoid(kx,38,kz,2,2,2,K.charM);
 beam(kx,38,kz,fx,12,fz,1.3,K.charL);
 ellipsoid(fx,10,fz,3,1.8,3,K.charD);}
ellipsoid(CX,27,121,11,8,8,K.char);
ellipsoid(CX-9,29,117,3.5,4.5,3.5,K.glass);ellipsoid(CX+9,29,117,3.5,4.5,3.5,K.glass);
P(CX-10,31,114,K.lens);P(CX+8,31,114,K.lens);
beam(CX-4,21,114,CX-6,17,110,1,K.charM);beam(CX+4,21,114,CX+6,17,110,1,K.charM);
beam(CX-4,34,118,CX-10,48,106,0.8,K.brassD);beam(CX+4,34,118,CX+10,48,106,0.8,K.brassD);
ellipsoid(CX-10,48,106,1.6,1.6,1.6,K.amberL);ellipsoid(CX+10,48,106,1.6,1.6,1.6,K.amberL);
cylY(31,36,CX,134,4,K.charL);
ellipsoid(CX,40,134,3,3,3,K.charM);
beam(CX,40,134,CX,60,122,1.8,K.brass);
beam(CX+3,41,133,CX+3,57,123,0.7,K.brass);
ellipsoid(CX,60,122,2.5,2.5,2.5,K.charM);
beam(CX,60,122,CX,66,106,1.5,K.brass);
ellipsoid(CX,66,105,2,2,2,K.charM);
beam(CX-4,66,104,CX-5,66,97,0.9,K.charL);beam(CX+4,66,104,CX+5,66,97,0.9,K.charL);
hexPrismZ(CX,66,97,102,4.5,K.amber);hexPrismZ(CX,66,96,96,3.5,K.brassL);hexPrismZ(CX,66,103,103,3.5,K.brassL);
cylY(32,34,CX,157,5,K.brassD);
for(let x=CX-17;x<=CX+17;x++)for(let z=140;z<=174;z++){
 const h=hexFlat(x-CX,z-157,6);const q=h[0],r=h[1];if(Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r))>1)continue;
 const top=(q===0&&r===0)?54:50;const empty=(q===0&&r===-1);
 B(x,35,z,x,36,z,K.woodD);
 if(h[2]>0.7){B(x,37,z,x,top-2,z,K.wood);B(x,top-1,z,x,top,z,K.brass);}
 else if(!empty){B(x,37,z,x,top-3,z,K.amber);P(x,top-2,z,K.brassL);}}

// spherical inspection robot on its hover dock
const OX=182,OZ=150,OY=25;
cylY(9,10,OX,OZ,13,K.charD);
ring(OX,17,OZ,11,2,K.brassD,'y');
for(let k=0;k<4;k++){const a=k*Math.PI/2+0.4;B(OX+11*Math.cos(a),11,OZ+11*Math.sin(a),OX+11*Math.cos(a),15,OZ+11*Math.sin(a),K.charD);}
cylY(11,13,OX,OZ,2,K.brassD);
for(let a=-12;a<=12;a++)for(let b=-12;b<=12;b++)for(let c=-12;c<=12;c++){const d2=a*a+b*b+c*c;if(d2>132.25)continue;
 let col=(b>=2)?K.char:(b>=-1?K.brass:K.charL);
 if(d2>90){const dot=(a*(-0.6)+b*0.15+c*(-0.785))/Math.sqrt(d2);if(dot>0.985)col=K.lens;else if(dot>0.95)col=K.glass;else if(dot>0.9)col=K.brassL;}
 P(OX+a,OY+b,OZ+c,col);}
beam(OX,36,OZ,OX+2,43,OZ+1,0.7,K.brass);ellipsoid(OX+2,44,OZ+1,1.5,1.5,1.5,K.amberL);
ellipsoid(OX+12,25,OZ,1.8,1.8,3,K.charM);ellipsoid(OX-12,25,OZ,1.8,1.8,3,K.charM);
for(let i=0;i<=8;i++){const hw=R(6-i*0.55);B(OX+14+i,25,OZ-hw,OX+14+i,26,OZ+hw,K.brassL);B(OX-14-i,25,OZ-hw,OX-14-i,26,OZ+hw,K.brassL);}

// crate of spare honeycomb cells
B(36,9,178,60,10,198,K.woodD);
B(36,11,178,60,20,178,K.wood);B(36,11,198,60,20,198,K.wood);B(36,11,178,36,20,198,K.wood);B(60,11,178,60,20,198,K.wood);
for(const p of [[36,178],[59,178],[36,197],[59,197]])B(p[0],9,p[1],p[0]+1,21,p[1]+1,K.brassD);
for(const p of [[42,184],[49,184],[56,184],[45,190],[52,190],[42,195],[49,195]]){hexPrismY(p[0],11,19,p[1],3,K.amber);hexPrismY(p[0],20,20,p[1],2.2,K.brassL);}

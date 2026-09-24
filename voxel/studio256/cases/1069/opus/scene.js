const C={wood:'#A8703F',woodL:'#C28B56',woodD:'#85552D',woodG:'#976231',end:'#B98049',char:'#3A3A3D',charL:'#4E4E52',charD:'#29292B',felt:'#434549',brass:'#C9A55E',brassL:'#E2C585',brassD:'#9C7B40',bamboo:'#D6BC84',ink:'#1E2124',glass:'#2D363B',paper:'#ECE3CF',graph:'#5C5F64',eraser:'#B98474'};
function B(a,b,c,d,e,f,col){box(Math.round(a),Math.round(b),Math.round(c),Math.round(d),Math.round(e),Math.round(f),col);}
function discX(x0,x1,cy,cz,r,col){const R=Math.ceil(r);for(let dy=-R;dy<=R;dy++)for(let dz=-R;dz<=R;dz++)if(dy*dy+dz*dz<=r*r+0.3)B(x0,cy+dy,cz+dz,x1,cy+dy,cz+dz,col);}
function discZ(z0,z1,cx,cy,r,col){const R=Math.ceil(r);for(let dx=-R;dx<=R;dx++)for(let dy=-R;dy<=R;dy++)if(dx*dx+dy*dy<=r*r+0.3)B(cx+dx,cy+dy,z0,cx+dx,cy+dy,z1,col);}
const X0=48,X1=207;

// small writing implements
function pen(xa,xb,y,z,body){beam(xa+11,y,z,xb-1,y,z,1.5,body);beam(xa+5,y,z,xa+10,y,z,1.15,C.charL);discX(xa+10,xa+11,y,z,1.6,C.brass);beam(xa+1,y,z,xa+5,y,z,0.75,C.brass);block(xa,y,z,C.brassL);discX(xb,xb,y,z,1.3,C.brassD);line(xb-16,y+2,z,xb-3,y+2,z,C.brassL);}
function brush(xa,xb,y,z){beam(xa+14,y,z,xb,y,z,1.4,C.bamboo);for(let x=xa+30;x<xb-4;x+=18)discX(x,x,y,z,1.6,C.woodL);discX(xa+11,xa+14,y,z,1.8,C.brass);beam(xa+4,y,z,xa+10,y,z,1.9,C.ink);beam(xa,y,z,xa+4,y,z,0.8,C.ink);ring(xb+2,y,z,1.4,0.5,C.charD,'z');}
function pencil(xa,xb,y,z,col){beam(xa+3,y,z,xb-6,y,z,1.5,col);beam(xb-6,y,z,xb-2,y,z,0.9,C.woodL);block(xb-1,y,z,C.graph);discX(xa+1,xa+2,y,z,1.6,C.brass);beam(xa-2,y,z,xa,y,z,1.3,C.eraser);}
function ruler(xa,xb,y,z0){B(xa,y,z0,xb,y+1,z0+5,C.woodL);B(xa,y,z0+5,xb,y+1,z0+5,C.brass);for(let x=xa+2;x<=xb-2;x+=4)B(x,y+1,(x-xa)%20===2?z0+2:z0+4,x,y+1,z0+4,C.ink);}
function letterOpener(xa,xb,y,z){B(xa+14,y,z-1,xb-3,y,z+1,C.brass);B(xb-2,y,z,xb,y,z,C.brassL);beam(xa,y+0.5,z,xa+12,y+0.5,z,1.4,C.woodD);discX(xa+13,xa+13,y,z,2,C.brassD);}
function scroll(xa,xb,y,z){beam(xa,y,z,xb,y,z,2.4,C.paper);discX(xa-1,xa-1,y,z,2.8,C.woodD);discX(xb+1,xb+1,y,z,2.8,C.woodD);const m=Math.round((xa+xb)/2);discX(m,m+1,y,z,2.6,C.charD);}
function nibTin(x,y,z){cylinder(x,y,z,5,1,C.brassD);cylinder(x,y+1,z,5,2,C.brass);cylinder(x,y+3,z,2,1,C.brassL);}
function inkBottle(x,y,z){cylinder(x,y,z,3.2,5,C.glass);cylinder(x,y+2,z,3.3,1,C.paper);cylinder(x,y+5,z,1.6,1,C.glass);cylinder(x,y+6,z,2.2,2,C.brass);}
function brushRest(x,y,z){B(x-6,y,z-2,x+6,y,z+2,C.charD);ellipsoid(x-4,y+2,z,2.5,2.5,2,C.char);ellipsoid(x,y+3,z,2.5,3.5,2,C.char);ellipsoid(x+4,y+2,z,2.5,2.5,2,C.char);}
function seal(x,y,z){B(x-2,y,z-2,x+2,y+6,z+2,C.charL);B(x-2,y+7,z-2,x+2,y+8,z+2,C.brass);ellipsoid(x,y+10,z,1.5,1.5,1.5,C.brassL);}
function sharpener(x,y,z){B(x-2,y,z-2,x+2,y+3,z+2,C.brass);discX(x+2,x+2,y+2,z,1,C.ink);}
function feltG(xa,xb,za,zb,yb,yt,cs,gr){for(let z=za;z<=zb;z++){let top=yt;for(const gz of cs){const d=Math.abs(z-gz);if(d<=gr)top=Math.min(top,yt-Math.round(Math.sqrt(gr*gr-d*d)));}B(xa,yb,z,xb,Math.max(yb,top),z,C.felt);}}
function feltW(xa,xb,za,zb,yb,yt,wells){for(let x=xa;x<=xb;x++)for(let z=za;z<=zb;z++){let top=yt;for(const w of wells){if((x-w[0])*(x-w[0])+(z-w[1])*(z-w[1])<=w[2]*w[2])top=yb;}B(x,yb,z,x,top,z,C.felt);}}

// low stepped charcoal stand
for(const fx of [41,124,207])for(const fz of [93,162])B(fx,4,fz,fx+8,5,fz+7,C.charD);
B(40,6,92,216,7,170,C.char);
B(41,8,93,215,8,169,C.char);
B(40,7,170,216,7,170,C.brassD);B(40,7,92,216,7,92,C.brassD);
B(46,9,98,210,11,158,C.charL);
B(47,12,99,209,12,157,C.charL);
function archZ(xc,z0,z1){for(let x=xc-7;x<=xc+7;x++){const u=(x-xc)/7.6;const h=Math.round(2.6*Math.sqrt(Math.max(0,1-u*u)));for(let y=9;y<9+h;y++)for(let z=z0;z<=z1;z++)block(x,y,z,null);}}
function archX(zc,x0,x1){for(let z=zc-7;z<=zc+7;z++){const u=(z-zc)/7.6;const h=Math.round(2.6*Math.sqrt(Math.max(0,1-u*u)));for(let y=9;y<9+h;y++)for(let x=x0;x<=x1;x++)block(x,y,z,null);}}
for(let i=0;i<6;i++){const xc=Math.round(62+26.4*i);archZ(xc,157,158);archZ(xc,98,99);}
for(const zc of [116,140]){archX(zc,46,47);archX(zc,209,210);}

// base chest with drawer bay and open well
B(X0-1,13,101,X1+1,14,154,C.woodD);
B(X0,15,102,X1,48,104,C.wood);
B(X0,15,151,71,48,153,C.wood);B(184,15,151,X1,48,153,C.wood);B(72,26,151,183,48,153,C.wood);
B(X0,15,105,X0+2,48,150,C.wood);B(X1-2,15,105,X1,48,150,C.wood);
B(51,26,105,204,28,150,C.woodD);
B(51,29,105,204,29,150,C.felt);
B(X0,48,102,X1,48,104,C.woodL);B(X0,48,151,X1,48,153,C.woodL);B(X0,48,105,X0+2,48,150,C.woodL);B(X1-2,48,105,X1,48,150,C.woodL);
for(let k=0;k<6;k++){const gy=31+Math.floor(rng()*14);const gx=56+Math.floor(rng()*110);const gl=16+Math.floor(rng()*30);B(gx,gy,153,Math.min(200,gx+gl),gy,153,C.woodG);const hy=31+Math.floor(rng()*14);const hx=56+Math.floor(rng()*110);B(hx,hy,102,Math.min(200,hx+gl),hy,102,C.woodG);}
for(let k=0;k<3;k++){const gy=18+Math.floor(rng()*26);const gz=108+Math.floor(rng()*14);B(X0,gy,gz,X0,gy,gz+14+Math.floor(rng()*14),C.woodG);B(X1,gy,gz,X1,gy,gz+14+Math.floor(rng()*14),C.woodG);}
for(const zf of [154,101]){B(52,29,zf,203,29,zf,C.woodD);B(52,46,zf,203,46,zf,C.woodD);for(const xf of [52,127,128,203])B(xf,29,zf,xf,46,zf,C.woodD);}
B(124,38,155,131,45,155,C.brass);B(127,40,155,128,42,155,C.ink);
for(const cx of [X0,X1])for(const cz of [102,153])for(const [ya,yb] of [[15,20],[42,47]]){
  const zf=cz===102?101:154,xf=cx===X0?X0-1:X1+1;
  const xa=cx===X0?X0-1:X1-4,xb=cx===X0?X0+4:X1+1;
  const za=cz===102?101:149,zb=cz===102?106:154;
  B(xa,ya,zf,xb,yb,zf,C.brass);B(xf,ya,za,xf,yb,zb,C.brass);
}
scroll(70,150,32,121);
pencil(80,170,31,130,C.char);pencil(84,172,31,134,C.woodD);pencil(82,168,34,132,C.charL);
B(124,29,128,126,36,136,C.brass);
brush(60,158,31,141);

// half-open drawer
B(72,15,110,183,16,160,C.woodD);
B(72,17,110,73,25,160,C.wood);B(182,17,110,183,25,160,C.wood);
B(74,17,110,181,25,111,C.wood);
B(74,17,112,181,17,160,C.felt);
B(70,14,161,185,26,163,C.wood);
B(74,16,164,181,24,164,C.woodL);
B(80,21,164,120,21,164,C.woodG);B(138,18,164,176,18,164,C.woodG);
discZ(165,165,128,22,2,C.brassD);
ring(128,19,166,3,0.8,C.brass,'z');
for(const xd of [101,128,155])B(xd,18,112,xd,22,160,C.woodL);
for(let i=0;i<5;i++)B(78+4*i,18,155,79+4*i,18,158,C.brassL);
for(let i=0;i<5;i++)beam(104+4.5*i,18.6,154,104+4.5*i,18.6,159,0.9,C.charD);
beam(135,18,157,147,18,157,0.7,C.brass);ring(132,18.5,157,1.8,0.6,C.brass,'y');
B(160,18,154,177,20,160,C.paper);B(160,19,154,177,19,160,C.charL);

// cantilever trays
function tray(z0,y0){
  const z1=z0+29,y1=y0+14;
  B(X0,y0,z0,X1,y0+2,z1,C.woodD);
  B(X0,y0+3,z0,X1,y1,z0+2,C.wood);B(X0,y0+3,z1-2,X1,y1,z1,C.wood);
  B(X0,y0+3,z0+3,X0+2,y1,z1-3,C.wood);B(X1-2,y0+3,z0+3,X1,y1,z1-3,C.wood);
  B(X0,y1,z0,X1,y1,z0+2,C.woodL);B(X0,y1,z1-2,X1,y1,z1,C.woodL);B(X0,y1,z0,X0+2,y1,z1,C.woodL);B(X1-2,y1,z0,X1,y1,z1,C.woodL);
  B(X0,y0,z0-1,X1,y0,z0-1,C.woodD);B(X0,y0,z1+1,X1,y0,z1+1,C.woodD);
  for(const cx of [X0,X1-2])for(const cz of [z0,z1-2]){for(let y=y0+1;y<y1-3;y+=2){if(((y-y0)>>1)%2===0)B(cx,y,cz,cx+2,y+1,cz+2,C.end);}B(cx,y1-3,cz,cx+2,y1,cz+2,C.brass);}
  B(159,y0+3,z0+3,160,y1-2,z1-3,C.woodL);
  for(let k=0;k<3;k++){const gy=y0+4+Math.floor(rng()*(y1-y0-7));const gx=X0+6+Math.floor(rng()*90);B(gx,gy,z1,Math.min(X1-6,gx+24+Math.floor(rng()*40)),gy,z1,C.woodG);const hy=y0+4+Math.floor(rng()*(y1-y0-7));const hx=X0+6+Math.floor(rng()*90);B(hx,hy,z0,Math.min(X1-6,hx+24+Math.floor(rng()*40)),hy,z0,C.woodG);}
}
tray(62,68);tray(82,51);tray(144,51);tray(164,68);

// upper front tray: fountain pens in grooves
feltG(51,158,167,190,71,74,[172,178,184],2.5);
B(161,71,167,204,74,190,C.felt);
pen(56,150,73,172,C.char);pen(62,146,73,178,C.woodD);pen(58,152,73,184,C.charD);
nibTin(172,75,176);inkBottle(192,75,182);B(184,75,170,188,75,171,C.brassL);
// upper back tray: brushes
feltG(51,158,65,88,71,74,[70,76,82],2.5);
B(161,71,65,204,74,88,C.felt);
brush(54,138,73,70);brush(60,146,73,76);brush(52,134,73,82);
brushRest(176,75,74);seal(196,75,70);B(186,75,80,200,77,84,C.ink);B(192,75,80,193,77,84,C.brass);
// middle front tray: pencils
B(51,54,147,158,56,170,C.felt);B(161,54,147,204,56,170,C.felt);
pencil(56,150,58,151,C.char);pencil(60,140,58,155,C.woodD);pencil(54,132,58,159,C.charL);pencil(58,146,58,163,C.char);pencil(56,120,58,167,C.woodD);
B(166,57,150,174,59,154,C.eraser);sharpener(186,57,160);beam(170,58,165,198,58,165,1.2,C.brass);
// middle back tray: ruler, opener, ink wells
B(51,54,85,158,56,108,C.felt);
ruler(56,154,57,88);letterOpener(60,150,57,101);
feltW(161,204,85,108,54,57,[[172,92,3.8],[190,101,3.8]]);
inkBottle(172,55,92);inkBottle(190,55,101);

// brass parallelogram linkages on both ends
function arm(xm,p,q){beam(xm,p[0],p[1],xm,q[0],q[1],1.1,C.brass);}
const LA=[[[40,136],[57,149]],[[40,148],[57,161]],[[40,119],[57,106]],[[40,107],[57,94]]];
const LC=[[[61,154],[76,167]],[[61,166],[76,179]],[[61,101],[76,88]],[[61,89],[76,76]]];
for(const [xm,xa,xb,xo] of [[46.5,46,47,46],[208.5,208,209,209]]){for(const [p,q] of LA){arm(xm,p,q);for(const s of [p,q]){discX(xa,xb,s[0],s[1],1.3,C.brassL);discX(xo,xo,s[0],s[1],2.1,C.brassD);}}}
for(const [xm,xa,xb,xo] of [[44.5,44,47,44],[210.5,208,211,211]]){for(const [p,q] of LC){arm(xm,p,q);for(const s of [p,q]){discX(xa,xb,s[0],s[1],1.3,C.brassL);discX(xo,xo,s[0],s[1],2.1,C.brassD);}}}

// objects resting on the stand ledge
beam(66,10,166,124,10,166,1.5,C.charD);discX(106,107,10,166,1.7,C.brass);discX(124,124,10,166,1.3,C.brassD);line(108,12,166,121,12,166,C.brassL);block(107,12,166,C.brassL);
beam(60,10,166,66,10,166,0.8,C.brass);block(59,10,166,C.brassL);
cylinder(196,9,164,5,4,C.brass);cylinder(196,13,164,4,1,C.brassD);cylinder(196,14,164,4.2,1,C.brassL);block(196,15,164,C.brassD);

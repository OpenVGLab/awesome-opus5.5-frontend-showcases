const R=Math.round;
function B(x0,y0,z0,x1,y1,z1,c){box(R(x0),R(y0),R(z0),R(x1),R(y1),R(z1),c);}
function P(x,y,z,c){block(R(x),R(y),R(z),c);}
function cylY(y0,y1,cx,cz,r,c,ri){const n=Math.ceil(r);for(let a=-n;a<=n;a++)for(let b=-n;b<=n;b++){const d=a*a+b*b;if(d<=r*r&&(ri===undefined||d>ri*ri))B(cx+a,y0,cz+b,cx+a,y1,cz+b,c);}}
function cylX(x0,x1,cy,cz,r,c,ri){const n=Math.ceil(r);for(let a=-n;a<=n;a++)for(let b=-n;b<=n;b++){const d=a*a+b*b;if(d<=r*r&&(ri===undefined||d>ri*ri))B(x0,cy+a,cz+b,x1,cy+a,cz+b,c);}}
const K={white:'#F2EEE6',whiteD:'#DCD6CB',whiteX:'#C8C1B5',
cel:'#94BFA7',celD:'#6E9E86',celL:'#C3DDCD',celX:'#4F7C66',
red:'#9A4B36',redD:'#733528',redL:'#B96B51',redX:'#55271D',
sand:'#D8C29A',sandD:'#B89C6E',glow:'#E0703A',glowL:'#F2A565',dark:'#3A3431'};
function heap(cx,cz,rx,rz,h,y0,cA,cB){for(let x=R(cx-rx);x<=R(cx+rx);x++)for(let z=R(cz-rz);z<=R(cz+rz);z++){const u=(x-cx)/rx,v=(z-cz)/rz;const q=R(h*Math.max(0,1-u*u-v*v));if(q>0)B(x,y0,z,x,y0+q-1,z,((x*7+z*13)%6===0)?cB:cA);}}

// two connected exhibit zones: pale gallery floor and terracotta workshop floor
function rr(x,z,x0,x1,z0,z1,r){if(x<x0||x>x1||z<z0||z>z1)return false;const cx=Math.min(Math.max(x,x0+r),x1-r),cz=Math.min(Math.max(z,z0+r),z1-r);return (x-cx)*(x-cx)+(z-cz)*(z-cz)<=r*r;}
for(let x=26;x<=230;x++)for(let z=28;z<=222;z++){const a=rr(x,z,26,140,28,150,14),b=rr(x,z,116,230,110,222,14);if(!a&&!b)continue;
 const both=a&&b;B(x,4,z,x,6,z,both?K.celX:(a?K.whiteX:K.redX));P(x,7,z,both?K.celD:(a?K.redL:K.celD));
 const ea=a&&!rr(x,z,27,139,29,149,13),eb=b&&!rr(x,z,117,229,111,221,13);let c;
 if(both)c=((x+z)%8<4)?K.celL:K.cel;
 else if(a)c=ea?K.whiteD:(((x-26)%12===0||(z-28)%12===0)?K.whiteD:K.white);
 else c=eb?K.redD:((((x-116)%10===0)||((z-110)%10===0))?K.redD:(((Math.floor((x-116)/10)+Math.floor((z-110)/10))%2)?K.red:K.redL));
 P(x,8,z,c);}

// display cabinet: six tiers from raw sand up to finished glass
B(32,9,34,98,13,72,K.redD);
B(34,14,36,36,124,70,K.red);B(94,14,36,96,124,70,K.red);
const TI=[14,32,50,68,86,104];
for(let t=0;t<6;t++)B(37,TI[t]+2,36,93,TI[t]+17,38,t%2?K.celL:K.white);
for(const y of [14,32,50,68,86,104,122]){B(34,y,36,96,y+1,70,K.redL);B(34,y,70,96,y+1,70,K.celD);}
B(34,14,70,36,124,70,K.celD);B(94,14,70,96,124,70,K.celD);
B(32,124,34,98,127,72,K.redD);B(40,128,38,90,130,68,K.red);B(50,131,42,80,133,64,K.redL);
cylY(134,135,65,53,3,K.celD);ellipsoid(65,141,53,5,6,5,K.celL);cylY(147,149,65,53,1.2,K.redD);
// tier 1 raw sand
B(42,16,44,88,16,66,K.redD);B(42,17,44,88,17,44,K.redL);B(42,17,66,88,17,66,K.redL);B(42,17,44,42,17,66,K.redL);B(88,17,44,88,17,66,K.redL);
heap(65,55,21,9.5,9,17,K.sand,K.sandD);
beam(79,21,60,89,29,67,0.8,K.redD);B(75,19,57,79,19,61,K.dark);
for(const p of [[47,18,64],[50,18,47],[84,18,47]])ellipsoid(p[0],p[1],p[2],1.6,1,1.2,K.white);
// tier 2 sieving
for(let i=0;i<3;i++){const y=34+i*3,r=11-i*2;cylY(y,y+2,52,54,r,K.cel,r-1.2);
 for(let a=-r;a<=r;a++)for(let b=-r;b<=r;b++){if(a*a+b*b>(r-1.2)*(r-1.2))continue;P(52+a,y+1,54+b,((a+b)&1)?K.white:K.whiteD);}}
ellipsoid(52,43,54,4,1.5,4,K.sand);
heap(70,54,4,5,6,34,K.sandD,K.redL);heap(79,54,4,5,5,34,K.sand,K.sandD);heap(88,54,3.5,5,4,34,K.white,K.whiteD);
// tier 3 batch ingredients in cutaway jars and a mixing bowl
for(const j of [[45,0],[57,1],[69,2]]){const cx=j[0],cz=52;cylY(52,52,cx,cz,5,K.celL);
 for(let a=-5;a<=5;a++)for(let b=-5;b<=2;b++){const d=a*a+b*b;if(d<=25&&d>16)B(cx+a,53,cz+b,cx+a,63,cz+b,K.celL);}
 for(let a=-4;a<=4;a++)for(let b=-4;b<=4;b++){if(a*a+b*b>16)continue;const col=j[1]===0?(((a+b)%3===0)?K.sandD:K.sand):(j[1]===1?K.white:((((a*3+b*5)&3)===0)?K.white:K.whiteD));B(cx+a,53,cz+b,cx+a,60-(j[1]===2?((a*a+b)&1):0),cz+b,col);}}
cylY(52,52,84,56,5,K.cel);cylY(53,56,84,56,6,K.cel,5);
for(let a=-5;a<=5;a++)for(let b=-5;b<=5;b++){if(a*a+b*b>25)continue;B(84+a,53,56+b,84+a,55,56+b,[K.sand,K.white,K.whiteD,K.sandD][(a*a+b*3+40)%4]);}
// tier 4 melting kiln with glowing crucible
B(44,70,42,86,84,64,K.red);
for(let y=70;y<=84;y++){if(y%3===0)B(44,y,64,86,y,64,K.redD);else for(let x=44+((y%6<3)?0:4);x<=86;x+=8)P(x,y,64,K.redD);}
for(let x=56;x<=74;x++)for(let y=70;y<=84;y++){const dx=x-65;if(Math.abs(dx)>9)continue;if(y>73+Math.sqrt(81-dx*dx)*1.0)continue;for(let z=50;z<=64;z++)P(x,y,z,null);}
for(let x=56;x<=74;x++)for(let y=70;y<=84;y++){const dx=x-65;if(Math.abs(dx)<=9&&y<=73+Math.sqrt(81-dx*dx))P(x,y,49,((x+y)%3===0)?K.glowL:K.glow);}
cylY(70,70,65,58,6,K.redX);cylY(71,76,65,58,5,K.redX,3.8);cylY(71,75,65,58,3.8,K.glow);cylY(76,76,65,58,3.6,K.glowL);
for(const f of [[65,77,58],[65,78,58],[65,79,58],[64,77,57],[64,78,57],[66,77,59]])P(f[0],f[1],f[2],K.glowL);
// tier 5 forming: blowpipe with gob, marver, jacks
B(42,88,60,66,89,68,K.white);
B(50,88,55,51,95,57,K.redD);B(72,88,55,73,95,57,K.redD);
cylX(40,79,96,56,0.9,K.dark);ellipsoid(84,96,56,5,5,5,K.cel);ellipsoid(86,97,55,2,2,2,K.celL);
line(68,88,62,80,88,66,K.dark);line(68,88,62,80,88,60,K.dark);B(76,88,44,90,88,48,K.redL);
// tier 6 finished glassware
for(let y=106;y<=120;y++){const t=(y-106)/14;const r=2.5+3.5*Math.sin(Math.PI*(t*0.85+0.1));cylY(y,y,46,54,r,K.cel,Math.max(0,r-1.2));}
cylY(106,114,58,52,4,K.celL,2.8);cone(58,115,52,4,1.5,4,K.celL);cylY(119,121,58,52,1.5,K.celD);
cylY(106,106,70,56,3.5,K.celL);cylY(107,111,70,56,0.8,K.celL);cone(70,112,56,1,4.5,6,K.cel);
cylY(106,110,82,58,3,K.celX,2);cylY(106,106,82,58,2,K.celX);
B(76,106,39,90,120,40,K.celL);B(76,106,39,90,106,40,K.celD);B(76,120,39,90,120,40,K.celD);

// standalone cutaway model of a glass melting furnace
B(102,9,42,134,29,74,K.whiteD);B(102,27,42,134,29,74,K.celD);B(104,9,44,132,11,72,K.whiteX);B(114,15,75,122,22,75,K.celD);
B(104,30,44,132,31,58,K.redX);
for(let x=104;x<=132;x++)for(let y=32;y<=41;y++)for(let z=44;z<=58;z++)P(x,y,z,((x+y+z)&1)?K.red:K.redX);
B(104,42,44,132,43,58,K.redD);
for(let x=104;x<=132;x++){const u=(x-118)/14.5;const h=R(8*Math.sqrt(Math.max(0,1-u*u)));B(x,44,44,x,56+h,45,K.red);B(x,55+h,44,x,57+h,58,K.redL);}
B(104,44,46,105,58,58,K.red);B(131,44,46,132,58,58,K.red);
for(let y=45;y<=58;y+=3){B(104,y,58,105,y,58,K.redD);B(131,y,58,132,y,58,K.redD);}
B(106,44,46,130,49,58,K.glow);B(106,50,46,130,50,58,K.glowL);B(106,51,46,113,51,58,K.sand);
for(const x of [110,118,126]){P(x,53,46,K.dark);P(x,53,47,K.glowL);P(x,53,48,K.glowL);P(x,52,48,K.glow);}
B(124,58,44,130,76,46,K.redD);B(123,77,43,131,78,47,K.red);
for(let x=103;x<=133;x++){P(x,30,59,K.celD);P(x,R(58+8*Math.sqrt(Math.max(0,1-((x-118)/14.5)*((x-118)/14.5))))+1,59,K.celD);}
B(103,30,59,103,59,59,K.celD);B(133,30,59,133,59,59,K.celD);

// layered display rack of stratified sand tubes
B(36,9,128,80,18,140,K.red);B(36,9,114,80,28,127,K.redL);B(36,9,100,80,38,113,K.red);
B(36,39,100,80,52,101,K.white);B(36,53,100,80,54,101,K.celD);
for(let s=0;s<3;s++){const y0=[19,29,39][s],zc=[134,120,106][s];
 for(let i=0;i<6;i++){const cx=40+7*i;let y=y0;cylY(y0,y0,cx,zc,2.8,K.celL);
  for(let k=0;k<5;k++){const hg=1+((i*3+k*5+s*7)%3);cylY(y,y+hg-1,cx,zc,2.2,[K.sand,K.sandD,K.white,K.redL,K.celD][(i+k+s)%5]);y+=hg;}
  cylY(y,y,cx,zc,2.2,K.celL);cylY(y+1,y+2,cx,zc,2.6,K.redD);}}

// observation instrument: microscope on a round table
cylY(9,10,104,112,7,K.redD);cylY(11,29,104,112,2.5,K.red);cylY(30,32,104,112,12,K.white);cylY(30,30,104,112,12,K.redL,11);
B(98,33,108,110,35,120,K.celD);B(102,36,117,106,53,120,K.cel);B(102,54,110,106,57,120,K.cel);
cylY(46,58,104,112,2.2,K.white);beam(104,58,112,104,64,107,1.6,K.dark);cylY(42,45,104,112,1.3,K.dark);
B(99,39,106,109,39,116,K.white);B(102,39,116,106,40,117,K.cel);B(101,40,109,107,40,113,K.celL);
P(103,41,110,K.sand);P(105,41,112,K.sandD);P(106,41,111,K.sand);P(102,41,112,K.sandD);
cylY(36,36,104,112,2,K.celL);cylX(99,101,48,118,2,K.redL);cylX(107,109,48,118,2,K.redL);
cylY(33,33,112,104,3,K.celL);cylY(34,34,112,104,3,K.celL,2.2);P(111,34,104,K.sand);P(113,34,105,K.sandD);P(112,34,103,K.sand);

// hand-crank demonstration stand: rotating sieve drum over graded trays
for(const p of [[150,124],[207,124],[150,155],[207,155]])B(p[0],9,p[1],p[0]+3,29,p[1]+3,K.redD);
B(150,30,124,210,30,158,K.red);B(150,31,124,210,31,158,K.redL);B(152,16,126,208,17,156,K.red);
for(let i=0;i<3;i++){const x0=162+12*i;B(x0,32,132,x0+10,32,150,K.redD);B(x0,33,132,x0+10,34,132,K.red);B(x0,33,150,x0+10,34,150,K.red);B(x0,33,132,x0,34,150,K.red);B(x0+10,33,132,x0+10,34,150,K.red);
 heap(x0+5,141,4.5,8,3,33,[K.sandD,K.sand,K.white][i],[K.redL,K.sandD,K.whiteD][i]);}
const DY=47,DZ=141;
cylX(154,208,DY,DZ,1,K.dark);
for(const rx of [160,172,184,196])ring(rx,DY,DZ,10,1,K.celD,'x');
for(let x=161;x<=195;x++)for(let a=-11;a<=11;a++)for(let b=-11;b<=11;b++){const d=Math.sqrt(a*a+b*b);if(d>10.3||d<9.3)continue;
 if(Math.abs(Math.sin(Math.atan2(b,a)*6))<0.2||(x-161)%4===0)P(x,DY+a,DZ+b,K.white);}
for(let x=162;x<=194;x++)for(let a=-9;a<=-6;a++)for(let b=-9;b<=9;b++){if(a*a+b*b>81)continue;P(x,DY+a,DZ+b,((x+b)%5===0)?K.sandD:K.sand);}
for(const rx of [160,196])for(let k=0;k<4;k++){const t=k*Math.PI/2+0.4;beam(rx,DY,DZ,rx,DY+9.3*Math.cos(t),DZ+9.3*Math.sin(t),0.7,K.dark);}
for(const bx of [156,200]){beam(bx,32,133,bx,46,141,1.2,K.redD);beam(bx,32,149,bx,46,141,1.2,K.redD);B(bx-1,45,139,bx+1,49,143,K.redD);}
B(151,32,140,153,53,142,K.redD);cone(152,54,141,2,6,9,K.redL);cylY(63,63,152,141,5.5,K.sand);beam(152,53,141,161,49,141,1.2,K.redL);
cylX(203,207,DY,DZ,2,K.redD);ring(205,DY,DZ,8,1,K.redL,'x');
for(let k=0;k<6;k++){const t=k*Math.PI/3;beam(205,DY,DZ,205,DY+8*Math.cos(t),DZ+8*Math.sin(t),0.8,K.red);}
beam(206,DY+8,DZ,211,DY+8,DZ,0.9,K.dark);ellipsoid(212,DY+8,DZ,1.6,1.6,1.6,K.redD);

// physical sample tray on a low table
for(const p of [[181,175],[217,175],[181,207],[217,207]])B(p[0],9,p[1],p[0]+2,25,p[1]+2,K.red);
B(180,26,174,220,27,210,K.redL);
B(182,28,176,218,28,208,K.celD);B(182,29,176,218,30,176,K.cel);B(182,29,208,218,30,208,K.cel);B(182,29,176,182,30,208,K.cel);B(218,29,176,218,30,208,K.cel);
B(194,29,177,194,30,207,K.white);B(206,29,177,206,30,207,K.white);B(183,29,192,217,30,192,K.white);
heap(188,184,4.5,6,4,29,K.sandD,K.redL);for(const p of [[186,32,182],[190,31,187],[187,31,188]])P(p[0],p[1],p[2],K.sandD);
heap(200,184,4.5,6,4,29,K.sand,K.whiteD);
for(let k=0;k<14;k++){const x=208+((k*5)%9),z=178+((k*7)%12);B(x,29,z,x,29+(k%2),z,K.white);}
for(const p of [[186,31,197,2.5],[190,31,203,2],[188,32,201,1.8],[191,30.5,196,1.6]])ellipsoid(p[0],p[1],p[2],p[3],p[3]*0.8,p[3]*1.1,(p[3]>2)?K.whiteD:K.white);
for(let k=0;k<8;k++){const x=197+((k*3)%7),z=195+((k*5)%10);ellipsoid(x,30,z,1.3+(k%3)*0.4,0.8,1.1,k%3?K.celL:(k%2?K.cel:K.celX));}
for(const p of [[209,197],[213,196],[211,201],[215,203],[209,205]])ellipsoid(p[0],30.8,p[1],1.8,1.8,1.8,(p[0]+p[1])%2?K.celL:K.cel);
beam(184,28,209,195,28,209,0.7,K.redD);ellipsoid(197.5,28.6,209,2,1,1.4,K.redL);

// detachable ball-and-stick silica lattice model with loose parts
cylY(9,20,146,194,13,K.white);cylY(17,18,146,194,13.3,K.celD,12.5);cylY(21,21,146,194,12,K.celL);
cylY(22,29,146,194,1,K.dark);
const SI=[[146,32,194],[136,44,188],[156,44,188],[146,44,204],[146,56,194]];
const BD=[[0,1],[0,2],[0,3],[4,1],[4,2],[4,3],[1,2]];
for(const bd of BD){const a=SI[bd[0]],b=SI[bd[1]];const mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2,mz=(a[2]+b[2])/2;
 const ox=mx+(mx-146)*0.25,oz=mz+(mz-194)*0.25;
 beam(a[0],a[1],a[2],ox,my,oz,0.7,K.dark);beam(ox,my,oz,b[0],b[1],b[2],0.7,K.dark);ellipsoid(ox,my,oz,2.2,2.2,2.2,K.white);}
for(const s of SI)ellipsoid(s[0],s[1],s[2],3,3,3,K.red);
ellipsoid(138,24,200,3,3,3,K.red);ellipsoid(154,23.3,201,2.2,2.2,2.2,K.white);beam(154,23,201,157,22.5,197,0.7,K.dark);
beam(148,22,184,155,22,188,0.7,K.dark);ellipsoid(140,23.3,186,2.2,2.2,2.2,K.white);

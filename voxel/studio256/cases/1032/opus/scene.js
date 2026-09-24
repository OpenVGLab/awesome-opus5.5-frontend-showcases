const R=Math.round;
function B(x0,y0,z0,x1,y1,z1,c){box(R(x0),R(y0),R(z0),R(x1),R(y1),R(z1),c);}
function P(x,y,z,c){block(R(x),R(y),R(z),c);}
function cylY(y0,y1,cx,cz,r,c,ri){const n=Math.ceil(r);for(let a=-n;a<=n;a++)for(let b=-n;b<=n;b++){const d=a*a+b*b;if(d<=r*r&&(ri===undefined||d>ri*ri))B(cx+a,y0,cz+b,cx+a,y1,cz+b,c);}}
function cylX(x0,x1,cy,cz,r,c,ri){const n=Math.ceil(r);for(let a=-n;a<=n;a++)for(let b=-n;b<=n;b++){const d=a*a+b*b;if(d<=r*r&&(ri===undefined||d>ri*ri))B(x0,cy+a,cz+b,x1,cy+a,cz+b,c);}}
function cylZ(z0,z1,cx,cy,r,c,ri){const n=Math.ceil(r);for(let a=-n;a<=n;a++)for(let b=-n;b<=n;b++){const d=a*a+b*b;if(d<=r*r&&(ri===undefined||d>ri*ri))B(cx+a,cy+b,z0,cx+a,cy+b,z1,c);}}
const K={off:'#F4EEE2',offD:'#E2D8C5',flour:'#FBF9F4',
teal:'#3E9C97',tealD:'#2B7773',tealL:'#8ACFC8',tealX:'#1F5754',
coral:'#EE7A5B',coralD:'#C95E43',coralL:'#F9A888',
dough:'#F0DCB6',crust:'#D58545',crustL:'#EDAE67',crumb:'#F7E8CA',crumbD:'#E6CFA3',
wood:'#B98B5E',woodD:'#8B6340',steel:'#B3BBB9',steelD:'#6C7573',glass:'#C4E6E1',
egg:'#F6EFE0',yolk:'#F2B43A',seed:'#F3E6C6',butter:'#F4D98A'};

// three-strand braid geometry
function bp(k,s,o){const ph=2*Math.PI*k/3,t=s*o.cyc*2*Math.PI;const env=0.35+0.65*Math.sin(Math.PI*s);const r=o.r*(0.5+0.5*Math.sin(Math.PI*s));
 return [o.x0+(o.x1-o.x0)*s,o.yb+0.85*r+o.H*(1+Math.sin(2*(t+ph)))/2*env,o.zc+o.W*Math.sin(t+ph)*env,r];}
function loaf(o){const N=Math.ceil((o.x1-o.x0)*3),lim=(o.cut===undefined)?1e9:o.cut+4;
 for(let k=0;k<3;k++)for(let i=0;i<=N;i++){const p=bp(k,i/N,o);if(p[0]>lim)continue;ellipsoid(p[0],p[1],p[2],p[3],p[3]*0.9,p[3],o.c);}
 if(o.hl)for(let k=0;k<3;k++)for(let i=0;i<=N;i+=2){const p=bp(k,i/N,o);if(p[0]>lim)continue;ellipsoid(p[0],p[1]+0.42*p[3],p[2],p[3]*0.55,p[3]*0.5,p[3]*0.55,o.hl);}
 if(o.seeds)for(let j=0;j<o.seeds;j++){const k=Math.floor(rng()*3),s=0.08+rng()*0.84,p=bp(k,s,o);if(p[0]>lim-5)continue;P(p[0]+(rng()-0.5)*p[3]*0.8,p[1]+p[3]*0.9+0.3,p[2]+(rng()-0.5)*p[3]*0.8,K.seed);}}
function faceQ(yv,zv,cs){let q1=-9,q2=-9,rr=1;for(const c of cs){const dy=(yv-c[1])/0.9,dz=zv-c[2];const q=1-Math.sqrt(dy*dy+dz*dz)/c[3];if(q>q1){q2=q1;q1=q;rr=c[3];}else if(q>q2)q2=q;}return [q1,q2,rr];}
function faceCol(f){if(f[0]<=0)return null;if(f[0]*f[2]<1.2)return K.crust;if(f[1]>0&&f[0]-f[1]<0.16)return K.crumbD;return K.crumb;}

// tiled kitchen floor with teal border and coral rug
function ins(z,z0,z1,r){let d=0;if(z<z0+r)d=z0+r-z;else if(z>z1-r)d=z-(z1-r);return d>0?r-Math.floor(Math.sqrt(r*r-d*d)):0;}
for(let z=34;z<=206;z++){const i=ins(z,34,206,16),x0=24+i,x1=232-i;B(x0,4,z,x1,6,z,K.tealX);B(x0,7,z,x1,7,z,K.coralD);
 if(z===34||z===206)continue;const j=ins(z,35,205,15),a0=25+j,a1=231-j;
 for(let x=a0;x<=a1;x++){const edge=(x-a0<3||a1-x<3||z<38||z>202);const rx=(x-128)/31,rz=(z-160)/20,rr=rx*rx+rz*rz;let c;
  if(edge)c=K.teal;else if(rr<=1)c=(rr>0.8)?K.coralD:((rr>0.55&&rr<0.64)?K.tealL:K.coral);else c=((x%11===0)||(z%11===0))?K.tealL:K.off;
  P(x,8,z,c);}}

// braided bread making table: cabinets, open shelving, marble top, back rack
B(74,9,56,102,10,96,K.tealX);B(154,9,56,182,10,96,K.tealX);
B(72,11,54,104,39,98,K.teal);B(152,11,54,184,39,98,K.teal);
for(const bx of [72,152]){B(bx,11,99,bx+32,39,99,K.teal);B(bx,20,99,bx+32,20,99,K.tealD);B(bx,30,99,bx+32,30,99,K.tealD);B(bx+16,11,99,bx+16,19,99,K.tealD);
 B(bx+12,34,100,bx+20,35,100,K.coral);B(bx+12,24,100,bx+20,25,100,K.coral);B(bx+5,14,100,bx+10,15,100,K.coral);B(bx+22,14,100,bx+27,15,100,K.coral);}
B(105,11,54,151,39,55,K.tealD);B(105,11,56,151,12,97,K.offD);B(105,25,56,151,26,97,K.offD);
for(const bx of [118,138]){cylY(13,20,bx,76,9,K.wood,7.5);cylY(13,13,bx,76,7.5,K.wood);for(let y=14;y<=20;y+=2)cylY(y,y,bx,76,9.2,K.woodD,8.4);ellipsoid(bx,20,76,7,3,7,K.dough);}
B(108,27,60,126,30,72,K.tealL);B(109,31,61,125,32,71,K.off);ellipsoid(140,33,72,7,6,6,K.offD);ellipsoid(140,39,72,2,1.5,2,K.coral);
B(70,40,52,186,40,100,K.coral);B(70,41,52,186,43,100,K.off);
line(76,43,58,110,43,74,K.offD);line(120,43,90,170,43,62,K.offD);line(150,43,99,184,43,80,K.offD);
for(const px of [72,183])B(px,44,52,px+1,88,53,K.steel);
B(72,78,52,184,78,53,K.steel);B(72,86,52,184,87,57,K.off);B(72,85,52,184,85,57,K.tealD);
cylY(88,96,84,55,3,K.teal);cylY(97,97,84,55,3.3,K.tealD);cylY(88,94,96,55,2.5,K.coralL);cylY(95,95,96,55,2.8,K.coralD);cylY(88,97,108,55,3,K.off);cylY(98,98,108,55,3.3,K.teal);
for(let a=-3;a<=3;a++)for(let b=-5;b<=5;b++)for(let c=-3;c<=3;c++){const q=a*a/6.25+b*b/25+c*c/6.25;if(q<=1&&q>0.55&&(a===0||c===0))P(120+a,66+b,55+c,K.steel);}
B(120,71,55,120,77,55,K.steelD);
B(132,68,55,132,77,55,K.steel);ellipsoid(132,66,56,2.5,2,2.5,K.steel);
ellipsoid(146,71,55,3,5,1.5,K.coral);ellipsoid(149,70,55,1.3,2,1.2,K.coral);B(143,76,54,149,77,56,K.coralD);P(146,77,55,K.coralD);
B(160,62,54,164,68,54,K.woodD);B(162,69,54,162,77,54,K.wood);

// work surface: floured braiding, rolling pin, scraper, egg wash, baking tray
for(let x=74;x<=134;x++)for(let z=57;z<=91;z++){const u=(x-104)/30,v=(z-74)/17;if(u*u+v*v+0.18*Math.sin(x*0.7)*Math.cos(z*0.9)<1)P(x,44,z,K.flour);}
{const x0=80,xm=104,x1=128,zc=74,yb=44,r0=2.8,cyc=2*Math.PI*1.5;
 for(let k=0;k<3;k++){const ph=2*Math.PI*k/3;
  for(let i=0;i<=72;i++){const s=i/72,x=x0+(xm-x0)*s,t=s*cyc,env=Math.min(1,s*4);
   const z=zc+5*Math.sin(t+ph)*env,y=yb+r0*0.85+1.8*(1+Math.sin(2*(t+ph)))/2*env,r=r0*(0.7+0.3*Math.min(1,s*3));ellipsoid(x,y,z,r,r*0.85,r,K.dough);}
  const zE=zc+5*Math.sin(cyc+ph),yE=yb+r0*0.85+1.8*(1+Math.sin(2*(cyc+ph)))/2,zF=zc+(k-1)*10;
  for(let i=0;i<=72;i++){const s=i/72,x=xm+(x1-xm)*s,z=zE+(zF-zE)*Math.min(1,s*2),y=yE+(yb+r0*0.85-yE)*Math.min(1,s*3),r=r0*(1-0.35*Math.max(0,(s-0.8)/0.2));
   ellipsoid(x,y,z,r,r*0.85,r,K.dough);if(i%9===4)P(x,y+r*0.85+0.4,z,K.flour);}}}
cylX(112,130,46,94,2.4,K.wood);cylX(107,111,46,94,1.2,K.woodD);cylX(131,135,46,94,1.2,K.woodD);
B(134,44,60,146,44,66,K.steel);cylX(134,146,45,59,1.2,K.teal);
cylY(44,44,142,80,3.5,K.off);cylY(45,47,142,80,4.5,K.off,3.5);cylY(45,46,142,80,3.5,K.yolk);
beam(135,47,88,143,46,84,0.7,K.woodD);ellipsoid(144.5,46,83,1.6,1.2,1.6,K.coral);
B(150,44,58,184,44,96,K.steelD);B(150,45,58,184,45,58,K.steel);B(150,45,96,184,45,96,K.steel);B(150,45,58,150,45,96,K.steel);B(184,45,58,184,45,96,K.steel);
B(152,45,60,182,45,94,K.coralL);
loaf({x0:154,x1:181,zc:69,W:3.4,H:2.4,r:4.2,cyc:2,yb:46,c:K.crust,hl:K.crustL,seeds:45});
loaf({x0:153,x1:182,zc:87,W:3.6,H:2.6,r:4.4,cyc:2.25,yb:46,c:K.crust,hl:K.crustL,seeds:45});

// cutting board on its stand with knife block and board rack
for(const p of [[30,108],[62,108],[30,142],[62,142]])B(p[0],9,p[1],p[0]+2,33,p[1]+2,K.teal);
B(30,16,108,64,17,144,K.offD);B(30,31,108,64,33,110,K.tealD);B(30,31,142,64,33,144,K.tealD);
B(29,34,107,65,37,145,K.wood);
for(let x=31;x<=63;x++){P(x,37,109,K.woodD);P(x,37,143,K.woodD);}for(let z=109;z<=143;z++){P(31,37,z,K.woodD);P(63,37,z,K.woodD);}
B(30,38,107,38,56,112,K.teal);for(let x=31;x<=37;x+=3)B(x,56,108,x,56,111,K.tealX);
B(31,57,109,32,62,110,K.coral);B(34,57,109,35,61,110,K.coralD);B(37,57,109,37,60,110,K.coral);
B(41,38,107,42,50,111,K.teal);B(64,38,107,65,50,111,K.teal);B(43,38,108,63,64,109,K.wood);B(43,64,108,63,64,109,K.woodD);
for(let x=50;x<=56;x++)for(let y=57;y<=63;y++)if((x-53)*(x-53)+(y-60)*(y-60)<=4.5){P(x,y,108,null);P(x,y,109,null);}
cylY(18,22,46,126,8,K.wood,6.8);cylY(18,18,46,126,6.8,K.wood);cylY(20,20,46,126,8.2,K.woodD,7.6);
for(const p of [[43,123],[49,129],[45,130],[50,121],[46,125]])ellipsoid(p[0],22.5,p[1],3,2.5,3,K.crust);
const o3={x0:31,x1:59,zc:128,W:3.4,H:2.4,r:4.2,cyc:2,yb:38,c:K.crust,hl:K.crustL,seeds:30,cut:50};
loaf(o3);
for(let x=51;x<=58;x++)for(let y=38;y<=54;y++)for(let z=116;z<=140;z++)P(x,y,z,null);
{const sc=(50-31)/28,cs=[0,1,2].map(k=>bp(k,sc,o3));for(let y=38;y<=54;y++)for(let z=116;z<=140;z++){const col=faceCol(faceQ(y,z,cs));if(col)P(50,y,z,col);}}
{const cs=[0,1,2].map(k=>bp(k,0.74,o3)),yref=o3.yb+4.5;for(let x=50;x<=65;x++)for(let z=110;z<=134;z++){const col=faceCol(faceQ(yref+(x-57),128+(z-121),cs));if(!col)continue;P(x,38,z,K.crust);P(x,39,z,col);}}
B(34,38,138,54,38,140,K.steel);for(let x=34;x<=54;x+=2)P(x,38,141,K.steelD);B(55,38,138,62,40,140,K.coral);P(57,40,139,K.steel);P(60,40,139,K.steel);

// mixing bowl of risen dough on a round stand
cylY(26,28,70,172,14,K.teal);cylY(28,28,70,172,14,K.coralD,12.8);
for(let k=0;k<3;k++){const a=k*2*Math.PI/3+0.3;beam(70+9*Math.cos(a),25,172+9*Math.sin(a),70+13*Math.cos(a),9,172+13*Math.sin(a),1.5,K.tealD);}
ring(70,15,172,11.8,0.8,K.tealD,'y');
cylY(29,31,70,172,7,K.tealD);
for(let x=52;x<=88;x++)for(let z=154;z<=190;z++)for(let y=29;y<=44;y++){const dx=x-70,dz=z-172,dy=y-44;
 if((dx*dx+dz*dz)/324+dy*dy/225>1)continue;const inn=(dx*dx+dz*dz)/272.25+dy*dy/182.25;if(inn<=1)continue;
 P(x,y,z,y>=43?K.coral:(inn<1.22?K.off:K.teal));}
for(let x=54;x<=86;x++)for(let z=156;z<=188;z++)for(let y=31;y<=50;y++){const dx=x-70,dz=z-172;
 if(y<=44){if((dx*dx+dz*dz)/272.25+(y-44)*(y-44)/182.25>1)continue;}else{if((dx*dx+dz*dz)/240.25+(y-44)*(y-44)/36>1)continue;}
 P(x,y,z,(y>=47&&((x*3+z*5)%7===0))?K.flour:K.dough);}
beam(78,46,166,92,62,156,0.9,K.wood);ellipsoid(92,62.5,156,1.2,1.2,1.2,K.woodD);

// small countertop oven on its cabinet, door open with a braid inside
B(193,9,90,227,34,132,K.off);
B(195,12,133,209,32,133,K.teal);B(211,12,133,225,32,133,K.teal);P(207,22,134,K.coral);P(213,22,134,K.coral);
B(192,35,89,228,36,133,K.tealD);
B(196,37,94,224,39,128,K.coral);B(196,59,94,224,62,128,K.coral);B(196,40,94,224,58,95,K.coral);
B(196,40,96,197,58,128,K.coral);B(215,40,96,224,58,128,K.coral);
B(198,39,96,214,39,127,K.steelD);
for(let x=200;x<=212;x+=3)B(x,62,100,x,62,122,K.coralD);
B(216,41,129,223,57,129,K.off);cylZ(130,131,219,53,1.8,K.teal);cylZ(130,131,219,47,1.8,K.teal);P(219,54,132,K.tealX);P(220,47,132,K.tealX);P(219,43,130,K.coralL);
for(const z of [100,110,120])cylX(198,214,57,z,0.8,K.coralL);
for(const z of [104,116])cylX(198,214,41,z,0.8,K.coralL);
for(let z=100;z<=124;z+=4)B(198,46,z,214,46,z,K.steel);B(198,46,97,198,46,127,K.steel);B(214,46,97,214,46,127,K.steel);
loaf({x0:200,x1:213,zc:118,W:2.2,H:1.6,r:2.8,cyc:1.5,yb:47,c:K.crustL,hl:K.dough});
B(197,37,129,215,38,146,K.coralD);B(200,39,132,212,39,143,K.glass);B(199,37,147,213,38,147,K.steel);

// ingredient tray on a trolley
for(const p of [[160,154],[202,154],[160,184],[202,184]]){cylZ(p[1],p[1]+2,p[0]+1,11,2,K.steelD);B(p[0],13,p[1],p[0]+2,34,p[1]+2,K.teal);}
B(160,18,154,204,19,186,K.offD);B(160,33,154,204,34,186,K.teal);
B(162,35,156,202,35,184,K.coral);B(162,36,156,202,37,156,K.coralD);B(162,36,184,202,37,184,K.coralD);B(162,36,156,162,37,184,K.coralD);B(202,36,156,202,37,184,K.coralD);
beam(205,34,158,209,44,158,0.9,K.steel);beam(205,34,182,209,44,182,0.9,K.steel);beam(209,44,158,209,44,182,1,K.steel);
cylY(36,36,170,162,4,K.off);cylY(37,40,170,162,5,K.off,4);
for(const e of [[168,39,160],[172,39,161],[170,39,165],[169.5,41,162]])ellipsoid(e[0],e[1],e[2],1.8,2.3,1.8,K.egg);
cylY(36,47,192,164,5,K.off);cylY(42,43,192,164,5.2,K.tealL);cylY(48,49,192,164,5.6,K.teal);ellipsoid(192,51,164,1.5,1.2,1.5,K.coral);
B(164,36,172,177,36,182,K.off);B(166,37,174,175,40,180,K.butter);
cylY(36,36,196,178,3,K.glass);cylY(37,43,196,178,3,K.glass,2.2);cylY(37,41,196,178,2.2,K.seed);cylY(36,36,190,181,2.5,K.coral);
cylY(36,46,182,174,3.5,K.off);cylY(40,41,182,174,3.7,K.teal);P(182,46,170,K.off);P(182,47,170,K.off);ring(186,41,174,2.5,0.7,K.off,'z');
ellipsoid(172,25,170,8,6,7,K.offD);ellipsoid(172,31,170,2,1.5,2,K.coral);B(186,20,158,200,28,182,K.tealL);B(186,28,158,200,28,182,K.teal);

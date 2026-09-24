const R=Math.round;
function B(x0,y0,z0,x1,y1,z1,c){box(R(x0),R(y0),R(z0),R(x1),R(y1),R(z1),c);}
function P(x,y,z,c){block(R(x),R(y),R(z),c);}
function cylY(y0,y1,cx,cz,r,c,ri){const n=Math.ceil(r);for(let a=-n;a<=n;a++)for(let b=-n;b<=n;b++){const d=a*a+b*b;if(d<=r*r&&(ri===undefined||d>ri*ri))B(cx+a,y0,cz+b,cx+a,y1,cz+b,c);}}
function cylX(x0,x1,cy,cz,r,c,ri){const n=Math.ceil(r);for(let a=-n;a<=n;a++)for(let b=-n;b<=n;b++){const d=a*a+b*b;if(d<=r*r&&(ri===undefined||d>ri*ri))B(x0,cy+a,cz+b,x1,cy+a,cz+b,c);}}
function cylZ(z0,z1,cx,cy,r,c,ri){const n=Math.ceil(r);for(let a=-n;a<=n;a++)for(let b=-n;b<=n;b++){const d=a*a+b*b;if(d<=r*r&&(ri===undefined||d>ri*ri))B(cx+a,cy+b,z0,cx+a,cy+b,z1,c);}}
const K={white:'#F1EDE3',whiteD:'#DCD5C6',stone:'#C8C2B4',stoneD:'#A39C8E',
cel:'#8FBBA0',celD:'#6B9B80',celL:'#BFDAC6',
red:'#9C4A35',redD:'#763425',redL:'#BC6A4E',redX:'#5A281D',
soil:'#7B4C36',soilL:'#96634B',water:'#86BDB6',waterL:'#AAD6CE',foam:'#EDF7F3',
grass:'#A6C69C',grassD:'#8BB183',sprout:'#6EA47D',grain:'#D8B46C',grainD:'#B8934F',film:'#DDEBE3'};

// terrain with a bending stream and layered earth edges
function segDist(px,pz,ax,az,bx,bz){const vx=bx-ax,vz=bz-az;const t=Math.max(0,Math.min(1,((px-ax)*vx+(pz-az)*vz)/(vx*vx+vz*vz)));const dx=px-(ax+t*vx),dz=pz-(az+t*vz);return Math.sqrt(dx*dx+dz*dz);}
function streamD(x,z){let d=Math.min(segDist(x,z,16,71,92,71),segDist(x,z,118,45,118,16));
 if(x>=92&&z>=45){d=Math.min(d,Math.abs(Math.sqrt((x-92)*(x-92)+(z-45)*(z-45))-26));}return d;}
function inLand(x,z){const u=(x-128)/102,v=(z-124)/98;return u*u*u*u+v*v*v*v<=1;}
function groundTop(x,z){const d=streamD(x,z);if(d<=16)return 8;if(d<20)return 8+R(d-16);return 12;}
function onFoot(x,z){return segDist(x,z,75,118,62,152)<=3;}
function onLane(x,z){return x>=104&&x<=198&&z>=159&&z<=193;}
for(let x=26;x<=230;x++)for(let z=26;z<=222;z++){if(!inLand(x,z))continue;const d=streamD(x,z);
 if(d<=16){P(x,4,z,K.soil);P(x,5,z,((x*7+z*13)%5===0)?K.stoneD:K.stone);B(x,6,z,x,7,z,K.water);P(x,8,z,((x*3+z*5)%11<2)?K.waterL:K.water);continue;}
 const top=(d<20)?8+R(d-16):12;
 B(x,4,z,x,Math.min(6,top),z,K.soil);if(top>=7)B(x,7,z,x,Math.min(9,top),z,K.soilL);if(top>=10)B(x,10,z,x,Math.min(11,top),z,K.whiteD);
 let c;if(top<12)c=((x+z)%3===0)?K.stone:K.whiteD;
 else if(onLane(x,z))c=((z>=161&&z<=165)||(z>=187&&z<=191))?K.soilL:K.whiteD;
 else if(onFoot(x,z))c=K.white;else c=((x*5+z*3)%13===0)?K.grassD:K.grass;
 P(x,top,z,c);}
for(const p of [[32,92],[38,89],[40,52],[46,50],[95,48],[86,42],[134,58],[136,49],[136,36],[108,97]]){
 const t=groundTop(p[0],p[1]);for(let k=0;k<3;k++){const x=p[0]+[0,1,-1][k],z=p[1]+[0,1,1][k],h=[9,7,6][k];B(x,t+1,z,x,t+h,z,k===1?K.celD:K.cel);P(x,t+h+1,z,K.soilL);}}

// noria water wheel on stone piers
const WX=66,WY=44,WZ=71;
B(56,5,55,76,16,59,K.stone);for(let y=7;y<=15;y+=4)B(56,y,55,76,y,59,K.stoneD);
beam(58,17,57,65,42,57,1.5,K.redD);beam(74,17,57,67,42,57,1.5,K.redD);B(62,41,55,70,47,59,K.redD);
B(48,5,81,84,16,86,K.stone);for(let y=7;y<=15;y+=4)B(48,y,81,84,y,86,K.stoneD);
beam(56,17,83,65,42,83,1.5,K.redD);beam(76,17,83,67,42,83,1.5,K.redD);B(62,41,81,70,47,85,K.redD);
cylZ(53,89,WX,WY,1.2,K.redX);
cylZ(64,78,WX,WY,5,K.red,2.2);
ring(WX,WY,65,29,1.2,K.red,'z');ring(WX,WY,77,29,1.2,K.red,'z');
for(let k=0;k<12;k++){const a=k*Math.PI/6,c=Math.cos(a),s=Math.sin(a);
 beam(WX+5*c,WY+5*s,65,WX+28.5*c,WY+28.5*s,65,1,K.red);beam(WX+5*c,WY+5*s,77,WX+28.5*c,WY+28.5*s,77,1,K.red);
 beam(WX+29*c,WY+29*s,66,WX+29*c,WY+29*s,76,0.8,K.redD);}
for(let k=0;k<16;k++){const a=k*Math.PI/8+0.1,c=Math.cos(a),s=Math.sin(a);
 cylZ(66,76,WX+31.5*c,WY+31.5*s,1.8,K.cel);cylZ(66,66,WX+31.5*c,WY+31.5*s,1.8,K.celL);cylZ(76,76,WX+31.5*c,WY+31.5*s,1.8,K.celL);
 const b=a+Math.PI/16,cb=Math.cos(b),sb=Math.sin(b);
 for(let q=28;q<=34;q+=0.5)for(let z=67;z<=75;z++)P(WX+q*cb,WY+q*sb,z,K.redD);}

// elevated platform: posts, deck, railing, ladder, collecting trough
for(const p of [[51,83,17],[79,83,17],[51,100,13],[79,100,13]])B(p[0],p[2],p[1],p[0]+2,69,p[1]+2,K.redD);
beam(53,14,101,79,66,101,0.9,K.redD);beam(79,14,101,53,66,101,0.9,K.redD);
for(const sx of [52,80]){beam(sx,18,86,sx,66,99,0.9,K.redD);beam(sx,18,99,sx,66,86,0.9,K.redD);}
B(48,70,80,84,71,105,K.redL);for(let x=50;x<=84;x+=4)B(x,71,80,x,71,105,K.red);
for(const x of [48,57,66,84])B(x,72,105,x,79,105,K.redD);
B(48,79,105,70,79,105,K.redD);B(80,79,105,84,79,105,K.redD);B(80,72,105,80,79,105,K.redD);
for(const z of [80,88,96])B(48,72,z,48,79,z,K.redD);B(48,79,80,48,79,105,K.redD);
for(const z of [92,98])B(84,72,z,84,79,z,K.redD);B(84,79,90,84,79,105,K.redD);
beam(72,13,116,72,70,106,0.9,K.redD);beam(78,13,116,78,70,106,0.9,K.redD);
for(let y=17;y<=68;y+=5){const z=R(116-10*(y-13)/57);B(73,y,z,77,y,z,K.redL);}
for(const x of [58,70,82])B(x,72,82,x+1,73,86,K.redD);
B(54,74,81,92,74,87,K.celD);B(54,75,81,96,77,81,K.cel);B(54,75,87,96,77,87,K.cel);B(54,75,81,54,77,87,K.cel);
B(55,75,82,95,76,86,K.water);B(93,70,84,94,74,85,K.water);
B(64,77,79,68,78,80,K.waterL);
B(96,59,80,96,78,80,K.redD);B(96,59,90,96,78,90,K.redD);B(96,78,80,96,78,90,K.redD);B(96,76,88,96,77,89,K.redD);

// catch basin, tipping double bucket, elevated flume on trestles
B(84,55,80,104,55,90,K.celD);
B(84,56,80,104,58,80,K.cel);B(84,56,90,104,58,90,K.cel);B(84,56,80,84,58,90,K.cel);
B(104,56,80,104,58,83,K.cel);B(104,56,87,104,58,90,K.cel);
B(85,56,81,103,56,89,K.water);
for(const p of [[85,81],[103,81],[85,89],[103,89]])B(p[0],5,p[1],p[0],54,p[1],K.redD);
B(93,59,80,95,63,80,K.redD);B(93,59,90,95,63,90,K.redD);cylZ(80,90,94,63,0.8,K.redX);
B(86,64,82,102,64,88,K.celD);B(86,65,82,86,68,88,K.celD);B(102,65,82,102,68,88,K.celD);
B(87,65,82,101,67,82,K.celD);B(87,65,88,101,67,88,K.celD);B(86,68,82,86,68,88,K.white);B(102,68,82,102,68,88,K.white);
B(94,65,83,94,69,87,K.white);B(87,65,83,93,66,87,K.waterL);
B(99,59,82,108,59,88,K.redL);
B(105,55,83,139,55,87,K.celD);B(105,56,83,139,58,83,K.cel);B(105,56,87,139,58,87,K.cel);B(105,56,84,139,56,86,K.water);
for(let x=112;x<=136;x+=12)B(x,58,83,x,58,87,K.celL);
for(const tx of [114,130]){beam(tx,6,78,tx,54,83,1,K.redD);beam(tx,6,92,tx,54,87,1,K.redD);B(tx,40,80,tx,41,90,K.redD);B(tx-1,54,82,tx+1,54,88,K.redD);}
for(let i=0;i<5;i++){const x=100+8*i;B(x,57,84,x+1,57,86,K.foam);}
B(140,54,81,148,54,89,K.celD);B(140,55,81,148,60,81,K.cel);B(140,55,89,148,60,89,K.cel);B(148,55,81,148,60,89,K.cel);
B(140,55,82,140,55,88,K.cel);B(140,55,82,140,60,83,K.cel);B(140,55,87,140,60,88,K.cel);B(140,58,84,140,60,86,K.cel);
B(141,55,82,147,56,88,K.water);B(139,61,80,149,61,90,K.redL);B(143,13,84,145,53,86,K.redD);
beam(149,56,85,150,31,85,1.1,K.celL);beam(150,31,85,153,31,85,1.1,K.celL);
beam(144,56,90,170,51,118,1,K.celL);beam(170,51,118,170,51,121,0.8,K.celL);

// small greenhouse with rolled-up front curtain
const GX0=152,GX1=214,GZ=76,GY=20,GR=24;
B(GX0,13,52,GX1,19,53,K.white);B(GX0,13,99,GX1,19,100,K.white);
B(GX0,13,52,GX0+1,19,100,K.white);B(GX1-1,13,52,GX1,19,100,K.white);
for(let z=70;z<=82;z++)for(let y=13;y<=34;y++){if((z-76)*(z-76)+(y-20)*(y-20)<=GR*GR)P(GX0,y,z,null);}
for(let x=GX0;x<=GX1;x++){const gable=(x<=GX0+1||x>=GX1-1),rib=((x-GX0)%8===0);
 for(let z=52;z<=100;z++)for(let y=20;y<=GY+GR+1;y++){const r=Math.sqrt((z-GZ)*(z-GZ)+(y-GY)*(y-GY));if(r>GR+1)continue;
  if(gable){if(x<=GX0+1&&z>=70&&z<=82&&y<=34)continue;P(x,y,z,y<=28?K.white:K.film);continue;}
  if(r<GR)continue;if(rib)P(x,y,z,K.redD);else if(z<GZ||y>34)P(x,y,z,K.film);}}
for(let z=70;z<=82;z++)for(let y=13;y<=19;y++)P(GX0,y,z,null),P(GX0+1,y,z,null);
B(GX0,13,69,GX0+1,35,69,K.redD);B(GX0,13,83,GX0+1,35,83,K.redD);B(GX0,35,69,GX0+1,35,83,K.redD);
cylX(GX0+2,GX1-2,34,96,1.5,K.celL);
for(const zc of [62,75,89]){B(156,13,zc-4,210,14,zc+4,K.soil);B(157,15,zc-3,209,15,zc+3,K.soilL);
 for(let x=159;x<=207;x+=6){ellipsoid(x,18,zc,2,2.5,2,(x%12===3)?K.grassD:K.grass);B(x,16,zc,x,16,zc,K.sprout);if(zc===89)P(x+1,18,zc+2,K.redL);}}

// standalone seedling rack
for(let k=0;k<4;k++){const y=16+k*10;B(156,y,116,196,y,146,K.redL);
 for(const tx of [159,178]){B(tx,y+1,119,tx+16,y+2,143,K.cel);B(tx+1,y+2,120,tx+15,y+2,142,K.soil);
  for(let x=tx+2;x<=tx+14;x+=3)for(let z=121;z<=141;z+=3){B(x,y+3,z,x,y+3+(k>1?1:0),z,K.sprout);if(k===3)P(x+((z%2)?1:-1),y+4,z,K.grass);}}}
for(const p of [[156,116],[195,116],[156,145],[195,145]])B(p[0],13,p[1],p[0]+1,49,p[1]+1,K.redD);
beam(157,14,116,195,46,116,0.8,K.redD);beam(157,14,146,195,46,146,0.8,K.redD);

// crop ridges in the open field
for(const zc of [110,119,128,137]){B(100,13,zc-2,146,13,zc+2,K.soil);B(100,14,zc-1,146,14,zc+1,K.soilL);
 for(let x=102;x<=144;x+=5){B(x,15,zc,x,16,zc,K.sprout);P(x-1,16,zc,K.grass);P(x+1,16,zc,K.grass);P(x,17,zc,K.grassD);}}

// hand-crank grain mill table
B(36,32,158,80,34,190,K.red);B(36,34,158,80,34,158,K.redL);B(36,34,190,80,34,190,K.redL);
for(const p of [[37,159],[76,159],[37,186],[76,186]])B(p[0],13,p[1],p[0]+3,31,p[1]+3,K.redD);
B(38,18,160,78,19,188,K.redL);B(41,24,160,75,25,161,K.redD);B(41,24,187,75,25,188,K.redD);
cylY(35,40,56,174,12,K.stone);cylY(40,40,56,174,12,K.stoneD,11);B(68,38,173,71,39,175,K.stone);
cylY(35,35,76,174,3,K.cel);cylY(36,38,76,174,4,K.cel,3);cylY(36,37,76,174,3,K.white);
for(let a=-11;a<=11;a++)for(let b=-11;b<=11;b++){const d2=a*a+b*b;if(d2>121||d2<=6.25)continue;
 const g=(Math.abs(Math.atan2(b,a))%(Math.PI/4))<0.14;B(56+a,41,174+b,56+a,45,174+b,K.white);P(56+a,46,174+b,g?K.whiteD:K.white);}
cylY(47,55,64,174,1.2,K.redL);ellipsoid(64,56,174,1.6,1.6,1.6,K.redL);
B(55,35,160,57,66,161,K.redD);B(55,35,187,57,66,188,K.redD);B(55,66,160,57,67,188,K.redD);
cone(56,56,174,2,7,8,K.red);cylY(64,64,56,174,6.5,K.grain);P(56,65,170,K.redD);P(56,65,178,K.redD);
B(56,44,174,56,55,174,K.grain);
ellipsoid(33,19,166,5,7,5,K.whiteD);ellipsoid(33,27,166,2,1.5,2,K.redD);
ellipsoid(33,18,177,5,6,5,K.whiteD);ellipsoid(33,25,177,2,1.5,2,K.redD);

// grain bin beside the mill
B(86,13,164,101,13,188,K.redD);
B(86,14,164,101,24,164,K.redL);B(86,14,188,101,24,188,K.redL);B(86,14,164,86,24,188,K.redL);B(101,14,164,101,24,188,K.redL);
for(let x=87;x<=100;x++)for(let z=165;z<=187;z++){const u=(x-93.5)/7,v=(z-176)/12;const h=20+R(3*Math.max(0,1-u*u-v*v));B(x,14,z,x,h,z,((x*7+z*3)%9===0)?K.grainD:K.grain);}

// two-wheeled grain cart with tipping box
cylZ(162,190,120,23,1.2,K.redX);
B(104,24,167,128,25,169,K.redD);B(104,24,183,128,25,185,K.redD);
B(117,22,167,123,25,169,K.redD);B(117,22,183,123,25,185,K.redD);
beam(128,25,168,150,30,168,1,K.redD);beam(128,25,184,150,30,184,1,K.redD);
beam(146,28,168,146,13,168,0.9,K.redD);beam(146,28,184,146,13,184,0.9,K.redD);
B(104,26,166,128,26,186,K.red);
B(104,27,166,128,35,166,K.red);B(104,27,186,128,35,186,K.red);B(104,27,166,104,35,186,K.red);B(128,27,166,128,35,186,K.red);
B(104,35,166,128,35,166,K.redL);B(104,35,186,128,35,186,K.redL);B(104,35,166,104,35,186,K.redL);B(128,35,166,128,35,186,K.redL);
for(let x=105;x<=127;x++)for(let z=167;z<=185;z++){const u=(x-116)/12,v=(z-176)/10;const h=34+R(4*Math.max(0,1-u*u-v*v));B(x,27,z,x,h,z,((x*5+z*7)%8===0)?K.grainD:K.grain);}
for(const w of [[162,164],[188,190]]){cylZ(w[0],w[1],120,23,10,K.stoneD,8.5);cylZ(w[0],w[1],120,23,2.5,K.whiteD,1.5);
 for(let k=0;k<8;k++){const a=k*Math.PI/4;beam(120+2.5*Math.cos(a),23+2.5*Math.sin(a),w[0]+1,120+8.5*Math.cos(a),23+8.5*Math.sin(a),w[0]+1,0.8,K.whiteD);}}

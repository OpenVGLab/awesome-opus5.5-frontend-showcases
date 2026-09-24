const R=Math.round;
function B(x0,y0,z0,x1,y1,z1,c){box(R(x0),R(y0),R(z0),R(x1),R(y1),R(z1),c);}
function P(x,y,z,c){block(R(x),R(y),R(z),c);}
function cylY(y0,y1,cx,cz,r,c,ri){const n=Math.ceil(r);for(let a=-n;a<=n;a++)for(let b=-n;b<=n;b++){const d=a*a+b*b;if(d<=r*r&&(ri===undefined||d>ri*ri))B(cx+a,y0,cz+b,cx+a,y1,cz+b,c);}}
function cylX(x0,x1,cy,cz,r,c,ri){const n=Math.ceil(r);for(let a=-n;a<=n;a++)for(let b=-n;b<=n;b++){const d=a*a+b*b;if(d<=r*r&&(ri===undefined||d>ri*ri))B(x0,cy+a,cz+b,x1,cy+a,cz+b,c);}}
function cylZ(z0,z1,cx,cy,r,c,ri){const n=Math.ceil(r);for(let a=-n;a<=n;a++)for(let b=-n;b<=n;b++){const d=a*a+b*b;if(d<=r*r&&(ri===undefined||d>ri*ri))B(cx+a,cy+b,z0,cx+a,cy+b,z1,c);}}
const K={floor:'#ECE4D3',grout:'#D8CEBA',rim:'#C6BAA3',base:'#9C958B',
teal:'#3AA39A',tealD:'#26766F',tealL:'#86D3C9',tealX:'#1C4F4B',
cream:'#F6EFE3',creamD:'#E1D4BE',coral:'#F17A5D',coralD:'#CB5A40',coralL:'#FFA689',
steel:'#9BA7AC',steelD:'#5F6A70',iron:'#394145',rail:'#727D83',
hide:'#B7754A',hideD:'#8A5233',hideL:'#D8A171',water:'#9FE2DB',glass:'#D3F2ED'};

// tiled floor slab with rounded corners
function ins(z,z0,z1,r){let d=0;if(z<z0+r)d=z0+r-z;else if(z>z1-r)d=z-(z1-r);return d>0?r-Math.floor(Math.sqrt(r*r-d*d)):0;}
for(let z=30;z<=204;z++){const i=ins(z,30,204,12);B(26+i,4,z,230-i,7,z,K.base);B(26+i,8,z,230-i,8,z,K.rim);
 if(z>30&&z<204){const j=ins(z,31,203,11),a0=27+j,a1=229-j;
  if((z-30)%16===0)B(a0,9,z,a1,9,z,K.grout);else{B(a0,9,z,a1,9,z,K.floor);for(let x=35;x<=a1;x+=16)if(x>=a0)P(x,9,z,K.grout);}}}

// cooling tower model
const TX=52,TZ=62;
cylY(10,15,TX,TZ,24,K.creamD,21.5);
cylY(10,11,TX,TZ,21.5,K.creamD);
cylY(12,13,TX,TZ,21.5,K.water);
cylY(16,16,TX,TZ,24.5,K.tealD,20.5);
for(let y=14;y<=25;y++)cylY(y,y,TX,TZ,17,(y%2)?K.tealL:K.glass);
for(let k=0;k<12;k++){const a=k*Math.PI/6;for(const s of [-1,1]){const b=a+s*0.26;
 beam(TX+22.5*Math.cos(a),17,TZ+22.5*Math.sin(a),TX+19*Math.cos(b),26,TZ+19*Math.sin(b),1.1,K.teal);}}
for(let y=26;y<=94;y++){const t=(y-76)/3.4,r=Math.sqrt(169+t*t),ri=r-2.2;let c=K.cream;
 if(y<=28)c=K.tealD;else if(y===44||y===45||y===68)c=K.teal;else if(y>=92)c=K.coral;
 const n=Math.ceil(r);
 for(let a=-n;a<=n;a++)for(let b=-n;b<=n;b++){const d=Math.sqrt(a*a+b*b);if(d<=r&&d>ri)P(TX+a,y,TZ+b,c);}
 if(y>=30&&y<=90)for(let k=0;k<8;k++){const q=k*Math.PI/4+0.2;P(TX+(r+0.6)*Math.cos(q),y,TZ+(r+0.6)*Math.sin(q),K.creamD);}}
B(TX-12,91,TZ-1,TX+12,92,TZ+1,K.steelD);B(TX-1,91,TZ-12,TX+1,92,TZ+12,K.steelD);
cylY(91,94,TX,TZ,2.5,K.iron);
cylY(95,96,TX,TZ,2.5,K.tealX);
for(let k=0;k<4;k++){const a=k*Math.PI/2+0.35;beam(TX+2.5*Math.cos(a),96,TZ+2.5*Math.sin(a),TX+11*Math.cos(a),96,TZ+11*Math.sin(a),1.1,K.glass);}

// cool supply and warm return loops between tower and heated die
beam(124,55,53,124,55,38,1.2,K.tealL);beam(124,55,38,124,13,38,1.2,K.tealL);beam(124,13,38,80,13,38,1.2,K.tealL);beam(80,13,38,72,13,50,1.2,K.tealL);
beam(144,55,53,144,55,34,1.2,K.coral);beam(144,55,34,144,40,34,1.2,K.coral);beam(144,40,34,66,40,34,1.2,K.coral);beam(66,40,34,61,40,48,1.2,K.coral);
for(const px of [84,104,128]){B(px,10,34,px,38,34,K.steelD);B(px-1,10,33,px+1,10,35,K.steelD);}

// cylindrical finishing-dye tank
const SX=206,SZ=60;
for(const [dx,dz] of [[-11,-11],[11,-11],[-11,11],[11,11]]){B(SX+dx-1,12,SZ+dz-1,SX+dx+1,26,SZ+dz+1,K.tealD);B(SX+dx-2,10,SZ+dz-2,SX+dx+2,11,SZ+dz+2,K.teal);}
ellipsoid(SX,26,SZ,16,6,16,K.creamD);
cylY(26,74,SX,SZ,16,K.cream);
cylY(36,37,SX,SZ,17,K.coral,15.5);cylY(58,59,SX,SZ,17,K.coral,15.5);
ellipsoid(SX,74,SZ,16,8,16,K.cream);
cylY(81,84,SX,SZ,4,K.steelD);cylY(85,85,SX,SZ,5,K.coralD);
for(const lx of [SX-4,SX+4])B(lx,10,SZ+19,lx,80,SZ+19,K.steel);
for(let y=14;y<=78;y+=5)B(SX-3,y,SZ+19,SX+3,y,SZ+19,K.steelD);
for(const y of [22,50,76]){B(SX-4,y,SZ+16,SX-4,y,SZ+18,K.steelD);B(SX+4,y,SZ+16,SX+4,y,SZ+18,K.steelD);}
for(const lx of [SX-4,SX+4]){beam(lx,80,SZ+19,lx,84,SZ+10,0.8,K.steel);B(lx,79,SZ+10,lx,84,SZ+10,K.steel);}
B(SX-18,30,SZ-1,SX-18,70,SZ+1,K.steelD);B(SX-19,31,SZ,SX-19,69,SZ,K.glass);B(SX-19,31,SZ,SX-19,52,SZ,K.coralL);
B(SX-17,30,SZ,SX-17,30,SZ,K.steelD);B(SX-17,70,SZ,SX-17,70,SZ,K.steelD);
beam(SX-16,28,SZ,182,28,SZ,1.2,K.coral);ring(186,28,SZ,3,0.7,K.coralD,'x');
beam(182,28,SZ,182,66,SZ,1.2,K.coral);beam(182,66,SZ,162,66,SZ,1.2,K.coral);
beam(162,66,46,162,66,82,1.3,K.coral);
for(let z=58;z<=74;z+=4)B(162,62,z,162,64,z,K.steelD);
B(162,48,46,162,65,46,K.steelD);B(162,48,82,162,65,82,K.steelD);

// embossing workbench
B(84,44,42,176,47,88,K.cream);B(84,44,89,176,45,89,K.teal);
for(const lx of [86,170])for(const lz of [44,82]){B(lx,12,lz,lx+4,43,lz+4,K.teal);B(lx-1,10,lz-1,lx+5,11,lz+5,K.tealD);}
B(87,18,49,89,20,81,K.tealD);B(171,18,49,173,20,81,K.tealD);B(91,18,45,169,20,47,K.tealD);
B(94,20,50,122,43,86,K.creamD);
for(let i=0;i<3;i++){const y0=22+i*7;B(96,y0,87,120,y0+5,87,K.cream);B(104,y0+2,88,112,y0+3,88,K.coral);}
B(126,10,48,127,43,86,K.creamD);
B(128,20,48,169,21,86,K.creamD);
cylX(132,164,27,58,5,K.hide);cylX(134,162,27,70,5,K.hideD);cylX(137,159,36,64,4,K.hideL);

// hide supply roll on brackets
for(const pz of [54,77]){B(93,48,pz,101,60,pz+1,K.teal);cylZ(pz,pz+1,97,64,4,K.teal);}
cylZ(52,80,97,64,1,K.steelD);
cylZ(57,75,97,64,7,K.hideL,2.5);
for(let a=3;a<=7;a++)for(let b=-1;b<=1;b++){if(a*a+b*b<=49)B(97+a,64+b,57,97+a,64+b,75,K.hideD);}
cylZ(57,57,97,64,5,K.hideD,4.2);cylZ(75,75,97,64,5,K.hideD,4.2);

// pinch roller frame and rollers
function plateZ(x0,x1,y0,y1,z0,z1,c,holes){for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){let ok=true;for(const h of holes){const dx=x-h[0],dy=y-h[1];if(dx*dx+dy*dy<=2)ok=false;}if(ok)B(x,y,z0,x,y,z1,c);}}
plateZ(105,113,48,65,53,55,K.teal,[[109,61],[109,53]]);
plateZ(105,113,48,65,77,79,K.teal,[[109,61],[109,53]]);
B(105,66,53,113,67,79,K.tealD);
cylZ(56,76,109,61,3,K.steel);cylZ(53,55,109,61,1,K.steelD);cylZ(77,79,109,61,1,K.steelD);
for(let a=2;a<=3;a++)B(109+a,61,56,109+a,61,76,K.steelD);
cylZ(56,76,109,53,3,K.steel);cylZ(53,55,109,53,1,K.steelD);cylZ(77,79,109,53,1,K.steelD);
for(let a=2;a<=3;a++)B(109-a,53,56,109-a,53,76,K.steelD);

// four-column screw press
const PX=134,PZ=65,COLS=[[118,50],[150,50],[118,80],[150,80]];
B(114,48,47,154,53,83,K.teal);B(114,48,47,154,48,83,K.tealD);
B(118,54,54,150,56,76,K.coral);
for(let x=122;x<=146;x+=6)P(x,55,77,K.coralL);
for(const [cx,cz] of COLS){cylY(54,108,cx,cz,2,K.steel);cylY(54,56,cx,cz,3.2,K.steelD);}
for(let x=112;x<=156;x++)for(let z=45;z<=85;z++){const dx=x-PX,dz=z-PZ;if(dx*dx+dz*dz<=12.25)continue;
 B(x,109,z,x,109,z,K.tealD);B(x,110,z,x,115,z,K.teal);B(x,116,z,x,116,z,K.tealL);}
for(const [cx,cz] of COLS)cylY(116,116,cx,cz,2,K.steelD);
cylY(117,120,PX,PZ,6,K.coralD,3.5);
function nearCol(x,z,r2){for(const [cx,cz] of COLS){const dx=x-cx,dz=z-cz;if(dx*dx+dz*dz<=r2)return true;}return false;}
for(let x=114;x<=154;x++)for(let z=47;z<=83;z++){if(nearCol(x,z,12.25))continue;B(x,80,z,x,80,z,K.tealD);B(x,81,z,x,86,z,K.teal);}
for(const [cx,cz] of COLS)cylY(80,88,cx,cz,5,K.coral,3.5);
cylY(87,90,PX,PZ,4,K.coral);
B(120,72,56,148,79,74,K.steelD);
for(let x=120;x<=148;x++)for(let z=56;z<=74;z++){if((x+z)%4===0||((x-z)%4+4)%4===0)P(x,71,z,K.steelD);}
for(let y=91;y<=133;y++)cylY(y,y,PX,PZ,2,(y%3===0)?K.steelD:K.iron);
cylY(134,139,PX,PZ,4,K.coral);
beam(108,136,PZ,160,136,PZ,1.8,K.steel);
ellipsoid(108,136,PZ,5,5,5,K.coral);ellipsoid(160,136,PZ,5,5,5,K.coral);
beam(160,141,PZ,160,146,PZ,1.2,K.steel);ellipsoid(160,147,PZ,1.8,1.8,1.8,K.cream);

// output table, leather strip, trim knife, offcut chute
B(155,48,52,176,55,80,K.creamD);B(155,56,52,176,56,80,K.cream);
for(let x=101;x<=119;x++){const e0=57+(rng()<0.35?1:0),e1=75-(rng()<0.35?1:0);B(x,57,e0,x,57,e1,K.hide);}
for(let x=120;x<=174;x++){const tr=x>=153;const z0=tr?58:57+(rng()<0.3?1:0),z1=tr?74:75-(rng()<0.3?1:0);
 for(let z=z0;z<=z1;z++){const g=((x+z)%6===0)||(((x-z)%6+6)%6===0);P(x,57,z,g?K.hideD:K.hide);
  if(x>154&&(x+z)%6===3&&((x-z)%6+6)%6===3)P(x,58,z,K.hideL);}}
B(153,54,56,153,62,57,K.steelD);B(153,54,75,153,62,76,K.steelD);B(153,61,56,153,62,76,K.steel);B(153,63,64,153,66,68,K.coral);
beam(160,57,81,164,47,92,0.6,K.hideL);
for(let z=89;z<=102;z++){const y=R(46-(z-89)*6/13);B(160,y,z,170,y,z,K.tealD);B(160,y+1,z,160,y+3,z,K.teal);B(170,y+1,z,170,y+3,z,K.teal);}
beam(165,42,96,172,30,86,0.8,K.tealD);
P(163,45,94,K.hideL);P(166,43,98,K.hideL);P(164,42,100,K.hideL);

// cart track and scrap bin
for(let x=90;x<=186;x+=6)B(x,10,96,x+2,10,120,K.tealX);
B(90,11,100,188,12,101,K.rail);B(90,11,115,188,12,116,K.rail);
B(189,10,98,190,15,103,K.coral);B(189,10,113,190,15,118,K.coral);
B(66,10,100,88,11,118,K.tealD);
B(66,12,100,88,21,100,K.teal);B(66,12,118,88,21,118,K.teal);B(66,12,100,66,21,118,K.teal);B(88,12,100,88,21,118,K.teal);
for(let x=67;x<=87;x++)for(let z=101;z<=117;z++){const h=12+Math.floor(rng()*4);B(x,12,z,x,h,z,rng()<0.5?K.hide:K.hideL);}

// hopper transport cart
B(152,24,103,176,25,113,K.coral);
B(152,21,103,176,23,103,K.coralD);B(152,21,113,176,23,113,K.coralD);
for(const ax of [156,172]){B(ax-2,16,103,ax+2,20,103,K.coralD);B(ax-2,16,113,ax+2,20,113,K.coralD);cylZ(99,117,ax,18,1,K.steelD);}
for(const ax of [156,172])for(const w of [[99,101,102],[115,117,114]]){
 cylZ(w[0],w[1],ax,18,5,K.iron,2.5);cylZ(w[0],w[1],ax,18,2.5,K.coralL,1.5);
 B(ax+3,18,w[0],ax+4,18,w[1],K.coralL);B(ax-4,18,w[0],ax-3,18,w[1],K.coralL);
 cylZ(w[2],w[2],ax,18,6,K.iron,4.5);}
B(155,26,104,157,26,105,K.coralD);B(155,26,111,157,26,112,K.coralD);B(168,26,106,171,26,110,K.coralD);
beam(176,26,104,181,40,104,0.8,K.coral);beam(176,26,112,181,40,112,0.8,K.coral);beam(181,40,104,181,40,112,1,K.coralD);
for(let y=27;y<=36;y++){const t=(y-27)/9,x0=R(156-4*t),x1=R(172+4*t),z0=R(104-4*t),z1=R(112+4*t);
 if(y===27){B(x0,y,z0,x1,y,z1,K.tealD);continue;}
 const c=(y===36)?K.tealD:K.teal;
 B(x0,y,z0,x1,y,z0,c);B(x0,y,z1,x1,y,z1,c);B(x0,y,z0,x0,y,z1,c);B(x1,y,z0,x1,y,z1,c);
 if(y<=31){for(let x=x0+1;x<x1;x++)for(let z=z0+1;z<z1;z++){if(y<=29||rng()<0.5)P(x,y,z,rng()<0.5?K.hide:K.hideL);}}}

// standalone maintenance stand
B(152,24,148,202,25,186,K.creamD);
for(const [lx,lz] of [[153,149],[201,149],[153,185],[201,185]]){cylX(lx-1,lx+1,13,lz,3,K.iron);B(lx-2,17,lz-2,lx+2,18,lz+2,K.steelD);B(lx-1,19,lz-1,lx+1,41,lz+1,K.teal);}
B(154,30,149,200,31,149,K.tealD);
B(150,42,146,204,42,188,K.tealD);B(150,43,146,204,44,188,K.cream);
B(158,45,154,196,45,180,K.tealL);
B(166,46,158,184,47,172,K.steelD);
for(let x=166;x<=184;x++)for(let z=158;z<=172;z++)if((x+z)%4===0||((x-z)%4+4)%4===0)P(x,48,z,K.steel);
B(152,45,178,160,47,186,K.teal);B(152,48,178,160,53,180,K.tealD);B(152,48,184,160,53,186,K.tealD);
cylX(153,159,51,182,1.5,K.coral);
cylZ(187,192,156,50,1,K.steel);beam(152,50,192,160,50,192,0.8,K.steel);
ellipsoid(152,50,192,1.4,1.4,1.4,K.coralD);ellipsoid(160,50,192,1.4,1.4,1.4,K.coralD);
cylY(45,46,198,156,3,K.tealD);cylY(47,66,198,156,1,K.steel);ellipsoid(198,67,156,1.8,1.8,1.8,K.coralD);
beam(198,67,156,186,74,164,1,K.coral);ellipsoid(186,74,164,1.6,1.6,1.6,K.coralD);
beam(186,74,164,180,67,166,0.9,K.coral);
ring(176,66,166,4,1,K.coral,'y');cylY(66,66,176,166,3,K.glass);
B(152,45,146,202,71,147,K.creamD);B(152,72,146,202,72,147,K.coral);
for(let x=155;x<=199;x+=4)for(let y=48;y<=69;y+=4)P(x,y,147,K.tealX);
B(158,50,148,159,62,148,K.hideD);B(155,62,148,162,65,149,K.steelD);
B(168,50,148,169,61,148,K.steel);ring(168,64,148,2.5,0.8,K.steel,'z');
B(176,52,148,184,62,148,K.steel);B(188,52,148,196,62,148,K.coralD);
for(let x=177;x<=183;x+=2)for(let y=53;y<=61;y+=2)P(x,y,149,K.steelD);
B(156,26,152,174,33,166,K.coral);B(155,34,151,175,35,167,K.coralD);B(162,36,158,168,37,160,K.steelD);
cylX(180,198,28,156,2.5,K.steel);cylX(180,198,28,162,2.5,K.steel);cylX(182,196,32,159,2.5,K.steelD);

// raw hide pallet
for(const pz of [146,163,180])B(48,10,pz,94,12,pz+3,K.creamD);
for(let x=48;x<=92;x+=6)B(x,13,146,x+4,13,183,K.cream);
for(let k=0;k<5;k++){const y=14+k*2,col=[K.hide,K.hideD,K.hideL,K.hide,K.hideD][k],sh=(k%2)?2:-1;
 for(let x=50;x<=92;x++){const u=(x-71-sh)/21;if(Math.abs(u)>1)continue;const w=Math.sqrt(1-u*u*u*u);
  const hw=R(16*w+Math.sin(x*0.45+k*1.7)*1.6);if(hw<1)continue;B(x,y,164-hw,x,y+1,164+hw,col);}}
cylX(58,84,27,158,3,K.hideL);cylX(60,82,27,169,3,K.hide);

// operator stool
cylY(27,29,132,138,6,K.coral);cylY(26,26,132,138,4,K.coralD);
for(let k=0;k<3;k++){const a=k*2.094+0.5;beam(132+3*Math.cos(a),25,138+3*Math.sin(a),132+6*Math.cos(a),10,138+6*Math.sin(a),0.9,K.teal);}
ring(132,17,138,5,0.7,K.tealD,'y');

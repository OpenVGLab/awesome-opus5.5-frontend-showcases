const C={base:'#8C8378',conc:'#D9D2C3',concD:'#BDB4A3',asph:'#3E4447',asphL:'#666D70',cream:'#F4EBD9',creamD:'#E2D5BC',wall:'#CFC2A8',teal:'#2A9D8F',tealD:'#1E6B68',tealL:'#7FCFC4',glass:'#BCE3DD',solar:'#2D7F86',solar2:'#3A949A',coral:'#EE7B5B',coralD:'#C8583F',steel:'#9AA4A6',steelD:'#5F6A6D',tire:'#2A2E30',lamp:'#FFE9B8',green:'#4FA383',greenD:'#337A62',trunk:'#8B6B50',soil:'#6E5B47',navy:'#24506A',m2:'#D5DEDC',m3:'#B4C1C0'};
function B(a,b,c,d,e,f,col){box(Math.round(a),Math.round(b),Math.round(c),Math.round(d),Math.round(e),Math.round(f),col);}
function discX(x0,x1,cy,cz,r,col){const R=Math.ceil(r);for(let dy=-R;dy<=R;dy++)for(let dz=-R;dz<=R;dz++)if(dy*dy+dz*dz<=r*r+0.3)B(x0,cy+dy,cz+dz,x1,cy+dy,cz+dz,col);}
function discZ(z0,z1,cx,cy,r,col){const R=Math.ceil(r);for(let dx=-R;dx<=R;dx++)for(let dy=-R;dy<=R;dy++)if(dx*dx+dy*dy<=r*r+0.3)B(cx+dx,cy+dy,z0,cx+dx,cy+dy,z1,col);}

// ground plinth, road, yard surfaces
B(30,4,36,226,7,222,C.base);
B(30,8,36,226,10,111,C.conc);
B(30,8,112,140,10,195,C.conc);
B(30,8,196,83,10,197,C.concD);
B(125,8,196,140,10,197,C.concD);
B(84,8,196,124,9,196,C.asphL);
B(84,8,197,124,8,197,C.asph);
B(30,8,198,226,8,222,C.asph);
for(let x=34;x<=218;x+=14)B(x,8,209,x+7,8,210,C.cream);
B(150,8,200,222,8,200,C.coral);B(150,8,206,222,8,206,C.coral);B(150,8,200,150,8,206,C.coral);B(222,8,200,222,8,206,C.coral);
B(30,10,40,123,10,106,C.concD);
B(36,10,107,124,10,157,C.asphL);
B(84,10,158,124,10,195,C.asphL);
B(38,10,58,115,10,59,C.steelD);B(38,10,90,115,10,91,C.steelD);
for(let x=40;x<=59;x++)for(let z=54;z<=96;z++){if((x+z)%8===0&&(z<58||z>59)&&(z<90||z>91))block(x,10,z,C.cream);}
for(const lx of [36,62,89,116])B(lx,10,107,lx+1,10,122,C.cream);
for(let i=0;i<8;i++)B(97+4*i,10,128,98+4*i,10,142,C.cream);
for(let z=112;z<=195;z+=8)B(125,10,z,140,10,z,C.concD);
for(let x=136;x<=226;x+=12)B(x,10,36,x,10,111,C.concD);
for(let z=48;z<=111;z+=12)B(124,10,z,226,10,z,C.concD);

// raised transit platform
B(141,8,112,226,15,197,C.wall);
B(141,12,112,226,12,112,C.tealD);B(141,12,112,141,12,197,C.tealD);B(141,12,197,226,12,197,C.tealD);B(226,12,112,226,12,197,C.tealD);
B(141,16,112,226,16,197,C.creamD);
for(let x=150;x<=222;x+=9)B(x,16,113,x,16,189,C.wall);
for(let z=121;z<=187;z+=9)B(142,16,z,225,16,z,C.wall);
B(158,16,156,221,16,187,C.cream);
B(141,16,190,226,16,192,C.coral);
B(141,16,193,226,16,197,C.cream);
B(141,16,112,226,16,112,C.cream);B(141,16,112,141,16,189,C.cream);B(226,16,112,226,16,189,C.cream);
for(let i=1;i<=5;i++){const xa=141-2*i,t=16-i;B(xa,8,124,xa+1,t,146,C.conc);B(xa,t,124,xa,t,146,C.coral);}
function railX(x0,x1,z){B(x0,19,z,x1,19,z,C.teal);B(x0,22,z,x1,22,z,C.teal);for(let x=x0;x<=x1;x+=6)B(x,17,z,x,21,z,C.tealD);B(x1,17,z,x1,21,z,C.tealD);}
function railZ(z0,z1,x){B(x,19,z0,x,19,z1,C.teal);B(x,22,z0,x,22,z1,C.teal);for(let z=z0;z<=z1;z+=6)B(x,17,z,x,21,z,C.tealD);B(x,17,z1,x,21,z1,C.tealD);}
railX(141,226,112);
railZ(112,123,141);
railZ(147,189,141);
railZ(112,189,226);
for(const z of [123,147]){line(131,16,z,141,22,z,C.teal);B(131,11,z,131,15,z,C.tealD);B(136,11,z,136,18,z,C.tealD);}

// puzzle parking lift: frame
const PX=[38,65,92];
B(31,11,43,43,11,49,C.steelD);B(110,11,43,122,11,49,C.steelD);
for(const x of [57,65,84,92])B(x-1,11,43,x+5,11,49,C.steelD);
B(31,11,98,37,11,105,C.steelD);B(116,11,98,122,11,105,C.steelD);
B(32,12,44,42,72,49,C.teal);B(111,12,44,121,72,49,C.teal);
for(const x of [57,65,84,92])B(x,12,44,x+4,72,49,C.teal);
B(32,12,99,36,72,104,C.teal);B(117,12,99,121,72,104,C.teal);
B(32,73,44,121,78,49,C.tealD);B(32,73,99,121,78,104,C.tealD);
B(32,73,50,36,78,98,C.tealD);B(117,73,50,121,78,98,C.tealD);
for(const sx of [32,117]){B(sx,29,50,sx+4,30,98,C.tealD);B(sx,50,50,sx+4,51,98,C.tealD);beam(sx+2,13,51,sx+2,71,97,1,C.tealD);beam(sx+2,71,51,sx+2,13,97,1,C.tealD);}
for(const px of PX){const a=px+5,b=px+18;beam(a,13,47,b,41,47,0.8,C.tealD);beam(b,13,47,a,41,47,0.8,C.tealD);beam(a,43,47,b,71,47,0.8,C.tealD);beam(b,43,47,a,71,47,0.8,C.tealD);}
for(const px of PX){for(const cx of [px+2,px+21]){for(let y=12;y<=70;y++)block(cx,y,43,(y%2===0)?C.tire:C.steelD);for(let y=13;y<=71;y+=3)B(cx-1,y,49,cx+1,y,49,C.steelD);}}
for(const px of PX){beam(px+8,75,41.5,px+15,75,41.5,2,C.cream);B(px+10,70,40,px+13,72,43,C.steelD);discZ(42,43,px+2,72,2,C.steel);discZ(42,43,px+21,72,2,C.steel);}
beam(33,76,42,120,76,42,0.7,C.steel);

// pallets and cars
function car(x0,y0,z0,body){
  B(x0+1,y0+2,z0+1,x0+16,y0+6,z0+34,body);
  B(x0+2,y0+2,z0,x0+15,y0+6,z0+35,body);
  B(x0+2,y0+7,z0+2,x0+15,y0+7,z0+33,body);
  B(x0+2,y0+8,z0+9,x0+15,y0+8,z0+28,C.glass);
  B(x0+2,y0+9,z0+10,x0+15,y0+10,z0+26,C.glass);
  B(x0+3,y0+11,z0+11,x0+14,y0+11,z0+24,C.glass);
  B(x0+3,y0+12,z0+12,x0+14,y0+12,z0+23,body);
  B(x0+2,y0+8,z0+18,x0+2,y0+10,z0+19,body);B(x0+15,y0+8,z0+18,x0+15,y0+10,z0+19,body);
  B(x0+3,y0+11,z0+18,x0+3,y0+11,z0+19,body);B(x0+14,y0+11,z0+18,x0+14,y0+11,z0+19,body);
  B(x0+2,y0+2,z0,x0+15,y0+3,z0,C.steelD);B(x0+2,y0+2,z0+35,x0+15,y0+3,z0+35,C.steelD);
  B(x0+2,y0+5,z0+35,x0+4,y0+6,z0+35,C.lamp);B(x0+13,y0+5,z0+35,x0+15,y0+6,z0+35,C.lamp);
  B(x0+6,y0+4,z0+35,x0+11,y0+5,z0+35,C.steelD);
  B(x0+2,y0+5,z0,x0+4,y0+6,z0,C.coralD);B(x0+13,y0+5,z0,x0+15,y0+6,z0,C.coralD);
  for(const wz of [z0+7,z0+28]){discX(x0,x0+2,y0+3,wz,3,C.tire);discX(x0+15,x0+17,y0+3,wz,3,C.tire);discX(x0,x0,y0+3,wz,1,C.steel);discX(x0+17,x0+17,y0+3,wz,1,C.steel);}
  block(x0+1,y0+8,z0+25,body);block(x0+16,y0+8,z0+25,body);
}
function pallet(px,py,pz,upper){
  if(upper){
    B(px+1,py-1,pz+1,px+22,py-1,pz+44,C.steelD);
    B(px,py-1,pz-2,px+4,py+8,pz-1,C.steelD);
    B(px+19,py-1,pz-2,px+23,py+8,pz-1,C.steelD);
  }
  B(px,py,pz,px+23,py+1,pz+45,C.steel);
  for(let z=pz+1;z<=pz+44;z++){const c=(z%3===0)?C.steelD:C.steel;B(px+3,py+2,z,px+7,py+2,z,c);B(px+16,py+2,z,px+20,py+2,z,c);}
  B(px,py,pz,px,py+3,pz+45,C.tealD);B(px+23,py,pz,px+23,py+3,pz+45,C.tealD);
  for(let x=px+1;x<=px+22;x++){const c=(Math.floor((x-px)/3)%2===0)?C.coral:C.cream;B(x,py,pz+45,x,py+1,pz+45,c);}
  B(px+3,py+3,pz+7,px+7,py+3,pz+8,C.coral);B(px+16,py+3,pz+7,px+20,py+3,pz+8,C.coral);
  if(!upper){
    B(px+3,py,pz+46,px+7,py+1,pz+47,C.steel);B(px+16,py,pz+46,px+20,py+1,pz+47,C.steel);
    B(px+3,py,pz+48,px+7,py,pz+49,C.steel);B(px+16,py,pz+48,px+20,py,pz+49,C.steel);
  }
}
pallet(65,11,52,false);car(68,14,57,C.coral);
pallet(92,11,52,false);car(95,14,57,C.navy);
pallet(38,32,52,true);car(41,35,57,C.cream);
pallet(65,32,52,true);car(68,35,57,C.teal);
pallet(92,32,52,true);car(95,35,57,C.coral);
pallet(38,53,52,true);car(41,56,57,C.tealL);
pallet(65,53,52,true);car(68,56,57,C.creamD);
pallet(92,53,52,true);

// solar canopy
B(30,79,40,123,79,106,C.tealD);
B(30,80,40,123,80,106,C.cream);
for(let i=0;i<7;i++)for(let j=0;j<5;j++){const xa=32+13*i,za=41+13*j;B(xa,80,za,xa+11,80,za+11,((i+j)%2===0)?C.solar:C.solar2);}
B(30,78,40,123,81,40,C.coral);B(30,78,106,123,81,106,C.coral);B(30,78,40,30,81,106,C.coral);B(123,78,40,123,81,106,C.coral);

// control pedestal and cones
B(124,11,106,127,23,109,C.cream);B(124,24,106,127,24,109,C.tealD);B(124,16,110,127,21,110,C.teal);block(125,19,111,C.coral);block(126,19,111,C.lamp);
function tcone(x,z){B(x-2,11,z-2,x+2,11,z+2,C.tire);cone(x,12,z,2.2,0.4,8,C.coral);cone(x,15,z,1.6,1.2,2,C.cream);}
tcone(125,88);tcone(151,90);

// ticket booth island and entry barrier
B(60,11,158,83,12,190,C.concD);
for(let x=60;x<=83;x++){const c=(Math.floor((x-60)/3)%2===0)?C.coral:C.cream;B(x,11,190,x,12,190,c);B(x,12,188,x,12,189,c);}
B(62,13,161,76,13,177,C.tealD);
B(63,14,161,75,19,177,C.cream);B(62,14,162,76,19,176,C.cream);
B(63,20,161,75,20,177,C.tealD);B(62,20,162,76,20,176,C.tealD);
B(63,21,161,75,27,177,C.glass);B(62,21,162,76,27,176,C.glass);
for(const [x,z] of [[62,162],[76,162],[62,176],[76,176],[63,161],[75,161],[63,177],[75,177],[69,161],[69,177],[62,169],[76,169]])B(x,21,z,x,27,z,C.teal);
B(63,28,161,75,28,177,C.tealD);B(62,28,162,76,28,176,C.tealD);
B(60,29,158,78,29,180,C.coral);B(59,29,159,79,29,179,C.coral);
B(61,30,159,77,30,179,C.cream);B(60,30,160,78,30,178,C.cream);
B(65,31,165,73,32,173,C.teal);B(64,33,164,74,33,174,C.cream);
B(62,14,166,62,27,172,C.tealD);block(61,20,171,C.steel);
B(76,21,165,76,26,173,C.lamp);B(77,20,164,78,20,174,C.teal);
B(80,13,168,82,19,172,C.tealD);B(83,16,169,83,18,171,C.tealL);
B(78,13,181,83,23,187,C.cream);B(78,24,181,83,24,187,C.coral);B(80,25,183,81,26,185,C.lamp);
discZ(183,186,86,21,2,C.steelD);
for(let x=89;x<=121;x++){const c=(Math.floor((x-89)/4)%2===0)?C.coral:C.cream;B(x,21,184,x,22,185,c);}
B(119,11,183,122,20,186,C.tealD);

// waiting shelter
function roofY(z){return 37+Math.round(2.5*Math.sin(Math.PI*(z-154)/36));}
B(162,18,159,217,34,159,C.glass);
B(160,17,158,219,17,159,C.tealD);B(160,35,158,219,35,159,C.tealD);
B(160,18,160,160,34,175,C.glass);B(219,18,160,219,34,175,C.glass);
B(160,17,160,161,17,175,C.tealD);B(218,17,160,219,17,175,C.tealD);
B(160,35,160,161,35,175,C.tealD);B(218,35,160,219,35,175,C.tealD);
for(const px of [160,179,199,218])B(px,17,158,px+1,roofY(158)-1,159,C.cream);
B(160,17,176,161,roofY(176)-1,177,C.cream);B(218,17,176,219,roofY(176)-1,177,C.cream);
for(let z=154;z<=190;z++){const y=roofY(z);B(156,y,z,223,y,z,C.tealD);B(156,y+1,z,223,y+1,z,C.cream);B(156,y,z,156,y+1,z,C.coral);B(223,y,z,223,y+1,z,C.coral);}
B(156,roofY(190),190,223,roofY(190)+1,190,C.coral);
for(const px of [160,179,199,218])beam(px+0.5,30,160,px+0.5,roofY(178)-1,178,0.8,C.cream);
B(166,21,161,212,22,165,C.coral);B(166,23,161,212,26,161,C.coralD);
for(const lx of [168,189,210])B(lx,17,162,lx+1,20,164,C.cream);
B(162,roofY(186)-1,186,217,roofY(186)-1,186,C.lamp);
B(213,20,160,217,32,160,C.lamp);B(214,22,160,214,30,160,C.teal);B(214,26,160,217,26,160,C.coral);block(216,29,160,C.tealD);
cylinder(211,17,186,2,6,C.tealD);cylinder(211,23,186,2,1,C.coral);
B(146,17,186,147,42,187,C.tealD);discZ(186,187,147,46,4.6,C.coral);discZ(186,187,147,46,3.2,C.cream);discZ(186,187,147,46,1.8,C.tealD);
B(224,17,148,225,52,149,C.tealD);B(213,52,148,225,53,149,C.tealD);B(211,50,147,216,51,150,C.cream);B(212,49,148,215,49,149,C.lamp);
for(let i=0;i<5;i++){const x=152+6*i;B(x,17,119,x,22,119,C.teal);B(x,17,125,x,22,125,C.teal);B(x,23,119,x,23,125,C.teal);}

// planting
function tree(x,y,z,s){beam(x,y,z,x,y+16*s,z,1.7*s,C.trunk);beam(x,y+11*s,z,x-6*s,y+17*s,z-4*s,1,C.trunk);beam(x,y+12*s,z,x+6*s,y+18*s,z+4*s,1,C.trunk);
  ellipsoid(x,y+23*s,z,11*s,8*s,11*s,C.green);ellipsoid(x-6*s,y+22*s,z-5*s,6*s,5*s,6*s,C.greenD);ellipsoid(x+5*s,y+27*s,z+4*s,6*s,5*s,6*s,C.green);ellipsoid(x+6*s,y+20*s,z+6*s,5*s,4*s,5*s,C.greenD);}
function planter(x0,z0,x1,z1,y0){B(x0,y0,z0,x1,y0+2,z1,C.concD);B(x0+1,y0+2,z0+1,x1-1,y0+2,z1-1,C.soil);}
planter(196,118,220,142,17);tree(208,19,130,1);
planter(33,164,55,192,11);tree(44,13,178,1);
planter(168,84,190,106,11);tree(179,13,95,0.9);

// service corner: parts rack, power cabinet, yard lamp, bollards
for(const x of [192,207,223])for(const z of [38,47])B(x,11,z,x+1,41,z+1,C.tealD);
for(const y of [19,29,40])B(192,y,38,224,y,48,C.steel);
B(195,20,40,202,25,46,C.coral);B(204,20,41,208,23,45,C.cream);
discZ(42,43,215,24,4,C.steelD);discZ(42,43,215,24,1.5,C.steel);
ring(199,31,43,4,1,C.tire,'y');
B(208,30,39,221,31,47,C.creamD);B(210,32,40,219,32,46,C.coral);
B(196,41,40,203,45,46,C.tealL);B(211,41,40,219,44,46,C.coral);
B(156,11,56,162,26,62,C.cream);B(155,27,55,163,27,63,C.tealD);B(163,13,57,163,24,61,C.teal);block(163,21,59,C.lamp);
line(147,11,60,155,11,60,C.tire);
B(126,11,190,127,50,191,C.tealD);B(116,50,190,127,51,191,C.tealD);B(114,48,189,119,49,192,C.cream);B(115,47,190,118,47,191,C.lamp);
for(let z=152;z<=184;z+=8){cylinder(128,11,z,1,5,C.cream);block(128,16,z,C.coral);}

// maintenance tool truck
for(const wz of [56,76]){discX(128,130,15,wz,4,C.tire);discX(144,146,15,wz,4,C.tire);discX(128,128,15,wz,1.5,C.steel);discX(146,146,15,wz,1.5,C.steel);}
B(131,12,50,143,15,82,C.steelD);
B(129,16,49,145,16,69,C.steel);
B(129,17,49,129,19,69,C.coral);B(130,17,49,136,19,49,C.coral);
B(137,17,50,143,27,68,C.cream);B(137,28,50,143,28,68,C.coralD);
B(143,20,51,143,20,67,C.creamD);B(143,24,51,143,24,67,C.creamD);
B(138,21,54,142,23,64,C.m2);B(143,21,54,143,23,64,C.tealL);B(144,22,57,144,22,61,C.tealL);
ring(133,21,63,3,1.2,C.tire,'x');beam(131,21,63,135,21,63,0.8,C.steelD);
B(130,16,70,144,22,82,C.coral);
B(130,23,70,144,28,80,C.glass);
B(130,23,70,130,28,70,C.coral);B(144,23,70,144,28,70,C.coral);B(130,23,79,130,28,80,C.coral);B(144,23,79,144,28,80,C.coral);
B(130,29,69,144,30,81,C.cream);
B(132,18,82,142,20,82,C.steelD);B(131,20,82,132,21,82,C.lamp);B(142,20,82,143,21,82,C.lamp);
B(130,14,83,144,15,83,C.steelD);
B(136,31,74,138,32,76,C.lamp);block(137,33,75,C.coralD);
block(129,24,79,C.steelD);block(145,24,79,C.steelD);
B(130,17,50,136,30,50,C.tealD);B(130,17,56,136,30,56,C.tealD);B(130,17,51,130,30,55,C.tealD);B(136,17,51,136,30,55,C.tealD);
B(131,17,51,135,38,51,C.m2);B(131,17,55,135,38,55,C.m2);B(131,17,52,131,38,54,C.m2);B(135,17,52,135,38,54,C.m2);
B(132,17,52,134,44,54,C.m3);
B(130,45,50,136,48,56,C.cream);B(129,46,51,129,47,55,C.lamp);

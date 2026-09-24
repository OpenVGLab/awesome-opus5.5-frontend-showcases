const C={water:'#4F6E7E',waterL:'#6A8A98',waterD:'#3A5563',foam:'#DCE3E2',stone:'#BEB9AE',stoneD:'#A19C91',stoneL:'#D5D1C7',mortar:'#8C877D',hull:'#35434F',hullL:'#4C5C69',ochre:'#C48A3F',ochreD:'#9A6A2E',ochreL:'#DDAE68',sup:'#D9D6CD',supD:'#B7B3A9',deck:'#827E75',deckD:'#64615B',glass:'#2E3D4A',red:'#D2462F',green:'#3DA35A',lamp:'#FFF1B8',orange:'#EB7A2C',net:'#B5733A',netT:'#9C6A3B',bag:'#C27D3E',bagD:'#8E5A2C',fish:'#C9D1D4',rope:'#CDB892',tire:'#2A2D30',steel:'#8D949A',steelD:'#59616A',wood:'#9C7651',radar:'#E4E1D8',winch:'#6F7C86',flange:'#B98E4A',spoke:'#4A3D30',white:'#F1EFE8'};
function B(a,b,c,d,e,f,col){box(Math.round(a),Math.round(b),Math.round(c),Math.round(d),Math.round(e),Math.round(f),col);}
function discX(x0,x1,cy,cz,r,col){const R=Math.ceil(r);for(let dy=-R;dy<=R;dy++)for(let dz=-R;dz<=R;dz++)if(dy*dy+dz*dz<=r*r+0.3)B(x0,cy+dy,cz+dz,x1,cy+dy,cz+dz,col);}
function discZ(z0,z1,cx,cy,r,col){const R=Math.ceil(r);for(let dx=-R;dx<=R;dx++)for(let dy=-R;dy<=R;dy++)if(dx*dx+dy*dy<=r*r+0.3)B(cx+dx,cy+dy,z0,cx+dx,cy+dy,z1,col);}
function rope(a,b,sag,r,col){const n=Math.max(6,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2])/3));let p=a;for(let i=1;i<=n;i++){const t=i/n;const q=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t-sag*4*t*(1-t),a[2]+(b[2]-a[2])*t];beam(p[0],p[1],p[2],q[0],q[1],q[2],r,col);p=q;}}
function drumZ(cx,cy,zA,zB,rF,rW,fl,core,spk,acc,nS,nA){const R=Math.ceil(rF);for(let dx=-R;dx<=R;dx++)for(let dy=-R;dy<=R;dy++){const r=Math.sqrt(dx*dx+dy*dy);if(r>rF+0.3)continue;const a=Math.atan2(dy,dx);const near=(n)=>{const s=2*Math.PI/n;const m=((a%s)+s)%s;return Math.min(m,s-m)*r<0.8;};const fc=(r>=2.5&&r<=rF-0.8&&near(nS))?spk:fl;B(cx+dx,cy+dy,zA,cx+dx,cy+dy,zA+1,fc);B(cx+dx,cy+dy,zB-1,cx+dx,cy+dy,zB,fc);if(r<=rW+0.3){const wc=(r>=rW-1.6&&near(nA))?acc:core;B(cx+dx,cy+dy,zA+2,cx+dx,cy+dy,zB-2,wc);}}}

// harbour water
B(28,4,58,228,10,214,C.waterD);
B(28,11,58,228,11,214,C.water);
for(let z=60;z<=212;z+=5)for(let x=28;x<=228;x++){const s=Math.sin(x*0.23+z*0.9)+0.5*Math.sin(x*0.07-z*0.3);if(s>1.05){const zz=z+Math.round(Math.sin(x*0.05+z)*1.5);if(zz>=58&&zz<=214)block(x,11,zz,C.waterL);}}
B(28,11,58,228,11,58,C.waterL);

// stone quay
B(28,4,30,228,23,57,C.stone);
function quayFace(z){for(let r=0;r<5;r++){const y0=4+4*r;for(let k=-1;k<21;k++){const x0=28+10*k+(r%2)*5;const xa=Math.max(28,x0),xb=Math.min(228,x0+9);if(xa>xb)continue;const c=[C.stone,C.stoneD,C.stoneL][(k*7+r*3+11)%3];B(xa,y0,z,xb,y0+3,z,c);B(xa,y0+3,z,xb,y0+3,z,C.mortar);if(x0>=28)B(x0,y0,z,x0,y0+3,z,C.mortar);}}}
quayFace(57);quayFace(30);
B(28,24,30,228,24,57,C.stoneL);
for(let x=34;x<=226;x+=12)B(x,24,30,x,24,53,C.stoneD);
B(28,24,54,228,24,54,C.stoneD);
B(28,25,55,228,25,57,C.stoneL);
for(const x of [58,118,178,222]){cylinder(x,25,50,1.8,4,C.hull);cylinder(x,29,50,2.6,1,C.hull);}
for(const x of [60,90,120,150,180]){ring(x,17,58,3,1.2,C.tire,'z');line(x,24,58,x,21,58,C.steelD);}
B(104,12,58,104,24,58,C.steelD);B(107,12,58,107,24,58,C.steelD);for(let y=13;y<=23;y+=2)B(105,y,58,106,y,58,C.steelD);
function crate(x,y,z,c){B(x,y,z,x+7,y+5,z+7,c);B(x,y+2,z,x+7,y+2,z+7,C.wood);B(x,y+5,z,x+7,y+5,z+7,C.ochreD);}
crate(140,25,35,C.ochre);crate(140,31,35,C.ochreL);crate(149,25,35,C.wood);crate(140,25,44,C.ochreL);crate(149,25,44,C.ochre);crate(149,31,44,C.ochre);
function fishbox(x,z){B(x,25,z,x+8,27,z+6,C.hullL);B(x+1,27,z+1,x+7,27,z+5,C.foam);B(x+2,28,z+2,x+4,28,z+2,C.fish);B(x+4,28,z+4,x+6,28,z+4,C.fish);}
fishbox(160,36);fishbox(160,44);fishbox(170,40);
ellipsoid(76,24,44,12,5,8,C.netT);
for(let k=0;k<14;k++){const a=k*2*Math.PI/14;const dx=Math.round(8*Math.cos(a)),dz=Math.round(5*Math.sin(a));const q=1-(dx/12)*(dx/12)-(dz/8)*(dz/8);const y=24+Math.floor(5*Math.sqrt(Math.max(0,q)));block(76+dx,y+1,44+dz,C.orange);}
B(110,25,50,111,48,51,C.hull);B(110,48,51,111,49,55,C.hull);B(109,46,54,112,47,56,C.supD);B(110,45,55,111,45,55,C.lamp);
B(203,25,38,213,26,48,C.steelD);
cylinder(208,27,43,3,24,C.ochre);
B(203,50,39,213,57,47,C.ochre);B(203,53,39,203,56,46,C.glass);B(204,53,47,212,56,47,C.glass);
beam(208,58,43,208,67,43,1,C.ochre);
beam(206,57,43,176,74,43,1.4,C.ochre);
beam(210,57,43,224,59,43,1.2,C.ochre);
B(219,52,40,226,58,46,C.hull);
line(208,67,43,177,75,43,C.steelD);line(208,67,43,224,60,43,C.steelD);
line(176,72,43,176,58,43,C.steelD);B(175,55,42,177,57,44,C.hull);block(176,54,43,C.steelD);

// stern trawler hull
const ZC=84;
function hbDeck(x){if(x<40||x>196)return -1;if(x<84){const u=(84-x)/44;return 19*Math.sqrt(Math.max(0,1-u*u));}if(x<=180)return 19;const u=(x-180)/16;return 19-2*u*u;}
function tDeck(x){return x<78?34+Math.round(3*Math.pow((78-x)/38,2)):26;}
function tW(x,y){if(x<40||x>196)return -1;const top=tDeck(x);const sh=x<84?Math.max(0,(top+3-y)*0.42):0;const h=hbDeck(x-sh);return h<0?-1:Math.floor(h+0.35);}
function rampY(x){return 26-Math.round((x-178)*13/18);}
for(let x=40;x<=196;x++){
  const top=tDeck(x);
  for(let y=8;y<=top+3;y++){
    const w=tW(x,y);if(w<0)continue;
    if(y>top){
      const wp=tW(x-1,y),wn=tW(x+1,y);
      let lo=Math.max(0,Math.min(w,wp<0?0:wp,wn<0?0:wn));
      if(x>=178&&lo<8)lo=8;
      const cc=(y===top+3)?C.ochreL:C.hull;
      B(x,y,ZC-w,x,y,ZC-lo,cc);B(x,y,ZC+lo,x,y,ZC+w,cc);
      continue;
    }
    const col=y<=11?C.hull:(y<=13?C.ochreD:(y===22?C.ochre:C.hull));
    const ramp=(x>=178&&y>rampY(x));
    if(y===top){
      if(ramp){B(x,y,ZC-w,x,y,ZC-8,C.deck);B(x,y,ZC+8,x,y,ZC+w,C.deck);}
      else B(x,y,ZC-w,x,y,ZC+w,C.deck);
      B(x,y,ZC-w,x,y,ZC-w,col);B(x,y,ZC+w,x,y,ZC+w,col);
    } else if(ramp){B(x,y,ZC-w,x,y,ZC-8,col);B(x,y,ZC+8,x,y,ZC+w,col);}
    else B(x,y,ZC-w,x,y,ZC+w,col);
  }
}
for(let x=178;x<=196;x++){const ry=rampY(x);B(x,ry,ZC-7,x,ry,ZC+7,(x%2===0)?C.deckD:C.deck);}
for(let z=ZC-16;z<=ZC+16;z+=4)B(123,26,z,177,26,z,C.deckD);
for(let x=126;x<=182;x+=8){block(x,27,ZC-19,C.deckD);block(x,27,ZC+19,C.deckD);}
for(let x=50;x<=74;x+=6){const w=tW(x,30);if(w>0){block(x,30,ZC-w,C.glass);block(x,30,ZC+w,C.glass);}}
for(let x=90;x<=170;x+=8){block(x,19,ZC-19,C.glass);block(x,19,ZC+19,C.glass);}
for(const s of [-1,1]){for(let y=27;y<=31;y++){const w=tW(51,y);if(w>0)B(50,y,ZC+s*(w+1),52,y,ZC+s*(w+1),C.steelD);}}

// forecastle fittings
B(58,35,ZC-5,64,38,ZC+5,C.steelD);discZ(ZC-7,ZC-6,61,38,2,C.steel);discZ(ZC+6,ZC+7,61,38,2,C.steel);
for(const s of [-1,1])cylinder(54,36,ZC+s*8,1.5,3,C.hull);
beam(46,37,ZC,46,58,ZC,0.8,C.sup);block(46,59,ZC,C.lamp);

// deckhouse, wheelhouse, mast, funnel
B(78,27,ZC-16,122,40,ZC+16,C.sup);
B(78,40,ZC-16,122,40,ZC+16,C.supD);
for(let x=82;x<=118;x+=6){B(x,33,ZC-16,x+1,34,ZC-16,C.glass);B(x,33,ZC+16,x+1,34,ZC+16,C.glass);}
B(78,35,ZC-12,78,37,ZC+12,C.glass);for(let z=ZC-12;z<=ZC+12;z+=4)B(78,35,z,78,37,z,C.sup);
B(113,27,ZC-16,115,32,ZC-16,C.supD);B(113,27,ZC+16,115,32,ZC+16,C.supD);
function railLine(x0,z0,x1,z1,y){B(x0,y+2,z0,x1,y+2,z1,C.supD);if(x0===x1){for(let z=Math.min(z0,z1);z<=Math.max(z0,z1);z+=4)B(x0,y,z,x0,y+1,z,C.supD);}else{for(let x=Math.min(x0,x1);x<=Math.max(x0,x1);x+=4)B(x,y,z0,x,y+1,z0,C.supD);}}
railLine(78,ZC-16,122,ZC-16,41);railLine(78,ZC+16,122,ZC+16,41);railLine(122,ZC-16,122,ZC+16,41);
B(84,41,ZC-13,110,52,ZC+13,C.sup);
B(84,46,ZC-13,110,50,ZC+13,C.glass);
for(let x=86;x<=108;x+=4){B(x,46,ZC-13,x,50,ZC-13,C.sup);B(x,46,ZC+13,x,50,ZC+13,C.sup);}
for(let z=ZC-11;z<=ZC+11;z+=4){B(84,46,z,84,50,z,C.sup);B(110,46,z,110,50,z,C.sup);}
B(82,53,ZC-15,112,54,ZC+15,C.supD);
B(86,50,ZC-14,87,51,ZC-14,C.green);B(86,50,ZC+14,87,51,ZC+14,C.red);
beam(100,55,ZC,100,86,ZC,1.2,C.sup);beam(106,55,ZC-6,100,77,ZC,0.9,C.sup);beam(106,55,ZC+6,100,77,ZC,0.9,C.sup);
B(99,77,ZC-8,101,77,ZC+8,C.sup);
B(99,79,ZC-1,101,80,ZC+1,C.lamp);B(99,83,ZC-1,101,84,ZC+1,C.green);block(100,87,ZC,C.lamp);
B(89,55,ZC-1,91,57,ZC+1,C.steelD);B(89,58,ZC-7,91,59,ZC+7,C.radar);
B(114,41,ZC-5,121,58,ZC+5,C.hull);B(114,52,ZC-5,121,54,ZC+5,C.ochre);B(114,59,ZC-5,121,59,ZC+5,C.tire);
B(116,60,ZC-2,117,63,ZC-1,C.steelD);B(118,60,ZC+1,119,62,ZC+2,C.steelD);
for(const s of [-1,1]){beam(113,42,ZC+s*12,119,42,ZC+s*12,2,C.white);discX(116,116,42,ZC+s*12,2.1,C.ochre);}
ring(123,34,ZC-9,2.3,0.8,C.orange,'x');ring(123,34,ZC+9,2.3,0.8,C.orange,'x');

// aft working deck: hatch, trawl winches, net drum
B(125,27,ZC-6,133,28,ZC+6,C.ochreD);B(126,29,ZC-5,132,29,ZC+5,C.deckD);
B(124,27,ZC+9,129,30,ZC+14,C.wood);B(124,31,ZC+9,129,33,ZC+14,C.ochre);B(124,27,ZC-14,129,30,ZC-9,C.ochre);
B(136,27,ZC-18,152,28,ZC+18,C.steelD);
B(139,29,ZC-9,149,39,ZC+9,C.steel);B(141,40,ZC-4,147,43,ZC+4,C.steelD);
drumZ(144,35,ZC+11,ZC+18,6,4.3,C.flange,C.winch,C.spoke,C.spoke,4,5);
drumZ(144,35,ZC-18,ZC-11,6,4.3,C.flange,C.winch,C.spoke,C.spoke,4,5);
beam(144,35,ZC-17,144,35,ZC+17,1.2,C.steelD);
for(const s of [-1,1]){const za=ZC+s*12,zb=ZC+s*13;B(165,27,Math.min(za,zb),171,38,Math.max(za,zb),C.steelD);discZ(Math.min(za,zb),Math.max(za,zb),168,40,3,C.steelD);}
drumZ(168,40,ZC-11,ZC+11,12,10,C.flange,C.net,C.spoke,C.orange,6,8);
beam(168,40,ZC-13,168,40,ZC+13,1.4,C.steelD);
for(let x=164;x<=196;x++){const sy=x<=178?26:rampY(x);for(let z=ZC-6;z<=ZC+6;z++)block(x,sy+1,z,((x+z)%3===0)?C.rope:C.netT);}
B(164,28,ZC-5,170,29,ZC+5,C.netT);

// stern gantry, trawl doors, warps
for(const s of [-1,1]){
  const za=ZC+s*15,zb=ZC+s*18;
  B(188,27,Math.min(za,zb),191,63,Math.max(za,zb),C.ochre);
  beam(189.5,55,ZC+s*15,189.5,63,ZC+s*9,1,C.ochre);
  B(187,59,Math.min(ZC+s*14,ZC+s*12),191,63,Math.max(ZC+s*14,ZC+s*12),C.steelD);
  discX(186,186,61,ZC+s*13,1.5,C.steel);
  const d0=Math.min(ZC+s*20,ZC+s*21),d1=Math.max(ZC+s*20,ZC+s*21);
  B(184,31,d0,195,42,d1,C.ochreD);B(184,31,d0,195,31,d1,C.steelD);B(184,31,d0,184,42,d1,C.hull);B(195,31,d0,195,42,d1,C.hull);B(189,33,d0,190,40,d1,C.hull);
  B(188,46,Math.min(ZC+s*18,ZC+s*21),191,47,Math.max(ZC+s*18,ZC+s*21),C.ochre);
  line(189,45,ZC+s*20,189,43,ZC+s*20,C.steelD);line(190,45,ZC+s*21,190,43,ZC+s*21,C.steelD);
  line(146,40,ZC+s*13,189,58,ZC+s*13,C.steelD);line(191,58,ZC+s*13,206,11,ZC+s*13,C.steelD);
  block(206,11,ZC+s*13,C.foam);
}
B(187,64,ZC-18,192,68,ZC+18,C.ochre);
B(187,69,ZC-18,192,69,ZC+18,C.ochreD);
block(192,66,ZC-10,C.lamp);block(192,66,ZC+10,C.lamp);

// cod-end on the stern ramp
for(let x=186;x<=196;x++)for(let z=ZC-7;z<=ZC+7;z++){
  const u=(x-191)/5.8,v=(z-ZC)/7.8;const q=1-u*u-v*v;if(q<=0)continue;
  const h=Math.max(1,Math.round(5.5*Math.sqrt(q)));const b0=rampY(x)+3;
  for(let y=b0;y<b0+h;y++){let c=((x+y+z)%3===0)?C.bagD:C.bag;if(y===b0+h-1&&(x*7+z*3)%11===0)c=C.orange;if(q<0.4&&(x+y+z)%4===1)c=C.fish;block(x,y,z,c);}
}

// mooring lines
cylinder(182,27,ZC-15,1.5,3,C.hull);
rope([54,39,ZC-8],[58,30,50],2,0.6,C.rope);
rope([182,30,ZC-15],[178,30,50],1.5,0.6,C.rope);

// harbour tug
const TZ=162;
function tugHB(x){if(x<62||x>134)return -1;if(x>=112){const u=(x-112)/23;return 13*Math.sqrt(Math.max(0,1-u*u));}if(x<=76){const u=(76-x)/15;return 13*Math.sqrt(Math.max(0,1-u*u));}return 13;}
function tugW(x){const h=tugHB(x);return h<0?-1:Math.floor(h+0.35);}
function tugDeck(x){return x>=104?23+Math.round(2*Math.pow((x-104)/30,2)):20;}
for(let x=61;x<=135;x++){const wb=tugW(Math.min(134,Math.max(62,x)))+1;B(x,18,TZ-wb,x,19,TZ+wb,C.tire);}
for(let x=62;x<=134;x++){const top=tugDeck(x),w=tugW(x);
  for(let y=8;y<=top+2;y++){
    if(y>top){const wp=tugW(x-1),wn=tugW(x+1);const lo=Math.max(0,Math.min(w,wp<0?0:wp,wn<0?0:wn));const cc=(y===top+2)?C.sup:C.ochre;B(x,y,TZ-w,x,y,TZ-lo,cc);B(x,y,TZ+lo,x,y,TZ+w,cc);continue;}
    const col=y<=13?C.hull:(y===16?C.ochreD:C.ochre);
    if(y===top){B(x,y,TZ-w,x,y,TZ+w,C.deck);B(x,y,TZ-w,x,y,TZ-w,col);B(x,y,TZ+w,x,y,TZ+w,col);}
    else B(x,y,TZ-w,x,y,TZ+w,col);
  }}
beam(136,15,TZ-4,136,15,TZ+4,2.2,C.tire);
beam(60,15,TZ-4,60,15,TZ+4,2.2,C.tire);
B(86,21,TZ-9,112,30,TZ+9,C.sup);
for(let x=89;x<=109;x+=5){B(x,26,TZ-9,x,27,TZ-9,C.glass);B(x,26,TZ+9,x,27,TZ+9,C.glass);}
B(96,21,TZ-9,98,28,TZ-9,C.supD);B(96,21,TZ+9,98,28,TZ+9,C.supD);
B(92,31,TZ-8,110,41,TZ+8,C.sup);
B(92,35,TZ-8,110,39,TZ+8,C.glass);
for(let x=94;x<=108;x+=4){B(x,35,TZ-8,x,39,TZ-8,C.sup);B(x,35,TZ+8,x,39,TZ+8,C.sup);}
for(let z=TZ-6;z<=TZ+6;z+=4){B(92,35,z,92,39,z,C.sup);B(110,35,z,110,39,z,C.sup);}
B(90,42,TZ-10,112,43,TZ+10,C.supD);
B(108,40,TZ+9,109,41,TZ+9,C.green);B(108,40,TZ-9,109,41,TZ-9,C.red);
beam(101,44,TZ,101,62,TZ,1,C.sup);B(100,56,TZ-6,102,56,TZ+6,C.sup);
B(100,51,TZ-1,102,51,TZ+1,C.lamp);B(100,54,TZ-1,102,54,TZ+1,C.lamp);
B(100,63,TZ-5,102,64,TZ+5,C.radar);
cylinder(107,44,TZ,1.5,3,C.steelD);
B(106,47,TZ-1,108,49,TZ+1,C.red);
beam(108,48,TZ,115,50,TZ,0.8,C.steel);
for(const s of [-1,1]){B(86,31,TZ+s*5,89,45,TZ+s*7,C.hull);B(86,41,TZ+s*5,89,42,TZ+s*7,C.ochre);B(86,46,TZ+s*5,89,46,TZ+s*7,C.tire);}
ring(85,25,TZ,2.3,0.8,C.orange,'x');
B(78,21,TZ-9,82,27,TZ-8,C.steelD);B(78,21,TZ+8,82,27,TZ+9,C.steelD);
drumZ(80,26,TZ-7,TZ+7,5,3.5,C.flange,C.winch,C.spoke,C.spoke,4,6);
beam(80,26,TZ-9,80,26,TZ+9,1,C.steelD);
for(let i=0;i<12;i++){const t0=Math.PI*i/12,t1=Math.PI*(i+1)/12;beam(68.5,21+9*Math.sin(t0),TZ-11*Math.cos(t0),68.5,21+9*Math.sin(t1),TZ-11*Math.cos(t1),0.8,C.steelD);}
for(const s of [-1,1]){cylinder(65,21,TZ+s*6,1.2,3,C.hull);cylinder(124,tugDeck(124)+1,TZ+s*5,1.2,3,C.hull);}
line(82,30,TZ,69,31,TZ,C.rope);
rope([68,31,TZ],[54,39,ZC+8],3,0.6,C.rope);
for(let x=40;x<=61;x++)for(let z=TZ-9;z<=TZ+9;z++){const d=Math.abs(z-TZ);if(d<=(62-x)*0.45+3&&((x*5+z*3)%7<3))block(x,11,z,C.foam);}
for(let x=135;x<=140;x++)for(let z=TZ-7;z<=TZ+7;z++){if(Math.abs(z-TZ)>=3&&(x+z)%2===0)block(x,11,z,C.foam);}

// floating light buoy
const BX=192,BZ=198;
for(let dx=-10;dx<=10;dx++)for(let dz=-10;dz<=10;dz++){const r=Math.sqrt(dx*dx+dz*dz);if(r>=8&&r<=9.3&&((dx+dz+20)%3!==0))block(BX+dx,11,BZ+dz,C.foam);}
cylinder(BX,5,BZ,7,11,C.red);
cylinder(BX,12,BZ,7,2,C.white);
cylinder(BX,16,BZ,7.6,1,C.hull);
for(const [sx,sz] of [[-4,-4],[4,-4],[-4,4],[4,4]])beam(BX+sx,17,BZ+sz,BX+sx*0.45,33,BZ+sz*0.45,0.8,C.red);
for(const [y,s] of [[23,3],[29,2]]){B(BX-s,y,BZ-s,BX+s,y,BZ-s,C.red);B(BX-s,y,BZ+s,BX+s,y,BZ+s,C.red);B(BX-s,y,BZ-s,BX-s,y,BZ+s,C.red);B(BX+s,y,BZ-s,BX+s,y,BZ+s,C.red);}
B(BX-2,33,BZ-2,BX+2,33,BZ+2,C.hull);
cylinder(BX,34,BZ,2,4,C.lamp);
cone(BX,38,BZ,2.6,0.6,2,C.hull);
block(BX,40,BZ,C.steelD);
cylinder(BX,41,BZ,1.8,4,C.red);

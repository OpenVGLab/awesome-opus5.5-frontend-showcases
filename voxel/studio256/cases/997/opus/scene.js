const C={footing:'#8E8579',deckA:'#A67B51',deckB:'#98704A',deckC:'#B38A5E',deckEdge:'#6F5037',brick:'#9C6547',brickDark:'#7C4D36',mortar:'#D9CCB4',plaster:'#EFE7D6',plasterShade:'#E0D4BD',wood:'#7B5534',woodDark:'#5A3C26',woodLight:'#A97D52',celadon:'#93BFAE',celadonDeep:'#6E9D8B',celadonPale:'#C3DDD1',copper:'#B9844E',gold:'#D6AA5E',ember:'#E07B3C',emberHot:'#F4B75C',soot:'#4A3F39',clay:'#C7AB86',ivory:'#F2EBDC',ttWood:'#A2703F',plate:'#F5EFE3',plateShade:'#E6DCCA',paint:'#76AC98',leaf:'#5B9180',armWood:'#8B6142',iron:'#5D5955',rotorWood:'#9A6A3E',clayWet:'#CDB08B',clayLine:'#B7966D',smoke:'#E6E3DC'};
const R=Math.round;
function put(x,y,z,c){x=R(x);y=R(y);z=R(z);if(x<10||x>245||z<10||z>245||y<4||y>245)return;block(x,y,z,c);}
function disc(cx,cz,y0,y1,r0,r1,col){const m=Math.ceil(r1);for(let y=y0;y<=y1;y++)for(let dx=-m;dx<=m;dx++)for(let dz=-m;dz<=m;dz++){const d=Math.sqrt(dx*dx+dz*dz);if(d<=r1&&d>r0)put(cx+dx,y,cz+dz,typeof col==='function'?col(dx,y,dz,d):col);}}
function lathe(cx,cz,y0,y1,rf,t,fl,col){for(let y=y0;y<=y1;y++){const ro=rf(y),ri=y<y0+fl?-1:ro-t,m=Math.ceil(ro);for(let dx=-m;dx<=m;dx++)for(let dz=-m;dz<=m;dz++){const d=Math.sqrt(dx*dx+dz*dz);if(d<=ro&&d>ri)put(cx+dx,y,cz+dz,typeof col==='function'?col(dx,y,dz,d,ro):col);}}}
function archIn(u,y,w,yc){return Math.abs(u)<=w&&(y<=yc||u*u+(y-yc)*(y-yc)<=w*w);}

// workshop deck with brick hearth
const DX0=26,DX1=230,DZ0=30,DZ1=224,DR=18,KX=66,KZ=72,HR=44;
function inDeck(x,z){if(x<DX0||x>DX1||z<DZ0||z>DZ1)return false;const qx=Math.min(Math.max(x,DX0+DR),DX1-DR),qz=Math.min(Math.max(z,DZ0+DR),DZ1-DR);return (x-qx)*(x-qx)+(z-qz)*(z-qz)<=DR*DR;}
for(let x=DX0;x<=DX1;x++)for(let z=DZ0;z<=DZ1;z++){
  if(!inDeck(x,z))continue;
  const edge=!inDeck(x-1,z)||!inDeck(x+1,z)||!inDeck(x,z-1)||!inDeck(x,z+1);
  put(x,4,z,C.footing);put(x,5,z,C.footing);
  const hd=Math.sqrt((x-KX)*(x-KX)+(z-KZ)*(z-KZ));
  if(hd<=HR){
    for(let y=6;y<=9;y++)put(x,y,z,edge?C.deckEdge:C.brickDark);
    const row=Math.floor((z+400)/4),off=(row%2)*3,mort=((z+400)%4===0)||((x+off+400)%7===0);
    put(x,10,z,hd>HR-1.5?C.mortar:(mort?C.mortar:(((row+Math.floor((x+off)/7))%3===0)?C.brickDark:C.brick)));
    continue;
  }
  const p=Math.floor((z-DZ0)/8),base=[C.deckA,C.deckB,C.deckC][p%3];
  for(let y=6;y<=8;y++)put(x,y,z,edge?C.deckEdge:base);
  const seam=((z-DZ0)%8===7)||(((x+p*23)%52)===0);
  put(x,9,z,(edge||seam)?C.deckEdge:base);
}

// bottle kiln
disc(KX,KZ,11,14,-1,33,(dx,y,dz,d)=>(y===14&&d>31.6)?C.mortar:C.brickDark);
disc(KX,KZ,15,50,-1,30,(dx,y,dz,d)=>(d>29&&rng()<0.2)?C.plasterShade:C.plaster);
for(let y=51;y<=75;y++){const t=(y-50)/25,r=30*Math.sqrt(Math.max(0,1-t*t));if(r<0.7)continue;disc(KX,KZ,y,y,-1,r,(dx,yy,dz,d)=>{const a=(Math.atan2(dz,dx)+Math.PI)/(2*Math.PI)*8;if(d>r-1.6&&(a%1)<0.1)return C.brick;return y<=52?C.copper:C.plasterShade;});}
for(let y=66;y<=90;y++){const r=15-(y-66)*6.5/24;disc(KX,KZ,y,y,-1,r,(dx,yy,dz,d)=>(y%6===0&&d>r-1.3)?C.plaster:C.brick);}
disc(KX,KZ,91,128,-1,8.5,(dx,y,dz,d)=>(y%8===0&&d>7.4)?C.mortar:(rng()<0.22?C.brickDark:C.brick));
disc(KX,KZ,121,123,8,10,C.copper);
disc(KX,KZ,127,128,8,9.7,C.brickDark);
disc(KX,KZ,110,128,-1,5.4,null);
disc(KX,KZ,109,109,-1,5.4,C.soot);
for(let y=16;y<=70;y++){let r;if(y<=50)r=26;else{const t=(y-50)/21;r=t<1?26*Math.sqrt(1-t*t):0;}if(r>0.7)disc(KX,KZ,y,y,-1,r-0.01,null);}
disc(KX,KZ,15,15,-1,25.9,C.soot);
for(let x=KX-11;x<=KX+11;x++)for(let y=16;y<=41;y++)for(let z=KZ+18;z<=KZ+32;z++)if(archIn(x-KX,y,11,30))put(x,y,z,null);
for(let x=KX-15;x<=KX+15;x++)for(let y=15;y<=45;y++)for(let z=KZ+16;z<=KZ+33;z++){const dx=x-KX,dz=z-KZ,d=Math.sqrt(dx*dx+dz*dz);if(d<=25.5||d>31)continue;const rho=y<=30?Math.abs(dx):Math.sqrt(dx*dx+(y-30)*(y-30));if(rho<=11||rho>14)continue;let c;if(y>30){const a=Math.atan2(y-30,dx);c=(Math.floor(a/(Math.PI/9))%2===0)?C.brick:C.brickDark;if(Math.abs(dx)<=1.5&&y>=41)c=C.gold;}else c=(Math.floor(y/3)%2===0)?C.brick:C.brickDark;put(x,y,z,c);}
box(KX-12,11,KZ+30,KX+12,12,KZ+37,C.brick);
box(KX-12,13,KZ+30,KX+12,14,KZ+33,C.brickDark);
const DZc=KZ+42;
for(let z=DZc-11;z<=DZc+11;z++){const h=30+Math.sqrt(Math.max(0,121-(z-DZc)*(z-DZc)));for(let y=16;y<=h;y++){const e=(z<=DZc-10||z>=DZc+10||y<=17||y>=h-1.2||y===24||y===33);put(KX+14,y,z,e?C.iron:C.copper);put(KX+15,y,z,e?C.iron:C.copper);}}
box(KX+13,20,KZ+26,KX+15,21,KZ+31,C.iron);box(KX+13,34,KZ+26,KX+15,35,KZ+31,C.iron);
for(let x=KX-34;x<=KX-22;x++)for(let y=16;y<=27;y++)for(let z=KZ-6;z<=KZ+6;z++)if(archIn(z-KZ,y,5,21))put(x,y,z,null);
for(let x=KX-34;x<=KX-24;x++)for(let y=15;y<=29;y++)for(let z=KZ-9;z<=KZ+9;z++){const dx=x-KX,dz=z-KZ,d=Math.sqrt(dx*dx+dz*dz);if(d<=25.5||d>31)continue;const rho=y<=21?Math.abs(dz):Math.sqrt(dz*dz+(y-21)*(y-21));if(rho>5&&rho<=7.5)put(x,y,z,C.brickDark);}
ellipsoid(KX-18,16.5,KZ,6,1.8,7,C.ember);
for(let i=0;i<34;i++)put(KX-18+rng()*10-5,17+R(rng()),KZ+rng()*12-6,C.emberHot);
beam(KX-23,18,KZ-4,KX-13,18,KZ+3,1.5,C.soot);
ellipsoid(KX-36,11,KZ,3,1.3,4,C.soot);
for(const [px,pz] of [[-16,-10],[16,-10],[-16,12],[16,12]])disc(KX+px,KZ+pz,16,26,-1,1.5,C.brickDark);
box(KX-18,27,KZ-12,KX+18,27,KZ+14,C.mortar);
for(const [px,pz] of [[-13,-8],[13,-8],[-13,10],[13,10]])disc(KX+px,KZ+pz,28,38,-1,1.5,C.brickDark);
box(KX-15,39,KZ-10,KX+15,39,KZ+12,C.mortar);
for(const [bx,bz,col] of [[-11,6,C.celadon],[-2,8,C.ivory],[7,6,C.celadonDeep],[-7,-4,C.ivory],[5,-5,C.celadon]])lathe(KX+bx,KZ+bz,28,31,(y)=>2.4+(y-28)*0.9,1,1,col);
for(const [vx,vz,col] of [[-8,4,C.ivory],[0,6,C.celadonDeep],[8,4,C.ivory]])lathe(KX+vx,KZ+vz,40,48,(y)=>y<=45?2.2+1.8*Math.sin(Math.PI*(y-40)/8):(y>=48?2.2:1.6),0.9,1,(dx,y,dz,d,ro)=>y===44?C.gold:col);
for(const deg of [20,140,215,270,325]){const a=deg*Math.PI/180;beam(KX+31.2*Math.cos(a),15,KZ+31.2*Math.sin(a),KX+30*Math.cos(a),50,KZ+30*Math.sin(a),2,C.brickDark);}
for(let y=22;y<=23;y++)for(let dx=-32;dx<=32;dx++)for(let dz=-32;dz<=32;dz++){const d=Math.sqrt(dx*dx+dz*dz);if(d<=29.4||d>31)continue;if(dz>0&&Math.abs(dx)<=14.5)continue;if(dx<0&&Math.abs(dz)<=8)continue;put(KX+dx,y,KZ+dz,C.brick);}
disc(KX,KZ,46,47,29.4,31,C.copper);
ellipsoid(66,133,72,6,4,6,C.smoke);
ellipsoid(68,141,71,5,4,5,C.plasterShade);
ellipsoid(70,148,70,4,3,4,C.smoke);

// firewood stack
function logZ(x,y,z0,z1,r,bark){const m=Math.ceil(r);for(let z=z0;z<=z1;z++)for(let dx=-m;dx<=m;dx++)for(let dy=-m;dy<=m;dy++){const d=Math.sqrt(dx*dx+dy*dy);if(d>r)continue;let c=bark;if(z===z0||z===z1)c=d<r-0.8?(Math.floor(d*1.4)%2?C.woodLight:C.clay):bark;put(x+dx,y+dy,z,c);}}
[[34,40.5,47,53.5],[37.2,43.7,50.2],[40.5,47],[43.7]].forEach((row,i)=>row.forEach((lx,j)=>logZ(lx,12.5+i*5.4,112+R(rng()*3),136+R(rng()*3),3,[C.wood,C.woodDark,C.woodLight][(i+j)%3])));
box(29,10,113,30,31,114,C.woodDark);box(29,10,135,30,31,136,C.woodDark);box(58,10,113,59,31,114,C.woodDark);box(58,10,135,59,31,136,C.woodDark);

// kick wheel
const WX=180,WZ=84;
for(const lx of [157,201])for(const lz of [65,101])box(lx,10,lz,lx+3,50,lz+3,C.wood);
box(158,11,65,203,13,67,C.woodDark);box(158,11,102,203,13,104,C.woodDark);
box(157,11,68,159,13,101,C.woodDark);box(202,11,68,204,13,101,C.woodDark);
box(160,11,83,201,13,85,C.woodDark);
box(177,11,81,183,14,87,C.copper);
box(158,44,65,203,47,67,C.wood);box(158,44,102,203,47,104,C.wood);
box(157,44,68,159,47,101,C.wood);box(202,44,68,204,47,101,C.wood);
box(158,32,65,203,34,67,C.wood);
box(160,44,83,176,46,85,C.woodDark);box(184,44,83,201,46,85,C.woodDark);
disc(WX,WZ,44,47,1.7,3.6,C.copper);
disc(WX,WZ,48,49,3.2,20.5,C.celadonDeep);
disc(WX,WZ,50,54,18.2,20.5,C.celadon);
disc(WX,WZ,55,55,18.2,21.3,C.celadonPale);
disc(WX,WZ,50,50,13.5,18.2,()=>rng()<0.55?C.clay:C.celadonDeep);
disc(WX,WZ,15,55,-1,1.5,C.iron);
disc(WX,WZ,17,21,1.5,4.5,C.rotorWood);
disc(WX,WZ,17,21,13.5,17,C.rotorWood);
disc(WX,WZ,18,20,17,18.2,C.iron);
for(let k=0;k<5;k++){const a=k*2*Math.PI/5+0.3;beam(WX+4*Math.cos(a),19,WZ+4*Math.sin(a),WX+14*Math.cos(a),19,WZ+14*Math.sin(a),1.3,C.rotorWood);}
for(const a of [0.9,3.6])put(WX+15.3*Math.cos(a),22,WZ+15.3*Math.sin(a),C.gold);
disc(WX,WZ,56,57,-1,12,C.gold);
for(let k=0;k<3;k++){const a=k*2*Math.PI/3;put(WX+9.5*Math.cos(a),58,WZ+9.5*Math.sin(a),C.iron);}
lathe(WX,WZ,58,76,(y)=>y<=70?6+3.2*Math.sin(Math.PI*(y-58)/14):(y<=74?5.2:6.2),1.6,2,(dx,y,dz,d,ro)=>(y%3===0&&d>ro-1)?C.clayLine:C.clayWet);
box(168,10,40,171,34,43,C.wood);box(189,10,40,192,34,43,C.wood);
box(168,32,44,170,34,64,C.woodDark);box(190,32,44,192,34,64,C.woodDark);
box(167,35,39,193,36,54,C.woodLight);
box(169,37,41,191,38,52,C.celadonPale);
box(205,36,68,206,39,101,C.wood);
box(205,40,70,216,41,98,C.woodLight);
line(215,39,72,206,30,72,C.woodDark);line(215,39,96,206,30,96,C.woodDark);
lathe(210,78,42,46,(y)=>3.2+(y-42)*0.35,1,1,C.ivory);disc(210,78,45,45,-1,3.4,C.celadonPale);
box(209,42,88,212,43,91,C.celadonPale);
line(207,42,94,214,42,96,C.iron);
lathe(206,130,10,31,(y)=>8+3*Math.sin(Math.PI*(y-10)/22),1.5,2,(dx,y,dz,d,ro)=>y>=21?(y===21?C.gold:C.celadonDeep):C.ivory);
disc(206,130,32,32,-1,8.7,C.woodDark);disc(206,130,33,34,-1,2,C.woodLight);
ellipsoid(191,12.5,134,4.5,2.5,4,C.clay);ellipsoid(194,12,123,3.5,2,3.5,C.clay);ellipsoid(190.5,15.5,133,3,2,3,C.clay);

// rotating plate painting stand
const PX=118,PZ=166;
disc(PX,PZ,10,21,-1,7,(dx,y,dz,d)=>(y===14||y===15)?C.celadon:(y>=20?C.celadonDeep:C.ivory));
for(let k=0;k<3;k++){const a=Math.PI/2+k*2*Math.PI/3,fx=PX+25*Math.cos(a),fz=PZ+25*Math.sin(a);beam(PX+5*Math.cos(a),17,PZ+5*Math.sin(a),fx,12.5,fz,2.2,C.wood);disc(R(fx),R(fz),10,11,-1,3.2,C.copper);}
disc(PX,PZ,22,43,-1,3.6,C.woodLight);
disc(PX,PZ,27,28,3.6,4.8,C.woodDark);disc(PX,PZ,35,36,3.6,4.8,C.woodDark);disc(PX,PZ,41,43,3.6,5.2,C.woodDark);
disc(PX,PZ,44,46,-1,6,C.copper);
disc(PX,PZ,47,49,-1,26.5,C.ttWood);
disc(PX,PZ,47,49,26.5,28.4,C.copper);
disc(PX,PZ,49,49,23.2,24.3,C.woodDark);
for(let k=0;k<16;k++){const a=k*Math.PI/8;put(PX+27.4*Math.cos(a),50,PZ+27.4*Math.sin(a),C.plate);if(k%4===0){put(PX+27.4*Math.cos(a),51,PZ+27.4*Math.sin(a),C.plate);put(PX+26.2*Math.cos(a),50,PZ+26.2*Math.sin(a),C.plate);}}
disc(PX,PZ,50,50,8.5,11.5,C.plateShade);
function plateCol(dx,dz,d){const an=(Math.atan2(dz,dx)+2*Math.PI)%(2*Math.PI);if(d>21.4)return C.plateShade;if(d>=20.2)return C.gold;if(d>=16.8&&d<=19.3&&an<4.4)return (d<17.8&&((an*7)%1)<0.5)?C.leaf:C.paint;if(d<=1.6)return C.gold;for(let k=0;k<3;k++){const ph=k*2*Math.PI/3+0.35,ux=Math.cos(ph),uz=Math.sin(ph),al=dx*ux+dz*uz,ac=-dx*uz+dz*ux,t=(al-7)/5.5;if(Math.abs(t)<1){const w=2.5*Math.sqrt(1-t*t);if(Math.abs(ac)<=w)return Math.abs(ac)<0.6?C.leaf:C.paint;}}if(d>=12.3&&d<=13.4&&Math.floor(an/(Math.PI/12))%2===0)return C.leaf;return C.plate;}
for(let dx=-22;dx<=22;dx++)for(let dz=-22;dz<=22;dz++){const d=Math.sqrt(dx*dx+dz*dz);if(d>22.3)continue;const top=d<=13?51:51+R((d-13)/3),bot=d<=15?51:top-1;for(let y=bot;y<=top;y++)put(PX+dx,y,PZ+dz,y===top?plateCol(dx,dz,d):C.plateShade);}
box(PX-37,10,PZ-2,PX-35,63,PZ+2,C.wood);box(PX+35,10,PZ-2,PX+37,63,PZ+2,C.wood);
box(PX-40,10,PZ-6,PX-32,11,PZ+6,C.woodDark);box(PX+32,10,PZ-6,PX+40,11,PZ+6,C.woodDark);
box(PX-37,61,PZ-2,PX+37,63,PZ+2,C.woodLight);
box(PX-10,64,PZ-3,PX+10,65,PZ+3,C.celadonPale);
line(PX-34,54,PZ,PX-30,60,PZ,C.woodDark);line(PX+34,54,PZ,PX+30,60,PZ,C.woodDark);
box(PX+27,61,PZ+3,PX+32,63,PZ+3,C.copper);
put(PX+30,62,PZ+4,C.armWood);
beam(PX+30,62,PZ+5.5,PX+15,60,PZ+12,1,C.armWood);
beam(PX+15,60,PZ+12,PX+14,58.6,PZ+12,0.7,C.gold);
put(PX+14,58,PZ+12,C.plaster);put(PX+14,57,PZ+12,C.plaster);put(PX+14,56,PZ+12,C.paint);
const TA=40*Math.PI/180,TX=R(PX+40*Math.cos(TA)),TZ=R(PZ+40*Math.sin(TA));
beam(PX+3*Math.cos(TA),32,PZ+3*Math.sin(TA),PX+31*Math.cos(TA),32,PZ+31*Math.sin(TA),1.4,C.woodDark);
disc(TX,TZ,30,32,-1,10.5,C.woodLight);
disc(TX,TZ,33,33,9.5,10.8,C.woodDark);
[[-5,-4,C.celadon],[1,-6,C.celadonDeep],[6,-1,C.gold],[-4,4,C.brick]].forEach(([ox,oz,g])=>{lathe(TX+ox,TZ+oz,33,38,(y)=>(y===35||y===36)?3.1:2.6,0.9,1,C.ivory);disc(TX+ox,TZ+oz,37,37,-1,1.8,g);});
lathe(TX+4,TZ+5,33,39,()=>2.2,0.9,1,C.woodDark);
line(TX+4,38,TZ+5,TX+2,47,TZ+3,C.woodLight);put(TX+2,48,TZ+3,C.celadon);
line(TX+4,38,TZ+5,TX+7,46,TZ+4,C.woodLight);put(TX+7,47,TZ+4,C.gold);
line(TX+4,38,TZ+5,TX+4,48,TZ+8,C.woodLight);put(TX+4,49,TZ+8,C.brick);
disc(TX+1,TZ+1,33,33,-1,2.2,C.ivory);put(TX+1,34,TZ+1,C.celadon);put(TX+2,34,TZ,C.gold);
const SX=86,SZ=198;
disc(SX,SZ,27,29,-1,8,C.woodLight);disc(SX,SZ,30,30,-1,6.5,C.celadonPale);
for(let k=0;k<3;k++){const a=k*2*Math.PI/3+0.5;beam(SX+5*Math.cos(a),26,SZ+5*Math.sin(a),SX+8.5*Math.cos(a),10.5,SZ+8.5*Math.sin(a),1.3,C.wood);}
ring(SX,17,SZ,7.1,0.7,C.woodDark,'y');

// glaze buckets, bisque crate, fresh ware, drying rack
function bucket(cx,cz,liq){lathe(cx,cz,10,24,(y)=>7+(y-10)*0.11,1.2,2,(dx,y,dz,d,ro)=>{if(d>ro-1.3&&(y===13||y===21))return C.copper;const a=Math.atan2(dz,dx);return (Math.floor((a+Math.PI)/(2*Math.PI)*16)%2)?C.wood:C.woodLight;});disc(cx,cz,22,22,-1,7.2,liq);let pv=null;for(let i=0;i<=16;i++){const t=Math.PI*i/16,q=[cx+8.8*Math.cos(t),24+7*Math.sin(t),cz];if(pv)line(pv[0],pv[1],pv[2],q[0],q[1],q[2],C.iron);pv=q;}}
bucket(46,158,C.celadon);bucket(64,172,C.ivory);bucket(44,188,C.celadonDeep);
box(40,10,200,68,17,218,C.woodDark);
box(40,18,200,68,18,218,C.woodLight);
for(let x=41;x<=66;x+=4)box(x,11,219,x+1,17,219,C.woodLight);
for(let k=0;k<6;k++)disc(49,209,19+k,19+k,-1,7.4-(k%2)*0.5,k%2?C.clay:C.mortar);
lathe(62,209,19,26,(y)=>5.6-Math.pow((y-19)/7,2)*3.4,1,0,(dx,y,dz,d)=>(y===21||y===24)?C.ivory:C.clay);
lathe(96,116,10,26,(y)=>y<=22?4.5+2.8*Math.sin(Math.PI*(y-10)/14):3.2,1.2,2,(dx,y,dz,d,ro)=>y>=24?C.ivory:C.celadon);
lathe(107,108,10,22,(y)=>y<=19?4+2.4*Math.sin(Math.PI*(y-10)/11):2.8,1.1,2,(dx,y,dz,d,ro)=>y>=20?C.gold:C.celadonDeep);
for(const [qx,qz] of [[198,152],[224,152],[198,202],[224,202]])box(qx,10,qz,qx+2,50,qz+2,C.wood);
for(const sy of [22,40])for(let i=0;i<7;i++)box(199+i*4,sy,152,200+i*4,sy+1,204,C.woodLight);
box(198,48,152,226,50,154,C.wood);box(198,48,202,226,50,204,C.wood);
box(222,50,154,223,51,202,C.wood);
[[205,160],[205,178],[205,196],[217,169],[217,187]].forEach(([bx,bz],i)=>lathe(bx,bz,24,28,(y)=>3+(y-24)*0.65,1,1,(dx,y,dz,d,ro)=>d>ro-1?(i%2?C.celadonDeep:C.celadon):C.ivory));
[164,178,192].forEach((pz,i)=>{for(let dy=-7;dy<=7;dy++)for(let dz=-7;dz<=7;dz++){const d=Math.sqrt(dy*dy+dz*dz);if(d>7.2)continue;const c=d>6.4?C.mortar:(d>=3.8&&d<=5?(i%2?C.celadonDeep:C.celadon):(d<1.3?C.gold:C.ivory));put(220,49+dy,pz+dz,c);put(221,49+dy,pz+dz,d>6.4?C.mortar:C.ivory);}});
[[206,166],[206,190]].forEach(([vx,vz],i)=>lathe(vx,vz,42,55,(y)=>y<=51?3+2.4*Math.sin(Math.PI*(y-42)/10):(y<=53?2:2.8),1,1,(dx,y,dz,d,ro)=>y===48?C.gold:(i?C.celadon:C.celadonDeep)));

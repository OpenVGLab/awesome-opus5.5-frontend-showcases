const R=Math.round;
function B(x0,y0,z0,x1,y1,z1,c){box(R(x0),R(y0),R(z0),R(x1),R(y1),R(z1),c);}
function P(x,y,z,c){block(R(x),R(y),R(z),c);}
function cylY(y0,y1,cx,cz,r,c,ri){const n=Math.ceil(r);for(let a=-n;a<=n;a++)for(let b=-n;b<=n;b++){const d=a*a+b*b;if(d<=r*r&&(ri===undefined||d>ri*ri))B(cx+a,y0,cz+b,cx+a,y1,cz+b,c);}}
const K={ivory:'#F3EBD8',ivoryD:'#E0D3B8',wood:'#8C5E3C',woodL:'#A9784F',woodD:'#6B4429',woodX:'#4E3020',
teal:'#7FB5A6',tealD:'#5C9384',tealL:'#B2D5CA',copper:'#C08A4A',copperL:'#DDB06A',
red:'#C0503F',gold:'#D9A94A',green:'#98B45A',leaf:'#6F9A62',leafD:'#557D4C',iron:'#3F3A36',steel:'#B9BDB8',glass:'#D2E8E2'};
const FR=[K.red,K.gold,K.green];
function fruit(x,y,z,r,c){ellipsoid(x,y,z,r,r,r,c);if(r>=2.5)P(x,y+r+0.6,z,K.woodD);}
function slatBox(x0,y0,z0,x1,y1,z1){B(x0,y0,z0,x1,y0,z1,K.woodD);
 for(let y=y0+1;y<=y1;y+=3){const t=Math.min(y+1,y1);B(x0,y,z0,x1,t,z0,K.woodL);B(x0,y,z1,x1,t,z1,K.woodL);B(x0,y,z0,x0,t,z1,K.woodL);B(x1,y,z0,x1,t,z1,K.woodL);}
 for(const p of [[x0,z0],[x1-1,z0],[x0,z1-1],[x1-1,z1-1]])B(p[0],y0,p[1],p[0]+1,y1,p[1]+1,K.woodD);}

// plank deck with painted border
function ins(z,z0,z1,r){let d=0;if(z<z0+r)d=z0+r-z;else if(z>z1-r)d=z-(z1-r);return d>0?r-Math.floor(Math.sqrt(r*r-d*d)):0;}
for(let z=32;z<=222;z++){const i=ins(z,32,222,14),x0=28+i,x1=228-i;B(x0,4,z,x1,6,z,K.woodX);B(x0,7,z,x1,7,z,K.ivoryD);
 if(z<=33||z>=221){B(x0,8,z,x1,8,z,K.ivory);continue;}
 const j=ins(z,33,221,13),a0=29+j,a1=227-j;B(a0,8,z,a1,8,z,K.ivory);
 if(z>=36&&z<=218){const row=Math.floor((z-36)/6),seam=(z-36)%6===5;const b0=a0+3,b1=a1-3;
  if(b1>b0){B(b0,8,z,b1,8,z,seam?K.woodD:(row%2?K.wood:K.woodL));if(!seam)for(let x=b0+((row*17)%40);x<=b1;x+=40)P(x,8,z,K.woodD);}}}

// grading table frame
for(const x0 of [54,121,190])for(const z0 of [52,94])B(x0,9,z0,x0+3,41,z0+3,K.woodD);
B(52,38,94,196,41,97,K.wood);B(52,38,51,196,41,54,K.wood);B(52,38,51,55,41,97,K.wood);B(193,38,51,196,41,97,K.wood);
B(54,22,52,193,23,55,K.wood);B(54,22,94,193,23,97,K.wood);B(58,24,56,189,25,93,K.woodL);
B(54,10,52,193,11,55,K.wood);B(54,10,94,193,11,97,K.wood);B(58,12,56,189,13,93,K.woodL);

// graduated drop bins with size-sorted fruit and dot tags
for(let i=0;i<5;i++){const x0=70+22*i,x1=x0+18;
 B(x0,26,57,x1,26,93,K.ivoryD);
 B(x0,27,57,x1,35,57,K.ivory);B(x0,27,93,x1,35,93,K.ivory);B(x0,27,57,x0,35,93,K.ivory);B(x1,27,57,x1,35,93,K.ivory);
 B(x0,36,57,x1,36,57,K.woodL);B(x0,36,93,x1,36,93,K.woodL);B(x0,36,57,x0,36,93,K.woodL);B(x1,36,57,x1,36,93,K.woodL);
 const xm=x0+9;B(xm-3,30,94,xm+3,33,94,K.copper);for(let k=0;k<=i;k++)P(xm-2+k,32,95,K.ivory);
 const r=1.6+0.7*i,st=2*r+1;
 for(let fx=x0+1+r;fx<=x1-1-r;fx+=st)for(let fz=58+r;fz<=92-r;fz+=st)fruit(fx,27+r,fz,r,FR[((fx*7+fz*3)|0)%3]);
 for(let fx=x0+1+1.5*r;fx<=x1-1-1.5*r;fx+=st*1.5)for(let fz=58+1.5*r;fz<=92-1.5*r;fz+=st*1.6)fruit(fx,27+2.6*r,fz,r,FR[((fx*5+fz*11)|0)%3]);}

// diverging roller sizer lanes
function rodY(x){return 50-6*(x-70)/110;}
for(const x of [74,100,128,156,180]){const y=R(rodY(x))-2;B(x,y-1,53,x+1,y,95,K.woodL);B(x,42,53,x+1,y-2,54,K.woodD);B(x,42,94,x+1,y-2,95,K.woodD);}
beam(72,49.9,64,180,44,60,1,K.teal);beam(72,49.9,68,180,44,72,1,K.teal);
beam(72,49.9,82,180,44,78,1,K.teal);beam(72,49.9,86,180,44,90,1,K.teal);
for(const z of [64,68,82,86])P(71,50,z,K.tealD);for(const z of [60,72,78,90])P(181,44,z,K.tealD);
for(const f of [[84,66,2.8],[108,66,3.5],[140,66,4.8],[96,84,3.2],[124,84,4.2],[162,84,5.6],[78,84,2.4]]){
 const h=2+4*(f[0]-70)/110,dy=Math.sqrt(Math.max(0,(f[2]+1)*(f[2]+1)-h*h));fruit(f[0],rodY(f[0])+dy,f[1],f[2],FR[(f[0]>>2)%3]);}

// inlet hopper with feed gate
B(60,42,52,61,50,53,K.woodD);B(78,42,52,79,50,53,K.woodD);B(60,42,95,61,50,96,K.woodD);B(78,42,95,79,50,96,K.woodD);
B(60,51,52,80,51,57,K.woodD);B(60,51,93,80,51,96,K.woodD);B(60,51,58,62,51,92,K.woodD);B(78,51,58,80,51,92,K.woodD);
for(let y=52;y<=68;y++){const t=(y-52)/16,x0=R(62-8*t),x1=R(78+6*t),z0=R(58-6*t),z1=R(92+6*t);const c=(y===68)?K.woodD:K.woodL;
 B(x0,y,z0,x1,y,z0,c);B(x0,y,z1,x1,y,z1,c);B(x0,y,z0,x0,y,z1,c);B(x1,y,z0,x1,y,z1,c);
 P(x0,y,z0,K.woodD);P(x1,y,z0,K.woodD);P(x0,y,z1,K.woodD);P(x1,y,z1,K.woodD);}
for(let i=0;i<4;i++)for(let j=0;j<6;j++){const fx=59+6.3*i,fz=57+6.8*j;fruit(fx,65+((i+j)%2),fz,3,FR[(i*2+j)%3]);}
for(let i=0;i<3;i++)for(let j=0;j<5;j++){const fx=62+6*i,fz=61+7*j;fruit(fx,70,fz,2.8,FR[(i+j*2+1)%3]);}
fruit(74,53.5,66,2.4,K.gold);fruit(75,53.5,84,2.4,K.red);
B(70,60,96,70,60,98,K.iron);ring(70,60,99,3,0.7,K.copper,'z');P(70,63,99,K.copperL);

// end crate for the largest grade
slatBox(179,26,58,190,40,92);
for(let fz=62.5;fz<=88;fz+=9)for(const fy of [31.5,39])fruit(184.5,fy,fz+(fy>35?4.5:0),4.5,FR[((fz+fy)|0)%3]);

// copper sizing ring gauges on a rack
B(96,42,50,97,70,51,K.woodD);B(158,42,50,159,70,51,K.woodD);B(96,69,50,159,70,51,K.wood);
for(let i=0;i<5;i++){const x=106+12*i,rr=2.2+0.9*i;P(x,68,50,K.iron);ring(x,67-rr-0.6,50,rr,0.6,K.copper,'z');}

// empty crates on the lower shelf
for(const cx0 of [62,100,140])slatBox(cx0,14,60,cx0+22,22,88);

// matching work chair
for(const p of [[133,117],[153,117],[133,135],[153,135]])B(p[0],9,p[1],p[0]+2,26,p[1]+2,K.woodD);
B(135,15,118,153,15,118,K.copper);B(135,15,136,153,15,136,K.copper);B(134,15,120,134,15,134,K.copper);B(154,15,120,154,15,134,K.copper);
for(let x=132;x<=156;x++)for(let z=116;z<=138;z++){const cx=Math.max(0,Math.abs(x-144)-9),cz=Math.max(0,Math.abs(z-127)-8);if(cx*cx+cz*cz>9)continue;B(x,27,z,x,28,z,K.wood);}
for(let x=134;x<=154;x++)for(let z=118;z<=135;z++){const cx=Math.max(0,Math.abs(x-144)-7),cz=Math.max(0,Math.abs(z-126.5)-6);const q=cx*cx+cz*cz;if(q>9)continue;P(x,29,z,K.teal);if(q<=2)P(x,30,z,K.tealL);}
B(133,29,136,135,58,138,K.woodD);B(153,29,136,155,58,138,K.woodD);
for(let x=136;x<=152;x++){const u=(x-144)/8,dz=R(u*u*1.5);B(x,42,137-dz,x,56,138-dz,K.ivory);B(x,48,137-dz,x,50,138-dz,K.teal);}
B(133,57,136,155,58,138,K.wood);

// canopied operating table
for(const p of [[41,151],[102,151],[41,182],[102,182]])B(p[0],9,p[1],p[0]+3,39,p[1]+3,K.woodD);
B(40,40,150,106,40,186,K.wood);B(40,41,150,106,42,186,K.ivory);
B(42,16,152,104,17,184,K.woodL);
for(const x of [38,107])for(const z of [146,189])B(x,9,z,x+1,z===146?88:78,z+1,K.woodD);
beam(38.5,88,146.5,38.5,78,189.5,0.8,K.wood);beam(107.5,88,146.5,107.5,78,189.5,0.8,K.wood);
B(38,88,146,108,88,147,K.wood);B(38,78,189,108,78,190,K.wood);
for(let z=144;z<=193;z++){const y=R(89-(z-146)*10/43);for(let x=34;x<=112;x++)B(x,y,z,x,y+1,z,(Math.floor((x-34)/6)%2)?K.ivory:K.teal);}
{const yf=R(89-(193-146)*10/43);for(let x=34;x<=112;x++){const m=(x-34)%6;const dep=(m===2||m===3)?3:2;B(x,yf-dep,194,x,yf,194,(Math.floor((x-34)/6)%2)?K.ivory:K.teal);}}
cylY(43,44,58,160,3.5,K.copper);cylY(45,62,58,160,0.8,K.copper);ellipsoid(58,63,160,1.4,1.4,1.4,K.copperL);
B(46,62,160,70,62,160,K.copper);
for(const sx of [46,70]){line(sx,61,160,sx,52,160,K.iron);cylY(51,51,sx,160,4,K.copperL);cylY(52,52,sx,160,4,K.copperL,3);}
fruit(46,54.5,160,2.4,K.red);cylY(52,54,69,160,1.2,K.copper);cylY(52,53,72,161,1,K.copper);
B(76,43,168,96,43,182,K.woodL);
cylY(44,44,82,176,4,K.red);cylY(44,44,82,176,3.2,K.ivory);P(82,44,176,K.woodD);P(83,44,175,K.woodD);
for(let a=0;a<=4;a++)for(let b=-4;b<=4;b++)for(let c=-4;c<=4;c++){if(a*a+b*b+c*c>16)continue;P(89+a,48+b,176+c,a===0?K.ivory:K.red);}
P(89,48,176,K.woodD);P(89,47,177,K.woodD);
B(77,44,171,85,44,171,K.steel);B(86,44,171,90,44,171,K.woodD);
beam(62,44.2,178,72,44.2,180,1.2,K.teal);ellipsoid(61,44.2,178,1.6,1.6,1.6,K.copper);B(72,43,179,74,46,181,K.tealD);
B(64,43,154,74,43,154,K.copper);B(64,43,154,64,43,158,K.copper);B(70,43,154,70,43,157,K.copper);
cylY(43,43,98,158,2.5,K.woodD);beam(98,44,158,96,52,160,0.7,K.copper);ring(95,53,161,3,0.6,K.copper,'y');cylY(53,53,95,161,2.4,K.glass);
slatBox(42,43,168,60,49,184);
for(let fx=45.5;fx<=57;fx+=5)for(let fz=171.5;fz<=181;fz+=5)fruit(fx,45.5,fz,2.3,((fx+fz)|0)%2?K.red:K.gold);
for(const cx0 of [46,76])slatBox(cx0,18,156,cx0+24,26,180);
for(let k=0;k<6;k++)ellipsoid(80+k*3,24,162+((k*7)%12),2.5,1.8,2.5,K.ivoryD);

// crate stack, basket and potted fruit tree
slatBox(166,9,166,190,19,186);
for(let fx=170;fx<=187;fx+=5.5)for(let fz=170;fz<=183;fz+=5.5)fruit(fx,17,fz,2.8,FR[((fx*3+fz)|0)%3]);
slatBox(169,20,170,187,29,183);
for(let fx=173;fx<=184;fx+=5)for(let fz=173.5;fz<=180;fz+=5)fruit(fx,28,fz,2.6,K.gold);
slatBox(194,9,160,212,17,174);
for(let fx=198;fx<=209;fx+=5)for(let fz=163.5;fz<=171;fz+=5)fruit(fx,16,fz,2.6,K.green);
cylY(9,18,122,170,8,K.woodL,6.5);cylY(9,9,122,170,6.5,K.woodL);
for(let y=10;y<=18;y+=2)cylY(y,y,122,170,8.3,K.wood,7.4);
ring(122,20,170,8,0.7,K.woodD,'x');
for(let i=0;i<7;i++){const a=i*0.9;fruit(122+3.5*Math.cos(a)*(i>0?1:0),17+(i===0?2:0),170+3.5*Math.sin(a)*(i>0?1:0),2.6,FR[i%3]);}
cone(206,9,194,7,9,12,K.teal);cylY(20,20,206,194,8,K.woodX);cylY(21,22,206,194,9.5,K.tealD,7.5);
beam(206,20,194,205,40,193,1.8,K.woodD);beam(205,34,193,198,44,190,1,K.woodD);beam(205,36,193,213,45,197,1,K.woodD);
ellipsoid(205,50,194,13,9,13,K.leaf);ellipsoid(197,45,189,7,6,7,K.leafD);ellipsoid(214,46,198,6,6,6,K.leaf);ellipsoid(206,57,195,8,5,8,K.leafD);
for(let k=0;k<14;k++){const a=k*2.4,e=(k%5)/5*1.2-0.4;fruit(205+13.6*Math.cos(a)*Math.cos(e),50+9.6*Math.sin(e),194+13.6*Math.sin(a)*Math.cos(e),1.6,k%3?K.red:K.gold);}

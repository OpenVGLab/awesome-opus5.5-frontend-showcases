'use strict';
// Shared mathematical primitives. Each scene supplies its own composition.
function ellipsoid(cx,cy,cz,rx,ry,rz,color){
  if(Math.min(rx,ry,rz)<=0)throw Error('Ellipsoid radii must be positive');
  for(let y=Math.ceil(cy-ry);y<=Math.floor(cy+ry);y++)for(let z=Math.ceil(cz-rz);z<=Math.floor(cz+rz);z++)for(let x=Math.ceil(cx-rx);x<=Math.floor(cx+rx);x++)
    if(((x-cx)/rx)**2+((y-cy)/ry)**2+((z-cz)/rz)**2<=1)block(x,y,z,color);
}
function cylinder(cx,y0,cz,radius,height,color){
  if(radius<=0||height<=0)throw Error('Cylinder dimensions must be positive');
  for(let y=Math.ceil(y0);y<y0+height;y++)for(let z=Math.ceil(cz-radius);z<=Math.floor(cz+radius);z++)for(let x=Math.ceil(cx-radius);x<=Math.floor(cx+radius);x++)
    if((x-cx)**2+(z-cz)**2<=radius**2)block(x,y,z,color);
}
function cone(cx,y0,cz,r0,r1,height,color){
  if(height<=0||Math.min(r0,r1)<0)throw Error('Invalid cone');
  for(let y=Math.ceil(y0);y<y0+height;y++){
    const r=r0+(r1-r0)*(y-y0)/Math.max(1,height-1);
    for(let z=Math.ceil(cz-r);z<=Math.floor(cz+r);z++)for(let x=Math.ceil(cx-r);x<=Math.floor(cx+r);x++)
      if((x-cx)**2+(z-cz)**2<=r*r)block(x,y,z,color);
  }
}
function beam(x0,y0,z0,x1,y1,z1,radius,color){
  const dx=x1-x0,dy=y1-y0,dz=z1-z0,length2=dx*dx+dy*dy+dz*dz;
  if(radius<=0)throw Error('Beam radius must be positive');
  for(let y=Math.ceil(Math.min(y0,y1)-radius);y<=Math.floor(Math.max(y0,y1)+radius);y++)
  for(let z=Math.ceil(Math.min(z0,z1)-radius);z<=Math.floor(Math.max(z0,z1)+radius);z++)
  for(let x=Math.ceil(Math.min(x0,x1)-radius);x<=Math.floor(Math.max(x0,x1)+radius);x++){
    const t=length2?Math.max(0,Math.min(1,((x-x0)*dx+(y-y0)*dy+(z-z0)*dz)/length2)):0;
    if((x-x0-t*dx)**2+(y-y0-t*dy)**2+(z-z0-t*dz)**2<=radius*radius)block(x,y,z,color);
  }
}
function ring(cx,cy,cz,major,tube,color,axis='y'){
  if(major<=0||tube<=0||!['x','y','z'].includes(axis))throw Error('Invalid ring');
  const r=major+tube,b=[r,r,r];b[['x','y','z'].indexOf(axis)]=tube;
  for(let y=Math.ceil(cy-b[1]);y<=Math.floor(cy+b[1]);y++)for(let z=Math.ceil(cz-b[2]);z<=Math.floor(cz+b[2]);z++)for(let x=Math.ceil(cx-b[0]);x<=Math.floor(cx+b[0]);x++){
    const dx=x-cx,dy=y-cy,dz=z-cz;
    const axial=axis==='x'?dx:axis==='y'?dy:dz;
    const radial=axis==='x'?Math.hypot(dy,dz):axis==='y'?Math.hypot(dx,dz):Math.hypot(dx,dy);
    if((radial-major)**2+axial**2<=tube*tube)block(x,y,z,color);
  }
}

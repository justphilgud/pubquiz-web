export type Pose = Readonly<{x:number;y:number;rotate:number;scaleX:number;scaleY:number;opacity:number}>;
export type Key = Partial<Pose>&{at:number;ease?:'smooth'|'in'|'out'|'linear'};
export type Track = Readonly<{shape:string;keys:readonly Key[];flow?:boolean}>;
const origin:Pose={x:0,y:0,rotate:0,scaleX:1,scaleY:1,opacity:1};
export function sample(keys:readonly Key[],time:number):Pose{
 let a={...origin,...keys[0]},b=a;
 for(let i=1;i<keys.length;i++){b={...a,...keys[i]};if(time<=b.at)break;a=b;}
 if(time>=b.at)return b;
 let u=Math.max(0,Math.min(1,(time-a.at)/(b.at-a.at||1)));
 u=a.ease==='linear'?u:a.ease==='in'?u*u:a.ease==='out'?1-(1-u)**3:u*u*(3-2*u);
 const blend=(k:keyof Pose)=>a[k]+(b[k]-a[k])*u;
 return {x:blend('x'),y:blend('y'),rotate:blend('rotate'),scaleX:blend('scaleX'),scaleY:blend('scaleY'),opacity:blend('opacity')};
}
export const frames=(rows:readonly (readonly number[])[]):Key[]=>rows.map(([at,x,y,rotate=0,scaleX=1,scaleY=scaleX,opacity=1])=>({at,x,y,rotate,scaleX,scaleY,opacity}));
export const track=(shape:string,rows:readonly (readonly number[])[]):Track=>({shape,keys:frames(rows)});
export const stationary=(shape:string,x:number,y:number,scale=1,rotate=0):Track=>track(shape,[[0,x,y,rotate,scale]]);
/** Shape-preserving cubic flight: continuous velocity, no overshoot beyond authored positions. */
export function sampleTrack(track:Track,time:number):Pose{
 const pose=sample(track.keys,time);if(!track.flow)return pose;
 let prior={...origin};const points=track.keys.map(key=>{prior={...prior,...key};return {...prior,at:key.at};});
 if(time<=points[0].at||time>=points.at(-1)!.at)return pose;
 const i=points.findIndex((key,index)=>index<points.length-1&&time>=key.at&&time<=points[index+1].at);
 if(i<0)return pose;
 const a=points[i],b=points[i+1],span=b.at-a.at,u=(time-a.at)/span;
 const interpolate=(property:'x'|'y')=>{
  const slope=(j:number)=>(points[j+1][property]-points[j][property])/(points[j+1].at-points[j].at);
  const tangent=(j:number)=>{if(j===0)return slope(0);if(j===points.length-1)return slope(j-1);const left=slope(j-1),right=slope(j);if(left*right<=0)return 0;const h0=points[j].at-points[j-1].at,h1=points[j+1].at-points[j].at,w0=2*h1+h0,w1=h1+2*h0;return(w0+w1)/(w0/left+w1/right);};
  return(2*u**3-3*u*u+1)*a[property]+(u**3-2*u*u+u)*span*tangent(i)+(-2*u**3+3*u*u)*b[property]+(u**3-u*u)*span*tangent(i+1);
 };
 return {...pose,x:interpolate('x'),y:interpolate('y')};
}

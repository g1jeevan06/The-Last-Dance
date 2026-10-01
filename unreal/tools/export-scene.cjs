/* Executes only this repository's trusted procedural scene code. No npm dependencies. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const input = path.resolve(root, '..', 'index.html');
const out = path.join(root, 'SourceData');
fs.mkdirSync(out, {recursive:true});
const html = fs.readFileSync(input, 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
if (scripts.length !== 2 || !scripts[1].includes('let t=0, prevT=-1')) throw Error('Source page structure changed; review exporter.');
const ctx = vm.createContext({console, document:{getElementById:()=>({style:{}})}, window:{}, performance:{now:()=>0}});
vm.runInContext(scripts[0], ctx);
// Rendering is deliberately disabled: the real geometry and simulation still run.
ctx.THREE.WebGLRenderer = function(){throw Error('Headless export');};
vm.runInContext(scripts[1].split('let t=0, prevT=-1')[0] + '\nglobalThis.bridge={SHOTS,SCENES,DUR,FPS,step,resetSim};', ctx);
const snapInit = scripts[1].match(/\(function initSnapCache\(\)\{[\s\S]*?\}\)\(\);/);
if(!snapInit)throw Error('Missing chain initialization');
vm.runInContext(snapInit[0],ctx);
const {SHOTS,SCENES,DUR,FPS,step,resetSim} = ctx.bridge;
const THREE = ctx.THREE;
const end = Math.round(DUR*FPS)-1;
const report = {sourceSha256:crypto.createHash('sha256').update(html).digest('hex'),fps:FPS,duration:DUR,frames:end+1,shots:SHOTS.length,worlds:{},limitations:[
  'Browser particles (Points), procedural audio, speech synthesis, HUD, fades and title overlays are not exported.',
  'Materials are USD Preview Surface approximations; browser shader effects, fog, environment maps and animated material properties require Unreal work.',
  'Light intensity conversion is approximate. Final exposure and lighting need an Unreal review.',
  'Characters retain their procedural mesh-part animation; no skeletal rig, Control Rig or retargetable animation is created.'
]};
const n = x => {if(!Number.isFinite(x)) throw Error('Nonfinite export value'); return String(Number(x.toFixed(6)));};
const tuple = a => '('+Array.from(a,n).join(', ')+')';
const vecs = (a,size=3) => {let r=[];for(let i=0;i<a.length;i+=size)r.push(tuple(a.slice(i,i+size)));return '['+r.join(', ')+']';};
const matrix = e => '('+[0,4,8,12].map(i=>tuple(e.slice(i,i+4))).join(', ')+')';
const q = JSON.stringify;
const header = '#usda 1.0\n(\n defaultPrim = "Reel"\n upAxis = "Y"\n metersPerUnit = 1\n timeCodesPerSecond = '+FPS+'\n framesPerSecond = '+FPS+'\n startTimeCode = 0\n endTimeCode = '+end+'\n)\n';
// Keep both ends of constant runs, so interpolation cannot smear a later change.
function sample(track,frame,value){
  const last=track[track.length-1];
  if(last && last[1]===value){last[2]=frame;return;}
  if(last && last[2]>last[0]) track.push([last[2],last[1],last[2]]);
  track.push([frame,value,frame]);
}
function attr(type,name,track){
  if(!track.length)return '';
  if(track.length===1)return `${type} ${name} = ${track[0][1]}\n`;
  return `${type} ${name}.timeSamples = {\n${track.map(v=>`${v[0]}: ${v[1]}`).join(',\n')}\n}\n`;
}
const worlds={};
const camera={matrix:[],focal:[],near:[]};
for(const [name,w] of Object.entries(SCENES)){
  const records=[], skipped={};
  function visit(o,parent){
    if(o.isPoints){skipped[o.type]=(skipped[o.type]||0)+1;return;}
    const rec={o,parent,id:'N'+o.id,children:[],mat:[],vis:[],intensity:[],points:[],version:-1};
    records.push(rec); if(parent)parent.children.push(rec);
    for(const child of o.children)visit(child,rec);
  }
  visit(w.scene,null);
  worlds[name]={w,records,root:records[0]};
  report.worlds[name]={nodes:records.length,meshes:records.filter(r=>r.o.isMesh).length,skipped};
}
resetSim();
let previous=-1;
for(let frame=0;frame<=end;frame++){
  const t=frame/FPS;
  const {S}=step(t,frame?1/FPS:0);
  const current=worlds[S.world];
  current.w.scene.updateMatrixWorld(true);
  for(const r of current.records){
    const o=r.o; o.updateMatrix();
    let m=o.matrix;
    if(o.isDirectionalLight || o.isSpotLight){
      // USD lights shine along local -Z; Three lights use a separate target.
      const target=o.target.position;
      const rot=new THREE.Matrix4().lookAt(o.position,target,o.up);
      m=new THREE.Matrix4().compose(o.position,new THREE.Quaternion().setFromRotationMatrix(rot),o.scale);
    }
    sample(r.mat,frame,matrix(m.elements));
    sample(r.vis,frame,q(o.visible?'inherited':'invisible'));
    if(o.isLight)sample(r.intensity,frame,n(o.intensity));
    if(o.isMesh && o.geometry.attributes && o.geometry.attributes.position){
      const a=o.geometry.attributes.position;
      // Store the actual deformed positions whenever a geometry buffer changes.
      if(r.version!==a.version){sample(r.points,frame,vecs(a.array));r.version=a.version;}
      else if(r.points.length)r.points[r.points.length-1][2]=frame;
    }
  }
  const cam=current.w.camera; cam.updateMatrixWorld(true);
  sample(camera.matrix,frame,matrix(cam.matrixWorld.elements));
  sample(camera.focal,frame,n((36/2.35)/(2*Math.tan(cam.fov*Math.PI/360))));
  sample(camera.near,frame,tuple([cam.near,cam.far]));
  const si=Number(S.no);
  if(si!==previous){console.log(`Bake shot ${S.no}: ${S.name} (${S.world})`);previous=si;}
}
function meshText(r){
  const o=r.o; let g=o.geometry;
  if(!g.isBufferGeometry)g=new THREE.BufferGeometry().fromGeometry(g);
  const pos=g.attributes.position;if(!pos)return '';
  const indices=g.index?Array.from(g.index.array):Array.from({length:pos.count},(_,i)=>i);
  let s='def Mesh "Geometry" (prepend apiSchemas = ["MaterialBindingAPI"]) {\n';
  s+='uniform token subdivisionScheme = "none"\nbool doubleSided = true\n';
  s+='int[] faceVertexCounts = ['+Array(indices.length/3).fill(3).join(',')+']\n';
  s+='int[] faceVertexIndices = ['+indices.join(',')+']\n';
  s+=r.points.length?attr('point3f[]','points',r.points):'point3f[] points = '+vecs(pos.array)+'\n';
  if(g.attributes.normal && r.points.length<=1)s+='normal3f[] normals = '+vecs(g.attributes.normal.array)+' (interpolation = "vertex")\n';
  if(g.attributes.color)s+='color3f[] primvars:displayColor = '+vecs(g.attributes.color.array)+' (interpolation = "vertex")\n';
  const mats=Array.isArray(o.material)?o.material:[o.material];
  s+='rel material:binding = </Reel/Materials/M'+mats[0].id+'>\n';
  if(mats.length>1){
    s+='uniform token subsetFamily:materialBind:familyType = "partition"\n';
    for(let i=0;i<g.groups.length;i++){
      const group=g.groups[i], faces=[];
      for(let j=group.start;j<Math.min(indices.length,group.start+group.count);j+=3)faces.push(Math.floor(j/3));
      s+=`def GeomSubset "Part${i}" (prepend apiSchemas = ["MaterialBindingAPI"]) {\nuniform token elementType = "face"\nuniform token familyName = "materialBind"\nint[] indices = [${faces.join(',')}]\nrel material:binding = </Reel/Materials/M${mats[group.materialIndex].id}>\n}\n`;
    }
  }
  return s+'}\n';
}
function nodeText(r){
  const o=r.o;
  let type='Xform';
  if(o.isDirectionalLight)type='DistantLight';
  else if(o.isAmbientLight || o.isHemisphereLight)type='DomeLight';
  else if(o.isLight)type='SphereLight';
  let s=`def ${type} "${r.id}" {\n`;
  if(o.name)s+='custom string sourceName = '+q(o.name)+'\n';
  s+=attr('matrix4d','xformOp:transform',r.mat)+'uniform token[] xformOpOrder = ["xformOp:transform"]\n';
  s+=attr('token','visibility',r.vis);
  if(o.isLight){
    s+='color3f inputs:color = '+tuple(o.color.toArray())+'\n'+attr('float','inputs:intensity',r.intensity);
    if(type==='SphereLight')s+='float inputs:radius = 0.05\n';
    if(o.isSpotLight)s+='float inputs:shaping:cone:angle = '+n(o.angle*180/Math.PI)+'\n';
  }
  if(o.isMesh)s+=meshText(r);
  for(const c of r.children)s+=nodeText(c);
  return s+'}\n';
}
function materialText(m){
  const color=m.color?m.color.toArray():[.5,.5,.5];
  let emission=m.emissive?m.emissive.toArray().map(v=>v*(m.emissiveIntensity??1)):[0,0,0];
  if(m.isMeshBasicMaterial)emission=color;
  return `def Material "M${m.id}" {\ntoken outputs:surface.connect = </Reel/Materials/M${m.id}/Surface.outputs:surface>\ndef Shader "Surface" {\nuniform token info:id = "UsdPreviewSurface"\ncolor3f inputs:diffuseColor = ${tuple(color)}\ncolor3f inputs:emissiveColor = ${tuple(emission)}\nfloat inputs:roughness = ${n(m.roughness??.9)}\nfloat inputs:metallic = ${n(m.metalness??0)}\nfloat inputs:opacity = ${n(m.transparent?m.opacity:1)}\ntoken outputs:surface\n}\n}\n`;
}
for(const [name,w] of Object.entries(worlds)){
  const mats=new Map();w.records.forEach(r=>{if(r.o.isMesh)(Array.isArray(r.o.material)?r.o.material:[r.o.material]).forEach(m=>mats.set(m.id,m));});
  let s=header+'def Xform "Reel" {\ndef Scope "Materials" {\n'+[...mats.values()].map(materialText).join('')+'}\n';
  s+=nodeText(w.root)+'}\n';
  fs.writeFileSync(path.join(out,name+'.usda'),s);
  report.worlds[name].bytes=Buffer.byteLength(s);
  console.log(`Wrote ${name}.usda: ${(Buffer.byteLength(s)/1048576).toFixed(1)} MB`);
}
let master=header+'def Xform "Reel" {\n';
for(const name of Object.keys(worlds)){
  const track=[];
  for(const S of SHOTS)sample(track,Math.round(S.start*FPS),q(S.world===name?'inherited':'invisible'));
  master+=`def Xform "${name}" (prepend references = @${name}.usda@</Reel>) {\n${attr('token','visibility',track)}}\n`;
}
master+='def Camera "Camera" {\nuniform token projection = "perspective"\nfloat horizontalAperture = 36\nfloat verticalAperture = '+n(36/2.35)+'\n';
master+=attr('matrix4d','xformOp:transform',camera.matrix)+'uniform token[] xformOpOrder = ["xformOp:transform"]\n';
master+=attr('float','focalLength',camera.focal)+attr('float2','clippingRange',camera.near)+'}\n}\n';
fs.writeFileSync(path.join(out,'TheLastDance.usda'),master);
fs.writeFileSync(path.join(out,'shots.json'),JSON.stringify({fps:FPS,duration:DUR,shots:SHOTS},null,2));
fs.writeFileSync(path.join(out,'export-report.json'),JSON.stringify(report,null,2));
console.log(`Exported ${SHOTS.length} shots, ${DUR} seconds, ${end+1} frames.`);

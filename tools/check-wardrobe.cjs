const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('index.html','utf8');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
for(const s of scripts)new vm.Script(s);
const ctx=vm.createContext({console,document:{getElementById:()=>({style:{}})},window:{},performance:{now:()=>0}});
vm.runInContext(scripts[0],ctx);
ctx.THREE.WebGLRenderer=function(){throw Error('Headless check');};
vm.runInContext(scripts[1].split('let t=0, prevT=-1')[0]+'\nglobalThis.audit={buildFigure,SHOTS,SCENES,step,resetSim};',ctx);
const snap=scripts[1].match(/\(function initSnapCache\(\)\{[\s\S]*?\}\)\(\);/);vm.runInContext(snap[0],ctx);
for(const height of [1.42,1.68,1.70,1.74,1.80,1.84,1.86,1.96,2.05]){
 const f=ctx.audit.buildFigure({height});
 for(const leg of f.legs){
  assert.equal(leg.hip.children.find(n=>n.isMesh).material.userData.surface,'cloth');
  assert.equal(leg.knee.children.find(n=>n.isMesh).material.userData.surface,'cloth');
  assert.equal(leg.foot.material.userData.surface,'leather');
 }
}
ctx.audit.resetSim();
for(let frame=0;frame<8016;frame+=24){
 ctx.audit.step(frame/24,frame?1:0);
 for(const world of Object.values(ctx.audit.SCENES)){
  world.scene.updateMatrixWorld(true);
  world.scene.traverse(n=>assert(n.matrixWorld.elements.every(Number.isFinite)));
 }
}
console.log('PASS: inline syntax, wardrobe materials at nine heights, finite scene transforms sampled across the 334-second film.');

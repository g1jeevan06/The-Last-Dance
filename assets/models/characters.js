/* CC0 Quaternius character replacements; procedural groups remain pose drivers. */
const MODEL_FIGURES=[];
function registerModelFigure(f, options){
  if(!options.model)return f;
  f.modelKind=options.model; f.modelOptions=options;
  f.placeholderMeshes=[];
  // Keep wardrobe, hair, scars and any props attached after construction.
  f.root.traverse(n=>{if(n.isMesh){let p=n,keep=false;while(p&&p!==f.root){
    if(p===f.hair||p===f.scars||Object.values(f.kit).includes(p))keep=true;p=p.parent;
  }if(!keep)f.placeholderMeshes.push(n);}});
  MODEL_FIGURES.push(f);return f;
}
const CHARACTER_MODELS={
  ready:null, loaded:0,
  async load(){
    const loader=new THREE.GLTFLoader();
    const templates={};
    await Promise.all(Object.keys(MODEL_ASSETS).map(async kind=>{
      const bytes=Uint8Array.from(atob(MODEL_ASSETS[kind]),c=>c.charCodeAt(0));
      templates[kind]=await new Promise((resolve,reject)=>loader.parse(bytes.buffer,'',resolve,reject));
    }));
    for(const f of MODEL_FIGURES){
      const model=THREE.SkeletonUtils.clone(templates[f.modelKind].scene);
      const bounds=new THREE.Box3().setFromObject(model), h=bounds.max.y-bounds.min.y;
      const scale=1.72*f.k/h;model.scale.setScalar(scale);model.position.y=-bounds.min.y*scale;
      model.name='OnlineCharacter_'+f.modelKind;
      model.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;n.frustumCulled=false;}});
      model.traverse(n=>{if(n.isMesh&&n.name==='Eyebrows'){
        n.material=n.material.clone();n.material.color.setHex(f.modelOptions.hair||0x29231e);
      }});
      // Rest-space coordinates keep the costume attached through every skeletal pose.
      model.traverse(n=>{if(n.isSkinnedMesh&&/^superhero_/i.test(n.name)){
        n.material=n.material.clone();
        n.geometry.computeBoundingBox();
        const bodyBounds=n.geometry.boundingBox;
        const bodyHeight=bodyBounds.max.y-bodyBounds.min.y;
        const color=new THREE.Color(f.modelOptions.cloth??0x303740);
        n.material.metalness=0;
        n.material.customProgramCacheKey=()=> 'last-dance-wardrobe-v2';
        n.material.onBeforeCompile=shader=>{
          shader.uniforms.costumeColor={value:color};
          shader.uniforms.bodyHeight={value:bodyHeight};
          shader.uniforms.bodyFloor={value:bodyBounds.min.y};
          shader.vertexShader='varying vec3 costumePosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncostumePosition=position;');
          shader.fragmentShader='varying vec3 costumePosition;uniform vec3 costumeColor;uniform float bodyHeight;uniform float bodyFloor;\n'+shader.fragmentShader;
          shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
            vec3 garment=vec3(costumePosition.x,costumePosition.y-bodyFloor,costumePosition.z)/bodyHeight;
            float torso=1.0-smoothstep(.145,.15,abs(garment.x));
            float trousers=1.0-smoothstep(.51,.514,garment.y);
            float sleeves=(1.0-smoothstep(.29,.295,abs(garment.x)))*smoothstep(.59,.60,garment.y);
            float suit=(1.0-smoothstep(.805,.81,garment.y))*max(max(torso,trousers),sleeves);
            float boots=1.0-smoothstep(.14,.145,garment.y);
            float belt=smoothstep(.505,.509,garment.y)*(1.0-smoothstep(.522,.526,garment.y))*torso;
            float seam=(1.0-smoothstep(.0015,.0035,abs(garment.x)))*smoothstep(.53,.54,garment.y)*torso;
            float weave=.97+.03*sin(garment.y*650.0)*sin(garment.x*650.0);
            vec3 fabric=costumeColor*mix(.72,1.0,smoothstep(.52,.53,garment.y))*weave;
            fabric=mix(fabric,vec3(.025,.029,.035),max(boots,belt));
            fabric=mix(fabric,fabric*.65,seam*.6);
            diffuseColor.rgb=mix(diffuseColor.rgb,fabric,suit);`);
          shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,mix(.94,.72,max(boots,belt)),suit);');
        };
      }});
      model.updateMatrixWorld(true);
      const bones={};model.traverse(n=>{if(n.isBone)bones[n.name]=n;});
      const headBase=bones.Head.getWorldPosition(new THREE.Vector3());
      f.modelHeadOffset=(1.72*f.k-headBase.y)*.48;
      if(f.modelOptions.hairStyle!=='none'){
        const hair=templates['hair_'+f.modelKind].scene.clone(true);
        hair.traverse(n=>{if(n.isMesh){n.material=n.material.clone();n.material.color.setHex(f.modelOptions.hair||0x29231e);n.castShadow=true;}});
        hair.scale.setScalar(scale);hair.position.y=model.position.y;hair.updateMatrixWorld(true);
        bones.Head.attach(hair);f.hair.visible=false;
      }
      const mapping={pelvis:f.hips,spine_01:f.spine,spine_02:f.spine,spine_03:f.spine,neck_01:f.neck,Head:f.head};
      // glTF left is positive X; the film's arms array is negative X first.
      for(const [suffix,i] of [['l',1],['r',0]]){
        mapping['upperarm_'+suffix]=f.arms[i].sh;mapping['lowerarm_'+suffix]=f.arms[i].el;
        mapping['hand_'+suffix]=f.arms[i].hand;mapping['thigh_'+suffix]=f.legs[i].hip;
        mapping['calf_'+suffix]=f.legs[i].knee;mapping['foot_'+suffix]=f.legs[i].foot;
      }
      const bindSource={};
      for(const suffix of ['l','r']){
        for(const [name,end] of [['upperarm','lowerarm'],['lowerarm','hand']]){
          const direction=bones[end+'_'+suffix].getWorldPosition(new THREE.Vector3()).sub(bones[name+'_'+suffix].getWorldPosition(new THREE.Vector3())).normalize();
          bindSource[name+'_'+suffix]=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,-1,0),direction);
        }
        bindSource['hand_'+suffix]=bindSource['lowerarm_'+suffix];
      }
      const links=[];
      model.traverse(b=>{if(b.isBone&&mapping[b.name])links.push({bone:b,driver:mapping[b.name],
        rest:b.getWorldQuaternion(new THREE.Quaternion()),
        sourceInverse:(bindSource[b.name]||new THREE.Quaternion()).clone().invert()});});
      f.root.add(model);f.importedModel=model;f.modelLinks=links;
      // Move story accessories together with the imported skull centre.
      const props=f.head.children.filter(n=>n!==f.hair&&!f.placeholderMeshes.includes(n));
      f.modelHeadProps=new THREE.Group();props.forEach(n=>f.modelHeadProps.add(n));f.head.add(f.modelHeadProps);
      f.modelHead=bones.Head;
      f.modelPelvis=bones.pelvis;f.modelPelvisRest=bones.pelvis.position.clone();
      this.loaded++;
    }
    this.update();
  },
  update(){
    const q=new THREE.Quaternion(), rootInverse=new THREE.Quaternion(),parentInverse=new THREE.Quaternion();
    for(const f of MODEL_FIGURES){
      if(!f.importedModel)continue;
      f.placeholderMeshes.forEach(n=>n.visible=false);
      // The fitted skinned top replaces the old rigid chest shells.
      f.kit.top.traverse(n=>{if(n.isMesh)n.visible=false;});
      f.root.updateWorldMatrix(true,true);
      rootInverse.copy(f.root.getWorldQuaternion(q)).invert();
      // Retarget world-space rotation deltas in parent-before-child order.
      for(const link of f.modelLinks){
        link.driver.getWorldQuaternion(q).premultiply(rootInverse).multiply(link.sourceInverse).multiply(link.rest);
        parentInverse.copy(link.bone.parent.getWorldQuaternion(new THREE.Quaternion())).premultiply(rootInverse).invert();
        link.bone.quaternion.copy(parentInverse.multiply(q));
        link.bone.updateWorldMatrix(false,false);
      }
      // Pelvis translation follows crouching, sitting and impacts in root space.
      const p=f.hips.getWorldPosition(new THREE.Vector3());
      f.modelPelvis.parent.worldToLocal(p);f.modelPelvis.position.copy(p);
      f.importedModel.updateWorldMatrix(false,true);
      const anchor=new THREE.Vector3(0,f.modelHeadOffset,.02*f.k).applyQuaternion(f.head.getWorldQuaternion(q));
      anchor.add(f.modelHead.getWorldPosition(new THREE.Vector3()));
      f.modelHeadProps.position.copy(f.head.worldToLocal(anchor));
    }
  }
};

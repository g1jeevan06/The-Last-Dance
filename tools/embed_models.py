"""Embed model files and their runtime into the portable HTML/JSON source."""
import base64, json, pathlib, re
root=pathlib.Path(__file__).resolve().parents[1]
page=root/'index.html'
text=page.read_text(encoding='utf-8')
block='/* CHARACTER_MODELS_START */\n'
for name in ('GLTFLoader','SkeletonUtils'):
    block+=(root/f'assets/vendor/{name}.js').read_text()+'\n'
data={kind:base64.b64encode((root/f'assets/models/{kind}.glb').read_bytes()).decode() for kind in ('male','female','hair_male','hair_female')}
block+='const MODEL_ASSETS='+json.dumps(data,separators=(',',':'))+';\n'
block+=(root/'assets/models/characters.js').read_text()+'\n/* CHARACTER_MODELS_END */\n'
if '/* CHARACTER_MODELS_START */' in text:
    text=re.sub(r'/\* CHARACTER_MODELS_START \*/.*?/\* CHARACTER_MODELS_END \*/\n',lambda m:block,text,flags=re.S)
else:
    text=text.replace('function buildFigure(o){',block+'function buildFigure(o){')
    text=text.replace('return {root, hips, spine, chest, neck, head, hair, arms, legs, scars, kit, k};','return registerModelFigure({root, hips, spine, chest, neck, head, hair, arms, legs, scars, kit, k},o);')
    for height,kind in [('1.70','female'),('1.86','male'),('1.80','male'),('1.96','male')]:
        text=text.replace('buildFigure({height:'+height+',','buildFigure({model:"'+kind+'", height:'+height+',')
    text=text.replace('  frameShot(t, si, u);','  CHARACTER_MODELS.update();\n  frameShot(t, si, u);')
    text=text.replace("el('materialStatus').textContent='Loading textures';","el('materialStatus').textContent='Loading textures and characters';")
    text=text.replace('SURFACES.ready.then(()=>{','Promise.all([SURFACES.ready, CHARACTER_MODELS.ready=CHARACTER_MODELS.load()]).then(()=>{')
    text=text.replace("textContent='PBR textures';","textContent='PBR + 3D characters';")
    text=text.replace("textContent='Texture error';","textContent='Asset loading error';")
page.write_text(text,encoding='utf-8',newline='\n')
print('Embedded four GLBs and character runtime.')

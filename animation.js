// ─── GLTFLoader ────────────────────────────────────────────────────────────────
// Inline minimal GLTFLoader compatible with r128
(function(){
const t=THREE;
class DRACOLoader{}
class GLTFLoader extends t.Loader{
  constructor(m){super(m);this.dracoLoader=null;this.ktx2Loader=null;this.meshoptDecoder=null;this.pluginCallbacks=[];}
  setDRACOLoader(d){this.dracoLoader=d;return this;}
  register(c){if(this.pluginCallbacks.indexOf(c)===-1)this.pluginCallbacks.push(c);return this;}
  unregister(c){const i=this.pluginCallbacks.indexOf(c);if(i!==-1)this.pluginCallbacks.splice(i,1);return this;}
  load(url,onLoad,onProgress,onError){
    const scope=this;
    const loader=new t.FileLoader(this.manager);
    loader.setPath(this.path);
    loader.setResponseType('arraybuffer');
    loader.setRequestHeader(this.requestHeader);
    loader.setWithCredentials(this.withCredentials);
    loader.load(url,function(data){
      try{scope.parse(data,'',onLoad,onError);}catch(e){if(onError)onError(e);else throw e;}
    },onProgress,onError);
  }
  loadAsync(url,onProgress){return new Promise((res,rej)=>this.load(url,res,onProgress,rej));}
  parse(data,path,onLoad,onError){
    let content='';
    const extensions={};
    const plugins={};
    if(typeof data==='string'){content=data;}
    else{
      const magic=t.LoaderUtils.decodeText(new Uint8Array(data,0,4));
      if(magic===BINARY_EXTENSION_HEADER_MAGIC){
        try{extensions[EXTENSIONS.KHR_BINARY_GLTF]=new GLTFBinaryExtension(data);}
        catch(e){if(onError)onError(e);return;}
        content=extensions[EXTENSIONS.KHR_BINARY_GLTF].content;
      }else{content=t.LoaderUtils.decodeText(new Uint8Array(data));}
    }
    const json=JSON.parse(content);
    if(json.asset===undefined||json.asset.version[0]<2){if(onError)onError(new Error('Unsupported asset. glTF versions >=2.0 are supported.'));return;}
    const parser=new GLTFParser(json,{path:path||this.resourcePath||'',crossOrigin:this.crossOrigin,requestHeader:this.requestHeader,manager:this.manager,ktx2Loader:this.ktx2Loader,meshoptDecoder:this.meshoptDecoder});
    parser.fileLoader.setRequestHeader(this.requestHeader);
    for(let i=0;i<this.pluginCallbacks.length;i++){const plugin=this.pluginCallbacks[i](parser);plugins[plugin.name]=plugin;for(const extensionName in plugin.beforeRoot){const r=parser.extensions[extensionName];if(r){console.warn('THREE.GLTFLoader: Plugin tries to override existing extension: '+extensionName);}parser.extensions[extensionName]=r||plugin.beforeRoot[extensionName];}}
    parser.parse(function(scene,scenes,cameras,animations,json){
      const result={scene:scene,scenes:scenes,cameras:cameras,animations:animations,asset:json.asset,parser:parser,userData:{}};
      t.Object3D.prototype.applyPlugin&&t.Object3D.prototype.applyPlugin(result);
      onLoad(result);
    },onError);
  }
}
const BINARY_EXTENSION_HEADER_MAGIC='glTF';
const BINARY_EXTENSION_HEADER_LENGTH=12;
const BINARY_EXTENSION_CHUNK_TYPES={JSON:0x4E4F534A,BIN:0x004E4942};
const EXTENSIONS={KHR_BINARY_GLTF:'KHR_binary_glTF',KHR_DRACO_MESH_COMPRESSION:'KHR_draco_mesh_compression',KHR_LIGHTS_PUNCTUAL:'KHR_lights_punctual',KHR_MATERIALS_CLEARCOAT:'KHR_materials_clearcoat',KHR_MATERIALS_IOR:'KHR_materials_ior',KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS:'KHR_materials_pbrSpecularGlossiness',KHR_MATERIALS_SPECULAR:'KHR_materials_specular',KHR_MATERIALS_TRANSMISSION:'KHR_materials_transmission',KHR_MATERIALS_UNLIT:'KHR_materials_unlit',KHR_MATERIALS_VOLUME:'KHR_materials_volume',KHR_TEXTURE_BASISU:'KHR_texture_basisu',KHR_TEXTURE_TRANSFORM:'KHR_texture_transform',KHR_MESH_QUANTIZATION:'KHR_mesh_quantization',EXT_TEXTURE_WEBP:'EXT_texture_webp',EXT_MESHOPT_COMPRESSION:'EXT_meshopt_compression'};
class GLTFBinaryExtension{
  constructor(data){
    this.name=EXTENSIONS.KHR_BINARY_GLTF;this.content=null;this.body=null;
    const headerView=new DataView(data,0,BINARY_EXTENSION_HEADER_LENGTH);
    this.header={magic:t.LoaderUtils.decodeText(new Uint8Array(data.slice(0,4))),version:headerView.getUint32(4,true),length:headerView.getUint32(8,true)};
    if(this.header.magic!==BINARY_EXTENSION_HEADER_MAGIC)throw new Error('THREE.GLTFLoader: Unsupported glTF-Binary header.');
    const chunkContentsLength=this.header.length-BINARY_EXTENSION_HEADER_LENGTH;
    const chunkView=new DataView(data,BINARY_EXTENSION_HEADER_LENGTH);
    let chunkIndex=0;
    while(chunkIndex<chunkContentsLength){
      const chunkLength=chunkView.getUint32(chunkIndex,true);chunkIndex+=4;
      const chunkType=chunkView.getUint32(chunkIndex,true);chunkIndex+=4;
      if(chunkType===BINARY_EXTENSION_CHUNK_TYPES.JSON){const contentArray=new Uint8Array(data,BINARY_EXTENSION_HEADER_LENGTH+chunkIndex,chunkLength);this.content=t.LoaderUtils.decodeText(contentArray);}
      else if(chunkType===BINARY_EXTENSION_CHUNK_TYPES.BIN){this.body=data.slice(BINARY_EXTENSION_HEADER_LENGTH+chunkIndex,BINARY_EXTENSION_HEADER_LENGTH+chunkIndex+chunkLength);}
      chunkIndex+=chunkLength;
    }
    if(this.content===null)throw new Error('THREE.GLTFLoader: JSON content not found.');
  }
}
class GLTFParser{
  constructor(json,options){
    this.json=json||{};this.extensions={};this.plugins={};this.options=options;this.cache=new GLTFRegistry();this.associations=new Map();this.primitiveCache={};this.meshCache={refs:{},uses:{}};this.cameraCache={refs:{},uses:{}};this.lightCache={refs:{},uses:{}};this.textureCache={};this.nodeNamesUsed={};
    this.textureLoader=new t.TextureLoader(options.manager);
    this.textureLoader.setCrossOrigin(options.crossOrigin);
    this.textureLoader.setRequestHeader(options.requestHeader);
    this.fileLoader=new t.FileLoader(options.manager);
    this.fileLoader.setResponseType('arraybuffer');
    this.fileLoader.setRequestHeader(options.requestHeader);
    if(options.crossOrigin==='use-credentials')this.fileLoader.setWithCredentials(true);
  }
  setExtensions(extensions){this.extensions=extensions;}
  setPlugins(plugins){this.plugins=plugins;}
  parse(onLoad,onError){
    const self=this;const json=this.json;const extensions=this.extensions;
    this.associations=new Map();
    this._invokeAll(function(ext){return ext.beforeRoot&&ext.beforeRoot();}).then(function(){
      return Promise.all([self.getDependencies('scene'),self.getDependencies('animation'),self.getDependencies('camera')]);
    }).then(function(dependencies){
      const result={json:self.json,scenes:dependencies[0],scene:dependencies[0][json.scene||0],animations:dependencies[1],cameras:dependencies[2],asset:json.asset,userData:{}};
      self._invokeAll(function(ext){return ext.afterRoot&&ext.afterRoot(result);}).then(function(){onLoad(result.scene,result.scenes,result.cameras,result.animations,result.json);}).catch(onError);
    }).catch(onError);
  }
  _invokeOne(func){const extensions=Object.values(this.plugins);extensions.push(this);for(let i=0;i<extensions.length;i++){const result=func(extensions[i]);if(result!==undefined)return result;}return null;}
  _invokeAll(func){const extensions=Object.values(this.plugins).concat(this);const pending=[];extensions.forEach(function(ext){const result=func(ext);if(result!==undefined)pending.push(result);});return Promise.all(pending);}
  getDependency(type,index){const cacheKey=type+':'+index;let dependency=this.cache.get(cacheKey);if(!dependency){switch(type){case 'scene':dependency=this.loadScene(index);break;case 'node':dependency=this.loadNode(index);break;case 'mesh':dependency=this._invokeOne(function(ext){return ext.loadMesh&&ext.loadMesh(index);});break;case 'accessor':dependency=this.loadAccessor(index);break;case 'bufferView':dependency=this._invokeOne(function(ext){return ext.loadBufferView&&ext.loadBufferView(index);});break;case 'buffer':dependency=this._invokeOne(function(ext){return ext.loadBuffer&&ext.loadBuffer(index);});break;case 'material':dependency=this._invokeOne(function(ext){return ext.loadMaterial&&ext.loadMaterial(index);});break;case 'texture':dependency=this._invokeOne(function(ext){return ext.loadTexture&&ext.loadTexture(index);});break;case 'skin':dependency=this.loadSkin(index);break;case 'animation':dependency=this.loadAnimation(index);break;case 'camera':dependency=this.loadCamera(index);break;case 'light':dependency=this.extensions[EXTENSIONS.KHR_LIGHTS_PUNCTUAL].loadLight(index);break;default:throw new Error('Unknown type: '+type);}this.cache.add(cacheKey,dependency);}return dependency;}
  getDependencies(type){let dependencies=this.cache.get(type);if(!dependencies){const defs=this.json[type+(type==='mesh'?'es':'s')]||[];dependencies=Promise.all(defs.map(function(_,index){return this.getDependency(type,index);},this));this.cache.add(type,dependencies);}return dependencies;}
  loadBuffer(bufferIndex){const bufferDef=this.json.buffers[bufferIndex];const loader=this.fileLoader;if(bufferDef.type&&bufferDef.type!=='arraybuffer')throw new Error('THREE.GLTFLoader: '+bufferDef.type+' buffer type is not supported.');if(bufferDef.uri===undefined&&bufferIndex===0){return Promise.resolve(this.extensions[EXTENSIONS.KHR_BINARY_GLTF].body);}const options=this.options;return new Promise(function(resolve,reject){loader.load(t.LoaderUtils.resolveURL(bufferDef.uri,options.path),resolve,undefined,function(){reject(new Error('THREE.GLTFLoader: Failed to load buffer "'+bufferDef.uri+'"'));});});}
  loadBufferView(bufferViewIndex){const bufferViewDef=this.json.bufferViews[bufferViewIndex];return this.getDependency('buffer',bufferViewDef.buffer).then(function(buffer){const byteLength=bufferViewDef.byteLength||0;const byteOffset=bufferViewDef.byteOffset||0;return buffer.slice(byteOffset,byteOffset+byteLength);});}
  loadAccessor(accessorIndex){const parser=this;const json=this.json;const accessorDef=this.json.accessors[accessorIndex];if(accessorDef.bufferView===undefined&&accessorDef.sparse===undefined){const itemSize=WEBGL_TYPE_SIZES[accessorDef.type];const TypedArray=WEBGL_COMPONENT_TYPES[accessorDef.componentType];const normalized=accessorDef.normalized===true;const array=new TypedArray(accessorDef.count*itemSize);return Promise.resolve(new t.BufferAttribute(array,itemSize,normalized));}const pendingBufferViews=[];if(accessorDef.bufferView!==undefined){pendingBufferViews.push(this.getDependency('bufferView',accessorDef.bufferView));}else{pendingBufferViews.push(null);}if(accessorDef.sparse!==undefined){pendingBufferViews.push(this.getDependency('bufferView',accessorDef.sparse.indices.bufferView));pendingBufferViews.push(this.getDependency('bufferView',accessorDef.sparse.values.bufferView));}return Promise.all(pendingBufferViews).then(function(bufferViews){const bufferView=bufferViews[0];const itemSize=WEBGL_TYPE_SIZES[accessorDef.type];const TypedArray=WEBGL_COMPONENT_TYPES[accessorDef.componentType];const elementBytes=TypedArray.BYTES_PER_ELEMENT;const itemBytes=elementBytes*itemSize;const byteOffset=accessorDef.byteOffset||0;const byteStride=accessorDef.bufferView!==undefined?json.bufferViews[accessorDef.bufferView].byteStride:undefined;const normalized=accessorDef.normalized===true;let array,bufferAttribute;if(byteStride&&byteStride!==itemBytes){const ibSlice=Math.floor(byteOffset/byteStride);const ibCacheKey='InterleavedBuffer:'+accessorDef.bufferView+':'+accessorDef.componentType+':'+ibSlice+':'+accessorDef.count;let ib=parser.cache.get(ibCacheKey);if(!ib){array=new TypedArray(bufferView,ibSlice*byteStride,accessorDef.count*byteStride/elementBytes);ib=new t.InterleavedBuffer(array,byteStride/elementBytes);parser.cache.add(ibCacheKey,ib);}bufferAttribute=new t.InterleavedBufferAttribute(ib,itemSize,(byteOffset%byteStride)/elementBytes,normalized);}else{if(bufferView===null){array=new TypedArray(accessorDef.count*itemSize);}else{array=new TypedArray(bufferView,byteOffset,accessorDef.count*itemSize);}bufferAttribute=new t.BufferAttribute(array,itemSize,normalized);}if(accessorDef.sparse!==undefined){const itemSizeIndices=WEBGL_TYPE_SIZES.SCALAR;const TypedArrayIndices=WEBGL_COMPONENT_TYPES[accessorDef.sparse.indices.componentType];const byteOffsetIndices=accessorDef.sparse.indices.byteOffset||0;const byteOffsetValues=accessorDef.sparse.values.byteOffset||0;const sparseIndices=new TypedArrayIndices(bufferViews[1],byteOffsetIndices,accessorDef.sparse.count*itemSizeIndices);const sparseValues=new TypedArray(bufferViews[2],byteOffsetValues,accessorDef.sparse.count*itemSize);if(bufferView!==null){bufferAttribute=new t.BufferAttribute(bufferAttribute.array.slice(),bufferAttribute.itemSize,bufferAttribute.normalized);}for(let i=0,il=sparseIndices.length;i<il;i++){const index=sparseIndices[i];bufferAttribute.setX(index,sparseValues[i*itemSize]);if(itemSize>=2)bufferAttribute.setY(index,sparseValues[i*itemSize+1]);if(itemSize>=3)bufferAttribute.setZ(index,sparseValues[i*itemSize+2]);if(itemSize>=4)bufferAttribute.setW(index,sparseValues[i*itemSize+3]);if(itemSize>=5)throw new Error('THREE.GLTFLoader: Unsupported itemSize in sparse BufferAttribute.');}}return bufferAttribute;});}
  loadTexture(textureIndex){const json=this.json;const options=this.options;const textureDef=json.textures[textureIndex];const textureExtensions=textureDef.extensions||{};let source;if(textureExtensions[EXTENSIONS.EXT_TEXTURE_WEBP]){source=json.images[textureExtensions[EXTENSIONS.EXT_TEXTURE_WEBP].source];}else{source=json.images[textureDef.source];}let loader=this.textureLoader;if(source.uri){const handler=options.manager.getHandler(source.uri);if(handler!==null)loader=handler;}return this.loadTextureImage(textureIndex,source,loader);}
  loadTextureImage(textureIndex,source,loader){const parser=this;const json=this.json;const options=this.options;const textureDef=json.textures[textureIndex];const cacheKey=(source.uri||source.bufferView)+':'+textureDef.sampler;if(this.textureCache[cacheKey]){return this.textureCache[cacheKey];}const promise=new Promise(function(resolve,reject){const URL=self.URL||self.webkitURL;let sourceURI=source.uri||'';let isObjectURL=false;if(source.bufferView!==undefined){parser.getDependency('bufferView',source.bufferView).then(function(bufferView){isObjectURL=true;const blob=new Blob([bufferView],{type:source.mimeType});sourceURI=URL.createObjectURL(blob);return sourceURI;}).then(function(sourceURI){return parser.loadImageSource(sourceURI,loader);}).then(function(texture){URL.revokeObjectURL(sourceURI);texture.flipY=false;if(textureDef.name)texture.name=textureDef.name;const samplers=json.samplers||{};const sampler=samplers[textureDef.sampler]||{};texture.magFilter=WEBGL_FILTERS[sampler.magFilter]||t.LinearFilter;texture.minFilter=WEBGL_FILTERS[sampler.minFilter]||t.LinearMipmapLinearFilter;texture.wrapS=WEBGL_WRAPPING[sampler.wrapS]||t.RepeatWrapping;texture.wrapT=WEBGL_WRAPPING[sampler.wrapT]||t.RepeatWrapping;parser.associations.set(texture,{textures:textureIndex});resolve(texture);}).catch(reject);}else{parser.loadImageSource(t.LoaderUtils.resolveURL(sourceURI,options.path),loader).then(function(texture){texture.flipY=false;if(textureDef.name)texture.name=textureDef.name;const samplers=json.samplers||{};const sampler=samplers[textureDef.sampler]||{};texture.magFilter=WEBGL_FILTERS[sampler.magFilter]||t.LinearFilter;texture.minFilter=WEBGL_FILTERS[sampler.minFilter]||t.LinearMipmapLinearFilter;texture.wrapS=WEBGL_WRAPPING[sampler.wrapS]||t.RepeatWrapping;texture.wrapT=WEBGL_WRAPPING[sampler.wrapT]||t.RepeatWrapping;parser.associations.set(texture,{textures:textureIndex});resolve(texture);}).catch(reject);}});this.textureCache[cacheKey]=promise;return promise;}
  loadImageSource(sourceURI,loader){const options=this.options;if(this.textureCache[sourceURI]!==undefined){return this.textureCache[sourceURI];}const promise=new Promise(function(resolve,reject){let onLoad=resolve;if(loader.isImageBitmapLoader===true){onLoad=function(imageBitmap){resolve(new t.CanvasTexture(imageBitmap));};}loader.load(sourceURI,onLoad,undefined,reject);});this.textureCache[sourceURI]=promise;return promise;}
  assignTexture(materialParams,mapName,mapDef,encoding){const parser=this;return this.getDependency('texture',mapDef.index).then(function(texture){if(!texture.isCompressedTexture){switch(mapName){case 'aoMap':case 'emissiveMap':case 'metalnessMap':case 'normalMap':case 'roughnessMap':texture.encoding=t.LinearEncoding;break;default:texture.encoding=encoding;}}materialParams[mapName]=texture;if(mapDef.texCoord!==undefined&&mapDef.texCoord!=0){materialParams[mapName].channel=mapDef.texCoord;}if(parser.extensions[EXTENSIONS.KHR_TEXTURE_TRANSFORM]){const transform=mapDef.extensions!==undefined?mapDef.extensions[EXTENSIONS.KHR_TEXTURE_TRANSFORM]:undefined;if(transform){const gltfReference=parser.associations.get(materialParams[mapName]);materialParams[mapName]=parser.extensions[EXTENSIONS.KHR_TEXTURE_TRANSFORM].extendTexture(materialParams[mapName],transform);parser.associations.set(materialParams[mapName],gltfReference);}}return texture;});}
  assignFinalMaterial(mesh){const geometry=mesh.geometry;let material=mesh.material;const useDerivativeTangents=geometry.attributes.tangent===undefined;const useVertexColors=geometry.attributes.color!==undefined;const useFlatShading=geometry.attributes.normal===undefined;if(mesh.isPoints){const cacheKey='PointsMaterial:'+material.uuid;let pointsMaterial=this.cache.get(cacheKey);if(!pointsMaterial){pointsMaterial=new t.PointsMaterial();t.Material.prototype.copy.call(pointsMaterial,material);pointsMaterial.color.copy(material.color);pointsMaterial.map=material.map;pointsMaterial.sizeAttenuation=false;this.cache.add(cacheKey,pointsMaterial);}material=pointsMaterial;}else if(mesh.isLine){const cacheKey='LineBasicMaterial:'+material.uuid;let lineMaterial=this.cache.get(cacheKey);if(!lineMaterial){lineMaterial=new t.LineBasicMaterial();t.Material.prototype.copy.call(lineMaterial,material);lineMaterial.color.copy(material.color);this.cache.add(cacheKey,lineMaterial);}material=lineMaterial;}if(useDerivativeTangents||useVertexColors||useFlatShading){let cacheKey='ClonedMaterial:'+material.uuid+':';if(material.isGLTFSpecularGlossinessMaterial)cacheKey+='specular-glossiness:';if(useDerivativeTangents)cacheKey+='derivative-tangents:';if(useVertexColors)cacheKey+='vertex-colors:';if(useFlatShading)cacheKey+='flat-shading:';let cachedMaterial=this.cache.get(cacheKey);if(!cachedMaterial){cachedMaterial=material.clone();if(useVertexColors)cachedMaterial.vertexColors=true;if(useFlatShading)cachedMaterial.flatShading=true;if(useDerivativeTangents){if(cachedMaterial.normalScale)cachedMaterial.normalScale.y*=-1;if(cachedMaterial.clearcoatNormalScale)cachedMaterial.clearcoatNormalScale.y*=-1;}this.cache.add(cacheKey,cachedMaterial);this.associations.set(cachedMaterial,this.associations.get(material));}material=cachedMaterial;}mesh.material=material;}
  getMaterialType(){return t.MeshStandardMaterial;}
  loadMaterial(materialIndex){const parser=this;const json=this.json;const extensions=this.extensions;const materialDef=json.materials[materialIndex];let materialType;const materialParams={};const materialExtensions=materialDef.extensions||{};const pending=[];if(materialExtensions[EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS]){const sgExtension=extensions[EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS];materialType=sgExtension.getMaterialType(materialIndex);pending.push(sgExtension.extendParams(materialParams,{materialDef,parser}));}else if(materialExtensions[EXTENSIONS.KHR_MATERIALS_UNLIT]){materialType=extensions[EXTENSIONS.KHR_MATERIALS_UNLIT].getMaterialType(materialIndex);pending.push(extensions[EXTENSIONS.KHR_MATERIALS_UNLIT].extendParams(materialParams,{materialDef,parser}));}else{materialType=t.MeshStandardMaterial;const metallicRoughness=materialDef.pbrMetallicRoughness||{};materialParams.color=new t.Color(1,1,1);materialParams.opacity=1;if(Array.isArray(metallicRoughness.baseColorFactor)){const array=metallicRoughness.baseColorFactor;materialParams.color.fromArray(array);materialParams.opacity=array[3];}if(metallicRoughness.baseColorTexture!==undefined){pending.push(parser.assignTexture(materialParams,'map',metallicRoughness.baseColorTexture,t.sRGBEncoding));}materialParams.metalness=metallicRoughness.metallicFactor!==undefined?metallicRoughness.metallicFactor:1;materialParams.roughness=metallicRoughness.roughnessFactor!==undefined?metallicRoughness.roughnessFactor:1;if(metallicRoughness.metallicRoughnessTexture!==undefined){pending.push(parser.assignTexture(materialParams,'metalnessMap',metallicRoughness.metallicRoughnessTexture));pending.push(parser.assignTexture(materialParams,'roughnessMap',metallicRoughness.metallicRoughnessTexture));}}if(materialDef.doubleSided===true)materialParams.side=t.DoubleSide;const alphaMode=materialDef.alphaMode||ALPHA_MODES.OPAQUE;if(alphaMode===ALPHA_MODES.BLEND){materialParams.transparent=true;materialParams.depthWrite=false;}else{materialParams.transparent=false;if(alphaMode===ALPHA_MODES.MASK){materialParams.alphaTest=materialDef.alphaCutoff!==undefined?materialDef.alphaCutoff:0.5;}}if(materialDef.normalTexture!==undefined&&materialType!==t.MeshBasicMaterial){pending.push(parser.assignTexture(materialParams,'normalMap',materialDef.normalTexture));materialParams.normalScale=new t.Vector2(1,1);if(materialDef.normalTexture.scale!==undefined){const scale=materialDef.normalTexture.scale;materialParams.normalScale.set(scale,scale);}}if(materialDef.occlusionTexture!==undefined&&materialType!==t.MeshBasicMaterial){pending.push(parser.assignTexture(materialParams,'aoMap',materialDef.occlusionTexture));if(materialDef.occlusionTexture.strength!==undefined)materialParams.aoMapIntensity=materialDef.occlusionTexture.strength;}if(materialDef.emissiveFactor!==undefined&&materialType!==t.MeshBasicMaterial){materialParams.emissive=new t.Color().fromArray(materialDef.emissiveFactor);}if(materialDef.emissiveTexture!==undefined&&materialType!==t.MeshBasicMaterial){pending.push(parser.assignTexture(materialParams,'emissiveMap',materialDef.emissiveTexture,t.sRGBEncoding));}return Promise.all(pending).then(function(){let material;if(materialType===GLTFMeshStandardSGMaterial){material=extensions[EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS].createMaterial(materialParams);}else{material=new materialType(materialParams);}if(materialDef.name)material.name=materialDef.name;if(material.map)material.map.encoding=t.sRGBEncoding;if(material.emissiveMap)material.emissiveMap.encoding=t.sRGBEncoding;parser.associations.set(material,{materials:materialIndex});if(materialExtensions[EXTENSIONS.KHR_MATERIALS_UNLIT])return material;return extensions[EXTENSIONS.KHR_MATERIALS_CLEARCOAT]?extensions[EXTENSIONS.KHR_MATERIALS_CLEARCOAT].extendMaterialParams(materialIndex,material,materialParams,pending).then(()=>material):material;});}
  loadGeometries(primitives){const parser=this;const extensions=this.extensions;const cache=this.primitiveCache;function createDracoPrimitive(primitive){return extensions[EXTENSIONS.KHR_DRACO_MESH_COMPRESSION].decodePrimitive(primitive,parser).then(function(geometry){return addPrimitiveAttributes(geometry,primitive,parser);});}const pending=[];for(let i=0,il=primitives.length;i<il;i++){const primitive=primitives[i];const cacheKey=createPrimitiveKey(primitive);const cached=cache[cacheKey];if(cached){pending.push(cached.promise);}else{let geometryPromise;if(primitive.extensions&&primitive.extensions[EXTENSIONS.KHR_DRACO_MESH_COMPRESSION]){geometryPromise=createDracoPrimitive(primitive);}else{geometryPromise=addPrimitiveAttributes(new t.BufferGeometry(),primitive,parser);}cache[cacheKey]={primitive:primitive,promise:geometryPromise};pending.push(geometryPromise);}}return Promise.all(pending);}
  loadMesh(meshIndex){const parser=this;const json=this.json;const extensions=this.extensions;const meshDef=json.meshes[meshIndex];const primitives=meshDef.primitives;const pending=[];for(let i=0,il=primitives.length;i<il;i++){const material=primitives[i].material===undefined?createDefaultMaterial(this.cache):this.getDependency('material',primitives[i].material);pending.push(material);}pending.push(parser.loadGeometries(primitives));return Promise.all(pending).then(function(results){const materials=results.slice(0,results.length-1);const geometries=results[results.length-1];const meshes=[];for(let i=0,il=geometries.length;i<il;i++){const geometry=geometries[i];const primitive=primitives[i];let mesh;const material=materials[i];if(primitive.mode===WEBGL_CONSTANTS.TRIANGLES||primitive.mode===WEBGL_CONSTANTS.TRIANGLE_STRIP||primitive.mode===WEBGL_CONSTANTS.TRIANGLE_FAN||primitive.mode===undefined){meshDef.isSkinnedMesh===true?mesh=new t.SkinnedMesh(geometry,material):mesh=new t.Mesh(geometry,material);if(mesh.isSkinnedMesh===true&&!mesh.geometry.attributes.skinWeight.normalized){mesh.normalizeSkinWeights();}if(primitive.mode===WEBGL_CONSTANTS.TRIANGLE_STRIP){mesh.drawMode=t.TriangleStripDrawMode;}else if(primitive.mode===WEBGL_CONSTANTS.TRIANGLE_FAN){mesh.drawMode=t.TriangleFanDrawMode;}}else if(primitive.mode===WEBGL_CONSTANTS.LINES){mesh=new t.LineSegments(geometry,material);}else if(primitive.mode===WEBGL_CONSTANTS.LINE_STRIP){mesh=new t.Line(geometry,material);}else if(primitive.mode===WEBGL_CONSTANTS.LINE_LOOP){mesh=new t.LineLoop(geometry,material);}else if(primitive.mode===WEBGL_CONSTANTS.POINTS){mesh=new t.Points(geometry,material);}else{throw new Error('THREE.GLTFLoader: Primitive mode unsupported: '+primitive.mode);}if(Object.keys(mesh.geometry.morphAttributes).length>0){updateMorphTargets(mesh,meshDef);}mesh.name=parser.createUniqueName(meshDef.name||('mesh_'+meshIndex));if(geometries.length>1)mesh.name+='_'+i;parser.assignFinalMaterial(mesh);meshes.push(mesh);}if(meshes.length===1){return meshes[0];}const group=new t.Group();for(let i=0,il=meshes.length;i<il;i++)group.add(meshes[i]);return group;});}
  loadCamera(cameraIndex){let camera;const cameraDef=this.json.cameras[cameraIndex];const params={};if(cameraDef.type==='perspective'){const perspective=cameraDef.perspective;params.fov=t.MathUtils.radToDeg(perspective.yfov);params.aspect=perspective.aspectRatio||1;params.near=perspective.znear||1;params.far=perspective.zfar||2e6;camera=new t.PerspectiveCamera(params.fov,params.aspect,params.near,params.far);}else if(cameraDef.type==='orthographic'){camera=new t.OrthographicCamera(-(cameraDef.orthographic.xmag),cameraDef.orthographic.xmag,cameraDef.orthographic.ymag,-(cameraDef.orthographic.ymag),cameraDef.orthographic.znear,cameraDef.orthographic.zfar);}if(cameraDef.name)camera.name=this.createUniqueName(cameraDef.name);return Promise.resolve(camera);}
  loadSkin(skinIndex){const skinDef=this.json.skins[skinIndex];const skinEntry={joints:skinDef.joints};if(skinDef.inverseBindMatrices===undefined){return Promise.resolve(skinEntry);}return this.getDependency('accessor',skinDef.inverseBindMatrices).then(function(accessor){skinEntry.inverseBindMatrices=accessor;return skinEntry;});}
  loadAnimation(animationIndex){const json=this.json;const animationDef=json.animations[animationIndex];const animationName=animationDef.name?animationDef.name:'animation_'+animationIndex;const pendingNodes=[];const pendingInputAccessors=[];const pendingOutputAccessors=[];const pendingSamplers=[];const pendingTargets=[];for(let i=0,il=animationDef.channels.length;i<il;i++){const channel=animationDef.channels[i];const sampler=animationDef.samplers[channel.sampler];const target=channel.target;const name=target.node;const input=animationDef.parameters!==undefined?animationDef.parameters[sampler.input]:sampler.input;const output=animationDef.parameters!==undefined?animationDef.parameters[sampler.output]:sampler.output;if(target.node===undefined)continue;pendingNodes.push(this.getDependency('node',name));pendingInputAccessors.push(this.getDependency('accessor',input));pendingOutputAccessors.push(this.getDependency('accessor',output));pendingSamplers.push(sampler);pendingTargets.push(target);}return Promise.all([Promise.all(pendingNodes),Promise.all(pendingInputAccessors),Promise.all(pendingOutputAccessors)]).then(function(dependencies){const nodes=dependencies[0];const inputAccessors=dependencies[1];const outputAccessors=dependencies[2];const tracks=[];for(let i=0,il=nodes.length;i<il;i++){const node=nodes[i];const inputAccessor=inputAccessors[i];const outputAccessor=outputAccessors[i];const sampler=pendingSamplers[i];const target=pendingTargets[i];node.updateMatrix();const createdTracks=addAnimationTracks(node,target.path,sampler,inputAccessor,outputAccessor);tracks.push(...createdTracks);}return new t.AnimationClip(animationName,-1,tracks);});}
  createUniqueName(originalName){const sanitizedName=t.PropertyBinding.sanitizeNodeName(originalName||'');let name=sanitizedName;for(let i=1;this.nodeNamesUsed[name];++i){name=sanitizedName+'_'+i;}this.nodeNamesUsed[name]=true;return name;}
  loadNode(nodeIndex){const json=this.json;const extensions=this.extensions;const parser=this;const nodeDef=json.nodes[nodeIndex];const nodeName=nodeDef.name?parser.createUniqueName(nodeDef.name):'';return(function(){const pending=[];const meshPromise=parser._invokeOne(function(ext){return ext.createNodeMesh&&ext.createNodeMesh(nodeIndex);});if(meshPromise){pending.push(meshPromise);}if(nodeDef.camera!==undefined){pending.push(parser.getDependency('camera',nodeDef.camera).then(function(camera){return parser._invokeOne(function(ext){return ext.createNodeAttachment&&ext.createNodeAttachment(nodeIndex,camera);});}));}if(nodeDef.extensions&&nodeDef.extensions[EXTENSIONS.KHR_LIGHTS_PUNCTUAL]&&nodeDef.extensions[EXTENSIONS.KHR_LIGHTS_PUNCTUAL].light!==undefined){const lightIndex=nodeDef.extensions[EXTENSIONS.KHR_LIGHTS_PUNCTUAL].light;pending.push(parser.getDependency('light',lightIndex).then(function(light){return parser._invokeOne(function(ext){return ext.createNodeAttachment&&ext.createNodeAttachment(nodeIndex,light);});}));}return Promise.all(pending);}()).then(function(objects){let node;if(nodeDef.isBone===true){node=new t.Bone();}else if(objects.length===1&&objects[0].isMesh){node=objects[0];}else if(objects.length===1&&objects[0].isCamera){node=objects[0];}else{node=nodeDef.skin!==undefined?new t.Group():new t.Object3D();}if(node!==objects[0])for(let i=0,il=objects.length;i<il;i++)node.add(objects[i]);if(nodeDef.name){node.userData.name=nodeDef.name;node.name=nodeName;}parser.assignExtrasToUserData(node,nodeDef);if(nodeDef.extensions)addUnknownExtensionsToUserData(extensions,node,nodeDef);if(nodeDef.matrix!==undefined){const matrix=new t.Matrix4();matrix.fromArray(nodeDef.matrix);node.applyMatrix4(matrix);}else{if(nodeDef.translation!==undefined){node.position.fromArray(nodeDef.translation);}if(nodeDef.rotation!==undefined){node.quaternion.fromArray(nodeDef.rotation);}if(nodeDef.scale!==undefined){node.scale.fromArray(nodeDef.scale);}}parser.associations.set(node,{nodes:nodeIndex});return node;});}
  loadScene(sceneIndex){const extensions=this.extensions;const sceneDef=this.json.scenes[sceneIndex];const parser=this;const scene=new t.Group();if(sceneDef.name)scene.name=parser.createUniqueName(sceneDef.name);parser.assignExtrasToUserData(scene,sceneDef);if(sceneDef.extensions)addUnknownExtensionsToUserData(extensions,scene,sceneDef);const nodeIds=sceneDef.nodes||[];const pending=[];for(let i=0,il=nodeIds.length;i<il;i++){pending.push(parser.getDependency('node',nodeIds[i]).then(function(node){scene.add(node);}));}return Promise.all(pending).then(function(){return scene;});}
  assignExtrasToUserData(object,gltfDef){if(gltfDef.extras!==undefined){if(typeof gltfDef.extras==='object'){Object.assign(object.userData,gltfDef.extras);}else{console.warn('THREE.GLTFLoader: Ignoring primitive type .extras, '+gltfDef.extras);}}}
}
const WEBGL_CONSTANTS={FLOAT:5126,FLOAT_MAT3:35675,FLOAT_MAT4:35676,FLOAT_VEC2:35664,FLOAT_VEC3:35665,FLOAT_VEC4:35666,LINEAR:9729,REPEAT:10497,SAMPLER_2D:35678,POINTS:0,LINES:1,LINE_LOOP:2,LINE_STRIP:3,TRIANGLES:4,TRIANGLE_STRIP:5,TRIANGLE_FAN:6,UNSIGNED_BYTE:5121,UNSIGNED_SHORT:5123};
const WEBGL_COMPONENT_TYPES={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
const WEBGL_FILTERS={9728:t.NearestFilter,9729:t.LinearFilter,9984:t.NearestMipmapNearestFilter,9985:t.LinearMipmapNearestFilter,9986:t.NearestMipmapLinearFilter,9987:t.LinearMipmapLinearFilter};
const WEBGL_WRAPPING={33071:t.ClampToEdgeWrapping,33648:t.MirroredRepeatWrapping,10497:t.RepeatWrapping};
const WEBGL_TYPE_SIZES={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16};
const ALPHA_MODES={OPAQUE:'OPAQUE',MASK:'MASK',BLEND:'BLEND'};
class GLTFRegistry{constructor(){this.objects={};}get(key){return this.objects[key];}add(key,object){this.objects[key]=object;}remove(key){delete this.objects[key];}removeAll(){this.objects={};}}
function addUnknownExtensionsToUserData(knownExtensions,object,objectDef){for(const name in objectDef.extensions){if(knownExtensions[name]===undefined){object.userData.gltfExtensions=object.userData.gltfExtensions||{};object.userData.gltfExtensions[name]=objectDef.extensions[name];}}}
function createDefaultMaterial(cache){if(cache.get('DefaultMaterial')===undefined){cache.add('DefaultMaterial',new t.MeshStandardMaterial({color:0xFFFFFF,emissive:0x000000,metalness:1,roughness:1,transparent:false,depthTest:true,side:t.FrontSide}));}return cache.get('DefaultMaterial');}
function addPrimitiveAttributes(geometry,primitiveDef,parser){const attributes=primitiveDef.attributes;const pending=[];function assignAttributeAccessor(accessorIndex,attributeName){return parser.getDependency('accessor',accessorIndex).then(function(accessor){geometry.setAttribute(attributeName,accessor);});}for(const gltfAttributeName in attributes){const threeAttributeName=ATTRIBUTES[gltfAttributeName]||gltfAttributeName.toLowerCase();if(!geometry.attributes[threeAttributeName])pending.push(assignAttributeAccessor(attributes[gltfAttributeName],threeAttributeName));}if(primitiveDef.indices!==undefined&&!geometry.index){const accessor=parser.getDependency('accessor',primitiveDef.indices).then(function(accessor){geometry.setIndex(accessor);});pending.push(accessor);}parser.assignExtrasToUserData(geometry,primitiveDef);return Promise.all(pending).then(function(){return primitiveDef.targets!==undefined?addMorphTargets(geometry,primitiveDef.targets,parser):geometry;});}
const ATTRIBUTES={POSITION:'position',NORMAL:'normal',TANGENT:'tangent',TEXCOORD_0:'uv',TEXCOORD_1:'uv2',COLOR_0:'color',WEIGHTS_0:'skinWeight',JOINTS_0:'skinIndex'};
function addMorphTargets(geometry,targets,parser){let hasMorphPosition=false;let hasMorphNormal=false;for(let i=0,il=targets.length;i<il;i++){const target=targets[i];if(target.POSITION!==undefined)hasMorphPosition=true;if(target.NORMAL!==undefined)hasMorphNormal=true;if(hasMorphPosition&&hasMorphNormal)break;}if(!hasMorphPosition&&hasMorphNormal)return Promise.resolve(geometry);const pending=[];for(let i=0,il=targets.length;i<il;i++){const target=targets[i];const attributePending=[];if(hasMorphPosition&&target.POSITION!==undefined)attributePending.push(parser.getDependency('accessor',target.POSITION));if(hasMorphNormal&&target.NORMAL!==undefined)attributePending.push(parser.getDependency('accessor',target.NORMAL));pending.push(Promise.all(attributePending));}return Promise.all(pending).then(function(accessors){const morphPositions=[];const morphNormals=[];for(let i=0,il=accessors.length;i<il;i++){const accessor=accessors[i];let ai=0;if(hasMorphPosition&&accessor[ai]!==undefined){morphPositions.push(accessor[ai]);ai++;}if(hasMorphNormal&&accessor[ai]!==undefined){morphNormals.push(accessor[ai]);}}if(hasMorphPosition)geometry.morphAttributes.position=morphPositions;if(hasMorphNormal)geometry.morphAttributes.normal=morphNormals;geometry.morphTargetsRelative=true;return geometry;});}
function updateMorphTargets(mesh,meshDef){mesh.updateMorphTargets();if(meshDef.weights!==undefined){for(let i=0,il=meshDef.weights.length;i<il;i++){mesh.morphTargetInfluences[i]=meshDef.weights[i];}}if(meshDef.extras&&Array.isArray(meshDef.extras.targetNames)){const targetNames=meshDef.extras.targetNames;if(mesh.morphTargetInfluences.length===targetNames.length){mesh.morphTargetDictionary={};for(let i=0,il=targetNames.length;i<il;i++){mesh.morphTargetDictionary[targetNames[i]]=i;}}else{console.warn('THREE.GLTFLoader: Invalid extras.targetNames length. Ignoring names.');}}}
function createPrimitiveKey(primitiveDef){const dracoExtension=primitiveDef.extensions&&primitiveDef.extensions[EXTENSIONS.KHR_DRACO_MESH_COMPRESSION];let geometryKey;if(dracoExtension){geometryKey='draco:'+dracoExtension.bufferView+':'+dracoExtension.indices+':'+createAttributesKey(dracoExtension.attributes);}else{geometryKey=primitiveDef.indices+':'+createAttributesKey(primitiveDef.attributes)+':'+primitiveDef.mode;}return geometryKey;}
function createAttributesKey(attributes){let attributesKey='';const keys=Object.keys(attributes).sort();for(let i=0,il=keys.length;i<il;i++){attributesKey+=keys[i]+':'+attributes[keys[i]]+'.';}return attributesKey;}
function addAnimationTracks(node,path,sampler,inputAccessor,outputAccessor){const tracks=[];const TypedKeyframeTrack={position:t.VectorKeyframeTrack,rotation:t.QuaternionKeyframeTrack,scale:t.VectorKeyframeTrack,weights:t.NumberKeyframeTrack}[path];if(!TypedKeyframeTrack)return tracks;const targetName=node.name?node.name:node.uuid;const times=inputAccessor.array;let values;if(path==='weights'){const valueMorphTargetCount=node.updateMorphTargets?node.morphTargetInfluences.length:outputAccessor.count/inputAccessor.count;values=new Float32Array(times.length*valueMorphTargetCount);let o=0;for(let j=0;j<times.length;j++){for(let k=0;k<valueMorphTargetCount;k++){values[o++]=outputAccessor.getX(j*valueMorphTargetCount+k);}}}else{values=outputAccessor.array;}const interpolation=sampler.interpolation!==undefined?INTERPOLATION[sampler.interpolation]:t.InterpolateLinear;if(interpolation===t.InterpolateLinear&&inputAccessor.count===1){values=values.slice();}tracks.push(new TypedKeyframeTrack(targetName+'.'+PATH_PROPERTIES[path],times,values,interpolation));return tracks;}
const INTERPOLATION={CATMULLROMSPLINE:t.InterpolateSmooth,CUBICSPLINE:t.InterpolateSmooth,LINEAR:t.InterpolateLinear,STEP:t.InterpolateDiscrete};
const PATH_PROPERTIES={scale:'scale',translation:'position',rotation:'quaternion',weights:'morphTargetInfluences'};
GLTFParser.prototype.createNodeMesh=function(nodeIndex){const json=this.json;const nodeDef=json.nodes[nodeIndex];if(nodeDef.mesh===undefined)return null;return this.getDependency('mesh',nodeDef.mesh).then(mesh=>{const node=this._getNodeRef(this.meshCache,nodeDef.mesh,mesh);if(nodeDef.weights){node.traverse(o=>{if(o.isMesh){for(let i=0,il=nodeDef.weights.length;i<il;i++){o.morphTargetInfluences[i]=nodeDef.weights[i];}}});}return node;});};
GLTFParser.prototype._getNodeRef=function(cache,index,object){if(cache.refs[index]===undefined){cache.refs[index]=cache.uses[index]=0;}const ref=object;if(cache.refs[index]>0){const cloned=object.clone();cloned.name+='_instance_'+cache.uses[index]++;return cloned;}cache.refs[index]++;return ref;};
window.GLTFLoader=GLTFLoader;
})();

// ─── MAIN SCENE ────────────────────────────────────────────────────────────────
const THREE = window.THREE;

const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById('three-canvas'),
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.55; 
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050402);

const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

(function buildEnvMap() {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const t = y / size;
      const r = t < 0.5 ? Math.floor(8 + t * 30) : Math.floor(22 + (t - 0.5) * 60);
      const g = t < 0.5 ? Math.floor(8 + t * 20) : Math.floor(14 + (t - 0.5) * 28);
      const b = t < 0.5 ? Math.floor(18 + t * 40) : Math.floor(4);
      data[i] = r; data[i+1] = g; data[i+2] = b; data[i+3] = 255;
    }
  }
  const envTex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  envTex.encoding = THREE.sRGBEncoding;
  envTex.needsUpdate = true;
  const envRT = pmremGenerator.fromEquirectangular(envTex);
  scene.environment = envRT.texture;
  pmremGenerator.dispose();
})();

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 1000);
camera.position.set(0, 1.5, 6);
camera.lookAt(0, 0, 0);

const ambient = new THREE.AmbientLight(0x0d0804, 0.15);
scene.add(ambient);

const keyLight = new THREE.SpotLight(0xffd080, 8, 30, Math.PI / 9, 0.25, 1.8);
keyLight.position.set(1.5, 9, 3.5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.width = 2048;
keyLight.shadow.mapSize.height = 2048;
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 40;
keyLight.shadow.bias = -0.0008;
keyLight.shadow.radius = 3;
scene.add(keyLight);
scene.add(keyLight.target);

const rimLight = new THREE.SpotLight(0xb8d0ff, 4.5, 25, Math.PI / 12, 0.1, 2);
rimLight.position.set(-4, 3, -5);
rimLight.castShadow = false;
scene.add(rimLight);
scene.add(rimLight.target);

const bounceLight = new THREE.PointLight(0x5a2e00, 1.2, 8, 2);
bounceLight.position.set(0, -3, 1);
scene.add(bounceLight);

const hairLight = new THREE.DirectionalLight(0xffe4b0, 0.6);
hairLight.position.set(5, 1, -1);
scene.add(hairLight);

const shadowCatchGeo = new THREE.PlaneGeometry(12, 12);
const shadowCatchMat = new THREE.ShadowMaterial({ opacity: 0.55 });
const shadowCatch = new THREE.Mesh(shadowCatchGeo, shadowCatchMat);
shadowCatch.rotation.x = -Math.PI / 2;
shadowCatch.position.y = -2.8;
shadowCatch.receiveShadow = true;
scene.add(shadowCatch);

const backdropGeo = new THREE.PlaneGeometry(6, 10);
const backdropMat = new THREE.ShadowMaterial({ opacity: 0.4 });
const backdrop = new THREE.Mesh(backdropGeo, backdropMat);
backdrop.position.set(0, 0, -1.2);
backdrop.receiveShadow = true;
scene.add(backdrop);

let needle = null;
let needleLoaded = false;
let modelBox = null;

let phase = 0; 
let t_phase = 0;
let impactTime = 0;
let ribbonStarted = false;
let welcomeShown = false;
let finalShown = false;

const FALL_START_Y = 12;
const LAND_Y = 0;
let needleY = FALL_START_Y;
let needleVY = 0;
let landed = false;
let bounces = 0;
const GRAVITY = -18;
const BOUNCE_DAMPS = [0.38, 0.18, 0.08];

const loader = new GLTFLoader();
(async () => {
  try {
    const resp = await fetch('/mnt/user-data/uploads/uploads_files_3424082_Needle.glb');
    const arrayBuf = await resp.arrayBuffer();
    loader.parse(arrayBuf, '', (gltf) => {
      needle = gltf.scene;
      const box = new THREE.Box3().setFromObject(needle);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 3.5 / maxDim;
      needle.scale.setScalar(scale);

      const center = new THREE.Vector3();
      box.getCenter(center);
      needle.position.set(-center.x * scale, FALL_START_Y, -center.z * scale);
      needle.rotation.z = 0;

      needle.traverse(c => {
        if (c.isMesh) {
          c.castShadow = true;
          c.receiveShadow = true;
          if (c.material) {
            c.material = new THREE.MeshStandardMaterial({
              color: new THREE.Color(0x4a3510),
              metalness: 1.0,
              roughness: 0.08,
              envMapIntensity: 2.2,
              emissive: new THREE.Color(0x1a0d00),
              emissiveIntensity: 0.4,
            });
            c.material.needsUpdate = true;
          }
        }
      });
      scene.add(needle);
      needleLoaded = true;
    }, (err) => {
      buildFallbackNeedle();
    });
  } catch(e) {
    buildFallbackNeedle();
  }
})();

function buildFallbackNeedle() {
  const grp = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x3a2808),
    metalness: 1.0,
    roughness: 0.06,
    emissive: new THREE.Color(0x0d0700),
    emissiveIntensity: 0.5,
  });

  const shaftGeo = new THREE.CylinderGeometry(0.038, 0.016, 3.6, 32, 8);
  const shaft = new THREE.Mesh(shaftGeo, mat);
  shaft.castShadow = true;
  shaft.receiveShadow = true;

  const headGeo = new THREE.CylinderGeometry(0.095, 0.040, 0.24, 32, 4);
  const head = new THREE.Mesh(headGeo, mat);
  head.position.y = 1.92;
  head.castShadow = true;

  const capGeo = new THREE.SphereGeometry(0.095, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const cap = new THREE.Mesh(capGeo, mat);
  cap.position.y = 2.04;
  cap.castShadow = true;

  const tipGeo = new THREE.ConeGeometry(0.016, 0.55, 24, 6);
  const tip = new THREE.Mesh(tipGeo, mat);
  tip.position.y = -2.075;
  tip.castShadow = true;

  const eyeMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x2a1a06),
    metalness: 1.0,
    roughness: 0.12,
    emissive: new THREE.Color(0x050200),
    emissiveIntensity: 0.3,
  });
  const eyeGeo = new THREE.TorusGeometry(0.052, 0.016, 16, 32);
  const eye = new THREE.Mesh(eyeGeo, eyeMat);
  eye.position.y = 1.72;
  eye.rotation.x = Math.PI / 2;
  eye.castShadow = true;

  grp.add(shaft, head, cap, tip, eye);
  grp.position.set(0, FALL_START_Y, 0);
  needle = grp;
  scene.add(needle);
  needleLoaded = true;
}

const ribbonCanvas = document.getElementById('ribbon-canvas');
const rctx = ribbonCanvas.getContext('2d');
ribbonCanvas.width = window.innerWidth;
ribbonCanvas.height = window.innerHeight;

let ribbonProgress = 0; 
const RIBBON_TEXT = '  EVERY CLOTHING NEEDS  THREADZ  ·  EVERY CLOTHING NEEDS  THREADZ  ·  EVERY CLOTHING NEEDS  THREADZ  ·  ';

function drawRibbon(progress, alpha) {
  rctx.clearRect(0, 0, ribbonCanvas.width, ribbonCanvas.height);
  if (progress <= 0 || alpha <= 0) return;

  const cx = ribbonCanvas.width / 2;
  const cy = ribbonCanvas.height / 2;
  const turns = 2.2;
  const maxAngle = turns * Math.PI * 2;
  const angleRange = maxAngle * progress;
  const steps = Math.floor(angleRange / 0.03);
  if (steps < 2) return;

  const rStart = 40;
  const rEnd = 260;
  const yStart = cy - 160;
  const yEnd = cy + 160;
  const ribbonW = 28;

  rctx.save();
  rctx.globalAlpha = alpha;

  for (let i = 0; i < steps - 1; i++) {
    const frac0 = i / (steps - 1);
    const frac1 = (i + 1) / (steps - 1);
    const angle0 = -Math.PI/2 + frac0 * angleRange;
    const angle1 = -Math.PI/2 + frac1 * angleRange;
    const r0 = rStart + (rEnd - rStart) * frac0;
    const r1 = rStart + (rEnd - rStart) * frac1;
    const y0 = yStart + (yEnd - yStart) * frac0;
    const y1 = yStart + (yEnd - yStart) * frac1;
    const x0 = cx + Math.cos(angle0) * r0;
    const x1 = cx + Math.cos(angle1) * r1;
    const z0 = Math.sin(angle0);
    const z1 = Math.sin(angle1);

    const zFac0 = (z0 + 1) * 0.5;
    const opacity0 = 0.25 + zFac0 * 0.55;
    const col0 = `rgba(${Math.floor(160+40*zFac0)},${Math.floor(130+30*zFac0)},${Math.floor(60+20*zFac0)},${opacity0})`;

    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.sqrt(dx*dx+dy*dy) || 1;
    const nx = -dy/len * ribbonW/2;
    const ny = dx/len * ribbonW/2;

    const grad = rctx.createLinearGradient(x0-nx, y0-ny, x0+nx, y0+ny);
    grad.addColorStop(0, `rgba(80,60,20,${opacity0*0.4})`);
    grad.addColorStop(0.3, col0);
    grad.addColorStop(0.5, `rgba(220,185,90,${opacity0})`);
    grad.addColorStop(0.7, col0);
    grad.addColorStop(1, `rgba(80,60,20,${opacity0*0.4})`);

    rctx.beginPath();
    rctx.moveTo(x0-nx, y0-ny);
    rctx.lineTo(x0+nx, y0+ny);
    rctx.lineTo(x1+nx*r1/r0, y1+ny*r1/r0);
    rctx.lineTo(x1-nx*r1/r0, y1-ny*r1/r0);
    rctx.closePath();
    rctx.fillStyle = grad;
    rctx.fill();
  }

  rctx.font = `bold ${Math.floor(9 + progress*3)}px 'Outfit', sans-serif`;
  rctx.letterSpacing = '0.25em';
  const textRepeat = RIBBON_TEXT;
  const totalArcLen = angleRange * ((rStart+rEnd)/2);
  let arcLen = 0;
  const charsPerLen = textRepeat.length / totalArcLen;

  for (let i = 0; i < steps - 1; i++) {
    const frac = i / (steps - 1);
    const angle = -Math.PI/2 + frac * angleRange;
    const r = rStart + (rEnd - rStart) * frac;
    const y = yStart + (yEnd - yStart) * frac;
    const x = cx + Math.cos(angle) * r;
    const z = Math.sin(angle);
    const zFac = (z + 1) * 0.5;
    const segLen = r * 0.03;
    arcLen += segLen;

    const charIdx = Math.floor(arcLen * charsPerLen) % textRepeat.length;
    const ch = textRepeat[charIdx];

    const nextAngle = angle + 0.03;
    const nx2 = cx + Math.cos(nextAngle) * r;
    const dy2 = (yStart + (yEnd-yStart)*((i+1)/(steps-1))) - y;
    const dx2 = nx2 - x;
    const rot = Math.atan2(dy2, dx2);

    const opacity = 0.5 + zFac * 0.5;
    rctx.save();
    rctx.translate(x, y);
    rctx.rotate(rot);
    rctx.fillStyle = `rgba(240,215,140,${opacity * alpha})`;
    rctx.shadowColor = `rgba(201,168,76,${0.6*alpha})`;
    rctx.shadowBlur = 4;
    rctx.fillText(ch, 0, 0);
    rctx.restore();
  }
  rctx.restore();
}

const particles = [];
function spawnImpact(x, y, z) {
  for (let i = 0; i < 22; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.5 + Math.random() * 3;
    const p = {
      x, y, z,
      vx: Math.cos(angle) * speed,
      vy: 1 + Math.random() * 4,
      vz: Math.sin(angle) * speed * 0.3,
      life: 1,
      size: 0.03 + Math.random() * 0.06
    };
    particles.push(p);
  }
}

const particleMeshes = [];
const pMat = new THREE.MeshBasicMaterial({color: 0xc9a84c, transparent: true});
for (let i = 0; i < 22; i++) {
  const pm = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), pMat.clone());
  pm.visible = false;
  scene.add(pm);
  particleMeshes.push(pm);
}

const clock = new THREE.Clock();
let totalTime = 0;
let ribbonAlpha = 0;

function easeOut(t, p=3) { return 1 - Math.pow(1-t, p); }

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  totalTime += dt;

  if (!needleLoaded) { renderer.render(scene, camera); return; }

  if (phase === 0) {
    if (!landed) {
      needleVY += GRAVITY * dt;
      needleY += needleVY * dt;

      const fallProgress = Math.max(0, Math.min(1, (FALL_START_Y - needleY) / (FALL_START_Y - LAND_Y)));
      if (fallProgress > 0.08) {
        const fRibbonProg = fallProgress * 0.45;
        const fAlpha = (fallProgress - 0.08) / 0.92 * 0.65;
        ribbonCanvas.style.opacity = '1';
        drawRibbon(fRibbonProg, fAlpha);
      }

      if (needleY <= LAND_Y) {
        needleY = LAND_Y;
        if (bounces < BOUNCE_DAMPS.length) {
          needleVY = Math.abs(needleVY) * BOUNCE_DAMPS[bounces];
          bounces++;
          if (bounces === 1) {
            spawnImpact(0, LAND_Y, 0);
            keyLight.intensity = 20;
            document.getElementById('center-glow').style.opacity = '1';
          }
        } else {
          landed = true;
          needleY = LAND_Y;
          needleVY = 0;
          impactTime = totalTime;
          phase = 1;
        }
      }
      needle.rotation.z = Math.sin(totalTime * 0.4) * 0.04;
    }
    needle.position.y = needleY;
  }

  if (keyLight.intensity > 8) {
    keyLight.intensity = Math.max(8, keyLight.intensity - 50 * dt);
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.vy -= 9.8 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.life -= dt * 1.4;
    const pm = particleMeshes[i % particleMeshes.length];
    if (p.life > 0) {
      pm.visible = true;
      pm.position.set(p.x, p.y, p.z);
      pm.material.opacity = p.life;
      pm.scale.setScalar(p.size * p.life);
    } else {
      pm.visible = false;
      particles.splice(i, 1);
    }
  }

  if (phase === 1 && landed) {
    const elapsed = totalTime - impactTime;
    if (elapsed > 0.8) {
      phase = 2;
      ribbonStarted = true;
      ribbonProgress = Math.max(ribbonProgress, 0.45); 
      ribbonCanvas.style.opacity = '1';
      document.getElementById('phase-tagline').style.opacity = '1';
    }
  }

  if (phase === 2) {
    ribbonProgress = Math.min(1, ribbonProgress + dt / 1.8);
    ribbonAlpha = Math.min(1, easeOut(ribbonProgress, 2) * 1.3);
    drawRibbon(ribbonProgress, ribbonAlpha);

    if (needle) needle.rotation.y += dt * 0.12;

    if (ribbonProgress >= 1 && !welcomeShown) {
      welcomeShown = true;
      phase = 3;
      setTimeout(() => {
        let fadeOut = 1;
        const fi = setInterval(() => {
          fadeOut -= 0.025;
          ribbonAlpha = Math.max(0, fadeOut);
          drawRibbon(1, ribbonAlpha);
          if (fadeOut <= 0) { clearInterval(fi); ribbonCanvas.style.opacity='0'; }
        }, 30);
        document.getElementById('phase-tagline').style.opacity = '0';
      }, 400);
    }
  }

  if (phase === 3 && !finalShown) {
    finalShown = true;
    const welcome = document.getElementById('welcome-overlay');
    if (welcome) {
        welcome.style.opacity = '1';
        setTimeout(() => {
        welcome.style.opacity = '0';
        setTimeout(() => {
            phase = 4;
            // Transition to actual website
            document.body.classList.add('entering');
            
            // Fade out the 3D layers
            document.getElementById('canvas-container').style.opacity = '0';
            document.getElementById('vignette').style.opacity = '0';
            document.getElementById('grain').style.opacity = '0';
            
            setTimeout(() => {
                document.getElementById('canvas-container').style.display = 'none';
            }, 1500);
            
        }, 1800);
        }, 2200);
    }
  }

  if (phase >= 4) {
    if (needle) {
      needle.rotation.y += dt * 0.06;
      needle.position.y = LAND_Y + Math.sin(totalTime * 0.4) * 0.015;
    }
    camera.position.x = Math.sin(totalTime * 0.08) * 0.3;
    camera.position.y = 1.5 + Math.sin(totalTime * 0.12) * 0.1;
    camera.lookAt(0, LAND_Y + 0.5, 0);
  }

  if (phase <= 2 && needle) {
    const targetY = needleY + 1.5;
    camera.position.y += (targetY - camera.position.y) * 0.08;
    camera.lookAt(0, needleY, 0);
  }

  if (needle) needle.position.y = needleY;

  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  ribbonCanvas.width = window.innerWidth;
  ribbonCanvas.height = window.innerHeight;
});

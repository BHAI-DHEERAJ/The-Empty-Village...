import { DoubleSide, MeshBasicMaterial } from 'three';
import { imageMaterial } from '../materials.js';
import { setBatchPaint } from './modeling.js';

export function villagePalette(textures) {
  const paint=new Map();
  const finish = (id, color, properties = {}) => {
    const material=imageMaterial(textures[id],{color,...properties});
    material.userData.tile=textures[id].tile;
    const key=id+JSON.stringify(properties);
    if(!paint.has(key))paint.set(key,imageMaterial(textures[id],{...properties,vertexColors:true}));
    setBatchPaint(material,paint.get(key));
    return material;
  };
  const glow = (color)=>new MeshBasicMaterial({map:textures.glass.albedo,color,toneMapped:false});
  return {
    plaster: finish('plaster',0xe5daca),
    mutedPlaster: finish('plaster',0xb2b4af),
    mutedGreen: finish('plaster',0x809993),
    mutedBlue: finish('plaster',0x8b9ca7),
    mutedOchre: finish('plaster',0xb99a71),
    lime: finish('damp',0xb6ad95),
    mutedLime: finish('damp',0x82948e),
    adobe: finish('adobe',0xe5c8a2),
    darkAdobe: finish('adobe',0xbd9473),
    brick: finish('brick',0xe0bca2),
    oldBrick: finish('brick',0xa79388),
    cement: finish('cement',0xc4c8bc),
    floor: finish('floor',0xaba899),
    rock: finish('masonry',0xc7c4b1),
    shrineStone: finish('masonry',0x9e998b,{strength:.51}),
    stoneMoss: finish('rock',0x96a083),
    roof: finish('roof',0xe2c7b5,{strength:.73}),
    thatch: finish('thatch',0xc3ae89),
    timber: finish('timber',0xd1b798),
    wood: finish('timber',0xdec4a5),
    darkWood: finish('boards',0xb39d82),
    softWood: finish('boards',0xd0bea4),
    door: finish('gate',0xc3a686),
    paintedWood: finish('timber',0x8fa69d),
    indigoWood: finish('timber',0x929fb3),
    board: finish('timber',0x3e5552,{strength:.20}),
    rust: finish('rust',0xd3af99),
    iron: finish('rust',0xb1b9b6),
    dullTeal: finish('rust',0x7c9d99,{metalness:.47}),
    tractorRed: finish('rust',0xa85641,{metalness:.40}),
    paper: finish('paper',0xd3b591,{side:DoubleSide}),
    photo: finish('photo',0xe9dcc9,{side:DoubleSide}),
    ink: finish('paper',0x202226),
    chalk: finish('plaster',0xe1d5c3,{side:DoubleSide}),
    pottery: finish('pottery',0xe09f6b,{side:DoubleSide}),
    cloth: finish('linen',0xe7d6b9,{side:DoubleSide}),
    dirtyCloth: finish('linen',0xaaa682,{side:DoubleSide}),
    bedRed: finish('cloth',0xa86858,{side:DoubleSide}),
    bedBlue: finish('cloth',0x7c949e,{side:DoubleSide}),
    rope: finish('linen',0xb99b74),
    web: finish('linen',0xdfd2b2,{transparent:true,opacity:.77,depthWrite:false,roughness:1}),
    glass: finish('glass',0x9aacb5,{roughness:.41,metalness:.19,side:DoubleSide,strength:.15}),
    darkGlass: finish('glass',0x555e62,{roughness:.64,side:DoubleSide}),
    carPaint: finish('carBody',0xe5d9bc,{strength:.78}),
    carTop: finish('carBody',0xbfcbae,{strength:.78}),
    carHoodInside: finish('carBody',0x746b55,{strength:.69}),
    carGlass: finish('glass',0xc0d3dc,{transparent:true,opacity:.139,depthWrite:false,side:DoubleSide,roughness:.48,strength:.16}),
    carTire: finish('cloth',0x403c3b,{strength:.50}),
    water: finish('water',0x657986,{roughness:.56,metalness:.17,emissive:0x7490aa,emissiveMap:textures.water.albedo,emissiveIntensity:.14}),
    black: finish('cloth',0x3d3a3a),
    rubber: finish('cloth',0x514a48),
    leather: finish('linen',0xaa9774),
    bark: finish('bark',0xb1a095),
    leaf: finish('leaf',0xcfb994,{side:DoubleSide,alphaTest:.42}),
    crop: finish('broadleaf',0xafaa78,{side:DoubleSide,alphaTest:.43}),
    grass: finish('wildGrass',0xccc4a3,{side:DoubleSide,alphaTest:.37}),
    soil: finish('earth',0xb3a696),
    paving: finish('gravel',0xb5b0a4),
    bulb: glow(0xf0a759),
    deadBulb: finish('glass',0x7a7562),
  };
}

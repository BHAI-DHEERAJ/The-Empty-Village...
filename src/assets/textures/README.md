# Texture assets

The scene uses UV-mapped geometry and locally bundled WebP files. **The Watcher's textures were generated for this project**: a front-facing death-mask image was projected and feathered around the sculpt's head UVs; separate generated ash-gray skin and charcoal cloth swatches cover the rest of its skinned mesh. The nine files in `watcher/` include those albedos and offline normal/AO–roughness–metallic derivatives. No existing character model or external character texture pack is used for the Watcher.

`*-albedo.webp` is color (sRGB); `*-normal-gl.webp` is an OpenGL normal map; `*-orm-height.webp` is **RGB occlusion, roughness, and metalness**. All non-color maps load without a color conversion. Fir bark uses a separate displacement image. Tile sizes and paths are in `src/game/world/surfaceCatalog.js`.

## Village image credits

The following village images are derived from [Poly Haven](https://polyhaven.com/license) CC0 assets. The mirror column lists the repositories used to obtain the reusable originals.

| Local material | Poly Haven original | Source mirror |
| --- | --- | --- |
| `ground/leafy-grass` | [CC0 source](https://polyhaven.com/a/leafy_grass) | [x0finch/Plinth](https://github.com/x0finch/Plinth) |
| `ground/farm-soil` | [CC0 source](https://polyhaven.com/a/farm_soil) | [x0finch/Plinth](https://github.com/x0finch/Plinth) |
| `ground/gravel-floor` | [CC0 source](https://polyhaven.com/a/gravel_floor_02) | [x0finch/Plinth](https://github.com/x0finch/Plinth) |
| `ground/brown-mud` | [CC0 source](https://polyhaven.com/a/brown_mud_dry) | [Nik5479/unity6-game](https://github.com/Nik5479/unity6-game) |
| `ground/forest-litter` | [CC0 source](https://polyhaven.com/a/forrest_ground_01) | [naosuke0506-max/forest-game](https://github.com/naosuke0506-max/forest-game) |
| `stone/mossy-rock` | [CC0 source](https://polyhaven.com/a/mossy_rock) | [naosuke0506-max/forest-game](https://github.com/naosuke0506-max/forest-game) |
| `stone/masonry-slates` | [CC0 source](https://polyhaven.com/a/castle_wall_slates) | [naosuke0506-max/forest-game](https://github.com/naosuke0506-max/forest-game) |
| `buildings/rough-lime` | [CC0 source](https://polyhaven.com/a/white_plaster_rough_01) | [naosuke0506-max/forest-game](https://github.com/naosuke0506-max/forest-game) |
| `buildings/stucco` | [CC0 source](https://polyhaven.com/a/white_stucco) | [x0finch/Plinth](https://github.com/x0finch/Plinth) |
| `buildings/adobe-block` | [CC0 source](https://polyhaven.com/a/clay_block_wall) | [Nik5479/unity6-game](https://github.com/Nik5479/unity6-game) |
| `buildings/village-brick` | [CC0 source](https://polyhaven.com/a/brick_4) | [Nik5479/unity6-game](https://github.com/Nik5479/unity6-game) |
| `buildings/brushed-concrete` | [CC0 source](https://polyhaven.com/a/brushed_concrete) | [x0finch/Plinth](https://github.com/x0finch/Plinth) |
| `buildings/scuffed-cement` | [CC0 source](https://polyhaven.com/a/scuffed_cement) | [x0finch/Plinth](https://github.com/x0finch/Plinth) |
| `buildings/clay-roof` | [CC0 source](https://polyhaven.com/a/clay_roof_tiles) | [naosuke0506-max/forest-game](https://github.com/naosuke0506-max/forest-game) |
| `buildings/thatch-roof` | [CC0 source](https://polyhaven.com/a/thatch_roof_angled) | [Nik5479/unity6-game](https://github.com/Nik5479/unity6-game) |
| `buildings/weathered-timber` | [CC0 source](https://polyhaven.com/a/weathered_brown_planks) | [naosuke0506-max/forest-game](https://github.com/naosuke0506-max/forest-game) |
| `buildings/old-planks` | [CC0 source](https://polyhaven.com/a/old_planks_02) | [naosuke0506-max/forest-game](https://github.com/naosuke0506-max/forest-game) |
| `buildings/wooden-gate` | [CC0 source](https://polyhaven.com/a/wooden_gate) | [naosuke0506-max/forest-game](https://github.com/naosuke0506-max/forest-game) |
| `vegetation/bark` | [CC0 source](https://polyhaven.com/a/pine_bark) | [naosuke0506-max/forest-game](https://github.com/naosuke0506-max/forest-game) |
| `vegetation/fir-shoot` | [CC0 source](https://polyhaven.com/a/fir_tree_01) | [mightywickedsounds-gif/groundwork](https://github.com/mightywickedsounds-gif/groundwork) |
| `vegetation/grass-clump` | [CC0 source](https://polyhaven.com/a/grass_medium_01) | [mightywickedsounds-gif/groundwork](https://github.com/mightywickedsounds-gif/groundwork) |
| `vegetation/leaf-shoot` | [CC0 source](https://polyhaven.com/a/tree_small_02) | [mightywickedsounds-gif/groundwork](https://github.com/mightywickedsounds-gif/groundwork) |
| `props/ceramic` | [CC0 source](https://polyhaven.com/a/clay_floor_001) | [x0finch/Plinth](https://github.com/x0finch/Plinth) |
| `props/rough-linen` | [CC0 source](https://polyhaven.com/a/rough_linen) | [x0finch/Plinth](https://github.com/x0finch/Plinth) |
| `props/faded-cloth` | [CC0 source](https://polyhaven.com/a/cotton_jersey) | [x0finch/Plinth](https://github.com/x0finch/Plinth) |
| `props/pitted-rust` | [CC0 source](https://polyhaven.com/a/rust_coarse_01) | [21Suspect/SILENCE](https://github.com/21Suspect/SILENCE) |
| `props/dim-glass` | [CC0 source](https://polyhaven.com/a/moonless_golf) | [mrdoob/three.js](https://github.com/mrdoob/three.js) |
| `vegetation/fir-bark` | [fir_tree_01](https://polyhaven.com/a/fir_tree_01) (Rico Cilliers, Rob Tuytel) | [21Suspect/SILENCE](https://github.com/21Suspect/SILENCE) |
| `vegetation/leaf-shoot` | [tree_small_02](https://polyhaven.com/a/tree_small_02) | [mightywickedsounds-gif/groundwork](https://github.com/mightywickedsounds-gif/groundwork) |
| `vegetation/grass-clump` | [grass_medium_01](https://polyhaven.com/a/grass_medium_01) | [mightywickedsounds-gif/groundwork](https://github.com/mightywickedsounds-gif/groundwork) |
| `props/aged-paper` | [book_pattern](https://polyhaven.com/a/book_pattern) | [21Suspect/SILENCE](https://github.com/21Suspect/SILENCE) |
| `props/dim-glass`, `props/night-reflection` | [Moonless Golf](https://polyhaven.com/a/moonless_golf) | [mrdoob/three.js](https://github.com/mrdoob/three.js) |
| `sky/kloppenheim-night` | [Kloppenheim 02 Pure Sky](https://polyhaven.com/a/kloppenheim_02_puresky) | [naosuke0506-max/forest-game](https://github.com/naosuke0506-max/forest-game) |
| `sky/kloofendal-cloud` | [Kloofendal 48d Partly Cloudy Pure Sky](https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky) | [naosuke0506-max/forest-game](https://github.com/naosuke0506-max/forest-game) |

- `vegetation/autumn-leaf` is a recolored leaf cutout from the foliage atlas. `props/village-print` is adapted from [Village scene, India, ca. 1920](https://commons.wikimedia.org/wiki/File:Village_scene,_India,_ca._1920_(IMP-CSCNWW33-OS16-66).jpg), University of Edinburgh/USC digital collection, unknown photographer, Public Domain Mark 1.0.
- `sky/lunar-surface` uses the [NASA 3D Resources lunar image](https://github.com/nasa/NASA-3D-Resources/tree/master/Images%20and%20Textures/Moon), under [NASA's image and media usage guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/).

### Satrod Kalan phone art

`src/assets/phone/phone-{dada,family,meera,ravi}-albedo.webp` are generated portraits of fictional characters. The phone displays them in its gallery and contacts; they are not loaded as 3D world materials.

### Car and apparition materials

`vehicle/oxidized-bodywork`, `haunt/funeral-cotton`, and `haunt/cracked-mask` are original generated base-color maps. The matching 512-pixel tangent-space normals and packed occlusion/roughness/metalness maps are derived from their surface details. Paint and fabric tile on actual UVs. The ceramic mask has a fitted frontal projection, real nose/cheek relief and a bone attachment to the Watcher sculpt; the other figures also use the mapped shroud and original Watcher skin/cloth materials.

### Roaming apparitions

`haunt/salt-veil` linen covers the wraith's ragged layers, and `haunt/charred-root` covers the crawler's shell. Both are original generated swatches baked to seamless 512px albedo, tangent-space normal and packed occlusion/roughness maps. The silhouettes come from actual meshes.

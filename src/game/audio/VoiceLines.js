// Bundled local recordings with matching Hindi captions. No speech service
// or downloads from a third party are needed at runtime.
export const VOICE_LINES=Object.freeze({
  'tape-intro':{
    src:new URL('../../assets/audio/voices/tape-intro.mp3',import.meta.url).href,
    title:'घरों में छोड़े निशान',label:'टेप 01 · मीरा',
    text:'अगर किसी को मेरी आवाज़ सुनाई दे रही है, तो टेप बंद मत करना। गाँव के हर घर में एक निशान छोड़ा है। बाहर नाम पढ़ना, फिर अंदर जाकर देखना। जो मिले, उसे साथ रखो। और जब सड़क की सारी बत्तियाँ एक साथ बुझें, समझ लेना… वह आ गया।',
  },
  'stalker-first':{
    src:new URL('../../assets/audio/voices/stalker-first.mp3',import.meta.url).href,
    text:'आह… हा… हा। कृष। दरवाज़े गिन रहे हो? मैंने भी गिने थे। एक दरवाज़ा तुम भूल गए। अपने पीछे देखो।',seconds:14.6,
  },
  'stalker-road':{
    src:new URL('../../assets/audio/voices/stalker-road.mp3',import.meta.url).href,
    text:'तुम्हें लगा गाँव खाली है? आह… हा। कोई बोलता नहीं… क्योंकि सब तुम्हें देख रहे हैं।',seconds:9.5,
  },
  'stalker-crowd':{
    src:new URL('../../assets/audio/voices/stalker-crowd.mp3',import.meta.url).href,
    text:'सुन रहे हो, कृष? मुझे अकेला मत समझना। पूरा गाँव तुम्हारे पीछे है। भागो… हा… हा… हा।',seconds:10.2,
  },
  'stalker-tree':{
    src:new URL('../../assets/audio/voices/stalker-tree.mp3',import.meta.url).href,
    text:'रुक क्यों गए? अब तो हम बहुत पास हैं। आह… हा… हा।',seconds:5.5,
  },
});

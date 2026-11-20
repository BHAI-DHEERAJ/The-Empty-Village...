export const CASE_TITLE = 'आख़िरी हाज़िरी';
const SAVE_KEY = 'empty-village-case-v1';

export const MISSIONS = Object.freeze([
  {
    id: 'gate-notice', title: 'लोग कहाँ गए?', hint: 'मुख्य सड़क से पहले बोर्ड तक जाओ। उसके नीचे लगा नोटिस पढ़ो।',
    item: 'गुमशुदगी का नोटिस', text: '“रात 2:43 पर हाज़िरी रुक गई। स्कूल के दरवाज़े के पास रजिस्टर पड़ा है। मिले तो गिनकर देखना, कितने नाम हैं।”',
  },
  {
    id: 'school-register', title: 'आख़िरी हाज़िरी', hint: 'स्कूल का बड़ा दरवाज़ा खोलो। रजिस्टर अंदर ही रखा है।',
    item: 'हाज़िरी का रजिस्टर', text: 'सारे नाम काट दिए गए हैं, बस लाल ट्रैक्टर वाले का नाम बचा है। कोने में लिखा है: “बत्तियाँ जलाए रखना। लौटते वक़्त रास्ता दिख जाएगा।”',
  },
  {
    id: 'tractor-red', title: 'खेत में एक रोशनी', hint: 'नहर वाली सड़क पकड़ो। इसी किनारे खड़े लाल ट्रैक्टर को चालू करो।',
    item: 'चाबी पर बँधा टैग', text: 'बत्तियाँ अब भी जलती हैं। चाबी पर बँधे पीतल के टुकड़े पर लिखा है “पुराना कुआँ”। पीछे खुरचकर लिखा है: “सुनो”।',
  },
  {
    id: 'well-tags', title: 'कुएँ का राज़', hint: 'मुख्य सड़क से पुरानी बस्ती तक जाओ। कुएँ के खंभे पर लगा टैग देखो।',
    item: 'पीतल पर खुदा नंबर', text: '“हवेली का रेडियो अब भी स्कूल की आवाज़ पकड़ता है। पश्चिम वाली गली से जाओ। हवेली के अंदर, नीचे वाले हॉल से बाईं तरफ़ दफ़्तर है। रेडियो का बटन बस एक बार घुमाना।”',
  },
  {
    id: 'mansion-radio', title: 'रेडियो की आख़िरी आवाज़', hint: 'पश्चिम की गली से हवेली जाओ। नीचे बाईं तरफ़ वाले दफ़्तर में रेडियो है।',
    item: 'आख़िरी आवाज़', text: 'एक बच्चा आख़िरी नाम पुकारता है। तुम्हारा। फिर रेडियो चुप हो जाता है। जो भी इंतज़ार कर रहा था, उसने तुम्हें सुन लिया। तुम अब भी गाँव घूम सकते हो।',
  },
]);

export class MissionLog {
  constructor(storage = null) {
    this.storage = storage;
    this.progress = 0;
    this.yard = 0;
    try {
      const saved = JSON.parse(storage?.getItem(SAVE_KEY) ?? 'null');
      if (Number.isInteger(saved?.progress)) this.progress = Math.min(MISSIONS.length, Math.max(0, saved.progress));
      if (Number.isInteger(saved?.yard)) this.yard = saved.yard & 3;
    } catch { /* Exploration and missions also work without storage. */ }
  }

  get current() { return MISSIONS[this.progress] ?? null; }

  use(action) {
    let yardChanged = false;
    const type = action.machine?.type;
    if (type === 'swing' || type === 'seesaw') {
      const previous = this.yard;
      this.yard |= type === 'swing' ? 1 : 2;
      yardChanged = this.yard !== previous;
    }
    const chapter = this.current;
    if (chapter?.id !== action.id || (action.kind === 'tractor' && !action.on)) {
      if (yardChanged) this.#save();
      if (action.kind === 'evidence') {
        const record = MISSIONS.find((entry, i) => i < this.progress && entry.id === action.id);
        return record ? { chapter: record, readAgain: true } : { text: 'ये बाद में काम आ सकता है। अभी का सुराग डायरी में देखो।' };
      }
      return yardChanged && this.yard === 3 ? { yardChanged, text: 'छोटा काम पूरा: एक बार और।' } : { yardChanged };
    }
    this.progress++;
    this.#save();
    return { chapter, yardChanged, finished: !this.current };
  }

  #save() {
    try { this.storage?.setItem(SAVE_KEY, JSON.stringify({ progress: this.progress, yard: this.yard })); } catch { /* optional */ }
  }
}

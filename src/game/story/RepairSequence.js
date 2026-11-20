import { MathUtils } from 'three';

export const REPAIR=Object.freeze({end:16.1,bonnet:1.05,tools:3.1,tryEngine:9.65,sputter:11.0,stall:12.1,close:14.35});
const REPAIR_CAPTIONS=[
  [0,'16:40','सड़क के किनारे','अभी दिन है। कृष ने गाड़ी के आगे जाकर बोनट उठाया।'],
  [2.95,'17:25','इंजन की मरम्मत','कृष ने पेचकस निकाला और हिलते हुए जोड़ को सँभालने की कोशिश की।'],
  [7.05,'18:31','आख़िरी कोशिश','औज़ार समेटकर उसने इंजन फिर से चालू किया। आसमान ढकने लगा।'],
  [12.05,'19:10','अब गाँव चलना होगा','इंजन एक पल चला, फिर बंद पड़ गया। अँधेरा हो गया है। स्कूल की ओर मदद ढूँढो।'],
].map(([at,clock,title,text])=>Object.freeze({at,clock,title,text,kicker:`सड़क पर मरम्मत · ${clock}`}));
export const repairCopy=time=>REPAIR_CAPTIONS.findLast(card=>time>=card.at)??REPAIR_CAPTIONS[0];
export const repairDaylight=time=>1-MathUtils.smoothstep(time,3.2,13.65);
export const REPAIR_CUES=Object.freeze([
  [REPAIR.bonnet,'repair-hood'], [3.22,'repair-ratchet'],[4.91,'repair-ratchet'],[6.42,'repair-seat'],
  [REPAIR.tryEngine,'repair-crank'],[REPAIR.sputter,'repair-catch'],[REPAIR.stall,'repair-stall'], [14.75,'repair-hood'],
].map(Object.freeze));

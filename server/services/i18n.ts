// Fixed, human-reviewed message templates in the three supported languages.
// Used for system messages (offers, confirmations) and the no-key demo
// assistant, so these never depend on a model.
export type Lang = "en" | "hi" | "mr";

export const LANGUAGE_NAME: Record<Lang, string> = { en: "English", hi: "हिंदी", mr: "मराठी" };

type IngredientNames = { name: string; nameHi: string | null; nameMr: string | null };

export function ingredientName(lang: Lang, i: IngredientNames) {
  return (lang === "hi" ? i.nameHi : lang === "mr" ? i.nameMr : null) ?? i.name;
}

export const fmtQty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export const T = {
  offer: (lang: Lang, ing: string, qty: number, price: number) =>
    ({
      en: `New order from Coffee on QR cafés: ${ing} · ${fmtQty(qty)} kg for next week at ₹${price}/kg. How many kg can you supply?`,
      hi: `Coffee on QR कैफ़े से नया ऑर्डर: ${ing} · अगले हफ्ते के लिए ${fmtQty(qty)} किलो, ₹${price}/किलो। आप कितने किलो दे सकते हैं?`,
      mr: `Coffee on QR कॅफेकडून नवीन मागणी: ${ing} · पुढच्या आठवड्यासाठी ${fmtQty(qty)} किलो, ₹${price}/किलो. तुम्ही किती किलो देऊ शकता?`,
    })[lang],
  committed: (lang: Lang, ing: string, qty: number, open: number) =>
    open > 0
      ? {
          en: `Saved: you'll supply ${fmtQty(qty)} kg of ${ing}. ${fmtQty(open)} kg is still needed from other farmers.`,
          hi: `दर्ज हो गया: आप ${fmtQty(qty)} किलो ${ing} देंगे। बाकी किसानों से अभी ${fmtQty(open)} किलो चाहिए।`,
          mr: `नोंद झाली: तुम्ही ${fmtQty(qty)} किलो ${ing} देणार. इतर शेतकऱ्यांकडून अजून ${fmtQty(open)} किलो हवे आहे.`,
        }[lang]
      : {
          en: `Saved: you'll supply ${fmtQty(qty)} kg of ${ing}. The order is now fully covered — thank you!`,
          hi: `दर्ज हो गया: आप ${fmtQty(qty)} किलो ${ing} देंगे। ऑर्डर अब पूरा हो गया — धन्यवाद!`,
          mr: `नोंद झाली: तुम्ही ${fmtQty(qty)} किलो ${ing} देणार. मागणी आता पूर्ण झाली — धन्यवाद!`,
        }[lang],
  declined: (lang: Lang) =>
    ({
      en: "Noted — you won't supply this order. We'll message you about the next one.",
      hi: "ठीक है — आप यह ऑर्डर नहीं देंगे। अगले ऑर्डर के बारे में हम आपको बताएँगे।",
      mr: "ठीक आहे — तुम्ही ही मागणी देणार नाही. पुढच्या मागणीबद्दल आम्ही कळवू.",
    })[lang],
  exceeds: (lang: Lang, open: number) =>
    ({
      en: `Only ${fmtQty(open)} kg is still needed. Would you like to supply ${fmtQty(open)} kg?`,
      hi: `अभी सिर्फ़ ${fmtQty(open)} किलो की ज़रूरत है। क्या आप ${fmtQty(open)} किलो देंगे?`,
      mr: `आता फक्त ${fmtQty(open)} किलोची गरज आहे. तुम्ही ${fmtQty(open)} किलो द्याल का?`,
    })[lang],
  closed: (lang: Lang) =>
    ({
      en: "This order is already fully covered or closed. Thank you — we'll share the next one.",
      hi: "यह ऑर्डर पहले ही पूरा या बंद हो चुका है। धन्यवाद — अगला ऑर्डर हम भेजेंगे।",
      mr: "ही मागणी आधीच पूर्ण किंवा बंद झाली आहे. धन्यवाद — पुढची मागणी आम्ही पाठवू.",
    })[lang],
  askQuantity: (lang: Lang, open: number) =>
    ({
      en: `How many kg can you supply? Up to ${fmtQty(open)} kg is open.`,
      hi: `आप कितने किलो दे सकते हैं? ${fmtQty(open)} किलो तक खुला है।`,
      mr: `तुम्ही किती किलो देऊ शकता? ${fmtQty(open)} किलोपर्यंत मागणी आहे.`,
    })[lang],
  noActiveOrder: (lang: Lang) =>
    ({
      en: "There's no open order for you right now. I'll message you as soon as a café needs your crop.",
      hi: "अभी आपके लिए कोई खुला ऑर्डर नहीं है। कैफ़े को आपकी फसल चाहिए होगी तो मैं तुरंत बताऊँगा।",
      mr: "आत्ता तुमच्यासाठी कोणतीही खुली मागणी नाही. कॅफेला तुमचं पीक हवं असेल तेव्हा मी लगेच कळवेन.",
    })[lang],
  photoUnclear: (lang: Lang) =>
    ({
      en: "The photo is too small or unclear to look at. Please send a close, sharp photo of one leaf in daylight — both sides if you can.",
      hi: "फ़ोटो बहुत छोटी या धुंधली है। कृपया दिन की रोशनी में एक पत्ते की पास से साफ़ फ़ोटो भेजें — हो सके तो दोनों तरफ़ की।",
      mr: "फोटो खूप लहान किंवा अस्पष्ट आहे. कृपया दिवसाच्या उजेडात एका पानाचा जवळून स्पष्ट फोटो पाठवा — शक्य असल्यास दोन्ही बाजूंचा.",
    })[lang],
  expertRequested: (lang: Lang) =>
    ({
      en: "I've asked your field agent to get an agriculture expert to review this. They'll contact you — please don't spray anything until then unless your agent advises it.",
      hi: "मैंने आपके फ़ील्ड एजेंट से कृषि विशेषज्ञ से जाँच करवाने को कहा है। वे आपसे संपर्क करेंगे — तब तक एजेंट की सलाह के बिना कोई छिड़काव न करें।",
      mr: "मी तुमच्या फील्ड एजंटला कृषी तज्ज्ञाकडून तपासणी करून घ्यायला सांगितलं आहे. ते तुमच्याशी संपर्क करतील — तोपर्यंत एजंटच्या सल्ल्याशिवाय फवारणी करू नका.",
    })[lang],
  voiceNoTranscript: (lang: Lang) =>
    ({
      en: "I received your voice note, but speech-to-text isn't set up here, so I couldn't understand it. Please type your message.",
      hi: "आपका वॉइस नोट मिला, लेकिन यहाँ आवाज़ से टेक्स्ट की सुविधा चालू नहीं है, इसलिए मैं समझ नहीं पाया। कृपया संदेश लिखकर भेजें।",
      mr: "तुमचा व्हॉइस नोट मिळाला, पण इथे आवाजातून मजकूर सुविधा सुरू नाही, त्यामुळे मला समजलं नाही. कृपया संदेश लिहून पाठवा.",
    })[lang],
  dontKnow: (lang: Lang) =>
    ({
      en: "I don't have verified information on that. I can ask your field agent or an agriculture expert to help — reply \"expert\" if you'd like that.",
      hi: "इस बारे में मेरे पास पक्की जानकारी नहीं है। मैं आपके फ़ील्ड एजेंट या कृषि विशेषज्ञ से मदद करवा सकता हूँ — चाहें तो \"विशेषज्ञ\" लिखें।",
      mr: "याबद्दल माझ्याकडे खात्रीशीर माहिती नाही. मी तुमच्या फील्ड एजंट किंवा कृषी तज्ज्ञाची मदत मिळवून देऊ शकतो — हवं असल्यास \"तज्ज्ञ\" लिहा.",
    })[lang],
};

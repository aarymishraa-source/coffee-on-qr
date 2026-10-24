import "server-only";
import type { Lang } from "@/server/services/i18n";

// Curated, general crop-care guidance the assistant may quote. Deliberately
// non-chemical and conservative: no pesticide/fungicide names or doses, no
// claims to be an official ICAR/KVK advisory. Anything beyond this goes to a
// human expert (escalateToExpert).
export const KNOWLEDGE_SOURCE = "Kisan Sahayak general crop-care notes (not an official advisory)";

export interface KnowledgeEntry {
  id: string;
  title: string;
  crops: string[]; // ingredient ids, or "any"
  keywords: string[]; // lowercase, any language
  text: Record<Lang, string>;
  source: string;
}

export const KNOWLEDGE: KnowledgeEntry[] = [
  {
    id: "basil-harvest-time",
    title: "When to harvest basil",
    crops: ["basil"],
    keywords: ["harvest", "pluck", "cut", "morning", "काढणी", "कटाई", "तोड", "सकाळी", "सुबह", "time", "when"],
    text: {
      en: "Harvest basil early in the morning, after the dew dries. Cut stems just above a pair of leaves so the plant branches again. Keep cut basil in shade and out of direct sun; don't wash it before transport.",
      hi: "बेसिल की कटाई सुबह जल्दी, ओस सूखने के बाद करें। पत्तों की जोड़ी के ठीक ऊपर से तना काटें ताकि पौधा फिर से शाखाएँ बनाए। कटी हुई बेसिल को छाँव में रखें; ढुलाई से पहले न धोएँ।",
      mr: "बेसिलची काढणी सकाळी लवकर, दव सुकल्यावर करा. पानांच्या जोडीच्या अगदी वरून फांदी कापा म्हणजे झाड पुन्हा फुटेल. काढलेले बेसिल सावलीत ठेवा; वाहतुकीपूर्वी धुवू नका.",
    },
    source: KNOWLEDGE_SOURCE,
  },
  {
    id: "basil-flowering",
    title: "Basil flowering",
    crops: ["basil"],
    keywords: ["flower", "flowering", "फूल", "फुल", "मंजिरी", "bloom"],
    text: {
      en: "When basil starts to flower, leaf flavour can drop. Pinch off the flower spikes from the top so the plant keeps making new leaves.",
      hi: "फूल आने पर बेसिल के पत्तों का स्वाद कम हो सकता है। फूल वाली टहनियों को ऊपर से तोड़ दें ताकि पौधा नए पत्ते बनाता रहे।",
      mr: "फुले आल्यावर बेसिलच्या पानांचा स्वाद कमी होऊ शकतो. फुलांचे तुरे वरून खुडून टाका म्हणजे झाडाला नवीन पाने येत राहतील.",
    },
    source: KNOWLEDGE_SOURCE,
  },
  {
    id: "leaf-spots-general",
    title: "Spots on leaves — first steps",
    crops: ["any"],
    keywords: ["spot", "spots", "धब्बे", "डाग", "ठिपके", "yellow", "पीले", "पिवळे", "brown", "भूरे", "तपकिरी", "disease", "रोग"],
    text: {
      en: "Spots on leaves can have many causes (fungus, bacteria, nutrient stress, sun or water damage). First steps: remove the worst-affected leaves and keep them away from the field, water at the base in the morning instead of over the leaves, and give plants more airflow. Send a clear photo of both sides of a leaf so we can look closer; an expert should confirm before any spray.",
      hi: "पत्तों पर धब्बों के कई कारण हो सकते हैं (फफूंद, बैक्टीरिया, पोषक तत्व की कमी, धूप या पानी)। पहले कदम: सबसे ज़्यादा प्रभावित पत्ते हटाकर खेत से दूर रखें, पानी सुबह जड़ों में दें, पत्तों पर नहीं, और पौधों में हवा का बहाव बढ़ाएँ। पत्ते के दोनों तरफ़ की साफ़ फ़ोटो भेजें; किसी भी छिड़काव से पहले विशेषज्ञ की पुष्टि ज़रूरी है।",
      mr: "पानांवरील डागांची अनेक कारणे असू शकतात (बुरशी, जिवाणू, पोषणाची कमतरता, ऊन किंवा पाणी). पहिली पावले: सर्वाधिक बाधित पाने काढून शेतापासून दूर ठेवा, पाणी सकाळी मुळांशी द्या, पानांवर नाही, आणि झाडांमध्ये हवा खेळती ठेवा. पानाच्या दोन्ही बाजूंचा स्पष्ट फोटो पाठवा; कोणत्याही फवारणीपूर्वी तज्ज्ञांची खात्री आवश्यक आहे.",
    },
    source: KNOWLEDGE_SOURCE,
  },
  {
    id: "watering-general",
    title: "Watering",
    crops: ["any"],
    keywords: ["water", "irrigation", "पानी", "पाणी", "सिंचाई", "how much water"],
    text: {
      en: "Water in the early morning at the base of the plant. Check soil a finger deep: water when the top 2–3 cm is dry. Avoid waterlogging — leafy crops like basil and spinach rot in standing water.",
      hi: "सुबह जल्दी पौधे की जड़ में पानी दें। उँगली से मिट्टी जाँचें: ऊपर की 2–3 सेमी मिट्टी सूखी हो तब पानी दें। पानी जमा न होने दें — बेसिल और पालक जैसी पत्तेदार फसलें खड़े पानी में सड़ जाती हैं।",
      mr: "सकाळी लवकर झाडाच्या मुळाशी पाणी द्या. बोटाने माती तपासा: वरची 2–3 सेमी माती कोरडी असेल तेव्हा पाणी द्या. पाणी साचू देऊ नका — बेसिल आणि पालकसारखी पालेभाजी साचलेल्या पाण्यात कुजते.",
    },
    source: KNOWLEDGE_SOURCE,
  },
  {
    id: "post-harvest-leafy",
    title: "Keeping leafy produce fresh after harvest",
    crops: ["basil", "spinach", "rocket"],
    keywords: ["fresh", "transport", "store", "wilt", "ताज़ा", "ताजे", "मुरझा", "सुकणे", "वाहतूक", "pack", "packing"],
    text: {
      en: "Harvest in the cool of the morning, move produce into shade within minutes, pack loosely in ventilated crates, and avoid stacking heavy loads on leaves. Basil is damaged by cold below about 10°C, so don't put it on ice.",
      hi: "सुबह की ठंडक में कटाई करें, कुछ ही मिनटों में उपज छाँव में रखें, हवादार क्रेट में ढीला पैक करें और पत्तों पर भारी बोझ न रखें। लगभग 10°C से कम ठंड बेसिल को नुकसान पहुँचाती है, इसलिए उसे बर्फ़ पर न रखें।",
      mr: "सकाळच्या गारव्यात काढणी करा, काही मिनिटांत माल सावलीत हलवा, हवेशीर क्रेटमध्ये सैल भरा आणि पानांवर जड ओझे ठेवू नका. सुमारे 10°C पेक्षा कमी थंडीने बेसिल खराब होते, म्हणून ते बर्फावर ठेवू नका.",
    },
    source: KNOWLEDGE_SOURCE,
  },
  {
    id: "tomato-harvest",
    title: "Harvesting tomatoes for cafés",
    crops: ["tomato"],
    keywords: ["tomato", "टमाटर", "टोमॅटो", "ripe", "पका", "पिकलेले", "colour", "रंग"],
    text: {
      en: "For café orders, pick tomatoes when they show full colour but are still firm. Handle gently, keep them out of direct sun after picking, and don't pack wet fruit.",
      hi: "कैफ़े के ऑर्डर के लिए टमाटर तब तोड़ें जब पूरा रंग आ जाए पर फल सख़्त हो। धीरे से संभालें, तोड़ने के बाद सीधी धूप से बचाएँ और गीले फल पैक न करें।",
      mr: "कॅफेच्या मागणीसाठी टोमॅटोला पूर्ण रंग आला पण फळ टणक असताना तोडा. हळुवार हाताळा, तोडल्यानंतर थेट उन्हापासून वाचवा आणि ओली फळे भरू नका.",
    },
    source: KNOWLEDGE_SOURCE,
  },
  {
    id: "pests-general",
    title: "Insects on plants — first steps",
    crops: ["any"],
    keywords: ["insect", "pest", "कीड़े", "कीड", "कीट", "अळी", "worm", "aphid", "मावा"],
    text: {
      en: "Check the underside of leaves in the morning. Remove and destroy badly infested leaves, and use sticky traps to see what's present. Don't spray any chemical without advice — tell us and we'll get an expert to look.",
      hi: "सुबह पत्तों के नीचे की तरफ़ जाँचें। ज़्यादा प्रभावित पत्ते हटाकर नष्ट करें और चिपचिपे ट्रैप लगाकर देखें कौन से कीड़े हैं। सलाह के बिना कोई रसायन न छिड़कें — हमें बताएँ, हम विशेषज्ञ से दिखवाएँगे।",
      mr: "सकाळी पानांची खालची बाजू तपासा. जास्त प्रादुर्भाव झालेली पाने काढून नष्ट करा आणि चिकट सापळे लावून कोणती कीड आहे ते पाहा. सल्ल्याशिवाय कोणतेही रसायन फवारू नका — आम्हाला सांगा, आम्ही तज्ज्ञांकडून पाहणी करून घेऊ.",
    },
    source: KNOWLEDGE_SOURCE,
  },
  {
    id: "transplant-seedlings",
    title: "Transplanting seedlings",
    crops: ["any"],
    keywords: ["transplant", "seedling", "रोपाई", "रोपे", "लावणी", "पौध", "nursery"],
    text: {
      en: "Transplant when seedlings have 2–3 pairs of true leaves. Do it in the evening, water lightly right after, and shade young plants for the first two days if it's very hot.",
      hi: "जब पौध में 2–3 जोड़ी असली पत्ते हों तब रोपाई करें। शाम को रोपाई करें, तुरंत हल्का पानी दें और बहुत गर्मी हो तो पहले दो दिन छाँव दें।",
      mr: "रोपांना 2–3 खऱ्या पानांच्या जोड्या आल्यावर लावणी करा. संध्याकाळी लावणी करा, लगेच हलके पाणी द्या आणि खूप ऊन असल्यास पहिले दोन दिवस सावली द्या.",
    },
    source: KNOWLEDGE_SOURCE,
  },
];

export function searchKnowledge(query: string, crop?: string | null, limit = 2): KnowledgeEntry[] {
  const q = query.toLowerCase();
  return KNOWLEDGE.map((e) => {
    let score = e.keywords.reduce((s, k) => (q.includes(k) ? s + 1 : s), 0);
    if (crop && e.crops.includes(crop)) score += 0.5;
    if (e.crops.includes("any")) score += 0.1;
    return { e, score };
  })
    .filter((x) => x.score >= 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.e);
}

/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                    NERO TTS SERVICE - API Client v2.1                         ║
 * ║              Pure HTTP Client for Python TTS Server                           ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * Simple, clean HTTP client that fetches audio from the Python TTS API.
 * No external packages required - uses only native Node.js modules.
 *
 * Server: http://92.118.206.166:30446
 *
 * @author Nero Development Team
 * @version 2.1.0
 */

"use strict";

const http = require("http");
const https = require("https");
const { URL } = require("url");
const fs = require("fs");
const path = require("path");
const os = require("os");

// Import font utilities for converting styled text back to normal
const { toNormal } = require("../utils/fonts");

// ══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ══════════════════════════════════════════════════════════════════════════════

/**
 * TTS Server URL - Your hosted Python server
 */
const TTS_SERVER_URL = "http://92.118.206.166:30446";

/**
 * Request timeout in milliseconds
 */
const REQUEST_TIMEOUT = 60000;

/**
 * Max text length for TTS
 */
const MAX_TEXT_LENGTH = 4000;

// ══════════════════════════════════════════════════════════════════════════════
// SMART VOICE - Language Detection & Auto Voice Selection (Female Only)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Language-specific female voices for smart voice detection
 */
const SMART_VOICES = {
  filipino: "fil-PH-BlessicaNeural",      // Filipino/Tagalog
  tagalog: "fil-PH-BlessicaNeural",       // Tagalog alias
  english: "en-US-AriaNeural",            // English US
  japanese: "ja-JP-NanamiNeural",         // Japanese
  korean: "ko-KR-SunHiNeural",            // Korean
  chinese: "zh-CN-XiaoxiaoNeural",        // Chinese Mandarin
  cantonese: "zh-HK-HiuGaaiNeural",       // Cantonese
  spanish: "es-MX-DaliaNeural",           // Spanish (Mexican)
  portuguese: "pt-BR-FranciscaNeural",    // Portuguese (Brazilian)
  french: "fr-FR-DeniseNeural",           // French
  german: "de-DE-KatjaNeural",            // German
  italian: "it-IT-ElsaNeural",            // Italian
  russian: "ru-RU-SvetlanaNeural",        // Russian
  arabic: "ar-SA-ZariyahNeural",          // Arabic
  hindi: "hi-IN-SwaraNeural",             // Hindi
  indonesian: "id-ID-GadisNeural",        // Indonesian
  malay: "ms-MY-YasminNeural",            // Malay
  thai: "th-TH-AcharaNeural",             // Thai
  vietnamese: "vi-VN-HoaiMyNeural",       // Vietnamese
  turkish: "tr-TR-EmelNeural",            // Turkish
  dutch: "nl-NL-ColetteNeural",           // Dutch
  polish: "pl-PL-ZofiaNeural",            // Polish
  swedish: "sv-SE-SofieNeural",           // Swedish
  norwegian: "nb-NO-IselinNeural",        // Norwegian
  danish: "da-DK-ChristelNeural",         // Danish
  finnish: "fi-FI-NooraNeural",           // Finnish
  greek: "el-GR-AthinaNeural",            // Greek
  czech: "cs-CZ-VlastaNeural",            // Czech
  hungarian: "hu-HU-NoemiNeural",         // Hungarian
  romanian: "ro-RO-AlinaNeural",          // Romanian
  hebrew: "he-IL-HilaNeural",             // Hebrew
  ukrainian: "uk-UA-PolinaNeural",        // Ukrainian
};

/**
 * Language detection patterns - common words/characters for each language
 */
const _LANGUAGE_PATTERNS = {
  filipino: {
    // Common Filipino/Tagalog words and patterns
    words: /\b(ang|ng|mga|sa|na|ay|ko|mo|ka|siya|kami|tayo|sila|ano|sino|paano|bakit|kailan|saan|ito|iyon|yun|dito|doon|po|opo|hindi|oo|wala|meron|may|gusto|kailangan|pwede|puwede|dapat|lang|lamang|din|rin|pa|na|ba|kasi|dahil|para|kung|kapag|pag|naman|talaga|sobra|grabe|naku|hala|ewan|baka|siguro|sige|salamat|maraming|salamat|kamusta|kumusta|maganda|ganda|gwapo|pangit|masaya|malungkot|mahal|kita|ikaw|ako|tayo|atin|natin|kanila|nila|niya|nyo|niyo|mo|ko|kayo|siya|sila|kami|ewan|alam|kilala|tanong|sagot|tulong|tulungan|paki|pakiusap|ingat|alagaan|mahal|miss|buhay|puso|pamilya|kaibigan|trabaho|gawa|kain|tulog|laro|lakad|takbo|upo|tayo|bilis|dali|hintay|sandali|mamaya|bukas|kahapon|ngayon|araw|gabi|umaga|hapon)\b/gi,
    // Filipino-specific character combinations
    chars: /[ñÑ]|ng|mga|[aeiou]{2,}/gi,
  },
  japanese: {
    // Hiragana, Katakana, and common Kanji
    chars: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g,
  },
  korean: {
    // Hangul characters
    chars: /[\uAC00-\uD7AF\u1100-\u11FF]/g,
  },
  chinese: {
    // Chinese characters (excluding Japanese-specific)
    chars: /[\u4E00-\u9FFF\u3400-\u4DBF]/g,
  },
  arabic: {
    // Arabic script
    chars: /[\u0600-\u06FF\u0750-\u077F]/g,
  },
  thai: {
    // Thai script
    chars: /[\u0E00-\u0E7F]/g,
  },
  hindi: {
    // Devanagari script (Hindi)
    chars: /[\u0900-\u097F]/g,
  },
  russian: {
    // Cyrillic script
    chars: /[\u0400-\u04FF]/g,
  },
  hebrew: {
    // Hebrew script
    chars: /[\u0590-\u05FF]/g,
  },
  greek: {
    // Greek script
    chars: /[\u0370-\u03FF]/g,
  },
  vietnamese: {
    // Vietnamese diacritics
    chars: /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/gi,
  },
  spanish: {
    words: /\b(el|la|los|las|un|una|de|que|y|en|es|por|para|con|no|se|lo|como|más|pero|su|le|ya|o|este|sí|porque|esta|son|entre|cuando|muy|sin|sobre|ser|tiene|también|me|hasta|hay|donde|han|sido|tiene|todo|hacer|tengo|hola|gracias|buenos|días|noches|tardes|cómo|estás|bien|mucho|gusto)\b/gi,
  },
  portuguese: {
    words: /\b(o|a|os|as|um|uma|de|que|e|do|da|em|é|para|com|não|se|na|por|mais|mas|foi|ao|ele|das|tem|à|seu|sua|ou|ser|quando|muito|há|nos|já|está|eu|também|só|pelo|pela|até|isso|ela|entre|era|depois|sem|mesmo|aos|ter|seus|quem|nas|me|esse|eles|você|tinha|foram|essa|num|nem|suas|meu|às|minha|têm|numa|pelos|elas|havia|seja|qual|será|nós|tenho|lhe|deles|essas|esses|pelas|este|fosse|dele|tu|te|vocês|vos|lhes|meus|minhas|teu|tua|teus|tuas|nosso|nossa|nossos|nossas|dela|delas|esta|estes|estas|aquele|aquela|aqueles|aquelas|isto|aquilo|olá|obrigado|obrigada|bom|boa|dia|noite|tarde|como|vai|tudo|bem)\b/gi,
  },
  french: {
    words: /\b(le|la|les|un|une|de|du|des|et|est|en|que|qui|ne|pas|ce|se|il|elle|on|nous|vous|ils|elles|son|sa|ses|leur|leurs|mon|ma|mes|ton|ta|tes|notre|nos|votre|vos|je|tu|lui|moi|toi|soi|pour|dans|par|sur|avec|sans|sous|chez|vers|entre|comme|mais|ou|où|donc|or|ni|car|si|quand|comment|pourquoi|combien|quel|quelle|quels|quelles|bonjour|bonsoir|merci|beaucoup|bien|très|oui|non|peut|être|avoir|faire|aller|voir|venir|prendre|savoir|pouvoir|vouloir|devoir|falloir|croire|mettre|dire|donner|passer|partir|sortir|arriver|entrer|rester|tomber|mourir|naître|devenir|revenir|tenir|appartenir)\b/gi,
  },
  german: {
    words: /\b(der|die|das|den|dem|des|ein|eine|einer|einem|einen|und|ist|in|zu|von|mit|für|auf|nicht|sich|bei|auch|nach|als|an|aus|noch|wie|nur|oder|aber|vor|bis|durch|über|so|wenn|weil|obwohl|dass|welcher|welche|welches|ich|du|er|sie|es|wir|ihr|mein|meine|dein|deine|sein|seine|unser|unsere|euer|eure|hallo|guten|tag|morgen|abend|nacht|danke|bitte|ja|nein|gut|sehr|haben|sein|werden|können|müssen|sollen|wollen|dürfen|mögen)\b/gi,
  },
  italian: {
    words: /\b(il|lo|la|i|gli|le|un|uno|una|di|a|da|in|con|su|per|tra|fra|e|è|che|non|si|come|ma|se|perché|quando|anche|più|solo|già|dove|chi|cosa|quale|quanto|questo|quello|suo|sua|suoi|sue|mio|mia|miei|mie|tuo|tua|tuoi|tue|nostro|nostra|vostro|vostra|loro|io|tu|lui|lei|noi|voi|essi|esse|ciao|buongiorno|buonasera|buonanotte|grazie|prego|sì|no|bene|molto|avere|essere|fare|dire|andare|venire|vedere|sapere|potere|volere|dovere|stare)\b/gi,
  },
  indonesian: {
    words: /\b(yang|dan|di|ini|itu|dengan|untuk|pada|adalah|dari|ke|tidak|akan|juga|atau|saya|anda|kamu|dia|mereka|kami|kita|ada|bisa|sudah|belum|sedang|harus|dapat|mau|ingin|perlu|boleh|jangan|apa|siapa|kapan|dimana|kenapa|bagaimana|berapa|mana|halo|selamat|pagi|siang|sore|malam|terima|kasih|sama|baik|sangat|sekali)\b/gi,
  },
  malay: {
    words: /\b(yang|dan|di|ini|itu|dengan|untuk|pada|adalah|dari|ke|tidak|akan|juga|atau|saya|anda|awak|dia|mereka|kami|kita|ada|boleh|sudah|belum|sedang|harus|dapat|mahu|ingin|perlu|jangan|apa|siapa|bila|mana|kenapa|bagaimana|berapa|halo|selamat|pagi|tengah|hari|petang|malam|terima|kasih|sama|baik|sangat|sekali)\b/gi,
  },
  dutch: {
    words: /\b(de|het|een|van|en|in|is|op|te|dat|die|voor|met|zijn|aan|hij|niet|er|maar|om|ook|als|dan|naar|bij|uit|tot|wat|wel|nog|zo|door|over|waar|wordt|kan|moet|zal|zou|hebben|worden|gaan|komen|zien|weten|willen|kunnen|moeten|zullen|hallo|goedemorgen|goedemiddag|goedenavond|dank|je|u|wel|ja|nee|goed|heel|erg)\b/gi,
  },
  turkish: {
    words: /\b(bir|bu|ve|için|ile|de|da|ne|var|ben|sen|o|biz|siz|onlar|mi|mı|mu|mü|gibi|daha|çok|ama|ya|veya|kadar|sonra|önce|şimdi|burada|orada|nasıl|neden|kim|nerede|hangi|merhaba|günaydın|iyi|akşamlar|geceler|teşekkür|ederim|evet|hayır|tamam|çok|iyi)\b/gi,
  },
};

/**
 * Detect the language of text
 * @param {string} text - Text to analyze
 * @returns {string} Detected language or "english" as default
 */
function detectLanguage(text) {
  if (!text || typeof text !== "string") return "english";
  
  const lowerText = text.toLowerCase();
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PRIORITY 1: Check for non-Latin scripts (most reliable - check FIRST)
  // If we find ANY of these characters, immediately return that language
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Japanese (Hiragana, Katakana, or Kanji)
  const japaneseChars = text.match(/[\u3040-\u309F\u30A0-\u30FF]/g);
  if (japaneseChars && japaneseChars.length >= 2) {
    console.log(`[TTS] Detected Japanese (${japaneseChars.length} kana characters)`);
    return "japanese";
  }
  
  // Korean (Hangul)
  const koreanChars = text.match(/[\uAC00-\uD7AF\u1100-\u11FF]/g);
  if (koreanChars && koreanChars.length >= 2) {
    console.log(`[TTS] Detected Korean (${koreanChars.length} hangul characters)`);
    return "korean";
  }
  
  // Chinese (CJK characters without Japanese kana = likely Chinese)
  const chineseChars = text.match(/[\u4E00-\u9FFF]/g);
  const hasKana = /[\u3040-\u309F\u30A0-\u30FF]/.test(text);
  if (chineseChars && chineseChars.length >= 2 && !hasKana) {
    console.log(`[TTS] Detected Chinese (${chineseChars.length} hanzi characters)`);
    return "chinese";
  }
  
  // Arabic
  const arabicChars = text.match(/[\u0600-\u06FF\u0750-\u077F]/g);
  if (arabicChars && arabicChars.length >= 3) {
    console.log(`[TTS] Detected Arabic (${arabicChars.length} characters)`);
    return "arabic";
  }
  
  // Thai
  const thaiChars = text.match(/[\u0E00-\u0E7F]/g);
  if (thaiChars && thaiChars.length >= 3) {
    console.log(`[TTS] Detected Thai (${thaiChars.length} characters)`);
    return "thai";
  }
  
  // Hindi (Devanagari)
  const hindiChars = text.match(/[\u0900-\u097F]/g);
  if (hindiChars && hindiChars.length >= 3) {
    console.log(`[TTS] Detected Hindi (${hindiChars.length} characters)`);
    return "hindi";
  }
  
  // Russian (Cyrillic)
  const russianChars = text.match(/[\u0400-\u04FF]/g);
  if (russianChars && russianChars.length >= 3) {
    console.log(`[TTS] Detected Russian (${russianChars.length} characters)`);
    return "russian";
  }
  
  // Hebrew
  const hebrewChars = text.match(/[\u0590-\u05FF]/g);
  if (hebrewChars && hebrewChars.length >= 3) {
    console.log(`[TTS] Detected Hebrew (${hebrewChars.length} characters)`);
    return "hebrew";
  }
  
  // Greek
  const greekChars = text.match(/[\u0370-\u03FF]/g);
  if (greekChars && greekChars.length >= 3) {
    console.log(`[TTS] Detected Greek (${greekChars.length} characters)`);
    return "greek";
  }
  
  // Vietnamese (special diacritics)
  const vietnameseChars = text.match(/[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/gi);
  if (vietnameseChars && vietnameseChars.length >= 3) {
    console.log(`[TTS] Detected Vietnamese (${vietnameseChars.length} diacritics)`);
    return "vietnamese";
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PRIORITY 2: Word-based detection for Latin-script languages
  // Only check if no non-Latin script was found
  // ═══════════════════════════════════════════════════════════════════════════
  
  const scores = {};
  
  // Filipino - require MORE unique words to avoid false positives
  const filipinoWords = lowerText.match(/\b(ang|mga|ako|ikaw|siya|kami|tayo|sila|ano|sino|paano|bakit|kailan|saan|ito|iyon|dito|doon|hindi|wala|meron|gusto|kailangan|pwede|dapat|naman|talaga|salamat|kamusta|maganda|masaya|mahal|pamilya|kaibigan|trabaho|kumain|matulog|oo|opo|po)\b/gi);
  if (filipinoWords) {
    const uniqueFilipino = [...new Set(filipinoWords.map(w => w.toLowerCase()))];
    if (uniqueFilipino.length >= 3) {
      scores.filipino = uniqueFilipino.length * 3;
      console.log(`[TTS] Filipino words found: ${uniqueFilipino.join(", ")}`);
    }
  }
  
  // Spanish
  const spanishWords = lowerText.match(/\b(hola|gracias|buenos|días|noches|cómo|estás|muy|bien|mucho|también|porque|cuando|donde|siempre|nunca|ahora|después|antes|pero|aunque|mientras|además|entonces|así|aquí|allí|este|esta|estos|estas|ese|esa|esos|esas|aquel|aquella)\b/gi);
  if (spanishWords) {
    const uniqueSpanish = [...new Set(spanishWords.map(w => w.toLowerCase()))];
    if (uniqueSpanish.length >= 2) {
      scores.spanish = uniqueSpanish.length * 3;
    }
  }
  
  // Portuguese
  const portugueseWords = lowerText.match(/\b(olá|obrigado|obrigada|bom|boa|dia|noite|tarde|como|vai|tudo|bem|muito|também|porque|quando|onde|sempre|nunca|agora|depois|antes|mas|embora|enquanto|além|então|assim|aqui|ali|você|vocês|nós|eles|elas)\b/gi);
  if (portugueseWords) {
    const uniquePortuguese = [...new Set(portugueseWords.map(w => w.toLowerCase()))];
    if (uniquePortuguese.length >= 2) {
      scores.portuguese = uniquePortuguese.length * 3;
    }
  }
  
  // French
  const frenchWords = lowerText.match(/\b(bonjour|bonsoir|merci|beaucoup|très|bien|oui|non|comment|allez|vous|nous|ils|elles|je|tu|il|elle|être|avoir|faire|aller|voir|venir|pourquoi|quand|où|toujours|jamais|maintenant|après|avant|mais|parce|pendant|aussi|donc|ainsi|ici|là)\b/gi);
  if (frenchWords) {
    const uniqueFrench = [...new Set(frenchWords.map(w => w.toLowerCase()))];
    if (uniqueFrench.length >= 2) {
      scores.french = uniqueFrench.length * 3;
    }
  }
  
  // German
  const germanWords = lowerText.match(/\b(hallo|guten|tag|morgen|abend|nacht|danke|bitte|sehr|gut|ja|nein|wie|geht|ich|du|er|sie|wir|ihr|haben|sein|werden|können|müssen|warum|wann|wo|immer|nie|jetzt|nach|vor|aber|weil|während|auch|dann|so|hier|dort)\b/gi);
  if (germanWords) {
    const uniqueGerman = [...new Set(germanWords.map(w => w.toLowerCase()))];
    if (uniqueGerman.length >= 2) {
      scores.german = uniqueGerman.length * 3;
    }
  }
  
  // Italian
  const italianWords = lowerText.match(/\b(ciao|buongiorno|buonasera|buonanotte|grazie|prego|molto|bene|sì|no|come|stai|io|tu|lui|lei|noi|voi|loro|essere|avere|fare|dire|andare|venire|perché|quando|dove|sempre|mai|adesso|dopo|prima|ma|perché|mentre|anche|quindi|così|qui|lì)\b/gi);
  if (italianWords) {
    const uniqueItalian = [...new Set(italianWords.map(w => w.toLowerCase()))];
    if (uniqueItalian.length >= 2) {
      scores.italian = uniqueItalian.length * 3;
    }
  }
  
  // Indonesian
  const indonesianWords = lowerText.match(/\b(halo|selamat|pagi|siang|sore|malam|terima|kasih|sama|baik|sangat|sekali|ya|tidak|bagaimana|apa|siapa|kapan|dimana|kenapa|saya|anda|kamu|dia|mereka|kami|kita|adalah|ada|bisa|sudah|belum|sedang|harus|dapat|mau|ingin|perlu|boleh|jangan)\b/gi);
  if (indonesianWords) {
    const uniqueIndonesian = [...new Set(indonesianWords.map(w => w.toLowerCase()))];
    if (uniqueIndonesian.length >= 3) {
      scores.indonesian = uniqueIndonesian.length * 3;
    }
  }
  
  // Dutch
  const dutchWords = lowerText.match(/\b(hallo|goedemorgen|goedemiddag|goedenavond|dank|je|wel|zeer|goed|ja|nee|hoe|gaat|het|ik|jij|hij|zij|wij|jullie|hebben|zijn|worden|kunnen|moeten|waarom|wanneer|waar|altijd|nooit|nu|na|voor|maar|omdat|terwijl|ook|dan|zo|hier|daar)\b/gi);
  if (dutchWords) {
    const uniqueDutch = [...new Set(dutchWords.map(w => w.toLowerCase()))];
    if (uniqueDutch.length >= 2) {
      scores.dutch = uniqueDutch.length * 3;
    }
  }
  
  // Turkish
  const turkishWords = lowerText.match(/\b(merhaba|günaydın|iyi|akşamlar|geceler|teşekkür|ederim|evet|hayır|tamam|nasıl|ne|kim|nerede|neden|hangi|ben|sen|o|biz|siz|onlar|var|yok|olmak|yapmak|gitmek|gelmek|görmek|bilmek|istemek|çok)\b/gi);
  if (turkishWords) {
    const uniqueTurkish = [...new Set(turkishWords.map(w => w.toLowerCase()))];
    if (uniqueTurkish.length >= 2) {
      scores.turkish = uniqueTurkish.length * 3;
    }
  }
  
  // Find highest scoring language
  let maxScore = 0;
  let detectedLang = "english";
  
  for (const [lang, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      detectedLang = lang;
    }
  }
  
  if (maxScore > 0) {
    console.log(`[TTS] Word-based detection: ${detectedLang} (score: ${maxScore})`);
  } else {
    console.log(`[TTS] No specific language detected, defaulting to English`);
  }
  
  return detectedLang;
}

/**
 * Get the appropriate female voice for a language
 * @param {string} language - Detected language
 * @returns {string} Voice name
 */
function getVoiceForLanguage(language) {
  return SMART_VOICES[language] || SMART_VOICES.english;
}

// ══════════════════════════════════════════════════════════════════════════════
// VOICE SHORTCUTS - All supported voices
// ══════════════════════════════════════════════════════════════════════════════

const VOICE_SHORTCUTS = {
  // ═══════════════════════════════════════════════════════════════════════════
  // ENGLISH US - FEMALE
  // ═══════════════════════════════════════════════════════════════════════════
  ana: { name: "en-US-AnaNeural", desc: "Child, Cute", lang: "English US" },
  aria: { name: "en-US-AriaNeural", desc: "Young Adult, Expressive", lang: "English US" },
  jenny: { name: "en-US-JennyNeural", desc: "Friendly, Warm", lang: "English US" },
  sara: { name: "en-US-SaraNeural", desc: "Professional", lang: "English US" },
  michelle: { name: "en-US-MichelleNeural", desc: "Warm, Clear", lang: "English US" },
  amber: { name: "en-US-AmberNeural", desc: "Calm, Soft", lang: "English US" },
  ashley: { name: "en-US-AshleyNeural", desc: "Cheerful", lang: "English US" },
  cora: { name: "en-US-CoraNeural", desc: "Natural", lang: "English US" },
  elizabeth: { name: "en-US-ElizabethNeural", desc: "Formal", lang: "English US" },
  nancy: { name: "en-US-NancyNeural", desc: "Serious", lang: "English US" },
  monica: { name: "en-US-MonicaNeural", desc: "Pleasant", lang: "English US" },
  aishah: { name: "en-US-AIShaNeural", desc: "AI Assistant", lang: "English US" },
  jane: { name: "en-US-JaneNeural", desc: "Conversational", lang: "English US" },
  steffan: { name: "en-US-SteffanNeural", desc: "Narrator", lang: "English US" },

  // ═══════════════════════════════════════════════════════════════════════════
  // ENGLISH US - MALE
  // ═══════════════════════════════════════════════════════════════════════════
  guy: { name: "en-US-GuyNeural", desc: "Casual, Friendly", lang: "English US" },
  davis: { name: "en-US-DavisNeural", desc: "Professional", lang: "English US" },
  tony: { name: "en-US-TonyNeural", desc: "Friendly", lang: "English US" },
  jason: { name: "en-US-JasonNeural", desc: "Confident", lang: "English US" },
  brandon: { name: "en-US-BrandonNeural", desc: "Deep Voice", lang: "English US" },
  christopher: { name: "en-US-ChristopherNeural", desc: "Warm", lang: "English US" },
  eric: { name: "en-US-EricNeural", desc: "News Anchor", lang: "English US" },
  jacob: { name: "en-US-JacobNeural", desc: "Young Adult", lang: "English US" },
  roger: { name: "en-US-RogerNeural", desc: "Narrator", lang: "English US" },
  andrew: { name: "en-US-AndrewNeural", desc: "Casual", lang: "English US" },
  brian: { name: "en-US-BrianNeural", desc: "Documentary", lang: "English US" },

  // ═══════════════════════════════════════════════════════════════════════════
  // ENGLISH UK - FEMALE
  // ═══════════════════════════════════════════════════════════════════════════
  sonia: { name: "en-GB-SoniaNeural", desc: "British Elegant", lang: "English UK" },
  libby: { name: "en-GB-LibbyNeural", desc: "British Friendly", lang: "English UK" },
  maisie: { name: "en-GB-MaisieNeural", desc: "British Child", lang: "English UK" },
  bella: { name: "en-GB-BellaNeural", desc: "British Warm", lang: "English UK" },
  hollie: { name: "en-GB-HollieNeural", desc: "British Cheerful", lang: "English UK" },

  // ═══════════════════════════════════════════════════════════════════════════
  // ENGLISH UK - MALE
  // ═══════════════════════════════════════════════════════════════════════════
  ryan: { name: "en-GB-RyanNeural", desc: "British Male", lang: "English UK" },
  thomas: { name: "en-GB-ThomasNeural", desc: "British Narrator", lang: "English UK" },
  alfie: { name: "en-GB-AlfieNeural", desc: "British Child", lang: "English UK" },
  oliver: { name: "en-GB-OliverNeural", desc: "British Young", lang: "English UK" },
  ethan: { name: "en-GB-EthanNeural", desc: "British Casual", lang: "English UK" },

  // ═══════════════════════════════════════════════════════════════════════════
  // ENGLISH AUSTRALIA
  // ═══════════════════════════════════════════════════════════════════════════
  natasha: { name: "en-AU-NatashaNeural", desc: "Australian Female", lang: "English AU" },
  annette: { name: "en-AU-AnnetteNeural", desc: "Australian Warm", lang: "English AU" },
  carly: { name: "en-AU-CarlyNeural", desc: "Australian Young", lang: "English AU" },
  william: { name: "en-AU-WilliamNeural", desc: "Australian Male", lang: "English AU" },
  darren: { name: "en-AU-DarrenNeural", desc: "Australian Deep", lang: "English AU" },
  duncan: { name: "en-AU-DuncanNeural", desc: "Australian Casual", lang: "English AU" },

  // ═══════════════════════════════════════════════════════════════════════════
  // ENGLISH CANADA/IRELAND/OTHERS
  // ═══════════════════════════════════════════════════════════════════════════
  clara: { name: "en-CA-ClaraNeural", desc: "Canadian Female", lang: "English CA" },
  liam: { name: "en-CA-LiamNeural", desc: "Canadian Male", lang: "English CA" },
  emily: { name: "en-IE-EmilyNeural", desc: "Irish Female", lang: "English IE" },
  connor: { name: "en-IE-ConnorNeural", desc: "Irish Male", lang: "English IE" },
  rosa: { name: "en-NZ-MollyNeural", desc: "New Zealand Female", lang: "English NZ" },
  mitchell: { name: "en-NZ-MitchellNeural", desc: "New Zealand Male", lang: "English NZ" },
  neerja: { name: "en-IN-NeerjaNeural", desc: "Indian English Female", lang: "English IN" },
  prabhat: { name: "en-IN-PrabhatNeural", desc: "Indian English Male", lang: "English IN" },

  // ═══════════════════════════════════════════════════════════════════════════
  // JAPANESE
  // ═══════════════════════════════════════════════════════════════════════════
  nanami: { name: "ja-JP-NanamiNeural", desc: "Cute Female", lang: "Japanese" },
  aoi: { name: "ja-JP-AoiNeural", desc: "Professional Female", lang: "Japanese" },
  mayu: { name: "ja-JP-MayuNeural", desc: "Cheerful Female", lang: "Japanese" },
  shiori: { name: "ja-JP-ShioriNeural", desc: "Calm Female", lang: "Japanese" },
  keita: { name: "ja-JP-KeitaNeural", desc: "Young Male", lang: "Japanese" },
  daichi: { name: "ja-JP-DaichiNeural", desc: "Professional Male", lang: "Japanese" },
  naoki: { name: "ja-JP-NaokiNeural", desc: "Casual Male", lang: "Japanese" },

  // ═══════════════════════════════════════════════════════════════════════════
  // KOREAN
  // ═══════════════════════════════════════════════════════════════════════════
  sunhi: { name: "ko-KR-SunHiNeural", desc: "Friendly Female", lang: "Korean" },
  jisoo: { name: "ko-KR-JiMinNeural", desc: "Young Female", lang: "Korean" },
  soonbok: { name: "ko-KR-SoonBokNeural", desc: "Warm Female", lang: "Korean" },
  yujin: { name: "ko-KR-YuJinNeural", desc: "Cheerful Female", lang: "Korean" },
  injoon: { name: "ko-KR-InJoonNeural", desc: "Professional Male", lang: "Korean" },
  bongjin: { name: "ko-KR-BongJinNeural", desc: "Deep Male", lang: "Korean" },
  gookmin: { name: "ko-KR-GookMinNeural", desc: "Narrator Male", lang: "Korean" },
  hyunsu: { name: "ko-KR-HyunsuNeural", desc: "Casual Male", lang: "Korean" },

  // ═══════════════════════════════════════════════════════════════════════════
  // CHINESE MANDARIN (SIMPLIFIED)
  // ═══════════════════════════════════════════════════════════════════════════
  xiaoxiao: { name: "zh-CN-XiaoxiaoNeural", desc: "Lively Female", lang: "Chinese" },
  xiaoyi: { name: "zh-CN-XiaoyiNeural", desc: "Warm Female", lang: "Chinese" },
  xiaomeng: { name: "zh-CN-XiaomengNeural", desc: "Cute Female", lang: "Chinese" },
  xiaomo: { name: "zh-CN-XiaomoNeural", desc: "Anime Female", lang: "Chinese" },
  xiaorui: { name: "zh-CN-XiaoruiNeural", desc: "Professional Female", lang: "Chinese" },
  xiaohan: { name: "zh-CN-XiaohanNeural", desc: "Soft Female", lang: "Chinese" },
  xiaoshuang: { name: "zh-CN-XiaoshuangNeural", desc: "Child Female", lang: "Chinese" },
  xiaoxuan: { name: "zh-CN-XiaoxuanNeural", desc: "Cheerful Female", lang: "Chinese" },
  xiaoyan: { name: "zh-CN-XiaoyanNeural", desc: "Calm Female", lang: "Chinese" },
  xiaozhen: { name: "zh-CN-XiaozhenNeural", desc: "News Female", lang: "Chinese" },
  yunxi: { name: "zh-CN-YunxiNeural", desc: "Young Male", lang: "Chinese" },
  yunjian: { name: "zh-CN-YunjianNeural", desc: "Narrator Male", lang: "Chinese" },
  yunyang: { name: "zh-CN-YunyangNeural", desc: "Professional Male", lang: "Chinese" },
  yunhao: { name: "zh-CN-YunhaoNeural", desc: "Warm Male", lang: "Chinese" },
  yunfeng: { name: "zh-CN-YunfengNeural", desc: "Casual Male", lang: "Chinese" },
  yunze: { name: "zh-CN-YunzeNeural", desc: "Deep Male", lang: "Chinese" },

  // ═══════════════════════════════════════════════════════════════════════════
  // CHINESE CANTONESE / TAIWANESE
  // ═══════════════════════════════════════════════════════════════════════════
  hiugaai: { name: "zh-HK-HiuGaaiNeural", desc: "Cantonese Female", lang: "Cantonese" },
  hiumaan: { name: "zh-HK-HiuMaanNeural", desc: "Cantonese Warm Female", lang: "Cantonese" },
  wanlung: { name: "zh-HK-WanLungNeural", desc: "Cantonese Male", lang: "Cantonese" },
  hsiao: { name: "zh-TW-HsiaoChenNeural", desc: "Taiwanese Female", lang: "Chinese TW" },
  hsiaoyu: { name: "zh-TW-HsiaoYuNeural", desc: "Taiwanese Warm Female", lang: "Chinese TW" },
  yunhsuan: { name: "zh-TW-YunJheNeural", desc: "Taiwanese Male", lang: "Chinese TW" },

  // ═══════════════════════════════════════════════════════════════════════════
  // FILIPINO / TAGALOG
  // ═══════════════════════════════════════════════════════════════════════════
  blessica: { name: "fil-PH-BlessicaNeural", desc: "Filipino Female", lang: "Filipino" },
  angelo: { name: "fil-PH-AngeloNeural", desc: "Filipino Male", lang: "Filipino" },

  // ═══════════════════════════════════════════════════════════════════════════
  // SPANISH
  // ═══════════════════════════════════════════════════════════════════════════
  elvira: { name: "es-ES-ElviraNeural", desc: "Spanish Female", lang: "Spanish ES" },
  abril: { name: "es-ES-AbrilNeural", desc: "Spanish Warm Female", lang: "Spanish ES" },
  irene: { name: "es-ES-IreneNeural", desc: "Spanish Young Female", lang: "Spanish ES" },
  triana: { name: "es-ES-TrianaNeural", desc: "Spanish Soft Female", lang: "Spanish ES" },
  alvaro: { name: "es-ES-AlvaroNeural", desc: "Spanish Male", lang: "Spanish ES" },
  arnau: { name: "es-ES-ArnauNeural", desc: "Spanish Deep Male", lang: "Spanish ES" },
  dalia: { name: "es-MX-DaliaNeural", desc: "Mexican Female", lang: "Spanish MX" },
  nuria: { name: "es-MX-NuriaNeural", desc: "Mexican Warm Female", lang: "Spanish MX" },
  renata: { name: "es-MX-RenataNeural", desc: "Mexican Young Female", lang: "Spanish MX" },
  larissa: { name: "es-MX-LarissaNeural", desc: "Mexican Cheerful Female", lang: "Spanish MX" },
  jorge: { name: "es-MX-JorgeNeural", desc: "Mexican Male", lang: "Spanish MX" },
  liberio: { name: "es-MX-LiberioNeural", desc: "Mexican Deep Male", lang: "Spanish MX" },
  elena: { name: "es-AR-ElenaNeural", desc: "Argentine Female", lang: "Spanish AR" },
  tomas: { name: "es-AR-TomasNeural", desc: "Argentine Male", lang: "Spanish AR" },

  // ═══════════════════════════════════════════════════════════════════════════
  // PORTUGUESE
  // ═══════════════════════════════════════════════════════════════════════════
  francisca: { name: "pt-BR-FranciscaNeural", desc: "Brazilian Female", lang: "Portuguese BR" },
  giovanna: { name: "pt-BR-GiovannaNeural", desc: "Brazilian Young Female", lang: "Portuguese BR" },
  leticia: { name: "pt-BR-LeticiaNeural", desc: "Brazilian Cheerful Female", lang: "Portuguese BR" },
  manuela: { name: "pt-BR-ManuelaNeural", desc: "Brazilian Warm Female", lang: "Portuguese BR" },
  antonio: { name: "pt-BR-AntonioNeural", desc: "Brazilian Male", lang: "Portuguese BR" },
  humberto: { name: "pt-BR-HumbertoNeural", desc: "Brazilian Deep Male", lang: "Portuguese BR" },
  julio: { name: "pt-BR-JulioNeural", desc: "Brazilian Casual Male", lang: "Portuguese BR" },
  valerio: { name: "pt-BR-ValerioNeural", desc: "Brazilian Narrator Male", lang: "Portuguese BR" },
  raquel: { name: "pt-PT-RaquelNeural", desc: "Portuguese Female", lang: "Portuguese PT" },
  fernanda: { name: "pt-PT-FernandaNeural", desc: "Portuguese Warm Female", lang: "Portuguese PT" },
  duarte: { name: "pt-PT-DuarteNeural", desc: "Portuguese Male", lang: "Portuguese PT" },

  // ═══════════════════════════════════════════════════════════════════════════
  // FRENCH
  // ═══════════════════════════════════════════════════════════════════════════
  denise: { name: "fr-FR-DeniseNeural", desc: "French Female", lang: "French" },
  brigitte: { name: "fr-FR-BrigitteNeural", desc: "French Elegant Female", lang: "French" },
  celeste: { name: "fr-FR-CelesteNeural", desc: "French Soft Female", lang: "French" },
  coralie: { name: "fr-FR-CoralieNeural", desc: "French Warm Female", lang: "French" },
  eloise: { name: "fr-FR-EloiseNeural", desc: "French Child Female", lang: "French" },
  jacqueline: { name: "fr-FR-JacquelineNeural", desc: "French Professional Female", lang: "French" },
  josephine: { name: "fr-FR-JosephineNeural", desc: "French Cheerful Female", lang: "French" },
  henri: { name: "fr-FR-HenriNeural", desc: "French Male", lang: "French" },
  alain: { name: "fr-FR-AlainNeural", desc: "French Deep Male", lang: "French" },
  claude: { name: "fr-FR-ClaudeNeural", desc: "French Narrator Male", lang: "French" },
  jerome: { name: "fr-FR-JeromeNeural", desc: "French Casual Male", lang: "French" },
  maurice: { name: "fr-FR-MauriceNeural", desc: "French Professional Male", lang: "French" },
  yves: { name: "fr-FR-YvesNeural", desc: "French Young Male", lang: "French" },
  sylvie: { name: "fr-CA-SylvieNeural", desc: "Canadian French Female", lang: "French CA" },
  antoine: { name: "fr-CA-AntoineNeural", desc: "Canadian French Male", lang: "French CA" },

  // ═══════════════════════════════════════════════════════════════════════════
  // GERMAN
  // ═══════════════════════════════════════════════════════════════════════════
  katja: { name: "de-DE-KatjaNeural", desc: "German Female", lang: "German" },
  amala: { name: "de-DE-AmalaNeural", desc: "German Warm Female", lang: "German" },
  elke: { name: "de-DE-ElkeNeural", desc: "German Professional Female", lang: "German" },
  gisela: { name: "de-DE-GiselaNeural", desc: "German Child Female", lang: "German" },
  klarissa: { name: "de-DE-KlarissaNeural", desc: "German Cheerful Female", lang: "German" },
  louisa: { name: "de-DE-LouisaNeural", desc: "German Young Female", lang: "German" },
  maja: { name: "de-DE-MajaNeural", desc: "German Soft Female", lang: "German" },
  seraphina: { name: "de-DE-SeraphinaNeural", desc: "German Elegant Female", lang: "German" },
  tanja: { name: "de-DE-TanjaNeural", desc: "German Calm Female", lang: "German" },
  conrad: { name: "de-DE-ConradNeural", desc: "German Male", lang: "German" },
  bernd: { name: "de-DE-BerndNeural", desc: "German Deep Male", lang: "German" },
  christoph: { name: "de-DE-ChristophNeural", desc: "German Professional Male", lang: "German" },
  florian: { name: "de-DE-FlorianNeural", desc: "German Young Male", lang: "German" },
  kasper: { name: "de-DE-KasperNeural", desc: "German Casual Male", lang: "German" },
  killian: { name: "de-DE-KillianNeural", desc: "German Narrator Male", lang: "German" },
  ralf: { name: "de-DE-RalfNeural", desc: "German Warm Male", lang: "German" },
  ingrid: { name: "de-AT-IngridNeural", desc: "Austrian Female", lang: "German AT" },
  jonas: { name: "de-AT-JonasNeural", desc: "Austrian Male", lang: "German AT" },
  leni: { name: "de-CH-LeniNeural", desc: "Swiss German Female", lang: "German CH" },
  jan: { name: "de-CH-JanNeural", desc: "Swiss German Male", lang: "German CH" },

  // ═══════════════════════════════════════════════════════════════════════════
  // ITALIAN
  // ═══════════════════════════════════════════════════════════════════════════
  elsa: { name: "it-IT-ElsaNeural", desc: "Italian Female", lang: "Italian" },
  isabella: { name: "it-IT-IsabellaNeural", desc: "Italian Warm Female", lang: "Italian" },
  fiamma: { name: "it-IT-FiammaNeural", desc: "Italian Young Female", lang: "Italian" },
  fabiola: { name: "it-IT-FabiolaNeural", desc: "Italian Cheerful Female", lang: "Italian" },
  imelda: { name: "it-IT-ImeldaNeural", desc: "Italian Professional Female", lang: "Italian" },
  irma: { name: "it-IT-IrmaNeural", desc: "Italian Soft Female", lang: "Italian" },
  palmira: { name: "it-IT-PalmiraNeural", desc: "Italian Elegant Female", lang: "Italian" },
  pierina: { name: "it-IT-PierinaNeural", desc: "Italian Child Female", lang: "Italian" },
  diego: { name: "it-IT-DiegoNeural", desc: "Italian Male", lang: "Italian" },
  benigno: { name: "it-IT-BenignoNeural", desc: "Italian Deep Male", lang: "Italian" },
  calimero: { name: "it-IT-CalimeroNeural", desc: "Italian Young Male", lang: "Italian" },
  cataldo: { name: "it-IT-CataldoNeural", desc: "Italian Professional Male", lang: "Italian" },
  gianni: { name: "it-IT-GianniNeural", desc: "Italian Casual Male", lang: "Italian" },
  lisandro: { name: "it-IT-LisandroNeural", desc: "Italian Narrator Male", lang: "Italian" },
  rinaldo: { name: "it-IT-RinaldoNeural", desc: "Italian Warm Male", lang: "Italian" },

  // ═══════════════════════════════════════════════════════════════════════════
  // RUSSIAN
  // ═══════════════════════════════════════════════════════════════════════════
  svetlana: { name: "ru-RU-SvetlanaNeural", desc: "Russian Female", lang: "Russian" },
  dariya: { name: "ru-RU-DariyaNeural", desc: "Russian Warm Female", lang: "Russian" },
  dmitry: { name: "ru-RU-DmitryNeural", desc: "Russian Male", lang: "Russian" },

  // ═══════════════════════════════════════════════════════════════════════════
  // ARABIC
  // ═══════════════════════════════════════════════════════════════════════════
  zariyah: { name: "ar-SA-ZariyahNeural", desc: "Arabic Saudi Female", lang: "Arabic SA" },
  hamed: { name: "ar-SA-HamedNeural", desc: "Arabic Saudi Male", lang: "Arabic SA" },
  fatima: { name: "ar-AE-FatimaNeural", desc: "Arabic UAE Female", lang: "Arabic UAE" },
  hamdan: { name: "ar-AE-HamdanNeural", desc: "Arabic UAE Male", lang: "Arabic UAE" },
  salma: { name: "ar-EG-SalmaNeural", desc: "Egyptian Female", lang: "Arabic EG" },
  shakir: { name: "ar-EG-ShakirNeural", desc: "Egyptian Male", lang: "Arabic EG" },

  // ═══════════════════════════════════════════════════════════════════════════
  // HINDI / INDIA
  // ═══════════════════════════════════════════════════════════════════════════
  swara: { name: "hi-IN-SwaraNeural", desc: "Hindi Female", lang: "Hindi" },
  madhur: { name: "hi-IN-MadhurNeural", desc: "Hindi Male", lang: "Hindi" },

  // ═══════════════════════════════════════════════════════════════════════════
  // INDONESIAN / MALAY
  // ═══════════════════════════════════════════════════════════════════════════
  gadis: { name: "id-ID-GadisNeural", desc: "Indonesian Female", lang: "Indonesian" },
  ardi: { name: "id-ID-ArdiNeural", desc: "Indonesian Male", lang: "Indonesian" },
  yasmin: { name: "ms-MY-YasminNeural", desc: "Malaysian Female", lang: "Malay" },
  osman: { name: "ms-MY-OsmanNeural", desc: "Malaysian Male", lang: "Malay" },

  // ═══════════════════════════════════════════════════════════════════════════
  // THAI
  // ═══════════════════════════════════════════════════════════════════════════
  achara: { name: "th-TH-AcharaNeural", desc: "Thai Female", lang: "Thai" },
  premwadee: { name: "th-TH-PremwadeeNeural", desc: "Thai Warm Female", lang: "Thai" },
  niwat: { name: "th-TH-NiwatNeural", desc: "Thai Male", lang: "Thai" },

  // ═══════════════════════════════════════════════════════════════════════════
  // VIETNAMESE
  // ═══════════════════════════════════════════════════════════════════════════
  hoai: { name: "vi-VN-HoaiMyNeural", desc: "Vietnamese Female", lang: "Vietnamese" },
  namminh: { name: "vi-VN-NamMinhNeural", desc: "Vietnamese Male", lang: "Vietnamese" },

  // ═══════════════════════════════════════════════════════════════════════════
  // TURKISH
  // ═══════════════════════════════════════════════════════════════════════════
  emel: { name: "tr-TR-EmelNeural", desc: "Turkish Female", lang: "Turkish" },
  ahmet: { name: "tr-TR-AhmetNeural", desc: "Turkish Male", lang: "Turkish" },

  // ═══════════════════════════════════════════════════════════════════════════
  // DUTCH / FLEMISH
  // ═══════════════════════════════════════════════════════════════════════════
  colette: { name: "nl-NL-ColetteNeural", desc: "Dutch Female", lang: "Dutch" },
  fenna: { name: "nl-NL-FennaNeural", desc: "Dutch Warm Female", lang: "Dutch" },
  maarten: { name: "nl-NL-MaartenNeural", desc: "Dutch Male", lang: "Dutch" },
  dena: { name: "nl-BE-DenaNeural", desc: "Flemish Female", lang: "Flemish" },
  arnaud: { name: "nl-BE-ArnaudNeural", desc: "Flemish Male", lang: "Flemish" },

  // ═══════════════════════════════════════════════════════════════════════════
  // POLISH
  // ═══════════════════════════════════════════════════════════════════════════
  zofia: { name: "pl-PL-ZofiaNeural", desc: "Polish Female", lang: "Polish" },
  agnieszka: { name: "pl-PL-AgnieszkaNeural", desc: "Polish Warm Female", lang: "Polish" },
  marek: { name: "pl-PL-MarekNeural", desc: "Polish Male", lang: "Polish" },

  // ═══════════════════════════════════════════════════════════════════════════
  // SWEDISH / NORWEGIAN / DANISH / FINNISH
  // ═══════════════════════════════════════════════════════════════════════════
  sofie: { name: "sv-SE-SofieNeural", desc: "Swedish Female", lang: "Swedish" },
  hillevi: { name: "sv-SE-HilleviNeural", desc: "Swedish Warm Female", lang: "Swedish" },
  mattias: { name: "sv-SE-MattiasNeural", desc: "Swedish Male", lang: "Swedish" },
  iselin: { name: "nb-NO-IselinNeural", desc: "Norwegian Female", lang: "Norwegian" },
  pernille: { name: "nb-NO-PernilleNeural", desc: "Norwegian Warm Female", lang: "Norwegian" },
  finn: { name: "nb-NO-FinnNeural", desc: "Norwegian Male", lang: "Norwegian" },
  christel: { name: "da-DK-ChristelNeural", desc: "Danish Female", lang: "Danish" },
  jeppe: { name: "da-DK-JeppeNeural", desc: "Danish Male", lang: "Danish" },
  noora: { name: "fi-FI-NooraNeural", desc: "Finnish Female", lang: "Finnish" },
  selma: { name: "fi-FI-SelmaNeural", desc: "Finnish Warm Female", lang: "Finnish" },
  harri: { name: "fi-FI-HarriNeural", desc: "Finnish Male", lang: "Finnish" },

  // ═══════════════════════════════════════════════════════════════════════════
  // GREEK / CZECH / HUNGARIAN / ROMANIAN
  // ═══════════════════════════════════════════════════════════════════════════
  athina: { name: "el-GR-AthinaNeural", desc: "Greek Female", lang: "Greek" },
  nestoras: { name: "el-GR-NestorasNeural", desc: "Greek Male", lang: "Greek" },
  vlasta: { name: "cs-CZ-VlastaNeural", desc: "Czech Female", lang: "Czech" },
  antonin: { name: "cs-CZ-AntoninNeural", desc: "Czech Male", lang: "Czech" },
  noemi: { name: "hu-HU-NoemiNeural", desc: "Hungarian Female", lang: "Hungarian" },
  tamas: { name: "hu-HU-TamasNeural", desc: "Hungarian Male", lang: "Hungarian" },
  alina: { name: "ro-RO-AlinaNeural", desc: "Romanian Female", lang: "Romanian" },
  emil: { name: "ro-RO-EmilNeural", desc: "Romanian Male", lang: "Romanian" },

  // ═══════════════════════════════════════════════════════════════════════════
  // HEBREW / UKRAINIAN
  // ═══════════════════════════════════════════════════════════════════════════
  hila: { name: "he-IL-HilaNeural", desc: "Hebrew Female", lang: "Hebrew" },
  avri: { name: "he-IL-AvriNeural", desc: "Hebrew Male", lang: "Hebrew" },
  polina: { name: "uk-UA-PolinaNeural", desc: "Ukrainian Female", lang: "Ukrainian" },
  ostap: { name: "uk-UA-OstapNeural", desc: "Ukrainian Male", lang: "Ukrainian" },
};

// ══════════════════════════════════════════════════════════════════════════════
// GLOBAL TTS STATE
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Path to TTS settings file for persistence
 */
const TTS_SETTINGS_PATH = path.join(__dirname, "../../../../../config/tts.json");

/**
 * Load TTS settings from file
 * @returns {Object} Settings object
 */
function loadSettings() {
  try {
    if (fs.existsSync(TTS_SETTINGS_PATH)) {
      const data = fs.readFileSync(TTS_SETTINGS_PATH, "utf8");
      const settings = JSON.parse(data);
      console.log(`[TTS] Loaded from tts.json - Default Voice: ${settings.defaultVoice}, Enabled: ${settings.enabled}`);
      return settings;
    }
  } catch (err) {
    console.error("[TTS] Error loading settings:", err.message);
  }
  // Create default settings file if it doesn't exist
  const defaultSettings = { enabled: false, defaultVoice: "ana", rate: "+0%", pitch: "+0Hz", mode: "both", smartVoice: true };
  try {
    fs.writeFileSync(TTS_SETTINGS_PATH, JSON.stringify(defaultSettings, null, 2));
    console.log("[TTS] Created default tts.json settings file");
  } catch (e) {
    console.error("[TTS] Could not create default settings:", e.message);
  }
  return defaultSettings;
}

/**
 * Save TTS settings to file
 */
function saveSettings() {
  try {
    const settings = {
      enabled: globalTTSEnabled,
      defaultVoice: currentVoice,
      rate: currentRate,
      pitch: currentPitch,
      mode: currentMode,
      smartVoice: smartVoiceEnabled,
    };
    fs.writeFileSync(TTS_SETTINGS_PATH, JSON.stringify(settings, null, 2));
    console.log("[TTS] Settings saved to file");
  } catch (err) {
    console.error("[TTS] Error saving settings:", err.message);
  }
}

// Load saved settings on startup
const savedSettings = loadSettings();

/**
 * Global TTS enabled state - When true, ALL chats get voice messages
 */
let globalTTSEnabled = savedSettings.enabled || false;

/**
 * Current voice setting (loaded from tts.json as defaultVoice)
 */
let currentVoice = savedSettings.defaultVoice || "ana";

/**
 * Speech rate (e.g., "+20%", "-10%")
 */
let currentRate = savedSettings.rate || "+0%";

/**
 * Voice pitch (e.g., "+10Hz", "-5Hz")
 */
let currentPitch = savedSettings.pitch || "+0Hz";

/**
 * Output mode: "voice" (voice only), "text" (text only), "both" (voice + text)
 */
let currentMode = savedSettings.mode || "both";

/**
 * Smart Voice: Auto-detect language and use appropriate female voice
 */
let smartVoiceEnabled = savedSettings.smartVoice !== false; // Default true

console.log(`[TTS] Loaded settings - Enabled: ${globalTTSEnabled}, Voice: ${currentVoice}, Mode: ${currentMode}, SmartVoice: ${smartVoiceEnabled}`);

// ══════════════════════════════════════════════════════════════════════════════
// HTTP CLIENT - Pure Node.js, no external packages
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Make HTTP request to TTS server
 * @param {string} endpoint - API endpoint
 * @param {Object} options - Request options
 * @returns {Promise<Buffer>} Response data
 */
function makeRequest(endpoint, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, TTS_SERVER_URL);
    const isHttps = url.protocol === "https:";
    const client = isHttps ? https : http;

    const requestOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: options.method || "GET",
      headers: {
        Accept: "audio/mpeg",
        "User-Agent": "Nero-Bot/2.1",
        ...options.headers,
      },
      timeout: REQUEST_TIMEOUT,
    };

    const req = client.request(requestOptions, (res) => {
      const chunks = [];

      res.on("data", (chunk) => chunks.push(chunk));

      res.on("end", () => {
        const data = Buffer.concat(chunks);

        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          let errorMsg = `HTTP ${res.statusCode}`;
          try {
            const json = JSON.parse(data.toString());
            errorMsg = json.detail || json.error || errorMsg;
          } catch {
            // Not JSON
          }
          reject(new Error(errorMsg));
        }
      });

      res.on("error", reject);
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// TTS API FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Generate speech audio from text
 * @param {string} text - Text to convert to speech
 * @param {string} voice - Voice shortcut or full name
 * @param {Object} options - Rate, pitch options
 * @returns {Promise<Buffer>} MP3 audio data
 */
async function generateSpeech(text, voice = currentVoice, options = {}) {
  if (!text || typeof text !== "string") {
    throw new Error("Text is required");
  }

  let trimmedText = text.trim();
  if (!trimmedText) {
    throw new Error("Text cannot be empty");
  }

  // Truncate if too long
  if (trimmedText.length > MAX_TEXT_LENGTH) {
    trimmedText = trimmedText.substring(0, MAX_TEXT_LENGTH) + "...";
  }

  // Resolve voice shortcut to full name
  const resolvedVoice = resolveVoice(voice);

  // Build query parameters
  const params = new URLSearchParams({
    text: trimmedText,
    voice: resolvedVoice,
    rate: options.rate || currentRate,
    pitch: options.pitch || currentPitch,
  });

  const endpoint = `/tts?${params.toString()}`;

  console.log(`[TTS] Generating: voice=${resolvedVoice}, length=${trimmedText.length}`);

  const audioData = await makeRequest(endpoint);

  if (!audioData || audioData.length === 0) {
    throw new Error("No audio data received");
  }

  console.log(`[TTS] Generated ${audioData.length} bytes`);
  return audioData;
}

/**
 * Check TTS server health
 * @returns {Promise<Object>} Health status
 */
async function checkHealth() {
  try {
    const data = await makeRequest("/health");
    return JSON.parse(data.toString());
  } catch (error) {
    return { status: "unhealthy", error: error.message };
  }
}

/**
 * Get available voices from server
 * @param {Object} filters - language, gender, locale filters
 * @returns {Promise<Object>} Voice list
 */
async function getVoices(filters = {}) {
  const params = new URLSearchParams();
  if (filters.language) params.append("language", filters.language);
  if (filters.gender) params.append("gender", filters.gender);
  if (filters.locale) params.append("locale", filters.locale);

  const endpoint = `/voices${params.toString() ? "?" + params.toString() : ""}`;

  try {
    const data = await makeRequest(endpoint);
    return JSON.parse(data.toString());
  } catch (error) {
    console.error("[TTS] Failed to get voices:", error.message);
    return { count: 0, voices: [] };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// VOICE MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Resolve voice shortcut to full Microsoft voice name
 * @param {string} voice - Shortcut or full name
 * @returns {string} Full voice name
 */
function resolveVoice(voice) {
  // If no voice specified, use the current voice from tts.json settings
  if (!voice) {
    return VOICE_SHORTCUTS[currentVoice]?.name || VOICE_SHORTCUTS.aria.name;
  }

  const lower = voice.toLowerCase().trim();

  // Check if it's a shortcut
  if (VOICE_SHORTCUTS[lower]) {
    return VOICE_SHORTCUTS[lower].name;
  }

  // Check if it's already a full voice name (contains "Neural")
  if (voice.includes("Neural")) {
    return voice;
  }

  // Try to find partial match in shortcuts
  for (const [key, val] of Object.entries(VOICE_SHORTCUTS)) {
    if (key.includes(lower) || val.name.toLowerCase().includes(lower)) {
      return val.name;
    }
  }

  // Fallback to current voice from tts.json settings
  return VOICE_SHORTCUTS[currentVoice]?.name || VOICE_SHORTCUTS.aria.name;
}

/**
 * Set the current voice
 * @param {string} voice - Voice shortcut or full name
 * @returns {Object} Result with voice info
 */
function setVoice(voice) {
  const lower = (voice || "").toLowerCase().trim();

  if (!lower) {
    return { success: false, error: "No voice specified" };
  }

  // Check if valid shortcut
  if (VOICE_SHORTCUTS[lower]) {
    currentVoice = lower;
    const info = VOICE_SHORTCUTS[lower];
    saveSettings();
    console.log(`[TTS] Voice changed to: ${lower} (${info.name})`);
    return {
      success: true,
      voice: lower,
      fullName: info.name,
      description: info.desc,
      language: info.lang,
    };
  }

  // Check if it's a full voice name
  if (voice.includes("Neural")) {
    currentVoice = voice;
    saveSettings();
    console.log(`[TTS] Voice changed to: ${voice}`);
    return {
      success: true,
      voice: voice,
      fullName: voice,
      description: "Custom voice",
      language: "Unknown",
    };
  }

  return {
    success: false,
    error: `Unknown voice: ${voice}`,
    available: Object.keys(VOICE_SHORTCUTS).join(", "),
  };
}

/**
 * Get current voice info
 * @returns {Object} Voice info
 */
function getVoice() {
  const info = VOICE_SHORTCUTS[currentVoice];
  return {
    shortcut: currentVoice,
    fullName: info ? info.name : currentVoice,
    description: info ? info.desc : "Custom",
    language: info ? info.lang : "Unknown",
  };
}

/**
 * Get all voice shortcuts
 * @returns {Object} All shortcuts
 */
function getShortcuts() {
  return VOICE_SHORTCUTS;
}

/**
 * Get voice list formatted for display
 * @returns {string} Formatted voice list
 */
function getVoiceListFormatted() {
  const currentVoiceMarker = "✓";
  
  let result = `🎤 𝙰𝚟𝚊𝚒𝚕𝚊𝚋𝚕𝚎 𝚅𝚘𝚒𝚌𝚎𝚜\n\n`;

  // English Female
  result += `🇺🇸 𝙴𝚗𝚐𝚕𝚒𝚜𝚑 𝙵𝚎𝚖𝚊𝚕𝚎:\n`;
  result += `  • ana - Child, Cute${currentVoice === "ana" ? " " + currentVoiceMarker : ""}\n`;
  result += `  • aria - Young Adult, Expressive${currentVoice === "aria" ? " " + currentVoiceMarker : ""}\n`;
  result += `  • jenny - Friendly, Warm${currentVoice === "jenny" ? " " + currentVoiceMarker : ""}\n`;
  result += `  • sara - Professional${currentVoice === "sara" ? " " + currentVoiceMarker : ""}\n`;
  result += `  • michelle - Warm, Clear${currentVoice === "michelle" ? " " + currentVoiceMarker : ""}\n\n`;

  // English Male
  result += `🇺🇸 𝙴𝚗𝚐𝚕𝚒𝚜𝚑 𝙼𝚊𝚕𝚎:\n`;
  result += `  • guy - Casual, Friendly${currentVoice === "guy" ? " " + currentVoiceMarker : ""}\n`;
  result += `  • davis - Professional${currentVoice === "davis" ? " " + currentVoiceMarker : ""}\n`;
  result += `  • tony - Friendly${currentVoice === "tony" ? " " + currentVoiceMarker : ""}\n`;
  result += `  • jason - Confident${currentVoice === "jason" ? " " + currentVoiceMarker : ""}\n\n`;

  // British
  result += `🇬🇧 𝙱𝚛𝚒𝚝𝚒𝚜𝚑:\n`;
  result += `  • emma - Elegant${currentVoice === "emma" ? " " + currentVoiceMarker : ""}\n`;
  result += `  • libby - Friendly${currentVoice === "libby" ? " " + currentVoiceMarker : ""}\n`;
  result += `  • ryan - Male${currentVoice === "ryan" ? " " + currentVoiceMarker : ""}\n\n`;

  // Japanese
  result += `🇯🇵 𝙹𝚊𝚙𝚊𝚗𝚎𝚜𝚎:\n`;
  result += `  • nanami - Cute Female${currentVoice === "nanami" ? " " + currentVoiceMarker : ""}\n`;
  result += `  • keita - Male${currentVoice === "keita" ? " " + currentVoiceMarker : ""}\n\n`;

  // Chinese
  result += `🇨🇳 𝙲𝚑𝚒𝚗𝚎𝚜𝚎:\n`;
  result += `  • xiaoxiao - Lively Female${currentVoice === "xiaoxiao" ? " " + currentVoiceMarker : ""}\n`;
  result += `  • xiaoyi - Warm Female${currentVoice === "xiaoyi" ? " " + currentVoiceMarker : ""}\n`;
  result += `  • yunxi - Male${currentVoice === "yunxi" ? " " + currentVoiceMarker : ""}\n`;
  result += `  • hsiao - Taiwanese${currentVoice === "hsiao" ? " " + currentVoiceMarker : ""}\n\n`;

  // Korean
  result += `🇰🇷 𝙺𝚘𝚛𝚎𝚊𝚗:\n`;
  result += `  • sunhi - Friendly Female${currentVoice === "sunhi" ? " " + currentVoiceMarker : ""}\n`;
  result += `  • injoon - Male${currentVoice === "injoon" ? " " + currentVoiceMarker : ""}\n\n`;

  // Filipino
  result += `🇵🇭 𝙵𝚒𝚕𝚒𝚙𝚒𝚗𝚘:\n`;
  result += `  • blessica - Female${currentVoice === "blessica" ? " " + currentVoiceMarker : ""}\n`;
  result += `  • angelo - Male${currentVoice === "angelo" ? " " + currentVoiceMarker : ""}\n\n`;

  // Spanish
  result += `🇪🇸 𝚂𝚙𝚊𝚗𝚒𝚜𝚑:\n`;
  result += `  • elvira - Spanish${currentVoice === "elvira" ? " " + currentVoiceMarker : ""}\n`;
  result += `  • dalia - Mexican${currentVoice === "dalia" ? " " + currentVoiceMarker : ""}\n`;
  result += `  • lupe - Mexican${currentVoice === "lupe" ? " " + currentVoiceMarker : ""}\n\n`;

  // Portuguese
  result += `🇧🇷 𝙿𝚘𝚛𝚝𝚞𝚐𝚞𝚎𝚜𝚎:\n`;
  result += `  • francisca - Brazilian${currentVoice === "francisca" ? " " + currentVoiceMarker : ""}\n`;
  result += `  • raquel - Portuguese${currentVoice === "raquel" ? " " + currentVoiceMarker : ""}\n\n`;

  // European
  result += `🇪🇺 𝙴𝚞𝚛𝚘𝚙𝚎𝚊𝚗:\n`;
  result += `  • denise - French Female${currentVoice === "denise" ? " " + currentVoiceMarker : ""}\n`;
  result += `  • henri - French Male${currentVoice === "henri" ? " " + currentVoiceMarker : ""}\n`;
  result += `  • katja - German Female${currentVoice === "katja" ? " " + currentVoiceMarker : ""}\n`;
  result += `  • conrad - German Male${currentVoice === "conrad" ? " " + currentVoiceMarker : ""}\n`;
  result += `  • elsa - Italian Female${currentVoice === "elsa" ? " " + currentVoiceMarker : ""}\n`;
  result += `  • diego - Italian Male${currentVoice === "diego" ? " " + currentVoiceMarker : ""}\n\n`;

  // Other Asian
  result += `🌏 𝙾𝚝𝚑𝚎𝚛 𝙰𝚜𝚒𝚊𝚗:\n`;
  result += `  • swara - Hindi${currentVoice === "swara" ? " " + currentVoiceMarker : ""}\n`;
  result += `  • gadis - Indonesian${currentVoice === "gadis" ? " " + currentVoiceMarker : ""}\n`;
  result += `  • achara - Thai${currentVoice === "achara" ? " " + currentVoiceMarker : ""}\n`;
  result += `  • hoai - Vietnamese${currentVoice === "hoai" ? " " + currentVoiceMarker : ""}\n\n`;

  // Australian
  result += `🇦🇺 𝙰𝚞𝚜𝚝𝚛𝚊𝚕𝚒𝚊𝚗:\n`;
  result += `  • olivia - Female${currentVoice === "olivia" ? " " + currentVoiceMarker : ""}\n\n`;

  result += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  result += `📍 Current: ${currentVoice}\n`;
  result += `📝 Usage: voice <name>\n`;
  result += `Example: nero voice nanami`;

  return result;
}

// ══════════════════════════════════════════════════════════════════════════════
// TTS STATE MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Enable TTS globally
 */
function enable() {
  globalTTSEnabled = true;
  saveSettings();
  console.log("[TTS] Enabled globally for ALL chats");
}

/**
 * Disable TTS globally
 */
function disable() {
  globalTTSEnabled = false;
  saveSettings();
  console.log("[TTS] Disabled globally");
}

/**
 * Toggle TTS state
 * @returns {boolean} New state
 */
function toggle() {
  globalTTSEnabled = !globalTTSEnabled;
  saveSettings();
  console.log(`[TTS] Toggled: ${globalTTSEnabled ? "ON" : "OFF"}`);
  return globalTTSEnabled;
}

/**
 * Check if TTS is enabled
 * @returns {boolean}
 */
function isEnabled() {
  return globalTTSEnabled;
}

/**
 * Set speech rate
 * @param {string} rate - Rate string (e.g., "+20%", "-10%", "fast", "slow")
 */
function setRate(rate) {
  if (rate === "fast") {
    currentRate = "+25%";
  } else if (rate === "slow") {
    currentRate = "-25%";
  } else if (rate === "normal" || rate === "default") {
    currentRate = "+0%";
  } else {
    currentRate = rate;
  }
  saveSettings();
  console.log(`[TTS] Rate set to: ${currentRate}`);
}

/**
 * Set voice pitch
 * @param {string} pitch - Pitch string (e.g., "+10Hz", "-5Hz", "high", "low")
 */
function setPitch(pitch) {
  if (pitch === "high") {
    currentPitch = "+20Hz";
  } else if (pitch === "low") {
    currentPitch = "-20Hz";
  } else if (pitch === "normal" || pitch === "default") {
    currentPitch = "+0Hz";
  } else {
    currentPitch = pitch;
  }
  saveSettings();
  console.log(`[TTS] Pitch set to: ${currentPitch}`);
}

/**
 * Set output mode
 * @param {string} mode - "voice" (voice only), "text" (text only), "both" (voice + text)
 * @returns {Object} Result with mode info
 */
function setMode(mode) {
  const lower = (mode || "").toLowerCase().trim();
  
  const validModes = {
    voice: { name: "voice", desc: "Voice Only - No text, just voice messages" },
    voiceonly: { name: "voice", desc: "Voice Only - No text, just voice messages" },
    text: { name: "text", desc: "Text Only - No voice, just text messages" },
    textonly: { name: "text", desc: "Text Only - No voice, just text messages" },
    both: { name: "both", desc: "Text+Voice - Send text and voice together" },
    textvoice: { name: "both", desc: "Text+Voice - Send text and voice together" },
    all: { name: "both", desc: "Text+Voice - Send text and voice together" },
  };

  if (validModes[lower]) {
    currentMode = validModes[lower].name;
    saveSettings();
    console.log(`[TTS] Mode set to: ${currentMode}`);
    return {
      success: true,
      mode: currentMode,
      description: validModes[lower].desc,
    };
  }

  return {
    success: false,
    error: `Invalid mode: ${mode}`,
    available: "voice, text, both",
  };
}

/**
 * Get current mode
 * @returns {string} Current mode (voice, text, both)
 */
function getMode() {
  return currentMode;
}

/**
 * Check if text should be sent based on mode
 * @returns {boolean}
 */
function shouldSendText() {
  return currentMode === "text" || currentMode === "both";
}

/**
 * Check if voice should be sent based on mode
 * @returns {boolean}
 */
function shouldSendVoice() {
  return globalTTSEnabled && (currentMode === "voice" || currentMode === "both");
}

// ══════════════════════════════════════════════════════════════════════════════
// SMART VOICE MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Enable smart voice (auto language detection)
 */
function enableSmartVoice() {
  smartVoiceEnabled = true;
  saveSettings();
  console.log("[TTS] Smart Voice enabled - Auto language detection active");
}

/**
 * Disable smart voice (use manual voice setting)
 */
function disableSmartVoice() {
  smartVoiceEnabled = false;
  saveSettings();
  console.log("[TTS] Smart Voice disabled - Using manual voice setting");
}

/**
 * Check if smart voice is enabled
 * @returns {boolean}
 */
function isSmartVoiceEnabled() {
  return smartVoiceEnabled;
}

/**
 * Get smart voice info for a text sample
 * @param {string} text - Text to analyze
 * @returns {Object} Language and voice info
 */
function getSmartVoiceInfo(text) {
  const lang = detectLanguage(text);
  const voice = getVoiceForLanguage(lang);
  return {
    detectedLanguage: lang,
    voice: voice,
    smartVoiceEnabled: smartVoiceEnabled,
  };
}

/**
 * Get all supported languages for smart voice
 * @returns {Object} Language to voice mapping
 */
function getSupportedLanguages() {
  return SMART_VOICES;
}

/**
 * Get full status info
 * @returns {Object}
 */
function getStatus() {
  return {
    enabled: globalTTSEnabled,
    voice: currentVoice,
    voiceFullName: VOICE_SHORTCUTS[currentVoice]?.name || currentVoice,
    rate: currentRate,
    pitch: currentPitch,
    mode: currentMode,
    smartVoice: smartVoiceEnabled,
    server: TTS_SERVER_URL,
  };
}

/**
 * Get formatted status message
 * @returns {string}
 */
function getStatusMessage() {
  const status = getStatus();
  const voiceInfo = VOICE_SHORTCUTS[status.voice];

  return `🎤 **TTS Status**

📡 **Server:** ${status.server}
🔊 **Status:** ${status.enabled ? "✅ ENABLED (All Chats)" : "❌ DISABLED"}
🗣️ **Voice:** ${status.voice} (${voiceInfo?.desc || "Custom"})
🌍 **Language:** ${voiceInfo?.lang || "Unknown"}
⚡ **Rate:** ${status.rate}
🎵 **Pitch:** ${status.pitch}

💡 **Commands:**
• \`tts enable\` - Turn on voice
• \`tts disable\` - Turn off voice
• \`tts voice <name>\` - Change voice
• \`tts voices\` - List all voices`;
}

// ══════════════════════════════════════════════════════════════════════════════
// FACEBOOK INTEGRATION
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Send voice message to Facebook Messenger
 * @param {Object} api - Facebook API
 * @param {string} threadID - Thread ID
 * @param {string} text - Text to speak
 * @param {string} senderID - Sender ID (for logging)
 * @returns {Promise<Object|null>} Sent message or null
 */
async function sendVoiceMessage(api, threadID, text, _senderID) {
  if (!globalTTSEnabled) {
    return null;
  }

  // FIRST: Convert Unicode styled fonts back to normal ASCII characters
  // This handles Monospace (𝙰𝙱𝙲), Sans Bold (𝗔𝗕𝗖), etc. that TTS can't read
  const normalizedText = toNormal(text);

  // Clean text for TTS (remove markdown, emojis, special characters, etc.)
  const cleanText = normalizedText
    .replace(/\*\*/g, "") // Remove bold markdown
    .replace(/\*/g, "") // Remove italic markdown
    .replace(/`/g, "") // Remove code markdown
    .replace(/#{1,6}\s/g, "") // Remove headers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Convert links to text
    .replace(/https?:\/\/\S+/g, "") // Remove URLs
    .replace(/```[\s\S]*?```/g, "") // Remove code blocks
    // Remove ALL emojis using comprehensive Unicode ranges
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
    // Fallback: Remove common emoji Unicode blocks
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "") // Supplemental Symbols and Pictographs
    .replace(/[\u{2600}-\u{27BF}]/gu, "") // Misc symbols, Dingbats
    .replace(/[\u{FE00}-\u{FE0F}]/gu, "") // Variation Selectors
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, "") // Supplemental Symbols
    .replace(/[\u{200D}]/gu, "") // Zero Width Joiner (used in combined emojis)
    .replace(/[\u{20E3}]/gu, "") // Combining Enclosing Keycap
    .replace(/[\u{FE0F}]/gu, "") // Variation Selector-16
    .replace(/[\u{00A9}\u{00AE}\u{2122}]/gu, "") // ©®™
    // Remove special characters that shouldn't be read aloud
    .replace(/_/g, " ") // Replace underscores with spaces
    .replace(/—|–|−/g, " ") // Replace em-dash, en-dash, minus with space
    .replace(/-{2,}/g, " ") // Replace multiple hyphens with space
    .replace(/(?<!\d)-(?!\d)/g, " ") // Replace hyphens not between numbers with space
    .replace(/[~•●○■□▪▫★☆►◄▲▼◆◇♦♠♣♥♡]/g, "") // Remove decorative symbols
    .replace(/[│├└┌┐┘┬┴┼═║╔╗╚╝╠╣╦╩╬]/g, "") // Remove box drawing characters
    .replace(/[<>{}[\]|\\^]/g, "") // Remove brackets and special chars
    .replace(/&amp;/g, "and") // Replace HTML &
    .replace(/&/g, "and") // Replace & with "and"
    .replace(/\+/g, " plus ") // Replace + with "plus"
    .replace(/=/g, " equals ") // Replace = with "equals"
    .replace(/@/g, " at ") // Replace @ with "at"
    .replace(/#(?!\d)/g, "") // Remove # not followed by number
    .replace(/\$/g, " dollars ") // Replace $ with "dollars"
    .replace(/%/g, " percent ") // Replace % with "percent"
    .replace(/\s+/g, " ") // Collapse multiple spaces
    .trim();

  if (!cleanText || cleanText.length < 3) {
    console.log("[TTS] Text too short after cleaning, skipping voice");
    return null;
  }

  try {
    // Smart Voice: Auto-detect language and select appropriate female voice
    let voiceToUse = currentVoice;
    let detectedLang = "english";
    
    if (smartVoiceEnabled) {
      detectedLang = detectLanguage(cleanText);
      voiceToUse = getVoiceForLanguage(detectedLang);
      console.log(`[TTS] Smart Voice detected: ${detectedLang} → Using: ${voiceToUse}`);
    } else {
      // Use the manually set voice
      voiceToUse = resolveVoice(currentVoice);
      console.log(`[TTS] Using manual voice: ${voiceToUse}`);
    }

    console.log(`[TTS] Generating voice for thread ${threadID}`);

    // Generate audio from API with the selected voice
    const audioBuffer = await generateSpeech(cleanText, voiceToUse);

    // Save to temp file
    const tempFile = path.join(os.tmpdir(), `nero_tts_${Date.now()}.mp3`);
    fs.writeFileSync(tempFile, audioBuffer);

    // Send as voice message
    const msg = {
      attachment: fs.createReadStream(tempFile),
    };

    return new Promise((resolve, reject) => {
      api.sendMessage(msg, threadID, (err, info) => {
        // Clean up temp file
        try {
          fs.unlinkSync(tempFile);
        } catch {
          // Ignore cleanup errors
        }

        if (err) {
          console.error("[TTS] Failed to send voice:", err.message);
          reject(err);
        } else {
          console.log(`[TTS] Voice message sent to ${threadID}`);
          resolve(info);
        }
      });
    });
  } catch (error) {
    console.error("[TTS] Voice message failed:", error.message);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// MODULE EXPORTS
// ══════════════════════════════════════════════════════════════════════════════

module.exports = {
  // Core TTS functions
  generateSpeech,
  checkHealth,
  getVoices,

  // State management
  enable,
  disable,
  toggle,
  isEnabled,

  // Voice management
  setVoice,
  getVoice,
  getShortcuts,
  getVoiceListFormatted,
  resolveVoice,

  // Rate/Pitch
  setRate,
  setPitch,

  // Mode management
  setMode,
  getMode,
  shouldSendText,
  shouldSendVoice,

  // Smart Voice (auto language detection)
  enableSmartVoice,
  disableSmartVoice,
  isSmartVoiceEnabled,
  getSmartVoiceInfo,
  getSupportedLanguages,
  detectLanguage,

  // Status
  getStatus,
  getStatusMessage,

  // Facebook integration
  sendVoiceMessage,

  // Constants
  TTS_SERVER_URL,
  VOICE_SHORTCUTS,
  SMART_VOICES,
};

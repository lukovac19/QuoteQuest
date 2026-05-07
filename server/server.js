import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import multer from "multer";
import fs from "fs";
import * as pdfjsLib from "pdfjs-dist/build/pdf.mjs";

dotenv.config();

// ========== ENSURE UPLOADS FOLDER EXISTS ==========
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

const app = express();
app.use(cors({
  origin: [
    'https://quote-quest-nine.vercel.app',
    'https://www.quotequest.site',
    'https://quotequest.site',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: "50mb" }));

// ========== PDF.js WARNING SILENCER ==========
pdfjsLib.GlobalWorkerOptions.standardFontDataUrl = "";

const originalWarn = console.warn;
const originalError = console.error;

console.warn = (...args) => {
  const msg = args.join(" ");
  if (
    msg.includes("fetchStandardFontData") ||
    msg.includes("standard font") ||
    msg.includes("baseUrl") ||
    msg.includes(".pfb") ||
    msg.includes("UnknownErrorException")
  ) {
    return;
  }
  originalWarn.apply(console, args);
};

console.error = (...args) => {
  const msg = args.join(" ");
  if (
    msg.includes("fetchStandardFontData") ||
    msg.includes("standard font") ||
    msg.includes("baseUrl") ||
    msg.includes(".pfb")
  ) {
    return;
  }
  originalError.apply(console, args);
};

try {
  if (pdfjsLib.VerbosityLevel) {
    pdfjsLib.GlobalWorkerOptions.verbosity = pdfjsLib.VerbosityLevel.ERRORS;
  }
} catch (e) {}

const upload = multer({ dest: "uploads/" });

/* ---------- CHUNK SIZE CONFIGURATION ---------- */
const PAGES_PER_CHUNK = 20;
const MAX_TOKENS_PER_REQUEST = 1200;
const MAX_CONCURRENT_REQUESTS = 5;

/* ---------- MICRO-DETAIL KEYWORDS ---------- */
const MICRO_DETAIL_KEYWORDS = {
  location: [
    "lokacija", "mjesto", "mjesto", "prostor", "u kojem", "gdje", "gdje", 
    "ulica", "kuća", "kuća", "soba", "grad", "zgrada", "prostorija"
  ],
  object: [
    "predmet", "šta drži", "sta drzi", "šta nosi", "sta nosi", 
    "šta koristi", "sta koristi", "koji predmeti", "stvar", "objekt"
  ],
  clothing: [
    "odjeća", "odjeca", "odijelo", "haljina", "šešir", "sesir",
    "obučen", "obucen", "odjeven", "oblači", "oblaci", "nosi", 
    "boje", "koje boje", "kako je obučen", "kako je obucen"
  ],
  food: [
    "hrana", "jelo", "piće", "pice", "jede", "pije", 
    "ručak", "rucak", "večera", "vecera", "doručak", "dorucak"
  ],
  appearance: [
    "izgled", "kako izgleda", "opis", "opisana", "opisan",
    "fizički", "fizicki", "vanjski", "vanjski", "lice", "kosa"
  ],
  mention: [
    "spomenje", "prvi put", "pojavljuje se", "navodi se",
    "kada se spomenje", "gdje se spomenje", "koliko puta"
  ],
  action: [
    "redoslijed", "redosled", "šta se dešava", "sta se desava",
    "koji događaji", "koji dogadjaji", "radnja", "što radi", "sta radi"
  ],
  dialogue: [
    "koje riječi", "koje rijeci", "šta kaže", "sta kaze",
    "dijalog", "razgovor", "govori", "izjava"
  ],
  time: [
    "kada", "u kojem trenutku", "vrijeme", "vreme", "period",
    "dan", "noć", "noc", "jutro", "godina"
  ],
  age: [
    "starost", "koliko godina", "star", "mlad", "godište", "godine", "uzrast"
  ],
  price: [
    "cijena", "cena", "koliko košta", "koliko kosta", "vrijednost", "vrednost"
  ],
  quantity: [
    "koliko", "količina", "kolicina", "broj", "mjera", "mera"
  ]
};

/* ---------- Detect if question is micro-detail ---------- */
function isMicroDetailQuestion(question) {
  const q = question.toLowerCase();
  
  for (const keywords of Object.values(MICRO_DETAIL_KEYWORDS)) {
    if (keywords.some(kw => q.includes(kw))) {
      return true;
    }
  }
  
  const microPatterns = [
    /u kojem (dijelu|poglavlju|činu|cinu)/i,
    /koje? (boje?|predmet|lokacij|odijelo|haljin)/i,
    /šta (drži|drzi|nosi|jede|pije|kaže|kaze|radi)/i,
    /sta (drzi|nosi|jede|pije|kaze|radi)/i,
    /kako (je|izgleda|je obučen|je obucen)/i,
    /koji (predmeti|likovi|događaji|dogadjaji)/i,
    /koliko (košta|kosta|godina|ima)/i,
    /gdje (se nalazi|se nalazi|živi|zivi)/i,
    /kada (se dešava|se desava|je rođen|je rodjen)/i
  ];
  
  return microPatterns.some(pattern => pattern.test(q));
}

/* ---------- Extract PDF pages with sentence structure ---------- */
async function extractPages(buffer) {
  const pdf = await pdfjsLib
    .getDocument({
      data: buffer,
      useSystemFonts: false,
      standardFontDataUrl: "",
      disableFontFace: true,
      verbosity: 0,
    })
    .promise;

  const pagePromises = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    pagePromises.push(
      (async () => {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        let text = "";
        for (let item of content.items) text += item.str + " ";
        return text.replace(/\s+/g, " ").trim();
      })()
    );
  }

  return await Promise.all(pagePromises);
}

/* ---------- Create sentence index for micro-detail search ---------- */
function createSentenceIndex(pages) {
  const index = [];
  
  pages.forEach((pageText, pageIdx) => {
    const sentences = pageText.split(/(?<=[.!?])\s+(?=[A-ZŠĐČĆŽ])/);
    
    sentences.forEach((sentence, sentIdx) => {
      if (sentence.trim().length < 10) return;
      
      index.push({
        page: pageIdx + 1,
        sentenceIndex: sentIdx,
        text: sentence.trim(),
        lowerText: sentence.toLowerCase().trim()
      });
    });
  });
  
  return index;
}

/* ---------- Keyword-based pre-filter for micro-details ---------- */
function preFilterSentences(sentenceIndex, question) {
  const keywords = extractKeywords(question);
  if (keywords.length === 0) return sentenceIndex;
  
  const filtered = sentenceIndex.filter(item => {
    return keywords.some(kw => item.lowerText.includes(kw.toLowerCase()));
  });
  
  return filtered.length > 0 ? filtered : sentenceIndex;
}

/* ---------- Extract keywords from question ---------- */
function extractKeywords(question) {
  const q = question.trim().toLowerCase();
  
  const stopWords = [
    "u", "i", "a", "ali", "ako", "je", "su", "sa", "se", "o", "na", "za",
    "od", "do", "po", "iz", "koji", "koja", "koje", "koje", "kakav", "kakva",
    "kakvo", "kad", "kada", "gdje", "gdje", "kako", "šta", "sta", "što", "sto",
    "da", "li", "taj", "ta", "to", "ovaj", "ova", "ovo", "taj", "neki",
    "sve", "svi", "bilo", "biti", "ima", "imaju", "može", "moze", "može", 
    "više", "vise", "manje", "samo", "već", "vec", "još", "jos", "čak", "cak"
  ];
  
  const words = q.replace(/[?!.,;:()]/g, "").split(/\s+/);
  
  return words.filter(w => w.length > 2 && !stopWords.includes(w));
}

/* ---------- Split pages into chunks ---------- */
function createChunks(pages) {
  const chunks = [];
  for (let i = 0; i < pages.length; i += PAGES_PER_CHUNK) {
    const chunkPages = pages.slice(i, i + PAGES_PER_CHUNK);
    const startPage = i + 1;
    const endPage = Math.min(i + PAGES_PER_CHUNK, pages.length);
    
    const chunkText = chunkPages
      .map((text, idx) => `STRANICA ${startPage + idx}:\n${text}`)
      .join("\n\n----------------\n\n");
    
    chunks.push({
      text: chunkText,
      startPage,
      endPage,
      pages: chunkPages
    });
  }
  return chunks;
}

/* ---------- Create smaller chunks for micro-detail questions ---------- */
function createMicroDetailChunks(pages, filteredSentences) {
  const chunks = [];
  const MICRO_CHUNK_SIZE = 5;
  
  if (filteredSentences.length === 0) {
    return createChunks(pages).map(chunk => ({
      ...chunk,
      isMicroDetail: true
    }));
  }
  
  const relevantPages = [...new Set(filteredSentences.map(s => s.page))].sort((a, b) => a - b);
  
  for (let i = 0; i < relevantPages.length; i += MICRO_CHUNK_SIZE) {
    const pageGroup = relevantPages.slice(i, i + MICRO_CHUNK_SIZE);
    const startPage = pageGroup[0];
    const endPage = pageGroup[pageGroup.length - 1];
    
    const chunkText = pageGroup
      .map(pageNum => `STRANICA ${pageNum}:\n${pages[pageNum - 1]}`)
      .join("\n\n----------------\n\n");
    
    chunks.push({
      text: chunkText,
      startPage,
      endPage,
      pages: pageGroup.map(p => pages[p - 1]),
      isMicroDetail: true,
      relevantSentenceCount: filteredSentences.filter(s => pageGroup.includes(s.page)).length
    });
  }
  
  return chunks;
}

/* ---------- INTELLIGENT QUESTION UNDERSTANDING ---------- */

const QUESTION_PATTERNS = {
  characterization: [
    /karakterizacij/i,
    /osobine?\s+lika/i,
    /kako\s+je\s+opisan/i,
    /kakav\s+je\s+lik/i,
    /opis\s+lika/i,
    /portret\s+lika/i,
    /analiza\s+lika/i
  ],
  
  contrast: [
    /kontrast/i,
    /opreka/i,
    /opreke/i,
    /suprotnost/i,
    /razlik[ae]/i,
    /poredjenje/i,
    /poređenje/i,
    /kontrasti/i,
    /nabroj\s+kontraste/i,
    /daj\s+mi\s+kontraste/i,
    /između.*i/i,
    /vs\./i,
    /naspram/i
  ],
  
  theme: [
    /\btema\b/i,
    /teme\b/i,
    /tematik/i,
    /o\s+čemu\s+govori/i,
    /glavna\s+tema/i,
    /centralna\s+tema/i,
    /tematska\s+analiza/i
  ],
  
  idea: [
    /\bideja\b/i,
    /ideje\b/i,
    /poruka/i,
    /misao/i,
    /filozofija/i,
    /što\s+autor\s+želi/i,
    /šta\s+autor\s+želi/i,
    /smisao/i,
    /značenje/i
  ],
  
  symbolism: [
    /simbol/i,
    /simbolik/i,
    /simbolizuje/i,
    /simbolizira/i,
    /predstavlja/i,
    /metafor/i,
    /alegorij/i
  ],
  
  motif: [
    /motiv/i,
    /ponavlj/i,
    /recurring/i,
    /often\s+se\s+pojavljuje/i,
    /often\s+se\s+spomnuje/i
  ],
  
  relation: [
    /odnos/i,
    /veza/i,
    /relacij/i,
    /kako\s+se\s+odnos/i,
    /međusobni/i,
    /povezanost/i
  ],
  
  events: [
    /važn[ie]\s+događaj/i,
    /vazn[ie]\s+dogadjaj/i,
    /ključn[ie]\s+događaj/i,
    /radnja/i,
    /fabula/i,
    /zaplet/i,
    /što\s+se\s+dešava/i,
    /šta\s+se\s+dešava/i,
    /sažetak/i
  ],
  
  count: [
    /koliko\s+puta/i,
    /broj\s+ponavljanja/i,
    /učestalost/i,
    /koliko\s+se\s+spomnuje/i
  ],
  
  quotes: [
    /citat/i,
    /navod/i,
    /izvadak/i,
    /pasaž/i,
    /rečenic/i,
    /dio\s+teksta/i
  ]
};

/* ---------- Flexible question type detection ---------- */
function detectQuestionType(q) {
  const qLower = q.toLowerCase();
  
  for (const [type, patterns] of Object.entries(QUESTION_PATTERNS)) {
    if (patterns.some(pattern => pattern.test(qLower))) {
      if (type === 'theme' && QUESTION_PATTERNS.idea.some(p => p.test(qLower))) {
        return 'theme-idea';
      }
      return type;
    }
  }
  
  if (isMicroDetailQuestion(qLower)) {
    return 'micro-detail';
  }
  
  return 'quotes';
}

/* ---------- Detect micro-detail category ---------- */
function detectMicroDetailCategory(question) {
  const q = question.toLowerCase().trim();
  
  for (const [category, keywords] of Object.entries(MICRO_DETAIL_KEYWORDS)) {
    if (keywords.some(kw => q.includes(kw))) {
      return category;
    }
  }
  
  if (/što|šta|sta.*(?:kupi|nosi|drži|drzi|koristi)/i.test(q)) return "object";
  if (/kako.*(?:obučen|obucen|odjeven|izgleda)/i.test(q)) return "clothing";
  if (/(?:gdje|gde).*(?:se nalazi|živi|zivi|ide)/i.test(q)) return "location";
  if (/koliko.*(?:star|godina|uzrast)/i.test(q)) return "age";
  
  return "general";
}

/* ---------- Extract character name from question ---------- */
function extractCharacterName(question) {
  const q = question.trim();
  
  const match = q.match(/karakterizacija\s+(?:lika\s+)?(.+?)(?:\?|$)/i);
  if (match) {
    return match[1].trim().split(/[,.]/).filter(Boolean)[0].trim();
  }
  return null;
}

/* ---------- Word count helpers ---------- */
function extractTargetWordForCount(q) {
  q = q.trim();
  
  const quoted = q.match(/["""'„]([^"'""„]+)["""'„]/);
  if (quoted) return quoted[1].trim().toLowerCase();
  return q.split(/\s+/).pop()?.toLowerCase() || "";
}

function countWordOccurrencesInChunks(chunks, word) {
  const regex = new RegExp(`\\b${word}\\b`, "gi");
  let total = 0;
  const perPage = [];
  const examples = [];

  chunks.forEach((chunk) => {
    chunk.pages.forEach((pageText, idx) => {
      const pageNumber = chunk.startPage + idx;
      const matches = pageText.match(regex);
      const count = matches ? matches.length : 0;

      if (count > 0) {
        total += count;
        perPage.push({ page: pageNumber, count });

        const sentences = pageText.split(/[.!?]+/).filter(s => s.trim().length > 10);
        let foundCount = 0;
        
        for (const sentence of sentences) {
          if (foundCount >= 2) break;
          if (regex.test(sentence)) {
            examples.push({
              page: pageNumber,
              sentence: sentence.trim(),
              fullText: pageText
            });
            foundCount++;
          }
        }
      }
    });
  });

  return { total, perPage, examples };
}

/* ---------- ENHANCED SYSTEM PROMPT ---------- */
function getSystemPrompt(totalPages, chunkInfo, taskType, category = null) {
  let basePrompt = `You are QuoteQuest AI — an ULTRA-PRECISE literature analysis engine that understands EVERY possible user question variation.

CRITICAL: You must ground ALL answers ONLY in the provided PDF text. NEVER invent information.

You are analyzing a CHUNK of a larger book.

CHUNK INFO:
- This chunk contains pages ${chunkInfo.startPage} to ${chunkInfo.endPage}
- Total book has ${totalPages} pages
- You are analyzing part of the complete work

═══════════════════════════════════════════════════════════════════
🔴 ABSOLUTE RULES 🔴
═══════════════════════════════════════════════════════════════════

1. BOSNIAN TITLES ONLY
   ✅ "element" field MUST be in Bosnian
   ✅ Examples: "Osobina: Hrabrost", "Tema: Sloboda", "Kontrast: Nora ↔ Torvald"
   ❌ NEVER use English: "Trait", "Theme", "Contrast"
   ❌ NEVER leave "element" empty or null

2. EXTRACT ONLY FROM PROVIDED TEXT
   ✅ Extract quotes ONLY from the chunk provided
   ✅ Use page numbers EXACTLY as marked (STRANICA X:)
   ✅ DO NOT invent or hallucinate content
   ✅ If information is NOT in this chunk, DO NOT include it
   ✅ If you cannot find the answer, do not make one up

3. NEVER REPEAT QUOTES
   ✅ Each "text" field must be UNIQUE
   ✅ DO NOT use the same sentence twice
   ✅ DO NOT use paraphrased versions of the same content

4. ACCURATE CONTEXT EXTRACTION
   ✅ Extract 3-8 sentences surrounding the quote
   ✅ Include sentences BEFORE and AFTER the quote
   ✅ The context must be the ACTUAL paragraph from the book
   ❌ DO NOT just repeat the quote

5. ACCURATE PAGE NUMBERS
   ✅ Use the exact page from "STRANICA X:" markers
   ✅ Never guess page numbers
   ✅ If page is unclear, use 0

6. UNDERSTAND ALL QUESTION VARIATIONS
   ✅ User may ask the same thing in many different ways
   ✅ Treat synonyms, paraphrases, and variations as same intent
   ✅ Examples: "kontrasti", "opreke", "suprotnosti" = all mean contrasts`;

  if (taskType === "theme" || taskType === "idea" || taskType === "theme-idea") {
    basePrompt += `

═══════════════════════════════════════════════════════════════════
🔥 THEME/IDEA EXTRACTION MODE 🔥
═══════════════════════════════════════════════════════════════════

SPECIAL RULES FOR THEMES AND IDEAS:

1. ELEMENT FORMAT:
   ✅ For theme: "Tema: [name of theme]"
   ✅ For idea: "Ideja: [name of idea]"
   ✅ Example: "Tema: Sloboda i društveni pritisak"
   ✅ Example: "Ideja: Sukob između individualnosti i društvenih normi"

2. TEXT FIELD:
   - For themes/ideas, the "text" field should be EMPTY ("")
   - NO quotes needed unless user explicitly asks
   - The main content goes in the "meaning" field

3. MEANING FIELD (MOST IMPORTANT):
   ✅ Start with SHORT formulation (1 sentence)
   ✅ Then provide detailed explanation (3-5 sentences)
   ✅ Explain the ESSENCE of the theme/idea
   ✅ Provide BROADER CONTEXT of how it manifests in the work
   ✅ Explain its SIGNIFICANCE to the overall narrative
   ✅ Connect it to CHARACTER DEVELOPMENT or PLOT
   ✅ DO NOT just quote - ANALYZE and EXPLAIN

4. EXAMPLE FORMAT:
   {
     "element": "Tema: Sloboda",
     "text": "",
     "meaning": "Tema slobode prožima cijelo djelo kroz Norin sukob sa društvenim konvencijama. Ona se bori protiv uloge koju joj nameće patrijarhat i traži svoju autentičnost. Kroz njen razvoj, autor pokazuje kako lažna sloboda u braku vodi do unutrašnje praznine i gubitka identiteta. Njena konačna odluka da napusti porodicu predstavlja vrhunac ovog tematskog razvoja.",
     "page": 45,
     "context": "..."
   }`;
  }

  if (taskType === "contrast") {
    basePrompt += `

═══════════════════════════════════════════════════════════════════
🔥 CONTRAST EXTRACTION MODE 🔥
═══════════════════════════════════════════════════════════════════

You must identify CONTRASTS and OPPOSITIONS in the work.
User may ask: "kontrasti", "opreke", "suprotnosti", "razlike", "poređenje" - all mean the same.

1. ELEMENT FORMAT:
   ✅ "Kontrast: [A ↔ B]"
   ✅ Example: "Kontrast: Nora (sloboda) ↔ Torvald (kontrola)"
   ✅ Example: "Kontrast: Javni ugled ↔ Privatna moralnost"

2. WHAT TO LOOK FOR:
   - Opposing characters (personality, values, goals)
   - Moral dilemmas (duty vs. desire)
   - Symbolic contrasts (light vs. darkness)
   - Social contrasts (rich vs. poor, freedom vs. oppression)
   - Emotional contrasts (happiness vs. despair)
   - Setting contrasts (public vs. private spaces)

3. TEXT FIELD:
   ✅ Include a quote that illustrates the contrast
   ✅ Can combine quotes from both sides if needed

4. MEANING FIELD:
   ✅ Explain BOTH sides of the contrast
   ✅ Show how they interact or conflict
   ✅ Explain significance to the overall work
   ✅ Connect to themes and character development

5. EXAMPLE:
   {
     "element": "Kontrast: Javni ugled ↔ Privatna moralnost",
     "text": "Torvald kaže: 'U našoj kući mora biti sve kako treba.' Ali Nora skriva tajnu falsifikovanja potpisa.",
     "meaning": "Torvald je opsjednut javnim ugledom i društvenim konvencijama, dok Nora živi u tajnosti svog prijestupa. Ovaj kontrast razotkriva licemjerje buržoaskog društva gdje površina je važnija od istine. Njihov brak funkcionira samo dok se održava fasada.",
     "page": 23,
     "context": "..."
   }`;
  }

  if (taskType === "micro-detail") {
    basePrompt += `

═══════════════════════════════════════════════════════════════════
🔥 MICRO-DETAIL EXTRACTION MODE 🔥
═══════════════════════════════════════════════════════════════════

You are in MICRO-DETAIL mode for answering specific factual questions.

1. EXTRACT EVERY SINGLE MENTION
   ✅ Find ALL sentences that answer the question
   ✅ Do not summarize or generalize
   ✅ Extract the EXACT text as written
   ✅ If something appears multiple times, include all occurrences

2. ELEMENT FORMAT (CATEGORY: ${category || "general"}):
   ${getMicroDetailCategoryInstructions(category)}

3. BE EXHAUSTIVE
   ✅ If something is mentioned 10 times, extract all 10
   ✅ Include even small descriptive details
   ✅ Chronological order by page number

4. TEXT FIELD:
   ✅ Must contain the EXACT quote that answers the question
   ✅ Full sentence or passage from the book
   ✅ If answer is embedded in dialogue, include speaker

5. MEANING FIELD:
   ✅ Explain HOW this quote answers the specific question
   ✅ Be precise about what detail it provides
   ✅ Example: "Opisuje boju haljine koju Nora nosi u prvom činu"
   ✅ Provide broader context if relevant

6. IF ANSWER NOT FOUND:
   - If the detail is NOT mentioned in this chunk, return empty array
   - DO NOT invent or assume information`;
  }

  if (taskType === "characterization") {
    basePrompt += `

═══════════════════════════════════════════════════════════════════
🔥 CHARACTERIZATION MODE 🔥
═══════════════════════════════════════════════════════════════════

1. ELEMENT FORMAT:
   ✅ "Osobina: [adjective trait]"
   ✅ Example: "Osobina: Hladnoća"
   ✅ Example: "Osobina: Lukavstvo"
   ✅ Example: "Osobina: Naivnost"
   ❌ NEVER: "Osobina: Nora" (name, not trait)
   ❌ NEVER: "Osobina: Protagonist" (role, not trait)

2. TEXT FIELD:
   ✅ Quote that demonstrates this trait
   ✅ Can be dialogue or narrative description
   ✅ Show, don't just tell

3. MEANING FIELD:
   ✅ Explain how this quote shows the trait
   ✅ Connect to character development
   ✅ Provide psychological insight
   ✅ Explain significance in story

4. EXTRACT 5-10 TRAITS:
   - Personality traits
   - Moral qualities
   - Behavioral patterns
   - Psychological characteristics`;
  }

  basePrompt += `

═══════════════════════════════════════════════════════════════════
📋 OUTPUT FORMAT
═══════════════════════════════════════════════════════════════════

{
  "type": "${taskType}",
  "quotes": [
    {
      "id": "unique-id",
      "element": "BOSNIAN TITLE (never empty, never English)",
      "text": "EXACT quote from text (or empty for themes/ideas)",
      "meaning": "Detailed explanation with broader context",
      "page": number,
      "context": "FULL paragraph (3-8 sentences)"
    }
  ]
}

═══════════════════════════════════════════════════════════════════
CRITICAL REMINDERS:
═══════════════════════════════════════════════════════════════════

- ALL "element" fields MUST be in BOSNIAN
- NEVER use English words in "element"
- NEVER leave "element" empty
- For themes/ideas: "text" is empty, focus on "meaning" field with deep analysis
- For contrasts: identify oppositions and explain their significance
- For micro-details: extract EXACT text with full context
- For characterization: traits must be ADJECTIVES, not names
- NEVER invent information not in the text
- If answer not in chunk, return empty array

Return ONLY valid JSON. NO markdown. NO explanations.`;

  return basePrompt;
}

/* ---------- Get category-specific instructions ---------- */
function getMicroDetailCategoryInstructions(category) {
  const instructions = {
    location: `
   - element format: "Lokacija: <place name>"
   - Example: "Lokacija: Helmerin salon"
   - Extract mentions of rooms, buildings, streets, cities
   - Include descriptions of these locations`,
    
    object: `
   - element format: "Predmet: <object name>"
   - Example: "Predmet: Prsten koji je Nora dobila"
   - Extract mentions of items, tools, possessions
   - Include what characters do with these objects`,
    
    clothing: `
   - element format: "Odjeća: <description>"
   - Example: "Odjeća: Norina haljina u prvom činu"
   - Extract color, style, type of clothing
   - Include all appearance details`,
    
    food: `
   - element format: "Hrana/Piće: <item>"
   - Example: "Hrana/Piće: Šampanjac na zabavi"
   - Extract mentions of eating, drinking
   - Include context of meals and gatherings`,
    
    appearance: `
   - element format: "Detalj: <feature>"
   - Example: "Detalj: Florentinova kosa"
   - Extract physical descriptions
   - Include emotional state if described`,
    
    mention: `
   - element format: "Spomenjanje: <what is mentioned>"
   - Example: "Spomenjanje: Prvo spomenjanje Krogstada"
   - Extract first mentions or all mentions as requested
   - Note the context of each mention`,
    
    action: `
   - element format: "Radnja: <action>"
   - Example: "Radnja: Norin odlazak iz kuće"
   - Extract sequence of events
   - Include who does what and when`,
    
    dialogue: `
   - element format: "Dijalog: <speaker>"
   - Example: "Dijalog: Torvaldove riječi ljutnje"
   - Extract exact words spoken
   - Include speaker identification`,
    
    time: `
   - element format: "Vrijeme: <when>"
   - Example: "Vrijeme: Božićno jutro"
   - Extract temporal markers
   - Include time of day, season, duration`
  };
  
  return instructions[category] || `
   - element format: "Detalj: <description>"
   - Example: "Detalj: Starost Florentina"
   - Extract exactly what the question asks for`;
}

/* ---------- Generate follow-up questions ---------- */
function generateFollowUpQuestions(taskType, question, results, category = null) {
  const questions = [];

  if (taskType === "contrast") {
    questions.push(
      "Kako se ovaj kontrast razvija kroz djelo?",
      "Koji drugi kontrasti su prisutni u djelu?",
      "Kako kontrasti doprinose centralnoj temi?"
    );
  } else if (taskType === "theme" || taskType === "theme-idea") {
    questions.push(
      "Kako se ova tema razvija kroz priču?",
      "Koja scena najjasnije prikazuje ovu temu?",
      "Kako tema komunicira s razvojem likova?"
    );
  } else if (taskType === "idea") {
    questions.push(
      "Kako autor razvija ovu ideju kroz djelo?",
      "Koji likovi najbolje predstavljaju ovu ideju?",
      "Kako se ideja povezuje s društvenim kontekstom?"
    );
  } else if (taskType === "micro-detail") {
    if (category === "location") {
      questions.push(
        "Koje još lokacije se spomnuju u djelu?",
        "Kako se opis prostora mijenja kroz priču?",
        "Koja lokacija je najvažnija za radnju?"
      );
    } else if (category === "clothing") {
      questions.push(
        "Kako odjeća odražava karakter lika?",
        "Kako se stil oblačenja mijenja kroz priču?",
        "Šta simbolizira ovaj dio garderobe?"
      );
    } else if (category === "mention") {
      questions.push(
        "Kako se učestalost spomnjevanja mijenja kroz djelo?",
        "U kojim kontekstima se najčešće spomnuje?",
        "Koja spomnjevanja su najznačajnija?"
      );
    } else {
      questions.push(
        "Kako ovaj detalj doprinosi karakterizaciji?",
        "Kako se ovaj element mijenja kroz priču?",
        "Koja još slična mjesta postoje u djelu?"
      );
    }
  } else if (taskType === "characterization") {
    const charName = extractCharacterName(question) || "lika";
    questions.push(
      `Kako se ${charName} mijenja kroz priču?`,
      `Koje odluke ${charName} najviše utiču na zaplet?`,
      `Kako drugi likovi reaguju na ${charName}?`
    );
  } else if (taskType === "events") {
    questions.push(
      "Koji događaj predstavlja prekretnicu u priči?",
      "Kako rani događaji najavljuju završetak?",
      "Koja odluka ima najveće posljedice?"
    );
  } else {
    questions.push(
      "Koji citat najbolje predstavlja djelo?",
      "Kako se filozofske ideje izražavaju kroz dijaloge?",
      "Koja scena najjasnije prikazuje sukob?"
    );
  }

  return questions.slice(0, 3);
}

/* ---------- Deduplicate quotes ---------- */
function deduplicateQuotes(allQuotes) {
  const seen = new Set();
  const unique = [];

  for (const quote of allQuotes) {
    const textKey = quote.text.toLowerCase().trim().substring(0, 100);
    const key = `${textKey}-${quote.page}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(quote);
    }
  }

  return unique;
}

/* ---------- Process single chunk ---------- */
async function processChunk(chunk, taskType, question, totalPages, characterName, category) {
  const systemPrompt = getSystemPrompt(totalPages, chunk, taskType, category);
  
  let userPrompt = `taskType: ${taskType}
userQuestion: ${question}`;

  if (characterName) {
    userPrompt += `\nCHARACTER TO ANALYZE: ${characterName}
IMPORTANT: Extract traits ONLY for ${characterName}. Ignore other characters.`;
  }

  if (taskType === "micro-detail") {
    userPrompt += `\n\nMICRO-DETAIL CATEGORY: ${category}
IMPORTANT: Extract EVERY sentence that answers the user's question. Be exhaustive, not selective.`;
  }

  userPrompt += `\n\nPDF TEXT (CHUNK):
${chunk.text}`;

  try {
    const response = await axios.post(
      "https://api.together.ai/v1/chat/completions",
      {
        model: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.05,
        max_tokens: MAX_TOKENS_PER_REQUEST
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.TOGETHER_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    let cleaned = response.data.choices[0].message.content.trim();

    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/```json\n?|```\n?/g, "");
    }

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) cleaned = jsonMatch[0];

    const aiJson = JSON.parse(cleaned);
    return aiJson.quotes || [];
  } catch (error) {
    console.error(`Error processing chunk ${chunk.startPage}-${chunk.endPage}:`, error.message);
    return [];
  }
}

/* ---------- Process chunks in parallel ---------- */
async function processAllChunks(chunks, taskType, question, characterName, category) {
  const totalPages = chunks[chunks.length - 1].endPage;
  const allQuotes = [];

  for (let i = 0; i < chunks.length; i += MAX_CONCURRENT_REQUESTS) {
    const batch = chunks.slice(i, i + MAX_CONCURRENT_REQUESTS);
    const results = await Promise.all(
      batch.map(chunk =>
        processChunk(chunk, taskType, question, totalPages, characterName, category)
      )
    );
    results.forEach(r => allQuotes.push(...r));
  }

  return deduplicateQuotes(allQuotes).sort((a, b) => (a.page || 0) - (b.page || 0));
}

/* ---------- Format final response ---------- */
function formatFinalResponse(taskType, quotes, question, countMeta = null, category = null) {
  const formattedQuotes = quotes.map((item, idx) => ({
    id: item.id || `q-${Date.now()}-${idx}`,
    text: item.text || "",
    page: typeof item.page === "number" ? item.page : 0,
    context: item.context || "",
    element: item.element || null,
    meaning: item.meaning || null
  }));

  const followUp = generateFollowUpQuestions(taskType, question, formattedQuotes, category);

  const response = {
    type: taskType,
    quotes: formattedQuotes,
    followUp
  };

  if (countMeta) response.meta = countMeta;

  return response;
}

/* ---------- MAIN ENDPOINT ---------- */
app.post("/ask-pdf", upload.single("file"), async (req, res) => {
  try {
    const { question } = req.body;
    if (!req.file) return res.status(400).json({ error: "Nema PDF fajla." });
    if (!question) return res.status(400).json({ error: "Nema pitanja." });

    const normalizedQuestion = question.trim();
    const taskType = detectQuestionType(normalizedQuestion);
    const characterName = taskType === "characterization"
      ? extractCharacterName(normalizedQuestion)
      : null;
    const category = taskType === "micro-detail"
      ? detectMicroDetailCategory(normalizedQuestion)
      : null;

    const buffer = new Uint8Array(fs.readFileSync(req.file.path));
    const pages = await extractPages(buffer);
    fs.unlink(req.file.path, () => {});

    let chunks;
    if (taskType === "micro-detail") {
      const sentenceIndex = createSentenceIndex(pages);
      const filteredSentences = preFilterSentences(sentenceIndex, normalizedQuestion);
      chunks = createMicroDetailChunks(pages, filteredSentences);
    } else {
      chunks = createChunks(pages);
    }

    const quotes = await processAllChunks(
      chunks,
      taskType,
      normalizedQuestion,
      characterName,
      category
    );

    return res.json(
      formatFinalResponse(taskType, quotes, normalizedQuestion, null, category)
    );
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Greška pri obradi PDF-a ili AI odgovora."
    });
  }
});

/* ---------- RENDER-SAFE PORT ---------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`✅ Server radi na portu ${PORT}`)
);
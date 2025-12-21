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
    'http://localhost:5174',
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
/* ---------- CHUNK SIZE CONFIGURATION ---------- */
const PAGES_PER_CHUNK = 6;  // ✅ SMANJENO (bilo 8)
const MAX_TOKENS_PER_REQUEST = 1500;  // ✅ SMANJENO (bilo 2000)
const MAX_CONCURRENT_REQUESTS = 2;  // ✅ KRITIČNO - samo 2 odjednom!

/* ---------- RETRY HELPER WITH EXPONENTIAL BACKOFF ---------- */
async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retryWithBackoff(fn, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // Ako je 429 (rate limit), čekaj i pokušaj ponovo
      if (error.response?.status === 429) {
        const retryAfter = parseInt(error.response.headers['retry-after']) || 30;
        console.log(`Rate limit hit, waiting ${retryAfter}s before retry ${attempt + 1}/${maxRetries}...`);
        
        if (attempt < maxRetries - 1) {
          await sleep((retryAfter + 5) * 1000); // Dodaj 5s buffer
          continue;
        }
      }
      throw error;
    }
  }
}

/* ---------- Process single chunk with retry ---------- */
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

  console.log('=== GROQ REQUEST ===');
  console.log('Chunk pages:', chunk.startPage, '-', chunk.endPage);
  console.log('Task type:', taskType);
  console.log('Prompt lengths:', {
    system: systemPrompt.length,
    user: userPrompt.length,
    totalEstimate: Math.ceil((systemPrompt.length + userPrompt.length) / 4)
  });

  const makeRequest = async () => {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.05,
        max_tokens: MAX_TOKENS_PER_REQUEST
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );
    return response;
  };

  try {
    // ✅ Retry sa backoff-om
    const response = await retryWithBackoff(makeRequest, 3);

    let cleaned = response.data.choices[0].message.content.trim();

    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/```json\n?|```\n?/g, "");
    }

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) cleaned = jsonMatch[0];

    const aiJson = JSON.parse(cleaned);
    return aiJson.quotes || [];
  } catch (error) {
    console.error('=== GROQ ERROR ===');
    console.error(`Chunk ${chunk.startPage}-${chunk.endPage}:`, error.message);
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    
    return [];
  }
}

/* ---------- Process chunks with delay between batches ---------- */
async function processAllChunks(chunks, taskType, question, characterName, category) {
  const totalPages = chunks[chunks.length - 1].endPage;
  const allQuotes = [];

  for (let i = 0; i < chunks.length; i += MAX_CONCURRENT_REQUESTS) {
    const batch = chunks.slice(i, i + MAX_CONCURRENT_REQUESTS);
    
    console.log(`Processing batch ${Math.floor(i / MAX_CONCURRENT_REQUESTS) + 1}/${Math.ceil(chunks.length / MAX_CONCURRENT_REQUESTS)}`);
    
    const results = await Promise.all(
      batch.map(chunk =>
        processChunk(chunk, taskType, question, totalPages, characterName, category)
      )
    );
    
    results.forEach(r => allQuotes.push(...r));
    
    // ✅ Pauza između batch-eva da se rate limit ne premaši
    if (i + MAX_CONCURRENT_REQUESTS < chunks.length) {
      console.log('Waiting 10s before next batch to respect rate limits...');
      await sleep(10000); // 10 sekundi pauze
    }
  }

  return deduplicateQuotes(allQuotes).sort((a, b) => (a.page || 0) - (b.page || 0));
}

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
    "spominje", "prvi put", "pojavljuje se", "navodi se",
    "kada se spominje", "gdje se spominje", "koliko puta"
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
  /\bmotivi\b/i,
  /\bmotiv\b/i,
  /ponavljajući\s+motiv/i,
  /ponavljaju[ćc]i\s+element/i,
  /koji\s+se\s+motiv/i,
  /navedi\s+motivi/i,
  /izdvoji\s+motivi/i,
  /motivi\s+u\s+djelu/i
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
    /koliko\s+se\s+spominje/i
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
/* ---------- ENHANCED SYSTEM PROMPT ---------- */
function getSystemPrompt(totalPages, chunkInfo, taskType, category = null) {
  let basePrompt = `QuoteQuest AI - ultra-precise literature analysis engine.

CHUNK CONTEXT: Analyzing pages ${chunkInfo.startPage}-${chunkInfo.endPage} (total book: ${totalPages} pages)

CORE RULES:
1. BOSNIAN TITLES MANDATORY
   - "element" field MUST be Bosnian
   - Examples: "Osobina: Hrabrost", "Tema: Sloboda", "Kontrast: Nora ↔ Torvald"
   - NEVER English: "Trait", "Theme", "Contrast"
   - NEVER empty element field

2. EXTRACT ONLY FROM PROVIDED TEXT
   - Use EXACT page numbers from "STRANICA X:" markers
   - DO NOT invent or hallucinate content
   - If information NOT in this chunk, DO NOT include it

3. NO DUPLICATE QUOTES
   - Each "text" field MUST be unique
   - Never use same sentence twice
   - No paraphrased versions of same content

4. ACCURATE CONTEXT
   - Extract 3-8 sentences surrounding the quote
   - Include sentences BEFORE and AFTER
   - Must be ACTUAL paragraph from book

5. UNDERSTAND QUESTION VARIATIONS
   - User may ask same thing in different ways
   - Treat synonyms as same intent
   - Examples: "kontrasti", "opreke", "suprotnosti" = all mean contrasts
`;

  if (taskType === "theme" || taskType === "idea" || taskType === "theme-idea") {
    basePrompt += `
THEME/IDEA EXTRACTION MODE:

ELEMENT FORMAT:
- Theme: "Tema: [name of theme]"
- Idea: "Ideja: [name of idea]"
- Example: "Tema: Sloboda i društveni pritisak"
- Example: "Ideja: Sukob individualnosti i društvenih normi"

TEXT FIELD:
- For themes/ideas: text field should be EMPTY ""
- Main content goes in "meaning" field

MEANING FIELD (CRITICAL):
- Start with SHORT formulation (1 sentence)
- Then detailed explanation (3-5 sentences)
- Explain ESSENCE of theme/idea
- Provide BROADER CONTEXT of how it manifests
- Explain SIGNIFICANCE to overall narrative
- Connect to CHARACTER DEVELOPMENT or PLOT
- DO NOT just quote - ANALYZE and EXPLAIN

Example:
{
  "element": "Tema: Sloboda",
  "text": "",
  "meaning": "Tema slobode prožima cijelo djelo kroz Norin sukob sa društvenim konvencijama. Ona se bori protiv uloge koju joj nameće patrijarhat i traži svoju autentičnost. Kroz njen razvoj, autor pokazuje kako lažna sloboda u braku vodi do unutrašnje praznine i gubitka identiteta. Njena konačna odluka da napusti porodicu predstavlja vrhunac ovog tematskog razvoja.",
  "page": 45,
  "context": "..."
}
`;
  }
  // ✅ DODAJ OVO U getSystemPrompt funkciju, POSLIJE contrast bloka, PRIJE micro-detail bloka

  if (taskType === "motif") {
    basePrompt += `
MOTIF EXTRACTION MODE:

ELEMENT FORMAT:
- "Motiv: [name of motif]"
- Example: "Motiv: Lutka"
- Example: "Motiv: Novac i dug"
- Example: "Motiv: Ples tarantele"

WHAT IS A MOTIF:
- Recurring element (object, action, phrase, image) throughout the work
- Appears multiple times with symbolic significance
- Contributes to theme or atmosphere
- Can be concrete (object) or abstract (idea)

WHAT TO LOOK FOR:
- Objects mentioned repeatedly (letters, doors, tree, costume)
- Actions repeated by characters (lying, dancing, borrowing)
- Phrases or words appearing multiple times
- Images or descriptions that recur
- Symbolic elements with layered meaning

TEXT FIELD:
- Include 1-2 representative quotes showing the motif
- Choose most significant occurrences
- Can combine quotes from different scenes if illustrative

MEANING FIELD:
- Explain WHAT the motif is (first mention what it literally is)
- Describe HOW it recurs throughout the work
- Analyze WHY it's significant (symbolic meaning)
- Connect to themes and character development
- Explain its function in the overall narrative

Example:
{
  "element": "Motiv: Lutka",
  "text": "Torvald kaže: 'Moja mala vjeverica.' Kasnije Nora odgovara: 'Nisam više tvoja lutka.'",
  "meaning": "Motiv lutke se provlači kroz cijelo djelo kroz Torvaldove nadimke za Noru (vjeverica, ptica, lutka). On je tretira kao igračku bez svoje volje. Ovaj motiv simbolizuje Norin nedostatak autonomije u braku i patrijarhalnu kontrolu. U kulminaciji, Nora odbacuje ulogu lutke, što predstavlja njen duhovni preporod i borbu za identitet.",
  "page": 12,
  "context": "..."
}

IMPORTANT:
- Extract 3-8 major motifs
- Focus on RECURRING elements, not one-time occurrences
- Each motif must appear at least 2-3 times in the work
- Explain both literal and symbolic significance
`;
  }

  if (taskType === "contrast") {
    basePrompt += `
CONTRAST EXTRACTION MODE:

ELEMENT FORMAT:
- "Kontrast: [A ↔ B]"
- Example: "Kontrast: Nora (sloboda) ↔ Torvald (kontrola)"
- Example: "Kontrast: Javni ugled ↔ Privatna moralnost"

WHAT TO LOOK FOR:
- Opposing characters (personality, values, goals)
- Moral dilemmas (duty vs. desire)
- Symbolic contrasts (light vs. darkness)
- Social contrasts (rich vs. poor, freedom vs. oppression)
- Emotional contrasts (happiness vs. despair)
- Setting contrasts (public vs. private spaces)

TEXT FIELD:
- Include quote that illustrates the contrast
- Can combine quotes from both sides if needed

MEANING FIELD:
- Explain BOTH sides of the contrast
- Show how they interact or conflict
- Explain significance to overall work
- Connect to themes and character development

Example:
{
  "element": "Kontrast: Javni ugled ↔ Privatna moralnost",
  "text": "Torvald kaže: 'U našoj kući mora biti sve kako treba.' Ali Nora skriva tajnu falsifikovanja potpisa.",
  "meaning": "Torvald je opsjednut javnim ugledom i društvenim konvencijama, dok Nora živi u tajnosti svog prijestupa. Ovaj kontrast razotkriva licemjerje buržoaskog društva gdje površina je važnija od istine. Njihov brak funkcionira samo dok se održava fasada.",
  "page": 23,
  "context": "..."
}
`;
  }

  if (taskType === "micro-detail") {
    basePrompt += `
MICRO-DETAIL EXTRACTION MODE (Category: ${category || "general"}):

EXHAUSTIVE EXTRACTION:
- Find ALL sentences that answer the question
- Do NOT summarize or generalize
- Extract EXACT text as written
- If something appears 10 times, include all 10 occurrences
- Chronological order by page number

${getMicroDetailCategoryInstructions(category)}

TEXT FIELD:
- Must contain EXACT quote answering the question
- Full sentence or passage from book
- If embedded in dialogue, include speaker

MEANING FIELD:
- Explain HOW this quote answers the specific question
- Be precise about what detail it provides
- Example: "Opisuje boju haljine koju Nora nosi u prvom činu"
- Provide broader context if relevant

IF ANSWER NOT FOUND:
- If detail NOT mentioned in this chunk, return empty array
- DO NOT invent or assume information
`;
  }

  if (taskType === "characterization") {
    basePrompt += `
CHARACTERIZATION MODE:

ELEMENT FORMAT:
- "Osobina: [adjective trait]"
- Example: "Osobina: Hladnoća"
- Example: "Osobina: Lukavstvo"
- Example: "Osobina: Naivnost"
- NEVER: "Osobina: Nora" (name, not trait)
- NEVER: "Osobina: Protagonist" (role, not trait)

TEXT FIELD:
- Quote that demonstrates this trait
- Can be dialogue or narrative description
- Show, don't just tell

MEANING FIELD:
- Explain how this quote shows the trait
- Connect to character development
- Provide psychological insight
- Explain significance in story

EXTRACT 5-10 TRAITS:
- Personality traits
- Moral qualities
- Behavioral patterns
- Psychological characteristics
`;
  }

  basePrompt += `
OUTPUT FORMAT:
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

FINAL REMINDERS:
- ALL "element" fields MUST be in BOSNIAN
- NEVER use English words in "element"
- NEVER leave "element" empty
- For themes/ideas: "text" is empty, focus on "meaning" field
- For contrasts: identify oppositions and explain significance
- For micro-details: extract EXACT text with full context
- For characterization: traits must be ADJECTIVES, not names
- NEVER invent information not in text
- If answer not in chunk, return empty array

Return ONLY valid JSON. NO markdown. NO explanations.`;

  return basePrompt;
}

/* ---------- Get category-specific instructions ---------- */
function getMicroDetailCategoryInstructions(category) {
  const instructions = {
    location: `
ELEMENT FORMAT: "Lokacija: <place name>"
Example: "Lokacija: Helmerin salon"
Extract mentions of: rooms, buildings, streets, cities
Include descriptions of these locations`,
    
    object: `
ELEMENT FORMAT: "Predmet: <object name>"
Example: "Predmet: Prsten koji je Nora dobila"
Extract mentions of: items, tools, possessions
Include what characters do with these objects`,
    
    clothing: `
ELEMENT FORMAT: "Odjeća: <description>"
Example: "Odjeća: Norina haljina u prvom činu"
Extract: color, style, type of clothing
Include all appearance details`,
    
    food: `
ELEMENT FORMAT: "Hrana/Piće: <item>"
Example: "Hrana/Piće: Šampanjac na zabavi"
Extract mentions of: eating, drinking
Include context of meals and gatherings`,
    
    appearance: `
ELEMENT FORMAT: "Detalj: <feature>"
Example: "Detalj: Florentinova kosa"
Extract: physical descriptions
Include emotional state if described`,
    
    mention: `
ELEMENT FORMAT: "Spominjanje: <what is mentioned>"
Example: "Spominjanje: Prvo spominjanje Krogstada"
Extract: first mentions or all mentions as requested
Note the context of each mention`,
    
    action: `
ELEMENT FORMAT: "Radnja: <action>"
Example: "Radnja: Norin odlazak iz kuće"
Extract: sequence of events
Include who does what and when`,
    
    dialogue: `
ELEMENT FORMAT: "Dijalog: <speaker>"
Example: "Dijalog: Torvaldove riječi ljutnje"
Extract: exact words spoken
Include speaker identification`,
    
    time: `
ELEMENT FORMAT: "Vrijeme: <when>"
Example: "Vrijeme: Božićno jutro"
Extract: temporal markers
Include time of day, season, duration`
  };
  
  return instructions[category] || `
ELEMENT FORMAT: "Detalj: <description>"
Example: "Detalj: Starost Florentina"
Extract exactly what the question asks for`;
}

/* ---------- Generate follow-up questions ---------- */
/* ---------- Generate follow-up questions ---------- */
function generateFollowUpQuestions(taskType, question, results, category = null) {
  const questions = [];

  if (taskType === "characterization") {
    const charName = extractCharacterName(question) || "lika";
    questions.push(
      `Kako se ${charName} mijenja kroz priču?`,
      `Koje odluke ${charName} najviše utiču na zaplet?`,
      `Kako drugi likovi reaguju na ${charName}?`
    );
  } else if (taskType === "contrast") {
    questions.push(
      "Kako se ovaj kontrast razvija kroz djelo?",
      "Koji drugi kontrasti su prisutni u djelu?",
      "Kako kontrasti doprinose centralnoj temi?"
    );
  } else if (taskType === "motif") {
    questions.push(
      "Kako se ovaj motiv razvija kroz djelo?",
      "Koji drugi motivi su prisutni u djelu?",
      "Kakvu simboliku ovaj motiv nosi?"
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
  } else if (taskType === "symbolism") {
    questions.push(
      "Koji još simboli postoje u djelu?",
      "Kako se simbolika povezuje s temama?",
      "Kako autor koristi simbole za dublju poruku?"
    );
  } else if (taskType === "relation") {
    questions.push(
      "Kako se ovaj odnos razvija kroz priču?",
      "Koji događaji najviše utiču na odnos?",
      "Kako odnos odražava šire teme?"
    );
  } else if (taskType === "micro-detail") {
    if (category === "location") {
      questions.push(
        "Koje još lokacije se spominju u djelu?",
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
        "Kako se učestalost spominjanja mijenja kroz djelo?",
        "U kojim kontekstima se najčešće spominje?",
        "Koja spominjanja su najznačajnija?"
      );
    } else {
      questions.push(
        "Kako ovaj detalj doprinosi karakterizaciji?",
        "Kako se ovaj element mijenja kroz priču?",
        "Koja još slična mjesta postoje u djelu?"
      );
    }
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

  // ✅ DEBUGGING - vidi šta šalješ
  console.log('=== GROQ REQUEST ===');
  console.log('Chunk pages:', chunk.startPage, '-', chunk.endPage);
  console.log('Prompt lengths:', {
    system: systemPrompt.length,
    user: userPrompt.length,
    totalEstimate: Math.ceil((systemPrompt.length + userPrompt.length) / 4)
  });

  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.05,
        max_tokens: MAX_TOKENS_PER_REQUEST
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
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

    // ✅ DETALJNO LOGOVANJE

    console.error('=== GROQ ERROR ===');
    console.error(`Chunk ${chunk.startPage}-${chunk.endPage}:`, error.message);

    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
      console.error('Headers:', error.response.headers);
    }

    if (error.config) {
      console.error('Request URL:', error.config.url);
      console.error('API Key exists:', !!error.config.headers?.Authorization);
      console.error('API Key preview:', error.config.headers?.Authorization?.substring(0, 25) + '...');
    }

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

/**
 * Deterministische Vorprüfung von Nutzertext — **vor** dem Modellaufruf.
 *
 * Ziel und Grenzen:
 *
 * - Sie erkennt die *mechanischen* Angriffe: Anweisungs-Overrides,
 *   Prompt-Extraktion, Chat-Template-Marker, kodierte Payloads,
 *   Secret-Fishing. Solche Formulierungen kommen in echten Bürgerfragen
 *   praktisch nicht vor, deshalb ist die Falsch-Positiv-Rate niedrig.
 * - Sie erkennt **kein** „Thema verfehlt". Ob „schreib mir ein Gedicht über
 *   Katzen" zum Auftrag gehört, entscheidet bewusst das Modell über den
 *   System-Prompt: eine Regex-Themenliste würde legitime Fragen abweisen
 *   („Gibt es im Rathaus einen Übersetzungsdienst?") und ist leicht zu
 *   umgehen. Die Heuristik ist also die *erste*, nicht die einzige Schicht.
 * - Sie ist bewusst kein LLM-Klassifikator: dieser Filter kostet nichts,
 *   braucht keine Netzverbindung und verhält sich bei jedem Provider gleich
 *   (Issue #12). Ein Treffer bedeutet: gar kein Modellaufruf, also 0 Token.
 *
 * Alle Muster arbeiten auf dem bereits normalisierten Text aus
 * `sanitize.ts` — sonst ließen sich die Schlüsselwörter mit unsichtbaren
 * Zeichen zerlegen.
 */

/** Verben, mit denen jemand Regeln außer Kraft setzen will. */
const OVERRIDE_VERB =
  /\b(ignorier\w*|ignore|ignoring|disregard|vergiss|vergesse|überschreib\w*|missachte|umgeh\w*|bypass|forget)\b/;

/** Substantive, die auf die Regeln des Systems zeigen. */
const INSTRUCTION_NOUN =
  /\b(anweisung\w*|instruktion\w*|instructions?|prompts?|regeln|rules|vorgaben|richtlinien|guidelines|systemtext|beschränkungen|restrictions)\b/;

/**
 * Bezugswort, das die Regeln als *die des Systems* ausweist.
 *
 * Ohne diese dritte Bedingung würde „Kann ich die Regeln für die Anmeldung
 * umgehen?" als Angriff gelten — eine völlig legitime Bürgerfrage.
 */
const SYSTEM_SCOPE =
  /\b(deine[nr]?|dein|alle[nr]?|obige[nr]?|vorherige[nr]?|bisherige[nr]?|your|all|previous|above|prior|initial|system)\b/;

/** Verben, mit denen jemand Inhalte herausgegeben haben will. */
const REVEAL_VERB =
  /\b(zeig\w*|nenn\w*|verrat\w*|gib|ausgeben|ausgabe|wiederhol\w*|wiedergeb\w*|nachplapper\w*|repeat|print|reveal|show|output|dump|leak|kopier\w*|copy|list|liste|übersetz\w*|translate)\b/;

/** Bezeichnungen für den System-Prompt bzw. die Konfiguration. */
const PROMPT_NOUN =
  /(system[- ]?prompt|systemanweisung\w*|system[- ]?nachricht|system[- ]?message|deine anweisungen|deine regeln|your instructions|your rules|initial (prompt|instructions)|erste anweisung|entwickler(nachricht|anweisung)|developer (message|prompt))/;

/** Verweise auf „alles, was vor dieser Nachricht steht". */
const ABOVE_NOUN =
  /(oberhalb|obige\w*|above|davor steht|vorherige[nr]? (text|nachricht|nachrichten)|bisherige (konversation|unterhaltung)|everything before|alles vor(her|))/;

/** Rollen-/Modus-Umschaltung. */
const PERSONA_HIJACK =
  /\b(dan[- ]?mod\w*|jailbreak\w*|developer mode|entwicklermodus|sudo mode|do anything now|uncensored|unzensiert|ohne (jede[n]? )?(einschränkung\w*|filter|zensur|regeln))\b/;

/** „Ab jetzt …" — nur zusammen mit einer Verhaltensanweisung ein Treffer. */
const FROM_NOW_ON = /\b(ab (jetzt|sofort|nun)|von (jetzt|nun) an|from now on)\b/;
const BEHAVIOUR_VERB =
  /\b(bist du|du bist|you are|you must|antworte|answer only|verhalte|handle|agier\w*|spiel\w*|act|behave|befolg\w*|gehorch\w*)\b/;

/** Angekündigte „neue" Regeln. */
const NEW_RULES =
  /(neue (system)?(anweisung\w*|regeln)|new (system )?(instructions|rules|prompt)|aktualisierte anweisung\w*|updated instructions|override the (system|instructions))/;

/**
 * Chat-Template-Marker verschiedener Modellfamilien.
 *
 * In einer Bürgerfrage gibt es dafür keinen legitimen Grund; sie dienen dazu,
 * eine fremde System- oder Assistenz-Rolle in den Text zu schmuggeln. Die
 * Liste deckt bewusst mehrere Provider ab (Issue #12).
 */
const TEMPLATE_MARKER =
  /(<\|?im_(start|end)\|?>|<\|(system|user|assistant|end_of_turn|eot_id|start_header_id)\|>|\[\/?inst\]|\[\/?sys\]|<<sys>>|<\/?s>)/;

/**
 * Vorgetäuschter Fremdquellen-Marker (Issue #16, `src/lib/guard/external.ts`).
 *
 * Der `<fremdquelle>`-Tag kommt aus dem Server, wenn ein Tool eingebundene
 * Inhalte in den Prompt packt — er hat in Nutzertext keinen legitimen Grund.
 * Ein Angreifer, der ihn selbst mitschickt, versucht, eigenen Text als
 * vertrauenswürdige externe Daten auszugeben.
 */
const FOREIGN_SOURCE_MARKER = /<\/?fremdquelle\b/i;

/** Lange Zeichenketten ohne Wortcharakter — typisch für Base64-Payloads. */
const BASE64_BLOB = /[A-Za-z0-9+/]{80,}={0,2}/;

/** Gehäufte Unicode-/Hex-Escapes — Text, der erst im Modell „aufgeht". */
const ESCAPE_SEQUENCE = /(\\u[0-9a-fA-F]{4}|\\x[0-9a-fA-F]{2}|&#x?[0-9a-fA-F]{2,6};)/g;

/** Hinweise auf Secrets und Serverinterna. */
const SECRET_NOUN =
  /(api[- ]?key|api[- ]?schlüssel|anthropic_api_key|mistral_api_key|access[- ]?token|process\.env|umgebungsvariable\w*|environment variable\w*|\.env(\.local|\.production)?\b)/;

const ASK_VERB = /\b(welche\w*|which|what|wie lautet|nenne|gib mir|zeig\w*|verrat\w*)\b/;

type Rule = {
  /** Kurzname fürs Log — landet nie in der Antwort an den Nutzer. */
  name: string;
  test: (text: string) => boolean;
};

const RULES: readonly Rule[] = [
  {
    name: "instruction-override",
    test: (t) =>
      OVERRIDE_VERB.test(t) && INSTRUCTION_NOUN.test(t) && SYSTEM_SCOPE.test(t),
  },
  {
    name: "prompt-extraction",
    test: (t) => PROMPT_NOUN.test(t) && REVEAL_VERB.test(t),
  },
  {
    name: "context-dump",
    test: (t) => ABOVE_NOUN.test(t) && REVEAL_VERB.test(t),
  },
  { name: "persona-hijack", test: (t) => PERSONA_HIJACK.test(t) },
  {
    name: "behaviour-reset",
    test: (t) => FROM_NOW_ON.test(t) && BEHAVIOUR_VERB.test(t),
  },
  { name: "new-rules", test: (t) => NEW_RULES.test(t) },
  { name: "template-marker", test: (t) => TEMPLATE_MARKER.test(t) },
  { name: "forged-source-marker", test: (t) => FOREIGN_SOURCE_MARKER.test(t) },
  { name: "encoded-payload", test: (t) => BASE64_BLOB.test(t) },
  {
    name: "escape-flood",
    test: (t) => (t.match(ESCAPE_SEQUENCE) ?? []).length >= 8,
  },
  {
    name: "secret-fishing",
    test: (t) => SECRET_NOUN.test(t) && (ASK_VERB.test(t) || REVEAL_VERB.test(t)),
  },
];

export type ScreenResult = {
  /** Treffer -> kein Modellaufruf, sondern die feste Ablehnung. */
  blocked: boolean;
  /** Namen der zutreffenden Regeln (für Logs und den Red-Team-Report). */
  rules: string[];
};

export function screenUserText(text: string): ScreenResult {
  const haystack = text.toLowerCase();
  const rules = RULES.filter((rule) => rule.test(haystack)).map(
    (rule) => rule.name,
  );
  return { blocked: rules.length > 0, rules };
}

/**
 * Ab wie vielen entfernten unsichtbaren Zeichen eine Nachricht als Angriff
 * gilt. Einzelne Soft Hyphens kommen aus Word oder PDF-Kopien; zwanzig
 * unsichtbare Zeichen sind kein Zufall mehr.
 */
export const HIDDEN_CHAR_THRESHOLD = 20;

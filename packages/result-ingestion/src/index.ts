import {
  normalizedLotteryResultSchema,
  lotofacilCatalogSchema,
  type LotofacilCatalog,
  type NormalizedLotteryResult,
} from "@boloes/lottery-contracts";

export const LOTOFACIL_CAIXA_PAGE_URL = "https://loterias.caixa.gov.br/Paginas/Lotofacil.aspx";
export const LOTOFACIL_CAIXA_PAGE_PARSER_VERSION = "lotofacil-caixa-page/1";
export const LOTOFACIL_CAIXA_RESULT_URL = "https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil";
export const LOTOFACIL_CAIXA_RESULT_PARSER_VERSION = "lotofacil-caixa-result-json/1";
export const LOTOFACIL_CAIXA_CATALOG_PARSER_VERSION = "lotofacil-caixa-catalog/1";
export const LOTOFACIL_CAIXA_PAGE_TIMEOUT_MS = 10_000;

export type PageFetcher = (input: string, init?: RequestInit) => Promise<Response>;

async function fetchCaixaText(
  url: string,
  accept: string,
  fetcher: PageFetcher,
  timeoutMs: number,
): Promise<string> {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("CAIXA request timeout must be a positive integer in milliseconds.");
  }
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutFailure = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new Error(`CAIXA request timed out after ${timeoutMs} ms.`));
    }, timeoutMs);
  });
  try {
    const response = await Promise.race([
      fetcher(url, { headers: { accept }, signal: controller.signal }),
      timeoutFailure,
    ]);
    if (!response.ok) throw new Error(`CAIXA request returned HTTP ${response.status}.`);
    return await Promise.race([response.text(), timeoutFailure]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

/** Retrieves only the documented public page; callers own persistence and fallback. */
export async function fetchLotofacilCaixaPage(
  fetcher: PageFetcher = fetch,
  timeoutMs = LOTOFACIL_CAIXA_PAGE_TIMEOUT_MS,
): Promise<string> {
  return fetchCaixaText(LOTOFACIL_CAIXA_PAGE_URL, "text/html", fetcher, timeoutMs);
}

/** Retrieves only the product-authorized latest-result endpoint as raw JSON text. */
export async function fetchLotofacilCaixaResult(
  fetcher: PageFetcher = fetch,
  timeoutMs = LOTOFACIL_CAIXA_PAGE_TIMEOUT_MS,
): Promise<string> {
  return fetchCaixaText(LOTOFACIL_CAIXA_RESULT_URL, "application/json", fetcher, timeoutMs);
}

function asPageText(content: string): string {
  return content
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/t[dh]>/gi, "|")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\r/g, "")
    .replace(/\n[ \t]*\n/g, "\n")
    .trim();
}

function requiredMatch(pattern: RegExp, content: string, message: string): RegExpMatchArray {
  const match = content.match(pattern);
  if (!match) throw new Error(message);
  return match;
}

function isoDate(date: string): string {
  const match = requiredMatch(/^(\d{2})\/(\d{2})\/(\d{4})$/, date, "Data de apuração inválida.");
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function cents(value: string): number {
  return Math.round(Number(value.replace(/\./g, "").replace(",", ".")) * 100);
}

function optionalNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

/** Parses only the versioned contract from the authorized latest-result endpoint. */
export function parseLotofacilCaixaResultPayload(payload: unknown): NormalizedLotteryResult {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new Error("Payload JSON da Lotofácil deve ser um objeto.");
  }
  const source = payload as Record<string, unknown>;
  if (source.tipoJogo !== "LOTOFACIL") {
    throw new Error("Payload JSON não pertence à Lotofácil.");
  }
  if (!Number.isSafeInteger(source.numero) || Number(source.numero) <= 0) {
    throw new Error("Número do concurso deve ser um inteiro positivo.");
  }
  if (typeof source.dataApuracao !== "string") {
    throw new Error("Data de apuração ausente ou inválida.");
  }
  if (!Array.isArray(source.listaDezenas) || source.listaDezenas.length !== 15) {
    throw new Error("Resultado Lotofácil deve conter exatamente 15 dezenas.");
  }
  const drawnNumbers = source.listaDezenas.map((value) => {
    if ((typeof value !== "string" && typeof value !== "number") || String(value).trim() === "") {
      throw new Error("Resultado Lotofácil contém dezena inválida.");
    }
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1 || number > 25) {
      throw new Error("Resultado Lotofácil contém dezena fora do intervalo 01–25.");
    }
    return number;
  });
  if (new Set(drawnNumbers).size !== drawnNumbers.length) {
    throw new Error("Resultado Lotofácil contém dezenas repetidas.");
  }

  return normalizedLotteryResultSchema.parse({
    lotteryId: "lotofacil",
    contestNumber: source.numero,
    drawDate: isoDate(source.dataApuracao),
    drawnNumbers,
    sourceUrl: LOTOFACIL_CAIXA_RESULT_URL,
    parserVersion: LOTOFACIL_CAIXA_RESULT_PARSER_VERSION,
    validations: ["official-json-result", "fifteen-unique-numbers-in-01-25"],
    drawLocation: optionalNonEmptyString(source.localSorteio),
    drawMunicipalityUf: optionalNonEmptyString(source.nomeMunicipioUFSorteio),
  });
}

/** Parses the price and prize-tier catalog from a locally captured official page. */
export function parseLotofacilCaixaCatalog(content: string): LotofacilCatalog {
  const text = asPageText(content);
  const section = requiredMatch(
    /Tabela\s+de\s+preços([\s\S]*?)(?:Probabilidade|Acumulação|$)/i,
    text,
    "Tabela de preços da Lotofácil ausente.",
  )[1] ?? "";
  const rows = [...section.matchAll(/\b(1[5-9]|20)\s*(?:\||\n)\s*R\$\s*([\d.]+,\d{2})/g)].map((match) => ({
    betSize: Number(match[1]), priceInCents: cents(match[2] ?? "0"),
  }));
  if (rows.length !== 6 || new Set(rows.map((row) => row.betSize)).size !== 6) {
    throw new Error("Tabela de preços deve conter apostas de 15 a 20 dezenas.");
  }
  const prizeTiers = [11, 12, 13, 14, 15];
  for (const tier of prizeTiers) {
    if (!new RegExp(`${tier}\\s+(?:acertos|prognósticos|números)`, "i").test(text)) {
      throw new Error(`Faixa de premiação ${tier} ausente.`);
    }
  }
  const bolaoSection = requiredMatch(/Bolão([\s\S]*?)(?:Loterias\s+Online|Tabela\s+de\s+preços)/i, text, "Seção de bolão ausente.")[1] ?? "";
  const bolaoLimits = [...bolaoSection.matchAll(/(?:^|\n)\s*(1[5-9]|20)\s*\|\s*\d+\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*R\$[^|]*\|\s*R\$[^|]*\|\s*R\$[^|]*\|\s*(\d+)/g)].map((match) => ({
    betSize: Number(match[1]), minShares: Number(match[2]), maxShares: Number(match[3]), maxGamesPerReceipt: Number(match[4]),
  }));
  if (bolaoLimits.length !== 6) throw new Error("Tabela de limites de bolão deve conter apostas de 15 a 20 dezenas.");
  return lotofacilCatalogSchema.parse({
    lotteryId: "lotofacil", sourceUrl: LOTOFACIL_CAIXA_PAGE_URL,
    parserVersion: LOTOFACIL_CAIXA_CATALOG_PARSER_VERSION,
    priceByBetSize: rows, prizeTiers,
    bolaoLimits,
    validations: ["price-table-15-to-20", "prize-tiers-11-to-15"],
  });
}

/** Parses a locally captured official page; it never retrieves content itself. */
export function parseLotofacilCaixaPage(content: string): NormalizedLotteryResult {
  if (/\{\{\s*resultado\./i.test(content)) {
    throw new Error("Snapshot contém placeholders da página, não um resultado publicado.");
  }

  const text = asPageText(content);
  const header = requiredMatch(
    /Resultado\s+Concurso\s+(\d+)\s*\((\d{2}\/\d{2}\/\d{4})\)/i,
    text,
    "Número do concurso ou data de apuração ausente.",
  );
  const numberSection = text.slice((header.index ?? 0) + header[0].length);
  const numberBoundary = numberSection.search(/Estimativa\s+de\s+prêmio|Como\s+jogar|Premiação/i);
  const numberText = numberBoundary >= 0 ? numberSection.slice(0, numberBoundary) : numberSection;
  const drawnNumbers = [...numberText.matchAll(/(?<!\d)(?:0?[1-9]|1\d|2[0-5])(?!\d)/g)].map((match) => Number(match[0]));

  if (drawnNumbers.length !== 15) {
    throw new Error(`Resultado Lotofácil deve conter 15 dezenas; recebidas ${drawnNumbers.length}.`);
  }
  if (new Set(drawnNumbers).size !== drawnNumbers.length) {
    throw new Error("Resultado Lotofácil contém dezenas repetidas.");
  }

  const location = text.match(/Sorteio\s+realizado\s+no\s+(.+?)\s+em\s+(.+?)(?:\n|Estimativa)/i);
  return normalizedLotteryResultSchema.parse({
    lotteryId: "lotofacil",
    contestNumber: Number(header[1]),
    drawDate: isoDate(header[2] ?? ""),
    drawnNumbers,
    sourceUrl: LOTOFACIL_CAIXA_PAGE_URL,
    parserVersion: LOTOFACIL_CAIXA_PAGE_PARSER_VERSION,
    validations: ["official-page-result-marker", "fifteen-unique-numbers-in-01-25"],
    drawLocation: location?.[1]?.trim(),
    drawMunicipalityUf: location?.[2]?.trim(),
  });
}

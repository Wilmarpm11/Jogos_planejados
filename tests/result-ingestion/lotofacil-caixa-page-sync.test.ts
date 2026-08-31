import {
  fetchLotofacilCaixaPage,
  fetchLotofacilCaixaResult,
  LOTOFACIL_CAIXA_PAGE_URL,
  LOTOFACIL_CAIXA_RESULT_PARSER_VERSION,
  LOTOFACIL_CAIXA_RESULT_URL,
  parseLotofacilCaixaResultPayload,
} from "@boloes/result-ingestion";
import { describe, expect, it } from "vitest";

describe("Lotofácil official-page fetcher", () => {
  it("requests only the official page and returns its body", async () => {
    const fetcher = async (url: string, init?: RequestInit): Promise<Response> => {
      expect(url).toBe(LOTOFACIL_CAIXA_PAGE_URL);
      expect(init?.headers).toEqual({ accept: "text/html" });
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return new Response("<html>result</html>", { status: 200 });
    };
    await expect(fetchLotofacilCaixaPage(fetcher)).resolves.toBe("<html>result</html>");
  });

  it("rejects HTTP and transport failures", async () => {
    await expect(fetchLotofacilCaixaPage(async () => new Response("", { status: 503 }))).rejects.toThrow("HTTP 503");
    await expect(fetchLotofacilCaixaPage(async () => { throw new Error("offline"); })).rejects.toThrow("offline");
  });

  it("aborts a request that exceeds the bounded timeout", async () => {
    let signal: AbortSignal | undefined;
    const fetcher = (_url: string, init?: RequestInit): Promise<Response> => {
      signal = init?.signal ?? undefined;
      return new Promise(() => undefined);
    };

    await expect(fetchLotofacilCaixaPage(fetcher, 5)).rejects.toThrow("timed out after 5 ms");
    expect(signal?.aborted).toBe(true);
  });

  it("keeps the timeout active while reading the response body", async () => {
    const fetcher = async (): Promise<Response> => ({
      ok: true,
      status: 200,
      text: () => new Promise(() => undefined),
    }) as Response;

    await expect(fetchLotofacilCaixaPage(fetcher, 5)).rejects.toThrow("timed out after 5 ms");
  });
});

describe("Lotofácil authorized latest-result endpoint", () => {
  const validPayload = {
    tipoJogo: "LOTOFACIL",
    numero: 3774,
    dataApuracao: "28/08/2026",
    listaDezenas: ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "25"],
    localSorteio: "ESPAÇO DA SORTE",
    nomeMunicipioUFSorteio: "SÃO PAULO, SP",
  };

  it("requests only the fixed authorized URL as JSON", async () => {
    const rawContent = JSON.stringify(validPayload);
    const fetcher = async (url: string, init?: RequestInit): Promise<Response> => {
      expect(url).toBe(LOTOFACIL_CAIXA_RESULT_URL);
      expect(init?.headers).toEqual({ accept: "application/json" });
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return new Response(rawContent, { status: 200 });
    };

    await expect(fetchLotofacilCaixaResult(fetcher)).resolves.toBe(rawContent);
  });

  it("rejects HTTP, transport and timeout failures without real network", async () => {
    await expect(fetchLotofacilCaixaResult(async () => new Response("", { status: 503 }))).rejects.toThrow("HTTP 503");
    await expect(fetchLotofacilCaixaResult(async () => { throw new Error("offline"); })).rejects.toThrow("offline");

    let signal: AbortSignal | undefined;
    const pendingFetcher = (_url: string, init?: RequestInit): Promise<Response> => {
      signal = init?.signal ?? undefined;
      return new Promise(() => undefined);
    };
    await expect(fetchLotofacilCaixaResult(pendingFetcher, 5)).rejects.toThrow("timed out after 5 ms");
    expect(signal?.aborted).toBe(true);
  });

  it("normalizes the frozen Lotofácil result contract", () => {
    expect(parseLotofacilCaixaResultPayload(validPayload)).toEqual({
      lotteryId: "lotofacil",
      contestNumber: 3774,
      drawDate: "2026-08-28",
      drawnNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 25],
      sourceUrl: LOTOFACIL_CAIXA_RESULT_URL,
      parserVersion: LOTOFACIL_CAIXA_RESULT_PARSER_VERSION,
      validations: ["official-json-result", "fifteen-unique-numbers-in-01-25"],
      drawLocation: "ESPAÇO DA SORTE",
      drawMunicipalityUf: "SÃO PAULO, SP",
    });
  });

  it.each([
    [{ ...validPayload, tipoJogo: "MEGA_SENA" }, "não pertence"],
    [{ ...validPayload, numero: 0 }, "inteiro positivo"],
    [{ ...validPayload, dataApuracao: "2026-08-28" }, "Data de apuração inválida"],
    [{ ...validPayload, listaDezenas: validPayload.listaDezenas.slice(0, 14) }, "exatamente 15"],
    [{ ...validPayload, listaDezenas: [...validPayload.listaDezenas.slice(0, 14), "14"] }, "repetidas"],
    [{ ...validPayload, listaDezenas: [...validPayload.listaDezenas.slice(0, 14), "26"] }, "intervalo 01–25"],
  ])("rejects payloads outside the frozen contract", (payload, message) => {
    expect(() => parseLotofacilCaixaResultPayload(payload)).toThrow(message);
  });
});

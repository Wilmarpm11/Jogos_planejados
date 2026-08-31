import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  LOTOFACIL_CAIXA_PAGE_PARSER_VERSION,
  LOTOFACIL_CAIXA_PAGE_URL,
  parseLotofacilCaixaPage,
} from "@boloes/result-ingestion";
import { describe, expect, it } from "vitest";

const validPage = `
  <h2>Resultado Concurso 3716 (20/06/2026)</h2>
  <p>Sorteio realizado no ESPAÇO DA SORTE em SÃO PAULO, SP</p>
  <ul>
    <li>01</li><li>02</li><li>04</li><li>05</li><li>07</li>
    <li>11</li><li>12</li><li>15</li><li>17</li><li>18</li>
    <li>21</li><li>22</li><li>23</li><li>24</li><li>25</li>
  </ul>
  <p>Estimativa de prêmio do próximo concurso 22/06/2026</p>
`;

describe("Lotofácil CAIXA page parser", () => {
  it("normalizes a captured official-page result", () => {
    expect(parseLotofacilCaixaPage(validPage)).toEqual({
      lotteryId: "lotofacil",
      contestNumber: 3716,
      drawDate: "2026-06-20",
      drawnNumbers: [1, 2, 4, 5, 7, 11, 12, 15, 17, 18, 21, 22, 23, 24, 25],
      sourceUrl: LOTOFACIL_CAIXA_PAGE_URL,
      parserVersion: LOTOFACIL_CAIXA_PAGE_PARSER_VERSION,
      validations: ["official-page-result-marker", "fifteen-unique-numbers-in-01-25"],
      drawLocation: "ESPAÇO DA SORTE",
      drawMunicipalityUf: "SÃO PAULO, SP",
    });
  });

  it.each([
    ["<h2>Resultado Concurso {{resultado.numero}} ({{resultado.dataApuracao}})</h2>", "placeholders"],
    ["<h2>Resultado Concurso 3716 (20/06/2026)</h2><p>Estimativa de prêmio</p>", "15 dezenas"],
    [validPage.replace("<li>25</li>", "<li>24</li>"), "repetidas"],
    [validPage.replace("<li>25</li>", "<li>26</li>"), "15 dezenas"],
  ])("rejects %s", (page, message) => {
    expect(() => parseLotofacilCaixaPage(page)).toThrow(message);
  });

  it("runs through the CLI without network access", () => {
    const directory = mkdtempSync(join(tmpdir(), "boloes-page-parser-"));
    const inputPath = join(directory, "lotofacil.html");
    writeFileSync(inputPath, validPage);
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "apps/cli/src/index.ts", "data", "parse-lotofacil-page", "--input", inputPath],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ contestNumber: 3716, lotteryId: "lotofacil" });
  });
});

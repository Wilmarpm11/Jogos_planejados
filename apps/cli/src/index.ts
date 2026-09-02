import {
  bootstrapDatabase,
  getLatestValidDatasetSnapshot,
  getLatestLotofacilCatalog,
  persistLotofacilCatalog,
  persistLotteryResult,
  getLotofacilResultByContest,
  getLotofacilResultWindow,
  getLotofacilHistoricalMetricProfiles,
  createCohortDefinition,
  classifyLotofacilResultSpecialType,
  materializeCohort,
  getLatestStrategyConfigVersion,
  getStrategyConfigVersion,
  persistDatasetImport,
  persistStrategyConfigVersion,
  persistHistoricalMetricProfiles,
} from "@boloes/data-access";
import {
  manualDatasetImportSchema,
  basicPortfolioAuditRequestSchema,
  pairwisePortfolioAuditRequestSchema,
  portfolioGenerationRequestSchema,
  type DatasetSnapshot,
} from "@boloes/lottery-contracts";
import {
  auditBasicPortfolio,
  auditPortfolioIntersections,
  PairwisePortfolioAuditCancelledError,
} from "@boloes/audit-engine";
import {
  LOTOFACIL_CAIXA_PAGE_PARSER_VERSION,
  LOTOFACIL_CAIXA_PAGE_URL,
  LOTOFACIL_CAIXA_RESULT_PARSER_VERSION,
  LOTOFACIL_CAIXA_RESULT_URL,
  fetchLotofacilCaixaResult,
  parseLotofacilCaixaPage,
  parseLotofacilCaixaResultPayload,
  parseLotofacilCaixaCatalog,
} from "@boloes/result-ingestion";
import {
  createStrategyTransition,
  isEligibleForAutomaticGeneration,
  validateResolvedStrategyConfig,
} from "@boloes/strategy-registry";
import { deriveLotofacilHistoricalMetricProfile } from "@boloes/statistics-engine";
import {
  calculateLotofacilAxisOccupancy,
  getLotofacilCanonicalFormulaManifest,
  calculateLotofacilMetricProfile,
  calculateLotofacilStructuralMass,
  classifyLotofacilStructuralProfile,
  generateLotofacilPortfolio,
  summarizeLotofacilStructuralProfile,
  LOTOFACIL_SPECIAL_DRAW_TYPES,
  validateLotofacilStructuralAllocation,
  summarizeLotofacilStructuralAllocation,
} from "@boloes/lottery-lotofacil";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const help = `Uso: boloes <comando>

Comandos:
  help                 Mostra esta ajuda.
  diagnose [--db PATH] Inicializa e verifica o banco local de fundação.
  data import --input PATH [--db PATH]
                       Registra um envelope de importação já validado, localmente.
  data latest --lottery ID [--db PATH]
                       Exibe o último snapshot válido local da modalidade.
  data parse-lotofacil-page --input PATH
                       Interpreta localmente um snapshot HTML da página oficial.
  data import-lotofacil-page --input PATH [--db PATH]
                       Valida e registra localmente um snapshot da página oficial.
  data sync-lotofacil-page [--db PATH]
                       Coleta o resultado oficial e preserva o último snapshot em falhas.
  data import-lotofacil-catalog --input PATH --snapshot ID [--db PATH]
                       Registra catálogo local vinculado a um snapshot validado.
  data latest-lotofacil-catalog [--db PATH]
                       Exibe o último catálogo Lotofácil válido.
  data ledger-lotofacil-page --input PATH --snapshot ID [--db PATH]
                       Registra resultado normalizado no ledger por snapshot.
  data lotofacil-result --contest N [--db PATH]
                       Consulta resultado Lotofácil e sua proveniência.
  data lotofacil-window --size 10|25|50|100|250|complete [--db PATH]
                       Consulta janela histórica local, sem análise estatística.
  data derive-lotofacil-profiles --size 10|25|50|100|250|complete [--db PATH]
                       Deriva perfis métricos locais, sem agregação ou estratégia.
  data lotofacil-metric-profiles --size 10|25|50|100|250|complete [--db PATH]
                       Consulta perfis métricos históricos já derivados.
  cohort create --lottery ID --selector PATH [--db PATH]
                       Cria uma coorte por seletor objetivo de concursos.
  cohort classify-lotofacil-special --result ID --type TYPE [--db PATH]
                       Classifica explicitamente um resultado especial Lotofácil.
  cohort resolve --id ID [--db PATH]
                       Materializa os Draws de uma coorte de modo auditável.
  strategy create --id ID --version VERSION --mode MODE --parameters PATH [--db PATH]
                       Registra uma hipótese no estado DRAFT.
  strategy latest --id ID [--db PATH]
                       Exibe a versão local mais recente de uma estratégia.
  strategy transition --id ID --from-version VERSION --version VERSION --to STATUS [--db PATH]
                       Registra a próxima versão no ciclo de vida definido.
  strategy validate --input PATH
  strategy compare --input PATH
                       Valida StrategyConfig sem gerar ou persistir carteira.
  portfolio generate --input PATH
                       Gera candidatos Lotofácil localmente, sem persistir, cobrir ou congelar carteira.
  portfolio audit-basic --input PATH
                       Audita validade, duplicidade e frequências sem persistir ou calcular cobertura.
  portfolio audit-intersections --input PATH
                       Audita interseções par a par com progresso e cancelamento locais.
  lotofacil occupancy --numbers 01,02,...
                       Calcula ocupação de linhas e colunas para 15–20 dezenas.
  lotofacil metrics --numbers 01,02,...
                       Calcula o perfil estrutural canônico da cartela.
  lotofacil structural-mass
                       Calcula a massa estrutural teórica de apostas simples.
  lotofacil formula
                       Exibe o manifesto canônico e versionado da fórmula.
`;

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function dataPath(): string {
  return resolve(argumentValue("--db") ?? ".data/boloes.sqlite");
}

function snapshotOutput(snapshot: DatasetSnapshot): object {
  return {
    id: snapshot.id,
    dataImportId: snapshot.dataImportId,
    lotteryId: snapshot.lotteryId,
    sourceUrl: snapshot.sourceUrl,
    importedAt: snapshot.importedAt,
    parserVersion: snapshot.parserVersion,
    validations: snapshot.validations,
    status: snapshot.status,
    contentReference: snapshot.contentHash ?? `stored-raw-content:${snapshot.id}`,
    persistedAt: snapshot.persistedAt,
  };
}

function cohortSelectorFromFile(path: string): unknown {
  const selector = JSON.parse(readFileSync(resolve(path), "utf8")) as Record<string, unknown>;
  if (selector.type === "CONTEST_RANGE") return { type: selector.type, startContest: selector.start_contest, endContest: selector.end_contest };
  if (selector.type === "SPECIAL_DRAW_TYPE") return { type: selector.type, specialType: selector.special_type };
  return selector;
}

const command = process.argv[2] ?? "help";

if (command === "help" || command === "--help" || command === "-h") {
  process.stdout.write(help);
} else if (command === "diagnose") {
  const dbPath = dataPath();
  const result = bootstrapDatabase(dbPath);
  process.stdout.write(
    JSON.stringify({ status: "ok", database: result.path, schemaVersion: result.schemaVersion }) +
      "\n",
  );
} else if (command === "data" && process.argv[3] === "import") {
  const inputPath = argumentValue("--input");
  if (!inputPath) {
    process.stderr.write("Informe --input com o envelope JSON normalizado.\n");
    process.exitCode = 1;
  } else {
    try {
      const input = manualDatasetImportSchema.parse(
        JSON.parse(readFileSync(resolve(inputPath), "utf8")),
      );
      const persisted = persistDatasetImport(dataPath(), input);
      process.stdout.write(
        JSON.stringify({
          dataImport: {
            id: persisted.dataImport.id,
            lotteryId: persisted.dataImport.lotteryId,
            sourceUrl: persisted.dataImport.sourceUrl,
            importedAt: persisted.dataImport.importedAt,
            parserVersion: persisted.dataImport.parserVersion,
            validations: persisted.dataImport.validations,
            status: persisted.dataImport.status,
            contentReference:
              persisted.dataImport.contentHash ??
              `stored-raw-content:${persisted.dataImport.id}`,
            persistedAt: persisted.dataImport.persistedAt,
          },
          snapshot: persisted.snapshot ? snapshotOutput(persisted.snapshot) : null,
        }) + "\n",
      );
    } catch (error) {
      process.stderr.write(
        (error instanceof Error ? error.message : "Envelope de importação inválido.") + "\n",
      );
      process.exitCode = 1;
    }
  }
} else if (command === "data" && process.argv[3] === "latest") {
  const lotteryId = argumentValue("--lottery");
  if (!lotteryId) {
    process.stderr.write("Informe --lottery com a modalidade.\n");
    process.exitCode = 1;
  } else {
    const snapshot = getLatestValidDatasetSnapshot(dataPath(), lotteryId);
    process.stdout.write(JSON.stringify({ snapshot: snapshot ? snapshotOutput(snapshot) : null }) + "\n");
  }
} else if (command === "data" && process.argv[3] === "parse-lotofacil-page") {
  const inputPath = argumentValue("--input");
  if (!inputPath) {
    process.stderr.write("Informe --input com o snapshot HTML da página oficial.\n");
    process.exitCode = 1;
  } else {
    try {
      process.stdout.write(
        JSON.stringify(parseLotofacilCaixaPage(readFileSync(resolve(inputPath), "utf8"))) + "\n",
      );
    } catch (error) {
      process.stderr.write((error instanceof Error ? error.message : "Página inválida.") + "\n");
      process.exitCode = 1;
    }
  }
} else if (command === "data" && process.argv[3] === "import-lotofacil-page") {
  const inputPath = argumentValue("--input");
  if (!inputPath) {
    process.stderr.write("Informe --input com o snapshot HTML da página oficial.\n");
    process.exitCode = 1;
  } else {
    let rawContent: string | null = null;
    try {
      rawContent = readFileSync(resolve(inputPath), "utf8");
    } catch (error) {
      process.stderr.write(`Não foi possível ler --input: ${error instanceof Error ? error.message : "erro desconhecido"}.\n`);
      process.exitCode = 1;
    }
    if (rawContent !== null) {
      let result: ReturnType<typeof parseLotofacilCaixaPage> | null = null;
      try {
        result = parseLotofacilCaixaPage(rawContent);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Página inválida.";
        try {
          const persisted = persistDatasetImport(dataPath(), {
            lotteryId: "lotofacil",
            sourceUrl: LOTOFACIL_CAIXA_PAGE_URL,
            importedAt: new Date().toISOString(),
            rawContent,
            parserVersion: LOTOFACIL_CAIXA_PAGE_PARSER_VERSION,
            validations: [`parser-rejected: ${message}`],
            status: "INVALID",
          });
          process.stdout.write(JSON.stringify({ result: null, ...persisted }) + "\n");
        } catch (persistenceError) {
          process.stderr.write((persistenceError instanceof Error ? persistenceError.message : "Falha ao registrar página inválida.") + "\n");
          process.exitCode = 1;
        }
      }
      if (result !== null) {
        try {
          const persisted = persistDatasetImport(dataPath(), {
            lotteryId: "lotofacil",
            sourceUrl: LOTOFACIL_CAIXA_PAGE_URL,
            importedAt: new Date().toISOString(),
            rawContent,
            parserVersion: LOTOFACIL_CAIXA_PAGE_PARSER_VERSION,
            validations: result.validations,
            status: "VALIDATED",
          });
          process.stdout.write(JSON.stringify({ result, ...persisted }) + "\n");
        } catch (error) {
          process.stderr.write((error instanceof Error ? error.message : "Falha ao registrar página válida.") + "\n");
          process.exitCode = 1;
        }
      }
    }
  }
} else if (command === "data" && process.argv[3] === "sync-lotofacil-page") {
  let rawContent: string | null = null;
  try {
    rawContent = await fetchLotofacilCaixaResult();
  } catch (error) {
    const snapshot = getLatestValidDatasetSnapshot(dataPath(), "lotofacil");
    process.stdout.write(JSON.stringify({
      status: "FAILED", error: error instanceof Error ? error.message : "Sync failed.",
      fallbackSnapshot: snapshot ? snapshotOutput(snapshot) : null,
    }) + "\n");
    process.exitCode = 1;
  }
  if (rawContent !== null) {
    let result: ReturnType<typeof parseLotofacilCaixaResultPayload> | null = null;
    try {
      result = parseLotofacilCaixaResultPayload(JSON.parse(rawContent));
    } catch (error) {
      try {
        const persisted = persistDatasetImport(dataPath(), {
          lotteryId: "lotofacil", sourceUrl: LOTOFACIL_CAIXA_RESULT_URL,
          importedAt: new Date().toISOString(), rawContent,
          parserVersion: LOTOFACIL_CAIXA_RESULT_PARSER_VERSION,
          validations: [`parser-rejected: ${error instanceof Error ? error.message : "Payload inválido."}`],
          status: "INVALID",
        });
        process.stdout.write(JSON.stringify({ status: "INVALID", result: null, ...persisted }) + "\n");
      } catch (persistenceError) {
        process.stderr.write((persistenceError instanceof Error ? persistenceError.message : "Falha ao registrar página inválida.") + "\n");
        process.exitCode = 1;
      }
    }
    if (result !== null) {
      try {
        const persisted = persistDatasetImport(dataPath(), {
          lotteryId: "lotofacil", sourceUrl: LOTOFACIL_CAIXA_RESULT_URL,
          importedAt: new Date().toISOString(), rawContent,
          parserVersion: LOTOFACIL_CAIXA_RESULT_PARSER_VERSION,
          validations: result.validations, status: "VALIDATED",
        });
        process.stdout.write(JSON.stringify({ status: "VALIDATED", result, ...persisted }) + "\n");
      } catch (error) {
        process.stderr.write((error instanceof Error ? error.message : "Falha ao registrar página válida.") + "\n");
        process.exitCode = 1;
      }
    }
  }
} else if (command === "data" && process.argv[3] === "import-lotofacil-catalog") {
  const inputPath = argumentValue("--input");
  const snapshotId = argumentValue("--snapshot");
  if (!inputPath || !snapshotId) {
    process.stderr.write("Informe --input e --snapshot.\n"); process.exitCode = 1;
  } else {
    try {
      const catalog = parseLotofacilCaixaCatalog(readFileSync(resolve(inputPath), "utf8"));
      process.stdout.write(JSON.stringify(persistLotofacilCatalog(dataPath(), snapshotId, catalog)) + "\n");
    } catch (error) { process.stderr.write((error instanceof Error ? error.message : "Catálogo inválido.") + "\n"); process.exitCode = 1; }
  }
} else if (command === "data" && process.argv[3] === "latest-lotofacil-catalog") {
  process.stdout.write(JSON.stringify({ catalog: getLatestLotofacilCatalog(dataPath()) }) + "\n");
} else if (command === "data" && process.argv[3] === "ledger-lotofacil-page") {
  const inputPath = argumentValue("--input"); const snapshotId = argumentValue("--snapshot");
  if (!inputPath || !snapshotId) { process.stderr.write("Informe --input e --snapshot.\n"); process.exitCode = 1; }
  else {
    try { process.stdout.write(JSON.stringify(persistLotteryResult(dataPath(), snapshotId, parseLotofacilCaixaPage(readFileSync(resolve(inputPath), "utf8")))) + "\n"); }
    catch (error) { process.stderr.write((error instanceof Error ? error.message : "Resultado inválido.") + "\n"); process.exitCode = 1; }
  }
} else if (command === "data" && process.argv[3] === "lotofacil-result") {
  const contest = Number(argumentValue("--contest"));
  if (!Number.isInteger(contest) || contest <= 0) { process.stderr.write("Informe --contest positivo.\n"); process.exitCode = 1; }
  else process.stdout.write(JSON.stringify({ result: getLotofacilResultByContest(dataPath(), contest) }) + "\n");
} else if (command === "data" && process.argv[3] === "lotofacil-window") {
  const size = argumentValue("--size");
  if (size !== "complete" && !["10", "25", "50", "100", "250"].includes(size ?? "")) { process.stderr.write("Informe --size 10, 25, 50, 100, 250 ou complete.\n"); process.exitCode = 1; }
  else {
    const windowSize = size === "complete" ? "complete" : Number(size) as 10 | 25 | 50 | 100 | 250;
    const results = getLotofacilResultWindow(dataPath(), windowSize);
    process.stdout.write(JSON.stringify({ window: { size: windowSize, resultCount: results.length }, results }) + "\n");
  }
} else if (command === "data" && process.argv[3] === "derive-lotofacil-profiles") {
  const size = argumentValue("--size");
  if (size !== "complete" && !["10", "25", "50", "100", "250"].includes(size ?? "")) { process.stderr.write("Informe --size 10, 25, 50, 100, 250 ou complete.\n"); process.exitCode = 1; }
  else {
    try {
      const windowSize = size === "complete" ? "complete" : Number(size) as 10 | 25 | 50 | 100 | 250;
      const profiles = persistHistoricalMetricProfiles(dataPath(), getLotofacilResultWindow(dataPath(), windowSize).map(deriveLotofacilHistoricalMetricProfile));
      process.stdout.write(JSON.stringify({ window: { size: windowSize, profileCount: profiles.length }, profiles }) + "\n");
    } catch (error) { process.stderr.write((error instanceof Error ? error.message : "Perfil histórico inválido.") + "\n"); process.exitCode = 1; }
  }
} else if (command === "data" && process.argv[3] === "lotofacil-metric-profiles") {
  const size = argumentValue("--size");
  if (size !== "complete" && !["10", "25", "50", "100", "250"].includes(size ?? "")) { process.stderr.write("Informe --size 10, 25, 50, 100, 250 ou complete.\n"); process.exitCode = 1; }
  else {
    const windowSize = size === "complete" ? "complete" : Number(size) as 10 | 25 | 50 | 100 | 250;
    const profiles = getLotofacilHistoricalMetricProfiles(dataPath(), windowSize);
    process.stdout.write(JSON.stringify({ window: { size: windowSize, profileCount: profiles.length }, profiles }) + "\n");
  }
} else if (command === "cohort" && process.argv[3] === "create") {
  const lotteryId = argumentValue("--lottery"); const selectorPath = argumentValue("--selector");
  if (!lotteryId || !selectorPath) { process.stderr.write("Informe --lottery e --selector.\n"); process.exitCode = 1; }
  else {
    try { process.stdout.write(JSON.stringify({ cohort: createCohortDefinition(dataPath(), lotteryId, cohortSelectorFromFile(selectorPath) as never) }) + "\n"); }
    catch (error) { process.stderr.write((error instanceof Error ? error.message : "Seletor de coorte inválido.") + "\n"); process.exitCode = 1; }
  }
} else if (command === "cohort" && process.argv[3] === "classify-lotofacil-special") {
  const resultId = argumentValue("--result"); const specialType = argumentValue("--type");
  if (!resultId || !specialType) { process.stderr.write("Informe --result e --type.\n"); process.exitCode = 1; }
  else if (!LOTOFACIL_SPECIAL_DRAW_TYPES.includes(specialType as never)) { process.stderr.write("Tipo especial Lotofácil inválido.\n"); process.exitCode = 1; }
  else {
    try { classifyLotofacilResultSpecialType(dataPath(), resultId, specialType); process.stdout.write(JSON.stringify({ resultId, specialType }) + "\n"); }
    catch (error) { process.stderr.write((error instanceof Error ? error.message : "Classificação inválida.") + "\n"); process.exitCode = 1; }
  }
} else if (command === "cohort" && process.argv[3] === "resolve") {
  const cohortId = argumentValue("--id");
  if (!cohortId) { process.stderr.write("Informe --id.\n"); process.exitCode = 1; }
  else {
    try { process.stdout.write(JSON.stringify({ resolution: materializeCohort(dataPath(), cohortId) }) + "\n"); }
    catch (error) { process.stderr.write((error instanceof Error ? error.message : "Coorte inválida.") + "\n"); process.exitCode = 1; }
  }
} else if (command === "strategy" && process.argv[3] === "create") {
  const id = argumentValue("--id");
  const version = argumentValue("--version");
  const mode = argumentValue("--mode");
  const parametersPath = argumentValue("--parameters");
  if (!id || !version || !mode || !parametersPath) {
    process.stderr.write("Informe --id, --version, --mode e --parameters.\n");
    process.exitCode = 1;
  } else {
    try {
      const parameters = JSON.parse(readFileSync(resolve(parametersPath), "utf8"));
      const strategy = persistStrategyConfigVersion(dataPath(), {
        id,
        version,
        status: "DRAFT",
        mode: mode as "NEUTRAL" | "BALANCED" | "CONCENTRATED" | "EXPERIMENTAL_SPECIAL",
        parameters,
      });
      process.stdout.write(JSON.stringify({ strategy, eligibleForAutomaticGeneration: isEligibleForAutomaticGeneration(strategy) }) + "\n");
    } catch (error) {
      process.stderr.write((error instanceof Error ? error.message : "Estratégia inválida.") + "\n");
      process.exitCode = 1;
    }
  }
} else if (command === "strategy" && process.argv[3] === "latest") {
  const id = argumentValue("--id");
  if (!id) {
    process.stderr.write("Informe --id.\n");
    process.exitCode = 1;
  } else {
    const strategy = getLatestStrategyConfigVersion(dataPath(), id);
    process.stdout.write(JSON.stringify({ strategy, eligibleForAutomaticGeneration: strategy ? isEligibleForAutomaticGeneration(strategy) : false }) + "\n");
  }
} else if (command === "strategy" && process.argv[3] === "transition") {
  const id = argumentValue("--id");
  const fromVersion = argumentValue("--from-version");
  const version = argumentValue("--version");
  const status = argumentValue("--to");
  if (!id || !fromVersion || !version || !status) {
    process.stderr.write("Informe --id, --from-version, --version e --to.\n");
    process.exitCode = 1;
  } else {
    try {
      const previous = getStrategyConfigVersion(dataPath(), id, fromVersion);
      if (!previous) throw new Error("Versão de origem da estratégia não encontrada.");
      const strategy = persistStrategyConfigVersion(
        dataPath(),
        createStrategyTransition(
          previous,
          version,
          status as "DRAFT" | "EXPLORATORY" | "VALIDATING" | "HOLDOUT" | "VALIDATED" | "PRODUCTION" | "REJECTED",
        ),
      );
      process.stdout.write(JSON.stringify({ strategy, eligibleForAutomaticGeneration: isEligibleForAutomaticGeneration(strategy) }) + "\n");
    } catch (error) {
      process.stderr.write((error instanceof Error ? error.message : "Transição inválida.") + "\n");
      process.exitCode = 1;
    }
  }
} else if (command === "strategy" && process.argv[3] === "validate") {
  const inputPath = argumentValue("--input");
  if (!inputPath) { process.stderr.write("Informe --input.\n"); process.exitCode = 1; }
  else {
    try {
      const validation = validateResolvedStrategyConfig(JSON.parse(readFileSync(resolve(inputPath), "utf8")));
      if (validation.strategy.lotteryId === "lotofacil" && validation.strategy.structuralAllocation) validateLotofacilStructuralAllocation(validation.strategy.structuralAllocation);
      process.stdout.write(JSON.stringify({ ...validation, theoreticalStructuralMass: validation.strategy.lotteryId === "lotofacil" ? calculateLotofacilStructuralMass() : null }) + "\n");
    } catch (error) { process.stderr.write((error instanceof Error ? error.message : "StrategyConfig inválido.") + "\n"); process.exitCode = 1; }
  }
} else if (command === "strategy" && process.argv[3] === "compare") {
  const inputPath = argumentValue("--input");
  if (!inputPath) { process.stderr.write("Informe --input.\n"); process.exitCode = 1; }
  else {
    try {
      const strategies = JSON.parse(readFileSync(resolve(inputPath), "utf8"));
      if (!Array.isArray(strategies) || strategies.length < 2) throw new Error("Informe ao menos duas StrategyConfig.");
      const comparison = strategies.map((input) => {
        const validation = validateResolvedStrategyConfig(input);
        const allocation = validation.strategy.lotteryId === "lotofacil" && validation.strategy.structuralAllocation
          ? summarizeLotofacilStructuralAllocation(validation.strategy.structuralAllocation)
          : null;
        return { id: validation.strategy.id, version: validation.strategy.version, mode: validation.strategy.mode, statisticalLabel: validation.strategy.statisticalLabel, eligibleForAutomaticGeneration: validation.eligibleForAutomaticGeneration, diagnostics: validation.diagnostics, structuralAllocation: allocation };
      });
      process.stdout.write(JSON.stringify({ comparison, persisted: false, portfolioGenerated: false }) + "\n");
    } catch (error) { process.stderr.write((error instanceof Error ? error.message : "Comparação inválida.") + "\n"); process.exitCode = 1; }
  }
} else if (command === "portfolio" && process.argv[3] === "generate") {
  const inputPath = argumentValue("--input");
  if (!inputPath) { process.stderr.write("Informe --input com a solicitação de geração.\n"); process.exitCode = 1; }
  else {
    try {
      const request = portfolioGenerationRequestSchema.parse(JSON.parse(readFileSync(resolve(inputPath), "utf8")));
      const validation = validateResolvedStrategyConfig(request.strategy);
      process.stdout.write(JSON.stringify(generateLotofacilPortfolio({ ...request, strategy: validation.strategy })) + "\n");
    } catch (error) { process.stderr.write((error instanceof Error ? error.message : "Solicitação de geração inválida.") + "\n"); process.exitCode = 1; }
  }
} else if (command === "portfolio" && process.argv[3] === "audit-basic") {
  const inputPath = argumentValue("--input");
  if (!inputPath) { process.stderr.write("Informe --input com os candidatos para auditoria.\n"); process.exitCode = 1; }
  else {
    try {
      const request = basicPortfolioAuditRequestSchema.parse(JSON.parse(readFileSync(resolve(inputPath), "utf8")));
      process.stdout.write(JSON.stringify(auditBasicPortfolio(request)) + "\n");
    } catch (error) { process.stderr.write((error instanceof Error ? error.message : "Solicitação de auditoria inválida.") + "\n"); process.exitCode = 1; }
  }
} else if (command === "portfolio" && process.argv[3] === "audit-intersections") {
  const inputPath = argumentValue("--input");
  if (!inputPath) { process.stderr.write("Informe --input com os candidatos para auditoria.\n"); process.exitCode = 1; }
  else {
    const cancellation = new AbortController();
    const cancelOnSigint = (): void => cancellation.abort();
    process.once("SIGINT", cancelOnSigint);
    try {
      const request = pairwisePortfolioAuditRequestSchema.parse(JSON.parse(readFileSync(resolve(inputPath), "utf8")));
      const result = await auditPortfolioIntersections(request, {
        signal: cancellation.signal,
        onProgress: (progress) => process.stderr.write(JSON.stringify(progress) + "\n"),
      });
      process.stdout.write(JSON.stringify(result) + "\n");
    } catch (error) {
      process.stderr.write((error instanceof Error ? error.message : "Solicitação de auditoria inválida.") + "\n");
      process.exitCode = error instanceof PairwisePortfolioAuditCancelledError ? 130 : 1;
    } finally {
      process.off("SIGINT", cancelOnSigint);
    }
  }
} else if (command === "lotofacil" && process.argv[3] === "occupancy") {
  const value = argumentValue("--numbers");
  if (!value) {
    process.stderr.write("Informe --numbers com dezenas separadas por vírgula.\n");
    process.exitCode = 1;
  } else {
    const numbers = value.split(",").map((part) => Number(part.trim()));
    try {
      process.stdout.write(JSON.stringify(calculateLotofacilAxisOccupancy(numbers)) + "\n");
    } catch (error) {
      process.stderr.write(
        (error instanceof Error ? error.message : "Entrada inválida.") + "\n",
      );
      process.exitCode = 1;
    }
  }
} else if (command === "lotofacil" && process.argv[3] === "metrics") {
  const value = argumentValue("--numbers");
  if (!value) {
    process.stderr.write("Informe --numbers com dezenas separadas por vírgula.\n");
    process.exitCode = 1;
  } else {
    const numbers = value.split(",").map((part) => Number(part.trim()));
    try {
      const profile = calculateLotofacilMetricProfile(numbers);
      const structuralClassification = classifyLotofacilStructuralProfile(profile);
      process.stdout.write(
        JSON.stringify({
          profile,
          structuralClassification,
          structuralSummary: summarizeLotofacilStructuralProfile(
            profile,
            structuralClassification,
          ),
        }) + "\n",
      );
    } catch (error) {
      process.stderr.write(
        (error instanceof Error ? error.message : "Entrada inválida.") + "\n",
      );
      process.exitCode = 1;
    }
  }
} else if (command === "lotofacil" && process.argv[3] === "structural-mass") {
  process.stdout.write(JSON.stringify(calculateLotofacilStructuralMass()) + "\n");
} else if (command === "lotofacil" && process.argv[3] === "formula") {
  process.stdout.write(JSON.stringify(getLotofacilCanonicalFormulaManifest()) + "\n");
} else {
  process.stderr.write(`Comando desconhecido: ${command}\n\n${help}`);
  process.exitCode = 1;
}

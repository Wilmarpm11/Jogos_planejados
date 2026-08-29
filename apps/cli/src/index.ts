import { bootstrapDatabase } from "@boloes/data-access";
import {
  calculateLotofacilAxisOccupancy,
  calculateLotofacilMetricProfile,
} from "@boloes/lottery-lotofacil";
import { resolve } from "node:path";

const help = `Uso: boloes <comando>

Comandos:
  help                 Mostra esta ajuda.
  diagnose [--db PATH] Inicializa e verifica o banco local de fundação.
  lotofacil occupancy --numbers 01,02,...
                       Calcula ocupação de linhas e colunas para 15–20 dezenas.
  lotofacil metrics --numbers 01,02,...
                       Calcula o perfil estrutural canônico da cartela.
`;

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const command = process.argv[2] ?? "help";

if (command === "help" || command === "--help" || command === "-h") {
  process.stdout.write(help);
} else if (command === "diagnose") {
  const dbPath = resolve(argumentValue("--db") ?? ".data/boloes.sqlite");
  const result = bootstrapDatabase(dbPath);
  process.stdout.write(
    JSON.stringify({ status: "ok", database: result.path, schemaVersion: result.schemaVersion }) +
      "\n",
  );
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
      process.stdout.write(JSON.stringify(calculateLotofacilMetricProfile(numbers)) + "\n");
    } catch (error) {
      process.stderr.write(
        (error instanceof Error ? error.message : "Entrada inválida.") + "\n",
      );
      process.exitCode = 1;
    }
  }
} else {
  process.stderr.write(`Comando desconhecido: ${command}\n\n${help}`);
  process.exitCode = 1;
}

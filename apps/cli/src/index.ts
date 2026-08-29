import { bootstrapDatabase } from "@boloes/data-access";
import { resolve } from "node:path";

const help = `Uso: boloes <comando>

Comandos:
  help                 Mostra esta ajuda.
  diagnose [--db PATH] Inicializa e verifica o banco local de fundação.
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
} else {
  process.stderr.write(`Comando desconhecido: ${command}\n\n${help}`);
  process.exitCode = 1;
}

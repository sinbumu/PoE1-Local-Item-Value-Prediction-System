import { readFile } from "node:fs/promises";

import { buildDesktopFeaturePayloadFromClipboardText } from "../services/desktop-feature-payload.service";

function readFlagValue(flag: string): string | undefined {
  const flagIndex = process.argv.findIndex(
    (value) => value === flag || value.startsWith(`${flag}=`),
  );
  if (flagIndex < 0) {
    return undefined;
  }

  const argument = process.argv[flagIndex];
  if (argument === flag) {
    const nextValue = process.argv[flagIndex + 1]?.trim();
    return nextValue && !nextValue.startsWith("--") ? nextValue : undefined;
  }

  return argument.slice(flag.length + 1).trim();
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

async function main(): Promise<void> {
  const inputPath = readFlagValue("--input");
  const rawText = inputPath ? await readFile(inputPath, "utf-8") : await readStdin();
  const payload = buildDesktopFeaturePayloadFromClipboardText(rawText);

  process.stdout.write(
    `${JSON.stringify(
      payload,
      null,
      2,
    )}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});

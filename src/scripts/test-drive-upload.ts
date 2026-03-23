import { unlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { closePool } from "../db/client";
import { GoogleDriveService } from "../services/google-drive.service";
import { logger } from "../utils/logger";

async function main(): Promise<void> {
  const googleDriveService = new GoogleDriveService();
  const tempFilePath = join(tmpdir(), `poe-drive-test-${Date.now()}.txt`);
  const content = [
    "PoE1 Local Item Value Prediction System",
    `uploaded_at=${new Date().toISOString()}`,
    "kind=drive_test",
  ].join("\n");

  await writeFile(tempFilePath, content, "utf8");

  try {
    const uploadedFile = await googleDriveService.uploadFile({
      filePath: tempFilePath,
      fileName: `poe-drive-test-${Date.now()}.txt`,
      mimeType: "text/plain",
    });
    const metadata = await googleDriveService.getFileMetadata(uploadedFile.id);

    logger.info(
      {
        fileId: metadata.id,
        fileName: metadata.name,
        mimeType: metadata.mimeType,
        size: metadata.size,
        webViewLink: metadata.webViewLink ?? null,
      },
      "Google Drive upload test succeeded",
    );
  } finally {
    await unlink(tempFilePath).catch(() => undefined);
  }
}

main()
  .catch((error) => {
    logger.error({ err: error }, "Google Drive upload test failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });

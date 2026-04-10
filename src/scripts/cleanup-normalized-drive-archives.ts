import { closePool } from "../db/client";
import { GoogleDriveService } from "../services/google-drive.service";
import { logger } from "../utils/logger";

const NORMALIZED_ARCHIVE_PREFIX = "normalized_priced_items_";

async function main(): Promise<void> {
  const driveService = new GoogleDriveService();
  const dryRun = process.argv.includes("--dry-run");
  const allCandidates = await driveService.listFiles({
    namePrefix: NORMALIZED_ARCHIVE_PREFIX,
  });
  const files = allCandidates.filter((file) =>
    file.name.startsWith(NORMALIZED_ARCHIVE_PREFIX),
  );

  logger.info(
    {
      dryRun,
      matchedFileCount: files.length,
      sampleMatchedFiles: files.slice(0, 10).map((file) => ({
        id: file.id,
        name: file.name,
      })),
    },
    "Matched normalized archive files in Google Drive",
  );

  if (dryRun) {
    return;
  }

  for (const file of files) {
    await driveService.deleteFile(file.id);
    logger.info(
      {
        fileId: file.id,
        fileName: file.name,
      },
      "Deleted normalized archive file from Google Drive",
    );
  }
}

main()
  .catch((error) => {
    logger.error({ err: error }, "Normalized drive archive cleanup failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });

import { createWriteStream } from "fs";
import { mkdir } from "fs/promises";
import { join } from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { createGzip } from "zlib";
import { env } from "../config/env";
import {
  ArchiveRepository,
  type ArchivedNormalizedRow,
} from "../repositories/archive.repository";
import {
  GoogleDriveService,
  type GoogleDriveFileMetadata,
} from "./google-drive.service";

type ArchiveNormalizedOptions = {
  olderThanHours?: number;
  limit?: number;
  outputDirectory?: string;
  purgeAfterUpload?: boolean;
};

export type NormalizedArchiveResult = {
  exportedRowCount: number;
  archivePath: string | null;
  driveFile: GoogleDriveFileMetadata | null;
  purgedRowCount: number;
};

function formatFileTimestamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

export class NormalizedArchiveService {
  constructor(
    private readonly archiveRepository = new ArchiveRepository(),
    private readonly googleDriveService = new GoogleDriveService(),
  ) {}

  async archiveAndUpload(
    options?: ArchiveNormalizedOptions,
  ): Promise<NormalizedArchiveResult> {
    const olderThanHours =
      options?.olderThanHours ?? env.NORMALIZED_RETENTION_HOURS;
    const limit = options?.limit ?? env.NORMALIZED_ARCHIVE_LIMIT;
    const outputDirectory = options?.outputDirectory ?? env.ARCHIVE_OUTPUT_DIR;
    const purgeAfterUpload = options?.purgeAfterUpload ?? false;
    const rows = await this.archiveRepository.getNormalizedRowsForArchive(
      olderThanHours,
      limit,
    );

    if (rows.length === 0) {
      return {
        exportedRowCount: 0,
        archivePath: null,
        driveFile: null,
        purgedRowCount: 0,
      };
    }

    await mkdir(outputDirectory, { recursive: true });

    const fileName = `normalized_priced_items_${formatFileTimestamp(
      new Date(),
    )}_${rows.length}.ndjson.gz`;
    const archivePath = join(outputDirectory, fileName);

    await this.writeArchiveFile(archivePath, rows, olderThanHours);

    const driveFile = await this.googleDriveService.uploadFile({
      filePath: archivePath,
      fileName,
      mimeType: "application/gzip",
    });

    let purgedRowCount = 0;

    if (purgeAfterUpload) {
      purgedRowCount = await this.archiveRepository.deleteNormalizedRowsByIds(
        rows.map((row) => row.id),
        olderThanHours,
      );
    }

    return {
      exportedRowCount: rows.length,
      archivePath,
      driveFile,
      purgedRowCount,
    };
  }

  private async writeArchiveFile(
    archivePath: string,
    rows: ArchivedNormalizedRow[],
    olderThanHours: number,
  ): Promise<void> {
    const metadataLine = JSON.stringify({
      kind: "archive_metadata",
      sourceTable: "normalized_priced_items",
      exportedAt: new Date().toISOString(),
      staleBy: "updated_at",
      olderThanHours,
      rowCount: rows.length,
    });

    const lines = [
      metadataLine,
      ...rows.map((row) =>
        JSON.stringify({
          kind: "normalized_priced_item",
          row,
        }),
      ),
    ];

    const source = Readable.from(lines.map((line) => `${line}\n`));
    const destination = createWriteStream(archivePath);

    await pipeline(source, createGzip(), destination);
  }
}

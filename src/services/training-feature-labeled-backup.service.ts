import { createWriteStream } from "fs";
import { mkdir } from "fs/promises";
import { join } from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { createGzip } from "zlib";
import { env } from "../config/env";
import {
  TrainingFeatureLabeledBackupRepository,
  type TrainingFeatureLabeledBackupRow,
} from "../repositories/training-feature-labeled-backup.repository";
import {
  TrainingFeatureLabeledBackupStateRepository,
  type TrainingFeatureLabeledBackupCursor,
} from "../repositories/training-feature-labeled-backup-state.repository";
import {
  GoogleDriveService,
  type GoogleDriveFileMetadata,
} from "./google-drive.service";

type BackupTrainingFeaturesLabeledOptions = {
  limit?: number;
  outputDirectory?: string;
  resetCursor?: boolean;
};

export type TrainingFeatureLabeledBackupResult = {
  exportedRowCount: number;
  archivePath: string | null;
  driveFile: GoogleDriveFileMetadata | null;
  cursor: TrainingFeatureLabeledBackupCursor | null;
};

function formatFileTimestamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

export class TrainingFeatureLabeledBackupService {
  constructor(
    private readonly repository = new TrainingFeatureLabeledBackupRepository(),
    private readonly stateRepository = new TrainingFeatureLabeledBackupStateRepository(),
    private readonly googleDriveService = new GoogleDriveService(),
  ) {}

  async backupNextBatch(
    options?: BackupTrainingFeaturesLabeledOptions,
  ): Promise<TrainingFeatureLabeledBackupResult> {
    const limit = options?.limit ?? env.LABELED_BACKUP_LIMIT;
    const outputDirectory =
      options?.outputDirectory ?? env.LABELED_BACKUP_OUTPUT_DIR;

    if (options?.resetCursor) {
      await this.stateRepository.resetCursor();
    }

    const cursor = await this.stateRepository.getCursor();
    const rows = await this.repository.getBatch(limit, cursor);

    if (rows.length === 0) {
      return {
        exportedRowCount: 0,
        archivePath: null,
        driveFile: null,
        cursor,
      };
    }

    await mkdir(outputDirectory, { recursive: true });

    const fileName = `training_features_labeled_${formatFileTimestamp(
      new Date(),
    )}_${rows.length}.ndjson.gz`;
    const archivePath = join(outputDirectory, fileName);

    await this.writeArchiveFile(archivePath, rows);

    const driveFile = await this.googleDriveService.uploadFile({
      filePath: archivePath,
      fileName,
      mimeType: "application/gzip",
    });

    const lastRow = rows[rows.length - 1];
    const nextCursor = {
      labeledAt: lastRow.labeled_at,
      listingKey: lastRow.listing_key,
    };
    await this.stateRepository.saveCursor(nextCursor);

    return {
      exportedRowCount: rows.length,
      archivePath,
      driveFile,
      cursor: nextCursor,
    };
  }

  private async writeArchiveFile(
    archivePath: string,
    rows: TrainingFeatureLabeledBackupRow[],
  ): Promise<void> {
    const metadataLine = JSON.stringify({
      kind: "archive_metadata",
      sourceTable: "training_features_labeled",
      exportedAt: new Date().toISOString(),
      rowCount: rows.length,
    });

    const lines = [
      metadataLine,
      ...rows.map((row) =>
        JSON.stringify({
          kind: "training_feature_labeled",
          row: row.row_json,
        }),
      ),
    ];

    const source = Readable.from(lines.map((line) => `${line}\n`));
    const destination = createWriteStream(archivePath);

    await pipeline(source, createGzip(), destination);
  }
}

import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import {
  access,
  copyFile,
  mkdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

import { NotFoundError } from "../../domain/errors.js";

export interface LocalFileStorageOptions {
  previewRoot: string;
  storageRoot: string;
  tempUploadRoot: string;
}

export interface FinalizedUpload {
  checksum: string;
  sizeBytes: number;
  storagePath: string;
}

export interface PreviewResult {
  previewPath: string | null;
  previewStatus: "failed" | "none" | "ready";
}

export class LocalFileStorage {
  private readonly previewRoot: string;
  private readonly storageRoot: string;
  private readonly tempUploadRoot: string;

  constructor(options: LocalFileStorageOptions) {
    this.previewRoot = options.previewRoot;
    this.storageRoot = options.storageRoot;
    this.tempUploadRoot = options.tempUploadRoot;
  }

  async ensureBaseDirectories(): Promise<void> {
    await mkdir(this.previewRoot, { recursive: true });
    await mkdir(this.storageRoot, { recursive: true });
    await mkdir(this.tempUploadRoot, { recursive: true });
  }

  async clearTransientUploadRoot(): Promise<void> {
    await rm(this.tempUploadRoot, { force: true, recursive: true });
    await mkdir(this.tempUploadRoot, { recursive: true });
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async finalizeUpload(
    uploadId: string,
    totalChunks: number,
  ): Promise<FinalizedUpload> {
    const uploadDirectory = this.getUploadDirectory(uploadId);
    const mergedFilePath = join(uploadDirectory, "merged.tmp");
    const hash = createHash("sha256");
    let sizeBytes = 0;

    await rm(mergedFilePath, { force: true });

    for (let index = 0; index < totalChunks; index += 1) {
      const partPath = this.getUploadPartPath(uploadId, index);
      const transform = new Transform({
        transform(chunk, _encoding, callback) {
          const bufferChunk = Buffer.isBuffer(chunk)
            ? chunk
            : Buffer.from(chunk);
          hash.update(bufferChunk);
          sizeBytes += bufferChunk.length;
          callback(null, bufferChunk);
        },
      });

      await pipeline(
        createReadStream(partPath),
        transform,
        createWriteStream(mergedFilePath, { flags: "a" }),
      );
    }

    const checksum = hash.digest("hex");
    const storagePath = this.getBlobPath(checksum);

    await mkdir(dirname(storagePath), { recursive: true });

    if (await this.fileExists(storagePath)) {
      await rm(mergedFilePath, { force: true });
    } else {
      await rename(mergedFilePath, storagePath);
    }

    return {
      checksum,
      sizeBytes,
      storagePath,
    };
  }

  async generatePreview(
    fileId: string,
    mimeType: string,
    sourcePath: string,
  ): Promise<PreviewResult> {
    if (mimeType.startsWith("image/")) {
      const extension = extname(sourcePath) || ".bin";
      const previewPath = this.getPreviewPath(fileId, extension);

      await mkdir(dirname(previewPath), { recursive: true });
      await copyFile(sourcePath, previewPath);

      return {
        previewPath,
        previewStatus: "ready",
      };
    }

    if (!mimeType.startsWith("video/")) {
      return {
        previewPath: null,
        previewStatus: "none",
      };
    }

    const previewPath = this.getPreviewPath(fileId, ".jpg");

    await mkdir(dirname(previewPath), { recursive: true });

    try {
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const childProcess = spawn(
          "ffmpeg",
          [
            "-y",
            "-i",
            sourcePath,
            "-vf",
            "thumbnail,scale=640:-1",
            "-frames:v",
            "1",
            previewPath,
          ],
          {
            stdio: "ignore",
          },
        );
        const ffmpegTimeout = setTimeout(() => {
          if (!settled) {
            settled = true;
            childProcess.kill("SIGKILL");
            reject(new Error("ffmpeg timed out after 30 seconds"));
          }
        }, 30_000);

        childProcess.once("error", (err) => {
          if (!settled) {
            settled = true;
            clearTimeout(ffmpegTimeout);
            reject(err);
          }
        });
        childProcess.once("exit", (code) => {
          if (!settled) {
            settled = true;
            clearTimeout(ffmpegTimeout);
            if (code === 0) {
              resolve();
              return;
            }
            reject(new Error(`ffmpeg exited with code ${code ?? -1}`));
          }
        });
      });

      return {
        previewPath,
        previewStatus: "ready",
      };
    } catch {
      await rm(previewPath, { force: true });

      return {
        previewPath: null,
        previewStatus: "failed",
      };
    }
  }

  getBlobPath(checksum: string): string {
    return join(
      this.storageRoot,
      checksum.slice(0, 2),
      checksum.slice(2, 4),
      checksum,
    );
  }

  getPreviewPath(fileId: string, extension: string): string {
    return join(
      this.previewRoot,
      fileId.slice(0, 2),
      fileId.slice(2, 4),
      `${fileId}${extension}`,
    );
  }

  getUploadDirectory(uploadId: string): string {
    return join(this.tempUploadRoot, uploadId, "chunks");
  }

  getUploadPartPath(uploadId: string, index: number): string {
    return join(this.getUploadDirectory(uploadId), `${index}.part`);
  }

  async removeUploadDirectory(uploadId: string): Promise<void> {
    await rm(join(this.tempUploadRoot, uploadId), {
      force: true,
      recursive: true,
    });
  }

  async removeFile(filePath: string): Promise<void> {
    await rm(filePath, { force: true });
  }

  async stat(filePath: string): Promise<{ size: number }> {
    const metadata = await stat(filePath);

    return {
      size: metadata.size,
    };
  }

  async writeUploadPart(
    uploadId: string,
    index: number,
    body: Buffer,
  ): Promise<void> {
    const targetPath = this.getUploadPartPath(uploadId, index);

    await mkdir(dirname(targetPath), { recursive: true });
    await rm(targetPath, { force: true });
    await writeFile(targetPath, body);
  }

  ensureReadable(filePath: string): Promise<void> {
    return access(filePath).catch(() => {
      throw new NotFoundError("ファイルが見つかりません。");
    });
  }
}

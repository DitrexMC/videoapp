import type {
  FolderRecord,
  GroupRecord,
  PreviewStatus,
  FileRecord,
} from "../domain/FileRecord.js";

export interface CreateFolderInput {
  createdAt: string;
  id: string;
  name: string;
  ownerUserId: string;
  public: boolean;
  updatedAt: string;
}

export interface CreateGroupInput {
  createdAt: string;
  expiresAt: string | null;
  id: string;
  isPrivate: boolean;
  label: string;
  ownerUserId: string;
  updatedAt: string;
}

export interface CreateFileInput {
  checksum: string;
  createdAt: string;
  expiresAt: string | null;
  folderId: string | null;
  groupId: string | null;
  id: string;
  mimeType: string;
  name: string;
  ownerUserId: string;
  previewPath: string | null;
  previewStatus: PreviewStatus;
  public: boolean;
  safeName: string;
  sizeBytes: number;
  storagePath: string;
  updatedAt: string;
}

export interface FileListFilters {
  cursor?: string;
  folderId?: string;
  groupId?: string;
  limit: number;
  ownerUserId: string;
  status?: FileRecord["status"];
}

export interface FileRepository {
  countFilesInFolder(folderId: string): number;
  createFile(input: CreateFileInput): FileRecord;
  createFolder(input: CreateFolderInput): FolderRecord;
  createGroup(input: CreateGroupInput): GroupRecord;
  deleteFolder(folderId: string, deletedAt: string): void;
  findFileById(fileId: string): FileRecord | null;
  findFolderById(folderId: string): FolderRecord | null;
  findFilesByIds(fileIds: string[]): FileRecord[];
  getStorageUsage(ownerUserId: string): number;
  listFiles(filters: FileListFilters): FileRecord[];
  listFolders(ownerUserId: string): FolderRecord[];
  listGroups(ownerUserId: string): GroupRecord[];
  findGroupById(groupId: string): GroupRecord | null;
  deleteGroup(groupId: string, deletedAt: string): void;
  renameGroup(groupId: string, label: string, updatedAt: string): void;
  updateGroupPrivacy(
    groupId: string,
    isPrivate: boolean,
    updatedAt: string,
  ): void;
  listSafeNames(ownerUserId: string, folderId: string | null): string[];
  renameFile(
    fileId: string,
    name: string,
    safeName: string,
    updatedAt: string,
  ): void;
  renameFile(
    fileId: string,
    name: string,
    safeName: string,
    updatedAt: string,
  ): void;
  renameFolder(folderId: string, name: string, updatedAt: string): void;
  setFileExpiration(
    fileId: string,
    expiresAt: string | null,
    updatedAt: string,
  ): void;
  setFileExpiration(
    fileId: string,
    expiresAt: string | null,
    updatedAt: string,
  ): void;
  softDeleteFile(fileId: string, deletedAt: string): void;
  softDeleteFilesInFolder(folderId: string, deletedAt: string): void;
  countNonDeletedFilesByStoragePath(storagePath: string): number;
  updateFilePreview(
    fileId: string,
    previewPath: string | null,
    previewStatus: PreviewStatus,
    updatedAt: string,
  ): void;
  updateFileShowUploader(
    fileId: string,
    showUploader: boolean,
    updatedAt: string,
  ): void;
  updateFileVisibility(
    fileId: string,
    isPublic: boolean,
    updatedAt: string,
  ): void;
  updateFolderVisibility(
    folderId: string,
    isPublic: boolean,
    updatedAt: string,
  ): void;
}

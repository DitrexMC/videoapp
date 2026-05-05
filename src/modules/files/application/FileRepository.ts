import type { FolderRecord, GroupRecord, PreviewStatus, FileRecord } from "../domain/FileRecord.js";

export interface CreateFolderInput {
  createdAt: string;
  id: string;
  name: string;
  ownerUserId: string;
  public: boolean;
  updatedAt: string;
}

export interface FileListFilters {
  cursor?: string;
  folderId?: string;
  limit: number;
  ownerUserId: string;
  status?: FileRecord["status"];
}

export interface FileRepository {
  countFilesInFolder(folderId: string): number;
  createFolder(input: CreateFolderInput): FolderRecord;
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
  updateGroupPrivacy(groupId: string, isPrivate: boolean, updatedAt: string): void;
  listSafeNames(ownerUserId: string, folderId: string | null): string[];
  renameFolder(folderId: string, name: string, updatedAt: string): void;
  softDeleteFile(fileId: string, deletedAt: string): void;
  softDeleteFilesInFolder(folderId: string, deletedAt: string): void;
  updateFilePreview(fileId: string, previewPath: string | null, previewStatus: PreviewStatus, updatedAt: string): void;
  updateFileVisibility(fileId: string, isPublic: boolean, updatedAt: string): void;
  updateFolderVisibility(folderId: string, isPublic: boolean, updatedAt: string): void;
}
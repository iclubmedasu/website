import type { Id } from '@/types/backend-contracts';

export interface EntityFileRef {
    id: Id | string;
    fileName: string;
    folderId?: Id | null;
    mimeType?: string;
    fileSize?: number;
    isActive?: boolean;
    createdAt?: string;
    updatedAt?: string;
    uploadedBy?: { id: Id | string; fullName?: string; profilePhotoUrl?: string | null };
    folder?: EntityFolderRef;
}

export interface EntityFolderRef {
    id: Id | string;
    folderName: string;
    githubPath?: string;
    isActive?: boolean;
    files?: { id: Id | string }[];
}

export interface EntityFileCommentRef {
    id: Id | string;
    fileId: Id | string;
    memberId: Id | string;
    comment: string;
    isEdited?: boolean;
    createdAt?: string;
    updatedAt?: string;
    member?: { id: Id | string; fullName?: string; profilePhotoUrl?: string | null };
}

export interface EntityFileHistoryEntry {
    sha: string;
    message: string;
    date: string;
    author: string;
}

export interface EntityFilesAPI {
    getAll: (entityId: Id | string) => Promise<EntityFileRef[]>;
    getFolders: (entityId: Id | string, includeDeleted?: boolean) => Promise<EntityFolderRef[]>;
    createFolder: (entityId: Id | string, folderName: string, createdByMemberId: Id | string) => Promise<EntityFolderRef>;
    removeFolder: (folderId: Id | string) => Promise<{ success?: boolean; message?: string }>;
    restoreFolder: (folderId: Id | string) => Promise<{ success?: boolean; message?: string } | EntityFolderRef>;
    getFolderHistory: (folderId: Id | string) => Promise<EntityFileHistoryEntry[]>;
    renameFolder: (folderId: Id | string, folderName: string) => Promise<EntityFolderRef>;
    upload: (
        entityId: Id | string,
        uploadedByMemberId: Id | string,
        file: File,
        onProgress?: (progress: number) => void,
        folderId?: Id | string | null,
    ) => Promise<EntityFileRef>;
    remove: (fileId: Id | string) => Promise<{ success?: boolean; message?: string }>;
    getHistory: (fileId: Id | string) => Promise<EntityFileHistoryEntry[]>;
    getComments: (fileId: Id | string) => Promise<EntityFileCommentRef[]>;
    addComment: (fileId: Id | string, comment: string) => Promise<EntityFileCommentRef>;
    editComment: (fileId: Id | string, commentId: Id | string, comment: string) => Promise<EntityFileCommentRef>;
    deleteComment: (fileId: Id | string, commentId: Id | string) => Promise<{ success?: boolean; message?: string }>;
    download: (fileId: Id | string, fileName: string) => Promise<void>;
    downloadVersion: (fileId: Id | string, commitSha: string, fileName: string) => Promise<void>;
    rename: (fileId: Id | string, fileName: string) => Promise<EntityFileRef>;
    move: (fileId: Id | string, folderId: Id | string | null) => Promise<EntityFileRef>;
    getDeleted: (entityId: Id | string) => Promise<EntityFileRef[]>;
    restore: (fileId: Id | string) => Promise<EntityFileRef>;
}

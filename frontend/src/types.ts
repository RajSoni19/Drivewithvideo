export type User = {
  id: string;
  email: string;
  createdAt: string;
};

export type FolderTreeNode = {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  children: FolderTreeNode[];
};

export type FolderRecord = {
  id: string;
  userId: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VideoRecord = {
  id: string;
  userId: string;
  folderId: string | null;
  title: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  status: 'UPLOADING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
  bunnyLibraryId: number;
  bunnyVideoId: string | null;
  bunnyVideoStatus: number | null;
  bunnyEncodeProgress: number | null;
  playbackUrl: string | null;
  embedUrl: string | null;
  thumbnailUrl: string | null;
  errorMessage: string | null;
  uploadedAt: string | null;
  processingStartedAt: string | null;
  processedAt: string | null;
  failedAt: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FolderContentsResponse = {
  currentFolder: { id: string | 'root'; name: string };
  breadcrumb: Array<{ id: string | 'root'; name: string }>;
  folders: FolderRecord[];
  videos: VideoRecord[];
};

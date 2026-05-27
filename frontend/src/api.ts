import type { FolderContentsResponse, FolderTreeNode, User, VideoRecord } from './types';

const apiBase = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '/api';

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const requestUrl = `${apiBase}${path}`;
  const response = await fetch(requestUrl, {
    credentials: 'include',
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init?.headers ?? {})
    },
    ...init
  });

  const text = await response.text();
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  const isJson = contentType.includes('application/json');
  const data = text && isJson ? JSON.parse(text) : null;

  if (text && !isJson) {
    throw new Error(
      `API returned non-JSON response (${response.status}) from ${requestUrl}. Check VITE_API_URL and backend deployment URL.`
    );
  }

  if (!response.ok) {
    const message = data?.error || data?.message || `Request failed with ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

export async function getSessionUser() {
  const requestUrl = `${apiBase}/auth/me`;
  const response = await fetch(requestUrl, { credentials: 'include' });
  if (!response.ok) {
    throw new Error('Not signed in');
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error(`API returned non-JSON response from ${requestUrl}. Check VITE_API_URL.`);
  }

  const data = (await response.json()) as { user: User };
  return data.user;
}

export function signIn(email: string, password: string) {
  return requestJson<{ user: User }>('/auth/signin', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
}

export function signUp(email: string, password: string) {
  return requestJson<{ user: User }>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
}

export function signOut() {
  return requestJson<{ ok: boolean }>('/auth/logout', { method: 'POST' });
}

export function getTree() {
  return requestJson<{ tree: FolderTreeNode[] }>('/folders/tree');
}

export function getContents(folderId: string | 'root') {
  return requestJson<FolderContentsResponse>(`/folders/${folderId}/contents`);
}

export function createFolder(name: string, parentId: string | null) {
  return requestJson<{ folder: unknown }>('/folders', {
    method: 'POST',
    body: JSON.stringify({ name, parentId })
  });
}

export async function uploadVideo(
  folderId: string | 'root',
  title: string,
  file: File,
  onProgress?: (progress: number) => void
) {
  return new Promise<{ video: VideoRecord }>((resolve, reject) => {
    const formData = new FormData();
    formData.append('folderId', folderId);
    formData.append('title', title);
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${apiBase}/videos/upload`);
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      try {
        const data = xhr.responseText ? (JSON.parse(xhr.responseText) as { video: VideoRecord; error?: string; message?: string }) : null;

        if (xhr.status >= 200 && xhr.status < 300 && data) {
          resolve({ video: data.video });
          return;
        }

        const message = data?.error || data?.message || `Upload failed with ${xhr.status}`;
        reject(new Error(message));
      } catch {
        reject(new Error(`Upload failed with ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Upload failed'));
    };

    xhr.send(formData);
  });
}

export function syncVideo(videoId: string) {
  return requestJson<{ video: VideoRecord }>(`/videos/${videoId}/sync`, { method: 'POST' });
}

export function getVideo(videoId: string) {
  return requestJson<{ video: VideoRecord }>(`/videos/${videoId}`);
}

export function getVideoPlay(videoId: string) {
  return requestJson<{ playbackUrl: string; embedUrl: string; thumbnailUrl: string | null; ready: boolean }>(`/videos/${videoId}/play`);
}

export function deleteVideo(videoId: string) {
  return requestJson<{ ok: boolean }>(`/videos/${videoId}`, { method: 'DELETE' });
}

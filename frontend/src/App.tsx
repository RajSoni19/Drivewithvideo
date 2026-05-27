import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  Home,
  LoaderCircle,
  Play,
  Search,
  Sparkles,
  Upload,
  Video,
  XCircle,
} from 'lucide-react';
import {
  createFolder,
  getContents,
  getSessionUser,
  getTree,
  getVideoPlay,
  deleteVideo,
  uploadVideo,
  signIn,
  signOut,
  signUp,
  syncVideo,
} from './api';
import type { FolderContentsResponse, FolderTreeNode, User, VideoRecord } from './types';

type AuthMode = 'signin' | 'signup';

const rootFolderId = 'root';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let active = true;
    getSessionUser()
      .then((currentUser) => {
        if (active) {
          setUser(currentUser);
        }
      })
      .catch(() => {
        if (active) {
          setUser(null);
        }
      })
      .finally(() => {
        if (active) {
          setBooting(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (booting) {
    return <BootScreen />;
  }

  return user ? (
    <Routes>
      <Route path="/" element={<DriveRoute user={user} onSignOut={() => setUser(null)} />} />
      <Route path="/folder/:folderId" element={<DriveRoute user={user} onSignOut={() => setUser(null)} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  ) : (
    <AuthScreen onAuthenticated={setUser} />
  );
}

function DriveRoute({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const params = useParams();
  const folderId = params.folderId ?? rootFolderId;

  return <DriveShell user={user} folderId={folderId} onSignOut={onSignOut} />;
}

function BootScreen() {
  return (
    <div className="boot-screen">
      <div className="boot-card">
        <div className="brand-mark" />
        <div>
          <p className="eyebrow">Drive</p>
          <h1>Loading your workspace</h1>
          <p className="muted">Preparing folders, auth, and Bunny Stream sync.</p>
        </div>
      </div>
    </div>
  );
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setWorking(true);

    try {
      const result = mode === 'signin' ? await signIn(email, password) : await signUp(email, password);
      onAuthenticated(result.user);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Authentication failed');
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-hero">
        <h1>Video folders that feel simple, fast, and accountable.</h1>
        <p>
          Sign in, create nested folders, upload videos, and watch the status move from uploading to processing to
          ready to play. 
        </p>
      </section>

      <section className="auth-card">
        <div className="auth-tabs">
          <button className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')} type="button">
            Sign in
          </button>
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')} type="button">
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" />
          </label>
          {error ? <div className="inline-error">{error}</div> : null}
          <button type="submit" className="primary-button" disabled={working}>
            {working ? 'Working...' : mode === 'signin' ? 'Sign in to Drive' : 'Create account'}
          </button>
        </form>
      </section>
    </div>
  );
}

function DriveShell({ user, folderId, onSignOut }: { user: User; folderId: string; onSignOut: () => void }) {
  const navigate = useNavigate();
  const currentFolderId = folderId === 'root' ? rootFolderId : folderId;
  const [tree, setTree] = useState<FolderTreeNode[]>([]);
  const [contents, setContents] = useState<FolderContentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [folderName, setFolderName] = useState('');
  const [folderError, setFolderError] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoRecord | null>(null);
  const [playback, setPlayback] = useState<{ embedUrl: string; playbackUrl: string; thumbnailUrl: string | null; ready: boolean } | null>(null);
  const [loadError, setLoadError] = useState('');
  const [searchValue, setSearchValue] = useState('');

  async function loadData(silent = false) {
    if (!silent) setLoading(true);
    setLoadError('');
    try {
      const [treeResponse, contentsResponse] = await Promise.all([getTree(), getContents(currentFolderId)]);
      setTree(treeResponse.tree);
      setContents(contentsResponse);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load folders and videos');
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [currentFolderId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadData(true);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [currentFolderId]);

  async function handleCreateFolder() {
    const name = folderName.trim();
    if (!name) {
      setFolderError('Folder name is required');
      return;
    }

    setFolderError('');
    setCreatingFolder(true);

    try {
      await createFolder(name, currentFolderId === rootFolderId ? null : currentFolderId);
      setFolderName('');
      await loadData();
    } catch (createError) {
      setFolderError(createError instanceof Error ? createError.message : 'Unable to create folder');
    } finally {
      setCreatingFolder(false);
    }
  }

  async function handleUpload(file: File, title: string) {
    setUploading(true);
    setUploadProgress(0);
    setUploadError('');

    try {
      const result = await uploadVideo(currentFolderId, title, file, setUploadProgress);

      setUploadProgress(100);
      const refreshedVideo = await syncVideo(result.video.id).catch(() => null);
      setSelectedVideo(refreshedVideo?.video ?? result.video);
      setPlayback(null);
      await loadData();
    } catch (uploadFailure) {
      setUploadError(uploadFailure instanceof Error ? uploadFailure.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteVideo(videoId: string) {
    if (!window.confirm('Delete this video? This action cannot be undone.')) return;
    try {
      await deleteVideo(videoId);
      await loadData();
      setSelectedVideo((s) => (s && s.id === videoId ? null : s));
      setPlayback(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to delete video');
    }
  }

  async function openVideo(video: VideoRecord) {
    setSelectedVideo(video);
    try {
      const playData = await getVideoPlay(video.id);
      setPlayback(playData);
    } catch {
      setPlayback(null);
    }
  }

  async function handleSignOut() {
    await signOut();
    onSignOut();
  }

  const visibleFolders = (contents?.folders ?? []).filter((folder) => folder.name.toLowerCase().includes(searchValue.toLowerCase()));
  const visibleVideos = (contents?.videos ?? []).filter((video) =>
    `${video.title} ${video.originalFileName}`.toLowerCase().includes(searchValue.toLowerCase())
  );
  const processingCount = (contents?.videos ?? []).filter((video) => video.status === 'PROCESSING' || video.status === 'UPLOADING').length;
  const readyCount = (contents?.videos ?? []).filter((video) => video.status === 'SUCCESS').length;
  const failedCount = (contents?.videos ?? []).filter((video) => video.status === 'FAILED').length;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-header premium">
          <div>
            <p className="eyebrow">Drive</p>
            <h2>{user.email}</h2>
          </div>
          <div className="brand-orb" aria-hidden="true">
            <Sparkles size={16} />
          </div>
        </div>

        <div className="sidebar-actions">
          <button className="ghost-button" type="button" onClick={handleSignOut}>
            Logout
          </button>
          <button className="primary-button full-width" type="button" onClick={() => navigate(`/folder/${rootFolderId}`)}>
            <Home size={16} />
            All files
          </button>
        </div>

        <FolderTreeView nodes={tree} activeId={currentFolderId} onOpen={(folderId) => navigate(`/folder/${folderId}`)} />
      </aside>

      <main className="workspace">
        <header className="topbar premium">
          <div>
            <p className="eyebrow">Current folder</p>
            <h1>{contents?.currentFolder.name ?? 'All files'}</h1>
            <Breadcrumbs items={contents?.breadcrumb ?? [{ id: 'root', name: 'All files' }]} onNavigate={(folderId) => navigate(folderId === 'root' ? `/folder/${rootFolderId}` : `/folder/${folderId}`)} />
          </div>

          <div className="toolbar">
            <label className="search-shell">
              <Search size={16} />
              <input placeholder="Search folders and videos..." value={searchValue} onChange={(event) => setSearchValue(event.target.value)} />
            </label>
            <button className="secondary-button glow-button" type="button" onClick={() => setUploadDialogOpen(true)}>
              <Upload size={16} />
              Upload video
            </button>
          </div>
        </header>

        <section className="stats-grid">
          <StatsCard icon={<Video size={16} />} label="Total videos" value={String(contents?.videos.length ?? 0)} tone="indigo" />
          <StatsCard icon={<LoaderCircle size={16} />} label="Processing" value={String(processingCount)} tone="amber" />
          <StatsCard icon={<FolderKanban size={16} />} label="Folders" value={String(contents?.folders.length ?? 0)} tone="cyan" />
          <StatsCard icon={<CheckCircle2 size={16} />} label="Ready" value={String(readyCount)} tone="purple" />
          <StatsCard icon={<XCircle size={16} />} label="Failed" value={String(failedCount)} tone="rose" />
        </section>

        <section className="composer-panel">
          <div>
            <p className="eyebrow">New folder</p>
            <h3>Create a nested folder</h3>
            <p className="muted">Folders can be nested as deeply as you need. No rename or move flows, just the minimum surface.</p>
          </div>
          <div className="composer-row">
            <input value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="Folder name" />
            <button type="button" className="primary-button" onClick={handleCreateFolder} disabled={creatingFolder}>
              {creatingFolder ? 'Creating...' : 'Create folder'}
            </button>
          </div>
          {folderError ? <div className="inline-error">{folderError}</div> : null}
        </section>

        {loading ? <div className="loading-state">Refreshing contents...</div> : null}

        <section className="grid-section">
          {loadError ? <div className="inline-error">{loadError}</div> : null}
          <SectionTitle title="Folders" count={visibleFolders.length} />
          <div className="folder-grid">
            {visibleFolders.map((folder) => (
              <motion.button layout whileHover={{ y: -4 }} className="folder-card premium" type="button" key={folder.id} onClick={() => navigate(`/folder/${folder.id}`)}>
                <span className="folder-icon">⌁</span>
                <strong>{folder.name}</strong>
                <span>Updated {formatDate(folder.updatedAt)}</span>
              </motion.button>
            ))}
            {!visibleFolders.length ? <EmptyState title="No folders yet" description="Create a folder to start organizing uploads." /> : null}
          </div>
        </section>

        <section className="grid-section">
          <SectionTitle title="Videos" count={visibleVideos.length} />
            <div className="video-grid">
            {visibleVideos.map((video) => (
              <VideoCard key={video.id} video={video} onPlay={() => void openVideo(video)} onDelete={() => void handleDeleteVideo(video.id)} />
            ))}
            {!visibleVideos.length ? <EmptyState title="No videos in this folder" description="Upload a video to Bunny Stream and watch its status update here." /> : null}
          </div>
        </section>
      </main>

      <AnimatePresence>
        {uploadDialogOpen ? (
          <UploadModal
            folderName={contents?.currentFolder.name ?? 'All files'}
            busy={uploading}
            progress={uploadProgress}
            error={uploadError}
            onClose={() => setUploadDialogOpen(false)}
            onUpload={handleUpload}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {selectedVideo ? (
          <VideoModal
            video={selectedVideo}
            playback={playback}
            onClose={() => {
              setSelectedVideo(null);
              setPlayback(null);
            }}
            onRefresh={() => void (async () => {
              const refreshed = await syncVideo(selectedVideo.id);
              setSelectedVideo(refreshed.video);
              setPlayback(await getVideoPlay(selectedVideo.id).catch(() => playback));
              await loadData();
            })()}
            onDelete={() => {
              void (async () => {
                await handleDeleteVideo(selectedVideo.id);
              })();
            }}
          />
        ) : null}
      </AnimatePresence>
      <nav className="mobile-nav">
        <button type="button" onClick={() => navigate(`/folder/${rootFolderId}`)}>
          <Home size={16} />
          Home
        </button>
        <button type="button" onClick={() => setUploadDialogOpen(true)}>
          <Upload size={16} />
          Upload
        </button>
        <button type="button" onClick={handleSignOut}>
          <XCircle size={16} />
          Logout
        </button>
      </nav>
    </div>
  );
}

function FolderTreeView({ nodes, activeId, onOpen }: { nodes: FolderTreeNode[]; activeId: string; onOpen: (folderId: string) => void }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleNode = (id: string) => setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  return (
    <div className="tree-root">
      <button className={activeId === rootFolderId ? 'tree-item active' : 'tree-item'} type="button" onClick={() => onOpen(rootFolderId)}>
        <div className="folder-chip">All files</div>
      </button>
      {nodes.map((node) => (
        <TreeBranch key={node.id} node={node} activeId={activeId} onOpen={onOpen} depth={0} collapsed={collapsed} onToggle={toggleNode} />
      ))}
    </div>
  );
}

function TreeBranch({
  node,
  activeId,
  onOpen,
  depth,
  collapsed,
  onToggle
}: {
  node: FolderTreeNode;
  activeId: string;
  onOpen: (folderId: string) => void;
  depth: number;
  collapsed: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsed[node.id] ?? false;

  return (
    <div className="tree-branch">
      <button className={activeId === node.id ? 'tree-item active' : 'tree-item'} type="button" onClick={() => onOpen(node.id)} style={{ paddingLeft: 14 + depth * 12 }}>
        {hasChildren ? (
          <span
            className="tree-expand"
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              onToggle(node.id);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onToggle(node.id);
              }
            }}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </span>
        ) : (
          <span className="tree-expand empty" />
        )}
        <div className="folder-chip">{node.name}</div>
      </button>
      {!isCollapsed
        ? node.children.map((child) => (
            <TreeBranch key={child.id} node={child} activeId={activeId} onOpen={onOpen} depth={depth + 1} collapsed={collapsed} onToggle={onToggle} />
          ))
        : null}
    </div>
  );
}

function Breadcrumbs({ items, onNavigate }: { items: Array<{ id: string | 'root'; name: string }>; onNavigate: (folderId: string | 'root') => void }) {
  return (
    <div className="breadcrumbs">
      {items.map((item, index) => (
        <span key={`${item.id}-${index}`}>
          <button type="button" onClick={() => onNavigate(item.id)}>
            {item.name}
          </button>
          {index < items.length - 1 ? <ChevronRight size={14} /> : null}
        </span>
      ))}
    </div>
  );
}

function SectionTitle({ title, count }: { title: string; count: number }) {
  return (
    <div className="section-title">
      <h3>{title}</h3>
      <span>{count} items</span>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty-state">
      <div className="empty-illustration" aria-hidden="true">
        <FolderKanban size={20} />
      </div>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function StatsCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: 'indigo' | 'amber' | 'cyan' | 'purple' | 'rose' }) {
  return (
    <motion.article layout whileHover={{ y: -4 }} className={`stats-card ${tone}`}>
      <div className="stats-label">
        <span>{icon}</span>
        <p>{label}</p>
      </div>
      <strong>{value}</strong>
    </motion.article>
  );
}

function statusLabel(status: VideoRecord['status']) {
  switch (status) {
    case 'UPLOADING':
      return 'Uploading';
    case 'PROCESSING':
      return 'Processing';
    case 'SUCCESS':
      return 'Ready';
    case 'FAILED':
      return 'Failed';
  }
}

function statusTone(status: VideoRecord['status']) {
  switch (status) {
    case 'UPLOADING':
      return 'uploading';
    case 'PROCESSING':
      return 'processing';
    case 'SUCCESS':
      return 'success';
    case 'FAILED':
      return 'failed';
  }
}

function VideoCard({ video, onPlay, onDelete }: { video: VideoRecord; onPlay: () => void; onDelete: () => void }) {
  const progress = video.status === 'PROCESSING' ? Math.max(1, video.bunnyEncodeProgress ?? 10) : video.status === 'SUCCESS' ? 100 : video.status === 'FAILED' ? 0 : 20;

  return (
    <motion.article layout whileHover={{ y: -5 }} className="video-card premium">
      <div className="video-thumb" style={{ backgroundImage: video.thumbnailUrl ? `url(${video.thumbnailUrl})` : 'none' }}>
        <button className="play-overlay" type="button" onClick={onPlay} disabled={video.status !== 'SUCCESS'}>
          <Play size={18} />
        </button>
        <div className={`status-pill ${statusTone(video.status)}`}>{statusLabel(video.status)}</div>
      </div>
      <div className="video-meta">
        <div>
          <h4>{video.title}</h4>
          <p>{video.originalFileName}</p>
        </div>
        <span className="muted small">{formatBytes(video.sizeBytes)}</span>
      </div>
      <div className="progress-shell">
        <div className="progress-bar" style={{ width: `${progress}%` }} />
      </div>
      <div className="video-actions">
        <span className="muted small">
          {video.status === 'SUCCESS'
            ? `Playable now • ${formatDate(video.updatedAt)}`
            : video.status === 'FAILED'
              ? video.errorMessage ?? 'Processing failed'
              : 'Waiting on Bunny'}
        </span>
        <div>
          <button className="secondary-button" type="button" onClick={onPlay} disabled={video.status !== 'SUCCESS'}>
            Play
          </button>
          <button className="ghost-button" type="button" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>
    </motion.article>
  );
}

function UploadModal({ folderName, busy, progress, error, onClose, onUpload }: { folderName: string; busy: boolean; progress: number; error: string; onClose: () => void; onUpload: (file: File, title: string) => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) {
        onClose();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <motion.div className="modal-backdrop" onClick={busy ? undefined : onClose} role="presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="modal-panel" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">Upload to {folderName}</p>
            <h3>Send a video to Bunny Stream</h3>
          </div>
          <button className="ghost-button" type="button" onClick={onClose} disabled={busy}>
            Close
          </button>
        </div>

        <label>
          Title
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="My summer demo" />
        </label>

        <label
          className={dragActive ? 'dropzone active' : 'dropzone'}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            setFile(event.dataTransfer.files?.[0] ?? null);
          }}
        >
          <input type="file" accept="video/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          <strong>{file ? file.name : 'Choose a video file'}</strong>
          <span>{file ? formatBytes(file.size) : 'MP4, MOV, or another browser-supported video file'}</span>
        </label>

        {error ? <div className="inline-error">{error}</div> : null}
        {busy ? (
          <div className="upload-progress-block">
            <div className="progress-shell">
              <div className="progress-bar" style={{ width: `${progress}%` }} />
            </div>
            <span className="muted small">Uploading to Bunny Stream: {progress}%</span>
            <div className="status-row">
              <StatusChip status={progress < 100 ? 'UPLOADING' : 'PROCESSING'} />
            </div>
          </div>
        ) : null}

        <div className="modal-actions">
          <button className="ghost-button" type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={busy || !file}
            onClick={async () => {
              if (file) {
                try {
                  await onUpload(file, title || file.name.replace(/\.[^.]+$/, ''));
                  onClose();
                } catch {
                  // The error is surfaced by the parent state.
                }
              }
            }}
          >
            {busy ? 'Uploading...' : 'Upload video'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function VideoModal({ video, playback, onClose, onRefresh, onDelete }: { video: VideoRecord; playback: { embedUrl: string; playbackUrl: string; thumbnailUrl: string | null; ready: boolean } | null; onClose: () => void; onRefresh: () => void; onDelete?: () => void }) {
  const iframeUrl = playback?.embedUrl || video.embedUrl || '';

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <motion.div className="modal-backdrop" onClick={onClose} role="presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="video-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">{statusLabel(video.status)}</p>
            <h3>{video.title}</h3>
          </div>
          <div className="modal-actions">
            <button className="secondary-button" type="button" onClick={onRefresh}>
              Sync now
            </button>
            {onDelete ? (
              <button className="ghost-button" type="button" onClick={onDelete}>
                Delete
              </button>
            ) : null}
            <button className="ghost-button" type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        {video.status === 'SUCCESS' && iframeUrl ? (
          <div className="player-shell">
            <iframe
              title={video.title}
              src={iframeUrl}
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="player-placeholder">
            <strong>{statusLabel(video.status)}</strong>
            <p>{video.status === 'FAILED' ? video.errorMessage ?? 'Bunny reported a failure.' : 'The video is still processing. Webhooks and polling keep the status updated.'}</p>
          </div>
        )}

        <div className="detail-grid">
          <Detail label="Original file" value={video.originalFileName} />
          <Detail label="Size" value={formatBytes(video.sizeBytes)} />
          <Detail label="Bunny video id" value={video.bunnyVideoId ?? 'Pending'} />
          <Detail label="Last synced" value={video.lastSyncedAt ? new Date(video.lastSyncedAt).toLocaleString() : 'Never'} />
          <Detail label="Uploaded" value={video.uploadedAt ? new Date(video.uploadedAt).toLocaleString() : 'Pending'} />
        </div>
      </motion.div>
    </motion.div>
  );
}

function StatusChip({ status }: { status: VideoRecord['status'] }) {
  const tone = statusTone(status);
  const icon =
    status === 'SUCCESS' ? <CheckCircle2 size={14} /> : status === 'FAILED' ? <XCircle size={14} /> : status === 'PROCESSING' ? <LoaderCircle size={14} className="spin" /> : <Upload size={14} />;
  return (
    <span className={`status-chip ${tone}`}>
      {icon}
      {statusLabel(status)}
    </span>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatBytes(bytes: number) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

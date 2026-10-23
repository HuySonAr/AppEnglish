import { useEffect, useRef, useState } from 'react';
import { deleteMedia, uploadMedia } from '../api/content-api.js';
import { uploadPending } from '../lib/lesson-draft.js';

export function useDraftMedia({ edit, sectionFor, lessonId }) {
  const [pending, setPending] = useState({});
  const [stored, setStored] = useState({});
  const [fileNames, setFileNames] = useState({});
  const [uploading, setUploading] = useState(new Set());
  const [failed, setFailed] = useState({});
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  useEffect(
    () => () =>
      Object.values(pendingRef.current).forEach((item) => URL.revokeObjectURL(item.url)),
    [],
  );

  function forget(ids) {
    setPending((current) => {
      const next = { ...current };
      for (const id of ids) {
        if (next[id]) URL.revokeObjectURL(next[id].url);
        delete next[id];
      }
      return next;
    });
  }

  function rememberFileNames(assets) {
    setFileNames((names) => ({
      ...names,
      ...Object.fromEntries(assets.map((asset) => [asset.id, asset.fileName])),
    }));
  }

  const media = {
    fileNames,
    pending,
    stored,
    uploading,
    failed,
    clear(path, mediaId) {
      edit(path, null);
      if (pending[mediaId]) forget([mediaId]);
      else deleteMedia(mediaId).catch(() => {});
    },
    choose(kind, file, path) {
      const temporaryId = crypto.randomUUID();
      setPending((current) => ({
        ...current,
        [temporaryId]: { kind, file, section: sectionFor(path), url: URL.createObjectURL(file) },
      }));
      edit(path, temporaryId);
    },
  };

  async function uploadAll(content) {
    const idOf = (item) => Object.keys(pending).find((id) => pending[id] === item);
    setFailed({});
    const result = await uploadPending(content, pending, async (item) => {
      const { kind, file, section } = item;
      const id = idOf(item);
      setUploading((current) => new Set([...current, id]));
      try {
        return (await uploadMedia({ kind, file, lessonId, section })).data.media;
      } catch (error) {
        error.fileName = file.name;
        setFailed((current) => ({ ...current, [id]: error?.response?.data?.data?.reason === 'MEDIA_FILE_TOO_LARGE' ? 'Larger than the upload limit' : 'Upload failed' }));
        throw error;
      } finally {
        setUploading((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      }
    });
    const done = Object.entries(result.uploaded);
    if (done.length) {
      rememberFileNames(done.map(([, uploaded]) => uploaded));
      forget(done.map(([temporaryId]) => temporaryId));
    }
    return { content: result.content, uploadedAny: done.length > 0, error: result.error };
  }

  return {
    media,
    setStored,
    rememberFileNames,
    uploadAll,
    reset: () => forget(Object.keys(pendingRef.current)),
  };
}

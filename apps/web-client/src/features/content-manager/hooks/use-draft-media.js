import { useEffect, useRef, useState } from 'react';
import { deleteMedia, uploadMedia } from '../api/content-api.js';
import { uploadPending } from '../lib/lesson-draft.js';

// Files of a draft being edited. A chosen file stays in the browser (with a
// preview) until the draft is saved; uploadAll then uploads what the content
// still uses.
//   edit(path, value)  sets one field of the content
//   sectionFor(path)   storage section of the field at that path
//   lessonId           lesson the files belong to (none for placement)
export function useDraftMedia({ edit, sectionFor, lessonId }) {
  // Chosen but not uploaded yet, by temporary id: { kind, file, section, url }.
  const [pending, setPending] = useState({});
  // Files the saved content uses, by media id: { kind, fileName, url }.
  const [stored, setStored] = useState({});
  // Names of files uploaded in this session; saved content only holds ids.
  const [fileNames, setFileNames] = useState({});
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  // Previews are released when the page is left.
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

  // What MediaField needs.
  const media = {
    fileNames,
    pending,
    stored,
    // A file that was never uploaded is just dropped. Removing a stored file
    // also deletes it unless a saved version still uses it; in that case the
    // server deletes it when the draft is saved.
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

  // Uploads the chosen files the content still uses. Returns the content with
  // the real media ids, whether anything was uploaded, and the error of the
  // upload that failed (its fileName says which file).
  async function uploadAll(content) {
    const result = await uploadPending(content, pending, async ({ kind, file, section }) => {
      try {
        return (await uploadMedia({ kind, file, lessonId, section })).data.media;
      } catch (error) {
        error.fileName = file.name;
        throw error;
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
    // After a successful save nothing chosen is left to upload.
    reset: () => forget(Object.keys(pendingRef.current)),
  };
}

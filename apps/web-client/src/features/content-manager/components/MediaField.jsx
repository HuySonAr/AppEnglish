import { MEDIA_MAX_FILE_SIZE_BYTES, MediaKind } from '@appenglish/content-contracts';
import { FileDropzone } from '../../../components/shared/FileDropzone.jsx';
import { FileRow } from '../../../components/shared/FileRow.jsx';
import { Label } from '../../../components/ui';
import { useReadOnly } from './ReadOnly.jsx';

const audioAccept = '.mp3,.mp4,.m4a,audio/mpeg,audio/mp4,video/mp4,audio/x-m4a';
const imageAccept = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';

export function MediaField({ id, label, kind, path, mediaId, media, audioRef }) {
  const readOnly = useReadOnly();
  const chosen = media.pending?.[mediaId];
  const url = chosen?.url || media.stored?.[mediaId]?.url;
  const audio = kind === MediaKind.AUDIO;
  const status = media.failed?.[mediaId] ? 'failed' : media.uploading?.has?.(mediaId) ? 'uploading' : chosen ? 'pending' : 'done';
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {mediaId ? (
        <FileRow
          name={chosen?.file.name || media.fileNames?.[mediaId] || media.stored?.[mediaId]?.fileName || `${audio ? 'Audio' : 'Image'} attached`}
          type={chosen?.file.type}
          sizeBytes={chosen?.file.size}
          status={status}
          error={media.failed?.[mediaId]}
          note={status === 'done' ? 'Uploaded' : undefined}
          onRemove={readOnly ? undefined : () => media.clear(path, mediaId)}
        >
          {url && audio ? <audio ref={audioRef} controls src={url} className="w-full" /> : null}
          {url && !audio ? <img src={url} alt="" className="max-h-48 rounded-md" /> : null}
        </FileRow>
      ) : readOnly ? (
        <p id={id} className="rounded-xl border border-dashed px-3 py-2.5 text-sm text-muted-foreground">
          No {audio ? 'recording' : 'picture'}.
        </p>
      ) : (
        <FileDropzone
          id={id}
          compact
          accept={audio ? audioAccept : imageAccept}
          kindLabel={audio ? 'MP3, MP4 or M4A' : 'JPEG, PNG or WebP'}
          maxBytes={MEDIA_MAX_FILE_SIZE_BYTES}
          title={audio ? 'Drag a recording here' : 'Drag a picture here'}
          onFile={(file) => media.choose(kind, file, path)}
        />
      )}
    </div>
  );
}

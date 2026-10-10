import { MediaKind } from '@appenglish/content-contracts';
import { Button, Input, Label } from '../../../components/ui';

const audioAccept = '.mp3,.mp4,.m4a,audio/mpeg,audio/mp4,video/mp4,audio/x-m4a';
const imageAccept = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';

// File control for one media reference. media = { choose(kind, file, path),
// clear(path, mediaId), fileNames, pending, stored } from the page. A chosen
// file is only previewed; it is uploaded when the lesson is saved. Stored
// files can be played or viewed again when they have a delivery URL.
export function MediaField({ id, label, kind, path, mediaId, media }) {
  const chosen = media.pending[mediaId];
  const url = chosen?.url || media.stored[mediaId]?.url;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {mediaId ? (
        <div className="space-y-2 rounded-md border border-border p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="truncate">
              {chosen?.file.name || media.fileNames[mediaId] || media.stored[mediaId]?.fileName || `${kind === MediaKind.AUDIO ? 'Audio' : 'Image'} attached`}
            </span>
            <Button variant="ghost" size="sm" onClick={() => media.clear(path, mediaId)}>Remove</Button>
          </div>
          {url && kind === MediaKind.AUDIO ? <audio controls src={url} className="w-full" /> : null}
          {url && kind === MediaKind.IMAGE ? <img src={url} alt="" className="max-h-48 rounded-md" /> : null}
          {chosen ? <p className="text-muted-foreground">Preview only — uploaded when you save.</p> : null}
        </div>
      ) : (
        <Input
          id={id}
          type="file"
          accept={kind === MediaKind.AUDIO ? audioAccept : imageAccept}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) media.choose(kind, file, path);
          }}
        />
      )}
    </div>
  );
}

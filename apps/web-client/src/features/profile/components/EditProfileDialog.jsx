import { useEffect, useState } from 'react';
import { Trash2, Undo2 } from 'lucide-react';
import { PROFILE_LIMITS, displayNameOf } from '@appenglish/auth-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '../../../components/ui';
import { Avatar } from '../../../components/shared/Avatar.jsx';
import { FileDropzone } from '../../../components/shared/FileDropzone.jsx';
import { removeAvatar, updateProfile, uploadAvatar } from '../../auth/api/auth-api.js';
import { avatarFileIssue, normalizeDisplayName, prepareAvatar } from '../lib/avatar.js';

// Name and picture in one dialog (D113). A chosen picture is only previewed;
// nothing reaches the server until Save. Cancel drops every pending change.
export function EditProfileDialog({ open, onOpenChange, account, onSaved }) {
  const [name, setName] = useState('');
  const [picture, setPicture] = useState({ file: null, url: null, remove: false });
  const [preparing, setPreparing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Start from the account each time the dialog opens; free the preview URL.
  useEffect(() => {
    if (!open) return undefined;
    setName(account?.displayName || '');
    setPicture({ file: null, url: null, remove: false });
    return () => setPicture((current) => {
      if (current.url) URL.revokeObjectURL(current.url);
      return { file: null, url: null, remove: false };
    });
  }, [open, account]);

  const normalizedName = normalizeDisplayName(name);
  const nameChanged = normalizedName !== (account?.displayName || '');
  const pictureChanged = Boolean(picture.file) || picture.remove;
  const dirty = nameChanged || pictureChanged;
  const preview = {
    ...account,
    displayName: normalizedName,
    avatarUrl: picture.file ? picture.url : picture.remove ? null : account?.avatarUrl,
  };

  async function choose(file) {
    const issue = avatarFileIssue(file);
    if (issue) {
      notify({ title: 'Could not use this picture', description: issue, variant: 'destructive' });
      return;
    }
    setPreparing(true);
    try {
      const prepared = await prepareAvatar(file);
      setPicture((current) => {
        if (current.url) URL.revokeObjectURL(current.url);
        return { file: prepared, url: URL.createObjectURL(prepared), remove: false };
      });
    } catch (error) {
      notify({ title: 'Could not read this picture', description: error.message, variant: 'destructive' });
    } finally {
      setPreparing(false);
    }
  }

  function undoPicture() {
    setPicture((current) => {
      if (current.url) URL.revokeObjectURL(current.url);
      return { file: null, url: null, remove: false };
    });
  }

  async function save() {
    setSaving(true);
    try {
      let latest = account;
      if (nameChanged) latest = (await updateProfile({ displayName: normalizedName })).data.account;
      if (picture.file) latest = (await uploadAvatar(picture.file)).data.account;
      else if (picture.remove) latest = (await removeAvatar()).data.account;
      onSaved(latest);
      notify({ title: 'Profile saved' });
      onOpenChange(false);
    } catch (error) {
      notify({ title: 'Could not save your profile', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>Your picture and name show on the leaderboards. Changes are kept only when you save.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div className="flex items-start gap-4">
            <Avatar account={preview} size="lg" className="ring-4 ring-background shadow-md" />
            <div className="flex flex-1 flex-wrap gap-2">
              <FileDropzone
                compact
                className="basis-full"
                accept={`${PROFILE_LIMITS.avatarMimeTypes.join(',')},.jpg,.jpeg,.png,.webp`}
                kindLabel="JPEG, PNG or WebP"
                maxBytes={PROFILE_LIMITS.avatarMaxBytes}
                title={preparing ? 'Preparing the picture…' : preview.avatarUrl ? 'Drag another picture here' : 'Drag a picture here'}
                disabled={saving || preparing}
                onFile={choose}
              />
              {pictureChanged ? (
                <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={undoPicture}>
                  <Undo2 className="h-4 w-4" />
                  Undo
                </Button>
              ) : account?.avatarUrl ? (
                <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => setPicture({ file: null, url: null, remove: true })}>
                  <Trash2 className="h-4 w-4" />
                  Remove picture
                </Button>
              ) : null}
              <p className="basis-full text-xs text-muted-foreground">
                {picture.file ? 'Preview: cropped to a square and shrunk. Save to upload it.' : picture.remove ? 'Your initial will be shown after you save.' : 'JPEG, PNG or WebP. It is cropped to a square before upload.'}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              value={name}
              maxLength={PROFILE_LIMITS.displayNameMax}
              placeholder={displayNameOf({ email: account?.email })}
              onChange={(event) => setName(event.target.value)}
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground">
              Your real name or a nickname; it does not have to be unique. Leave it empty to be shown as {displayNameOf({ email: account?.email })}. {normalizedName.length}/{PROFILE_LIMITS.displayNameMax}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" loading={saving} disabled={!dirty || preparing} onClick={save}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { Input, Label } from '../../../components/ui';
import { Textarea } from '../../../components/ui/textarea.jsx';
import { useReadOnly } from './ReadOnly.jsx';

export function TextField({ id, label, value, onChange, multiline = false, ...props }) {
  const readOnly = useReadOnly();
  const Field = multiline ? Textarea : Input;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Field id={id} value={value} onChange={(event) => onChange(event.target.value)} {...props} readOnly={readOnly || props.readOnly} />
    </div>
  );
}

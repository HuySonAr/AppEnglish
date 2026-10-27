import { MockFormat } from '@appenglish/content-contracts';
import { Badge } from '../../../components/ui';

export const mockFormatLabels = Object.freeze({ [MockFormat.FULL]: 'Full test', [MockFormat.PRACTICE]: 'Practice set' });
export const formatOf = (mockTest) => mockTest?.format || MockFormat.FULL;

export function MockFormatBadge({ format }) {
  const value = format || MockFormat.FULL;
  return <Badge variant={value === MockFormat.PRACTICE ? 'secondary' : 'info'}>{mockFormatLabels[value]}</Badge>;
}

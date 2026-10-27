import { useAuth } from '../../auth/context/AuthContext.jsx';
import { contentAreaFor } from '../lib/content-area.js';

export function useContentArea() {
  const { account } = useAuth();
  return contentAreaFor(account?.role);
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  getCurrentUser,
  loginAccount,
  logoutAccount,
} from '../api/auth-api.js';
import { responseData } from '../../../lib/api/response.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', account: null });

  const restoreSession = useCallback(async () => {
    setState((current) => ({ ...current, status: 'loading' }));
    try {
      const result = await getCurrentUser();
      setState({
        status: 'authenticated',
        account: responseData(result).account,
      });
    } catch {
      setState({ status: 'anonymous', account: null });
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const signIn = useCallback(async (values) => {
    const result = await loginAccount(values);
    const account = responseData(result).account;
    if (account) setState({ status: 'authenticated', account });
    return result;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await logoutAccount();
    } finally {
      setState({ status: 'anonymous', account: null });
    }
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      isAuthenticated: state.status === 'authenticated',
      restoreSession,
      signIn,
      signOut,
    }),
    [restoreSession, signIn, signOut, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

import { Navigate, useParams } from 'react-router-dom';

export function SpeakingPartPage() {
  const { part } = useParams();
  return <Navigate to={`/student/practice/speaking?part=${part}`} replace />;
}

import { Navigate, useParams } from 'react-router-dom';
import { toeicModeOf } from '../lib/listening-practice.js';

export function ListeningExerciseListPage() {
  const { topicId, mode } = useParams();
  return <Navigate to={`/student/practice/listening/topics/${topicId}?mode=${toeicModeOf(mode)}`} replace />;
}

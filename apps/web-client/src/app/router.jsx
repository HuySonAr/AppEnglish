import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthLayout } from '../layouts/AuthLayout.jsx';
import { ManagementLayout } from '../layouts/ManagementLayout.jsx';
import { StudentLayout } from '../layouts/StudentLayout.jsx';
import { PublicOnlyRoute } from '../routes/PublicOnlyRoute.jsx';
import { ProtectedRoute } from '../routes/ProtectedRoute.jsx';
import { RoleRoute } from '../routes/RoleRoute.jsx';
import { LoginPage } from '../features/auth/pages/LoginPage.jsx';
import { RegisterPage } from '../features/auth/pages/RegisterPage.jsx';
import { VerifyEmailPage } from '../features/auth/pages/VerifyEmailPage.jsx';
import { ForgotPasswordPage } from '../features/auth/pages/ForgotPasswordPage.jsx';
import { ResetPasswordPage } from '../features/auth/pages/ResetPasswordPage.jsx';
import { UnauthorizedPage } from '../features/auth/pages/UnauthorizedPage.jsx';
import { NotFoundPage } from '../features/auth/pages/NotFoundPage.jsx';
import { StudentDashboardPage } from '../features/student/pages/StudentDashboardPage.jsx';
import { AdminDashboardPage } from '../features/admin/pages/AdminDashboardPage.jsx';
import { AdminAccountsPage } from '../features/admin/pages/AdminAccountsPage.jsx';
import { ContentManagerDashboardPage } from '../features/content-manager/pages/ContentManagerDashboardPage.jsx';
import { ContentUnitsPage } from '../features/content-manager/pages/ContentUnitsPage.jsx';
import { LessonEditorPage } from '../features/content-manager/pages/LessonEditorPage.jsx';
import { PlacementEditorPage } from '../features/content-manager/pages/PlacementEditorPage.jsx';
import { PlacementPage } from '../features/student/pages/PlacementPage.jsx';
import { LessonsPage } from '../features/student/pages/LessonsPage.jsx';
import { LessonPage } from '../features/student/pages/LessonPage.jsx';
import { LessonTestPage } from '../features/student/pages/LessonTestPage.jsx';
import { PlacementSettingsPage } from '../features/admin/pages/PlacementSettingsPage.jsx';
import { MockTestsManagePage } from '../features/content-manager/pages/MockTestsManagePage.jsx';
import { MockTestEditorPage } from '../features/content-manager/pages/MockTestEditorPage.jsx';
import { MockTestsPage } from '../features/student/pages/MockTestsPage.jsx';
import { MockTestPage } from '../features/student/pages/MockTestPage.jsx';
import { MockMiniHistoryPage } from '../features/student/pages/MockMiniHistoryPage.jsx';
import { PracticePage } from '../features/student/pages/PracticePage.jsx';
import { ListeningExercisePage } from '../features/student/pages/ListeningExercisePage.jsx';
import { ListeningPracticePage } from '../features/student/pages/ListeningPracticePage.jsx';
import { ListeningExerciseListPage } from '../features/student/pages/ListeningExerciseListPage.jsx';
import { ListeningTopicPage } from '../features/student/pages/ListeningTopicPage.jsx';
import { ListeningExerciseEditorPage } from '../features/content-manager/pages/ListeningExerciseEditorPage.jsx';
import { ListeningExercisesPage } from '../features/content-manager/pages/ListeningExercisesPage.jsx';
import { ListeningTopicsPage } from '../features/content-manager/pages/ListeningTopicsPage.jsx';
import { VocabularyPracticePage } from '../features/student/pages/VocabularyPracticePage.jsx';
import { ScoreConversionPage } from '../features/admin/pages/ScoreConversionPage.jsx';
import { ExamTypesPage } from '../features/admin/pages/ExamTypesPage.jsx';
import { Roles } from '../constants/auth.js';
import { dashboardPathForRole } from '../features/auth/flow/auth-flow.js';
import { useAuth } from '../features/auth/context/AuthContext.jsx';

function DashboardRedirect() {
  const { account } = useAuth();
  if (!account) return <Navigate to="/login" replace />;
  return <Navigate to={dashboardPathForRole(account.role)} replace />;
}

export function AppRouter() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<DashboardRedirect />} />
        <Route path="/app" element={<DashboardRedirect />} />
        <Route path="/403" element={<UnauthorizedPage />} />
        <Route
          path="/student"
          element={<RoleRoute allowedRole={Roles.STUDENT} />}
        >
          <Route element={<StudentLayout />}>
            <Route index element={<StudentDashboardPage />} />
            <Route path="placement" element={<PlacementPage />} />
            <Route path="lessons" element={<LessonsPage />} />
            <Route path="lessons/:lessonId" element={<LessonPage />} />
            <Route path="lessons/:lessonId/test" element={<LessonTestPage />} />
            <Route path="mock-tests" element={<MockTestsPage />} />
            <Route path="mock-tests/:mockTestId" element={<MockTestPage />} />
            <Route path="mock-tests/:mockTestId/mini/:partKey" element={<MockMiniHistoryPage />} />
            <Route path="practice" element={<PracticePage />} />
            <Route path="practice/vocabulary" element={<VocabularyPracticePage />} />
            <Route path="practice/listening" element={<ListeningPracticePage />} />
            <Route path="practice/listening/topics/:topicId" element={<ListeningTopicPage />} />
            <Route path="practice/listening/topics/:topicId/:mode" element={<ListeningExerciseListPage />} />
            <Route path="practice/listening/:exerciseId" element={<ListeningExercisePage />} />
          </Route>
        </Route>
        <Route path="/admin" element={<RoleRoute allowedRole={Roles.ADMIN} />}>
          <Route element={<ManagementLayout role={Roles.ADMIN} />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="accounts" element={<AdminAccountsPage />} />
            <Route path="placement" element={<PlacementSettingsPage />} />
            <Route path="score-conversion" element={<ScoreConversionPage />} />
            <Route path="exam-types" element={<ExamTypesPage />} />
            <Route path="listening-topics" element={<ListeningTopicsPage eyebrow="Admin" />} />
          </Route>
        </Route>
        <Route
          path="/content-manager"
          element={<RoleRoute allowedRole={Roles.CONTENT_MANAGER} />}
        >
          <Route element={<ManagementLayout role={Roles.CONTENT_MANAGER} />}>
            <Route index element={<ContentManagerDashboardPage />} />
            <Route path="units" element={<ContentUnitsPage />} />
            <Route path="placement" element={<PlacementEditorPage />} />
            <Route path="mock-tests" element={<MockTestsManagePage />} />
            <Route path="mock-tests/:mockTestId" element={<MockTestEditorPage />} />
            <Route path="listening" element={<ListeningExercisesPage />} />
            <Route path="listening/:exerciseId" element={<ListeningExerciseEditorPage />} />
            <Route path="listening-topics" element={<ListeningTopicsPage eyebrow="Content Manager" />} />
            <Route path="lessons/:lessonId" element={<LessonEditorPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="/auth" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

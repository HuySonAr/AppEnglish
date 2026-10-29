import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthLayout } from '../layouts/AuthLayout.jsx';
import { SidebarLayout } from '../layouts/SidebarLayout.jsx';
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
import { AcceptInvitePage } from '../features/auth/pages/AcceptInvitePage.jsx';
import { AdminSystemPage } from '../features/admin/pages/AdminSystemPage.jsx';
import { AdminAccountsPage } from '../features/admin/pages/AdminAccountsPage.jsx';
import { AdminAccountDetailPage } from '../features/admin/pages/AdminAccountDetailPage.jsx';
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
import { MockStatsPage } from '../features/content-manager/pages/MockStatsPage.jsx';
import { MockTestEditorPage } from '../features/content-manager/pages/MockTestEditorPage.jsx';
import { MockTestsPage } from '../features/student/pages/MockTestsPage.jsx';
import { MockTestPage } from '../features/student/pages/MockTestPage.jsx';
import { MockMistakesPage } from '../features/student/pages/MockMistakesPage.jsx';
import { MockHistoryPage } from '../features/student/pages/MockHistoryPage.jsx';
import { PracticePage } from '../features/student/pages/PracticePage.jsx';
import { SpeakingPromptsPage } from '../features/student/pages/SpeakingPromptsPage.jsx';
import { SpeakingPromptPage } from '../features/student/pages/SpeakingPromptPage.jsx';
import { WritingPromptsPage } from '../features/student/pages/WritingPromptsPage.jsx';
import { WritingPromptPage } from '../features/student/pages/WritingPromptPage.jsx';
import { GeminiKeyPage } from '../features/student/pages/GeminiKeyPage.jsx';
import { ListeningExercisePage } from '../features/student/pages/ListeningExercisePage.jsx';
import { ListeningPracticePage } from '../features/student/pages/ListeningPracticePage.jsx';
import { ListeningExerciseListPage } from '../features/student/pages/ListeningExerciseListPage.jsx';
import { ListeningTopicPage } from '../features/student/pages/ListeningTopicPage.jsx';
import { ListeningPartPage } from '../features/student/pages/ListeningPartPage.jsx';
import { ProgressPage } from '../features/student/pages/ProgressPage.jsx';
import { LeaderboardPage } from '../features/student/pages/LeaderboardPage.jsx';
import { ListeningExerciseEditorPage } from '../features/content-manager/pages/ListeningExerciseEditorPage.jsx';
import { ListeningExercisesPage } from '../features/content-manager/pages/ListeningExercisesPage.jsx';
import { ListeningTestsPage } from '../features/content-manager/pages/ListeningTestsPage.jsx';
import { ListeningTopicsPage } from '../features/content-manager/pages/ListeningTopicsPage.jsx';
import { VocabularyPracticePage } from '../features/student/pages/VocabularyPracticePage.jsx';
import { ScoreConversionPage } from '../features/admin/pages/ScoreConversionPage.jsx';
import { ExamTypesPage } from '../features/admin/pages/ExamTypesPage.jsx';
import { ProfilePage } from '../features/profile/pages/ProfilePage.jsx';
import { UnitReviewEditorPage } from '../features/content-manager/pages/UnitReviewEditorPage.jsx';
import { UnitReviewPage } from '../features/student/pages/UnitReviewPage.jsx';
import { TeacherDashboardPage } from '../features/teacher/pages/TeacherDashboardPage.jsx';
import { TeacherPromptsPage } from '../features/teacher/pages/TeacherPromptsPage.jsx';
import { TeacherSpeakingPage } from '../features/teacher/pages/TeacherSpeakingPage.jsx';
import { SpeakingPartPage } from '../features/student/pages/SpeakingPartPage.jsx';
import { PromptEditorPage } from '../features/teacher/pages/PromptEditorPage.jsx';
import { TeacherReviewQueuePage } from '../features/teacher/pages/TeacherReviewQueuePage.jsx';
import { TeacherReviewPage } from '../features/teacher/pages/TeacherReviewPage.jsx';
import { PracticeReviewPage } from '../features/content-manager/pages/PracticeReviewPage.jsx';
import { PracticeReviewDetailPage } from '../features/content-manager/pages/PracticeReviewDetailPage.jsx';
import { ContentReviewQueuePage } from '../features/content-manager/pages/ContentReviewQueuePage.jsx';
import { SwTestsManagePage } from '../features/content-manager/pages/SwTestsManagePage.jsx';
import { SwTestEditorPage } from '../features/content-manager/pages/SwTestEditorPage.jsx';
import { SwTestsPage } from '../features/student/pages/SwTestsPage.jsx';
import { SwTestPage } from '../features/student/pages/SwTestPage.jsx';
import { SwResultPage } from '../features/student/pages/SwResultPage.jsx';
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
          <Route path="/accept-invite" element={<AcceptInvitePage />} />
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
          <Route element={<SidebarLayout role={Roles.STUDENT} />}>
            <Route index element={<StudentDashboardPage />} />
            <Route path="placement" element={<PlacementPage />} />
            <Route path="lessons" element={<LessonsPage />} />
            <Route path="lessons/:lessonId" element={<LessonPage />} />
            <Route path="lessons/:lessonId/test" element={<LessonTestPage />} />
            <Route path="units/:unitId/review" element={<UnitReviewPage />} />
            <Route path="mock-tests" element={<MockTestsPage />} />
            <Route path="mock-tests/mistakes" element={<MockMistakesPage />} />
            <Route path="mock-tests/:mockTestId" element={<MockTestPage />} />
            <Route path="mock-tests/:mockTestId/history" element={<MockHistoryPage />} />
            <Route path="mock-tests/:mockTestId/mini/:partKey" element={<MockHistoryPage />} />
            <Route path="sw-tests" element={<SwTestsPage />} />
            <Route path="sw-tests/:swTestId" element={<SwTestPage />} />
            <Route path="sw-tests/:swTestId/result" element={<SwResultPage />} />
            <Route path="progress" element={<ProgressPage />} />
            <Route path="leaderboard" element={<LeaderboardPage />} />
            <Route path="practice" element={<PracticePage />} />
            <Route path="practice/vocabulary" element={<VocabularyPracticePage />} />
            <Route path="practice/listening" element={<ListeningPracticePage />} />
            <Route path="practice/speaking" element={<SpeakingPromptsPage />} />
            <Route path="practice/speaking/parts/:part" element={<SpeakingPartPage />} />
            <Route path="practice/speaking/:promptId/history" element={<SpeakingPromptPage view="history" />} />
            <Route path="practice/speaking/:promptId" element={<SpeakingPromptPage />} />
            <Route path="practice/writing" element={<WritingPromptsPage />} />
            <Route path="practice/writing/:promptId" element={<WritingPromptPage />} />
            <Route path="gemini-key" element={<GeminiKeyPage />} />
            <Route path="practice/listening/topics/:topicId" element={<ListeningTopicPage />} />
            <Route path="practice/listening/tests/:testId/parts/:part" element={<ListeningPartPage />} />
            <Route path="practice/listening/topics/:topicId/:mode" element={<ListeningExerciseListPage />} />
            <Route path="practice/listening/:exerciseId" element={<ListeningExercisePage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
        </Route>
        <Route path="/admin" element={<RoleRoute allowedRole={Roles.ADMIN} />}>
          <Route element={<SidebarLayout role={Roles.ADMIN} />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="accounts" element={<AdminAccountsPage />} />
            <Route path="accounts/:accountId" element={<AdminAccountDetailPage />} />
            <Route path="placement" element={<PlacementSettingsPage />} />
            <Route path="score-conversion" element={<ScoreConversionPage />} />
            <Route path="system" element={<AdminSystemPage />} />
            <Route path="exam-types" element={<ExamTypesPage />} />
            <Route path="listening-topics" element={<ListeningTopicsPage eyebrow="Admin" />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
        </Route>
        <Route
          path="/content-manager"
          element={<RoleRoute allowedRole={Roles.CONTENT_MANAGER} />}
        >
          <Route element={<SidebarLayout role={Roles.CONTENT_MANAGER} />}>
            <Route index element={<ContentManagerDashboardPage />} />
            <Route path="reviews" element={<ContentReviewQueuePage />} />
            <Route path="units" element={<ContentUnitsPage />} />
            <Route path="units/:unitId/review" element={<UnitReviewEditorPage />} />
            <Route path="placement" element={<PlacementEditorPage />} />
            <Route path="mock-tests" element={<MockTestsManagePage />} />
            <Route path="mock-tests/:mockTestId" element={<MockTestEditorPage />} />
            <Route path="sw-tests" element={<SwTestsManagePage />} />
            <Route path="sw-tests/:swTestId" element={<SwTestEditorPage />} />
            <Route path="mock-tests/:mockTestId/results" element={<MockStatsPage />} />
            <Route path="listening" element={<ListeningTestsPage />} />
            <Route path="listening/all" element={<ListeningExercisesPage />} />
            <Route path="listening/:exerciseId" element={<ListeningExerciseEditorPage />} />
            <Route path="listening-topics" element={<ListeningTopicsPage eyebrow="Content Manager" />} />
            <Route path="lessons/:lessonId" element={<LessonEditorPage />} />
            <Route path="speaking-prompts" element={<PracticeReviewPage key="speaking" area="speaking" />} />
            <Route path="writing-prompts" element={<PracticeReviewPage key="writing" area="writing" />} />
            <Route path="speaking-prompts/:promptId" element={<PracticeReviewDetailPage />} />
            <Route path="writing-prompts/:promptId" element={<PracticeReviewDetailPage />} />
            <Route path="practice-prompts" element={<Navigate to="/content-manager/speaking-prompts" replace />} />
            <Route path="practice-prompts/:promptId" element={<PracticeReviewDetailPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
        </Route>
        <Route path="/teacher" element={<RoleRoute allowedRole={Roles.TEACHER} />}>
          <Route element={<SidebarLayout role={Roles.TEACHER} />}>
            <Route index element={<TeacherDashboardPage />} />
            <Route path="units" element={<ContentUnitsPage />} />
            <Route path="units/:unitId/review" element={<UnitReviewEditorPage />} />
            <Route path="lessons/:lessonId" element={<LessonEditorPage />} />
            <Route path="placement" element={<PlacementEditorPage />} />
            <Route path="mock-tests" element={<MockTestsManagePage />} />
            <Route path="mock-tests/:mockTestId" element={<MockTestEditorPage />} />
            <Route path="sw-tests" element={<SwTestsManagePage />} />
            <Route path="sw-tests/:swTestId" element={<SwTestEditorPage />} />
            <Route path="listening" element={<ListeningTestsPage />} />
            <Route path="listening/all" element={<ListeningExercisesPage />} />
            <Route path="listening/:exerciseId" element={<ListeningExerciseEditorPage />} />
            <Route path="speaking" element={<TeacherSpeakingPage />} />
            <Route path="read-aloud" element={<Navigate to="/teacher/speaking?part=1" replace />} />
            <Route path="open-speaking" element={<Navigate to="/teacher/speaking?part=2" replace />} />
            <Route path="writing" element={<TeacherPromptsPage key="writing" kind="writing" />} />
            <Route path=":kindSlug/:promptId" element={<PromptEditorPage />} />
            <Route path="prompts" element={<Navigate to="/teacher" replace />} />
            <Route path="prompts/:promptId" element={<PromptEditorPage />} />
            <Route path="reviews" element={<TeacherReviewQueuePage />} />
            <Route path="reviews/:reviewId" element={<TeacherReviewPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
        </Route>
      </Route>
      <Route path="/auth" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

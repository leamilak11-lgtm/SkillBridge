import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./auth";
import { AppFrame, Loading } from "./components";
import { ApplicationsPage } from "./pages/ApplicationsPage";
import { CareerPlanPage } from "./pages/CareerPlanPage";
import { HomePage } from "./pages/HomePage";
import { JobDetailPage, JobsPage } from "./pages/JobsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { ResumePage } from "./pages/ResumePage";
import { AuthPage, PasswordResetPage } from "./pages/AuthPage";
import { SavedJobsPage } from "./pages/SavedJobsPage";
import { RecruiterApplicationsPage, RecruiterPage } from "./pages/RecruiterPage";
import { AdminPage } from "./pages/AdminPage";
import { CandidateDiscoveryPage } from "./pages/CandidateDiscoveryPage";
import { InterviewPrepPage } from "./pages/InterviewPrepPage";
import { RecommendationsPage } from "./pages/RecommendationsPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { AuthCallbackPage, EmailVerificationPage } from "./pages/EmailVerificationPage";

function roleHome(role: "JOB_SEEKER" | "RECRUITER" | "ADMIN") {
  return role === "ADMIN" ? "/app/admin" : role === "RECRUITER" ? "/app/recruiter" : "/app/profile";
}
function Protected({ children, roles }: { children: ReactNode; roles?: Array<"JOB_SEEKER" | "RECRUITER" | "ADMIN"> }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading label="Checking your session" />;
  if (!user) return <Navigate to="/sign-in" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={roleHome(user.role)} replace />;
  return <AppFrame>{children}</AppFrame>;
}
export function App() {
  return <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/jobs" element={<JobsPage />} />
    <Route path="/jobs/:id" element={<JobDetailPage />} />
    <Route path="/sign-in" element={<AuthPage mode="sign-in" />} />
    <Route path="/sign-up" element={<AuthPage mode="sign-up" />} />
    <Route path="/recruiter/sign-up" element={<AuthPage mode="recruiter-sign-up" />} />
    <Route path="/password-reset" element={<PasswordResetPage />} />
    <Route path="/verify-email" element={<EmailVerificationPage />} />
    <Route path="/auth/callback" element={<AuthCallbackPage />} />
    <Route path="/app/profile" element={<Protected roles={["JOB_SEEKER"]}><ProfilePage /></Protected>} />
    <Route path="/app/resumes" element={<Protected roles={["JOB_SEEKER"]}><ResumePage /></Protected>} />
    <Route path="/app/saved" element={<Protected roles={["JOB_SEEKER"]}><SavedJobsPage /></Protected>} />
    <Route path="/app/applications" element={<Protected roles={["JOB_SEEKER"]}><ApplicationsPage /></Protected>} />
    <Route path="/app/career-plan" element={<Protected roles={["JOB_SEEKER"]}><CareerPlanPage /></Protected>} />
    <Route path="/app/interview-prep" element={<Protected roles={["JOB_SEEKER"]}><InterviewPrepPage /></Protected>} />
    <Route path="/app/recommendations" element={<Protected roles={["JOB_SEEKER"]}><RecommendationsPage /></Protected>} />
    <Route path="/app/recruiter" element={<Protected roles={["RECRUITER"]}><RecruiterPage /></Protected>} />
    <Route path="/app/recruiter/applications" element={<Protected roles={["RECRUITER"]}><RecruiterApplicationsPage /></Protected>} />
    <Route path="/app/recruiter/candidates" element={<Protected roles={["RECRUITER"]}><CandidateDiscoveryPage /></Protected>} />
    <Route path="/app/admin" element={<Protected roles={["ADMIN"]}><AdminPage /></Protected>} />
    <Route path="/app/notifications" element={<Protected><NotificationsPage /></Protected>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}

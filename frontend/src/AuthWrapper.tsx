import { useStudy } from "@/context/StudyContext";
import AuthPage from "./pages/AuthPage";
import { Outlet } from "react-router-dom";

export default function AuthWrapper({ children }: { children?: React.ReactNode }) {
  const { token } = useStudy();

  if (!token) {
    return <AuthPage />;
  }

  return children ? <>{children}</> : <Outlet />;
}

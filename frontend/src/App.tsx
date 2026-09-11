import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import DashboardPage from "./pages/DashboardPage";
import ContractsPage from "./pages/ContractsPage";
import ContractAnalysisPage from "./pages/ContractAnalysisPage";
import AskAIPage from "./pages/AskAIPage";
import ComparisonPage from "./pages/ComparisonPage";
import LoginPage from "./pages/LoginPage";
import DashboardLayout from "./layouts/DashboardLayout";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginModal from "./components/LoginModal";

function GlobalModal() {
  const { isLoginModalOpen, closeLoginModal } = useAuth();
  return <LoginModal isOpen={isLoginModalOpen} onClose={closeLoginModal} />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <GlobalModal />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/contracts" element={<ContractsPage />} />
            <Route path="/contracts/:id" element={<ContractAnalysisPage />} />
            <Route path="/ask-ai" element={<AskAIPage />} />
            <Route path="/compare" element={<ComparisonPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { InvestmentDashboard } from './pages/DashboardPage';
import Aurora from './components/Aurora';
import { useAuth } from './context/AuthContext';
import { supabase } from './supabaseClient';
import AuthPage from './pages/AuthPage';
import OnBoarding from './pages/OnboardingPage';

export default function App() {
  const { user } = useAuth();
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean | null>(null); // null = loading
  const navigate = useNavigate();

  useEffect(() => {
    async function checkOnboardingStatus() {
      if (!user) {
        setHasCompletedOnboarding(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('tone')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error checking onboarding status:', error);
        }

        // If we have a tone, we consider onboarding complete
        if (data?.tone) {
          setHasCompletedOnboarding(true);
        } else {
          setHasCompletedOnboarding(false);
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        setHasCompletedOnboarding(false);
      }
    }

    checkOnboardingStatus();
  }, [user]);

  const handleOnboardingComplete = () => {
    setHasCompletedOnboarding(true);
    navigate('/dashboard');
  };

  const handleBackToOnboarding = () => {
    setHasCompletedOnboarding(false);
    navigate('/onboarding');
  };

  if (user && hasCompletedOnboarding === null) {
    return <div className="min-h-screen bg-[#2D2D2D] flex items-center justify-center text-white">Loading...</div>;
  }

  return (
    <Routes>
      <Route 
        path="/login" 
        element={user ? <Navigate to="/dashboard" replace /> : <AuthPage />} 
      />
      
      <Route 
        path="/onboarding" 
        element={
          !user ? <Navigate to="/login" replace /> : 
          <OnBoarding onComplete={handleOnboardingComplete} />
        } 
      />

      <Route 
        path="/dashboard" 
        element={
          !user ? <Navigate to="/login" replace /> :
          !hasCompletedOnboarding ? <Navigate to="/onboarding" replace /> :
          <div className="min-h-screen bg-[#2D2D2D] relative">
            <div className="fixed inset-0 z-0 opacity-40">
              <Aurora
                colorStops={["#FF88B7", "#7B61FF", "#FF88B7"]}
                blend={0.6}
                amplitude={0.8}
                speed={0.4}
              />
            </div>
            <div className="relative z-10">
              <InvestmentDashboard onBackToOnboarding={handleBackToOnboarding} />
            </div>
          </div>
        } 
      />

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
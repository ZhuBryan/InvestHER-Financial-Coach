import { useState } from 'react';
import { InvestmentDashboard } from './components/InvestmentDashboard';
import Aurora from './components/Aurora';

export default function App() {
  return (
    <div className="min-h-screen bg-[#2D2D2D] relative">
      {/* Animated Aurora background */}
      <div className="fixed inset-0 z-0 opacity-40">
        <Aurora
          colorStops={["#FF88B7", "#7B61FF", "#FF88B7"]}
          blend={0.6}
          amplitude={0.8}
          speed={0.4}
        />
      </div>
      
      {/* Main content */}
      <div className="relative z-10">
        <InvestmentDashboard />
      </div>
    </div>
  );
}
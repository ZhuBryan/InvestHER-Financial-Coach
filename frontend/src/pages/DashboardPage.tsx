import { useState, useMemo, useEffect } from 'react';
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area } from 'recharts';
import { TrendingUp, Calendar, Target, ChevronDown, Info, Zap, ChevronUp, LogOut, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import Aurora from '../components/Aurora';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { model } from '../gemini';

// Savings history data from DB
interface SavingsItem {
  id: string;
  company: string;
  amount: number;
  date: string;
  daysAgo: number;
  icon?: string;
}

// Recently visited stores
interface RecentItem {
  company: string;
  daysAgo: number;
  icon?: string;
}

// ETF options with different return rates
const ETF_OPTIONS = {
  VDY: { name: 'Vanguard Canadian High Dividend Yield', annualReturn: 0.07, description: 'Canadian Dividend ETF' },
  VFV: { name: 'Vanguard S&P 500 Index', annualReturn: 0.11, description: 'S&P 500 CAD' },
  SPY: { name: 'SPDR S&P 500 ETF', annualReturn: 0.11, description: 'S&P 500 USD' },
  XEQT: { name: 'iShares Core Equity ETF', annualReturn: 0.09, description: 'All Equity Balanced' },
  QQQ: { name: 'Invesco QQQ Trust', annualReturn: 0.14, description: 'Nasdaq 100' },
};

type ETFTicker = keyof typeof ETF_OPTIONS;

// Generate ETF data based on recurring contributions (dollar-cost averaging)
function generateETFData(
  savingsHistory: SavingsItem[], 
  startDate: Date, 
  endDate: Date, 
  ticker: ETFTicker,
  recurringAmount: number,
  recurringFrequency: 'weekly' | 'monthly'
) {
  const data = [];
  const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  const annualReturn = ETF_OPTIONS[ticker].annualReturn;
  const dailyReturn = Math.pow(1 + annualReturn, 1 / 365) - 1;
  
  // Sort savings by date (oldest first)
  const sortedSavings = [...savingsHistory].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  // Track each contribution separately with its growth
  const contributions: { date: Date; amount: number; currentValue: number; type: 'impulse' | 'recurring' }[] = [];
  
  // Calculate interval days for recurring contributions
  const recurringIntervalDays = recurringFrequency === 'weekly' ? 7 : 30;
  let nextRecurringDate = new Date(new Date().getTime() + recurringIntervalDays * 24 * 60 * 60 * 1000);
  
  for (let i = 0; i <= daysDiff; i += 1) { // Daily calculations
    const currentDate = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    
    // Check if any impulse savings should be added on this date
    sortedSavings.forEach(saving => {
      const savingDate = new Date(saving.date);
      // Add contribution if it matches current date and hasn't been added yet
      if (savingDate.toDateString() === currentDate.toDateString() && 
          !contributions.some(c => c.date.getTime() === savingDate.getTime() && c.amount === saving.amount && c.type === 'impulse')) {
        contributions.push({
          date: new Date(savingDate),
          amount: saving.amount,
          currentValue: saving.amount,
          type: 'impulse'
        });
      }
    });
    
    // Add recurring contributions if enabled and date matches
    if (recurringAmount > 0 && currentDate >= nextRecurringDate) {
      while (nextRecurringDate <= currentDate) {
        contributions.push({
          date: new Date(nextRecurringDate),
          amount: recurringAmount,
          currentValue: recurringAmount,
          type: 'recurring'
        });
        nextRecurringDate = new Date(nextRecurringDate.getTime() + recurringIntervalDays * 24 * 60 * 60 * 1000);
      }
    }
    
    // Grow all existing contributions by daily return
    const volatility = (Math.random() - 0.5) * 0.003;
    const todayReturn = dailyReturn + volatility;
    
    contributions.forEach(contribution => {
      contribution.currentValue = contribution.currentValue * (1 + todayReturn);
    });
    
    // Calculate totals
    const totalValue = contributions.reduce((sum, c) => sum + c.currentValue, 0);
    const totalPrincipal = contributions.reduce((sum, c) => sum + c.amount, 0);
    const impulseSavingsTotal = contributions.filter(c => c.type === 'impulse').reduce((sum, c) => sum + c.amount, 0);
    const recurringTotal = contributions.filter(c => c.type === 'recurring').reduce((sum, c) => sum + c.amount, 0);
    
    // Add data point every 7 days for chart performance
    if (i % 7 === 0) {
      data.push({
        date: currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: totalValue,
        principal: totalPrincipal,
        gain: totalValue - totalPrincipal,
        contributionCount: contributions.length,
        impulseSavings: impulseSavingsTotal,
        recurringContributions: recurringTotal,
      });
    }
  }
  
  return data;
}

export function InvestmentDashboard({ onBackToOnboarding }: { onBackToOnboarding?: () => void }) {
  const { signOut, user } = useAuth();
  const [selectedTicker, setSelectedTicker] = useState<ETFTicker>('VDY');
  const [showTickerDropdown, setShowTickerDropdown] = useState(false);
  const [isGainsCardExpanded, setIsGainsCardExpanded] = useState(false);
  const [timeRange, setTimeRange] = useState<'6mo' | '1Y' | '2Y' | '5Y'>('1Y');
  const [recurringAmount, setRecurringAmount] = useState<number>(0);
  const [recurringFrequency, setRecurringFrequency] = useState<'weekly' | 'monthly'>('weekly');
  
  // Goals tracking state
  interface Goal {
    id: string;
    name: string;
    targetAmount: number;
    allocatedAmount: number;
    color: string;
  }
  
  const [goals, setGoals] = useState<Goal[]>([]);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newGoal, setNewGoal] = useState({
    name: '',
    targetAmount: 0,
    allocatedAmount: 0,
    color: '#FF88B7'
  });

  const [savingsHistory, setSavingsHistory] = useState<SavingsItem[]>([]);
  const [failuresHistory, setFailuresHistory] = useState<SavingsItem[]>([]);
  const [recentlyVisited, setRecentlyVisited] = useState<RecentItem[]>([]);
  const [goalInputValues, setGoalInputValues] = useState<{[key: string]: string}>({});

  // User Profile state
  interface UserProfile {
    tone: 'Educative' | 'Casual' | 'Harsh';
    motivations: string[];
    struggles: string[];
  }
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [aiInsight, setAiInsight] = useState<string>('');
  const [aiWelcome, setAiWelcome] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState(false);

  // Fetch data from Supabase
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        // Fetch User Profile
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();
        
        if (!profileError && profileData) {
          setUserProfile(profileData);
        }

        // Fetch Savings (Purchases with status 'success')
        const { data: purchasesData, error: purchasesError } = await supabase
          .from('purchases')
          .select('*')
          .eq('user_id', user.id)
          .order('time', { ascending: false });

        if (purchasesError) throw purchasesError;

        if (purchasesData) {
          // Process Savings History (Success = Saved)
          const savings = purchasesData
            .filter(p => p.status === 'success')
            .map(p => ({
              id: p.id,
              company: p.store || 'Unknown Store',
              amount: p.total_price,
              date: p.time,
              daysAgo: Math.floor((new Date().getTime() - new Date(p.time).getTime()) / (1000 * 60 * 60 * 24)),
              icon: p.store_image || `https://www.google.com/s2/favicons?domain=${p.store}&sz=128`
            }));
          setSavingsHistory(savings);

          // Process Failures History (Not Success = Spent/Impulse Buy)
          const failures = purchasesData
            .filter(p => p.status !== 'success')
            .map(p => ({
              id: p.id,
              company: p.store || 'Unknown Store',
              amount: p.total_price,
              date: p.time,
              daysAgo: Math.floor((new Date().getTime() - new Date(p.time).getTime()) / (1000 * 60 * 60 * 24)),
              icon: p.store_image || `https://www.google.com/s2/favicons?domain=${p.store}&sz=128`
            }));
          setFailuresHistory(failures);

          // Process Recently Visited (Unique stores)
          const uniqueStores = new Map();
          purchasesData.forEach(p => {
            if (!uniqueStores.has(p.store)) {
              uniqueStores.set(p.store, {
                company: p.store || 'Unknown Store',
                daysAgo: Math.floor((new Date().getTime() - new Date(p.time).getTime()) / (1000 * 60 * 60 * 24)),
                icon: p.store_image || `https://www.google.com/s2/favicons?domain=${p.store}&sz=128`
              });
            }
          });
          setRecentlyVisited(Array.from(uniqueStores.values()).slice(0, 5));
        }

        // Fetch Goals
        const { data: goalsData, error: goalsError } = await supabase
          .from('goals')
          .select('*')
          .eq('user_id', user.id);

        if (goalsError) throw goalsError;

        if (goalsData) {
          setGoals(goalsData.map(g => ({
            id: g.id,
            name: g.goal,
            targetAmount: g.goal_value,
            allocatedAmount: g.allocated_amount || 0,
            color: g.color || '#FF88B7'
          })));
        }

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      }
    };

    fetchData();
  }, [user]);

  const totalSaved = useMemo(() => 
    savingsHistory.reduce((sum, item) => sum + item.amount, 0),
    [savingsHistory]
  );

  // Account creation date (earliest save date)
  const accountCreationDate = useMemo(() => {
    if (savingsHistory.length === 0) return new Date();
    const earliestDate = savingsHistory.reduce((earliest, item) => {
      const itemDate = new Date(item.date);
      return itemDate < earliest ? itemDate : earliest;
    }, new Date(savingsHistory[0].date));
    return earliestDate;
  }, [savingsHistory]);

  // Calculate end date based on time range
  const endDate = useMemo(() => {
    const end = new Date();
    switch (timeRange) {
      case '6mo':
        end.setMonth(end.getMonth() + 6);
        break;
      case '1Y':
        end.setFullYear(end.getFullYear() + 1);
        break;
      case '2Y':
        end.setFullYear(end.getFullYear() + 2);
        break;
      case '5Y':
        end.setFullYear(end.getFullYear() + 5);
        break;
    }
    return end;
  }, [timeRange]);

  const etfData = useMemo(() => 
    generateETFData(savingsHistory, accountCreationDate, endDate, selectedTicker, recurringAmount, recurringFrequency),
    [savingsHistory, accountCreationDate, endDate, selectedTicker, recurringAmount, recurringFrequency]
  );

  const currentValue = etfData[etfData.length - 1]?.value || totalSaved;
  const totalPrincipal = etfData[etfData.length - 1]?.principal || totalSaved;
  const totalGain = currentValue - totalPrincipal;
  const gainPercentage = totalPrincipal > 0 ? ((totalGain / totalPrincipal) * 100).toFixed(2) : '0.00';

  const totalAllocated = useMemo(() => goals.reduce((sum, g) => sum + g.allocatedAmount, 0), [goals]);
  const unallocated = Math.max(0, totalSaved - totalAllocated);

  const impulsePurchasesCancelled = savingsHistory.length;

  // Calculate time range label
  const timeRangeLabel = useMemo(() => {
    const months = Math.floor((endDate.getTime() - accountCreationDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
    if (timeRange === '6mo') return '6 months';
    if (timeRange === '1Y') return '1 year';
    if (timeRange === '2Y') return '2 years';
    if (timeRange === '5Y') return '5 years';
    return `${months} months`;
  }, [timeRange, endDate, accountCreationDate]);

  // Add Goal Handler
  const handleAddGoal = async () => {
    if (newGoal.name && newGoal.targetAmount > 0 && user) {
      // Validate allocation
      if (newGoal.allocatedAmount > unallocated) {
        toast.error(`You only have $${unallocated.toFixed(2)} available to allocate.`);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('goals')
          .insert([{
            user_id: user.id,
            goal: newGoal.name,
            goal_value: newGoal.targetAmount,
            allocated_amount: newGoal.allocatedAmount,
            color: newGoal.color
          }])
          .select()
          .single();

        if (error) throw error;

        if (data) {
          setGoals([...goals, {
            id: data.id,
            name: data.goal,
            targetAmount: data.goal_value,
            allocatedAmount: data.allocated_amount,
            color: data.color
          }]);
          setNewGoal({ name: '', targetAmount: 0, allocatedAmount: 0, color: '#FF88B7' });
          setShowAddGoal(false);
        }
      } catch (error) {
        console.error('Error adding goal:', error);
      }
    }
  };

  // Delete Goal Handler
  const handleDeleteGoal = async (goalId: string) => {
    try {
      const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', goalId);

      if (error) throw error;
      setGoals(goals.filter(g => g.id !== goalId));
    } catch (error) {
      console.error('Error deleting goal:', error);
    }
  };

  // Update Goal Allocation Handler
  const handleUpdateGoal = async (goalId: string, newAmount: number) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;

    // Calculate max allowed for this specific goal
    // Available = (Current Unallocated) + (This Goal's Current Allocation)
    const maxAllowed = unallocated + goal.allocatedAmount;
    
    if (newAmount > maxAllowed) {
      // Clamp to max allowed
      newAmount = maxAllowed;
    }

    // Optimistic update
    setGoals(goals.map(g => 
      g.id === goalId ? { ...g, allocatedAmount: newAmount } : g
    ));

    try {
      const { error } = await supabase
        .from('goals')
        .update({ allocated_amount: newAmount })
        .eq('id', goalId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating goal:', error);
      // Revert on error (optional, but good practice)
    }
  };

  const handleSaveGoalAllocation = async (goalId: string) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;
    
    const inputValue = goalInputValues[goalId];
    // If user hasn't typed anything, use current value
    const newAmount = inputValue !== undefined ? parseFloat(inputValue) : goal.allocatedAmount;
    
    if (isNaN(newAmount)) {
      toast.error('Please enter a valid number');
      return;
    }

    // Calculate max allowed for this specific goal
    // Available = (Current Unallocated) + (This Goal's Current Allocation)
    const maxAllowed = unallocated + goal.allocatedAmount;
    
    if (newAmount > maxAllowed) {
      toast.error(`You cannot allocate $${newAmount.toFixed(2)}. You only have $${maxAllowed.toFixed(2)} available.`);
      return;
    }

    await handleUpdateGoal(goalId, newAmount);
    
    // Clear the input value state
    const newInputs = {...goalInputValues};
    delete newInputs[goalId];
    setGoalInputValues(newInputs);
  };

  // AI Insight Generation
  useEffect(() => {
    if (!userProfile || savingsHistory.length === 0) return;

    const generateAiContent = async () => {
      setLoadingAi(true);
      try {
        const totalSavedVal = savingsHistory.reduce((sum, item) => sum + item.amount, 0);
        const impulseCount = savingsHistory.length;
        
        // Generate Insight
        const insightPrompt = `
          You are a financial coach with a ${userProfile.tone} tone.
          The user is motivated by: ${userProfile.motivations?.join(', ') || 'financial freedom'}.
          They struggle with: ${userProfile.struggles?.join(', ') || 'saving'}.
          They have saved $${totalSavedVal.toFixed(2)} by skipping ${impulseCount} impulse purchases.
          
          Generate a short, punchy, 1-2 sentence insight or piece of advice for them. 
          Focus on the positive reinforcement of their actions.
          Do not use markdown. Just plain text.
        `;

        const insightResult = await model.generateContent(insightPrompt);
        const insightResponse = await insightResult.response;
        setAiInsight(insightResponse.text());

        // Generate Welcome Message
        const welcomePrompt = `
          Generate a short (2-5 words) welcome greeting for a user who prefers a ${userProfile.tone} tone.
          Examples:
          Casual: "Hey there, superstar!"
          Harsh: "Ready to work?"
          Educative: "Welcome back, student."
          
          Just the greeting, nothing else. No quotes.
        `;
        
        const welcomeResult = await model.generateContent(welcomePrompt);
        const welcomeResponse = await welcomeResult.response;
        setAiWelcome(welcomeResponse.text().trim());

      } catch (error) {
        console.error("Error generating AI content:", error);
        setAiInsight("Great job on your savings! Keep it up!");
        setAiWelcome("Welcome back");
      } finally {
        setLoadingAi(false);
      }
    };

    generateAiContent();
  }, [userProfile, savingsHistory.length]); // Re-run if profile or history length changes

  return (
    <div className="min-h-screen bg-[#2D2D2D] relative">
      {/* Animated Aurora background - Fixed position */}
      <div className="fixed inset-0 z-0 opacity-40 pointer-events-none">
        <Aurora
          colorStops={["#FF88B7", "#7B61FF", "#FF88B7"]}
          blend={0.6}
          amplitude={0.8}
          speed={0.4}
        />
      </div>

      {/* Scrollable Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="pt-8 pb-16 px-6">
          <div className="max-w-[1400px] mx-auto">
            <div className="flex items-center justify-end gap-4 mb-8">
              {onBackToOnboarding && (
                <button
                  onClick={onBackToOnboarding}
                  className="text-white/60 hover:text-white transition-all duration-200 flex items-center gap-2 text-sm px-3 py-2 rounded-lg hover:bg-white/10"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Onboarding
                </button>
              )}
              <button
                onClick={signOut}
                className="text-white/60 hover:text-white transition-all duration-200 flex items-center gap-2 text-sm px-3 py-2 rounded-lg hover:bg-white/10"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>

            <h1 className="text-center mb-4 text-white text-[32px] font-bold">
              Welcome back, {user?.user_metadata?.full_name?.split(' ')[0] || 'Investor'}
            </h1>
            {aiWelcome && (
              <p className="text-center text-[#FF88B7] text-lg font-medium mb-2 animate-fade-in">
                {aiWelcome}
              </p>
            )}
            <div className="text-center max-w-2xl mx-auto">
              <p className="text-sm text-white/80 mb-3">
                Every time you skip an impulse purchase while shopping online, track it here.
                See how that money <span className="text-[#FF88B7] font-medium">could have grown</span> if you had invested it instead!
              </p>
              <div className="flex items-center justify-center gap-2 text-xs text-white/60 bg-white/5 px-4 py-2 rounded-full inline-flex border border-white/10 mb-8">
                <Info className="w-3.5 h-3.5" />
                <span>This shows projected growth based on historical ETF returns - not actual investing</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Dashboard */}
        <div className="max-w-[1400px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] gap-6 pb-12">
        {/* Left Sidebar */}
        <div className="space-y-6">
          {/* Recently Visited */}
          <div className="bg-white rounded-2xl p-6 border border-[#e5e5e5]">
            <h3 className="mb-4">Recently Visited</h3>
            <div className="space-y-3">
              {recentlyVisited.map((item, index) => (
                <div key={index} className="flex items-center gap-3">
                  {item.icon ? (
                    <img src={item.icon} alt={item.company} className="w-10 h-10 rounded-lg object-cover bg-[#f5f5f5]" />
                  ) : (
                    <div className="w-10 h-10 bg-[#e5e5e5] rounded-lg flex items-center justify-center text-xs text-[#666]">
                      {item.company.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="text-sm">{item.company}</div>
                    <div className="text-xs text-[#999999]">{item.daysAgo} day{item.daysAgo > 1 ? 's' : ''} ago</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Impulse Purchases (Failures) */}
          {failuresHistory.length > 0 && (
            <div className="bg-white rounded-2xl p-6 border border-[#e5e5e5]">
              <h3 className="mb-4 text-red-600 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Impulse Buys
              </h3>
              <div className="space-y-3">
                {failuresHistory.slice(0, 3).map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center text-xs text-red-500 border border-red-100">
                        {item.company.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm text-[#333]">{item.company}</div>
                        <div className="text-xs text-[#999]">{item.daysAgo} days ago</div>
                      </div>
                    </div>
                    <div className="text-sm font-medium text-red-600">-${item.amount.toFixed(2)}</div>
                  </div>
                ))}
                {failuresHistory.length > 3 && (
                  <div className="text-xs text-center text-[#999] pt-2">
                    + {failuresHistory.length - 3} more
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Progress */}
          <div className="bg-white rounded-2xl p-6 border border-[#e5e5e5]">
            <div className="flex items-center justify-between mb-4">
              <h3>My Goals</h3>
              <button
                onClick={() => setShowAddGoal(!showAddGoal)}
                className="text-xs px-3 py-1.5 bg-gradient-to-r from-[#FF88B7] to-[#7B61FF] text-white rounded-lg hover:opacity-90 transition-opacity"
              >
                {showAddGoal ? 'Cancel' : '+ Add Goal'}
              </button>
            </div>

            {showAddGoal && (
              <div className="mb-4 p-4 bg-[#f5f5f5] rounded-xl space-y-3">
                <div>
                  <label className="text-xs text-[#666] mb-1 block">Goal Name</label>
                  <input
                    type="text"
                    value={newGoal.name}
                    onChange={(e) => setNewGoal({ ...newGoal, name: e.target.value })}
                    placeholder="e.g., Emergency Fund"
                    className="w-full px-3 py-2 bg-white rounded-lg text-sm outline-none border border-[#e5e5e5]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#666] mb-1 block">Target Amount</label>
                  <input
                    type="number"
                    value={newGoal.targetAmount || ''}
                    onChange={(e) => setNewGoal({ ...newGoal, targetAmount: parseFloat(e.target.value) || 0 })}
                    placeholder="$1,000"
                    className="w-full px-3 py-2 bg-white rounded-lg text-sm outline-none border border-[#e5e5e5]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#666] mb-1 block">Allocate Now</label>
                  <input
                    type="number"
                    value={newGoal.allocatedAmount || ''}
                    onChange={(e) => setNewGoal({ ...newGoal, allocatedAmount: parseFloat(e.target.value) || 0 })}
                    placeholder="$100"
                    className="w-full px-3 py-2 bg-white rounded-lg text-sm outline-none border border-[#e5e5e5]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#666] mb-1 block">Color</label>
                  <div className="flex gap-2">
                    {['#FF88B7', '#7B61FF', '#0fedbe', '#ffaa2b', '#FF6B9D', '#9B83FF'].map((color) => (
                      <button
                        key={color}
                        onClick={() => setNewGoal({ ...newGoal, color })}
                        className={`w-8 h-8 rounded-lg transition-all ${
                          newGoal.color === color ? 'ring-2 ring-offset-2 ring-gray-400' : ''
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleAddGoal}
                  className="w-full py-2 bg-gradient-to-r from-[#FF88B7] to-[#7B61FF] text-white text-sm rounded-lg hover:opacity-90 transition-opacity"
                >
                  Add Goal
                </button>
              </div>
            )}

            {(() => {
              const totalAllocated = goals.reduce((sum, g) => sum + g.allocatedAmount, 0);
              const unallocated = Math.max(0, totalSaved - totalAllocated);
              
              return (
                <>
                  <div className="mb-4 p-3 bg-gradient-to-br from-[#FF88B7]/10 to-[#7B61FF]/10 rounded-lg border border-[#FF88B7]/20">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-[#666]">Total Allocated</span>
                      <span className="font-medium">${totalAllocated.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#666]">Unallocated</span>
                      <span className="font-medium text-[#7B61FF]">${unallocated.toFixed(2)}</span>
                    </div>
                  </div>

                  {goals.length === 0 ? (
                    <div className="text-center py-8 text-sm text-[#999]">
                      <p className="mb-2">No goals yet</p>
                      <p className="text-xs">Add a goal to start tracking!</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {goals.map((goal) => {
                        const progressPercentage = goal.targetAmount > 0 
                          ? Math.min((goal.allocatedAmount / goal.targetAmount) * 100, 100)
                          : 0;
                        const isComplete = goal.allocatedAmount >= goal.targetAmount;
                        
                        return (
                          <div key={goal.id}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 flex-1">
                                <div 
                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: goal.color }}
                                />
                                <span className="text-sm truncate">{goal.name}</span>
                              </div>
                              <button
                                onClick={() => handleDeleteGoal(goal.id)}
                                className="text-xs text-[#999] hover:text-[#ef4444] transition-colors ml-2"
                              >
                                ✕
                              </button>
                            </div>
                            
                            <div className="mb-2 flex items-center gap-2">
                              <div className="flex-1 relative">
                                <span className="absolute left-2 top-1.5 text-xs text-[#999]">$</span>
                                <input
                                  type="number"
                                  value={goalInputValues[goal.id] !== undefined ? goalInputValues[goal.id] : (goal.allocatedAmount || '')}
                                  onChange={(e) => setGoalInputValues({...goalInputValues, [goal.id]: e.target.value})}
                                  className="w-full pl-5 pr-2 py-1.5 bg-white rounded-lg text-xs outline-none border border-[#e5e5e5] focus:border-[#FF88B7]"
                                  placeholder="0"
                                />
                              </div>
                              <button
                                onClick={() => handleSaveGoalAllocation(goal.id)}
                                className="px-2 py-1.5 bg-[#f5f5f5] hover:bg-[#e5e5e5] text-[#666] text-xs rounded-lg transition-colors"
                              >
                                Save
                              </button>
                              <span className="text-xs text-[#666]">/ ${goal.targetAmount}</span>
                            </div>
                            
                            <div className="h-2 bg-[#f0f0f0] rounded-full overflow-hidden">
                              <div 
                                className="h-full transition-all duration-500"
                                style={{ 
                                  width: `${progressPercentage}%`,
                                  background: `linear-gradient(to right, ${goal.color}, ${goal.color}dd)`
                                }}
                              />
                            </div>
                            {isComplete && (
                              <div className="text-xs text-[#0fedbe] mt-1">✓ Goal reached!</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        {/* Main Chart Area */}
        <div className="space-y-6">
          {/* Gains Highlight Card - Collapsible */}
          <button
            onClick={() => setIsGainsCardExpanded(!isGainsCardExpanded)}
            className="w-full bg-gradient-to-br from-[#FF88B7] via-[#FF9FC8] to-[#FFB6D9] rounded-2xl p-6 text-white shadow-lg transition-all hover:shadow-xl"
          >
            {!isGainsCardExpanded ? (
              // Collapsed View
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6 flex-1">
                  <div className="text-left">
                    <div className="text-xs opacity-75 mb-1">Your Money Could Grow To</div>
                    <div className="text-4xl font-bold">${currentValue.toFixed(2)}</div>
                  </div>
                  <div className="text-left">
                    <div className="text-xs opacity-75 mb-1">Potential Reward Earned</div>
                    <div className="text-2xl font-bold flex items-center gap-2 bg-white/20 px-3 py-1 rounded-lg backdrop-blur-sm">
                      +${totalGain.toFixed(2)}
                      <span className="text-sm opacity-90 font-normal">(+{gainPercentage}%)</span>
                    </div>
                  </div>
                  <div className="text-left opacity-80">
                    <div className="text-xs mb-1">Money You Saved</div>
                    <div className="text-xl">${totalSaved.toFixed(2)}</div>
                  </div>
                </div>
                <ChevronDown className="w-6 h-6 opacity-75" />
              </div>
            ) : (
              // Expanded View
              <div>
                <div className="flex items-start justify-between mb-6 pb-4 border-b border-white/20">
                  <div className="flex items-start gap-3">
                    <Zap className="w-5 h-5 flex-shrink-0 mt-1" />
                    <div className="text-left">
                      <div className="text-xs opacity-90 mb-1">Recurring Contribution Scenario</div>
                      <div className="text-sm opacity-80 leading-relaxed">
                        Each time you saved, that money was automatically added to your {selectedTicker} portfolio and started growing from that day!
                      </div>
                    </div>
                  </div>
                  <ChevronUp className="w-6 h-6 opacity-75 flex-shrink-0" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex-1 text-left">
                    <div className="text-sm opacity-90 mb-2">Your Money Could Grow To</div>
                    <div className="text-5xl mb-3 font-bold">${currentValue.toFixed(2)}</div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-xl backdrop-blur-sm">
                        <TrendingUp className="w-5 h-5" />
                        <span className="text-xl font-bold">+${totalGain.toFixed(2)}</span>
                      </div>
                      <div className="px-3 py-1 bg-white/10 rounded-lg backdrop-blur-sm">
                        <span className="text-sm">+{gainPercentage}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right opacity-80">
                    <div className="text-sm mb-2">Money You Saved</div>
                    <div className="text-2xl mb-3">${totalSaved.toFixed(2)}</div>
                    <div className="text-xs opacity-75">from skipping {impulsePurchasesCancelled} purchases</div>
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-white/20">
                  <div className="flex items-center justify-between">
                    <div className="text-left">
                      <div className="text-sm opacity-90 mb-1">Your Potential Reward</div>
                      <div className="text-xs opacity-75">This is the extra money you could earn</div>
                    </div>
                    <span className="text-3xl font-bold">${totalGain.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </button>

          {/* History - Moved Up */}
          <div className="bg-white rounded-2xl p-6 border border-[#e5e5e5]">
            <div className="mb-4">
              <h3 className="mb-1">Savings History</h3>
              <p className="text-xs text-[#666]">Each time you avoided an impulse buy, that amount was added to your portfolio on that day and started growing</p>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-[1fr_auto] pb-2 border-b border-[#f0f0f0] text-sm text-[#666]">
                <div>Contribution Added</div>
                <div className="text-right">Amount</div>
              </div>
              {savingsHistory.map((item) => (
                <div key={item.id} className="grid grid-cols-[1fr_auto] items-center gap-4">
                  <div className="flex items-center gap-3">
                    {item.icon ? (
                      <img src={item.icon} alt={item.company} className="w-10 h-10 rounded-lg object-cover bg-[#f5f5f5]" />
                    ) : (
                      <div className="w-10 h-10 bg-[#e5e5e5] rounded-lg flex items-center justify-center text-xs text-[#666]">
                        {item.company.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="text-sm">{item.company}</div>
                      <div className="text-xs text-[#999999]">Added {item.daysAgo} day{item.daysAgo > 1 ? 's' : ''} ago</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm mb-0.5">${item.amount.toFixed(2)}</div>
                    <div className="text-xs text-[#FF88B7]">→ Portfolio</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Total Summary */}
            <div className="mt-6 pt-4 border-t-2 border-[#e5e5e5] grid grid-cols-2 items-center">
              <div className="font-medium">Total Contributed</div>
              <div className="text-right">${totalSaved.toFixed(2)}</div>
            </div>
          </div>

          {/* Investment Chart */}
          <div className="bg-white rounded-2xl p-6 border border-[#e5e5e5]">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="text-3xl mb-1">${currentValue.toFixed(2)}</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#FF88B7]">+${totalGain.toFixed(2)} ({gainPercentage}%)</span>
                  <TrendingUp className="w-4 h-4 text-[#FF88B7]" />
                </div>
              </div>
              <div className="relative">
                <button 
                  className="flex items-center gap-2 px-4 py-2 bg-[#f5f5f5] rounded-lg hover:bg-[#e5e5e5] transition-colors cursor-pointer"
                  onClick={() => setShowTickerDropdown(!showTickerDropdown)}
                >
                  <div>
                    <div className="text-sm">{selectedTicker}</div>
                    <div className="text-xs text-[#666]">{ETF_OPTIONS[selectedTicker].description}</div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-[#999999]" />
                </button>
                {showTickerDropdown && (
                  <div className="absolute right-0 top-full mt-2 bg-white border border-[#e5e5e5] rounded-lg shadow-lg z-10 min-w-[280px]">
                    {(Object.keys(ETF_OPTIONS) as ETFTicker[]).map((ticker) => (
                      <button
                        key={ticker}
                        className="w-full px-4 py-3 text-left hover:bg-[#f0f0f0] first:rounded-t-lg last:rounded-b-lg transition-colors border-b border-[#f0f0f0] last:border-b-0"
                        onClick={() => {
                          setSelectedTicker(ticker);
                          setShowTickerDropdown(false);
                        }}
                      >
                        <div className="text-sm mb-0.5">{ticker}</div>
                        <div className="text-xs text-[#999]">{ETF_OPTIONS[ticker].description}</div>
                        <div className="text-xs text-[#0fedbe] mt-1">~{(ETF_OPTIONS[ticker].annualReturn * 100).toFixed(1)}% annual return</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="h-[320px] -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={etfData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF88B7" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#FF88B7" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#999999"
                    style={{ fontSize: '12px' }}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="#999999"
                    style={{ fontSize: '12px' }}
                    tickLine={false}
                    tickFormatter={(value) => `$${value.toFixed(0)}`}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: '1px solid #e5e5e5',
                      borderRadius: '8px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === 'value') return [`$${value.toFixed(2)}`, 'Portfolio Value'];
                      if (name === 'principal') return [`$${value.toFixed(2)}`, 'Principal'];
                      if (name === 'gain') return [`$${value.toFixed(2)}`, 'Gain'];
                      return value;
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#FF88B7" 
                    strokeWidth={2}
                    fill="url(#colorValue)" 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="principal" 
                    stroke="#7B61FF" 
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center justify-center gap-6 mt-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#FF88B7]" />
                <span className="text-[#666]">Projected Value</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-0.5 bg-[#7B61FF]" />
                <span className="text-[#666]">Principal</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Investment Summary Cards */}
          <div className="bg-gradient-to-br from-[#7B61FF] to-[#9B83FF] rounded-2xl p-6 text-white">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-5 h-5" />
              <span className="text-sm opacity-90">Investment Period</span>
            </div>
            <div className="text-sm mb-1 opacity-90">
              {accountCreationDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {' - '}
              {endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
            <div className="text-xs opacity-75 mb-4">Account opened {Math.floor((new Date().getTime() - accountCreationDate.getTime()) / (1000 * 60 * 60 * 24))} days ago</div>
            
            {/* Time Range Selector */}
            <div className="flex gap-2 mb-4">
              {(['6mo', '1Y', '2Y', '5Y'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs transition-all ${
                    timeRange === range
                      ? 'bg-white text-[#7B61FF]'
                      : 'bg-white/20 hover:bg-white/30'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
            
            {/* Recurring Contributions Section */}
            <div className="pt-4 border-t border-white/20">
              <div className="text-xs opacity-90 mb-3">Set Regular Contributions</div>
              <div className="flex gap-2 mb-2">
                <div className="flex-1 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/20">
                  <input
                    type="number"
                    value={recurringAmount || ''}
                    onChange={(e) => setRecurringAmount(parseFloat(e.target.value) || 0)}
                    placeholder="$0"
                    className="w-full bg-transparent text-white text-sm outline-none placeholder:text-white/40"
                  />
                </div>
                <div className="flex gap-1 bg-white/10 backdrop-blur-sm rounded-lg p-1 border border-white/20">
                  <button
                    onClick={() => setRecurringFrequency('weekly')}
                    className={`px-2 py-1 rounded text-xs transition-all ${
                      recurringFrequency === 'weekly'
                        ? 'bg-white text-[#7B61FF]'
                        : 'text-white/80 hover:text-white'
                    }`}
                  >
                    /wk
                  </button>
                  <button
                    onClick={() => setRecurringFrequency('monthly')}
                    className={`px-2 py-1 rounded text-xs transition-all ${
                      recurringFrequency === 'monthly'
                        ? 'bg-white text-[#7B61FF]'
                        : 'text-white/80 hover:text-white'
                    }`}
                  >
                    /mo
                  </button>
                </div>
              </div>
              {recurringAmount > 0 && (
                <div className="text-xs opacity-75 mt-2">
                  Adding ${recurringAmount} {recurringFrequency} to your portfolio
                </div>
              )}
            </div>
          </div>

          {/* Educational Resources */}
          <div className="bg-white rounded-2xl p-6 border border-[#e5e5e5]">
            <h3 className="mb-4">Educational Resources</h3>
            <div className="space-y-3">
              <div className="h-24 bg-gradient-to-br from-[#f5f5f5] to-[#e5e5e5] rounded-xl flex items-center justify-center text-xs text-[#999]">
                What is an ETF?
              </div>
              <div className="h-24 bg-gradient-to-br from-[#f5f5f5] to-[#e5e5e5] rounded-xl flex items-center justify-center text-xs text-[#999]">
                Compound Interest
              </div>
              <div className="h-24 bg-gradient-to-br from-[#f5f5f5] to-[#e5e5e5] rounded-xl flex items-center justify-center text-xs text-[#999]">
                Investment Basics
              </div>
            </div>
          </div>

          {/* Key Insights */}
          <div className="bg-[#fff7ed] rounded-2xl p-6 border border-[#ffaa2b]">
            <div className="flex items-start gap-3">
              <Target className="w-5 h-5 text-[#ffaa2b] flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm mb-2">💡 Key Insight</div>
                <div className="text-xs text-[#666] leading-relaxed">
                  {loadingAi ? (
                    <span className="animate-pulse">Generating personalized insight...</span>
                  ) : aiInsight ? (
                    aiInsight
                  ) : (
                    <>
                      By avoiding just {impulsePurchasesCancelled} impulse purchases, you could grow your savings to 
                      <span className="text-[#ffaa2b]"> ${currentValue.toFixed(2)}</span> in {timeRangeLabel} through smart investing!
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
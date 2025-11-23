import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import {
  TrendingUp,
  Calendar,
  DollarSign,
  Target,
  ChevronDown,
  Info,
  Zap,
  ChevronUp,
  CreditCard,
  AlertCircle,
  LogOut,
  ArrowLeft,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

// Import educational articles images
import article1 from "../assets/article-1.jpeg";
import article2 from "../assets/article-2.jpeg";
import article3 from "../assets/article-3.jpeg";

// Mock savings history data
interface SavingsItem {
  id: string;
  company: string;
  amount: number;
  date: string;
  daysAgo: number;
}

// ETF options with different return rates
const ETF_OPTIONS = {
  VDY: {
    name: "Vanguard Canadian High Dividend Yield",
    annualReturn: 0.07,
    description: "Canadian Dividend ETF",
  },
  VFV: {
    name: "Vanguard S&P 500 Index",
    annualReturn: 0.11,
    description: "S&P 500 CAD",
  },
  SPY: {
    name: "SPDR S&P 500 ETF",
    annualReturn: 0.11,
    description: "S&P 500 USD",
  },
  XEQT: {
    name: "iShares Core Equity ETF",
    annualReturn: 0.09,
    description: "All Equity Balanced",
  },
  QQQ: {
    name: "Invesco QQQ Trust",
    annualReturn: 0.14,
    description: "Nasdaq 100",
  },
};

type ETFTicker = keyof typeof ETF_OPTIONS;

// Generate mock ETF data based on recurring contributions (dollar-cost averaging)
function generateETFData(
  savingsHistory: SavingsItem[],
  startDate: Date,
  endDate: Date,
  ticker: ETFTicker,
  recurringAmount: number,
  recurringFrequency: "weekly" | "monthly"
) {
  const data = [];
  const daysDiff = Math.floor(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const annualReturn = ETF_OPTIONS[ticker].annualReturn;
  const dailyReturn = Math.pow(1 + annualReturn, 1 / 365) - 1;

  // Sort savings by date (oldest first)
  const sortedSavings = [...savingsHistory].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Track each contribution separately with its growth
  const contributions: {
    date: Date;
    amount: number;
    currentValue: number;
    type: "impulse" | "recurring";
  }[] = [];

  // Calculate interval days for recurring contributions
  const recurringIntervalDays = recurringFrequency === "weekly" ? 7 : 30;
  let nextRecurringDate = new Date(
    new Date().getTime() + recurringIntervalDays * 24 * 60 * 60 * 1000
  );

  for (let i = 0; i <= daysDiff; i += 1) {
    // Daily calculations
    const currentDate = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);

    // Check if any impulse savings should be added on this date
    sortedSavings.forEach((saving) => {
      const savingDate = new Date(saving.date);
      // Add contribution if it matches current date and hasn't been added yet
      if (
        savingDate.toDateString() === currentDate.toDateString() &&
        !contributions.some(
          (c) =>
            c.date.getTime() === savingDate.getTime() &&
            c.amount === saving.amount &&
            c.type === "impulse"
        )
      ) {
        contributions.push({
          date: new Date(savingDate),
          amount: saving.amount,
          currentValue: saving.amount,
          type: "impulse",
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
          type: "recurring",
        });
        nextRecurringDate = new Date(
          nextRecurringDate.getTime() +
            recurringIntervalDays * 24 * 60 * 60 * 1000
        );
      }
    }

    // Grow all existing contributions by daily return
    const volatility = (Math.random() - 0.5) * 0.003;
    const todayReturn = dailyReturn + volatility;

    contributions.forEach((contribution) => {
      contribution.currentValue = contribution.currentValue * (1 + todayReturn);
    });

    // Calculate totals
    const totalValue = contributions.reduce(
      (sum, c) => sum + c.currentValue,
      0
    );
    const totalPrincipal = contributions.reduce((sum, c) => sum + c.amount, 0);
    const impulseSavingsTotal = contributions
      .filter((c) => c.type === "impulse")
      .reduce((sum, c) => sum + c.amount, 0);
    const recurringTotal = contributions
      .filter((c) => c.type === "recurring")
      .reduce((sum, c) => sum + c.amount, 0);

    // Add data point every 7 days for chart performance
    if (i % 7 === 0) {
      data.push({
        date: currentDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
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

// Calculate loan payoff scenarios
function calculateLoanPayoff(
  loanAmount: number,
  annualInterestRate: number,
  monthlyPayment: number,
  extraMonthlyFromGains: number
) {
  if (loanAmount <= 0 || monthlyPayment <= 0) {
    return {
      standardMonths: 0,
      acceleratedMonths: 0,
      timeSaved: 0,
      interestSaved: 0,
      standardTotalPaid: 0,
      acceleratedTotalPaid: 0,
    };
  }

  const monthlyRate = annualInterestRate / 12 / 100;

  // Standard payoff calculation
  let standardBalance = loanAmount;
  let standardMonths = 0;
  let standardTotalInterest = 0;

  while (standardBalance > 0 && standardMonths < 600) {
    // 50 year cap
    const interestCharge = standardBalance * monthlyRate;
    const principalPayment = Math.min(
      monthlyPayment - interestCharge,
      standardBalance
    );

    if (principalPayment <= 0) {
      // Payment doesn't cover interest - loan grows indefinitely
      standardMonths = 0;
      break;
    }

    standardTotalInterest += interestCharge;
    standardBalance -= principalPayment;
    standardMonths++;
  }

  // Accelerated payoff calculation (with extra payment from gains)
  let acceleratedBalance = loanAmount;
  let acceleratedMonths = 0;
  let acceleratedTotalInterest = 0;
  const totalMonthlyPayment = monthlyPayment + extraMonthlyFromGains;

  while (acceleratedBalance > 0 && acceleratedMonths < 600) {
    const interestCharge = acceleratedBalance * monthlyRate;
    const principalPayment = Math.min(
      totalMonthlyPayment - interestCharge,
      acceleratedBalance
    );

    if (principalPayment <= 0) {
      acceleratedMonths = 0;
      break;
    }

    acceleratedTotalInterest += interestCharge;
    acceleratedBalance -= principalPayment;
    acceleratedMonths++;
  }

  return {
    standardMonths,
    acceleratedMonths,
    timeSaved: standardMonths - acceleratedMonths,
    interestSaved: standardTotalInterest - acceleratedTotalInterest,
    standardTotalPaid: loanAmount + standardTotalInterest,
    acceleratedTotalPaid: loanAmount + acceleratedTotalInterest,
  };
}

export function InvestmentDashboard({
  onBackToOnboarding,
}: {
  onBackToOnboarding?: () => void;
}) {
  const { signOut, user } = useAuth();
  const [selectedTicker, setSelectedTicker] = useState<ETFTicker>("VDY");
  const [showTickerDropdown, setShowTickerDropdown] = useState(false);
  const [isGainsCardExpanded, setIsGainsCardExpanded] = useState(false);
  const [timeRange, setTimeRange] = useState<"6mo" | "1Y" | "2Y" | "5Y">("1Y");
  const [recurringAmount, setRecurringAmount] = useState<number>(0);
  const [recurringFrequency, setRecurringFrequency] = useState<
    "weekly" | "monthly"
  >("weekly");

  // Goals tracking state
  interface Goal {
    id: string;
    name: string;
    targetAmount: number;
    allocatedAmount: number;
    color: string;
  }

  const [goals, setGoals] = useState<Goal[]>([
    {
      id: "1",
      name: "Emergency Fund",
      targetAmount: 1000,
      allocatedAmount: 100,
      color: "#FF88B7",
    },
    {
      id: "2",
      name: "Vacation Fund",
      targetAmount: 500,
      allocatedAmount: 39.75,
      color: "#7B61FF",
    },
  ]);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newGoal, setNewGoal] = useState({
    name: "",
    targetAmount: 0,
    allocatedAmount: 0,
    color: "#FF88B7",
  });

  const [savingsHistory] = useState<SavingsItem[]>([
    {
      id: "1",
      company: "UNIQLO",
      amount: 45.0,
      date: "2025-11-21",
      daysAgo: 1,
    },
    {
      id: "2",
      company: "ARITZIA",
      amount: 28.5,
      date: "2025-11-21",
      daysAgo: 1,
    },
    {
      id: "3",
      company: "LULULEMON",
      amount: 32.0,
      date: "2025-11-20",
      daysAgo: 2,
    },
    { id: "4", company: "ZARA", amount: 18.75, date: "2025-11-19", daysAgo: 3 },
    { id: "5", company: "H&M", amount: 15.25, date: "2025-11-18", daysAgo: 4 },
  ]);

  const [recentlyVisited] = useState([
    { company: "UNIQLO", daysAgo: 1 },
    { company: "ARITZIA", daysAgo: 1 },
    { company: "LULULEMON", daysAgo: 2 },
  ]);

  const totalSaved = useMemo(
    () => savingsHistory.reduce((sum, item) => sum + item.amount, 0),
    [savingsHistory]
  );

  // Account creation date (earliest save date)
  const accountCreationDate = useMemo(() => {
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
      case "6mo":
        end.setMonth(end.getMonth() + 6);
        break;
      case "1Y":
        end.setFullYear(end.getFullYear() + 1);
        break;
      case "2Y":
        end.setFullYear(end.getFullYear() + 2);
        break;
      case "5Y":
        end.setFullYear(end.getFullYear() + 5);
        break;
    }
    return end;
  }, [timeRange]);

  const etfData = useMemo(
    () =>
      generateETFData(
        savingsHistory,
        accountCreationDate,
        endDate,
        selectedTicker,
        recurringAmount,
        recurringFrequency
      ),
    [
      savingsHistory,
      accountCreationDate,
      endDate,
      selectedTicker,
      recurringAmount,
      recurringFrequency,
    ]
  );

  const currentValue = etfData[etfData.length - 1]?.value || totalSaved;
  const totalPrincipal = etfData[etfData.length - 1]?.principal || totalSaved;
  const totalGain = currentValue - totalPrincipal;
  const gainPercentage =
    totalPrincipal > 0
      ? ((totalGain / totalPrincipal) * 100).toFixed(2)
      : "0.00";

  const impulsePurchasesCancelled = savingsHistory.length;
  const goalAmount = 300;
  const progressPercentage = Math.min((totalSaved / goalAmount) * 100, 100);

  // Calculate time range label
  const timeRangeLabel = useMemo(() => {
    const months = Math.floor(
      (endDate.getTime() - accountCreationDate.getTime()) /
        (1000 * 60 * 60 * 24 * 30)
    );
    if (timeRange === "6mo") return "6 months";
    if (timeRange === "1Y") return "1 year";
    if (timeRange === "2Y") return "2 years";
    if (timeRange === "5Y") return "5 years";
    return `${months} months`;
  }, [timeRange, endDate, accountCreationDate]);

  return (
    <div className="min-h-screen px-12 py-8">
      {/* removed bg-[#f8f9fa] */}
      {/* Header */}
      <div className="max-w-[1400px] mx-auto mb-8">
        <div className="bg-[#2D2D2D]/90 backdrop-blur-xl rounded-3xl p-8 border border-white/10 relative">
          <div className="absolute top-6 right-6 flex gap-3">
            {/* Back to Onboarding Button */}
            {onBackToOnboarding && (
              <button
                onClick={onBackToOnboarding}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/15 text-white/80 hover:text-white rounded-xl transition-all duration-300 hover:scale-105 border border-white/10"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Onboarding</span>
              </button>
            )}

            {/* Logout Button */}
            <button
              onClick={() => signOut()}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/15 text-white/80 hover:text-white rounded-xl transition-all duration-300 hover:scale-105 border border-white/10"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>

          <h1 className="text-center mb-4 text-white text-[32px] font-bold">
            Welcome back,{" "}
            {user?.user_metadata?.full_name?.split(" ")[0] || "Investor"}
          </h1>
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-sm text-white/80 mb-3">
              Every time you skip an impulse purchase while shopping online,
              track it here. See how that money{" "}
              <span className="text-[#FF88B7] font-medium">
                could have grown
              </span>{" "}
              if you had invested it instead!
            </p>
            <div className="flex items-center justify-center gap-2 text-xs text-white/60 bg-white/5 px-4 py-2 rounded-full inline-flex border border-white/10">
              <Info className="w-3.5 h-3.5" />
              <span>
                This shows projected growth based on historical ETF returns -
                not actual investing
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Dashboard */}
      <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] gap-6">
        {/* Left Sidebar */}
        <div className="space-y-6">
          {/* Recently Visited */}
          <div className="bg-white rounded-2xl p-6 border border-[#e5e5e5]">
            <h3 className="mb-4">Recently Visited</h3>
            <div className="space-y-3">
              {recentlyVisited.map((item, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#e5e5e5] rounded-lg" />
                  <div>
                    <div className="text-sm">{item.company}</div>
                    <div className="text-xs text-[#999999]">
                      {item.daysAgo} day{item.daysAgo > 1 ? "s" : ""} ago
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Progress */}
          <div className="bg-white rounded-2xl p-6 border border-[#e5e5e5]">
            <div className="flex items-center justify-between mb-4">
              <h3>My Goals</h3>
              <button
                onClick={() => setShowAddGoal(!showAddGoal)}
                className="text-xs px-3 py-1.5 bg-gradient-to-r from-[#FF88B7] to-[#7B61FF] text-white rounded-lg hover:opacity-90 transition-opacity"
              >
                {showAddGoal ? "Cancel" : "+ Add Goal"}
              </button>
            </div>

            {showAddGoal && (
              <div className="mb-4 p-4 bg-[#f5f5f5] rounded-xl space-y-3">
                <div>
                  <label className="text-xs text-[#666] mb-1 block">
                    Goal Name
                  </label>
                  <input
                    type="text"
                    value={newGoal.name}
                    onChange={(e) =>
                      setNewGoal({ ...newGoal, name: e.target.value })
                    }
                    placeholder="e.g., Emergency Fund"
                    className="w-full px-3 py-2 bg-white rounded-lg text-sm outline-none border border-[#e5e5e5]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#666] mb-1 block">
                    Target Amount
                  </label>
                  <input
                    type="number"
                    value={newGoal.targetAmount || ""}
                    onChange={(e) =>
                      setNewGoal({
                        ...newGoal,
                        targetAmount: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="$1,000"
                    className="w-full px-3 py-2 bg-white rounded-lg text-sm outline-none border border-[#e5e5e5]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#666] mb-1 block">
                    Allocate Now
                  </label>
                  <input
                    type="number"
                    value={newGoal.allocatedAmount || ""}
                    onChange={(e) =>
                      setNewGoal({
                        ...newGoal,
                        allocatedAmount: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="$100"
                    className="w-full px-3 py-2 bg-white rounded-lg text-sm outline-none border border-[#e5e5e5]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#666] mb-1 block">
                    Color
                  </label>
                  <div className="flex gap-2">
                    {[
                      "#FF88B7",
                      "#7B61FF",
                      "#0fedbe",
                      "#ffaa2b",
                      "#FF6B9D",
                      "#9B83FF",
                    ].map((color) => (
                      <button
                        key={color}
                        onClick={() => setNewGoal({ ...newGoal, color })}
                        className={`w-8 h-8 rounded-lg transition-all ${
                          newGoal.color === color
                            ? "ring-2 ring-offset-2 ring-gray-400"
                            : ""
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (newGoal.name && newGoal.targetAmount > 0) {
                      setGoals([
                        ...goals,
                        { ...newGoal, id: Date.now().toString() },
                      ]);
                      setNewGoal({
                        name: "",
                        targetAmount: 0,
                        allocatedAmount: 0,
                        color: "#FF88B7",
                      });
                      setShowAddGoal(false);
                    }
                  }}
                  className="w-full py-2 bg-gradient-to-r from-[#FF88B7] to-[#7B61FF] text-white text-sm rounded-lg hover:opacity-90 transition-opacity"
                >
                  Add Goal
                </button>
              </div>
            )}

            {(() => {
              const totalAllocated = goals.reduce(
                (sum, g) => sum + g.allocatedAmount,
                0
              );
              const unallocated = Math.max(0, currentValue - totalAllocated);

              return (
                <>
                  <div className="mb-4 p-3 bg-gradient-to-br from-[#FF88B7]/10 to-[#7B61FF]/10 rounded-lg border border-[#FF88B7]/20">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-[#666]">Total Allocated</span>
                      <span className="font-medium">
                        ${totalAllocated.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#666]">Unallocated</span>
                      <span className="font-medium text-[#7B61FF]">
                        ${unallocated.toFixed(2)}
                      </span>
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
                        const progressPercentage =
                          goal.targetAmount > 0
                            ? Math.min(
                                (goal.allocatedAmount / goal.targetAmount) *
                                  100,
                                100
                              )
                            : 0;
                        const isComplete =
                          goal.allocatedAmount >= goal.targetAmount;

                        return (
                          <div key={goal.id}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 flex-1">
                                <div
                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: goal.color }}
                                />
                                <span className="text-sm truncate">
                                  {goal.name}
                                </span>
                              </div>
                              <button
                                onClick={() =>
                                  setGoals(
                                    goals.filter((g) => g.id !== goal.id)
                                  )
                                }
                                className="text-xs text-[#999] hover:text-[#ef4444] transition-colors ml-2"
                              >
                                ✕
                              </button>
                            </div>

                            <div className="mb-2 flex items-center gap-2">
                              <div className="flex-1 relative">
                                <span className="absolute left-2 top-1.5 text-xs text-[#999]">
                                  $
                                </span>
                                <input
                                  type="number"
                                  value={goal.allocatedAmount || ""}
                                  onChange={(e) => {
                                    const newAmount =
                                      parseFloat(e.target.value) || 0;
                                    setGoals(
                                      goals.map((g) =>
                                        g.id === goal.id
                                          ? { ...g, allocatedAmount: newAmount }
                                          : g
                                      )
                                    );
                                  }}
                                  className="w-full pl-5 pr-2 py-1.5 bg-white rounded-lg text-xs outline-none border border-[#e5e5e5] focus:border-[#FF88B7]"
                                  placeholder="0"
                                />
                              </div>
                              <span className="text-xs text-[#666]">
                                / ${goal.targetAmount}
                              </span>
                            </div>

                            <div className="h-2 bg-[#f0f0f0] rounded-full overflow-hidden">
                              <div
                                className="h-full transition-all duration-500"
                                style={{
                                  width: `${progressPercentage}%`,
                                  background: `linear-gradient(to right, ${goal.color}, ${goal.color}dd)`,
                                }}
                              />
                            </div>
                            {isComplete && (
                              <div className="text-xs text-[#0fedbe] mt-1">
                                ✓ Goal reached!
                              </div>
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
                    <div className="text-xs opacity-75 mb-1">
                      Your Money Could Grow To
                    </div>
                    <div className="text-3xl">${currentValue.toFixed(2)}</div>
                  </div>
                  <div className="text-left">
                    <div className="text-xs opacity-75 mb-1">
                      Potential Reward Earned
                    </div>
                    <div className="text-2xl flex items-center gap-2">
                      +${totalGain.toFixed(2)}
                      <span className="text-sm opacity-90">
                        (+{gainPercentage}%)
                      </span>
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="text-xs opacity-75 mb-1">
                      Money You Saved
                    </div>
                    <div className="text-2xl">${totalSaved.toFixed(2)}</div>
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
                      <div className="text-xs opacity-90 mb-1">
                        Recurring Contribution Scenario
                      </div>
                      <div className="text-sm opacity-80 leading-relaxed">
                        Each time you saved, that money was automatically added
                        to your {selectedTicker} portfolio and started growing
                        from that day!
                      </div>
                    </div>
                  </div>
                  <ChevronUp className="w-6 h-6 opacity-75 flex-shrink-0" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex-1 text-left">
                    <div className="text-sm opacity-90 mb-2">
                      Your Money Could Grow To
                    </div>
                    <div className="text-5xl mb-3">
                      ${currentValue.toFixed(2)}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" />
                        <span className="text-xl">
                          +${totalGain.toFixed(2)}
                        </span>
                      </div>
                      <div className="px-3 py-1 bg-white/20 rounded-lg backdrop-blur-sm">
                        <span className="text-sm">+{gainPercentage}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm opacity-90 mb-2">
                      Money You Saved
                    </div>
                    <div className="text-3xl mb-3">
                      ${totalSaved.toFixed(2)}
                    </div>
                    <div className="text-xs opacity-75">
                      from skipping {impulsePurchasesCancelled} purchases
                    </div>
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-white/20">
                  <div className="flex items-center justify-between">
                    <div className="text-left">
                      <div className="text-sm opacity-90 mb-1">
                        Your Potential Reward
                      </div>
                      <div className="text-xs opacity-75">
                        This is the extra money you could earn
                      </div>
                    </div>
                    <span className="text-3xl">${totalGain.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </button>

          {/* History - Moved Up */}
          <div className="bg-white rounded-2xl p-6 border border-[#e5e5e5]">
            <div className="mb-4">
              <h3 className="mb-1">Savings History</h3>
              <p className="text-xs text-[#666]">
                Each time you avoided an impulse buy, that amount was added to
                your portfolio on that day and started growing
              </p>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-[1fr_auto] pb-2 border-b border-[#f0f0f0] text-sm text-[#666]">
                <div>Contribution Added</div>
                <div className="text-right">Amount</div>
              </div>
              {savingsHistory.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#e5e5e5] rounded-lg" />
                    <div>
                      <div className="text-sm">{item.company}</div>
                      <div className="text-xs text-[#999999]">
                        Added {item.daysAgo} day{item.daysAgo > 1 ? "s" : ""}{" "}
                        ago
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm mb-0.5">
                      ${item.amount.toFixed(2)}
                    </div>
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
                  <span className="text-sm text-[#FF88B7]">
                    +${totalGain.toFixed(2)} ({gainPercentage}%)
                  </span>
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
                    <div className="text-xs text-[#666]">
                      {ETF_OPTIONS[selectedTicker].description}
                    </div>
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
                        <div className="text-xs text-[#999]">
                          {ETF_OPTIONS[ticker].description}
                        </div>
                        <div className="text-xs text-[#0fedbe] mt-1">
                          ~{(ETF_OPTIONS[ticker].annualReturn * 100).toFixed(1)}
                          % annual return
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="h-[320px] -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={etfData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF88B7" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#FF88B7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#f0f0f0"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    stroke="#999999"
                    style={{ fontSize: "12px" }}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#999999"
                    style={{ fontSize: "12px" }}
                    tickLine={false}
                    tickFormatter={(value) => `$${value.toFixed(0)}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(255, 255, 255, 0.95)",
                      border: "1px solid #e5e5e5",
                      borderRadius: "8px",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === "value")
                        return [`$${value.toFixed(2)}`, "Portfolio Value"];
                      if (name === "principal")
                        return [`$${value.toFixed(2)}`, "Principal"];
                      if (name === "gain")
                        return [`$${value.toFixed(2)}`, "Gain"];
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
                </AreaChart>
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
          <div className="bg-gradient-to-br from-[#FF88B7] to-[#FF9FC8] rounded-2xl p-6 text-white">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5" />
              <span className="text-sm opacity-90">Potential Gain</span>
            </div>
            <div className="text-2xl mb-1">${totalGain.toFixed(2)}</div>
            <div className="text-sm opacity-90">in {timeRangeLabel}</div>
          </div>

          <div className="bg-gradient-to-br from-[#7B61FF] to-[#9B83FF] rounded-2xl p-6 text-white">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-5 h-5" />
              <span className="text-sm opacity-90">Investment Period</span>
            </div>
            <div className="text-sm mb-1 opacity-90">
              {accountCreationDate.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
              {" - "}
              {endDate.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </div>
            <div className="text-xs opacity-75 mb-4">
              Account opened{" "}
              {Math.floor(
                (new Date().getTime() - accountCreationDate.getTime()) /
                  (1000 * 60 * 60 * 24)
              )}{" "}
              days ago
            </div>

            {/* Time Range Selector */}
            <div className="flex gap-2 mb-4">
              {(["6mo", "1Y", "2Y", "5Y"] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs transition-all ${
                    timeRange === range
                      ? "bg-white text-[#7B61FF]"
                      : "bg-white/20 hover:bg-white/30"
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>

            {/* Recurring Contributions Section */}
            <div className="pt-4 border-t border-white/20">
              <div className="text-xs opacity-90 mb-3">
                Set Regular Contributions
              </div>
              <div className="flex gap-2 mb-2">
                <div className="flex-1 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/20">
                  <input
                    type="number"
                    value={recurringAmount || ""}
                    onChange={(e) =>
                      setRecurringAmount(parseFloat(e.target.value) || 0)
                    }
                    placeholder="$0"
                    className="w-full bg-transparent text-white text-sm outline-none placeholder:text-white/40"
                  />
                </div>
                <div className="flex gap-1 bg-white/10 backdrop-blur-sm rounded-lg p-1 border border-white/20">
                  <button
                    onClick={() => setRecurringFrequency("weekly")}
                    className={`px-2 py-1 rounded text-xs transition-all ${
                      recurringFrequency === "weekly"
                        ? "bg-white text-[#7B61FF]"
                        : "text-white/80 hover:text-white"
                    }`}
                  >
                    /wk
                  </button>
                  <button
                    onClick={() => setRecurringFrequency("monthly")}
                    className={`px-2 py-1 rounded text-xs transition-all ${
                      recurringFrequency === "monthly"
                        ? "bg-white text-[#7B61FF]"
                        : "text-white/80 hover:text-white"
                    }`}
                  >
                    /mo
                  </button>
                </div>
              </div>
              {recurringAmount > 0 && (
                <div className="text-xs opacity-75 mt-2">
                  Adding ${recurringAmount} {recurringFrequency} to your
                  portfolio
                </div>
              )}
            </div>
          </div>

          {/* Educational Resources */}
          <div className="bg-white rounded-2xl p-6 border border-[#e5e5e5]">
            <h3 className="mb-4">Educational Resources</h3>
            <div className="space-y-3">
              <a
                href="https://www.investopedia.com/terms/e/etf.asp"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full h-24 bg-gradient-to-br from-[#f5f5f5] to-[#f5f5f5] rounded-xl flex items-center justify-center text-xs text-white hover:shadow-md transition-shadow"
                style={{
                  backgroundImage: `url(${article1})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                What is an ETF?
              </a>

              <a
                href="https://www.ciro.ca/office-investor/investing-basics/compound-interest"
                target="_blank"
                rel="noopener noreferrer"
                className="h-24 bg-gradient-to-br from-[#f5f5f5] to-[#e5e5e5] rounded-xl flex items-center justify-center text-xs text-white hover:shadow-md transition-shadow"
                style={{
                  backgroundImage: `url(${article2})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                Compound Interest
              </a>
              <a
                href="https://www.td.com/ca/en/personal-banking/personal-investing/learn/investing-101-basics"
                target="_blank"
                rel="noopener noreferrer"
                className="h-24 bg-gradient-to-br from-[#f5f5f5] to-[#e5e5e5] rounded-xl flex items-center justify-center text-xs text-white hover:shadow-md transition-shadow"
                style={{
                  backgroundImage: `url(${article3})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                Investment Basics
              </a>
            </div>
          </div>

          {/* Key Insights */}
          <div className="bg-[#fff7ed] rounded-2xl p-6 border border-[#ffaa2b]">
            <div className="flex items-start gap-3">
              <Target className="w-5 h-5 text-[#ffaa2b] flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm mb-2">💡 Key Insight</div>
                <div className="text-xs text-[#666] leading-relaxed">
                  By avoiding just {impulsePurchasesCancelled} impulse
                  purchases, you could grow your savings to
                  <span className="text-[#ffaa2b]">
                    {" "}
                    ${currentValue.toFixed(2)}
                  </span>{" "}
                  in {timeRangeLabel} through smart investing!
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

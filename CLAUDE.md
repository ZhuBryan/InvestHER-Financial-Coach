# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

InvestHER-Financial-Coach is a Hack Western project that helps users visualize the potential growth of money saved from avoided impulse purchases. The application demonstrates how savings could grow if invested in ETFs, encouraging better spending habits through data visualization.

## Tech Stack

**Frontend:**
- React 18 + TypeScript
- Vite for build tooling
- Tailwind CSS + Radix UI components
- Recharts for data visualization
- Supabase for authentication and backend

**Backend/Data:**
- Supabase (PostgreSQL) for database
- Row Level Security (RLS) policies for data protection
- Python backend planned (FastAPI, yfinance, pandas, numpy)

**Additional:**
- Chrome extension (placeholder files exist)
- Planned Streamlit dashboard

## Development Commands

### Frontend Development

```bash
cd frontend
npm install              # Install dependencies
npm run dev             # Start dev server on port 3000
npm run build           # Build for production (outputs to build/)
```

The dev server automatically opens in browser at http://localhost:3000.

### Environment Setup

The frontend requires a `.env` file in `frontend/` with:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_KEY=your_supabase_anon_key
```

## Architecture

### Application Flow

1. **Entry Point**: `frontend/src/main.tsx`
   - Renders the root with `AuthProvider` wrapping the entire app

2. **Auth Flow**: `frontend/src/App.tsx`
   - Checks authentication status via `useAuth()` hook
   - Unauthenticated users see `AuthPage`
   - Authenticated users see `InvestmentDashboard` with animated Aurora background

3. **Authentication**: `frontend/src/context/AuthContext.tsx`
   - Manages Supabase auth state
   - Provides `signUp`, `signIn`, `signOut`, and `user` to all components
   - Handles session persistence and auth state changes

4. **Main Dashboard**: `frontend/src/components/InvestmentDashboard.tsx`
   - Complex component with ETF growth calculations
   - Uses dollar-cost averaging simulation for historical savings
   - Displays interactive charts showing projected growth vs principal
   - Supports multiple ETF options (VDY, VFV, SPY, XEQT, QQQ)
   - Allows configuring recurring contributions (weekly/monthly)
   - Goal tracking with allocation management

### Database Schema

Located in `database/schema.sql`:

**Tables:**
- `purchases`: Tracks user purchases with status (success=avoided, failure=purchased)
  - Stores products as JSONB array, store info, category, timestamps
- `goals`: User financial goals with target amounts
- `user_profiles`: User preferences, motivations, struggles, and tone settings

All tables use RLS policies ensuring users only access their own data.

**Triggers:**
- `handle_new_user()`: Automatically creates profile entry for new users

### Key Components

**UI Components** (`frontend/src/components/ui/`):
- Full Radix UI + Tailwind component library
- Consistent styling via `class-variance-authority` and `tailwind-merge`
- Mobile-responsive via custom hook in `use-mobile.ts`

**Custom Components**:
- `Aurora.tsx`: Animated gradient background effect
- `InvestmentDashboard.tsx`: Main dashboard with ETF calculations
- `AuthPage.tsx`: Sign in/up page with form validation

### ETF Growth Calculation Logic

The `generateETFData()` function in `InvestmentDashboard.tsx`:
- Simulates dollar-cost averaging by tracking each contribution separately
- Applies daily compounding with volatility simulation
- Supports both impulse savings (from avoided purchases) and recurring contributions
- Calculates separate totals for impulse vs recurring contributions
- Returns time-series data for charting

## Important Notes

### Supabase Integration
- All auth flows go through Supabase Auth
- Session persistence configured in `supabaseClient.ts` with localStorage
- Auto-refresh tokens enabled for seamless user experience
- Environment variables must be prefixed with `VITE_` to be accessible in frontend
- RLS policies must be tested thoroughly when modifying database schema
- On successful login/signup, users are automatically redirected to dashboard via auth state change

**Email Confirmation:**
- By default, Supabase requires email confirmation for new signups
- For development: Disable email confirmation in Supabase Dashboard → Authentication → Providers → Email
- For production: Users must confirm their email before they can sign in
- AuthPage now shows helpful error messages when email is not confirmed

### Vite Configuration
- Contains extensive alias mappings for Radix UI and other dependencies
- Build target is `esnext` for modern browser features
- Output directory is `build/` (not `dist/`)

### Component Patterns
- Uses React hooks extensively (useState, useMemo, useEffect)
- Auth state managed via Context API
- Controlled form inputs throughout

### Styling Approach
- Tailwind utility classes with custom color palette
- Gradient colors: `#FF88B7` (pink), `#7B61FF` (purple)
- Dark theme background: `#2D2D2D`
- All components follow consistent border-radius pattern (rounded-xl, rounded-2xl)

## Planned Features (requirements.txt indicates)

- FastAPI backend for AI/ML features
- Google Gemini integration for financial coaching
- ElevenLabs voice integration
- yfinance for real ETF data
- Streamlit dashboard (`dashboard/app.py` exists but appears empty)
- Chrome extension functionality (placeholder files exist)

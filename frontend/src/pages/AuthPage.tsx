import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Checkbox } from '../components/ui/checkbox'
import { Label } from '../components/ui/label'
import Aurora from '../components/Aurora'

export default function AuthPage() {
  const { signUp, signIn } = useAuth()
  const [isSignUp, setIsSignUp] = useState(true)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}`,
        },
      })
      if (error) throw error
    } catch (err: any) {
      setError(err.message || 'An error occurred with Google login')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (isSignUp && !agreedToTerms) {
      setError('Please agree to the terms and conditions')
      setLoading(false)
      return
    }

    try {
      if (isSignUp) {
        const { data, error } = await signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            }
          }
        })
        if (error) throw error

        // Check if email confirmation is required
        if (data?.user && !data.session) {
          setError('Please check your email to confirm your account before signing in.')
        }
      } else {
        const { error } = await signIn({ email, password })
        if (error) {
          if (error.message.includes('Email not confirmed')) {
            throw new Error('Please confirm your email before signing in. Check your inbox for the confirmation link.')
          }
          throw error
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#2D2D2D] relative flex items-center justify-center px-8 py-16 overflow-hidden">
      {/* Animated Aurora background */}
      <div className="fixed inset-0 z-0 opacity-40">
        <Aurora
          colorStops={["#FF88B7", "#7B61FF", "#FF88B7"]}
          blend={0.6}
          amplitude={0.8}
          speed={0.4}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-full max-w-[500px] space-y-12 px-8"
      >
        {/* Header - 8px grid: spacing in multiples of 8 */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="text-center space-y-4"
        >
          <h1 className="text-8xl md:text-9xl font-bold text-white tracking-tight drop-shadow-lg">
            InvestHer
          </h1>
          <p className="text-lg text-white font-light">
            Your personalized path to financial confidence
          </p>
        </motion.div>

        {/* Form - 8px grid spacing */}
        <motion.form
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          onSubmit={handleSubmit}
          className="space-y-6 w-full"
        >
          <div className="flex flex-col gap-4 w-full max-w-xs mx-auto">
            <AnimatePresence mode="popLayout">
              {isSignUp && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Input
                    type="text"
                    placeholder="Full Name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="h-16 px-8 bg-white text-gray-900 placeholder:text-gray-500 border-0 rounded-3xl shadow-xl focus:shadow-2xl focus:ring-2 focus:ring-[#FF88B7]/40 transition-all duration-300 text-base"
                    required
                  />
                </motion.div>
              )}
            </AnimatePresence>
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-16 px-8 bg-white text-gray-900 placeholder:text-gray-500 border-0 rounded-3xl shadow-xl focus:shadow-2xl focus:ring-2 focus:ring-[#FF88B7]/40 transition-all duration-300 text-base"
              required
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-16 px-8 bg-white text-gray-900 placeholder:text-gray-500 border-0 rounded-3xl shadow-xl focus:shadow-2xl focus:ring-2 focus:ring-[#FF88B7]/40 transition-all duration-300 text-base"
              required
            />
          </div>

          {/* Terms Checkbox - Only for Sign Up - 8px spacing */}
          <AnimatePresence mode="popLayout">
            {isSignUp && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-center gap-3 px-1 max-w-xs mx-auto pt-2">
                  <Checkbox
                    id="terms"
                    checked={agreedToTerms}
                    onCheckedChange={(checked: boolean | string) => setAgreedToTerms(checked as boolean)}
                    className="h-6 w-6 border-2 border-white data-[state=checked]:bg-white data-[state=checked]:text-[#7B61FF] data-[state=checked]:border-white"
                  />
                  <Label
                    htmlFor="terms"
                    className="text-sm text-white cursor-pointer leading-relaxed font-medium"
                  >
                    I agree to the terms of use and privacy policy
                  </Label>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <div className="text-white text-sm text-center bg-red-500/30 backdrop-blur-md p-4 rounded-2xl border border-red-400/40 shadow-lg max-w-xs mx-auto">
              {error}
            </div>
          )}

          {/* Submit Button - 8px spacing */}
          <div className="pt-2 max-w-xs mx-auto">
            <Button
              type="submit"
              className="w-full h-16 bg-gradient-to-r from-[#7B61FF] to-[#9B83FF] hover:from-[#6A51E0] hover:to-[#8A72EF] text-white font-bold text-base rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              disabled={loading}
            >
              {loading ? 'LOADING...' : (isSignUp ? 'SIGN UP' : 'SIGN IN')}
            </Button>
          </div>
        </motion.form>

        {/* Social Login - 8px grid spacing with larger top margin */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="space-y-6 pt-8"
        >
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t-2 border-white" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-[#2D2D2D] px-6 py-2 text-white font-medium">Or continue with</span>
            </div>
          </div>

          <div className="flex justify-center gap-4">
            <Button
              type="button"
              variant="ghost"
              onClick={handleGoogleLogin}
              className="h-14 w-full max-w-xs bg-white hover:bg-white/90 transition-all duration-300 hover:scale-[1.02] shadow-xl active:scale-[0.98] rounded-3xl flex items-center justify-center gap-3"
            >
              <svg className="h-6 w-6" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              <span className="text-gray-700 font-bold text-base">Google</span>
            </Button>
          </div>
        </motion.div>

        {/* Toggle Sign In/Sign Up - 8px spacing */}
        <p className="text-center text-white text-base pt-4">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp)
              setError(null)
              setAgreedToTerms(false)
            }}
            className="text-white font-bold hover:text-[#FF88B7] transition-colors duration-200"
          >
            {isSignUp ? 'Sign in' : 'Sign up'}
          </button>
        </p>
      </motion.div>
    </div>
  )
}

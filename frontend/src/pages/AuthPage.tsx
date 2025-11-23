import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Checkbox } from '../components/ui/checkbox'
import { Label } from '../components/ui/label'
import { User, Mail as MailIcon, Globe, Apple } from 'lucide-react'
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
    <div className="min-h-screen bg-[#2D2D2D] relative flex items-center justify-center px-[30px] py-16 overflow-hidden">
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
          <img src="/logo.svg" alt="description" className="mx-auto py-3"/>

          <h1 className="text-[32px] md:text-9xl mb-8 font-bold text-white tracking-tight drop-shadow-lg">
            InvestHer
          </h1>
          <p className="text-xl text-white font-light">
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
          <div className="flex-col">
            <div className="flex justify-center">
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
                      className="w-64 h-16 px-12 py-2 mb-3 mt-4 bg-white text-gray-900 placeholder:text-gray-500 border-0 rounded-3xl shadow-xl focus:shadow-2xl focus:ring-2 focus:ring-[#FF88B7]/40 transition-all duration-300 text-base"
                      required
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="flex justify-center">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-64 h-16 px-12 py-2 mb-3 bg-white text-gray-900 placeholder:text-gray-500 border-0 rounded-3xl shadow-xl focus:shadow-2xl focus:ring-2 focus:ring-[#FF88B7]/40 transition-all duration-300 text-base"
                required
              />
            </div>
            <div className="flex justify-center">
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-64 h-16 px-12 py-2 mb-3 bg-white text-gray-900 placeholder:text-gray-500-left border-0 rounded-3xl shadow-xl focus:shadow-2xl focus:ring-2 focus:ring-[#FF88B7]/40 transition-all duration-300 text-base"
                required
              />
            </div>
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
                <div className="flex items-center gap-3 px-1 pt-2 justify-center">
                  <Checkbox
                    id="terms"
                    checked={agreedToTerms}
                    onCheckedChange={(checked: boolean | string) => setAgreedToTerms(checked as boolean)}
                    className="h-5 w-5 border-2 border-white bg-white data-[state=checked]:bg-white data-[state=checked]:text-[#7B61FF] data-[state=checked]:border-white"
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
          <div className="pt-2 flex justify-center">
            <Button
              type="submit"
              className="py-3 margin-bottom bg-[#FF88B7] hover:bg-[#FF6FA3] text-white font-bold text-sm rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer hover:-translate-y-1"
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
          className="space-y-2 pt-2"
        >
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t-2 border-white" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-[#2D2D2D] px-6 py-8 text-white font-medium">Sign up with</span>
            </div>
          </div>

          <div className="flex justify-center gap-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-14 w-14 rounded-full bg-white hover:bg-white/90 transition-all duration-300 hover:scale-110 shadow-xl active:scale-95"
            >
              <User className="h-5 w-5 text-[#1877F2]" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-14 w-14 rounded-full bg-white hover:bg-white/90 transition-all duration-300 hover:scale-110 shadow-xl active:scale-95"
            >
              <MailIcon className="h-5 w-5 text-[#EA4335]" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-14 w-14 rounded-full bg-white hover:bg-white/90 transition-all duration-300 hover:scale-110 shadow-xl active:scale-95"
            >
              <Globe className="h-5 w-5 text-[#4285F4]" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-14 w-14 rounded-full bg-white hover:bg-white/90 transition-all duration-300 hover:scale-110 shadow-xl active:scale-95"
            >
              <Apple className="h-5 w-5 text-black" />
            </Button>
          </div>
        </motion.div>

        {/* Toggle Sign In/Sign Up - 8px spacing */}
        <p className="text-center text-white text-base pt-4 py-8">
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

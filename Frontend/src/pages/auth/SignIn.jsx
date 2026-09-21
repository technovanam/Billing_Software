import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signInWithEmailAndPassword, setPersistence, browserSessionPersistence } from "firebase/auth";
import { auth } from "../../lib/firebase/config";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import AuthCollage from "../../components/AuthCollage";
import { useToast } from "../../context/ToastContext";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { error: toastError } = useToast();

  const handleLogin = async (e) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toastError("Please enter your email address.");
      return;
    }
    if (!password) {
      toastError("Please enter your password.");
      return;
    }
    setLoading(true);
    try {
      await setPersistence(auth, browserSessionPersistence);
      await signInWithEmailAndPassword(auth, trimmedEmail, password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      if (
        err.code === "auth/user-not-found" ||
        err.code === "auth/wrong-password" ||
        err.code === "auth/invalid-credential"
      ) {
        toastError("Invalid email or password. Please try again.");
      } else if (err.code === "auth/invalid-email") {
        toastError("Please enter a valid email address.");
      } else if (err.code === "auth/too-many-requests") {
        toastError("Too many failed attempts. Please try again later or reset your password.");
      } else if (err.code === "auth/network-request-failed") {
        toastError("Network error. Please check your internet connection.");
      } else {
        toastError(err.message || "Sign in failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white">
      {/* Left — Collage */}
      <AuthCollage />

      {/* Right — Sign In Form */}
      <div className="w-full lg:w-[45%] min-h-screen flex flex-col justify-between px-6 sm:px-10 lg:px-12 py-6 flex-shrink-0">
        {/* Top bar — Sign up link */}
        <div className="flex items-center justify-between pb-4">
          <Link
            to="/"
            className="text-sm text-gray-500 hover:text-blue-600 transition-colors"
          >
            ← Back
          </Link>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            Don&apos;t have an account?
            <Link
              to="/signup"
              className="font-semibold text-gray-900 border border-gray-300 px-3.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Sign up
            </Link>
          </div>
        </div>

        {/* Form */}
        <div className="w-full max-w-sm mx-auto my-auto py-4">
          {/* Logo + heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Sign in to{" "}
              <span className="text-blue-600">Techno Vanam</span>
            </h1>
            <p className="text-sm text-gray-500">
              Welcome back, please enter your login details below to access the app.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4" noValidate>
            {/* Email */}
            <div>
              <input
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm placeholder:text-gray-400 focus:border-blue-500 transition-colors"
                placeholder="Email Address"
                required
              />
            </div>

            {/* Password */}
            <div className="relative">
              <input
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 pr-11 text-sm placeholder:text-gray-400 focus:border-blue-500 transition-colors"
                placeholder="Password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </button>
            </div>

            {/* Forgot password */}
            <div className="text-right">
              <button type="button" className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                Forgot the password?
              </button>
            </div>

            {/* Login button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 py-3 text-white font-semibold hover:bg-blue-700 transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
            >
              {loading ? "Signing in…" : "Login"}
            </button>
          </form>
        </div>

        <div className="h-4" />
      </div>
    </div>
  );
}

import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  setPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "../../lib/firebase/config";
import {
  EyeIcon,
  EyeSlashIcon,
  BuildingOffice2Icon,
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  IdentificationIcon,
} from "@heroicons/react/24/outline";
import AuthCollage from "../../components/AuthCollage";
import { useToast } from "../../context/ToastContext";

const STEPS = ["Account", "Company"];

function InputField({ id, label, icon: Icon, type = "text", placeholder, value, onChange, required = true, hint, maxLength }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <Icon className="h-4 w-4" />
          </div>
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          maxLength={maxLength}
          className={`w-full rounded-xl border border-gray-300 py-2.5 text-sm transition-colors focus:border-blue-400 ${Icon ? "pl-9 pr-3" : "px-3"}`}
        />
      </div>
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

export default function SignUp() {
  const navigate = useNavigate();
  const { error: toastError } = useToast();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");

  // Step 1 — account
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Step 2 — company
  const [companyName, setCompanyName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [gstType, setGstType] = useState("non-gst");
  const [gstin, setGstin] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");

  // Logo
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [logoFileName, setLogoFileName] = useState("");
  const [logoError, setLogoError] = useState("");

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLogoError("");
    if (!file.type.startsWith("image/")) {
      toastError("Please upload an image file (PNG, JPG, SVG, etc.).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toastError("Logo must be smaller than 2 MB.");
      return;
    }
    setLogoFile(file);
    setLogoFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  /* ── Step 1 validation ────────────────────────────────────────── */
  const handleStep1 = (e) => {
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
    if (password.length < 6) {
      toastError("Password must be at least 6 characters.");
      return;
    }
    if (!confirmPassword) {
      toastError("Please confirm your password.");
      return;
    }
    if (password !== confirmPassword) {
      toastError("Passwords do not match.");
      return;
    }
    setStep(1);
  };

  /* ── Final submit ─────────────────────────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!companyName.trim()) {
      toastError("Please enter your company name.");
      return;
    }
    if (gstType === "gst") {
      const cleanGstin = gstin.trim().toUpperCase();
      if (!cleanGstin) {
        toastError("Please enter your 15-digit GSTIN.");
        return;
      }
      if (cleanGstin.length !== 15) {
        toastError("GSTIN must be exactly 15 characters.");
        return;
      }
    }
    if (!city.trim()) {
      toastError("Please enter your city.");
      return;
    }
    if (!state.trim()) {
      toastError("Please enter your state.");
      return;
    }
    if (!pincode.trim()) {
      toastError("Please enter your pincode.");
      return;
    }
    if (pincode.length !== 6) {
      toastError("Pincode must be 6 digits.");
      return;
    }
    setLoading(true);

    try {
      // Step 1 — Create Firebase Auth user first (auth must exist before any db/storage write)
      setUploadProgress("Creating account…");
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      // Step 2 — Upload logo to Firebase Storage (user is now authenticated)
      let logoURL = "";
      if (logoFile) {
        setUploadProgress("Uploading logo…");
        const storageRef = ref(storage, `logos/${uid}/company_logo`);
        await uploadBytes(storageRef, logoFile);
        logoURL = await getDownloadURL(storageRef);
      }

      // Step 3 — Update Firebase Auth display name
      setUploadProgress("Saving profile…");
      await updateProfile(userCredential.user, { displayName: ownerName || companyName });

      const finalGstin = gstType === "gst" ? gstin.trim().toUpperCase() : "";

      // Step 4 — Write to Firestore AFTER auth is confirmed (avoids "Missing permissions" error)
      await setDoc(doc(db, "users", uid), {
        companyName,
        ownerName,
        phone,
        gstin: finalGstin,
        address,
        city,
        state,
        pincode,
        logoURL,
        createdAt: serverTimestamp(),
      });

      // Step 5 — Cache profile locally for fast reads throughout the app
      localStorage.setItem(
        "company_profile",
        JSON.stringify({
          uid,
          companyName,
          ownerName,
          email,
          phone,
          gstin: finalGstin,
          address,
          city,
          state,
          pincode,
          logoURL,
          createdAt: new Date().toISOString(),
        })
      );

      navigate("/dashboard", { replace: true });
    } catch (err) {
      if (
        err.code === "auth/email-already-in-use" ||
        err.message?.toLowerCase().includes("email-already-in-use") ||
        err.message?.toLowerCase().includes("already in use")
      ) {
        setStep(0);
        toastError("This email is already registered. Please sign in or use a different email address.");
      } else if (err.code === "auth/invalid-email") {
        setStep(0);
        toastError("Please enter a valid email address.");
      } else if (err.code === "auth/weak-password") {
        setStep(0);
        toastError("Password is too weak. Please use at least 6 characters.");
      } else if (err.code === "auth/network-request-failed") {
        toastError("Network error. Please check your internet connection.");
      } else {
        toastError(err.message || "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
      setUploadProgress("");
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white">
      {/* Left — Sign Up Form */}
      <div className="w-full lg:w-[45%] min-h-screen flex flex-col justify-between px-6 sm:px-10 lg:px-12 py-6 flex-shrink-0">
        <div className="flex items-center justify-between pb-4">
          <button
            onClick={() => (step === 0 ? navigate("/signin") : setStep(0))}
            className="text-sm text-gray-500 hover:text-blue-600 transition-colors"
          >
            ← {step === 0 ? "Back to Sign In" : "Back"}
          </button>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            Already have an account?
            <Link
              to="/signin"
              className="font-semibold text-gray-900 border border-gray-300 px-3.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>

        <div className="w-full max-w-lg mx-auto my-auto py-4">
        {/* Logo + heading */}
        <div className="mb-6 text-center">
          <img src="/logo@4x-8.png" alt="Techno Vanam Billing" className="mx-auto mb-3 h-9 object-contain" />
          <h1 className="text-xl font-bold text-gray-900">Create Your Account</h1>
          <p className="text-sm text-gray-500 mt-0.5">Set up your company billing profile</p>
        </div>

        {/* Step indicator — centred */}
        <div className="flex items-center justify-center gap-2 mb-7">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                i < step ? "bg-green-500 text-white" : i === step ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-400"
              }`}>
                {i < step ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span className={`text-xs font-medium ${i === step ? "text-blue-600" : "text-gray-400"}`}>{label}</span>
            </div>
          ))}
        </div>

        {/* ── Step 0: Account ─────────────────────────────────────── */}
        {step === 0 && (
          <form onSubmit={handleStep1} className="space-y-4" noValidate>
            <InputField
              id="email"
              label="Email Address"
              icon={EnvelopeIcon}
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  required
                  className="w-full rounded-xl border border-gray-300 py-2.5 pl-9 pr-11 text-sm focus:border-blue-400 transition-colors"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  id="confirm"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  required
                  className="w-full rounded-xl border border-gray-300 py-2.5 pl-9 pr-11 text-sm focus:border-blue-400 transition-colors"
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showConfirm ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button type="submit"
              className="w-full rounded-xl bg-blue-600 py-3 text-white font-semibold shadow-md hover:bg-blue-700 transition-colors text-sm mt-2">
              Continue to Company Details →
            </button>
          </form>
        )}

        {/* ── Step 1: Company ─────────────────────────────────────── */}
        {step === 1 && (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <InputField
              id="companyName"
              label="Company Name"
              icon={BuildingOffice2Icon}
              placeholder="e.g. Techno Vanam Engineering"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />

            {/* Company Logo Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company Logo <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <label
                htmlFor="companyLogo"
                className={`flex items-center gap-4 w-full rounded-xl border-2 border-dashed px-4 py-3 cursor-pointer transition-colors ${
                  logoPreview
                    ? "border-green-300 bg-green-50"
                    : "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50"
                }`}
              >
                {logoPreview ? (
                  <>
                    <img src={logoPreview} alt="Preview" className="h-10 w-10 object-contain rounded-lg border border-gray-200 bg-white flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-green-700 truncate">{logoFileName}</p>
                      <p className="text-xs text-gray-500">Click to change logo</p>
                    </div>
                    <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </>
                ) : (
                  <>
                    <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Click to upload your logo</p>
                      <p className="text-xs text-gray-400 mt-0.5">PNG, JPG, SVG — max 2 MB</p>
                    </div>
                  </>
                )}
                <input
                  id="companyLogo"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoChange}
                />
              </label>
              {logoError && <p className="mt-1 text-xs text-red-500">{logoError}</p>}
            </div>

            <InputField
              id="ownerName"
              label="Owner / Contact Name"
              icon={UserIcon}
              placeholder="e.g. Ramesh Kumar"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
            />

            <InputField
              id="phone"
              label="Phone Number"
              icon={PhoneIcon}
              type="tel"
              placeholder="+91 99999 99999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            {/* GST / Non-GST Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Tax Type <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setGstType("gst")}
                  className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border text-sm font-medium transition-all ${
                    gstType === "gst"
                      ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm ring-2 ring-blue-500/20"
                      : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-400"
                  }`}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full transition-colors ${
                      gstType === "gst" ? "bg-blue-600" : "bg-gray-300"
                    }`}
                  />
                  GST
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGstType("non-gst");
                    setGstin("");
                  }}
                  className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border text-sm font-medium transition-all ${
                    gstType === "non-gst"
                      ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm ring-2 ring-blue-500/20"
                      : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-400"
                  }`}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full transition-colors ${
                      gstType === "non-gst" ? "bg-blue-600" : "bg-gray-300"
                    }`}
                  />
                  Non-GST
                </button>
              </div>
            </div>

            {/* GSTIN Input (only if GST selected) */}
            {gstType === "gst" && (
              <InputField
                id="gstin"
                label="GSTIN"
                icon={IdentificationIcon}
                placeholder="e.g. 33ABCDE1234F1Z5"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                required={true}
                maxLength={15}
                hint="15-digit GST Identification Number"
              />
            )}

            <InputField
              id="address"
              label="Street Address"
              icon={MapPinIcon}
              placeholder="Door no., Street, Area"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">City <span className="text-red-500">*</span></label>
                <input id="city" type="text" value={city} onChange={(e) => setCity(e.target.value)}
                  placeholder="Chennai" required
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-400 transition-colors" />
              </div>
              <div>
                <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">State <span className="text-red-500">*</span></label>
                <input id="state" type="text" value={state} onChange={(e) => setState(e.target.value)}
                  placeholder="Tamil Nadu" required
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-400 transition-colors" />
              </div>
              <div>
                <label htmlFor="pincode" className="block text-sm font-medium text-gray-700 mb-1">Pincode <span className="text-red-500">*</span></label>
                <input id="pincode" type="text" value={pincode} onChange={(e) => setPincode(e.target.value)}
                  placeholder="600001" required maxLength={6}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-400 transition-colors" />
              </div>
            </div>

            {/* Progress indicator */}
            {loading && uploadProgress && (
              <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 text-blue-700 text-sm rounded-xl px-4 py-3">
                <svg className="w-4 h-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                {uploadProgress}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 py-3 text-white font-semibold shadow-md hover:bg-blue-700 transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? "Please wait…" : "Create Account"}
            </button>
          </form>
        )}

          </div>

          {/* Sign in link */}
          <p className="mt-8 pb-4 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link to="/signin" className="font-semibold text-blue-600 hover:text-blue-700 transition-colors">
              Sign In
            </Link>
          </p>
        </div>

        {/* Right — Collage */}
        <AuthCollage />
      </div>
    );
  }

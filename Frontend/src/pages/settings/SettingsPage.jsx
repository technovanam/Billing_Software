import React, { useState, useRef, useEffect, useContext } from "react";
import {
  Upload,
  Save,
  User,
  Lock,
  Eye,
  EyeOff,
  SlidersHorizontal,
  ShieldCheck,
  LogOut,
  Clock,
} from "lucide-react";
import { AuthContext } from "../../context/AuthContext";
import { useCompanyProfile } from "../../context/CompanyProfileContext";
import { useSettings } from "../../hooks/useFirestore";
import PropTypes from "prop-types";

// A reusable toggle switch component
const ToggleSwitch = ({ enabled, setEnabled }) => (
  <button
    onClick={() => setEnabled(!enabled)}
    className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-200 ease-in-out ${enabled ? "bg-blue-600" : "bg-gray-300"
      }`}
  >
    <span
      className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-200 ease-in-out ${enabled ? "translate-x-6" : "translate-x-1"
        }`}
    />
  </button>
);

ToggleSwitch.propTypes = {
  enabled: PropTypes.bool.isRequired,
  setEnabled: PropTypes.func.isRequired,
};

const ProfileSettings = () => {
  const { user, updateUserEmail, updateUserPassword, updateUserProfile } =
    useContext(AuthContext);
  const { companyProfile } = useCompanyProfile();
  const { settings, updateSettings } = useSettings();
  const [profileInfo, setProfileInfo] = useState({
    fullName: "",
    email: "",
    phone: "",
    role: "",
  });
  const [password, setPassword] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  // Company logo from signup profile, or default Techno Vanam icon
  const logoURL = companyProfile?.logoURL || "/Icon@4x-8.png";

  useEffect(() => {
    if (user) {
      setProfileInfo((prev) => ({
        ...prev,
        fullName: user.displayName || "Admin User",
        email: user.email || "",
        phone: user.phoneNumber || "",
        role: user.role || "",
      }));
    }
    // Load additional profile data from settings
    if (settings?.userProfile) {
      setProfileInfo((prev) => ({
        ...prev,
        phone: settings.userProfile.value?.phone || prev.phone,
        role: settings.userProfile.value?.role || prev.role,
      }));
    }
  }, [user, settings]);

  const handleProfileChange = (e) => {
    setProfileInfo({ ...profileInfo, [e.target.name]: e.target.value });
  };

  const handlePasswordChange = (e) => {
    setPassword({ ...password, [e.target.name]: e.target.value });
  };

  const toggleEdit = () => {
    setIsEditing(!isEditing);
    setMessage({ text: "", type: "" });
  };

  const handleSaveProfile = async () => {
    if (!profileInfo.email) {
      setMessage({ text: "Email cannot be empty", type: "error" });
      return;
    }

    setIsUpdating(true);
    setMessage({ text: "Updating profile...", type: "info" });

    try {
      // Update display name if it has changed
      if (profileInfo.fullName !== user.displayName) {
        const nameResult = await updateUserProfile(profileInfo.fullName);
        if (!nameResult.success) {
          throw new Error(nameResult.error || "Failed to update name");
        }
      }

      // Only update email if it has changed
      if (profileInfo.email !== user.email) {
        const emailResult = await updateUserEmail(
          profileInfo.email,
          password.current
        );
        if (!emailResult.success) {
          throw new Error(emailResult.error || "Failed to update email");
        }
      }

      // Save phone and role (no photo)
      await updateSettings(
        "userProfile",
        {
          phone: profileInfo.phone,
          role: profileInfo.role,
        },
        "User profile information"
      );

      setMessage({ text: "Profile updated successfully!", type: "success" });
      setIsEditing(false);
      setPassword((prev) => ({ ...prev, current: "" }));

      // Clear the message after 3 seconds
      setTimeout(() => {
        setMessage({ text: "", type: "" });
      }, 3000);
    } catch (error) {
      setMessage({
        text:
          error.message ||
          "Failed to update profile. Please check your current password and try again.",
        type: "error",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePasswordUpdate = async () => {
    if (password.new !== password.confirm) {
      setMessage({
        text: "New password and confirm password do not match.",
        type: "error",
      });
      return;
    }
    if (password.new.length < 6) {
      setMessage({
        text: "Password should be at least 6 characters long.",
        type: "error",
      });
      return;
    }

    setIsUpdating(true);
    setMessage({ text: "Updating password...", type: "info" });

    try {
      const result = await updateUserPassword(password.current, password.new);
      if (!result.success) {
        throw new Error(result.error || "Failed to update password");
      }

      setMessage({ text: "Password updated successfully!", type: "success" });
      setPassword({ current: "", new: "", confirm: "" });
    } catch (error) {
      setMessage({
        text:
          error.message ||
          "Failed to update password. Please check your current password and try again.",
        type: "error",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Message Display */}
      {message.text && (
        <div
          className={`p-4 rounded-md ${message.type === "error"
            ? "bg-red-50 text-red-700"
            : message.type === "success"
              ? "bg-green-50 text-green-700"
              : "bg-blue-50 text-blue-700"
            }`}
        >
          {message.text}
        </div>
      )}

      {/* User Profile Section */}
      <div className="p-6 border border-gray-200 rounded-xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <User size={20} className="text-gray-700" />
            <h2 className="text-lg font-bold text-gray-900">User Profile</h2>
          </div>
          {!isEditing ? (
            <button
              onClick={toggleEdit}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Edit Profile
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={toggleEdit}
                className="px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
                disabled={isUpdating}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={isUpdating}
                className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {isUpdating ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <img
              src={logoURL}
              alt="Company logo"
              className="w-20 h-20 object-contain rounded"
            />
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-gray-900">
                {profileInfo.fullName}
              </h3>
              <p className="text-sm text-gray-600">{profileInfo.role || "Administrator"}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="fullName" className="text-sm text-gray-800 mb-1 block">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                name="fullName"
                value={profileInfo.fullName}
                onChange={handleProfileChange}
                className="w-full bg-gray-100 border-0 rounded-md text-sm p-2.5 disabled:bg-gray-200 disabled:text-gray-500"
                disabled={!isEditing || isUpdating}
              />
            </div>
            <div>
              <label htmlFor="email" className="text-sm text-gray-800 mb-1 block">
                Email Address
              </label>
              {isEditing ? (
                <>
                  <input
                    id="email"
                    type="email"
                    name="email"
                    value={profileInfo.email}
                    onChange={handleProfileChange}
                    className="w-full bg-gray-100 border-0 rounded-md text-sm p-2.5 disabled:bg-gray-200 disabled:text-gray-500"
                    disabled={isUpdating}
                  />
                  <div className="mt-2">
                    <label htmlFor="currentPassword" className="text-sm text-gray-800 mb-1 block">
                      Confirm Current Password
                    </label>
                    <input
                      id="currentPassword"
                      type={showPassword ? "text" : "password"}
                      name="current"
                      value={password.current}
                      onChange={handlePasswordChange}
                      placeholder="Required to update email"
                      className="w-full bg-gray-100 border-0 rounded-md text-sm p-2.5"
                      disabled={isUpdating}
                    />
                  </div>
                </>
              ) : (
                <input
                  id="email"
                  type="email"
                  value={profileInfo.email}
                  readOnly
                  className="w-full bg-gray-100 border-0 rounded-md text-sm p-2.5 text-gray-700"
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-800 mb-1 block">
                Phone Number
              </label>
              <input
                type="text"
                name="phone"
                value={profileInfo.phone}
                onChange={handleProfileChange}
                className="w-full bg-gray-100 border-0 rounded-md text-sm p-2.5 disabled:bg-gray-200 disabled:text-gray-500"
                disabled={!isEditing || isUpdating}
              />
            </div>
            <div>
              <label htmlFor="role" className="text-sm text-gray-800 mb-1 block">Role</label>
              <input
                id="role"
                type="text"
                name="role"
                value={profileInfo.role}
                onChange={handleProfileChange}
                className="w-full bg-gray-100 border-0 rounded-md text-sm p-2.5 disabled:bg-gray-200 disabled:text-gray-500"
                disabled={!isEditing || isUpdating}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Section */}
      <div className="p-6 border border-gray-200 rounded-xl">
        <h2 className="text-lg font-bold text-gray-900 mb-6">
          Change Password
        </h2>
        <div className="space-y-4 max-w-lg">
          <div>
            <label htmlFor="currentPasswordMain" className="text-sm text-gray-800 mb-1 block">
              Current Password
            </label>
            <div className="relative">
              <input
                id="currentPasswordMain"
                type={showPassword ? "text" : "password"}
                name="current"
                value={password.current}
                onChange={handlePasswordChange}
                className="w-full bg-gray-100 border-0 rounded-md text-sm p-2.5 pr-10"
                disabled={isUpdating}
                placeholder="Enter your current password"
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                type="button"
                disabled={isUpdating}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="newPassword" className="text-sm text-gray-800 mb-1 block">
                New Password
              </label>
              <input
                id="newPassword"
                type={showPassword ? "text" : "password"}
                name="new"
                value={password.new}
                onChange={handlePasswordChange}
                className="w-full bg-gray-100 border-0 rounded-md text-sm p-2.5"
                disabled={isUpdating}
                placeholder="At least 6 characters"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="text-sm text-gray-800 mb-1 block">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                name="confirm"
                value={password.confirm}
                onChange={handlePasswordChange}
                className="w-full bg-gray-100 border-0 rounded-md text-sm p-2.5"
                disabled={isUpdating}
                placeholder="Retype new password"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handlePasswordUpdate}
              disabled={
                isUpdating ||
                !password.current ||
                !password.new ||
                !password.confirm
              }
              className={`flex items-center gap-2 px-5 py-2 text-white rounded-md text-sm font-medium ${isUpdating ||
                !password.current ||
                !password.new ||
                !password.confirm
                ? "bg-blue-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
                }`}
            >
              {isUpdating ? (
                "Updating..."
              ) : (
                <>
                  <Lock size={16} />
                  Change Password
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const FeatureItem = ({ title, description, enabled, onToggle }) => (
  <div className="flex items-center justify-between">
    <div>
      <h4 className="font-medium text-gray-900 text-sm">{title}</h4>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
    <ToggleSwitch enabled={enabled} setEnabled={onToggle} />
  </div>
);

FeatureItem.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  enabled: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
};

const SystemSettings = () => {
  const [config, setConfig] = useState({
    currency: "INR",
    timeZone: "Asia/Kolkata",
    dateFormat: "DD/MM/YYYY",
    invoicePrefix: "INV",
  });
  const [features, setFeatures] = useState({
    autoInvoice: true,
    gstCalculation: true,
    roundOff: true,
  });

  // Use settings hook
  const { settings, error: settingsError, updateSettings } = useSettings();

  // Load settings
  useEffect(() => {
    if (settings) {
      if (settings.systemSettings?.value?.systemConfig) {
        setConfig((prev) => ({
          ...prev,
          ...settings.systemSettings.value.systemConfig,
        }));
      }
      if (settings.systemSettings?.value?.systemFeatures) {
        setFeatures((prev) => ({
          ...prev,
          ...settings.systemSettings.value.systemFeatures,
        }));
      }
    }
  }, [settings]);

  const [systemMessage, setSystemMessage] = useState({ text: "", type: "" });

  const showSystemMessage = (text, type) => {
    setSystemMessage({ text, type });
    setTimeout(() => setSystemMessage({ text: "", type: "" }), 3000);
  };

  const handleSaveSystemSettings = async () => {
    try {
      const systemSettings = {
        systemConfig: config,
        systemFeatures: features,
      };

      const result = await updateSettings(
        "systemSettings",
        systemSettings,
        "System configuration and features"
      );
      if (result.success) {
        showSystemMessage(
          "System settings saved successfully! Changes will apply to new invoices immediately.",
          "success"
        );
      } else {
        showSystemMessage(
          "Error saving system settings: " + result.error,
          "error"
        );
      }
    } catch (error) {
      showSystemMessage(
        "Error saving system settings: " + error.message,
        "error"
      );
    }
  };

  return (
    <div className="p-6 border border-gray-200 rounded-xl">
      <div className="flex items-center gap-3 mb-6">
        <SlidersHorizontal size={20} className="text-gray-700" />
        <h2 className="text-lg font-bold text-gray-900">
          System Configuration
        </h2>
        <div className="text-xs text-gray-500 ml-auto">
          Settings apply to new invoices immediately
        </div>
      </div>

      {/* Success/Error Messages */}
      {systemMessage.text && (
        <div
          className={`mb-6 p-4 rounded-lg border text-sm ${systemMessage.type === "error"
            ? "bg-red-50 text-red-700 border-red-200"
            : "bg-green-50 text-green-700 border-green-200"
            }`}
        >
          {systemMessage.text}
        </div>
      )}
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="currency" className="text-sm text-gray-800 mb-1 block">
              Default Currency
            </label>
            <input
              id="currency"
              type="text"
              value={config.currency}
              readOnly
              className="w-full bg-gray-200 border-0 rounded-md text-sm p-2.5 text-gray-500"
            />
          </div>
          <div>
            <label htmlFor="timeZone" className="text-sm text-gray-800 mb-1 block">
              Time Zone
            </label>
            <input
              id="timeZone"
              type="text"
              value={config.timeZone}
              readOnly
              className="w-full bg-gray-200 border-0 rounded-md text-sm p-2.5 text-gray-500"
            />
          </div>
          <div>
            <label htmlFor="dateFormat" className="text-sm text-gray-800 mb-1 block">
              Date Format
            </label>
            <input
              id="dateFormat"
              type="text"
              value={config.dateFormat}
              readOnly
              className="w-full bg-gray-200 border-0 rounded-md text-sm p-2.5 text-gray-500"
            />
          </div>
          <div>
            <label htmlFor="invoicePrefix" className="text-sm text-gray-800 mb-1 block">
              Invoice Prefix
            </label>
            <input
              id="invoicePrefix"
              type="text"
              value={config.invoicePrefix}
              onChange={(e) =>
                setConfig({ ...config, invoicePrefix: e.target.value })
              }
              className="w-full bg-gray-100 border-0 rounded-md text-sm p-2.5"
            />
          </div>
        </div>
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-base font-bold text-gray-800 mb-4">
            System Features
          </h3>
          <div className="space-y-4">
            <FeatureItem
              title="Auto Invoice Numbering"
              description="Automatically generate sequential invoice numbers"
              enabled={features.autoInvoice}
              onToggle={() =>
                setFeatures((p) => ({ ...p, autoInvoice: !p.autoInvoice }))
              }
            />
            <FeatureItem
              title="GST Calculation"
              description="Enable automatic GST calculation"
              enabled={features.gstCalculation}
              onToggle={() =>
                setFeatures((p) => ({
                  ...p,
                  gstCalculation: !p.gstCalculation,
                }))
              }
            />
            <FeatureItem
              title="Round Off"
              description="Enable automatic round off for invoice totals"
              enabled={features.roundOff}
              onToggle={() =>
                setFeatures((p) => ({ ...p, roundOff: !p.roundOff }))
              }
            />
          </div>
        </div>
        <div className="pt-2">
          <button
            onClick={handleSaveSystemSettings}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
          >
            <Save size={16} />
            Save System Settings
          </button>
        </div>
      </div>
    </div>
  );
};

const SecurityItem = ({ icon: Icon, title, description, control }) => (
  <div className="p-4 border border-gray-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
    <div className="flex items-center gap-4">
      <Icon size={20} className="text-gray-500 flex-shrink-0" />
      <div>
        <h4 className="font-medium text-gray-900 text-sm">{title}</h4>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
    </div>
    {control && <div className="w-full sm:w-auto">{control}</div>}
  </div>
);

SecurityItem.propTypes = {
  icon: PropTypes.elementType.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  control: PropTypes.element,
};

const SecuritySettings = () => {
  const {
    signOut,
    isSessionTimeoutEnabled,
    toggleSessionTimeout,
    sessionTimeoutMinutes,
    setSessionTimeoutMinutes,
  } = useContext(AuthContext);
  const { settings, updateSettings } = useSettings();
  const [localTimeoutMinutes, setLocalTimeoutMinutes] = useState(15);
  const [message, setMessage] = useState({ text: "", type: "" });

  useEffect(() => {
    // Load session timeout settings
    if (settings?.securitySettings?.value?.sessionTimeoutMinutes) {
      setLocalTimeoutMinutes(
        settings.securitySettings.value.sessionTimeoutMinutes
      );
    }
  }, [settings]);

  const handleLogout = async () => {
    try {
      await signOut();
      setMessage({
        text: "Logging out...",
        type: "success",
      });
    } catch (error) {
      setMessage({
        text: "Failed to log out. Please try again.",
        type: "error",
      });
    }
  };

  const handleSessionTimeoutToggle = async () => {
    toggleSessionTimeout();
    const newState = !isSessionTimeoutEnabled;

    // Save settings
    try {
      await updateSettings(
        "securitySettings",
        {
          sessionTimeoutEnabled: newState,
          sessionTimeoutMinutes: localTimeoutMinutes,
        },
        "Security settings"
      );

      if (newState) {
        setMessage({
          text: `Session timeout enabled. You will be logged out after ${localTimeoutMinutes} minutes of inactivity.`,
          type: "success",
        });
      } else {
        setMessage({
          text: "Session timeout disabled.",
          type: "success",
        });
      }
    } catch (error) {
      setMessage({
        text: "Failed to update security settings.",
        type: "error",
      });
    }
  };

  const handleTimeoutChange = async (newMinutes) => {
    setLocalTimeoutMinutes(newMinutes);

    // Save settings
    try {
      await updateSettings(
        "securitySettings",
        {
          sessionTimeoutEnabled: isSessionTimeoutEnabled,
          sessionTimeoutMinutes: newMinutes,
        },
        "Security settings"
      );
    } catch (error) {
      console.error("Failed to save timeout settings:", error);
    }
  };

  return (
    <div className="p-6 border border-gray-200 rounded-xl">
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck size={20} className="text-gray-700" />
        <h2 className="text-lg font-bold text-gray-900">Security Settings</h2>
      </div>
      <div className="space-y-6">
        {message.text && (
          <div
            className={`p-3 rounded-md text-sm ${message.type === "error"
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-green-50 text-green-700 border border-green-200"
              }`}
          >
            {message.text}
          </div>
        )}
        <div className="space-y-4">
          <SecurityItem
            icon={Clock}
            title="Session Timeout"
            description={`Automatically log out after ${localTimeoutMinutes} minutes of inactivity`}
            control={
              <div className="flex items-center gap-3">
                <select
                  aria-label="Session timeout duration"
                  value={localTimeoutMinutes}
                  onChange={(e) => handleTimeoutChange(Number(e.target.value))}
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                  disabled={!isSessionTimeoutEnabled}
                >
                  <option value={5}>5 min</option>
                  <option value={10}>10 min</option>
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                  <option value={60}>60 min</option>
                </select>
                <ToggleSwitch
                  enabled={isSessionTimeoutEnabled}
                  setEnabled={handleSessionTimeoutToggle}
                />
              </div>
            }
          />
        </div>
        <div className="border-t border-gray-200 pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors duration-200 shadow-md hover:shadow-lg"
            >
              <LogOut size={18} />
              Logout from Account
            </button>
            <div>
              <p className="text-sm text-gray-600 font-medium">
                End Current Session
              </p>
              <p className="text-xs text-gray-500 mt-1">
                You will be securely logged out and redirected to the login
                page
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState("Profile");
  const tabs = ["Profile", "System", "Security"];

  // Get authentication context
  const { user } = useContext(AuthContext);

  // Use settings hook
  const { settings, error: settingsError } = useSettings();

  const renderContent = () => {
    switch (activeTab) {
      case "Profile":
        return <ProfileSettings />;
      case "System":
        return <SystemSettings />;
      case "Security":
        return <SecuritySettings />;
      default:
        return (
          <div className="text-center py-20 text-gray-500">
            Settings for "{activeTab}" are not yet implemented.
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen text-slate-800 font-mazzard">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-6">
        <header className="mb-2">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage your application preferences and configurations
          </p>
        </header>

        <main className="mt-6 flex flex-col gap-6">
          <div>
            <div className="bg-gray-100 rounded-lg p-1 flex items-center space-x-1 max-w-fit overflow-x-auto scrollbar-hide">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap flex-shrink-0 ${activeTab === tab
                    ? "bg-white text-gray-900 shadow-sm"
                    : "bg-transparent text-gray-600 hover:bg-gray-200"
                    }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm">{renderContent()}</div>
        </main>
      </div>
    </div>
  );
};

// PropTypes
ToggleSwitch.propTypes = {
  enabled: PropTypes.bool.isRequired,
  setEnabled: PropTypes.func.isRequired,
};

// Internal component prop validations
// Note: ProfileSettings, SystemSettings, SecuritySettings usually don't take props directly in this implementation, 
// but if they did, we'd add them here. 
// FeatureItem within SystemSettings takes props.

// We can't easily attach propTypes to FeatureItem since it's defined INSIDE SystemSettings (another code smell actually).
// Best practice: Move FeatureItem OUTSIDE SystemSettings.

// Move SecurityItem OUTSIDE SecuritySettings as well.

export default SettingsPage;

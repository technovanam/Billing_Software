import React, { createContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut, updateEmail, updatePassword, updateProfile, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import axios from "axios";
import { auth } from "../lib/firebase/config";

export const AuthContext = createContext();

// Role and business from the verified token. Cashiers sign in with a
// backend-issued custom token carrying role/businessUid/cashierId claims.
async function withClaims(u) {
    let claims = {};
    try {
        claims = (await u.getIdTokenResult()).claims || {};
    } catch (_) {}
    const isCashier = claims.role === "cashier" && claims.businessUid && claims.cashierId;
    const email = String(u.email || "").toLowerCase();
    return {
        ...u,
        uid: u.uid,
        email: u.email,
        displayName: isCashier ? claims.cashierName || claims.cashierId : u.displayName,
        role: isCashier ? "cashier" : email.startsWith("wh.") ? "warehouse" : "owner",
        businessUid: isCashier ? claims.businessUid : u.uid,
        cashierId: isCashier ? claims.cashierId : null,
        cashierName: isCashier ? claims.cashierName || claims.cashierId : null,
        counter: isCashier ? claims.counter || null : null,
        deviceId: isCashier ? claims.deviceId || null : null,
    };
}

// Revoked cashier sessions fail this refresh, which signs them out.
const CASHIER_SESSION_CHECK_MS = 2 * 60 * 1000;

import PropTypes from 'prop-types';

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [authInitialized, setAuthInitialized] = useState(false);

    const [isSessionTimeoutEnabled, setIsSessionTimeoutEnabled] = useState(() => {
        const saved = localStorage.getItem('sessionTimeoutEnabled');
        if (saved === null) {
            return true;
        }
        return JSON.parse(saved);
    });

    const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(() => {
        const saved = localStorage.getItem('sessionTimeoutMinutes');
        return saved === null ? 15 : JSON.parse(saved);
    });

    useEffect(() => {
        localStorage.setItem('sessionTimeoutEnabled', JSON.stringify(isSessionTimeoutEnabled));
    }, [isSessionTimeoutEnabled]);

    useEffect(() => {
        localStorage.setItem('sessionTimeoutMinutes', JSON.stringify(sessionTimeoutMinutes));
    }, [sessionTimeoutMinutes]);

    const toggleSessionTimeout = () => {
        setIsSessionTimeoutEnabled(prev => !prev);
    };

    useEffect(() => {
        const interceptor = axios.interceptors.request.use(async (config) => {
            const current = auth.currentUser;
            if (current) {
                const token = await current.getIdToken();
                config.headers = config.headers || {};
                config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        }, (err) => Promise.reject(err));

        // Clear any stale localStorage auth keys from previous builds.
        // Auth state is now managed exclusively by Firebase SDK.
        localStorage.removeItem("admin_auth_user");

        let sessionTimer = null;
        const unsubscribe = onAuthStateChanged(auth, async (u) => {
            clearInterval(sessionTimer);
            if (u) {
                const next = await withClaims(u);
                setUser(next);
                if (next.role === "cashier") {
                    // A cashier must never fall back to a cached owner session.
                    sessionTimer = setInterval(() => {
                        u.getIdToken(true).catch(() => {
                            firebaseSignOut(auth).catch(() => {});
                            localStorage.removeItem("pos_cashier_session");
                        });
                    }, CASHIER_SESSION_CHECK_MS);
                }
            } else {
                // Firebase says no signed-in user. Never fall back to localStorage.
                setUser(null);
            }
            setAuthInitialized(true);
        });

        return () => {
            unsubscribe();
            clearInterval(sessionTimer);
            axios.interceptors.request.eject(interceptor);
        };
    }, []);

    const signOut = async () => {
        try {
            await firebaseSignOut(auth);
        } catch (_) {}
        localStorage.removeItem("admin_auth_user");
        localStorage.removeItem("pos_cashier_session");
        setUser(null);
    };

    const updateUserEmail = async (newEmail, currentPassword) => {
        try {
            const user = auth.currentUser;
            if (!user) throw new Error('No user is signed in');

            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);

            await updateEmail(user, newEmail);

            setUser({ ...user, email: newEmail });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const updateUserPassword = async (currentPassword, newPassword) => {
        try {
            const user = auth.currentUser;
            if (!user) throw new Error('No user is signed in');

            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);

            await updatePassword(user, newPassword);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const updateUserProfile = async (displayName) => {
        try {
            const user = auth.currentUser;
            if (!user) throw new Error('No user is signed in');

            await updateProfile(user, { displayName });

            setUser({ ...user, displayName });

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const value = React.useMemo(() => ({
        user,
        setUser,
        authInitialized,
        signOut,
        updateUserEmail,
        updateUserPassword,
        updateUserProfile,
        isSessionTimeoutEnabled,
        toggleSessionTimeout,
        sessionTimeoutMinutes,
        setSessionTimeoutMinutes
    }), [user, authInitialized, isSessionTimeoutEnabled, sessionTimeoutMinutes]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

AuthProvider.propTypes = {
    children: PropTypes.node.isRequired,
};
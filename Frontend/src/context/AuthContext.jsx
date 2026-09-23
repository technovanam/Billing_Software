import React, { createContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut, updateEmail, updatePassword, updateProfile, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import axios from "axios";
import { auth } from "../lib/firebase/config";

export const AuthContext = createContext();

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

        const savedAdmin = localStorage.getItem("admin_auth_user");
        const defaultUser = savedAdmin ? JSON.parse(savedAdmin) : null;

        const unsubscribe = onAuthStateChanged(auth, (u) => {
            if (u) {
                setUser({ ...u });
            } else {
                const storedAdmin = localStorage.getItem("admin_auth_user");
                setUser(storedAdmin ? JSON.parse(storedAdmin) : null);
            }
            setAuthInitialized(true);
        });

        // If local admin session exists, initialize immediately
        if (defaultUser) {
            setUser(defaultUser);
            setAuthInitialized(true);
        }

        return () => {
            unsubscribe();
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
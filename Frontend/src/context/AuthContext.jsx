import React, { createContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut, updateEmail, updatePassword, updateProfile, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import axios from "axios";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "../lib/firebase/config";
import { clearDataCaches } from "../lib/dataCache";

export const AuthContext = createContext();

// On the website a person is the owner of their own business, or a team member
// (accountant / viewer) working in another business's books (Settings -> Team).
// businessUid is whose data every screen reads and writes. POS cashiers and
// "wh." warehouse accounts use the separate POS app.
function withRole(u, ws = null) {
    return {
        ...u,
        uid: u.uid,
        email: u.email,
        displayName: u.displayName,
        role: ws ? ws.role : "owner",
        businessUid: ws ? ws.ownerUid : u.uid,
        businessName: ws?.businessName || "",
    };
}

const workspaceKey = (uid) => `kd.workspace:${uid}`;

// Businesses that added this (verified) email to their team.
async function loadMemberships(u) {
    if (!u?.email || !u.emailVerified) return [];
    try {
        const snap = await getDocs(collection(db, "teamInvites", u.email.toLowerCase(), "owners"));
        return snap.docs.map((d) => ({ ownerUid: d.id, ...d.data() })).filter((m) => m.active !== false && m.ownerUid !== u.uid);
    } catch (_) {
        return [];
    }
}

import PropTypes from 'prop-types';

export const AuthProvider = ({ children }) => {
    const [rawUser, setUser] = useState(null);
    const [memberships, setMemberships] = useState([]);
    const [workspaceUid, setWorkspaceUid] = useState(null);
    const [authInitialized, setAuthInitialized] = useState(false);
    const workspace = memberships.find((m) => m.ownerUid === workspaceUid) || null;
    const user = React.useMemo(() => (rawUser ? withRole(rawUser, workspace) : null), [rawUser, workspace]);

    const switchWorkspace = (ownerUid) => {
        if (!rawUser) return;
        try {
            if (ownerUid) localStorage.setItem(workspaceKey(rawUser.uid), ownerUid);
            else localStorage.removeItem(workspaceKey(rawUser.uid));
        } catch (_) {
            // storage unavailable (private mode)
        }
        clearDataCaches();
        setWorkspaceUid(ownerUid || null);
        window.location.assign("/dashboard");
    };

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
        // Old builds cached lists under shared keys; drop them.
        localStorage.removeItem("store_customers_cache");
        localStorage.removeItem("store_invoices_cache");

        const unsubscribe = onAuthStateChanged(auth, async (u) => {
            if (u) {
                const list = await loadMemberships(u);
                let saved = null;
                try {
                    saved = localStorage.getItem(workspaceKey(u.uid));
                } catch (_) {
            // storage unavailable (private mode)
        }
                setMemberships(list);
                setWorkspaceUid(list.some((m) => m.ownerUid === saved) ? saved : null);
                setUser(u);
            } else {
                // Firebase says no signed-in user. Never fall back to localStorage.
                clearDataCaches();
                setMemberships([]);
                setWorkspaceUid(null);
                setUser(null);
            }
            setAuthInitialized(true);
        });

        return () => {
            unsubscribe();
            axios.interceptors.request.eject(interceptor);
        };
    }, []);

    const signOut = async () => {
        try {
            await firebaseSignOut(auth);
        } catch (_) {
            // storage unavailable (private mode)
        }
        localStorage.removeItem("admin_auth_user");
        clearDataCaches();
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
        memberships,
        switchWorkspace,
        authInitialized,
        signOut,
        updateUserEmail,
        updateUserPassword,
        updateUserProfile,
        isSessionTimeoutEnabled,
        toggleSessionTimeout,
        sessionTimeoutMinutes,
        setSessionTimeoutMinutes
    }), [user, memberships, authInitialized, isSessionTimeoutEnabled, sessionTimeoutMinutes]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

AuthProvider.propTypes = {
    children: PropTypes.node.isRequired,
};
import React, { createContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import PropTypes from "prop-types";
import { auth } from "../lib/firebase/config";

export const AuthContext = createContext();

// Role and business from the verified token. Cashiers sign in with a
// backend-issued custom token carrying role/businessUid/cashierId claims.
// Email/password accounts: a "wh." email is a warehouse account, anyone else
// is the business owner.
async function withClaims(u) {
    let claims = {};
    try {
        claims = (await u.getIdTokenResult()).claims || {};
    } catch (_) { /* best effort */ }
    const isCashier = claims.role === "cashier" && claims.businessUid && claims.cashierId;
    const isWarehouse = !isCashier && String(u.email || "").toLowerCase().startsWith("wh.");
    return {
        ...u,
        uid: u.uid,
        email: u.email,
        displayName: isCashier ? claims.cashierName || claims.cashierId : u.displayName,
        role: isCashier ? "cashier" : isWarehouse ? "warehouse" : "owner",
        businessUid: isCashier ? claims.businessUid : u.uid,
        cashierId: isCashier ? claims.cashierId : null,
        cashierName: isCashier ? claims.cashierName || claims.cashierId : null,
        counter: isCashier ? claims.counter || null : null,
        deviceId: isCashier ? claims.deviceId || null : null,
    };
}

// Revoked cashier sessions fail this refresh, which signs them out.
const CASHIER_SESSION_CHECK_MS = 2 * 60 * 1000;

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [authInitialized, setAuthInitialized] = useState(false);

    useEffect(() => {
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
                setUser(null);
            }
            setAuthInitialized(true);
        });

        return () => {
            unsubscribe();
            clearInterval(sessionTimer);
        };
    }, []);

    const signOut = async () => {
        try {
            await firebaseSignOut(auth);
        } catch (_) { /* best effort */ }
        localStorage.removeItem("pos_cashier_session");
        setUser(null);
    };

    const value = React.useMemo(() => ({ user, authInitialized, signOut }), [user, authInitialized]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

AuthProvider.propTypes = {
    children: PropTypes.node.isRequired,
};

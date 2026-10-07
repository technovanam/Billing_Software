import { useState, useEffect } from 'react';

/**
 * Financial Year Management Utility
 * Handles FY transitions, data archiving, and FY-based filtering
 */

// Get current financial year (April to March)
export const getCurrentFinancialYear = () => {
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-11
    const currentYear = now.getFullYear();

    // If month is Jan-Mar (0-2), FY started last year
    // If month is Apr-Dec (3-11), FY started this year
    const fyStartYear = currentMonth < 3 ? currentYear - 1 : currentYear;
    const fyEndYear = fyStartYear + 1;

    return {
        startYear: fyStartYear,
        endYear: fyEndYear,
        label: `${fyStartYear}-${fyEndYear.toString().slice(-2)}`, // e.g., "2025-26"
        fullLabel: `${fyStartYear}-${fyEndYear}`, // e.g., "2025-2026"
        startDate: new Date(fyStartYear, 3, 1), // April 1
        endDate: new Date(fyEndYear, 2, 31), // March 31
    };
};

// Get FY for a specific date
export const getFinancialYearForDate = (date) => {
    const d = new Date(date);
    const month = d.getMonth();
    const year = d.getFullYear();

    const fyStartYear = month < 3 ? year - 1 : year;
    const fyEndYear = fyStartYear + 1;

    return {
        startYear: fyStartYear,
        endYear: fyEndYear,
        label: `${fyStartYear}-${fyEndYear.toString().slice(-2)}`,
    };
};

// Check if a date is in current FY
export const isInCurrentFY = (date) => {
    const currentFY = getCurrentFinancialYear();
    const d = new Date(date);
    return d >= currentFY.startDate && d <= currentFY.endDate;
};

// Archive invoices from previous FY
export const archivePreviousFYInvoices = () => {
    const invoices = JSON.parse(localStorage.getItem('stub_invoices') || '[]');
    const payments = JSON.parse(localStorage.getItem('stub_payments') || '[]');

    // Separate current FY and previous FY invoices
    const currentFYInvoices = [];
    const previousFYInvoices = [];

    invoices.forEach(invoice => {
        const invoiceDate = new Date(invoice.invoiceDate || invoice.date);
        if (isInCurrentFY(invoiceDate)) {
            currentFYInvoices.push(invoice);
        } else {
            previousFYInvoices.push(invoice);
        }
    });

    // Get existing archives
    const archives = JSON.parse(localStorage.getItem('fy_archives') || '{}');

    // Group previous FY invoices by their FY
    previousFYInvoices.forEach(invoice => {
        const invoiceDate = new Date(invoice.invoiceDate || invoice.date);
        const fy = getFinancialYearForDate(invoiceDate);
        const fyKey = fy.label;

        if (!archives[fyKey]) {
            archives[fyKey] = {
                invoices: [],
                payments: [],
                startDate: new Date(fy.startYear, 3, 1).toISOString(),
                endDate: new Date(fy.endYear, 2, 31).toISOString(),
            };
        }

        archives[fyKey].invoices.push(invoice);
    });

    // Archive related payments
    payments.forEach(payment => {
        const paymentDate = new Date(payment.paymentDate || payment.date);
        if (!isInCurrentFY(paymentDate)) {
            const fy = getFinancialYearForDate(paymentDate);
            const fyKey = fy.label;

            if (archives[fyKey]) {
                archives[fyKey].payments.push(payment);
            }
        }
    });

    // Save archives
    localStorage.setItem('fy_archives', JSON.stringify(archives));

    // Keep only current FY invoices
    localStorage.setItem('stub_invoices', JSON.stringify(currentFYInvoices));

    // Keep only current FY payments
    const currentFYPayments = payments.filter(payment => {
        const paymentDate = new Date(payment.paymentDate || payment.date);
        return isInCurrentFY(paymentDate);
    });
    localStorage.setItem('stub_payments', JSON.stringify(currentFYPayments));

    return {
        archived: previousFYInvoices.length,
        current: currentFYInvoices.length,
        archives: Object.keys(archives),
    };
};

// Get all archived FYs
export const getArchivedFYs = () => {
    const archives = JSON.parse(localStorage.getItem('fy_archives') || '{}');
    return Object.keys(archives).sort().reverse(); // Latest first
};

// Get archived data for a specific FY
export const getArchivedFYData = (fyLabel) => {
    const archives = JSON.parse(localStorage.getItem('fy_archives') || '{}');
    return archives[fyLabel] || null;
};

// Check if FY transition is needed
export const checkFYTransition = () => {
    const lastCheckedFY = localStorage.getItem('last_checked_fy');
    const currentFY = getCurrentFinancialYear();
    const currentFYLabel = currentFY.label;

    if (lastCheckedFY !== currentFYLabel) {
        // FY has changed!
        return {
            needsTransition: true,
            previousFY: lastCheckedFY,
            currentFY: currentFYLabel,
        };
    }

    return {
        needsTransition: false,
        currentFY: currentFYLabel,
    };
};

// Perform FY transition
export const performFYTransition = () => {
    const currentFY = getCurrentFinancialYear();

    // Archive previous FY data
    const archiveResult = archivePreviousFYInvoices();

    // Update last checked FY
    localStorage.setItem('last_checked_fy', currentFY.label);

    // Reset invoice counter for new FY
    localStorage.setItem('last_invoice_number', '0');

    return {
        success: true,
        currentFY: currentFY.label,
        ...archiveResult,
    };
};

// Initialize FY system (call on app start)
export const initializeFYSystem = () => {
    const currentFY = getCurrentFinancialYear();
    const lastCheckedFY = localStorage.getItem('last_checked_fy');

    if (!lastCheckedFY) {
        // First time setup
        localStorage.setItem('last_checked_fy', currentFY.label);
        return {
            initialized: true,
            currentFY: currentFY.label,
        };
    }

    // Check if transition is needed
    const transitionCheck = checkFYTransition();

    if (transitionCheck.needsTransition) {
        return performFYTransition();
    }

    return {
        initialized: true,
        currentFY: currentFY.label,
    };
};

// Custom hook for FY management
export const useFinancialYear = () => {
    const [currentFY, setCurrentFY] = useState(getCurrentFinancialYear());
    const [archivedFYs, setArchivedFYs] = useState([]);

    useEffect(() => {
        // Initialize FY system
        initializeFYSystem();

        // Update archived FYs list
        setArchivedFYs(getArchivedFYs());

        // Check for FY transition daily
        const checkInterval = setInterval(() => {
            const check = checkFYTransition();
            if (check.needsTransition) {
                const result = performFYTransition();
                if (result.success) {
                    setCurrentFY(getCurrentFinancialYear());
                    setArchivedFYs(getArchivedFYs());
                    // Reload page to refresh all data
                    window.location.reload();
                }
            }
        }, 24 * 60 * 60 * 1000); // Check once per day

        return () => clearInterval(checkInterval);
    }, []);

    return {
        currentFY,
        archivedFYs,
        archivePreviousFY: archivePreviousFYInvoices,
        getArchivedData: getArchivedFYData,
        performTransition: performFYTransition,
    };
};

import React from 'react';
import { X, Calendar, CreditCard, Hash, ChevronLeft, ChevronRight } from 'lucide-react';
import { usePayments } from '../../hooks/useFirestore';
import PropTypes from 'prop-types';

const TransactionHistoryModal = ({ isOpen, onClose, invoiceId, invoiceNo }) => {
    const { payments: allTransactions, error } = usePayments(invoiceId);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">Transaction History</h3>
                        <p className="text-sm text-gray-500">Invoice: {invoiceNo}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X size={24} className="text-gray-500" />
                    </button>
                </div>

                {error && (
                    <div className="p-4 mb-4 bg-red-50 text-red-600 rounded-md text-sm">
                        {error}
                    </div>
                )}

                <div className="relative group px-1">
                    {/* Left Scroll Button */}
                    <button
                        onClick={() => {
                            const container = document.getElementById('transaction-scroll-container');
                            if (container) container.scrollBy({ left: -300, behavior: 'smooth' });
                        }}
                        className="absolute left-0 top-1/2 -translate-y-1/2 -ml-5 z-10 bg-white border border-gray-200 shadow-md p-2 rounded-full text-gray-600 hover:text-blue-600 hover:border-blue-200 transition-all opacity-0 group-hover:opacity-100"
                        title="Scroll Left"
                    >
                        <ChevronLeft size={20} />
                    </button>

                    <div
                        id="transaction-scroll-container"
                        className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide scroll-smooth px-1"
                    >
                        {allTransactions && allTransactions.length > 0 ? (
                            allTransactions.map((tx) => (
                                <div key={tx.id} className="min-w-[250px] bg-gray-50 border border-gray-200 rounded-lg p-4 flex-shrink-0">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs text-gray-500 flex items-center gap-1">
                                            <Calendar size={12} /> {tx.paymentDate || "-"}
                                        </span>
                                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                            {tx.status || "Completed"}
                                        </span>
                                    </div>

                                    <div className="mb-3">
                                        <p className="text-sm text-gray-500 mb-1">Amount Paid</p>
                                        <p className="text-xl font-bold text-gray-900">
                                            ₹{Number(tx.amount).toLocaleString()}
                                        </p>
                                    </div>

                                    <div className="space-y-2 pt-3 border-t border-gray-200">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500 flex items-center gap-1">
                                                <CreditCard size={14} /> Method
                                            </span>
                                            <span className="font-medium text-gray-900">{tx.method}</span>
                                        </div>
                                        {tx.transactionId && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-500 flex items-center gap-1">
                                                    <Hash size={14} /> Ref ID
                                                </span>
                                                <span className="font-mono text-gray-700 text-xs">{tx.transactionId}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="w-full py-12 text-center text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                No transactions found for this invoice.
                            </div>
                        )}
                    </div>

                    {/* Right Scroll Button */}
                    <button
                        onClick={() => {
                            const container = document.getElementById('transaction-scroll-container');
                            if (container) container.scrollBy({ left: 300, behavior: 'smooth' });
                        }}
                        className="absolute right-0 top-1/2 -translate-y-1/2 -mr-5 z-10 bg-white border border-gray-200 shadow-md p-2 rounded-full text-gray-600 hover:text-blue-600 hover:border-blue-200 transition-all opacity-0 group-hover:opacity-100"
                        title="Scroll Right"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>

                {allTransactions && allTransactions.length > 0 && (
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100 flex justify-between items-center">
                        <span className="text-sm font-medium text-blue-900">Total Amount Paid</span>
                        <span className="text-lg font-bold text-blue-700">
                            ₹{allTransactions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0).toLocaleString()}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

TransactionHistoryModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    invoiceId: PropTypes.string,
    invoiceNo: PropTypes.string,
    totalAmount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

export default TransactionHistoryModal;

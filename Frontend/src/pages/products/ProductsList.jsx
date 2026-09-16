import React, { useState, useEffect, useContext, memo, useCallback } from "react";
import PropTypes from 'prop-types';
import { Plus, Search, Eye, Edit, Trash2, X, History, ArrowLeft, ArrowRight } from "lucide-react";
import Pagination from "../../components/Pagination";
import { useProducts } from "../../hooks/useFirestore";
import { AuthContext } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

const ModalWrapper = ({ children, onClose, maxWidth = "max-w-md" }) => (
  <div
    className="fixed inset-0 bg-black bg-opacity-50 modal-backdrop flex justify-center items-center z-50 p-4"
    onClick={onClose}
    role="button"
    tabIndex={-1}
    onKeyDown={(e) => e.key === 'Escape' && onClose()}
  >
    <div
      className={`bg-white rounded-lg shadow-xl w-full ${maxWidth} relative transition-all`}
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
    >
      {children}
    </div>
  </div>
);

ModalWrapper.propTypes = {
  children: PropTypes.node.isRequired,
  onClose: PropTypes.func.isRequired,
  maxWidth: PropTypes.string,
};

// --- ProductFormModal for adding/editing products ---
const ProductFormModal = ({ onClose, onSave, productToEdit }) => {
  const [name, setName] = useState("");
  const [hsn, setHsn] = useState("");
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (productToEdit) {
      setName(productToEdit.name);
      setHsn(productToEdit.hsn);
      const priceValue = productToEdit.price.replaceAll(/[^0-9.-]+/g, "");
      setPrice(priceValue);
      setUnit(productToEdit.unit || "");
      setDescription(productToEdit.description || "");
    } else {
      // Reset form for adding new product
      setName("");
      setHsn("");
      setPrice("");
      setUnit("");
      setDescription("");
    }
  }, [productToEdit]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...productToEdit, name, hsn, price, unit, description });
  };

  const modalTitle = productToEdit ? "Edit Product" : "Add New Product";
  const submitButtonText = productToEdit ? "Save Changes" : "Add Product";

  return (
    <ModalWrapper onClose={onClose}>
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        title="Close"
      >
        <X size={18} />
      </button>
      <div className="p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">{modalTitle}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="productName"
              className="block text-sm text-gray-700 mb-1"
            >
              Product Name *
            </label>
            <input
              id="productName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter product name"
              className="w-full px-3 py-2 bg-gray-100 border-0 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="hsnCode"
                className="block text-sm text-gray-700 mb-1"
              >
                HSN Code *
              </label>
              <input
                id="hsnCode"
                type="text"
                value={hsn}
                onChange={(e) => setHsn(e.target.value)}
                placeholder="e.g., 8479"
                className="w-full px-3 py-2 bg-gray-100 border-0 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label
                htmlFor="price"
                className="block text-sm text-gray-700 mb-1"
              >
                Price (₹) *
              </label>
              <input
                id="price"
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 bg-gray-100 border-0 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="productUnit" className="block text-sm text-gray-700 mb-1">
                Unit *
              </label>
              <select
                id="productUnit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2 bg-gray-100 border-0 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select unit</option>
                <option value="Piece">Piece</option>
                <option value="Box">Box</option>
                <option value="Kilogram">Kilogram</option>
                <option value="Gram">Gram</option>
                <option value="Meter">Meter</option>
                <option value="Mile">Mile</option>
                <option value="Litre">Litre</option>
                <option value="Hour">Hour</option>
              </select>
            </div>
            <div>
              <label htmlFor="productDescription" className="block text-sm text-gray-700 mb-1">
                Description
              </label>
              <input
                id="productDescription"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter product description"
                className="w-full px-3 py-2 bg-gray-100 border-0 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-4 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-white border border-gray-200 text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              {submitButtonText}
            </button>
          </div>
        </form>
      </div>
    </ModalWrapper>
  );
};

ProductFormModal.propTypes = {
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  productToEdit: PropTypes.shape({
    name: PropTypes.string,
    hsn: PropTypes.string,
    price: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }),
};

// --- ProductViewModal for viewing product details ---
const ProductViewModal = ({ product, onClose }) => {
  const [historyPage, setHistoryPage] = useState(0);
  const itemsPerPage = 4;

  if (!product) return null;

  const history = product.priceHistory || [];
  const totalPages = Math.ceil(history.length / itemsPerPage);
  const displayedHistory = history.slice(historyPage * itemsPerPage, (historyPage + 1) * itemsPerPage);

  const handlePrevPage = () => setHistoryPage(p => Math.max(0, p - 1));
  const handleNextPage = () => setHistoryPage(p => Math.min(totalPages - 1, p + 1));

  return (
    <ModalWrapper onClose={onClose} maxWidth="max-w-5xl">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors z-10"
        title="Close"
      >
        <X size={20} />
      </button>

      <div className="p-8 flex flex-col lg:flex-row gap-8">
        {/* Left Side: Identity & Meta + Current Price */}
        <div className="w-full lg:w-1/3 flex flex-col justify-center border-r border-gray-100 pr-8">
          <div className="text-center lg:text-left mb-6">
            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto lg:mx-0 mb-4 shadow-sm">
              <span className="text-3xl font-bold">{product.name.charAt(0).toUpperCase()}</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 leading-tight">{product.name}</h2>
            <p className="text-sm text-gray-500 mt-2">Product Details</p>
          </div>

          <div className="flex flex-col gap-4 mt-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Serial No.</p>
                <p className="text-base font-semibold text-gray-900">{product.displayId}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">HSN Code</p>
                <p className="text-base font-semibold text-gray-900">{product.hsn}</p>
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Current Price</p>
                <p className="text-2xl font-bold text-green-600">{product.price}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Price History Only */}
        <div className="w-full lg:w-2/3 flex flex-col">
          <div className="p-6 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-gray-100 flex flex-col h-full min-h-[320px]">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
              <History size={16} className="text-gray-400" />
              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Price History</p>
              <span className="ml-auto text-xs text-gray-400 font-medium">
                {history.length} Record{history.length !== 1 ? 's' : ''}
              </span>
            </div>

            {history.length > 0 ? (
              <>
                <div className="flex-1 flex flex-col gap-3">
                  {displayedHistory.map((historyItem, index) => (
                    <div key={index} className="flex justify-between items-center group p-3 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-100">
                      <span className="font-bold text-xl text-gray-400 line-through decoration-2 decoration-gray-300">
                        ₹{Number(historyItem.price).toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider bg-gray-100 px-3 py-1.5 rounded-full">
                        {new Date(historyItem.date).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                    <button
                      onClick={handlePrevPage}
                      disabled={historyPage === 0}
                      className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-gray-600"
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <span className="text-xs font-medium text-gray-400">
                      Page {historyPage + 1} of {totalPages}
                    </span>
                    <button
                      onClick={handleNextPage}
                      disabled={historyPage === totalPages - 1}
                      className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-gray-600"
                    >
                      <ArrowRight size={16} />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <History size={32} className="mb-2 opacity-20" />
                <p className="text-sm">No price history available</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalWrapper>
  );
};

ProductViewModal.propTypes = {
  product: PropTypes.shape({
    displayId: PropTypes.string,
    name: PropTypes.string,
    hsn: PropTypes.string,
    price: PropTypes.string,
    revenue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }),
  onClose: PropTypes.func.isRequired,
};

const DeleteConfirmationModal = ({ onClose, onConfirm, productName }) => {
  return (
    <ModalWrapper onClose={onClose}>
      <div className="p-6 text-center">
        <h2 className="text-lg font-bold text-gray-900 mb-2">
          Confirm Deletion
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to delete <strong>{productName}</strong>? This
          action cannot be undone.
        </p>
        <div className="flex justify-center gap-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-white border border-gray-200 text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
};

DeleteConfirmationModal.propTypes = {
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  productName: PropTypes.string,
};

// PERFORMANCE: Memoized ProductRow to prevent unnecessary re-renders
const ProductRow = memo(({
  product,
  serialNumber,
  onView,
  onEdit,
  onDelete,
}) => (
  <tr className="text-sm transition-colors hover:bg-gray-50">
    <td className="px-6 py-4 font-medium text-gray-900">{serialNumber}</td>
    <td className="px-6 py-4">
      <div className="font-medium text-gray-900">{product.name}</div>
    </td>
    <td className="px-6 py-4 text-gray-700">{product.hsn}</td>
    <td className="px-6 py-4 font-medium text-gray-900">{product.price}</td>
    <td className="px-6 py-4">
      <div className="flex items-center space-x-3">
        <button
          onClick={() => onView(product, serialNumber)}
          className="p-1 text-gray-600 transition-colors hover:text-blue-600"
          title="View Details"
        >
          <Eye className="w-4 h-4" />
        </button>
        <button
          onClick={() => onEdit(product)}
          className="p-1 text-gray-600 transition-colors hover:text-green-600"
          title="Edit Product"
        >
          <Edit className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(product)}
          className="p-1 text-gray-600 transition-colors hover:text-red-600"
          title="Delete Product"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </td>
  </tr>
));

ProductRow.displayName = 'ProductRow';

ProductRow.propTypes = {
  product: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    hsn: PropTypes.string,
    price: PropTypes.string.isRequired,
  }).isRequired,
  serialNumber: PropTypes.string.isRequired,
  onView: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

// --- Main App Component ---
export default function ProductManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [modal, setModal] = useState({ isOpen: false, type: null, data: null });

	// ...existing code...
  const { success, error: showError, warning } = useToast();

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Use products hook
  const {
    products,
    allProducts,
    loading,
    error,
    pagination,
    addProduct,
    editProduct,
    removeProduct
  } = useProducts({
    search: searchTerm,
    page: currentPage,
    limit: itemsPerPage,
    sortBy: 'serialNumber', // Sort by serial number, not name
    sortDirection: 'asc'
  });

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Stable handlers for actions


  // Stable handlers for actions
  const closeModal = useCallback(() => setModal({ isOpen: false, type: null, data: null }), []);

  const handleViewProduct = useCallback((product, serialNumber) => {
    setModal({
      isOpen: true,
      type: "view",
      data: {
        ...product,
        displayId: serialNumber,
      },
    });
  }, []);

  const handleEditProduct = useCallback((product) => {
    setModal({ isOpen: true, type: "edit", data: product });
  }, []);

  const handleDeleteProduct = useCallback((product) => {
    setModal({ isOpen: true, type: "delete", data: product });
  }, []);

  // handle save (add or edit)
  const handleSaveProduct = async (productData) => {
    const isEdit = modal.type === "edit" && productData?.id;
    const productName = productData.name;

    // Optimistic UI: Close modal and show notification immediately
    closeModal();

    if (isEdit) {
      // Update = Yellow (Warning style)
      warning(`Product "${productName}" updated successfully!`, "Updated");
    } else {
      // Create = Green (Success style)
      success(`Product "${productName}" added successfully!`, "Added");
    }

    let result;
    if (isEdit) {
      const newPrice = Number.parseFloat(productData.price);
      const updateData = {
        name: productData.name,
        hsn: productData.hsn,
        price: newPrice,
        unit: productData.unit,
        description: productData.description,
      };

      // Check if price changed to update oldPrice
      // modal.data.price is formatted string e.g. "₹1,200", we need to parse it
      const previousPriceString = modal.data.price || "";
      const previousPrice = Number.parseFloat(previousPriceString.replace(/[^0-9.-]+/g, ""));

      if (!isNaN(previousPrice) && previousPrice !== newPrice) {
        updateData.oldPrice = previousPrice;

        // Update Price History
        const currentHistory = modal.data.priceHistory || [];
        updateData.priceHistory = [
          { price: previousPrice, date: new Date().toISOString() },
          ...currentHistory
        ];
      }

      result = await editProduct(productData.id, updateData);
    } else {
      result = await addProduct({
        name: productData.name,
        hsn: productData.hsn,
        price: Number.parseFloat(productData.price),
        unit: productData.unit,
        description: productData.description,
      });
    }

    // Handle failure
    if (!result.success) {
      showError(`Failed to ${isEdit ? "update" : "add"} product: ${result.error}`, "Error");
    }
  };

  const confirmDelete = async () => {
    if (modal.data?.id) {
      const productName = modal.data.name;
      const productId = modal.data.id;

      // Optimistic UI: Close modal and show notification immediately
      closeModal();

      // Delete = Red (Error style)
      showError(`Product "${productName}" deleted successfully!`, "Deleted");

      const result = await removeProduct(productId);

      // Handle failure
      if (!result.success) {
        showError(`Failed to delete product: ${result.error}`, "Error");
      }
    }
  };

  const renderTableBody = () => {
    if (loading) {
      return Array.from({ length: 5 }).map((_, i) => (
        <tr key={`skeleton-${i}`} className="animate-pulse">
          <td className="px-6 py-4">
            <div className="h-4 bg-gray-200 rounded w-8"></div>
          </td>
          <td className="px-6 py-4">
            <div className="h-4 bg-gray-200 rounded w-48"></div>
          </td>
          <td className="px-6 py-4">
            <div className="h-4 bg-gray-200 rounded w-24"></div>
          </td>
          <td className="px-6 py-4">
            <div className="h-4 bg-gray-200 rounded w-20"></div>
          </td>
          <td className="px-6 py-4">
            <div className="h-4 bg-gray-200 rounded w-24"></div>
          </td>
        </tr>
      ));
    }

    if (error) {
      return (
        <tr>
          <td colSpan="5" className="text-center text-sm text-gray-500 py-12">
            <div className="text-red-600">
              <p>Error loading products: {error}</p>
              <button
                onClick={() => globalThis.location.reload()}
                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          </td>
        </tr>
      );
    }

    if (products && products.length > 0) {
      return products.map((product, index) => {
        // Use the permanent serialNumber from the product data
        const serialNumber = product.serialNumber || String(index + 1).padStart(2, '0');

        return (
          <ProductRow
            key={product.id}
            product={{
              ...product,
              price: `₹${Number(product.price).toLocaleString('en-IN')}`,
              revenue: 'N/A'
            }}
            serialNumber={serialNumber}
            onView={handleViewProduct}
            onEdit={handleEditProduct}
            onDelete={handleDeleteProduct}
          />
        );
      });
    }

    return (
      <tr>
        <td
          colSpan="5"
          className="text-center text-sm text-gray-500 py-12"
        >
          No products found.{" "}
          {searchTerm && "Try adjusting your search criteria."}
        </td>
      </tr>
    );
  };

  return (
    <>
      <div className="min-h-screen text-slate-800 font-mazzard">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-6">
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Product Management
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                View all your products in one place
              </p>
            </div>
            <div className="flex items-center gap-2 mt-3 sm:mt-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  aria-label="Search products"
                  type="text"
                  placeholder="Search by HSN or Name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-80 bg-gray-100 rounded-lg pl-9 pr-4 py-2 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={() =>
                  setModal({ isOpen: true, type: "add", data: null })
                }
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <Plus size={16} />
                Add Product
              </button>
            </div>
          </header>

          <main className="mt-6 flex flex-col gap-6">
            <div className="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
              <table className="w-full min-w-[600px]">
                <thead className="text-xs font-semibold text-gray-500 uppercase bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left">S.No</th>
                    <th scope="col" className="px-6 py-3 text-left">Product Name</th>
                    <th scope="col" className="px-6 py-3 text-left">HSN Code</th>
                    <th scope="col" className="px-6 py-3 text-left">Price</th>
                    <th scope="col" className="px-6 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {renderTableBody()}
                </tbody>
              </table>
            </div>
            {pagination && (
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={setCurrentPage}
                itemsPerPage={itemsPerPage}
                onItemsPerPageChange={setItemsPerPage}
                totalItems={pagination.total}
                startIndex={(pagination.page - 1) * pagination.limit}
                endIndex={pagination.page * pagination.limit}
              />
            )}
          </main>
        </div>
      </div>

      {/* --- MODAL RENDERING --- */}
      {modal.isOpen && (
        <>
          {modal.type === "view" && (
            <ProductViewModal
              product={modal.data}
              onClose={closeModal}
            />
          )}
          {(modal.type === "add" || modal.type === "edit") && (
            <ProductFormModal
              onClose={closeModal}
              onSave={handleSaveProduct}
              productToEdit={modal.type === "edit" ? modal.data : null}
            />
          )}
          {modal.type === "delete" && (
            <DeleteConfirmationModal
              onClose={closeModal}
              onConfirm={confirmDelete}
              productName={modal.data?.name}
            />
          )}
        </>
      )}
    </>
  );
}

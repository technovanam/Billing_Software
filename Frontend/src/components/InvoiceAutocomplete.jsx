import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { focusNextFormField } from "../utils/keyboardNavigation";

export const ClientAutocomplete = ({ clients, selectedClient, onSelect }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (selectedClient) {
      setSearchTerm(selectedClient.name);
    } else {
      setSearchTerm("");
    }
  }, [selectedClient]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsFocused(false);
        setSuggestions([]);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [wrapperRef]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (value) {
      const filteredSuggestions = clients.filter((client) =>
        client.name.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(filteredSuggestions);
      setSelectedIndex(0);
    } else {
      setSuggestions([]);
      onSelect(null);
    }
  };

  const handleSelectSuggestion = (client) => {
    onSelect(client.id);
    setSearchTerm(client.name);
    setSuggestions([]);
    setIsFocused(false);
    // After selection, focus next form field
    setTimeout(() => {
      if (inputRef.current) {
        focusNextFormField(inputRef.current);
      }
    }, 50);
  };

  const handleKeyDown = (e) => {
    if (isFocused && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        const chosen = suggestions[selectedIndex] || suggestions[0];
        if (chosen) {
          handleSelectSuggestion(chosen);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setIsFocused(false);
        return;
      }
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <label htmlFor="client-search" className="block text-sm text-gray-700 mb-1">
        Select Client
      </label>
      <input
        ref={inputRef}
        id="client-search"
        type="text"
        value={searchTerm}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        placeholder="Type to search for a client..."
        className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-0"
        data-autocomplete-open={isFocused && suggestions.length > 0 ? "true" : "false"}
      />
      {isFocused && searchTerm && (
        <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
          {suggestions.length > 0 ? (
            suggestions.map((client, idx) => (
              <li key={client.id}>
                <button
                  type="button"
                  onClick={() => handleSelectSuggestion(client)}
                  className={`w-full text-left px-4 py-2 text-sm cursor-pointer hover:bg-gray-100 focus:bg-gray-100 focus:outline-none ${
                    idx === selectedIndex ? "bg-blue-50 text-blue-700 font-medium" : ""
                  }`}
                >
                  {client.name}
                </button>
              </li>
            ))
          ) : (
            <li className="px-4 py-2 text-sm text-gray-500">No client found</li>
          )}
        </ul>
      )}
    </div>
  );
};

export const ProductAutocomplete = ({
  products,
  value,
  onSelect,
  onChange,
  onAddNewProduct,
  clientId,
}) => {
  const [searchTerm, setSearchTerm] = useState(value || "");
  const [suggestions, setSuggestions] = useState([]);
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const [dropdownStyle, setDropdownStyle] = useState({});

  const updateDropdownPosition = () => {
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      setDropdownStyle({
        top: `${rect.bottom}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
      });
    }
  };

  useEffect(() => {
    if (isFocused) {
      updateDropdownPosition();
      window.addEventListener("scroll", updateDropdownPosition, true);
      window.addEventListener("resize", updateDropdownPosition);
    }
    return () => {
      window.removeEventListener("scroll", updateDropdownPosition, true);
      window.removeEventListener("resize", updateDropdownPosition);
    };
  }, [isFocused]);

  useEffect(() => {
    setSearchTerm(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target) &&
        (!dropdownRef.current || !dropdownRef.current.contains(event.target))
      ) {
        setIsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [wrapperRef]);

  const handleInputChange = (e) => {
    const inputValue = e.target.value;
    setSearchTerm(inputValue);
    onChange(inputValue);

    if (inputValue) {
      const filteredSuggestions = products.filter((product) =>
        product.name.toLowerCase().includes(inputValue.toLowerCase())
      );
      setSuggestions(filteredSuggestions);
      setSelectedIndex(0);
    } else {
      setSuggestions([]);
    }
  };

  const handleAddNewProduct = () => {
    if (onAddNewProduct && searchTerm.trim()) {
      onAddNewProduct(searchTerm.trim(), clientId);
      setSearchTerm("");
      setSuggestions([]);
      setIsFocused(false);
      setTimeout(() => {
        if (inputRef.current) {
          focusNextFormField(inputRef.current);
        }
      }, 50);
    }
  };

  const handleSelectSuggestion = (product) => {
    onSelect(product);
    setSearchTerm(product.name);
    setSuggestions([]);
    setIsFocused(false);
    // After selection, focus next form field (e.g. HSN or Qty)
    setTimeout(() => {
      if (inputRef.current) {
        focusNextFormField(inputRef.current);
      }
    }, 50);
  };

  const handleKeyDown = (e) => {
    const exactMatch = products.find(
      (p) => p.name.toLowerCase() === searchTerm.toLowerCase()
    );
    const showAddOption = searchTerm.trim() && !exactMatch && onAddNewProduct;
    const totalOptions = suggestions.length + (showAddOption ? 1 : 0);

    if (isFocused && totalOptions > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < totalOptions - 1 ? prev + 1 : 0));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : totalOptions - 1));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (selectedIndex < suggestions.length) {
          handleSelectSuggestion(suggestions[selectedIndex]);
        } else if (showAddOption) {
          handleAddNewProduct();
        } else if (suggestions.length > 0) {
          handleSelectSuggestion(suggestions[0]);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setIsFocused(false);
        return;
      }
    }
  };

  const Dropdown = () => {
    const exactMatch = products.find(
      (p) => p.name.toLowerCase() === searchTerm.toLowerCase()
    );
    const showAddOption = searchTerm.trim() && !exactMatch && onAddNewProduct;

    return (
      <ul
        ref={dropdownRef}
        style={{ ...dropdownStyle, position: "fixed" }}
        className="z-50 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto"
      >
        {suggestions.length > 0 ? (
          suggestions.map((product, idx) => (
            <li key={product.id}>
              <button
                type="button"
                onClick={() => handleSelectSuggestion(product)}
                className={`w-full text-left px-4 py-2 text-sm cursor-pointer hover:bg-gray-100 focus:bg-gray-100 focus:outline-none ${
                  idx === selectedIndex ? "bg-blue-50 text-blue-700 font-medium" : ""
                }`}
              >
                {product.name} - ₹{product.price}
              </button>
            </li>
          ))
        ) : (
          !showAddOption && (
            <li className="px-4 py-2 text-sm text-gray-500">
              No item found
            </li>
          )
        )}
        {showAddOption && (
          <li>
            <button
              type="button"
              onClick={handleAddNewProduct}
              className={`w-full text-left px-4 py-2 text-sm cursor-pointer hover:bg-blue-100 border-t border-gray-200 text-blue-600 font-medium focus:outline-none focus:bg-blue-100 ${
                selectedIndex === suggestions.length ? "bg-blue-100 font-bold" : ""
              }`}
            >
              + Add "{searchTerm}" as new product
            </button>
          </li>
        )}
      </ul>
    );
  };

  return (
    <div ref={wrapperRef}>
      <input
        ref={inputRef}
        type="text"
        placeholder="Item description"
        value={searchTerm}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-0"
        data-autocomplete-open={isFocused && (suggestions.length > 0 || (searchTerm.trim() && onAddNewProduct)) ? "true" : "false"}
      />
      {isFocused &&
        searchTerm &&
        createPortal(<Dropdown />, document.body)}
    </div>
  );
};

// Default export for compatibility (noop)
export default {};


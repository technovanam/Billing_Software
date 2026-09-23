import React from "react";
import PropTypes from "prop-types";
import { Navigate, useLocation } from "react-router-dom";
import { useSuperAdminAuth } from "../../context/SuperAdminAuthContext";

export default function SuperAdminRoute({ children }) {
  const { isAuthenticated } = useSuperAdminAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/super-admin/login" state={{ from: location }} replace />;
  }

  return children;
}

SuperAdminRoute.propTypes = {
  children: PropTypes.node.isRequired,
};

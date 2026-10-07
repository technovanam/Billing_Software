import React from "react";
import PropTypes from "prop-types";

// Keeps one broken page from blanking the whole app: shows the error and a
// way back instead. Reset by changing `resetKey` (the route path).
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Page crashed:", error, info?.componentStack);
  }

  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="m-6 rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
        <h2 className="mb-1 text-base font-bold">This page hit an error</h2>
        <p className="mb-3">{String(this.state.error?.message || this.state.error)}</p>
        <button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-rose-600 px-3 py-1.5 font-semibold text-white hover:bg-rose-700">
          Reload page
        </button>
      </div>
    );
  }
}

ErrorBoundary.propTypes = { children: PropTypes.node, resetKey: PropTypes.string };

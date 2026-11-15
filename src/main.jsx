import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { console.error('Hesabu interface error:', error.message); }
  render() {
    if (this.state.failed) return <main className="fatal-error"><h1>Let’s get you back to learning.</h1><p>The interface could not load. Your saved browser data has not been removed.</p><button onClick={() => location.reload()}>Reload Hesabu</button></main>;
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(<ErrorBoundary><App /></ErrorBoundary>);

import { Component } from 'react';
export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('Workspace error', error, info); }
  render() {
    if (this.state.error) return <div className="standalone-workspace"><h1>Workspace error</h1><p className="error-message">{this.state.error.message}</p><button className="button" onClick={() => window.location.reload()}>Reload workspace</button></div>;
    return this.props.children;
  }
}

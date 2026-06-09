import React from "react";

export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
    };
  }

  static getDerivedStateFromError() {
    return {
      hasError: true,
    };
  }

  componentDidMount() {
    window.addEventListener("unhandledrejection", this.handleUnhandledRejection);
  }

  componentWillUnmount() {
    window.removeEventListener("unhandledrejection", this.handleUnhandledRejection);
  }

  componentDidCatch(error) {
    console.error("GameMatch crashed:", error);
  }

  handleUnhandledRejection = (event) => {
    console.error("GameMatch async error:", event.reason);
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="crash-screen">
          <div className="crash-screen__panel">
            <div className="brand-lockup brand-lockup--center">
              <img className="brand-lockup__logo" src="/logo.png" alt="" width="48" height="48" />
              <span>GameMatch</span>
            </div>
            <h1>Algo deu errado.</h1>
            <p className="muted">Ocorreu um erro inesperado. Tente recarregar a página para continuar.</p>
            <button className="button button--primary" type="button" onClick={this.handleReload}>
              Recarregar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

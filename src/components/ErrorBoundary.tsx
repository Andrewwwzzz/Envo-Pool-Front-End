import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  /** Optional label shown in the fallback, e.g. "Admin panel" */
  label?: string;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary]${this.props.label ? ` (${this.props.label})` : ""}`, error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
          <h2 className="text-lg font-semibold text-foreground">
            Something went wrong{this.props.label ? ` in ${this.props.label}` : ""}.
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            This section hit an unexpected error. The rest of the site is unaffected — try reloading this page.
          </p>
          <Button onClick={this.handleReload}>Reload</Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

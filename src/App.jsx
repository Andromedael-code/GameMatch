import { AppProvider } from "./app/AppProvider";
import { AppRouter } from "./app/AppRouter";
import { AppErrorBoundary } from "./app/ErrorBoundary";

export default function App() {
  return (
    <AppErrorBoundary>
      <AppProvider>
        <AppRouter />
      </AppProvider>
    </AppErrorBoundary>
  );
}

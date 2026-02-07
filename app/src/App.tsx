import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { I18nProvider } from "@/i18n";
import { AppLayout } from "@/components/layout/AppLayout";
import { VehiculosPage } from "@/features/vehiculos";
import { VehiclesTodayPage } from "@/features/vehiculos/VehiclesTodayPage";
import { PlateConflictsModal } from "@/features/vehiculos/components/PlateConflictsModal";
import { useParkingStore } from "@/hooks/useParkingStore";
import { useSession } from "@/hooks/useSession";
import { useFirstRunStatus } from "@/hooks/useFirstRunStatus";
import { CajaPage } from "@/features/caja";
import { MetricasPage } from "@/features/metricas";
import { RolesPage } from "@/features/roles";
import { BackupPage } from "@/features/backup";
import { DebtorsPage } from "@/features/debtors";
import { TariffsPage } from "@/features/tariffs";
import { DevConsolePage } from "@/features/dev-console";
import { BarcodesPage } from "@/features/barcodes";
import { LoginPage } from "@/pages/Login";
import { FirstRunPage } from "@/pages/FirstRunPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
  },
});

function isTauri(): boolean {
  return typeof window !== "undefined" && !!(window as unknown as { __TAURI__?: unknown }).__TAURI__;
}

function PlateConflictsGate() {
  const { plateConflicts, resolvePlateConflict } = useParkingStore();
  return (
    <PlateConflictsModal
      conflicts={plateConflicts}
      onResolve={(plate, keepId) => void resolvePlateConflict(plate, keepId)}
    />
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, isLoading } = useSession();
  const { completed: firstRunCompleted, isLoading: firstRunLoading } = useFirstRunStatus();
  const tauri = isTauri();
  const path = location.pathname;

  if (!tauri) {
    return <>{children}</>;
  }
  if (isLoading || firstRunLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" role="status" aria-label="Loading">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }
  if (firstRunCompleted === false && path !== "/first-run") {
    return <Navigate to="/first-run" replace />;
  }
  if (firstRunCompleted === true && path === "/first-run") {
    return <Navigate to="/vehicles" replace />;
  }
  if (!user && path !== "/login" && path !== "/first-run") {
    return <Navigate to="/login" replace />;
  }
  if (user && path === "/login") {
    return <Navigate to="/vehicles" replace />;
  }
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      storageKey="coco-parking-theme"
      themes={["light", "dark", "soft"]}
      enableSystem={false}
    >
      <I18nProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
        <PlateConflictsGate />
        <BrowserRouter>
          <AuthGate>
            <Routes>
              <Route path="/first-run" element={<FirstRunPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<AppLayout />}>
                <Route index element={<Navigate to="/vehicles" replace />} />
                <Route path="vehicles" element={<VehiculosPage />} />
                <Route path="vehicles/today" element={<VehiclesTodayPage />} />
                <Route path="till" element={<CajaPage />} />
                <Route path="debtors" element={<DebtorsPage />} />
                <Route path="metrics" element={<MetricasPage />} />
                <Route path="barcode" element={<BarcodesPage />} />
                <Route path="tariffs" element={<TariffsPage />} />
                <Route path="roles" element={<RolesPage />} />
                <Route path="backup" element={<BackupPage />} />
                <Route path="dev-console" element={<DevConsolePage />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthGate>
        </BrowserRouter>
        </TooltipProvider>
      </I18nProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

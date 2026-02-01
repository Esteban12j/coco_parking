import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { I18nProvider } from "@/i18n";
import { AppLayout } from "@/components/layout/AppLayout";
import { VehiculosPage } from "@/features/vehiculos";
import { PlateConflictsModal } from "@/features/vehiculos/components/PlateConflictsModal";
import { useParkingStore } from "@/hooks/useParkingStore";
import { CajaPage } from "@/features/caja";
import { MetricasPage } from "@/features/metricas";
import { RolesPage } from "@/features/roles";
import { BackupPage } from "@/features/backup";
import { DrivePage } from "@/features/drive";
import { DevConsolePage } from "@/features/dev-console";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function PlateConflictsGate() {
  const { plateConflicts, resolvePlateConflict } = useParkingStore();
  return (
    <PlateConflictsModal
      conflicts={plateConflicts}
      onResolve={(plate, keepId) => void resolvePlateConflict(plate, keepId)}
    />
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <I18nProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <PlateConflictsGate />
        <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<Navigate to="/vehicles" replace />} />
            <Route path="vehicles" element={<VehiculosPage />} />
            <Route path="till" element={<CajaPage />} />
            <Route path="metrics" element={<MetricasPage />} />
            <Route path="roles" element={<RolesPage />} />
            <Route path="backup" element={<BackupPage />} />
            <Route path="drive" element={<DrivePage />} />
            <Route path="dev-console" element={<DevConsolePage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </I18nProvider>
  </QueryClientProvider>
);

export default App;

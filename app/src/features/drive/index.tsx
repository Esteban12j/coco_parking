import { Cloud } from "lucide-react";
import { useTranslation } from "@/i18n";

export const DrivePage = () => {
  const { t } = useTranslation();
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t("drive.title")}</h1>
        <p className="text-muted-foreground">{t("drive.subtitle")}</p>
      </div>
      <div className="bg-card border border-border rounded-xl p-12 text-center">
        <Cloud className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">{t("drive.inDevelopment")}</p>
      </div>
    </div>
  );
};

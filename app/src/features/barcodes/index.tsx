import { useTranslation } from "@/i18n";
import { PageHeader } from "@/components/layout/PageHeader";

export const BarcodesPage = () => {
  const { t } = useTranslation();
  return (
    <div className="container mx-auto py-4">
      <PageHeader title={t("nav.barcode")} subtitle={t("barcodes.subtitle")} />
    </div>
  );
};

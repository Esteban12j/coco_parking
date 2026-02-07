import { useTranslation } from "@/i18n";
import { useNavigate } from "react-router-dom";
import { useFirstRunStatus } from "@/hooks/useFirstRunStatus";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function FirstRunPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setCompleted, setCompletedIsPending } = useFirstRunStatus();

  const handleContinue = async () => {
    await setCompleted();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("firstRun.title")}</CardTitle>
          <CardDescription>{t("firstRun.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full"
            onClick={handleContinue}
            disabled={setCompletedIsPending}
          >
            {setCompletedIsPending ? t("common.loading") : t("firstRun.continueToLogin")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

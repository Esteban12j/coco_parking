import { useState } from "react";
import { useTranslation } from "@/i18n";
import { useNavigate } from "react-router-dom";
import { useFirstRunStatus } from "@/hooks/useFirstRunStatus";
import { useSession } from "@/hooks/useSession";
import * as apiFirstRun from "@/api/firstRun";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

export function FirstRunPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setCompleted, setCompletedIsPending } = useFirstRunStatus();
  const { logout } = useSession();
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitPending, setSubmitPending] = useState(false);
  const [success, setSuccess] = useState(false);

  const isPending = submitPending || setCompletedIsPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (newPassword !== confirmPassword) {
      setFormError(t("firstRun.passwordsDoNotMatch"));
      return;
    }
    if (newPassword.length < 4) {
      setFormError(t("firstRun.passwordMinLength"));
      return;
    }
    setSubmitPending(true);
    try {
      await apiFirstRun.changeAdminPassword(currentPassword, newPassword);
      await setCompleted();
      await logout();
      setSuccess(true);
      toast({ title: t("firstRun.passwordChanged") });
      navigate("/login", { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isWrongCurrentPassword =
        message === "Invalid current password" ||
        message.toLowerCase().includes("invalid current password");
      const displayMessage = isWrongCurrentPassword
        ? t("firstRun.currentPasswordIncorrect")
        : message;
      setFormError(displayMessage);
      if (isWrongCurrentPassword) {
        setCurrentPassword("");
      }
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: displayMessage,
      });
    } finally {
      setSubmitPending(false);
    }
  };

  const goToLogin = () => navigate("/login", { replace: true });

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t("firstRun.title")}</CardTitle>
            <CardDescription>{t("firstRun.passwordChanged")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={goToLogin} className="w-full">
              {t("firstRun.continueToLogin")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("firstRun.title")}</CardTitle>
          <CardDescription>{t("firstRun.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <AlertDescription>{t("firstRun.accountContext")}</AlertDescription>
          </Alert>
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="current-password">{t("firstRun.currentPassword")}</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t("firstRun.currentPasswordPlaceholder")}
                required
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">{t("firstRun.newPassword")}</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t("firstRun.newPasswordPlaceholder")}
                required
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">{t("firstRun.confirmPassword")}</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t("firstRun.confirmPasswordPlaceholder")}
                required
                disabled={isPending}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? t("common.loading") : t("firstRun.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

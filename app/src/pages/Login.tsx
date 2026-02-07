import { useState } from "react";
import { useTranslation } from "@/i18n";
import { useNavigate } from "react-router-dom";
import { useSession } from "@/hooks/useSession";
import { useFirstRunStatus } from "@/hooks/useFirstRunStatus";
import * as apiFirstRun from "@/api/firstRun";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export const LoginPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { login, loginError, loginIsPending, refetchSession } = useSession();
  const { refetch: refetchFirstRun } = useFirstRunStatus();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState("");
  const [resetDevPassword, setResetDevPassword] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetPending, setResetPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(username.trim(), password);
      setPassword("");
      await refetchSession();
      const { data: firstRunData } = await refetchFirstRun();
      if (firstRunData?.completed === false) {
        navigate("/first-run", { replace: true });
      }
    } catch {
      setPassword("");
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    if (!resetTargetUser.trim()) {
      setResetError(t("auth.resetPasswordTargetUserRequired"));
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setResetError(t("firstRun.passwordsDoNotMatch"));
      return;
    }
    if (resetNewPassword.length < 4) {
      setResetError(t("firstRun.passwordMinLength"));
      return;
    }
    setResetPending(true);
    try {
      await apiFirstRun.resetPasswordWithDev(
        resetDevPassword,
        resetTargetUser,
        resetNewPassword
      );
      toast({ title: t("auth.resetPasswordSuccess") });
      setResetOpen(false);
      setResetTargetUser("");
      setResetDevPassword("");
      setResetNewPassword("");
      setResetConfirmPassword("");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isWrongDevPassword =
        message === "Invalid developer password" ||
        message.toLowerCase().includes("invalid developer password");
      setResetError(
        isWrongDevPassword ? t("auth.resetPasswordDevPasswordIncorrect") : message
      );
      if (isWrongDevPassword) {
        setResetDevPassword("");
      }
    } finally {
      setResetPending(false);
    }
  };

  const errorMessage =
    loginError instanceof Error ? loginError.message : typeof loginError === "string" ? loginError : null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t("auth.title")}</CardTitle>
          <CardDescription>{t("auth.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMessage && (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="username">{t("auth.username")}</Label>
              <Input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t("auth.usernamePlaceholder")}
                required
                disabled={loginIsPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("auth.passwordPlaceholder")}
                required
                disabled={loginIsPending}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loginIsPending}>
              {loginIsPending ? t("common.loading") : t("auth.signIn")}
            </Button>
            <Dialog open={resetOpen} onOpenChange={setResetOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="link" className="w-full text-muted-foreground">
                  {t("auth.resetPassword")}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{t("auth.resetPasswordTitle")}</DialogTitle>
                  <DialogDescription>{t("auth.resetPasswordDescription")}</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleResetSubmit} className="space-y-4">
                  {resetError && (
                    <Alert variant="destructive">
                      <AlertDescription>{resetError}</AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="reset-target-user">{t("auth.resetPasswordTargetUser")}</Label>
                    <Input
                      id="reset-target-user"
                      type="text"
                      autoComplete="username"
                      value={resetTargetUser}
                      onChange={(e) => setResetTargetUser(e.target.value)}
                      placeholder={t("auth.resetPasswordTargetUserPlaceholder")}
                      required
                      disabled={resetPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reset-dev-password">{t("auth.resetPasswordDevPassword")}</Label>
                    <Input
                      id="reset-dev-password"
                      type="password"
                      autoComplete="off"
                      value={resetDevPassword}
                      onChange={(e) => setResetDevPassword(e.target.value)}
                      placeholder={t("auth.resetPasswordDevPasswordPlaceholder")}
                      required
                      disabled={resetPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reset-new-password">{t("auth.resetPasswordNewPasswordLabel")}</Label>
                    <Input
                      id="reset-new-password"
                      type="password"
                      autoComplete="new-password"
                      value={resetNewPassword}
                      onChange={(e) => setResetNewPassword(e.target.value)}
                      placeholder={t("auth.resetPasswordNewPasswordPlaceholder")}
                      required
                      disabled={resetPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reset-confirm-password">{t("auth.resetPasswordConfirm")}</Label>
                    <Input
                      id="reset-confirm-password"
                      type="password"
                      autoComplete="new-password"
                      value={resetConfirmPassword}
                      onChange={(e) => setResetConfirmPassword(e.target.value)}
                      placeholder={t("auth.resetPasswordConfirmPlaceholder")}
                      required
                      disabled={resetPending}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={resetPending}>
                    {resetPending ? t("common.loading") : t("auth.resetPasswordSubmit")}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

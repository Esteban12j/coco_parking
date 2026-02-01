import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Terminal, User, Play, AlertTriangle, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";

export const DevConsolePage = () => {
  const { t } = useTranslation();
  const [currentUser, setCurrentUser] = useState<string>("—");
  const [commands, setCommands] = useState<string[]>([]);
  const [selectedCommand, setSelectedCommand] = useState<string>("");
  const [argsJson, setArgsJson] = useState<string>("{}");
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [setUserInput, setSetUserInput] = useState<string>("");
  const [dbPath, setDbPath] = useState<string>("");

  const loadCurrentUser = async () => {
    try {
      const user = await invoke<string>("dev_get_current_user_id");
      setCurrentUser(user);
    } catch (e) {
      setCurrentUser("(error)");
    }
  };

  const loadCommands = async () => {
    try {
      const list = await invoke<string[]>("dev_list_commands");
      setCommands(list);
      if (list.length && !selectedCommand) setSelectedCommand(list[0]);
    } catch (e) {
      toast({
        title: t("devConsole.devModeNotAvailable"),
        description: t("devConsole.devModeNotAvailableDesc"),
        variant: "destructive",
      });
      setCommands([]);
    }
  };

  const loadDbPath = async () => {
    try {
      const path = await invoke<string>("dev_get_db_path");
      setDbPath(path);
    } catch {
      setDbPath("");
    }
  };

  useEffect(() => {
    loadCurrentUser();
    loadCommands();
    loadDbPath();
  }, []);

  const handleLoginAsDeveloper = async () => {
    setLoading(true);
    try {
      const msg = await invoke<string>("dev_login_as_developer");
      toast({ title: "Dev login", description: msg });
      await loadCurrentUser();
    } catch (e) {
      toast({
        title: t("common.error"),
        description: String(e),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRunCommand = async () => {
    if (!selectedCommand) return;
    setLoading(true);
    setResult("");
    try {
      let args: Record<string, unknown> = {};
      try {
        if (argsJson.trim()) {
          args = JSON.parse(argsJson) as Record<string, unknown>;
        }
      } catch {
        toast({
          title: t("devConsole.invalidJson"),
          description: t("devConsole.invalidJsonDesc"),
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      const res = await invoke(selectedCommand, args);
      setResult(typeof res === "string" ? res : JSON.stringify(res, null, 2));
    } catch (e) {
      toast({
        title: t("devConsole.commandFailed"),
        description: String(e),
        variant: "destructive",
      });
      setResult(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleSetUser = async () => {
    if (!setUserInput.trim()) return;
    setLoading(true);
    try {
      await invoke("dev_set_current_user", { userId: setUserInput.trim() });
      toast({ title: t("devConsole.userChanged"), description: setUserInput });
      await loadCurrentUser();
    } catch (e) {
      toast({
        title: t("common.error"),
        description: String(e),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Terminal className="h-7 w-7" />
          {t("devConsole.title")}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t("devConsole.subtitle")}
        </p>
      </div>

      <div className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <User className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">{t("devConsole.currentUser")}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm">{currentUser}</span>
            <Button size="sm" variant="outline" onClick={handleLoginAsDeveloper} disabled={loading}>
              {t("devConsole.logInAsDeveloper")}
            </Button>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Input
              placeholder={t("devConsole.userIdPlaceholder")}
              value={setUserInput}
              onChange={(e) => setSetUserInput(e.target.value)}
              className="max-w-xs"
            />
            <Button size="sm" variant="secondary" onClick={handleSetUser} disabled={loading}>
              {t("devConsole.setUser")}
            </Button>
          </div>
        </div>

        {dbPath && (
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-xs font-medium text-muted-foreground mb-1">Database (single source)</div>
            <code className="text-sm break-all">{dbPath}</code>
          </div>
        )}

        <div className="rounded-lg border border-amber-500/50 bg-amber-500/5 p-4 flex gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">{t("devConsole.devModeWarning")}</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="font-semibold flex items-center gap-2 mb-4">
            <UserCog className="h-5 w-5" />
            {t("devConsole.commandLabel")}
          </h2>
          <div className="space-y-4">
            <div>
              <Label>{t("devConsole.selectCommand")}</Label>
              <Select value={selectedCommand} onValueChange={setSelectedCommand}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={t("devConsole.selectCommand")} />
                </SelectTrigger>
                <SelectContent>
                  {commands.map((cmd) => (
                    <SelectItem key={cmd} value={cmd}>
                      {cmd}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("devConsole.argumentsLabel")}</Label>
              <Textarea
                value={argsJson}
                onChange={(e) => setArgsJson(e.target.value)}
                placeholder="{}"
                className="font-mono text-sm mt-1 min-h-[80px]"
              />
            </div>
            <Button onClick={handleRunCommand} disabled={loading || !selectedCommand}>
              <Play className="h-4 w-4 mr-2" />
              {t("common.run")}
            </Button>
            {result !== "" && (
              <div className="mt-4">
                <Label>{t("devConsole.result")}</Label>
                <pre className="mt-1 p-4 rounded-lg bg-muted text-sm overflow-auto max-h-96 font-mono whitespace-pre-wrap break-words">
                  {result}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

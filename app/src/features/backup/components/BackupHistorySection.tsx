import { useQuery } from "@tanstack/react-query";
import { listBackups } from "@/api/backup";
import { History } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useMyPermissions } from "@/hooks/useMyPermissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const BACKUP_LIST_QUERY_KEY = ["backup", "list"];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface BackupHistorySectionProps {
  embedded?: boolean;
}

export function BackupHistorySection({ embedded = false }: BackupHistorySectionProps) {
  const { t } = useTranslation();
  const { hasPermission } = useMyPermissions();
  const canList = hasPermission("backup:list:read");

  const listQuery = useQuery({
    queryKey: BACKUP_LIST_QUERY_KEY,
    queryFn: listBackups,
    enabled: canList,
  });

  if (!canList) return null;

  const backups = listQuery.data ?? [];
  const isLoading = listQuery.isLoading;

  const content = (
    <>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">...</p>
      ) : backups.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("backup.historyEmpty")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("backup.historyDate")}</TableHead>
              <TableHead>{t("backup.historySize")}</TableHead>
              <TableHead className="max-w-[200px] truncate">{t("backup.historyPath")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {backups.map((entry) => (
              <TableRow key={entry.path}>
                <TableCell className="whitespace-nowrap">{entry.createdAt}</TableCell>
                <TableCell className="whitespace-nowrap">{formatBytes(entry.sizeBytes)}</TableCell>
                <TableCell className="max-w-[200px] truncate font-mono text-xs" title={entry.path}>
                  {entry.path}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );

  if (embedded) return content;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-muted-foreground" />
          <CardTitle>{t("backup.historyTitle")}</CardTitle>
        </div>
        <CardDescription>{t("backup.historyDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
}

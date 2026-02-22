import { useState, useMemo } from "react";
import { ChevronDown, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  getObservationGroupsForVehicle,
  ADMINISTRATIVE_OBSERVATIONS,
  type ObservationGroup,
} from "@/lib/observationOptions";
import type { VehicleType } from "@/types/parking";
import { useTranslation } from "@/i18n";

interface ObservationTagsProps {
  vehicleType: VehicleType;
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
}

export const ObservationTags = ({
  vehicleType,
  selectedTags,
  onToggleTag,
}: ObservationTagsProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const groups = useMemo(
    () => getObservationGroupsForVehicle(vehicleType),
    [vehicleType]
  );

  const filteredGroups = useMemo(() => {
    if (!filter.trim()) return { groups, admin: ADMINISTRATIVE_OBSERVATIONS };
    const q = filter.trim().toLowerCase();
    const filterGroup = (g: ObservationGroup) => ({
      ...g,
      items: g.items.filter((item) => item.toLowerCase().includes(q)),
    });
    return {
      groups: groups.map(filterGroup).filter((g) => g.items.length > 0),
      admin: ADMINISTRATIVE_OBSERVATIONS.filter((s) =>
        s.toLowerCase().includes(q)
      ),
    };
  }, [groups, filter]);

  const handleSelect = (item: string) => {
    onToggleTag(item);
  };

  const hasOptions =
    filteredGroups.groups.some((g) => g.items.length > 0) ||
    filteredGroups.admin.length > 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {selectedTags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary border border-primary/20"
          >
            {tag}
            <button
              type="button"
              onClick={() => onToggleTag(tag)}
              className="rounded p-0.5 hover:bg-primary/20 focus:outline-none focus:ring-1 focus:ring-primary"
              aria-label={t("common.remove")}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full justify-between text-muted-foreground font-normal"
          >
            <span>{t("vehicles.addObservation")}</span>
            <ChevronDown className={cn("h-4 w-4 shrink-0", open && "rotate-180")} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <div className="border-b p-2">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t("vehicles.filterObservations")}
              className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div className="max-h-[280px] overflow-y-auto">
            {!hasOptions ? (
              <p className="p-3 text-sm text-muted-foreground text-center">
                {t("vehicles.noObservationsMatch")}
              </p>
            ) : (
              <>
                {filteredGroups.groups.map((group) => (
                  <div key={group.label} className="py-1">
                    <div className="sticky top-0 z-10 bg-muted/80 px-3 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur-sm">
                      {group.label}
                    </div>
                    <ul className="py-0.5">
                      {group.items.map((item) => {
                        const selected = selectedTags.includes(item);
                        return (
                          <li key={item}>
                            <button
                              type="button"
                              onClick={() => handleSelect(item)}
                              className={cn(
                                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent",
                                selected && "bg-primary/5 text-primary"
                              )}
                            >
                              <span
                                className={cn(
                                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                                  selected
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-muted-foreground/30"
                                )}
                              >
                                {selected ? <Check className="h-2.5 w-2.5" /> : null}
                              </span>
                              {item}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
                {filteredGroups.admin.length > 0 && (
                  <div className="border-t py-1">
                    <div className="sticky top-0 z-10 bg-muted/80 px-3 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur-sm">
                      {t("vehicles.observationsAdministrative")}
                    </div>
                    <ul className="py-0.5">
                      {filteredGroups.admin.map((item) => {
                        const selected = selectedTags.includes(item);
                        return (
                          <li key={item}>
                            <button
                              type="button"
                              onClick={() => handleSelect(item)}
                              className={cn(
                                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent",
                                selected && "bg-primary/5 text-primary"
                              )}
                            >
                              <span
                                className={cn(
                                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                                  selected
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-muted-foreground/30"
                                )}
                              >
                                {selected ? <Check className="h-2.5 w-2.5" /> : null}
                              </span>
                              {item}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

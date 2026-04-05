import type { ComponentType } from "react";
import { ArchiveIcon, ArrowLeftIcon, Settings2Icon } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "../ui/sidebar";
import { useTranslation } from "../../i18n";

export type SettingsSectionPath = "/settings/general" | "/settings/archived";

export const SETTINGS_NAV_ITEMS: ReadonlyArray<{
  labelKey: "general" | "archived";
  to: SettingsSectionPath;
  icon: ComponentType<{ className?: string }>;
}> = [
  { labelKey: "general", to: "/settings/general", icon: Settings2Icon },
  { labelKey: "archived", to: "/settings/archived", icon: ArchiveIcon },
];

export function SettingsSidebarNav({ pathname }: { pathname: string }) {
  const navigate = useNavigate();
  const { copy } = useTranslation();

  return (
    <>
      <SidebarContent className="overflow-x-hidden">
        <SidebarGroup className="px-2 py-3">
          <SidebarMenu>
            {SETTINGS_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.to;
              const label =
                item.labelKey === "general" ? copy.settingsNav.general : copy.settingsNav.archived;
              return (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    size="sm"
                    isActive={isActive}
                    className={
                      isActive
                        ? "gap-2 px-2 py-2 text-left text-xs text-foreground"
                        : "gap-2 px-2 py-2 text-left text-xs text-muted-foreground hover:text-foreground/80"
                    }
                    onClick={() => void navigate({ to: item.to, replace: true })}
                  >
                    <Icon
                      className={
                        isActive
                          ? "size-4 shrink-0 text-foreground"
                          : "size-4 shrink-0 text-muted-foreground"
                      }
                    />
                    <span className="truncate">{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />
      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="sm"
              className="gap-2 px-2 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={() => window.history.back()}
            >
              <ArrowLeftIcon className="size-4" />
              <span>{copy.common.back}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}

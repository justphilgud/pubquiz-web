import type { AppLocale } from "./locale";
import { deRoleMessages } from "./messages/de/roles";
import { enRoleMessages } from "./messages/en/roles";
import type { WidenMessageCatalog } from "./messageTypes";

export type RoleMessages = WidenMessageCatalog<typeof deRoleMessages>;

export function loadRoleMessages(locale: AppLocale): RoleMessages {
  return locale === "en" ? enRoleMessages : deRoleMessages;
}

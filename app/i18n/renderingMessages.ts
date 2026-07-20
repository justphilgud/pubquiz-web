import type { AppLocale } from "./locale";
import { deRenderingMessages } from "./messages/de/rendering";
import { enRenderingMessages } from "./messages/en/rendering";
import type { WidenMessageCatalog } from "./messageTypes";

export type RenderingMessages = WidenMessageCatalog<
  typeof deRenderingMessages
>;

export function loadRenderingMessages(locale: AppLocale): RenderingMessages {
  return locale === "en" ? enRenderingMessages : deRenderingMessages;
}

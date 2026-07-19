import type { MessageParams } from "./messageTypes";

export function formatMessage(
  template: string,
  params: MessageParams = {},
): string {
  return template.replace(
    /\{([a-zA-Z0-9_]+)\}/g,
    (placeholder, key: string) =>
      key in params ? String(params[key]) : placeholder,
  );
}

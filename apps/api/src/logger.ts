export type LogLevel = "info" | "warn" | "error";

export function logEvent(level: LogLevel, event: string, fields: Record<string, string | number | boolean | undefined> = {}) {
  const record = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)),
  };
  const line = JSON.stringify(record);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

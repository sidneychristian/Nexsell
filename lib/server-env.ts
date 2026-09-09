export function getServerEnv(name: string) {
  const nodeValue = typeof process !== "undefined" ? process.env[name] : undefined;
  return nodeValue?.trim() || undefined;
}

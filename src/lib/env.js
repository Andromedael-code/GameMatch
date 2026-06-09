export function readRequiredEnv(name) {
  const value = String(import.meta.env[name] || "").trim();

  if (!value) {
    throw new Error(`Variavel de ambiente ausente: ${name}`);
  }

  return value;
}

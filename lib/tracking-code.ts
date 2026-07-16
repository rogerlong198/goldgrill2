// Código de rastreio no formato dos Correios (XX#########BR) — determinístico
// pelo pedido, então o mesmo pedido sempre gera o mesmo código. O simulador de
// rastreio da loja (tracking-simulator) detecta esse formato como "Correios".
const PREFIXES = ["PB", "OB", "LB", "JT", "NM", "QB"];

export function generateTrackingCode(seed: string): string {
  let h = 0;
  for (const ch of seed || "x") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const prefix = PREFIXES[h % PREFIXES.length];
  const digits = String(h % 1_000_000_000).padStart(9, "0");
  return `${prefix}${digits}BR`;
}

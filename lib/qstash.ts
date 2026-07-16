// Agendamento de chamadas com atraso via QStash (Upstash). Usado pra disparar o
// e-mail de pedido pendente X minutos depois da criação do PIX, mesmo que o
// cliente feche a aba. Sem QSTASH_TOKEN configurado, vira no-op seguro.
import { createHmac } from "crypto";

const QSTASH_TOKEN = process.env.QSTASH_TOKEN;
// Base do QStash. Varia por região (ex.: https://qstash-us-east-1.upstash.io).
const QSTASH_BASE = (process.env.QSTASH_URL || "https://qstash.upstash.io").replace(/\/$/, "");

export function qstashConfigured(): boolean {
  return Boolean(QSTASH_TOKEN);
}

// Assinatura do callback (não expõe chave crua na URL do QStash).
function callbackSecret() {
  return (
    process.env.ABANDONED_SECRET ||
    process.env.CHECKOUT_SESSION_SECRET ||
    process.env.PAGOUAI_SECRET_KEY ||
    "dev-abandoned-secret"
  );
}
export function abandonedSig(txid: string): string {
  return createHmac("sha256", callbackSecret()).update(txid).digest("hex").slice(0, 32);
}

// Agenda um POST para `destinationUrl` daqui a `delaySeconds` segundos.
export async function scheduleDelayedCall(destinationUrl: string, delaySeconds: number): Promise<void> {
  if (!QSTASH_TOKEN) return;
  const res = await fetch(`${QSTASH_BASE}/v2/publish/${destinationUrl}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${QSTASH_TOKEN}`,
      "content-type": "application/json",
      "upstash-delay": `${delaySeconds}s`,
    },
    body: JSON.stringify({ scheduled: true }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`QStash erro ${res.status}: ${await res.text()}`);
  }
}

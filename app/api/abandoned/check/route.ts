import { NextResponse } from "next/server";
import { getOrder } from "@/lib/order-store";
import { isOrderPaid } from "@/lib/orders";
import { kvConfigured, kvSetNx } from "@/lib/kv-store";
import { sendAbandonedCartEmail, validateOrderInput } from "@/lib/send-order-email";
import { abandonedSig } from "@/lib/qstash";

export const dynamic = "force-dynamic";

// Chamado pelo QStash ~15 min após a criação do PIX. Se o pedido NÃO foi pago,
// dispara o e-mail de pedido pendente — uma única vez (trava NX no KV).
async function handle(request: Request) {
  const url = new URL(request.url);
  const txid = url.searchParams.get("txid")?.trim();
  if (!txid) return NextResponse.json({ ok: true, handled: false, reason: "sem-txid" });

  // Assinatura: o link foi gerado pelo pix/create com o sig correto do txid.
  const sig = url.searchParams.get("sig") || "";
  if (sig !== abandonedSig(txid)) {
    return NextResponse.json({ ok: false, error: "assinatura inválida" }, { status: 401 });
  }

  if (!kvConfigured()) return NextResponse.json({ ok: true, handled: false, reason: "sem-kv" });

  try {
    if (await isOrderPaid(txid)) {
      return NextResponse.json({ ok: true, handled: false, reason: "ja-pago" });
    }

    const order = await getOrder(txid);
    if (!order) return NextResponse.json({ ok: true, handled: false, reason: "sem-snapshot" });
    if (validateOrderInput(order)) {
      return NextResponse.json({ ok: true, handled: false, reason: "snapshot-invalido" });
    }

    // Trava: nunca manda 2x (TTL 48h).
    const won = await kvSetNx(`abandon:sent:${txid}`, "1", 60 * 60 * 48);
    if (!won) return NextResponse.json({ ok: true, handled: false, reason: "ja-enviado" });

    const result = await sendAbandonedCartEmail(order);
    if (!result.ok) console.error(`[ABANDONED CHECK] Falha ao enviar (${txid}):`, result.error);
    return NextResponse.json({ ok: true, handled: result.ok });
  } catch (e) {
    console.error("[ABANDONED CHECK] Erro inesperado:", e);
    return NextResponse.json({ ok: true, handled: false, reason: "erro" });
  }
}

export async function POST(request: Request) {
  return handle(request);
}
export async function GET(request: Request) {
  return handle(request);
}

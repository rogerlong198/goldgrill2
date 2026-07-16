import { NextResponse } from "next/server";
import { getOrder } from "@/lib/order-store";
import { isOrderPaid } from "@/lib/orders";
import { kvConfigured, kvSetNx } from "@/lib/kv-store";
import { sendShippedEmail, validateOrderInput } from "@/lib/send-order-email";
import { abandonedSig } from "@/lib/qstash";
import { generateTrackingCode } from "@/lib/tracking-code";

export const dynamic = "force-dynamic";

// Chamado pelo QStash ~1h após o pagamento ser confirmado. Envia o e-mail de
// "pedido postado" com o código de rastreio — uma única vez (trava NX).
async function handle(request: Request) {
  const url = new URL(request.url);
  const txid = url.searchParams.get("txid")?.trim();
  if (!txid) return NextResponse.json({ ok: true, handled: false, reason: "sem-txid" });

  const sig = url.searchParams.get("sig") || "";
  if (sig !== abandonedSig(txid)) {
    return NextResponse.json({ ok: false, error: "assinatura inválida" }, { status: 401 });
  }
  if (!kvConfigured()) return NextResponse.json({ ok: true, handled: false, reason: "sem-kv" });

  try {
    // Só notifica postagem de pedido REALMENTE pago.
    if (!(await isOrderPaid(txid))) {
      return NextResponse.json({ ok: true, handled: false, reason: "nao-pago" });
    }

    const order = await getOrder(txid);
    if (!order) return NextResponse.json({ ok: true, handled: false, reason: "sem-snapshot" });
    if (validateOrderInput(order)) {
      return NextResponse.json({ ok: true, handled: false, reason: "snapshot-invalido" });
    }

    // Trava: nunca manda 2x.
    const won = await kvSetNx(`shipped:sent:${txid}`, "1", 60 * 60 * 24 * 7);
    if (!won) return NextResponse.json({ ok: true, handled: false, reason: "ja-enviado" });

    const trackingCode = generateTrackingCode(order.orderCode || txid);
    const result = await sendShippedEmail(order, trackingCode);
    if (!result.ok) console.error(`[SHIPPED NOTIFY] Falha ao enviar (${txid}):`, result.error);
    return NextResponse.json({ ok: true, handled: result.ok, trackingCode });
  } catch (e) {
    console.error("[SHIPPED NOTIFY] Erro inesperado:", e);
    return NextResponse.json({ ok: true, handled: false, reason: "erro" });
  }
}

export async function POST(request: Request) {
  return handle(request);
}
export async function GET(request: Request) {
  return handle(request);
}

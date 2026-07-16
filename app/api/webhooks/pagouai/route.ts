import { NextResponse } from "next/server"

import { recordPaymentStatus, isGatewayPaidStatus } from "@/lib/payment-status"
import { getOrder } from "@/lib/order-store"
import { dispatchOrderEmailOnce } from "@/lib/send-order-email"
import { markOrderPaid } from "@/lib/orders"
import { scheduleShippedNotify } from "@/lib/qstash"

export const dynamic = "force-dynamic"

function getPayloadValue(payload: any, keys: string[]) {
  for (const key of keys) {
    const value = key.split(".").reduce((current, part) => current?.[part], payload)
    if (value !== undefined && value !== null && value !== "") return value
  }

  return null
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "pagouai-webhook",
  })
}

export async function POST(request: Request) {
  // Se a loja usa o relay (RELAY_SECRET definido), só aceita webhooks que
  // passaram por ele — o relay envia o header x-relay-secret. Opt-in: sem a env,
  // o webhook aceita como antes (não derruba o fluxo até o relay estar no ar).
  const relaySecret = process.env.RELAY_SECRET?.trim()
  if (relaySecret && request.headers.get("x-relay-secret") !== relaySecret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  const rawBody = await request.text()
  let payload: any = {}

  try {
    payload = rawBody ? JSON.parse(rawBody) : {}
  } catch {
    return NextResponse.json({ ok: false, error: "JSON invalido." }, { status: 400 })
  }

  const event =
    getPayloadValue(payload, ["event", "type", "action", "name"]) ??
    "transaction.updated"
  const transactionId = getPayloadValue(payload, [
    "transactionId",
    "data.transactionId",
    "data.id",
    "transaction.transactionId",
    "transaction.id",
    "id",
  ])
  const status = getPayloadValue(payload, [
    "status",
    "event_type",
    "data.status",
    "data.event_type",
    "transaction.status",
  ]) ?? (String(event).toLowerCase().includes("paid") ? "paid" : null)
  const paymentMethod = getPayloadValue(payload, [
    "paymentMethod",
    "data.paymentMethod",
    "transaction.paymentMethod",
  ])

  console.log("[PAGOUAI WEBHOOK]", {
    event,
    transactionId,
    status,
    paymentMethod,
    receivedAt: new Date().toISOString(),
  })

  if (transactionId && status) {
    const txid = String(transactionId)

    await recordPaymentStatus({
      event: String(event),
      transactionId: txid,
      status: String(status),
      paymentMethod: paymentMethod ? String(paymentMethod) : null,
      updatedAt: new Date().toISOString(),
    })

    // Pagamento confirmado: dispara o e-mail de confirmação no servidor, sem
    // depender de o cliente estar com a aba aberta. O pedido foi persistido no
    // KV quando o PIX foi criado. A trava de idempotência impede duplicidade
    // caso o front também dispare o e-mail.
    if (isGatewayPaidStatus(status)) {
      // Marca o pedido como pago pro painel /admin (best-effort, não interfere no e-mail).
      try {
        await markOrderPaid(txid)
      } catch (err) {
        console.error("[PAGOUAI WEBHOOK] erro ao marcar pago no painel:", err)
      }

      try {
        const order = await getOrder(txid)
        if (order) {
          const result = await dispatchOrderEmailOnce(txid, order)
          console.log("[PAGOUAI WEBHOOK] e-mail:", {
            txid,
            outcome: result.ok
              ? result.deduped
                ? "ja-enviado"
                : `enviado:${result.id ?? ""}`
              : `falha:${result.error}`,
          })
        } else {
          console.warn(
            "[PAGOUAI WEBHOOK] pedido nao encontrado no KV para txid",
            txid,
            "- e-mail nao disparado pelo webhook (verifique se o KV esta provisionado).",
          )
        }
      } catch (err) {
        // Best-effort: nunca derruba o webhook por causa do e-mail.
        console.error("[PAGOUAI WEBHOOK] erro ao despachar e-mail:", err)
      }
      // Agenda o e-mail de "pedido postado" pra ~1h depois.
      await scheduleShippedNotify(txid)
    }
  }

  return NextResponse.json({
    ok: true,
    received: true,
  })
}

import { NextResponse } from "next/server"

import { recordPaymentStatus } from "@/lib/payment-status"
import { getOrder } from "@/lib/order-store"
import { dispatchOrderEmailOnce } from "@/lib/send-order-email"
import { markOrderPaid } from "@/lib/orders"
import { scheduleShippedNotify } from "@/lib/qstash"
import { getStatusCenturion } from "@/lib/gateways/centurion"

export const dynamic = "force-dynamic"

// SEM relay: a CenturionPay bate direto aqui (postbackUrl = este endpoint).
// A doc NÃO documenta o schema do postback (página placeholder), então lemos o
// id de vários caminhos prováveis e confirmamos o pagamento via GET status.
function extractId(body: any): string | null {
  const d = body?.data ?? body?.transaction ?? body ?? {}
  const id = d?.id ?? d?.transactionId ?? body?.transactionId ?? body?.objectId ?? body?.id ?? null
  return id != null ? String(id) : null
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "centurion-webhook" })
}

export async function POST(request: Request) {
  // Sem relay: a CenturionPay bate DIRETO aqui (o relay é exclusivo da Pagou.ai).
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: true }) // ack mesmo sem corpo válido
  }

  const txid = extractId(body)
  if (!txid) {
    return NextResponse.json({ ok: true, handled: false, reason: "sem-id" })
  }

  // NÃO confiamos no corpo (sem assinatura). Confirmamos consultando a própria
  // API da Centurion antes de liberar qualquer coisa.
  const st = await getStatusCenturion(txid)
  if (!st.ok || !st.paid) {
    return NextResponse.json({ ok: true, handled: false, reason: "nao-pago" })
  }

  // Grava o status pro polling do front refletir (mesma via do webhook Pagou).
  await recordPaymentStatus({
    event: "centurion.webhook",
    transactionId: txid,
    status: "paid",
    paymentMethod: "pix",
    updatedAt: new Date().toISOString(),
  }).catch(() => {})

  try {
    await markOrderPaid(txid)
  } catch (err) {
    console.error("[CENTURION WEBHOOK] erro ao marcar pago no painel:", err)
  }

  try {
    const order = await getOrder(txid)
    if (order) {
      const result = await dispatchOrderEmailOnce(txid, order)
      console.log("[CENTURION WEBHOOK] e-mail:", {
        txid,
        outcome: result.ok ? (result.deduped ? "ja-enviado" : `enviado:${result.id ?? ""}`) : `falha:${result.error}`,
      })
    } else {
      console.warn("[CENTURION WEBHOOK] pedido nao encontrado no KV para txid", txid)
    }
  } catch (err) {
    console.error("[CENTURION WEBHOOK] erro ao despachar e-mail:", err)
  }

  // Agenda o e-mail de "pedido postado" pra ~1h depois.
  await scheduleShippedNotify(txid)

  return NextResponse.json({ ok: true, handled: true })
}

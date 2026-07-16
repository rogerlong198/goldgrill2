import { NextResponse } from "next/server"

import { recordPaymentStatus } from "@/lib/payment-status"
import { getOrder } from "@/lib/order-store"
import { dispatchOrderEmailOnce } from "@/lib/send-order-email"
import { markOrderPaid } from "@/lib/orders"
import { scheduleShippedNotify } from "@/lib/qstash"
import { getStatusMedusa } from "@/lib/gateways/medusa"

export const dynamic = "force-dynamic"

// SEM relay: a MedusaPay bate direto aqui (postbackUrl = este endpoint).
// O postback não tem assinatura documentada, então lemos o id de vários caminhos.
function extractId(body: any): string | null {
  const d = body?.data ?? body?.transaction ?? body ?? {}
  const id = d?.id ?? d?.transactionId ?? body?.transactionId ?? body?.objectId ?? body?.id ?? null
  return id != null ? String(id) : null
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "medusa-webhook" })
}

export async function POST(request: Request) {
  // Sem relay: a MedusaPay bate DIRETO aqui (o relay é exclusivo da Pagou.ai).
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
  // API da Medusa antes de liberar qualquer coisa.
  const st = await getStatusMedusa(txid)
  if (!st.ok || !st.paid) {
    return NextResponse.json({ ok: true, handled: false, reason: "nao-pago" })
  }

  // Grava o status pro polling do front refletir (mesma via do webhook Pagou).
  await recordPaymentStatus({
    event: "medusa.webhook",
    transactionId: txid,
    status: "paid",
    paymentMethod: "pix",
    updatedAt: new Date().toISOString(),
  }).catch(() => {})

  try {
    await markOrderPaid(txid)
  } catch (err) {
    console.error("[MEDUSA WEBHOOK] erro ao marcar pago no painel:", err)
  }

  try {
    const order = await getOrder(txid)
    if (order) {
      const result = await dispatchOrderEmailOnce(txid, order)
      console.log("[MEDUSA WEBHOOK] e-mail:", {
        txid,
        outcome: result.ok ? (result.deduped ? "ja-enviado" : `enviado:${result.id ?? ""}`) : `falha:${result.error}`,
      })
    } else {
      console.warn("[MEDUSA WEBHOOK] pedido nao encontrado no KV para txid", txid)
    }
  } catch (err) {
    console.error("[MEDUSA WEBHOOK] erro ao despachar e-mail:", err)
  }

  // Agenda o e-mail de "pedido postado" pra ~1h depois.
  await scheduleShippedNotify(txid)

  return NextResponse.json({ ok: true, handled: true })
}

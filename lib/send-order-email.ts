// Envio do e-mail de confirmação de pedido via Resend.
//
// Centralizado aqui para ser reaproveitado tanto pela rota chamada pelo front
// (/api/email/order-confirmation) quanto pelo webhook da Pagou, garantindo um
// único caminho de envio.

import { Resend } from "resend";
import { renderOrderConfirmationEmail, renderAbandonedCartEmail, renderShippedEmail, type OrderEmailInput } from "./order-email";
import { kvSetNx, kvDel } from "./kv-store";

export type SendOrderEmailResult =
  | { ok: true; id: string | null; deduped?: boolean }
  | { ok: false; error: string; status: number };

const EMAIL_LOCK_TTL_SECONDS = 60 * 60 * 48; // 48h

export function isValidEmail(value: unknown) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Retorna null se o pedido for válido, ou uma mensagem de erro caso contrário.
export function validateOrderInput(order: Partial<OrderEmailInput>): string | null {
  if (!order?.orderCode || !order?.customer || !isValidEmail(order.customer.email)) {
    return "Dados do pedido incompletos.";
  }
  if (!Array.isArray(order.items) || order.items.length === 0) {
    return "Pedido sem itens.";
  }
  if (!order.address) {
    return "Endereço ausente.";
  }
  return null;
}

export async function sendOrderEmail(order: OrderEmailInput): Promise<SendOrderEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[ORDER EMAIL] RESEND_API_KEY ausente.");
    return { ok: false, error: "Servidor de e-mail não configurado.", status: 500 };
  }

  const fromAddress = process.env.RESEND_FROM_EMAIL || "Gold Grill <suporte@goldgrill.com.br>";

  try {
    const { subject, html } = renderOrderConfirmationEmail(order);
    const resend = new Resend(apiKey);

    const result = await resend.emails.send({
      from: fromAddress,
      to: [order.customer.email],
      subject,
      html,
      replyTo: process.env.RESEND_REPLY_TO || undefined,
    });

    if (result.error) {
      console.error("[ORDER EMAIL] Resend error:", result.error);
      return { ok: false, error: result.error.message || "Falha ao enviar e-mail.", status: 502 };
    }

    return { ok: true, id: result.data?.id ?? null };
  } catch (err: any) {
    console.error("[ORDER EMAIL] Falha inesperada:", err);
    return { ok: false, error: err?.message || "Falha ao enviar e-mail.", status: 500 };
  }
}

// E-mail de PEDIDO PENDENTE (mesmo Resend, template diferente). Chamado pelo
// /api/abandoned/check quando o pagamento não caiu no prazo.
export async function sendAbandonedCartEmail(order: OrderEmailInput): Promise<SendOrderEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[ABANDONED EMAIL] RESEND_API_KEY ausente.");
    return { ok: false, error: "Servidor de e-mail não configurado.", status: 500 };
  }
  const fromAddress = process.env.RESEND_FROM_EMAIL || "Gold Grill <suporte@goldgrill.com.br>";
  try {
    const { subject, html } = renderAbandonedCartEmail(order);
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: fromAddress,
      to: [order.customer.email],
      subject,
      html,
      replyTo: process.env.RESEND_REPLY_TO || undefined,
    });
    if (result.error) {
      console.error("[ABANDONED EMAIL] Resend error:", result.error);
      return { ok: false, error: result.error.message || "Falha ao enviar.", status: 502 };
    }
    return { ok: true, id: result.data?.id ?? null };
  } catch (err: any) {
    console.error("[ABANDONED EMAIL] Falha inesperada:", err);
    return { ok: false, error: err?.message || "Falha ao enviar.", status: 500 };
  }
}

// E-mail de PEDIDO POSTADO (mesmo Resend, template com código de rastreio).
export async function sendShippedEmail(order: OrderEmailInput, trackingCode: string): Promise<SendOrderEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[SHIPPED EMAIL] RESEND_API_KEY ausente.");
    return { ok: false, error: "Servidor de e-mail não configurado.", status: 500 };
  }
  const fromAddress = process.env.RESEND_FROM_EMAIL || "Gold Grill <suporte@goldgrill.com.br>";
  try {
    const { subject, html } = renderShippedEmail(order, trackingCode);
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: fromAddress,
      to: [order.customer.email],
      subject,
      html,
      replyTo: process.env.RESEND_REPLY_TO || undefined,
    });
    if (result.error) {
      console.error("[SHIPPED EMAIL] Resend error:", result.error);
      return { ok: false, error: result.error.message || "Falha ao enviar.", status: 502 };
    }
    return { ok: true, id: result.data?.id ?? null };
  } catch (err: any) {
    console.error("[SHIPPED EMAIL] Falha inesperada:", err);
    return { ok: false, error: err?.message || "Falha ao enviar.", status: 500 };
  }
}

// Garante UM único e-mail por pedido, não importa quantos gatilhos (webhook do
// servidor + polling do front) cheguem. A trava NX no KV é o árbitro: quem a
// adquire é quem envia. Se o envio falhar, a trava é liberada para permitir
// nova tentativa num próximo gatilho.
export async function dispatchOrderEmailOnce(
  idempotencyKey: string,
  order: OrderEmailInput,
): Promise<SendOrderEmailResult> {
  const lockKey = `emailed:${idempotencyKey}`;
  const acquired = await kvSetNx(lockKey, new Date().toISOString(), EMAIL_LOCK_TTL_SECONDS);
  if (!acquired) {
    return { ok: true, id: null, deduped: true };
  }

  const result = await sendOrderEmail(order);
  if (!result.ok) {
    await kvDel(lockKey).catch(() => {});
  }
  return result;
}

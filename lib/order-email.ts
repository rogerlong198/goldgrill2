export type OrderEmailItem = {
  id: number | string;
  name: string;
  image?: string;
  price: number;
  compareAtPrice?: number;
  quantity: number;
};

export type OrderEmailAddress = {
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  stateUF: string;
};

export type OrderEmailInput = {
  orderCode: string;
  customer: {
    name: string;
    email: string;
    phone?: string;
    cpf?: string;
  };
  address: OrderEmailAddress;
  items: OrderEmailItem[];
  subtotal: number;
  shipping: number;
  // Cupom de desconto (opcional) — quando presente, aparece como linha própria
  // no bloco de totais para a conta fechar (subtotal - desconto + frete = total).
  discount?: number;
  coupon?: string;
  total: number;
  paymentMethod: "pix" | "card";
};

const BRAND_NAME = "Gold Grill";
const BRAND_TAGLINE = "Tudo para o seu churrasco";
const BRAND_TRACKING_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://goldgrill.shop";
const BRAND_LOGO_URL = `${BRAND_TRACKING_URL}/images/logo-gold-grill.png`;

// Paleta brand
const C = {
  primary: "#1a1a1a",
  dark: "#202020",
  accent: "#b98a2e", // dourado
  accentSoft: "#fff8e8",
  accentBorder: "#f1d6a4",
  green: "#14752d",
  greenSoft: "#f1fff5",
  greenBorder: "#c6edcf",
  text: "#202020",
  muted: "#777777",
  mutedSoft: "#a7a7a7",
  line: "#ececec",
  lineSoft: "#f1f1f1",
  bg: "#e7e7e7",
  card: "#ffffff",
  cardSoft: "#fafafa",
  cardSofter: "#fbfbfb",
  footerLine: "#373737",
};

const formatBRL = (value: number) =>
  `R$ ${Number(value).toFixed(2).replace(".", ",")}`;

const escapeHtml = (value: string) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export function renderOrderConfirmationEmail(order: OrderEmailInput) {
  const methodLabel = order.paymentMethod === "pix" ? "Pix" : "Cartão de Crédito";
  const firstName = (order.customer.name || "").trim().split(" ")[0] || "Cliente";

  const addressLine1 = [
    order.address.street,
    order.address.number,
    order.address.complement ? `— ${order.address.complement}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const addressLine2 = [
    order.address.neighborhood,
    `${order.address.city} — ${order.address.stateUF}`,
    `CEP ${order.address.cep}`,
  ]
    .filter(Boolean)
    .join(" · ");

  // Cliente de e-mail (Gmail, etc) NÃO resolve caminho relativo — a imagem
  // precisa de URL absoluta com o domínio da loja.
  const absoluteImg = (src?: string) =>
    src ? (src.startsWith("http") ? src : `${BRAND_TRACKING_URL}${src.startsWith("/") ? "" : "/"}${src}`) : "";

  const itemRows = order.items
    .map((item) => {
      const lineTotal = item.price * item.quantity;
      const imgCell = item.image
        ? `<td width="56" style="padding:10px 12px 10px 0;vertical-align:top;">
             <img src="${escapeHtml(absoluteImg(item.image))}" width="56" height="56" alt="" style="display:block;width:56px;height:56px;border-radius:8px;border:1px solid ${C.line};object-fit:cover;" />
           </td>`
        : `<td width="56" style="padding:10px 12px 10px 0;vertical-align:top;">
             <div style="width:56px;height:56px;border-radius:8px;border:1px solid ${C.line};background:${C.cardSoft};"></div>
           </td>`;
      return `
        <tr>
          ${imgCell}
          <td style="padding:10px 0;vertical-align:top;color:${C.text};font-size:13px;line-height:18px;">
            <strong style="display:block;color:${C.primary};font-size:13px;font-weight:700;">${escapeHtml(item.name)}</strong>
            <span style="display:inline-block;margin-top:3px;color:${C.muted};font-size:11px;">Qtd: ${item.quantity} · ${formatBRL(item.price)} un.</span>
          </td>
          <td align="right" style="padding:10px 0 10px 12px;vertical-align:top;color:${C.text};font-size:13px;font-weight:700;white-space:nowrap;">
            ${formatBRL(lineTotal)}
          </td>
        </tr>
      `;
    })
    .join("");

  const trackingHref = `${BRAND_TRACKING_URL}/rastreio-de-pedido?codigo=${encodeURIComponent(order.orderCode)}`;

  const subject = `Pedido confirmado · ${order.orderCode} · ${BRAND_NAME}`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    Seu pedido ${escapeHtml(order.orderCode)} foi confirmado no ${BRAND_NAME}.
  </div>

  <div style="max-width:600px;margin:0 auto;background:${C.card};">
    <!-- top accent bar -->
    <div style="background:${C.accent};height:5px;"></div>

    <!-- header / logo -->
    <div style="background:${C.card};padding:24px 32px 20px;text-align:center;border-bottom:1px solid ${C.lineSoft};">
      <img src="${BRAND_LOGO_URL}" alt="${BRAND_NAME}" height="80" style="display:inline-block;height:80px;width:auto;max-width:240px;border:0;outline:none;text-decoration:none;" />
      <p style="margin:4px 0 0;font-size:11px;color:${C.muted};letter-spacing:1.4px;text-transform:uppercase;">${BRAND_TAGLINE}</p>
    </div>

    <!-- intro -->
    <div style="background:${C.cardSofter};padding:22px 30px;text-align:center;border-bottom:1px solid ${C.line};">
      <h1 style="margin:0 0 7px;font-size:19px;color:${C.primary};font-weight:700;line-height:1.25;">
        Olá, ${escapeHtml(firstName)} — recebemos seu pedido <span style="color:${C.accent};">${escapeHtml(order.orderCode)}</span>.
      </h1>
      <p style="margin:0;font-size:12px;color:${C.muted};line-height:1.45;">
        O pagamento foi confirmado e o seu pedido já está em preparação. Use o código acima para acompanhar a entrega.
      </p>
    </div>

    <!-- main card -->
    <div style="padding:16px 30px;">
      <div style="background:${C.card};border-radius:15px;border:1px solid ${C.line};overflow:hidden;box-shadow:0 10px 28px rgba(0,0,0,0.08);">
        <!-- pill header -->
        <div style="background:${C.primary};padding:11px;text-align:center;">
          <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
            <tr>
              <td style="padding-right:10px;vertical-align:middle;">
                <div style="width:30px;height:30px;background:${C.green};border-radius:50%;text-align:center;line-height:30px;">
                  <span style="color:#ffffff;font-size:16px;font-weight:800;">✓</span>
                </div>
              </td>
              <td style="vertical-align:middle;">
                <span style="color:#ffffff;font-size:15px;font-weight:700;letter-spacing:0.5px;">Pagamento confirmado</span>
              </td>
            </tr>
          </table>
        </div>

        <!-- total + tracking code -->
        <div style="padding:18px 24px 16px;background:${C.cardSoft};">
          <div style="background:${C.card};border:1px solid ${C.line};border-radius:18px;padding:22px;text-align:center;box-shadow:0 8px 22px rgba(0,0,0,0.06);">
            <p style="margin:0 0 8px;font-size:10px;color:${C.muted};text-transform:uppercase;letter-spacing:1.4px;font-weight:700;">Total pago</p>
            <p style="margin:0 0 14px;font-size:28px;font-weight:800;color:${C.green};line-height:1.05;">${formatBRL(order.total)}</p>

            <div style="display:inline-block;background:${C.greenSoft};border:1px solid ${C.greenBorder};border-radius:999px;padding:7px 13px;margin:0 0 18px;">
              <p style="margin:0;font-size:10px;color:${C.green};font-weight:700;line-height:1.25;letter-spacing:0.3px;">
                ${methodLabel} aprovado
              </p>
            </div>

            <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:${C.primary};">Código do pedido</p>
            <div style="background:#f7f7f7;border:1px solid #dfdfdf;border-radius:11px;padding:0 12px;margin:0 0 14px;min-height:44px;line-height:44px;overflow:hidden;">
              <p style="margin:0;font-size:15px;font-family:'Courier New',monospace;color:${C.primary};line-height:44px;font-weight:700;letter-spacing:1.6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${escapeHtml(order.orderCode)}
              </p>
            </div>

            <a href="${escapeHtml(trackingHref)}" style="display:block;background:${C.accent};color:${C.primary};text-decoration:none;padding:0 18px;border-radius:999px;font-size:14px;font-weight:800;line-height:54px;min-height:54px;box-shadow:0 8px 18px rgba(185,138,46,0.30);letter-spacing:0.4px;text-transform:uppercase;">
              Acompanhar meu pedido
            </a>

            <p style="margin:10px 0 0;font-size:10px;color:${C.muted};line-height:1.32;">
              O link abre a página de rastreio com o seu código já preenchido.
            </p>
          </div>
        </div>

        <!-- items -->
        <div style="padding:0 24px 4px;background:${C.cardSoft};">
          <p style="margin:0 0 6px;font-size:11px;font-weight:800;color:${C.primary};letter-spacing:1.2px;text-transform:uppercase;">Itens do pedido</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.line};">
            ${itemRows}
          </table>
        </div>

        <!-- totals -->
        <div style="padding:0 24px 16px;background:${C.cardSoft};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.line};">
            <tr>
              <td style="padding:10px 0;color:${C.muted};font-size:12px;">Subtotal</td>
              <td align="right" style="padding:10px 0;color:${C.text};font-size:12px;font-weight:600;">${formatBRL(order.subtotal)}</td>
            </tr>
            ${
              order.discount && order.discount > 0
                ? `<tr>
              <td style="padding:0 0 10px;color:${C.green};font-size:12px;font-weight:700;">Cupom${order.coupon ? ` ${order.coupon}` : ""}</td>
              <td align="right" style="padding:0 0 10px;color:${C.green};font-size:12px;font-weight:700;">-${formatBRL(order.discount)}</td>
            </tr>`
                : ""
            }
            <tr>
              <td style="padding:0 0 10px;color:${C.muted};font-size:12px;">Frete</td>
              <td align="right" style="padding:0 0 10px;color:${C.text};font-size:12px;font-weight:600;">${order.shipping > 0 ? formatBRL(order.shipping) : "Grátis"}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-top:1px solid ${C.line};color:${C.primary};font-size:13px;font-weight:800;">Total pago</td>
              <td align="right" style="padding:10px 0;border-top:1px solid ${C.line};color:${C.green};font-size:15px;font-weight:800;">${formatBRL(order.total)}</td>
            </tr>
          </table>
        </div>

        <!-- shipping address -->
        <div style="padding:0 24px 16px;background:${C.cardSoft};">
          <p style="margin:0 0 6px;font-size:11px;font-weight:800;color:${C.primary};letter-spacing:1.2px;text-transform:uppercase;">Endereço de entrega</p>
          <div style="background:${C.card};border:1px solid ${C.line};border-radius:12px;padding:14px 16px;">
            <p style="margin:0;color:${C.text};font-size:13px;line-height:20px;">
              <strong style="display:block;font-weight:700;color:${C.primary};">${escapeHtml(order.customer.name)}</strong>
              ${addressLine1 ? `<span style="display:block;margin-top:3px;">${escapeHtml(addressLine1)}</span>` : ""}
              ${addressLine2 ? `<span style="display:block;color:${C.muted};font-size:12px;">${escapeHtml(addressLine2)}</span>` : ""}
              ${order.customer.phone ? `<span style="display:block;margin-top:6px;color:${C.muted};font-size:11px;">Telefone: ${escapeHtml(order.customer.phone)}</span>` : ""}
            </p>
          </div>
        </div>

        <!-- warning band -->
        <div style="padding:0 24px 22px;background:${C.cardSoft};">
          <div style="background:${C.accentSoft};border:1px solid ${C.accentBorder};border-radius:9px;padding:12px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9a5b00;line-height:1.45;">
              Em até 24 h enviamos um novo e-mail com o código de rastreio dos Correios assim que o pedido for despachado.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- secondary note -->
    <div style="padding:0 32px 24px;">
      <div style="background:#f7f7f7;border-radius:10px;padding:13px 16px;text-align:center;border:1px solid #eeeeee;">
        <p style="margin:0;font-size:11px;color:${C.muted};line-height:1.55;">
          Em caso de dúvidas, basta responder este e-mail. Nosso time de atendimento responde em horário comercial.
        </p>
      </div>
    </div>

    <!-- footer -->
    <div style="background:${C.dark};padding:28px 32px;text-align:center;">
      <div style="display:inline-block;background:#ffffff;border-radius:14px;padding:10px 16px;">
        <img src="${BRAND_LOGO_URL}" alt="${BRAND_NAME}" height="64" style="display:block;height:64px;width:auto;max-width:200px;border:0;outline:none;text-decoration:none;" />
      </div>
      <div style="width:42px;height:2px;background:${C.accent};margin:10px auto 14px;"></div>
      <p style="margin:0 0 14px;font-size:11px;color:${C.mutedSoft};line-height:1.45;">
        Churrasqueiras, facas, kits e presentes premium para quem ama a brasa.
      </p>
      <div style="border-top:1px solid ${C.footerLine};padding-top:14px;">
        <p style="margin:0;font-size:11px;color:#8a8a8a;">© ${new Date().getFullYear()} ${BRAND_NAME}. Todos os direitos reservados.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

  return { subject, html };
}

// E-mail de PEDIDO PENDENTE (o cliente gerou o PIX mas não pagou). Disparado
// pelo QStash ~15 min depois, se o pagamento não caiu. Foco: lembrar do pedido
// e trazer o cliente de volta pra finalizar.
export function renderAbandonedCartEmail(order: OrderEmailInput) {
  const firstName = (order.customer.name || "").trim().split(" ")[0] || "Cliente";
  const absoluteImg = (src?: string) =>
    src ? (src.startsWith("http") ? src : `${BRAND_TRACKING_URL}${src.startsWith("/") ? "" : "/"}${src}`) : "";

  const itemRows = order.items
    .map((item) => {
      const imgCell = item.image
        ? `<td width="52" style="padding:9px 12px 9px 0;vertical-align:top;">
             <img src="${escapeHtml(absoluteImg(item.image))}" width="52" height="52" alt="" style="display:block;width:52px;height:52px;border-radius:8px;border:1px solid ${C.line};object-fit:cover;" />
           </td>`
        : "";
      return `
        <tr>
          ${imgCell}
          <td style="padding:9px 0;vertical-align:middle;color:${C.text};font-size:13px;">
            <strong style="display:block;color:${C.primary};font-size:13px;font-weight:700;">${escapeHtml(item.name)}</strong>
            <span style="display:inline-block;margin-top:3px;color:${C.muted};font-size:11px;">Qtd: ${item.quantity} · ${formatBRL(item.price)} un.</span>
          </td>
          <td align="right" style="padding:9px 0;vertical-align:middle;color:${C.text};font-size:13px;font-weight:700;white-space:nowrap;">
            ${formatBRL(item.price * item.quantity)}
          </td>
        </tr>`;
    })
    .join("");

  const shopHref = `${BRAND_TRACKING_URL}/checkout`;
  const subject = `${firstName}, seu pedido ficou pela metade — finalize agora`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.bg};font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Seus produtos ainda estão te esperando no ${BRAND_NAME}.</div>
  <div style="max-width:600px;margin:0 auto;background:${C.card};">
    <div style="background:${C.accent};height:5px;"></div>
    <div style="background:${C.card};padding:24px 32px 20px;text-align:center;border-bottom:1px solid ${C.lineSoft};">
      <img src="${BRAND_LOGO_URL}" alt="${BRAND_NAME}" height="72" style="display:inline-block;height:72px;width:auto;max-width:220px;border:0;" />
      <p style="margin:4px 0 0;font-size:11px;color:${C.muted};letter-spacing:1.4px;text-transform:uppercase;">${BRAND_TAGLINE}</p>
    </div>

    <div style="background:${C.cardSofter};padding:26px 30px;text-align:center;border-bottom:1px solid ${C.line};">
      <p style="margin:0 0 6px;font-size:34px;line-height:1;">🔥</p>
      <h1 style="margin:0 0 8px;font-size:20px;color:${C.primary};font-weight:800;line-height:1.25;">
        ${escapeHtml(firstName)}, seu pedido ficou pela metade!
      </h1>
      <p style="margin:0;font-size:13px;color:${C.muted};line-height:1.5;">
        Você separou ótimos produtos mas o pagamento não foi concluído. Seus itens ainda estão reservados — finalize agora antes que acabe o estoque.
      </p>
    </div>

    <div style="padding:20px 30px 8px;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:800;color:${C.primary};letter-spacing:1.2px;text-transform:uppercase;">Seu pedido</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.line};">
        ${itemRows}
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.line};margin-top:4px;">
        <tr>
          <td style="padding:12px 0;color:${C.primary};font-size:14px;font-weight:800;">Total</td>
          <td align="right" style="padding:12px 0;color:${C.green};font-size:16px;font-weight:800;">${formatBRL(order.total)}</td>
        </tr>
      </table>
    </div>

    <div style="padding:8px 30px 26px;text-align:center;">
      <a href="${escapeHtml(shopHref)}" style="display:block;background:${C.accent};color:${C.primary};text-decoration:none;padding:0 18px;border-radius:999px;font-size:15px;font-weight:800;line-height:56px;min-height:56px;box-shadow:0 8px 18px rgba(185,138,46,0.30);letter-spacing:0.4px;text-transform:uppercase;">
        Finalizar meu pedido
      </a>
      <p style="margin:12px 0 0;font-size:12px;color:${C.muted};line-height:1.5;">
        Dica: use o cupom <strong style="color:${C.accent};">PRIMEIRACOMPRA</strong> e ganhe 5% de desconto ao concluir.
      </p>
    </div>

    <div style="background:${C.dark};padding:26px 32px;text-align:center;">
      <div style="display:inline-block;background:#ffffff;border-radius:14px;padding:9px 15px;">
        <img src="${BRAND_LOGO_URL}" alt="${BRAND_NAME}" height="56" style="display:block;height:56px;width:auto;max-width:180px;border:0;" />
      </div>
      <p style="margin:12px 0 0;font-size:11px;color:${C.mutedSoft};line-height:1.45;">
        Churrasqueiras, facas, kits e presentes premium para quem ama a brasa.
      </p>
      <p style="margin:10px 0 0;font-size:11px;color:#8a8a8a;">© ${new Date().getFullYear()} ${BRAND_NAME}. Todos os direitos reservados.</p>
    </div>
  </div>
</body>
</html>`;

  return { subject, html };
}

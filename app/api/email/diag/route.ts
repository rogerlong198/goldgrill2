import { NextResponse } from "next/server";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

// Diagnóstico de e-mail. GET sem dados → formulário (evita problema de senha com
// caracteres especiais na URL). POST {secret,to} → tenta enviar e devolve o
// erro EXATO do Resend (domínio não verificado, chave inválida, sandbox).

function envDiag() {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  return {
    RESEND_API_KEY: apiKey ? `presente (${apiKey.slice(0, 3)}…${apiKey.slice(-3)})` : "❌ FALTANDO",
    RESEND_FROM_EMAIL: (process.env.RESEND_FROM_EMAIL || "").trim() || "❌ FALTANDO (usa fallback)",
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "❌ FALTANDO",
    QSTASH_TOKEN: process.env.QSTASH_TOKEN ? "presente" : "❌ FALTANDO",
    KV: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL ? "presente" : "❌ FALTANDO",
  };
}

export async function GET() {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Diagnóstico de e-mail</title>
<style>body{font-family:system-ui,sans-serif;max-width:560px;margin:40px auto;padding:0 16px;color:#1a1a1a}
h1{font-size:20px}label{display:block;font-weight:600;margin:14px 0 4px;font-size:14px}
input{width:100%;padding:10px;border:1px solid #ccc;border-radius:8px;font-size:15px;box-sizing:border-box}
button{margin-top:16px;background:#eaa50c;color:#1a1a1a;font-weight:800;border:0;border-radius:999px;padding:12px 20px;font-size:15px;cursor:pointer}
pre{background:#f5f5f5;border:1px solid #e5e5e5;border-radius:8px;padding:12px;white-space:pre-wrap;word-break:break-word;font-size:13px;margin-top:16px}</style>
</head><body>
<h1>🔧 Diagnóstico de e-mail — Gold Grill</h1>
<p>Digite a senha do admin e um e-mail de teste. Vai tentar enviar e mostrar o erro exato (se houver).</p>
<label>Senha do admin</label>
<input id="secret" type="password" placeholder="ADMIN_PASSWORD" />
<label>E-mail de teste (recebe o envio)</label>
<input id="to" type="email" placeholder="seu@email.com" />
<button onclick="run()">Testar envio</button>
<pre id="out" style="display:none"></pre>
<script>
async function run(){
  const out=document.getElementById('out');out.style.display='block';out.textContent='Testando…';
  try{
    const r=await fetch('/api/email/diag',{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({secret:document.getElementById('secret').value,to:document.getElementById('to').value})});
    const j=await r.json();out.textContent=JSON.stringify(j,null,2);
  }catch(e){out.textContent='Erro: '+e.message;}
}
</script></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

export async function POST(request: Request) {
  let body: any = {};
  try {
    body = await request.json();
  } catch {}
  const secret = String(body?.secret || "");
  const to = String(body?.to || "").trim();

  const adminPw = (process.env.ADMIN_PASSWORD || "").trim();
  if (!adminPw || secret !== adminPw) {
    return NextResponse.json({ ok: false, motivo: "Senha do admin incorreta." }, { status: 401 });
  }

  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  const fromAddress = (process.env.RESEND_FROM_EMAIL || "").trim();
  const diag = envDiag();

  if (!apiKey) return NextResponse.json({ ok: false, motivo: "RESEND_API_KEY não configurada.", diag });
  if (!to) return NextResponse.json({ ok: false, motivo: "Informe um e-mail de teste.", diag });

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: fromAddress || "Gold Grill <onboarding@resend.dev>",
      to: [to],
      subject: "Teste de e-mail — Gold Grill",
      html: "<p>Se você recebeu este e-mail, o Resend está OK ✅</p>",
    });
    if (result.error) {
      return NextResponse.json({
        ok: false,
        motivo: "O Resend RECUSOU o envio. Veja o erro abaixo.",
        erro: result.error,
        dica: "Se falar 'domain not verified' ou 'testing emails', você precisa VERIFICAR o domínio goldgrill.shop no Resend (Domains → Add → SPF/DKIM no DNS).",
        diag,
      });
    }
    return NextResponse.json({ ok: true, enviado: true, id: result.data?.id, para: to, diag });
  } catch (e: any) {
    return NextResponse.json({ ok: false, motivo: "Exceção ao enviar.", erro: e?.message, diag });
  }
}

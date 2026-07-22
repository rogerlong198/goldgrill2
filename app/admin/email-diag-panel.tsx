"use client"

import { useState } from "react"
import { Mail, Loader2, CheckCircle2, XCircle } from "lucide-react"

// Diagnóstico de e-mail dentro do painel. Bate na mesma rota /api/email/diag
// (POST), mas sem pedir senha — a rota aceita o cookie de sessão do admin.
export function EmailDiagPanel() {
  const [to, setTo] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const res = await fetch("/api/email/diag", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to }),
      })
      const data = await res.json()
      setResult(data)
    } catch (e: any) {
      setError(e?.message || "Erro ao testar.")
    } finally {
      setLoading(false)
    }
  }

  const ok = result?.ok === true

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Diagnóstico de e-mail</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Envia um e-mail de teste e mostra o erro exato (se houver). Também confere as variáveis do
          Resend/KV e o gateway ativo.
        </p>

        <label className="mt-4 block text-xs font-semibold text-muted-foreground">
          E-mail de teste (recebe o envio)
          <div className="mt-1 flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && to.trim() && !loading) run()
              }}
              placeholder="seu@email.com"
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal text-foreground outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              type="button"
              onClick={run}
              disabled={loading || !to.trim()}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:brightness-110 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Testar envio
            </button>
          </div>
        </label>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div
            className={`flex items-center gap-2 rounded-xl border p-4 text-sm font-medium ${
              ok
                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700"
                : "border-destructive/30 bg-destructive/5 text-destructive"
            }`}
          >
            {ok ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
            <span>
              {ok
                ? `E-mail enviado com sucesso para ${result.para}.`
                : result.motivo || "Falha no envio."}
            </span>
          </div>

          {result?.dica && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-50 p-4 text-xs text-amber-800">
              💡 {result.dica}
            </div>
          )}

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Detalhes técnicos
            </p>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-muted p-3 text-[11px] leading-relaxed text-foreground">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, X, RefreshCw, AlertTriangle, CircleDot } from "lucide-react"

type Item = { label: string; envs: string[]; set: boolean; level: "req" | "rec" | "opt"; hint: string }
type Group = { title: string; desc: string; items: Item[] }
type Data = { activeGateway: string; groups: Group[] }

const levelLabel: Record<Item["level"], string> = { req: "Obrigatória", rec: "Recomendada", opt: "Opcional" }

export function SetupStatus() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch("/api/admin/env-check", { cache: "no-store" })
      const d = await r.json().catch(() => null)
      if (d?.groups) setData(d)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const all = data?.groups.flatMap((g) => g.items) ?? []
  // "Faltando" = só o que trava (obrigatória/recomendada não setada). Opcional não conta.
  const faltando = all.filter((i) => !i.set && i.level !== "opt")
  const bloqueia = all.filter((i) => !i.set && i.level === "req")

  return (
    <div className="space-y-5">
      {/* Resumo no topo */}
      <div
        className={`rounded-2xl border p-4 ${
          bloqueia.length > 0
            ? "border-red-200 bg-red-50"
            : faltando.length > 0
              ? "border-amber-200 bg-amber-50"
              : "border-emerald-200 bg-emerald-50"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {bloqueia.length > 0 ? (
              <AlertTriangle className="h-5 w-5 text-red-600" />
            ) : faltando.length > 0 ? (
              <CircleDot className="h-5 w-5 text-amber-600" />
            ) : (
              <Check className="h-5 w-5 text-emerald-600" />
            )}
            <div>
              <div className="text-sm font-bold text-foreground">
                {bloqueia.length > 0
                  ? `${bloqueia.length} chave(s) obrigatória(s) faltando`
                  : faltando.length > 0
                    ? `Tudo essencial ok — ${faltando.length} recomendada(s) faltando`
                    : "Tudo configurado ✓"}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {bloqueia.length > 0
                  ? "A loja não funciona 100% até preencher as obrigatórias."
                  : faltando.length > 0
                    ? "Funciona, mas o ideal é completar as recomendadas."
                    : "Todas as chaves essenciais e recomendadas estão ativas."}
              </div>
            </div>
          </div>
          <button
            onClick={load}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Reverificar
          </button>
        </div>
      </div>

      {/* Lista de faltantes em destaque (o que o Daniel pediu: "o que falta") */}
      {faltando.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Falta preencher ({faltando.length})
          </div>
          <ul className="space-y-2">
            {faltando.map((i) => (
              <li key={i.envs[0]} className="flex items-start gap-2">
                <X className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground">
                    {i.label}{" "}
                    <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${i.level === "req" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                      {levelLabel[i.level]}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">{i.hint}</div>
                  <code className="mt-0.5 inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                    {i.envs.join("  ou  ")}
                  </code>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Detalhe por grupo */}
      {data?.groups.map((g) => (
        <div key={g.title} className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-0.5 text-sm font-bold text-foreground">{g.title}</div>
          <div className="mb-3 text-[11px] text-muted-foreground">{g.desc}</div>
          <ul className="space-y-2">
            {g.items.map((i) => (
              <li key={i.envs[0]} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    {i.label}
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${i.level === "req" ? "bg-red-100 text-red-700" : i.level === "rec" ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"}`}>
                      {levelLabel[i.level]}
                    </span>
                  </div>
                  <code className="font-mono text-[10px] text-muted-foreground">{i.envs.join(" / ")}</code>
                </div>
                {i.set ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700">
                    <Check className="h-3 w-3" /> Ativa
                  </span>
                ) : (
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${i.level === "opt" ? "bg-muted text-muted-foreground" : "bg-red-100 text-red-700"}`}>
                    <X className="h-3 w-3" /> Faltando
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <p className="text-[11px] text-muted-foreground">
        As chaves ficam nas variáveis de ambiente (Vercel → Settings → Environment Variables, ou no
        <code className="mx-1 rounded bg-muted px-1 font-mono">.env.local</code> em produção local). Depois de adicionar,
        faça um <strong>Redeploy</strong> e clique em Reverificar. Os valores nunca são exibidos aqui — só o status.
      </p>
    </div>
  )
}

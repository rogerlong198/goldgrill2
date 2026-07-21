"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Link2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
  Radio,
  KeyRound,
  ShieldCheck,
} from "lucide-react"

type RelayTarget = { key: string; name: string; url: string; secret: string; createdAt: string }
type RelayEvent = {
  id: string
  ts: number
  key: string
  name: string
  event?: string
  status?: string
  txid?: string
  amount?: number
  forwarded: boolean
  forwardStatus?: number
  error?: string
}
type ClientCfg = {
  activeGateway: string
  pagouActive: boolean
  webhookPath: string
  relaySecret: string
  notifyOverride: string
}
type Data = {
  kvOk: boolean
  separateKv?: boolean
  env?: { urlSet: boolean; tokenSet: boolean }
  globalSecret?: string | null
  targets: Record<string, RelayTarget>
  log: RelayEvent[]
  client?: ClientCfg
}

const brl = (v?: number) => (v ? `R$ ${(v / 100).toFixed(2).replace(".", ",")}` : "—")
const fmt = (ts: number) => new Date(ts).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
const pretty = (s?: string) => {
  if (!s) return ""
  try {
    return JSON.stringify(JSON.parse(s), null, 2)
  } catch {
    return s
  }
}

// Prompt pronto pra colar no agente (Claude Code/Cursor) da OUTRA loja: ensina a
// integrar com o relay e a devolver o webhook pra registrar aqui.
function buildAgentPrompt(notifyUrl: string, secret: string) {
  return `Configure ESTA loja pra receber os pagamentos atraves de um relay externo (uma loja-fachada), pra o gateway (Pagou.ai) NUNCA ver o dominio real desta loja. O relay recebe o webhook do gateway e repassa pra ca com o mesmo corpo.

=== O CONTRATO (faca exatamente isto, adaptando a stack desta loja) ===

1) NOTIFY/CALLBACK: ao criar QUALQUER cobranca (PIX/cartao) no gateway, o notify_url desta loja deve apontar pro relay, nao pro dominio proprio. Deixe isso na env NOTIFY_URL_OVERRIDE e use-a quando existir.

2) VALIDACAO DE ENTRADA: o webhook desta loja (endpoint que recebe o gateway, ex.: /api/webhooks/pagouai) passa a receber o header "x-relay-secret". Valide contra a env RELAY_SECRET:
   - RELAY_SECRET definido e header != valor  => responda 401
   - RELAY_SECRET nao definido                => aceite (nao quebre nada)
   COMPARE DE FORMA EXATA: de trim nos dois lados e NAO deixe aspas/espacos entrarem no valor. (Erro comum: o valor entrar com aspas ou espaco e dar 401.)

3) NAO altere a logica de pagamento (marcar pago, e-mail, liberar a pagina de obrigado/rastreio). O corpo do webhook chega IDENTICO ao do gateway; so muda de onde ele vem.

=== VARIAVEIS PRA DEFINIR NA VERCEL DESTA LOJA (Production) ===
Cole exatamente estas duas (sem aspas):
NOTIFY_URL_OVERRIDE=${notifyUrl}
RELAY_SECRET=${secret}

=== ME DEVOLVA AO FINAL ===
A URL publica do webhook desta loja (ex.: https://SEU-DOMINIO/api/webhooks/pagouai), pra eu cadastrar como "destino" no relay.

=== TELA DE CONFERENCIA (crie, ajuda muito) ===
Uma pagina admin PROTEGIDA POR SENHA que mostre, com botao Copiar em cada campo: a URL de destino (o webhook desta loja), o RELAY_SECRET atual e o NOTIFY_URL_OVERRIDE atual. Serve pra conferir a qualquer momento se os valores batem com o relay.

Antes de editar, investigue onde a loja monta o notify_url e onde esta o handler do webhook. Se for Next.js, aplique via env. Se for outra stack, adapte mantendo o contrato. Nada pode dar erro por falta das envs (degrade gracioso).`
}

// Prompt de CONEXAO (auto-registro): cole no agente da loja NOVA. Ele configura
// a loja e a registra sozinho no relay — a loja aparece no painel ja conectada.
function buildOnboardPrompt(origin: string, secret: string) {
  return `Voce vai conectar ESTA loja a um relay de pagamento (uma loja-fachada), pra o gateway (Pagou.ai) NUNCA ver o dominio real desta loja. Faca, adaptando a stack desta loja:

1) VALIDACAO DE ENTRADA: no webhook desta loja (endpoint que recebe o gateway, ex.: /api/webhooks/pagouai), valide o header "x-relay-secret" contra a env RELAY_SECRET, comparando EXATO (de trim nos dois, sem aspas). Se nao bater => responda 401. NAO altere a logica de pagamento (marcar pago, e-mail, liberar pagina de obrigado/rastreio).

2) NOTIFY: deixe o notify_url do gateway configuravel pela env NOTIFY_URL_OVERRIDE e use-a quando existir.

3) AUTO-REGISTRO NO RELAY: rode este comando (troque SEU-DOMINIO pela URL publica REAL desta loja e NOME DA LOJA por um apelido):
   curl -X POST "${origin}/api/relay/register" -H "x-relay-secret: ${secret}" -H "content-type: application/json" -d "{\\"name\\":\\"NOME DA LOJA\\",\\"url\\":\\"https://SEU-DOMINIO/api/webhooks/pagouai\\"}"
   A resposta traz um campo "notifyUrl". GUARDE ele.

4) DEFINA na Vercel desta loja (Production) e faca redeploy:
   NOTIFY_URL_OVERRIDE=<o notifyUrl que voltou no passo 3>
   RELAY_SECRET=${secret}

5) TELA DE CONFERENCIA (crie, PROTEGIDA POR SENHA): mostre com botao Copiar em cada campo — o webhook desta loja, o RELAY_SECRET e o NOTIFY_URL_OVERRIDE atuais.

Pronto: apos o registro, esta loja aparece SOZINHA no painel do relay, ja conectada. Nada pode dar erro por falta de env (degrade gracioso).`
}

function CopyBtn({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        } catch {}
      }}
      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted"
    >
      {done ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
      {done ? "Copiado" : label}
    </button>
  )
}

function Field({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div>
      <div className={`mb-0.5 ${small ? "text-[10px]" : "text-xs"} font-semibold uppercase tracking-wide text-muted-foreground`}>
        {label}
      </div>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1.5 font-mono text-xs text-foreground">
          {value}
        </code>
        <CopyBtn text={value} />
      </div>
    </div>
  )
}

// Card colapsável (minimizar/maximizar) usado pelas duas áreas do painel de
// relay: "esta loja como cliente" (envio) e "esta loja como hub" (recebe).
function CollapsibleCard({
  title,
  icon,
  headerRight,
  defaultOpen = true,
  children,
}: {
  title: string
  icon?: ReactNode
  headerRight?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <div className="flex min-w-0 items-center gap-2">
          {icon}
          <h3 className="truncate text-sm font-bold text-foreground">{title}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {headerRight}
          {open ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>
      {open && <div className="mt-4">{children}</div>}
    </div>
  )
}

function TargetCard({
  target,
  notifyUrl,
  globalSecret,
  onChanged,
}: {
  target: RelayTarget
  notifyUrl: string
  globalSecret?: string | null
  onChanged: () => void
}) {
  const [url, setUrl] = useState(target.url)
  // Segredo que o relay realmente manda: o global (se houver) ou o da loja.
  const effectiveSecret = globalSecret || target.secret
  const envBlock = `NOTIFY_URL_OVERRIDE=${notifyUrl}\nRELAY_SECRET=${effectiveSecret}`
  const [saving, setSaving] = useState(false)
  const dirty = url.trim() !== target.url

  async function saveUrl() {
    setSaving(true)
    try {
      await fetch("/api/admin/relay", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: target.key, url }),
      })
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!confirm("Desconectar esta loja? O relay para de repassar os webhooks dela.")) return
    await fetch(`/api/admin/relay?key=${encodeURIComponent(target.key)}`, { method: "DELETE" })
    onChanged()
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 font-semibold text-foreground">
          <Link2 className="h-3.5 w-3.5 text-muted-foreground" /> {target.name}
          {!target.url && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              aguardando webhook
            </span>
          )}
        </div>
        <button onClick={remove} className="shrink-0 rounded-lg border border-border p-1.5 text-red-600 hover:bg-red-50" title="Desconectar">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Bloco .env pronto: cole ISTO nas variáveis da Vercel da loja de trás.
          Vem os dois valores juntos e corretos — sem risco de misturar. */}
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Cole na Vercel da loja de trás (Environment Variables)
          </span>
          <CopyBtn text={envBlock} label="Copiar .env" />
        </div>
        <pre className="overflow-x-auto rounded-md bg-muted p-2 font-mono text-[11px] leading-relaxed text-foreground">
          {envBlock}
        </pre>
      </div>

      <div className="mt-3">
        <CopyBtn text={buildAgentPrompt(notifyUrl, effectiveSecret)} label="Copiar prompt pro agente da loja" />
        <p className="mt-1 text-[11px] text-muted-foreground">
          Cole no agente (Claude Code/Cursor) da outra loja — ele configura o código e te devolve o webhook.
        </p>
      </div>

      <div className="mt-3">
        <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Webhook de destino (cole o que o agente te devolver)
        </div>
        <div className="flex items-center gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://loja-de-tras/api/webhooks/pagouai"
            className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            onClick={saveUrl}
            disabled={!dirty || saving}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-40"
          >
            {saving ? "…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  )
}

function genSecret() {
  const a = new Uint8Array(24)
  crypto.getRandomValues(a)
  return btoa(String.fromCharCode(...a)).replace(/[+/=]/g, "").slice(0, 28)
}

function GlobalSecretBox({ current, onSaved }: { current: string; onSaved: () => void }) {
  const [value, setValue] = useState(current)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setValue(current)
  }, [current])

  async function save() {
    setSaving(true)
    setSaved(false)
    try {
      await fetch("/api/admin/relay", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ globalSecret: value.trim() }),
      })
      setSaved(true)
      onSaved()
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-bold text-foreground">
        🔑 Segredo único (usado por TODAS as lojas)
      </div>
      <p className="mb-2 text-[11px] text-muted-foreground">
        Defina uma vez aqui — todas as lojas de trás usam este mesmo valor no <code className="font-mono">RELAY_SECRET</code>,
        então nunca mais desalinha. Sem variável de ambiente nenhuma.
        {current ? (
          <span className="ml-1 font-bold text-emerald-700">Ativo ✓</span>
        ) : (
          <span className="ml-1 text-amber-700">Vazio — cada loja usa um segredo próprio (mais chato).</span>
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="cole o segredo (ex: o que a loja de trás já usa) ou gere um"
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          onClick={() => setValue(genSecret())}
          className="rounded-lg border border-border px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-muted"
        >
          Gerar
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
        >
          {saving ? "…" : saved ? "Salvo ✓" : "Salvar"}
        </button>
      </div>
    </div>
  )
}

// Painel "esta loja como CLIENTE de um relay externo" (igual ao da v0-delivery):
// mostra, com botão Copiar, tudo que precisa pra plugar a Gold Grill num relay.
function ClientRelayPanel({ cfg, origin }: { cfg: ClientCfg; origin: string }) {
  const gwLabel: Record<string, string> = { pagou: "Pagou.ai", medusa: "MedusaPay", centurion: "CenturionPay" }
  const destUrl = origin ? `${origin}${cfg.webhookPath}` : cfg.webhookPath
  const secret = cfg.relaySecret
  const notify = cfg.notifyOverride
  const envBlock = `NOTIFY_URL_OVERRIDE=${notify || "<url-do-relay>"}\nRELAY_SECRET=${secret || "<segredo-do-relay>"}`
  const secretOk = !!secret
  const notifyOk = !!notify

  return (
    <CollapsibleCard
      title="Esta loja como cliente do relay (Pagou.ai)"
      icon={<Radio className="h-4 w-4 text-primary" />}
      headerRight={
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            secretOk && notifyOk ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
          }`}
        >
          {secretOk && notifyOk ? "Enviando via relay ✓" : "Relay não ativado"}
        </span>
      }
    >
      <p className="mb-3 text-[11px] text-muted-foreground">
        O relay é exclusivo da <strong className="text-foreground">Pagou.ai</strong>: ele recebe o webhook dela e repassa
        pra esta loja, escondendo o domínio real do gateway.
        {!cfg.pagouActive && (
          <span className="ml-1 font-semibold text-amber-700">
            Gateway ativo agora é {gwLabel[cfg.activeGateway] ?? cfg.activeGateway} — o relay só age quando a Pagou.ai está ativa.
          </span>
        )}
      </p>

      {/* 3 explicações rápidas */}
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-background p-2.5">
          <Radio className="mb-1 h-4 w-4 text-primary" />
          <div className="text-xs font-bold text-foreground">Destino do relay</div>
          <div className="text-[10px] text-muted-foreground">Configure a URL abaixo como repasse no relay.</div>
        </div>
        <div className="rounded-lg border border-border bg-background p-2.5">
          <KeyRound className="mb-1 h-4 w-4 text-primary" />
          <div className="text-xs font-bold text-foreground">Header obrigatório</div>
          <div className="text-[10px] text-muted-foreground">O relay deve mandar x-relay-secret em cada POST.</div>
        </div>
        <div className="rounded-lg border border-border bg-background p-2.5">
          <ShieldCheck className="mb-1 h-4 w-4 text-primary" />
          <div className="text-xs font-bold text-foreground">Corpo intacto</div>
          <div className="text-[10px] text-muted-foreground">Repassar o JSON do gateway sem transformar campos.</div>
        </div>
      </div>

      {/* 1. dados pro relay */}
      <div className="mb-3 rounded-xl border border-border bg-background p-3">
        <div className="mb-2 text-xs font-bold text-foreground">1. Configurar no relay como destino</div>
        <div className="space-y-2.5">
          <Field label="URL destino (webhook desta loja)" value={destUrl} />
          <Field label="Método" value="POST" />
          <Field label="Header" value="x-relay-secret" />
          <Field label="Valor do header (RELAY_SECRET)" value={secret || "— defina RELAY_SECRET no ambiente —"} />
          <Field label="Content-Type" value="application/json" />
        </div>
      </div>

      {/* 2. notify que vai no gateway */}
      <div className="mb-3 rounded-xl border border-border bg-background p-3">
        <div className="mb-2 text-xs font-bold text-foreground">2. URL que vai no gateway</div>
        <Field label="NOTIFY_URL atual (NOTIFY_URL_OVERRIDE)" value={notify || "— não definido: o gateway veria o domínio desta loja —"} />
        <p
          className={`mt-2 rounded-lg px-3 py-2 text-[11px] ${
            notifyOk ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          {notifyOk
            ? "NOTIFY_URL_OVERRIDE aponta pro relay. O gateway só vê o domínio do relay, nunca o desta loja."
            : "Defina NOTIFY_URL_OVERRIDE com a URL do relay — senão o gateway recebe o domínio real desta loja."}
        </p>
      </div>

      {/* 3. bloco .env */}
      <div className="rounded-xl border border-border bg-background p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-bold text-foreground">3. Envs esperadas na produção</span>
          <CopyBtn text={envBlock} label="Copiar .env" />
        </div>
        <pre className="overflow-x-auto rounded-md bg-muted p-2 font-mono text-[11px] leading-relaxed text-foreground">
          {envBlock}
        </pre>
      </div>
    </CollapsibleCard>
  )
}

export function RelayPanel() {
  const [data, setData] = useState<Data | null>(null)
  const [origin, setOrigin] = useState("")
  const [name, setName] = useState("")
  const [keyInput, setKeyInput] = useState("")
  const [secretInput, setSecretInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/relay", { cache: "no-store" })
    const d = await r.json().catch(() => null)
    if (d) setData(d)
  }, [])

  useEffect(() => {
    load()
    // 30s: o painel lê a KV só enquanto está aberto; intervalo maior = menos
    // comandos gastos. Use o botão "Atualizar" pra ver na hora.
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [load])

  const notifyUrl = (key: string) => `${origin}/api/webhooks/payment/${key}`

  async function connect() {
    if (!name.trim()) {
      setMsg({ ok: false, text: "Dê um apelido pra loja (ex: Loja B)." })
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      const r = await fetch("/api/admin/relay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          key: keyInput.trim() || undefined,
          secret: secretInput.trim() || undefined,
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d?.error || "Erro ao conectar.")
      setName("")
      setKeyInput("")
      setSecretInput("")
      await load()
      setMsg({ ok: true, text: "Loja criada. Copie o prompt no card dela e cole no agente da outra loja." })
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || "Erro ao conectar." })
    } finally {
      setBusy(false)
    }
  }

  const targets = data ? Object.values(data.targets) : []
  const log = data?.log ?? []

  return (
    <div className="space-y-6">
      {/* ESTA loja como cliente de um relay externo (envio) — o que a v0 mostra */}
      {data?.client && <ClientRelayPanel cfg={data.client} origin={origin} />}

      <CollapsibleCard title="Esta loja como hub (recebe de outras)" icon={<Sparkles className="h-4 w-4 text-primary" />}>
      <div className="space-y-6">

      {data && !data.kvOk && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          KV (Upstash) não configurado — sem hub. Provisione o Upstash na Vercel pra conectar lojas.
        </div>
      )}

      {data && data.kvOk && (
        <div className="space-y-1 text-xs text-muted-foreground">
          <div>
            Banco do relay:{" "}
            {data.separateKv ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-700">separado (conta nova) ✓</span>
            ) : (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-700">principal (o mesmo do e-mail)</span>
            )}
          </div>
          {!data.separateKv && data.env && (
            <div className="rounded-lg border border-border bg-card p-2 font-mono text-[11px]">
              <div>
                <code>RELAY_KV_REST_API_URL</code>:{" "}
                {data.env.urlSet ? <span className="text-emerald-700">✓ chegou</span> : <span className="text-red-600">✗ vazia/faltando</span>}
              </div>
              <div>
                <code>RELAY_KV_REST_API_TOKEN</code>:{" "}
                {data.env.tokenSet ? <span className="text-emerald-700">✓ chegou</span> : <span className="text-red-600">✗ vazia/faltando</span>}
              </div>
              <div className="mt-1 font-sans text-muted-foreground">
                {data.env.urlSet && data.env.tokenSet
                  ? "As duas chegaram mas ainda está no principal — force um Redeploy (sem cache)."
                  : "Env faltando: confira o NOME exato na Vercel (Production) e dê Redeploy."}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
        <strong className="text-foreground">Como funciona:</strong> crie uma loja aqui (só o apelido) → copie o{" "}
        <strong>prompt pro agente</strong> no card dela e cole no agente (Claude Code/Cursor) da loja nova → o agente
        configura a loja e te devolve o webhook → cole o webhook no card. Pronto: o gateway só vê o domínio desta loja.
      </div>

      {/* Segredo único do relay — definido aqui, guardado no banco, sem env */}
      {data && data.kvOk && <GlobalSecretBox current={data.globalSecret || ""} onSaved={load} />}

      {/* Conectar loja */}
      <section>
        <h3 className="mb-2 text-sm font-bold text-foreground">Conectar loja nova</h3>

        {/* Jeito fácil: auto-registro via prompt */}
        <div className="mb-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <div className="mb-1 text-xs font-bold text-foreground">✨ Jeito fácil (recomendado)</div>
          <p className="mb-2 text-[11px] text-muted-foreground">
            Cole este prompt no agente (Claude Code/Cursor) da loja nova — ele configura a loja e a{" "}
            <strong>registra sozinho</strong> no relay. Ela aparece aqui já conectada, sem você mexer no painel.
          </p>
          {origin && data?.globalSecret ? (
            <CopyBtn text={buildOnboardPrompt(origin, data.globalSecret)} label="Copiar prompt de conexão" />
          ) : (
            <span className="text-[11px] font-semibold text-amber-700">
              Defina o Segredo único acima primeiro — o auto-registro usa ele.
            </span>
          )}
        </div>

        <p className="mb-1 text-xs font-semibold text-muted-foreground">Ou crie manualmente:</p>
        <div className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Apelido (ex: Loja B)"
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            onClick={connect}
            disabled={busy}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Criar
          </button>
        </div>
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-muted-foreground">Restaurar loja existente (chave + segredo)</summary>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Chave (ex: 7f18efeb2875)"
              className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-primary/40"
            />
            <input
              value={secretInput}
              onChange={(e) => setSecretInput(e.target.value)}
              placeholder="Segredo (o RELAY_SECRET que a loja já usa)"
              className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Preencha pra recriar a loja com a MESMA chave/segredo que a loja de trás já usa — sem precisar mexer nela.
            Deixe vazio pra gerar novos.
          </p>
        </details>
        {msg && <p className={`mt-2 text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}
      </section>

      {/* Lojas conectadas */}
      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-foreground">
          <Sparkles className="h-4 w-4 text-primary" /> Lojas ({targets.length})
        </h3>
        {targets.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Nenhuma loja ainda. Crie uma acima.
          </div>
        ) : (
          <div className="space-y-2">
            {targets.map((t) => (
              <TargetCard
                key={t.key}
                target={t}
                notifyUrl={notifyUrl(t.key)}
                globalSecret={data?.globalSecret}
                onChanged={load}
              />
            ))}
          </div>
        )}
      </section>

      {/* Log ao vivo */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">Tráfego recente</h3>
          <div className="flex items-center gap-3">
            <button onClick={load} className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
              <RefreshCw className="h-3 w-3" /> Atualizar
            </button>
            {log.length > 0 && (
              <button
                onClick={async () => {
                  if (!confirm("Limpar todo o log de tráfego?")) return
                  await fetch("/api/admin/relay?clear=log", { method: "DELETE" })
                  await load()
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-3 w-3" /> Limpar
              </button>
            )}
          </div>
        </div>
        {log.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Nenhum evento ainda. Quando um pagamento passar pelo relay, aparece aqui.
          </div>
        ) : (
          <div className="space-y-2">
            {log.map((e) => {
              const open = expanded === e.id
              return (
                <div key={e.id} className="rounded-lg border border-border bg-card text-xs">
                  <button
                    onClick={() => setExpanded(open ? null : e.id)}
                    className="w-full p-3 text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground">{e.name}</span>
                      <span className="text-muted-foreground">{fmt(e.ts)}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                      {e.status && <span>status: <strong className="text-foreground">{e.status}</strong></span>}
                      {e.amount ? <span>{brl(e.amount)}</span> : null}
                      {e.txid && <span className="break-all">txid: {String(e.txid).slice(0, 16)}…</span>}
                      {e.forwarded ? (
                        <span
                          className={`rounded-full px-2 py-0.5 font-bold ${
                            e.forwardStatus && e.forwardStatus < 300 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          entregue {e.forwardStatus}
                        </span>
                      ) : (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 font-bold text-red-700">
                          falhou{e.error ? ` · ${e.error}` : ""}
                        </span>
                      )}
                      <span className="ml-auto text-[10px] text-muted-foreground">{open ? "▲ fechar" : "▼ ver payload"}</span>
                    </div>
                  </button>
                  {open && (
                    <div className="space-y-2 border-t border-border px-3 pb-3 pt-2">
                      <div>
                        <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Payload recebido do gateway
                        </div>
                        <pre className="max-h-64 overflow-auto rounded-md bg-muted p-2 font-mono text-[11px] leading-relaxed text-foreground">
                          {pretty(e.payload) || "(não capturado)"}
                        </pre>
                      </div>
                      {e.response !== undefined && (
                        <div>
                          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Resposta da loja de trás
                          </div>
                          <pre className="max-h-40 overflow-auto rounded-md bg-muted p-2 font-mono text-[11px] leading-relaxed text-foreground">
                            {pretty(e.response) || "(vazia)"}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
      </div>
      </CollapsibleCard>
    </div>
  )
}

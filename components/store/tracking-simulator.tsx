"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import {
  CheckCircle2,
  Clock3,
  Copy,
  Mail,
  MapPin,
  PackageCheck,
  Search,
  Trash2,
  Truck,
} from "lucide-react"

type CarrierId = "correios" | "fedex" | "dhl" | "ups" | "fionobre"

type TrackingStep = {
  title: string
  description: string
  date: string
  location: string
  state: "complete" | "current" | "pending"
}

type TrackingResult = {
  code: string
  displayCode: string
  carrierId: CarrierId
  carrierName: string
  progressIndex: number
  currentStatus: string
  statusDetail: string
  eta: string
  origin: string
  destination: string
  updatedAt: string
  consultedAt: string
  steps: TrackingStep[]
}

type OrderLookup = {
  code: string
  name: string
  email: string
  phone?: string
  destinationAddress?: string
  address?: {
    cep?: string
    street?: string
    number?: string
    complement?: string
    neighborhood?: string
    city?: string
    stateUF?: string
  }
  savedAt?: string
}

const STORAGE_KEY = "fio-nobre-tracking-cache-v1"
const ORDER_LOOKUP_STORAGE_KEY = "fio-nobre-order-lookup-v1"
const MAX_RECENT = 5
// Recalcula a cada 1 minuto. O status real é derivado do tempo decorrido
// desde a compra (savedAt), não de um timer simples.
const PROGRESS_UPDATE_INTERVAL_MS = 60 * 1000

// Offset em horas, a partir do momento da compra, em que cada step entra
// como "completo". Ex.: index 3 ("Em transporte") chega 28 h depois e
// permanece como o status corrente por 9 dias antes do próximo.
const STEP_OFFSET_HOURS = [
  0,                              // 0 Pagamento aprovado     — instante da compra
  1,                              // 1 Em preparação          — +1 h
  1 + 24,                         // 2 Postagem preparada     — +24 h (= 25 h)
  1 + 24 + 3,                     // 3 Em transporte          — +3 h (= 28 h)
  1 + 24 + 3 + 9 * 24 + 1,        // 4 Saiu para entrega      — após 9 d + 1 h
  1 + 24 + 3 + 9 * 24 + 1 + 5,    // 5 Tentativa não efetuada — +5 h
  1 + 24 + 3 + 9 * 24 + 1 + 5 + 6,// 6 Voltando para base     — +6 h
  1 + 24 + 3 + 9 * 24 + 1 + 5 + 6 + 24, // 7 Saiu p/ entrega 2ª — +24 h
  1 + 24 + 3 + 9 * 24 + 1 + 5 + 6 + 24 + 3, // 8 Entregue        — +3 h
]

const carrierLabels: Record<CarrierId, string> = {
  correios: "Correios",
  fedex: "FedEx",
  dhl: "DHL",
  ups: "UPS",
  fionobre: "Gold Grill Entregas",
}

const statusTitles = [
  "Pagamento aprovado",
  "Em preparação",
  "Postagem preparada",
  "Em transporte",
  "Saiu para entrega",
  "Tentativa de entrega não efetuada",
  "Pedido voltando para a base de distribuição",
  "Saiu para entrega",
  "Entregue",
]

const LAST_STEP_INDEX = statusTitles.length - 1
const ATTEMPT_FAILED_STEP_INDEX = 5
const RETURNING_TO_BASE_STEP_INDEX = 6
const SECOND_DELIVERY_ATTEMPT_STEP_INDEX = 7
const HIDDEN_UNTIL_CURRENT_STEP_INDEXES = [
  ATTEMPT_FAILED_STEP_INDEX,
  RETURNING_TO_BASE_STEP_INDEX,
]

const stepDescriptions = [
  "Pagamento aprovado e pedido confirmado no sistema da loja.",
  "Pedido em preparação no centro de preparo.",
  "Remessa vinculada à transportadora.",
  "Pacote em transferência para a unidade regional.",
  "Entrega em rota para o endereço informado.",
  "A transportadora não conseguiu concluir a entrega nesta tentativa.",
  "Pedido retornando para a base de distribuição para uma nova tentativa de entrega.",
  "Nova tentativa de entrega em rota para o endereço informado.",
  "Entrega finalizada no endereço do pedido.",
]

const hubs = [
  "São Paulo, SP",
  "Campinas, SP",
  "Curitiba, PR",
  "Belo Horizonte, MG",
  "Rio de Janeiro, RJ",
  "Joinville, SC",
]

function normalizeCode(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
}

function hashCode(value: string) {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

function detectCarrier(code: string): CarrierId {
  if (/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(code)) return "correios"
  if (/^1Z[A-Z0-9]{16}$/.test(code)) return "ups"
  if (/^\d{12}$/.test(code)) return "fedex"
  if (/^\d{10}$/.test(code)) return "dhl"

  return "fionobre"
}

function formatDisplayCode(code: string, carrierId: CarrierId) {
  if (/^CB\d{8}\d{6}$/.test(code)) {
    return `CB-${code.slice(2, 10)}-${code.slice(10)}`
  }

  if (carrierId === "correios") {
    return code
  }

  if (carrierId === "ups") {
    return `${code.slice(0, 2)} ${code.slice(2, 8)} ${code.slice(8, 14)} ${code.slice(14)}`
  }

  if (/^\d+$/.test(code)) {
    return code.replace(/(\d{3})(?=\d)/g, "$1 ")
  }

  return code.replace(/(.{4})(?=.)/g, "$1 ")
}

function dateAt(base: Date, daysOffset: number, seed: number) {
  const date = new Date(base)
  date.setDate(date.getDate() + daysOffset)
  date.setHours(8 + ((seed + daysOffset * 7) % 9))
  date.setMinutes((seed + daysOffset * 11) % 60)
  date.setSeconds(0)
  date.setMilliseconds(0)
  return date
}

// Data exata de um step com base no horário da compra + offset definido.
function stepDateFromCreated(createdAt: Date, stepIndex: number) {
  const date = new Date(createdAt)
  date.setHours(date.getHours() + (STEP_OFFSET_HOURS[stepIndex] ?? 0))
  return date
}

// Calcula em qual step o pedido está, dado o tempo real decorrido desde a
// compra. Retorna o último step cuja janela de tempo já foi atingida.
function progressIndexFromCreated(createdAt: Date, now: Date = new Date()) {
  const elapsedHours = (now.getTime() - createdAt.getTime()) / 3600000
  let reached = 0
  for (let i = 0; i < STEP_OFFSET_HOURS.length; i += 1) {
    if (elapsedHours >= STEP_OFFSET_HOURS[i]) reached = i
  }
  return reached
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
  }).format(date)
}

function getProgressIndex(seed: number) {
  const roll = seed % 100

  if (roll < 10) return 1
  if (roll < 28) return 2
  if (roll < 56) return 3
  if (roll < 76) return 4
  if (roll < 88) return 5
  if (roll < 96) return 6
  if (roll < 99) return 7
  return LAST_STEP_INDEX
}

function clampProgressIndex(value: number) {
  return Math.max(0, Math.min(LAST_STEP_INDEX, value))
}

function getProgressIndexFromSteps(steps?: TrackingStep[]) {
  if (!Array.isArray(steps)) return 0

  const currentIndex = steps.findIndex((step) => step.state === "current")
  if (currentIndex >= 0) return clampProgressIndex(currentIndex)

  const lastCompleteIndex = steps.reduce((lastIndex, step, index) => {
    return step.state === "complete" ? index : lastIndex
  }, -1)

  return clampProgressIndex(lastCompleteIndex >= 0 ? lastCompleteIndex : 0)
}

function getResultProgressIndex(result: Pick<TrackingResult, "progressIndex" | "steps">) {
  if (Number.isFinite(result.progressIndex)) {
    return clampProgressIndex(result.progressIndex)
  }

  return getProgressIndexFromSteps(result.steps)
}

function shouldShowTimelineStep(index: number, currentProgressIndex: number) {
  if (HIDDEN_UNTIL_CURRENT_STEP_INDEXES.includes(index)) {
    return currentProgressIndex >= index
  }

  if (index === SECOND_DELIVERY_ATTEMPT_STEP_INDEX) {
    return currentProgressIndex >= RETURNING_TO_BASE_STEP_INDEX
  }

  return true
}

function buildTrackingResult(
  code: string,
  progressIndex?: number,
  createdAt?: Date,
): TrackingResult {
  const carrierId = detectCarrier(code)
  const seed = hashCode(code)
  const useRealSchedule = Boolean(createdAt)

  let currentIndex: number
  if (useRealSchedule && createdAt) {
    // Quando temos o momento real da compra, o status é função do tempo.
    // Se o caller forçou um progressIndex, respeita.
    currentIndex = clampProgressIndex(progressIndex ?? progressIndexFromCreated(createdAt))
  } else {
    const defaultProgressIndex = code.startsWith("CB") ? 0 : getProgressIndex(seed)
    currentIndex = clampProgressIndex(progressIndex ?? defaultProgressIndex)
  }

  const isDelivered = currentIndex >= LAST_STEP_INDEX
  const origin = hubs[seed % hubs.length]
  const transferHub = hubs[(seed + 2) % hubs.length]

  // baseDate: usado só pela trilha "sintética" (sem createdAt) pra manter
  // o comportamento legado. Quando temos createdAt, ignorado.
  const baseDate = new Date()
  baseDate.setDate(baseDate.getDate() - currentIndex - 1)

  const dateForStep = (index: number) =>
    useRealSchedule && createdAt
      ? stepDateFromCreated(createdAt, index)
      : dateAt(baseDate, index, seed)

  const deliveryDate = dateForStep(LAST_STEP_INDEX)
  const updatedDate = dateForStep(currentIndex)

  const locations = [
    "Pedido online",
    `Centro de preparo - ${origin}`,
    `Unidade de postagem - ${origin}`,
    `Unidade de tratamento - ${transferHub}`,
    "Rota de entrega local",
    "Endereço informado no checkout",
    "Base de distribuição local",
    "Rota de entrega local",
    "Endereço informado no checkout",
  ]

  const steps = statusTitles.map((title, index) => {
    const isComplete = index < currentIndex || (isDelivered && index === LAST_STEP_INDEX)
    const isCurrent = !isDelivered && index === currentIndex
    const state: TrackingStep["state"] = isCurrent
      ? "current"
      : isComplete
        ? "complete"
        : "pending"

    return {
      title,
      description: stepDescriptions[index],
      date:
        isComplete || isCurrent
          ? formatDateTime(dateForStep(index))
          : index === currentIndex + 1
            ? `Previsto para ${formatDate(dateForStep(index))}`
            : "Aguardando",
      location: locations[index],
      state,
    }
  })

  return {
    code,
    displayCode: formatDisplayCode(code, carrierId),
    carrierId,
    carrierName: carrierLabels[carrierId],
    progressIndex: currentIndex,
    currentStatus: statusTitles[currentIndex],
    statusDetail: stepDescriptions[currentIndex],
    eta:
      currentIndex >= LAST_STEP_INDEX
        ? `Entregue em ${formatDate(deliveryDate)}`
        : `Previsto até ${formatDate(deliveryDate)}`,
    origin,
    destination: "Endereço informado no checkout",
    updatedAt: formatDateTime(updatedDate),
    consultedAt: new Date().toISOString(),
    steps,
  }
}

function readRecentResults() {
  if (typeof window === "undefined") return []

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed
      .map((item) => {
        const code = normalizeCode(String(item?.code ?? ""))
        if (code.length < 6) return null

        const progressIndex = Number.isFinite(item?.progressIndex)
          ? Number(item.progressIndex)
          : getProgressIndexFromSteps(item?.steps)

        return buildTrackingResult(code, progressIndex)
      })
      .filter((item): item is TrackingResult => Boolean(item))
  } catch {
    return []
  }
}

function readOrderLookup(code: string) {
  if (typeof window === "undefined") return null

  try {
    const raw = window.localStorage.getItem(ORDER_LOOKUP_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null

    const normalizedCode = normalizeCode(code)
    const order = parsed.find((item) => normalizeCode(item?.code ?? "") === normalizedCode)

    if (!order?.name) return null

    return {
      code: String(order.code ?? code),
      name: String(order.name),
      email: String(order.email ?? ""),
      phone: order.phone ? String(order.phone) : undefined,
      destinationAddress: order.destinationAddress ? String(order.destinationAddress) : undefined,
      address: order.address && typeof order.address === "object"
        ? {
            cep: order.address.cep ? String(order.address.cep) : undefined,
            street: order.address.street ? String(order.address.street) : undefined,
            number: order.address.number ? String(order.address.number) : undefined,
            complement: order.address.complement ? String(order.address.complement) : undefined,
            neighborhood: order.address.neighborhood ? String(order.address.neighborhood) : undefined,
            city: order.address.city ? String(order.address.city) : undefined,
            stateUF: order.address.stateUF ? String(order.address.stateUF) : undefined,
          }
        : undefined,
      savedAt: order.savedAt ? String(order.savedAt) : undefined,
    } satisfies OrderLookup
  } catch {
    return null
  }
}

function saveRecentResults(results: TrackingResult[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(results.slice(0, MAX_RECENT)))
}

export function TrackingSimulator() {
  const [input, setInput] = useState("")
  const [result, setResult] = useState<TrackingResult | null>(null)
  const [recentResults, setRecentResults] = useState<TrackingResult[]>([])
  const [orderLookup, setOrderLookup] = useState<OrderLookup | null>(null)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const storedResults = readRecentResults()
    const codeFromUrl = normalizeCode(
      new URLSearchParams(window.location.search).get("codigo") ?? ""
    )

    if (codeFromUrl.length >= 6) {
      const orderFromUrl = readOrderLookup(codeFromUrl)
      const createdAt = orderFromUrl?.savedAt ? new Date(orderFromUrl.savedAt) : undefined
      const cachedResult = storedResults.find((item) => item.code === codeFromUrl)
      const nextResult = cachedResult ?? buildTrackingResult(codeFromUrl, undefined, createdAt)
      const nextResults = cachedResult
        ? storedResults
        : [
            nextResult,
            ...storedResults.filter((item) => item.code !== nextResult.code),
          ].slice(0, MAX_RECENT)

      setInput(codeFromUrl)
      setResult(nextResult)
      setOrderLookup(orderFromUrl)
      setNotice(cachedResult ? "Consulta recuperada deste navegador." : "Pedido carregado pelo código da compra.")
      setRecentResults(nextResults)
      saveRecentResults(nextResults)
      return
    }

    setRecentResults(storedResults)
  }, [])

  const normalizedInput = useMemo(() => normalizeCode(input), [input])
  const currentProgressIndex = result ? getResultProgressIndex(result) : 0
  const trackingFinished = Boolean(result && currentProgressIndex >= LAST_STEP_INDEX)
  const visibleSteps = useMemo(() => {
    if (!result) return []

    return result.steps
      .map((step, index) => ({ step, index }))
      .filter(({ index }) => shouldShowTimelineStep(index, currentProgressIndex))
  }, [currentProgressIndex, result])

  const storeRecentResult = useCallback((nextResult: TrackingResult) => {
    setRecentResults((currentResults) => {
      const nextResults = [
        nextResult,
        ...currentResults.filter((item) => item.code !== nextResult.code),
      ].slice(0, MAX_RECENT)

      saveRecentResults(nextResults)
      return nextResults
    })
  }, [])

  useEffect(() => {
    if (!result) return

    const progressIndex = getResultProgressIndex(result)
    if (progressIndex >= LAST_STEP_INDEX) return

    // Auto-atualização só vale pra pedidos reais (com savedAt). O status é
    // recalculado a partir do tempo decorrido — não há mais o "avança +1
    // a cada N segundos" que causava progresso irreal.
    const createdAtRaw = orderLookup?.savedAt
    if (!createdAtRaw) return
    const createdAt = new Date(createdAtRaw)
    if (Number.isNaN(createdAt.getTime())) return

    const tick = () => {
      const newIndex = progressIndexFromCreated(createdAt)
      if (newIndex === progressIndex) return

      const nextResult = buildTrackingResult(result.code, newIndex, createdAt)
      setResult(nextResult)
      storeRecentResult(nextResult)
      setCopied(false)
      setNotice(
        nextResult.progressIndex >= LAST_STEP_INDEX
          ? "Pedido entregue."
          : `Atualização automática: ${nextResult.currentStatus}.`
      )
    }

    const timer = window.setInterval(tick, PROGRESS_UPDATE_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [result, orderLookup, storeRecentResult])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCopied(false)

    if (normalizedInput.length < 6) {
      setError("Informe um código de rastreio ou número de pedido válido.")
      setNotice("")
      return
    }

    setError("")

    const matchedOrder = readOrderLookup(normalizedInput)

    if (result?.code === normalizedInput) {
      setOrderLookup(matchedOrder)
      setNotice("Essa consulta já está aberta neste navegador.")
      return
    }

    const cachedResult = recentResults.find((item) => item.code === normalizedInput)
    if (cachedResult) {
      setResult(cachedResult)
      setOrderLookup(matchedOrder)
      setNotice("Consulta recuperada deste navegador.")
      return
    }

    const createdAt = matchedOrder?.savedAt ? new Date(matchedOrder.savedAt) : undefined
    const nextResult = buildTrackingResult(normalizedInput, undefined, createdAt)
    setResult(nextResult)
    setOrderLookup(matchedOrder)
    setNotice("")
    storeRecentResult(nextResult)
  }

  async function copyCode() {
    if (!result) return

    await navigator.clipboard.writeText(result.code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  function openRecent(item: TrackingResult) {
    setInput(item.code)
    setResult(item)
    setOrderLookup(readOrderLookup(item.code))
    setNotice("Consulta recente carregada.")
    setError("")
    setCopied(false)
  }

  function clearTrackingCodes() {
    window.localStorage.removeItem(STORAGE_KEY)
    setInput("")
    setResult(null)
    setRecentResults([])
    setOrderLookup(null)
    setNotice("Códigos de rastreio limpos deste navegador.")
    setError("")
    setCopied(false)
  }

  return (
    <section className="bg-[#fbfaf7]">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-[0.9fr_1.1fr] md:px-6 md:py-14">
        <div className="flex flex-col justify-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b98a2e]">
            Rastreio de pedido
          </p>
          <h1 className="mt-3 max-w-xl text-3xl font-bold leading-tight text-[#1a1a1a] md:text-5xl">
            Acompanhe seu pedido em tempo real
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[#525252] md:text-base">
            Consulte pelo código enviado no e-mail ou pelo número do pedido. As
            atualizações oficiais da transportadora continuam sendo enviadas
            pelos canais de atendimento.
          </p>

          <div className="mt-7 grid gap-3 text-sm text-[#3f3f3f] sm:grid-cols-2">
            <div className="rounded-lg border border-[#eadfca] bg-white/80 p-4">
              <Truck className="h-5 w-5 text-[#b98a2e]" />
              <p className="mt-3 font-bold text-[#1a1a1a]">Transportadoras</p>
              <p className="mt-1 leading-6">Correios, FedEx, DHL, UPS e pedidos Gold Grill.</p>
            </div>
            <div className="rounded-lg border border-[#eadfca] bg-white/80 p-4">
              <PackageCheck className="h-5 w-5 text-[#b98a2e]" />
              <p className="mt-3 font-bold text-[#1a1a1a]">Mesmo código</p>
              <p className="mt-1 leading-6">A consulta fica salva neste navegador.</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-[#eadfca] bg-white p-4 shadow-[0_18px_50px_rgba(26,26,26,0.08)] md:p-6">
          <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div>
              <label htmlFor="tracking-code" className="text-sm font-bold text-[#1a1a1a]">
                Código de rastreio ou pedido
              </label>
              <input
                id="tracking-code"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ex: AN067003514DC"
                className="mt-2 h-12 w-full rounded-lg border border-[#ded6c8] bg-[#fbfaf7] px-4 text-sm font-semibold uppercase tracking-wide text-[#1a1a1a] outline-none transition focus:border-[#b98a2e] focus:bg-white focus:ring-2 focus:ring-[#b98a2e]/20"
                autoComplete="off"
              />
              {error && <p className="mt-2 text-sm font-semibold text-red-600">{error}</p>}
            </div>

            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center gap-2 self-end rounded-lg bg-[#1a1a1a] px-5 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#333333] focus:outline-none focus:ring-2 focus:ring-[#b98a2e]/40"
            >
              <Search className="h-4 w-4" />
              Consultar
            </button>
          </form>

          <div className="mt-3">
            <button
              type="button"
              onClick={clearTrackingCodes}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#ded6c8] bg-white px-4 text-xs font-bold uppercase tracking-wide text-[#525252] transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-200"
            >
              <Trash2 className="h-4 w-4" />
              Limpar códigos
            </button>
          </div>

          {notice && (
            <div className="mt-4 rounded-lg border border-[#eadfca] bg-[#fff9ea] px-4 py-3 text-sm font-semibold text-[#6f5310]">
              {notice}
            </div>
          )}

          <div className="mt-6">
            {!result ? (
              <div className="rounded-lg border border-dashed border-[#ded6c8] bg-[#fbfaf7] px-5 py-8 text-center">
                <PackageCheck className="mx-auto h-9 w-9 text-[#b98a2e]" />
                <p className="mt-4 text-sm font-bold text-[#1a1a1a]">Aguardando consulta</p>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#666666]">
                  O status do envio aparece aqui depois da primeira consulta.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-lg border border-[#eadfca] bg-[#fbfaf7] p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#b98a2e]">
                        {result.carrierName}
                      </p>
                      {orderLookup?.name && (
                        <p className="mt-2 text-sm font-bold text-[#1a1a1a]">
                          Pedido de <span className="text-[#b8860b]">{orderLookup.name}</span>
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-bold text-[#1a1a1a]">{result.currentStatus}</h2>
                        <span className="rounded-full bg-[#b98a2e] px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                          Atualizado
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[#525252]">{result.statusDetail}</p>
                      <p className="mt-3 rounded-lg border border-[#eadfca] bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#6f5310]">
                        {trackingFinished
                          ? "Linha do tempo concluída"
                          : orderLookup?.savedAt
                            ? "Atualiza automaticamente a cada minuto"
                            : "Status atualizado na próxima consulta"}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={copyCode}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#ded6c8] bg-white px-3 text-sm font-bold text-[#1a1a1a] transition hover:border-[#b98a2e]"
                      aria-label="Copiar código de rastreio"
                    >
                      <Copy className="h-4 w-4" />
                      {copied ? "Copiado" : result.displayCode}
                    </button>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <InfoBlock icon={<Clock3 className="h-4 w-4" />} label="Previsão" value={result.eta} />
                    <InfoBlock icon={<MapPin className="h-4 w-4" />} label="Origem" value={result.origin} />
                    <InfoBlock
                      icon={<Truck className="h-4 w-4" />}
                      label="Destino"
                      value={orderLookup?.destinationAddress || result.destination}
                    />
                    <InfoBlock icon={<CheckCircle2 className="h-4 w-4" />} label="Atualização" value={result.updatedAt} />
                  </div>
                </div>

                <div className="rounded-lg border border-[#eadfca] bg-white p-4">
                  <ol className="space-y-0">
                    {visibleSteps.map(({ step, index }, visualIndex) => (
                      <li key={`${index}-${step.title}`} className="grid grid-cols-[32px_1fr] gap-3">
                        <div className="flex flex-col items-center">
                          <span
                            className={`flex h-8 w-8 items-center justify-center rounded-full border text-white ${
                              step.state === "pending"
                                ? "border-[#ded6c8] bg-[#c8c1b5]"
                                : step.state === "current"
                                  ? "border-[#b98a2e] bg-[#b98a2e]"
                                  : "border-[#1f7a4f] bg-[#1f7a4f]"
                            }`}
                          >
                            {step.state === "pending" ? (
                              <Clock3 className="h-4 w-4" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4" />
                            )}
                          </span>
                          {visualIndex < visibleSteps.length - 1 && (
                            <span className="h-12 w-px bg-[#ded6c8]" aria-hidden="true" />
                          )}
                        </div>

                        <div className="pb-5">
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                            <p className="font-bold text-[#1a1a1a]">{step.title}</p>
                            <p className="text-xs font-bold uppercase tracking-wide text-[#8a8174]">
                              {step.date}
                            </p>
                          </div>
                          <p className="mt-1 text-sm leading-6 text-[#525252]">
                            {index === 0 && orderLookup?.name
                              ? `Pagamento do pedido de ${orderLookup.name} aprovado no sistema da loja.`
                              : step.description}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-[#8a8174]">{step.location}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}
          </div>

          {recentResults.length > 0 && (
            <div className="mt-6 border-t border-[#eadfca] pt-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8a8174]">
                Consultas recentes
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {recentResults.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => openRecent(item)}
                    className="rounded-lg border border-[#ded6c8] bg-[#fbfaf7] px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#1a1a1a] transition hover:border-[#b98a2e] hover:bg-white"
                  >
                    {item.displayCode}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 rounded-lg bg-[#1a1a1a] p-4 text-white sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold">Precisa de ajuda?</p>
              <p className="mt-1 text-sm text-white/70">Envie o número do pedido para o atendimento.</p>
            </div>
            <a
              href="mailto:atendimento-pedidos@goldgrill.shop"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-[#1a1a1a] transition hover:bg-[#f3ead8]"
            >
              <Mail className="h-4 w-4" />
              Atendimento
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

function InfoBlock({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border border-[#eadfca] bg-white p-3">
      <div className="flex items-center gap-2 text-[#b98a2e]">
        {icon}
        <span className="text-xs font-bold uppercase tracking-[0.14em]">{label}</span>
      </div>
      <p className="mt-2 text-sm font-bold leading-5 text-[#1a1a1a]">{value}</p>
    </div>
  )
}

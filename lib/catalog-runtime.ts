// ============================================================================
//  Overlay de catálogo no LADO DO SITE (somente leitura).
//
//  O painel /admin grava as edições num overlay no KV. Aqui o site público
//  aplica esse overlay por cima do catálogo estático (lib/products.ts), pra a
//  edição refletir no site SEM exportar/commitar/deploy.
//
//  USO MÍNIMO DO KV (importante pro plano Free do Upstash):
//   • A leitura usa UM fetch (MGET) marcado como `force-cache` + tag CATALOG_TAG.
//     O Next guarda o resultado no Data Cache — então o site NÃO lê o Upstash a
//     cada visita (tráfego de anúncios não toca o KV).
//   • O KV só é lido de novo quando o painel chama revalidateTag(CATALOG_TAG)
//     ao salvar uma edição — aí as páginas regeneram lendo o overlay uma vez.
//
//  Só aplica nos campos escalares (preço, nome, imagem, etc.) e remove os
//  produtos deletados. Produtos NOVOS adicionados pelo painel só aparecem no
//  site após um deploy (precisam de rota estática própria).
// ============================================================================

import "server-only"
import { revalidatePath, revalidateTag } from "next/cache"
import { type Product } from "@/lib/products"
import { OVERRIDES_KEY, DELETED_KEY, CATALOG_TAG } from "./catalog-keys"

export { CATALOG_TAG }

// Chamado pelo painel ao salvar/excluir/zerar: invalida o cache do overlay e as
// páginas que mostram produtos, pra a edição refletir no site. NÃO lê o KV — só
// marca pra regenerar; a leitura (1x) acontece quando a página é re-renderizada.
export function revalidateCatalog(slug?: string): void {
  revalidateTag(CATALOG_TAG)
  revalidatePath("/")
  revalidatePath("/produtos")
  revalidatePath("/colecoes", "layout")
  if (slug && slug.trim()) revalidatePath(`/product/${slug.trim()}`)
}

const URL_BASE = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "").replace(/\/$/, "")
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || ""

type Overlay = { overrides: Record<string, Partial<Product>>; deleted: string[] }

const EMPTY: Overlay = { overrides: {}, deleted: [] }

async function readOverlay(): Promise<Overlay> {
  if (!URL_BASE || !TOKEN) return EMPTY
  try {
    // MGET pega as duas chaves num único comando. force-cache + tag fazem o
    // Next cachear o resultado (sem ler o KV por visita) e invalidar só quando
    // o painel chamar revalidateTag(CATALOG_TAG).
    const res = await fetch(
      `${URL_BASE}/mget/${encodeURIComponent(OVERRIDES_KEY)}/${encodeURIComponent(DELETED_KEY)}`,
      {
        headers: { authorization: `Bearer ${TOKEN}` },
        // `revalidate` (TTL) além da tag: se a invalidação por tag falhar — o que
        // acontecia com `force-cache`, deixando o overlay congelado desde o build
        // e as edições do painel nunca aparecendo no site — o dado expira sozinho
        // em 60s. Teto de ~1 leitura do KV por minuto: seguro no free do Upstash.
        next: { revalidate: 60, tags: [CATALOG_TAG] },
      },
    )
    if (!res.ok) return EMPTY
    const data = (await res.json()) as { result?: (string | null)[] }
    const [ovRaw, delRaw] = Array.isArray(data?.result) ? data.result : [null, null]
    const overrides = ovRaw ? (JSON.parse(ovRaw) as Record<string, Partial<Product>>) : {}
    const deletedParsed = delRaw ? (JSON.parse(delRaw) as unknown) : []
    const deleted = Array.isArray(deletedParsed) ? (deletedParsed as string[]) : []
    return { overrides: overrides ?? {}, deleted }
  } catch {
    return EMPTY
  }
}

// Mescla um override sobre o produto base, DESCARTANDO valores inválidos
// (null/undefined ou número não-finito). Blindagem: um override mal gravado
// — ex.: preço digitado com vírgula virou NaN/null no KV — nunca substitui um
// campo bom por lixo, então o site não quebra (ex.: price.toFixed em null).
function mergeOverride<T extends { id: number }>(item: T, ov: Partial<Product> | undefined): T {
  if (!ov) return item
  const merged = { ...item } as Record<string, unknown>
  for (const [key, value] of Object.entries(ov)) {
    if (value === null || value === undefined) continue
    if (typeof value === "number" && !Number.isFinite(value)) continue
    merged[key] = value
  }
  merged.id = item.id
  return merged as T
}

// Aplica o overlay numa lista de produtos (edições + remove deletados).
export async function applyOverlay<T extends { id: number }>(items: T[]): Promise<T[]> {
  const { overrides, deleted } = await readOverlay()
  if (Object.keys(overrides).length === 0 && deleted.length === 0) return items
  const del = new Set(deleted)
  const out: T[] = []
  for (const item of items) {
    const key = String(item.id)
    if (del.has(key)) continue
    out.push(mergeOverride(item, overrides[key]))
  }
  return out
}

// Aplica o overlay num único produto (ou null se foi deletado).
export async function applyOverlayOne<T extends { id: number }>(
  item: T | null | undefined,
): Promise<T | null> {
  if (!item) return null
  const { overrides, deleted } = await readOverlay()
  if (deleted.includes(String(item.id))) return null
  return mergeOverride(item, overrides[String(item.id)])
}

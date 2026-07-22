"use client"

import { mergeAttributes } from "@tiptap/core"
import TiptapImage from "@tiptap/extension-image"
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react"
import { AlignLeft, AlignCenter, AlignRight } from "lucide-react"

// Passos de largura em blocos de 10% — vira classe fixa (gg-img-w-NN) em vez
// de style inline, pra não precisar liberar `style` no sanitizador (lib/rich-text.ts).
const MIN_WIDTH = 10
const MAX_WIDTH = 100
const STEP = 10

type Align = "left" | "center" | "right"

function alignClass(align: Align) {
  return align === "left" ? "gg-img-left" : align === "right" ? "gg-img-right" : "gg-img-center"
}

function ImageNodeView({ node, updateAttributes, selected, editor }: ReactNodeViewProps) {
  const { src, alt, width, align } = node.attrs as {
    src: string
    alt: string | null
    width: number
    align: Align
  }

  function startResize(e: React.PointerEvent) {
    e.preventDefault()
    e.stopPropagation()
    const containerWidth = editor.view.dom.clientWidth || 1
    const startX = e.clientX
    const startWidth = width ?? 100

    function onMove(ev: PointerEvent) {
      const deltaPercent = ((ev.clientX - startX) / containerWidth) * 100
      let next = Math.round((startWidth + deltaPercent) / STEP) * STEP
      next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, next))
      updateAttributes({ width: next })
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  return (
    <NodeViewWrapper
      as="span"
      className={`gg-img-node relative inline-block align-top ${alignClass(align)} gg-img-w-${width ?? 100}`}
      style={{ lineHeight: 0 }}
    >
      <img src={src} alt={alt ?? ""} draggable={false} className="block h-auto w-full rounded-lg" />

      {selected && (
        <>
          <div className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-primary" />
          <div className="absolute -top-9 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-md border border-border bg-card px-1 py-1 shadow-md">
            <button
              type="button"
              onClick={() => updateAttributes({ align: "left" })}
              title="Alinhar à esquerda (texto contorna)"
              className={`rounded p-1 hover:bg-muted ${align === "left" ? "bg-muted" : ""}`}
            >
              <AlignLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => updateAttributes({ align: "center" })}
              title="Centralizar"
              className={`rounded p-1 hover:bg-muted ${align === "center" ? "bg-muted" : ""}`}
            >
              <AlignCenter className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => updateAttributes({ align: "right" })}
              title="Alinhar à direita (texto contorna)"
              className={`rounded p-1 hover:bg-muted ${align === "right" ? "bg-muted" : ""}`}
            >
              <AlignRight className="h-3.5 w-3.5" />
            </button>
            <span className="ml-1 border-l border-border pl-1.5 pr-0.5 text-[11px] font-semibold text-muted-foreground">
              {width ?? 100}%
            </span>
          </div>
          <div
            onPointerDown={startResize}
            title="Arraste pra redimensionar"
            style={{ touchAction: "none" }}
            className="absolute -bottom-1.5 -right-1.5 h-4 w-4 cursor-nwse-resize rounded-full border-2 border-white bg-primary shadow"
          />
        </>
      )}
    </NodeViewWrapper>
  )
}

export const ResizableImage = TiptapImage.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: 100,
        parseHTML: (el: HTMLElement) => {
          const match = Array.from(el.classList).find((c) => c.startsWith("gg-img-w-"))
          const n = match ? Number(match.replace("gg-img-w-", "")) : 100
          return Number.isFinite(n) ? n : 100
        },
        renderHTML: () => ({}),
      },
      align: {
        default: "center",
        parseHTML: (el: HTMLElement) => {
          if (el.classList.contains("gg-img-left")) return "left"
          if (el.classList.contains("gg-img-right")) return "right"
          return "center"
        },
        renderHTML: () => ({}),
      },
    }
  },

  renderHTML({ HTMLAttributes, node }) {
    const width = (node.attrs.width as number) ?? 100
    const align = (node.attrs.align as Align) ?? "center"
    const cls = `rounded-lg ${alignClass(align)} gg-img-w-${width}`
    return ["img", mergeAttributes(HTMLAttributes, { class: cls })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView)
  },
})

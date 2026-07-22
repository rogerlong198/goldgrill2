"use client"

import { useRef, useState } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import { ResizableImage } from "./tiptap-resizable-image"
import { upload } from "@vercel/blob/client"
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image as ImageIcon,
  Video as VideoIcon,
  Undo,
  Redo,
} from "lucide-react"
import { Video } from "@/lib/tiptap-video-extension"

const MAX_IMAGE_MB = 15
const MAX_VIDEO_MB = 100

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent ${
        active ? "bg-muted text-foreground" : ""
      }`}
    >
      {children}
    </button>
  )
}

export function RichTextEditor({
  value,
  onChange,
  blobOk,
}: {
  value: string
  onChange: (html: string) => void
  blobOk: boolean
}) {
  const [uploading, setUploading] = useState<"image" | "video" | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, autolink: true },
      }),
      ResizableImage,
      Video,
      Placeholder.configure({ placeholder: "Escreva a descrição do produto…" }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "prose-sm max-w-none min-h-[140px] px-3 py-2 text-sm text-foreground outline-none",
      },
    },
  })

  async function handleFile(file: File, kind: "image" | "video") {
    if (!editor) return
    const maxMb = kind === "image" ? MAX_IMAGE_MB : MAX_VIDEO_MB
    if (file.size > maxMb * 1024 * 1024) {
      alert(`Arquivo muito grande. Envie um(a) ${kind === "image" ? "imagem" : "vídeo"} de até ${maxMb}MB.`)
      return
    }
    setUploading(kind)
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/admin/upload",
        clientPayload: kind,
      })
      if (kind === "image") {
        editor.chain().focus().setImage({ src: blob.url }).run()
      } else {
        editor.chain().focus().setVideo(blob.url).run()
      }
    } catch (e: any) {
      alert(e?.message || "Erro ao enviar o arquivo.")
    } finally {
      setUploading(null)
    }
  }

  if (!editor) return null

  return (
    <div className="mt-1 overflow-hidden rounded-lg border border-border bg-background focus-within:ring-2 focus-within:ring-primary/40">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 px-1.5 py-1">
        <ToolbarButton
          title="Negrito"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Itálico"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Sublinhado"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton
          title="Título"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Subtítulo"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton
          title="Lista com marcadores"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Lista numerada"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Link"
          active={editor.isActive("link")}
          onClick={() => {
            const url = window.prompt("URL do link:", editor.getAttributes("link").href || "https://")
            if (url === null) return
            if (url === "") {
              editor.chain().focus().unsetLink().run()
            } else {
              editor.chain().focus().setLink({ href: url }).run()
            }
          }}
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton
          title={blobOk ? "Inserir imagem" : "Configure o Vercel Blob pra habilitar upload"}
          disabled={!blobOk || uploading !== null}
          onClick={() => imageInputRef.current?.click()}
        >
          <ImageIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title={blobOk ? "Inserir vídeo" : "Configure o Vercel Blob pra habilitar upload"}
          disabled={!blobOk || uploading !== null}
          onClick={() => videoInputRef.current?.click()}
        >
          <VideoIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton title="Desfazer" onClick={() => editor.chain().focus().undo().run()}>
          <Undo className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Refazer" onClick={() => editor.chain().focus().redo().run()}>
          <Redo className="h-3.5 w-3.5" />
        </ToolbarButton>
        {uploading && (
          <span className="ml-auto pr-1 text-[11px] font-medium text-muted-foreground">
            Enviando {uploading === "image" ? "imagem" : "vídeo"}…
          </span>
        )}
      </div>

      <EditorContent editor={editor} />

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ""
          if (file) handleFile(file, "image")
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ""
          if (file) handleFile(file, "video")
        }}
      />

      {!blobOk && (
        <p className="border-t border-border bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800">
          Upload de imagem/vídeo desativado — configure o Vercel Blob (BLOB_READ_WRITE_TOKEN) pra habilitar.
        </p>
      )}
    </div>
  )
}

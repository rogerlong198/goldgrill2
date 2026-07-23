"use client"

import { useEffect, useRef, useState } from "react"
import { Expand } from "lucide-react"

interface ProductGalleryProps {
  images: string[]
  name: string
}

// Distância mínima (px) pra um arrasto contar como troca de foto — abaixo
// disso é toque/rolagem, não swipe.
const SWIPE_THRESHOLD = 40

export function ProductGallery({ images, name }: ProductGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const thumbStripRef = useRef<HTMLDivElement>(null)

  function goTo(next: number) {
    if (!images.length) return
    setCurrentIndex(((next % images.length) + images.length) % images.length)
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    touchStartX.current = null
    touchStartY.current = null
    // Só troca se o gesto foi mais horizontal que vertical — senão o usuário
    // estava rolando a página e trocar a foto seria um efeito indesejado.
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return
    goTo(dx < 0 ? currentIndex + 1 : currentIndex - 1)
  }

  // Mantém a miniatura ativa visível na faixa quando a foto muda por swipe/seta.
  useEffect(() => {
    const strip = thumbStripRef.current
    const active = strip?.children[currentIndex] as HTMLElement | undefined
    active?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
  }, [currentIndex])

  return (
    <div className="relative bg-[#ffffff] md:flex md:items-start md:gap-4 md:flex-row-reverse">
      {/* Main image */}
      <div className="relative aspect-square bg-[#ffffff] md:bg-[#f5f5f5] rounded-2xl md:rounded-2xl flex-1 flex items-center justify-center p-6 md:p-0 overflow-hidden group">
        <div
          className="relative w-full h-full md:hidden"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <img
            src={images[currentIndex]}
            alt={name}
            draggable={false}
            className="absolute inset-0 w-full h-full object-contain rounded-2xl select-none"
          />
        </div>
        <img
          src={images[currentIndex]}
          alt={name}
          className="hidden md:block w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 rounded-2xl"
        />

        {/* Expand button */}
        <button
          className="absolute bottom-4 left-4 p-2 bg-[#ffffff] rounded-full shadow-md hover:shadow-lg transition-shadow"
          aria-label="Ampliar imagem"
        >
          <Expand size={16} className="text-[#1a1a1a]" />
        </button>

        {/* Desktop Navigation Arrows */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))
          }}
          className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 backdrop-blur items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white shadow-sm text-[#1a1a1a]"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))
          }}
          className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 backdrop-blur items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white shadow-sm text-[#1a1a1a]"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      </div>

      {/* Thumbnails Desktop */}
      <div className="hidden md:flex flex-col gap-3 w-20 shrink-0 h-[calc(100vh-140px)] max-h-[700px] overflow-y-auto pr-1 pb-4" style={{ scrollbarWidth: 'none' }}>
        {images.map((img, i) => (
          <button
            key={i}
            onClick={() => setCurrentIndex(i)}
            className={`relative w-20 h-20 rounded-xl overflow-hidden border-2 transition-colors shrink-0 ${i === currentIndex ? "border-[#1a1a1a]" : "border-transparent"
              }`}
          >
            <img src={img} alt={`Thumbnail ${i + 1}`} className="w-full h-full object-cover" />
          </button>
        ))}
      </div>

      {/* Contador + dots: só quando há mais de uma imagem (evita "1/1" e vazio) */}
      {images.length > 1 && (
        <div className="md:hidden">
          <div className="flex items-center justify-center gap-1 py-3 text-xs text-[#737373]">
            <span>{currentIndex + 1}</span>
            <span>/</span>
            <span>{images.length}</span>
          </div>

          {/* Miniaturas: rolam na horizontal e trocam a foto ao toque. */}
          <div
            ref={thumbStripRef}
            className="scrollbar-hide flex gap-2 overflow-x-auto px-4 pb-4"
          >
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                aria-label={`Imagem ${i + 1}`}
                className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                  i === currentIndex ? "border-[#1a1a1a]" : "border-[#e5e5e5]"
                }`}
              >
                <img
                  src={img}
                  alt={`Miniatura ${i + 1}`}
                  draggable={false}
                  className="h-full w-full select-none object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

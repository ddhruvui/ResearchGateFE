import { useEffect, useRef, useState } from 'react'

/**
 * Jump links to every section, pinned under the app bar. The current section is
 * highlighted as you scroll, and its chip is kept in view on narrow screens.
 */
export default function SectionNav ({ sections, topRef }) {
  const [active, setActive] = useState(sections[0]?.id)
  const navRef = useRef(null)
  const ids = sections.map(s => s.id).join(',')

  useEffect(() => {
    let raf = 0
    const update = () => {
      const line = (topRef.current?.offsetHeight || 0) + 48
      const list = ids.split(',').map(id => document.getElementById(id)).filter(Boolean)
      if (!list.length) return
      let cur = list[0].id
      for (const el of list) if (el.getBoundingClientRect().top <= line) cur = el.id
      const doc = document.documentElement
      if (window.innerHeight + window.scrollY >= doc.scrollHeight - 4) cur = list[list.length - 1].id
      setActive(cur)
    }
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [ids, topRef])

  useEffect(() => {                    // keep the active chip visible in a scrolled nav
    const nav = navRef.current
    const chip = nav?.querySelector(`a[href="#${active}"]`)
    if (!nav || !chip) return
    const l = chip.offsetLeft, r = l + chip.offsetWidth
    if (l < nav.scrollLeft) nav.scrollLeft = l - 14
    else if (r > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = r - nav.clientWidth + 14
  }, [active])

  const go = (e, id) => {
    const el = document.getElementById(id)
    if (!el) return
    e.preventDefault()
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    setActive(id)
  }

  return (
    <nav className="nav" ref={navRef} aria-label="Dashboard sections">
      {sections.map(s => (
        <a key={s.id} href={`#${s.id}`} aria-current={active === s.id ? 'true' : undefined}
           onClick={e => go(e, s.id)}>{s.label}</a>
      ))}
    </nav>
  )
}

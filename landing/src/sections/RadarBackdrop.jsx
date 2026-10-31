// Decorative radar for the hero: rings + crosshair (CSS), a rotating sweep, and
// blips that pulse as the sweep passes them. Purely visual, hidden from AT.

// Position (% of box), and delay so each blip lights up as the 6s sweep reaches it.
// Sweep starts at 12 o'clock and rotates clockwise, so delay = (angle / 360) * 6s.
const BLIPS = [
  { x: 71, y: 30, delay: '0.8s' },
  { x: 80, y: 62, delay: '2.6s' },
  { x: 38, y: 78, delay: '3.9s' },
  { x: 22, y: 44, delay: '5.2s' },
  { x: 58, y: 18, delay: '0.2s' },
]

export default function RadarBackdrop() {
  return (
    <div aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-[44%] -z-10 aspect-square w-[min(1100px,150vw)] -translate-x-1/2 -translate-y-1/2 opacity-70 [mask-image:radial-gradient(circle,#000_30%,transparent_68%)] [-webkit-mask-image:radial-gradient(circle,#000_30%,transparent_68%)]">
      <div className="radar-grid absolute inset-0" />
      <div className="radar-sweep animate-sweep absolute inset-0" />
      {BLIPS.map((b, i) => (
        <span key={i}
          className="animate-blip absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400 shadow-[0_0_10px_2px_rgb(46_229_138/0.7)] opacity-0"
          style={{ left: `${b.x}%`, top: `${b.y}%`, animationDelay: b.delay }} />
      ))}
    </div>
  )
}

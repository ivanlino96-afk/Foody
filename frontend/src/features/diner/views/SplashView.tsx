import type { CSSProperties } from 'react'

const abs = (s: CSSProperties): CSSProperties => ({ position: 'absolute', ...s })
const crumb = (left: number, top: number, color: string) => (
  <span style={abs({ left, top, width: 6, height: 3, borderRadius: 999, background: color })} />
)

function Sandwich() {
  return (
    <div className="relative h-[150px] w-[150px]">
      <div role="img" aria-label="Un sándwich se arma capa por capa"
        style={abs({ left: -75, top: -75, width: 300, height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'scale(0.5)' })}>
        <div style={abs({ width: 280, height: 280, borderRadius: 999, background: '#3A5A47' })} />
        <div style={abs({ bottom: 80, width: 250, height: 12, borderRadius: 999, background: 'rgba(0,0,0,0.18)' })} />
        <div className="stack" style={abs({ left: 0, right: 0, bottom: 86, height: 200 })}>
          <div className="l0" style={abs({ left: 35, bottom: 0, width: 230, height: 30, boxSizing: 'border-box', borderRadius: 8, background: '#C99A62', border: '4px solid #8A5A32' })}>
            {crumb(30, 6, '#6B4423')}{crumb(80, 12, '#EAD7B0')}{crumb(130, 5, '#6B4423')}{crumb(175, 11, '#EAD7B0')}
          </div>
          <div className="l1" style={abs({ left: 26, bottom: 28, width: 248, height: 14, display: 'flex' })}>
            {['#4F7F45', '#6E9A5B', '#4F7F45', '#6E9A5B', '#4F7F45'].map((c, i) => (
              <span key={i} style={{ flex: 1, borderRadius: 999, background: c, marginLeft: i ? -14 : 0 }} />
            ))}
          </div>
          <div className="l2" style={abs({ left: 44, bottom: 40, width: 212, height: 12, display: 'flex', gap: 6 })}>
            {[0, 1, 2].map((i) => <span key={i} style={{ flex: 1, borderRadius: 6, background: '#D2553F' }} />)}
          </div>
          <div className="l3" style={abs({ left: 40, bottom: 51, width: 220, height: 12, display: 'flex', gap: 4 })}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} style={{ flex: 1, boxSizing: 'border-box', borderRadius: 6, background: '#DCEBC4', border: '3px solid #4F7F45' }} />
            ))}
          </div>
          <div className="l4" style={abs({ left: 36, bottom: 62, width: 228, height: 14, display: 'flex' })}>
            {['#EBC3A8', '#F2D2BC', '#EBC3A8'].map((c, i) => (
              <span key={i} style={{ flex: 1, borderRadius: 999, background: c, marginLeft: i ? -16 : 0 }} />
            ))}
          </div>
          <div className="l5" style={abs({ left: 46, bottom: 75, width: 208, height: 18 })}>
            <div style={abs({ left: 0, right: 0, bottom: 0, height: 12, display: 'flex', gap: 4 })}>
              {[0, 1, 2].map((i) => (
                <span key={i} style={{ flex: 1, borderRadius: 6, background: '#A9C46C', boxShadow: 'inset 0 -3px 0 #6E9A5B' }} />
              ))}
            </div>
            {[[20, -20], [60, 15], [100, -10], [140, 20], [180, -15]].map(([left, deg]) => (
              <span key={left} style={abs({ left, top: 0, width: 2, height: 9, background: '#F4EFD8', transform: `rotate(${deg}deg)` })} />
            ))}
          </div>
          <div className="l6" style={abs({ left: 35, bottom: 92, width: 230, height: 30, boxSizing: 'border-box', borderRadius: '12px 12px 8px 8px', background: '#C99A62', border: '4px solid #8A5A32' })}>
            {crumb(40, 6, '#EAD7B0')}{crumb(92, 12, '#6B4423')}{crumb(140, 6, '#EAD7B0')}{crumb(186, 12, '#6B4423')}
          </div>
        </div>
      </div>
    </div>
  )
}

export function SplashView({ tableLine, onSkip }: { tableLine: string; onSkip: () => void }) {
  return (
    <div className="splash fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 overflow-hidden bg-bosque text-white" role="status">
      <Sandwich />
      <div className="logo flex flex-col items-center gap-1.5">
        <span className="text-[40px] font-extrabold tracking-[-0.04em]">foody<span className="text-[#D6A262]">.</span></span>
        {tableLine && <span className="text-[15px] font-medium text-[#D5E2D8]">{tableLine}</span>}
      </div>
      <div className="absolute bottom-16 flex flex-col items-center gap-3">
        <div aria-hidden="true" className="flex gap-2">
          {['d1', 'd2', 'd3'].map((d) => <span key={d} className={`${d} h-2 w-2 rounded-full bg-hoja`} />)}
        </div>
        <span className="text-sm font-semibold text-[#D5E2D8]">Preparando tu menú</span>
        <button type="button" onClick={onSkip} className="min-h-11 border-0 bg-transparent px-4 text-sm font-bold text-hoja">Saltar</button>
      </div>
    </div>
  )
}

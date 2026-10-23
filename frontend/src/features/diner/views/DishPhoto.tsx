import { photoUrl } from '../../../data/photos'

const TINTS = ['#E6D6C2', '#D5DFC9', '#DCD3C3', '#E3DED3']

export function DishPhoto({ path, name, className = '' }: { path: string | null; name: string; className?: string }) {
  const url = photoUrl(path)
  const tint = TINTS[name.length % TINTS.length]
  return url
    ? <img src={url} alt={name} loading="lazy" className={`object-cover ${className}`} />
    : <div role="img" aria-label={name} className={className} style={{ background: tint }} />
}

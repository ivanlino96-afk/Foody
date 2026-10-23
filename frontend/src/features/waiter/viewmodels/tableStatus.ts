import type { TableStatus } from '../../../domain/types'

export const TABLE_STATUS: Record<TableStatus, { label: string; color: string; fg: string }> = {
  free: { label: 'Libre', color: '#CFC8BA', fg: '#5A615B' },
  occupied: { label: 'Ocupada', color: '#5B7FA6', fg: '#2B4A6B' },
  awaiting_order: { label: 'En espera de orden', color: '#B98552', fg: '#6F4A22' },
  served: { label: 'Orden servida', color: '#5E8C6A', fg: '#24392C' },
  bill_requested: { label: 'Cuenta solicitada', color: '#E11D48', fg: '#9F1239' },
  closed: { label: 'Cerrada', color: '#77736A', fg: '#44483F' },
}

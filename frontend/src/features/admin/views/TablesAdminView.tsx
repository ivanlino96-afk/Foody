import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import type { AdminTable } from '../../../domain/staffTypes'
import { Button } from '../../../shared/ui/Button'
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog'
import { Notice } from '../../../shared/ui/Notice'
import { TABLE_STATUS } from '../../waiter/viewmodels/tableStatus'
import { AdminTitle, CARD } from '../AdminLayout'
import { useTablesAdminViewModel } from '../viewmodels/useTablesAdminViewModel'
import { Field } from './fields'

function PrintSheet({ table, qr, url, onClose }: { table: AdminTable; qr: string; url: string; onClose: () => void }) {
  return createPortal(
    <div className="print-sheet fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white p-8 text-center text-carbon">
      <span className="text-3xl font-extrabold tracking-tight">foody<span className="text-madera">.</span></span>
      <img src={qr} alt={`QR de la mesa ${table.code}`} className="size-72" />
      <span className="text-5xl font-extrabold">{table.code}</span>
      <span className="text-sm break-all text-musgo">{url}</span>
      <p className="m-0 text-base">Escanea para ver el menú y ordenar desde tu mesa.</p>
      <div className="flex gap-2 print:hidden">
        <Button variant="soft" onClick={onClose}>Cerrar</Button>
        <Button onClick={() => window.print()}>Imprimir</Button>
      </div>
    </div>,
    document.body,
  )
}

export function TablesAdminView() {
  const vm = useTablesAdminViewModel()
  const [printing, setPrinting] = useState<AdminTable | null>(null)
  const [qrError, setQrError] = useState<string | null>(null)
  const printQr = printing ? vm.qrFor(printing) : null

  const showQr = async (t: AdminTable) => {
    setQrError(null)
    try {
      await vm.loadQr(t)
    } catch {
      setQrError(`No se pudo generar el QR de ${t.code}`)
    }
  }

  return (
    <>
      <AdminTitle title="Mesas y QR">
        <Link to="/admin/plano" className="text-sm font-semibold text-bosque">Ubica mesas y áreas en el plano →</Link>
      </AdminTitle>
      <Notice text={vm.notice ?? qrError} onClose={() => { vm.dismissNotice(); setQrError(null) }} />
      <form className={`${CARD} grid grid-cols-2 items-start gap-3 md:grid-cols-[140px_1fr_1fr_120px_auto]`}
        onSubmit={(e) => { e.preventDefault(); void vm.saveForm() }}>
        <Field label="Código" value={vm.form.code} maxLength={20} error={vm.formErrors.code} onChange={(e) => vm.setForm({ ...vm.form, code: e.target.value })} />
        <Field label="Nombre (opcional)" value={vm.form.label} maxLength={80} onChange={(e) => vm.setForm({ ...vm.form, label: e.target.value })} />
        <Field label="Zona" value={vm.form.zone} maxLength={40} onChange={(e) => vm.setForm({ ...vm.form, zone: e.target.value })} />
        <Field label="Lugares" inputMode="numeric" value={vm.form.capacity} error={vm.formErrors.capacity} onChange={(e) => vm.setForm({ ...vm.form, capacity: e.target.value })} />
        <div className="flex gap-2 self-end">
          {vm.form.id && <Button variant="soft" className="!min-h-11 !py-2" onClick={vm.resetForm}>Cancelar</Button>}
          <Button type="submit" className="!min-h-11 !py-2">{vm.form.id ? 'Guardar' : 'Agregar mesa'}</Button>
        </div>
      </form>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {vm.tables.map((t) => {
          const qr = vm.qrFor(t)
          const status = TABLE_STATUS[t.status]
          return (
            <section key={t.id} className={`${CARD} flex flex-col gap-3`}>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-extrabold">{t.code}</span>
                <span className="text-sm text-musgo">{[t.label, t.zone, t.capacity && `${t.capacity} lug.`].filter(Boolean).join(' · ')}</span>
                <span className="ml-auto text-xs font-bold" style={{ color: status.fg }}>{status.label}</span>
              </div>
              {qr ? <img src={qr} alt={`QR de la mesa ${t.code}`} className="size-40 self-center" />
                : <Button variant="soft" className="!min-h-11 !py-2" onClick={() => void showQr(t)}>Ver QR</Button>}
              <div className="flex flex-wrap gap-1">
                <button type="button" className="min-h-11 rounded-lg px-3 text-sm font-semibold hover:bg-avena"
                  onClick={async () => { await showQr(t); setPrinting(t) }}>Imprimir</button>
                <button type="button" className="min-h-11 rounded-lg px-3 text-sm font-semibold hover:bg-avena" onClick={() => vm.editTable(t)}>Editar</button>
                <button type="button" className="min-h-11 rounded-lg px-3 text-sm font-semibold hover:bg-avena" onClick={() => vm.askRegenerate(t)}>Regenerar QR</button>
                <button type="button" className="ml-auto min-h-11 rounded-lg px-2 text-sm font-semibold text-[#B42318]" onClick={() => vm.askDelete(t)}>Borrar</button>
              </div>
            </section>
          )
        })}
      </div>
      {vm.pendingDelete && (
        <ConfirmDialog title={`¿Borrar la mesa ${vm.pendingDelete.code}?`} body="Solo se puede borrar si está libre. Su QR deja de funcionar."
          confirmLabel="Borrar" onCancel={vm.cancelDelete} onConfirm={() => void vm.confirmDelete()} />
      )}
      {vm.pendingRegenerate && (
        <ConfirmDialog title={`¿Regenerar el QR de ${vm.pendingRegenerate.code}?`}
          body="El QR impreso actual dejará de funcionar y tendrás que imprimir el nuevo."
          confirmLabel="Regenerar" onCancel={vm.cancelRegenerate} onConfirm={() => void vm.confirmRegenerate()} />
      )}
      {printing && printQr && <PrintSheet table={printing} qr={printQr} url={vm.dinerUrl(printing)} onClose={() => setPrinting(null)} />}
    </>
  )
}

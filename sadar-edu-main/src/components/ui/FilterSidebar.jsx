import { ChevronDown } from 'lucide-react';

function Field({ label, value, disabled = false }) {
  return <label className="filter-field"><span>{label}</span><div className={disabled ? 'filter-disabled' : ''}>{value}<ChevronDown size={16}/></div></label>;
}

export default function FilterSidebar({ disabled = false, onReset }) {
  return <div className="filter-sidebar-content">
    <h2>Persempit pencarian</h2>
    <Field label="Provinsi" value="Pilih provinsi" />
    <Field label="Kabupaten / kota" value="Pilih provinsi dahulu" disabled />
    <Field label="Kecamatan" value="Pilih kabupaten dahulu" disabled />
    <hr />
    <Field label="Jenjang" value="Semua jenjang" />
    <Field label="Status sekolah" value="Semua status" />
    <button className="filter-apply" disabled={disabled}>Terapkan filter</button>
    <button className="filter-reset" onClick={onReset}>Hapus semua filter</button>
    <p className="filter-hint">Filter wilayah mengikuti pilihan sebelumnya.</p>
  </div>;
}

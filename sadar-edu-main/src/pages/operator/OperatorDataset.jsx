/**
 * ============================================================================
 * HALAMAN: Kelola Dataset & Pembaruan Data Sekolah (Operator)
 * ============================================================================
 * Menyediakan 2 fungsi operasional utama:
 * 1. TAB RIWAYAT & GONTA-GANTI VERSI DATASET:
 *    - Mengelola multi-versi dataset per tahun (misal: 2024, 2026, 2028).
 *    - Mengaktifkan / menonaktifkan versi dataset sebagai acuan analisis & peta.
 *    - Ekspor data aktif ke format .CSV dan .GeoJSON untuk backup / laporan.
 *    - Hapus dataset usang dari database PostgreSQL (DELETE /api/v1/dataset/:id).
 * 
 * 2. TAB EDIT CEPAT SATUAN SEKOLAH (Single School Edit):
 *    - Mencari sekolah berdasarkan nama atau NPSN secara real-time dari DB.
 *    - Memperbarui nama sekolah, alamat, status, jenjang, atau koordinat
 *      langsung ke PostgreSQL (PUT /api/v1/sekolah/:id) tanpa re-upload CSV.
 * ============================================================================
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Check,
  Database,
  Download,
  FileSpreadsheet,
  History,
  Image as ImageIcon,
  Info,
  Pencil,
  Plus,
  RefreshCw,
  School,
  Search,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
} from 'lucide-react';
import { useOperatorStore } from '../../store/useOperatorStore';
import {
  BTN_OUTLINE,
  BTN_PRIMARY,
  CARD,
  Dialog,
  EMPTY,
  FOCUS,
  PageHeader,
  StatusPill,
  TD,
  TH,
} from '../../components/operator/ui';

const REQUIREMENTS = [
  { title: 'NPSN', text: 'String unik; nol di depan dipertahankan' },
  { title: 'Identitas', text: 'Nama sekolah wajib terisi' },
  { title: 'Koordinat Spasial', text: 'Format desimal WGS84 (Lat, Lng) Kab. Bogor' },
  { title: 'Numerik', text: 'Jumlah siswa/guru bernilai riil (tidak dipaksa 0)' },
  { title: 'Provenance & Versi', text: 'Tahun periode (mis. 2026, 2028), sumber, dan lisensi' },
];

export default function OperatorDataset() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Store state & actions
  const versions = useOperatorStore((state) => state.versions);
  const fetchDatasets = useOperatorStore((state) => state.fetchDatasets);
  const toggleDatasetActive = useOperatorStore((state) => state.toggleDatasetActive);
  const deleteDatasetById = useOperatorStore((state) => state.deleteDatasetById);
  const exportDataAsCsv = useOperatorStore((state) => state.exportDataAsCsv);
  const exportDataAsGeoJson = useOperatorStore((state) => state.exportDataAsGeoJson);
  const searchSchools = useOperatorStore((state) => state.searchSchools);
  const updateSingleSchool = useOperatorStore((state) => state.updateSingleSchool);
  const createSingleSchool = useOperatorStore((state) => state.createSingleSchool);
  const deleteSingleSchool = useOperatorStore((state) => state.deleteSingleSchool);

  // Tab state: 'versions' (Riwayat & Versi) vs 'single-edit' (Edit Cepat Satuan)
  const [activeTab, setActiveTab] = useState('versions');

  // Filter state untuk tab Riwayat Versi
  const query = searchParams.get('q') ?? '';
  const [yearFilter, setYearFilter] = useState('');
  const [togglingId, setTogglingId] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  // Modal konfirmasi hapus dataset
  const [deletingDataset, setDeletingDataset] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // State untuk tab Edit Cepat Satuan Sekolah
  const [schoolSearchQuery, setSchoolSearchQuery] = useState('');
  const [isSearchingSchools, setIsSearchingSchools] = useState(false);
  const [schoolResults, setSchoolResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Modal edit single school
  const [editingSchool, setEditingSchool] = useState(null);
  const [editForm, setEditForm] = useState({
    nama_sekolah: '',
    npsn: '',
    status_sekolah: 'Negeri',
    jenjang: 'SMP',
    alamat: '',
    latitude: '',
    longitude: '',
    jumlah_siswa: '',
    foto_url: '',
  });
  const [isSavingSchool, setIsSavingSchool] = useState(false);
  const [editSchoolError, setEditSchoolError] = useState('');

  // Modal tambah single school baru (Create)
  const [isAddingSchool, setIsAddingSchool] = useState(false);
  const [addForm, setAddForm] = useState({
    nama_sekolah: '',
    npsn: '',
    status_sekolah: 'Negeri',
    jenjang: 'SMP',
    alamat: '',
    latitude: '',
    longitude: '',
    jumlah_siswa: '',
    foto_url: '',
  });
  const [isCreatingSchool, setIsCreatingSchool] = useState(false);

  // Modal konfirmasi hapus single school (Delete)
  const [deletingSchoolItem, setDeletingSchoolItem] = useState(null);
  const [isDeletingSchool, setIsDeletingSchool] = useState(false);

  const schoolNameInputRef = useRef(null);

  // Load datasets on mount
  useEffect(() => {
    fetchDatasets();
  }, [fetchDatasets]);

  // Handler Ekspor CSV
  const handleExportCsv = async () => {
    setIsExporting(true);
    setActionMessage(null);
    const res = await exportDataAsCsv();
    setIsExporting(false);
    if (res.success) {
      setActionMessage({
        type: 'success',
        text: `Berhasil mengunduh ${res.count} data sekolah aktif dalam format CSV.`,
      });
    } else {
      setActionMessage({ type: 'error', text: res.message });
    }
  };

  // Handler Unduh GeoJSON
  const handleExportGeoJson = async () => {
    setIsExporting(true);
    setActionMessage(null);
    const res = await exportDataAsGeoJson();
    setIsExporting(false);
    if (res.success) {
      setActionMessage({
        type: 'success',
        text: 'Berhasil mengunduh file spasial GeoJSON data sekolah.',
      });
    } else {
      setActionMessage({ type: 'error', text: res.message });
    }
  };

  // Handler Hapus Dataset
  const handleConfirmDelete = async () => {
    if (!deletingDataset?.id_dataset) return;
    setIsDeleting(true);
    const res = await deleteDatasetById(deletingDataset.id_dataset);
    setIsDeleting(false);
    const deletedName = deletingDataset.name;
    setDeletingDataset(null);
    if (res.success) {
      setActionMessage({
        type: 'success',
        text: `Dataset "${deletedName}" dan seluruh data spasialnya berhasil dihapus dari database.`,
      });
    } else {
      setActionMessage({ type: 'error', text: res.message });
    }
  };

  // Ekstrak daftar tahun unik untuk filter
  const availableYears = useMemo(() => {
    const set = new Set();
    versions.forEach((v) => {
      if (v.period && v.period !== EMPTY) set.add(String(v.period));
    });
    return Array.from(set).sort((a, b) => Number(b) - Number(a));
  }, [versions]);

  // Filter baris versi dataset
  const filteredVersions = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return versions.filter((row) => {
      if (yearFilter !== '' && String(row.period) !== yearFilter) return false;
      if (!keyword) return true;
      return `${row.name} ${row.source} ${row.period} ${row.kategori ?? ''}`.toLowerCase().includes(keyword);
    });
  }, [versions, query, yearFilter]);

  // Handler toggle aktif versi dataset
  const handleToggleActive = async (row) => {
    if (!row.id_dataset) return;
    const nextAktif = !row.aktif;
    setTogglingId(row.id_dataset);
    setActionMessage(null);

    const res = await toggleDatasetActive(row.id_dataset, nextAktif);
    setTogglingId(null);
    if (res.success) {
      setActionMessage({
        type: 'success',
        text: `Versi "${row.name}" (${row.period || 'Aktif'}) kini berstatus ${nextAktif ? 'AKTIF' : 'NONAKTIF'}.`,
      });
    } else {
      setActionMessage({ type: 'error', text: res.message });
    }
  };

  // Handler pencarian sekolah satuan
  const handleSearchSchools = async (searchKeyword) => {
    const q = typeof searchKeyword === 'string' ? searchKeyword : schoolSearchQuery;
    if (!q.trim()) return;

    setIsSearchingSchools(true);
    setHasSearched(true);
    setActionMessage(null);

    const results = await searchSchools(q.trim());
    setSchoolResults(results);
    setIsSearchingSchools(false);
  };

  // Buka modal edit untuk 1 sekolah
  const handleOpenEdit = (school) => {
    setEditingSchool(school);
    setEditForm({
      nama_sekolah: school.nama_sekolah || '',
      npsn: school.npsn || '',
      status_sekolah: school.status_sekolah || 'Negeri',
      jenjang: school.jenjang || 'SMP',
      alamat: school.alamat || '',
      latitude: school.latitude !== null ? String(school.latitude) : '',
      longitude: school.longitude !== null ? String(school.longitude) : '',
      jumlah_siswa: school.jumlah_siswa ? String(school.jumlah_siswa) : '0',
      foto_url: school.foto_url || '',
    });
    setEditSchoolError('');
  };

  // Simpan update satu sekolah ke backend PostgreSQL PostGIS
  const handleSaveSingleSchool = async (e) => {
    e.preventDefault();
    if (!editingSchool) return;

    if (!editForm.nama_sekolah.trim()) {
      setEditSchoolError('Nama sekolah wajib diisi.');
      return;
    }

    const lat = editForm.latitude ? parseFloat(editForm.latitude) : null;
    const lng = editForm.longitude ? parseFloat(editForm.longitude) : null;

    if (lat !== null && (isNaN(lat) || lat < -7.0 || lat > -6.2)) {
      setEditSchoolError('Latitude harus dalam rentang Kabupaten Bogor (~ -6.2 s.d -7.0).');
      return;
    }
    if (lng !== null && (isNaN(lng) || lng < 106.4 || lng > 107.2)) {
      setEditSchoolError('Longitude harus dalam rentang Kabupaten Bogor (~ 106.4 s.d 107.2).');
      return;
    }

    setIsSavingSchool(true);
    setEditSchoolError('');

    const payload = {
      nama_sekolah: editForm.nama_sekolah.trim(),
      status_sekolah: editForm.status_sekolah,
      jenjang: editForm.jenjang,
      alamat: editForm.alamat.trim(),
      ...(lat !== null && lng !== null ? { latitude: lat, longitude: lng } : {}),
      jumlah_siswa: parseInt(editForm.jumlah_siswa, 10) || 0,
      foto_url: editForm.foto_url.trim() || null,
    };

    const res = await updateSingleSchool(editingSchool.id_sekolah, payload);
    setIsSavingSchool(false);

    if (res.success) {
      // Update hasil di tabel sekolah secara lokal
      setSchoolResults((prev) =>
        prev.map((s) =>
          s.id_sekolah === editingSchool.id_sekolah
            ? { ...s, ...payload, latitude: lat ?? s.latitude, longitude: lng ?? s.longitude }
            : s
        )
      );
      setEditingSchool(null);
      setActionMessage({
        type: 'success',
        text: `Data sekolah "${payload.nama_sekolah}" berhasil diperbarui di PostgreSQL.`,
      });
    } else {
      setEditSchoolError(res.message);
    }
  };

  // Tambah satu sekolah baru (CREATE)
  const handleCreateSchool = async (e) => {
    e.preventDefault();
    if (!addForm.nama_sekolah.trim() || !addForm.npsn.trim()) {
      setEditSchoolError('NPSN dan Nama sekolah wajib diisi.');
      return;
    }
    const lat = addForm.latitude ? parseFloat(addForm.latitude) : -6.589;
    const lng = addForm.longitude ? parseFloat(addForm.longitude) : 106.793;

    if (isNaN(lat) || lat < -7.0 || lat > -6.2 || isNaN(lng) || lng < 106.4 || lng > 107.2) {
      setEditSchoolError('Koordinat harus dalam rentang Kabupaten Bogor (Lat: -6.2 s.d -7.0, Lng: 106.4 s.d 107.2).');
      return;
    }

    setIsCreatingSchool(true);
    setEditSchoolError('');

    const payload = {
      npsn: addForm.npsn.trim(),
      nama_sekolah: addForm.nama_sekolah.trim(),
      status_sekolah: addForm.status_sekolah,
      jenjang: addForm.jenjang,
      alamat: addForm.alamat.trim(),
      latitude: lat,
      longitude: lng,
      jumlah_siswa: parseInt(addForm.jumlah_siswa, 10) || 0,
      foto_url: addForm.foto_url.trim() || null,
    };

    const res = await createSingleSchool(payload);
    setIsCreatingSchool(false);

    if (res.success) {
      setIsAddingSchool(false);
      handleSearchSchools(payload.nama_sekolah);
      setActionMessage({
        type: 'success',
        text: `Sekolah baru "${payload.nama_sekolah}" (NPSN: ${payload.npsn}) berhasil ditambahkan ke database.`,
      });
    } else {
      setEditSchoolError(res.message);
    }
  };

  // Hapus satu sekolah (DELETE)
  const handleConfirmDeleteSchool = async () => {
    if (!deletingSchoolItem) return;
    setIsDeletingSchool(true);
    const res = await deleteSingleSchool(deletingSchoolItem.id_sekolah, deletingSchoolItem.nama_sekolah);
    setIsDeletingSchool(false);

    if (res.success) {
      setSchoolResults((prev) => prev.filter((s) => s.id_sekolah !== deletingSchoolItem.id_sekolah));
      setDeletingSchoolItem(null);
      setActionMessage({
        type: 'success',
        text: res.message,
      });
    } else {
      setActionMessage({
        type: 'error',
        text: res.message,
      });
    }
  };

  return (
    <div className="operator-dataset flex flex-col gap-5 p-4 sm:p-7">
      <PageHeader
        eyebrow="Dataset & Riwayat Spasial"
        title="Kelola Dataset & Data Sekolah"
        description="Kelola versi dataset berkala (perubahan massal per tahun seperti 2026, 2028) atau ubah data sekolah satuan secara instan di PostgreSQL."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={isExporting}
              className={`${BTN_OUTLINE} flex items-center gap-1.5`}
            >
              <Download size={15} />
              {isExporting ? 'Mengekspor...' : 'Ekspor CSV'}
            </button>
            <button
              type="button"
              onClick={handleExportGeoJson}
              disabled={isExporting}
              className={`${BTN_OUTLINE} flex items-center gap-1.5`}
            >
              <FileSpreadsheet size={15} />
              Unduh GeoJSON
            </button>
            <button
              type="button"
              onClick={() => navigate('/operator/dataset/impor')}
              className={`${BTN_PRIMARY} flex items-center gap-2`}
            >
              <Database size={16} />
              Impor Versi Baru (Massal)
            </button>
          </div>
        }
      />

      {/* Tab Switcher */}
      <div className="flex border-b border-[#d7e1e8]">
        <button
          type="button"
          onClick={() => setActiveTab('versions')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors ${
            activeTab === 'versions'
              ? 'border-[#1b4965] text-[#1b4965]'
              : 'border-transparent text-[#445665] hover:text-[#173042]'
          }`}
        >
          <History size={16} />
          Riwayat & Gonta-Ganti Versi Dataset
          <span className="rounded-full bg-[#edf3f6] px-2 py-0.5 text-xs text-[#173042]">
            {versions.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('single-edit');
            if (!hasSearched && schoolResults.length === 0) {
              handleSearchSchools('SMP');
            }
          }}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors ${
            activeTab === 'single-edit'
              ? 'border-[#1b4965] text-[#1b4965]'
              : 'border-transparent text-[#445665] hover:text-[#173042]'
          }`}
        >
          <School size={16} />
          Edit Cepat Satuan Sekolah (Update Nama / Atribut)
        </button>
      </div>

      {/* Global Action Feedback Message */}
      {actionMessage && (
        <div
          role="status"
          className={`flex items-center justify-between rounded-lg px-4 py-3 text-xs font-medium leading-5 ${
            actionMessage.type === 'success'
              ? 'bg-[#e8f3f0] text-[#126552]'
              : 'bg-[#fff0f0] text-[#a12b31]'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
            <span>{actionMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            className="text-current opacity-70 hover:opacity-100"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* ================= TAB 1: RIWAYAT & VERSI DATASET ================= */}
      {activeTab === 'versions' && (
        <div className="flex flex-col gap-5">
          {/* Petunjuk Multi-Versi */}
          <div className="rounded-lg border border-[#c2d7e5] bg-[#edf5f8] p-4 text-xs text-[#1b4965]">
            <p className="font-semibold">💡 Pengelolaan Multi-Versi Dataset (Contoh: 2026, 2028)</p>
            <p className="mt-1 leading-relaxed text-[#3a6079]">
              Untuk <strong>perubahan massal</strong> per tahun, unggah berkas CSV/GeoJSON baru melalui tombol{' '}
              <strong>"Impor Versi Baru (Massal)"</strong> dan tentukan tahun periodenya. Versi lama tidak tertimpa
              melainkan tersimpan sebagai arsip histori. Anda dapat <strong>mengganti versi aktif</strong> kapan saja
              melalui tombol status di tabel berikut.
            </p>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] max-w-[500px] flex-1">
              <label htmlFor="cari-dataset" className="sr-only">
                Cari nama dataset atau sumber
              </label>
              <Search
                size={18}
                aria-hidden="true"
                className="pointer-events-none absolute left-[13px] top-1/2 -translate-y-1/2 text-[#445665]"
              />
              <input
                id="cari-dataset"
                type="search"
                placeholder="Cari nama dataset, sumber, atau periode..."
                value={query}
                onChange={(e) => {
                  const nextParams = new URLSearchParams(searchParams);
                  if (e.target.value) nextParams.set('q', e.target.value);
                  else nextParams.delete('q');
                  setSearchParams(nextParams, { replace: true });
                }}
                className={`h-11 w-full rounded-lg border border-[#d7e1e8] bg-white pl-[43px] pr-3 text-xs placeholder:text-[#445665] ${FOCUS}`}
              />
            </div>

            <div>
              <label htmlFor="filter-tahun" className="sr-only">
                Filter Tahun Periode
              </label>
              <select
                id="filter-tahun"
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className={`h-11 cursor-pointer rounded-lg border border-[#d7e1e8] bg-white px-3 text-xs font-semibold text-[#173042] ${FOCUS}`}
              >
                <option value="">Semua Tahun Periode</option>
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    Tahun {year}
                  </option>
                ))}
              </select>
            </div>

            <div className="ml-auto">
              <StatusPill tone="success">Terkoneksi ke PostgreSQL</StatusPill>
            </div>
          </div>

          {/* Bento Layout: Tabel Versi & Persyaratan */}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <section aria-labelledby="judul-versi" className={`${CARD} min-w-0 p-[18px]`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 id="judul-versi" className="text-base font-semibold text-[#173042]">
                    Daftar Versi Dataset di Database
                  </h2>
                  <p className="text-xs text-[#445665]">
                    {filteredVersions.length} dataset tersimpan di PostgreSQL PostGIS
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => fetchDatasets()}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#2c6e8e] hover:underline"
                >
                  <RefreshCw size={13} /> Muat Ulang
                </button>
              </div>

              <div role="region" tabIndex={0} className={`mt-4 overflow-x-auto ${FOCUS}`}>
                <table className="w-full min-w-[620px] text-left">
                  <thead>
                    <tr>
                      <th scope="col" className={`${TH} w-[30%]`}>
                        Nama Dataset / Versi
                      </th>
                      <th scope="col" className={`${TH} w-[15%]`}>
                        Periode
                      </th>
                      <th scope="col" className={`${TH} w-[20%]`}>
                        Kategori / Format
                      </th>
                      <th scope="col" className={`${TH} w-[15%]`}>
                        Status Aktif
                      </th>
                      <th scope="col" className={`${TH} w-[20%] text-right`}>
                        Gonta-Ganti Versi
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVersions.map((row) => (
                      <tr key={row.id} className="hover:bg-[#fbfcfd]">
                        <td className={TD}>
                          <span className="block font-semibold text-[#173042]">{row.name}</span>
                          <span className="block text-[11px] text-[#445665]">{row.source}</span>
                        </td>
                        <td className={TD}>
                          <span className="inline-block rounded bg-[#edf3f6] px-2 py-0.5 text-xs font-bold text-[#1b4965]">
                            {row.period || '2026'}
                          </span>
                        </td>
                        <td className={TD}>
                          <span className="block capitalize text-[#173042]">{row.kategori || 'sekolah'}</span>
                          <span className="block text-[11px] uppercase text-[#445665]">
                            {row.format || 'PostGIS'}
                          </span>
                        </td>
                        <td className={TD}>
                          {row.aktif ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f3f0] px-2.5 py-1 text-[11px] font-semibold text-[#126552]">
                              <Check size={12} /> Aktif
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-[#edf3f6] px-2.5 py-1 text-[11px] font-medium text-[#445665]">
                              Nonaktif
                            </span>
                          )}
                        </td>
                        <td className={`${TD} text-right`}>
                          <div className="flex items-center justify-end gap-1.5">
                            {row.id_dataset ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleToggleActive(row)}
                                  disabled={togglingId === row.id_dataset}
                                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                                    row.aktif
                                      ? 'border-[#d7e1e8] bg-white text-[#85520c] hover:bg-[#fff7ed]'
                                      : 'border-[#1b4965] bg-[#1b4965] text-white hover:bg-[#153a52]'
                                  } disabled:opacity-50`}
                                >
                                  {togglingId === row.id_dataset ? (
                                    <RefreshCw size={13} className="animate-spin" />
                                  ) : row.aktif ? (
                                    <>
                                      <ToggleRight size={15} /> Nonaktifkan
                                    </>
                                  ) : (
                                    <>
                                      <ToggleLeft size={15} /> Jadikan Aktif
                                    </>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingDataset(row)}
                                  title="Hapus dataset ini dari database"
                                  className="inline-flex items-center justify-center rounded-lg border border-[#d7e1e8] p-1.5 text-[#a12b31] transition-colors hover:bg-[#fff0f0]"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            ) : (
                              <span className="text-[11px] text-[#445665]">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredVersions.length === 0 && (
                  <p className="px-3 py-8 text-center text-xs text-[#445665]">
                    Tidak ada versi dataset yang cocok dengan kriteria pencarian.
                  </p>
                )}
              </div>
            </section>

            {/* Sidebar Persyaratan Sumber */}
            <section aria-labelledby="judul-syarat" className={`${CARD} p-[18px]`}>
              <h2 id="judul-syarat" className="text-base font-semibold leading-6 text-[#173042]">
                Standar Dataset SADAR-EDU
              </h2>
              <p className="text-xs text-[#445665]">Kaidah data spasial & non-spasial.</p>
              <ul className="mt-4 flex flex-col gap-2.5">
                {REQUIREMENTS.map((item) => (
                  <li
                    key={item.title}
                    className="flex items-start gap-3 rounded-lg border border-[#d7e1e8] bg-[#f9fafb] p-3"
                  >
                    <Check size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-[#126552]" />
                    <span>
                      <span className="block text-xs font-semibold text-[#173042]">{item.title}</span>
                      <span className="block text-[11px] text-[#445665]">{item.text}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      )}

      {/* ================= TAB 2: EDIT CEPAT SATUAN SEKOLAH ================= */}
      {activeTab === 'single-edit' && (
        <div className="flex flex-col gap-5">
          {/* Card Penjelasan Fitur */}
          <div className="rounded-lg border border-[#c2d7e5] bg-[#edf5f8] p-4 text-xs text-[#1b4965]">
            <p className="font-semibold">✏️ Pembaruan Satuan Sekolah (Single School Edit)</p>
            <p className="mt-1 leading-relaxed text-[#3a6079]">
              Jika hanya ada <strong>satu atau beberapa sekolah yang salah nama, alamat, atau koordinatnya</strong>,
              Anda <strong>tidak perlu mengunggah ulang ribuan baris CSV</strong>. Cari nama sekolah di bawah ini, klik{' '}
              <strong>"Edit"</strong>, perbaiki namanya, dan klik <strong>"Simpan ke Database"</strong>. Data di PostgreSQL
              dan PostGIS akan langsung ter-update seketika.
            </p>
          </div>

          {/* Form Pencarian Sekolah Satuan */}
          <div className={`${CARD} p-5`}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSearchSchools();
              }}
              className="flex flex-wrap items-center gap-3"
            >
              <div className="relative min-w-[260px] max-w-[600px] flex-1">
                <label htmlFor="cari-sekolah-satuan" className="sr-only">
                  Cari Nama Sekolah atau NPSN
                </label>
                <Search
                  size={18}
                  className="pointer-events-none absolute left-[13px] top-1/2 -translate-y-1/2 text-[#445665]"
                />
                <input
                  id="cari-sekolah-satuan"
                  type="text"
                  placeholder="Ketik nama sekolah atau NPSN (misal: Cibinong, Cileungsi, SMPN 1...)"
                  value={schoolSearchQuery}
                  onChange={(e) => setSchoolSearchQuery(e.target.value)}
                  className={`h-11 w-full rounded-lg border border-[#d7e1e8] bg-white pl-[43px] pr-3 text-xs placeholder:text-[#445665] ${FOCUS}`}
                />
              </div>

              <button
                type="submit"
                disabled={isSearchingSchools}
                className={`${BTN_PRIMARY} flex items-center gap-2`}
              >
                {isSearchingSchools ? <RefreshCw size={15} className="animate-spin" /> : <Search size={15} />}
                {isSearchingSchools ? 'Mencari di DB...' : 'Cari Sekolah'}
              </button>

              <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#445665]">
                <span>Pintas pencarian:</span>
                {['Cibinong', 'Cileungsi', 'Bogor', 'SMP Swasta', 'SMP Negeri'].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => {
                      setSchoolSearchQuery(chip);
                      handleSearchSchools(chip);
                    }}
                    className="rounded bg-[#edf3f6] px-2 py-1 text-xs font-medium text-[#1b4965] hover:bg-[#dce9f0]"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </form>

            {/* Tabel Hasil Pencarian Sekolah Satuan */}
            <div className="mt-5">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
                <h3 className="text-sm font-semibold text-[#173042]">
                  Hasil Pencarian Database ({schoolResults.length} Sekolah Ditemukan)
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setAddForm({
                      nama_sekolah: '',
                      npsn: '',
                      status_sekolah: 'Negeri',
                      jenjang: 'SMP',
                      alamat: '',
                      latitude: '-6.5891',
                      longitude: '106.7932',
                      jumlah_siswa: '0',
                      foto_url: '',
                    });
                    setEditSchoolError('');
                    setIsAddingSchool(true);
                  }}
                  className={`${BTN_PRIMARY} flex items-center gap-1.5 py-1.5 px-3 text-xs`}
                >
                  <Plus size={14} /> Tambah Sekolah Baru (Create)
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left">
                  <thead>
                    <tr>
                      <th scope="col" className={`${TH} w-[30%]`}>
                        Nama Sekolah
                      </th>
                      <th scope="col" className={`${TH} w-[15%]`}>
                        NPSN
                      </th>
                      <th scope="col" className={`${TH} w-[15%]`}>
                        Jenjang & Status
                      </th>
                      <th scope="col" className={`${TH} w-[15%]`}>
                        Wilayah / Kec.
                      </th>
                      <th scope="col" className={`${TH} w-[15%]`}>
                        Koordinat (Lat, Lng)
                      </th>
                      <th scope="col" className={`${TH} w-[10%] text-right`}>
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {schoolResults.map((school) => (
                      <tr key={school.id_sekolah} className="hover:bg-[#fbfcfd]">
                        <td className={TD}>
                          <div className="flex items-center gap-2.5">
                            {school.foto_url ? (
                              <img
                                src={school.foto_url}
                                alt=""
                                className="h-9 w-9 rounded object-cover border border-[#d7e1e8] shrink-0"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                            ) : (
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-[#edf3f6] text-[#445665]" title="Foto belum ada">
                                <ImageIcon size={16} />
                              </div>
                            )}
                            <div>
                              <span className="block font-semibold text-[#173042]">{school.nama_sekolah}</span>
                              <span className="block text-[11px] text-[#445665] truncate max-w-[240px]">
                                {school.alamat || 'Alamat belum diisi'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className={TD}>
                          <span className="font-mono text-xs font-medium text-[#1b4965]">
                            {school.npsn || '—'}
                          </span>
                        </td>
                        <td className={TD}>
                          <span className="inline-block rounded bg-[#edf3f6] px-2 py-0.5 text-xs text-[#173042]">
                            {school.jenjang} • {school.status_sekolah}
                          </span>
                        </td>
                        <td className={TD}>
                          <span className="text-xs text-[#173042]">{school.nama_wilayah || 'Kab. Bogor'}</span>
                        </td>
                        <td className={TD}>
                          <span className="font-mono text-[11px] text-[#445665]">
                            {school.latitude && school.longitude
                              ? `${Number(school.latitude).toFixed(4)}, ${Number(school.longitude).toFixed(4)}`
                              : 'Tanpa koordinat'}
                          </span>
                        </td>
                        <td className={`${TD} text-right`}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(school)}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#1b4965] bg-white px-2.5 py-1 text-xs font-semibold text-[#1b4965] transition-colors hover:bg-[#edf5f8]"
                              title="Edit data sekolah ini"
                            >
                              <Pencil size={12} /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingSchoolItem(school)}
                              className="inline-flex items-center justify-center rounded-lg border border-[#d7e1e8] p-1.5 text-[#a12b31] transition-colors hover:bg-[#fff0f0]"
                              title="Hapus sekolah ini dari database"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {schoolResults.length === 0 && (
                  <div className="py-10 text-center text-xs text-[#445665]">
                    {hasSearched
                      ? 'Tidak ada sekolah yang cocok dengan kata kunci pencarian.'
                      : 'Ketik nama sekolah atau NPSN di atas untuk mencari dan memperbarui data sekolah.'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL EDIT SATU SEKOLAH ================= */}
      {editingSchool && (
        <Dialog
          title={`Edit Data: ${editingSchool.nama_sekolah}`}
          onClose={() => setEditingSchool(null)}
          focusRef={schoolNameInputRef}
          wide
        >
          <form onSubmit={handleSaveSingleSchool} className="mt-4 flex flex-col gap-4 text-xs">
            {editSchoolError && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-lg bg-[#fff0f0] p-3 text-xs text-[#a12b31]"
              >
                <AlertCircle size={15} />
                <span>{editSchoolError}</span>
              </div>
            )}

            <div className="rounded-lg bg-[#edf5f8] p-3 text-[11px] text-[#1b4965]">
              Perubahan pada nama sekolah atau koordinat di form ini akan langsung tersimpan ke database PostgreSQL
              dan otomatis memperbarui kecamatan terkait via spatial query PostGIS.
            </div>

            {/* Nama Sekolah (Focus & Highlight) */}
            <div>
              <label htmlFor="edit-nama-sekolah" className="block text-xs font-bold text-[#173042]">
                Nama Sekolah <span className="text-[#a12b31]">*</span>
              </label>
              <input
                ref={schoolNameInputRef}
                id="edit-nama-sekolah"
                type="text"
                value={editForm.nama_sekolah}
                onChange={(e) => setEditForm({ ...editForm, nama_sekolah: e.target.value })}
                placeholder="Contoh: SMP Negeri 1 Cibinong"
                className={`mt-1.5 h-11 w-full rounded-lg border border-[#d7e1e8] bg-white px-3 text-sm font-semibold text-[#173042] ${FOCUS}`}
                required
              />
            </div>

            {/* Baris NPSN, Jenjang, Status */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="edit-npsn" className="block font-semibold text-[#173042]">
                  NPSN
                </label>
                <input
                  id="edit-npsn"
                  type="text"
                  value={editForm.npsn}
                  onChange={(e) => setEditForm({ ...editForm, npsn: e.target.value })}
                  disabled
                  className="mt-1 h-10 w-full rounded-md border border-[#d7e1e8] bg-[#edf3f6] px-3 font-mono text-xs text-[#445665]"
                />
              </div>

              <div>
                <label htmlFor="edit-jenjang" className="block font-semibold text-[#173042]">
                  Jenjang
                </label>
                <select
                  id="edit-jenjang"
                  value={editForm.jenjang}
                  onChange={(e) => setEditForm({ ...editForm, jenjang: e.target.value })}
                  className={`mt-1 h-10 w-full rounded-md border border-[#d7e1e8] bg-white px-3 text-xs text-[#173042] ${FOCUS}`}
                >
                  <option value="SMP">SMP</option>
                  <option value="MTs">MTs</option>
                  <option value="SMA">SMA</option>
                  <option value="SMK">SMK</option>
                </select>
              </div>

              <div>
                <label htmlFor="edit-status" className="block font-semibold text-[#173042]">
                  Status Sekolah
                </label>
                <select
                  id="edit-status"
                  value={editForm.status_sekolah}
                  onChange={(e) => setEditForm({ ...editForm, status_sekolah: e.target.value })}
                  className={`mt-1 h-10 w-full rounded-md border border-[#d7e1e8] bg-white px-3 text-xs text-[#173042] ${FOCUS}`}
                >
                  <option value="Negeri">Negeri</option>
                  <option value="Swasta">Swasta</option>
                </select>
              </div>
            </div>

            {/* Alamat */}
            <div>
              <label htmlFor="edit-alamat" className="block font-semibold text-[#173042]">
                Alamat Sekolah
              </label>
              <textarea
                id="edit-alamat"
                rows={2}
                value={editForm.alamat}
                onChange={(e) => setEditForm({ ...editForm, alamat: e.target.value })}
                placeholder="Alamat jalan / desa / kelurahan..."
                className={`mt-1 w-full rounded-md border border-[#d7e1e8] bg-white p-2.5 text-xs text-[#173042] ${FOCUS}`}
              />
            </div>

            {/* Koordinat Lat & Lng */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="edit-lat" className="block font-semibold text-[#173042]">
                  Latitude (Lintang, cth: -6.4851)
                </label>
                <input
                  id="edit-lat"
                  type="text"
                  value={editForm.latitude}
                  onChange={(e) => setEditForm({ ...editForm, latitude: e.target.value })}
                  placeholder="-6.4851"
                  className={`mt-1 h-10 w-full rounded-md border border-[#d7e1e8] bg-white px-3 font-mono text-xs text-[#173042] ${FOCUS}`}
                />
              </div>

              <div>
                <label htmlFor="edit-lng" className="block font-semibold text-[#173042]">
                  Longitude (Bujur, cth: 106.8432)
                </label>
                <input
                  id="edit-lng"
                  type="text"
                  value={editForm.longitude}
                  onChange={(e) => setEditForm({ ...editForm, longitude: e.target.value })}
                  placeholder="106.8432"
                  className={`mt-1 h-10 w-full rounded-md border border-[#d7e1e8] bg-white px-3 font-mono text-xs text-[#173042] ${FOCUS}`}
                />
              </div>
            </div>

            {/* URL Foto / Gambar Sekolah */}
            <div>
              <label htmlFor="edit-foto" className="block font-semibold text-[#173042]">
                URL Foto / Gambar Sekolah (Bisa link web atau path file lokal)
              </label>
              <input
                id="edit-foto"
                type="text"
                value={editForm.foto_url}
                onChange={(e) => setEditForm({ ...editForm, foto_url: e.target.value })}
                placeholder="https://... atau /images/sekolah/20200877.jpg"
                className={`mt-1 h-10 w-full rounded-md border border-[#d7e1e8] bg-white px-3 font-mono text-xs text-[#173042] ${FOCUS}`}
              />
              <p className="mt-1 text-[11px] text-[#445665]">
                Link foto ini akan langsung tampil di kartu profil dan pop-up peta interaktif publik.
              </p>
              {editForm.foto_url && (
                <div className="mt-2 flex items-center gap-3 rounded-lg border border-[#d7e1e8] bg-[#f9fafb] p-2">
                  <img
                    src={editForm.foto_url}
                    alt="Preview"
                    className="h-14 w-20 rounded object-cover border border-[#d7e1e8]"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                  <span className="text-[11px] text-[#445665]">Pratinjau foto sekolah yang akan ditampilkan ke masyarakat.</span>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="mt-4 flex items-center justify-end gap-3 border-t border-[#d7e1e8] pt-4">
              <button
                type="button"
                onClick={() => setEditingSchool(null)}
                className={BTN_OUTLINE}
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSavingSchool}
                className={`${BTN_PRIMARY} flex items-center gap-2`}
              >
                {isSavingSchool ? <RefreshCw size={15} className="animate-spin" /> : <Check size={15} />}
                {isSavingSchool ? 'Menyimpan ke DB...' : 'Simpan Perubahan ke Database'}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {/* ================= MODAL TAMBAH SATU SEKOLAH BARU (CREATE) ================= */}
      {isAddingSchool && (
        <Dialog
          title="Tambah Sekolah Baru ke Database"
          onClose={() => setIsAddingSchool(false)}
          wide
        >
          <form onSubmit={handleCreateSchool} className="mt-4 flex flex-col gap-4 text-xs">
            {editSchoolError && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-lg bg-[#fff0f0] p-3 text-xs text-[#a12b31]"
              >
                <AlertCircle size={15} />
                <span>{editSchoolError}</span>
              </div>
            )}

            <div className="rounded-lg bg-[#edf5f8] p-3 text-[11px] text-[#1b4965]">
              Sekolah baru akan langsung disimpan ke database PostgreSQL PostGIS dan dikaitkan otomatis ke kecamatan setempat via kueri spasial.
            </div>

            <div>
              <label htmlFor="add-nama" className="block text-xs font-bold text-[#173042]">
                Nama Sekolah <span className="text-[#a12b31]">*</span>
              </label>
              <input
                id="add-nama"
                type="text"
                value={addForm.nama_sekolah}
                onChange={(e) => setAddForm({ ...addForm, nama_sekolah: e.target.value })}
                placeholder="Contoh: SMP IT Al-Fityan Cibinong"
                className={`mt-1.5 h-11 w-full rounded-lg border border-[#d7e1e8] bg-white px-3 text-sm font-semibold text-[#173042] ${FOCUS}`}
                required
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="add-npsn" className="block font-semibold text-[#173042]">
                  NPSN <span className="text-[#a12b31]">*</span>
                </label>
                <input
                  id="add-npsn"
                  type="text"
                  value={addForm.npsn}
                  onChange={(e) => setAddForm({ ...addForm, npsn: e.target.value })}
                  placeholder="8 digit NPSN"
                  className={`mt-1 h-10 w-full rounded-md border border-[#d7e1e8] bg-white px-3 font-mono text-xs text-[#173042] ${FOCUS}`}
                  required
                />
              </div>

              <div>
                <label htmlFor="add-jenjang" className="block font-semibold text-[#173042]">
                  Jenjang
                </label>
                <select
                  id="add-jenjang"
                  value={addForm.jenjang}
                  onChange={(e) => setAddForm({ ...addForm, jenjang: e.target.value })}
                  className={`mt-1 h-10 w-full rounded-md border border-[#d7e1e8] bg-white px-3 text-xs text-[#173042] ${FOCUS}`}
                >
                  <option value="SMP">SMP</option>
                  <option value="MTs">MTs</option>
                  <option value="SMA">SMA</option>
                  <option value="SMK">SMK</option>
                </select>
              </div>

              <div>
                <label htmlFor="add-status" className="block font-semibold text-[#173042]">
                  Status Sekolah
                </label>
                <select
                  id="add-status"
                  value={addForm.status_sekolah}
                  onChange={(e) => setAddForm({ ...addForm, status_sekolah: e.target.value })}
                  className={`mt-1 h-10 w-full rounded-md border border-[#d7e1e8] bg-white px-3 text-xs text-[#173042] ${FOCUS}`}
                >
                  <option value="Negeri">Negeri</option>
                  <option value="Swasta">Swasta</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="add-alamat" className="block font-semibold text-[#173042]">
                Alamat Sekolah
              </label>
              <textarea
                id="add-alamat"
                rows={2}
                value={addForm.alamat}
                onChange={(e) => setAddForm({ ...addForm, alamat: e.target.value })}
                placeholder="Alamat jalan / desa / kelurahan..."
                className={`mt-1 w-full rounded-md border border-[#d7e1e8] bg-white p-2.5 text-xs text-[#173042] ${FOCUS}`}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="add-lat" className="block font-semibold text-[#173042]">
                  Latitude (Lintang, default: -6.5891)
                </label>
                <input
                  id="add-lat"
                  type="text"
                  value={addForm.latitude}
                  onChange={(e) => setAddForm({ ...addForm, latitude: e.target.value })}
                  placeholder="-6.5891"
                  className={`mt-1 h-10 w-full rounded-md border border-[#d7e1e8] bg-white px-3 font-mono text-xs text-[#173042] ${FOCUS}`}
                />
              </div>

              <div>
                <label htmlFor="add-lng" className="block font-semibold text-[#173042]">
                  Longitude (Bujur, default: 106.7932)
                </label>
                <input
                  id="add-lng"
                  type="text"
                  value={addForm.longitude}
                  onChange={(e) => setAddForm({ ...addForm, longitude: e.target.value })}
                  placeholder="106.7932"
                  className={`mt-1 h-10 w-full rounded-md border border-[#d7e1e8] bg-white px-3 font-mono text-xs text-[#173042] ${FOCUS}`}
                />
              </div>
            </div>

            {/* URL Foto Sekolah */}
            <div>
              <label htmlFor="add-foto" className="block font-semibold text-[#173042]">
                URL Foto / Gambar Sekolah (Bisa link web atau path file lokal)
              </label>
              <input
                id="add-foto"
                type="text"
                value={addForm.foto_url}
                onChange={(e) => setAddForm({ ...addForm, foto_url: e.target.value })}
                placeholder="https://... atau /images/sekolah/20200877.jpg"
                className={`mt-1 h-10 w-full rounded-md border border-[#d7e1e8] bg-white px-3 font-mono text-xs text-[#173042] ${FOCUS}`}
              />
              {addForm.foto_url && (
                <div className="mt-2 flex items-center gap-3 rounded-lg border border-[#d7e1e8] bg-[#f9fafb] p-2">
                  <img
                    src={addForm.foto_url}
                    alt="Preview"
                    className="h-14 w-20 rounded object-cover border border-[#d7e1e8]"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                  <span className="text-[11px] text-[#445665]">Pratinjau foto sekolah.</span>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-end gap-3 border-t border-[#d7e1e8] pt-4">
              <button
                type="button"
                onClick={() => setIsAddingSchool(false)}
                className={BTN_OUTLINE}
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isCreatingSchool}
                className={`${BTN_PRIMARY} flex items-center gap-2`}
              >
                {isCreatingSchool ? <RefreshCw size={15} className="animate-spin" /> : <Plus size={15} />}
                {isCreatingSchool ? 'Menyimpan...' : 'Simpan Sekolah Baru'}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {/* ================= MODAL KONFIRMASI HAPUS SATU SEKOLAH (DELETE) ================= */}
      {deletingSchoolItem && (
        <Dialog
          title="Hapus Sekolah dari Database?"
          onClose={() => setDeletingSchoolItem(null)}
        >
          <div className="mt-3 flex flex-col gap-4 text-xs">
            <p className="leading-relaxed text-[#445665]">
              Apakah Anda yakin ingin menghapus sekolah{' '}
              <strong className="text-[#173042]">{deletingSchoolItem.nama_sekolah}</strong> (NPSN: {deletingSchoolItem.npsn})
              dari database PostgreSQL?
            </p>
            <div className="rounded-lg bg-[#fff0f0] p-3 text-[11px] text-[#a12b31]">
              ⚠️ <strong>Peringatan:</strong> Seluruh titik koordinat dan statistik sekolah ini akan dihapus dari peta publik dan sistem.
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingSchoolItem(null)}
                className={BTN_OUTLINE}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSchool}
                disabled={isDeletingSchool}
                className="inline-flex h-[42px] cursor-pointer items-center justify-center rounded-lg bg-[#a12b31] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#852328] disabled:opacity-50"
              >
                {isDeletingSchool ? 'Menghapus...' : 'Ya, Hapus Sekolah'}
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* ================= MODAL KONFIRMASI HAPUS DATASET ================= */}
      {deletingDataset && (
        <Dialog
          title="Hapus Dataset dari Database?"
          onClose={() => setDeletingDataset(null)}
        >
          <div className="mt-3 flex flex-col gap-4 text-xs">
            <p className="leading-relaxed text-[#445665]">
              Apakah Anda yakin ingin menghapus dataset{' '}
              <strong className="text-[#173042]">{deletingDataset.name}</strong> (Tahun {deletingDataset.period})
              beserta seluruh data spasial yang terhubung dengannya dari database PostgreSQL?
            </p>
            <div className="rounded-lg bg-[#fff0f0] p-3 text-[11px] text-[#a12b31]">
              ⚠️ <strong>Peringatan:</strong> Tindakan ini permanen dan akan menghapus baris data dari server. Pastikan Anda sudah mengekspor cadangan (backup) jika masih dibutuhkan.
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingDataset(null)}
                className={BTN_OUTLINE}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="inline-flex h-[42px] cursor-pointer items-center justify-center rounded-lg bg-[#a12b31] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#852328] disabled:opacity-50"
              >
                {isDeleting ? 'Menghapus...' : 'Ya, Hapus Permanen'}
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

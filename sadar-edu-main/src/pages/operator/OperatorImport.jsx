/**
 * ============================================================================
 * HALAMAN: Impor & Pemetaan Kolom Dataset (Operator)
 * ============================================================================
 * Fungsi:
 * 1. Mengunggah berkas sumber (CSV atau XLSX).
 * 2. Mencocokkan kolom sumber secara otomatis (auto-mapping) ke skema SADAR-EDU
 *    (NPSN, Nama Sekolah, Lintang, Bujur, Jumlah Siswa).
 * 3. Menyediakan mode "Impor Cepat (1-Klik ke DB)" jika data sudah 100% valid.
 * 4. Menyediakan jalur validasi bertahap jika ingin meninjau temuan terlebih dahulu.
 * ============================================================================
 */

import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Sparkles, Upload } from 'lucide-react';
import { useOperatorStore } from '../../store/useOperatorStore';
import {
  FIELDS,
  formatFileSize,
  guessMapping,
  isMappingComplete,
  parseCsv,
  validateRows,
} from '../../lib/operatorImport';
import { readXlsx } from '../../lib/operatorXlsx';
import {
  BTN_OUTLINE,
  BTN_PRIMARY,
  CARD,
  FOCUS,
  PageHeader,
  StatusPill,
  TD,
  TH,
} from '../../components/operator/ui';

const STEPS = ['Unggah', 'Pemetaan', 'Validasi', 'Review'];

const stepState = (index, hasFile) => {
  if (index === 0) return hasFile ? 'done' : 'current';
  if (index === 1) return hasFile ? 'current' : 'todo';
  return 'todo';
};

const STEP_STYLE = {
  done: { card: 'bg-white', circle: 'bg-[#2d8272] text-white', label: 'text-[#173042]' },
  current: { card: 'bg-[#e8f3f0]', circle: 'bg-[#1b4965] text-white', label: 'text-[#1b4965]' },
  todo: { card: 'bg-white', circle: 'bg-[#edf3f6] text-[#445665]', label: 'text-[#173042]' },
};

export default function OperatorImport() {
  const navigate = useNavigate();
  const savedDraft = useOperatorStore((state) => state.draft);
  const saveDraft = useOperatorStore((state) => state.saveDraft);
  const runValidation = useOperatorStore((state) => state.runValidation);
  const syncDraftToBackend = useOperatorStore((state) => state.syncDraftToBackend);

  const [file, setFile] = useState(savedDraft);
  const [mapping, setMapping] = useState(savedDraft?.mapping ?? {});
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const [draftSaved, setDraftSaved] = useState(Boolean(savedDraft));
  const [isQuickImporting, setIsQuickImporting] = useState(false);
  const inputRef = useRef(null);

  const hasFile = Boolean(file);
  const isWilayah = file?.kategori === 'wilayah';
  const ready = hasFile && file.rows.length > 0 && (isWilayah || isMappingComplete(mapping));

  const handleFile = async (selected) => {
    if (!selected || reading) return;
    const name = selected.name.toLowerCase();
    const isXlsx = name.endsWith('.xlsx');
    const isJson = name.endsWith('.json') || name.endsWith('.geojson');
    const isCsv = name.endsWith('.csv');

    if (name.endsWith('.xls')) {
      setError('Format XLS lama belum didukung. Simpan sebagai XLSX, CSV, atau GeoJSON, lalu pilih lagi.');
      return;
    }
    if (!isXlsx && !isCsv && !isJson) {
      setError('Format tidak didukung. Pilih berkas CSV, XLSX, JSON, atau GeoJSON.');
      return;
    }

    setReading(true);
    try {
      let headers = [];
      let rows = [];
      let rawGeoJson = null;
      let kategori = 'sekolah';

      if (isJson) {
        const text = await selected.text();
        const parsed = JSON.parse(text);
        if (parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
          rawGeoJson = parsed;
          const firstGeom = parsed.features[0]?.geometry?.type;
          if (firstGeom === 'Polygon' || firstGeom === 'MultiPolygon') {
            // Berkas Poligon Batas Wilayah Kecamatan
            kategori = 'wilayah';
            headers = ['Kode BPS', 'Nama Wilayah / Kecamatan', 'Level', 'Luas Km2', 'Penduduk Usia SMP', 'Jumlah Penduduk'];
            rows = parsed.features.map((f) => {
              const p = f.properties || {};
              return [
                String(p.kode_bps || p.id_wilayah || ''),
                String(p.nama_wilayah || p.kecamatan || ''),
                String(p.level_wilayah || 'Kecamatan'),
                String(p.luas_km2 || ''),
                String(p.penduduk_usia_smp || ''),
                String(p.jumlah_penduduk || ''),
              ];
            });
          } else {
            // Berkas Titik Sekolah (Point)
            kategori = 'sekolah';
            headers = ['NPSN', 'Nama Sekolah', 'Jenjang', 'Status', 'Kecamatan', 'Latitude', 'Longitude', 'Jumlah Siswa'];
            rows = parsed.features.map((f) => {
              const p = f.properties || {};
              const coords = f.geometry?.coordinates || [0, 0];
              return [
                String(p.npsn || p.kode || ''),
                String(p.nama || p.nama_sekolah || ''),
                String(p.jenjang || 'SMP'),
                String(p.status || p.status_sekolah || 'Swasta'),
                String(p.kecamatan || p.nama_wilayah || ''),
                String(coords[1] ?? ''),
                String(coords[0] ?? ''),
                String(p.jumlahSiswa || p.jumlah_siswa || 0),
              ];
            });
          }
        } else {
          setError('Berkas JSON harus berupa FeatureCollection GeoJSON yang valid.');
          return;
        }
      } else if (isXlsx) {
        const xlsxData = await readXlsx(selected);
        headers = xlsxData.headers;
        rows = xlsxData.rows;
      } else {
        const csvData = parseCsv(await selected.text());
        headers = csvData.headers;
        rows = csvData.rows;
      }

      if (headers.length === 0 || rows.length === 0) {
        setError('Berkas kosong. Pilih berkas yang berisi data fitur.');
        return;
      }

      setFile({ fileName: selected.name, fileSize: selected.size, headers, rows, rawGeoJson, kategori });
      setMapping(guessMapping(headers));
      setDraftSaved(false);
      setError('');
    } catch (err) {
      setError(
        isXlsx
          ? 'Berkas XLSX tidak dapat dibaca. Pastikan berkasnya tidak rusak atau terkunci kata sandi.'
          : isJson
          ? 'Berkas JSON/GeoJSON tidak valid: ' + (err?.message || '')
          : 'Berkas tidak dapat dibaca. Pastikan berkas CSV tidak rusak.'
      );
    } finally {
      setReading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleSaveDraft = () => {
    const draft = { ...file, mapping };
    saveDraft(draft);
    if (isWilayah) {
      runValidation(draft, {
        totalRows: file.rows.length,
        passedRows: file.rows.length,
        needsFixRows: 0,
        noMarkerRows: 0,
        ranAt: new Date().toISOString(),
        errors: [],
        affected: { npsn: 0, koordinat: 0, numerik: 0, identitas: 0 },
      });
    } else {
      runValidation(draft, validateRows(file.rows, mapping));
    }
    setDraftSaved(true);
  };

  const handleValidate = () => {
    const draft = { ...file, mapping };
    if (isWilayah) {
      runValidation(draft, {
        totalRows: file.rows.length,
        passedRows: file.rows.length,
        needsFixRows: 0,
        noMarkerRows: 0,
        ranAt: new Date().toISOString(),
        errors: [],
        affected: { npsn: 0, koordinat: 0, numerik: 0, identitas: 0 },
      });
    } else {
      runValidation(draft, validateRows(file.rows, mapping));
    }
    navigate('/operator/validasi');
  };

  const handleQuickImport = async () => {
    if (!ready || isQuickImporting) return;
    setIsQuickImporting(true);
    setError('');

    const draft = { ...file, mapping };
    saveDraft(draft);

    let valResult;
    if (isWilayah) {
      valResult = {
        totalRows: file.rows.length,
        passedRows: file.rows.length,
        needsFixRows: 0,
        noMarkerRows: 0,
        ranAt: new Date().toISOString(),
        errors: [],
        affected: { npsn: 0, koordinat: 0, numerik: 0, identitas: 0 },
      };
    } else {
      valResult = validateRows(file.rows, mapping);
    }
    runValidation(draft, valResult);

    // Jika ada temuan baris error, langsung arahkan ke halaman validasi/perbaikan
    if (valResult.errors && valResult.errors.length > 0) {
      setIsQuickImporting(false);
      navigate('/operator/validasi');
      return;
    }

    // Jika data 100% bersih, simpan langsung ke PostgreSQL server
    try {
      const syncRes = await syncDraftToBackend();
      setIsQuickImporting(false);
      if (syncRes.success) {
        navigate('/operator/dataset');
      } else {
        setError(syncRes.message || 'Gagal menyimpan ke database server.');
      }
    } catch {
      setIsQuickImporting(false);
      navigate('/operator/validasi');
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-7">
      <PageHeader
        eyebrow={'Langkah 1\u20132'}
        title="Impor dan petakan kolom"
        description="Unggah berkas sumber, kemudian cocokkan kolomnya dengan skema SADAR EDU."
        action={
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={!hasFile}
            className={`${BTN_OUTLINE} w-[172px] disabled:cursor-not-allowed disabled:opacity-50`}
          >
            Simpan draf
          </button>
        }
      />

      <ol aria-label="Langkah impor" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((label, index) => {
          const state = stepState(index, hasFile);
          const style = STEP_STYLE[state];
          return (
            <li
              key={label}
              aria-current={state === 'current' ? 'step' : undefined}
              className={`flex h-[62px] items-center gap-3 rounded-lg border border-[#d7e1e8] px-[11px] ${style.card}`}
            >
              <span
                aria-hidden="true"
                className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-sm font-semibold ${style.circle}`}
              >
                {state === 'done' ? <Check size={18} /> : index + 1}
              </span>
              <span className={`text-sm font-semibold leading-5 ${style.label}`}>{label}</span>
              {state === 'done' && <span className="sr-only">, selesai</span>}
            </li>
          );
        })}
      </ol>

      <div className="grid gap-5 lg:grid-cols-[330px_minmax(0,1fr)]">
        <section aria-labelledby="judul-berkas" className={`${CARD} p-[17px]`}>
          <h2 id="judul-berkas" className="text-base font-semibold leading-6">Berkas sumber</h2>

          <div
            role="group"
            aria-label="Area tarik berkas"
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`mt-5 flex h-[150px] flex-col items-center justify-center rounded-lg border bg-[#edf3f6] text-center transition-colors ${
              dragging ? 'border-[#1b4965] bg-[#e1eaee]' : 'border-[#d7e1e8]'
            }`}
          >
            <Upload size={34} aria-hidden="true" className="text-[#1b4965]" />
            <p className="mt-3 text-sm font-semibold leading-5">Tarik berkas ke sini</p>
            <p className="mt-1 text-[11px] font-medium leading-4 text-[#445665]">CSV, XLSX, atau GeoJSON (.json)</p>
          </div>

          <div className="mt-4 flex justify-center">
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.json,.geojson"
              className="hidden"
              tabIndex={-1}
              onChange={(e) => {
                handleFile(e.target.files[0]);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={reading}
              className={`${BTN_OUTLINE} w-[178px] disabled:cursor-wait disabled:opacity-50`}
            >
              Pilih berkas
            </button>
          </div>

          <div className="mt-5 border-t border-[#d7e1e8] pt-5">
            <p className="text-[11px] font-medium leading-4 text-[#445665]">Status berkas</p>
            <p aria-live="polite" className="mt-2 break-words text-sm font-semibold leading-5">
              {reading ? 'Membaca berkas...' : hasFile ? file.fileName : 'Belum ada berkas dipilih'}
            </p>
            {hasFile && (
              <p className="mt-1 text-[11px] font-medium leading-4 text-[#445665]">
                {file.rows.length} baris, {file.headers.length} kolom, {formatFileSize(file.fileSize)}
              </p>
            )}
            {error && (
              <p role="alert" className="mt-2 text-xs leading-[18px] text-[#a12b31]">{error}</p>
            )}
            <p className="mt-3 text-[11px] font-medium leading-4 text-[#445665]">
              Ukuran maksimum dan aturan format mengikuti kebijakan integrasi.
            </p>
            <p className="mt-2 text-[11px] font-medium leading-4 text-[#445665]">
              Untuk XLSX, hanya lembar pertama yang dibaca. Format kolom NPSN sebagai Teks agar nol di depan
              tidak hilang.
            </p>
            <div className="mt-4" aria-live="polite">
              <StatusPill>{draftSaved ? 'Draf tersimpan' : 'Draf'}</StatusPill>
            </div>
          </div>
        </section>

        <section aria-labelledby="judul-pemetaan" className={`${CARD} min-w-0 p-[17px]`}>
          <h2 id="judul-pemetaan" className="text-base font-semibold leading-6">Pemetaan kolom</h2>
          <p className="text-xs leading-[18px] text-[#445665]">
            {isWilayah
              ? 'Berkas poligon batas wilayah terdeteksi (GeoJSON MultiPolygon). Atribut kecamatan otomatis terpetakan.'
              : 'Kolom wajib harus dipetakan sebelum validasi.'}
          </p>

          {isWilayah ? (
            <div className="mt-5 rounded-lg border border-[#c4e0d7] bg-[#f4f9f7] p-4 text-xs leading-5 text-[#1b4965]">
              <p className="font-semibold text-[#126552]">Fitur Batas Wilayah Kecamatan Terdeteksi ({file?.rows?.length || 0} Wilayah)</p>
              <p className="mt-1">
                Poligon spasial otomatis dikonversi ke sistem koordinat WGS84 (PostGIS). Bidang atribut yang teridentifikasi:
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-[#2d5061]">
                {file?.headers?.map((h, i) => (
                  <li key={i}><span className="font-medium text-[#173042]">{h}</span></li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-[#445665]">
                Klik &quot;Impor Cepat (1-Klik ke DB)&quot; di bawah untuk langsung memperbarui batas kecamatan dan mengaitkan sekolah-sekolah di dalamnya secara otomatis.
              </p>
            </div>
          ) : (
            <div
              role="region"
              aria-label="Tabel pemetaan kolom"
              tabIndex={0}
              className={`mt-5 overflow-x-auto ${FOCUS}`}
            >
              <table className="w-full min-w-[560px] text-left">
                <thead>
                  <tr>
                    <th scope="col" className={`${TH} w-[25%]`}>Kolom SADAR EDU</th>
                    <th scope="col" className={`${TH} w-[35%]`}>Kolom sumber</th>
                    <th scope="col" className={`${TH} w-[40%]`}>Aturan</th>
                  </tr>
                </thead>
                <tbody>
                  {FIELDS.map((field) => (
                    <tr key={field.key}>
                      <th scope="row" className={`${TD} text-sm font-semibold`}>{field.label}</th>
                      <td className={TD}>
                        <select
                          aria-label={`Kolom sumber untuk ${field.label}`}
                          disabled={!hasFile}
                          value={mapping[field.key] ?? ''}
                          onChange={(e) => {
                            setMapping({ ...mapping, [field.key]: e.target.value });
                            setDraftSaved(false);
                          }}
                          className={`h-9 w-full max-w-[240px] cursor-pointer rounded-lg border border-[#d7e1e8] bg-white px-2 text-xs text-[#173042] disabled:cursor-not-allowed disabled:bg-[#f9fafb] disabled:text-[#445665] ${FOCUS}`}
                        >
                          <option value="">Pilih kolom</option>
                          {hasFile &&
                            file.headers.map((header, index) => (
                              <option key={`${header}-${index}`} value={String(index)}>
                                {header || `(kolom ${index + 1} tanpa judul)`}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td className={`${TD} text-[#445665]`}>{field.rule}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p id="catatan-validasi" className="text-xs leading-[18px] text-[#445665]">
          {hasFile && file.rows.length === 0
            ? 'Berkas tidak berisi baris data, jadi belum bisa divalidasi.'
            : 'Validasi aktif setelah berkas dan seluruh kolom wajib dipilih.'}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleQuickImport}
            disabled={!ready || isQuickImporting}
            className={`${BTN_PRIMARY} flex items-center gap-2 bg-[#126552] hover:bg-[#0e5041] disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <Sparkles size={16} />
            {isQuickImporting ? 'Memvalidasi & Menyimpan...' : 'Impor Cepat (1-Klik ke DB)'}
          </button>
          <button
            type="button"
            onClick={handleValidate}
            disabled={!ready}
            aria-describedby="catatan-validasi"
            className={`${BTN_OUTLINE} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            Jalankan validasi berurutan
          </button>
        </div>
      </div>
    </div>
  );
}

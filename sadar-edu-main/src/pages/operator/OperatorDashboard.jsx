import GeoLoader from '../../components/ui/GeoLoader';
import { useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChartColumn, Database, ShieldCheck, TriangleAlert, Upload, Wrench } from 'lucide-react';
import { useOperatorStore } from '../../store/useOperatorStore';
import { useAuthStore } from '../../store/useAuthStore';
import { isProvenanceComplete } from '../../lib/operatorImport';
import IsoScene from '../../components/operator/IsoScene';
import './operator-dashboard.css';
const OperatorMapPreview = lazy(() => import('../../components/operator/OperatorMapPreview'));
import {
  EMPTY,
  FOCUS,
  StatusPill,
  formatTimestamp,
} from '../../components/operator/ui';

const ALERTS = [
  {
    icon: TriangleAlert,
    tone: 'amber',
    title: 'Validasi belum dijalankan',
    text: 'Unggah dataset untuk melihat temuan.',
  },
  {
    icon: Database,
    tone: 'teal',
    title: 'Provenance belum lengkap',
    text: 'Sumber dan periode wajib sebelum pengajuan.',
  },
  {
    icon: ShieldCheck,
    tone: 'green',
    title: 'Tidak ada pengajuan aktif',
    text: 'Status muncul setelah dikirim ke Dinas.',
  },
];

const STATUS_TONE = {
  Selesai: 'success',
  Diterapkan: 'success',
  Diajukan: 'success',
  Tersimpan: 'success',
  Aktif: 'success',
  'Perlu perbaikan': 'warning',
  Diusulkan: 'warning',
  Nonaktif: 'neutral',
  Draf: 'neutral',
};

const STAGE_TONE = {
  Dataset: 'green',
  Validasi: 'amber',
  Perbaikan: 'amber',
  Pengajuan: 'teal',
};

const SHORTCUTS = [
  { label: 'Unggah berkas baru', to: '/operator/dataset/impor', icon: Upload },
  { label: 'Perbaiki data', to: '/operator/validasi/perbaikan', icon: Wrench },
  { label: 'Indikator & metadata', to: '/operator/indikator', icon: ChartColumn },
];

const COMPOSITION_COLORS = ['#145646', '#2f9a75', '#d97706', '#9fb3a8', '#0f766e'];
const DOTS = 84;

function greetingFor(date = new Date()) {
  const hour = date.getHours();
  if (hour < 11) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 18) return 'Selamat sore';
  return 'Selamat malam';
}

export default function OperatorDashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const versions = useOperatorStore((state) => state.versions);
  const activity = useOperatorStore((state) => state.activity);
  const fetchDatasets = useOperatorStore((state) => state.fetchDatasets);

  const draft = useOperatorStore((state) => state.draft);
  const validation = useOperatorStore((state) => state.validation);
  const provenance = useOperatorStore((state) => state.provenance);
  const submission = useOperatorStore((state) => state.submission);

  useEffect(() => {
    fetchDatasets();
  }, [fetchDatasets]);

  const countByStatus = (status) => versions.filter((version) => version.status === status).length;
  const activeDatasets = versions.filter((v) => v.aktif !== false).length;
  const firstName = String(user?.nama ?? user?.name ?? 'Operator').split(/\s+/)[0];

  const metrics = [
    {
      label: 'Dataset aktif',
      value: activeDatasets > 0 ? activeDatasets : (versions.length > 0 ? versions.length : EMPTY),
      note: activeDatasets > 0 ? `${activeDatasets} dataset aktif di server` : 'Versi belum tersedia',
      icon: Database,
    },
    {
      label: 'Siap ditinjau',
      value: validation ? countByStatus('Siap ditinjau') : countByStatus('Siap digunakan'),
      note: validation ? 'Lolos validasi draf' : (versions.length > 0 ? `${countByStatus('Siap digunakan')} dataset valid` : 'Menunggu validasi'),
      icon: ShieldCheck,
    },
    {
      label: 'Perlu perbaikan',
      value: validation ? countByStatus('Perlu perbaikan') : 0,
      note: validation ? 'Dari validasi terakhir' : 'Belum divalidasi',
      icon: TriangleAlert,
    },
  ];

  const alerts = [
    validation
      ? {
          icon: TriangleAlert,
          tone: 'amber',
          title: 'Validasi terakhir',
          text:
            validation.needsFixRows > 0
              ? `${validation.needsFixRows} dari ${validation.totalRows} baris perlu perbaikan.`
              : `Semua ${validation.totalRows} baris lolos aturan.`,
        }
      : ALERTS[0],
    isProvenanceComplete(provenance)
      ? {
          icon: Database,
          tone: 'teal',
          title: 'Provenance lengkap',
          text: 'Sumber, periode, cakupan, dan lisensi sudah diisi.',
        }
      : ALERTS[1],
    submission
      ? {
          icon: ShieldCheck,
          tone: 'green',
          title: 'Pengajuan aktif',
          text: `${submission.fileName} menunggu peninjauan Dinas.`,
        }
      : ALERTS[2],
  ];

  // Alur kerja pembaruan data: tiap tahap tampil sebagai pil progres.
  const needsFix = validation?.needsFixRows ?? 0;
  const stages = [
    { key: 'impor', label: 'Impor', done: Boolean(draft) || versions.length > 0, to: '/operator/dataset/impor' },
    { key: 'validasi', label: 'Validasi', done: Boolean(validation) && needsFix === 0, warn: Boolean(validation) && needsFix > 0, to: '/operator/validasi' },
    { key: 'provenance', label: 'Provenance', done: isProvenanceComplete(provenance), to: '/operator/pengajuan/status' },
    { key: 'pengajuan', label: 'Pengajuan', done: Boolean(submission), to: '/operator/pengajuan' },
  ];
  const currentIndex = stages.findIndex((stage) => !stage.done);
  const doneCount = stages.filter((stage) => stage.done).length;

  // Matriks titik untuk kartu kesehatan validasi.
  const totalRows = validation?.totalRows ?? 0;
  const validRows = Math.max(0, totalRows - needsFix);
  const warnDots = totalRows > 0 ? Math.round((needsFix / totalRows) * DOTS) : 0;
  const okDots = totalRows > 0 ? DOTS - warnDots : 0;

  // Komposisi status versi dataset untuk diagram cincin.
  const composition = Object.entries(
    versions.reduce((acc, version) => {
      const key = version.status || 'Lainnya';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const compositionTotal = composition.reduce((sum, [, count]) => sum + count, 0);
  const RING = 2 * Math.PI * 42;
  const segments = composition.map(([status, count], index) => {
    const before = composition.slice(0, index).reduce((sum, [, c]) => sum + c, 0);
    return {
      status,
      length: (count / compositionTotal) * RING,
      offset: (before / compositionTotal) * RING,
      color: COMPOSITION_COLORS[index % COMPOSITION_COLORS.length],
    };
  });

  const timeline = activity.slice(0, 4);

  return (
    <div className="operator-overview">
      {/* Salam + KPI */}
      <div className="ov-hero">
        <div className="ov-hero__greeting">
          <h1>
            {greetingFor()}, <span>{firstName}</span>
          </h1>
          <p className="ov-hero__lead">Periksa sebaran sekolah dan selesaikan pembaruan data Anda.</p>
        </div>
        <dl className="ov-kpis">
          {metrics.map(({ label, value, note, icon: Icon }) => (
            <div key={label} className="ov-kpi" title={note}>
              <dt>
                <span className="ov-kpi__icon" aria-hidden="true"><Icon size={14} /></span>
                {label}
              </dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Pil progres alur kerja */}
      <ol className="ov-progress" aria-label={`Alur pembaruan data, ${doneCount} dari ${stages.length} tahap selesai`}>
        {stages.map((stage, index) => {
          const state = stage.done ? 'done' : stage.warn ? 'warn' : index === currentIndex ? 'current' : 'todo';
          const stateText = { done: 'Selesai', warn: 'Perlu perbaikan', current: 'Berikutnya', todo: 'Menunggu' }[state];
          return (
            <li key={stage.key} className={`ov-progress__item is-${state}`}>
              <span className="ov-progress__label">{stage.label}</span>
              <button type="button" onClick={() => navigate(stage.to)} className={`ov-progress__bar ${FOCUS}`}>
                <span>{stateText}</span>
                <span className="sr-only">, buka tahap {stage.label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="ov-bento">
        {/* Kartu ilustrasi kawasan */}
        <section className="ov-card ov-scene" aria-labelledby="judul-kawasan">
          <div className="ov-scene__text">
            <h2 id="judul-kawasan">Data sekolah Kabupaten Bogor</h2>
            <p>Impor berkas baru, validasi, lalu ajukan ke Dinas dalam satu alur.</p>
            <div className="ov-scene__actions">
              <button
                type="button"
                onClick={() => navigate('/operator/dataset/impor')}
                className={`ov-btn ov-btn--dark ${FOCUS}`}
              >
                <Upload size={16} aria-hidden="true" />
                Impor dataset
              </button>
              <button
                type="button"
                onClick={() => navigate('/operator/dataset')}
                className={`ov-btn ${FOCUS}`}
              >
                Kelola data sekolah
              </button>
            </div>
          </div>
          <IsoScene variant="district" className="ov-scene__art" title="Ilustrasi kawasan sekolah" />
        </section>

        {/* Linimasa aktivitas */}
        <section className="ov-card ov-timeline" aria-labelledby="judul-linimasa">
          <div className="ov-card__head">
            <h2 id="judul-linimasa">Linimasa</h2>
            <button
              type="button"
              onClick={() => navigate('/operator/pengajuan/status')}
              aria-label="Buka preview dan status"
              className={`ov-round ${FOCUS}`}
            >
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
          <ol className="ov-timeline__list">
            {timeline.length > 0
              ? timeline.map((item, index) => (
                  <li key={item.id} className={index === 0 ? 'is-current' : ''}>
                    <span className="ov-timeline__time">
                      {new Date(item.at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).replace('.', ':')}
                    </span>
                    <span className="ov-timeline__event">
                      <span className="ov-timeline__title">{item.text}</span>
                      <span className="ov-timeline__meta">{item.stage} · {item.status}</span>
                    </span>
                  </li>
                ))
              : stages.map((stage, index) => (
                  <li key={stage.key} className={index === Math.max(0, currentIndex) ? 'is-current' : ''}>
                    <span className="ov-timeline__time">{String(index + 1).padStart(2, '0')}</span>
                    <button type="button" onClick={() => navigate(stage.to)} className={`ov-timeline__event ${FOCUS}`}>
                      <span className="ov-timeline__title">{stage.label}</span>
                      <span className="ov-timeline__meta">{stage.done ? 'Selesai' : 'Belum dimulai'}</span>
                    </button>
                  </li>
                ))}
          </ol>
          <div className="ov-timeline__foot">
            <p className="ov-timeline__count">
              <strong>{doneCount}</strong>/{stages.length}
              <span>tahap alur selesai</span>
            </p>
            <span className="ov-meter" aria-hidden="true">
              <span style={{ width: `${(doneCount / stages.length) * 100}%` }} />
            </span>
            <ul className="ov-shortcuts" aria-label="Pintasan">
              {SHORTCUTS.map(({ label, to, icon: Icon }) => (
                <li key={to}>
                  <button type="button" onClick={() => navigate(to)} className={FOCUS}>
                    <Icon size={15} aria-hidden="true" />
                    {label}
                    <ArrowRight size={14} aria-hidden="true" className="ov-shortcuts__go" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Kartu gelap: kesehatan validasi */}
        <section className="ov-card ov-dark" aria-labelledby="judul-validasi">
          <div className="ov-card__head">
            <h2 id="judul-validasi">Kesehatan validasi</h2>
            <button
              type="button"
              onClick={() => navigate('/operator/validasi')}
              aria-label="Buka validasi data"
              className={`ov-round ov-round--dark ${FOCUS}`}
            >
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="ov-dark__stats">
            <p><strong>{validation ? validRows : EMPTY}</strong><span>baris lolos</span></p>
            <p className="is-warn"><strong>{validation ? needsFix : EMPTY}</strong><span>perlu perbaikan</span></p>
          </div>
          <div className="ov-dots" role="img" aria-label={validation ? `${validRows} baris lolos dan ${needsFix} baris perlu perbaikan dari ${totalRows} baris` : 'Belum ada hasil validasi'}>
            {Array.from({ length: DOTS }, (_, i) => (
              <span key={i} className={i < okDots ? 'is-ok' : i < okDots + warnDots ? 'is-warn' : ''} />
            ))}
          </div>
          {!validation && <p className="ov-dark__note">Jalankan validasi untuk mengisi matriks ini.</p>}
        </section>

        {/* Peta cakupan */}
        <section className="ov-card ov-map" aria-labelledby="judul-cakupan">
          <div className="ov-card__head">
            <div>
              <h2 id="judul-cakupan">Cakupan lokasi sekolah</h2>
              <p>Data server dan lokasi draf yang sedang dikelola</p>
            </div>
            <StatusPill>Pratinjau interaktif</StatusPill>
          </div>
          <div className="ov-map__frame">
            <Suspense fallback={<GeoLoader label="Memuat pratinjau peta…" />}><OperatorMapPreview /></Suspense>
          </div>
        </section>

        {/* Cincin komposisi dataset */}
        <section className="ov-card ov-donut" aria-labelledby="judul-komposisi">
          <div className="ov-card__head">
            <h2 id="judul-komposisi">Komposisi dataset</h2>
          </div>
          <div className="ov-donut__ring">
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#eef4f0" strokeWidth="9" />
              {segments.map(({ status, length, offset, color }) => (
                <circle
                  key={status}
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke={color}
                  strokeWidth="9"
                  strokeDasharray={`${Math.max(0, length - 1.5)} ${RING}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 50 50)"
                />
              ))}
            </svg>
            <p className="ov-donut__center">
              <strong>{compositionTotal}</strong>
              <span>versi</span>
            </p>
          </div>
          {composition.length > 0 ? (
            <ul className="ov-donut__legend">
              {composition.map(([status, count], index) => (
                <li key={status}>
                  <span aria-hidden="true" style={{ background: COMPOSITION_COLORS[index % COMPOSITION_COLORS.length] }} />
                  {status}
                  <strong>{Math.round((count / compositionTotal) * 100)}%</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ov-muted">Belum ada versi dataset.</p>
          )}
        </section>

        {/* Perhatian data */}
        <section className="ov-card ov-attention" aria-labelledby="judul-perhatian">
          <div className="ov-card__head">
            <div>
              <h2 id="judul-perhatian">Perhatian data</h2>
              <p>Aturan yang memerlukan tindakan operator.</p>
            </div>
          </div>
          <ul>
            {alerts.map(({ icon: Icon, tone, title, text }) => (
              <li key={title}>
                <span aria-hidden="true" className={`ov-chip ov-chip--${tone}`}>
                  <Icon size={17} />
                </span>
                <span>
                  <span className="ov-attention__title">{title}</span>
                  <span className="ov-attention__text">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Aktivitas terbaru */}
        <section className="ov-card ov-activity" aria-labelledby="judul-aktivitas">
          <div className="ov-card__head">
            <div>
              <h2 id="judul-aktivitas">Aktivitas terbaru</h2>
              <p>Perubahan dataset dan keputusan akan muncul di sini.</p>
            </div>
          </div>
          <div
            role="region"
            aria-label="Tabel aktivitas terbaru"
            tabIndex={0}
            className={`ov-table-wrap ${FOCUS}`}
          >
            <table>
              <thead>
                <tr>
                  <th scope="col" className="w-[22%]">Tahap</th>
                  <th scope="col" className="w-[42%]">Aktivitas</th>
                  <th scope="col" className="w-[18%]">Waktu</th>
                  <th scope="col" className="w-[18%]">Status</th>
                </tr>
              </thead>
              <tbody>
                {activity.length === 0 ? (
                  <tr>
                    <td><StageCell stage="Dataset" /></td>
                    <td>Belum ada aktivitas</td>
                    <td>{EMPTY}</td>
                    <td><StatusPill>Menunggu</StatusPill></td>
                  </tr>
                ) : (
                  activity.map((item) => (
                    <tr key={item.id}>
                      <td><StageCell stage={item.stage} /></td>
                      <td>{item.text}</td>
                      <td>{formatTimestamp(item.at)}</td>
                      <td><StatusPill tone={STATUS_TONE[item.status] ?? 'neutral'}>{item.status}</StatusPill></td>
                    </tr>
                  ))
                )}
                {!activity.some((item) => item.stage === 'Pengajuan') && (
                  <tr>
                    <td><StageCell stage="Pengajuan" /></td>
                    <td>Belum ada pengajuan</td>
                    <td>{EMPTY}</td>
                    <td><StatusPill>Belum dimulai</StatusPill></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function StageCell({ stage }) {
  return (
    <span className="ov-stage">
      <span aria-hidden="true" className={`ov-chip ov-chip--${STAGE_TONE[stage] ?? 'green'} ov-chip--sm`}>
        {String(stage).slice(0, 1)}
      </span>
      {stage}
    </span>
  );
}

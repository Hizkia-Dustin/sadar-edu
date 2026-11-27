import { GeoMark } from '../ui/GeoLoader';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp, Bot, MapPin, RotateCcw, Globe, X, ChevronRight, ChevronDown, Layers, School, Map as MapIcon, Users,
  Target, FlaskConical, Lightbulb, BookOpen, Database, Copy, Check, Crosshair, Sparkles, CircleHelp,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useDataStore } from '../../store/useDataStore';

const defaultSuggestionsGlobal = [
  [School, 'Kebutuhan sekolah', 'Kecamatan mana yang paling kekurangan sekolah?'],
  [Layers, 'Bandingkan wilayah', 'Bandingkan kecamatan yang paling butuh sekolah baru dan renovasi kelas.'],
  [MapIcon, 'Jangkauan SMP', 'Kecamatan mana yang memiliki area terluas di luar jangkauan SMP?'],
  [Users, 'Kepadatan kelas', 'Mana tiga kecamatan dengan kelas paling padat dan kekurangan guru tertinggi?'],
];

const defaultSuggestionsKecamatan = [
  [MapIcon, 'Diagnosis wilayah', 'Apa masalah pendidikan utama di kecamatan ini?'],
  [School, 'Kondisi kelas', 'Sekolah mana di kecamatan ini yang ruang kelasnya rusak berat?'],
  [Users, 'Pilihan intervensi', 'Mana yang lebih dibutuhkan di sini, sekolah baru, ruang kelas tambahan, atau rehabilitasi?'],
  [Layers, 'Bandingkan wilayah', 'Bandingkan kecamatan ini dengan kecamatan prioritas tertinggi di Bogor.'],
];

function renderRichText(text) {
  if (!text) return null;
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

/* ---------- Bantuan agar jawaban mudah dibaca orang awam ---------- */

// Istilah teknis yang sering muncul di jawaban → penjelasan bahasa sehari-hari
const GLOSSARY = [
  [/\b(skor )?mcda\b|skor prioritas/i, 'Skor prioritas (MCDA)', 'Nilai 0–100 gabungan beberapa indikator: jarak ke sekolah, kapasitas kursi, kepadatan kelas, dan kondisi ruang kelas. Makin tinggi, makin mendesak ditangani.'],
  [/blank ?spot|di luar jangkauan/i, 'Blank spot', 'Bagian wilayah yang jaraknya lebih dari 3 km dari SMP terdekat, sehingga anak harus menempuh perjalanan jauh.'],
  [/gap kursi|kekurangan kursi/i, 'Gap kursi', 'Selisih jumlah anak usia SMP dengan kursi sekolah yang tersedia. Angka positif berarti kursi kurang.'],
  [/\busb\b|unit sekolah baru/i, 'USB', 'Unit Sekolah Baru: membangun sekolah baru di lokasi yang belum terlayani.'],
  [/\brkb\b|ruang kelas baru|penambahan ruang kelas/i, 'RKB', 'Ruang Kelas Baru: menambah ruang kelas di sekolah yang sudah ada agar kelas tidak terlalu padat.'],
  [/siswa ?\/ ?kelas|siswa per kelas|kepadatan kelas/i, 'Siswa per kelas', 'Rata-rata jumlah siswa dalam satu ruang kelas. Standar SMP idealnya maksimal 32 siswa.'],
  [/siswa ?\/ ?guru|siswa per guru|rasio guru/i, 'Siswa per guru', 'Rata-rata jumlah siswa yang ditangani satu guru. Makin besar, makin berat beban guru.'],
  [/rusak berat/i, 'Rusak berat', 'Ruang kelas yang kerusakannya tinggi dan berisiko dipakai, sehingga perlu rehabilitasi segera.'],
  [/\brombel\b/i, 'Rombel', 'Rombongan belajar: satu kelompok kelas siswa.'],
];

const TOPICS = {
  guru_sekolah: [Users, 'Beban guru per sekolah'],
  prioritas: [Target, 'Prioritas wilayah'],
  jangkauan: [MapIcon, 'Jangkauan sekolah'],
  kapasitas: [Users, 'Kapasitas & kelas'],
  simulasi: [FlaskConical, 'Simulasi intervensi'],
};

const TONE_LABEL = { danger: 'Kritis', warn: 'Perlu perhatian', good: 'Baik', neutral: 'Info' };

// Kategori prioritas → warna & posisi pada skala
const CATEGORY = [
  [/sangat tinggi/i, 'very-high'],
  [/tinggi/i, 'high'],
  [/sedang/i, 'medium'],
  [/rendah/i, 'low'],
];

function parseBadge(badge = '') {
  const score = Number(String(badge).match(/(\d+(?:[.,]\d+)?)/)?.[1]?.replace(',', '.'));
  const cat = CATEGORY.find(([re]) => re.test(badge));
  const label = cat ? String(badge).match(cat[0])[0] : null;
  return { score: Number.isFinite(score) && score <= 100 ? score : null, level: cat?.[1] || null, label };
}

function stripMarkup(text = '') {
  return String(text).replace(/\*\*/g, '');
}

function cleanChipLabel(label = '') {
  return label.replace(/^[\p{Extended_Pictographic}️‍\s]+/u, '');
}

/** Kelompokkan metrik "Skor MCDA Nanggung", "Blank Spot Nanggung" per kecamatan agar tidak bercampur */
function groupMetrics(metrics, names) {
  const sorted = [...names].filter(Boolean).sort((a, b) => b.length - a.length);
  const groups = new Map();
  let ungrouped = 0;
  for (const m of metrics) {
    const name = sorted.find(n => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(m.label));
    if (!name) ungrouped += 1;
    const label = name
      ? m.label.replace(new RegExp(`\\s*\\(?\\b(kec\\.\\s*)?${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b\\)?\\s*`, 'i'), ' ').trim() || m.label
      : m.label;
    const key = name || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...m, label });
  }
  const grouped = groups.size > 1 && ungrouped === 0;
  return grouped ? [...groups.entries()] : [['', metrics]];
}

const LOADING_STEPS = ['Membaca data peta', 'Menghitung indikator wilayah', 'Menyusun jawaban'];

function ThinkingSteps() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep(s => Math.min(s + 1, LOADING_STEPS.length - 1)), 1500);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="sh-chat-thinking" role="status" aria-live="polite">
      <GeoMark />
      <ol>
        {LOADING_STEPS.map((label, i) => (
          <li key={label} className={i < step ? 'is-done' : i === step ? 'is-active' : ''}>
            {i < step ? <Check size={12} /> : <span aria-hidden="true" />}
            {label}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Section({ icon: Icon, title, hint, children, className = '' }) {
  return (
    <section className={`sh-ans-section ${className}`}>
      <h5><Icon size={13} aria-hidden="true" />{title}{hint && <span className="sh-ans-hint">{hint}</span>}</h5>
      {children}
    </section>
  );
}

function AnswerCard({ answer, isLast, pending, compact, onToggleCompact, onHighlight, onSend, kecamatanById }) {
  const [copied, setCopied] = useState(false);
  const [TopicIcon, topicLabel] = TOPICS[answer.topic] || [Sparkles, 'Analisis wilayah'];

  // Nama wilayah yang sedang disorot di peta
  const highlighted = useMemo(() => {
    const ids = answer.highlight_wilayah?.length ? answer.highlight_wilayah : answer.primary_wilayah?.id ? [answer.primary_wilayah.id] : [];
    return ids.map(id => {
      const row = answer.comparison?.find(r => Number(r.wilayahId) === Number(id));
      return { id, name: row?.wilayah || kecamatanById.get(String(id)) || (Number(answer.primary_wilayah?.id) === Number(id) ? answer.primary_wilayah.name : null) };
    }).filter(item => item.name);
  }, [answer, kecamatanById]);

  const districtNames = useMemo(() => [
    ...(answer.comparison || []).map(r => r.wilayah),
    ...highlighted.map(h => h.name),
  ], [answer.comparison, highlighted]);

  const metricGroups = useMemo(() => groupMetrics(answer.metrics || [], districtNames), [answer.metrics, districtNames]);

  const terms = useMemo(() => {
    const text = [answer.headline, answer.summary, answer.recommendation, ...(answer.metrics || []).map(m => m.label),
      ...(answer.comparison || []).map(r => r.detail), ...(answer.evidence || [])].join(' ');
    return GLOSSARY.filter(([re]) => re.test(text));
  }, [answer]);

  const focusOnMap = (ids, wilayahId = null, focusPanel = false) => onHighlight?.({
    highlightIds: ids,
    wilayahId: wilayahId ?? ids[0] ?? null,
    layers: answer.suggested_layers || ['mcdaLayer'],
    focusPanel,
  });

  const copyAnswer = async () => {
    const text = [answer.headline, stripMarkup(answer.summary), answer.recommendation && `Usulan: ${stripMarkup(answer.recommendation)}`]
      .filter(Boolean).join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard tidak tersedia */ }
  };

  if (compact) {
    return (
      <div className="sh-ans is-compact">
        <div className="sh-ans-topic"><TopicIcon size={12} />{topicLabel}</div>
        {answer.headline && <h4 className="sh-chat-headline">{answer.headline}</h4>}
        <p className="sh-ans-summary is-clamped">{renderRichText(answer.summary)}</p>
        <button type="button" className="sh-ans-expand" onClick={onToggleCompact}>
          Tampilkan rincian <ChevronDown size={13} />
        </button>
      </div>
    );
  }

  return (
    <div className="sh-ans">
      <div className="sh-ans-topic"><TopicIcon size={12} />{topicLabel}</div>
      {answer.headline && <h4 className="sh-chat-headline">{answer.headline}</h4>}

      {/* Tautan jelas ke peta: wilayah mana yang sedang diwarnai */}
      {highlighted.length > 0 && (
        <button type="button" className="sh-ans-mapnote" onClick={() => focusOnMap(highlighted.map(h => h.id), null, false)} title="Sorot ulang di peta">
          <Crosshair size={14} aria-hidden="true" />
          <span>Disorot di peta: <strong>{highlighted.map(h => h.name).join(', ')}</strong></span>
        </button>
      )}

      <Section icon={Sparkles} title="Inti jawaban" className="is-summary">
        <p className="sh-ans-summary">{renderRichText(answer.summary)}</p>
        {answer.schools?.length > 0 && <ol className="sh-staffing-schools">
          {answer.schools.map(school => <li key={school.id}>
            <strong>{school.name}</strong>
            <small>Kec. {school.district} · {school.detail}</small>
          </li>)}
        </ol>}
      </Section>

      {answer.metrics?.length > 0 && (
        <Section icon={Database} title="Angka kunci" hint="warna = tingkat urgensi">
          {metricGroups.map(([group, items]) => (
            <div key={group || 'all'} className="sh-ans-metric-group">
              {group && <span className="sh-ans-metric-group-name"><MapPin size={11} />Kec. {group}</span>}
              <div className="sh-chat-metrics" role="list">
                {items.map((m, i) => (
                  <div key={i} className={`sh-chat-metric tone-${m.tone || 'neutral'}`} role="listitem">
                    <span className="sh-chat-metric-label">{m.label}</span>
                    <strong className="sh-chat-metric-val">{m.value}</strong>
                    <span className="sh-chat-metric-tone">{TONE_LABEL[m.tone] || TONE_LABEL.neutral}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Section>
      )}

      {answer.comparison?.length > 0 && (
        <Section icon={Layers} title="Peringkat wilayah" hint="klik untuk buka di peta">
          <ol className="sh-chat-compare">
            {answer.comparison.map((row, i) => {
              const { score, level, label } = parseBadge(row.badge);
              return (
                <li key={i}>
                  <button
                    type="button"
                    className={`sh-chat-compare-row ${level ? `lvl-${level}` : ''}`}
                    disabled={!row.wilayahId}
                    onClick={() => row.wilayahId && focusOnMap([row.wilayahId], row.wilayahId, true)}
                  >
                    <span className="sh-chat-compare-rank">{i + 1}</span>
                    <span className="sh-chat-compare-body">
                      <span className="sh-chat-compare-top">
                        <strong>Kec. {row.wilayah}</strong>
                        {label && <span className="sh-chat-compare-badge">{label}</span>}
                      </span>
                      {score != null && (
                        <span className="sh-chat-scorebar" aria-label={`Skor prioritas ${score} dari 100`}>
                          <span className="sh-chat-scorebar-track"><span style={{ width: `${score}%` }} /></span>
                          <b>{score.toLocaleString('id-ID', { maximumFractionDigits: 1 })}<small>/100</small></b>
                        </span>
                      )}
                      {score == null && row.badge && <span className="sh-chat-compare-badge">{row.badge}</span>}
                      {row.detail && <span className="sh-chat-compare-detail">{row.detail}</span>}
                    </span>
                    {row.wilayahId && <ChevronRight size={15} className="sh-chat-compare-go" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ol>
        </Section>
      )}

      {answer.recommendation && (
        <div className="sh-chat-rec">
          <Lightbulb size={16} aria-hidden="true" />
          <div>
            <span className="sh-chat-rec-title">Langkah yang disarankan</span>
            <p>{renderRichText(answer.recommendation)}</p>
          </div>
        </div>
      )}

      {(answer.action_chips?.length > 0 || highlighted.length > 1) && (
        <Section icon={MapIcon} title="Lanjutkan di peta">
          <div className="sh-chat-chips" role="group">
            {(answer.action_chips || []).map((chip, idx) => {
              const ChipIcon = chip.action === 'simulate' ? FlaskConical : chip.wilayahId ? MapPin : Layers;
              return (
                <button
                  key={idx}
                  type="button"
                  className={`sh-chat-chip-btn ${chip.action === 'simulate' ? 'is-sim' : ''}`}
                  onClick={() => onHighlight?.({
                    wilayahId: chip.wilayahId ?? null,
                    highlightIds: chip.wilayahId ? [chip.wilayahId] : [],
                    layer: chip.layer,
                    action: chip.action,
                    tipe: chip.tipe,
                    jumlah: chip.jumlah,
                    focusPanel: Boolean(chip.wilayahId),
                  })}
                  title={chip.action === 'simulate' ? 'Buka tab Simulasi Intervensi' : chip.wilayahId ? 'Fokus wilayah di peta' : 'Aktifkan lapisan peta'}
                >
                  <ChipIcon size={13} aria-hidden="true" />
                  {cleanChipLabel(chip.label)}
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {(terms.length > 0 || answer.evidence?.length > 0) && (
        <div className="sh-ans-foldouts">
          {terms.length > 0 && (
            <details className="sh-chat-glossary">
              <summary><BookOpen size={13} />Arti istilah ({terms.length})<ChevronDown size={13} className="sh-fold-caret" /></summary>
              <dl>
                {terms.map(([, term, desc]) => (
                  <div key={term}><dt>{term}</dt><dd>{desc}</dd></div>
                ))}
              </dl>
            </details>
          )}
          {answer.evidence?.length > 0 && (
            <details className="sh-chat-evidence">
              <summary><CircleHelp size={13} />Dari mana angka ini? ({answer.evidence.length})<ChevronDown size={13} className="sh-fold-caret" /></summary>
              <ul>{answer.evidence.map((line, i) => <li key={i}>{renderRichText(line)}</li>)}</ul>
            </details>
          )}
        </div>
      )}

      {isLast && !pending && answer.follow_ups?.length > 0 && (
        <div className="sh-chat-followups" aria-label="Analisis lanjutan">
          <span className="sh-chat-followups-label">Mungkin ingin ditanyakan berikutnya</span>
          {answer.follow_ups.map(q => String(q).replace(/^[\s,.;:–-]+/, '')).filter(Boolean).map((qText, i) => (
            <button key={i} type="button" onClick={() => onSend(qText)}>
              <span>{qText}</span>
              <ChevronRight size={13} />
            </button>
          ))}
        </div>
      )}

      <footer className="sh-ans-foot">
        <small><Database size={11} />{answer.source || 'Analis Spasial SADAR EDU'}{answer.tahun ? ` · Data ${answer.tahun}` : ''}</small>
        <span>
          {!isLast && onToggleCompact && (
            <button type="button" onClick={onToggleCompact}>Ringkas</button>
          )}
          <button type="button" onClick={copyAnswer} title="Salin ringkasan jawaban">
            {copied ? <Check size={12} /> : <Copy size={12} />}{copied ? 'Tersalin' : 'Salin'}
          </button>
        </span>
      </footer>
    </div>
  );
}

function Conversation({ wilayah, kecamatan = [], tahun, weights, open, onHighlight, onResetMap }) {
  const [expanded, setExpanded] = useState(() => new Set());
  const kecamatanById = useMemo(() => new Map(kecamatan.map(k => [String(k.id), k.name])), [kecamatan]);
  const [turns, setTurns] = useState([]);
  const [draft, setDraft] = useState('');
  const request = useRef(null);
  const log = useRef(null);
  const pending = turns.at(-1)?.pending;
  const ready = Boolean(tahun);

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    // Mulai dari pertanyaan terbaru agar jawaban panjang bisa dibaca dari awal.
    if (open && log.current && turns.length) {
      const last = log.current.lastElementChild;
      if (last) log.current.scrollTop += last.getBoundingClientRect().top - log.current.getBoundingClientRect().top - 16;
    }
  }, [turns, open]);

  async function send(text) {
    const question = text.trim();
    if (!ready || !question || request.current) return;
    const controller = new AbortController();
    request.current = controller;

    const history = turns.filter(turn => turn.answer).slice(-5).map(({ question: q, answer }) => ({
      question: q,
      summary: [answer.summary, ...(answer.schools || []).map(s => `${s.name} (${s.district}): ${s.detail}`),
        ...(answer.comparison || []).map(r => `${r.wilayah}: ${r.detail}`)].join('\n').slice(0, 2000),
      headline: answer.headline,
      districtIds: answer.highlight_wilayah,
      scopeDistrictIds: answer.scopeDistrictIds,
      schoolIds: answer.schools?.map(s => s.id),
      topic: answer.topic,
    }));

    const scope = wilayah?.name ? `Kec. ${wilayah.name}` : 'Seluruh Bogor';
    setTurns(previous => [...previous, { question, scope, pending: true }]);
    setDraft('');
    let reply;
    try {
      const answer = await api.post('/analisis/tanya-wilayah', {
        wilayahId: wilayah?.id ? Number(wilayah.id) : null,
        tahun: Number(tahun) || 2026,
        weights,
        question,
        history,
      }, { signal: controller.signal });

      reply = { answer };

      // Otomatis sorot semua wilayah hasil analisis di peta (multi-region spotlight)
      if (onHighlight && (answer?.highlight_wilayah?.length > 0 || answer?.primary_wilayah?.id)) {
        const ids = answer.highlight_wilayah?.length > 0
          ? answer.highlight_wilayah
          : [answer.primary_wilayah.id];
        onHighlight({
          highlightIds: ids,
          wilayahId: answer.primary_wilayah?.id ?? ids[0],
          layers: answer.suggested_layers || ['mcdaLayer'],
          focusPanel: false,
        });
      }
    } catch (reason) {
      reply = { error: reason.message || 'Pesan gagal dikirim.' };
    } finally {
      if (!controller.signal.aborted) {
        setTurns(previous => [...previous.slice(0, -1), { question, scope, ...reply }]);
        request.current = null;
      }
    }
  }

  function handleClear() {
    request.current?.abort();
    request.current = null;
    setTurns([]);
    setExpanded(new Set());
    setDraft('');
    if (onResetMap) onResetMap();
  }

  const suggestions = wilayah ? defaultSuggestionsKecamatan : defaultSuggestionsGlobal;

  return <div className={turns.length ? 'sh-chat-session' : 'sh-chat-session is-empty'}>
    {turns.length > 0 && (
      <div className="sh-chat-toolbar">
        <span>{turns.filter(t => t.answer).length} analisis</span>
        <button type="button" onClick={handleClear} title="Mulai percakapan analisis baru">
          <RotateCcw size={12} />
          <span>Chat baru</span>
        </button>
      </div>
    )}

    <div className="sh-chat-log" ref={log} role="log" aria-label="Percakapan">
      {!turns.length && <div className="sh-chat-intro">
        <div className="sh-chat-globe" aria-hidden="true"><Globe size={32} strokeWidth={1.35} /></div>
        <h3>Apa yang ingin kamu kaji<br />di <em>{wilayah?.name || 'Bogor'}</em>?</h3>
        <p className="sh-chat-intro-note">
          Setiap jawaban berisi inti temuan, angka kunci, peringkat wilayah, dan langkah yang disarankan.
          Wilayah yang dibahas langsung disorot di peta.
        </p>
        <div className="sh-chat-suggestions">
          {suggestions.map(([Icon, label, text]) => (
            <button type="button" key={label} disabled={!ready} title={text} onClick={() => send(text)}>
              <Icon size={15} aria-hidden="true" />{label}
            </button>
          ))}
        </div>
      </div>}

      {turns.map(({ question, scope, answer, pending: awaitingReply, error }, index) => {
        const isLast = index === turns.length - 1;
        const compact = !isLast && !expanded.has(index);
        const toggle = () => setExpanded(prev => {
          const next = new Set(prev);
          if (next.has(index)) next.delete(index); else next.add(index);
          return next;
        });
        return (
          <article key={index}>
            <div className="sh-chat-question-wrap">
              {scope && <span className="sh-chat-scope"><MapPin size={10} />{scope}</span>}
              <p className="sh-chat-question">{question}</p>
            </div>
            {awaitingReply && <ThinkingSteps />}
            {error && (
              <p role="alert" className="sh-chat-error">
                {error}{' '}
                <button type="button" disabled={pending} onClick={() => send(question)}>Kirim ulang</button>
              </p>
            )}
            {answer && (
              <AnswerCard
                answer={answer}
                isLast={isLast}
                pending={pending}
                compact={compact}
                onToggleCompact={isLast ? null : toggle}
                onHighlight={onHighlight}
                onSend={send}
                kecamatanById={kecamatanById}
              />
            )}
          </article>
        );
      })}
    </div>

    <form className="sh-chat-form" onSubmit={e => { e.preventDefault(); send(draft); }}>
      <textarea
        aria-label="Pertanyaan untuk asisten peta"
        rows={2}
        maxLength={600}
        disabled={!ready}
        placeholder={wilayah
          ? `Tanyakan tentang sekolah di ${wilayah.name}…`
          : 'Tanyakan tentang sekolah di Bogor…'}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            send(draft);
          }
        }}
      />
      <button type="submit" aria-label="Kirim pesan" title="Kirim pesan" disabled={!ready || pending || !draft.trim()}>
        <ArrowUp size={19} />
      </button>
    </form>
  </div>;
}

export default function TanyaWilayah({
  open,
  onClose,
  wilayah,
  kecamatan = [],
  onSelect,
  onHighlight,
  tahun,
  demo,
}) {
  const weights = useDataStore(state => state.weights);
  const closeButton = useRef(null);

  useEffect(() => {
    if (open) closeButton.current?.focus();
  }, [open]);

  return <aside
    id="sh-chat"
    hidden={!open}
    className="sh-chat"
    aria-labelledby="sh-chat-title"
    onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
  >
    <header className="sh-chat-head">
      <Bot size={23} aria-hidden="true" />
      <div>
        <h2 id="sh-chat-title">Asisten peta</h2>
        <small>SADAR EDU{tahun ? ' · Data ' + tahun : ''}{demo ? ' · Data demo' : ''}</small>
      </div>
      <button type="button" ref={closeButton} onClick={onClose} title="Tutup chat" aria-label="Tutup chat">
        <X size={19} />
      </button>
    </header>

    <label className="sh-chat-region">
      <MapPin size={16} aria-hidden="true" />
      <select
        aria-label="Kecamatan untuk percakapan"
        value={wilayah?.id ?? 'all'}
        onChange={e => onSelect && onSelect(e.target.value === 'all' ? null : e.target.value)}
      >
        <option value="all">Seluruh Bogor{kecamatan.length ? ` (${kecamatan.length} kecamatan)` : ''}</option>
        {kecamatan.map(k => (
          <option key={k.id} value={k.id}>Kec. {k.name}</option>
        ))}
      </select>
    </label>

    <Conversation
      key={JSON.stringify([tahun, weights])}
      wilayah={wilayah}
      kecamatan={kecamatan}
      tahun={tahun}
      weights={weights}
      open={open}
      onHighlight={onHighlight}
      onResetMap={() => onSelect && onSelect('all')}
    />
  </aside>;
}

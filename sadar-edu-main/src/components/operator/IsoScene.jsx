// Ilustrasi isometrik datar (inline SVG) untuk header & keadaan kosong ruang operator.
// Semua bentuk dibangun dari kotak isometrik sederhana: 3 sisi, garis tipis, palet terbatas.

const U = 10; // satuan grid -> px
const C30 = Math.cos(Math.PI / 6);

const INK = '#132a25';
const PAL = {
  green: { top: '#d3efe0', left: '#1f6f5f', right: '#145646' },
  teal: { top: '#e7f4ed', left: '#0f766e', right: '#0b5c56' },
  cream: { top: '#fbfaf3', left: '#e7f4ed', right: '#c9e4d5' },
  amber: { top: '#fde7bf', left: '#d97706', right: '#b7791f' },
  ink: { top: '#3a5a50', left: '#24382f', right: INK },
  ground: { top: '#eef6f0', left: '#cfe6d9', right: '#b5d8c6' },
};

const pt = (x, y, z = 0) => [(x - y) * C30 * U, (x + y) * 0.5 * U - z * U];
const poly = (pts) => pts.map((p) => pt(...p).map((n) => n.toFixed(1)).join(',')).join(' ');

function Box({ x, y, z = 0, w, d, h, tone = 'green', windows, roof }) {
  const c = PAL[tone];
  const t = z + h;
  const win = [];
  if (windows) {
    const { cols = 2, rows = 2, color = '#fbfaf3' } = windows;
    // sisi depan-kiri (bidang y = y + d)
    for (let r = 0; r < rows; r += 1) {
      for (let i = 0; i < cols; i += 1) {
        const gw = w / cols;
        const gh = h / (rows + 0.6);
        const wx = x + i * gw + gw * 0.28;
        const wz = z + h - (r + 1) * gh + gh * 0.1;
        win.push(
          <polygon
            key={`l${r}${i}`}
            points={poly([[wx, y + d, wz], [wx + gw * 0.44, y + d, wz], [wx + gw * 0.44, y + d, wz + gh * 0.55], [wx, y + d, wz + gh * 0.55]])}
            fill={color}
          />
        );
      }
    }
    // sisi depan-kanan (bidang x = x + w)
    const dcols = Math.max(1, Math.round((cols * d) / w));
    for (let r = 0; r < rows; r += 1) {
      for (let i = 0; i < dcols; i += 1) {
        const gd = d / dcols;
        const gh = h / (rows + 0.6);
        const wy = y + i * gd + gd * 0.28;
        const wz = z + h - (r + 1) * gh + gh * 0.1;
        win.push(
          <polygon
            key={`r${r}${i}`}
            points={poly([[x + w, wy, wz], [x + w, wy + gd * 0.44, wz], [x + w, wy + gd * 0.44, wz + gh * 0.55], [x + w, wy, wz + gh * 0.55]])}
            fill={color}
            opacity="0.82"
          />
        );
      }
    }
  }
  return (
    <g stroke={INK} strokeWidth="0.8" strokeLinejoin="round">
      <polygon points={poly([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, t], [x, y + d, t]])} fill={c.left} />
      <polygon points={poly([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, t], [x + w, y, t]])} fill={c.right} />
      <polygon points={poly([[x, y, t], [x + w, y, t], [x + w, y + d, t], [x, y + d, t]])} fill={c.top} />
      <g stroke="none">{win}</g>
      {roof === 'flag' && (
        <g>
          <line x1={pt(x + w * 0.5, y + d * 0.5, t)[0]} y1={pt(x + w * 0.5, y + d * 0.5, t)[1]} x2={pt(x + w * 0.5, y + d * 0.5, t + 3.2)[0]} y2={pt(x + w * 0.5, y + d * 0.5, t + 3.2)[1]} />
          <polygon points={poly([[x + w * 0.5, y + d * 0.5, t + 3.2], [x + w * 0.5 + 1.6, y + d * 0.5, t + 2.8], [x + w * 0.5, y + d * 0.5, t + 2.4]])} fill="#d97706" />
        </g>
      )}
    </g>
  );
}

function Tree({ x, y }) {
  const [cx, cy] = pt(x, y, 0);
  return (
    <g stroke={INK} strokeWidth="0.8">
      <line x1={cx} y1={cy} x2={cx} y2={cy - 9} />
      <circle cx={cx} cy={cy - 13} r="6" fill="#2f9a75" />
      <path d={`M${cx - 3} ${cy - 15} a4 4 0 0 1 4 -3`} fill="none" stroke="#d3efe0" strokeWidth="1.2" strokeLinecap="round" />
    </g>
  );
}

// Jalan lurus sepanjang sumbu x atau y, dengan marka putus-putus di tengah.
function Road({ x, y, len, axis = 'x', width = 3 }) {
  const pts = axis === 'x'
    ? [[x, y, 0], [x + len, y, 0], [x + len, y + width, 0], [x, y + width, 0]]
    : [[x, y, 0], [x + width, y, 0], [x + width, y + len, 0], [x, y + len, 0]];
  const a = axis === 'x' ? pt(x + 0.5, y + width / 2) : pt(x + width / 2, y + 0.5);
  const b = axis === 'x' ? pt(x + len - 0.5, y + width / 2) : pt(x + width / 2, y + len - 0.5);
  return (
    <g>
      <polygon points={poly(pts)} fill="#24382f" />
      <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#fbfaf3" strokeWidth="1" strokeDasharray="3 4" />
    </g>
  );
}

function Pin({ x, y, z = 0, tone = '#d97706' }) {
  const [cx, cy] = pt(x, y, z);
  return (
    <g className="iso-pin" stroke={INK} strokeWidth="0.8">
      <ellipse cx={cx} cy={cy} rx="4" ry="2" fill="#132a2522" stroke="none" />
      <path d={`M${cx} ${cy - 1} C${cx - 7} ${cy - 11} ${cx - 6} ${cy - 19} ${cx} ${cy - 19} C${cx + 6} ${cy - 19} ${cx + 7} ${cy - 11} ${cx} ${cy - 1}Z`} fill={tone} />
      <circle cx={cx} cy={cy - 13.5} r="2.3" fill="#fbfaf3" />
    </g>
  );
}

function Dashed({ from, to }) {
  const a = pt(...from);
  const b = pt(...to);
  return <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={INK} strokeWidth="0.9" strokeDasharray="2 3" opacity="0.55" />;
}

function Ground({ w, d, h = 1.2 }) {
  return <Box x={0} y={0} z={-h} w={w} d={d} h={h} tone="ground" />;
}

// Lembar dokumen yang tegak di atas bidang (dipakai di adegan dataset/validasi).
function Sheet({ x, y, z, w = 5, h = 6.5, lines = 3, check }) {
  const face = [[x, y, z], [x + w, y, z], [x + w, y, z + h], [x, y, z + h]];
  const rows = [];
  for (let i = 0; i < lines; i += 1) {
    const lz = z + h - 1.6 - i * 1.3;
    const a = pt(x + 0.9, y, lz);
    const b = pt(x + w - (i === lines - 1 ? 2 : 0.9), y, lz);
    rows.push(<line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#1f6f5f" strokeWidth="1.1" strokeLinecap="round" />);
  }
  const c = pt(x + w - 1.3, y, z + 1.3);
  return (
    <g>
      <polygon points={poly(face)} fill="#fbfaf3" stroke={INK} strokeWidth="0.8" strokeLinejoin="round" />
      {rows}
      {check && (
        <g>
          <circle cx={c[0]} cy={c[1]} r="4.2" fill={check === 'warn' ? '#d97706' : '#2f9a75'} stroke={INK} strokeWidth="0.8" />
          {check === 'warn'
            ? <path d={`M${c[0]} ${c[1] - 2.2} v2.3 M${c[0]} ${c[1] + 1.5} v0.2`} stroke="#fbfaf3" strokeWidth="1.3" strokeLinecap="round" />
            : <path d={`M${c[0] - 2} ${c[1]} l1.4 1.4 l2.6 -2.8`} fill="none" stroke="#fbfaf3" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />}
        </g>
      )}
    </g>
  );
}

const SCENES = {
  // Kawasan sekolah: gedung sekolah amber dengan bendera, gedung hijau, jalan, bus, pohon, penanda lokasi.
  district: {
    view: '-182 -28 378 248',
    draw: () => (
      <>
        <Ground w={22} d={20} />
        <Road x={0} y={12} len={22} axis="x" />
        <Road x={13} y={0} len={12} axis="y" />
        <Dashed from={[2, 2, 0]} to={[11, 2, 0]} />
        <Dashed from={[2, 2, 0]} to={[2, 10, 0]} />
        <Box x={3} y={3} w={8} d={6} h={5} tone="amber" windows={{ cols: 4, rows: 2 }} roof="flag" />
        <Box x={17} y={2} w={4} d={4} h={9} tone="green" windows={{ cols: 2, rows: 4 }} />
        <Box x={17} y={7} w={4} d={3.5} h={5} tone="teal" windows={{ cols: 2, rows: 2 }} />
        <g className="iso-bus">
          <Box x={5} y={12.6} w={4.5} d={1.8} h={1.8} tone="amber" windows={{ cols: 3, rows: 1, color: '#fbfaf3' }} />
        </g>
        <Tree x={1.5} y={17} />
        <Tree x={20.5} y={17.5} />
        <Tree x={11.5} y={17.3} />
        <Box x={4} y={16.5} w={5} d={2.5} h={3} tone="cream" windows={{ cols: 3, rows: 1, color: '#1f6f5f' }} />
        <Pin x={15} y={9} z={0} />
        <Pin x={11.5} y={10.3} tone="#2f9a75" />
      </>
    ),
  },
  // Keadaan kosong dataset: tumpukan blok data menunggu diimpor di samping gedung.
  dataset: {
    view: '-112 -42 236 190',
    draw: () => (
      <>
        <Ground w={14} d={12} />
        <Box x={2} y={2} w={5} d={5} h={1.6} tone="green" />
        <Box x={2} y={2} w={5} d={5} h={1.6} z={1.8} tone="teal" />
        <Box x={2} y={2} w={5} d={5} h={1.6} z={3.6} tone="amber" />
        <Box x={9} y={2} w={3.5} d={3.5} h={5.5} tone="cream" windows={{ cols: 2, rows: 3, color: '#1f6f5f' }} />
        <Dashed from={[4.5, 8.5, 0]} to={[12, 8.5, 0]} />
        <Pin x={11} y={9.5} />
        <Tree x={1.5} y={10.5} />
      </>
    ),
  },
  // Validasi: dokumen dengan tanda centang dan peringatan di atas alas.
  validation: {
    view: '-112 -48 236 196',
    draw: () => (
      <>
        <Ground w={14} d={12} />
        <Box x={2} y={3} w={6} d={6} h={1.2} tone="green" />
        <Sheet x={2.6} y={5.4} z={1.2} check="ok" />
        <Box x={9} y={3} w={3.5} d={3.5} h={1.2} tone="teal" />
        <Sheet x={9.3} y={5} z={1.2} w={3} h={5} lines={2} check="warn" />
        <Dashed from={[3, 10.5, 0]} to={[12.5, 10.5, 0]} />
        <Tree x={12.8} y={10} />
      </>
    ),
  },
  // Pengajuan: paket data meluncur ke gedung dinas.
  review: {
    view: '-112 -66 236 214',
    draw: () => (
      <>
        <Ground w={14} d={12} />
        <Box x={7} y={1.5} w={5.5} d={5} h={7} tone="green" windows={{ cols: 3, rows: 3 }} roof="flag" />
        <Road x={0} y={8} len={14} axis="x" width={2.4} />
        <g className="iso-bus">
          <Box x={2} y={8.3} w={2.6} d={1.8} h={1.8} tone="amber" />
        </g>
        <Sheet x={1.5} y={6} z={0} w={3.6} h={4.6} lines={2} check="ok" />
        <Tree x={1} y={11.5} />
      </>
    ),
  },
};

export default function IsoScene({ variant = 'district', className = '', title }) {
  const scene = SCENES[variant] ?? SCENES.district;
  return (
    <svg
      viewBox={scene.view}
      className={`iso-scene ${className}`}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : 'true'}
      focusable="false"
    >
      {scene.draw()}
    </svg>
  );
}

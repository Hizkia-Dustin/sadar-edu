// Ilustrasi peta skematis. Bukan lokasi nyata dan tidak memuat data sekolah.
export default function SchematicMap() {
  return (
    <svg
      viewBox="0 0 684 218"
      role="img"
      aria-label="Ilustrasi peta skematis tanpa data nyata"
      className="h-auto w-full"
    >
      <rect width="684" height="218" fill="#edf3f6" />
      <path d="M0 34 L150 0 H684 V92 L500 124 L250 96 L0 126 Z" fill="#dfe9dc" />
      <path d="M0 160 L250 126 L500 150 L684 118 V218 H0 Z" fill="#dfe9dc" />
      <path
        d="M236 0 C214 60 262 118 232 218"
        fill="none"
        stroke="#bfe3ec"
        strokeWidth="24"
        strokeLinecap="round"
      />
      <g fill="none" stroke="#ffffff" strokeWidth="5" strokeLinecap="round">
        <path d="M0 78 L684 118" />
        <path d="M60 0 L120 218" />
        <path d="M450 0 L500 218" />
        <path d="M110 190 L260 60 L430 130 L684 96" />
      </g>
      <path d="M0 196 C200 140 400 150 684 84" fill="none" stroke="#e6a03c" strokeWidth="1.5" />
      <g fill="#1b4965" stroke="#ffffff" strokeWidth="2">
        <circle cx="128" cy="106" r="6" />
        <circle cx="258" cy="74" r="6" />
        <circle cx="388" cy="122" r="6" />
        <circle cx="470" cy="70" r="6" />
      </g>
    </svg>
  );
}
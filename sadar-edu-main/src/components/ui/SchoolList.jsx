import iconList from '../../assets/figma/icon-list.svg';
import schoolA from '../../assets/figma/school-a.png';
import schoolB from '../../assets/figma/school-b.png';
import schoolC from '../../assets/figma/school-c.png';

const schools = [
  { name: 'Contoh sekolah A', image: schoolA, action: 'Lihat detail sekolah →' },
  { name: 'Contoh sekolah B', image: schoolB, action: 'Lihat detail sekolah →' },
  { name: 'Contoh sekolah C', image: schoolC, action: 'Lokasi belum tersedia', unavailable: true },
];

export default function SchoolList({ onDetail, query = '' }) {
  const visibleSchools = schools.filter(school => school.name.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <section className="school-list-content" aria-labelledby="school-list-title">
      <h2 className="school-list-title" id="school-list-title">
        <img src={iconList} alt="" />
        Daftar sekolah
      </h2>

      <div className="school-list-counts" aria-label="Ringkasan hasil">
        <div><strong>—</strong><small>Total hasil</small></div>
        <div><strong>—</strong><small>Terpetakan</small></div>
        <div><strong>—</strong><small>Tanpa titik</small></div>
      </div>

      <hr />

      <div className="school-cards">
        {visibleSchools.map((school) => (
          <article className="school-card" key={school.name}>
            <div className="school-card-image">
              <img src={school.image} alt="" />
              <span>Foto ilustrasi</span>
            </div>
            <div className="school-card-body">
              <h3>{school.name}</h3>
              <p>NPSN belum tersedia</p>
              <p>Jenjang • Status • Wilayah</p>
              {school.unavailable ? <p className="school-card-unavailable">{school.action}</p> : <button className="school-card-action" onClick={() => onDetail?.(school)}>{school.action}</button>}
            </div>
          </article>
        ))}
      </div>

      <p className="school-list-note">Nama dan atribut di atas adalah contoh struktur data.</p>
    </section>
  );
}

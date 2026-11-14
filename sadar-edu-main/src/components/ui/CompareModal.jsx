import { useShallow } from "zustand/react/shallow";
import { useMapStore } from "../../store/useMapStore";

export default function CompareModal() {
  const {
    comparedSchools,
    removeFromCompare,
    isCompareOpen,
    setIsCompareOpen,
  } = useMapStore(useShallow((state) => ({
    comparedSchools: state.comparedSchools,
    removeFromCompare: state.removeFromCompare,
    isCompareOpen: state.isCompareOpen,
    setIsCompareOpen: state.setIsCompareOpen,
  })));

  if (!isCompareOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in duration-150">
        {/* Header Modal */}
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-[#F8FAFC]">
          <div>
            <h2 className="text-lg font-bold text-[#1F6F5F]">
              Perbandingan Sekolah
            </h2>
            <p className="text-xs text-slate-500">
              Membandingkan {comparedSchools.length} dari maks. 3 sekolah
            </p>
          </div>
          <button
            onClick={() => setIsCompareOpen(false)}
            className="text-slate-400 hover:text-slate-600 font-bold text-sm px-2 py-1 rounded"
          >
            ✕
          </button>
        </div>

        {/* Tabel Komparasi */}
        <div className="p-6 overflow-x-auto">
          {comparedSchools.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              Belum ada sekolah yang dipilih. Klik titik sekolah di peta lalu
              pilih "+ Tambah ke Perbandingan".
            </div>
          ) : (
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="p-3 text-slate-400 font-medium text-xs uppercase">
                    Kriteria
                  </th>
                  {comparedSchools.map((school) => (
                    <th
                      key={school.id}
                      className="p-3 font-bold text-[#1F6F5F] min-w-[160px]"
                    >
                      <div className="flex justify-between items-start">
                        <span>{school.nama}</span>
                        <button
                          onClick={() => removeFromCompare(school.id)}
                          className="text-red-400 hover:text-red-600 text-xs font-normal"
                        >
                          Hapus
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="p-3 text-slate-500 font-medium">Status</td>
                  {comparedSchools.map((s) => (
                    <td key={s.id} className="p-3 font-semibold">
                      {s.status}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-3 text-slate-500 font-medium">Akreditasi</td>
                  {comparedSchools.map((s) => (
                    <td key={s.id} className="p-3">
                      {s.akreditasi || "-"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-3 text-slate-500 font-medium">
                    Jumlah Siswa
                  </td>
                  {comparedSchools.map((s) => (
                    <td key={s.id} className="p-3">
                      {s.jumlahSiswa ?? "-"} siswa
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-3 text-slate-500 font-medium">
                    Rasio Guru-Siswa
                  </td>
                  {comparedSchools.map((s) => (
                    <td key={s.id} className="p-3 font-semibold text-[#1F6F5F]">
                      {s.jumlahGuru > 0 ? `1 : ${Math.round(s.jumlahSiswa / s.jumlahGuru)}` : "-"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-3 text-slate-500 font-medium">
                    Ruang Kelas
                  </td>
                  {comparedSchools.map((s) => (
                    <td key={s.id} className="p-3">
                      {s.ruangKelas ?? "-"} RKB
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// DATA MASTER LAYANAN - NAUFAL LAUNDRY
// jenisCuci: 'CS' (Cuci Setrika/Komplit), 'CK' (Cuci Kering/Setrika Saja), 'SA' (Satuan)
// level: 'BIASA', 'NORMAL', 'EXPRESS', 'SUPER_EXPRESS'
// waktuJam: estimasi durasi dalam jam (dipakai hitung Est Selesai)
// ============================================

const KATEGORI_LAYANAN = [
  {
    id: 'paket_komplit',
    nama: 'Paket Cuci Komplit',
    subtitle: '(Cuci + Keringkan & Setrika)',
    jenisCuci: 'CS',
    varian: [
      { id: 'pk_biasa', label: 'Biasa', harga: 8000, satuan: 'KG', level: 'BIASA', waktuJam: 72 },
      { id: 'pk_express', label: 'Express', harga: 13000, satuan: 'KG', level: 'EXPRESS', waktuJam: 24 },
      { id: 'pk_normal', label: 'Normal', harga: 11000, satuan: 'KG', level: 'NORMAL', waktuJam: 48 },
      { id: 'pk_superexpress', label: 'Super Express', harga: 16000, satuan: 'KG', level: 'SUPER_EXPRESS', waktuJam: 6 },
    ],
  },
  {
    id: 'cuci_kering',
    nama: 'Cuci Kering',
    jenisCuci: 'CK',
    varian: [
      { id: 'ck_biasa', label: 'Biasa', harga: 7000, satuan: 'KG', level: 'BIASA', waktuJam: 72 },
      { id: 'ck_express', label: 'Express', harga: 9000, satuan: 'KG', level: 'EXPRESS', waktuJam: 24 },
      { id: 'ck_superexpress', label: 'Super Express', harga: 13000, satuan: 'KG', level: 'SUPER_EXPRESS', waktuJam: 6 },
    ],
  },
  {
    id: 'setrika_saja',
    nama: 'Setrika Saja',
    jenisCuci: 'CK',
    varian: [
      { id: 'ss_biasa', label: 'Biasa', harga: 7000, satuan: 'KG', level: 'BIASA', waktuJam: 72 },
      { id: 'ss_express', label: 'Express', harga: 8000, satuan: 'KG', level: 'EXPRESS', waktuJam: 24 },
      { id: 'ss_superexpress', label: 'Super Express', harga: 13000, satuan: 'KG', level: 'SUPER_EXPRESS', waktuJam: 6 },
    ],
  },
  {
    id: 'mukena',
    nama: 'Mukena',
    jenisCuci: 'SA',
    varian: [
      { id: 'mk_tebal_biasa', label: 'Tebal (Biasa)', harga: 8000, satuan: 'STEL', level: 'BIASA', waktuJam: 72 },
      { id: 'mk_tipis_biasa', label: 'Tipis (Biasa)', harga: 7000, satuan: 'STEL', level: 'BIASA', waktuJam: 72 },
      { id: 'mk_tebal_express', label: 'Tebal (Express)', harga: 11000, satuan: 'STEL', level: 'EXPRESS', waktuJam: 24 },
      { id: 'mk_tipis_express', label: 'Tipis (Express)', harga: 10000, satuan: 'STEL', level: 'EXPRESS', waktuJam: 24 },
    ],
  },
  {
    id: 'sejadah',
    nama: 'Sejadah',
    jenisCuci: 'SA',
    varian: [
      { id: 'sj_tebal_besar', label: 'Tebal Besar', harga: 13000, satuan: 'PTG', level: 'BIASA', waktuJam: 72 },
      { id: 'sj_tipis_besar', label: 'Tipis Besar', harga: 11000, satuan: 'PTG', level: 'BIASA', waktuJam: 72 },
      { id: 'sj_kecil', label: 'Kecil', harga: 7000, satuan: 'PTG', level: 'BIASA', waktuJam: 72 },
    ],
  },
  {
    id: 'handuk',
    nama: 'Handuk',
    jenisCuci: 'SA',
    varian: [
      { id: 'hd_superbesar', label: 'Super Besar', harga: 11000, satuan: 'PTG', level: 'BIASA', waktuJam: 72 },
      { id: 'hd_tebalbesar', label: 'Tebal Besar', harga: 9000, satuan: 'PTG', level: 'BIASA', waktuJam: 72 },
      { id: 'hd_tipisbesar', label: 'Tipis Besar', harga: 8000, satuan: 'PTG', level: 'BIASA', waktuJam: 72 },
    ],
  },
  {
    id: 'gorden',
    nama: 'Gorden',
    jenisCuci: 'SA',
    varian: [
      { id: 'gd_fitrase', label: 'Fitrase', harga: 7000, satuan: 'M', level: 'BIASA', waktuJam: 72 },
      { id: 'gd_kain', label: 'Kain', harga: 8000, satuan: 'M', level: 'BIASA', waktuJam: 72 },
    ],
  },
  {
    id: 'dress_gaun',
    nama: 'Dress, Gaun & Kebaya',
    jenisCuci: 'SA',
    varian: [
      { id: 'dg_dilipat', label: 'Dilipat', harga: 16000, satuan: 'PTG', level: 'BIASA', waktuJam: 72 },
      { id: 'dg_digantung', label: 'Digantung', harga: 21000, satuan: 'STEL', level: 'BIASA', waktuJam: 72 },
    ],
  },
  {
    id: 'jaket_panjang',
    nama: 'Jaket Panjang Tebal',
    jenisCuci: 'SA',
    varian: [
      { id: 'jp_dilipat', label: 'Dilipat', harga: 16000, satuan: 'PTG', level: 'BIASA', waktuJam: 72 },
      { id: 'jp_digantung', label: 'Digantung', harga: 21000, satuan: 'PTG', level: 'BIASA', waktuJam: 72 },
    ],
  },
  {
    id: 'jaket_pendek',
    nama: 'Jaket Pendek Tebal',
    jenisCuci: 'SA',
    varian: [
      { id: 'jd_dilipat', label: 'Dilipat', harga: 13000, satuan: 'PTG', level: 'BIASA', waktuJam: 72 },
      { id: 'jd_digantung', label: 'Digantung', harga: 16000, satuan: 'PTG', level: 'BIASA', waktuJam: 72 },
    ],
  },
  {
    id: 'tas',
    nama: 'Tas',
    jenisCuci: 'SA',
    varian: [
      { id: 'ts_superbesar', label: 'Super Besar', harga: 26000, satuan: 'PCS', level: 'BIASA', waktuJam: 72 },
      { id: 'ts_besar', label: 'Besar', harga: 21000, satuan: 'PCS', level: 'BIASA', waktuJam: 72 },
      { id: 'ts_sedang', label: 'Sedang', harga: 16000, satuan: 'PCS', level: 'BIASA', waktuJam: 72 },
      { id: 'ts_kecil', label: 'Kecil', harga: 11000, satuan: 'PCS', level: 'BIASA', waktuJam: 72 },
    ],
  },
  {
    id: 'bantal_guling',
    nama: 'Bantal & Guling',
    jenisCuci: 'SA',
    varian: [
      { id: 'bg_biasa', label: 'Biasa', harga: 11000, satuan: 'PCS', level: 'BIASA', waktuJam: 120 },
    ],
  },
  {
    id: 'bed_cover',
    nama: 'Bed Cover',
    jenisCuci: 'SA',
    varian: [
      { id: 'bc_superbesar', label: 'Super Besar', harga: 36000, satuan: 'PTG', level: 'BIASA', waktuJam: 72 },
      { id: 'bc_besar', label: 'Besar', harga: 26000, satuan: 'PTG', level: 'BIASA', waktuJam: 72 },
      { id: 'bc_sedang', label: 'Sedang', harga: 23000, satuan: 'PTG', level: 'BIASA', waktuJam: 72 },
      { id: 'bc_kecil', label: 'Kecil', harga: 21000, satuan: 'PTG', level: 'BIASA', waktuJam: 72 },
      { id: 'bc_bantalselimut', label: 'Bantal Selimut', harga: 21000, satuan: 'PTG', level: 'BIASA', waktuJam: 72 },
    ],
  },
  {
    id: 'sprei',
    nama: 'Sprei',
    jenisCuci: 'SA',
    varian: [
      { id: 'sp_besar_sbsg', label: 'Besar +SB +SG', harga: 16000, satuan: 'STEL', level: 'BIASA', waktuJam: 72 },
      { id: 'sp_besar_tanpa', label: 'Besar Tanpa SB SG', harga: 13000, satuan: 'STEL', level: 'BIASA', waktuJam: 72 },
      { id: 'sp_sedang_sbsg', label: 'Sedang +SB +SG', harga: 11000, satuan: 'STEL', level: 'BIASA', waktuJam: 72 },
      { id: 'sp_sedang_tanpa', label: 'Sedang Tanpa SB SG', harga: 9000, satuan: 'STEL', level: 'BIASA', waktuJam: 72 },
      { id: 'sp_kecil_sbsg', label: 'Kecil +SB +SG', harga: 9000, satuan: 'STEL', level: 'BIASA', waktuJam: 72 },
      { id: 'sp_kecil_tanpa', label: 'Kecil Tanpa SB SG', harga: 8000, satuan: 'STEL', level: 'BIASA', waktuJam: 72 },
    ],
  },
  {
    id: 'selimut',
    nama: 'Selimut',
    jenisCuci: 'SA',
    varian: [
      { id: 'sl_superbesar_tebal', label: 'Super Besar Tebal', harga: 36000, satuan: 'PCS', level: 'BIASA', waktuJam: 72 },
      { id: 'sl_besar_tebal', label: 'Besar Tebal', harga: 31000, satuan: 'PCS', level: 'BIASA', waktuJam: 72 },
      { id: 'sl_sedang_tebal', label: 'Sedang Tebal', harga: 21000, satuan: 'PCS', level: 'BIASA', waktuJam: 72 },
      { id: 'sl_kecil_tebal', label: 'Kecil Tebal', harga: 13000, satuan: 'PCS', level: 'BIASA', waktuJam: 72 },
      { id: 'sl_sedang_tipis', label: 'Sedang Tipis', harga: 16000, satuan: 'PCS', level: 'BIASA', waktuJam: 72 },
      { id: 'sl_mini_tebal', label: 'Mini Tebal', harga: 13000, satuan: 'PCS', level: 'BIASA', waktuJam: 72 },
    ],
  },
  {
    id: 'karpet',
    nama: 'Karpet',
    jenisCuci: 'SA',
    varian: [
      { id: 'kp_superbesar_tebal', label: 'Super Besar Tebal', harga: 710000, satuan: 'BH', level: 'BIASA', waktuJam: 168 },
      { id: 'kp_superbesar_tipis', label: 'Super Besar Tipis', harga: 66000, satuan: 'BH', level: 'BIASA', waktuJam: 168 },
      { id: 'kp_besar_tebal', label: 'Besar Tebal', harga: 61000, satuan: 'BH', level: 'BIASA', waktuJam: 168 },
      { id: 'kp_besar_tipis', label: 'Besar Tipis', harga: 51000, satuan: 'BH', level: 'BIASA', waktuJam: 168 },
      { id: 'kp_sedang_tebal', label: 'Sedang Tebal', harga: 41000, satuan: 'BH', level: 'BIASA', waktuJam: 168 },
      { id: 'kp_sedang_tipis', label: 'Sedang Tipis', harga: 36000, satuan: 'BH', level: 'BIASA', waktuJam: 168 },
      { id: 'kp_kecil_tebal', label: 'Kecil Tebal', harga: 31000, satuan: 'BH', level: 'BIASA', waktuJam: 168 },
      { id: 'kp_kecil_tipis', label: 'Kecil Tipis', harga: 26000, satuan: 'BH', level: 'BIASA', waktuJam: 168 },
    ],
  },
  {
    id: 'kasur_karpet',
    nama: 'Kasur Karpet',
    jenisCuci: 'SA',
    varian: [
      { id: 'kk_besar_tebal', label: 'Besar Tebal', harga: 41000, satuan: 'BH', level: 'BIASA', waktuJam: 168 },
      { id: 'kk_besar_tipis', label: 'Besar Tipis', harga: 31000, satuan: 'BH', level: 'BIASA', waktuJam: 168 },
    ],
  },
  {
    id: 'boneka',
    nama: 'Boneka',
    jenisCuci: 'SA',
    varian: [
      { id: 'bn_superbesar', label: 'Super Besar', harga: 36000, satuan: 'BH', level: 'BIASA', waktuJam: 120 },
      { id: 'bn_besar', label: 'Besar', harga: 31000, satuan: 'BH', level: 'BIASA', waktuJam: 120 },
      { id: 'bn_sedang', label: 'Sedang', harga: 21000, satuan: 'BH', level: 'BIASA', waktuJam: 120 },
      { id: 'bn_kecil', label: 'Kecil', harga: 16000, satuan: 'BH', level: 'BIASA', waktuJam: 120 },
      { id: 'bn_kecilsekali', label: 'Kecil Sekali', harga: 11000, satuan: 'BH', level: 'BIASA', waktuJam: 120 },
    ],
  },
  {
    id: 'sepatu',
    nama: 'Sepatu',
    jenisCuci: 'SA',
    varian: [
      { id: 'sp2_paspasang', label: 'Per Pasang', harga: 16000, satuan: 'BH', level: 'BIASA', waktuJam: 72 },
    ],
  },
  {
    id: 'jas',
    nama: 'Jas, Jas Lab, Almamater',
    jenisCuci: 'SA',
    varian: [
      { id: 'js_biasa_dilipat', label: 'Biasa (Dilipat)', harga: 11000, satuan: 'PTG', level: 'BIASA', waktuJam: 72 },
      { id: 'js_biasa_digantung', label: 'Biasa (Digantung)', harga: 13000, satuan: 'PTG', level: 'BIASA', waktuJam: 72 },
      { id: 'js_express_dilipat', label: 'Express (Dilipat)', harga: 14000, satuan: 'PTG', level: 'EXPRESS', waktuJam: 24 },
      { id: 'js_express_digantung24', label: 'Express (Digantung) 24 Jam', harga: 16000, satuan: 'PTG', level: 'EXPRESS', waktuJam: 24 },
      { id: 'js_express_digantung6', label: 'Express (Digantung) 6 Jam', harga: 21000, satuan: 'PTG', level: 'SUPER_EXPRESS', waktuJam: 6 },
    ],
  },
];

const PARFUM_OPTIONS = ['C Berry', 'Royal'];

const METODE_BAYAR = ['Tunai', 'QRIS', 'Transfer'];

const LEVEL_LABEL = {
  BIASA: 'Biasa',
  NORMAL: 'Normal',
  EXPRESS: 'Express',
  SUPER_EXPRESS: 'Super Express',
};

const JENIS_CUCI_LABEL = {
  CS: 'Cuci Setrika',
  CK: 'Cuci Kering',
  SA: 'Satuan',
};

if (typeof module !== 'undefined') {
  module.exports = { KATEGORI_LAYANAN, PARFUM_OPTIONS, METODE_BAYAR, LEVEL_LABEL, JENIS_CUCI_LABEL };
}

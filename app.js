// ============================================
// NAUFAL LAUNDRY - APP LOGIC
// ============================================

const STORAGE_KEYS = {
  TRANSAKSI: 'nl_transaksi',
  PELANGGAN: 'nl_pelanggan',
  PENGELUARAN: 'nl_pengeluaran',
  KASIR_LIST: 'nl_kasir_list',
  NOTA_COUNTER: 'nl_nota_counter',
  TIME_OFFSET: 'nl_time_offset', // ms, buat testing override waktu
};

// ---------- UTIL ----------
function nowTs() {
  const offset = parseInt(localStorage.getItem(STORAGE_KEYS.TIME_OFFSET) || '0', 10);
  return Date.now() + offset;
}
function fmtRupiah(n) {
  return 'Rp' + Math.round(n).toLocaleString('id-ID');
}
function fmtTgl(ts) {
  const d = new Date(ts);
  const pad = (x) => String(x).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} - ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtTglSingkat(ts) {
  const d = new Date(ts);
  const pad = (x) => String(x).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
}
function fmtHari(ts) {
  const hari = ['Minggu','Senin','Selasa','Rabu','Kamis',"Jum'at",'Sabtu'];
  const d = new Date(ts);
  return hari[d.getDay()];
}
function uid(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}
function saveJSON(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}
function toast(msg) {
  const root = document.getElementById('toastRoot');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function nextNotaNumber() {
  let counter = parseInt(localStorage.getItem(STORAGE_KEYS.NOTA_COUNTER) || '2652', 10);
  counter += 1;
  localStorage.setItem(STORAGE_KEYS.NOTA_COUNTER, String(counter));
  return counter;
}

// ---------- STATE ----------
const state = {
  activeTab: 'kasir',
  currentKasir: loadJSON('nl_current_kasir', null),
  kasirList: loadJSON(STORAGE_KEYS.KASIR_LIST, ['Hera', 'Ilyas', 'Naufal']),
  cart: [], // {catId, catNama, jenisCuci, varianId, varianLabel, satuan, level, waktuJam, harga, qty, promoActive, promoNote}
  pelangganNama: '',
  pelangganAlamat: '',
  pelangganTelp: '',
  parfum: 'Royal',
  metodeBayar: null,
  statusBayar: 'Belum Bayar',
  catatanRincian: '',
  diskonNominal: 0,
  diskonPersen: 0,
  editingTransaksiId: null, // kalau sedang edit transaksi lama
};

const TABS = [
  { id: 'kasir', label: 'Kasir', ic: '🧺' },
  { id: 'status', label: 'Status', ic: '📦' },
  { id: 'pelanggan', label: 'Pelanggan', ic: '👥' },
  { id: 'pengeluaran', label: 'Pengeluaran', ic: '💸' },
  { id: 'laporan', label: 'Laporan', ic: '📊' },
];

// ============================================
// APP OBJECT
// ============================================
const app = {

  init() {
    this.renderTabs();
    this.updateKasirBadge();
    this.renderTab();
  },

  renderTabs() {
    const nav = document.getElementById('tabNav');
    nav.innerHTML = TABS.map(t => `
      <button class="${state.activeTab === t.id ? 'active' : ''}" onclick="app.switchTab('${t.id}')">
        <span class="ic">${t.ic}</span><span>${t.label}</span>
      </button>
    `).join('');
  },

  switchTab(tabId) {
    state.activeTab = tabId;
    this.renderTabs();
    this.renderTab();
  },

  renderTab() {
    const main = document.getElementById('mainContent');
    main.innerHTML = '';
    if (state.activeTab === 'kasir') this.renderKasirTab(main);
    else if (state.activeTab === 'status') this.renderStatusTab(main);
    else if (state.activeTab === 'pelanggan') this.renderPelangganTab(main);
    else if (state.activeTab === 'pengeluaran') this.renderPengeluaranTab(main);
    else if (state.activeTab === 'laporan') this.renderLaporanTab(main);
  },

  updateKasirBadge() {
    document.getElementById('kasirBadgeName').textContent = state.currentKasir || 'Pilih Kasir';
  },

  openKasirPicker() {
    const html = `
      <div class="modal-header"><h3>Pilih Kasir</h3><span class="modal-close" onclick="app.closeModal()">&times;</span></div>
      <div class="chip-group">
        ${state.kasirList.map(k => `<div class="chip ${state.currentKasir===k?'selected':''}" onclick="app.setKasir('${esc(k)}')">${esc(k)}</div>`).join('')}
      </div>
      <label>Tambah nama kasir baru</label>
      <div class="row">
        <input type="text" id="newKasirInput" placeholder="Nama kasir">
        <button class="btn btn-outline" style="flex:0 0 auto;" onclick="app.addKasir()">+ Tambah</button>
      </div>
    `;
    this.openModal(html);
  },

  addKasir() {
    const val = document.getElementById('newKasirInput').value.trim();
    if (!val) return;
    if (!state.kasirList.includes(val)) {
      state.kasirList.push(val);
      saveJSON(STORAGE_KEYS.KASIR_LIST, state.kasirList);
    }
    this.setKasir(val);
  },

  setKasir(name) {
    state.currentKasir = name;
    localStorage.setItem('nl_current_kasir', JSON.stringify(name));
    this.updateKasirBadge();
    this.closeModal();
  },

  openModal(innerHtml) {
    const root = document.getElementById('modalRoot');
    root.innerHTML = `<div class="modal-overlay" onclick="if(event.target===this) app.closeModal()"><div class="modal-sheet">${innerHtml}</div></div>`;
  },
  closeModal() {
    document.getElementById('modalRoot').innerHTML = '';
  },

  // ============================================
  // TAB: KASIR
  // ============================================
  renderKasirTab(main) {
    const cartTotal = this.calcCartTotal();
    main.innerHTML = `
      <div class="card">
        <h2>Pilih Layanan</h2>
        <div class="kategori-grid">
          ${KATEGORI_LAYANAN.map(k => `
            <div class="kategori-tile tag-${k.jenisCuci}" onclick="app.openVarianPicker('${k.id}')">
              <span class="tag">${k.jenisCuci}</span>
              <span>${esc(k.nama)}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="card">
        <h2>Keranjang ${state.cart.length ? `<span class="badge-count">${state.cart.length}</span>` : ''}</h2>
        <div id="cartList">
          ${state.cart.length === 0
            ? `<div class="empty-state"><span class="ic">🛒</span>Belum ada item.<br>Pilih layanan di atas.</div>`
            : state.cart.map((item, idx) => this.renderCartItem(item, idx)).join('')
          }
        </div>
      </div>

      ${state.cart.length > 0 ? `
      <div class="card">
        <h2>Data Pelanggan</h2>
        <label>Nama Pelanggan</label>
        <div class="search-box">
          <input type="text" id="inpPelangganNama" placeholder="Ketik nama..." value="${esc(state.pelangganNama)}"
            oninput="app.onPelangganNamaInput(this.value)" autocomplete="off">
          <div id="pelangganAutocomplete"></div>
        </div>
        <label>Alamat <span style="font-weight:400;color:#999;">(opsional, isi kalau delivery)</span></label>
        <input type="text" id="inpPelangganAlamat" placeholder="Alamat pengantaran" value="${esc(state.pelangganAlamat)}"
          oninput="state.pelangganAlamat=this.value">
        <label>No. Telp <span style="font-weight:400;color:#999;">(opsional)</span></label>
        <input type="tel" id="inpPelangganTelp" placeholder="08xxxxxxxxxx" value="${esc(state.pelangganTelp)}"
          oninput="state.pelangganTelp=this.value">
      </div>

      <div class="card">
        <h2>Preferensi & Catatan</h2>
        <label>Parfum</label>
        <div class="chip-group">
          ${PARFUM_OPTIONS.map(p => `<div class="chip ${state.parfum===p?'selected':''}" onclick="app.setParfum('${esc(p)}')">${esc(p)}</div>`).join('')}
        </div>
        <label>Catatan Rincian (jenis & jumlah pakaian, dll)</label>
        <textarea id="inpCatatan" placeholder="Contoh: baju 14 celana 7 sb 3 handuk 2 mukena 1 ps kdlm 4 cd 2" oninput="state.catatanRincian=this.value">${esc(state.catatanRincian)}</textarea>
      </div>

      <div class="card">
        <h2>Diskon (opsional)</h2>
        <div class="row">
          <div>
            <label>Diskon Rp</label>
            <input type="number" id="inpDiskonNominal" placeholder="0" value="${state.diskonNominal || ''}"
              oninput="state.diskonNominal=parseFloat(this.value)||0; app.renderTab()">
          </div>
          <div>
            <label>Diskon %</label>
            <input type="number" id="inpDiskonPersen" placeholder="0" value="${state.diskonPersen || ''}"
              oninput="state.diskonPersen=parseFloat(this.value)||0; app.renderTab()">
          </div>
        </div>
      </div>

      <div class="card">
        <h2>Pembayaran</h2>
        <label>Status</label>
        <div class="chip-group">
          <div class="chip ${state.statusBayar==='Lunas'?'selected':''}" onclick="app.setStatusBayar('Lunas')">Lunas</div>
          <div class="chip ${state.statusBayar==='Belum Bayar'?'selected':''}" onclick="app.setStatusBayar('Belum Bayar')">Belum Bayar (nanti saat ambil)</div>
        </div>
        ${state.statusBayar === 'Lunas' ? `
        <label>Metode Bayar</label>
        <div class="chip-group">
          ${METODE_BAYAR.map(m => `<div class="chip ${state.metodeBayar===m?'selected':''}" onclick="app.setMetodeBayar('${m}')">${m}</div>`).join('')}
        </div>` : ''}
      </div>
      ` : ''}

      ${state.cart.length > 0 ? `
      <div style="height:80px;"></div>
      <div class="total-bar">
        <div class="total-row">
          <span class="total-label">Total (${this.estimasiSelesaiText()})</span>
          <span class="total-amount">${fmtRupiah(cartTotal.grandTotal)}</span>
        </div>
        <button class="btn btn-gold btn-block" onclick="app.simpanTransaksi()">✓ Simpan Transaksi & Cetak Struk</button>
      </div>
      ` : ''}
    `;
  },

  renderCartItem(item, idx) {
    const subtotal = item.harga * item.qty * (item.promoActive ? item.promoFactor : 1);
    return `
      <div class="cart-item">
        <div class="cart-item-top">
          <div>
            <div class="cart-item-name">${esc(item.catNama)} - ${esc(item.varianLabel)}</div>
            <div class="cart-item-sub">
              <span class="pill pill-${item.level}">${LEVEL_LABEL[item.level]}</span>
              ${fmtRupiah(item.harga)}/${item.satuan}
            </div>
          </div>
          <span class="cart-item-x" onclick="app.removeCartItem(${idx})">&times;</span>
        </div>
        <div class="qty-control">
          <span class="qty-btn" onclick="app.adjustQty(${idx}, -1)">−</span>
          <input type="number" step="0.01" value="${item.qty}" onchange="app.setQty(${idx}, this.value)">
          <span class="qty-btn" onclick="app.adjustQty(${idx}, 1)">+</span>
          <span style="font-size:11px;color:#888;">${item.satuan}</span>
          <span class="cart-item-subtotal" style="margin-left:auto;">${fmtRupiah(subtotal)}</span>
        </div>
        ${item.satuan === 'KG' ? `
        <div class="promo-toggle" onclick="app.togglePromo(${idx})">
          <input type="checkbox" ${item.promoActive ? 'checked' : ''} style="pointer-events:none;">
          Promo kiloan (kelipatan gratis)
        </div>
        ${item.promoActive ? `
        <div class="row" style="margin-top:6px;">
          <div>
            <label style="font-size:10.5px;">Kelipatan (kg)</label>
            <input type="number" value="${item.promoKelipatan||10}" onchange="app.setPromoConfig(${idx},'promoKelipatan',this.value)">
          </div>
          <div>
            <label style="font-size:10.5px;">Gratis (kg)</label>
            <input type="number" value="${item.promoGratis||1}" onchange="app.setPromoConfig(${idx},'promoGratis',this.value)">
          </div>
        </div>` : ''}
        ` : ''}
      </div>
    `;
  },

  openVarianPicker(catId) {
    const kat = KATEGORI_LAYANAN.find(k => k.id === catId);
    const html = `
      <div class="modal-header">
        <h3>${esc(kat.nama)} ${kat.subtitle ? `<div style="font-size:10.5px;font-weight:400;color:#999;">${esc(kat.subtitle)}</div>` : ''}</h3>
        <span class="modal-close" onclick="app.closeModal()">&times;</span>
      </div>
      <div class="varian-list">
        ${kat.varian.map(v => `
          <div class="varian-tile" onclick="app.addToCart('${kat.id}', '${v.id}')">
            <div>
              <div class="vname">${esc(v.label)}</div>
              <div class="vmeta"><span class="pill pill-${v.level}">${LEVEL_LABEL[v.level]}</span> · ${v.waktuJam < 24 ? v.waktuJam + ' jam' : (v.waktuJam/24) + ' hari'}</div>
            </div>
            <div class="vharga">${fmtRupiah(v.harga)}<div style="font-size:10px;color:#999;font-weight:400;">/${v.satuan}</div></div>
          </div>
        `).join('')}
      </div>
    `;
    this.openModal(html);
  },

  addToCart(catId, varianId) {
    const kat = KATEGORI_LAYANAN.find(k => k.id === catId);
    const v = kat.varian.find(x => x.id === varianId);
    state.cart.push({
      catId: kat.id,
      catNama: kat.nama,
      jenisCuci: kat.jenisCuci,
      varianId: v.id,
      varianLabel: v.label,
      satuan: v.satuan,
      level: v.level,
      waktuJam: v.waktuJam,
      harga: v.harga,
      qty: v.satuan === 'KG' ? 1 : 1,
      promoActive: false,
      promoKelipatan: 10,
      promoGratis: 1,
      promoFactor: 1,
    });
    this.closeModal();
    this.renderTab();
    toast(`${v.label} ditambahkan`);
  },

  removeCartItem(idx) {
    state.cart.splice(idx, 1);
    this.renderTab();
  },

  adjustQty(idx, delta) {
    const item = state.cart[idx];
    const step = item.satuan === 'KG' ? 0.25 : 1;
    item.qty = Math.max(step, Math.round((item.qty + delta * step) * 100) / 100);
    this.renderTab();
  },

  setQty(idx, val) {
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) state.cart[idx].qty = num;
    this.renderTab();
  },

  togglePromo(idx) {
    const item = state.cart[idx];
    item.promoActive = !item.promoActive;
    this.recalcPromoFactor(idx);
    this.renderTab();
  },

  setPromoConfig(idx, field, val) {
    state.cart[idx][field] = parseFloat(val) || 1;
    this.recalcPromoFactor(idx);
    this.renderTab();
  },

  recalcPromoFactor(idx) {
    const item = state.cart[idx];
    if (!item.promoActive) { item.promoFactor = 1; return; }
    const kelipatan = item.promoKelipatan || 10;
    const gratis = item.promoGratis || 1;
    // hitung berapa banyak "gratis" berlaku berdasarkan qty
    const kaliPromo = Math.floor(item.qty / kelipatan);
    const totalGratisKg = kaliPromo * gratis;
    const efektifKg = Math.max(0, item.qty - totalGratisKg);
    item.promoFactor = item.qty > 0 ? efektifKg / item.qty : 1;
  },

  setParfum(p) { state.parfum = p; this.renderTab(); },
  setMetodeBayar(m) { state.metodeBayar = m; this.renderTab(); },
  setStatusBayar(s) {
    state.statusBayar = s;
    if (s === 'Belum Bayar') state.metodeBayar = null;
    this.renderTab();
  },

  onPelangganNamaInput(val) {
    state.pelangganNama = val;
    const box = document.getElementById('pelangganAutocomplete');
    if (!val) { box.innerHTML = ''; return; }
    const list = loadJSON(STORAGE_KEYS.PELANGGAN, []);
    const matches = list.filter(p => p.nama.toLowerCase().includes(val.toLowerCase())).slice(0, 5);
    if (matches.length === 0) { box.innerHTML = ''; return; }
    box.innerHTML = `<div class="autocomplete-list">${matches.map(p => `
      <div class="autocomplete-item" onclick="app.pickPelanggan('${esc(p.nama)}','${esc(p.alamat||'')}','${esc(p.telp||'')}')">
        <strong>${esc(p.nama)}</strong>${p.alamat ? ' — ' + esc(p.alamat) : ''}
      </div>`).join('')}</div>`;
  },

  pickPelanggan(nama, alamat, telp) {
    state.pelangganNama = nama;
    state.pelangganAlamat = alamat;
    state.pelangganTelp = telp;
    document.getElementById('pelangganAutocomplete').innerHTML = '';
    this.renderTab();
  },

  calcCartTotal() {
    let subtotal = 0;
    state.cart.forEach(item => {
      subtotal += item.harga * item.qty * (item.promoActive ? item.promoFactor : 1);
    });
    let afterDiskon = subtotal - (state.diskonNominal || 0);
    afterDiskon = afterDiskon - (afterDiskon * (state.diskonPersen || 0) / 100);
    afterDiskon = Math.max(0, afterDiskon);
    return { subtotal, grandTotal: afterDiskon };
  },

  maxWaktuJam() {
    if (state.cart.length === 0) return 0;
    return Math.max(...state.cart.map(i => i.waktuJam));
  },

  estimasiSelesaiText() {
    const jam = this.maxWaktuJam();
    if (jam < 24) return `Est. ${jam} jam`;
    return `Est. ${Math.round(jam/24)} hari`;
  },

  simpanTransaksi() {
    if (state.cart.length === 0) { toast('Keranjang masih kosong'); return; }
    if (!state.currentKasir) { toast('Pilih kasir dulu'); this.openKasirPicker(); return; }
    if (!state.pelangganNama.trim()) { toast('Isi nama pelanggan dulu'); return; }
    if (state.statusBayar === 'Lunas' && !state.metodeBayar) { toast('Pilih metode bayar'); return; }

    const ts = nowTs();
    const jamSelesai = this.maxWaktuJam();
    const estSelesaiTs = ts + jamSelesai * 3600 * 1000;
    const { subtotal, grandTotal } = this.calcCartTotal();
    const notaNum = nextNotaNumber();

    const trx = {
      id: uid('trx'),
      nota: `TRX/${notaNum}`,
      tglMasuk: ts,
      estSelesai: estSelesaiTs,
      kasir: state.currentKasir,
      pelanggan: { nama: state.pelangganNama.trim(), alamat: state.pelangganAlamat.trim(), telp: state.pelangganTelp.trim() },
      items: JSON.parse(JSON.stringify(state.cart)),
      parfum: state.parfum,
      catatan: state.catatanRincian,
      diskonNominal: state.diskonNominal || 0,
      diskonPersen: state.diskonPersen || 0,
      subtotal,
      total: grandTotal,
      statusBayar: state.statusBayar,
      metodeBayar: state.metodeBayar,
      statusPesanan: 'Diproses',
      tglDiambil: null,
    };

    const list = loadJSON(STORAGE_KEYS.TRANSAKSI, []);
    list.push(trx);
    saveJSON(STORAGE_KEYS.TRANSAKSI, list);

    // simpan pelanggan
    this.upsertPelanggan(trx.pelanggan);

    // tampilkan struk
    this.showStruk(trx);

    // reset form (kasir tetap kepilih)
    state.cart = [];
    state.pelangganNama = '';
    state.pelangganAlamat = '';
    state.pelangganTelp = '';
    state.parfum = 'Royal';
    state.metodeBayar = null;
    state.statusBayar = 'Belum Bayar';
    state.catatanRincian = '';
    state.diskonNominal = 0;
    state.diskonPersen = 0;
  },

  upsertPelanggan(p) {
    if (!p.nama) return;
    const list = loadJSON(STORAGE_KEYS.PELANGGAN, []);
    const existing = list.find(x => x.nama.toLowerCase() === p.nama.toLowerCase());
    if (existing) {
      if (p.alamat) existing.alamat = p.alamat;
      if (p.telp) existing.telp = p.telp;
    } else {
      list.push({ id: uid('pel'), nama: p.nama, alamat: p.alamat, telp: p.telp, createdAt: nowTs() });
    }
    saveJSON(STORAGE_KEYS.PELANGGAN, list);
  },

  // ============================================
  // STRUK
  // ============================================
  strukHtml(trx) {
    const itemsHtml = trx.items.map(item => {
      const sub = item.harga * item.qty * (item.promoActive ? item.promoFactor : 1);
      const qtyDisplay = item.satuan === 'KG' ? item.qty.toLocaleString('id-ID', {maximumFractionDigits:2}) : item.qty;
      return `<div style="margin-bottom:6px;">
        <div>${esc(item.varianLabel)} (${esc(item.catNama)})</div>
        <div style="display:flex;justify-content:space-between;">
          <span>${qtyDisplay} ${item.satuan} x ${fmtRupiah(item.harga)}${item.promoActive ? ' 🎁promo' : ''}</span>
          <span>${fmtRupiah(sub)}</span>
        </div>
      </div>`;
    }).join('');

    let diskonLine = '';
    if (trx.diskonNominal > 0 || trx.diskonPersen > 0) {
      diskonLine = `<div style="display:flex;justify-content:space-between;color:#b8562e;">
        <span>Diskon ${trx.diskonPersen>0?trx.diskonPersen+'%':''}${trx.diskonNominal>0?' -'+fmtRupiah(trx.diskonNominal):''}</span>
        <span>-${fmtRupiah(trx.subtotal - trx.total)}</span>
      </div>`;
    }

    return `
      <div id="strukArea" style="background:#fff;padding:20px;font-family:'Courier New',monospace;font-size:12.5px;color:#333;max-width:340px;margin:0 auto;">
        <div style="text-align:center;margin-bottom:10px;">
          <div style="width:52px;height:52px;border-radius:10px;background:linear-gradient(135deg,#d4af6a,#b8934a);color:#1a1a1a;
            display:flex;align-items:center;justify-content:center;font-weight:700;font-size:22px;margin:0 auto 6px;">N</div>
          <div style="font-size:16px;font-weight:700;">Naufal Laundry</div>
          <div style="font-size:10.5px;color:#666;">Jl. Ahmad No. 9, Pamoyanan, Cicendo, Bandung</div>
        </div>
        <div style="border-top:1px dashed #999;margin:8px 0;"></div>
        <div style="display:flex;justify-content:space-between;"><span>No Nota</span><strong>${esc(trx.nota)}</strong></div>
        <div style="display:flex;justify-content:space-between;"><span>Pelanggan</span><strong>${esc(trx.pelanggan.nama)}</strong></div>
        ${trx.pelanggan.alamat ? `<div style="display:flex;justify-content:space-between;"><span>Alamat</span><strong style="text-align:right;max-width:200px;">${esc(trx.pelanggan.alamat)}</strong></div>` : ''}
        <div style="display:flex;justify-content:space-between;"><span>Tgl Masuk</span><strong>${fmtTgl(trx.tglMasuk)}</strong></div>
        <div style="display:flex;justify-content:space-between;"><span>Est Selesai</span><strong>${fmtTgl(trx.estSelesai)}</strong></div>
        <div style="display:flex;justify-content:space-between;"><span>Kasir</span><strong>${esc(trx.kasir)}</strong></div>
        <div style="display:flex;justify-content:space-between;"><span>Parfum</span><strong>${esc(trx.parfum)}</strong></div>
        <div style="border-top:1px dashed #999;margin:8px 0;"></div>
        ${itemsHtml}
        <div style="border-top:1px dashed #999;margin:8px 0;"></div>
        ${diskonLine}
        <div style="display:flex;justify-content:space-between;"><span>Status</span><strong>${esc(trx.statusBayar)}</strong></div>
        <div style="display:flex;justify-content:space-between;"><span>Metode Bayar</span><strong>${esc(trx.metodeBayar || '-')}</strong></div>
        <div style="display:flex;justify-content:space-between;font-size:15px;margin-top:4px;"><span>Total</span><strong>${fmtRupiah(trx.total)}</strong></div>
        ${trx.catatan ? `<div style="border-top:1px dashed #999;margin:8px 0;"></div><div style="color:#555;">${esc(trx.catatan)}</div>` : ''}
        <div style="border-top:1px dashed #999;margin:8px 0;"></div>
        <div style="text-align:center;font-size:11px;color:#555;">
          Struk ini wajib dibawa saat pengambilan<br><br>
          Terima kasih telah menggunakan Naufal Laundry.<br>
          Info & pemesanan: 0821-1975-6778<br>
          Instagram: @naufallaundry.bdg
        </div>
      </div>
    `;
  },

  showStruk(trx) {
    const html = `
      <div class="modal-header"><h3>Struk Transaksi</h3><span class="modal-close" onclick="app.closeModal(); app.renderTab();">&times;</span></div>
      ${this.strukHtml(trx)}
      <div class="row" style="margin-top:14px;">
        <button class="btn btn-outline" onclick="app.downloadStruk('${trx.id}')">💾 Simpan Gambar</button>
        <button class="btn btn-gold" onclick="app.shareStrukWA('${trx.id}')">📱 Kirim WA</button>
      </div>
      <button class="btn btn-primary btn-block" style="margin-top:8px;" onclick="app.closeModal(); app.renderTab();">Selesai</button>
    `;
    this.openModal(html);
  },

  findTrx(id) {
    return loadJSON(STORAGE_KEYS.TRANSAKSI, []).find(t => t.id === id);
  },

  drawStrukCanvas(trx) {
    const width = 380;
    const lineHeight = 20;
    let lines = [];
    lines.push({ text: 'NAUFAL LAUNDRY', size: 18, bold: true, center: true });
    lines.push({ text: 'Jl. Ahmad No. 9, Pamoyanan, Cicendo, Bandung', size: 11, center: true, color: '#666' });
    lines.push({ text: '------------------------------------------', size: 11, center: true });
    lines.push({ text: `No Nota`, right: trx.nota, size: 12.5 });
    lines.push({ text: `Pelanggan`, right: trx.pelanggan.nama, size: 12.5 });
    if (trx.pelanggan.alamat) lines.push({ text: `Alamat`, right: trx.pelanggan.alamat, size: 11 });
    lines.push({ text: `Tgl Masuk`, right: fmtTgl(trx.tglMasuk), size: 12.5 });
    lines.push({ text: `Est Selesai`, right: fmtTgl(trx.estSelesai), size: 12.5 });
    lines.push({ text: `Kasir`, right: trx.kasir, size: 12.5 });
    lines.push({ text: `Parfum`, right: trx.parfum, size: 12.5 });
    lines.push({ text: '------------------------------------------', size: 11, center: true });
    trx.items.forEach(item => {
      const sub = item.harga * item.qty * (item.promoActive ? item.promoFactor : 1);
      const qtyDisplay = item.satuan === 'KG' ? item.qty.toLocaleString('id-ID', {maximumFractionDigits:2}) : item.qty;
      lines.push({ text: `${item.varianLabel} (${item.catNama})`, size: 12.5 });
      lines.push({ text: `${qtyDisplay} ${item.satuan} x ${fmtRupiah(item.harga)}`, right: fmtRupiah(sub), size: 12, color: '#444' });
    });
    lines.push({ text: '------------------------------------------', size: 11, center: true });
    if (trx.subtotal !== trx.total) {
      lines.push({ text: `Diskon`, right: '-' + fmtRupiah(trx.subtotal - trx.total), size: 12.5, color: '#b8562e' });
    }
    lines.push({ text: `Status`, right: trx.statusBayar, size: 12.5 });
    lines.push({ text: `Metode Bayar`, right: trx.metodeBayar || '-', size: 12.5 });
    lines.push({ text: `TOTAL`, right: fmtRupiah(trx.total), size: 15, bold: true });
    if (trx.catatan) {
      lines.push({ text: '------------------------------------------', size: 11, center: true });
      lines.push({ text: trx.catatan, size: 11, color: '#555', wrap: true });
    }
    lines.push({ text: '------------------------------------------', size: 11, center: true });
    lines.push({ text: 'Struk ini wajib dibawa saat pengambilan', size: 10.5, center: true, color: '#555' });
    lines.push({ text: 'Terima kasih telah menggunakan Naufal Laundry.', size: 10.5, center: true, color: '#555' });
    lines.push({ text: 'Info & pemesanan: 0821-1975-6778', size: 10.5, center: true, color: '#555' });
    lines.push({ text: 'Instagram: @naufallaundry.bdg', size: 10.5, center: true, color: '#555' });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let totalHeight = 90;
    const measuredLines = [];
    lines.forEach(l => {
      ctx.font = `${l.bold ? 'bold' : ''} ${l.size}px Courier New`;
      if (l.wrap) {
        const words = l.text.split(' ');
        let cur = '';
        const wrapped = [];
        words.forEach(w => {
          const test = cur ? cur + ' ' + w : w;
          if (ctx.measureText(test).width > width - 40) {
            wrapped.push(cur);
            cur = w;
          } else cur = test;
        });
        if (cur) wrapped.push(cur);
        wrapped.forEach(w => { measuredLines.push({ ...l, text: w }); totalHeight += lineHeight; });
      } else {
        measuredLines.push(l);
        totalHeight += lineHeight;
      }
    });
    totalHeight += 30;

    canvas.width = width * 2;
    canvas.height = totalHeight * 2;
    canvas.style.width = width + 'px';
    canvas.style.height = totalHeight + 'px';
    ctx.scale(2, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, totalHeight);

    let y = 20;
    ctx.fillStyle = '#b8934a';
    ctx.fillRect(width/2 - 26, y, 52, 52);
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('N', width/2, y + 36);
    y += 70;

    ctx.textAlign = 'left';
    measuredLines.forEach(l => {
      ctx.font = `${l.bold ? 'bold' : ''} ${l.size}px 'Courier New', monospace`;
      ctx.fillStyle = l.color || '#222';
      if (l.center) {
        ctx.textAlign = 'center';
        ctx.fillText(l.text, width/2, y);
        ctx.textAlign = 'left';
      } else if (l.right !== undefined) {
        ctx.fillText(l.text, 20, y);
        ctx.textAlign = 'right';
        ctx.fillText(l.right, width - 20, y);
        ctx.textAlign = 'left';
      } else {
        ctx.fillText(l.text, 20, y);
      }
      y += lineHeight;
    });

    return canvas;
  },

  downloadStruk(trxId) {
    const trx = this.findTrx(trxId);
    const canvas = this.drawStrukCanvas(trx);
    const link = document.createElement('a');
    link.download = `Struk_${trx.nota.replace('/','-')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast('Struk tersimpan');
  },

  shareStrukWA(trxId) {
    const trx = this.findTrx(trxId);
    const waTab = window.open('', '_blank');
    const canvas = this.drawStrukCanvas(trx);
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const telp = (trx.pelanggan.telp || '').replace(/\D/g, '');
      const waNumber = telp ? (telp.startsWith('0') ? '62' + telp.slice(1) : telp) : '';
      const waUrl = waNumber ? `https://wa.me/${waNumber}` : `https://wa.me/`;
      if (waTab) {
        waTab.document.write(`
          <html><head><title>Struk ${trx.nota}</title></head>
          <body style="margin:0;background:#111;display:flex;flex-direction:column;align-items:center;padding:20px;font-family:sans-serif;">
            <p style="color:#fff;">Simpan gambar ini, lalu kirim manual via WhatsApp.</p>
            <img src="${url}" style="max-width:100%;border-radius:8px;">
            <a href="${url}" download="Struk_${trx.nota.replace('/','-')}.png" style="margin-top:12px;padding:12px 20px;background:#25D366;color:#fff;text-decoration:none;border-radius:8px;">Download Gambar</a>
            <a href="${waUrl}" target="_blank" style="margin-top:8px;padding:12px 20px;background:#128C7E;color:#fff;text-decoration:none;border-radius:8px;">Buka WhatsApp</a>
          </body></html>
        `);
      }
    }, 'image/png');
  },

  // ============================================
  // TAB: STATUS PESANAN
  // ============================================
  renderStatusTab(main) {
    const list = loadJSON(STORAGE_KEYS.TRANSAKSI, []).slice().reverse();
    const filter = state._statusFilter || 'AKTIF';
    const filtered = list.filter(t => {
      if (filter === 'AKTIF') return t.statusPesanan !== 'Sudah Diambil';
      if (filter === 'SEMUA') return true;
      return t.statusPesanan === filter;
    });

    main.innerHTML = `
      <div class="card">
        <h2>Status Pesanan</h2>
        <div class="chip-group">
          <div class="chip ${filter==='AKTIF'?'selected':''}" onclick="app.setStatusFilter('AKTIF')">Aktif</div>
          <div class="chip ${filter==='Diproses'?'selected':''}" onclick="app.setStatusFilter('Diproses')">Diproses</div>
          <div class="chip ${filter==='Siap Diambil'?'selected':''}" onclick="app.setStatusFilter('Siap Diambil')">Siap Diambil</div>
          <div class="chip ${filter==='Sudah Diambil'?'selected':''}" onclick="app.setStatusFilter('Sudah Diambil')">Sudah Diambil</div>
          <div class="chip ${filter==='SEMUA'?'selected':''}" onclick="app.setStatusFilter('SEMUA')">Semua</div>
        </div>
      </div>
      <div class="card">
        ${filtered.length === 0
          ? `<div class="empty-state"><span class="ic">📦</span>Tidak ada transaksi.</div>`
          : filtered.map(t => this.renderStatusRow(t)).join('')
        }
      </div>
    `;
  },

  setStatusFilter(f) {
    state._statusFilter = f;
    this.renderTab();
  },

  renderStatusRow(t) {
    const statusClass = t.statusPesanan === 'Diproses' ? 'status-diproses' : t.statusPesanan === 'Siap Diambil' ? 'status-siap' : 'status-diambil';
    const bayarClass = t.statusBayar === 'Lunas' ? 'bayar-lunas' : 'bayar-belum';
    return `
      <div class="transaksi-row">
        <div class="transaksi-row-top">
          <div>
            <div class="transaksi-nota">${esc(t.nota)} · ${esc(t.pelanggan.nama)}</div>
            <div class="transaksi-meta">Masuk ${fmtTglSingkat(t.tglMasuk)} · Est ${fmtTglSingkat(t.estSelesai)}</div>
          </div>
          <div class="transaksi-total">${fmtRupiah(t.total)}</div>
        </div>
        <div style="display:flex;gap:6px;margin-top:8px;align-items:center;flex-wrap:wrap;">
          <span class="status-badge ${statusClass}">${esc(t.statusPesanan)}</span>
          <span class="status-badge ${bayarClass}">${esc(t.statusBayar)}</span>
          <div style="margin-left:auto;display:flex;gap:6px;">
            ${t.statusPesanan !== 'Siap Diambil' && t.statusPesanan !== 'Sudah Diambil' ? `<button class="btn btn-outline btn-sm" onclick="app.updateStatusPesanan('${t.id}','Siap Diambil')">Siap Diambil</button>` : ''}
            ${t.statusPesanan !== 'Sudah Diambil' ? `<button class="btn btn-ok btn-sm" onclick="app.updateStatusPesanan('${t.id}','Sudah Diambil')">Sudah Diambil</button>` : ''}
            ${t.statusBayar !== 'Lunas' ? `<button class="btn btn-gold btn-sm" onclick="app.lunaskanTransaksi('${t.id}')">Tandai Lunas</button>` : ''}
          </div>
        </div>
      </div>
    `;
  },

  updateStatusPesanan(id, status) {
    const list = loadJSON(STORAGE_KEYS.TRANSAKSI, []);
    const t = list.find(x => x.id === id);
    if (!t) return;
    t.statusPesanan = status;
    if (status === 'Sudah Diambil') t.tglDiambil = nowTs();
    saveJSON(STORAGE_KEYS.TRANSAKSI, list);
    this.renderTab();
    toast(`Status diubah: ${status}`);
  },

  lunaskanTransaksi(id) {
    const html = `
      <div class="modal-header"><h3>Metode Bayar</h3><span class="modal-close" onclick="app.closeModal()">&times;</span></div>
      <div class="chip-group">
        ${METODE_BAYAR.map(m => `<div class="chip" onclick="app.confirmLunas('${id}','${m}')">${m}</div>`).join('')}
      </div>
    `;
    this.openModal(html);
  },

  confirmLunas(id, metode) {
    const list = loadJSON(STORAGE_KEYS.TRANSAKSI, []);
    const t = list.find(x => x.id === id);
    if (!t) return;
    t.statusBayar = 'Lunas';
    t.metodeBayar = metode;
    saveJSON(STORAGE_KEYS.TRANSAKSI, list);
    this.closeModal();
    this.renderTab();
    toast('Ditandai Lunas');
  },

  // ============================================
  // TAB: PELANGGAN
  // ============================================
  renderPelangganTab(main) {
    const list = loadJSON(STORAGE_KEYS.PELANGGAN, []).slice().sort((a,b) => a.nama.localeCompare(b.nama));
    const q = (state._pelangganSearch || '').toLowerCase();
    const filtered = q ? list.filter(p => p.nama.toLowerCase().includes(q)) : list;

    main.innerHTML = `
      <div class="card">
        <h2>Data Pelanggan <span class="badge-count">${list.length}</span></h2>
        <input type="text" placeholder="Cari nama pelanggan..." value="${esc(state._pelangganSearch||'')}"
          oninput="state._pelangganSearch=this.value; app.renderTab()">
      </div>
      <div class="card">
        ${filtered.length === 0
          ? `<div class="empty-state"><span class="ic">👥</span>Belum ada data pelanggan.</div>`
          : filtered.map(p => `
            <div class="transaksi-row">
              <div class="transaksi-row-top">
                <div>
                  <div class="transaksi-nota">${esc(p.nama)}</div>
                  <div class="transaksi-meta">${esc(p.alamat || 'Alamat belum diisi')}${p.telp ? ' · ' + esc(p.telp) : ''}</div>
                </div>
                <div style="display:flex;gap:6px;">
                  <button class="btn btn-outline btn-sm" onclick="app.editPelanggan('${p.id}')">Edit</button>
                </div>
              </div>
            </div>
          `).join('')
        }
      </div>
    `;
  },

  editPelanggan(id) {
    const list = loadJSON(STORAGE_KEYS.PELANGGAN, []);
    const p = list.find(x => x.id === id);
    if (!p) return;
    const html = `
      <div class="modal-header"><h3>Edit Pelanggan</h3><span class="modal-close" onclick="app.closeModal()">&times;</span></div>
      <label>Nama</label>
      <input type="text" id="editNama" value="${esc(p.nama)}">
      <label>Alamat</label>
      <input type="text" id="editAlamat" value="${esc(p.alamat||'')}">
      <label>No. Telp</label>
      <input type="tel" id="editTelp" value="${esc(p.telp||'')}">
      <label>PIN untuk konfirmasi perubahan</label>
      <input type="text" id="editPin" placeholder="Masukkan PIN">
      <div class="row" style="margin-top:14px;">
        <button class="btn btn-danger" onclick="app.deletePelanggan('${p.id}')">Hapus</button>
        <button class="btn btn-gold" onclick="app.savePelanggan('${p.id}')">Simpan</button>
      </div>
    `;
    this.openModal(html);
  },

  checkPin() {
    const pin = document.getElementById('editPin').value;
    if (pin !== '123456') { toast('PIN salah'); return false; }
    return true;
  },

  savePelanggan(id) {
    if (!this.checkPin()) return;
    const list = loadJSON(STORAGE_KEYS.PELANGGAN, []);
    const p = list.find(x => x.id === id);
    if (!p) return;
    p.nama = document.getElementById('editNama').value.trim();
    p.alamat = document.getElementById('editAlamat').value.trim();
    p.telp = document.getElementById('editTelp').value.trim();
    saveJSON(STORAGE_KEYS.PELANGGAN, list);
    this.closeModal();
    this.renderTab();
    toast('Data pelanggan disimpan');
  },

  deletePelanggan(id) {
    if (!this.checkPin()) return;
    let list = loadJSON(STORAGE_KEYS.PELANGGAN, []);
    list = list.filter(x => x.id !== id);
    saveJSON(STORAGE_KEYS.PELANGGAN, list);
    this.closeModal();
    this.renderTab();
    toast('Pelanggan dihapus');
  },

  // ============================================
  // TAB: PENGELUARAN
  // ============================================
  JENIS_PENGELUARAN: ['Detergen', 'Kantong Kresek', 'Transportasi/Bensin', 'Service Alat/Lain-lain'],

  renderPengeluaranTab(main) {
    const list = loadJSON(STORAGE_KEYS.PENGELUARAN, []).slice().reverse();
    const todayStr = fmtTglSingkat(nowTs());
    const todayTotal = list.filter(p => fmtTglSingkat(p.tanggal) === todayStr).reduce((a,b) => a + b.jumlah, 0);

    main.innerHTML = `
      <div class="card">
        <h2>Catat Pengeluaran</h2>
        <label>Jenis Pengeluaran</label>
        <div class="chip-group">
          ${this.JENIS_PENGELUARAN.map(j => `<div class="chip ${state._pengeluaranJenis===j?'selected':''}" onclick="state._pengeluaranJenis='${j}'; app.renderTab()">${j}</div>`).join('')}
        </div>
        <label>Jumlah Biaya (Rp)</label>
        <input type="number" id="inpPengeluaranJumlah" placeholder="0">
        <label>Bukti</label>
        <div class="chip-group">
          ${['Bon','Kwitansi','Nota'].map(b => `<div class="chip ${state._pengeluaranBukti===b?'selected':''}" onclick="state._pengeluaranBukti='${b}'; app.renderTab()">${b}</div>`).join('')}
        </div>
        <label>Keterangan (opsional)</label>
        <input type="text" id="inpPengeluaranKet" placeholder="Catatan tambahan">
        <button class="btn btn-gold btn-block" style="margin-top:12px;" onclick="app.simpanPengeluaran()">+ Simpan Pengeluaran</button>
      </div>

      <div class="card">
        <h2>Pengeluaran Hari Ini</h2>
        <div style="font-size:20px;font-weight:800;color:var(--gold);margin-bottom:8px;">${fmtRupiah(todayTotal)}</div>
      </div>

      <div class="card">
        <h2>Riwayat Pengeluaran</h2>
        ${list.length === 0
          ? `<div class="empty-state"><span class="ic">💸</span>Belum ada pengeluaran tercatat.</div>`
          : list.slice(0, 30).map(p => `
            <div class="transaksi-row">
              <div class="transaksi-row-top">
                <div>
                  <div class="transaksi-nota">${esc(p.jenis)}</div>
                  <div class="transaksi-meta">${fmtTglSingkat(p.tanggal)} · ${esc(p.bukti)}${p.keterangan ? ' · ' + esc(p.keterangan) : ''}</div>
                </div>
                <div class="transaksi-total">${fmtRupiah(p.jumlah)}</div>
              </div>
            </div>
          `).join('')
        }
      </div>
    `;
  },

  simpanPengeluaran() {
    const jenis = state._pengeluaranJenis;
    const jumlah = parseFloat(document.getElementById('inpPengeluaranJumlah').value) || 0;
    const bukti = state._pengeluaranBukti;
    const keterangan = document.getElementById('inpPengeluaranKet').value.trim();
    if (!jenis) { toast('Pilih jenis pengeluaran'); return; }
    if (jumlah <= 0) { toast('Isi jumlah biaya'); return; }
    if (!bukti) { toast('Pilih jenis bukti'); return; }

    const list = loadJSON(STORAGE_KEYS.PENGELUARAN, []);
    list.push({ id: uid('peng'), tanggal: nowTs(), jenis, jumlah, bukti, keterangan, kasir: state.currentKasir || '-' });
    saveJSON(STORAGE_KEYS.PENGELUARAN, list);
    state._pengeluaranJenis = null;
    state._pengeluaranBukti = null;
    this.renderTab();
    toast('Pengeluaran dicatat');
  },

  // ============================================
  // TAB: LAPORAN
  // ============================================
  renderLaporanTab(main) {
    const mode = state._laporanMode || 'harian';
    main.innerHTML = `
      <div class="card">
        <h2>Laporan</h2>
        <div class="chip-group">
          <div class="chip ${mode==='harian'?'selected':''}" onclick="app.setLaporanMode('harian')">Harian</div>
          <div class="chip ${mode==='bulanan'?'selected':''}" onclick="app.setLaporanMode('bulanan')">Bulanan</div>
          <div class="chip ${mode==='kinerja'?'selected':''}" onclick="app.setLaporanMode('kinerja')">Kinerja Kasir</div>
        </div>
      </div>
      <div id="laporanBody"></div>
    `;
    const body = document.getElementById('laporanBody');
    if (mode === 'harian') this.renderLaporanHarian(body);
    else if (mode === 'bulanan') this.renderLaporanBulanan(body);
    else this.renderLaporanKinerja(body);
  },

  setLaporanMode(m) { state._laporanMode = m; this.renderTab(); },

  getTanggalLaporan() {
    if (!state._laporanTgl) state._laporanTgl = fmtTglSingkat(nowTs());
    return state._laporanTgl;
  },

  renderLaporanHarian(body) {
    const tglStr = this.getTanggalLaporan();
    const trxAll = loadJSON(STORAGE_KEYS.TRANSAKSI, []);
    const pengAll = loadJSON(STORAGE_KEYS.PENGELUARAN, []);

    const masuk = trxAll.filter(t => fmtTglSingkat(t.tglMasuk) === tglStr);
    const keluar = trxAll.filter(t => t.tglDiambil && fmtTglSingkat(t.tglDiambil) === tglStr);
    const pengeluaran = pengAll.filter(p => fmtTglSingkat(p.tanggal) === tglStr);

    const totalMasuk = masuk.reduce((a,b) => a + b.total, 0);
    const totalKeluar = keluar.reduce((a,b) => a + b.total, 0);
    const totalPengeluaran = pengeluaran.reduce((a,b) => a + b.jumlah, 0);

    body.innerHTML = `
      <div class="card">
        <label>Pilih Tanggal</label>
        <input type="date" id="laporanTglInput" value="${this.toInputDate(tglStr)}" onchange="app.setLaporanTgl(this.value)">
      </div>

      <div class="card">
        <h2>📥 Laporan Masuk Laundry — ${esc(fmtHari(this.parseInputDate(tglStr)))}, ${tglStr}</h2>
        ${this.renderLaporanTable(masuk, 'masuk')}
        <div style="text-align:right;font-weight:800;margin-top:10px;font-size:15px;">Jumlah Pemasukan: ${fmtRupiah(totalMasuk)}</div>
        <button class="btn btn-outline btn-block" style="margin-top:10px;" onclick="app.downloadLaporanHarianImage('masuk','${tglStr}')">💾 Export Gambar</button>
      </div>

      <div class="card">
        <h2>📤 Laporan Keluar Laundry — ${esc(fmtHari(this.parseInputDate(tglStr)))}, ${tglStr}</h2>
        ${this.renderLaporanTable(keluar, 'keluar')}
        <div style="text-align:right;font-weight:800;margin-top:10px;font-size:15px;">Jumlah Diambil: ${fmtRupiah(totalKeluar)}</div>
        <button class="btn btn-outline btn-block" style="margin-top:10px;" onclick="app.downloadLaporanHarianImage('keluar','${tglStr}')">💾 Export Gambar</button>
      </div>

      <div class="card">
        <h2>💸 Pengeluaran — ${tglStr}</h2>
        ${pengeluaran.length === 0 ? `<div class="empty-state">Tidak ada pengeluaran.</div>` : `
        <table style="width:100%;font-size:11.5px;border-collapse:collapse;">
          <tr style="background:var(--paper-dim);"><th style="padding:5px;text-align:left;">Jenis</th><th style="padding:5px;text-align:right;">Biaya</th><th style="padding:5px;text-align:left;">Bukti</th></tr>
          ${pengeluaran.map(p => `<tr><td style="padding:5px;border-top:1px solid var(--line);">${esc(p.jenis)}</td><td style="padding:5px;border-top:1px solid var(--line);text-align:right;">${fmtRupiah(p.jumlah)}</td><td style="padding:5px;border-top:1px solid var(--line);">${esc(p.bukti)}</td></tr>`).join('')}
        </table>`}
        <div style="text-align:right;font-weight:800;margin-top:10px;font-size:15px;">Jumlah Pengeluaran: ${fmtRupiah(totalPengeluaran)}</div>
      </div>

      <div class="card">
        <h2>Ringkasan Hari Ini</h2>
        <div class="grid3">
          <div style="text-align:center;"><div style="font-size:10px;color:#888;">MASUK</div><div style="font-weight:800;">${fmtRupiah(totalMasuk)}</div></div>
          <div style="text-align:center;"><div style="font-size:10px;color:#888;">KELUAR</div><div style="font-weight:800;">${fmtRupiah(totalKeluar)}</div></div>
          <div style="text-align:center;"><div style="font-size:10px;color:#888;">NET</div><div style="font-weight:800;color:${(totalMasuk-totalPengeluaran)>=0?'var(--ok)':'var(--danger)'};">${fmtRupiah(totalMasuk-totalPengeluaran)}</div></div>
        </div>
      </div>
    `;
  },

  toInputDate(ddmmyyyy) {
    const [d,m,y] = ddmmyyyy.split('/');
    return `${y}-${m}-${d}`;
  },
  parseInputDate(ddmmyyyy) {
    const [d,m,y] = ddmmyyyy.split('/');
    return new Date(`${y}-${m}-${d}T00:00:00`).getTime();
  },
  setLaporanTgl(inputVal) {
    const [y,m,d] = inputVal.split('-');
    state._laporanTgl = `${d}/${m}/${y}`;
    this.renderTab();
  },

  renderLaporanTable(rows, kind) {
    if (rows.length === 0) return `<div class="empty-state">Tidak ada transaksi.</div>`;
    return `
      <div style="overflow-x:auto;">
      <table style="width:100%;font-size:10.5px;border-collapse:collapse;white-space:nowrap;">
        <tr style="background:var(--paper-dim);">
          <th style="padding:5px;">No</th><th style="padding:5px;">Nota</th><th style="padding:5px;text-align:left;">Pelanggan</th>
          <th style="padding:5px;">Jenis</th><th style="padding:5px;">Level</th><th style="padding:5px;text-align:right;">Biaya</th><th style="padding:5px;">Bayar</th>
        </tr>
        ${rows.map((t, i) => {
          const jenisSet = [...new Set(t.items.map(it => it.jenisCuci))].join('/');
          const levelSet = [...new Set(t.items.map(it => LEVEL_LABEL[it.level]))].join('/');
          return `<tr>
            <td style="padding:5px;border-top:1px solid var(--line);text-align:center;">${i+1}</td>
            <td style="padding:5px;border-top:1px solid var(--line);">${esc(t.nota)}</td>
            <td style="padding:5px;border-top:1px solid var(--line);">${esc(t.pelanggan.nama)}</td>
            <td style="padding:5px;border-top:1px solid var(--line);text-align:center;">${jenisSet}</td>
            <td style="padding:5px;border-top:1px solid var(--line);text-align:center;">${levelSet}</td>
            <td style="padding:5px;border-top:1px solid var(--line);text-align:right;">${fmtRupiah(t.total)}</td>
            <td style="padding:5px;border-top:1px solid var(--line);text-align:center;">${t.statusBayar==='Lunas' ? '✓ '+esc(t.metodeBayar||'') : '✗'}</td>
          </tr>`;
        }).join('')}
      </table>
      </div>
    `;
  },

  downloadLaporanHarianImage(kind, tglStr) {
    const trxAll = loadJSON(STORAGE_KEYS.TRANSAKSI, []);
    const rows = kind === 'masuk'
      ? trxAll.filter(t => fmtTglSingkat(t.tglMasuk) === tglStr)
      : trxAll.filter(t => t.tglDiambil && fmtTglSingkat(t.tglDiambil) === tglStr);
    const total = rows.reduce((a,b) => a + b.total, 0);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const width = 700;
    const rowH = 26;
    const headerH = 90;
    const height = headerH + (rows.length + 3) * rowH;
    canvas.width = width * 2; canvas.height = height * 2;
    canvas.style.width = width+'px'; canvas.style.height = height+'px';
    ctx.scale(2,2);
    ctx.fillStyle = '#fff'; ctx.fillRect(0,0,width,height);

    ctx.fillStyle = '#1a1a1a'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`LAPORAN ${kind.toUpperCase()} LAUNDRY`, width/2, 26);
    ctx.font = '12px sans-serif';
    ctx.fillText(`${fmtHari(this.parseInputDate(tglStr))}, ${tglStr} — Naufal Laundry`, width/2, 46);

    let y = headerH;
    const cols = [
      {label:'No', w:30, align:'center'},
      {label:'Nota', w:80, align:'left'},
      {label:'Pelanggan', w:150, align:'left'},
      {label:'Jenis', w:70, align:'center'},
      {label:'Level', w:100, align:'center'},
      {label:'Biaya', w:110, align:'right'},
      {label:'Bayar', w:100, align:'center'},
    ];
    let x = 15;
    ctx.fillStyle = '#f0ede6'; ctx.fillRect(15, y-18, width-30, 24);
    ctx.fillStyle = '#333'; ctx.font = 'bold 11px sans-serif';
    cols.forEach(c => { ctx.textAlign = c.align; ctx.fillText(c.label, c.align==='right' ? x+c.w-4 : c.align==='center' ? x+c.w/2 : x+4, y); x += c.w; });
    y += rowH;

    ctx.font = '11px sans-serif';
    rows.forEach((t, i) => {
      x = 15;
      const jenisSet = [...new Set(t.items.map(it => it.jenisCuci))].join('/');
      const levelSet = [...new Set(t.items.map(it => LEVEL_LABEL[it.level]))].join('/');
      const vals = [String(i+1), t.nota, t.pelanggan.nama, jenisSet, levelSet, fmtRupiah(t.total), t.statusBayar==='Lunas'?'Lunas':'Belum'];
      ctx.fillStyle = '#222';
      cols.forEach((c, ci) => {
        ctx.textAlign = c.align;
        let txt = vals[ci];
        if (ctx.measureText(txt).width > c.w - 6) {
          while (ctx.measureText(txt+'…').width > c.w - 6 && txt.length > 1) txt = txt.slice(0,-1);
          txt += '…';
        }
        ctx.fillText(txt, c.align==='right' ? x+c.w-4 : c.align==='center' ? x+c.w/2 : x+4, y);
        x += c.w;
      });
      y += rowH;
      ctx.strokeStyle = '#eee'; ctx.beginPath(); ctx.moveTo(15,y-rowH+8); ctx.lineTo(width-15,y-rowH+8); ctx.stroke();
    });

    y += 10;
    ctx.textAlign = 'right'; ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = '#b8934a';
    ctx.fillText(`Jumlah: ${fmtRupiah(total)}`, width-15, y);

    const link = document.createElement('a');
    link.download = `Laporan_${kind}_${tglStr.replace(/\//g,'-')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast('Laporan tersimpan');
  },

  renderLaporanBulanan(body) {
    if (!state._laporanBulan) {
      const d = new Date(nowTs());
      state._laporanBulan = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    }
    const [y, m] = state._laporanBulan.split('-').map(Number);
    const trxAll = loadJSON(STORAGE_KEYS.TRANSAKSI, []);
    const pengAll = loadJSON(STORAGE_KEYS.PENGELUARAN, []);

    const inMonth = (ts) => { const d = new Date(ts); return d.getFullYear()===y && (d.getMonth()+1)===m; };
    const trxBulan = trxAll.filter(t => inMonth(t.tglMasuk));
    const pengBulan = pengAll.filter(p => inMonth(p.tanggal));

    const totalOmzet = trxBulan.reduce((a,b) => a + b.total, 0);
    const totalPengeluaran = pengBulan.reduce((a,b) => a + b.jumlah, 0);
    const totalTransaksi = trxBulan.length;
    const totalLunas = trxBulan.filter(t => t.statusBayar === 'Lunas').reduce((a,b)=>a+b.total,0);
    const totalBelumBayar = totalOmzet - totalLunas;

    // breakdown per jenis cuci
    const perJenis = {};
    trxBulan.forEach(t => t.items.forEach(it => {
      perJenis[it.jenisCuci] = (perJenis[it.jenisCuci]||0) + it.harga * it.qty * (it.promoActive?it.promoFactor:1);
    }));

    body.innerHTML = `
      <div class="card">
        <label>Pilih Bulan</label>
        <input type="month" value="${state._laporanBulan}" onchange="state._laporanBulan=this.value; app.renderTab()">
      </div>
      <div class="card">
        <h2>Ringkasan Bulanan</h2>
        <div class="grid2">
          <div style="text-align:center;padding:10px;background:var(--paper-dim);border-radius:8px;">
            <div style="font-size:10px;color:#888;">TOTAL OMZET</div><div style="font-weight:800;font-size:16px;">${fmtRupiah(totalOmzet)}</div>
          </div>
          <div style="text-align:center;padding:10px;background:var(--paper-dim);border-radius:8px;">
            <div style="font-size:10px;color:#888;">TOTAL PENGELUARAN</div><div style="font-weight:800;font-size:16px;">${fmtRupiah(totalPengeluaran)}</div>
          </div>
          <div style="text-align:center;padding:10px;background:var(--paper-dim);border-radius:8px;">
            <div style="font-size:10px;color:#888;">JML TRANSAKSI</div><div style="font-weight:800;font-size:16px;">${totalTransaksi}</div>
          </div>
          <div style="text-align:center;padding:10px;background:var(--paper-dim);border-radius:8px;">
            <div style="font-size:10px;color:#888;">BELUM DIBAYAR</div><div style="font-weight:800;font-size:16px;color:var(--danger);">${fmtRupiah(totalBelumBayar)}</div>
          </div>
        </div>
      </div>
      <div class="card">
        <h2>Breakdown per Jenis Cuci</h2>
        ${Object.entries(perJenis).map(([k,v]) => `
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--paper-dim);">
            <span>${JENIS_CUCI_LABEL[k]||k}</span><strong>${fmtRupiah(v)}</strong>
          </div>
        `).join('') || '<div class="empty-state">Belum ada data.</div>'}
      </div>
      <div class="card">
        <h2>Export Laporan Bulanan</h2>
        <p style="font-size:11.5px;color:#888;margin-top:0;">File Excel 3 sheet: Rekap Bulanan, Kinerja Kasir, Data Transaksi Mentah.</p>
        <button class="btn btn-gold btn-block" onclick="app.exportExcelBulanan()">📊 Export ke Excel</button>
      </div>
    `;
  },

  renderLaporanKinerja(body) {
    if (!state._laporanBulan) {
      const d = new Date(nowTs());
      state._laporanBulan = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    }
    const [y, m] = state._laporanBulan.split('-').map(Number);
    const trxAll = loadJSON(STORAGE_KEYS.TRANSAKSI, []);
    const inMonth = (ts) => { const d = new Date(ts); return d.getFullYear()===y && (d.getMonth()+1)===m; };
    const trxBulan = trxAll.filter(t => inMonth(t.tglMasuk));

    const perKasir = {};
    trxBulan.forEach(t => {
      if (!perKasir[t.kasir]) perKasir[t.kasir] = { jumlahTransaksi: 0, totalOmzet: 0 };
      perKasir[t.kasir].jumlahTransaksi += 1;
      perKasir[t.kasir].totalOmzet += t.total;
    });

    body.innerHTML = `
      <div class="card">
        <label>Pilih Bulan</label>
        <input type="month" value="${state._laporanBulan}" onchange="state._laporanBulan=this.value; app.renderTab()">
      </div>
      <div class="card">
        <h2>Kinerja per Kasir</h2>
        ${Object.keys(perKasir).length === 0 ? '<div class="empty-state">Belum ada data.</div>' :
          Object.entries(perKasir).sort((a,b) => b[1].totalOmzet - a[1].totalOmzet).map(([kasir, data]) => `
            <div class="transaksi-row">
              <div class="transaksi-row-top">
                <div>
                  <div class="transaksi-nota">${esc(kasir)}</div>
                  <div class="transaksi-meta">${data.jumlahTransaksi} transaksi</div>
                </div>
                <div class="transaksi-total">${fmtRupiah(data.totalOmzet)}</div>
              </div>
            </div>
          `).join('')
        }
      </div>
    `;
  },

  exportExcelBulanan() {
    toast('Sedang menyiapkan file Excel...');
    // Export sederhana berbasis CSV multi-file di-zip manual tidak tersedia offline tanpa library;
    // gunakan pendekatan: generate 1 file Excel (SpreadsheetML XML) yang bisa dibuka Excel/Sheets.
    const [y, m] = (state._laporanBulan || '').split('-').map(Number);
    const trxAll = loadJSON(STORAGE_KEYS.TRANSAKSI, []);
    const inMonth = (ts) => { const d = new Date(ts); return d.getFullYear()===y && (d.getMonth()+1)===m; };
    const trxBulan = trxAll.filter(t => inMonth(t.tglMasuk));

    const perKasir = {};
    trxBulan.forEach(t => {
      if (!perKasir[t.kasir]) perKasir[t.kasir] = { jumlahTransaksi: 0, totalOmzet: 0 };
      perKasir[t.kasir].jumlahTransaksi += 1;
      perKasir[t.kasir].totalOmzet += t.total;
    });

    const escXml = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const cell = (v, type) => {
      if (type === 'num') return `<Cell><Data ss:Type="Number">${v}</Data></Cell>`;
      return `<Cell><Data ss:Type="String">${escXml(v)}</Data></Cell>`;
    };

    let rekapRows = `<Row>${cell('Bulan')}${cell(state._laporanBulan)}</Row>`;
    rekapRows += `<Row>${cell('Total Omzet')}${cell(trxBulan.reduce((a,b)=>a+b.total,0),'num')}</Row>`;
    rekapRows += `<Row>${cell('Jumlah Transaksi')}${cell(trxBulan.length,'num')}</Row>`;

    let kinerjaRows = `<Row>${cell('Kasir')}${cell('Jumlah Transaksi')}${cell('Total Omzet')}</Row>`;
    Object.entries(perKasir).forEach(([k,d]) => {
      kinerjaRows += `<Row>${cell(k)}${cell(d.jumlahTransaksi,'num')}${cell(d.totalOmzet,'num')}</Row>`;
    });

    let dataRows = `<Row>${cell('Nota')}${cell('Tanggal Masuk')}${cell('Pelanggan')}${cell('Kasir')}${cell('Total')}${cell('Status Bayar')}${cell('Status Pesanan')}</Row>`;
    trxBulan.forEach(t => {
      dataRows += `<Row>${cell(t.nota)}${cell(fmtTgl(t.tglMasuk))}${cell(t.pelanggan.nama)}${cell(t.kasir)}${cell(t.total,'num')}${cell(t.statusBayar)}${cell(t.statusPesanan)}</Row>`;
    });

    const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Rekap Bulanan"><Table>${rekapRows}</Table></Worksheet>
<Worksheet ss:Name="Kinerja Kasir"><Table>${kinerjaRows}</Table></Worksheet>
<Worksheet ss:Name="Data Transaksi"><Table>${dataRows}</Table></Worksheet>
</Workbook>`;

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Laporan_NaufalLaundry_${state._laporanBulan}.xls`;
    link.click();
    toast('Excel berhasil di-export');
  },

};

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', () => app.init());

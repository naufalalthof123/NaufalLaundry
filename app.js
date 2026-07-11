// ============================================
// NAUFAL LAUNDRY - APP LOGIC
// ============================================

const STORAGE_KEYS = {
  TRANSAKSI: 'nl_transaksi',
  PELANGGAN: 'nl_pelanggan',
  PENGELUARAN: 'nl_pengeluaran',
  KASIR_LIST: 'nl_kasir_list',
  NOTA_COUNTER: 'nl_nota_counter',
  NOTA_PERIOD: 'nl_nota_period',
  TIME_MODE: 'nl_time_mode', // 'otomatis' atau 'manual'
  TIME_MANUAL_TS: 'nl_time_manual_ts', // timestamp manual (ms) kalau mode manual
  TIME_MANUAL_SET_AT: 'nl_time_manual_set_at', // kapan manual ts itu di-set (buat hitung offset berjalan)
};

// ---------- UTIL ----------
function nowTs() {
  const mode = localStorage.getItem(STORAGE_KEYS.TIME_MODE) || 'otomatis';
  if (mode === 'manual') {
    const manualTs = parseInt(localStorage.getItem(STORAGE_KEYS.TIME_MANUAL_TS) || '0', 10);
    const setAt = parseInt(localStorage.getItem(STORAGE_KEYS.TIME_MANUAL_SET_AT) || '0', 10);
    if (manualTs > 0 && setAt > 0) {
      return manualTs + (Date.now() - setAt);
    }
  }
  return Date.now();
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
  const now = new Date();
  const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const savedPeriod = localStorage.getItem(STORAGE_KEYS.NOTA_PERIOD);
  let counter;
  if (savedPeriod !== periodKey) {
    // Bulan baru (atau pertama kali) -> reset counter dari 0
    counter = 0;
    localStorage.setItem(STORAGE_KEYS.NOTA_PERIOD, periodKey);
  } else {
    counter = parseInt(localStorage.getItem(STORAGE_KEYS.NOTA_COUNTER) || '0', 10);
  }
  counter += 1;
  localStorage.setItem(STORAGE_KEYS.NOTA_COUNTER, String(counter));
  return counter;
}
function formatNota(counter) {
  return `NL${String(counter).padStart(4, '0')}`;
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
  ongkirJauh: false,
  editingTransaksiId: null, // kalau sedang edit transaksi lama
};

const TABS = [
  { id: 'kasir', label: 'Kasir', ic: '🧺' },
  { id: 'status', label: 'Status', ic: '📦' },
  { id: 'riwayat', label: 'Riwayat', ic: '📜' },
  { id: 'pelanggan', label: 'Pelanggan', ic: '👥' },
  { id: 'pengeluaran', label: 'Pengeluaran', ic: '💸' },
  { id: 'laporan', label: 'Laporan', ic: '📊' },
];

// ============================================
// APP OBJECT
// ============================================
const app = {

  init() {
    const headerLogo = document.getElementById('headerLogo');
    if (headerLogo && typeof LOGO_SMALL_B64 !== 'undefined') headerLogo.src = LOGO_SMALL_B64;
    this.renderTabs();
    this.updateKasirBadge();
    this.updateWaktuBadge();
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
    else if (state.activeTab === 'riwayat') this.renderRiwayatTab(main);
    else if (state.activeTab === 'pelanggan') this.renderPelangganTab(main);
    else if (state.activeTab === 'pengeluaran') this.renderPengeluaranTab(main);
    else if (state.activeTab === 'laporan') this.renderLaporanTab(main);
  },

  updateKasirBadge() {
    document.getElementById('kasirBadgeName').textContent = state.currentKasir || 'Pilih Kasir';
  },

  updateWaktuBadge() {
    const mode = localStorage.getItem(STORAGE_KEYS.TIME_MODE) || 'otomatis';
    const el = document.getElementById('waktuBadgeText');
    const badge = document.getElementById('waktuBadge');
    if (!el) return;
    if (mode === 'manual') {
      el.textContent = fmtTgl(nowTs());
      badge.style.borderColor = 'var(--warn)';
      badge.style.color = '#f0a868';
    } else {
      el.textContent = 'Otomatis';
      badge.style.borderColor = 'var(--gold)';
      badge.style.color = 'var(--gold-light)';
    }
  },

  openWaktuPicker() {
    const mode = localStorage.getItem(STORAGE_KEYS.TIME_MODE) || 'otomatis';
    const current = new Date(nowTs());
    const pad = (x) => String(x).padStart(2, '0');
    const dateVal = `${current.getFullYear()}-${pad(current.getMonth()+1)}-${pad(current.getDate())}`;
    const timeVal = `${pad(current.getHours())}:${pad(current.getMinutes())}`;

    const html = `
      <div class="modal-header"><h3>Pengaturan Waktu</h3><span class="modal-close" onclick="app.closeModal()">&times;</span></div>
      <p style="font-size:12px;color:#777;margin-top:0;">Gunakan mode Manual kalau perlu input transaksi untuk tanggal lain (misal transaksi yang lupa dicatat kemarin).</p>
      <div class="chip-group">
        <div class="chip ${mode==='otomatis'?'selected':''}" onclick="app.setWaktuMode('otomatis')">🕐 Otomatis (waktu HP)</div>
        <div class="chip ${mode==='manual'?'selected':''}" onclick="app.setWaktuMode('manual')">✏️ Manual</div>
      </div>
      ${mode === 'manual' ? `
      <label>Tanggal</label>
      <input type="date" id="waktuManualDate" value="${dateVal}">
      <label>Jam</label>
      <input type="time" id="waktuManualTime" value="${timeVal}">
      <button class="btn btn-gold btn-block" style="margin-top:14px;" onclick="app.applyWaktuManual()">Terapkan</button>
      ` : ''}
    `;
    this.openModal(html);
  },

  setWaktuMode(mode) {
    localStorage.setItem(STORAGE_KEYS.TIME_MODE, mode);
    if (mode === 'otomatis') {
      this.updateWaktuBadge();
      this.closeModal();
      this.renderTab();
      toast('Waktu kembali otomatis');
    } else {
      this.openWaktuPicker(); // re-render modal biar muncul input tanggal/jam
    }
  },

  applyWaktuManual() {
    const dateVal = document.getElementById('waktuManualDate').value;
    const timeVal = document.getElementById('waktuManualTime').value;
    if (!dateVal || !timeVal) { toast('Isi tanggal dan jam dulu'); return; }
    const ts = new Date(`${dateVal}T${timeVal}:00`).getTime();
    if (isNaN(ts)) { toast('Tanggal/jam tidak valid'); return; }
    localStorage.setItem(STORAGE_KEYS.TIME_MODE, 'manual');
    localStorage.setItem(STORAGE_KEYS.TIME_MANUAL_TS, String(ts));
    localStorage.setItem(STORAGE_KEYS.TIME_MANUAL_SET_AT, String(Date.now()));
    this.updateWaktuBadge();
    this.closeModal();
    this.renderTab();
    toast('Waktu manual diterapkan: ' + fmtTgl(ts));
  },

  openKasirPicker() {
    const html = `
      <div class="modal-header"><h3>Pilih Kasir</h3><span class="modal-close" onclick="app.closeModal()">&times;</span></div>
      <div class="chip-group">
        ${state.kasirList.map(k => `
          <div class="chip ${state.currentKasir===k?'selected':''}" style="display:flex;align-items:center;gap:6px;padding-right:8px;">
            <span onclick="app.setKasir('${esc(k)}')">${esc(k)}</span>
            <span onclick="app.confirmHapusKasir('${esc(k)}')" style="opacity:0.6;font-weight:700;padding:0 2px;">&times;</span>
          </div>
        `).join('')}
      </div>
      <label>Tambah nama kasir baru</label>
      <div class="row">
        <input type="text" id="newKasirInput" placeholder="Nama kasir">
        <button class="btn btn-outline" style="flex:0 0 auto;" onclick="app.addKasir()">+ Tambah</button>
      </div>
    `;
    this.openModal(html);
  },

  confirmHapusKasir(name) {
    const html = `
      <div class="modal-header"><h3>Hapus Kasir?</h3><span class="modal-close" onclick="app.openKasirPicker()">&times;</span></div>
      <p style="font-size:13px;color:#555;">Nama kasir <strong>${esc(name)}</strong> akan dihapus dari daftar. Transaksi lama yang sudah tercatat atas nama ini tidak akan berubah.</p>
      <div class="row" style="margin-top:14px;">
        <button class="btn btn-outline" onclick="app.openKasirPicker()">Batal</button>
        <button class="btn btn-danger" onclick="app.hapusKasir('${esc(name)}')">Ya, Hapus</button>
      </div>
    `;
    this.openModal(html);
  },

  hapusKasir(name) {
    state.kasirList = state.kasirList.filter(k => k !== name);
    saveJSON(STORAGE_KEYS.KASIR_LIST, state.kasirList);
    if (state.currentKasir === name) {
      state.currentKasir = null;
      localStorage.removeItem('nl_current_kasir');
      this.updateKasirBadge();
    }
    toast(`Kasir ${name} dihapus`);
    this.openKasirPicker();
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
      ${state.editingTransaksiId ? `
      <div class="card" style="background:#fdf2e9;border-color:var(--warn);display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:12.5px;color:var(--warn);font-weight:700;">✏️ Mode Edit Transaksi</div>
        <button class="btn btn-outline btn-sm" onclick="app.batalEditTransaksi()">Batal Edit</button>
      </div>` : ''}
      <div class="card">
        <h2>Pilih Layanan</h2>
        <div class="kategori-grid">
          ${KATEGORI_LAYANAN.map(k => `
            <div class="kategori-tile tag-${k.jenisCuci}" onclick="app.openVarianPicker('${k.id}')">
              <span class="tag">${k.jenisCuci}</span>
              <span>${esc(k.nama)}</span>
            </div>
          `).join('')}
          <div class="custom-item-tile" onclick="app.openCustomItemForm()">
            <span>+ Item Lainnya</span>
          </div>
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
        <div class="ongkir-toggle" onclick="app.toggleOngkir()">
          <input type="checkbox" ${state.ongkirJauh ? 'checked' : ''} style="pointer-events:none;">
          Delivery Jauh (+${fmtRupiah(ONGKIR_JAUH)})
        </div>
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
          <span class="total-label">
            Total (${this.estimasiSelesaiText()})
            ${cartTotal.ongkir > 0 ? `<br><span style="font-size:10px;">termasuk ongkir ${fmtRupiah(cartTotal.ongkir)}</span>` : ''}
          </span>
          <span class="total-amount">${fmtRupiah(cartTotal.grandTotal)}</span>
        </div>
        <button class="btn btn-gold btn-block" onclick="app.simpanTransaksi()">${state.editingTransaksiId ? '✓ Update Transaksi' : '✓ Simpan Transaksi & Cetak Struk'}</button>
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
            <div class="cart-item-name">${item.isCustom ? '✏️ ' : ''}${esc(item.catNama)}${item.isCustom ? '' : ' - ' + esc(item.varianLabel)}</div>
            <div class="cart-item-sub">
              ${item.isCustom ? '<span class="pill" style="background:#f5eee0;color:var(--gold);">Custom</span>' : `<span class="pill pill-${item.level}">${LEVEL_LABEL[item.level]}</span>`}
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

  openCustomItemForm() {
    const html = `
      <div class="modal-header"><h3>Item Lainnya (Custom)</h3><span class="modal-close" onclick="app.closeModal()">&times;</span></div>
      <label>Nama Item</label>
      <input type="text" id="customItemNama" placeholder="Contoh: Cuci Helm">
      <label>Harga Satuan (Rp)</label>
      <input type="number" id="customItemHarga" placeholder="0">
      <label>Jumlah/Qty</label>
      <input type="number" id="customItemQty" value="1" step="0.01">
      <button class="btn btn-gold btn-block" style="margin-top:14px;" onclick="app.addCustomItemToCart()">+ Tambah ke Keranjang</button>
    `;
    this.openModal(html);
  },

  addCustomItemToCart() {
    const nama = document.getElementById('customItemNama').value.trim();
    const harga = parseFloat(document.getElementById('customItemHarga').value) || 0;
    const qty = parseFloat(document.getElementById('customItemQty').value) || 1;
    if (!nama) { toast('Isi nama item dulu'); return; }
    if (harga <= 0) { toast('Isi harga dulu'); return; }

    state.cart.push({
      catId: 'custom',
      catNama: nama,
      jenisCuci: 'SA',
      varianId: 'custom',
      varianLabel: 'Custom',
      satuan: 'PCS',
      level: 'BIASA',
      waktuJam: 72,
      harga: harga,
      qty: qty,
      isCustom: true,
      promoActive: false,
      promoKelipatan: 10,
      promoGratis: 1,
      promoFactor: 1,
    });
    this.closeModal();
    this.renderTab();
    toast(`${nama} ditambahkan`);
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

  toggleOngkir() { state.ongkirJauh = !state.ongkirJauh; this.renderTab(); },

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
    this._autocompleteMatches = matches;
    box.innerHTML = `<div class="autocomplete-list">${matches.map((p, i) => `
      <div class="autocomplete-item" onclick="app.pickPelanggan(${i})">
        <div style="font-weight:700;">${esc(p.nama)}</div>
        <div style="font-size:11px;color:#888;margin-top:1px;">${p.alamat ? '📍 ' + esc(p.alamat) : 'Alamat belum ada'}${p.telp ? ' · 📞 ' + esc(p.telp) : ''}</div>
      </div>`).join('')}</div>`;
  },

  pickPelanggan(idx) {
    const p = this._autocompleteMatches[idx];
    if (!p) return;
    state.pelangganNama = p.nama;
    state.pelangganAlamat = p.alamat || '';
    state.pelangganTelp = p.telp || '';
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
    const ongkir = state.ongkirJauh ? ONGKIR_JAUH : 0;
    return { subtotal, ongkir, grandTotal: afterDiskon + ongkir };
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

    const { subtotal, ongkir, grandTotal } = this.calcCartTotal();
    const isEdit = !!state.editingTransaksiId;

    let trx;
    const list = loadJSON(STORAGE_KEYS.TRANSAKSI, []);

    if (isEdit) {
      trx = list.find(x => x.id === state.editingTransaksiId);
      if (!trx) { toast('Transaksi tidak ditemukan'); state.editingTransaksiId = null; return; }
      const jamSelesai = this.maxWaktuJam();
      trx.estSelesai = trx.tglMasuk + jamSelesai * 3600 * 1000;
      trx.pelanggan = { nama: state.pelangganNama.trim(), alamat: state.pelangganAlamat.trim(), telp: state.pelangganTelp.trim() };
      trx.items = JSON.parse(JSON.stringify(state.cart));
      trx.parfum = state.parfum;
      trx.catatan = state.catatanRincian;
      trx.diskonNominal = state.diskonNominal || 0;
      trx.diskonPersen = state.diskonPersen || 0;
      trx.ongkir = ongkir;
      trx.subtotal = subtotal;
      trx.total = grandTotal;
      trx.statusBayar = state.statusBayar;
      trx.metodeBayar = state.metodeBayar;
      if (state.statusBayar === 'Lunas' && !trx.tglLunas) trx.tglLunas = nowTs();
      if (state.statusBayar === 'Belum Bayar') trx.tglLunas = null;
      trx.kasir = state.currentKasir;
      saveJSON(STORAGE_KEYS.TRANSAKSI, list);
      this.upsertPelanggan(trx.pelanggan);
      toast(`Transaksi ${trx.nota} diperbarui`);
      this.showStruk(trx);
    } else {
      const ts = nowTs();
      const jamSelesai = this.maxWaktuJam();
      const estSelesaiTs = ts + jamSelesai * 3600 * 1000;
      const notaNum = nextNotaNumber();

      trx = {
        id: uid('trx'),
        nota: formatNota(notaNum),
        tglMasuk: ts,
        estSelesai: estSelesaiTs,
        kasir: state.currentKasir,
        pelanggan: { nama: state.pelangganNama.trim(), alamat: state.pelangganAlamat.trim(), telp: state.pelangganTelp.trim() },
        items: JSON.parse(JSON.stringify(state.cart)),
        parfum: state.parfum,
        catatan: state.catatanRincian,
        diskonNominal: state.diskonNominal || 0,
        diskonPersen: state.diskonPersen || 0,
        ongkir,
        subtotal,
        total: grandTotal,
        statusBayar: state.statusBayar,
        metodeBayar: state.metodeBayar,
        tglLunas: state.statusBayar === 'Lunas' ? ts : null,
        statusPesanan: 'Diproses',
        tglDiambil: null,
      };
      list.push(trx);
      saveJSON(STORAGE_KEYS.TRANSAKSI, list);
      this.upsertPelanggan(trx.pelanggan);
      this.showStruk(trx);
    }

    // reset form
    state.editingTransaksiId = null;
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
    state.ongkirJauh = false;
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
    const totalDiskon = (trx.subtotal + (trx.ongkir||0)) - trx.total;
    if (trx.diskonNominal > 0 || trx.diskonPersen > 0) {
      diskonLine = `<div style="display:flex;justify-content:space-between;color:#b8562e;">
        <span>Diskon ${trx.diskonPersen>0?trx.diskonPersen+'%':''}${trx.diskonNominal>0?' -'+fmtRupiah(trx.diskonNominal):''}</span>
        <span>-${fmtRupiah(totalDiskon)}</span>
      </div>`;
    }
    let ongkirLine = '';
    if (trx.ongkir > 0) {
      ongkirLine = `<div style="display:flex;justify-content:space-between;">
        <span>Ongkir (Delivery Jauh)</span><span>${fmtRupiah(trx.ongkir)}</span>
      </div>`;
    }

    return `
      <div id="strukArea" style="background:#fff;padding:20px;font-family:'Courier New',monospace;font-size:12.5px;color:#333;max-width:340px;margin:0 auto;">
        <div style="text-align:center;margin-bottom:10px;">
          <img src="${typeof LOGO_FULL_B64 !== 'undefined' ? LOGO_FULL_B64 : ''}" style="max-width:160px;margin:0 auto 4px;display:block;">
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
        ${ongkirLine}
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
      <button class="btn btn-gold btn-block" style="margin-top:8px;" onclick="app.cetakStrukPrinter('${trx.id}', false)">🖨️ Cetak ke Printer Thermal</button>
      <div class="row" style="margin-top:8px;">
        <button class="btn btn-outline" onclick="app.downloadStrukInternal('${trx.id}')">🧵 Struk Internal</button>
        <button class="btn btn-outline" onclick="app.cetakStrukPrinter('${trx.id}', true)">🖨️ Print Internal</button>
      </div>
      <button class="btn btn-primary btn-block" style="margin-top:8px;" onclick="app.closeModal(); app.renderTab();">Selesai</button>
    `;
    this.openModal(html);
  },

  findTrx(id) {
    return loadJSON(STORAGE_KEYS.TRANSAKSI, []).find(t => t.id === id);
  },

  _logoImgCache: null,
  getLogoImg() {
    if (this._logoImgCache) return Promise.resolve(this._logoImgCache);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { this._logoImgCache = img; resolve(img); };
      img.onerror = () => resolve(null);
      img.src = (typeof LOGO_FULL_B64 !== 'undefined') ? LOGO_FULL_B64 : '';
    });
  },

  // Helper: buat pasangan label-value. Kalau kepanjangan buat 1 baris (di lebar 384px),
  // otomatis "ditumpuk" jadi 2 baris (label lalu value di bawahnya) supaya font besar tetap muat.
  _makeField(ctx, width, label, value, size, opts = {}) {
    const bold = opts.bold !== false;
    ctx.font = `${bold ? 'bold ' : ''}${size}px 'Courier New', monospace`;
    const valStr = value == null ? '' : String(value);
    const labelW = ctx.measureText(label).width;
    const valueW = ctx.measureText(valStr).width;
    const available = width - 20;
    if (labelW + valueW + 16 <= available) {
      return [{ text: label, right: valStr, size, bold }];
    }
    return [
      { text: label, size, bold },
      { text: valStr, size, bold, indent: 14, wrap: true },
    ];
  },

  async drawStrukCanvas(trx) {
    const width = 384; // resolusi native printer thermal 58mm (203 DPI, ~384 dot)
    const lineHeight = 34;
    const RULE_H = 20;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    let lines = [];
    const F = (label, value, size, opts) => this._makeField(ctx, width, label, value, size, opts);

    lines.push(...F('No Nota', trx.nota, 26));
    lines.push(...F('Pelanggan', trx.pelanggan.nama, 26));
    if (trx.pelanggan.alamat) lines.push(...F('Alamat', trx.pelanggan.alamat, 22));
    lines.push(...F('Tgl Masuk', fmtTgl(trx.tglMasuk), 22));
    lines.push(...F('Est Selesai', fmtTgl(trx.estSelesai), 22));
    lines.push(...F('Kasir', trx.kasir, 26));
    lines.push(...F('Parfum', trx.parfum, 26));
    lines.push({ rule: true });
    trx.items.forEach(item => {
      const sub = item.harga * item.qty * (item.promoActive ? item.promoFactor : 1);
      const qtyDisplay = item.satuan === 'KG' ? item.qty.toLocaleString('id-ID', {maximumFractionDigits:2}) : item.qty;
      const namaItem = item.isCustom ? item.catNama : `${item.varianLabel} (${item.catNama})`;
      lines.push({ text: namaItem, size: 26, bold: true, wrap: true });
      lines.push(...F(`${qtyDisplay} ${item.satuan} x ${fmtRupiah(item.harga)}`, fmtRupiah(sub), 22));
    });
    lines.push({ rule: true });
    if (trx.ongkir > 0) {
      lines.push(...F('Ongkir (Delivery Jauh)', fmtRupiah(trx.ongkir), 22));
    }
    const totalDiskon = (trx.subtotal + (trx.ongkir||0)) - trx.total;
    if (totalDiskon > 0) {
      lines.push(...F('Diskon', '-' + fmtRupiah(totalDiskon), 22));
    }
    lines.push(...F('Status', trx.statusBayar, 26));
    lines.push(...F('Metode Bayar', trx.metodeBayar || '-', 26));
    lines.push({ rule: true });
    lines.push({ text: `TOTAL`, right: fmtRupiah(trx.total), size: 34, bold: true });
    if (trx.catatan) {
      lines.push({ rule: true });
      lines.push({ text: trx.catatan, size: 22, bold: true, wrap: true });
    }
    lines.push({ rule: true });
    lines.push({ text: 'Struk ini wajib dibawa saat pengambilan', size: 20, bold: true, center: true, wrap: true });
    lines.push({ text: 'Terima kasih telah menggunakan Naufal Laundry.', size: 20, bold: true, center: true, wrap: true });
    lines.push({ text: 'Info & pemesanan: 0821-1975-6778', size: 20, bold: true, center: true, wrap: true });
    lines.push({ text: 'Instagram: @naufallaundry.bdg', size: 20, bold: true, center: true, wrap: true });

    const logoImg = await this.getLogoImg();
    const logoW = 200;
    const logoH = logoImg ? Math.round(logoW * logoImg.height / logoImg.width) : 0;

    let totalHeight = logoH + 50;
    const measuredLines = [];
    lines.forEach(l => {
      if (l.rule) { measuredLines.push(l); totalHeight += RULE_H; return; }
      ctx.font = `${l.bold ? 'bold' : ''} ${l.size}px Courier New`;
      if (l.wrap) {
        const maxW = width - 20 - (l.indent || 0);
        const words = l.text.split(' ');
        let cur = '';
        const wrapped = [];
        words.forEach(w => {
          const test = cur ? cur + ' ' + w : w;
          if (ctx.measureText(test).width > maxW) {
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
    totalHeight += 20;

    // Render native (tanpa scale 2x) supaya lebar canvas persis 384px sesuai resolusi printer 58mm
    canvas.width = width;
    canvas.height = totalHeight;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, totalHeight);

    let y = 16;
    if (logoImg) {
      ctx.drawImage(logoImg, width/2 - logoW/2, y, logoW, logoH);
      y += logoH + 12;
    } else {
      y += 10;
    }
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.fillText('Jl. Ahmad No. 9, Pamoyanan, Cicendo, Bandung', width/2, y);
    y += 28;

    ctx.textAlign = 'left';
    measuredLines.forEach(l => {
      if (l.rule) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(10, y - RULE_H/2 + 4);
        ctx.lineTo(width - 10, y - RULE_H/2 + 4);
        ctx.stroke();
        y += RULE_H;
        return;
      }
      ctx.font = `${l.bold ? 'bold' : ''} ${l.size}px 'Courier New', monospace`;
      ctx.fillStyle = '#000000';
      const xBase = 10 + (l.indent || 0);
      if (l.center) {
        ctx.textAlign = 'center';
        ctx.fillText(l.text, width/2, y);
        ctx.textAlign = 'left';
      } else if (l.right !== undefined) {
        ctx.fillText(l.text, xBase, y);
        ctx.textAlign = 'right';
        ctx.fillText(l.right, width - 10, y);
        ctx.textAlign = 'left';
      } else {
        ctx.fillText(l.text, xBase, y);
      }
      y += lineHeight;
    });

    return canvas;
  },

  async downloadStruk(trxId) {
    const trx = this.findTrx(trxId);
    const canvas = await this.drawStrukCanvas(trx);
    const link = document.createElement('a');
    link.download = `Struk_${trx.nota.replace(/[^a-zA-Z0-9]/g, '')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast('Struk tersimpan');
  },

  // Cetak ke printer thermal via Web Share API — membuka picker share Android,
  // di situ kasir pilih app printer thermal (RPP02/Bluetooth Print/dll) yang sudah terpasang.
  async cetakStrukPrinter(trxId, internal) {
    const trx = this.findTrx(trxId);
    if (!trx) return;
    const canvas = internal ? await this.drawStrukInternalCanvas(trx) : await this.drawStrukCanvas(trx);

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const fileName = `Struk_${trx.nota.replace(/[^a-zA-Z0-9]/g, '')}.png`;
    const file = new File([blob], fileName, { type: 'image/png' });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `Struk ${trx.nota}` });
        return;
      } catch (e) {
        // kalau user cancel share, jangan tampilkan error, cukup diam
        if (e.name === 'AbortError') return;
      }
    }
    // Fallback: browser/perangkat tidak dukung Web Share API dengan file
    toast('Share ke printer tidak didukung, gambar disimpan sebagai gantinya');
    const link = document.createElement('a');
    link.download = fileName;
    link.href = canvas.toDataURL('image/png');
    link.click();
  },

  async downloadStrukInternal(trxId) {
    const trx = this.findTrx(trxId);
    const canvas = await this.drawStrukInternalCanvas(trx);
    const link = document.createElement('a');
    link.download = `StrukInternal_${trx.nota.replace(/[^a-zA-Z0-9]/g, '')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast('Struk internal tersimpan');
  },

  async drawStrukInternalCanvas(trx) {
    const width = 384; // resolusi native printer thermal 58mm
    const lineHeight = 32;
    const RULE_H = 20;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const F = (label, value, size, opts) => this._makeField(ctx, width, label, value, size, opts);

    // Baris SEBELUM nama besar (No Nota)
    let preLines = [];
    preLines.push(...F('No Nota', trx.nota, 22));

    // Baris SETELAH nama besar
    let postLines = [];
    postLines.push(...F('Tgl Masuk', fmtTgl(trx.tglMasuk), 20));
    postLines.push(...F('Est Selesai', fmtTgl(trx.estSelesai), 20));
    postLines.push(...F('Kasir', trx.kasir, 24));
    postLines.push(...F('Parfum', trx.parfum, 24));
    postLines.push({ rule: true });
    postLines.push({ text: 'DAFTAR ITEM (untuk proses cuci):', size: 22, bold: true, wrap: true });
    trx.items.forEach(item => {
      const qtyDisplay = item.satuan === 'KG' ? item.qty.toLocaleString('id-ID', {maximumFractionDigits:2}) : item.qty;
      const namaItem = item.isCustom ? item.catNama : `${item.varianLabel} (${item.catNama})`;
      postLines.push({ text: `• ${namaItem} — ${qtyDisplay} ${item.satuan}`, size: 24, bold: true, wrap: true });
    });
    postLines.push({ rule: true });
    if (trx.catatan) {
      postLines.push({ text: 'CATATAN / INSTRUKSI KHUSUS:', size: 22, bold: true, wrap: true });
      postLines.push({ text: trx.catatan, size: 24, bold: true, wrap: true });
    } else {
      postLines.push({ text: 'Tidak ada catatan khusus.', size: 20, bold: true });
    }
    postLines.push({ rule: true });
    postLines.push({ text: '(Struk internal - tanpa harga, untuk tim cuci)', size: 16, bold: true, center: true, wrap: true });

    const logoImg = await this.getLogoImg();
    const logoW = 160;
    const logoH = logoImg ? Math.round(logoW * logoImg.height / logoImg.width) : 0;

    const measureWrap = (linesArr) => {
      const measured = [];
      let h = 0;
      linesArr.forEach(l => {
        if (l.rule) { measured.push(l); h += RULE_H; return; }
        ctx.font = `${l.bold ? 'bold' : ''} ${l.size}px Courier New`;
        if (l.wrap) {
          const maxW = width - 20 - (l.indent || 0);
          const words = l.text.split(' ');
          let cur = '';
          const wrapped = [];
          words.forEach(w => {
            const test = cur ? cur + ' ' + w : w;
            if (ctx.measureText(test).width > maxW) {
              wrapped.push(cur);
              cur = w;
            } else cur = test;
          });
          if (cur) wrapped.push(cur);
          wrapped.forEach(w => { measured.push({ ...l, text: w }); h += lineHeight; });
        } else {
          measured.push(l);
          h += lineHeight;
        }
      });
      return { measured, h };
    };

    const preM = measureWrap(preLines);
    const postM = measureWrap(postLines);

    // Ukur tinggi nama besar (bisa wrap kalau nama kepanjangan)
    const namaFontSize = 44;
    ctx.font = `bold ${namaFontSize}px 'Courier New', monospace`;
    const namaWords = trx.pelanggan.nama.split(' ');
    let namaCur = '';
    const namaWrapped = [];
    namaWords.forEach(w => {
      const test = namaCur ? namaCur + ' ' + w : w;
      if (ctx.measureText(test).width > width - 20) {
        namaWrapped.push(namaCur);
        namaCur = w;
      } else namaCur = test;
    });
    if (namaCur) namaWrapped.push(namaCur);
    const namaLineHeight = 54;
    const namaBlockHeight = namaWrapped.length * namaLineHeight + 24; // padding atas-bawah

    let totalHeight = logoH + 40 + preM.h + namaBlockHeight + postM.h + 30;

    // Render native (tanpa scale 2x) supaya lebar canvas persis 384px sesuai resolusi printer 58mm
    canvas.width = width;
    canvas.height = totalHeight;
    ctx.fillStyle = '#fffdf5';
    ctx.fillRect(0, 0, width, totalHeight);

    let y = 16;
    if (logoImg) {
      ctx.drawImage(logoImg, width/2 - logoW/2, y, logoW, logoH);
      y += logoH + 8;
    }
    ctx.textAlign = 'center'; ctx.font = 'bold 20px sans-serif'; ctx.fillStyle = '#000000';
    ctx.fillText('STRUK INTERNAL — TIM CUCI', width/2, y + 16);
    y += 34;

    const drawLine = (l) => {
      if (l.rule) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(10, y - RULE_H/2 + 4);
        ctx.lineTo(width - 10, y - RULE_H/2 + 4);
        ctx.stroke();
        y += RULE_H;
        return;
      }
      ctx.font = `${l.bold ? 'bold' : ''} ${l.size}px 'Courier New', monospace`;
      ctx.fillStyle = '#000000';
      const xBase = 10 + (l.indent || 0);
      if (l.center) {
        ctx.textAlign = 'center';
        ctx.fillText(l.text, width/2, y);
        ctx.textAlign = 'left';
      } else if (l.right !== undefined) {
        ctx.fillText(l.text, xBase, y);
        ctx.textAlign = 'right';
        ctx.fillText(l.right, width - 10, y);
        ctx.textAlign = 'left';
      } else {
        ctx.fillText(l.text, xBase, y);
      }
      y += lineHeight;
    };

    preM.measured.forEach(drawLine);

    // Nama pelanggan BESAR di tengah, biar gampang di-scan visual saat sortir cucian
    y += 8;
    ctx.strokeStyle = '#000000'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(10, y - lineHeight/2 - 2); ctx.lineTo(width - 10, y - lineHeight/2 - 2); ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillStyle = '#000000';
    ctx.font = `bold ${namaFontSize}px 'Courier New', monospace`;
    namaWrapped.forEach(w => {
      ctx.fillText(w, width/2, y + namaLineHeight - 10);
      y += namaLineHeight;
    });
    y += 8;
    ctx.beginPath(); ctx.moveTo(10, y - 4); ctx.lineTo(width - 10, y - 4); ctx.stroke();
    ctx.textAlign = 'left';
    y += 16;

    postM.measured.forEach(drawLine);

    return canvas;
  },

  async shareStrukWA(trxId) {
    const trx = this.findTrx(trxId);
    const waTab = window.open('', '_blank');
    const canvas = await this.drawStrukCanvas(trx);
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
            <a href="${url}" download="Struk_${trx.nota.replace(/[^a-zA-Z0-9]/g, '')}.png" style="margin-top:12px;padding:12px 20px;background:#25D366;color:#fff;text-decoration:none;border-radius:8px;">Download Gambar</a>
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
    const q = (state._statusSearch || '').toLowerCase();
    const filtered = list.filter(t => {
      if (q && !t.nota.toLowerCase().includes(q) && !t.pelanggan.nama.toLowerCase().includes(q)) return false;
      if (filter === 'AKTIF') return t.statusPesanan !== 'Sudah Diambil';
      if (filter === 'SEMUA') return true;
      return t.statusPesanan === filter;
    });

    main.innerHTML = `
      <div class="card">
        <h2>Status Pesanan</h2>
        <input type="text" placeholder="Cari no. nota atau nama pelanggan..." value="${esc(state._statusSearch||'')}"
          oninput="state._statusSearch=this.value; app.renderTab()" style="margin-bottom:10px;">
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
        <div class="transaksi-row-top" onclick="app.openEditTransaksi('${t.id}')" style="cursor:pointer;">
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
            ${t.statusPesanan !== 'Siap Diambil' && t.statusPesanan !== 'Sudah Diambil' ? `<button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); app.updateStatusPesanan('${t.id}','Siap Diambil')">Siap Diambil</button>` : ''}
            ${t.statusPesanan !== 'Sudah Diambil' ? `<button class="btn btn-ok btn-sm" onclick="event.stopPropagation(); app.updateStatusPesanan('${t.id}','Sudah Diambil')">Sudah Diambil</button>` : ''}
            ${t.statusBayar !== 'Lunas' ? `<button class="btn btn-gold btn-sm" onclick="event.stopPropagation(); app.lunaskanTransaksi('${t.id}')">Tandai Lunas</button>` : ''}
          </div>
        </div>
      </div>
    `;
  },

  updateStatusPesanan(id, status) {
    if (status === 'Siap Diambil') {
      // Jangan langsung ubah status - tampilkan dulu popup notif WA,
      // biar kalau kasir batal (silang), status tetap Diproses (tidak kepalang berubah)
      const t = this.findTrx(id);
      if (!t) return;
      this.offerNotifSiapDiambil(t);
      return;
    }
    if (status === 'Sudah Diambil') {
      const t = this.findTrx(id);
      if (!t) return;
      if (t.statusBayar !== 'Lunas') {
        // Wajib pilih metode bayar dulu sebelum status jadi Sudah Diambil
        this.mintaBayarSebelumAmbil(id);
        return;
      }
    }
    this._setStatusPesanan(id, status);
  },

  _setStatusPesanan(id, status) {
    const list = loadJSON(STORAGE_KEYS.TRANSAKSI, []);
    const t = list.find(x => x.id === id);
    if (!t) return;
    t.statusPesanan = status;
    if (status === 'Sudah Diambil') t.tglDiambil = nowTs();
    saveJSON(STORAGE_KEYS.TRANSAKSI, list);
    this.renderTab();
    toast(`Status diubah: ${status}`);
  },

  mintaBayarSebelumAmbil(id) {
    const t = this.findTrx(id);
    if (!t) return;
    const html = `
      <div class="modal-header"><h3>Pilih Metode Bayar</h3><span class="modal-close" onclick="app.closeModal()">&times;</span></div>
      <p style="font-size:13px;color:#555;">Transaksi <strong>${esc(t.nota)}</strong> masih <strong>Belum Bayar</strong>. Pilih metode bayar dulu sebelum ditandai Sudah Diambil.</p>
      <div class="chip-group">
        ${METODE_BAYAR.map(m => `<div class="chip" onclick="app.confirmLunasLaluAmbil('${id}','${m}')">${m}</div>`).join('')}
      </div>
    `;
    this.openModal(html);
  },

  confirmLunasLaluAmbil(id, metode) {
    const list = loadJSON(STORAGE_KEYS.TRANSAKSI, []);
    const t = list.find(x => x.id === id);
    if (!t) return;
    t.statusBayar = 'Lunas';
    t.metodeBayar = metode;
    t.tglLunas = nowTs();
    t.statusPesanan = 'Sudah Diambil';
    t.tglDiambil = nowTs();
    saveJSON(STORAGE_KEYS.TRANSAKSI, list);
    this.closeModal();
    this.renderTab();
    toast('Lunas & ditandai Sudah Diambil');
  },

  offerNotifSiapDiambil(t) {
    const html = `
      <div class="modal-header"><h3>Kabari Pelanggan?</h3><span class="modal-close" onclick="app.closeModal()">&times;</span></div>
      <p style="font-size:13px;color:#555;">Cucian <strong>${esc(t.nota)}</strong> milik <strong>${esc(t.pelanggan.nama)}</strong> sudah siap diambil. Kirim kabar via WhatsApp?</p>
      ${!t.pelanggan.telp ? '<p style="font-size:12px;color:var(--danger);">⚠️ Nomor telp pelanggan ini belum tersimpan, kamu perlu isi manual nanti di WhatsApp.</p>' : ''}
      <div class="row" style="margin-top:12px;">
        <button class="btn btn-outline" onclick="app.tundaNotifSiapDiambil('${t.id}')">Nanti Saja</button>
        <button class="btn btn-gold" onclick="app.kirimNotifSiapDiambil('${t.id}')">📱 Kirim WA</button>
      </div>
    `;
    this.openModal(html);
  },

  tundaNotifSiapDiambil(trxId) {
    // Kasir sengaja skip kirim WA, tapi status pesanan tetap lanjut jadi Siap Diambil
    this.closeModal();
    this._setStatusPesanan(trxId, 'Siap Diambil');
  },

  kirimNotifSiapDiambil(trxId) {
    const t = this.findTrx(trxId);
    if (!t) return;
    const pesan = `Halo Kak ${t.pelanggan.nama}, cucian Anda di Naufal Laundry (${t.nota}) sudah *siap diambil*.\n\nTotal: ${fmtRupiah(t.total)}\nStatus Bayar: ${t.statusBayar}\n\nDitunggu ya kedatangannya di Jl. Ahmad No. 9, Pamoyanan, Cicendo, Bandung. Terima kasih! 🙏\n\nOh iya, kalau ada waktu, kami senang banget kalau boleh dengar masukan soal layanan kami di sini: https://forms.gle/SfhNqXrkuMFYiaS27 🙏`;
    const telp = (t.pelanggan.telp || '').replace(/\D/g, '');
    const waNumber = telp ? (telp.startsWith('0') ? '62' + telp.slice(1) : telp) : '';
    const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(pesan)}`;
    window.open(waUrl, '_blank');
    this.closeModal();
    this._setStatusPesanan(trxId, 'Siap Diambil');
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
    t.tglLunas = nowTs();
    saveJSON(STORAGE_KEYS.TRANSAKSI, list);
    this.closeModal();
    this.renderTab();
    toast('Ditandai Lunas');
  },

  // ============================================
  // TAB: RIWAYAT (semua transaksi + edit)
  // ============================================
  renderRiwayatTab(main) {
    const list = loadJSON(STORAGE_KEYS.TRANSAKSI, []).slice().reverse();
    const q = (state._riwayatSearch || '').toLowerCase();
    const filtered = q
      ? list.filter(t => t.nota.toLowerCase().includes(q) || t.pelanggan.nama.toLowerCase().includes(q))
      : list;
    const alreadyImported = localStorage.getItem('nl_legacy_imported') === 'true';
    const hasLegacyData = typeof LEGACY_TRANSAKSI !== 'undefined' && LEGACY_TRANSAKSI.length > 0;

    main.innerHTML = `
      ${(hasLegacyData && !alreadyImported) ? `
      <div class="card" style="background:#eaf2fb;border-color:var(--info);">
        <h2 style="color:var(--info);">📥 Import Data Histori Kasmini</h2>
        <p style="font-size:12px;color:#555;margin-top:0;">Tersedia ${LEGACY_TRANSAKSI.length} transaksi dan ${LEGACY_PELANGGAN.length} data pelanggan dari histori Kasmini (31 hari terakhir). Data ini belum diimpor ke sistem.</p>
        <button class="btn btn-gold btn-block" onclick="app.confirmImportLegacy()">Import Sekarang</button>
      </div>` : ''}
      <div class="card">
        <h2>Riwayat Transaksi <span class="badge-count">${list.length}</span></h2>
        <input type="text" placeholder="Cari no. nota atau nama pelanggan..." value="${esc(state._riwayatSearch||'')}"
          oninput="state._riwayatSearch=this.value; app.renderTab()">
      </div>
      <div class="card">
        ${filtered.length === 0
          ? `<div class="empty-state"><span class="ic">📜</span>Belum ada transaksi.</div>`
          : filtered.slice(0, 50).map(t => this.renderRiwayatRow(t)).join('')
        }
        ${filtered.length > 50 ? `<div style="text-align:center;font-size:11px;color:#999;margin-top:8px;">Menampilkan 50 transaksi terbaru dari ${filtered.length}. Gunakan pencarian untuk hasil lebih spesifik.</div>` : ''}
      </div>
    `;
  },

  confirmImportLegacy() {
    const html = `
      <div class="modal-header"><h3>Import Data Histori?</h3><span class="modal-close" onclick="app.closeModal()">&times;</span></div>
      <p style="font-size:13px;color:#555;">Ini akan menambahkan <strong>${LEGACY_TRANSAKSI.length} transaksi</strong> dan <strong>${LEGACY_PELANGGAN.length} data pelanggan</strong> dari histori Kasmini ke sistem.</p>
      <p style="font-size:12px;color:#888;">Catatan: semua transaksi lama ditandai kasir "Hera", dan transaksi yang statusnya lunas ditandai metode bayar "Tidak diketahui" (karena tidak tercatat di data asal). Proses ini aman dijalankan sekali dan tidak akan menduplikasi data jika diulang.</p>
      <div class="row" style="margin-top:14px;">
        <button class="btn btn-outline" onclick="app.closeModal()">Batal</button>
        <button class="btn btn-gold" onclick="app.importLegacyData()">Ya, Import</button>
      </div>
    `;
    this.openModal(html);
  },

  importLegacyData() {
    const existingTrx = loadJSON(STORAGE_KEYS.TRANSAKSI, []);
    const existingIds = new Set(existingTrx.map(t => t.id));
    const newTrx = LEGACY_TRANSAKSI.filter(t => !existingIds.has(t.id));
    const merged = existingTrx.concat(newTrx);
    saveJSON(STORAGE_KEYS.TRANSAKSI, merged);

    const existingPel = loadJSON(STORAGE_KEYS.PELANGGAN, []);
    const existingNames = new Set(existingPel.map(p => p.nama.toLowerCase()));
    const newPel = LEGACY_PELANGGAN.filter(p => !existingNames.has(p.nama.toLowerCase()));
    const mergedPel = existingPel.concat(newPel);
    saveJSON(STORAGE_KEYS.PELANGGAN, mergedPel);

    localStorage.setItem('nl_legacy_imported', 'true');
    this.closeModal();
    this.renderTab();
    toast(`${newTrx.length} transaksi & ${newPel.length} pelanggan diimpor`);
  },

  renderRiwayatRow(t) {
    const statusClass = t.statusPesanan === 'Diproses' ? 'status-diproses' : t.statusPesanan === 'Siap Diambil' ? 'status-siap' : 'status-diambil';
    const bayarClass = t.statusBayar === 'Lunas' ? 'bayar-lunas' : 'bayar-belum';
    return `
      <div class="transaksi-row">
        <div class="transaksi-row-top">
          <div>
            <div class="transaksi-nota">${esc(t.nota)} · ${esc(t.pelanggan.nama)}</div>
            <div class="transaksi-meta">Masuk ${fmtTgl(t.tglMasuk)} · Kasir ${esc(t.kasir)}</div>
          </div>
          <div class="transaksi-total">${fmtRupiah(t.total)}</div>
        </div>
        <div style="display:flex;gap:6px;margin-top:8px;align-items:center;flex-wrap:wrap;">
          <span class="status-badge ${statusClass}">${esc(t.statusPesanan)}</span>
          <span class="status-badge ${bayarClass}">${esc(t.statusBayar)}</span>
          <div style="margin-left:auto;display:flex;gap:6px;">
            <button class="btn btn-outline btn-sm" onclick="app.lihatStrukLama('${t.id}')">Lihat Struk</button>
            <button class="btn btn-outline btn-sm" onclick="app.openEditTransaksi('${t.id}')">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="app.confirmHapusTransaksi('${t.id}')">Hapus</button>
          </div>
        </div>
      </div>
    `;
  },

  confirmHapusTransaksi(trxId) {
    const t = this.findTrx(trxId);
    if (!t) return;
    const html = `
      <div class="modal-header"><h3>Hapus Transaksi?</h3><span class="modal-close" onclick="app.closeModal()">&times;</span></div>
      <p style="font-size:13px;color:#555;">Transaksi <strong>${esc(t.nota)}</strong> (${esc(t.pelanggan.nama)}, ${fmtRupiah(t.total)}) akan dihapus permanen. Aksi ini biasanya untuk keperluan development/koreksi data, dan tidak bisa dibatalkan.</p>
      <div class="row" style="margin-top:14px;">
        <button class="btn btn-outline" onclick="app.closeModal()">Batal</button>
        <button class="btn btn-danger" onclick="app.hapusTransaksi('${t.id}')">Ya, Hapus</button>
      </div>
    `;
    this.openModal(html);
  },

  hapusTransaksi(trxId) {
    let list = loadJSON(STORAGE_KEYS.TRANSAKSI, []);
    list = list.filter(x => x.id !== trxId);
    saveJSON(STORAGE_KEYS.TRANSAKSI, list);
    this.closeModal();
    this.renderTab();
    toast('Transaksi dihapus');
  },

  lihatStrukLama(trxId) {
    const t = this.findTrx(trxId);
    if (!t) return;
    this.showStruk(t);
  },

  openEditTransaksi(trxId) {
    const t = this.findTrx(trxId);
    if (!t) return;
    // Load transaksi ke state kasir untuk diedit
    state.editingTransaksiId = t.id;
    state.cart = JSON.parse(JSON.stringify(t.items));
    state.pelangganNama = t.pelanggan.nama;
    state.pelangganAlamat = t.pelanggan.alamat || '';
    state.pelangganTelp = t.pelanggan.telp || '';
    state.parfum = t.parfum;
    state.metodeBayar = t.metodeBayar;
    state.statusBayar = t.statusBayar;
    state.catatanRincian = t.catatan || '';
    state.diskonNominal = t.diskonNominal || 0;
    state.diskonPersen = t.diskonPersen || 0;
    state.ongkirJauh = (t.ongkir || 0) > 0;
    state.activeTab = 'kasir';
    this.renderTabs();
    this.renderTab();
    toast(`Mengedit transaksi ${t.nota}`);
  },

  batalEditTransaksi() {
    state.editingTransaksiId = null;
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
    state.ongkirJauh = false;
    this.renderTab();
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
        <button class="btn btn-gold btn-block" style="margin-top:10px;" onclick="app.openTambahPelanggan()">+ Tambah Pelanggan Baru</button>
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

  openTambahPelanggan() {
    const html = `
      <div class="modal-header"><h3>Tambah Pelanggan Baru</h3><span class="modal-close" onclick="app.closeModal()">&times;</span></div>
      <label>Nama</label>
      <input type="text" id="newPelangganNama" placeholder="Nama pelanggan">
      <label>Alamat <span style="font-weight:400;color:#999;">(opsional)</span></label>
      <input type="text" id="newPelangganAlamat" placeholder="Alamat">
      <label>No. Telp <span style="font-weight:400;color:#999;">(opsional)</span></label>
      <input type="tel" id="newPelangganTelp" placeholder="08xxxxxxxxxx">
      <button class="btn btn-gold btn-block" style="margin-top:14px;" onclick="app.simpanPelangganBaru()">+ Simpan Pelanggan</button>
    `;
    this.openModal(html);
  },

  simpanPelangganBaru() {
    const nama = document.getElementById('newPelangganNama').value.trim();
    const alamat = document.getElementById('newPelangganAlamat').value.trim();
    const telp = document.getElementById('newPelangganTelp').value.trim();
    if (!nama) { toast('Isi nama pelanggan dulu'); return; }

    const list = loadJSON(STORAGE_KEYS.PELANGGAN, []);
    const existing = list.find(x => x.nama.toLowerCase() === nama.toLowerCase());
    if (existing) { toast('Nama ini sudah ada di data pelanggan'); return; }

    list.push({ id: uid('pel'), nama, alamat, telp, createdAt: nowTs() });
    saveJSON(STORAGE_KEYS.PELANGGAN, list);
    this.closeModal();
    this.renderTab();
    toast(`${nama} ditambahkan`);
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
                <div style="display:flex;align-items:center;gap:8px;">
                  <div class="transaksi-total">${fmtRupiah(p.jumlah)}</div>
                  <button class="btn btn-outline btn-sm" onclick="app.editPengeluaran('${p.id}')">Edit</button>
                </div>
              </div>
            </div>
          `).join('')
        }
      </div>
    `;
  },

  editPengeluaran(id) {
    const list = loadJSON(STORAGE_KEYS.PENGELUARAN, []);
    const p = list.find(x => x.id === id);
    if (!p) return;
    const html = `
      <div class="modal-header"><h3>Edit Pengeluaran</h3><span class="modal-close" onclick="app.closeModal()">&times;</span></div>
      <label>Jenis Pengeluaran</label>
      <div class="chip-group" id="editPengJenisGroup">
        ${this.JENIS_PENGELUARAN.map(j => `<div class="chip ${p.jenis===j?'selected':''}" data-val="${esc(j)}" onclick="app.selectChipInModal('editPengJenisGroup', this)">${j}</div>`).join('')}
      </div>
      <label>Jumlah Biaya (Rp)</label>
      <input type="number" id="editPengJumlah" value="${p.jumlah}">
      <label>Bukti</label>
      <div class="chip-group" id="editPengBuktiGroup">
        ${['Bon','Kwitansi','Nota'].map(b => `<div class="chip ${p.bukti===b?'selected':''}" data-val="${esc(b)}" onclick="app.selectChipInModal('editPengBuktiGroup', this)">${b}</div>`).join('')}
      </div>
      <label>Keterangan</label>
      <input type="text" id="editPengKet" value="${esc(p.keterangan||'')}">
      <div class="row" style="margin-top:14px;">
        <button class="btn btn-danger" onclick="app.deletePengeluaran('${p.id}')">Hapus</button>
        <button class="btn btn-gold" onclick="app.savePengeluaran('${p.id}')">Simpan</button>
      </div>
    `;
    this.openModal(html);
  },

  selectChipInModal(groupId, el) {
    const group = document.getElementById(groupId);
    group.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
  },

  savePengeluaran(id) {
    const list = loadJSON(STORAGE_KEYS.PENGELUARAN, []);
    const p = list.find(x => x.id === id);
    if (!p) return;
    const jenisEl = document.querySelector('#editPengJenisGroup .chip.selected');
    const buktiEl = document.querySelector('#editPengBuktiGroup .chip.selected');
    const jumlah = parseFloat(document.getElementById('editPengJumlah').value) || 0;
    if (!jenisEl) { toast('Pilih jenis pengeluaran'); return; }
    if (!buktiEl) { toast('Pilih bukti'); return; }
    if (jumlah <= 0) { toast('Isi jumlah biaya'); return; }
    p.jenis = jenisEl.dataset.val;
    p.bukti = buktiEl.dataset.val;
    p.jumlah = jumlah;
    p.keterangan = document.getElementById('editPengKet').value.trim();
    saveJSON(STORAGE_KEYS.PENGELUARAN, list);
    this.closeModal();
    this.renderTab();
    toast('Pengeluaran diperbarui');
  },

  deletePengeluaran(id) {
    let list = loadJSON(STORAGE_KEYS.PENGELUARAN, []);
    list = list.filter(x => x.id !== id);
    saveJSON(STORAGE_KEYS.PENGELUARAN, list);
    this.closeModal();
    this.renderTab();
    toast('Pengeluaran dihapus');
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
    // Transaksi yang PEMBAYARANNYA terjadi hari ini (bukan berdasar tglMasuk/tglDiambil) -
    // ini yang jadi acuan "uang beneran diterima hari ini", menghindari dobel hitung
    // (misal transaksi dibayar lunas 3 hari lalu lalu diambil hari ini, tidak dihitung lagi hari ini).
    const bayarHariIni = trxAll.filter(t => t.tglLunas && fmtTglSingkat(t.tglLunas) === tglStr);

    const totalMasuk = masuk.reduce((a,b) => a + b.total, 0);
    const totalKeluar = keluar.reduce((a,b) => a + b.total, 0);
    const totalPengeluaran = pengeluaran.reduce((a,b) => a + b.jumlah, 0);
    const totalBayarHariIni = bayarHariIni.reduce((a,b) => a + b.total, 0);

    const breakdownBayar = (rows) => {
      const b = { Tunai: 0, QRIS: 0, Transfer: 0, 'Belum Bayar': 0 };
      rows.forEach(t => {
        if (t.statusBayar === 'Lunas' && t.metodeBayar) b[t.metodeBayar] += t.total;
        else b['Belum Bayar'] += t.total;
      });
      return b;
    };
    const bayarMasuk = breakdownBayar(masuk);
    const bayarKeluar = breakdownBayar(keluar);
    const breakdownPembayaranHariIni = { Tunai: 0, QRIS: 0, Transfer: 0 };
    bayarHariIni.forEach(t => { if (t.metodeBayar) breakdownPembayaranHariIni[t.metodeBayar] += t.total; });

    body.innerHTML = `
      <div class="card">
        <label>Pilih Tanggal</label>
        <input type="date" id="laporanTglInput" value="${this.toInputDate(tglStr)}" onchange="app.setLaporanTgl(this.value)">
      </div>

      <div class="card" style="background:#f5eee0;border-color:var(--gold);">
        <h2>💰 Total Pembayaran Hari Ini</h2>
        <p style="font-size:11px;color:#777;margin-top:0;">Uang yang beneran diterima hari ini (termasuk pembayaran dari order sebelumnya yang baru lunas hari ini), berapapun tanggal order masuk/diambilnya.</p>
        <div style="font-size:24px;font-weight:800;color:var(--gold);margin:8px 0;">${fmtRupiah(totalBayarHariIni)}</div>
        <div class="grid3">
          <div style="text-align:center;padding:8px 4px;background:#fff;border-radius:6px;">
            <div style="font-size:9.5px;color:#888;">TUNAI</div><div style="font-weight:700;font-size:12.5px;">${fmtRupiah(breakdownPembayaranHariIni.Tunai)}</div>
          </div>
          <div style="text-align:center;padding:8px 4px;background:#fff;border-radius:6px;">
            <div style="font-size:9.5px;color:#888;">QRIS</div><div style="font-weight:700;font-size:12.5px;">${fmtRupiah(breakdownPembayaranHariIni.QRIS)}</div>
          </div>
          <div style="text-align:center;padding:8px 4px;background:#fff;border-radius:6px;">
            <div style="font-size:9.5px;color:#888;">TRANSFER</div><div style="font-weight:700;font-size:12.5px;">${fmtRupiah(breakdownPembayaranHariIni.Transfer)}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <h2>📥 Laporan Masuk Laundry — ${esc(fmtHari(this.parseInputDate(tglStr)))}, ${tglStr}</h2>
        ${this.renderLaporanTable(masuk, 'masuk')}
        ${this.renderBayarBreakdown(bayarMasuk)}
        <div style="text-align:right;font-weight:800;margin-top:10px;font-size:15px;">Jumlah Pemasukan: ${fmtRupiah(totalMasuk)}</div>
      </div>

      <div class="card">
        <h2>📤 Laporan Keluar Laundry — ${esc(fmtHari(this.parseInputDate(tglStr)))}, ${tglStr}</h2>
        ${this.renderLaporanTable(keluar, 'keluar')}
        ${this.renderBayarBreakdown(bayarKeluar)}
        <div style="text-align:right;font-weight:800;margin-top:10px;font-size:15px;">Jumlah Diambil: ${fmtRupiah(totalKeluar)}</div>
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
          <div style="text-align:center;"><div style="font-size:10px;color:#888;">NET</div><div style="font-weight:800;color:${(totalBayarHariIni-totalPengeluaran)>=0?'var(--ok)':'var(--danger)'};">${fmtRupiah(totalBayarHariIni-totalPengeluaran)}</div></div>
        </div>
        <button class="btn btn-gold btn-block" style="margin-top:12px;" onclick="app.downloadLaporanHarianPDF('${tglStr}')">📄 Export Laporan Harian (PDF)</button>
      </div>
    `;
  },

  renderBayarBreakdown(b) {
    return `
      <div class="grid3" style="margin-top:10px;">
        <div style="text-align:center;padding:8px 4px;background:var(--paper-dim);border-radius:6px;">
          <div style="font-size:9.5px;color:#888;">TUNAI</div><div style="font-weight:700;font-size:12.5px;">${fmtRupiah(b.Tunai)}</div>
        </div>
        <div style="text-align:center;padding:8px 4px;background:var(--paper-dim);border-radius:6px;">
          <div style="font-size:9.5px;color:#888;">QRIS</div><div style="font-weight:700;font-size:12.5px;">${fmtRupiah(b.QRIS)}</div>
        </div>
        <div style="text-align:center;padding:8px 4px;background:var(--paper-dim);border-radius:6px;">
          <div style="font-size:9.5px;color:#888;">TRANSFER</div><div style="font-weight:700;font-size:12.5px;">${fmtRupiah(b.Transfer)}</div>
        </div>
      </div>
      ${b['Belum Bayar'] > 0 ? `<div style="text-align:center;margin-top:6px;font-size:11px;color:var(--danger);">Belum Bayar: ${fmtRupiah(b['Belum Bayar'])}</div>` : ''}
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

  // Helper: gambar 1 section tabel (Masuk/Keluar/Pengeluaran) ke context canvas, mulai dari startY.
  // Mengembalikan Y akhir setelah section selesai digambar.
  _drawSectionHeader(ctx, width, y, title, bgColor, textColor) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, y, width, 40);
    ctx.fillStyle = textColor;
    ctx.font = 'bold 17px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(title, 20, y + 26);
    return y + 40 + 14;
  },

  _drawTrxTable(ctx, width, y, rows) {
    const rowH = 24;
    const cols = [
      {label:'No', w:32, align:'center'},
      {label:'Nota', w:75, align:'left'},
      {label:'Pelanggan', w:150, align:'left'},
      {label:'Jenis', w:65, align:'center'},
      {label:'Level', w:95, align:'center'},
      {label:'Biaya', w:105, align:'right'},
      {label:'Bayar', w:95, align:'center'},
    ];
    let x = 20;
    ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fillRect(20, y-17, width-40, 23);
    ctx.fillStyle = '#333'; ctx.font = 'bold 11px sans-serif';
    cols.forEach(c => { ctx.textAlign = c.align; ctx.fillText(c.label, c.align==='right' ? x+c.w-4 : c.align==='center' ? x+c.w/2 : x+4, y); x += c.w; });
    y += rowH;

    if (rows.length === 0) {
      ctx.font = 'italic 12px sans-serif'; ctx.fillStyle = '#888'; ctx.textAlign = 'left';
      ctx.fillText('Tidak ada transaksi.', 24, y);
      y += rowH;
      return y;
    }

    ctx.font = '11px sans-serif';
    rows.forEach((t, i) => {
      x = 20;
      const jenisSet = [...new Set(t.items.map(it => it.jenisCuci))].join('/');
      const levelSet = [...new Set(t.items.map(it => LEVEL_LABEL[it.level]))].join('/');
      const vals = [String(i+1), t.nota, t.pelanggan.nama, jenisSet, levelSet, fmtRupiah(t.total), t.statusBayar==='Lunas'?(t.metodeBayar||'Lunas'):'Belum'];
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
      ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.beginPath(); ctx.moveTo(20,y-rowH+8); ctx.lineTo(width-20,y-rowH+8); ctx.stroke();
    });
    return y;
  },

  _drawBayarBreakdown(ctx, width, y, bayar) {
    const boxW = (width - 40 - 16) / 3;
    const items = [['TUNAI', bayar.Tunai], ['QRIS', bayar.QRIS], ['TRANSFER', bayar.Transfer]];
    items.forEach(([label, val], i) => {
      const bx = 20 + i * (boxW + 8);
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      ctx.fillRect(bx, y, boxW, 40);
      ctx.fillStyle = '#666'; ctx.font = '9.5px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(label, bx + boxW/2, y + 15);
      ctx.fillStyle = '#222'; ctx.font = 'bold 12.5px sans-serif';
      ctx.fillText(fmtRupiah(val), bx + boxW/2, y + 32);
    });
    y += 50;
    if (bayar['Belum Bayar'] > 0) {
      ctx.fillStyle = '#c0392b'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`Belum Bayar: ${fmtRupiah(bayar['Belum Bayar'])}`, width/2, y);
      y += 20;
    }
    return y;
  },

  downloadLaporanHarianPDF(tglStr) {
    const html = `
      <div class="modal-header"><h3>Tanda Tangan Operator</h3><span class="modal-close" onclick="app.closeModal()">&times;</span></div>
      <p style="font-size:12px;color:#777;margin-top:0;">Tanda tangan di area bawah ini sebelum laporan di-export.</p>
      <canvas id="signatureCanvas" width="600" height="240" style="width:100%;height:150px;border:1.5px dashed var(--line);border-radius:8px;background:#fff;touch-action:none;"></canvas>
      <div class="row" style="margin-top:10px;">
        <button class="btn btn-outline" onclick="app.clearSignature()">Hapus</button>
        <button class="btn btn-outline" onclick="app.skipSignatureAndExport('${tglStr}')">Lewati</button>
        <button class="btn btn-gold" onclick="app.confirmSignatureAndExport('${tglStr}')">✓ Konfirmasi & Export</button>
      </div>
    `;
    this.openModal(html);
    this.initSignaturePad();
  },

  initSignaturePad() {
    const canvas = document.getElementById('signatureCanvas');
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    let drawing = false;
    let lastX = 0, lastY = 0;

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    };

    const start = (e) => {
      e.preventDefault();
      drawing = true;
      const pos = getPos(e);
      lastX = pos.x; lastY = pos.y;
    };
    const move = (e) => {
      if (!drawing) return;
      e.preventDefault();
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      lastX = pos.x; lastY = pos.y;
    };
    const end = () => { drawing = false; };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('mouseleave', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end);
  },

  clearSignature() {
    const canvas = document.getElementById('signatureCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  },

  _isSignatureBlank(canvas) {
    const ctx = canvas.getContext('2d');
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] !== 0) return false;
    }
    return true;
  },

  async confirmSignatureAndExport(tglStr) {
    const canvas = document.getElementById('signatureCanvas');
    if (this._isSignatureBlank(canvas)) { toast('Tanda tangan dulu, atau tap Lewati'); return; }
    const signatureDataUrl = canvas.toDataURL('image/png');
    this.closeModal();
    await this._generateLaporanHarianPDF(tglStr, signatureDataUrl);
  },

  async skipSignatureAndExport(tglStr) {
    this.closeModal();
    await this._generateLaporanHarianPDF(tglStr, null);
  },

  async _generateLaporanHarianPDF(tglStr, signatureDataUrl) {
    toast('Menyiapkan PDF...');
    const trxAll = loadJSON(STORAGE_KEYS.TRANSAKSI, []);
    const pengAll = loadJSON(STORAGE_KEYS.PENGELUARAN, []);

    const masuk = trxAll.filter(t => fmtTglSingkat(t.tglMasuk) === tglStr);
    const keluar = trxAll.filter(t => t.tglDiambil && fmtTglSingkat(t.tglDiambil) === tglStr);
    const pengeluaran = pengAll.filter(p => fmtTglSingkat(p.tanggal) === tglStr);
    const bayarHariIni = trxAll.filter(t => t.tglLunas && fmtTglSingkat(t.tglLunas) === tglStr);

    const totalMasuk = masuk.reduce((a,b) => a + b.total, 0);
    const totalKeluar = keluar.reduce((a,b) => a + b.total, 0);
    const totalPengeluaran = pengeluaran.reduce((a,b) => a + b.jumlah, 0);
    const totalBayarHariIni = bayarHariIni.reduce((a,b) => a + b.total, 0);

    const breakdownBayar = (rows) => {
      const b = { Tunai: 0, QRIS: 0, Transfer: 0, 'Belum Bayar': 0 };
      rows.forEach(t => {
        if (t.statusBayar === 'Lunas' && t.metodeBayar) b[t.metodeBayar] += t.total;
        else b['Belum Bayar'] += t.total;
      });
      return b;
    };
    const bayarMasuk = breakdownBayar(masuk);
    const bayarKeluar = breakdownBayar(keluar);
    const breakdownPembayaranHariIni = { Tunai: 0, QRIS: 0, Transfer: 0 };
    bayarHariIni.forEach(t => { if (t.metodeBayar) breakdownPembayaranHariIni[t.metodeBayar] += t.total; });

    const width = 780;
    // Estimasi tinggi total dulu (dry run sederhana): header + total bayar hari ini + 3 section + footer ttd
    const rowH = 24;
    const estTotalBayarH = 100;
    const estMasukH = 40+14 + 23+rowH + Math.max(masuk.length,1)*rowH + 50 + 45;
    const estKeluarH = 40+14 + 23+rowH + Math.max(keluar.length,1)*rowH + 50 + 45;
    const estPengH = 40+14 + 23+rowH + Math.max(pengeluaran.length,1)*rowH + 45;
    const headerH = 100;
    const footerH = 170; // ringkasan + ttd
    const totalHeight = headerH + estTotalBayarH + estMasukH + estKeluarH + estPengH + footerH + 40;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = width * 2;
    canvas.height = totalHeight * 2;
    canvas.style.width = width + 'px';
    canvas.style.height = totalHeight + 'px';
    ctx.scale(2, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, totalHeight);

    // Header
    let y = 20;
    const logoImg = await this.getLogoImg();
    if (logoImg) {
      const logoW = 90;
      const logoH = Math.round(logoW * logoImg.height / logoImg.width);
      ctx.drawImage(logoImg, 20, y, logoW, logoH);
    }
    ctx.textAlign = 'right';
    ctx.fillStyle = '#1a1a1a'; ctx.font = 'bold 20px sans-serif';
    ctx.fillText('LAPORAN HARIAN', width - 20, y + 24);
    ctx.font = '13px sans-serif'; ctx.fillStyle = '#666';
    ctx.fillText(`${fmtHari(this.parseInputDate(tglStr))}, ${tglStr}`, width - 20, y + 44);
    ctx.fillText('Naufal Laundry', width - 20, y + 60);
    y = headerH;

    // Section TOTAL PEMBAYARAN HARI INI (gold/kuning)
    y = this._drawSectionHeader(ctx, width, y, '💰  TOTAL PEMBAYARAN HARI INI', '#f5eee0', '#8a6d1e');
    y = this._drawBayarBreakdown(ctx, width, y, { ...breakdownPembayaranHariIni, 'Belum Bayar': 0 });
    ctx.textAlign = 'right'; ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = '#8a6d1e';
    ctx.fillText(`Total: ${fmtRupiah(totalBayarHariIni)}`, width - 20, y + 6);
    y += 36;

    // Section MASUK (hijau muda)
    y = this._drawSectionHeader(ctx, width, y, '📥  LAPORAN MASUK LAUNDRY', '#dcefdf', '#1e5c33');
    y = this._drawTrxTable(ctx, width, y, masuk);
    y += 8;
    y = this._drawBayarBreakdown(ctx, width, y, bayarMasuk);
    ctx.textAlign = 'right'; ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = '#1e5c33';
    ctx.fillText(`Jumlah Pemasukan: ${fmtRupiah(totalMasuk)}`, width - 20, y + 6);
    y += 36;

    // Section KELUAR (biru muda)
    y = this._drawSectionHeader(ctx, width, y, '📤  LAPORAN KELUAR LAUNDRY', '#dbe9f7', '#1c4f7c');
    y = this._drawTrxTable(ctx, width, y, keluar);
    y += 8;
    y = this._drawBayarBreakdown(ctx, width, y, bayarKeluar);
    ctx.textAlign = 'right'; ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = '#1c4f7c';
    ctx.fillText(`Jumlah Diambil: ${fmtRupiah(totalKeluar)}`, width - 20, y + 6);
    y += 36;

    // Section PENGELUARAN (oranye muda)
    y = this._drawSectionHeader(ctx, width, y, '💸  PENGELUARAN', '#fbe8d6', '#8a4a1e');
    const rowHP = 24;
    if (pengeluaran.length === 0) {
      ctx.font = 'italic 12px sans-serif'; ctx.fillStyle = '#888'; ctx.textAlign = 'left';
      ctx.fillText('Tidak ada pengeluaran.', 24, y);
      y += rowHP;
    } else {
      const cols = [{label:'Jenis',w:280,align:'left'},{label:'Biaya',w:200,align:'right'},{label:'Bukti',w:200,align:'left'}];
      let x = 20;
      ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fillRect(20, y-17, width-40, 23);
      ctx.fillStyle = '#333'; ctx.font = 'bold 11px sans-serif';
      cols.forEach(c => { ctx.textAlign = c.align; ctx.fillText(c.label, c.align==='right'?x+c.w-4:x+4, y); x += c.w; });
      y += rowHP;
      ctx.font = '11px sans-serif';
      pengeluaran.forEach(p => {
        x = 20;
        const vals = [p.jenis, fmtRupiah(p.jumlah), p.bukti];
        ctx.fillStyle = '#222';
        cols.forEach((c, ci) => {
          ctx.textAlign = c.align;
          ctx.fillText(vals[ci], c.align==='right'?x+c.w-4:x+4, y);
          x += c.w;
        });
        y += rowHP;
        ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.beginPath(); ctx.moveTo(20,y-rowHP+8); ctx.lineTo(width-20,y-rowHP+8); ctx.stroke();
      });
    }
    y += 8;
    ctx.textAlign = 'right'; ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = '#8a4a1e';
    ctx.fillText(`Jumlah Pengeluaran: ${fmtRupiah(totalPengeluaran)}`, width - 20, y + 6);
    y += 40;

    // Ringkasan
    ctx.strokeStyle = '#ccc'; ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(width-20, y); ctx.stroke();
    y += 26;
    ctx.textAlign = 'left'; ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#1a1a1a';
    ctx.fillText(`Net (Total Pembayaran - Pengeluaran): ${fmtRupiah(totalBayarHariIni - totalPengeluaran)}`, 20, y);
    y += 40;

    // Tanda tangan
    ctx.textAlign = 'left'; ctx.font = '12px sans-serif'; ctx.fillStyle = '#444';
    ctx.fillText('Tanda tangan operator:', 20, y);
    y += 8;
    if (signatureDataUrl) {
      const sigImg = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = signatureDataUrl;
      });
      if (sigImg) {
        const sigW = 160;
        const sigH = Math.round(sigW * sigImg.height / sigImg.width);
        ctx.drawImage(sigImg, 20, y, sigW, sigH);
        y += sigH + 6;
      } else {
        y += 50;
      }
    } else {
      y += 50;
    }
    ctx.strokeStyle = '#999'; ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(220, y); ctx.stroke();
    y += 16;
    ctx.font = '10.5px sans-serif'; ctx.fillStyle = '#888';
    ctx.fillText(`(${state.currentKasir || '.......................'})`, 20, y);

    // Convert ke PDF
    const pdfBlob = await this.canvasToPdfBlob(canvas, width, totalHeight);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(pdfBlob);
    link.download = `Laporan_Harian_NaufalLaundry_${tglStr.replace(/\//g,'-')}.pdf`;
    link.click();
    toast('Laporan PDF tersimpan');
  },

  // Konversi canvas jadi PDF 1 halaman (embed sebagai JPEG di dalam PDF minimal).
  // Pendekatan manual tanpa library eksternal supaya tetap 100% offline.
  canvasToPdfBlob(canvas, widthPt, heightPt) {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        const reader = new FileReader();
        reader.onload = () => {
          const jpegData = new Uint8Array(reader.result);
          const pdfBytes = this.buildSingleImagePdf(jpegData, widthPt, heightPt, canvas.width, canvas.height);
          resolve(new Blob([pdfBytes], { type: 'application/pdf' }));
        };
        reader.readAsArrayBuffer(blob);
      }, 'image/jpeg', 0.92);
    });
  },

  buildSingleImagePdf(jpegBytes, widthPt, heightPt, pixelWidth, pixelHeight) {
    return this.buildMultiImagePdf([{ jpegBytes, widthPt, heightPt, pixelWidth, pixelHeight }]);
  },

  // Bangun PDF multi-halaman, tiap halaman 1 gambar JPEG full-page.
  // pages: array of { jpegBytes, widthPt, heightPt, pixelWidth, pixelHeight }
  buildMultiImagePdf(pages) {
    const enc = new TextEncoder();
    const chunks = [];
    const offsets = {};
    let pos = 0;
    const push = (data) => {
      const bytes = typeof data === 'string' ? enc.encode(data) : data;
      chunks.push(bytes);
      pos += bytes.length;
    };

    const n = pages.length;
    // Object numbering: 1=Catalog, 2=Pages, lalu tiap halaman pakai 3 object (Page, Image, Content)
    // Page i (0-based): Page = 3+i*3, Image = 4+i*3, Content = 5+i*3
    const pageObjNums = [];
    for (let i = 0; i < n; i++) pageObjNums.push(3 + i * 3);

    push('%PDF-1.4\n');

    offsets[1] = pos;
    push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);

    offsets[2] = pos;
    const kids = pageObjNums.map(num => `${num} 0 R`).join(' ');
    push(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${n} >>\nendobj\n`);

    pages.forEach((p, i) => {
      const pageNum = 3 + i * 3;
      const imgNum = 4 + i * 3;
      const contentNum = 5 + i * 3;

      offsets[pageNum] = pos;
      push(`${pageNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.widthPt} ${p.heightPt}] /Resources << /XObject << /Im0 ${imgNum} 0 R >> >> /Contents ${contentNum} 0 R >>\nendobj\n`);

      offsets[imgNum] = pos;
      push(`${imgNum} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.pixelWidth} /Height ${p.pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpegBytes.length} >>\nstream\n`);
      push(p.jpegBytes);
      push(`\nendstream\nendobj\n`);

      const content = `q\n${p.widthPt} 0 0 ${p.heightPt} 0 0 cm\n/Im0 Do\nQ`;
      offsets[contentNum] = pos;
      push(`${contentNum} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);
    });

    const totalObjs = 2 + n * 3;
    const xrefStart = pos;
    push(`xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`);
    for (let i = 1; i <= totalObjs; i++) {
      push(String(offsets[i]).padStart(10, '0') + ' 00000 n \n');
    }
    push(`trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

    const totalLen = chunks.reduce((a, c) => a + c.length, 0);
    const result = new Uint8Array(totalLen);
    let off = 0;
    chunks.forEach(c => { result.set(c, off); off += c.length; });
    return result;
  },

  canvasToJpegData(canvas) {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        const reader = new FileReader();
        reader.onload = () => resolve(new Uint8Array(reader.result));
        reader.readAsArrayBuffer(blob);
      }, 'image/jpeg', 0.92);
    });
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
      <div class="card">
        <h2>Laporan Presentasi Bulanan</h2>
        <p style="font-size:11.5px;color:#888;margin-top:0;">PDF format slide untuk presentasi ke owner/GM: orderan & timbangan masuk/keluar harian, plus perbandingan tahunan.</p>
        <button class="btn btn-gold btn-block" onclick="app.exportLaporanPresentasiPDF()">🖼️ Export Laporan Presentasi (PDF)</button>
      </div>
    `;
  },

  // ============================================
  // LAPORAN PRESENTASI BULANAN (PDF multi-slide)
  // ============================================
  _slideCanvas(w, h) {
    const canvas = document.createElement('canvas');
    canvas.width = w * 2;
    canvas.height = h * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    return { canvas, ctx };
  },

  _drawBarChart(ctx, opts) {
    const { x, y, w, h, labels, values, barColor, maxVal, valueFmt } = opts;
    const max = maxVal || Math.max(...values, 1) * 1.15;
    const n = values.length;
    const gap = 4;
    const barW = Math.max(2, (w - gap * (n - 1)) / n);
    const chartH = h - 30; // ruang buat label di bawah

    // gridlines
    ctx.strokeStyle = '#e5e5e5'; ctx.fillStyle = '#888'; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
    const steps = 5;
    for (let s = 0; s <= steps; s++) {
      const gy = y + chartH - (chartH * s / steps);
      ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke();
      ctx.fillText(Math.round(max * s / steps).toLocaleString('id-ID'), x - 6, gy + 3);
    }

    values.forEach((v, i) => {
      const bh = (v / max) * chartH;
      const bx = x + i * (barW + gap);
      const by = y + chartH - bh;
      ctx.fillStyle = barColor;
      ctx.fillRect(bx, by, barW, bh);
      if (barW > 10) {
        ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(String(v), bx + barW/2, by + 11);
      }
      // label tanggal di bawah
      ctx.save();
      ctx.translate(bx + barW/2, y + chartH + 12);
      ctx.rotate(-Math.PI/4);
      ctx.fillStyle = '#555'; ctx.font = '8.5px sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(labels[i], 0, 0);
      ctx.restore();
    });
  },

  _drawGroupedBarChart(ctx, opts) {
    const { x, y, w, h, labels, seriesA, seriesB, colorA, colorB } = opts;
    const max = Math.max(...seriesA, ...seriesB, 1) * 1.15;
    const n = labels.length;
    const groupGap = 10;
    const groupW = (w - groupGap * (n - 1)) / n;
    const barW = (groupW - 4) / 2;
    const chartH = h - 34;

    ctx.strokeStyle = '#e5e5e5'; ctx.fillStyle = '#888'; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
    const steps = 5;
    for (let s = 0; s <= steps; s++) {
      const gy = y + chartH - (chartH * s / steps);
      ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke();
      ctx.fillText(Math.round(max * s / steps).toLocaleString('id-ID'), x - 6, gy + 3);
    }

    labels.forEach((label, i) => {
      const gx = x + i * (groupW + groupGap);
      const vA = seriesA[i] || 0;
      const vB = seriesB[i] || 0;
      const bhA = (vA / max) * chartH;
      const bhB = (vB / max) * chartH;
      ctx.fillStyle = colorA;
      ctx.fillRect(gx, y + chartH - bhA, barW, bhA);
      ctx.fillStyle = colorB;
      ctx.fillRect(gx + barW + 4, y + chartH - bhB, barW, bhB);
      if (vA > 0) { ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(String(vA), gx + barW/2, y + chartH - bhA + 11); }
      if (vB > 0) { ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(String(vB), gx + barW + 4 + barW/2, y + chartH - bhB + 11); }
      ctx.fillStyle = '#555'; ctx.font = '9.5px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(label, gx + groupW/2, y + chartH + 16);
    });
  },

  async _drawSlideHeader(ctx, width, title) {
    ctx.fillStyle = '#f5f1e8';
    ctx.fillRect(0, 0, width, 90);
    const logoImg = await this.getLogoImg();
    if (logoImg) {
      const logoH = 50;
      const logoW = Math.round(logoH * logoImg.width / logoImg.height);
      ctx.drawImage(logoImg, 24, 20, logoW, logoH);
    }
    ctx.fillStyle = '#1a1a1a'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(title, width - 24, 52);
    ctx.strokeStyle = '#b8934a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 90); ctx.lineTo(width, 90); ctx.stroke();
  },

  async exportLaporanPresentasiPDF() {
    toast('Menyiapkan laporan presentasi...');
    const [y, m] = (state._laporanBulan || '').split('-').map(Number);
    const trxAll = loadJSON(STORAGE_KEYS.TRANSAKSI, []);
    const namaBulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'][m-1];
    const daysInMonth = new Date(y, m, 0).getDate();

    const width = 900, height = 560;
    const pages = [];

    // --- Slide 1: Cover ---
    {
      const { canvas, ctx } = this._slideCanvas(width, height);
      ctx.fillStyle = '#f5f1e8'; ctx.fillRect(0, 0, width, height);
      const logoImg = await this.getLogoImg();
      if (logoImg) {
        const logoH = 130;
        const logoW = Math.round(logoH * logoImg.width / logoImg.height);
        ctx.drawImage(logoImg, width/2 - logoW/2, 110, logoW, logoH);
      }
      ctx.textAlign = 'center';
      ctx.fillStyle = '#1a1a1a'; ctx.font = 'bold 40px sans-serif';
      ctx.fillText('LAPORAN', width/2, 300);
      ctx.fillText('NAUFAL LAUNDRY', width/2, 350);
      ctx.fillStyle = '#b8934a'; ctx.font = 'bold 24px sans-serif';
      ctx.fillText(`${namaBulan.toUpperCase()} ${y}`, width/2, 400);
      pages.push(canvas);
    }

    const buildDailySlide = async (title, subtitleFn, dataFn, barColor) => {
      const { canvas, ctx } = this._slideCanvas(width, height);
      ctx.fillStyle = '#fdfaf3'; ctx.fillRect(0, 0, width, height);
      await this._drawSlideHeader(ctx, width, title);

      const labels = [], values = [];
      let total = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const v = dataFn(d);
        labels.push(String(d).padStart(2,'0'));
        values.push(v);
        total += v;
      }
      const avg = Math.round(total / daysInMonth);

      ctx.fillStyle = '#3d6b47'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(subtitleFn(total, avg), width/2, 120);

      this._drawBarChart(ctx, {
        x: 60, y: 145, w: width - 110, h: height - 200,
        labels, values, barColor, maxVal: null,
      });
      return canvas;
    };

    // --- Slide 2: Jumlah Orderan Masuk ---
    pages.push(await buildDailySlide(
      'JUMLAH ORDERAN MASUK',
      (total, avg) => `Jumlah pelanggan masuk: ${total} Order  ·  Rata-rata: ${avg} Order/hari`,
      (d) => trxAll.filter(t => { const dt = new Date(t.tglMasuk); return dt.getFullYear()===y && dt.getMonth()+1===m && dt.getDate()===d; }).length,
      '#5b8c5e'
    ));

    // --- Slide 3: Jumlah Timbangan Masuk ---
    pages.push(await buildDailySlide(
      'JUMLAH TIMBANGAN MASUK',
      (total, avg) => `Jumlah timbangan masuk: ${total.toLocaleString('id-ID')} kg  ·  Rata-rata: ${avg} kg/hari`,
      (d) => {
        const trxHari = trxAll.filter(t => { const dt = new Date(t.tglMasuk); return dt.getFullYear()===y && dt.getMonth()+1===m && dt.getDate()===d; });
        let kg = 0;
        trxHari.forEach(t => t.items.forEach(it => { if (it.satuan === 'KG') kg += it.qty; }));
        return Math.round(kg);
      },
      '#5b8c5e'
    ));

    // --- Slide 4: Jumlah Orderan Keluar ---
    pages.push(await buildDailySlide(
      'JUMLAH ORDERAN KELUAR',
      (total, avg) => `Jumlah pelanggan keluar: ${total} Order  ·  Rata-rata: ${avg} Order/hari`,
      (d) => trxAll.filter(t => { if (!t.tglDiambil) return false; const dt = new Date(t.tglDiambil); return dt.getFullYear()===y && dt.getMonth()+1===m && dt.getDate()===d; }).length,
      '#4a7ba6'
    ));

    // --- Slide 5: Jumlah Timbangan Keluar ---
    pages.push(await buildDailySlide(
      'JUMLAH TIMBANGAN KELUAR',
      (total, avg) => `Jumlah timbangan keluar: ${total.toLocaleString('id-ID')} kg  ·  Rata-rata: ${avg} kg/hari`,
      (d) => {
        const trxHari = trxAll.filter(t => { if (!t.tglDiambil) return false; const dt = new Date(t.tglDiambil); return dt.getFullYear()===y && dt.getMonth()+1===m && dt.getDate()===d; });
        let kg = 0;
        trxHari.forEach(t => t.items.forEach(it => { if (it.satuan === 'KG') kg += it.qty; }));
        return Math.round(kg);
      },
      '#4a7ba6'
    ));

    // --- Slide 6: Perbandingan Tahunan (Pelanggan & Timbangan, Masuk vs Keluar per bulan) ---
    {
      const { canvas, ctx } = this._slideCanvas(width, height);
      ctx.fillStyle = '#fdfaf3'; ctx.fillRect(0, 0, width, height);
      await this._drawSlideHeader(ctx, width, `PERBANDINGAN TAHUNAN ${y}`);

      const namaBulanSingkat = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
      const pelangganMasuk = [], pelangganKeluar = [], kgMasuk = [], kgKeluar = [];
      for (let bulan = 1; bulan <= 12; bulan++) {
        const masukBulan = trxAll.filter(t => { const dt = new Date(t.tglMasuk); return dt.getFullYear()===y && dt.getMonth()+1===bulan; });
        const keluarBulan = trxAll.filter(t => { if (!t.tglDiambil) return false; const dt = new Date(t.tglDiambil); return dt.getFullYear()===y && dt.getMonth()+1===bulan; });
        pelangganMasuk.push(masukBulan.length);
        pelangganKeluar.push(keluarBulan.length);
        let kgM = 0, kgK = 0;
        masukBulan.forEach(t => t.items.forEach(it => { if (it.satuan==='KG') kgM += it.qty; }));
        keluarBulan.forEach(t => t.items.forEach(it => { if (it.satuan==='KG') kgK += it.qty; }));
        kgMasuk.push(Math.round(kgM));
        kgKeluar.push(Math.round(kgK));
      }

      ctx.fillStyle = '#3d6b47'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('PELANGGAN (Masuk vs Keluar)', 40, 118);
      this._drawGroupedBarChart(ctx, {
        x: 60, y: 130, w: width - 110, h: 165,
        labels: namaBulanSingkat, seriesA: pelangganMasuk, seriesB: pelangganKeluar,
        colorA: '#5b8c5e', colorB: '#a3c585',
      });

      ctx.fillStyle = '#3d6b47'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('TIMBANGAN KG (Masuk vs Keluar)', 40, 350);
      this._drawGroupedBarChart(ctx, {
        x: 60, y: 362, w: width - 110, h: 165,
        labels: namaBulanSingkat, seriesA: kgMasuk, seriesB: kgKeluar,
        colorA: '#4a7ba6', colorB: '#8fb8d9',
      });

      pages.push(canvas);
    }

    // --- Slide 7: Penutup ---
    {
      const { canvas, ctx } = this._slideCanvas(width, height);
      ctx.fillStyle = '#f5f1e8'; ctx.fillRect(0, 0, width, height);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#3d6b47'; ctx.font = 'bold 48px sans-serif';
      ctx.fillText('TERIMA KASIH', width/2, height/2);
      const logoImg = await this.getLogoImg();
      if (logoImg) {
        const logoH = 70;
        const logoW = Math.round(logoH * logoImg.width / logoImg.height);
        ctx.drawImage(logoImg, width/2 - logoW/2, height/2 + 40, logoW, logoH);
      }
      pages.push(canvas);
    }

    // Convert semua canvas jadi JPEG dan gabung ke 1 PDF
    const pdfPages = [];
    for (const canvas of pages) {
      const jpegBytes = await this.canvasToJpegData(canvas);
      pdfPages.push({ jpegBytes, widthPt: width, heightPt: height, pixelWidth: canvas.width, pixelHeight: canvas.height });
    }
    const pdfBytes = this.buildMultiImagePdf(pdfPages);
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Laporan_Presentasi_NaufalLaundry_${state._laporanBulan}.pdf`;
    link.click();
    toast('Laporan presentasi PDF tersimpan');
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

    const bayarBulan = { Tunai: 0, QRIS: 0, Transfer: 0, 'Belum Bayar': 0 };
    trxBulan.forEach(t => {
      if (t.statusBayar === 'Lunas' && t.metodeBayar) bayarBulan[t.metodeBayar] += t.total;
      else bayarBulan['Belum Bayar'] += t.total;
    });

    const rekapRows = [
      ['Bulan', state._laporanBulan],
      ['Total Omzet', trxBulan.reduce((a,b)=>a+b.total,0)],
      ['Jumlah Transaksi', trxBulan.length],
      [],
      ['Tunai', bayarBulan.Tunai],
      ['QRIS', bayarBulan.QRIS],
      ['Transfer', bayarBulan.Transfer],
      ['Belum Bayar', bayarBulan['Belum Bayar']],
    ];

    const kinerjaRows = [['Kasir', 'Jumlah Transaksi', 'Total Omzet']];
    Object.entries(perKasir).forEach(([k,d]) => {
      kinerjaRows.push([k, d.jumlahTransaksi, d.totalOmzet]);
    });

    const dataRows = [['Nota', 'Tanggal Masuk', 'Pelanggan', 'Kasir', 'Total', 'Status Bayar', 'Metode Bayar', 'Status Pesanan']];
    trxBulan.forEach(t => {
      dataRows.push([t.nota, fmtTgl(t.tglMasuk), t.pelanggan.nama, t.kasir, t.total, t.statusBayar, t.metodeBayar || '-', t.statusPesanan]);
    });

    const sheetsData = [
      { name: 'Rekap Bulanan', rows: rekapRows },
      { name: 'Kinerja Kasir', rows: kinerjaRows },
      { name: 'Data Transaksi', rows: dataRows },
    ];

    const xlsxBytes = this.buildXlsx(sheetsData);
    const blob = new Blob([xlsxBytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Laporan_NaufalLaundry_${state._laporanBulan}.xlsx`;
    link.click();
    toast('Excel berhasil di-export');
  },

  // ============================================
  // XLSX BUILDER (format OOXML asli, tanpa dependency eksternal)
  // ============================================
  _crc32(buf) {
    let table = this.__crc32Table;
    if (!table) {
      table = this.__crc32Table = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        table[n] = c >>> 0;
      }
    }
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  },

  _dosDateTime(date) {
    const dosTime = ((date.getHours() & 0x1F) << 11) | ((date.getMinutes() & 0x3F) << 5) | ((date.getSeconds() >> 1) & 0x1F);
    const dosDate = (((date.getFullYear() - 1980) & 0x7F) << 9) | (((date.getMonth() + 1) & 0xF) << 5) | (date.getDate() & 0x1F);
    return { dosTime, dosDate };
  },

  buildZip(files) {
    const encoder = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    const { dosTime, dosDate } = this._dosDateTime(new Date());

    files.forEach(f => {
      const nameBytes = encoder.encode(f.name);
      const content = typeof f.content === 'string' ? encoder.encode(f.content) : f.content;
      const crc = this._crc32(content);
      const size = content.length;

      const localHeader = new Uint8Array(30 + nameBytes.length);
      const lv = new DataView(localHeader.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0, true);
      lv.setUint16(8, 0, true);
      lv.setUint16(10, dosTime, true);
      lv.setUint16(12, dosDate, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, size, true);
      lv.setUint32(22, size, true);
      lv.setUint16(26, nameBytes.length, true);
      lv.setUint16(28, 0, true);
      localHeader.set(nameBytes, 30);
      localParts.push(localHeader, content);

      const centralHeader = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(centralHeader.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, dosTime, true);
      cv.setUint16(14, dosDate, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, size, true);
      cv.setUint32(24, size, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      centralHeader.set(nameBytes, 46);
      centralParts.push(centralHeader);
      offset += localHeader.length + content.length;
    });

    const centralStart = offset;
    let centralSize = 0;
    centralParts.forEach(c => centralSize += c.length);

    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, centralStart, true);
    ev.setUint16(20, 0, true);

    const allParts = [...localParts, ...centralParts, eocd];
    const totalLen = allParts.reduce((a, p) => a + p.length, 0);
    const result = new Uint8Array(totalLen);
    let pos = 0;
    allParts.forEach(p => { result.set(p, pos); pos += p.length; });
    return result;
  },

  _xlsxColLetter(n) {
    let s = '';
    while (n > 0) {
      const rem = (n - 1) % 26;
      s = String.fromCharCode(65 + rem) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  },

  _escXmlAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  },

  // sheetsData: [{ name, rows: [[val, ...], ...] }], val string atau number
  buildXlsx(sheetsData) {
    const files = [];
    const escXml = this._escXmlAttr;

    files.push({ name: '[Content_Types].xml', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${sheetsData.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n')}
</Types>` });

    files.push({ name: '_rels/.rels', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>` });

    files.push({ name: 'xl/_rels/workbook.xml.rels', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheetsData.map((s, i) => `<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('\n')}
</Relationships>` });

    files.push({ name: 'xl/workbook.xml', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>
${sheetsData.map((s, i) => `<sheet name="${escXml(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('\n')}
</sheets>
</workbook>` });

    sheetsData.forEach((s, i) => {
      let rowsXml = '';
      s.rows.forEach((row, rIdx) => {
        const rowNum = rIdx + 1;
        let cellsXml = '';
        row.forEach((val, cIdx) => {
          const cellRef = this._xlsxColLetter(cIdx + 1) + rowNum;
          if (typeof val === 'number') {
            cellsXml += `<c r="${cellRef}"><v>${val}</v></c>`;
          } else if (val != null && val !== '') {
            cellsXml += `<c r="${cellRef}" t="inlineStr"><is><t xml:space="preserve">${escXml(val)}</t></is></c>`;
          }
        });
        rowsXml += `<row r="${rowNum}">${cellsXml}</row>`;
      });
      files.push({ name: `xl/worksheets/sheet${i+1}.xml`, content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>${rowsXml}</sheetData>
</worksheet>` });
    });

    return this.buildZip(files);
  },

};

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', () => app.init());

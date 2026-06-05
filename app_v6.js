console.log('App Version: 6.0 (Admin Password Updated)');
const COLLECTION = 'sultanahmet_raporlar';
const STOK_COLLECTION = 'sultanahmet_stok';
const PRODUCT_COLLECTION = 'sultanahmet_products';
const USER_COLLECTION = 'sultanahmet_users';
const PERSONEL_MASTER_COL = 'sultanahmet_personel_master';
const PERSONEL_RECORD_COL = 'sultanahmet_personel_hareket';
const RESERV_COLLECTION = 'sultanahmet_rezervasyon';
const RECIPE_COLLECTION = 'sultanahmet_receteler';
const URETIM_COLLECTION = 'sultanahmet_uretim';
const SALES_COLLECTION        = 'sultanahmet_satis';
const CUSTOMER_COLLECTION     = 'sultanahmet_customers';
const TEDARIKCI_COLLECTION    = 'sultanahmet_tedarikciler';
const FATURA_COLLECTION       = 'sultanahmet_faturalar';
const FATURA_ODEME_COLLECTION = 'sultanahmet_fatura_odemeler';
const FIYAT_GECMIS_COLLECTION = 'sultanahmet_fiyat_gecmisi';

let chartInstance = null;
let allData = [];
let allStokData = [];
let allProducts = {};
let allPersonelMaster = [];
let allPersonelRecords = [];
let allReservations = [];
let allRecipes = [];
let allUretim = [];
let allSales = [];
let allCustomers = [];
let allStokItems = [];
let allTedarikciler = [];
let allFaturalar    = [];
let allFaturaOdemeler = [];
let currentUser = null;
let html5QrCode = null;

// --- UTILS ---
const formatCurrency = (amount) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
const formatDate = (dateString) => {
    if (!dateString) return '';
    const parts = dateString.split('-');
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
};

// ── AUTH LOGIC ────────────────────────────────────────────────
const checkAuth = () => {
    const saved = localStorage.getItem('sultanahmet_user');
    if (saved) {
        currentUser = JSON.parse(saved);
        document.getElementById('loginOverlay').classList.add('hidden');
        updateUIVisibility();
        initApp();
    } else {
        document.getElementById('loginOverlay').classList.remove('hidden');
    }
};

const updateUIVisibility = () => {
    try {
        const isAdmin = currentUser && currentUser.role === 'admin';
        
        // Admin-only elements
        document.querySelectorAll('.admin-only').forEach(el => {
            el.classList.toggle('hidden', !isAdmin);
        });

        // Permission-based panels
        const canSeeMali = isAdmin || (currentUser && currentUser.perms && currentUser.perms.mali);
        const canSeeStok = isAdmin || (currentUser && currentUser.perms && currentUser.perms.stok);
        const canSeePersonel = isAdmin || (currentUser && currentUser.perms && currentUser.perms.personel);
        const canSeeRez = isAdmin || (currentUser && currentUser.perms && currentUser.perms.rezervasyon);
        const canSeeUretim = isAdmin || (currentUser && currentUser.perms && currentUser.perms.uretim);
        const canSeeFatura = isAdmin || (currentUser && currentUser.perms && currentUser.perms.fatura);
        const canSeeSatis = isAdmin || (currentUser && currentUser.perms && currentUser.perms.satis);

        document.getElementById('toggleMaliAnaliz')?.parentElement?.classList.toggle('hidden', !canSeeMali);
        document.getElementById('toggleDepoStok')?.parentElement?.classList.toggle('hidden', !canSeeStok);
        
        const togglePersonel = document.getElementById('togglePersonel');
        if(togglePersonel) togglePersonel.parentElement.classList.toggle('hidden', !canSeePersonel);

        const toggleRez = document.getElementById('toggleRezervasyon');
        if(toggleRez) toggleRez.parentElement.classList.toggle('hidden', !canSeeRez);

        const toggleUretim = document.getElementById('toggleUretim');
        if(toggleUretim) toggleUretim.parentElement.classList.toggle('hidden', !canSeeUretim);

        const toggleFatura = document.getElementById('toggleFatura');
        if(toggleFatura) toggleFatura.parentElement.classList.toggle('hidden', !canSeeFatura);

        const toggleSatis = document.getElementById('toggleSatis');
        if(toggleSatis) toggleSatis.parentElement.classList.toggle('hidden', !canSeeSatis);

        // Forms should be hidden for non-admins
        document.getElementById('dataForm')?.classList.toggle('hidden', !isAdmin);
        document.getElementById('stokForm')?.classList.toggle('hidden', !isAdmin);
        document.getElementById('newPersonelForm')?.parentElement?.parentElement?.classList.toggle('hidden', !isAdmin);
        document.getElementById('rezervForm')?.parentElement?.classList.toggle('hidden', !canSeeRez);
        document.getElementById('recipeForm')?.parentElement?.classList.toggle('hidden', !isAdmin);
        document.getElementById('dailyUretimForm')?.parentElement?.classList.toggle('hidden', !isAdmin);
        
        // Hide help text for non-admins
        document.querySelectorAll('.badge-hint').forEach(el => el.classList.toggle('hidden', !isAdmin));
    } catch (err) {
        console.error('UI Visibility Update Error:', err);
    }
};

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('Login attempt detected...');
    const username = document.getElementById('loginUser').value.trim().toLowerCase();
    const password = document.getElementById('loginPass').value.trim();
    const errorEl = document.getElementById('loginError');
    errorEl.textContent = 'Bağlanılıyor...';

    try {
        let data;
        
        // Acil durum kurtarma (admin / 227029)
        if (username === 'admin' && password === '227029') {
            data = { role: 'admin', perms: { mali: true, stok: true, personel: true }, password: '227029' };
            try { 
                await db.collection(USER_COLLECTION).doc('admin').set(data, { merge: true }); 
            } catch(e) { 
                console.error('Firebase Error:', e); 
            }
        } else {
            const userDoc = await db.collection(USER_COLLECTION).doc(username).get();
            if (!userDoc.exists) {
                errorEl.textContent = 'Kullanıcı bulunamadı!';
                return;
            }
            data = userDoc.data();
            if (data.password !== password) {
                errorEl.textContent = 'Hatalı şifre!';
                return;
            }
        }

        currentUser = { username, role: data.role, perms: data.perms || { mali: true, stok: true, personel: true } };
        localStorage.setItem('sultanahmet_user', JSON.stringify(currentUser));
        document.getElementById('loginOverlay').classList.add('hidden');
        updateUIVisibility();
        initApp();
        showToast(`Hoş geldiniz, ${username}!`);
    } catch (err) {
        console.error(err);
        errorEl.textContent = 'Giriş hatası!';
    }
});

document.getElementById('btnLogout').addEventListener('click', () => {
    localStorage.removeItem('sultanahmet_user');
    location.reload();
});

// Admin Settings
document.getElementById('btnSettings').addEventListener('click', async () => {
    toggleModal('settingsModal', true);
    renderUserManagement();
});

const renderUserManagement = async () => {
    const body = document.getElementById('userManagementBody');
    body.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:1rem;color:var(--text-muted)"><i class="fa-solid fa-spinner fa-spin"></i> Yükleniyor...</td></tr>';
    
    const snap = await db.collection(USER_COLLECTION).get();
    body.innerHTML = '';
    
    if (snap.empty) {
        body.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-muted)">Henüz kullanıcı yok.</td></tr>';
        return;
    }

    snap.docs.forEach(doc => {
        const u = doc.data();
        if (u.role === 'admin') return; // Admin satırını gizle

        const p = u.perms || {};
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:700">${doc.id}</td>
            <td><input type="text" placeholder="Yeni şifre" id="pass_${doc.id}" style="width:110px; padding:5px 8px; background:rgba(0,0,0,0.3); border:1px solid var(--border-color); border-radius:6px; color:white; font-size:0.8rem;"></td>
            <td style="text-align:center"><input type="checkbox" id="perm_mali_${doc.id}"       ${p.mali        ? 'checked' : ''}></td>
            <td style="text-align:center"><input type="checkbox" id="perm_stok_${doc.id}"       ${p.stok        ? 'checked' : ''}></td>
            <td style="text-align:center"><input type="checkbox" id="perm_personel_${doc.id}"   ${p.personel    ? 'checked' : ''}></td>
            <td style="text-align:center"><input type="checkbox" id="perm_rez_${doc.id}"        ${p.rezervasyon ? 'checked' : ''}></td>
            <td style="text-align:center"><input type="checkbox" id="perm_uretim_${doc.id}"     ${p.uretim      ? 'checked' : ''}></td>
            <td style="text-align:center"><input type="checkbox" id="perm_satis_${doc.id}"      ${p.satis       ? 'checked' : ''}></td>
            <td style="text-align:center"><input type="checkbox" id="perm_fatura_${doc.id}"     ${p.fatura      ? 'checked' : ''}></td>
            <td style="display:flex;gap:0.4rem;align-items:center;">
                <button class="btn btn-success btn-sm" style="padding:0.3rem 0.7rem; font-size:0.75rem;" onclick="updateUser('${doc.id}')">
                    <i class="fa-solid fa-save"></i> Kaydet
                </button>
                <button class="btn btn-danger btn-sm" style="padding:0.3rem 0.5rem; font-size:0.75rem;" onclick="deleteUser('${doc.id}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        body.appendChild(tr);
    });
};

window.toggleAddUserForm = () => {
    const panel = document.getElementById('addUserFormPanel');
    const isHidden = panel.style.display === 'none' || panel.style.display === '';
    panel.style.display = isHidden ? 'block' : 'none';
    if (isHidden) {
        document.getElementById('newUsername').focus();
    }
};

window.createUser = async (e) => {
    e.preventDefault();
    const username = document.getElementById('newUsername').value.trim().toLowerCase();
    const password = document.getElementById('newUserPassword').value.trim();

    if (!username || !password) { showToast('Kullanıcı adı ve şifre zorunlu!', 'error'); return; }
    if (username === 'admin') { showToast('"admin" kullanıcı adı kullanılamaz!', 'error'); return; }

    // Var mı kontrol et
    try {
        const existing = await db.collection(USER_COLLECTION).doc(username).get();
        if (existing.exists) { showToast(`"${username}" zaten mevcut!`, 'error'); return; }
    } catch(e) {}

    const perms = {
        mali:        document.getElementById('newPerm_mali').checked,
        stok:        document.getElementById('newPerm_stok').checked,
        personel:    document.getElementById('newPerm_personel').checked,
        rezervasyon: document.getElementById('newPerm_rezervasyon').checked,
        uretim:      document.getElementById('newPerm_uretim').checked,
        satis:       document.getElementById('newPerm_satis').checked,
        fatura:      document.getElementById('newPerm_fatura').checked,
    };

    try {
        await db.collection(USER_COLLECTION).doc(username).set({
            role: 'viewer',
            password,
            perms,
            createdAt: new Date().toISOString()
        });
        showToast(`✅ "${username}" başarıyla oluşturuldu.`);
        document.getElementById('addUserForm').reset();
        document.getElementById('addUserFormPanel').style.display = 'none';
        renderUserManagement();
    } catch (err) {
        console.error(err);
        showToast('Kullanıcı oluşturma hatası!', 'error');
    }
};

window.updateUser = async (username) => {
    const newPass    = document.getElementById(`pass_${username}`).value;
    const permMali   = document.getElementById(`perm_mali_${username}`).checked;
    const permStok   = document.getElementById(`perm_stok_${username}`).checked;
    const permPersonel = document.getElementById(`perm_personel_${username}`).checked;
    const permRez    = document.getElementById(`perm_rez_${username}`).checked;
    const permUretim = document.getElementById(`perm_uretim_${username}`).checked;
    const permSatis  = document.getElementById(`perm_satis_${username}`)?.checked || false;
    const permFatura = document.getElementById(`perm_fatura_${username}`)?.checked || false;

    const updateData = {
        perms: { mali: permMali, stok: permStok, personel: permPersonel, rezervasyon: permRez, uretim: permUretim, satis: permSatis, fatura: permFatura }
    };
    if (newPass) updateData.password = newPass;

    try {
        await db.collection(USER_COLLECTION).doc(username).update(updateData);
        showToast(`✅ ${username} güncellendi.`);
        renderUserManagement();
    } catch (e) {
        showToast('Güncelleme hatası!', 'error');
    }
};

window.deleteUser = async (username) => {
    if (!confirm(`"${username}" kullanıcısını silmek istediğinize emin misiniz?`)) return;
    try {
        await db.collection(USER_COLLECTION).doc(username).delete();
        showToast(`🗑️ "${username}" silindi.`);
        renderUserManagement();
    } catch (e) {
        showToast('Silme hatası!', 'error');
    }
};


const initApp = () => {
    // Raporlar
    db.collection(COLLECTION).orderBy('date', 'asc').onSnapshot(snapshot => {
        allData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderAll(allData);
    });

    // Stoklar
    db.collection(STOK_COLLECTION).orderBy('date', 'desc').onSnapshot(snapshot => {
        allStokData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        processStokData();
    });

    // Ürün Fiyatları
    db.collection(PRODUCT_COLLECTION).onSnapshot(snapshot => {
        allProducts = {};
        const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        prods.sort((a,b) => a.name.localeCompare(b.name, 'tr'));
        const datalist = document.getElementById('productList');
        if (datalist) {
            datalist.innerHTML = '';
            prods.forEach(p => {
                allProducts[p.id] = p;
                const opt = document.createElement('option');
                opt.value = p.name;
                datalist.appendChild(opt);
            });
        }
        processStokData();
    });

    // Barcode Listener
    document.getElementById('inputStokBarcode')?.addEventListener('input', (e) => {
        const barcode = e.target.value.trim();
        if (!barcode) return;

        // Find product by barcode
        const product = Object.values(allProducts).find(p => p.barcode === barcode);
        if (product) {
            document.getElementById('inputStokProduct').value = product.name;
            document.getElementById('inputStokUnit').value = product.unit || '';
            if (product.price) document.getElementById('inputStokPrice').value = product.price;
            showToast(`Ürün bulundu: ${product.name}`);
        }
    });

    // Scanner Controls
    const startScanner = async (targetInputId) => {
        // Check for secure context (HTTPS) - required for camera
        if (!window.isSecureContext && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
            showToast('Kamera erişimi için HTTPS (güvenli bağlantı) gereklidir!', 'error');
            return;
        }

        const container = document.getElementById('barcodeScannerContainer');
        container.classList.remove('hidden');
        
        try {
            if (!html5QrCode) {
                html5QrCode = new Html5Qrcode("scannerReader");
            }

            // Eğer zaten çalışıyorsa önce durdur
            if (html5QrCode.isScanning) {
                await html5QrCode.stop();
            }

            const config = { fps: 15, qrbox: { width: 250, height: 250 } };

            await html5QrCode.start(
                { facingMode: "environment" }, 
                config,
                (decodedText) => {
                    const targetInput = document.getElementById(targetInputId);
                    if (targetInput) {
                        targetInput.value = decodedText;
                        targetInput.dispatchEvent(new Event('input'));
                    }
                    stopScanner();
                    showToast('Barkod başarıyla okundu.');
                },
                (errorMessage) => {
                    // console.log(errorMessage);
                }
            );
        } catch (err) {
            console.error("Camera Start Error:", err);
            // Daha detaylı hata mesajı
            if (err.name === 'NotAllowedError') {
                showToast('Kamera izni reddedildi!', 'error');
            } else if (err.name === 'NotFoundError') {
                showToast('Kamera bulunamadı!', 'error');
            } else {
                showToast('Kamera başlatılamadı! Lütfen HTTPS bağlantısını ve izinleri kontrol edin.', 'error');
            }
            document.getElementById('barcodeScannerContainer').classList.add('hidden');
        }
    };

    document.getElementById('btnScanBarcode')?.addEventListener('click', () => startScanner('inputStokBarcode'));
    document.getElementById('btnScanEditBarcode')?.addEventListener('click', () => startScanner('editProductBarcode'));

    window.stopScanner = async () => {
        try {
            if (html5QrCode && html5QrCode.isScanning) {
                await html5QrCode.stop();
            }
        } catch (e) {
            console.error("Stop Error:", e);
        }
        document.getElementById('barcodeScannerContainer').classList.add('hidden');
    };

    document.getElementById('btnCloseScanner')?.addEventListener('click', stopScanner);

    // Personel Master
    db.collection(PERSONEL_MASTER_COL).onSnapshot(snapshot => {
        allPersonelMaster = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        populatePersonelSelects();
        processPersonelData();
    });

    // Personel Hareketleri
    db.collection(PERSONEL_RECORD_COL).orderBy('date', 'desc').onSnapshot(snapshot => {
        allPersonelRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        processPersonelData();
    });

    // Rezervasyon ve Üretim Modülleri
    initReservations();
    initUretim();
};

// Uygulama başlatma
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAuth);
} else {
    checkAuth();
}

// 📦 FIREBASE: SAVE 📦─────────────────────────────────────────────
const saveRecord = async (rec) => {
    try {
        await db.collection(COLLECTION).doc(rec.id).set(rec, { merge: true });
        showToast('Kayıt başarıyla güncellendi ✓');
    } catch (e) {
        console.error(e);
        showToast('Kayıt sırasında hata oluştu!', 'error');
    }
};

const saveStokRecord = async (rec) => {
    try {
        await db.collection(STOK_COLLECTION).doc(rec.id).set(rec, { merge: true });
        showToast('Stok çıkışı başarıyla kaydedildi ✓');
    } catch (e) {
        console.error(e);
        showToast('Stok kaydı sırasında hata!', 'error');
    }
};

// ── FIREBASE: DELETE ───────────────────────────────────────────
window.deleteRecord = async (id) => {
    if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;
    try {
        await db.collection(COLLECTION).doc(id).delete();
        showToast('Kayıt silindi.');
    } catch (e) {
        showToast('Silme sırasında hata!', 'error');
    }
};

window.editRecord = (id) => {
    const item = allData.find(r => r.id === id);
    if (!item) return;

    document.getElementById('inputDate').value = item.date || '';
    document.getElementById('inputRobotEft').value = item.robotEft || '';
    document.getElementById('inputMuhasebeEft').value = item.muhEft || '';
    document.getElementById('inputKasaNakit').value = item.kasaNakit || '';
    document.getElementById('inputRobotNakit').value = item.robotNakit || '';
    document.getElementById('inputMuhasebeNakit').value = item.muhNakit || '';
    document.getElementById('inputRobotKredi').value = item.robotKredi || '';
    document.getElementById('inputMuhasebeKredi').value = item.muhKredi || '';
    document.getElementById('inputYemek').value = item.yemek || '';
    document.getElementById('inputKasaYemek').value = item.kasaYemek || '';
    document.getElementById('inputCari').value = item.cari || '';

    // Scroll to form
    document.getElementById('dataForm').scrollIntoView({ behavior: 'smooth' });
    
    // Recalculate read-only calculated fields
    recalcForm();
    
    showToast('Veriler düzenleme formuna yüklendi. Değişiklikleri yapıp "Kaydet"e basın.');
};

window.deleteStokRecord = async (id) => {
    if (!confirm('Bu stok kaydını silmek istediğinize emin misiniz?')) return;
    try {
        await db.collection(STOK_COLLECTION).doc(id).delete();
        showToast('Stok kaydı silindi.');
    } catch (e) {
        showToast('Stok silme sırasında hata!', 'error');
    }
};

// ── FIREBASE: CLEAR ALL ────────────────────────────────────────
document.getElementById('btnClearData').addEventListener('click', async () => {
    if (!confirm('TÜM verileri (rapor, stok, ürünler) silmek istediğinize emin misiniz? Bu işlem geri alınamaz!')) return;
    try {
        const batch = db.batch();
        const snap = await db.collection(COLLECTION).get();
        snap.docs.forEach(doc => batch.delete(doc.ref));
        
        const stokSnap = await db.collection(STOK_COLLECTION).get();
        stokSnap.docs.forEach(doc => batch.delete(doc.ref));

        const prodSnap = await db.collection(PRODUCT_COLLECTION).get();
        prodSnap.docs.forEach(doc => batch.delete(doc.ref));

        await batch.commit();
        showToast('Tüm veriler silindi.');
    } catch (e) {
        showToast('Silme hatası!', 'error');
    }
});

// ── RENDER ─────────────────────────────────────────────────────
let activeFilters = {};

const applyFilters = () => {
    let filtered = [...allData];
    
    // Tarih aralığı filtrelemesi
    const dateStart = document.getElementById('filterDateStart')?.value || '';
    const dateEnd = document.getElementById('filterDateEnd')?.value || '';
    
    if (dateStart !== '') {
        filtered = filtered.filter(item => item.date >= dateStart);
    }
    if (dateEnd !== '') {
        filtered = filtered.filter(item => item.date <= dateEnd);
    }
    
    Object.keys(activeFilters).forEach(key => {
        const val = activeFilters[key];
        if (val === '') return;
        
        filtered = filtered.filter(item => {
            if (key === 'date') return true; // Tarih zaten aralık filtrelemesinde yapıldı
            
            let numVal = 0;
            const rEft = item.robotEft||0, mEft = item.muhEft||0;
            const kNak = item.kasaNakit||0, rNak = item.robotNakit||0, mNak = item.muhNakit||0;
            const rKre = item.robotKredi||0, mKre = item.muhKredi||0;
            const rYem = item.yemek||0, kYem = item.kasaYemek||0;
            const cari = item.cari||0;
            
            if (key === 'robotEft') numVal = rEft;
            else if (key === 'muhEft') numVal = mEft;
            else if (key === 'eftFark') numVal = mEft - rEft;
            else if (key === 'kasaNakit') numVal = kNak;
            else if (key === 'robotNakit') numVal = rNak;
            else if (key === 'muhNakit') numVal = mNak;
            else if (key === 'posRobFark') numVal = kNak - rNak;
            else if (key === 'robotKredi') numVal = rKre;
            else if (key === 'muhKredi') numVal = mKre;
            else if (key === 'kreFark') numVal = mKre - rKre;
            else if (key === 'yemek') numVal = rYem;
            else if (key === 'kasaYemek') numVal = kYem;
            else if (key === 'yemekFark') numVal = kYem - rYem;
            else if (key === 'robTop') numVal = rEft + rNak + rKre + rYem + cari;
            else if (key === 'muhTop') numVal = mEft + mNak + mKre + kYem;
            else if (key === 'kasRobFark') numVal = kNak - rNak;
            else if (key === 'nakFarkTop') numVal = (mEft - rEft) + (kNak - rNak) + (mKre - rKre) + (kYem - rYem);
            else if (key === 'cari') numVal = cari;
            
            const numStr = numVal.toFixed(2);
            const numRawStr = numVal.toString();
            return numStr.includes(val) || numRawStr.includes(val);
        });
    });
    
    updateTable(filtered);
    
    const hasDateFilter = dateStart !== '' || dateEnd !== '';
    const hasActiveFilters = Object.values(activeFilters).some(v => v !== '');
    
    if (hasDateFilter || hasActiveFilters) {
        document.getElementById('recordCount').textContent = `${filtered.length} / ${allData.length} Kayıt`;
    } else {
        document.getElementById('recordCount').textContent = `${allData.length} Kayıt`;
    }
};

// Bind table filters input/change events
const onFilterChange = (e) => {
    if (e.target.classList.contains('table-filter')) {
        const col = e.target.getAttribute('data-col');
        activeFilters[col] = e.target.value.trim();
        applyFilters();
    } else if (e.target.classList.contains('table-filter-date')) {
        applyFilters();
    }
};
document.addEventListener('input', onFilterChange);
document.addEventListener('change', onFilterChange);

const renderAll = (data) => {
    updateKPIs(data);
    applyFilters();
    updateChart(data);
};

const updateKPIs = (data) => {
    let totalRobot = 0, totalKredi = 0, totalNakit = 0, totalMobil = 0;
    data.forEach(d => {
        totalRobot  += (d.robotEft||0) + (d.robotNakit||0) + (d.robotKredi||0) + (d.yemek||0) + (d.cari||0);
        totalKredi  += (d.robotKredi||0);
        totalNakit  += (d.robotNakit||0);
        totalMobil  += (d.robotEft||0);
    });
    
    let totalRez = 0;
    if (typeof allReservations !== 'undefined' && Array.isArray(allReservations)) {
        allReservations.forEach(r => {
            totalRez += (r.count || 0) * (r.price || 0);
        });
    }

    const kRatio = totalRobot > 0 ? (totalKredi / totalRobot) * 100 : 0;
    const nRatio = totalRobot > 0 ? (totalNakit / totalRobot) * 100 : 0;
    const mRatio = totalRobot > 0 ? (totalMobil / totalRobot) * 100 : 0;

    document.getElementById('kpiTotal').textContent       = formatCurrency(totalRobot) + ' TL';
    if (document.getElementById('kpiRezTotal')) {
        document.getElementById('kpiRezTotal').textContent = formatCurrency(totalRez) + ' TL';
    }
    document.getElementById('kpiKrediRatio').textContent  = `%${kRatio.toFixed(1)}`;
    document.getElementById('kpiNakitRatio').textContent  = `%${nRatio.toFixed(1)}`;
    document.getElementById('kpiMuhasebeRatio').textContent = `%${mRatio.toFixed(1)}`;
    document.getElementById('kpiDays').textContent         = data.length.toString();
};

const updateTable = (data) => {
    const body       = document.getElementById('tableBody');
    const emptyState = document.getElementById('emptyState');
    const table      = document.getElementById('dataTable');
    body.innerHTML   = '';

    if (data.length === 0) {
        emptyState.classList.remove('hidden');
        table.classList.add('hidden');
        return;
    }
    emptyState.classList.add('hidden');
    table.classList.remove('hidden');

    const colorize = (val) => val === 0 ? '' : (val > 0 ? 'color:#10b981' : 'color:#ef4444');

    [...data].reverse().forEach(item => {
        const rEft = item.robotEft||0, mEft = item.muhEft||0;
        const kNak = item.kasaNakit||0, rNak = item.robotNakit||0, mNak = item.muhNakit||0;
        const rKre = item.robotKredi||0, mKre = item.muhKredi||0;
        const rYem = item.yemek||0, kYem = item.kasaYemek||0;

        const eftFark      = mEft - rEft;
        const posRobFark   = kNak - rNak;
        const kreFark      = mKre - rKre;
        const yemekFark    = kYem - rYem;

        const robTop       = rEft + rNak + rKre + rYem + (item.cari||0);
        const muhTop       = mEft + mNak + mKre + kYem;
        const kasRobFark   = kNak - rNak;
        const nakFarkTop   = eftFark + posRobFark + kreFark + yemekFark;

        const isAdmin = currentUser && currentUser.role === 'admin';
        let actionHtml = '-';
        if (isAdmin) {
            actionHtml = `
                <button class="btn-icon" onclick="editRecord('${item.id}')" title="Düzenle" style="color:var(--primary); margin-right:8px;">
                    <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button class="btn-icon" onclick="deleteRecord('${item.id}')" title="Sil" style="color:var(--danger);">
                    <i class="fa-solid fa-trash"></i>
                </button>
            `;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="white-space:nowrap;text-align:left">${formatDate(item.date)}</td>
            <td class="currency">${formatCurrency(rEft)}</td>
            <td class="currency">${formatCurrency(mEft)}</td>
            <td class="currency fark-col" style="${colorize(eftFark)}">${formatCurrency(eftFark)}</td>
            <td class="currency">${formatCurrency(kNak)}</td>
            <td class="currency">${formatCurrency(rNak)}</td>
            <td class="currency">${formatCurrency(mNak)}</td>
            <td class="currency fark-col" style="${colorize(posRobFark)}">${formatCurrency(posRobFark)}</td>
            <td class="currency">${formatCurrency(rKre)}</td>
            <td class="currency">${formatCurrency(mKre)}</td>
            <td class="currency fark-col" style="${colorize(kreFark)}">${formatCurrency(kreFark)}</td>
            <td class="currency">${formatCurrency(rYem)}</td>
            <td class="currency">${formatCurrency(kYem)}</td>
            <td class="currency fark-col" style="${colorize(yemekFark)}">${formatCurrency(yemekFark)}</td>
            <td class="currency toplam-col">${formatCurrency(robTop)}</td>
            <td class="currency toplam-col">${formatCurrency(muhTop)}</td>
            <td class="currency fark-col" style="${colorize(kasRobFark)}">${formatCurrency(kasRobFark)}</td>
            <td class="currency toplam-col" style="${colorize(nakFarkTop)};font-weight:700">${formatCurrency(nakFarkTop)}</td>
            <td class="currency">${formatCurrency(item.cari)}</td>
            <td style="white-space:nowrap; text-align:center;">${actionHtml}</td>
        `;
        body.appendChild(tr);
    });
};

const processStokData = () => {
    // 1. Hesapla
    const status = {}; // { slug: { name, price, count: 0, in: 0, out: 0, balance: 0, lastCountDate: '' } }

    // Önce ürünleri baz al
    Object.keys(allProducts).forEach(slug => {
        status[slug] = { 
            name: allProducts[slug].name, 
            price: allProducts[slug].price || 0,
            unit: allProducts[slug].unit || '',
            isActive: allProducts[slug].isActive !== false, // default true
            count: 0, in: 0, out: 0, balance: 0, lastCountDate: '0000-00-00'
        };
    });

    // Hareketleri işle (Tarihe göre sıralı işlemek önemli)
    const sortedMoves = [...allStokData].sort((a,b) => a.date.localeCompare(b.date));
    
    // Fiyat havuzu (Ağırlıklı Ortalama için)
    const pricePool = {}; // { slug: { totalCost: 0, totalQty: 0 } }

    sortedMoves.forEach(m => {
        const pName = m.productName || m.product;
        if (!pName) return;
        
        const slug = pName.toUpperCase('tr-TR').replace(/\s+/g, '');
        if (!status[slug]) {
             status[slug] = { 
                 name: pName, price: 0, unit: '', 
                 isActive: true,
                 count: 0, in: 0, out: 0, balance: 0, lastCountDate: '0000-00-00' 
             };
        }
        if (!pricePool[slug]) pricePool[slug] = { totalCost: 0, totalQty: 0 };

        if (m.type === 'COUNT') {
            status[slug].count = m.amount;
            status[slug].balance = m.amount;
            status[slug].in = 0;
            status[slug].out = 0;
            status[slug].lastCountDate = m.date;
            // Sayım sırasında fiyat girildiyse havuza ekle
            if (m.price > 0) {
                pricePool[slug].totalCost += m.amount * m.price;
                pricePool[slug].totalQty += m.amount;
            }
        } else if (m.type === 'IN') {
            status[slug].in += m.amount;
            status[slug].balance += m.amount;
            if (m.price > 0) {
                pricePool[slug].totalCost += m.amount * m.price;
                pricePool[slug].totalQty += m.amount;
            }
        } else if (m.type === 'OUT') {
            status[slug].out += m.amount;
            status[slug].balance -= m.amount;
        }

        // Ağırlıklı Ortalama Hesapla
        if (pricePool[slug].totalQty > 0) {
            status[slug].price = pricePool[slug].totalCost / pricePool[slug].totalQty;
        }
    });

    renderStokStatus(status);
    
    // Filtreleme mantığı
    const pSearch = document.getElementById('filterHareketUrun')?.value.toLowerCase() || '';
    const tSearch = document.getElementById('filterHareketTip')?.value || '';
    const sDate = document.getElementById('filterHareketStart')?.value || '1970-01-01';
    const eDate = document.getElementById('filterHareketEnd')?.value || '2099-12-31';

    const filteredRecords = allStokData.filter(item => {
        const typeLabel = (item.type === 'IN' ? 'GİRİŞ' : (item.type === 'OUT' ? 'ÇIKIŞ' : 'SAYIM'));
        if (pSearch && !item.productName.toLowerCase().includes(pSearch)) return false;
        if (tSearch && typeLabel !== tSearch) return false;
        if (item.date < sDate || item.date > eDate) return false;
        return true;
    });

    renderStokTable(filteredRecords);
};

const renderStokStatus = (status) => {
    const body = document.getElementById('stokStatusBody');
    const filter = document.getElementById('stokStatusFilter').value;
    const isAdmin = currentUser && currentUser.role === 'admin';
    body.innerHTML = '';
    
    let prodCount = 0;
    let totalVal = 0;
    let criticalCount = 0;

    allStokItems = []; // Populate for exports

    Object.keys(status).forEach(slug => {
        const s = status[slug];
        
        // Export data preparation
        allStokItems.push({
            name: s.name,
            unit: s.unit,
            stock: s.balance,
            price: s.price,
            category: '', // Add if needed
            status: s.isActive ? 'ACTIVE' : 'PASSIVE'
        });

        // Filter logic
        if (filter === 'ACTIVE' && !s.isActive) return;
        if (filter === 'PASSIVE' && s.isActive) return;

        const rowVal = s.balance * s.price;
        totalVal += rowVal;
        prodCount++;
        if (s.balance <= 0) criticalCount++;

        const tr = document.createElement('tr');
        tr.style.opacity = s.isActive ? '1' : '0.5';

        let actionHtml = '';
        if (isAdmin) {
            actionHtml = `
                <td class="admin-only">
                    <button class="btn-icon" onclick="editProductName('${s.name}')" title="Ürünü Düzenle" style="color:var(--primary); margin-right:5px;">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="btn-icon" onclick="toggleProductStatus('${slug}', ${s.isActive})" title="${s.isActive ? 'Pasife Al' : 'Aktife Al'}" style="margin-right:5px;">
                        <i class="fa-solid ${s.isActive ? 'fa-eye-slash' : 'fa-eye'}"></i>
                    </button>
                    <button class="btn-icon" onclick="deleteProductMaster('${slug}', '${s.name}')" title="Ürünü Tamamen Sil" style="color:var(--danger);">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            `;
        }

        tr.innerHTML = `
            <td style="text-align:left;font-weight:600; cursor:pointer;" onclick="editProductName('${s.name}')" title="Düzenlemek için tıklayın">
                ${s.name} <i class="fa-solid fa-pen-to-square" style="font-size:0.7rem; opacity:0.5"></i>
            </td>
            <td style="font-size:0.8rem; color:var(--text-muted)">${s.unit || '-'}</td>
            <td style="font-weight:700; color:${s.balance > 0 ? 'var(--success)' : 'var(--danger)'}">${s.balance}</td>
            <td>${formatCurrency(s.price)}</td>
            <td class="toplam-col">${formatCurrency(rowVal)}</td>
            <td style="color:var(--success)">+${s.in}</td>
            <td style="color:var(--danger)">-${s.out}</td>
            <td style="color:var(--text-muted)">${s.count} (${formatDate(s.lastCountDate)})</td>
            ${actionHtml}
        `;
        body.appendChild(tr);
    });

    document.getElementById('kpiStokCount').textContent = prodCount;
    document.getElementById('kpiStokValue').textContent = formatCurrency(totalVal) + ' TL';
    document.getElementById('kpiStokCritical').textContent = criticalCount;
    
    // Admin yetkisini tekrar kontrol et (yeni eklenen satırlar için)
    updateUIVisibility();
};

document.getElementById('stokStatusFilter').addEventListener('change', () => processStokData());
document.getElementById('filterHareketUrun')?.addEventListener('input', () => processStokData());
document.getElementById('filterHareketTip')?.addEventListener('change', () => processStokData());
document.getElementById('filterHareketStart')?.addEventListener('change', () => processStokData());
document.getElementById('filterHareketEnd')?.addEventListener('change', () => processStokData());

window.toggleProductStatus = async (slug, currentStatus) => {
    try {
        await db.collection(PRODUCT_COLLECTION).doc(slug).update({
            isActive: !currentStatus,
            updatedAt: new Date().toISOString()
        });
        showToast(`Ürün ${!currentStatus ? 'aktif' : 'pasif'} hale getirildi.`);
    } catch (e) {
        showToast('Hata oluştu!', 'error');
    }
};

window.deleteProductMaster = async (slug, name) => {
    if (!confirm(`${name} isimli ürünü ve tüm hareket geçmişini silmek istediğinize emin misiniz?`)) return;
    try {
        const batch = db.batch();
        // 1. Master sil
        batch.delete(db.collection(PRODUCT_COLLECTION).doc(slug));
        // 2. Hareketleri sil
        const snap = await db.collection(STOK_COLLECTION).where('productName', '==', name).get();
        snap.docs.forEach(doc => batch.delete(doc.ref));
        
        await batch.commit();
        showToast('Ürün tamamen silindi.');
    } catch (e) {
        showToast('Silme hatası!', 'error');
    }
};

const renderStokTable = (data) => {
    const body       = document.getElementById('stokTableBody');
    const emptyState = document.getElementById('stokEmptyState');
    const table      = document.getElementById('stokTable');
    document.getElementById('stokRecordCount').textContent = `${data.length} Kayıt`;
    body.innerHTML   = '';

    if (data.length === 0) {
        emptyState.classList.remove('hidden');
        table.classList.add('hidden');
        return;
    }
    emptyState.classList.add('hidden');
    table.classList.remove('hidden');

    data.forEach(item => {
        const tr = document.createElement('tr');
        const typeLabels = { 'IN': 'GİRİŞ', 'OUT': 'ÇIKIŞ', 'COUNT': 'SAYIM' };
        const typeColors = { 'IN': 'var(--success)', 'OUT': 'var(--danger)', 'COUNT': 'var(--primary)' };
        
        tr.innerHTML = `
            <td style="white-space:nowrap;text-align:left">${formatDate(item.date)}</td>
            <td style="color:${typeColors[item.type]}; font-weight:bold; font-size:0.7rem">${typeLabels[item.type]}</td>
            <td style="text-align:left;font-weight:600">${item.productName}</td>
            <td class="currency" style="font-weight:700">${item.type === 'OUT' ? '-' : (item.type === 'IN' ? '+' : '=')}${item.amount}</td>
            <td>
                <button class="btn-icon" onclick="deleteStokRecord('${item.id}')" title="Sil">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        body.appendChild(tr);
    });
};

// ── CHART ──────────────────────────────────────────────────────
const updateChart = (data) => {
    const ctx = document.getElementById('revenueChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    if (data.length === 0) return;
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => formatDate(d.date).substring(0, 5)),
            datasets: [
                { label: 'ROBOTPOS TOPLAM', data: data.map(d => (d.robotEft||0)+(d.robotNakit||0)+(d.robotKredi||0)+(d.yemek||0)+(d.cari||0)), borderColor: 'rgba(59,130,246,1)', backgroundColor: 'rgba(59,130,246,0.1)', tension: 0.3, fill: true },
                { label: 'MUHASEBE TOPLAM', data: data.map(d => (d.muhEft||0)+(d.muhNakit||0)+(d.muhKredi||0)+(d.kasaYemek||0)), borderColor: 'rgba(16,185,129,1)', backgroundColor: 'rgba(16,185,129,0.1)', tension: 0.3, fill: true }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#94a3b8' } } },
            scales: {
                y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
            }
        }
    });
};

// ── LIVE FORM CALCULATION ──────────────────────────────────────
const g = (id) => parseFloat(document.getElementById(id).value) || 0;
const s = (id, val) => {
    const el = document.getElementById(id);
    el.value = val.toFixed(2);
    el.style.color = val === 0 ? '' : (val > 0 ? '#10b981' : '#ef4444');
};

const recalcForm = () => {
    const rEft = g('inputRobotEft'), mEft = g('inputMuhasebeEft');
    const kNak = g('inputKasaNakit'), rNak = g('inputRobotNakit'), mNak = g('inputMuhasebeNakit');
    const rKre = g('inputRobotKredi'), mKre = g('inputMuhasebeKredi');
    const rYem = g('inputYemek'), kYem = g('inputKasaYemek');

    s('inputEftFark',             mEft - rEft);
    s('inputPosRobotNakitFark',   kNak - rNak);
    s('inputKrediFark',           mKre - rKre);
    s('inputYemekFark',           kYem - rYem);
    s('inputRobotToplam',         rEft + rNak + rKre + rYem + g('inputCari'));
    s('inputMuhasebeToplam',      mEft + mNak + mKre + kYem);
    s('inputKasaRobotFark',       kNak - rNak);
    s('inputKasaNakitFarkToplam', (mEft - rEft) + (kNak - rNak) + (mKre - rKre) + (kYem - rYem));
};

['inputRobotEft','inputMuhasebeEft','inputKasaNakit','inputRobotNakit',
 'inputMuhasebeNakit','inputRobotKredi','inputMuhasebeKredi','inputYemek','inputKasaYemek','inputCari'
].forEach(id => document.getElementById(id).addEventListener('input', recalcForm));

// ── FORM SUBMIT ────────────────────────────────────────────────
document.getElementById('dataForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const date = document.getElementById('inputDate').value;
    if (!date) return;

    // Check if record for this date exists
    const existing = allData.find(r => r.date === date);

    // Boş bırakılan alanlarda var olan veriyi korur, yeni girileni üstüne yazar
    const getVal = (id, fieldName) => {
        const strVal = document.getElementById(id).value;
        if (strVal !== '') return parseFloat(strVal) || 0;
        return existing ? (existing[fieldName] || 0) : 0;
    };

    const rec = {
        id:          existing ? existing.id : date.replace(/-/g, ''),
        date,
        robotEft:    getVal('inputRobotEft', 'robotEft'),
        muhEft:      getVal('inputMuhasebeEft', 'muhEft'),
        kasaNakit:   getVal('inputKasaNakit', 'kasaNakit'),
        robotNakit:  getVal('inputRobotNakit', 'robotNakit'),
        muhNakit:    getVal('inputMuhasebeNakit', 'muhNakit'),
        robotKredi:  getVal('inputRobotKredi', 'robotKredi'),
        muhKredi:    getVal('inputMuhasebeKredi', 'muhKredi'),
        yemek:       getVal('inputYemek', 'yemek'),
        kasaYemek:   getVal('inputKasaYemek', 'kasaYemek'),
        cari:        getVal('inputCari', 'cari'),
        updatedAt:   new Date().toISOString()
    };
    await saveRecord(rec);
    document.getElementById('dataForm').reset();
    document.getElementById('inputDate').valueAsDate = new Date();
    recalcForm();
});
document.getElementById('inputDate').valueAsDate = new Date();

document.getElementById('stokForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const date = document.getElementById('inputStokDate').value;
    const type = document.getElementById('inputStokType').value;
    const barcode = document.getElementById('inputStokBarcode').value.trim();
    const productName = document.getElementById('inputStokProduct').value.trim().toUpperCase('tr-TR');
    const amount = parseFloat(document.getElementById('inputStokAmount').value) || 0;
    const price  = parseFloat(document.getElementById('inputStokPrice').value) || 0;
    const unit   = document.getElementById('inputStokUnit').value.trim().toUpperCase('tr-TR');
    
    if (!date || !productName || amount < 0) return;

    const productSlug = productName.replace(/\s+/g, '');
    
    // 1. Ürün bilgilerini (fiyat, birim, barkod) güncelle
    if (price > 0 || unit || barcode || !allProducts[productSlug]) {
        await db.collection(PRODUCT_COLLECTION).doc(productSlug).set({
            name: productName,
            barcode: barcode || (allProducts[productSlug] ? (allProducts[productSlug].barcode || '') : ''),
            price: price || (allProducts[productSlug] ? allProducts[productSlug].price : 0),
            unit: unit || (allProducts[productSlug] ? (allProducts[productSlug].unit || '') : ''),
            isActive: allProducts[productSlug] ? (allProducts[productSlug].isActive !== false) : true,
            updatedAt: new Date().toISOString()
        }, { merge: true });
    }

    // 2. Hareketi kaydet (Benzersiz ID: Tarih + Tip + Ürün)
    const id = `${date.replace(/-/g, '')}_${type}_${productSlug}_${Date.now()}`;

    const rec = {
        id,
        date,
        type,
        productName,
        amount,
        price,
        updatedAt: new Date().toISOString()
    };
    
    await saveStokRecord(rec);
    
    // Formu temizle
    document.getElementById('inputStokBarcode').value = '';
    document.getElementById('inputStokProduct').value = '';
    document.getElementById('inputStokAmount').value = '';
    document.getElementById('inputStokPrice').value  = '';
    document.getElementById('inputStokUnit').value   = '';
    document.getElementById('inputStokBarcode').focus();
});

window.editProductName = (oldName) => {
    const oldSlug = oldName.toUpperCase('tr-TR').replace(/\s+/g, '');
    const product = allProducts[oldSlug];
    
    document.getElementById('editProductOldName').value = oldName;
    document.getElementById('editProductNameInput').value = oldName;
    document.getElementById('editProductBarcode').value = product ? (product.barcode || '') : '';
    document.getElementById('editProductUnit').value = product ? (product.unit || '') : '';
    document.getElementById('editProductPrice').value = product ? (product.price || 0) : 0;
    
    toggleModal('productEditModal', true);
};

document.getElementById('btnScanEditBarcode')?.addEventListener('click', async () => {
    // startScanner fonksiyonu yukarıda initApp içinde tanımlı olduğu için 
    // buradaki eski dinleyiciyi silebiliriz veya startScanner'ı global yapabiliriz.
    // Ancak initApp içinde zaten btnScanEditBarcode için dinleyici ekledik.
});

document.getElementById('productEditForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const oldName = document.getElementById('editProductOldName').value;
    const newName = document.getElementById('editProductNameInput').value.trim().toUpperCase('tr-TR');
    const barcode = document.getElementById('editProductBarcode').value.trim();
    const unit = document.getElementById('editProductUnit').value.trim().toUpperCase('tr-TR');
    const price = parseFloat(document.getElementById('editProductPrice').value) || 0;

    if (!newName) return;

    const oldSlug = oldName.toUpperCase('tr-TR').replace(/\s+/g, '');
    const newSlug = newName.replace(/\s+/g, '');

    try {
        const batch = db.batch();
        const oldProd = allProducts[oldSlug];
        
        // 1. Ürün master kaydını güncelle
        const updatedProdData = {
            name: newName,
            barcode: barcode,
            unit: unit,
            price: price,
            isActive: oldProd ? (oldProd.isActive !== false) : true,
            updatedAt: new Date().toISOString()
        };

        batch.set(db.collection(PRODUCT_COLLECTION).doc(newSlug), updatedProdData);
        if (oldSlug !== newSlug) {
            batch.delete(db.collection(PRODUCT_COLLECTION).doc(oldSlug));
            
            // 2. Hareketlerdeki isimleri güncelle
            const snap = await db.collection(STOK_COLLECTION).where('productName', '==', oldName).get();
            snap.docs.forEach(doc => {
                batch.update(doc.ref, { productName: newName });
            });
        }

        await batch.commit();
        toggleModal('productEditModal', false);
        showToast('Ürün başarıyla güncellendi.');
    } catch (e) {
        console.error(e);
        showToast('Güncelleme sırasında hata!', 'error');
    }
});

// Arama Filtresi
document.getElementById('stokSearch').addEventListener('input', (e) => {
    const q = e.target.value.toUpperCase('tr-TR');
    const rows = document.querySelectorAll('#stokStatusBody tr');
    rows.forEach(row => {
        const text = row.cells[0].textContent.toUpperCase('tr-TR');
        row.style.display = text.includes(q) ? '' : 'none';
    });
});

document.getElementById('inputStokDate').valueAsDate = new Date();

// ── FILE UPLOAD ────────────────────────────────────────────────
const dropZone    = document.getElementById('dropZone');
const fileInput   = document.getElementById('fileInput');
const uploadStatus = document.getElementById('uploadStatus');

dropZone.addEventListener('dragover',  (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', ()  => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop',      async (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); if (e.dataTransfer.files.length) await handleFiles(e.dataTransfer.files); });
fileInput.addEventListener('change',   async (e) => { if (e.target.files.length) await handleFiles(e.target.files); });

const handleFiles = async (files) => {
    uploadStatus.textContent = 'Dosyalar işleniyor...';
    let added = 0;
    for (const file of files) {
        const ext = file.name.split('.').pop().toLowerCase();
        try {
            if (ext === 'pdf') {
                const text = await extractTextFromPDF(file);
                console.log('PDF RAW TEXT:', text); // Debug: tarayıcı konsolunda görülebilir
                const rec  = parseDataFromText(text, file.name);
                console.log('PARSED REC:', rec); // Debug
                if (rec) { await saveRecord(rec); added++; }
            } else {
                showToast('Excel yükleme yakında aktif olacak. Şimdilik PDF veya manuel giriş kullanın.');
            }
        } catch (err) { console.error(err); }
    }
    uploadStatus.textContent = added > 0 ? `${added} kayıt eklendi ✓` : 'Tanınan veri bulunamadı.';
    setTimeout(() => uploadStatus.textContent = '', 4000);
    fileInput.value = '';
};

const extractTextFromPDF = async (file) => {
    const ab  = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
    let text  = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page    = await pdf.getPage(i);
        const content = await page.getTextContent();
        // Her text item'ı arasına newline koy (böylece satır bazlı arama yapılabilir)
        text += content.items.map(s => s.str).join('\n') + '\n';
    }
    return text;
};

// ── PDF / TEXT PARSER ──────────────────────────────────────────
// Gerçek Z raporu formatı (Word COM ile okunmuş):
//   7: MOBİL KREDİ
//   8: 812.010,00 TL
//   10: MOBİL NAKİT
//   11: 135.820,00 TL
//   13: NAKİT
//   14: 110.745,00 TL
//   16: METROPOL
//   17: 11.690,00 TL
// Etiket bir satırda, tutar sonraki satırlarda
const parseDataFromText = (text, filename) => {
    // Sayı temizleme: "1.097.045,00 TL" -> 1097045.00
    const clean = (s) => {
        if (!s) return 0;
        const cleaned = s.replace(/\s/g, '').replace(/TL/gi, '').replace(/%[\d.,]+/g, '').replace(/\./g, '').replace(',', '.').trim();
        return parseFloat(cleaned) || 0;
    };

    // Satırlara ayır
    const lines = text.split(/[\r\n\u0007]+/).map(l => l.trim()).filter(l => l.length > 0);
    
    // Yardımcı: Belirli bir etiketin bulunduğu satırdan sonraki ilk sayıyı bul
    const findAmount = (labelPattern) => {
        const labelRegex = new RegExp(labelPattern, 'i');
        for (let i = 0; i < lines.length; i++) {
            if (labelRegex.test(lines[i])) {
                // Aynı satırda tutar var mı? (ör: "NAKİT 110.745,00 TL")
                const sameLineMatch = lines[i].match(/(\d[\d.]*,\d{2})/);
                if (sameLineMatch) return clean(sameLineMatch[1]);
                // Sonraki 1-3 satırda tutar ara
                for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
                    const numMatch = lines[j].match(/(\d[\d.]*,\d{2})/);
                    if (numMatch) return clean(numMatch[1]);
                }
            }
        }
        return 0;
    };

    // ── ANA VERİLER ──
    // MOBİL NAKİT + NAKİT = ROBOTPOS NAKİT
    const mobilNakit  = findAmount('MOB.L\\s+NAK.T');
    const normalNakit = findAmount('^NAK.T$');

    // MOBİL KREDİ + KREDİ KARTI = ROBOTPOS KREDİ KARTI
    const mobilKredi  = findAmount('MOB.L\\s+KRED.');
    const normalKredi = findAmount('^KRED.\\s*KART');

    // YEMEK KARTLARI = SODEXO + METROPOL + MULTINET + SETCARD + TICKET
    const sodexo   = findAmount('SODEXO');
    const metropol = findAmount('METROPOL');
    const multinet = findAmount('MULT.NET');
    const setcard  = findAmount('SETCARD');
    const ticket   = findAmount('T.CKET');
    const yemekKartlari = sodexo + metropol + multinet + setcard + ticket;

    // ONLINE CARİ
    const onlineCari = findAmount('ONLINE\\s*CAR.');

    const robotNakit = normalNakit + mobilNakit;
    const robotKredi = normalKredi + mobilKredi;

    // Tarih ayıklama (dosya adından: 01.04.2026.pdf)
    let dateObj = new Date();
    const dm = filename.match(/(\d{1,2})[.\-](\d{1,2})[.\-](\d{4})/);
    if (dm) {
        dateObj = new Date(`${dm[3]}-${dm[2].padStart(2,'0')}-${dm[1].padStart(2,'0')}`);
    }
    const dateISO = dateObj.toISOString().split('T')[0];

    // Debug log
    console.log(`PDF Parse: Nakit=${normalNakit}+${mobilNakit}=${robotNakit}, Kredi=${normalKredi}+${mobilKredi}=${robotKredi}, Yemek=${yemekKartlari}, Cari=${onlineCari}`);
    
    // Sadece bulunan (0'dan büyük) değerleri nesneye ekle (merge: true ile mevcut veriler korunur)
    const rec = {
        id: dateISO.replace(/-/g, ''),
        date: dateISO,
        updatedAt: new Date().toISOString()
    };
    
    if (robotNakit > 0) rec.robotNakit = robotNakit;
    if (robotKredi > 0) rec.robotKredi = robotKredi;
    if (yemekKartlari > 0) rec.yemek = yemekKartlari;
    if (onlineCari > 0) rec.cari = onlineCari;
    
    return rec;
};

// ── EXCEL EXPORT ───────────────────────────────────────────────
document.getElementById('btnExportExcel').addEventListener('click', () => {
    if (!allData.length) return alert('İndirilecek veri yok!');
    const rows = allData.map(d => {
        const rEft=d.robotEft||0, mEft=d.muhEft||0;
        const kNak=d.kasaNakit||0, rNak=d.robotNakit||0, mNak=d.muhNakit||0;
        const rKre=d.robotKredi||0, mKre=d.muhKredi||0;
        const rYem=d.yemek||0, kYem=d.kasaYemek||0;
        const ef=mEft-rEft, pf=kNak-rNak, kf=mKre-rKre, yf=kYem-rYem;
        return {
            'Tarih': formatDate(d.date),
            'ROBOTPOS EFT': rEft, 'MUHASEBE EFT': mEft, 'EFT FARK': ef,
            'KASA NAKİT': kNak, 'ROBOTPOS NAKİT': rNak, 'MUHASEBE NAKİT': mNak, 'POS-ROBOT NAKİT FARK': pf,
            'ROBOTPOS KREDİ': rKre, 'MUHASEBE KREDİ': mKre, 'KREDİ KART FARK': kf,
            'ROBOTPOS YEMEK KARTLARI': rYem, 'KASA YEMEK KARTLARI': kYem, 'YEMEK FARK': yf,
            'ROBOTPOS TOPLAM': rEft+rNak+rKre+rYem+(d.cari||0), 'MUHASEBE TOPLAM': mEft+mNak+mKre+kYem,
            'KASA NAKİT TOPLAM FARK': kNak-rNak, 'KASA ROBOTPOS TOPLAM FARK': ef+pf+kf+yf,
            'CARİ': d.cari||0
        };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rapor');
    XLSX.writeFile(wb, `Rapor_${new Date().toISOString().split('T')[0]}.xlsx`);
});

// ── PDF EXPORT ─────────────────────────────────────────────────
document.getElementById('btnExportPDF').addEventListener('click', () => {
    if (!allData.length) return alert('İndirilecek veri yok!');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(14); doc.text('Sultanahmet Veri Analizi Raporu', 14, 14);
    doc.setFontSize(9); doc.setTextColor(120); doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 14, 21);
    const rows = allData.map(d => {
        const rEft=d.robotEft||0, mEft=d.muhEft||0;
        const kNak=d.kasaNakit||0, rNak=d.robotNakit||0, mNak=d.muhNakit||0;
        const rKre=d.robotKredi||0, mKre=d.muhKredi||0;
        const rYem=d.yemek||0, kYem=d.kasaYemek||0;
        const ef=mEft-rEft, pf=kNak-rNak, kf=mKre-rKre, yf=kYem-rYem;
        return [
            formatDate(d.date),
            formatCurrency(rEft), formatCurrency(mEft), formatCurrency(ef),
            formatCurrency(kNak), formatCurrency(rNak), formatCurrency(mNak), formatCurrency(pf),
            formatCurrency(rKre), formatCurrency(mKre), formatCurrency(kf),
            formatCurrency(rYem), formatCurrency(kYem), formatCurrency(yf),
            formatCurrency(rEft+rNak+rKre+rYem+(d.cari||0)), formatCurrency(mEft+mNak+mKre+kYem),
            formatCurrency(kNak-rNak), formatCurrency(ef+pf+kf+yf)
        ];
    });
    doc.autoTable({
        startY: 26,
        head: [['Tarih','R.EFT','M.EFT','EFT FARK','KASA NAK','R.NAK','M.NAK','NAK FARK','R.KRE','M.KRE','KRE FARK','R.YEM','K.YEM','YEM FARK','R.TOP','M.TOP','K.NAK TOP FARK','K.ROB TOP FARK']],
        body: rows, theme: 'grid',
        headStyles: { fillColor: [59,130,246], fontSize: 7, halign: 'center' },
        styles: { fontSize: 7, cellPadding: 1.5 },
        columnStyles: { 3:{textColor:[59,130,246]}, 7:{textColor:[59,130,246]}, 10:{textColor:[59,130,246]}, 13:{textColor:[59,130,246]}, 17:{textColor:[16,185,129],fontStyle:'bold'} }
    });
    doc.save(`Rapor_${new Date().toISOString().split('T')[0]}.pdf`);
});

// ── STOK EXPORT ────────────────────────────────────────────────
document.getElementById('btnStokExportExcel')?.addEventListener('click', () => {
    if (!allStokItems.length) return alert('İndirilecek stok verisi yok!');
    const rows = allStokItems.map(item => ({
        'Ürün Adı': item.name,
        'Birim': item.unit,
        'Mevcut Stok': item.stock,
        'Birim Fiyat': item.price,
        'Envanter Değeri': item.stock * item.price,
        'Kategori': item.category,
        'Durum': item.status === 'ACTIVE' ? 'Aktif' : 'Pasif'
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stok');
    XLSX.writeFile(wb, `Stok_Raporu_${new Date().toISOString().split('T')[0]}.xlsx`);
});

document.getElementById('btnStokExportPDF')?.addEventListener('click', () => {
    if (!allStokItems.length) return alert('İndirilecek stok verisi yok!');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.text('Anlık Stok Raporu', 14, 15);
    const rows = allStokItems.map(item => [
        item.name, item.unit, item.stock, formatCurrency(item.price), formatCurrency(item.stock * item.price), item.category
    ]);
    doc.autoTable({
        startY: 20,
        head: [['Ürün', 'Birim', 'Stok', 'Fiyat', 'Değer', 'Kategori']],
        body: rows,
        theme: 'grid'
    });
    doc.save(`Stok_Raporu_${Date.now()}.pdf`);
});

// ── PERSONEL EXPORT ─────────────────────────────────────────────
document.getElementById('btnPersonelExportExcel')?.addEventListener('click', () => {
    const sDate = document.getElementById('filterWorkStart')?.value || '1970-01-01';
    const eDate = document.getElementById('filterWorkEnd')?.value || '2099-12-31';
    const fName = document.getElementById('filterPersonelName')?.value || '';
    const fDept = document.getElementById('filterDeptName')?.value || '';

    const records = allPersonelRecords.filter(r => {
        const p = allPersonelMaster.find(m => m.id === r.personelId);
        if (fName && r.personelId !== fName) return false;
        if (fDept && p && p.dept !== fDept) return false;
        if (r.date < sDate || r.date > eDate) return false;
        return true;
    });

    if (!records.length) return alert('Seçili kriterlerde kayıt bulunamadı!');

    const rows = records.map(r => {
        const p = allPersonelMaster.find(m => m.id === r.personelId);
        return {
            'Tarih': formatDate(r.date),
            'Personel': p ? p.name : r.personelId,
            'Tür': r.type === 'WORK' ? 'MESAİ' : (r.leaveType || 'İZİN/RAPOR'),
            'Detay': r.type === 'WORK' ? `${r.start} - ${r.end}` : '-',
            'Mola/Rapor': r.type === 'WORK' ? (r.breakMins ? r.breakMins + ' dk' : '-') : (r.sickDays ? r.sickDays + ' Gün' : '-'),
            'Süre': r.type === 'WORK' ? r.hours + ' Saat' : (r.leaveDays || 0) + ' Gün'
        };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Personel_Raporu');
    XLSX.writeFile(wb, `Personel_Raporu_${Date.now()}.xlsx`);
});

document.getElementById('btnPersonelExportPDF')?.addEventListener('click', () => {
    const sDate = document.getElementById('filterWorkStart')?.value || '1970-01-01';
    const eDate = document.getElementById('filterWorkEnd')?.value || '2099-12-31';
    const fName = document.getElementById('filterPersonelName')?.value || '';
    const fDept = document.getElementById('filterDeptName')?.value || '';

    const records = allPersonelRecords.filter(r => {
        const p = allPersonelMaster.find(m => m.id === r.personelId);
        if (fName && r.personelId !== fName) return false;
        if (fDept && p && p.dept !== fDept) return false;
        if (r.date < sDate || r.date > eDate) return false;
        return true;
    });

    if (!records.length) return alert('Seçili kriterlerde kayıt bulunamadı!');

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.text('Personel Çalışma ve İzin Raporu', 14, 15);
    const rows = records.map(r => {
        const p = allPersonelMaster.find(m => m.id === r.personelId);
        return [
            formatDate(r.date),
            p ? p.name : r.personelId,
            r.type === 'WORK' ? 'MESAİ' : (r.leaveType || 'İZİN'),
            r.type === 'WORK' ? `${r.start}-${r.end}` : '-',
            r.type === 'WORK' ? (r.breakMins || '-') : (r.sickDays || '-'),
            r.type === 'WORK' ? r.hours : (r.leaveDays || 0)
        ];
    });

    doc.autoTable({
        startY: 20,
        head: [['Tarih', 'Personel', 'Tür', 'Saat', 'Mola/Rap', 'Süre']],
        body: rows,
        theme: 'grid'
    });
    doc.save(`Personel_Raporu_${Date.now()}.pdf`);
});

// ── TOAST ──────────────────────────────────────────────────────
const showToast = (msg, type = 'success') => {
    const el = document.createElement('div');
    el.style.cssText = `
        position:fixed; bottom:1.5rem; right:1.5rem; z-index:9999;
        background:${type === 'error' ? '#ef4444' : '#10b981'};
        color:white; padding:0.75rem 1.25rem; border-radius:10px;
        font-size:0.9rem; font-weight:600; box-shadow:0 4px 20px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease;
    `;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
};

// ── PERSONEL YÖNETİMİ MANTIĞI ──────────────────────────────────────────

const populatePersonelSelects = () => {
    const wSel = document.getElementById('selectWorkPersonel');
    const lSel = document.getElementById('selectLeavePersonel');
    const fSel = document.getElementById('filterPersonelName');
    const dSel = document.getElementById('filterDeptName');
    if (!wSel || !lSel) return;
    
    // Mevcut seçimleri sakla
    const wVal = wSel.value;
    const lVal = lSel.value;
    const fVal = fSel ? fSel.value : '';
    const dVal = dSel ? dSel.value : '';

    const opts = '<option value="">Seçiniz...</option>' + allPersonelMaster.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    wSel.innerHTML = opts;
    lSel.innerHTML = opts;
    
    if(fSel) {
        fSel.innerHTML = '<option value="">Tüm Personeller</option>' + allPersonelMaster.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        fSel.value = fVal;
    }

    if(dSel) {
        const depts = [...new Set(allPersonelMaster.map(p => p.dept).filter(Boolean))];
        dSel.innerHTML = '<option value="">Tüm Bölümler</option>' + depts.map(d => `<option value="${d}">${d}</option>`).join('');
        dSel.value = dVal;
    }

    wSel.value = wVal;
    lSel.value = lVal;
};

// Toplam saat hesaplama
const calcWorkHours = () => {
    const start = document.getElementById('inputWorkStart').value;
    const end = document.getElementById('inputWorkEnd').value;
    const breakMins = parseFloat(document.getElementById('inputWorkBreak').value) || 0;
    const totalEl = document.getElementById('inputWorkTotal');
    
    if (start && end) {
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        
        let diff = (eh * 60 + em) - (sh * 60 + sm);
        if (diff < 0) diff += 24 * 60; // Gece yarısını geçme durumu
        
        diff -= breakMins; // Mola süresini çıkar
        if (diff < 0) diff = 0;
        
        const hours = (diff / 60).toFixed(2);
        totalEl.value = hours;
    } else {
        totalEl.value = '';
    }
};

document.getElementById('inputWorkStart')?.addEventListener('input', calcWorkHours);
document.getElementById('inputWorkEnd')?.addEventListener('input', calcWorkHours);
document.getElementById('inputWorkBreak')?.addEventListener('input', calcWorkHours);

// Personel Ekleme
document.getElementById('newPersonelForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('inputPerName').value.trim();
    const dept = document.getElementById('inputPerDept').value.trim();
    const leave = parseFloat(document.getElementById('inputPerLeave').value) || 0;
    
    if (!name) return;
    
    const id = name.toUpperCase('tr-TR').replace(/\s+/g, '_');
    
    try {
        await db.collection(PERSONEL_MASTER_COL).doc(id).set({
            name, dept, totalLeave: leave, updatedAt: new Date().toISOString()
        }, { merge: true });
        showToast('Personel kaydedildi.');
        document.getElementById('newPersonelForm').reset();
    } catch(err) {
        showToast('Personel eklenemedi.', 'error');
    }
});

// Çalışma Saati Ekleme
document.getElementById('workHourForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pId = document.getElementById('selectWorkPersonel').value;
    const date = document.getElementById('inputWorkDate').value;
    const start = document.getElementById('inputWorkStart').value;
    const end = document.getElementById('inputWorkEnd').value;
    const breakMins = parseFloat(document.getElementById('inputWorkBreak').value) || 0;
    const hours = parseFloat(document.getElementById('inputWorkTotal').value) || 0;

    if (!pId || !date || !start || !end) return;

    const id = `${date.replace(/-/g, '')}_WORK_${pId}_${Date.now()}`;
    
    try {
        await db.collection(PERSONEL_RECORD_COL).doc(id).set({
            type: 'WORK',
            personelId: pId,
            date, start, end, breakMins, hours,
            updatedAt: new Date().toISOString()
        });
        showToast('Çalışma saati kaydedildi.');
        document.getElementById('inputWorkStart').value = '';
        document.getElementById('inputWorkEnd').value = '';
        document.getElementById('inputWorkBreak').value = '0';
        document.getElementById('inputWorkTotal').value = '';
    } catch(err) {
        showToast('Hata oluştu.', 'error');
    }
});

// İzin Ekleme
document.getElementById('leaveForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pId = document.getElementById('selectLeavePersonel').value;
    const lType = document.getElementById('selectLeaveType').value;
    const start = document.getElementById('inputLeaveStart').value;
    const end = document.getElementById('inputLeaveEnd').value;
    const days = parseFloat(document.getElementById('inputLeaveDays').value) || 0;

    if (!pId || !start || !end || days <= 0) return;

    let leaveDays = 0;
    let sickDays = 0;
    if (lType === 'Yıllık İzin') leaveDays = days;
    if (lType === 'Rapor') sickDays = days;

    const id = `${start.replace(/-/g, '')}_LEAVE_${pId}_${Date.now()}`;
    
    try {
        await db.collection(PERSONEL_RECORD_COL).doc(id).set({
            type: 'LEAVE',
            personelId: pId,
            date: start, // Referans tarih olarak başlangıç
            leaveType: lType,
            leaveStart: start, leaveEnd: end, leaveDays, sickDays,
            updatedAt: new Date().toISOString()
        });
        showToast('Kayıt eklendi.');
        document.getElementById('leaveForm').reset();
    } catch(err) {
        showToast('Hata oluştu.', 'error');
    }
});

// Silme Fonksiyonu
window.deletePersonelRecord = async (id) => {
    if(!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;
    try {
        await db.collection(PERSONEL_RECORD_COL).doc(id).delete();
        showToast('Kayıt silindi.');
    } catch(e) {
        showToast('Silinemedi.', 'error');
    }
};

window.deletePersonelMaster = async (id) => {
    if(!confirm('Personeli tamamen silmek istediğinize emin misiniz?')) return;
    try {
        await db.collection(PERSONEL_MASTER_COL).doc(id).delete();
        showToast('Personel silindi.');
    } catch(e) {
        showToast('Silinemedi.', 'error');
    }
};

// Data Processing & Rendering
const processPersonelData = () => {
    const sDate = document.getElementById('filterWorkStart')?.value || '1970-01-01';
    const eDate = document.getElementById('filterWorkEnd')?.value || '2099-12-31';
    const fName = document.getElementById('filterPersonelName')?.value || '';
    const fDept = document.getElementById('filterDeptName')?.value || '';

    let summary = {};
    allPersonelMaster.forEach(p => {
        summary[p.id] = { ...p, usedLeave: 0, sickDays: 0, filteredHours: 0 };
    });

    const recordsBody = document.getElementById('personelRecordsBody');
    if(recordsBody) recordsBody.innerHTML = '';
    
    const isAdmin = currentUser && currentUser.role === 'admin';

    allPersonelRecords.forEach(r => {
        const p = summary[r.personelId];
        
        // Filtreler
        if (fName && r.personelId !== fName) return;
        if (fDept && p && p.dept !== fDept) return;

        const pName = p ? p.name : r.personelId;
        
        // Kümülatif hesaplamalar
        if (r.type === 'LEAVE' && p) {
            p.usedLeave += (r.leaveDays || 0);
            p.sickDays += (r.sickDays || 0);
        }
        
        // Filtreli saat hesabı
        if (r.type === 'WORK' && r.date >= sDate && r.date <= eDate && p) {
            p.filteredHours += (r.hours || 0);
        }

        // Tablo Satırı
        if (recordsBody) {
            const tr = document.createElement('tr');
            if (r.type === 'WORK') {
                tr.innerHTML = `
                    <td style="color:var(--success); font-weight:bold; font-size:0.7rem;">MESAİ</td>
                    <td>${formatDate(r.date)}</td>
                    <td>${pName}</td>
                    <td>${r.start} - ${r.end}</td>
                    <td style="color:var(--amber);">${r.breakMins ? r.breakMins + ' dk Mola' : '-'}</td>
                    <td style="font-weight:bold;">${r.hours} Saat</td>
                    <td>${isAdmin ? '<button class="btn-icon" onclick="deletePersonelRecord(\'' + r.id + '\')"><i class="fa-solid fa-trash"></i></button>' : '-'}</td>
                `;
            } else {
                let det = [];
                if (r.sickDays) det.push(r.sickDays + ' Gün Rapor');
                if (r.leaveDays) det.push(r.leaveDays + ' Gün İzin');
                
                tr.innerHTML = `
                    <td style="color:var(--danger); font-weight:bold; font-size:0.7rem;">${r.leaveType ? r.leaveType.toUpperCase() : 'İZİN/RAPOR'}</td>
                    <td>${formatDate(r.date)}</td>
                    <td>${pName}</td>
                    <td>${formatDate(r.leaveStart)} - ${formatDate(r.leaveEnd)}</td>
                    <td style="color:var(--amber);">-</td>
                    <td style="font-weight:bold; color:var(--danger);">${det.join(', ')}</td>
                    <td>${isAdmin ? '<button class="btn-icon" onclick="deletePersonelRecord(\'' + r.id + '\')"><i class="fa-solid fa-trash"></i></button>' : '-'}</td>
                `;
            }
            recordsBody.appendChild(tr);
        }
    });

    const sumBody = document.getElementById('personelSummaryBody');
    if(sumBody) {
        sumBody.innerHTML = '';
        Object.values(summary).forEach(p => {
            if (fName && p.id !== fName) return;
            if (fDept && p.dept !== fDept) return;
            const remain = p.totalLeave - p.usedLeave;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:bold;">${p.name}</td>
                <td style="color:var(--text-muted); font-size:0.8rem;">${p.dept}</td>
                <td>${p.totalLeave}</td>
                <td>${p.usedLeave}</td>
                <td style="font-weight:bold; color:${remain > 0 ? 'var(--success)' : 'var(--danger)'};">${remain}</td>
                <td>${p.sickDays || 0}</td>
                <td style="font-weight:bold; color:var(--primary);">${p.filteredHours.toFixed(2)}</td>
                <td class="admin-only ${isAdmin ? '' : 'hidden'}">
                    <button class="btn-icon" onclick="deletePersonelMaster('${p.id}')" title="Personeli Sil"><i class="fa-solid fa-trash-can"></i></button>
                </td>
            `;
            sumBody.appendChild(tr);
        });
    }
};

document.getElementById('filterWorkStart')?.addEventListener('change', processPersonelData);
document.getElementById('filterWorkEnd')?.addEventListener('change', processPersonelData);
document.getElementById('filterPersonelName')?.addEventListener('change', processPersonelData);
document.getElementById('filterDeptName')?.addEventListener('change', processPersonelData);
// ──────────────────────────────────────────────────────────────────
// ── RESERVATION LOGIC ──────────────────────────────────────────
let editingRezId = null;

const clearRezEditMode = () => {
    editingRezId = null;
    document.getElementById('rezervForm').reset();
    document.getElementById('rezTotalCount').value = '0';
    
    const submitBtn = document.querySelector('#rezervForm button[type="submit"]');
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fa-solid fa-save"></i> Rezervasyonu Kaydet';
        submitBtn.className = 'btn btn-primary';
    }
    
    const cancelBtn = document.getElementById('btnCancelRezEdit');
    if (cancelBtn) {
        cancelBtn.remove();
    }
};

window.editReservation = (id) => {
    const rez = allReservations.find(r => r.id === id);
    if (!rez) return;
    
    if (rez.completed) {
        showToast('Onaylanmış rezervasyonlar düzenlenemez!', 'error');
        return;
    }
    
    document.getElementById('rezDate').value = rez.date || '';
    if (rez.time) {
        const parts = rez.time.split(' - ');
        if (parts.length === 2) {
            document.getElementById('rezTimeStart').value = parts[0];
            document.getElementById('rezTimeEnd').value = parts[1];
        }
    }
    document.getElementById('rezCustomer').value = rez.customer || '';
    document.getElementById('rezContact').value = rez.contact || '';
    document.getElementById('rezCount').value = rez.count || '';
    document.getElementById('rezFreeCount').value = rez.freeCount || '';
    document.getElementById('rezTotalCount').value = rez.totalCount || '';
    document.getElementById('rezMenu').value = rez.menu || '';
    document.getElementById('rezPrice').value = rez.price || '';
    document.getElementById('rezPayment').value = rez.payment || 'Nakit';
    document.getElementById('rezInvoice').value = rez.invoice || '';
    document.getElementById('rezTaxOffice').value = rez.taxOffice || '';
    document.getElementById('rezTaxNumber').value = rez.taxNumber || '';
    document.getElementById('rezAddress').value = rez.address || '';
    document.getElementById('rezEmail').value = rez.email || '';
    
    editingRezId = id;
    
    const submitBtn = document.querySelector('#rezervForm button[type="submit"]');
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fa-solid fa-rotate"></i> Rezervasyonu Güncelle';
        submitBtn.className = 'btn btn-success';
        
        let cancelBtn = document.getElementById('btnCancelRezEdit');
        if (!cancelBtn) {
            cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.id = 'btnCancelRezEdit';
            cancelBtn.className = 'btn btn-outline';
            cancelBtn.style.marginRight = '10px';
            cancelBtn.innerHTML = '<i class="fa-solid fa-times"></i> Vazgeç';
            cancelBtn.addEventListener('click', clearRezEditMode);
            submitBtn.parentElement.insertBefore(cancelBtn, submitBtn);
        }
    }
    
    document.getElementById('rezervForm').scrollIntoView({ behavior: 'smooth' });
};

// ── RESERVATION LOGIC ──────────────────────────────────────────
const renderReservations = () => {
    const body = document.getElementById('rezTableBody');
    const filter = document.getElementById('filterRezStatus').value;
    if(!body) return;
    body.innerHTML = '';

    const sorted = [...allReservations].sort((a,b) => {
        const dateA = a.date || "";
        const dateB = b.date || "";
        return dateB.localeCompare(dateA);
    });

    sorted.forEach(r => {
        if (filter === 'PENDING' && r.completed) return;
        if (filter === 'COMPLETED' && !r.completed) return;

        const total = (r.count || 0) * (r.price || 0);
        const tr = document.createElement('tr');
        if (r.completed) tr.style.opacity = '0.6';

        tr.innerHTML = `
            <td>
                <input type="checkbox" ${r.completed ? 'checked disabled' : ''} onchange="toggleRezStatus('${r.id}', this.checked)" title="Tamamlandı olarak işaretle">
            </td>
            <td>
                <div style="font-weight:600">${formatDate(r.date)}</div>
                <div style="font-size:0.7rem; color:var(--text-muted)">${r.time}</div>
            </td>
            <td style="text-align:left">
                <div style="font-weight:700">${r.customer}</div>
                <div style="font-size:0.75rem; color:var(--text-muted)"><i class="fa-solid fa-user"></i> ${r.contact || '-'}</div>
            </td>
            <td style="text-align:center;">
                <div style="font-size:0.85rem">Ödeyen: <b>${r.count}</b></div>
                <div style="font-size:0.75rem; color:var(--danger)">Free: ${r.freeCount || 0}</div>
                <div style="font-size:0.85rem; font-weight:700; color:var(--accent); border-top:1px solid rgba(255,255,255,0.1); margin-top:2px;">Toplam: ${r.totalCount || r.count}</div>
            </td>
            <td>
                <div style="font-size:0.8rem">${r.menu || '-'}</div>
                <div style="color:var(--amber)">${formatCurrency(r.price)} TL / Kişi</div>
            </td>
            <td style="font-weight:700; color:var(--success)">${formatCurrency(total)} TL</td>
            <td style="text-align:left; font-size:0.75rem">
                <div><b>Ödeme:</b> ${r.payment}</div>
                <div><b>Fatura:</b> ${r.invoice || '-'}</div>
                ${r.taxNumber ? `<div><b>V.N.:</b> ${r.taxNumber}</div>` : ''}
                ${r.taxOffice ? `<div><b>V.D.:</b> ${r.taxOffice}</div>` : ''}
                ${r.email ? `<div><b>E-posta:</b> <a href="mailto:${r.email}" style="color:var(--primary); font-size:0.75rem;">${r.email}</a></div>` : ''}
                ${r.address ? `<div style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${r.address}"><b>Adres:</b> ${r.address}</div>` : ''}
            </td>
            <td>
                <button class="btn-icon" onclick="addRezToCalendar('${r.id}')" title="Takvime Ekle" style="color:var(--amber); margin-right:5px;">
                    <i class="fa-solid fa-calendar-plus"></i>
                </button>
                ${!r.completed ? `
                    <button class="btn-icon" onclick="editReservation('${r.id}')" title="Düzenle" style="color:var(--primary); margin-right:5px;">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                ` : `
                    <button class="btn-icon" disabled style="opacity:0.4; cursor:not-allowed; margin-right:5px;" title="Onaylanmış rezervasyon düzenlenemez">
                        <i class="fa-solid fa-lock" style="color:var(--text-muted)"></i>
                    </button>
                `}
                <button class="btn-icon" onclick="deleteReservation('${r.id}')" title="Sil" ${r.completed ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''}>
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        body.appendChild(tr);
    });
};

document.getElementById('rezervForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const customerName = document.getElementById('rezCustomer').value.trim();
        const contact = document.getElementById('rezContact').value.trim();
        const invoice = document.getElementById('rezInvoice').value.trim();
        const taxOffice = document.getElementById('rezTaxOffice').value.trim();
        const taxNumber = document.getElementById('rezTaxNumber').value.trim();
        const address = document.getElementById('rezAddress').value.trim();
        const email = document.getElementById('rezEmail').value.trim();
        const count = parseInt(document.getElementById('rezCount').value) || 0;
        const freeCount = parseInt(document.getElementById('rezFreeCount').value) || 0;
        const timeStart = document.getElementById('rezTimeStart').value;
        const timeEnd = document.getElementById('rezTimeEnd').value;

        // If editing, perform safety check
        if (editingRezId) {
            const currentRez = allReservations.find(r => r.id === editingRezId);
            if (currentRez && currentRez.completed) {
                showToast('Onaylanmış rezervasyonlar güncellenemez!', 'error');
                clearRezEditMode();
                return;
            }
        }

        const data = {
            date: document.getElementById('rezDate').value,
            time: `${timeStart} - ${timeEnd}`,
            count: count,
            freeCount: freeCount,
            totalCount: count + freeCount,
            customer: customerName,
            contact: contact,
            menu: document.getElementById('rezMenu').value,
            price: parseFloat(document.getElementById('rezPrice').value) || 0,
            payment: document.getElementById('rezPayment').value,
            invoice: invoice,
            taxOffice: taxOffice,
            taxNumber: taxNumber,
            address: address,
            email: email,
            updatedAt: new Date().toISOString()
        };

        // If creating new, set completed to false and add createdAt
        if (!editingRezId) {
            data.completed = false;
            data.createdAt = new Date().toISOString();
        }

        // Müşteriyi otomatik kaydet/güncelle
        if (customerName) {
            const customerSlug = customerName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            if (customerSlug) {
                await db.collection(CUSTOMER_COLLECTION).doc(customerSlug).set({
                    name: customerName,
                    contact: contact || '',
                    invoice: invoice || '',
                    taxOffice: taxOffice || '',
                    taxNumber: taxNumber || '',
                    address: address || '',
                    email: email || '',
                    updatedAt: new Date().toISOString()
                }, { merge: true });
            }
        }

        if (editingRezId) {
            await db.collection(RESERV_COLLECTION).doc(editingRezId).update(data);
            showToast('Rezervasyon başarıyla güncellendi ✓', 'success');
            clearRezEditMode();
        } else {
            const docRef = await db.collection(RESERV_COLLECTION).add(data);
            showToast('Rezervasyon kaydedildi.', 'success');
            
            // Auto-trigger mobile calendar integration
            data.id = docRef.id;
            setTimeout(() => {
                showCalendarModal(data);
            }, 500);

            if (confirm('Rezervasyon Şeflere WhatsApp\'tan bildirilsin mi?')) {
                const text = "🔔 *YENİ GRUP REZERVASYONU*\n\n📅 Tarih: " + data.date + "\n⏰ Saat: " + data.time + "\n👥 Toplam Kişi: " + data.totalCount + " (" + data.count + " + " + (data.freeCount || 0) + " Free)\n📌 Grup: " + data.customer + "\n👤 İlgili Kişi: " + (data.contact || '-') + (data.email ? "\n✉ E-posta: " + data.email : "") + "\n🍽 Menü: " + (data.menu || '-') + (data.invoice ? "\n🧾 Fatura: " + data.invoice : "") + (data.taxNumber ? "\n🆔 V.N.: " + data.taxNumber : "") + (data.taxOffice ? "\n🏢 V.D.: " + data.taxOffice : "") + (data.address ? "\n📍 Adres: " + data.address : "") + "\n\nLütfen hazırlıklarınızı buna göre planlayın.";
                window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
            }
            e.target.reset();
            document.getElementById('rezTotalCount').value = '0';
        }
    } catch (err) {
        alert('HATA OLUŞTU: ' + err.message);
        console.error('Rezervasyon Hatası:', err);
    }
});

// Otomatik Toplam Hesaplama
const updateRezTotal = () => {
    const c = parseInt(document.getElementById('rezCount')?.value) || 0;
    const f = parseInt(document.getElementById('rezFreeCount')?.value) || 0;
    const totalEl = document.getElementById('rezTotalCount');
    if(totalEl) totalEl.value = c + f;
};
document.getElementById('rezCount')?.addEventListener('input', updateRezTotal);
document.getElementById('rezFreeCount')?.addEventListener('input', updateRezTotal);

// Otomatik Menü Fiyatı Doldurma
document.getElementById('rezMenu')?.addEventListener('input', (e) => {
    const val = e.target.value;
    const recipe = allRecipes.find(r => r.id === val);
    const prod = allProducts[val.replace(/\s+/g, '')];
    
    // Eğer Reçetede fiyat yoksa Ürün listesinden çek
    let price = 0;
    if (prod && prod.price) price = prod.price;
    // Eğer ikisinde de varsa ürün satış fiyatı önceliklidir, ama kullanıcının girmesi istenir
    if (price > 0) {
        document.getElementById('rezPrice').value = price;
    }
});

// Otomatik Müşteri Bilgisi Doldurma
document.getElementById('rezCustomer')?.addEventListener('input', (e) => {
    const val = e.target.value;
    const customer = allCustomers.find(c => c.name === val);
    if (customer) {
        if (customer.contact) document.getElementById('rezContact').value = customer.contact;
        if (customer.invoice) document.getElementById('rezInvoice').value = customer.invoice;
        if (customer.taxOffice) document.getElementById('rezTaxOffice').value = customer.taxOffice;
        if (customer.taxNumber) document.getElementById('rezTaxNumber').value = customer.taxNumber;
        if (customer.address) document.getElementById('rezAddress').value = customer.address;
        if (customer.email) document.getElementById('rezEmail').value = customer.email;
    }
});

document.getElementById('filterRezStatus')?.addEventListener('change', renderReservations);

window.toggleRezStatus = async (id, status) => {
    try {
        const rezDoc = allReservations.find(r => r.id === id);
        if (!rezDoc) return;

        await db.collection(RESERV_COLLECTION).doc(id).update({ completed: status });
        
        if (status) {
            const batch = db.batch();
            
            // 1. Satış olarak kaydet
            const saleRef = db.collection(SALES_COLLECTION).doc();
            batch.set(saleRef, {
                date: rezDoc.date,
                productName: rezDoc.menu || 'RESERV_MENU',
                amount: rezDoc.count,
                source: 'RESERV',
                rezId: id,
                createdAt: new Date().toISOString()
            });

            // 2. Stoktan Düşme İşlemi (Reçete varsa reçete, yoksa menü adı)
            const recipe = allRecipes.find(r => r.id === rezDoc.menu);
            if (recipe && recipe.ingredients) {
                for (const ing of recipe.ingredients) {
                    const reqAmount = ing.amount * (rezDoc.totalCount || rezDoc.count);
                    const stokRef = db.collection(STOK_COLLECTION).doc();
                    batch.set(stokRef, {
                        date: rezDoc.date,
                        productName: ing.name,
                        type: 'OUT',
                        amount: reqAmount,
                        notes: `Rez. (${rezDoc.customer}) - Reçete`,
                        createdAt: new Date().toISOString(),
                        rezId: id
                    });
                }
            } else if (rezDoc.menu) {
                const stokRef = db.collection(STOK_COLLECTION).doc();
                batch.set(stokRef, {
                    date: rezDoc.date,
                    productName: rezDoc.menu,
                    type: 'OUT',
                    amount: (rezDoc.totalCount || rezDoc.count),
                    notes: `Rez. (${rezDoc.customer})`,
                    createdAt: new Date().toISOString(),
                    rezId: id
                });
            }

            // 3. Finansal Tutarı Günlük Veriye İlave Etme İptal Edildi
            // Kullanıcı talebi: Rezervasyon ödemeleri Z Raporuna yansıtıldığı için çifte sayım olmaması adına Mali Analiz'e otomatik eklenmemelidir.


            await batch.commit();
            showToast('Ziyaret tamamlandı. Kasa ve Stoklar otomatik güncellendi.', 'success');

            if (confirm("Rezervasyon Muhasebe ve Şeflere WhatsApp'tan bildirilsin mi?")) {
                const total = (rezDoc.count * rezDoc.price).toFixed(2);
                const text = "✅ *REZERVASYON TAMAMLANDI*\n\n📅 Tarih: " + rezDoc.date + "\n📌 Grup: " + rezDoc.customer + "\n👤 İlgili Kişi: " + (rezDoc.contact || '-') + (rezDoc.email ? "\n✉ E-posta: " + rezDoc.email : "") + "\n👥 Gelen Kişi: " + rezDoc.count + " (+" + (rezDoc.freeCount || 0) + " Free)\n🍽 Menü: " + (rezDoc.menu || '-') + "\n💰 Toplam Tutar: " + total + " TL\n💳 Ödeme Türü: " + rezDoc.payment + "\n🧾 Fatura: " + (rezDoc.invoice || 'Yok') + (rezDoc.taxNumber ? "\n🆔 V.N.: " + rezDoc.taxNumber : "") + (rezDoc.taxOffice ? "\n🏢 V.D.: " + rezDoc.taxOffice : "") + (rezDoc.address ? "\n📍 Adres: " + rezDoc.address : "") + "\n\nSistem kayıtlarına başarıyla işlenmiştir.";
                window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank");
            }
        } else {
            // Eğer onay geri alındıysa (beklemeye alındı)
            const sale = allSales.find(s => s.rezId === id);
            if(sale) await db.collection(SALES_COLLECTION).doc(sale.id).delete();

            // Stok hareketlerini geri al
            const stokDocs = await db.collection(STOK_COLLECTION).where('rezId', '==', id).get();
            if (!stokDocs.empty) {
                const batch = db.batch();
                stokDocs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
            }
            showToast('Ziyaret beklemeye alındı. Satış ve stok düşümleri iptal edildi.');
        }
    } catch (e) { 
        showToast('Hata oluştu!', 'error'); 
        console.error(e);
    }
};

window.deleteReservation = async (id) => {
    if(!confirm('Bu rezervasyonu silmek istediğinize emin misiniz?')) return;
    try {
        await db.collection(RESERV_COLLECTION).doc(id).delete();
        showToast('Rezervasyon silindi.');
    } catch (e) { showToast('Hata!', 'error'); }
};

const getCalendarDates = (dateStr, timeStart, timeEnd) => {
    timeStart = (timeStart || '12:00').trim();
    timeEnd = (timeEnd || '14:00').trim();
    
    const padZero = (num) => String(num).padStart(2, '0');
    
    const formatTimePart = (timeStr) => {
        const parts = timeStr.split(':');
        const h = padZero(parts[0] || '12');
        const m = padZero(parts[1] || '00');
        return `${h}${m}00`;
    };
    
    const formatTimeForISO = (timeStr) => {
        const parts = timeStr.split(':');
        const h = padZero(parts[0] || '12');
        const m = padZero(parts[1] || '00');
        return `${h}:${m}`;
    };
    
    const cleanDateStr = dateStr.replace(/[^0-9]/g, '');
    const startLocal = `${cleanDateStr}T${formatTimePart(timeStart)}`;
    const endLocal = `${cleanDateStr}T${formatTimePart(timeEnd)}`;
    
    const isoTimeStart = formatTimeForISO(timeStart);
    const isoTimeEnd = formatTimeForISO(timeEnd);
    
    let startUTC = '';
    let endUTC = '';
    
    try {
        const startD = new Date(`${dateStr}T${isoTimeStart}:00+03:00`);
        const endD = new Date(`${dateStr}T${isoTimeEnd}:00+03:00`);
        if (!isNaN(startD.getTime()) && !isNaN(endD.getTime())) {
            startUTC = startD.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            endUTC = endD.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        } else {
            throw new Error('Invalid Date');
        }
    } catch (e) {
        try {
            const startD = new Date(`${dateStr}T${isoTimeStart}:00`);
            const endD = new Date(`${dateStr}T${isoTimeEnd}:00`);
            if (!isNaN(startD.getTime()) && !isNaN(endD.getTime())) {
                const startUTC_ms = startD.getTime() - (3 * 60 * 60 * 1000);
                const endUTC_ms = endD.getTime() - (3 * 60 * 60 * 1000);
                startUTC = new Date(startUTC_ms).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                endUTC = new Date(endUTC_ms).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            } else {
                throw new Error('Fallback failed');
            }
        } catch (e2) {
            startUTC = `${cleanDateStr}T${formatTimePart(timeStart)}Z`;
            endUTC = `${cleanDateStr}T${formatTimePart(timeEnd)}Z`;
        }
    }
    
    return { startLocal, endLocal, startUTC, endUTC };
};

const downloadICS = (rez) => {
    const title = `Rezervasyon: ${rez.customer}`;
    let description = `Grup: ${rez.customer}\nKişi: ${rez.count}`;
    if (rez.freeCount) description += ` (+${rez.freeCount} Free)`;
    if (rez.menu) description += `\nMenü: ${rez.menu}`;
    if (rez.contact) description += `\nİletişim: ${rez.contact}`;
    if (rez.payment) description += `\nÖdeme: ${rez.payment}`;
    
    // Parse time
    let timeStart = '12:00';
    let timeEnd = '14:00';
    if (rez.time) {
        const parts = rez.time.split(' - ');
        if (parts.length === 2) {
            timeStart = parts[0];
            timeEnd = parts[1];
        }
    }
    
    const dates = getCalendarDates(rez.date, timeStart, timeEnd);
    
    const icsLines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Sultanahmet Koftecisi//Rezervasyon Takvimi//TR',
        'CALSCALE:GREGORIAN',
        'BEGIN:VEVENT',
        `UID:${rez.id || Date.now()}@sultanahmetkoftecisi.com`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
        `DTSTART:${dates.startUTC}`,
        `DTEND:${dates.endUTC}`,
        `SUMMARY:${title}`,
        `DESCRIPTION:${description.replace(/\n/g, '\\n')}`,
        'END:VEVENT',
        'END:VCALENDAR'
    ];
    
    const icsContent = icsLines.join('\r\n');
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `rezervasyon_${rez.customer.replace(/[^a-zA-Z0-9]/g, '_')}_${rez.date}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const showCalendarModal = (rez) => {
    // Remove existing modal if any
    const existing = document.getElementById('calendarModal');
    if (existing) existing.remove();

    // Create modal element
    const modal = document.createElement('div');
    modal.id = 'calendarModal';
    modal.style.cssText = `
        position:fixed; top:0; left:0; width:100%; height:100%;
        background:rgba(15,23,42,0.75); backdrop-filter:blur(6px);
        display:flex; align-items:center; justify-content:center;
        z-index:99999; animation: fadeIn 0.2s ease;
    `;

    const title = `Rezervasyon: ${rez.customer}`;
    let description = `Grup: ${rez.customer}\nKişi: ${rez.count}`;
    if (rez.freeCount) description += ` (+${rez.freeCount} Free)`;
    if (rez.menu) description += `\nMenü: ${rez.menu}`;
    if (rez.contact) description += `\nİletişim: ${rez.contact}`;
    if (rez.payment) description += `\nÖdeme: ${rez.payment}`;
    
    // Parse time
    let timeStart = '12:00';
    let timeEnd = '14:00';
    if (rez.time) {
        const parts = rez.time.split(' - ');
        if (parts.length === 2) {
            timeStart = parts[0];
            timeEnd = parts[1];
        }
    }
    
    const dates = getCalendarDates(rez.date, timeStart, timeEnd);
    const googleUrl = `https://calendar.google.com/calendar/r/eventedit?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${dates.startLocal}/${dates.endLocal}&details=${encodeURIComponent(description)}&ctz=Europe/Istanbul`;

    const content = document.createElement('div');
    content.className = 'glass-panel';
    content.style.cssText = `
        max-width:400px; width:90%; padding:1.5rem; border-radius:12px;
        background:rgba(30,41,59,0.9); border:1px solid rgba(255,255,255,0.15);
        color:white; text-align:center; box-shadow:0 15px 30px rgba(0,0,0,0.5);
    `;
    
    content.innerHTML = `
        <h3 style="margin-top:0; margin-bottom:0.75rem; font-size:1.2rem; color:#93c5fd; display:flex; align-items:center; justify-content:center; gap:0.5rem;"><i class="fa-solid fa-calendar-plus"></i> Takvime Ekle</h3>
        <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1.5rem; line-height:1.4;">Lütfen eklemek istediğiniz takvim uygulamasını seçin:</p>
        <div style="display:flex; flex-direction:column; gap:0.75rem; margin-bottom:1.5rem;">
            <a href="${googleUrl}" target="_blank" class="btn btn-primary" style="display:inline-flex; align-items:center; justify-content:center; gap:0.5rem; text-decoration:none; padding:0.6rem; color:white; font-weight:600; font-size:0.9rem;" onclick="document.getElementById('calendarModal').remove()">
                <i class="fa-brands fa-google"></i> Google Takvim'e Ekle
            </a>
            <button id="btnIcalDownload" class="btn btn-success" style="display:inline-flex; align-items:center; justify-content:center; gap:0.5rem; padding:0.6rem; font-weight:600; font-size:0.9rem;">
                <i class="fa-solid fa-download"></i> Telefon Takvimine Ekle (iCal/ICS)
            </button>
        </div>
        <button class="btn btn-outline btn-sm" onclick="document.getElementById('calendarModal').remove()" style="width:100%;">Kapat</button>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    // Setup ICS Download trigger
    document.getElementById('btnIcalDownload').addEventListener('click', () => {
        downloadICS(rez);
        modal.remove();
    });
};

window.addRezToCalendar = (id) => {
    const rez = allReservations.find(r => r.id === id);
    if (!rez) return;
    showCalendarModal(rez);
};

// --- DATA LISTENERS ---
const initReservations = () => {
    db.collection(RESERV_COLLECTION).orderBy('date', 'desc').onSnapshot(snap => {
        allReservations = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderReservations();
        if (typeof allData !== 'undefined' && Array.isArray(allData)) {
            updateKPIs(allData); // Güncel rezervasyon geliri KPI'a yansısın
        }
    });

    db.collection(CUSTOMER_COLLECTION).onSnapshot(snap => {
        allCustomers = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const list = document.getElementById('rezCustomerList');
        if (list) {
            list.innerHTML = '';
            allCustomers.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.name;
                list.appendChild(opt);
            });
        }
    });

    db.collection(RECIPE_COLLECTION).onSnapshot(snap => {
        allRecipes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const list = document.getElementById('rezMenuList');
        if (list) {
            list.innerHTML = '';
            allRecipes.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.id; // Recipe names are IDs
                list.appendChild(opt);
            });
        }
    });
};



// ── PRODUCTION & RECIPE LOGIC ──────────────────────────────────
window.addIngredientRow = () => {
    const container = document.getElementById('recipeIngredients');
    const div = document.createElement('div');
    div.className = 'ingredient-row';
    div.style.display = 'grid';
    div.style.gridTemplateColumns = '2fr 1fr 40px';
    div.style.gap = '0.5rem';
    div.style.marginBottom = '0.5rem';
    div.innerHTML = `
        <input type="text" class="ing-name" list="productList" placeholder="Malzeme" required>
        <input type="number" step="0.001" class="ing-amount" placeholder="Miktar" required>
        <button type="button" class="btn-icon" onclick="this.parentElement.remove()"><i class="fa-solid fa-times"></i></button>
    `;
    container.appendChild(div);
};

const renderUretim = () => {
    const body = document.getElementById('uretimTableBody');
    const select = document.getElementById('uretimProductSelect');
    if(!body) return;
    body.innerHTML = '';
    
    // Update select options for production
    const currentVal = select.value;
    select.innerHTML = '<option value="">Reçeteli Ürün Seçin...</option>' + 
        allRecipes.map(r => `<option value="${r.id}">${r.id}</option>`).join('');
    select.value = currentVal;

    const sorted = [...allUretim].sort((a,b) => b.date.localeCompare(a.date));

    sorted.forEach(u => {
        const tr = document.createElement('tr');
        const unitCost = u.totalCost / u.amount;
        tr.innerHTML = `
            <td>${formatDate(u.date)}</td>
            <td style="font-weight:700">${u.productName}</td>
            <td>${u.amount} Adet</td>
            <td>${formatCurrency(unitCost)} TL</td>
            <td class="toplam-col" style="color:var(--danger)">${formatCurrency(u.totalCost)} TL</td>
            <td>
                <button class="btn-icon" onclick="deleteUretim('${u.id}')" title="Üretimi Sil"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        body.appendChild(tr);
    });
};

document.getElementById('recipeForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const product = document.getElementById('recipeProduct').value.toUpperCase().trim();
    const rows = document.querySelectorAll('.ingredient-row');
    const ingredients = [];
    
    rows.forEach(row => {
        const name = row.querySelector('.ing-name').value.toUpperCase().trim();
        const amount = parseFloat(row.querySelector('.ing-amount').value) || 0;
        if(name && amount > 0) ingredients.push({ name, amount });
    });

    try {
        await db.collection(RECIPE_COLLECTION).doc(product).set({ ingredients, updatedAt: new Date().toISOString() });
        showToast('Reçete kaydedildi.');
    } catch (err) { showToast('Hata!', 'error'); }
});

const updateUretimPreview = () => {
    const productName = document.getElementById('uretimProductSelect')?.value;
    const amount = parseFloat(document.getElementById('uretimAmount')?.value) || 1;
    const previewDiv = document.getElementById('uretimIngredientsPreview');
    
    if (!previewDiv) return;
    
    if (!productName) {
        previewDiv.style.display = 'none';
        return;
    }
    
    const recipe = allRecipes.find(r => r.id === productName);
    if (!recipe || !recipe.ingredients || recipe.ingredients.length === 0) {
        previewDiv.style.display = 'none';
        return;
    }
    
    // Üretilen ürünün birimini bul
    const prodDef = Object.values(allProducts).find(p => p.name.trim().toLowerCase() === productName.trim().toLowerCase());
    const prodUnit = prodDef && prodDef.unit ? prodDef.unit : 'Adet/Porsiyon';
    
    let html = `<strong><i class="fa-solid fa-flask"></i> Kullanılacak Malzemeler (${amount} ${prodUnit} için):</strong><ul style="margin-top: 5px; padding-left: 20px; margin-bottom: 0;">`;
    recipe.ingredients.forEach(ing => {
        const totalAmount = (ing.amount * amount).toFixed(2);
        // Malzemenin birimini bul
        const ingDef = Object.values(allProducts).find(p => p.name.trim().toLowerCase() === ing.name.trim().toLowerCase());
        const ingUnit = ingDef && ingDef.unit ? ingDef.unit : 'birim';
        html += `<li>${ing.name}: <strong>${totalAmount}</strong> ${ingUnit}</li>`;
    });
    html += '</ul>';
    
    previewDiv.innerHTML = html;
    previewDiv.style.display = 'block';
};

document.getElementById('uretimProductSelect')?.addEventListener('change', updateUretimPreview);
document.getElementById('uretimAmount')?.addEventListener('input', updateUretimPreview);

document.getElementById('dailyUretimForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const date = document.getElementById('uretimDate').value;
    const productName = document.getElementById('uretimProductSelect').value;
    const amount = parseFloat(document.getElementById('uretimAmount').value) || 0;

    const recipe = allRecipes.find(r => r.id === productName);
    if(!recipe) return showToast('Reçete bulunamadı!', 'error');

    try {
        let totalCost = 0;
        const batch = db.batch();

        // Her malzeme için stoktan düş ve maliyet hesapla
        for(const ing of recipe.ingredients) {
            const ingSlug = ing.name.replace(/\s+/g, '_').toLowerCase();
            const requiredAmount = ing.amount * amount;
            const ingPrice = (allProducts[ingSlug] ? allProducts[ingSlug].price : 0);
            totalCost += requiredAmount * ingPrice;

            // Stok hareketi ekle
            const stokRef = db.collection(STOK_COLLECTION).doc();
            batch.set(stokRef, {
                date,
                productName: ing.name,
                type: 'OUT',
                amount: requiredAmount,
                notes: `${productName} üretimi için reçeteden düşüldü`,
                createdAt: new Date().toISOString()
            });
        }

        // Üretim günlüğü ekle
        const uretimRef = db.collection(URETIM_COLLECTION).doc();
        batch.set(uretimRef, {
            date,
            productName,
            amount,
            totalCost,
            createdAt: new Date().toISOString()
        });

        await batch.commit();
        showToast('Üretim kaydedildi, stoklar güncellendi.');
        e.target.reset();
    } catch (err) { showToast('Hata!', 'error'); }
});

window.deleteUretim = async (id) => {
    if(!confirm('Bu üretim kaydını silmek istiyor musunuz? (Not: Stok hareketleri geri alınmaz)')) return;
    try {
        await db.collection(URETIM_COLLECTION).doc(id).delete();
        showToast('Üretim kaydı silindi.');
    } catch (e) { showToast('Hata!', 'error'); }
};

const initUretim = () => {
    db.collection(RECIPE_COLLECTION).onSnapshot(snap => {
        allRecipes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderUretim();
    });
    db.collection(URETIM_COLLECTION).orderBy('date', 'desc').onSnapshot(snap => {
        allUretim = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderUretim();
        renderMamulStok();
    });
    db.collection(SALES_COLLECTION).orderBy('date', 'desc').onSnapshot(snap => {
        allSales = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderSales();
        renderMamulStok();
    });
};

// ── SALES & MAMUL STOK LOGIC ──────────────────────────────────
const renderSales = () => {
    const body = document.getElementById('salesTableBody');
    const select = document.getElementById('salesProductSelect');
    if(!body) return;
    body.innerHTML = '';

    // Update select options
    const currentVal = select.value;
    select.innerHTML = '<option value="">Ürün Seçin...</option>' + 
        allRecipes.map(r => `<option value="${r.id}">${r.id}</option>`).join('');
    select.value = currentVal;

    // Filtre değerleri
    const urunFilter = (document.getElementById('filterSatisUrun')?.value || '').toLowerCase().trim();
    const startDate  = document.getElementById('filterSatisStart')?.value || '1970-01-01';
    const endDate    = document.getElementById('filterSatisEnd')?.value   || '2099-12-31';
    const sortMode   = document.getElementById('filterSatisSort')?.value  || 'date_desc';

    // Filtrele
    let filtered = allSales.filter(s => {
        if (urunFilter && !(s.productName || '').toLowerCase().includes(urunFilter)) return false;
        if (s.date < startDate || s.date > endDate) return false;
        return true;
    });

    // Sırala
    filtered.sort((a, b) => {
        if (sortMode === 'date_asc')  return a.date.localeCompare(b.date) || (a.productName||'').localeCompare(b.productName||'', 'tr');
        if (sortMode === 'date_desc') return b.date.localeCompare(a.date) || (a.productName||'').localeCompare(b.productName||'', 'tr');
        if (sortMode === 'name_asc')  return (a.productName||'').localeCompare(b.productName||'', 'tr') || a.date.localeCompare(b.date);
        if (sortMode === 'name_desc') return (b.productName||'').localeCompare(a.productName||'', 'tr') || a.date.localeCompare(b.date);
        return 0;
    });

    // Kayıt sayısı
    const countEl = document.getElementById('satisRecordCount');
    if (countEl) countEl.textContent = `${filtered.length} Kayıt`;

    // Boş durum
    const emptyEl = document.getElementById('satisEmptyState');
    const tableEl = document.getElementById('salesTable');
    if (filtered.length === 0) {
        if (emptyEl) emptyEl.classList.remove('hidden');
        if (tableEl) tableEl.classList.add('hidden');
        return;
    }
    if (emptyEl) emptyEl.classList.add('hidden');
    if (tableEl) tableEl.classList.remove('hidden');

    filtered.forEach(s => {
        let sourceText = 'Manuel';
        if (s.source === 'RESERV') sourceText = 'Rezervasyon';
        if (s.source === 'EXCEL')  sourceText = 'Excel Aktarımı';
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDate(s.date)}</td>
            <td style="font-weight:700">${s.productName}</td>
            <td>${s.amount} Adet</td>
            <td><span class="badge">${sourceText}</span></td>
            <td>
                <button class="btn-icon" onclick="deleteSale('${s.id}')" title="Satışı Sil"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        body.appendChild(tr);
    });
};


const renderMamulStok = () => {
    const body = document.getElementById('mamulStokBody');
    if(!body) return;
    body.innerHTML = '';

    // Üretilen her ürün için bakiye hesapla
    const balances = {};
    allRecipes.forEach(r => {
        balances[r.id] = { produced: 0, sold: 0 };
    });

    allUretim.forEach(u => {
        if(balances[u.productName]) balances[u.productName].produced += (u.amount || 0);
    });

    allSales.forEach(s => {
        if(balances[s.productName]) balances[s.productName].sold += (s.amount || 0);
    });

    Object.keys(balances).forEach(pName => {
        const b = balances[pName];
        const stock = b.produced - b.sold;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:700">${pName}</td>
            <td style="color:var(--success)">${b.produced} Adet</td>
            <td style="color:var(--danger)">${b.sold} Adet</td>
            <td class="toplam-col" style="font-weight:800; font-size:1rem">${stock} Adet</td>
        `;
        body.appendChild(tr);
    });
};

document.getElementById('dailySalesForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        date: document.getElementById('salesDate').value,
        productName: document.getElementById('salesProductSelect').value,
        amount: parseFloat(document.getElementById('salesAmount').value) || 0,
        source: 'MANUAL',
        createdAt: new Date().toISOString()
    };

    try {
        await db.collection(SALES_COLLECTION).add(data);
        showToast('Satış başarıyla kaydedildi.');
        e.target.reset();
    } catch (err) { showToast('Hata!', 'error'); }
});

window.deleteSale = async (id) => {
    if(!confirm('Bu satış kaydını silmek istiyor musunuz?')) return;
    try {
        await db.collection(SALES_COLLECTION).doc(id).delete();
        showToast('Satış kaydı silindi.');
    } catch (e) { showToast('Hata!', 'error'); }
};

// ── SALES FILE UPLOAD ──────────────────────────────────────────
const salesDropZone = document.getElementById('salesDropZone');
const salesFileInput = document.getElementById('salesFileInput');
const salesUploadStatus = document.getElementById('salesUploadStatus');

salesDropZone?.addEventListener('dragover', (e) => { e.preventDefault(); salesDropZone.classList.add('dragover'); });
salesDropZone?.addEventListener('dragleave', () => salesDropZone.classList.remove('dragover'));
salesDropZone?.addEventListener('drop', async (e) => {
    e.preventDefault();
    salesDropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) await handleSalesFiles(e.dataTransfer.files);
});


salesFileInput?.addEventListener('change', async (e) => {
    if (e.target.files.length) await handleSalesFiles(e.target.files);
});

// Global handler for HTML attribute
window.onSalesFileChange = async (input) => {
    if (input.files && input.files.length) {
        await handleSalesFiles(input.files);
    }
};

const handleSalesFiles = async (files) => {
    salesUploadStatus.style.color = 'var(--amber)';
    salesUploadStatus.textContent = 'İşleniyor...';
    
    // Step 1: XLSX library check
    if (typeof XLSX === 'undefined') {
        salesUploadStatus.style.color = 'var(--danger)';
        salesUploadStatus.textContent = '❌ HATA: Excel kütüphanesi (XLSX) yüklenemedi! Sayfayı yenileyin.';
        return;
    }
    
    let added = 0;
    for (const file of files) {
        salesUploadStatus.textContent = `"${file.name}" okunuyor...`;
        try {
            const data = await parseSalesExcel(file);
            salesUploadStatus.textContent = `${data.length} kayıt bulundu, kaydediliyor...`;
            
            if (data && data.length > 0) {
                // Batch max 500 doc
                const chunkSize = 400;
                for (let i = 0; i < data.length; i += chunkSize) {
                    const chunk = data.slice(i, i + chunkSize);
                    const batch = db.batch();
                    chunk.forEach(item => {
                        const ref = db.collection(SALES_COLLECTION).doc();
                        batch.set(ref, { ...item, source: 'EXCEL', createdAt: new Date().toISOString() });
                    });
                    await batch.commit();
                }
                added += data.length;
            } else {
                salesUploadStatus.style.color = 'var(--danger)';
                salesUploadStatus.textContent = `⚠️ "${file.name}" dosyasında geçerli satış verisi bulunamadı.`;
            }
        } catch (err) { 
            console.error(err); 
            salesUploadStatus.style.color = 'var(--danger)';
            salesUploadStatus.textContent = `❌ Hata: ${err.message}`;
        }
    }
    
    if (added > 0) {
        salesUploadStatus.style.color = 'var(--success)';
        salesUploadStatus.textContent = `✅ ${added} satış kaydı başarıyla aktarıldı!`;
        showToast(`${added} adet satış verisi başarıyla yüklendi.`);
    } else {
        showToast('Yüklenecek uygun satış verisi bulunamadı.', 'error');
    }
    setTimeout(() => { salesUploadStatus.textContent = ''; salesUploadStatus.style.color = ''; }, 8000);
    salesFileInput.value = '';
};

const parseSalesExcel = async (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                // Raw data as array of arrays to handle various header positions
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

                console.log('Raw Excel Rows:', rows);

                // Dosya adından tarih çekme
                let fileDate = new Date().toISOString().split('T')[0];
                const dateMatch = file.name.match(/(\d{1,2})[.\-](\d{1,2})[.\-](\d{4})/);
                if (dateMatch) {
                    fileDate = `${dateMatch[3]}-${dateMatch[2].padStart(2,'0')}-${dateMatch[1].padStart(2,'0')}`;
                }

                const results = [];
                rows.forEach(row => {
                    // Satır boşsa veya çok kısaysa atla
                    if (!row || row.length < 2) return;

                    // Sağdan sola doğru tarayarak ilk geçerli sayıyı (adet) bulalım
                    let numIdx = -1;
                    let amount = 0;
                    
                    // Genelde son kolonlarda sayı olur, sondan başa tarıyoruz
                    for (let i = row.length - 1; i >= 1; i--) {
                        let val = row[i];
                        if (val === null || val === undefined || val === "") continue;
                        
                        // Değer string ise sayıya çevirmeyi dene (Örn: "1.050,00 TL" -> 1050)
                        if (typeof val === 'string') {
                            let cleanStr = val.replace(/[^0-9,.]/g, '').trim();
                            if (cleanStr) {
                                // Binlik ayırıcıyı kaldır, virgülü noktaya çevir
                                let parsed = parseFloat(cleanStr.replace(/\./g, '').replace(',', '.'));
                                if (!isNaN(parsed)) val = parsed;
                            }
                        }

                        if (typeof val === 'number' && !isNaN(val) && val > 0) {
                            numIdx = i;
                            amount = val;
                            break;
                        }
                    }

                    // Eğer sayı bulduysak, hemen solundaki hücre ürün adıdır
                    if (numIdx > 0) {
                        let cellVal = row[numIdx - 1];
                        if (cellVal !== null && cellVal !== undefined) {
                            const productName = cellVal.toString().trim();
                            if (productName) {
                                const upperVal = productName.toUpperCase('tr-TR');
                                // Özet satırlarını ele (TOTAL, TOPLAM vb.)
                                if (!upperVal.includes('TOTAL') && !upperVal.includes('TOPLAM') && !upperVal.includes('GENEL') && !upperVal.includes('TOPLAMI')) {
                                    results.push({
                                        date: fileDate,
                                        productName: upperVal,
                                        amount: amount
                                    });
                                }
                            }
                        }
                    }
                });

                console.log(`Excel'den ${results.length} geçerli satır okundu.`);
                resolve(results);
            } catch (err) { 
                console.error('Excel Ayrıştırma Hatası:', err);
                reject(err); 
            }
        };
        reader.readAsArrayBuffer(file);
    });
};

// =========================================================
// OTO-GÜNCELLEME SİSTEMİ (HIZLI EXCEL / PDF YÜKLEYİCİ)
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
    const autoInput = document.getElementById('autoUpdateInput');
    if (autoInput) {
        autoInput.addEventListener('change', async (e) => {
            if (!e.target.files.length) return;
            const files = Array.from(e.target.files);
            
            showToast('Toplu işleme başladı, lütfen bekleyin...', 'info');
            let pdfCount = 0;
            let excelCount = 0;
            let salesAdded = 0;



            for (const file of files) {
                const ext = file.name.split('.').pop().toLowerCase();
                
                try {
                    // 1. PDF İŞLEME (Mali Analiz Raporları)
                    if (ext === 'pdf') {
                        const text = await extractTextFromPDF(file);
                        const rec = parseDataFromText(text, file.name);
                        if (rec) {
                            await db.collection(COLLECTION).doc(rec.date).set(rec, { merge: true });
                            pdfCount++;
                        }
                    }
                    // 2. EXCEL İŞLEME (Satışlar ve Reçete Düşümleri)
                    else if (ext === 'xlsx' || ext === 'xls') {
                        if (typeof XLSX === 'undefined') {
                            showToast('Excel kütüphanesi yüklenemedi.', 'error');
                            continue;
                        }
                        
                        const data = await parseSalesExcel(file);
                        if (data && data.length > 0) {
                            // Reçeteleri al (Satışları hammaddeden düşmek için)
                            const recipesSnap = await db.collection(RECIPE_COLLECTION).get();
                            const recipes = {};
                            recipesSnap.forEach(doc => {
                                recipes[doc.data().name.toUpperCase('tr-TR')] = doc.data().ingredients;
                            });

                            const processedOuts = [];
                            for (const sale of data) {
                                const prodName = sale.productName;
                                if (recipes[prodName]) {
                                    // Reçetesi var, hammaddeleri düş
                                    for (const ing of recipes[prodName]) {
                                        processedOuts.push({
                                            date: sale.date,
                                            product: ing.name.toUpperCase('tr-TR'),
                                            amount: ing.amount * sale.amount
                                        });
                                    }
                                } else {
                                    // Reçetesi yok, direkt kendisini düş
                                    processedOuts.push({
                                        date: sale.date,
                                        product: prodName,
                                        amount: sale.amount
                                    });
                                }
                            }

                            // Firebase'e Stok Çıkışlarını Yaz
                            const chunkSize = 400;
                            for (let i = 0; i < processedOuts.length; i += chunkSize) {
                                const chunk = processedOuts.slice(i, i + chunkSize);
                                const batch = db.batch();
                                for (const item of chunk) {
                                    // Ürünü aktif et
                                    const productSlug = item.product.replace(/\s+/g, '').replace(/,/g, '');
                                    const prodRef = db.collection(PRODUCT_COLLECTION).doc(productSlug);
                                    batch.set(prodRef, {
                                        name: item.product, isActive: true, unit: 'ADET', updatedAt: new Date().toISOString()
                                    }, { merge: true });

                                    // Stok hareketini yaz
                                    const id = item.date.replace(/-/g, '') + '_OUT_' + productSlug + '_' + Math.random().toString(36).substr(2, 5);
                                    const stokRef = db.collection(STOK_COLLECTION).doc(id);
                                    batch.set(stokRef, {
                                        id: id,
                                        date: item.date,
                                        type: 'OUT',
                                        productName: item.product,
                                        amount: item.amount,
                                        price: 0,
                                        unit: 'ADET',
                                        updatedAt: new Date().toISOString(),
                                        source: 'AUTO_EXCEL'
                                    }, { merge: true });
                                }
                                await batch.commit();
                            }
                            excelCount++;
                            salesAdded += data.length;
                        }
                    }
                } catch (err) {
                    console.error('Hata:', file.name, err);
                }
            }
            
            showToast("İşlem Tamam! " + pdfCount + " PDF okundu. " + excelCount + " Excel'den " + salesAdded + " satış stoklardan düşüldü.", 'success');
            autoInput.value = '';
        });
    }
});



// ══════════════════════════════════════════════════════════════════════════
// TEDARİKÇİ & FATURA YÖNETİMİ MODÜLÜ
// ══════════════════════════════════════════════════════════════════════════

const initFaturaModule = () => {
    // Tedarikçiler
    db.collection(TEDARIKCI_COLLECTION).onSnapshot(snap => {
        allTedarikciler = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderTedarikci();
        populateTedarikciSelects();
    });
    // Faturalar
    db.collection(FATURA_COLLECTION).orderBy('faturaDate','desc').onSnapshot(snap => {
        allFaturalar = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderFaturalar();
        renderFiyatUyarilari();
    });
    // Ödemeler
    db.collection(FATURA_ODEME_COLLECTION).orderBy('date','desc').onSnapshot(snap => {
        allFaturaOdemeler = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderFaturalar();
        renderTedarikci();
    });
    // Ödeme tarihi default
    const odemeT = document.getElementById('odemeTarih');
    if (odemeT) odemeT.valueAsDate = new Date();
};

// initApp içine entegre et
const _origInitApp = initApp;

// ── Tedarikçi tablosu ──────────────────────────────────────────────────────
const renderTedarikci = () => {
    const body = document.getElementById('tedarikciBody');
    if (!body) return;
    body.innerHTML = '';

    // Her tedarikçi için ödeme toplamını hesapla
    const paidMap = {};
    allFaturaOdemeler.forEach(o => {
        const v = o.supplierVkn || '';
        paidMap[v] = (paidMap[v] || 0) + (o.amount || 0);
    });

    let totalDebt = 0, activeCount = 0;
    allTedarikciler.sort((a,b) => (b.currentBalance||0) - (a.currentBalance||0));
    allTedarikciler.forEach(t => {
        const paid   = paidMap[t.vkn] || 0;
        const kalan  = (t.currentBalance || 0) - paid;
        totalDebt += kalan > 0 ? kalan : 0;
        if (kalan > 0) activeCount++;

        const statusHtml = kalan <= 0
            ? `<span class="badge" style="background:rgba(16,185,129,0.2);color:#10b981">Kapatıldı</span>`
            : `<span class="badge" style="background:rgba(239,68,68,0.2);color:#ef4444">Açık Borç</span>`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:700;text-align:left">${t.name || t.id}</td>
            <td style="font-size:0.8rem;color:var(--text-muted)">${t.vkn || '-'}</td>
            <td style="font-size:0.8rem">${[t.tel, t.email].filter(Boolean).join(' | ') || '-'}</td>
            <td style="font-size:0.75rem;color:var(--text-muted)">${t.iban ? t.iban.replace(/(.{4})/g,'$1 ').trim() : '-'}</td>
            <td style="text-align:right;color:var(--danger)">${formatCurrency(t.currentBalance)} TL</td>
            <td style="text-align:right;color:var(--success)">${formatCurrency(paid)} TL</td>
            <td class="toplam-col" style="text-align:right;font-weight:800;color:${kalan>0?'var(--danger)':'var(--success)'}">${formatCurrency(kalan)} TL</td>
            <td>${statusHtml}</td>
        `;
        body.appendChild(tr);
    });

    // KPI güncelle
    const el = id => document.getElementById(id);
    if (el('kpiFaturaTedarikci'))  el('kpiFaturaTedarikci').textContent  = allTedarikciler.length;
    if (el('kpiFaturaBorcToplam')) el('kpiFaturaBorcToplam').textContent = formatCurrency(totalDebt) + ' TL';
    const acikFaturaSayisi = allFaturalar.filter(f => f.status !== 'ODENDI').length;
    if (el('kpiFaturaAcik')) el('kpiFaturaAcik').textContent = acikFaturaSayisi;
};

// ── Fatura listesi ─────────────────────────────────────────────────────────
window.renderFaturalar = () => {
    const body      = document.getElementById('faturaListeBody');
    const emptyEl   = document.getElementById('faturaEmptyState');
    const tableEl   = document.getElementById('faturaListeTable');
    const countEl   = document.getElementById('faturaRecordCount');
    if (!body) return;

    const filterVkn    = document.getElementById('filterFaturaTedarikci')?.value || '';
    const filterStatus = document.getElementById('filterFaturaStatus')?.value    || '';
    const startDate    = document.getElementById('filterFaturaStart')?.value     || '1970-01-01';
    const endDate      = document.getElementById('filterFaturaEnd')?.value       || '2099-12-31';

    // Her fatura için ödenen tutarı hesapla
    const paidByFatura = {};
    allFaturaOdemeler.forEach(o => {
        const fid = o.faturaId || '';
        paidByFatura[fid] = (paidByFatura[fid] || 0) + (o.amount || 0);
    });

    let filtered = allFaturalar.filter(f => {
        if (filterVkn    && f.supplierVkn !== filterVkn) return false;
        if (filterStatus && f.status      !== filterStatus) return false;
        if ((f.faturaDate||'') < startDate || (f.faturaDate||'') > endDate) return false;
        return true;
    });

    body.innerHTML = '';
    if (countEl) countEl.textContent = `${filtered.length} Fatura`;

    if (filtered.length === 0) {
        if (emptyEl) emptyEl.classList.remove('hidden');
        if (tableEl) tableEl.classList.add('hidden');
        return;
    }
    if (emptyEl) emptyEl.classList.add('hidden');
    if (tableEl) tableEl.classList.remove('hidden');

    filtered.forEach(f => {
        const paid  = paidByFatura[f.id] || 0;
        const kalan = (f.totalAmount || 0) - paid;
        const liveStatus = kalan <= 0 ? 'ODENDI' : (paid > 0 ? 'KISMI' : 'ODENMEDI');

        const statusLabels = { ODENMEDI: ['Ödenmedi','#ef4444'], KISMI: ['Kısmi','#f59e0b'], ODENDI: ['Ödendi','#10b981'] };
        const [sLabel, sColor] = statusLabels[liveStatus] || ['?','gray'];
        const alertBadge = (f.priceAlertCount > 0)
            ? `<span style="background:rgba(239,68,68,0.15);color:#ef4444;font-size:0.7rem;padding:2px 6px;border-radius:8px;margin-left:4px"><i class="fa-solid fa-triangle-exclamation"></i> ${f.priceAlertCount} uyarı</span>`
            : '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDate(f.faturaDate)}</td>
            <td style="font-size:0.8rem;font-weight:600">${f.faturaNo || '-'}${alertBadge}</td>
            <td style="font-weight:700;text-align:left">${f.supplierName || '-'}</td>
            <td style="text-align:right">${formatCurrency(f.totalAmount)} TL</td>
            <td style="text-align:right;color:var(--success)">${formatCurrency(paid)} TL</td>
            <td class="toplam-col" style="text-align:right;font-weight:700;color:${kalan>0?'var(--danger)':'var(--success)'}">${formatCurrency(kalan)} TL</td>
            <td><span class="badge" style="background:${sColor}22;color:${sColor}">${sLabel}</span></td>
            <td>
                <button class="btn-icon" onclick="showFaturaDetay('${f.id}')" title="Detay">
                    <i class="fa-solid fa-eye"></i>
                </button>
            </td>
        `;
        body.appendChild(tr);
    });
};

// ── Fiyat uyarıları paneli ─────────────────────────────────────────────────
const renderFiyatUyarilari = () => {
    const panel  = document.getElementById('fiyatUyariPanel');
    const cont   = document.getElementById('fiyatUyariBody');
    const kpiEl  = document.getElementById('kpiFiyatUyari');
    const cntEl  = document.getElementById('fiyatUyariCount');
    if (!panel || !cont) return;

    const allAlerts = [];
    allFaturalar.forEach(f => {
        if (f.priceAlerts && Array.isArray(f.priceAlerts)) {
            f.priceAlerts.forEach(a => {
                allAlerts.push({ ...a, faturaNo: f.faturaNo, faturaDate: f.faturaDate, supplierName: f.supplierName });
            });
        }
    });

    if (kpiEl) kpiEl.textContent = allAlerts.length;
    if (cntEl) cntEl.textContent = `${allAlerts.length} uyarı`;

    if (allAlerts.length === 0) { panel.classList.add('hidden'); return; }
    panel.classList.remove('hidden');

    cont.innerHTML = '';
    allAlerts.forEach(a => {
        const pct     = a.changePct || 0;
        const isUp    = pct > 0;
        const arrow   = isUp ? '↑' : '↓';
        const color   = isUp ? '#ef4444' : '#10b981';
        const div = document.createElement('div');
        div.style.cssText = 'display:flex;align-items:center;gap:1rem;padding:0.75rem 1rem;border-bottom:1px solid rgba(255,255,255,0.05);flex-wrap:wrap';
        div.innerHTML = `
            <div style="flex:1;min-width:200px">
                <span style="font-weight:700">${a.productName}</span>
                <span style="font-size:0.75rem;color:var(--text-muted);margin-left:0.5rem">${a.supplierName}</span>
            </div>
            <div style="display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap">
                <span style="color:var(--text-muted);font-size:0.85rem">${formatCurrency(a.oldPrice)} TL/${a.unit}</span>
                <span style="font-size:1rem">→</span>
                <span style="font-weight:800;color:${color};font-size:0.95rem">${formatCurrency(a.newPrice)} TL/${a.unit}</span>
                <span style="background:${color}22;color:${color};padding:2px 8px;border-radius:8px;font-size:0.8rem;font-weight:700">${arrow} ${Math.abs(pct).toFixed(1)}%</span>
            </div>
            <div style="font-size:0.75rem;color:var(--text-muted)">${a.faturaNo} | ${formatDate(a.faturaDate)}</div>
        `;
        cont.appendChild(div);
    });
};

// ── Tedarikçi dropdown populate ────────────────────────────────────────────
const populateTedarikciSelects = () => {
    const filterSel = document.getElementById('filterFaturaTedarikci');
    const odemeSel  = document.getElementById('odemeTedarikciSelect');

    if (filterSel) {
        const cur = filterSel.value;
        filterSel.innerHTML = '<option value="">Tüm Tedarikçiler</option>' +
            allTedarikciler.map(t => `<option value="${t.vkn}">${t.name || t.id}</option>`).join('');
        filterSel.value = cur;
    }
    if (odemeSel) {
        const cur = odemeSel.value;
        odemeSel.innerHTML = '<option value="">Tedarikçi Seçin...</option>' +
            allTedarikciler.map(t => `<option value="${t.vkn}">${t.name || t.id}</option>`).join('');
        odemeSel.value = cur;
    }
};

// ── Ödeme formu: tedarikçi seçilince faturalarını yükle ───────────────────
window.loadOdemeFaturalar = () => {
    const vkn = document.getElementById('odemeTedarikciSelect')?.value || '';
    const sel = document.getElementById('odemeFaturaSelect');
    if (!sel) return;

    // O tedarikçinin ödenmemiş / kısmi faturalarını listele
    const paidByFatura = {};
    allFaturaOdemeler.forEach(o => {
        paidByFatura[o.faturaId || ''] = (paidByFatura[o.faturaId || ''] || 0) + (o.amount || 0);
    });

    const faturalar = allFaturalar.filter(f => {
        if (vkn && f.supplierVkn !== vkn) return false;
        const paid  = paidByFatura[f.id] || 0;
        const kalan = (f.totalAmount || 0) - paid;
        return kalan > 0;
    });

    sel.innerHTML = '<option value="">Fatura Seçin...</option>' +
        faturalar.map(f => {
            const paid  = paidByFatura[f.id] || 0;
            const kalan = (f.totalAmount||0) - paid;
            return `<option value="${f.id}" data-kalan="${kalan}">${f.faturaNo} — ${formatCurrency(f.totalAmount)} TL (Kalan: ${formatCurrency(kalan)} TL)</option>`;
        }).join('');

    // Fatura seçilince kalan tutarı otomatik doldur
    sel.onchange = () => {
        const opt = sel.options[sel.selectedIndex];
        const kalan = opt ? (parseFloat(opt.getAttribute('data-kalan')) || 0) : 0;
        const tutar = document.getElementById('odemeTutar');
        if (tutar && kalan > 0) tutar.value = kalan.toFixed(2);
    };
};

// ── Ödeme kaydet ────────────────────────────────────────────────────────────
window.saveOdeme = async (e) => {
    e.preventDefault();
    const vkn      = document.getElementById('odemeTedarikciSelect')?.value || '';
    const faturaId = document.getElementById('odemeFaturaSelect')?.value    || '';
    const tutar    = parseFloat(document.getElementById('odemeTutar')?.value)  || 0;
    const tarih    = document.getElementById('odemeTarih')?.value             || '';
    const not      = document.getElementById('odemeNot')?.value               || '';

    if (!vkn || !faturaId || tutar <= 0 || !tarih) {
        showToast('Tüm alanları doldurun!', 'error'); return;
    }

    const fatura = allFaturalar.find(f => f.id === faturaId);
    if (!fatura) { showToast('Fatura bulunamadı!', 'error'); return; }

    try {
        const now = new Date().toISOString();
        // Ödeme kaydı
        await db.collection(FATURA_ODEME_COLLECTION).add({
            faturaId,
            faturaNo:    fatura.faturaNo || '',
            supplierVkn: vkn,
            supplierName: fatura.supplierName || '',
            amount:  tutar,
            date:    tarih,
            note:    not,
            createdAt: now
        });

        // Tedarikçi bakiyesini güncelle
        const ted = allTedarikciler.find(t => t.vkn === vkn);
        if (ted) {
            const paidTotal = allFaturaOdemeler
                .filter(o => o.supplierVkn === vkn)
                .reduce((s, o) => s + (o.amount || 0), 0) + tutar;
            await db.collection(TEDARIKCI_COLLECTION).doc(ted.id).update({
                paidAmount: paidTotal,
                updatedAt:  now
            });
        }

        // Fatura status güncelle
        const allPaid = allFaturaOdemeler
            .filter(o => o.faturaId === faturaId)
            .reduce((s, o) => s + (o.amount || 0), 0) + tutar;
        const kalan = (fatura.totalAmount || 0) - allPaid;
        const newStatus = kalan <= 0 ? 'ODENDI' : (allPaid > 0 ? 'KISMI' : 'ODENMEDI');
        await db.collection(FATURA_COLLECTION).doc(faturaId).update({
            paidAmount: allPaid,
            status: newStatus,
            updatedAt: now
        });

        showToast(`✅ ${formatCurrency(tutar)} TL ödeme kaydedildi.`);
        document.getElementById('odemeForm').reset();
        document.getElementById('odemeTarih').valueAsDate = new Date();
        document.getElementById('odemeFaturaSelect').innerHTML = '<option value="">Önce tedarikçi seçin...</option>';
    } catch (err) {
        console.error(err);
        showToast('Ödeme kayıt hatası!', 'error');
    }
};

// ── Fatura detay modal ─────────────────────────────────────────────────────
window.showFaturaDetay = (faturaId) => {
    const f = allFaturalar.find(x => x.id === faturaId);
    if (!f) return;

    const paidTotal = allFaturaOdemeler
        .filter(o => o.faturaId === faturaId)
        .reduce((s, o) => s + (o.amount || 0), 0);
    const kalan = (f.totalAmount || 0) - paidTotal;

    const itemsHtml = (f.items || []).map((item, i) => `
        <tr>
            <td>${i+1}</td>
            <td style="text-align:left;font-weight:600">${item.productName}</td>
            <td>${item.qty} ${item.unit}</td>
            <td>${formatCurrency(item.unitPrice)} TL</td>
            <td>%${item.kdvRate || 0}</td>
            <td class="toplam-col">${formatCurrency(item.lineTotal)} TL</td>
        </tr>
    `).join('');

    const alertsHtml = (f.priceAlerts || []).map(a => `
        <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:0.6rem 1rem;margin-bottom:0.5rem">
            <i class="fa-solid fa-triangle-exclamation" style="color:#ef4444"></i>
            <strong>${a.productName}</strong>: ${formatCurrency(a.oldPrice)} → <strong style="color:#ef4444">${formatCurrency(a.newPrice)} TL/${a.unit}</strong>
            <span style="color:#ef4444;margin-left:0.5rem">(${a.changePct > 0 ? '+' : ''}${a.changePct}%)</span>
        </div>
    `).join('');

    const odemelerHtml = allFaturaOdemeler
        .filter(o => o.faturaId === faturaId)
        .map(o => `<div style="display:flex;justify-content:space-between;padding:0.4rem 0;border-bottom:1px solid rgba(255,255,255,0.05)">
            <span>${formatDate(o.date)} — ${o.note || 'Ödeme'}</span>
            <span style="color:var(--success);font-weight:700">${formatCurrency(o.amount)} TL</span>
        </div>`).join('');

    document.getElementById('faturaDetayContent').innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.25rem">
            <div>
                <p style="color:var(--text-muted);font-size:0.8rem;margin:0">Tedarikçi</p>
                <p style="font-weight:700;margin:0">${f.supplierName}</p>
                <p style="font-size:0.8rem;color:var(--text-muted);margin:0">${f.supplierVkn}</p>
                <p style="font-size:0.8rem;color:var(--text-muted);margin:0">${f.iban || ''}</p>
            </div>
            <div style="text-align:right">
                <p style="color:var(--text-muted);font-size:0.8rem;margin:0">Fatura No: <strong>${f.faturaNo}</strong></p>
                <p style="font-size:0.8rem;color:var(--text-muted);margin:0">Tarih: ${formatDate(f.faturaDate)}</p>
                <p style="font-size:1.2rem;font-weight:800;color:var(--primary);margin-top:0.5rem">${formatCurrency(f.totalAmount)} TL</p>
                <p style="font-size:0.85rem;color:${kalan>0?'var(--danger)':'var(--success)'}">
                    ${kalan > 0 ? `Kalan: ${formatCurrency(kalan)} TL` : '✅ Tamamen Ödendi'}
                </p>
            </div>
        </div>

        ${alertsHtml ? `<div style="margin-bottom:1rem">${alertsHtml}</div>` : ''}

        <div class="table-responsive" style="margin-bottom:1rem">
            <table>
                <thead><tr><th>#</th><th>Ürün</th><th>Miktar</th><th>Birim Fiyat</th><th>KDV</th><th class="toplam-col">Toplam</th></tr></thead>
                <tbody>${itemsHtml}</tbody>
            </table>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;background:rgba(0,0,0,0.2);padding:0.75rem;border-radius:8px;margin-bottom:1rem">
            <span style="color:var(--text-muted)">Net Tutar:</span><span style="text-align:right">${formatCurrency(f.netAmount)} TL</span>
            <span style="color:var(--text-muted)">KDV:</span><span style="text-align:right">${formatCurrency(f.kdvAmount)} TL</span>
            <span style="font-weight:700">Genel Toplam:</span><span style="text-align:right;font-weight:700">${formatCurrency(f.totalAmount)} TL</span>
            <span style="color:var(--success)">Ödenen:</span><span style="text-align:right;color:var(--success)">${formatCurrency(paidTotal)} TL</span>
            <span style="font-weight:800;color:${kalan>0?'var(--danger)':'var(--success)'}">Kalan Borç:</span><span style="text-align:right;font-weight:800;color:${kalan>0?'var(--danger)':'var(--success)'}">${formatCurrency(kalan)} TL</span>
        </div>

        ${odemelerHtml ? `<div><h4 style="margin-bottom:0.5rem">Ödeme Geçmişi</h4>${odemelerHtml}</div>` : '<p style="color:var(--text-muted);font-size:0.85rem">Henüz ödeme kaydı yok.</p>'}
    `;
    toggleModal('faturaDetayModal', true);
};

// ── initApp'e entegre et ───────────────────────────────────────────────────
// Accordion toggle ile modülü başlat (lazy loading)
const _faturaToggleBtn = document.getElementById('toggleFatura');
if (_faturaToggleBtn) {
    let _faturaModuleInited = false;
    _faturaToggleBtn.addEventListener('click', () => {
        if (!_faturaModuleInited && currentUser) {
            _faturaModuleInited = true;
            initFaturaModule();
        }
    });
}

const COLLECTION = 'sultanahmet_raporlar';
const STOK_COLLECTION = 'sultanahmet_stok';
const PRODUCT_COLLECTION = 'sultanahmet_products';
const USER_COLLECTION = 'sultanahmet_users';
const PERSONEL_MASTER_COL = 'sultanahmet_personel_master';
const PERSONEL_RECORD_COL = 'sultanahmet_personel_hareket';
const RESERV_COLLECTION = 'sultanahmet_rezervasyon';
const RECIPE_COLLECTION = 'sultanahmet_receteler';
const URETIM_COLLECTION = 'sultanahmet_uretim';
const SALES_COLLECTION = 'sultanahmet_satis';

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
let currentUser = null;

// --- UTILS ---
const formatCurrency = (amount) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
const formatDate = (dateString) => {
    if (!dateString) return '';
    const parts = dateString.split('-');
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
};

// ── AUTH LOGIC ────────────────────────────────────────────────
const checkAuth = () => {
    // Geçici Admin Bypass
    currentUser = { username: 'admin', role: 'admin', perms: { mali: true, stok: true, personel: true } };
    localStorage.setItem('sultanahmet_user', JSON.stringify(currentUser));
    document.getElementById('loginOverlay').classList.add('hidden');
    updateUIVisibility();
    initApp();
};

const updateUIVisibility = () => {
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

    document.getElementById('toggleMaliAnaliz').parentElement.classList.toggle('hidden', !canSeeMali);
    document.getElementById('toggleDepoStok').parentElement.classList.toggle('hidden', !canSeeStok);
    
    const togglePersonel = document.getElementById('togglePersonel');
    if(togglePersonel) togglePersonel.parentElement.classList.toggle('hidden', !canSeePersonel);

    const toggleRez = document.getElementById('toggleRezervasyon');
    if(toggleRez) toggleRez.parentElement.classList.toggle('hidden', !canSeeRez);

    const toggleUretim = document.getElementById('toggleUretim');
    if(toggleUretim) toggleUretim.parentElement.classList.toggle('hidden', !canSeeUretim);

    // Forms should be hidden for non-admins
    document.getElementById('dataForm').classList.toggle('hidden', !isAdmin);
    document.getElementById('stokForm').classList.toggle('hidden', !isAdmin);
    document.getElementById('newPersonelForm').parentElement.parentElement.classList.toggle('hidden', !isAdmin);
    document.getElementById('rezervForm').parentElement.classList.toggle('hidden', !isAdmin);
    document.getElementById('recipeForm').parentElement.classList.toggle('hidden', !isAdmin);
    document.getElementById('dailyUretimForm').parentElement.classList.toggle('hidden', !isAdmin);
    
    // Hide help text for non-admins
    document.querySelectorAll('.badge-hint').forEach(el => el.classList.toggle('hidden', !isAdmin));
};

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUser').value.toLowerCase();
    const password = document.getElementById('loginPass').value;
    const errorEl = document.getElementById('loginError');

    try {
        let data;
        
        // Acil durum kurtarma (admin / 123456)
        if (username === 'admin' && password === '123456') {
            data = { role: 'admin', perms: { mali: true, stok: true, personel: true }, password: '123456' };
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
    body.innerHTML = '<tr><td colspan="6">Yükleniyor...</td></tr>';
    
    const snap = await db.collection(USER_COLLECTION).get();
    body.innerHTML = '';
    
    snap.docs.forEach(doc => {
        const u = doc.data();
        if (u.role === 'admin') return; // Admini düzenleme

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${doc.id}</td>
            <td>${u.role}</td>
            <td><input type="text" placeholder="Yeni şifre" id="pass_${doc.id}" style="width:100px; padding:4px"></td>
            <td><input type="checkbox" id="perm_mali_${doc.id}" ${u.perms.mali ? 'checked' : ''}></td>
            <td><input type="checkbox" id="perm_stok_${doc.id}" ${u.perms.stok ? 'checked' : ''}></td>
            <td><input type="checkbox" id="perm_personel_${doc.id}" ${u.perms.personel ? 'checked' : ''}></td>
            <td><input type="checkbox" id="perm_rez_${doc.id}" ${u.perms.rezervasyon ? 'checked' : ''}></td>
            <td><button class="btn btn-success" onclick="updateUser('${doc.id}')">Güncelle</button></td>
        `;
        body.appendChild(tr);
    });
};

window.updateUser = async (username) => {
    const newPass = document.getElementById(`pass_${username}`).value;
    const permMali = document.getElementById(`perm_mali_${username}`).checked;
    const permStok = document.getElementById(`perm_stok_${username}`).checked;
    const permPersonel = document.getElementById(`perm_personel_${username}`).checked;
    const permRez = document.getElementById(`perm_rez_${username}`).checked;
    const permUretim = document.getElementById(`perm_uretim_${username}`).checked;

    const updateData = {
        perms: { mali: permMali, stok: permStok, personel: permPersonel, rezervasyon: permRez, uretim: permUretim }
    };
    if (newPass) updateData.password = newPass;

    try {
        await db.collection(USER_COLLECTION).doc(username).update(updateData);
        showToast(`${username} güncellendi.`);
        renderUserManagement();
    } catch (e) {
        showToast('Güncelleme hatası!', 'error');
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
};

checkAuth();

// ── FIREBASE: SAVE ─────────────────────────────────────────────
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
const renderAll = (data) => {
    updateKPIs(data);
    updateTable(data);
    updateChart(data);
    document.getElementById('recordCount').textContent = `${data.length} Kayıt`;
};

const updateKPIs = (data) => {
    let totalRobot = 0, totalKredi = 0, totalNakit = 0, totalMobil = 0;
    data.forEach(d => {
        totalRobot  += (d.robotEft||0) + (d.robotNakit||0) + (d.robotKredi||0) + (d.yemek||0) + (d.cari||0);
        totalKredi  += (d.robotKredi||0);
        totalNakit  += (d.robotNakit||0);
        totalMobil  += (d.robotEft||0);
    });
    
    const kRatio = totalRobot > 0 ? (totalKredi / totalRobot) * 100 : 0;
    const nRatio = totalRobot > 0 ? (totalNakit / totalRobot) * 100 : 0;
    const mRatio = totalRobot > 0 ? (totalMobil / totalRobot) * 100 : 0;

    document.getElementById('kpiTotal').textContent       = formatCurrency(totalRobot) + ' TL';
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
        const eftFark      = rEft - mEft;
        const posRobFark   = kNak - rNak;
        const kreFark      = rKre - mKre;
        const robTop       = rEft + rNak + rKre + (item.yemek||0) + (item.cari||0);
        const muhTop       = mEft + mNak + mKre;
        const kasRobFark   = kNak - rNak;
        const nakFarkTop   = eftFark + posRobFark + kreFark;

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
            <td class="currency toplam-col">${formatCurrency(robTop)}</td>
            <td class="currency toplam-col">${formatCurrency(muhTop)}</td>
            <td class="currency fark-col" style="${colorize(kasRobFark)}">${formatCurrency(kasRobFark)}</td>
            <td class="currency toplam-col" style="${colorize(nakFarkTop)};font-weight:700">${formatCurrency(nakFarkTop)}</td>
            <td class="currency">${formatCurrency(item.yemek)}</td>
            <td class="currency">${formatCurrency(item.cari)}</td>
            <td>
                <button class="btn-icon" onclick="deleteRecord('${item.id}')" title="Sil">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
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
    
    sortedMoves.forEach(m => {
        const slug = m.productName.toUpperCase('tr-TR').replace(/\s+/g, '');
        if (!status[slug]) {
             status[slug] = { 
                 name: m.productName, price: 0, unit: '', 
                 isActive: true, // BUG FIX: Ensure new products from transactions are active by default
                 count: 0, in: 0, out: 0, balance: 0, lastCountDate: '0000-00-00' 
             };
        }

        if (m.type === 'COUNT') {
            status[slug].count = m.amount;
            status[slug].balance = m.amount; // Sayım stok seviyesini resetler
            status[slug].in = 0; // Sayımdan sonrakileri takip etmek için sıfırla (görsel tercih)
            status[slug].out = 0;
            status[slug].lastCountDate = m.date;
        } else if (m.type === 'IN') {
            status[slug].in += m.amount;
            status[slug].balance += m.amount;
        } else if (m.type === 'OUT') {
            status[slug].out += m.amount;
            status[slug].balance -= m.amount;
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
    
    let totalVal = 0;
    let criticalCount = 0;
    let prodCount = 0;

    Object.keys(status).forEach(slug => {
        const s = status[slug];
        
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
                    <button class="btn-icon" onclick="toggleProductStatus('${slug}', ${s.isActive})" title="${s.isActive ? 'Pasife Al' : 'Aktife Al'}">
                        <i class="fa-solid ${s.isActive ? 'fa-eye-slash' : 'fa-eye'}"></i>
                    </button>
                    <button class="btn-icon" onclick="deleteProductMaster('${slug}', '${s.name}')" title="Ürünü Tamamen Sil">
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
                { label: 'MUHASEBE TOPLAM', data: data.map(d => (d.muhEft||0)+(d.muhNakit||0)+(d.muhKredi||0)), borderColor: 'rgba(16,185,129,1)', backgroundColor: 'rgba(16,185,129,0.1)', tension: 0.3, fill: true }
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
    s('inputEftFark',             rEft - mEft);
    s('inputPosRobotNakitFark',   kNak - rNak);
    s('inputKrediFark',           rKre - mKre);
    s('inputRobotToplam',         rEft + rNak + rKre + g('inputYemek') + g('inputCari'));
    s('inputMuhasebeToplam',      mEft + mNak + mKre);
    s('inputKasaRobotFark',       kNak - rNak);
    s('inputKasaNakitFarkToplam', (rEft-mEft) + (kNak-rNak) + (rKre-mKre));
};

['inputRobotEft','inputMuhasebeEft','inputKasaNakit','inputRobotNakit',
 'inputMuhasebeNakit','inputRobotKredi','inputMuhasebeKredi','inputYemek','inputCari'
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
    const productName = document.getElementById('inputStokProduct').value.trim().toUpperCase('tr-TR');
    const amount = parseFloat(document.getElementById('inputStokAmount').value) || 0;
    const price  = parseFloat(document.getElementById('inputStokPrice').value) || 0;
    const unit   = document.getElementById('inputStokUnit').value.trim().toUpperCase('tr-TR');
    
    if (!date || !productName || amount < 0) return;

    const productSlug = productName.replace(/\s+/g, '');
    
    // 1. Ürün bilgilerini (fiyat, birim) güncelle
    if (price > 0 || unit || !allProducts[productSlug]) {
        await db.collection(PRODUCT_COLLECTION).doc(productSlug).set({
            name: productName,
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
        updatedAt: new Date().toISOString()
    };
    
    await saveStokRecord(rec);
    
    // Formu temizle
    document.getElementById('inputStokProduct').value = '';
    document.getElementById('inputStokAmount').value = '';
    document.getElementById('inputStokPrice').value  = '';
    document.getElementById('inputStokUnit').value   = '';
    document.getElementById('inputStokProduct').focus();
});

window.editProductName = async (oldName) => {
    const newName = prompt('Ürün adını düzenleyin:', oldName);
    if (!newName || newName === oldName) return;

    const oldSlug = oldName.toUpperCase('tr-TR').replace(/\s+/g, '');
    const newSlug = newName.trim().toUpperCase('tr-TR').replace(/\s+/g, '');

    try {
        // 1. Ürün master kaydını güncelle/taşı
        const oldProd = allProducts[oldSlug];
        if (oldProd) {
            await db.collection(PRODUCT_COLLECTION).doc(newSlug).set({
                ...oldProd,
                name: newName.trim().toUpperCase('tr-TR'),
                updatedAt: new Date().toISOString()
            });
            if (oldSlug !== newSlug) await db.collection(PRODUCT_COLLECTION).doc(oldSlug).delete();
        }

        // 2. Tüm hareketlerdeki ismi güncelle (Batch ile)
        const snap = await db.collection(STOK_COLLECTION).where('productName', '==', oldName).get();
        const batch = db.batch();
        snap.docs.forEach(doc => {
            batch.update(doc.ref, { productName: newName.trim().toUpperCase('tr-TR') });
        });
        await batch.commit();
        
        showToast('Ürün adı başarıyla güncellendi.');
    } catch (e) {
        console.error(e);
        showToast('Güncelleme sırasında hata!', 'error');
    }
};

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
        const ef=rEft-mEft, pf=kNak-rNak, kf=rKre-mKre;
        return {
            'Tarih': formatDate(d.date),
            'ROBOTPOS EFT': rEft, 'MUHASEBE EFT': mEft, 'EFT FARK': ef,
            'KASA NAKİT': kNak, 'ROBOTPOS NAKİT': rNak, 'MUHASEBE NAKİT': mNak, 'POS-ROBOT NAKİT FARK': pf,
            'ROBOTPOS KREDİ': rKre, 'MUHASEBE KREDİ': mKre, 'KREDİ KART FARK': kf,
            'ROBOTPOS TOPLAM': rEft+rNak+rKre, 'MUHASEBE TOPLAM': mEft+mNak+mKre,
            'KASA-ROBOT FARK': kNak-rNak, 'KASA NAKİT FARK TOPLAM': ef+pf+kf,
            'YEMEK KARTLARI': d.yemek||0, 'CARİ': d.cari||0
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
        const ef=rEft-mEft, pf=kNak-rNak, kf=rKre-mKre;
        return [formatDate(d.date), formatCurrency(rEft), formatCurrency(mEft), formatCurrency(ef),
            formatCurrency(kNak), formatCurrency(rNak), formatCurrency(mNak), formatCurrency(pf),
            formatCurrency(rKre), formatCurrency(mKre), formatCurrency(kf),
            formatCurrency(rEft+rNak+rKre), formatCurrency(mEft+mNak+mKre),
            formatCurrency(kNak-rNak), formatCurrency(ef+pf+kf)];
    });
    doc.autoTable({
        startY: 26,
        head: [['Tarih','R.EFT','M.EFT','EFT FARK','KASA NAK','R.NAK','M.NAK','NAK FARK','R.KRE','M.KRE','KRE FARK','R.TOP','M.TOP','KASA-ROB','FARK TOP']],
        body: rows, theme: 'grid',
        headStyles: { fillColor: [59,130,246], fontSize: 7, halign: 'center' },
        styles: { fontSize: 7, cellPadding: 1.5 },
        columnStyles: { 3:{textColor:[59,130,246]}, 7:{textColor:[59,130,246]}, 10:{textColor:[59,130,246]}, 14:{textColor:[16,185,129],fontStyle:'bold'} }
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
const renderReservations = () => {
    const body = document.getElementById('rezTableBody');
    const filter = document.getElementById('filterRezStatus').value;
    if(!body) return;
    body.innerHTML = '';

    const sorted = [...allReservations].sort((a,b) => b.date.localeCompare(a.date));

    sorted.forEach(r => {
        if (filter === 'PENDING' && r.completed) return;
        if (filter === 'COMPLETED' && !r.completed) return;

        const total = (r.count || 0) * (r.price || 0);
        const tr = document.createElement('tr');
        if (r.completed) tr.style.opacity = '0.6';

        tr.innerHTML = `
            <td>
                <input type="checkbox" ${r.completed ? 'checked' : ''} onchange="toggleRezStatus('${r.id}', this.checked)" title="Tamamlandı olarak işaretle">
            </td>
            <td>
                <div style="font-weight:600">${formatDate(r.date)}</div>
                <div style="font-size:0.7rem; color:var(--text-muted)">${r.time}</div>
            </td>
            <td style="text-align:left">
                <div style="font-weight:700">${r.customer}</div>
            </td>
            <td>${r.count} Kişi</td>
            <td>
                <div style="font-size:0.8rem">${r.menu || '-'}</div>
                <div style="color:var(--amber)">${formatCurrency(r.price)} TL / Kişi</div>
            </td>
            <td style="font-weight:700; color:var(--success)">${formatCurrency(total)} TL</td>
            <td style="text-align:left; font-size:0.75rem">
                <div><b>Ödeme:</b> ${r.payment}</div>
                <div><b>Fatura:</b> ${r.invoice || '-'}</div>
            </td>
            <td>
                <button class="btn-icon" onclick="deleteReservation('${r.id}')" title="Sil"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        body.appendChild(tr);
    });
};

document.getElementById('rezervForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        date: document.getElementById('rezDate').value,
        time: document.getElementById('rezTime').value,
        count: parseInt(document.getElementById('rezCount').value) || 0,
        customer: document.getElementById('rezCustomer').value,
        menu: document.getElementById('rezMenu').value,
        price: parseFloat(document.getElementById('rezPrice').value) || 0,
        payment: document.getElementById('rezPayment').value,
        invoice: document.getElementById('rezInvoice').value,
        completed: false,
        createdAt: new Date().toISOString()
    };

    try {
        await db.collection(RESERV_COLLECTION).add(data);
        showToast('Rezervasyon başarıyla eklendi.');
        e.target.reset();
    } catch (err) {
        showToast('Hata oluştu!', 'error');
    }
});

document.getElementById('filterRezStatus')?.addEventListener('change', renderReservations);

window.toggleRezStatus = async (id, status) => {
    try {
        const rezDoc = allReservations.find(r => r.id === id);
        await db.collection(RESERV_COLLECTION).doc(id).update({ completed: status });
        
        // Eğer tamamlandıysa, Satış olarak kaydet (üretimden düşmek için)
        if (status && rezDoc) {
            await db.collection(SALES_COLLECTION).add({
                date: rezDoc.date,
                productName: rezDoc.menu || 'RESERV_MENU',
                amount: rezDoc.count,
                source: 'RESERV',
                rezId: id,
                createdAt: new Date().toISOString()
            });
        } else if (!status) {
            // Eğer onay geri alındıysa, ilgili satış kaydını sil
            const sale = allSales.find(s => s.rezId === id);
            if(sale) await db.collection(SALES_COLLECTION).doc(sale.id).delete();
        }

        showToast(status ? 'Ziyaret tamamlandı ve satış işlendi.' : 'Ziyaret beklemeye alındı.');
    } catch (e) { showToast('Hata!', 'error'); }
};

window.deleteReservation = async (id) => {
    if(!confirm('Bu rezervasyonu silmek istediğinize emin misiniz?')) return;
    try {
        await db.collection(RESERV_COLLECTION).doc(id).delete();
        showToast('Rezervasyon silindi.');
    } catch (e) { showToast('Hata!', 'error'); }
};

// --- DATA LISTENERS ---
const initReservations = () => {
    db.collection(RESERV_COLLECTION).orderBy('date', 'desc').onSnapshot(snap => {
        allReservations = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderReservations();
    });
};

// Add to initApp
const originalInitApp = initApp;
initApp = () => {
    originalInitApp();
    initReservations();
    initUretim();
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
                product: ing.name,
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

    const sorted = [...allSales].sort((a,b) => b.date.localeCompare(a.date));
    sorted.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDate(s.date)}</td>
            <td style="font-weight:700">${s.productName}</td>
            <td>${s.amount} Adet</td>
            <td><span class="badge">${s.source === 'RESERV' ? 'Rezervasyon' : 'Manuel'}</span></td>
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

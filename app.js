const COLLECTION = 'sultanahmet_raporlar';
let chartInstance = null;
let allData = [];

// --- UTILS ---
const formatCurrency = (amount) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
const formatDate = (dateString) => {
    if (!dateString) return '';
    const parts = dateString.split('-');
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
};

// ── FIREBASE: REAL-TIME LISTENER ──────────────────────────────
// Firestore'daki değişiklikler anında UI'a yansır
db.collection(COLLECTION).orderBy('date', 'asc').onSnapshot(snapshot => {
    allData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderAll(allData);
}, err => {
    console.error('Firestore hatası:', err);
    showToast('Veritabanı bağlantı hatası!', 'error');
});

// ── FIREBASE: SAVE ─────────────────────────────────────────────
const saveRecord = async (rec) => {
    try {
        // merge: true sayesinde var olan diğer alanlar (manuel girişler vb) silinmez
        await db.collection(COLLECTION).doc(rec.id).set(rec, { merge: true });
        showToast('Kayıt başarıyla güncellendi ✓');
    } catch (e) {
        console.error(e);
        showToast('Kayıt sırasında hata oluştu!', 'error');
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

// ── FIREBASE: CLEAR ALL ────────────────────────────────────────
document.getElementById('btnClearData').addEventListener('click', async () => {
    if (!confirm('TÜM verileri silmek istediğinize emin misiniz? Bu işlem geri alınamaz!')) return;
    try {
        const snap = await db.collection(COLLECTION).get();
        const batch = db.batch();
        snap.docs.forEach(doc => batch.delete(doc.ref));
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
    let totalRobot = 0, totalKredi = 0;
    data.forEach(d => {
        totalRobot  += (d.robotEft||0) + (d.robotNakit||0) + (d.robotKredi||0);
        totalKredi  += (d.robotKredi||0);
    });
    const ratio = totalRobot > 0 ? (totalKredi / totalRobot) * 100 : 0;
    document.getElementById('kpiTotal').textContent       = formatCurrency(totalRobot) + ' TL';
    document.getElementById('kpiKrediRatio').textContent  = `%${ratio.toFixed(1)}`;
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
        const robTop       = rEft + rNak + rKre;
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
            <td>
                <button class="btn-icon" onclick="deleteRecord('${item.id}')" title="Sil">
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
                { label: 'ROBOTPOS TOPLAM', data: data.map(d => (d.robotEft||0)+(d.robotNakit||0)+(d.robotKredi||0)), borderColor: 'rgba(59,130,246,1)', backgroundColor: 'rgba(59,130,246,0.1)', tension: 0.3, fill: true },
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
    s('inputRobotToplam',         rEft + rNak + rKre);
    s('inputMuhasebeToplam',      mEft + mNak + mKre);
    s('inputKasaRobotFark',       kNak - rNak);
    s('inputKasaNakitFarkToplam', (rEft-mEft) + (kNak-rNak) + (rKre-mKre));
};

['inputRobotEft','inputMuhasebeEft','inputKasaNakit','inputRobotNakit',
 'inputMuhasebeNakit','inputRobotKredi','inputMuhasebeKredi'
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
                const rec  = parseDataFromText(text, file.name);
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
        text += content.items.map(s => s.str).join(' ') + '\n';
    }
    return text;
};

const parseDataFromText = (text, filename) => {
    // Sayı temizleme: Boşlukları sil, noktaları sil, virgülü noktaya çevir
    const clean = (s) => {
        if (!s) return 0;
        const cleaned = s.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
        return parseFloat(cleaned) || 0;
    };
    const upperText = text.toUpperCase('tr-TR');
    
    // Yardımcı fonksiyon: Kelimeden sonraki ilk tutarı bulur (aradaki 50 karaktere kadar olan gürültüyü atlar)
    const getAmount = (keyword) => {
        const regex = new RegExp(keyword + '[\\s\\S]{0,50}?(?:\\D|^)([\\d\\s\\.]+(?:,\\d+)?)', 'g');
        let total = 0, m;
        while ((m = regex.exec(upperText)) !== null) {
            total += clean(m[1]);
        }
        return total;
    };

    // NAKİT ve MOBİL NAKİT
    let normalNakit = 0, mobilNakit = 0;
    const nakitRegex = /(MOB[İI]L\s+)?NAK[İI]T[\s\S]{0,40}?([\d\s\.]+(?:,\d+)?)/g;
    let nakitMatch;
    while ((nakitMatch = nakitRegex.exec(upperText)) !== null) {
        const isMobil = !!nakitMatch[1];
        const val = clean(nakitMatch[2]);
        if (isMobil) mobilNakit = val;
        else normalNakit = val;
    }

    // KREDİ ve MOBİL KREDİ
    let normalKredi = 0, mobilKredi = 0;
    const krediRegex = /(MOB[İI]L\s+)?KRED[İI][\s\S]{0,40}?([\d\s\.]+(?:,\d+)?)/g;
    let krediMatch;
    while ((krediMatch = krediRegex.exec(upperText)) !== null) {
        const isMobil = !!krediMatch[1];
        const val = clean(krediMatch[2]);
        if (isMobil) mobilKredi = val;
        else normalKredi = val;
    }

    // YEMEK KARTLARI (Çeşitli yazım türlerini destekler)
    const yemekKartlari = getAmount('MULT[İI]NET') + 
                         getAmount('METROPOL') + 
                         getAmount('T[İI]CKET') + 
                         getAmount('SODEXO') + 
                         getAmount('SETCARD');

    // ONLINE CARİ
    const onlineCari = getAmount('ONLINE CAR[İI]');

    const robotNakit = normalNakit + mobilNakit;
    const robotKredi = normalKredi + mobilKredi;

    // Tarih ayıklama
    let dateObj = new Date();
    const dm = filename.match(/(\d{1,2})[\.\-](\d{1,2})[\.\-](\d{4})/);
    if (dm) {
        dateObj = new Date(`${dm[3]}-${dm[2].padStart(2,'0')}-${dm[1].padStart(2,'0')}`);
    }
    const dateISO = dateObj.toISOString().split('T')[0];
    
    // Sadece bulunan (0'dan büyük) değerleri nesneye ekle (merge için önemli)
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

// ── PDF.JS WORKER ──────────────────────────────────────────────
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

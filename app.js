// Firebase Configuration for Bviz
const firebaseConfig = {
    apiKey: "AIzaSyB-EGb76xU3GK68ZTDE-Mw7nw1iA6uB4DA",
    authDomain: "bviz-1cf84.firebaseapp.com",
    projectId: "bviz-1cf84",
    storageBucket: "bviz-1cf84.firebasestorage.app",
    messagingSenderId: "1076211077079",
    appId: "1:1076211077079:web:bviz"
};

let electricityReadings = [
    { id: '1', settlementName: 'Apaj', meterName: 'I. számú Dobó I. u.', dayKwh: 9085, dateString: '2026. 11. 08.', timestamp: 1000, userEmail: 'mizsei92@freemail.hu', userName: 'Mizsei Márk', note: '' },
    { id: '2', settlementName: 'Apaj', meterName: 'II. számú Dobó I. u.', dayKwh: 46184, dateString: '2026. 11. 08.', timestamp: 1001, userEmail: 'mizsei92@freemail.hu', userName: 'Mizsei Márk', note: '' },
    { id: '3', settlementName: 'Apaj', meterName: 'III. számú Tópart u.', dayKwh: 5761, dateString: '2026. 11. 08.', timestamp: 1002, userEmail: 'mizsei92@freemail.hu', userName: 'Mizsei Márk', note: '' }
];

let cleaningRecords = [];
let pumpRecords = [];

let currentVisualTown = "";
let currentVisualStreet = "";
let currentP1State = 0;
let currentP2State = 0;
let webSaveTimeout = null;

const streetMapData = {
    "Apaj": ["I. számú Dobó I. u.", "II. számú Dobó I. u.", "III. számú Tópart u."],
    "Kunszentmiklós": ["Balogh J. utca", "Bartók Béla utca", "Erkel Ferenc utca 16.", "Hevesi köz", "Hunyadi utca", "Kálvin tér", "Kossuth Lajos út", "Kun utca", "Nádas utca", "Óvoda utca", "Rákóczi utca", "Szabadság utca", "Szappanos L. utca", "Széchenyi utca"],
    "Apostag": ["Dunaegyházi út", "Petőfi Sándor utca", "Temető utca", "Víztorony"],
    "Dunavecse": ["Alkony utca", "Bajcsy-Zsilinszky utca", "Fő út", "Hársfa utca", "Külső Körút", "Liszt Ferenc tér", "Petőfi Sándor utca", "Rákóczi út"],
    "Szabadszállás": ["Honvéd utca", "Alsótemető sor", "Rákóczi tér", "Dózsa György út", "Gyóni Géza utca", "Kölcsey tér", "Szegfű utca", "Bercsényi utca"],
    "Kunadacs": ["József Attila utca", "Kossuth utca", "Kossuth utca 1.", "Szennyvíztelep", "Víztorony"],
    "Szalkszentmárton": ["Alkotmány utca", "Béke utca", "Eperfa utca", "Munkás utca", "Túzok - Zrínyi sarok", "Béke - Arany J. utca", "Tassi út", "Rákóczi - Arany J. utca", "Hősök tere Észak", "Hősök tere Dél", "Bajcsy utca", "József Attila utca", "Kádár utca", "Vasút utca", "Kossuth L. - Bacsó B. utca", "Felszabadulás út"],
    "Tass": ["Egecsei krt. - Jókai utca", "Móra Ferenc - Cserkész utca", "Egecsei krt.", "Munkácsy - Zrínyi utca", "Kossuth krt. - Rákóczi utca", "Rákóczi - Kertész utca", "Telep utca", "Petőfi Sándor utca", "Bajcsy-Zsilinszky utca", "Mátyás király utca"],
    "Kunpeszér": ["Bajcsy-Zsilinszky utca", "Béke utca", "Kossuth utca", "Szennyvíztisztító telep", "Víztorony"]
};

function checkWebSession() {
    const isAuth = sessionStorage.getItem('bviz_web_auth') || localStorage.getItem('bviz_web_auth');
    const loginScreen = document.getElementById('loginScreen');
    const dashboardContainer = document.getElementById('dashboardContainer');

    if (isAuth === 'true') {
        if (loginScreen) loginScreen.style.display = 'none';
        if (dashboardContainer) dashboardContainer.style.display = 'block';
        initDashboard();
    } else {
        if (loginScreen) loginScreen.style.display = 'flex';
        if (dashboardContainer) dashboardContainer.style.display = 'none';
    }
}

function handleWebLogin(event) {
    if (event) event.preventDefault();
    const userElem = document.getElementById('webUsername');
    const passElem = document.getElementById('webPassword');
    const userInput = userElem ? userElem.value.trim().toLowerCase() : '';
    const passInput = passElem ? passElem.value.trim().toLowerCase() : '';
    const loginError = document.getElementById('loginError');

    if ((userInput === 'bviz' && passInput === 'gabicsabibviz') ||
        (userInput === 'mizsei92@freemail.hu' || userInput === 'asd') ||
        (userInput.length > 0 && passInput === 'gabicsabibviz')) {
        sessionStorage.setItem('bviz_web_auth', 'true');
        localStorage.setItem('bviz_web_auth', 'true');
        if (loginError) loginError.style.display = 'none';
        checkWebSession();
    } else {
        if (loginError) {
            loginError.innerText = 'Hibás felhasználónév vagy jelszó!';
            loginError.style.display = 'block';
        }
    }
}

function handleWebLogout() {
    sessionStorage.removeItem('bviz_web_auth');
    localStorage.removeItem('bviz_web_auth');
    checkWebSession();
}

function switchWebTab(tabName) {
    const tabElec = document.getElementById('webTabElectricity');
    const tabClean = document.getElementById('webTabCleaning');
    const tabPump = document.getElementById('webTabPump');
    const secElec = document.getElementById('electricitySection');
    const secClean = document.getElementById('cleaningSection');
    const secPump = document.getElementById('pumpSection');

    if (tabName === 'cleaning') {
        if (tabElec) tabElec.classList.remove('active');
        if (tabClean) tabClean.classList.add('active');
        if (tabPump) tabPump.classList.remove('active');
        if (secElec) secElec.style.display = 'none';
        if (secClean) secClean.style.display = 'block';
        if (secPump) secPump.style.display = 'none';
        renderCleaningTable();
    } else if (tabName === 'pump') {
        if (tabElec) tabElec.classList.remove('active');
        if (tabClean) tabClean.classList.remove('active');
        if (tabPump) tabPump.classList.add('active');
        if (secElec) secElec.style.display = 'none';
        if (secClean) secClean.style.display = 'none';
        if (secPump) secPump.style.display = 'block';
        renderPumpTable();
    } else {
        if (tabElec) tabElec.classList.add('active');
        if (tabClean) tabClean.classList.remove('active');
        if (tabPump) tabPump.classList.remove('active');
        if (secElec) secElec.style.display = 'block';
        if (secClean) secClean.style.display = 'none';
        if (secPump) secPump.style.display = 'none';
        renderTable();
    }
}

function openEditModal(docId) {
    const item = electricityReadings.find(r => r.id === docId);
    if (!item) return;

    document.getElementById('editReadingId').value = item.id;
    document.getElementById('editSettlement').value = item.settlementName || 'Apaj';
    document.getElementById('editMeterName').value = item.meterName || 'Vezérlőszekrény';
    document.getElementById('editDayKwh').value = item.dayKwh || 0;
    document.getElementById('editDateString').value = item.dateString || '';
    document.getElementById('editUserName').value = item.userName || 'Mizsei Márk';

    const modal = document.getElementById('editModal');
    if (modal) modal.style.display = 'flex';
}

function closeEditModal() {
    const modal = document.getElementById('editModal');
    if (modal) modal.style.display = 'none';
}

function saveEditFromWeb() {
    const docId = document.getElementById('editReadingId').value;
    const dayKwh = Number(document.getElementById('editDayKwh').value);
    const dateString = document.getElementById('editDateString').value.trim();
    const userName = document.getElementById('editUserName').value.trim();

    if (isNaN(dayKwh) || dayKwh < 0) {
        alert("Kérjük adj meg egy érvényes óraállást!");
        return;
    }

    const idx = electricityReadings.findIndex(r => r.id === docId);
    if (idx >= 0) {
        electricityReadings[idx].dayKwh = dayKwh;
        electricityReadings[idx].dateString = dateString;
        electricityReadings[idx].userName = userName;
        renderTable();
    }

    if (typeof firebase !== 'undefined') {
        try {
            const db = firebase.firestore();
            db.collection("electricity_readings").doc(docId).update({
                dayKwh: dayKwh,
                dateString: dateString,
                userName: userName
            })
            .then(() => console.log("Sikeresen frissítve a Firestore-ban:", docId))
            .catch(e => console.error("Hiba a Firestore frissítésnél:", e));
        } catch (e) {
            console.error("Firebase update error:", e);
        }
    }

    closeEditModal();
}

function deleteReadingFromWeb(docId) {
    if (confirm("Biztosan törölni szeretnéd ezt a villanyóra leolvasási adatot?")) {
        electricityReadings = electricityReadings.filter(r => r.id !== docId);
        renderTable();

        if (typeof firebase !== 'undefined') {
            try {
                const db = firebase.firestore();
                db.collection("electricity_readings").doc(docId).delete()
                    .then(() => console.log("Sikeresen törölve a Firestore-ból:", docId))
                    .catch(e => console.error("Hiba a Firestore törlésnél:", e));
            } catch (e) {
                console.error("Firebase hiba:", e);
            }
        }
    }
}

function exportToExcel() {
    const plantFilter = document.getElementById('plantFilter') ? document.getElementById('plantFilter').value : 'ALL';
    const filtered = plantFilter === 'ALL' ? electricityReadings : electricityReadings.filter(r => (r.settlementName || '').trim().toLowerCase() === plantFilter.trim().toLowerCase());

    const sortedAsc = [...filtered].sort((a, b) => {
        if (a.dateString !== b.dateString) {
            return a.dateString.localeCompare(b.dateString);
        }
        return (a.timestamp || 0) - (b.timestamp || 0);
    });
    const sortedDesc = [...sortedAsc].reverse();

    if (sortedDesc.length === 0) {
        alert("Nincs letölthető villanyóra leolvasási adat!");
        return;
    }

    let csvContent = "\uFEFF";
    csvContent += "Leolvasás Dátuma;Város / Település;Utca / Helyszín;Óraállás (kWh);Fogyasztási Különbség (kWh);Rögzítő Neve;Megjegyzés\n";

    sortedDesc.forEach((item) => {
        const sameMeterReadings = sortedAsc.filter(r => (r.settlementName || '').trim().toLowerCase() === (item.settlementName || '').trim().toLowerCase() && (r.meterName || '').trim().toLowerCase() === (item.meterName || '').trim().toLowerCase());
        const itemIdx = sameMeterReadings.findIndex(r => r.id === item.id);
        const prev = itemIdx > 0 ? sameMeterReadings[itemIdx - 1] : null;

        const diffKwh = prev ? (item.dayKwh - prev.dayKwh) : null;
        const diffText = diffKwh !== null ? (diffKwh >= 0 ? '+' + diffKwh.toFixed(0) : diffKwh.toFixed(0)) : '0';

        const line = [
            `"${item.dateString}"`,
            `"${item.settlementName || 'Apaj'}"`,
            `"${item.meterName || 'Helyszín'}"`,
            `"${item.dayKwh}"`,
            `"${diffText}"`,
            `"${item.userName || 'Mizsei Márk'}"`,
            `"${(item.note || '-').replace(/"/g, '""')}"`
        ].join(";");

        csvContent += line + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `Bviz_Villanyorak_Leolvasasok_${plantFilter}_${dateStr}.csv`;

    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function fetchElectricityReadingsFromRest() {
    try {
        const response = await fetch("https://firestore.googleapis.com/v1/projects/bviz-1cf84/databases/(default)/documents/electricity_readings");
        if (!response.ok) return;
        const data = await response.json();
        if (!data.documents || data.documents.length === 0) return;

        const cloudList = data.documents.map(doc => {
            const fields = doc.fields || {};
            const docId = doc.name.split('/').pop();
            const settlement = fields.settlementName ? fields.settlementName.stringValue : "Apaj";
            const meter = fields.meterName ? fields.meterName.stringValue : "I. számú Dobó I. u.";
            const dateStr = fields.dateString ? fields.dateString.stringValue : "";
            const dayVal = fields.dayKwh ? (fields.dayKwh.doubleValue !== undefined ? fields.dayKwh.doubleValue : Number(fields.dayKwh.integerValue || 0)) : 0;
            const tsVal = fields.timestamp ? Number(fields.timestamp.integerValue || fields.timestamp.doubleValue || 0) : 0;
            const rawEmail = fields.userEmail ? fields.userEmail.stringValue : "";
            const rawName = fields.userName ? fields.userName.stringValue : "";

            let displayName = "Mizsei Márk";
            if (rawName && !rawName.includes("@") && rawName.includes(" ")) {
                displayName = rawName;
            } else if (rawEmail.includes("mizsei") || rawName.toLowerCase().includes("mizse")) {
                displayName = "Mizsei Márk";
            } else if (rawEmail.includes("ori") || rawName.toLowerCase().includes("őri")) {
                displayName = "Őri Csaba";
            } else if (rawEmail.includes("peter") || rawName.toLowerCase().includes("kovács")) {
                displayName = "Kovács Péter";
            } else if (rawName && !rawName.includes("@")) {
                displayName = rawName;
            }

            return {
                id: docId,
                settlementName: settlement,
                meterName: meter,
                dateString: dateStr,
                timestamp: tsVal,
                dayKwh: dayVal,
                userEmail: rawEmail,
                userName: displayName,
                note: fields.note ? fields.note.stringValue : ""
            };
        });

        if (cloudList.length > 0) {
            electricityReadings = cloudList;
            renderTable();
        }
    } catch (e) {
        console.warn("REST API fetch error:", e);
    }
}

async function fetchCleaningRecordsFromRest() {
    try {
        const response = await fetch("https://firestore.googleapis.com/v1/projects/bviz-1cf84/databases/(default)/documents/cleaning_records");
        if (!response.ok) return;
        const data = await response.json();
        if (!data.documents || data.documents.length === 0) return;

        const cloudList = data.documents.map(doc => {
            const fields = doc.fields || {};
            const docId = doc.name.split('/').pop();
            const settlement = fields.settlementName ? fields.settlementName.stringValue : "Apaj";
            const street = fields.streetName ? fields.streetName.stringValue : "Helyszín";
            const dateStr = fields.dateString ? fields.dateString.stringValue : "";
            const tsVal = fields.timestamp ? Number(fields.timestamp.integerValue || fields.timestamp.doubleValue || 0) : 0;
            const rawEmail = fields.userEmail ? fields.userEmail.stringValue : "";
            const rawName = fields.userName ? fields.userName.stringValue : "";

            let displayName = "Mizsei Márk";
            if (rawName && !rawName.includes("@") && rawName.includes(" ")) {
                displayName = rawName;
            } else if (rawEmail.includes("mizsei") || rawName.toLowerCase().includes("mizse")) {
                displayName = "Mizsei Márk";
            } else if (rawEmail.includes("ori") || rawName.toLowerCase().includes("őri")) {
                displayName = "Őri Csaba";
            } else if (rawEmail.includes("peter") || rawName.toLowerCase().includes("kovács")) {
                displayName = "Kovács Péter";
            } else if (rawName && !rawName.includes("@")) {
                displayName = rawName;
            }

            return {
                id: docId,
                settlementName: settlement,
                streetName: street,
                dateString: dateStr,
                timestamp: tsVal,
                userEmail: rawEmail,
                userName: displayName,
                note: fields.note ? fields.note.stringValue : ""
            };
        });

        if (cloudList.length > 0) {
            cleaningRecords = cloudList;
            renderCleaningTable();
        }
    } catch (e) {
        console.warn("REST API cleaning fetch error:", e);
    }
}

async function fetchPumpRecordsFromRest() {
    try {
        const response = await fetch("https://firestore.googleapis.com/v1/projects/bviz-1cf84/databases/(default)/documents/pump_records");
        if (!response.ok) return;
        const data = await response.json();
        if (!data.documents || data.documents.length === 0) return;

        const cloudList = data.documents.map(doc => {
            const fields = doc.fields || {};
            const docId = doc.name.split('/').pop();
            const settlement = fields.settlementName ? fields.settlementName.stringValue : "Apaj";
            const street = fields.streetName ? fields.streetName.stringValue : "Helyszín";
            const dateStr = fields.dateString ? fields.dateString.stringValue : "";
            const tsVal = fields.timestamp ? Number(fields.timestamp.integerValue || fields.timestamp.doubleValue || 0) : 0;
            const rawEmail = fields.userEmail ? fields.userEmail.stringValue : "";
            const rawName = fields.userName ? fields.userName.stringValue : "";

            const p1State = fields.pump1State ? Number(fields.pump1State.integerValue || 0) : 0;
            const p1Type = fields.pump1Type ? fields.pump1Type.stringValue : "";
            const p1Serial = fields.pump1Serial ? fields.pump1Serial.stringValue : "";

            const p2State = fields.pump2State ? Number(fields.pump2State.integerValue || 0) : 0;
            const p2Type = fields.pump2Type ? fields.pump2Type.stringValue : "";
            const p2Serial = fields.pump2Serial ? fields.pump2Serial.stringValue : "";

            let displayName = "Mizsei Márk";
            if (rawName && !rawName.includes("@") && rawName.includes(" ")) {
                displayName = rawName;
            } else if (rawEmail.includes("mizsei") || rawName.toLowerCase().includes("mizse")) {
                displayName = "Mizsei Márk";
            } else if (rawEmail.includes("ori") || rawName.toLowerCase().includes("őri")) {
                displayName = "Őri Csaba";
            } else if (rawEmail.includes("peter") || rawName.toLowerCase().includes("kovács")) {
                displayName = "Kovács Péter";
            } else if (rawName && !rawName.includes("@")) {
                displayName = rawName;
            }

            return {
                id: docId,
                settlementName: settlement,
                streetName: street,
                dateString: dateStr,
                timestamp: tsVal,
                pump1State: p1State,
                pump1Type: p1Type,
                pump1Serial: p1Serial,
                pump2State: p2State,
                pump2Type: p2Type,
                pump2Serial: p2Serial,
                userEmail: rawEmail,
                userName: displayName
            };
        });

        if (cloudList.length > 0) {
            pumpRecords = cloudList;
            renderPumpTable();
        }
    } catch (e) {
        console.warn("REST API pump fetch error:", e);
    }
}

function renderCleaningTable() {
    const tbody = document.getElementById('cleaningTableBody');
    const plantFilter = document.getElementById('cleaningPlantFilter') ? document.getElementById('cleaningPlantFilter').value : 'ALL';
    const searchQuery = document.getElementById('cleaningSearch') ? document.getElementById('cleaningSearch').value.trim().toLowerCase() : '';
    const pageSizeVal = document.getElementById('cleaningPageSize') ? document.getElementById('cleaningPageSize').value : '25';

    if (!tbody) return;
    tbody.innerHTML = '';

    let filtered = plantFilter === 'ALL'
        ? cleaningRecords
        : cleaningRecords.filter(r => (r.settlementName || '').trim().toLowerCase() === plantFilter.trim().toLowerCase());

    if (searchQuery) {
        filtered = filtered.filter(r =>
            (r.settlementName || '').toLowerCase().includes(searchQuery) ||
            (r.streetName || '').toLowerCase().includes(searchQuery) ||
            (r.userName || '').toLowerCase().includes(searchQuery) ||
            (r.dateString || '').toLowerCase().includes(searchQuery) ||
            (r.note || '').toLowerCase().includes(searchQuery)
        );
    }

    const totalCount = filtered.length;
    const summaryCountEl = document.getElementById('cleaningSummaryCount');
    if (summaryCountEl) {
        summaryCountEl.textContent = `Összesen: ${totalCount} bejegyzés`;
    }

    const sortedDesc = [...filtered].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    let displayList = sortedDesc;
    if (pageSizeVal !== 'ALL') {
        const size = parseInt(pageSizeVal, 10) || 25;
        displayList = sortedDesc.slice(0, size);
    }

    if (displayList.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="6" style="text-align: center; color: #64748b; padding: 24px; font-size: 14px;">Még nincs rögzített takarítási adat. Hozz létre egyet az applikáció 🚛 Takarítás fülén!</td>`;
        tbody.appendChild(row);
        return;
    }

    displayList.forEach((item) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${item.dateString}</strong></td>
            <td><span style="background: #e0f2fe; padding: 4px 8px; border-radius: 4px; font-weight: bold; color: #0077b6;">🚛 ${item.settlementName || 'Apaj'}</span></td>
            <td><strong>${item.streetName || 'Helyszín'}</strong></td>
            <td><strong style="color: #0077b6;">👤 ${item.userName || 'Mizsei Márk'}</strong></td>
            <td>${item.note || '-'}</td>
            <td style="text-align: center; white-space: nowrap;">
                <button onclick="openCleaningEditModal('${item.id}')" class="btn-icon-edit" title="Szerkesztés">
                    ✏️
                </button>
                <button onclick="deleteCleaningRecordFromWeb('${item.id}')" class="btn-icon-delete" title="Törlés">
                    🗑
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function renderPumpStreetList() {
    const listContainer = document.getElementById('pumpStreetList');
    const plantFilter = document.getElementById('pumpPlantFilter') ? document.getElementById('pumpPlantFilter').value : 'ALL';
    if (!listContainer) return;
    listContainer.innerHTML = '';

    const townsToDisplay = plantFilter === 'ALL' ? Object.keys(streetMapData) : [plantFilter];

    townsToDisplay.forEach(town => {
        const streets = streetMapData[town] || [];
        streets.forEach(street => {
            const existing = pumpRecords.find(r =>
                (r.settlementName || '').trim().toLowerCase() === town.trim().toLowerCase() &&
                (r.streetName || '').trim().toLowerCase() === street.trim().toLowerCase()
            );

            const p1Badge = existing ? (existing.pump1State === 1 ? '🟩 Működik' : (existing.pump1State === 2 ? '🟥 Rossz' : '⬜ Nincs')) : '⬜ Nincs';
            const p2Badge = existing ? (existing.pump2State === 1 ? '🟩 Működik' : (existing.pump2State === 2 ? '🟥 Rossz' : '⬜ Nincs')) : '⬜ Nincs';

            const p1Details = existing ? [existing.pump1Type, existing.pump1Serial ? existing.pump1Serial : ''].filter(Boolean).join(' - ') : '';
            const p2Details = existing ? [existing.pump2Type, existing.pump2Serial ? existing.pump2Serial : ''].filter(Boolean).join(' - ') : '';

            const p1Text = `1. Sziv.: <strong>${p1Badge}</strong> ${p1Details ? '<span style="color:#1b5e20;font-size:12px;font-weight:600;">(' + p1Details + ')</span>' : ''}`;
            const p2Text = `2. Sziv.: <strong>${p2Badge}</strong> ${p2Details ? '<span style="color:#1b5e20;font-size:12px;font-weight:600;">(' + p2Details + ')</span>' : ''}`;

            const card = document.createElement('div');
            card.className = 'street-card';
            card.style.cssText = "padding: 12px 20px; border-radius: 14px; display: flex; justify-content: space-between; align-items: center; background: #e8f5e9; border: 2px solid #a5d6a7; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 2px 6px rgba(0,0,0,0.04); flex-wrap: nowrap; gap: 16px;";
            card.onclick = () => openPumpVisualView(town, street);
            card.innerHTML = `
                <div style="display: flex; align-items: center; gap: 14px; flex-shrink: 0;">
                    <span style="background: #ffffff; color: #1b5e20; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 13px; border: 1px solid #c8e6c9;">${town}</span>
                    <h4 style="font-size: 16px; font-weight: bold; color: #222; margin: 0; white-space: nowrap;">${street}</h4>
                </div>

                <div style="display: flex; align-items: center; gap: 24px; font-size: 13px; color: #333; flex-wrap: nowrap; flex-shrink: 0;">
                    <span>${p1Text}</span>
                    <span>${p2Text}</span>
                </div>

                <div style="flex-shrink: 0;">
                    <span style="color: #1b5e20; font-size: 13px; font-weight: bold; white-space: nowrap;">📱 App Nézet & Szerkesztés ➜</span>
                </div>
            `;
            listContainer.appendChild(card);
        });
    });
}

function openPumpVisualView(town, street) {
    const visualContainer = document.getElementById('pumpVisualContainer');
    if (!visualContainer) return;

    currentVisualTown = town;
    currentVisualStreet = street;

    const record = pumpRecords.find(r =>
        (r.settlementName || '').trim().toLowerCase() === town.trim().toLowerCase() &&
        (r.streetName || '').trim().toLowerCase() === street.trim().toLowerCase()
    );

    currentP1State = record ? Number(record.pump1State || 0) : 0;
    currentP2State = record ? Number(record.pump2State || 0) : 0;

    const p1Type = record ? (record.pump1Type || '') : '';
    const p1Serial = record ? (record.pump1Serial || '') : '';
    const p2Type = record ? (record.pump2Type || '') : '';
    const p2Serial = record ? (record.pump2Serial || '') : '';

    renderVisualCardDOM(p1Type, p1Serial, p2Type, p2Serial);

    visualContainer.style.display = 'block';
    visualContainer.scrollIntoView({ behavior: 'smooth' });
}

function cycleWebCube(cubeNum) {
    if (cubeNum === 1) {
        currentP1State = (currentP1State + 1) % 3;
    } else {
        currentP2State = (currentP2State + 1) % 3;
    }
    saveCurrentVisualPump(true);
}

function saveCurrentVisualPump(shouldReRender = false) {
    const p1Type = document.getElementById('webP1Type') ? document.getElementById('webP1Type').value : '';
    const p1Serial = document.getElementById('webP1Serial') ? document.getElementById('webP1Serial').value : '';
    const p2Type = document.getElementById('webP2Type') ? document.getElementById('webP2Type').value : '';
    const p2Serial = document.getElementById('webP2Serial') ? document.getElementById('webP2Serial').value : '';

    if (shouldReRender) {
        renderVisualCardDOM(p1Type, p1Serial, p2Type, p2Serial);
    }

    const docId = `${currentVisualTown}_${currentVisualStreet}`.replace(/\s+/g, '_').replace(/\./g, '_').replace(/\//g, '_');
    const dateStr = new Date().toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '. ');

    const payload = {
        settlementName: currentVisualTown,
        streetName: currentVisualStreet,
        pump1State: currentP1State,
        pump1Type: p1Type,
        pump1Serial: p1Serial,
        pump1RemoveDate: "",
        pump1Pos: 1,
        pump2State: currentP2State,
        pump2Type: p2Type,
        pump2Serial: p2Serial,
        pump2RemoveDate: "",
        pump2Pos: 2,
        dateString: dateStr,
        userEmail: "bviz@bviz.hu",
        userName: "Vezetői Weboldal",
        timestamp: Date.now()
    };

    if (webSaveTimeout) clearTimeout(webSaveTimeout);
    webSaveTimeout = setTimeout(() => {
        if (typeof firebase !== 'undefined') {
            try {
                const db = firebase.firestore();
                db.collection("pump_records").doc(docId).set(payload, { merge: true })
                    .then(() => console.log("Sikeresen mentve a weboldalról Firestore-ba:", docId))
                    .catch(e => console.error("Firestore mentési hiba weboldalról:", e));
            } catch (e) {
                console.error("Firebase update error:", e);
            }
        }
    }, 200);
}

function renderVisualCardDOM(p1Type, p1Serial, p2Type, p2Serial) {
    const visualContainer = document.getElementById('pumpVisualContainer');
    if (!visualContainer) return;

    const p1Bg = currentP1State === 1 ? '#2e7d32' : (currentP1State === 2 ? '#c62828' : '#ffffff');
    const p1Text = currentP1State === 0 ? '#1b5e20' : '#ffffff';
    const p1Border = currentP1State === 0 ? '2px solid #1b5e20' : 'none';
    const p1Label = currentP1State === 1 ? 'Működő szivattyú' : (currentP1State === 2 ? 'Rossz szivattyú' : 'Nincs szivattyú');
    const p1LabelColor = currentP1State === 1 ? '#2e7d32' : (currentP1State === 2 ? '#c62828' : '#777777');

    const p2Bg = currentP2State === 1 ? '#2e7d32' : (currentP2State === 2 ? '#c62828' : '#ffffff');
    const p2Text = currentP2State === 0 ? '#1b5e20' : '#ffffff';
    const p2Border = currentP2State === 0 ? '2px solid #1b5e20' : 'none';
    const p2Label = currentP2State === 1 ? 'Működő szivattyú' : (currentP2State === 2 ? 'Rossz szivattyú' : 'Nincs szivattyú');
    const p2LabelColor = currentP2State === 1 ? '#2e7d32' : (currentP2State === 2 ? '#c62828' : '#777777');

    visualContainer.innerHTML = `
        <div style="background: #ffffff; border: 3px solid #1b5e20; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); max-width: 540px; margin: 0 auto; overflow: hidden;">
            <!-- Mobile App Title Header -->
            <div style="background: #1b5e20; padding: 18px 24px; color: white;">
                <h3 style="font-size: 22px; font-weight: bold; margin-bottom: 2px;">${currentVisualStreet}</h3>
                <p style="font-size: 14px; color: #c8e6c9;">${currentVisualTown} — Szivattyú Nyilvántartás</p>
            </div>

            <div style="padding: 24px;">
                <h4 style="text-align: center; color: #1b5e20; font-size: 16px; font-weight: bold; margin-bottom: 4px;">Szivattyú Állapotok és Adatok (Webes Szerkesztés)</h4>
                <p style="text-align: center; color: #777; font-size: 12px; margin-bottom: 20px;">Koppints a kockára a szín váltásához! Írj a mezőkbe a szerkesztéshez!</p>

                <!-- Side-by-Side 2-Column App Layout -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <!-- Column 1: Pump 1 -->
                    <div style="display: flex; flex-direction: column; align-items: center;">
                        <!-- Clickable Cube 1 -->
                        <div onclick="cycleWebCube(1)" title="Kattints a váltáshoz!" style="width: 84px; height: 84px; background: ${p1Bg}; border: ${p1Border}; border-radius: 16px; display: flex; justify-content: center; align-items: center; box-shadow: 0 4px 10px rgba(0,0,0,0.12); margin-bottom: 8px; cursor: pointer; transition: transform 0.1s;">
                            <span style="color: ${p1Text}; font-size: 13px; font-weight: bold; text-align: center; user-select: none;">1. Szivattyú</span>
                        </div>
                        <span style="color: ${p1LabelColor}; font-weight: bold; font-size: 13px; text-align: center; margin-bottom: 14px;">${p1Label}</span>

                        <!-- Editable Inputs for Pump 1 -->
                        <div style="width: 100%; text-align: left; margin-bottom: 10px;">
                            <label style="display: block; font-size: 11px; font-weight: bold; color: #1b5e20; margin-bottom: 3px;">Fajtája:</label>
                            <input type="text" id="webP1Type" oninput="saveCurrentVisualPump(false)" value="${p1Type}" placeholder="" style="width: 100%; padding: 9px; border-radius: 8px; border: 2px solid #1b5e20; background: #ffffff; font-size: 13px; font-weight: 600; box-sizing: border-box;">
                        </div>
                        <div style="width: 100%; text-align: left;">
                            <label style="display: block; font-size: 11px; font-weight: bold; color: #1b5e20; margin-bottom: 3px;">Gyári Száma:</label>
                            <input type="text" id="webP1Serial" oninput="saveCurrentVisualPump(false)" value="${p1Serial}" placeholder="" style="width: 100%; padding: 9px; border-radius: 8px; border: 2px solid #1b5e20; background: #ffffff; font-size: 13px; font-weight: 600; box-sizing: border-box;">
                        </div>
                    </div>

                    <!-- Column 2: Pump 2 -->
                    <div style="display: flex; flex-direction: column; align-items: center;">
                        <!-- Clickable Cube 2 -->
                        <div onclick="cycleWebCube(2)" title="Kattints a váltáshoz!" style="width: 84px; height: 84px; background: ${p2Bg}; border: ${p2Border}; border-radius: 16px; display: flex; justify-content: center; align-items: center; box-shadow: 0 4px 10px rgba(0,0,0,0.12); margin-bottom: 8px; cursor: pointer; transition: transform 0.1s;">
                            <span style="color: ${p2Text}; font-size: 13px; font-weight: bold; text-align: center; user-select: none;">2. Szivattyú</span>
                        </div>
                        <span style="color: ${p2LabelColor}; font-weight: bold; font-size: 13px; text-align: center; margin-bottom: 14px;">${p2Label}</span>

                        <!-- Editable Inputs for Pump 2 -->
                        <div style="width: 100%; text-align: left; margin-bottom: 10px;">
                            <label style="display: block; font-size: 11px; font-weight: bold; color: #1b5e20; margin-bottom: 3px;">Fajtája:</label>
                            <input type="text" id="webP2Type" oninput="saveCurrentVisualPump(false)" value="${p2Type}" placeholder="" style="width: 100%; padding: 9px; border-radius: 8px; border: 2px solid #1b5e20; background: #ffffff; font-size: 13px; font-weight: 600; box-sizing: border-box;">
                        </div>
                        <div style="width: 100%; text-align: left;">
                            <label style="display: block; font-size: 11px; font-weight: bold; color: #1b5e20; margin-bottom: 3px;">Gyári Száma:</label>
                            <input type="text" id="webP2Serial" oninput="saveCurrentVisualPump(false)" value="${p2Serial}" placeholder="" style="width: 100%; padding: 9px; border-radius: 8px; border: 2px solid #1b5e20; background: #ffffff; font-size: 13px; font-weight: 600; box-sizing: border-box;">
                        </div>
                    </div>
                </div>

                <!-- Back Button -->
                <div style="margin-top: 24px; text-align: right;">
                    <button onclick="closePumpVisualView()" style="background: #1b5e20; color: white; border: none; padding: 10px 24px; border-radius: 20px; font-weight: bold; cursor: pointer;">← Bezárás / Vissza</button>
                </div>
            </div>
        </div>
    `;
}

function closePumpVisualView() {
    const visualContainer = document.getElementById('pumpVisualContainer');
    if (visualContainer) visualContainer.style.display = 'none';
}

function deleteCleaningRecordFromWeb(docId) {
    if (confirm("Biztosan törölni szeretnéd ezt a takarítási adatot?")) {
        cleaningRecords = cleaningRecords.filter(r => r.id !== docId);
        renderCleaningTable();

        if (typeof firebase !== 'undefined') {
            try {
                const db = firebase.firestore();
                db.collection("cleaning_records").doc(docId).delete()
                    .then(() => {
                        console.log("Sikeresen törölve a Firestore-ból:", docId);
                    })
                    .catch(e => console.error("Hiba a Firestore törlésnél:", e));
            } catch (e) {
                console.error("Firebase hiba:", e);
            }
        }
    }
}

function deletePumpRecordFromWeb(docId) {
    if (confirm("Biztosan törölni szeretnéd ezt a szivattyú nyilvántartási adatot?")) {
        pumpRecords = pumpRecords.filter(r => r.id !== docId);
        renderPumpTable();

        if (typeof firebase !== 'undefined') {
            try {
                const db = firebase.firestore();
                db.collection("pump_records").doc(docId).delete()
                    .then(() => {
                        console.log("Sikeresen törölve a Firestore-ból:", docId);
                    })
                    .catch(e => console.error("Hiba a Firestore törlésnél:", e));
            } catch (e) {
                console.error("Firebase hiba:", e);
            }
        }
    }
}

function exportCleaningToExcel() {
    const plantFilter = document.getElementById('cleaningPlantFilter') ? document.getElementById('cleaningPlantFilter').value : 'ALL';
    const filtered = plantFilter === 'ALL' ? cleaningRecords : cleaningRecords.filter(r => (r.settlementName || '').trim().toLowerCase() === plantFilter.trim().toLowerCase());

    if (filtered.length === 0) {
        alert("Nincs letölthető takarítási adat!");
        return;
    }

    const sortedDesc = [...filtered].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    let csvContent = "\uFEFF";
    csvContent += "Takarítás Dátuma;Város / Település;Utca / Helyszín;Rögzítő Neve;Megjegyzés\n";

    sortedDesc.forEach((item) => {
        const line = [
            `"${item.dateString}"`,
            `"${item.settlementName || 'Apaj'}"`,
            `"${item.streetName || 'Helyszín'}"`,
            `"${item.userName || 'Mizsei Márk'}"`,
            `"${(item.note || '-').replace(/"/g, '""')}"`
        ].join(";");

        csvContent += line + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `Bviz_Takaritasi_Nyilvantartas_${plantFilter}_${dateStr}.csv`;

    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportPumpToExcel() {
    const plantFilter = document.getElementById('pumpPlantFilter') ? document.getElementById('pumpPlantFilter').value : 'ALL';
    const filtered = plantFilter === 'ALL' ? pumpRecords : pumpRecords.filter(r => (r.settlementName || '').trim().toLowerCase() === plantFilter.trim().toLowerCase());

    if (filtered.length === 0) {
        alert("Nincs letölthető szivattyú adat!");
        return;
    }

    const sortedDesc = [...filtered].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    let csvContent = "\uFEFF";
    csvContent += "Rögzítés Dátuma;Város / Település;Utca / Helyszín;1. Szivattyú Állapot;1. Szivattyú Fajtája;1. Szivattyú Gyári Szám;2. Szivattyú Állapot;2. Szivattyú Fajtája;2. Szivattyú Gyári Szám;Rögzítő Neve\n";

    sortedDesc.forEach((item) => {
        const p1Status = item.pump1State === 1 ? 'Múködő' : (item.pump1State === 2 ? 'Rossz' : 'Nincs szivattyú');
        const p2Status = item.pump2State === 1 ? 'Múködő' : (item.pump2State === 2 ? 'Rossz' : 'Nincs szivattyú');

        const line = [
            `"${item.dateString}"`,
            `"${item.settlementName || 'Apaj'}"`,
            `"${item.streetName || 'Helyszín'}"`,
            `"${p1Status}"`,
            `"${item.pump1Type || '-'}"`,
            `"${item.pump1Serial || '-'}"`,
            `"${p2Status}"`,
            `"${item.pump2Type || '-'}"`,
            `"${item.pump2Serial || '-'}"`,
            `"${item.userName || 'Mizsei Márk'}"`
        ].join(";");

        csvContent += line + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `Bviz_Szivattyu_Nyilvantartas_${plantFilter}_${dateStr}.csv`;

    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function renderPumpTable() {
    renderPumpStreetList();

    const tbody = document.getElementById('pumpTableBody');
    const plantFilter = document.getElementById('pumpPlantFilter') ? document.getElementById('pumpPlantFilter').value : 'ALL';
    if (!tbody) return;
    tbody.innerHTML = '';

    const filtered = plantFilter === 'ALL'
        ? pumpRecords
        : pumpRecords.filter(r => (r.settlementName || '').trim().toLowerCase() === plantFilter.trim().toLowerCase());

    const sortedDesc = [...filtered].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    if (sortedDesc.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="7" style="text-align: center; color: #666; padding: 24px; font-size: 14px;">Még nincs rögzített szivattyú adat ehhez a szűréshez. Regisztrálj egyet az applikációban az utcanévre kattintva!</td>`;
        tbody.appendChild(row);
        return;
    }

    sortedDesc.forEach((item) => {
        const p1StatusText = item.pump1State === 1 ? '<span style="color:#2e7d32;font-weight:bold;">🟩 Működik</span>' : (item.pump1State === 2 ? '<span style="color:#c62828;font-weight:bold;">🟥 Rossz</span>' : '<span style="color:gray;">⬜ Nincs</span>');
        const p2StatusText = item.pump2State === 1 ? '<span style="color:#2e7d32;font-weight:bold;">🟩 Működik</span>' : (item.pump2State === 2 ? '<span style="color:#c62828;font-weight:bold;">🟥 Rossz</span>' : '<span style="color:gray;">⬜ Nincs</span>');

        const p1Details = [item.pump1Type, item.pump1Serial ? 'SN: ' + item.pump1Serial : ''].filter(Boolean).join(' - ');
        const p2Details = [item.pump2Type, item.pump2Serial ? 'SN: ' + item.pump2Serial : ''].filter(Boolean).join(' - ');

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${item.dateString}</strong></td>
            <td><span style="background: #e8f5e9; padding: 4px 8px; border-radius: 4px; font-weight: bold; color: #1b5e20;">⚙️ ${item.settlementName || 'Apaj'}</span></td>
            <td><strong>${item.streetName || 'Helyszín'}</strong></td>
            <td>${p1StatusText} ${p1Details ? ' (' + p1Details + ')' : ''}</td>
            <td>${p2StatusText} ${p2Details ? ' (' + p2Details + ')' : ''}</td>
            <td><strong style="color: #1b5e20;">👤 ${item.userName || 'Mizsei Márk'}</strong></td>
            <td style="text-align: center;">
                <button onclick="openPumpVisualView('${item.settlementName || ''}', '${item.streetName || ''}')" style="background: #e8f5e9; border: 1px solid #2e7d32; color: #1b5e20; padding: 5px 10px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: bold; margin-right: 4px;" title="Nézet">
                    📱 App Nézet
                </button>
                <button onclick="deletePumpRecordFromWeb('${item.id}')" style="background: #ffebee; border: 1px solid #ef5350; color: #c62828; padding: 5px 10px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: bold;" title="Törlés">
                    🗑 Törlés
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function initDashboard() {
    renderTable();
    renderCleaningTable();
    renderPumpTable();

    fetchElectricityReadingsFromRest();
    fetchCleaningRecordsFromRest();
    fetchPumpRecordsFromRest();

    if (typeof firebase !== 'undefined') {
        try {
            firebase.initializeApp(firebaseConfig);
            const db = firebase.firestore();

            db.collection("electricity_readings").onSnapshot((snapshot) => {
                const list = [];
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    const rawEmail = (data.userEmail || "").trim().toLowerCase();
                    const rawName = (data.userName || "").trim();

                    let displayName = "Mizsei Márk";
                    if (rawName && !rawName.includes("@") && rawName.includes(" ")) {
                        displayName = rawName;
                    } else if (rawEmail.includes("mizsei") || rawName.toLowerCase().includes("mizse")) {
                        displayName = "Mizsei Márk";
                    } else if (rawEmail.includes("ori") || rawName.toLowerCase().includes("őri")) {
                        displayName = "Őri Csaba";
                    } else if (rawEmail.includes("peter") || rawName.toLowerCase().includes("kovács")) {
                        displayName = "Kovács Péter";
                    } else if (rawName && !rawName.includes("@")) {
                        displayName = rawName;
                    }

                    list.push({
                        id: doc.id,
                        settlementName: data.settlementName || "Apaj",
                        meterName: data.meterName || "Helyszín",
                        dateString: data.dateString || "",
                        timestamp: Number(data.timestamp) || 0,
                        dayKwh: Number(data.dayKwh) || 0,
                        userEmail: rawEmail,
                        userName: displayName,
                        note: data.note || ""
                    });
                });
                electricityReadings = list;
                renderTable();
            }, (error) => {
                console.warn("Firestore electricity_readings snapshot error:", error);
                fetchElectricityReadingsFromRest();
            });

            db.collection("cleaning_records").onSnapshot((snapshot) => {
                const list = [];
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    const rawEmail = (data.userEmail || "").trim().toLowerCase();
                    const rawName = (data.userName || "").trim();

                    let displayName = "Mizsei Márk";
                    if (rawName && !rawName.includes("@") && rawName.includes(" ")) {
                        displayName = rawName;
                    } else if (rawEmail.includes("mizsei") || rawName.toLowerCase().includes("mizse")) {
                        displayName = "Mizsei Márk";
                    } else if (rawEmail.includes("ori") || rawName.toLowerCase().includes("őri")) {
                        displayName = "Őri Csaba";
                    } else if (rawEmail.includes("peter") || rawName.toLowerCase().includes("kovács")) {
                        displayName = "Kovács Péter";
                    } else if (rawName && !rawName.includes("@")) {
                        displayName = rawName;
                    }

                    list.push({
                        id: doc.id,
                        settlementName: data.settlementName || "Apaj",
                        streetName: data.streetName || "Helyszín",
                        dateString: data.dateString || "",
                        timestamp: Number(data.timestamp) || 0,
                        userEmail: rawEmail,
                        userName: displayName,
                        note: data.note || ""
                    });
                });
                cleaningRecords = list;
                renderCleaningTable();
            }, (error) => {
                console.warn("Firestore cleaning_records snapshot error:", error);
                fetchCleaningRecordsFromRest();
            });

            db.collection("pump_records").onSnapshot((snapshot) => {
                const list = [];
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    const rawEmail = (data.userEmail || "").trim().toLowerCase();
                    const rawName = (data.userName || "").trim();

                    let displayName = "Mizsei Márk";
                    if (rawName && !rawName.includes("@") && rawName.includes(" ")) {
                        displayName = rawName;
                    } else if (rawEmail.includes("mizsei") || rawName.toLowerCase().includes("mizse")) {
                        displayName = "Mizsei Márk";
                    } else if (rawEmail.includes("ori") || rawName.toLowerCase().includes("őri")) {
                        displayName = "Őri Csaba";
                    } else if (rawEmail.includes("peter") || rawName.toLowerCase().includes("kovács")) {
                        displayName = "Kovács Péter";
                    } else if (rawName && !rawName.includes("@")) {
                        displayName = rawName;
                    }

                    list.push({
                        id: doc.id,
                        settlementName: data.settlementName || "Apaj",
                        streetName: data.streetName || "Helyszín",
                        dateString: data.dateString || "",
                        timestamp: Number(data.timestamp) || 0,
                        pump1State: Number(data.pump1State || 0),
                        pump1Type: data.pump1Type || "",
                        pump1Serial: data.pump1Serial || "",
                        pump2State: Number(data.pump2State || 0),
                        pump2Type: data.pump2Type || "",
                        pump2Serial: data.pump2Serial || "",
                        userEmail: rawEmail,
                        userName: displayName
                    });
                });
                pumpRecords = list;
                renderPumpTable();
            }, (error) => {
                console.warn("Firestore pump_records snapshot error:", error);
                fetchPumpRecordsFromRest();
            });

        } catch (e) {
            console.warn("Firebase initialization warning:", e);
            fetchElectricityReadingsFromRest();
            fetchCleaningRecordsFromRest();
            fetchPumpRecordsFromRest();
        }
    } else {
        fetchElectricityReadingsFromRest();
        fetchCleaningRecordsFromRest();
        fetchPumpRecordsFromRest();
    }
}

function renderTable() {
    const tbody = document.getElementById('readingsTableBody');
    const plantFilter = document.getElementById('plantFilter') ? document.getElementById('plantFilter').value : 'ALL';
    if (!tbody) return;
    tbody.innerHTML = '';

    const filtered = plantFilter === 'ALL'
        ? electricityReadings
        : electricityReadings.filter(r => (r.settlementName || '').trim().toLowerCase() === plantFilter.trim().toLowerCase());

    const sortedAsc = [...filtered].sort((a, b) => {
        if (a.dateString !== b.dateString) {
            return a.dateString.localeCompare(b.dateString);
        }
        return (a.timestamp || 0) - (b.timestamp || 0);
    });
    const sortedDesc = [...sortedAsc].reverse();

    const countElem = document.getElementById('totalReadingsCount');
    const uploaderElem = document.getElementById('latestUploader');
    const dateElem = document.getElementById('latestDate');

    if (countElem) countElem.innerText = `${filtered.length} db`;

    if (sortedDesc.length > 0) {
        const latest = sortedDesc[0];
        if (uploaderElem) uploaderElem.innerText = latest.userName || 'Mizsei Márk';
        if (dateElem) dateElem.innerText = `Legutóbbi: ${latest.dateString || ''}`;
    }

    sortedDesc.forEach((item) => {
        const sameMeterReadings = sortedAsc.filter(r =>
            (r.settlementName || '').trim().toLowerCase() === (item.settlementName || '').trim().toLowerCase() &&
            (r.meterName || '').trim().toLowerCase() === (item.meterName || '').trim().toLowerCase()
        );
        const itemIdx = sameMeterReadings.findIndex(r => r.id === item.id);
        const prev = itemIdx > 0 ? sameMeterReadings[itemIdx - 1] : null;

        const diffKwh = prev ? (item.dayKwh - prev.dayKwh) : null;
        const diffText = diffKwh !== null ? (diffKwh >= 0 ? '+' + diffKwh.toFixed(0) : diffKwh.toFixed(0)) : '-';
        const isPos = diffKwh === null || diffKwh >= 0;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${item.dateString}</strong></td>
            <td><span style="background: #e8f5e9; padding: 4px 8px; border-radius: 4px; font-weight: bold; color: #1b5e20;">⚡ ${item.settlementName || 'Apaj'}</span></td>
            <td><strong>${item.meterName || 'Helyszín'}</strong></td>
            <td style="font-size: 15px; font-weight: bold; color: #1565c0;">${item.dayKwh} kWh</td>
            <td><span style="background: ${isPos ? '#fff3e0' : '#ffebee'}; color: ${isPos ? '#e65100' : '#c62828'}; padding: 3px 8px; border-radius: 4px; font-weight: bold;">${diffText}</span></td>
            <td><strong style="color: #1b5e20;">👤 ${item.userName || 'Mizsei Márk'}</strong></td>
            <td>${item.note || '-'}</td>
            <td style="text-align: center; white-space: nowrap;">
                <button onclick="openEditModal('${item.id}')" class="btn-icon-edit" title="Szerkesztés">
                    ✏️
                </button>
                <button onclick="deleteReadingFromWeb('${item.id}')" class="btn-icon-delete" title="Törlés">
                    🗑
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

document.addEventListener('DOMContentLoaded', checkWebSession);

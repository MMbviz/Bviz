// Firebase Configuration for Bviz
const firebaseConfig = {
    apiKey: "AIzaSyB-EGb76xU3GK68ZTDE-Mw7nw1iA6uB4DA",
    authDomain: "bviz-1cf84.firebaseapp.com",
    projectId: "bviz-1cf84",
    storageBucket: "bviz-1cf84.firebasestorage.app",
    messagingSenderId: "1076211077079",
    appId: "1:1076211077079:web:bviz"
};

let electricityReadings = [];

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
    let item = electricityReadings.find(r => r.id === docId);
    let town = 'Apaj';
    let street = 'Helyszín';

    if (item) {
        town = item.settlementName;
        street = item.meterName;
    } else if (docId.startsWith('elec_')) {
        const parts = docId.split('_');
        town = (parts[1] || 'Apaj').replace(/_/g, ' ');
        street = (parts.slice(2).join(' ') || 'Helyszín').replace(/_/g, ' ');
    }

    const normTown = normalizeStreetName(town);
    const normStreet = normalizeStreetName(street);

    const sameMeterReadings = electricityReadings.filter(r =>
        normalizeStreetName(r.settlementName) === normTown &&
        normalizeStreetName(r.meterName) === normStreet
    ).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    const fixedDocId = `elec_${town}_${street}`.replace(/\s+/g, '_').replace(/\./g, '_').replace(/\//g, '_');
    const fixedDoc = sameMeterReadings.find(r => r.id === fixedDocId);
    const latestReading = fixedDoc || (sameMeterReadings.length > 0 ? sameMeterReadings[0] : null);
    const previousReading = sameMeterReadings.find(r => r.id !== (latestReading ? latestReading.id : ''));

    // Current reading (Óraállás - Column 5)
    let currKwhValue = '';
    if (latestReading && latestReading.dayKwh > 0) {
        currKwhValue = Math.round(latestReading.dayKwh);
    }

    // Previous reading (Előző Óraállás - Column 4)
    let prevKwhValue = '';
    if (latestReading && latestReading.dayKwh > 0) {
        const baselinePrev = (latestReading.prevDayKwh && latestReading.prevDayKwh > 0) ? latestReading.prevDayKwh : ((previousReading && previousReading.dayKwh > 0) ? previousReading.dayKwh : null);
        if (baselinePrev !== null && baselinePrev > 0) {
            prevKwhValue = Math.round(baselinePrev);
        }
    } else if (latestReading && latestReading.prevDayKwh && latestReading.prevDayKwh > 0) {
        prevKwhValue = Math.round(latestReading.prevDayKwh);
    }

    document.getElementById('editReadingId').value = latestReading ? latestReading.id : fixedDocId;
    document.getElementById('editSettlement').value = (town || 'Apaj').replace(/_/g, ' ');
    document.getElementById('editMeterName').value = (street || 'Helyszín').replace(/_/g, ' ');
    document.getElementById('editPrevDayKwh').value = prevKwhValue;
    document.getElementById('editDayKwh').value = currKwhValue;
    document.getElementById('editDateString').value = (latestReading ? latestReading.dateString : '') || '2026. 11. 11.';
    document.getElementById('editUserName').value = (latestReading ? latestReading.userName : '') || 'Vezetői Weboldal';
    const noteElem = document.getElementById('editReadingNote');
    if (noteElem) noteElem.value = (latestReading ? latestReading.note : '') || '';

    const modal = document.getElementById('editModal');
    if (modal) modal.style.display = 'flex';
}

function closeEditModal() {
    const modal = document.getElementById('editModal');
    if (modal) modal.style.display = 'none';
}

function saveEditFromWeb() {
    const docId = document.getElementById('editReadingId').value;
    const settlementName = document.getElementById('editSettlement').value.trim();
    const meterName = document.getElementById('editMeterName').value.trim();
    const dayKwhVal = document.getElementById('editDayKwh').value.trim();
    const prevDayKwhVal = document.getElementById('editPrevDayKwh').value.trim();
    const dateString = document.getElementById('editDateString').value.trim();
    const userName = document.getElementById('editUserName').value.trim() || 'Vezetői Weboldal';
    const noteText = document.getElementById('editReadingNote') ? document.getElementById('editReadingNote').value.trim() : '';

    const dayKwh = dayKwhVal !== '' ? Number(dayKwhVal) : 0;
    const prevDayKwh = prevDayKwhVal !== '' && !isNaN(Number(prevDayKwhVal)) ? Number(prevDayKwhVal) : null;

    const fixedDocId = `elec_${settlementName}_${meterName}`.replace(/\s+/g, '_').replace(/\./g, '_').replace(/\//g, '_');

    let idx = electricityReadings.findIndex(r =>
        (r.settlementName || '').trim().toLowerCase() === settlementName.toLowerCase() &&
        (r.meterName || '').trim().toLowerCase() === meterName.toLowerCase()
    );

    const payload = {
        settlementName: settlementName,
        meterName: meterName,
        dayKwh: dayKwh,
        dateString: dateString,
        userName: userName,
        note: noteText,
        userEmail: 'bviz@bviz.hu',
        timestamp: Date.now()
    };

    if (prevDayKwh !== null && !isNaN(prevDayKwh)) {
        payload.prevDayKwh = prevDayKwh;
    } else if (typeof firebase !== 'undefined') {
        payload.prevDayKwh = firebase.firestore.FieldValue.delete();
    }

    if (idx >= 0) {
        electricityReadings[idx].settlementName = settlementName;
        electricityReadings[idx].meterName = meterName;
        electricityReadings[idx].dayKwh = dayKwh;
        if (prevDayKwh !== null && !isNaN(prevDayKwh)) {
            electricityReadings[idx].prevDayKwh = prevDayKwh;
        } else {
            delete electricityReadings[idx].prevDayKwh;
        }
        electricityReadings[idx].dateString = dateString;
        electricityReadings[idx].userName = userName;
        electricityReadings[idx].note = noteText;
        electricityReadings[idx].timestamp = Date.now();
    } else {
        const newRecord = {
            id: fixedDocId,
            settlementName: settlementName,
            meterName: meterName,
            dayKwh: dayKwh,
            prevDayKwh: prevDayKwh,
            dateString: dateString,
            userEmail: 'bviz@bviz.hu',
            userName: userName,
            note: noteText,
            timestamp: Date.now()
        };
        electricityReadings.unshift(newRecord);
    }

    if (typeof firebase !== 'undefined') {
        try {
            const db = firebase.firestore();
            db.collection("electricity_readings").doc(fixedDocId).set(payload, { merge: true })
                .then(() => console.log("Sikeresen frissítve a Firestore-ban (mindkét óraállás):", fixedDocId))
                .catch(e => console.error("Hiba a Firestore frissítésnél:", e));

            if (dayKwh > 0) {
                const archiveId = `hist_${settlementName}_${meterName}_${dateString.replace(/\./g, '').replace(/\s+/g, '')}`.replace(/\s+/g, '_');
                db.collection("electricity_readings").doc(archiveId).set(payload, { merge: true });
            }
        } catch (e) {
            console.error("Firebase update error:", e);
        }
    }

    renderTable();
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
            const prevVal = fields.prevDayKwh ? (fields.prevDayKwh.doubleValue !== undefined ? fields.prevDayKwh.doubleValue : Number(fields.prevDayKwh.integerValue || 0)) : null;
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
                prevDayKwh: prevVal,
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
        row.style.cursor = 'pointer';
        row.title = 'Kattints a sorra a szerkesztéshez!';
        row.onclick = (e) => {
            if (e.target.tagName !== 'BUTTON') {
                openCleaningEditModal(item.id);
            }
        };
        row.innerHTML = `
            <td><strong>${item.dateString}</strong></td>
            <td><span style="background: #e0f2fe; padding: 4px 8px; border-radius: 4px; font-weight: bold; color: #0077b6;">🚛 ${item.settlementName || 'Apaj'}</span></td>
            <td><strong>${item.streetName || 'Helyszín'}</strong></td>
            <td><strong style="color: #0077b6;">👤 ${item.userName || 'Mizsei Márk'}</strong></td>
            <td>${item.note || '-'}</td>
            <td style="text-align: center; white-space: nowrap;">
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

    currentVisualTown = (town || '').replace(/_/g, ' ');
    currentVisualStreet = (street || '').replace(/_/g, ' ');

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

    const p1ChipBg = currentP1State === 1 ? '#e6f4ea' : (currentP1State === 2 ? '#fee2e2' : '#f1f5f9');
    const p1ChipText = currentP1State === 1 ? '● Üzemel' : (currentP1State === 2 ? '● Hibás' : 'Nincs szivattyú');
    const p1ChipColor = currentP1State === 1 ? '#137333' : (currentP1State === 2 ? '#b91c1c' : '#64748b');

    const p2ChipBg = currentP2State === 1 ? '#e6f4ea' : (currentP2State === 2 ? '#fee2e2' : '#f1f5f9');
    const p2ChipText = currentP2State === 1 ? '● Üzemel' : (currentP2State === 2 ? '● Hibás' : 'Nincs szivattyú');
    const p2ChipColor = currentP2State === 1 ? '#137333' : (currentP2State === 2 ? '#b91c1c' : '#64748b');

    visualContainer.innerHTML = `
        <div style="background: #ffffff; border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); max-width: 600px; margin: 0 auto; overflow: hidden; border: 1px solid #cbd5e1;">
            <!-- Header Banner (#0077b6 ocean blue) -->
            <div style="background: #0077b6; padding: 16px 20px; color: white; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h3 style="font-size: 20px; font-weight: bold; margin: 0; color: #ffffff;">${currentVisualStreet}</h3>
                    <p style="font-size: 13px; color: #e0f7fa; margin-top: 2px;">${currentVisualTown} • Szivattyú nyilvántartás</p>
                </div>
                <button onclick="document.getElementById('pumpVisualContainer').style.display='none'" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 6px 14px; border-radius: 20px; font-weight: bold; cursor: pointer; font-size: 13px;">✕ Bezárás</button>
            </div>

            <div style="padding: 20px;">
                <!-- Side-by-Side 2-Column App Layout matching Image 1 -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <!-- Column 1: 1. sz. Szivattyú Card -->
                    <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 14px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); text-align: center;">
                        <h4 style="font-size: 15px; font-weight: 600; color: #1e293b; margin-bottom: 8px;">1. sz. Szivattyú</h4>

                        <!-- Clickable Status Chip -->
                        <div onclick="cycleWebCube(1)" title="Kattints a státusz váltásához!" style="background: ${p1ChipBg}; color: ${p1ChipColor}; padding: 6px 14px; border-radius: 20px; font-weight: bold; font-size: 12px; cursor: pointer; display: inline-block; margin-bottom: 14px; user-select: none;">
                            ${p1ChipText}
                        </div>

                        <!-- Editable Inputs for Pump 1 with Clear X -->
                        <div style="text-align: left; margin-bottom: 12px;">
                            <label style="display: block; font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 4px;">Fajtája</label>
                            <div style="position: relative;">
                                <input type="text" id="webP1Type" value="${p1Type}" oninput="saveCurrentVisualPump(false)" placeholder="" style="width: 100%; padding: 10px 32px 10px 12px; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 14px; outline: none; box-sizing: border-box;">
                                ${p1Type ? '<span onclick="clearWebInput(\'webP1Type\')" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-weight: bold; cursor: pointer; font-size: 14px;">✕</span>' : ''}
                            </div>
                        </div>
                        <div style="text-align: left;">
                            <label style="display: block; font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 4px;">Gyári száma</label>
                            <div style="position: relative;">
                                <input type="text" id="webP1Serial" value="${p1Serial}" oninput="saveCurrentVisualPump(false)" placeholder="" style="width: 100%; padding: 10px 32px 10px 12px; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 14px; outline: none; box-sizing: border-box;">
                                ${p1Serial ? '<span onclick="clearWebInput(\'webP1Serial\')" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-weight: bold; cursor: pointer; font-size: 14px;">✕</span>' : ''}
                            </div>
                        </div>
                    </div>

                    <!-- Column 2: 2. sz. Szivattyú Card -->
                    <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 14px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); text-align: center;">
                        <h4 style="font-size: 15px; font-weight: 600; color: #1e293b; margin-bottom: 8px;">2. sz. Szivattyú</h4>

                        <!-- Clickable Status Chip -->
                        <div onclick="cycleWebCube(2)" title="Kattints a státusz váltásához!" style="background: ${p2ChipBg}; color: ${p2ChipColor}; padding: 6px 14px; border-radius: 20px; font-weight: bold; font-size: 12px; cursor: pointer; display: inline-block; margin-bottom: 14px; user-select: none;">
                            ${p2ChipText}
                        </div>

                        <!-- Editable Inputs for Pump 2 with Clear X -->
                        <div style="text-align: left; margin-bottom: 12px;">
                            <label style="display: block; font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 4px;">Fajtája</label>
                            <div style="position: relative;">
                                <input type="text" id="webP2Type" value="${p2Type}" oninput="saveCurrentVisualPump(false)" placeholder="" style="width: 100%; padding: 10px 32px 10px 12px; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 14px; outline: none; box-sizing: border-box;">
                                ${p2Type ? '<span onclick="clearWebInput(\'webP2Type\')" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-weight: bold; cursor: pointer; font-size: 14px;">✕</span>' : ''}
                            </div>
                        </div>
                        <div style="text-align: left;">
                            <label style="display: block; font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 4px;">Gyári száma</label>
                            <div style="position: relative;">
                                <input type="text" id="webP2Serial" value="${p2Serial}" oninput="saveCurrentVisualPump(false)" placeholder="" style="width: 100%; padding: 10px 32px 10px 12px; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 14px; outline: none; box-sizing: border-box;">
                                ${p2Serial ? '<span onclick="clearWebInput(\'webP2Serial\')" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-weight: bold; cursor: pointer; font-size: 14px;">✕</span>' : ''}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function closePumpVisualView() {
    const visualContainer = document.getElementById('pumpVisualContainer');
    if (visualContainer) visualContainer.style.display = 'none';
}

function openCleaningEditModal(docId) {
    const item = cleaningRecords.find(r => r.id === docId);
    if (!item) return;

    const idEl = document.getElementById('editCleaningId');
    const townEl = document.getElementById('editCleaningSettlement');
    const streetEl = document.getElementById('editCleaningStreet');
    const dateEl = document.getElementById('editCleaningDateString');
    const userEl = document.getElementById('editCleaningUserName');
    const noteEl = document.getElementById('editCleaningNote');

    if (idEl) idEl.value = item.id;
    if (townEl) townEl.value = (item.settlementName || 'Apaj').replace(/_/g, ' ');
    if (streetEl) streetEl.value = (item.streetName || 'Helyszín').replace(/_/g, ' ');
    if (dateEl) dateEl.value = item.dateString || '';
    if (userEl) userEl.value = item.userName || 'Mizsei Márk';
    if (noteEl) noteEl.value = item.note || '';

    const modal = document.getElementById('cleaningEditModal');
    if (modal) modal.style.display = 'flex';
}

function closeCleaningEditModal() {
    const modal = document.getElementById('cleaningEditModal');
    if (modal) modal.style.display = 'none';
}

function saveCleaningEditFromWeb() {
    const docId = document.getElementById('editCleaningId') ? document.getElementById('editCleaningId').value : '';
    const settlementName = document.getElementById('editCleaningSettlement') ? document.getElementById('editCleaningSettlement').value.trim() : '';
    const streetName = document.getElementById('editCleaningStreet') ? document.getElementById('editCleaningStreet').value.trim() : '';
    const dateString = document.getElementById('editCleaningDateString') ? document.getElementById('editCleaningDateString').value.trim() : '';
    const userName = document.getElementById('editCleaningUserName') ? document.getElementById('editCleaningUserName').value.trim() : '';
    const note = document.getElementById('editCleaningNote') ? document.getElementById('editCleaningNote').value.trim() : '';

    const idx = cleaningRecords.findIndex(r => r.id === docId);
    if (idx >= 0) {
        cleaningRecords[idx].settlementName = settlementName;
        cleaningRecords[idx].streetName = streetName;
        cleaningRecords[idx].dateString = dateString;
        cleaningRecords[idx].userName = userName;
        cleaningRecords[idx].note = note;
        renderCleaningTable();
    }

    if (typeof firebase !== 'undefined') {
        try {
            const db = firebase.firestore();
            db.collection("cleaning_records").doc(docId).update({
                settlementName: settlementName,
                streetName: streetName,
                dateString: dateString,
                userName: userName,
                note: note
            })
            .then(() => console.log("Sikeresen frissítve a Firestore-ban (takarítás):", docId))
            .catch(e => console.error("Hiba a Firestore frissítésnél (takarítás):", e));
        } catch (e) {
            console.error("Firebase update error:", e);
        }
    }

    closeCleaningEditModal();
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
    if (confirm("Biztosan törölni szeretnéd ezt a szivattyú nyilvántartási adatot/átemelőt?")) {
        const targetRecord = pumpRecords.find(r => r.id === docId);
        if (targetRecord) {
            const town = targetRecord.settlementName;
            const street = targetRecord.streetName;
            if (streetMapData[town]) {
                streetMapData[town] = streetMapData[town].filter(s => s !== street);
            }
        }

        pumpRecords = pumpRecords.filter(r => r.id !== docId);
        renderPumpTable();

        if (typeof firebase !== 'undefined') {
            try {
                const db = firebase.firestore();
                db.collection("pump_records").doc(docId).delete()
                    .then(() => console.log("Sikeresen törölve a Firestore-ból (pump_records):", docId))
                    .catch(e => console.error("Hiba a Firestore törlésnél:", e));
                db.collection("custom_streets").doc(docId).delete()
                    .then(() => console.log("Sikeresen törölve a custom_streets-ből:", docId))
                    .catch(e => console.error("Hiba a custom_streets törlésnél:", e));
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
    const searchQuery = document.getElementById('pumpSearch') ? document.getElementById('pumpSearch').value.trim().toLowerCase() : '';
    const pageSizeVal = document.getElementById('pumpPageSize') ? document.getElementById('pumpPageSize').value : 'ALL';

    if (!tbody) return;
    tbody.innerHTML = '';

    // Collect ALL streets across all towns from streetMapData
    const townsToInclude = plantFilter === 'ALL' ? Object.keys(streetMapData) : [plantFilter];
    let allStreetRows = [];

    townsToInclude.forEach(town => {
        const streets = streetMapData[town] || [];
        streets.forEach(street => {
            const existing = pumpRecords.find(r =>
                (r.settlementName || '').trim().toLowerCase() === town.trim().toLowerCase() &&
                (r.streetName || '').trim().toLowerCase() === street.trim().toLowerCase()
            );

            if (existing) {
                allStreetRows.push(existing);
            } else {
                allStreetRows.push({
                    id: `${town}_${street}`.replace(/\s+/g, '_').replace(/\./g, '_').replace(/\//g, '_'),
                    settlementName: town,
                    streetName: street,
                    dateString: '2026. 11. 11.',
                    timestamp: 0,
                    pump1State: 0,
                    pump1Type: '',
                    pump1Serial: '',
                    pump2State: 0,
                    pump2Type: '',
                    pump2Serial: '',
                    userName: 'Rendszer'
                });
            }
        });
    });

    if (searchQuery) {
        allStreetRows = allStreetRows.filter(r =>
            (r.settlementName || '').toLowerCase().includes(searchQuery) ||
            (r.streetName || '').toLowerCase().includes(searchQuery) ||
            (r.userName || '').toLowerCase().includes(searchQuery) ||
            (r.pump1Type || '').toLowerCase().includes(searchQuery) ||
            (r.pump1Serial || '').toLowerCase().includes(searchQuery) ||
            (r.pump2Type || '').toLowerCase().includes(searchQuery) ||
            (r.pump2Serial || '').toLowerCase().includes(searchQuery) ||
            (r.dateString || '').toLowerCase().includes(searchQuery)
        );
    }

    const totalCount = allStreetRows.length;
    const summaryCountEl = document.getElementById('pumpSummaryCount');
    if (summaryCountEl) {
        summaryCountEl.textContent = `Összesen: ${totalCount} bejegyzés`;
    }

    let displayList = allStreetRows;
    if (pageSizeVal !== 'ALL') {
        const size = parseInt(pageSizeVal, 10) || 50;
        displayList = allStreetRows.slice(0, size);
    }

    if (displayList.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="7" style="text-align: center; color: #64748b; padding: 24px; font-size: 14px;">Még nincs rögzített szivattyú adat ehhez a szűréshez.</td>`;
        tbody.appendChild(row);
        return;
    }

    displayList.forEach((item) => {
        const p1StatusBadge = item.pump1State === 1
            ? '<span style="background: #e6f4ea; color: #137333; font-weight: bold; padding: 4px 10px; border-radius: 20px; font-size: 12px; display: inline-block;">● Üzemel</span>'
            : (item.pump1State === 2
                ? '<span style="background: #fee2e2; color: #b91c1c; font-weight: bold; padding: 4px 10px; border-radius: 20px; font-size: 12px; display: inline-block;">● Hibás</span>'
                : '<span style="background: #f1f5f9; color: #64748b; font-weight: 600; padding: 4px 10px; border-radius: 20px; font-size: 12px; display: inline-block;">Nincs szivattyú</span>');

        const p2StatusBadge = item.pump2State === 1
            ? '<span style="background: #e6f4ea; color: #137333; font-weight: bold; padding: 4px 10px; border-radius: 20px; font-size: 12px; display: inline-block;">● Üzemel</span>'
            : (item.pump2State === 2
                ? '<span style="background: #fee2e2; color: #b91c1c; font-weight: bold; padding: 4px 10px; border-radius: 20px; font-size: 12px; display: inline-block;">● Hibás</span>'
                : '<span style="background: #f1f5f9; color: #64748b; font-weight: 600; padding: 4px 10px; border-radius: 20px; font-size: 12px; display: inline-block;">Nincs szivattyú</span>');

        const p1Details = [item.pump1Type, item.pump1Serial].filter(Boolean).join(' - ');
        const p2Details = [item.pump2Type, item.pump2Serial].filter(Boolean).join(' - ');

        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        row.title = 'Kattints a sorra a szerkesztéshez!';
        row.onclick = (e) => {
            if (e.target.tagName !== 'BUTTON') {
                openPumpVisualView(item.settlementName || '', item.streetName || '');
            }
        };
        row.innerHTML = `
            <td><strong>${item.dateString || '2026. 11. 11.'}</strong></td>
            <td><span style="background: #e0f2fe; padding: 4px 8px; border-radius: 4px; font-weight: bold; color: #0077b6;">⚙️ ${item.settlementName || 'Apaj'}</span></td>
            <td><strong>${item.streetName || 'Helyszín'}</strong></td>
            <td>${p1StatusBadge} ${p1Details ? '<span style="color: #334155; font-size: 13px; font-weight: 500; margin-left: 6px;">(' + p1Details + ')</span>' : ''}</td>
            <td>${p2StatusBadge} ${p2Details ? '<span style="color: #334155; font-size: 13px; font-weight: 500; margin-left: 6px;">(' + p2Details + ')</span>' : ''}</td>
            <td><strong style="color: #0077b6;">👤 ${item.userName || 'Rendszer'}</strong></td>
            <td style="text-align: center; white-space: nowrap;">
                <button onclick="deletePumpRecordFromWeb('${item.id}')" class="btn-icon-delete" title="Törlés">
                    🗑
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
                        prevDayKwh: (data.prevDayKwh !== undefined && data.prevDayKwh !== null) ? Number(data.prevDayKwh) : null,
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

function normalizeStreetName(str) {
    if (!str) return '';
    return str.toString()
        .trim()
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\./g, '')
        .replace(/\s+/g, ' ');
}

function renderTable() {
    const tbody = document.getElementById('readingsTableBody');
    const plantFilter = document.getElementById('plantFilter') ? document.getElementById('plantFilter').value : 'ALL';
    const searchQuery = document.getElementById('electricitySearch') ? document.getElementById('electricitySearch').value.trim().toLowerCase() : '';
    const pageSizeVal = document.getElementById('electricityPageSize') ? document.getElementById('electricityPageSize').value : 'ALL';

    if (!tbody) return;
    tbody.innerHTML = '';

    const townsToInclude = plantFilter === 'ALL' ? Object.keys(streetMapData) : [plantFilter];
    let allElecRows = [];

    // Monthly rollover cycle check (5th of the month)
    const now = new Date();
    const currentDay = now.getDate();
    const isNewCycle = currentDay >= 5;

    townsToInclude.forEach(town => {
        const streets = streetMapData[town] || [];
        streets.forEach(street => {
            const normTown = normalizeStreetName(town);
            const normStreet = normalizeStreetName(street);

            const sameMeterReadings = electricityReadings.filter(r =>
                normalizeStreetName(r.settlementName) === normTown &&
                normalizeStreetName(r.meterName) === normStreet
            ).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

            const fixedDocId = `elec_${town}_${street}`.replace(/\s+/g, '_').replace(/\./g, '_').replace(/\//g, '_');
            const fixedDoc = sameMeterReadings.find(r => r.id === fixedDocId);
            const latestReading = fixedDoc || (sameMeterReadings.length > 0 ? sameMeterReadings[0] : null);

            const previousReading = sameMeterReadings.find(r => r.id !== (latestReading ? latestReading.id : ''));

            let prevKwhText = '-';
            let currKwhText = '-';
            let diffBadge = '<span style="color:#94a3b8;">-</span>';
            let dateStr = '2026. 11. 11.';
            let uploaderName = 'Rendszer';
            let noteText = '-';
            let docId = fixedDocId;

            if (latestReading) {
                dateStr = latestReading.dateString || '2026. 11. 11.';
                noteText = latestReading.note || noteText;
                docId = latestReading.id;

                const mostRecentDoc = sameMeterReadings.length > 0 ? sameMeterReadings[0] : null;
                if (mostRecentDoc && mostRecentDoc.userName && mostRecentDoc.userName.trim() !== '') {
                    uploaderName = mostRecentDoc.userName;
                } else if (latestReading.userName) {
                    uploaderName = latestReading.userName;
                }

                if (latestReading.dayKwh > 0) {
                    currKwhText = `${Math.round(latestReading.dayKwh)} kWh`;

                    const baselinePrev = (latestReading.prevDayKwh && latestReading.prevDayKwh > 0) ? latestReading.prevDayKwh : ((previousReading && previousReading.dayKwh > 0) ? previousReading.dayKwh : null);

                    if (baselinePrev !== null && baselinePrev > 0) {
                        prevKwhText = `${Math.round(baselinePrev)} kWh`;
                        const diff = latestReading.dayKwh - baselinePrev;
                        if (diff >= 0) {
                            diffBadge = `<span style="background: #dcfce7; color: #15803d; font-weight: bold; padding: 3px 8px; border-radius: 6px; font-size: 12px; display: inline-block;">▲ +${Math.round(diff)} kWh</span>`;
                        } else {
                            diffBadge = `<span style="background: #fee2e2; color: #b91c1c; font-weight: bold; padding: 3px 8px; border-radius: 6px; font-size: 12px; display: inline-block;">▼ ${Math.round(diff)} kWh</span>`;
                        }
                    }
                } else if (latestReading.prevDayKwh && latestReading.prevDayKwh > 0) {
                    prevKwhText = `${Math.round(latestReading.prevDayKwh)} kWh`;
                }
            }

            allElecRows.push({
                id: docId,
                settlementName: town,
                meterName: street,
                dateString: dateStr,
                prevKwhText: prevKwhText,
                currKwhText: currKwhText,
                diffBadge: diffBadge,
                userName: uploaderName,
                note: noteText
            });
        });
    });

    if (searchQuery) {
        allElecRows = allElecRows.filter(r =>
            (r.settlementName || '').toLowerCase().includes(searchQuery) ||
            (r.meterName || '').toLowerCase().includes(searchQuery) ||
            (r.userName || '').toLowerCase().includes(searchQuery) ||
            (r.prevKwhText || '').toLowerCase().includes(searchQuery) ||
            (r.currKwhText || '').toLowerCase().includes(searchQuery) ||
            (r.dateString || '').toLowerCase().includes(searchQuery) ||
            (r.note || '').toLowerCase().includes(searchQuery)
        );
    }

    const totalCount = allElecRows.length;
    const summaryCountEl = document.getElementById('electricitySummaryCount');
    if (summaryCountEl) {
        summaryCountEl.textContent = `Összesen: ${totalCount} bejegyzés`;
    }

    let displayList = allElecRows;
    if (pageSizeVal !== 'ALL') {
        const size = parseInt(pageSizeVal, 10) || 50;
        displayList = allElecRows.slice(0, size);
    }

    if (displayList.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="9" style="text-align: center; color: #64748b; padding: 24px; font-size: 14px;">Még nincs rögzített leolvasási adat ehhez a szűréshez.</td>`;
        tbody.appendChild(row);
        return;
    }

    displayList.forEach((item) => {
        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        row.title = 'Kattints a sorra a szerkesztéshez!';
        row.onclick = (e) => {
            if (e.target.tagName !== 'BUTTON') {
                openEditModal(item.id);
            }
        };
        row.innerHTML = `
            <td><strong>${item.dateString}</strong></td>
            <td><span style="background: #e0f2fe; padding: 4px 8px; border-radius: 4px; font-weight: bold; color: #0077b6;">⚡ ${item.settlementName}</span></td>
            <td><strong>${item.meterName}</strong></td>
            <td><span style="color: #64748b; font-size: 14px; font-weight: 600;">${item.prevKwhText}</span></td>
            <td><strong style="color: #0f172a; font-size: 15px;">${item.currKwhText}</strong></td>
            <td>${item.diffBadge}</td>
            <td><strong style="color: #0077b6;">👤 ${item.userName}</strong></td>
            <td>${item.note}</td>
            <td style="text-align: center; white-space: nowrap;">
                <button onclick="openHistoryModal('${item.settlementName}', '${item.meterName}')" class="btn-icon-history" title="Előzmények megtekintése" style="background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; border-radius: 6px; padding: 4px 8px; font-size: 14px; cursor: pointer; margin-right: 6px;">📜</button>
                <button onclick="deleteReadingFromWeb('${item.id}')" class="btn-icon-delete" title="Törlés">
                    🗑
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Add Custom Street Modal functions
function openAddCustomStreetModal() {
    const townSelect = document.getElementById('customTownSelect');
    if (townSelect) townSelect.value = 'Apaj';

    const townInput = document.getElementById('customTownInput');
    if (townInput) {
        townInput.value = '';
        townInput.style.display = 'none';
    }

    const streetInput = document.getElementById('customStreetNameInput');
    if (streetInput) streetInput.value = '';

    const modal = document.getElementById('addCustomStreetModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeAddCustomStreetModal() {
    const modal = document.getElementById('addCustomStreetModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function openDeleteCustomStreetModal() {
    updateDeleteCustomStreetDropdown();
    const modal = document.getElementById('deleteCustomStreetModal');
    if (modal) modal.style.display = 'flex';
}

function closeDeleteCustomStreetModal() {
    const modal = document.getElementById('deleteCustomStreetModal');
    if (modal) modal.style.display = 'none';
}

function updateDeleteCustomStreetDropdown() {
    const town = document.getElementById('deleteCustomTownSelect') ? document.getElementById('deleteCustomTownSelect').value : 'Apaj';
    const streetSelect = document.getElementById('deleteCustomStreetSelect');
    if (!streetSelect) return;
    streetSelect.innerHTML = '';

    const defaultStreets = streetMapData[town] || [];
    const customFromPumps = pumpRecords.filter(r => (r.settlementName || '').trim().toLowerCase() === town.trim().toLowerCase()).map(r => r.streetName);
    const customFromElec = electricityReadings.filter(r => (r.settlementName || '').trim().toLowerCase() === town.trim().toLowerCase()).map(r => r.meterName);
    const customFromClean = cleaningRecords.filter(r => (r.settlementName || '').trim().toLowerCase() === town.trim().toLowerCase()).map(r => r.streetName);

    const allStreets = [...defaultStreets, ...customFromPumps, ...customFromElec, ...customFromClean]
        .filter(Boolean)
        .filter((v, i, a) => a.findIndex(t => t.toLowerCase() === v.toLowerCase()) === i);

    if (allStreets.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'Nincs törölhető utca';
        streetSelect.appendChild(opt);
        return;
    }

    allStreets.forEach(st => {
        const opt = document.createElement('option');
        opt.value = st;
        opt.textContent = st;
        streetSelect.appendChild(opt);
    });
}

function executeDeleteCustomStreetFromWeb() {
    const townSelect = document.getElementById('deleteCustomTownSelect');
    const town = townSelect ? townSelect.value : 'Apaj';
    const streetSelect = document.getElementById('deleteCustomStreetSelect');
    const street = streetSelect ? streetSelect.value : '';

    if (!street) {
        alert("Nincs kiválasztva törlendő utca!");
        return;
    }

    if (confirm(`Biztosan törölni szeretnéd a(z) "${street}" átemelőt (${town}) mind az appból, mind a weboldalról?`)) {
        if (streetMapData[town]) {
            streetMapData[town] = streetMapData[town].filter(s => s.toLowerCase() !== street.toLowerCase());
        }

        electricityReadings = electricityReadings.filter(r => !( (r.settlementName || '').toLowerCase() === town.toLowerCase() && (r.meterName || '').toLowerCase() === street.toLowerCase() ));
        cleaningRecords = cleaningRecords.filter(r => !( (r.settlementName || '').toLowerCase() === town.toLowerCase() && (r.streetName || '').toLowerCase() === street.toLowerCase() ));
        pumpRecords = pumpRecords.filter(r => !( (r.settlementName || '').toLowerCase() === town.toLowerCase() && (r.streetName || '').toLowerCase() === street.toLowerCase() ));

        const docId = `${town}_${street}`.replace(/\s+/g, '_').replace(/\./g, '_').replace(/\//g, '_');
        if (typeof firebase !== 'undefined') {
            try {
                const db = firebase.firestore();
                db.collection("custom_streets").doc(docId).delete().then(() => {
                    console.log("Custom street deleted from Firestore:", docId);
                }).catch(e => console.error("Error deleting custom street:", e));

                db.collection("pump_records").doc(docId).delete();
                db.collection("electricity_readings").where("settlementName", "==", town).where("meterName", "==", street).get().then(snapshot => {
                    snapshot.forEach(doc => doc.ref.delete());
                });
                db.collection("cleaning_records").where("settlementName", "==", town).where("streetName", "==", street).get().then(snapshot => {
                    snapshot.forEach(doc => doc.ref.delete());
                });
            } catch (e) {
                console.error("Firebase delete error:", e);
            }
        }

        updateAddElecStreetDropdown();
        updateAddCleanStreetDropdown();
        updateAddPumpStreetDropdown();
        updateDeleteCustomStreetDropdown();
        renderTable();
        renderCleaningTable();
        renderPumpTable();

        alert(`A(z) "${street}" átemelő (${town}) véglegesen törölve lett a weboldalról és az Android applikációból is!`);
        closeDeleteCustomStreetModal();
    }
}

function toggleCustomTownInput() {
    const townSelect = document.getElementById('customTownSelect');
    const inputEl = document.getElementById('customTownInput');
    if (townSelect && inputEl) {
        inputEl.style.display = townSelect.value === 'NEW_TOWN' ? 'block' : 'none';
    }
}

function saveCustomStreetFromWeb() {
    const townSelect = document.getElementById('customTownSelect');
    let settlement = townSelect ? townSelect.value : 'Apaj';
    if (settlement === 'NEW_TOWN') {
        const customTownInput = document.getElementById('customTownInput');
        settlement = customTownInput ? customTownInput.value.trim() : '';
        if (!settlement) {
            alert("Kérjük írd be az új település nevét!");
            return;
        }
    }

    const streetName = document.getElementById('customStreetNameInput') ? document.getElementById('customStreetNameInput').value.trim() : '';

    if (!streetName) {
        alert("Kérjük írd be az új átemelő utca nevét!");
        return;
    }

    if (!streetMapData[settlement]) {
        streetMapData[settlement] = [];
    }
    if (!streetMapData[settlement].includes(streetName)) {
        streetMapData[settlement].push(streetName);
    }

    const docId = `${settlement}_${streetName}`.replace(/\s+/g, '_').replace(/\./g, '_').replace(/\//g, '_');
    const dateStr = new Date().toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '. ');

    const customStreetPayload = {
        settlementName: settlement,
        streetName: streetName,
        timestamp: Date.now()
    };

    const pumpPayload = {
        id: docId,
        settlementName: settlement,
        streetName: streetName,
        pump1State: 0,
        pump1Type: "",
        pump1Serial: "",
        pump2State: 0,
        pump2Type: "",
        pump2Serial: "",
        dateString: dateStr,
        userEmail: "bviz@bviz.hu",
        userName: "Vezetői Weboldal",
        timestamp: Date.now()
    };

    const idxP = pumpRecords.findIndex(r => r.id === docId);
    if (idxP >= 0) {
        pumpRecords[idxP] = pumpPayload;
    } else {
        pumpRecords.unshift(pumpPayload);
    }

    if (typeof firebase !== 'undefined') {
        try {
            const db = firebase.firestore();
            db.collection("custom_streets").doc(docId).set(customStreetPayload, { merge: true });
            db.collection("pump_records").doc(docId).set(pumpPayload, { merge: true });
        } catch (e) {
            console.error("Firebase custom street save error:", e);
        }
    }

    updateAddElecStreetDropdown();
    updateAddCleanStreetDropdown();
    updateAddPumpStreetDropdown();
    renderTable();
    renderCleaningTable();
    renderPumpTable();

    alert(`A(z) "${streetName}" átemelő (${settlement}) sikeresen létrehozva és szinkronizálva!`);
    closeAddCustomStreetModal();
}

// Dropdown street updates
function updateAddElecStreetDropdown() {
    const settlement = document.getElementById('addElecSettlement') ? document.getElementById('addElecSettlement').value : 'Apaj';
    const streetSelect = document.getElementById('addElecStreet');
    if (!streetSelect) return;
    streetSelect.innerHTML = '';
    const defaultStreets = streetMapData[settlement] || ["1. sz. Helyszín", "2. sz. Helyszín"];
    const customFromElec = electricityReadings.filter(r => (r.settlementName || '').trim().toLowerCase() === settlement.trim().toLowerCase()).map(r => r.meterName);
    const allStreets = [...defaultStreets, ...customFromElec].filter(Boolean).filter((v, i, a) => a.findIndex(t => t.toLowerCase() === v.toLowerCase()) === i);

    allStreets.forEach(st => {
        const opt = document.createElement('option');
        opt.value = st;
        opt.textContent = st;
        streetSelect.appendChild(opt);
    });
}

function updateAddCleanStreetDropdown() {
    const settlement = document.getElementById('addCleanSettlement') ? document.getElementById('addCleanSettlement').value : 'Apaj';
    const streetSelect = document.getElementById('addCleanStreet');
    if (!streetSelect) return;
    streetSelect.innerHTML = '';
    const defaultStreets = streetMapData[settlement] || ["1. sz. Helyszín", "2. sz. Helyszín"];
    const customFromClean = cleaningRecords.filter(r => (r.settlementName || '').trim().toLowerCase() === settlement.trim().toLowerCase()).map(r => r.streetName);
    const allStreets = [...defaultStreets, ...customFromClean].filter(Boolean).filter((v, i, a) => a.findIndex(t => t.toLowerCase() === v.toLowerCase()) === i);

    allStreets.forEach(st => {
        const opt = document.createElement('option');
        opt.value = st;
        opt.textContent = st;
        streetSelect.appendChild(opt);
    });
}

function updateAddPumpStreetDropdown() {
    const settlement = document.getElementById('addPumpSettlement') ? document.getElementById('addPumpSettlement').value : 'Apaj';
    const streetSelect = document.getElementById('addPumpStreet');
    if (!streetSelect) return;
    streetSelect.innerHTML = '';
    const defaultStreets = streetMapData[settlement] || ["1. sz. Helyszín", "2. sz. Helyszín"];
    const customFromPumps = pumpRecords.filter(r => (r.settlementName || '').trim().toLowerCase() === settlement.trim().toLowerCase()).map(r => r.streetName);
    const allStreets = [...defaultStreets, ...customFromPumps].filter(Boolean).filter((v, i, a) => a.findIndex(t => t.toLowerCase() === v.toLowerCase()) === i);

    allStreets.forEach(st => {
        const opt = document.createElement('option');
        opt.value = st;
        opt.textContent = st;
        streetSelect.appendChild(opt);
    });
}

// 1. Add Electricity Modal
function openAddElectricityModal() {
    updateAddElecStreetDropdown();
    const dateEl = document.getElementById('addElecDateString');
    if (dateEl) {
        dateEl.value = new Date().toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '. ');
    }
    const modal = document.getElementById('addElectricityModal');
    if (modal) modal.style.display = 'flex';
}

function closeAddElectricityModal() {
    const modal = document.getElementById('addElectricityModal');
    if (modal) modal.style.display = 'none';
}

function saveNewElectricityFromWeb() {
    const settlement = document.getElementById('addElecSettlement').value;
    const streetSelect = document.getElementById('addElecStreet');
    let street = streetSelect ? streetSelect.value : '';
    if (street === 'NEW_STREET') {
        const customEl = document.getElementById('addElecNewStreetInput');
        street = customEl ? customEl.value.trim() : '';
        if (street.length === 0) {
            alert("Kérjük írd be az új utca/átemelő nevét!");
            return;
        }
        if (!streetMapData[settlement]) streetMapData[settlement] = [];
        if (!streetMapData[settlement].includes(street)) streetMapData[settlement].push(street);
    }
    const dayKwh = Number(document.getElementById('addElecDayKwh').value);
    const dateString = document.getElementById('addElecDateString').value.trim();
    const userName = document.getElementById('addElecUserName').value.trim() || 'Vezetői Weboldal';

    if (isNaN(dayKwh) || dayKwh < 0) {
        alert("Kérjük adj meg egy érvényes leolvasott óraállást!");
        return;
    }

    const newDocId = `web_${Date.now()}`;
    const newRecord = {
        id: newDocId,
        settlementName: settlement,
        meterName: street,
        dayKwh: dayKwh,
        dateString: dateString,
        userEmail: 'bviz@bviz.hu',
        userName: userName,
        note: '',
        timestamp: Date.now()
    };

    electricityReadings.unshift(newRecord);
    renderTable();

    if (typeof firebase !== 'undefined') {
        try {
            const db = firebase.firestore();
            db.collection("electricity_readings").add({
                settlementName: settlement,
                meterName: street,
                dayKwh: dayKwh,
                dateString: dateString,
                userEmail: 'bviz@bviz.hu',
                userName: userName,
                note: '',
                timestamp: Date.now()
            }).then(() => console.log("Új villanyóra leolvasás elmentve Firestore-ba!"))
            .catch(e => console.error("Hiba az új leolvasás mentésénél:", e));
        } catch (e) {
            console.error("Firebase save error:", e);
        }
    }

    closeAddElectricityModal();
}

// 2. Add Cleaning Modal
function openAddCleaningModal() {
    updateAddCleanStreetDropdown();
    const dateEl = document.getElementById('addCleanDateString');
    if (dateEl) {
        dateEl.value = new Date().toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '. ');
    }
    const modal = document.getElementById('addCleaningModal');
    if (modal) modal.style.display = 'flex';
}

function closeAddCleaningModal() {
    const modal = document.getElementById('addCleaningModal');
    if (modal) modal.style.display = 'none';
}

function saveNewCleaningFromWeb() {
    const settlement = document.getElementById('addCleanSettlement').value;
    const streetSelect = document.getElementById('addCleanStreet');
    let street = streetSelect ? streetSelect.value : '';
    if (street === 'NEW_STREET') {
        const customEl = document.getElementById('addCleanNewStreetInput');
        street = customEl ? customEl.value.trim() : '';
        if (street.length === 0) {
            alert("Kérjük írd be az új utca/átemelő nevét!");
            return;
        }
        if (!streetMapData[settlement]) streetMapData[settlement] = [];
        if (!streetMapData[settlement].includes(street)) streetMapData[settlement].push(street);
    }
    const dateString = document.getElementById('addCleanDateString').value.trim();
    const userName = document.getElementById('addCleanUserName').value.trim() || 'Vezetői Weboldal';
    const note = document.getElementById('addCleanNote') ? document.getElementById('addCleanNote').value.trim() : '';

    const newDocId = `web_clean_${Date.now()}`;
    const newRecord = {
        id: newDocId,
        settlementName: settlement,
        streetName: street,
        dateString: dateString,
        userEmail: 'bviz@bviz.hu',
        userName: userName,
        note: note,
        timestamp: Date.now()
    };

    cleaningRecords.unshift(newRecord);
    renderCleaningTable();

    if (typeof firebase !== 'undefined') {
        try {
            const db = firebase.firestore();
            db.collection("cleaning_records").add({
                settlementName: settlement,
                streetName: street,
                dateString: dateString,
                userEmail: 'bviz@bviz.hu',
                userName: userName,
                note: note,
                timestamp: Date.now()
            }).then(() => console.log("Új takarítási adat elmentve Firestore-ba!"))
            .catch(e => console.error("Hiba az új takarítás mentésénél:", e));
        } catch (e) {
            console.error("Firebase save error:", e);
        }
    }

    closeAddCleaningModal();
}

// 3. Add Pump Modal
function openAddPumpModal() {
    updateAddPumpStreetDropdown();
    const modal = document.getElementById('addPumpModal');
    if (modal) modal.style.display = 'flex';
}

function closeAddPumpModal() {
    const modal = document.getElementById('addPumpModal');
    if (modal) modal.style.display = 'none';
}

function saveNewPumpFromWeb() {
    const settlement = document.getElementById('addPumpSettlement').value;
    const streetSelect = document.getElementById('addPumpStreet');
    let street = streetSelect ? streetSelect.value : '';
    if (street === 'NEW_STREET') {
        const customEl = document.getElementById('addPumpNewStreetInput');
        street = customEl ? customEl.value.trim() : '';
        if (street.length === 0) {
            alert("Kérjük írd be az új utca/átemelő nevét!");
            return;
        }
        if (!streetMapData[settlement]) streetMapData[settlement] = [];
        if (!streetMapData[settlement].includes(street)) streetMapData[settlement].push(street);
    }
    const p1State = Number(document.getElementById('addPumpP1State').value || 0);
    const p1Type = document.getElementById('addPumpP1Type') ? document.getElementById('addPumpP1Type').value.trim() : '';
    const p1Serial = document.getElementById('addPumpP1Serial') ? document.getElementById('addPumpP1Serial').value.trim() : '';

    const p2State = Number(document.getElementById('addPumpP2State').value || 0);
    const p2Type = document.getElementById('addPumpP2Type') ? document.getElementById('addPumpP2Type').value.trim() : '';
    const p2Serial = document.getElementById('addPumpP2Serial') ? document.getElementById('addPumpP2Serial').value.trim() : '';

    const docId = `${settlement}_${street}`.replace(/\s+/g, '_').replace(/\./g, '_').replace(/\//g, '_');
    const dateStr = new Date().toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '. ');

    const payload = {
        id: docId,
        settlementName: settlement,
        streetName: street,
        pump1State: p1State,
        pump1Type: p1Type,
        pump1Serial: p1Serial,
        pump1RemoveDate: "",
        pump1Pos: 1,
        pump2State: p2State,
        pump2Type: p2Type,
        pump2Serial: p2Serial,
        pump2RemoveDate: "",
        pump2Pos: 2,
        dateString: dateStr,
        userEmail: "bviz@bviz.hu",
        userName: "Vezetői Weboldal",
        timestamp: Date.now()
    };

    const idx = pumpRecords.findIndex(r => r.id === docId);
    if (idx >= 0) {
        pumpRecords[idx] = payload;
    } else {
        pumpRecords.unshift(payload);
    }

    renderPumpTable();

    if (typeof firebase !== 'undefined') {
        try {
            const db = firebase.firestore();
            db.collection("pump_records").doc(docId).set(payload, { merge: true })
                .then(() => console.log("Új szivattyú adat elmentve Firestore-ba!"))
                .catch(e => console.error("Hiba az új szivattyú adat mentésénél:", e));
        } catch (e) {
            console.error("Firebase save error:", e);
        }
    }

    closeAddPumpModal();
}

function openHistoryModal(town, street) {
    const subtitleEl = document.getElementById('historyModalSubtitle');
    const tbody = document.getElementById('historyModalTableBody');
    if (subtitleEl) subtitleEl.textContent = `${town} • ${street}`;
    if (tbody) tbody.innerHTML = '';

    const normTown = normalizeStreetName(town);
    const normStreet = normalizeStreetName(street);

    const rawList = electricityReadings.filter(r =>
        normalizeStreetName(r.settlementName) === normTown &&
        normalizeStreetName(r.meterName) === normStreet &&
        r.dayKwh > 0
    ).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // Deduplicate history records by dayKwh + dateString so identical numbers on the same date never multiply
    const historyList = [];
    const seenKeys = new Set();

    rawList.forEach(item => {
        const key = `${Math.round(item.dayKwh)}_${item.dateString}`;
        if (!seenKeys.has(key)) {
            seenKeys.add(key);
            historyList.push(item);
        }
    });

    if (historyList.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="5" style="text-align: center; color: #64748b; padding: 16px;">Még nincs elmentett előzmény adat ehhez az utcához.</td>`;
        tbody.appendChild(tr);
    } else {
        historyList.forEach(item => {
            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            tr.title = 'Duplán kattintva szerkesztheted ezt a korábbi leolvasást!';
            tr.ondblclick = () => {
                openEditHistoryRecordModal(item.id, item.dateString, item.dayKwh, item.userName, item.note, town, street);
            };
            tr.innerHTML = `
                <td style="padding: 10px; font-weight: bold;">${item.dateString || '2026. 11. 11.'}</td>
                <td style="padding: 10px; font-weight: bold; color: #1565c0;">${item.dayKwh > 0 ? Math.round(item.dayKwh) + ' kWh' : '-'}</td>
                <td style="padding: 10px; font-weight: bold; color: #0077b6;">👤 ${item.userName || 'Rendszer'}</td>
                <td style="padding: 10px; color: #475569;">${item.note || '-'}</td>
                <td style="padding: 10px; text-align: center;">
                    <button class="btn-delete-hist" title="Törlés" style="background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; border-radius: 6px; padding: 4px 8px; font-size: 13px; cursor: pointer; font-weight: bold;">🗑 Törlés</button>
                </td>
            `;

            const delBtn = tr.querySelector('.btn-delete-hist');
            if (delBtn) {
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    deleteSingleHistoryRecord(item.id, town, street);
                };
            }

            tbody.appendChild(tr);
        });
    }

    const modal = document.getElementById('historyModal');
    if (modal) modal.style.display = 'flex';
}

function deleteSingleHistoryRecord(recordId, town, street) {
    if (confirm("Biztosan törölni szeretnéd ezt a konkrét leolvasási sort az előzményekből?")) {
        // Delete ONLY the specific clicked record ID from local memory!
        electricityReadings = electricityReadings.filter(r => r.id !== recordId);

        // Delete ONLY this specific document ID from Cloud Firestore
        if (typeof firebase !== 'undefined') {
            try {
                const db = firebase.firestore();
                db.collection("electricity_readings").doc(recordId).delete()
                    .then(() => console.log("Sikeresen törölve a konkrét előzmény elem:", recordId))
                    .catch(e => console.error("Hiba a törlésnél:", e));
            } catch (e) {
                console.error("Firebase error:", e);
            }
        }

        // Re-render open history modal and main table
        setTimeout(() => {
            openHistoryModal(town, street);
            renderTable();
        }, 150);
    }
}

function openEditHistoryRecordModal(recordId, dateStr, kwh, userName, note, town, street) {
    document.getElementById('editHistoryRecordId').value = recordId;
    document.getElementById('editHistoryTown').value = town;
    document.getElementById('editHistoryStreet').value = street;
    document.getElementById('editHistoryKwh').value = kwh ? Math.round(kwh) : '';
    document.getElementById('editHistoryDateString').value = dateStr || '2026. 11. 11.';
    document.getElementById('editHistoryUserName').value = userName || 'Vezetői Weboldal';
    const noteEl = document.getElementById('editHistoryNote');
    if (noteEl) noteEl.value = note || '';

    const modal = document.getElementById('editHistoryRecordModal');
    if (modal) modal.style.display = 'flex';
}

function closeEditHistoryRecordModal() {
    const modal = document.getElementById('editHistoryRecordModal');
    if (modal) modal.style.display = 'none';
}

function saveEditHistoryRecordFromWeb() {
    const recordId = document.getElementById('editHistoryRecordId').value;
    const town = document.getElementById('editHistoryTown').value;
    const street = document.getElementById('editHistoryStreet').value;
    const kwhVal = document.getElementById('editHistoryKwh').value.trim();
    const dateStr = document.getElementById('editHistoryDateString').value.trim();
    const userName = document.getElementById('editHistoryUserName').value.trim() || 'Vezetői Weboldal';
    const noteText = document.getElementById('editHistoryNote') ? document.getElementById('editHistoryNote').value.trim() : '';

    const newKwh = kwhVal !== '' ? Number(kwhVal) : 0;

    const idx = electricityReadings.findIndex(r => r.id === recordId);
    if (idx >= 0) {
        electricityReadings[idx].dayKwh = newKwh;
        electricityReadings[idx].dateString = dateStr;
        electricityReadings[idx].userName = userName;
        electricityReadings[idx].note = noteText;
        electricityReadings[idx].timestamp = Date.now();
    }

    if (typeof firebase !== 'undefined') {
        try {
            const db = firebase.firestore();
            db.collection("electricity_readings").doc(recordId).update({
                dayKwh: newKwh,
                dateString: dateStr,
                userName: userName,
                note: noteText,
                timestamp: Date.now()
            }).then(() => console.log("Korábbi előzmény mérés elmentve:", recordId));
        } catch (e) {}
    }

    closeEditHistoryRecordModal();
    openHistoryModal(town, street);
    renderTable();
}

function deleteSingleHistoryRecord(recordId, town, street) {
    if (confirm("Biztosan törölni szeretnéd ezt a korábbi mérést az előzményekből?")) {
        electricityReadings = electricityReadings.filter(r => r.id !== recordId);
        openHistoryModal(town, street);
        renderTable();

        if (typeof firebase !== 'undefined') {
            try {
                const db = firebase.firestore();
                db.collection("electricity_readings").doc(recordId).delete()
                    .then(() => console.log("Sikeresen törölve az előzményekből:", recordId))
                    .catch(e => console.error("Hiba az előzmény törlésénél:", e));
            } catch (e) {
                console.error("Firebase error:", e);
            }
        }
    }
}

function closeHistoryModal() {
    const modal = document.getElementById('historyModal');
    if (modal) modal.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', checkWebSession);

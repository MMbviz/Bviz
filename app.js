// Firebase Configuration for Bviz
const firebaseConfig = {
    apiKey: "AIzaSyB-EGb76xU3GK68ZTDE-Mw7nw1iA6uB4DA",
    authDomain: "bviz-1cf84.firebaseapp.com",
    projectId: "bviz-1cf84",
    storageBucket: "bviz-1cf84.firebasestorage.app",
    messagingSenderId: "1076211077079",
    appId: "1:1076211077079:web:bviz"
};

// Firebase inicializálása azonnal az oldal betöltésekor
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

let electricityReadings = [];
let cleaningRecords = [];
let pumpRecords = [];
let dashboardInitialized = false;

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

// Teljes névből ékezetmentes admin e-mail cím készítése (pl. "Őri Csaba" -> "ori.csaba@bviz.admin")
function formatAdminEmail(inputName) {
    const clean = inputName.trim().toLowerCase();
    if (clean.includes('@')) return clean;
    const normalized = clean
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, '.');
    return `${normalized}@bviz.admin`;
}

// Aktuális belépett vezető nevének lekérése
function getLoggedInAdminName() {
    if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
        const email = (firebase.auth().currentUser.email || '').toLowerCase();
        if (email.includes('mizsei')) return 'Mizsei Márk';
        if (email.includes('ori')) return 'Őri Csaba';
        if (email.includes('kovacs') || email.includes('peter')) return 'Kovács Péter';
        const prefix = email.split('@')[0];
        return prefix.split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    }
    return 'Vezetői Weboldal';
}

function getLoggedInAdminEmail() {
    if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
        return firebase.auth().currentUser.email || 'admin@bviz.admin';
    }
    return 'admin@bviz.admin';
}

function checkWebSession() {
    const loginScreen = document.getElementById('loginScreen');
    const dashboardContainer = document.getElementById('dashboardContainer');

    if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().onAuthStateChanged((user) => {
            if (user && user.email && user.email.endsWith('@bviz.admin')) {
                const userDisplayEl = document.getElementById('userDisplay');
                if (userDisplayEl) {
                    userDisplayEl.innerHTML = `Hitelesített Vezetői Hozzáférés: <strong style="color: #80deea; font-size: 15px;">${getLoggedInAdminName()}</strong>`;
                }
                if (loginScreen) loginScreen.style.display = 'none';
                if (dashboardContainer) dashboardContainer.style.display = 'block';
                initDashboard();
            } else {
                if (user) firebase.auth().signOut();
                if (loginScreen) loginScreen.style.display = 'flex';
                if (dashboardContainer) dashboardContainer.style.display = 'none';
            }
        });
    } else {
        if (loginScreen) loginScreen.style.display = 'flex';
        if (dashboardContainer) dashboardContainer.style.display = 'none';
    }
}

function handleWebLogin(event) {
    if (event) event.preventDefault();
    const userElem = document.getElementById('webUsername');
    const passElem = document.getElementById('webPassword');
    const rawUser = userElem ? userElem.value.trim() : '';
    const passInput = passElem ? passElem.value.trim() : '';
    const loginError = document.getElementById('loginError');

    if (!rawUser || !passInput) {
        if (loginError) {
            loginError.innerText = 'Kérjük add meg a nevedet és a jelszavadat!';
            loginError.style.display = 'block';
        }
        return;
    }

    const adminEmail = formatAdminEmail(rawUser);

    if (!adminEmail.endsWith('@bviz.admin')) {
        if (loginError) {
            loginError.innerText = 'Nincs vezetői jogosultságod a webes felülethez!';
            loginError.style.display = 'block';
        }
        return;
    }

    if (typeof firebase === 'undefined' || !firebase.auth) {
        if (loginError) {
            loginError.innerText = 'Hiba: A Firebase hitelesítés nincs betöltve az oldalon!';
            loginError.style.display = 'block';
        }
        return;
    }

    firebase.auth().signInWithEmailAndPassword(adminEmail, passInput)
        .then(() => {
            if (loginError) loginError.style.display = 'none';
        })
        .catch((error) => {
            console.error("Belépési hiba:", error.code);
            if (loginError) {
                loginError.innerText = 'Hibás felhasználónév vagy jelszó (vagy nincs vezetői jogosultság)!';
                loginError.style.display = 'block';
            }
        });
}

function handleWebLogout() {
    if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().signOut().then(() => {
            dashboardInitialized = false;
            window.location.reload();
        });
    }
}

function switchWebTab(tabName) {
    const tabElec = document.getElementById('webTabElectricity');
    const tabClean = document.getElementById('webTabCleaning');
    const tabPump = document.getElementById('webTabPump');
    const secElec = document.getElementById('electricitySection');
    const secClean = document.getElementById('cleaningSection');
    const secPump = document.getElementById('pumpSection');
    const primaryBtn = document.getElementById('webPrimaryActionButton');

    if (tabName === 'cleaning') {
        if (tabElec) tabElec.classList.remove('active');
        if (tabClean) tabClean.classList.add('active');
        if (tabPump) tabPump.classList.remove('active');
        if (secElec) secElec.style.display = 'none';
        if (secClean) secClean.style.display = 'block';
        if (secPump) secPump.style.display = 'none';
        if (primaryBtn) {
            primaryBtn.innerHTML = '➕ Új Takarítás';
            primaryBtn.onclick = openAddCleaningModal;
            primaryBtn.style.display = 'inline-block';
        }
        renderCleaningTable();
    } else if (tabName === 'pump') {
        if (tabElec) tabElec.classList.remove('active');
        if (tabClean) tabClean.classList.remove('active');
        if (tabPump) tabPump.classList.add('active');
        if (secElec) secElec.style.display = 'none';
        if (secClean) secClean.style.display = 'none';
        if (secPump) secPump.style.display = 'block';
        if (primaryBtn) {
            primaryBtn.innerHTML = '➕ Új Szivattyú Adat';
            primaryBtn.onclick = openAddPumpModal;
            primaryBtn.style.display = 'inline-block';
        }
        renderPumpTable();
    } else {
        if (tabElec) tabElec.classList.add('active');
        if (tabClean) tabClean.classList.remove('active');
        if (tabPump) tabPump.classList.remove('active');
        if (secElec) secElec.style.display = 'block';
        if (secClean) secClean.style.display = 'none';
        if (secPump) secPump.style.display = 'none';
        if (primaryBtn) {
            primaryBtn.innerHTML = '➕ Új Leolvasás';
            primaryBtn.onclick = openAddElectricityModal;
            primaryBtn.style.display = 'inline-block';
        }
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

    let currKwhValue = '';
    if (latestReading && latestReading.dayKwh > 0) {
        currKwhValue = Math.round(latestReading.dayKwh);
    }

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
    document.getElementById('editOriginalSettlement').value = town;
    document.getElementById('editOriginalMeterName').value = street;
    document.getElementById('editSettlement').value = (town || 'Apaj').replace(/_/g, ' ');
    document.getElementById('editMeterName').value = (street || 'Helyszín').replace(/_/g, ' ');
    document.getElementById('editPrevDayKwh').value = prevKwhValue;
    document.getElementById('editDayKwh').value = currKwhValue;
    document.getElementById('editDateString').value = (latestReading ? latestReading.dateString : '') || new Date().toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '. ');
    document.getElementById('editUserName').value = (latestReading ? latestReading.userName : '') || getLoggedInAdminName();
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
    const origSettlement = document.getElementById('editOriginalSettlement') ? document.getElementById('editOriginalSettlement').value.trim() : '';
    const origMeterName = document.getElementById('editOriginalMeterName') ? document.getElementById('editOriginalMeterName').value.trim() : '';
    const settlementName = document.getElementById('editSettlement').value.trim();
    const meterName = document.getElementById('editMeterName').value.trim();
    const dayKwhVal = document.getElementById('editDayKwh').value.trim();
    const prevDayKwhVal = document.getElementById('editPrevDayKwh').value.trim();
    const dateString = document.getElementById('editDateString').value.trim();
    const userName = document.getElementById('editUserName').value.trim() || getLoggedInAdminName();
    const noteText = document.getElementById('editReadingNote') ? document.getElementById('editReadingNote').value.trim() : '';

    const isRenamed = (origMeterName !== '' && normalizeStreetName(origMeterName) !== normalizeStreetName(meterName)) ||
                      (origSettlement !== '' && normalizeStreetName(origSettlement) !== normalizeStreetName(settlementName));

    if (isRenamed) {
        const normOrigTown = normalizeStreetName(origSettlement);
        const normOrigStreet = normalizeStreetName(origMeterName);

        const oldFixedDocId = `elec_${origSettlement}_${origMeterName}`.replace(/\s+/g, '_').replace(/\./g, '_').replace(/\//g, '_');
        if (typeof firebase !== 'undefined') {
            try {
                firebase.firestore().collection("electricity_readings").doc(oldFixedDocId).delete();
            } catch (e) {}
        }

        if (streetMapData[origSettlement]) {
            const idx = streetMapData[origSettlement].findIndex(s => normalizeStreetName(s) === normOrigStreet);
            if (idx >= 0) {
                streetMapData[origSettlement][idx] = meterName;
            }
        }

        electricityReadings.forEach(r => {
            if (normalizeStreetName(r.settlementName) === normOrigTown && normalizeStreetName(r.meterName) === normOrigStreet) {
                r.settlementName = settlementName;
                r.meterName = meterName;
                if (typeof firebase !== 'undefined') {
                    try {
                        firebase.firestore().collection("electricity_readings").doc(r.id).update({
                            settlementName: settlementName,
                            meterName: meterName
                        });
                    } catch (e) {}
                }
            }
        });

        cleaningRecords.forEach(r => {
            if (normalizeStreetName(r.settlementName) === normOrigTown && normalizeStreetName(r.streetName) === normOrigStreet) {
                r.settlementName = settlementName;
                r.streetName = meterName;
                if (typeof firebase !== 'undefined') {
                    try {
                        firebase.firestore().collection("cleaning_records").doc(r.id).update({
                            settlementName: settlementName,
                            streetName: meterName
                        });
                    } catch (e) {}
                }
            }
        });

        pumpRecords.forEach(r => {
            if (normalizeStreetName(r.settlementName) === normOrigTown && normalizeStreetName(r.streetName) === normOrigStreet) {
                r.settlementName = settlementName;
                r.streetName = meterName;
                if (typeof firebase !== 'undefined') {
                    try {
                        firebase.firestore().collection("pump_records").doc(r.id).update({
                            settlementName: settlementName,
                            streetName: meterName
                        });
                    } catch (e) {}
                }
            }
        });

        if (typeof firebase !== 'undefined') {
            try {
                const renameDocId = `rename_${origSettlement}_${origMeterName}`.replace(/\s+/g, '_').replace(/\./g, '_');
                if (normalizeStreetName(meterName) === normalizeStreetName(origMeterName)) {
                    firebase.firestore().collection("custom_streets").doc(renameDocId).delete();
                } else {
                    firebase.firestore().collection("custom_streets").doc(renameDocId).set({
                        settlementName: settlementName,
                        oldStreetName: origMeterName,
                        newStreetName: meterName,
                        timestamp: Date.now()
                    }, { merge: true });
                }
            } catch (e) {}
        }
    }

    const dayKwh = (dayKwhVal !== '' && !isNaN(Number(dayKwhVal)) && Number(dayKwhVal) > 0) ? Number(dayKwhVal) : 0;
    const prevDayKwh = (prevDayKwhVal !== '' && !isNaN(Number(prevDayKwhVal)) && Number(prevDayKwhVal) > 0) ? Number(prevDayKwhVal) : null;
    const fixedDocId = `elec_${settlementName}_${meterName}`.replace(/\s+/g, '_').replace(/\./g, '_').replace(/\//g, '_');

    let idx = electricityReadings.findIndex(r =>
        normalizeStreetName(r.settlementName) === normalizeStreetName(settlementName) &&
        normalizeStreetName(r.meterName) === normalizeStreetName(meterName)
    );

    const payload = {
        settlementName: settlementName,
        meterName: meterName,
        dayKwh: dayKwh,
        dateString: dateString,
        userName: userName,
        note: noteText,
        userEmail: getLoggedInAdminEmail(),
        timestamp: Date.now()
    };

    if (prevDayKwh !== null && !isNaN(prevDayKwh) && prevDayKwh > 0) {
        payload.prevDayKwh = prevDayKwh;
    } else if (typeof firebase !== 'undefined') {
        payload.prevDayKwh = firebase.firestore.FieldValue.delete();
        electricityReadings.forEach(r => {
            if (normalizeStreetName(r.settlementName) === normalizeStreetName(settlementName) &&
                normalizeStreetName(r.meterName) === normalizeStreetName(meterName)) {
                delete r.prevDayKwh;
            }
        });
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
            userEmail: getLoggedInAdminEmail(),
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
                .then(() => console.log("Sikeresen frissítve a Firestore-ban:", fixedDocId))
                .catch(e => console.error("Hiba a Firestore frissítésnél:", e));

            if (dayKwh > 0) {
                const timestampId = Date.now();
                const archiveId = `hist_${settlementName}_${meterName}_${timestampId}`.replace(/\s+/g, '_').replace(/\./g, '_').replace(/\//g, '_');
                const archivePayload = {
                    id: archiveId,
                    settlementName: settlementName,
                    meterName: meterName,
                    dayKwh: dayKwh,
                    prevDayKwh: prevDayKwh,
                    dateString: dateString,
                    userEmail: getLoggedInAdminEmail(),
                    userName: userName,
                    note: noteText,
                    timestamp: timestampId
                };
                electricityReadings.unshift(archivePayload);
                db.collection("electricity_readings").doc(archiveId).set(archivePayload, { merge: true });
            }
        } catch (e) {
            console.error("Firebase update error:", e);
        }
    }

    renderTable();
    renderCleaningTable();
    renderPumpTable();
    closeEditModal();
}

function deleteReadingFromWeb(docId) {
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

function resolveDisplayName(rawName, rawEmail) {
    if (rawName && !rawName.includes("@") && rawName.includes(" ")) {
        return rawName;
    } else if (rawEmail.includes("mizsei") || rawName.toLowerCase().includes("mizse")) {
        return "Mizsei Márk";
    } else if (rawEmail.includes("ori") || rawName.toLowerCase().includes("őri")) {
        return "Őri Csaba";
    } else if (rawEmail.includes("peter") || rawName.toLowerCase().includes("kovács")) {
        return "Kovács Péter";
    } else if (rawName && !rawName.includes("@")) {
        return rawName;
    }
    return "Mizsei Márk";
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
        : cleaningRecords.filter(r => normalizeStreetName(r.settlementName) === normalizeStreetName(plantFilter));

    if (searchQuery) {
        filtered = filtered.filter(r =>
            (r.settlementName || '').toLowerCase().includes(searchQuery) ||
            (r.streetName || '').toLowerCase().includes(searchQuery) ||
            (r.userName || '').toLowerCase().includes(searchQuery) ||
            (r.dateString || '').toLowerCase().includes(searchQuery) ||
            (r.note || '').toLowerCase().includes(searchQuery)
        );
    }

    const sortedDesc = [...filtered].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    const totalCount = sortedDesc.length;

    const summaryCountEl = document.getElementById('cleaningSummaryCount');
    if (summaryCountEl) {
        summaryCountEl.textContent = `Összesen: ${totalCount} bejegyzés`;
    }

    let displayList = sortedDesc;
    if (pageSizeVal !== 'ALL') {
        const size = parseInt(pageSizeVal, 10) || 50;
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
                normalizeStreetName(r.settlementName) === normalizeStreetName(town) &&
                normalizeStreetName(r.streetName) === normalizeStreetName(street)
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
        normalizeStreetName(r.settlementName) === normalizeStreetName(town) &&
        normalizeStreetName(r.streetName) === normalizeStreetName(street)
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

function clearWebInput(inputId) {
    const el = document.getElementById(inputId);
    if (el) {
        el.value = '';
        saveCurrentVisualPump(true);
    }
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
        userEmail: getLoggedInAdminEmail(),
        userName: getLoggedInAdminName(),
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
            <div style="background: #0077b6; padding: 16px 20px; color: white; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h3 style="font-size: 20px; font-weight: bold; margin: 0; color: #ffffff;">${currentVisualStreet}</h3>
                    <p style="font-size: 13px; color: #e0f7fa; margin-top: 2px;">${currentVisualTown} • Szivattyú nyilvántartás</p>
                </div>
                <button onclick="document.getElementById('pumpVisualContainer').style.display='none'" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 6px 14px; border-radius: 20px; font-weight: bold; cursor: pointer; font-size: 13px;">✕ Bezárás</button>
            </div>

            <div style="padding: 20px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 14px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); text-align: center;">
                        <h4 style="font-size: 15px; font-weight: 600; color: #1e293b; margin-bottom: 8px;">1. sz. Szivattyú</h4>
                        <div onclick="cycleWebCube(1)" title="Kattints a státusz váltásához!" style="background: ${p1ChipBg}; color: ${p1ChipColor}; padding: 6px 14px; border-radius: 20px; font-weight: bold; font-size: 12px; cursor: pointer; display: inline-block; margin-bottom: 14px; user-select: none;">
                            ${p1ChipText}
                        </div>
                        <div style="text-align: left; margin-bottom: 12px;">
                            <label style="display: block; font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 4px;">Fajtája</label>
                            <div style="position: relative;">
                                <input type="text" id="webP1Type" value="${p1Type}" list="pumpTypeOptions" oninput="saveCurrentVisualPump(false)" placeholder="" style="width: 100%; padding: 10px 32px 10px 12px; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 14px; outline: none; box-sizing: border-box;">
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

                    <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 14px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); text-align: center;">
                        <h4 style="font-size: 15px; font-weight: 600; color: #1e293b; margin-bottom: 8px;">2. sz. Szivattyú</h4>
                        <div onclick="cycleWebCube(2)" title="Kattints a státusz váltásához!" style="background: ${p2ChipBg}; color: ${p2ChipColor}; padding: 6px 14px; border-radius: 20px; font-weight: bold; font-size: 12px; cursor: pointer; display: inline-block; margin-bottom: 14px; user-select: none;">
                            ${p2ChipText}
                        </div>
                        <div style="text-align: left; margin-bottom: 12px;">
                            <label style="display: block; font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 4px;">Fajtája</label>
                            <div style="position: relative;">
                                <input type="text" id="webP2Type" value="${p2Type}" list="pumpTypeOptions" oninput="saveCurrentVisualPump(false)" placeholder="" style="width: 100%; padding: 10px 32px 10px 12px; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 14px; outline: none; box-sizing: border-box;">
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
    if (userEl) userEl.value = item.userName || getLoggedInAdminName();
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
    cleaningRecords = cleaningRecords.filter(r => r.id !== docId);
    renderCleaningTable();

    if (typeof firebase !== 'undefined') {
        try {
            const db = firebase.firestore();
            db.collection("cleaning_records").doc(docId).delete()
                .then(() => console.log("Sikeresen törölve a Firestore-ból:", docId))
                .catch(e => console.error("Hiba a Firestore törlésnél:", e));
        } catch (e) {
            console.error("Firebase hiba:", e);
        }
    }
}

function deletePumpRecordFromWeb(docId) {
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

function exportCleaningToExcel() {
    const plantFilter = document.getElementById('cleaningPlantFilter') ? document.getElementById('cleaningPlantFilter').value : 'ALL';
    const filtered = plantFilter === 'ALL' ? cleaningRecords : cleaningRecords.filter(r => normalizeStreetName(r.settlementName) === normalizeStreetName(plantFilter));

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
    const filtered = plantFilter === 'ALL' ? pumpRecords : pumpRecords.filter(r => normalizeStreetName(r.settlementName) === normalizeStreetName(plantFilter));

    if (filtered.length === 0) {
        alert("Nincs letölthető szivattyú adat!");
        return;
    }

    const sortedDesc = [...filtered].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    let csvContent = "\uFEFF";
    csvContent += "Rögzítés Dátuma;Város / Település;Utca / Helyszín;1. Szivattyú Állapot;1. Szivattyú Fajtája;1. Szivattyú Gyári Szám;2. Szivattyú Állapot;2. Szivattyú Fajtája;2. Szivattyú Gyári Szám;Rögzítő Neve\n";

    sortedDesc.forEach((item) => {
        const p1Status = item.pump1State === 1 ? 'Működő' : (item.pump1State === 2 ? 'Rossz' : 'Nincs szivattyú');
        const p2Status = item.pump2State === 1 ? 'Működő' : (item.pump2State === 2 ? 'Rossz' : 'Nincs szivattyú');

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

    const townsToInclude = plantFilter === 'ALL' ? Object.keys(streetMapData) : [plantFilter];
    let allStreetRows = [];

    townsToInclude.forEach(town => {
        const streets = streetMapData[town] || [];
        streets.forEach(street => {
            const existing = pumpRecords.find(r =>
                normalizeStreetName(r.settlementName) === normalizeStreetName(town) &&
                normalizeStreetName(r.streetName) === normalizeStreetName(street)
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
            <td><span style="background: #e0f2fe; padding: 4px 8px; border-radius: 4px; font-weight: bold; color: #0077b6;">🛠️ ${item.settlementName || 'Apaj'}</span></td>
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
    if (dashboardInitialized) return;
    dashboardInitialized = true;

    renderTable();
    renderCleaningTable();
    renderPumpTable();

    if (typeof firebase !== 'undefined') {
        try {
            const db = firebase.firestore();

            db.collection("electricity_readings").onSnapshot((snapshot) => {
                const list = [];
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    const rawEmail = (data.userEmail || "").trim().toLowerCase();
                    const rawName = (data.userName || "").trim();

                    list.push({
                        id: doc.id,
                        settlementName: data.settlementName || "Apaj",
                        meterName: data.meterName || "Helyszín",
                        dateString: data.dateString || "",
                        timestamp: Number(data.timestamp) || 0,
                        dayKwh: Number(data.dayKwh) || 0,
                        prevDayKwh: (data.prevDayKwh !== undefined && data.prevDayKwh !== null) ? Number(data.prevDayKwh) : null,
                        userEmail: rawEmail,
                        userName: resolveDisplayName(rawName, rawEmail),
                        note: data.note || ""
                    });
                });
                electricityReadings = list;
                renderTable();
            }, (error) => {
                console.warn("Firestore electricity_readings snapshot error:", error);
            });

            db.collection("custom_street_order").onSnapshot((snapshot) => {
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    if (data.settlementName && Array.isArray(data.streetsOrder)) {
                        streetMapData[data.settlementName] = data.streetsOrder;
                    }
                });
                renderTable();
            }, (error) => {
                console.warn("Firestore custom_street_order snapshot error:", error);
            });

            db.collection("custom_streets").onSnapshot((snapshot) => {
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    const town = data.settlementName;
                    const street = data.streetName;
                    if (town && street) {
                        if (!streetMapData[town]) {
                            streetMapData[town] = [];
                        }
                        if (!streetMapData[town].includes(street)) {
                            streetMapData[town].push(street);
                        }
                    }
                });
                updateAddElecStreetDropdown();
                updateAddCleanStreetDropdown();
                updateAddPumpStreetDropdown();
                updateDeleteCustomStreetDropdown();
                renderTable();
                renderCleaningTable();
                renderPumpTable();
            }, (error) => {
                console.warn("Firestore custom_streets snapshot error:", error);
            });

            db.collection("cleaning_records").onSnapshot((snapshot) => {
                const list = [];
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    const rawEmail = (data.userEmail || "").trim().toLowerCase();
                    const rawName = (data.userName || "").trim();

                    list.push({
                        id: doc.id,
                        settlementName: data.settlementName || "Apaj",
                        streetName: data.streetName || "Helyszín",
                        dateString: data.dateString || "",
                        timestamp: Number(data.timestamp) || 0,
                        userEmail: rawEmail,
                        userName: resolveDisplayName(rawName, rawEmail),
                        note: data.note || ""
                    });
                });
                cleaningRecords = list;
                renderCleaningTable();
            }, (error) => {
                console.warn("Firestore cleaning_records snapshot error:", error);
            });

            db.collection("pump_records").onSnapshot((snapshot) => {
                const list = [];
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    const rawEmail = (data.userEmail || "").trim().toLowerCase();
                    const rawName = (data.userName || "").trim();

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
                        userName: resolveDisplayName(rawName, rawEmail)
                    });
                });
                pumpRecords = list;
                renderPumpTable();
            }, (error) => {
                console.warn("Firestore pump_records snapshot error:", error);
            });

        } catch (e) {
            console.warn("Firebase initialization warning:", e);
        }
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
            const primaryDoc = sameMeterReadings.find(r => r.id === fixedDocId || r.id.startsWith("elec_"));
            const latestReading = primaryDoc || (sameMeterReadings.length > 0 ? sameMeterReadings[0] : null);
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

                // Baseline previous reading (Explicit prevDayKwh OR previous month's final reading on/after 5th)
                const baselinePrev = (latestReading.prevDayKwh && latestReading.prevDayKwh > 0)
                    ? latestReading.prevDayKwh
                    : ((previousReading && previousReading.dayKwh > 0) ? previousReading.dayKwh : null);

                if (baselinePrev !== null && baselinePrev > 0) {
                    prevKwhText = `${Math.round(baselinePrev)} kWh`;
                }

                if (latestReading.dayKwh > 0) {
                    currKwhText = `${Math.round(latestReading.dayKwh)} kWh`;

                    if (baselinePrev !== null && baselinePrev > 0) {
                        const diff = latestReading.dayKwh - baselinePrev;
                        if (diff >= 0) {
                            diffBadge = `<span style="background: #dcfce7; color: #15803d; font-weight: bold; padding: 3px 8px; border-radius: 6px; font-size: 12px; display: inline-block;">▲ +${Math.round(diff)} kWh</span>`;
                        } else {
                            diffBadge = `<span style="background: #fee2e2; color: #b91c1c; font-weight: bold; padding: 3px 8px; border-radius: 6px; font-size: 12px; display: inline-block;">▼ ${Math.round(diff)} kWh</span>`;
                        }
                    }
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
        row.style.cursor = 'grab';
        row.title = 'Nyomvatartással húzhatod fel-le a sorrend megváltoztatásához!';
        row.draggable = true;

        row.ondragstart = (e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify({ town: item.settlementName, street: item.meterName }));
            row.style.opacity = '0.5';
            row.style.background = '#e0f2fe';
        };

        row.ondragend = () => {
            row.style.opacity = '1.0';
            row.style.background = '';
        };

        row.ondragover = (e) => {
            e.preventDefault();
            row.style.borderTop = '3px solid #0077b6';
        };

        row.ondragleave = () => {
            row.style.borderTop = '';
        };

        row.ondrop = (e) => {
            e.preventDefault();
            row.style.borderTop = '';
            try {
                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                if (data.town === item.settlementName && data.street !== item.meterName) {
                    reorderStreetInTown(data.town, data.street, item.meterName);
                }
            } catch (err) {}
        };

        row.onclick = (e) => {
            if (e.target.closest('button') || e.target.closest('.btn-icon-history')) {
                return;
            }
            openEditModal(item.id);
        };
        const escapedTown = (item.settlementName || '').replace(/'/g, "\\'");
        const escapedStreet = (item.meterName || '').replace(/'/g, "\\'");
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
                <button onclick="event.stopPropagation(); openHistoryModal('${escapedTown}', '${escapedStreet}')" class="btn-icon-history" title="Előzmények megtekintése" style="background: #e0f2fe; color: #0284c7; border: 1.5px solid #0284c7; border-radius: 8px; padding: 6px 14px; font-size: 16px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; min-width: 42px; min-height: 42px; box-shadow: 0 2px 6px rgba(0,0,0,0.15); transition: all 0.2s ease;">📜</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function reorderStreetInTown(town, draggedStreet, targetStreet) {
    let list = streetMapData[town];
    if (!list) list = [];

    const draggedIdx = list.findIndex(s => normalizeStreetName(s) === normalizeStreetName(draggedStreet));
    const targetIdx = list.findIndex(s => normalizeStreetName(s) === normalizeStreetName(targetStreet));

    if (draggedIdx >= 0 && targetIdx >= 0) {
        const [movedItem] = list.splice(draggedIdx, 1);
        list.splice(targetIdx, 0, movedItem);
        streetMapData[town] = list;

        renderTable();

        if (typeof firebase !== 'undefined') {
            try {
                const db = firebase.firestore();
                const docId = `order_${town}`.replace(/\s+/g, '_');
                db.collection("custom_street_order").doc(docId).set({
                    settlementName: town,
                    streetsOrder: list,
                    timestamp: Date.now()
                }, { merge: true })
                .then(() => console.log("Új utca sorrend elmentve a Firestore-ban:", town))
                .catch(e => console.error("Hiba a sorrend mentésénél:", e));
            } catch (e) {
                console.error("Firebase save order error:", e);
            }
        }
    }
}

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
    if (modal) modal.style.display = 'flex';
}

function closeAddCustomStreetModal() {
    const modal = document.getElementById('addCustomStreetModal');
    if (modal) modal.style.display = 'none';
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
                db.collection("custom_streets").doc(docId).delete();
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

        alert(`A(z) "${street}" átemelő (${town}) véglegesen törölve lett!`);
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
        userEmail: getLoggedInAdminEmail(),
        userName: getLoggedInAdminName(),
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

function openAddElectricityModal() {
    updateAddElecStreetDropdown();
    const dateEl = document.getElementById('addElecDateString');
    if (dateEl) {
        dateEl.value = new Date().toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '. ');
    }
    const userEl = document.getElementById('addElecUserName');
    if (userEl) userEl.value = getLoggedInAdminName();

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
    const userName = document.getElementById('addElecUserName').value.trim() || getLoggedInAdminName();

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
        userEmail: getLoggedInAdminEmail(),
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
                userEmail: getLoggedInAdminEmail(),
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

function openAddCleaningModal() {
    updateAddCleanStreetDropdown();
    const dateEl = document.getElementById('addCleanDateString');
    if (dateEl) {
        dateEl.value = new Date().toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '. ');
    }
    const userEl = document.getElementById('addCleanUserName');
    if (userEl) userEl.value = getLoggedInAdminName();

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
    const userName = document.getElementById('addCleanUserName').value.trim() || getLoggedInAdminName();
    const note = document.getElementById('addCleanNote') ? document.getElementById('addCleanNote').value.trim() : '';

    const newDocId = `web_clean_${Date.now()}`;
    const newRecord = {
        id: newDocId,
        settlementName: settlement,
        streetName: street,
        dateString: dateString,
        userEmail: getLoggedInAdminEmail(),
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
                userEmail: getLoggedInAdminEmail(),
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
        userEmail: getLoggedInAdminEmail(),
        userName: getLoggedInAdminName(),
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
        ((r.dayKwh && r.dayKwh > 0) || (r.prevDayKwh && r.prevDayKwh > 0))
    ).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    const historyList = [];
    const seenKeys = new Set();

    rawList.forEach(item => {
        const displayKwhVal = item.dayKwh > 0 ? item.dayKwh : item.prevDayKwh;
        const key = `${Math.round(displayKwhVal)}_${item.dateString}`;
        if (!seenKeys.has(key)) {
            seenKeys.add(key);
            historyList.push({ ...item, displayKwh: displayKwhVal });
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
                openEditHistoryRecordModal(item.id, item.dateString, item.displayKwh, item.userName, item.note, town, street);
            };
            const escapedTown = (town || '').replace(/'/g, "\\'");
            const escapedStreet = (street || '').replace(/'/g, "\\'");
            tr.innerHTML = `
                <td style="padding: 10px; font-weight: bold;">${item.dateString || '2026. 11. 11.'}</td>
                <td style="padding: 10px; font-weight: bold; color: #1565c0;">${item.displayKwh > 0 ? Math.round(item.displayKwh) + ' kWh' : '-'}</td>
                <td style="padding: 10px; font-weight: bold; color: #0077b6;">👤 ${item.userName || 'Rendszer'}</td>
                <td style="padding: 10px; color: #475569;">${item.note || '-'}</td>
                <td style="padding: 10px; text-align: center;">
                    <button onclick="event.stopPropagation(); deleteSingleHistoryRecord('${item.id}', '${escapedTown}', '${escapedStreet}')" class="btn-delete-hist" title="Törlés" style="background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; border-radius: 6px; padding: 4px 8px; font-size: 13px; cursor: pointer; font-weight: bold;">🗑 Törlés</button>
                </td>
            `;

            tbody.appendChild(tr);
        });
    }

    const modal = document.getElementById('historyModal');
    if (modal) modal.style.display = 'flex';
}

function deleteSingleHistoryRecord(recordId, town, street) {
    const normTown = normalizeStreetName(town);
    const normStreet = normalizeStreetName(street);
    const targetItem = electricityReadings.find(r => r.id === recordId);

    let idsToDelete = [recordId];

    if (targetItem) {
        const targetKwh = Math.round(Number(targetItem.dayKwh || targetItem.prevDayKwh || 0));
        const targetDate = targetItem.dateString;

        // Find all matching duplicate documents for this street, kwh and date
        const matches = electricityReadings.filter(r =>
            r.id === recordId ||
            (normalizeStreetName(r.settlementName) === normTown &&
             normalizeStreetName(r.meterName) === normStreet &&
             (Math.round(r.dayKwh) === targetKwh || Math.round(r.prevDayKwh) === targetKwh) &&
             r.dateString === targetDate)
        );

        idsToDelete = [...new Set([recordId, ...matches.map(r => r.id)])];
    }

    // 1. Immediately remove ALL matching duplicate IDs from local memory (0ms delay!)
    electricityReadings = electricityReadings.filter(r => !idsToDelete.includes(r.id));

    // 2. Instantly update open history modal and main table
    openHistoryModal(town, street);
    renderTable();

    // 3. Delete ALL matching document IDs from Cloud Firestore in background
    if (typeof firebase !== 'undefined') {
        try {
            const db = firebase.firestore();
            idsToDelete.forEach(id => {
                db.collection("electricity_readings").doc(id).delete()
                    .then(() => console.log("Sikeresen 1-kattintással törölve a Firestore-ból:", id))
                    .catch(e => console.error("Hiba a törlésnél:", e));
            });
        } catch (e) {
            console.error("Firebase error:", e);
        }
    }
}

function generateRandomReadingsForAllStreets() {
    const dateStr = new Date().toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '. ');
    const timestampNow = Date.now();

    Object.keys(streetMapData).forEach(town => {
        const streets = streetMapData[town] || [];
        streets.forEach(street => {
            const random4Digit = Math.floor(1000 + Math.random() * 9000);
            const fixedDocId = `elec_${town}_${street}`.replace(/\s+/g, '_').replace(/\./g, '_').replace(/\//g, '_');
            const archiveId = `hist_${town}_${street}_${timestampNow}`.replace(/\s+/g, '_').replace(/\./g, '_').replace(/\//g, '_');

            const payload = {
                id: fixedDocId,
                settlementName: town,
                meterName: street,
                dayKwh: random4Digit,
                dateString: dateStr,
                userName: getLoggedInAdminName(),
                userEmail: getLoggedInAdminEmail(),
                timestamp: timestampNow
            };

            const archivePayload = {
                id: archiveId,
                settlementName: town,
                meterName: street,
                dayKwh: random4Digit,
                dateString: dateStr,
                userName: getLoggedInAdminName(),
                userEmail: getLoggedInAdminEmail(),
                timestamp: timestampNow
            };

            const idx = electricityReadings.findIndex(r => r.id === fixedDocId);
            if (idx >= 0) {
                electricityReadings[idx].dayKwh = random4Digit;
                electricityReadings[idx].dateString = dateStr;
                electricityReadings[idx].timestamp = timestampNow;
            } else {
                electricityReadings.unshift(payload);
            }
            electricityReadings.unshift(archivePayload);

            if (typeof firebase !== 'undefined') {
                try {
                    const db = firebase.firestore();
                    db.collection("electricity_readings").doc(fixedDocId).set(payload, { merge: true });
                    db.collection("electricity_readings").doc(archiveId).set(archivePayload, { merge: true });
                } catch (e) {}
            }
        });
    });

    renderTable();
    alert("🎲 Sikeresen feltöltve véletlenszerű 4-jegyű leolvasási adatokkal minden település összes utcája!");
}

function simulate5thRollover() {
    const dateStr = new Date().toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '. ');
    let rolledCount = 0;

    Object.keys(streetMapData).forEach(town => {
        const streets = streetMapData[town] || [];
        streets.forEach(street => {
            const normTown = normalizeStreetName(town);
            const normStreet = normalizeStreetName(street);

            const sameMeterReadings = electricityReadings.filter(r =>
                normalizeStreetName(r.settlementName) === normTown &&
                normalizeStreetName(r.meterName) === normStreet
            ).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

            const latestReading = sameMeterReadings.length > 0 ? sameMeterReadings[0] : null;

            if (latestReading && latestReading.dayKwh > 0) {
                rolledCount++;
                const currentReadingVal = latestReading.dayKwh;
                const currentPrevVal = latestReading.prevDayKwh || null;
                const timestampNow = Date.now();
                const fixedDocId = `elec_${town}_${street}`.replace(/\s+/g, '_').replace(/\./g, '_').replace(/\//g, '_');
                const archiveId = `hist_${town}_${street}_${timestampNow}`.replace(/\s+/g, '_').replace(/\./g, '_').replace(/\//g, '_');

                const archivePayload = {
                    id: archiveId,
                    settlementName: town,
                    meterName: street,
                    dayKwh: currentReadingVal,
                    prevDayKwh: currentPrevVal,
                    dateString: latestReading.dateString || dateStr,
                    userName: latestReading.userName || getLoggedInAdminName(),
                    userEmail: latestReading.userEmail || getLoggedInAdminEmail(),
                    note: latestReading.note || '',
                    timestamp: timestampNow
                };

                const primaryPayload = {
                    id: fixedDocId,
                    settlementName: town,
                    meterName: street,
                    dayKwh: 0,
                    prevDayKwh: currentReadingVal,
                    dateString: dateStr,
                    userName: getLoggedInAdminName(),
                    userEmail: getLoggedInAdminEmail(),
                    note: '',
                    timestamp: timestampNow
                };

                // Add archive record to local memory
                electricityReadings.unshift(archivePayload);

                // Update or add primary record in local memory
                const primaryIdx = electricityReadings.findIndex(r => r.id === fixedDocId);
                if (primaryIdx >= 0) {
                    electricityReadings[primaryIdx].prevDayKwh = currentReadingVal;
                    electricityReadings[primaryIdx].dayKwh = 0;
                    electricityReadings[primaryIdx].timestamp = timestampNow;
                } else {
                    electricityReadings.unshift(primaryPayload);
                }

                // Save to Cloud Firestore
                if (typeof firebase !== 'undefined') {
                    try {
                        const db = firebase.firestore();
                        db.collection("electricity_readings").doc(archiveId).set(archivePayload, { merge: true });
                        db.collection("electricity_readings").doc(fixedDocId).set(primaryPayload, { merge: true });
                    } catch (e) {}
                }
            }
        });
    });

    renderTable();
    alert(`🚀 Sikeresen lefutott a 5-i átgördülés ${rolledCount} átemelőnél! Az értékek átkerültek az 'Előző Óraállás' alá, bekerültek az Előzményekbe, és az új havi mezők kiürültek!`);
}

function openEditHistoryRecordModal(recordId, dateStr, kwh, userName, note, town, street) {
    document.getElementById('editHistoryRecordId').value = recordId;
    document.getElementById('editHistoryTown').value = town;
    document.getElementById('editHistoryStreet').value = street;
    document.getElementById('editHistoryKwh').value = kwh ? Math.round(kwh) : '';
    document.getElementById('editHistoryDateString').value = dateStr || '2026. 11. 11.';
    document.getElementById('editHistoryUserName').value = userName || getLoggedInAdminName();
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
    const userName = document.getElementById('editHistoryUserName').value.trim() || getLoggedInAdminName();
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

function closeHistoryModal() {
    const modal = document.getElementById('historyModal');
    if (modal) modal.style.display = 'none';
}

function toggleWebTheme() {
    const isDark = document.body.classList.toggle('dark-theme');
    localStorage.setItem('bviz_web_theme', isDark ? 'dark' : 'light');
    updateThemeButtonUI(isDark);
}

function initWebTheme() {
    const savedTheme = localStorage.getItem('bviz_web_theme');
    const isDark = savedTheme === 'dark';
    if (isDark) {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
    updateThemeButtonUI(isDark);
}

function updateThemeButtonUI(isDark) {
    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
        if (isDark) {
            btn.innerHTML = '☀️ Világos Mód';
            btn.style.background = '#fbbf24';
            btn.style.color = '#0f172a';
            btn.style.borderColor = '#f59e0b';
        } else {
            btn.innerHTML = '🌙 Sötét Mód';
            btn.style.background = 'rgba(255,255,255,0.15)';
            btn.style.color = '#80deea';
            btn.style.borderColor = 'rgba(128,222,234,0.4)';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    checkWebSession();
    initWebTheme();
});

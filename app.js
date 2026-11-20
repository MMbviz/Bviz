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
            if (user && user.email) {
                const userDisplayEl = document.getElementById('userDisplay');
                if (userDisplayEl) {
                    userDisplayEl.innerHTML = `Hitelesített Vezetői Hozzáférés: <strong style="color: #80deea; font-size: 15px;">${getLoggedInAdminName()}</strong>`;
                }
                if (loginScreen) loginScreen.style.display = 'none';
                if (dashboardContainer) dashboardContainer.style.display = 'block';
                initDashboard();
            } else {
                if (loginScreen) loginScreen.style.display = 'flex';
                if (dashboardContainer) dashboardContainer.style.display = 'none';
            }
        });
    } else {
        if (loginScreen) loginScreen.style.display = 'flex';
        if (dashboardContainer) dashboardContainer.style.display = 'none';
    }
}

function normalizeNameToEmailPrefixWeb(name) {
    if (name.includes('@')) return name.toLowerCase().trim();
    const unaccented = name.toLowerCase()
        .replace(/á/g, "a").replace(/é/g, "e").replace(/í/g, "i")
        .replace(/ó/g, "o").replace(/ö/g, "o").replace(/ő/g, "o")
        .replace(/ú/g, "u").replace(/ü/g, "u").replace(/ű/g, "u");
    return unaccented.replace(/[^a-z0-9]/g, "");
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

    if (typeof firebase === 'undefined' || !firebase.auth) {
        if (loginError) {
            loginError.innerText = 'Hiba: A Firebase hitelesítés nincs betöltve az oldalon!';
            loginError.style.display = 'block';
        }
        return;
    }

    const auth = firebase.auth();
    const prefix = normalizeNameToEmailPrefixWeb(rawUser);

    const emailCandidate1 = rawUser.includes('@') ? rawUser : `${prefix}@bviz.admin`;
    const emailCandidate2 = rawUser.includes('@') ? rawUser : `${rawUser.toLowerCase().replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '.')}@bviz.admin`;
    const emailCandidate3 = rawUser.includes('@') ? rawUser : `${prefix}@bviz.local`;

    auth.signInWithEmailAndPassword(emailCandidate1, passInput)
        .then(() => { if (loginError) loginError.style.display = 'none'; })
        .catch(() => {
            auth.signInWithEmailAndPassword(emailCandidate2, passInput)
                .then(() => { if (loginError) loginError.style.display = 'none'; })
                .catch(() => {
                    auth.signInWithEmailAndPassword(emailCandidate3, passInput)
                        .then(() => { if (loginError) loginError.style.display = 'none'; })
                        .catch((error) => {
                            console.error("Belépési hiba:", error.code, error.message);
                            if (loginError) {
                                loginError.innerText = 'Hibás felhasználónév vagy jelszó!';
                                loginError.style.display = 'block';
                            }
                        });
                });
        });
}

const WEB_VERSION = "1.5";
let cachedWebVersion = WEB_VERSION;

function compareVersions(v1, v2) {
    const p1 = (v1 || '').toString().split('.').map(n => parseInt(n, 10) || 0);
    const p2 = (v2 || '').toString().split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
        const n1 = p1[i] || 0;
        const n2 = p2[i] || 0;
        if (n1 > n2) return 1;
        if (n1 < n2) return -1;
    }
    return 0;
}

function fetchGitHubCommitVersion() {
    try {
        fetch('https://api.github.com/repos/mmbviz/Bviz/commits?per_page=1')
            .then(response => {
                const linkHeader = response.headers.get('Link');
                if (linkHeader) {
                    const match = linkHeader.match(/page=(\d+)>; rel="last"/);
                    if (match && match[1]) {
                        const totalCommits = parseInt(match[1], 10) || 0;
                        const minorVersion = Math.max(0, totalCommits - 41);
                        const ghVersion = `1.${minorVersion}`;
                        if (compareVersions(ghVersion, cachedWebVersion) >= 0) {
                            cachedWebVersion = ghVersion;
                            updateWebAboutVersionUI();
                        }
                    }
                }
                return response.json();
            })
            .then(data => {
                if (Array.isArray(data) && data.length > 0 && data[0].commit && data[0].commit.author) {
                    console.log("Legutóbbi GitHub commit dátuma:", data[0].commit.author.date);
                }
            })
            .catch(err => console.warn("GitHub commit fetch info:", err));
    } catch (e) {
        console.warn("GitHub version fetch exception:", e);
    }
}

function fetchWebVersionFromFirestore() {
    fetchGitHubCommitVersion();
    if (typeof firebase !== 'undefined' && firebase.firestore) {
        try {
            const db = firebase.firestore();
            db.collection("app_config").doc("system").onSnapshot(doc => {
                if (doc.exists) {
                    const data = doc.data();
                    const fsVer = (data.appVersion || data.version || '').toString().trim();
                    if (fsVer && compareVersions(fsVer, cachedWebVersion) > 0) {
                        cachedWebVersion = fsVer;
                        updateWebAboutVersionUI();
                    }
                }
            }, err => console.warn("Firestore system version listener warning:", err));

            db.collection("app_downloads").get().then(snapshot => {
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const fsVer = (data.version || data.appVersion || '').toString().trim();
                    if (fsVer && compareVersions(fsVer, cachedWebVersion) > 0) {
                        cachedWebVersion = fsVer;
                        updateWebAboutVersionUI();
                    }
                });
            }).catch(err => console.warn("App downloads version fetch error:", err));
        } catch (e) {
            console.warn("Firestore version fetch error:", e);
        }
    }
}

function updateWebAboutVersionUI() {
    const verEl = document.getElementById('aboutVersionDisplay');
    if (verEl) {
        verEl.textContent = cachedWebVersion;
    }
}

function openAboutModal() {
    fetchWebVersionFromFirestore();
    updateWebAboutVersionUI();
    const modal = document.getElementById('aboutModal');
    if (modal) modal.style.display = 'flex';
}

function closeAboutModal() {
    const modal = document.getElementById('aboutModal');
    if (modal) modal.style.display = 'none';
}

function closeAboutModalOnBackdrop(e) {
    if (e.target && e.target.id === 'aboutModal') {
        closeAboutModal();
    }
}

function togglePasswordVisibility(inputId, btnId) {
    const targetId = inputId || 'webPassword';
    const buttonId = btnId || 'togglePasswordBtn';
    const passInput = document.getElementById(targetId);
    const toggleBtn = document.getElementById(buttonId);

    if (passInput && toggleBtn) {
        if (passInput.type === 'password') {
            passInput.type = 'text';
            toggleBtn.textContent = 'Elrejt';
        } else {
            passInput.type = 'password';
            toggleBtn.textContent = 'Mutat';
        }
    }
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
    const tabWarehouse = document.getElementById('webTabPumpWarehouse');
    const secElec = document.getElementById('electricitySection');
    const secClean = document.getElementById('cleaningSection');
    const secPump = document.getElementById('pumpSection');
    const secWarehouse = document.getElementById('pumpWarehouseSection');
    const primaryBtn = document.getElementById('webPrimaryActionButton');
    const rolloverBtn = document.getElementById('webRolloverBtn');
    const haviOsszesito = document.getElementById('havi-osszesito');

    if (tabName === 'cleaning') {
        if (tabElec) tabElec.classList.remove('active');
        if (tabClean) tabClean.classList.add('active');
        if (tabPump) tabPump.classList.remove('active');
        if (tabWarehouse) tabWarehouse.classList.remove('active');
        if (secElec) secElec.style.display = 'none';
        if (secClean) secClean.style.display = 'block';
        if (secPump) secPump.style.display = 'none';
        if (secWarehouse) secWarehouse.style.display = 'none';
        if (rolloverBtn) rolloverBtn.style.display = 'none';
        if (haviOsszesito) haviOsszesito.style.display = 'none';
        if (primaryBtn) {
            primaryBtn.innerHTML = '➕ Új Takarítás';
            primaryBtn.title = 'Új átemelő-takarítási esemény rögzítése a vezetői felületről.';
            primaryBtn.onclick = openAddCleaningModal;
            primaryBtn.style.display = 'inline-block';
        }
        renderCleaningTable();
    } else if (tabName === 'pump') {
        if (tabElec) tabElec.classList.remove('active');
        if (tabClean) tabClean.classList.remove('active');
        if (tabPump) tabPump.classList.add('active');
        if (tabWarehouse) tabWarehouse.classList.remove('active');
        if (secElec) secElec.style.display = 'none';
        if (secClean) secClean.style.display = 'none';
        if (secPump) secPump.style.display = 'block';
        if (secWarehouse) secWarehouse.style.display = 'none';
        if (rolloverBtn) rolloverBtn.style.display = 'none';
        if (haviOsszesito) haviOsszesito.style.display = 'none';
        if (primaryBtn) {
            primaryBtn.innerHTML = '➕ Új Szivattyú Adat';
            primaryBtn.title = 'Új szivattyú üzemóra vagy állapotadat rögzítése a vezetői felületről.';
            primaryBtn.onclick = openAddPumpModal;
            primaryBtn.style.display = 'inline-block';
        }
        renderPumpTable();
    } else if (tabName === 'pump_warehouse') {
        if (tabElec) tabElec.classList.remove('active');
        if (tabClean) tabClean.classList.remove('active');
        if (tabPump) tabPump.classList.remove('active');
        if (tabWarehouse) tabWarehouse.classList.add('active');
        if (secElec) secElec.style.display = 'none';
        if (secClean) secClean.style.display = 'none';
        if (secPump) secPump.style.display = 'none';
        if (secWarehouse) secWarehouse.style.display = 'block';
        if (rolloverBtn) rolloverBtn.style.display = 'none';
        if (haviOsszesito) haviOsszesito.style.display = 'none';
        if (primaryBtn) {
            primaryBtn.style.display = 'none';
        }
        renderPumpWarehouseTable();
    } else {
        if (tabElec) tabElec.classList.add('active');
        if (tabClean) tabClean.classList.remove('active');
        if (tabPump) tabPump.classList.remove('active');
        if (tabWarehouse) tabWarehouse.classList.remove('active');
        if (secElec) secElec.style.display = 'block';
        if (secClean) secClean.style.display = 'none';
        if (secPump) secPump.style.display = 'none';
        if (secWarehouse) secWarehouse.style.display = 'none';
        if (rolloverBtn) rolloverBtn.style.display = 'inline-flex';
        if (haviOsszesito) haviOsszesito.style.display = 'inline-flex';
        if (primaryBtn) {
            primaryBtn.innerHTML = '➕ Új Leolvasás';
            primaryBtn.title = 'Új villanyóra-állás rögzítése manuálisan a vezetői felületről — az adat azonnal frissül a rendszerben és a telefonos alkalmazásban is.';
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
    const primaryReading = sameMeterReadings.find(r => r.id === fixedDocId || !r.id.startsWith("hist_")) || sameMeterReadings[0] || null;

    let currKwhValue = '';
    if (primaryReading && primaryReading.dayKwh > 0) {
        currKwhValue = Math.round(primaryReading.dayKwh);
    }

    let prevKwhValue = '';
    if (primaryReading && primaryReading.prevDayKwh && primaryReading.prevDayKwh > 0) {
        prevKwhValue = Math.round(primaryReading.prevDayKwh);
    }

    document.getElementById('editReadingId').value = primaryReading ? primaryReading.id : fixedDocId;
    document.getElementById('editOriginalSettlement').value = town;
    document.getElementById('editOriginalMeterName').value = street;
    document.getElementById('editSettlement').value = (town || 'Apaj').replace(/_/g, ' ');
    document.getElementById('editMeterName').value = (street || 'Helyszín').replace(/_/g, ' ');
    document.getElementById('editPrevDayKwh').value = prevKwhValue;
    document.getElementById('editDayKwh').value = currKwhValue;
    document.getElementById('editDateString').value = (primaryReading ? primaryReading.dateString : '') || new Date().toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '. ');
    document.getElementById('editUserName').value = (primaryReading ? primaryReading.userName : '') || getLoggedInAdminName();
    const noteElem = document.getElementById('editReadingNote');
    if (noteElem) noteElem.value = (primaryReading ? primaryReading.note : '') || '';

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
    const searchQuery = document.getElementById('electricitySearch') ? document.getElementById('electricitySearch').value.trim().toLowerCase() : '';

    const townsToInclude = (plantFilter === 'ALL' ? Object.keys(streetMapData) : [plantFilter])
        .sort((a, b) => a.localeCompare(b, 'hu'));

    let exportRows = [];

    townsToInclude.forEach(town => {
        const streets = (streetMapData[town] || []).slice().sort((a, b) => a.localeCompare(b, 'hu'));
        streets.forEach(street => {
            const normTown = normalizeStreetName(town);
            const normStreet = normalizeStreetName(street);

            const fixedDocId = `elec_${town}_${street}`.replace(/\s+/g, '_').replace(/\./g, '_').replace(/\//g, '_');
            const sameMeterReadings = electricityReadings.filter(r =>
                normalizeStreetName(r.settlementName) === normTown &&
                normalizeStreetName(r.meterName) === normStreet
            ).sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));

            const primaryReading = sameMeterReadings.find(r => r.id === fixedDocId || !r.id.startsWith("hist_")) || sameMeterReadings[0] || null;

            let prevKwhNum = null;
            let currKwhNum = null;

            if (primaryReading) {
                const baselinePrev = (primaryReading.prevDayKwh && primaryReading.prevDayKwh > 0)
                    ? primaryReading.prevDayKwh
                    : null;

                if (baselinePrev !== null && baselinePrev > 0) {
                    prevKwhNum = Math.round(baselinePrev);
                }

                if (primaryReading.dayKwh > 0) {
                    currKwhNum = Math.round(primaryReading.dayKwh);
                }
            }

            exportRows.push({
                town: town,
                street: street,
                prevKwhNum: prevKwhNum,
                currKwhNum: currKwhNum
            });
        });
    });

    if (searchQuery) {
        exportRows = exportRows.filter(r =>
            (r.town || '').toLowerCase().includes(searchQuery) ||
            (r.street || '').toLowerCase().includes(searchQuery) ||
            (r.prevKwhNum !== null && r.prevKwhNum.toString().includes(searchQuery)) ||
            (r.currKwhNum !== null && r.currKwhNum.toString().includes(searchQuery))
        );
    }

    if (exportRows.length === 0) {
        alert("Nincs letölthető villanyóra leolvasási adat!");
        return;
    }

    if (typeof XLSX === 'undefined') {
        alert("Hiba: Az Excel (SheetJS) könyvtár nincs betöltve az oldalon!");
        return;
    }

    const dataForSheet = [
        ["Település", "Utca", "Előző Óraállás", "Óraállás"]
    ];

    exportRows.forEach(item => {
        dataForSheet.push([
            item.town,
            item.street,
            item.prevKwhNum !== null ? item.prevKwhNum : "",
            item.currKwhNum !== null ? item.currKwhNum : ""
        ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(dataForSheet);

    ws['!cols'] = [
        { wch: 22 },
        { wch: 32 },
        { wch: 18 },
        { wch: 15 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Villanyóra Állások");

    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `Villanyora_allasok_${dateStr}.xlsx`;

    XLSX.writeFile(wb, fileName);
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

let cleaningViewMode = 'overview'; // 'overview' (Állapot áttekintő) or 'history' (Teljes előzménynapló)
let currentHistoryLocationKey = null;

let currentElectricityPage = 1;
let currentCleaningPage = 1;
let currentPumpPage = 1;

const TRUCK_SVG_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: -2px; margin-right: 4px;"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>`;

function getPageNumbers(currentPage, totalPages) {
    if (totalPages <= 7) {
        const pages = [];
        for (let i = 1; i <= totalPages; i++) pages.push(i);
        return pages;
    }
    const pages = [1];
    if (currentPage > 3) {
        pages.push('...');
    }
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
    }
    if (currentPage < totalPages - 2) {
        pages.push('...');
    }
    if (!pages.includes(totalPages)) {
        pages.push(totalPages);
    }
    return pages;
}

function buildPaginationControls(containerId, summaryElId, currentPage, totalItems, pageSize, onPageChange, itemLabelPlural = 'bejegyzés') {
    const container = document.getElementById(containerId);
    const summaryEl = document.getElementById(summaryElId);

    const size = parseInt(pageSize, 10) || 25;
    const totalPages = Math.ceil(totalItems / size) || 1;

    let validPage = currentPage;
    if (validPage > totalPages) validPage = totalPages;
    if (validPage < 1) validPage = 1;

    const startIndex = totalItems === 0 ? 0 : (validPage - 1) * size + 1;
    const endIndex = Math.min(validPage * size, totalItems);

    if (summaryEl) {
        if (totalItems === 0) {
            summaryEl.textContent = `Összesen: 0 ${itemLabelPlural}`;
        } else {
            summaryEl.textContent = `Megjelenítve: ${startIndex}–${endIndex} / ${totalItems} ${itemLabelPlural}`;
        }
    }

    if (!container) return { startIndex: totalItems === 0 ? 0 : (validPage - 1) * size, endIndex, validPage };

    container.innerHTML = '';

    if (totalPages <= 1) {
        return { startIndex: totalItems === 0 ? 0 : (validPage - 1) * size, endIndex, validPage };
    }

    // Previous Button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn';
    prevBtn.innerHTML = '‹ Előző';
    prevBtn.disabled = validPage === 1;
    prevBtn.onclick = () => onPageChange(validPage - 1);
    container.appendChild(prevBtn);

    // Page Number Buttons
    const pageNumbers = getPageNumbers(validPage, totalPages);
    pageNumbers.forEach(p => {
        if (p === '...') {
            const span = document.createElement('span');
            span.className = 'page-ellipsis';
            span.textContent = '...';
            container.appendChild(span);
        } else {
            const pageBtn = document.createElement('button');
            pageBtn.className = 'page-btn' + (p === validPage ? ' active' : '');
            pageBtn.textContent = p;
            pageBtn.onclick = () => onPageChange(p);
            container.appendChild(pageBtn);
        }
    });

    // Next Button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn';
    nextBtn.innerHTML = 'Következő ›';
    nextBtn.disabled = validPage === totalPages;
    nextBtn.onclick = () => onPageChange(validPage + 1);
    container.appendChild(nextBtn);

    return { startIndex: (validPage - 1) * size, endIndex, validPage };
}

function setCleaningViewMode(mode) {
    currentCleaningPage = 1;
    cleaningViewMode = mode;
    const btnOverview = document.getElementById('cleaningViewOverview');
    const btnHistory = document.getElementById('cleaningViewHistory');
    if (btnOverview && btnHistory) {
        if (mode === 'overview') {
            btnOverview.style.background = '#0077b6';
            btnOverview.style.color = '#ffffff';
            btnHistory.style.background = 'transparent';
            btnHistory.style.color = '#64748b';
        } else {
            btnHistory.style.background = '#0077b6';
            btnHistory.style.color = '#ffffff';
            btnOverview.style.background = 'transparent';
            btnOverview.style.color = '#64748b';
        }
    }
    renderCleaningTable();
}

function calculateCleaningDaysAgo(timestamp, dateString) {
    const nowMs = Date.now();
    if (timestamp && timestamp > 0) {
        const diff = nowMs - timestamp;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        return days < 0 ? 0 : days;
    }
    if (dateString) {
        const clean = dateString.replace(/[^\d]/g, ' ');
        const parts = clean.trim().split(/\s+/);
        if (parts.length >= 3) {
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            const d = parseInt(parts[2], 10);
            const parsed = new Date(y, m, d).getTime();
            if (!isNaN(parsed)) {
                const diff = nowMs - parsed;
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                return days < 0 ? 0 : days;
            }
        }
    }
    return 0;
}

function getCleaningStatusBadgeHTML(daysAgo) {
    if (daysAgo === 9999) {
        return `<span class="badge-status badge-overdue">⚠️ Esedékes - Még nincs adat</span>`;
    } else if (daysAgo <= 30) {
        const text = daysAgo === 0 ? 'Rendben - Ma' : `Rendben - ${daysAgo} napja`;
        return `<span class="badge-status badge-ok">✓ ${text}</span>`;
    } else if (daysAgo <= 60) {
        return `<span class="badge-status badge-warning">⚡ Közeleg - ${daysAgo} napja</span>`;
    } else {
        return `<span class="badge-status badge-overdue">⚠️ Esedékes - ${daysAgo} napja</span>`;
    }
}

function openLocationCleaningHistoryModal(groupKey, town, street) {
    currentHistoryLocationKey = groupKey;
    const modal = document.getElementById('locationCleaningHistoryModal');
    const titleEl = document.getElementById('locationCleaningHistoryTitle');
    const subtitleEl = document.getElementById('locationCleaningHistorySubtitle');
    const tbody = document.getElementById('locationCleaningHistoryTableBody');

    if (!modal || !tbody) return;
    tbody.innerHTML = '';

    const parts = groupKey.split('_');
    const displayTown = town || (parts[0] || 'Apaj');
    const displayStreet = street || (parts.slice(1).join(' ') || 'Helyszín');

    const records = cleaningRecords.filter(r => `${normalizeStreetName(r.settlementName)}_${normalizeStreetName(r.streetName)}` === groupKey);
    records.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    if (titleEl) titleEl.innerHTML = `${TRUCK_SVG_ICON} ${displayTown} • ${displayStreet}`;
    if (subtitleEl) subtitleEl.textContent = `Összesen ${records.length} korábbi takarítás rögzítve`;

    if (records.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="4" style="text-align: center; color: #64748b; padding: 20px;">Még nincs rögzített tisztítási előzmény ehhez a helyszínhez.</td>`;
        tbody.appendChild(row);
    } else {
        records.forEach(rec => {
            const row = document.createElement('tr');
            row.style.cursor = 'pointer';
            row.title = 'Duplán kattintva szerkesztheted ezt a korábbi takarítási adatot!';
            row.ondblclick = () => {
                openCleaningEditModal(rec.id);
                closeLocationCleaningHistoryModal();
            };
            row.innerHTML = `
                <td><strong>${rec.dateString}</strong></td>
                <td><strong style="color: #0077b6; white-space: nowrap;">${rec.userName || 'Mizsei Márk'}</strong></td>
                <td>${rec.note || '-'}</td>
                <td style="text-align: center; white-space: nowrap;">
                    <button onclick="event.stopPropagation(); deleteCleaningRecordFromWeb('${rec.id}'); closeLocationCleaningHistoryModal();" class="btn-icon-delete" title="Törlés">🗑</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    modal.style.display = 'flex';
}

function closeLocationCleaningHistoryModal() {
    const modal = document.getElementById('locationCleaningHistoryModal');
    if (modal) modal.style.display = 'none';
}

function renderCleaningTable() {
    const tbody = document.getElementById('cleaningTableBody');
    const plantFilter = document.getElementById('cleaningPlantFilter') ? document.getElementById('cleaningPlantFilter').value : 'ALL';
    const statusFilter = document.getElementById('cleaningStatusFilter') ? document.getElementById('cleaningStatusFilter').value : 'ALL';
    const searchQuery = document.getElementById('cleaningSearch') ? document.getElementById('cleaningSearch').value.trim().toLowerCase() : '';
    const pageSizeVal = document.getElementById('cleaningPageSize') ? document.getElementById('cleaningPageSize').value : '25';

    if (!tbody) return;
    tbody.innerHTML = '';

    const allGroupedLocations = [];
    const towns = Object.keys(streetMapData);

    towns.forEach(town => {
        const streets = streetMapData[town] || [];
        const normTown = normalizeStreetName(town);

        streets.forEach(street => {
            const normStreet = normalizeStreetName(street);
            const key = `${normTown}_${normStreet}`;

            // Find all matching cleaning records for this town and street
            const matchingRecords = cleaningRecords.filter(r =>
                normalizeStreetName(r.settlementName) === normTown &&
                normalizeStreetName(r.streetName) === normStreet
            ).sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));

            if (matchingRecords.length > 0) {
                const latest = matchingRecords[0];
                const daysAgo = calculateCleaningDaysAgo(latest.timestamp, latest.dateString);
                let status = 'OK';
                if (daysAgo > 60) status = 'OVERDUE';
                else if (daysAgo >= 31) status = 'WARNING';

                allGroupedLocations.push({
                    key: key,
                    settlementName: town,
                    streetName: street,
                    latestRecord: latest,
                    daysAgo: daysAgo,
                    status: status,
                    historyRecords: matchingRecords
                });
            } else {
                // Street has no cleaning record yet
                allGroupedLocations.push({
                    key: key,
                    settlementName: town,
                    streetName: street,
                    latestRecord: {
                        id: '',
                        settlementName: town,
                        streetName: street,
                        dateString: 'Még nincs adat',
                        userName: '-',
                        note: 'Még nincs tisztítási előzmény rögzítve'
                    },
                    daysAgo: 9999,
                    status: 'OVERDUE',
                    historyRecords: []
                });
            }
        });
    });

    // Update summary stat cards
    const statTotalEl = document.getElementById('statTotalLocations');
    const statOkEl = document.getElementById('statOkLocations');
    const statOverdueEl = document.getElementById('statOverdueLocations');

    if (statTotalEl) statTotalEl.textContent = allGroupedLocations.length;
    if (statOkEl) statOkEl.textContent = allGroupedLocations.filter(loc => loc.status === 'OK').length;
    if (statOverdueEl) statOverdueEl.textContent = allGroupedLocations.filter(loc => loc.status === 'OVERDUE').length;

    // Update table header row based on view mode
    const headerRow = document.getElementById('cleaningTableHeaderRow');
    if (headerRow) {
        if (cleaningViewMode === 'overview') {
            headerRow.innerHTML = `
                <th style="width: 14%;">Utolsó Takarítás</th>
                <th style="width: 15%;">Állapot</th>
                <th style="width: 14%;">Település</th>
                <th style="width: 18%;">Utca / Helyszín</th>
                <th style="width: 21%;">Megjegyzés</th>
                <th style="width: 14%;">Rögzítő Neve</th>
                <th style="width: 9%; text-align: center;">Műveletek</th>
            `;
        } else {
            headerRow.innerHTML = `
                <th style="width: 14%;">Takarítás Dátuma</th>
                <th style="width: 15%;">Állapot</th>
                <th style="width: 14%;">Település</th>
                <th style="width: 18%;">Utca / Helyszín</th>
                <th style="width: 21%;">Megjegyzés</th>
                <th style="width: 14%;">Rögzítő Neve</th>
                <th style="width: 9%; text-align: center;">Műveletek</th>
            `;
        }
    }

    if (cleaningViewMode === 'overview') {
        // --- OVERVIEW MODE ---
        let filtered = allGroupedLocations;

        if (plantFilter !== 'ALL') {
            filtered = filtered.filter(loc => normalizeStreetName(loc.settlementName) === normalizeStreetName(plantFilter));
        }

        if (statusFilter !== 'ALL') {
            filtered = filtered.filter(loc => loc.status === statusFilter);
        }

        if (searchQuery) {
            filtered = filtered.filter(loc =>
                (loc.settlementName || '').toLowerCase().includes(searchQuery) ||
                (loc.streetName || '').toLowerCase().includes(searchQuery) ||
                (loc.latestRecord.userName || '').toLowerCase().includes(searchQuery) ||
                (loc.latestRecord.dateString || '').toLowerCase().includes(searchQuery) ||
                (loc.latestRecord.note || '').toLowerCase().includes(searchQuery)
            );
        }

        // Stable town and street order so streets NEVER jump to another page when a new cleaning is added
        const totalCount = filtered.length;
        const { startIndex, endIndex, validPage } = buildPaginationControls(
            'cleaningPaginationControls',
            'cleaningSummaryCount',
            currentCleaningPage,
            totalCount,
            pageSizeVal,
            (newPage) => {
                currentCleaningPage = newPage;
                renderCleaningTable();
            },
            'átemelő helyszín'
        );
        currentCleaningPage = validPage;

        const displayList = filtered.slice(startIndex, endIndex);

        if (displayList.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `<td colspan="7" style="text-align: center; color: #64748b; padding: 24px; font-size: 14px;">Nincs a szűrésnek megfelelő takarítási adat.</td>`;
            tbody.appendChild(row);
            return;
        }

        displayList.forEach(loc => {
            const row = document.createElement('tr');
            row.style.cursor = 'pointer';
            row.title = 'Dupla kattintással szerkesztheted az adatokat | Nyomvatartással húzhatod fel-le a sorrend megváltoztatásához!';
            row.onclick = (e) => {
                if (e.target.tagName !== 'BUTTON' && !e.target.closest('button')) {
                    openLocationCleaningHistoryModal(loc.key, loc.settlementName, loc.streetName);
                }
            };
            const escapedTown = (loc.settlementName || '').replace(/'/g, "\\'");
            const escapedStreet = (loc.streetName || '').replace(/'/g, "\\'");
            row.innerHTML = `
                <td><strong>${loc.latestRecord.dateString}</strong></td>
                <td>${getCleaningStatusBadgeHTML(loc.daysAgo)}</td>
                <td><span class="settlement-badge">${TRUCK_SVG_ICON}${loc.settlementName}</span></td>
                <td><strong>${loc.streetName}</strong></td>
                <td>${loc.latestRecord.note || '-'}</td>
                <td style="white-space: nowrap;"><strong style="color: #0077b6;">${loc.latestRecord.userName || 'Mizsei Márk'}</strong></td>
                <td style="text-align: center; white-space: nowrap;">
                    <button onclick="openLocationCleaningHistoryModal('${loc.key}', '${escapedTown}', '${escapedStreet}')" class="btn-icon-edit" style="width: auto; padding: 4px 10px; font-weight: bold; font-size: 12px; height: auto;" title="Előzmények megtekintése">
                        📝 ${loc.historyRecords.length} előzmény
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });

    } else {
        // --- HISTORY LOG MODE ---
        let filtered = cleaningRecords.map(r => {
            const daysAgo = calculateCleaningDaysAgo(r.timestamp, r.dateString);
            let status = 'OK';
            if (daysAgo > 60) status = 'OVERDUE';
            else if (daysAgo >= 31) status = 'WARNING';
            return { record: r, daysAgo: daysAgo, status: status };
        });

        if (plantFilter !== 'ALL') {
            filtered = filtered.filter(item => normalizeStreetName(item.record.settlementName) === normalizeStreetName(plantFilter));
        }

        if (statusFilter !== 'ALL') {
            filtered = filtered.filter(item => item.status === statusFilter);
        }

        if (searchQuery) {
            filtered = filtered.filter(item =>
                (item.record.settlementName || '').toLowerCase().includes(searchQuery) ||
                (item.record.streetName || '').toLowerCase().includes(searchQuery) ||
                (item.record.userName || '').toLowerCase().includes(searchQuery) ||
                (item.record.dateString || '').toLowerCase().includes(searchQuery) ||
                (item.record.note || '').toLowerCase().includes(searchQuery)
            );
        }

        filtered.sort((a, b) => (b.record.timestamp || 0) - (a.record.timestamp || 0));

        const totalCount = filtered.length;
        const { startIndex, endIndex, validPage } = buildPaginationControls(
            'cleaningPaginationControls',
            'cleaningSummaryCount',
            currentCleaningPage,
            totalCount,
            pageSizeVal,
            (newPage) => {
                currentCleaningPage = newPage;
                renderCleaningTable();
            },
            'bejegyzés'
        );
        currentCleaningPage = validPage;

        const displayList = filtered.slice(startIndex, endIndex);

        if (displayList.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `<td colspan="7" style="text-align: center; color: #64748b; padding: 24px; font-size: 14px;">Még nincs rögzített takarítási bejegyzés.</td>`;
            tbody.appendChild(row);
            return;
        }

        displayList.forEach(item => {
            const rec = item.record;
            const row = document.createElement('tr');
            row.style.cursor = 'pointer';
            row.title = 'Dupla kattintással szerkesztheted az adatokat | Nyomvatartással húzhatod fel-le a sorrend megváltoztatásához!';
            row.onclick = (e) => {
                if (e.target.tagName !== 'BUTTON' && !e.target.closest('button')) {
                    openCleaningEditModal(rec.id);
                }
            };
            row.innerHTML = `
                <td><strong>${rec.dateString}</strong></td>
                <td>${getCleaningStatusBadgeHTML(item.daysAgo)}</td>
                <td><span class="settlement-badge">${TRUCK_SVG_ICON}${rec.settlementName || 'Apaj'}</span></td>
                <td><strong>${rec.streetName || 'Helyszín'}</strong></td>
                <td>${rec.note || '-'}</td>
                <td style="white-space: nowrap;"><strong style="color: #0077b6;">${rec.userName || 'Mizsei Márk'}</strong></td>
                <td style="text-align: center; white-space: nowrap;">
                    <button onclick="openCleaningEditModal('${rec.id}')" class="btn-icon-edit" title="Szerkesztés">✏️</button>
                    <button onclick="deleteCleaningRecordFromWeb('${rec.id}')" class="btn-icon-delete" title="Törlés">🗑</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }
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
    const p1Model = record ? (record.pump1Model || '') : '';
    const p1Impeller = record ? (record.pump1Impeller || '') : '';
    const p1Owner = record ? (record.pump1Owner || '') : '';

    const p2Type = record ? (record.pump2Type || '') : '';
    const p2Serial = record ? (record.pump2Serial || '') : '';
    const p2Model = record ? (record.pump2Model || '') : '';
    const p2Impeller = record ? (record.pump2Impeller || '') : '';
    const p2Owner = record ? (record.pump2Owner || '') : '';

    const pNote = record ? (record.note || '') : '';

    renderVisualCardDOM(p1Type, p1Serial, p1Model, p1Impeller, p1Owner, p2Type, p2Serial, p2Model, p2Impeller, p2Owner, pNote);

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
    const p1Model = document.getElementById('webP1Model') ? document.getElementById('webP1Model').value : '';
    const p1Impeller = document.getElementById('webP1Impeller') ? document.getElementById('webP1Impeller').value : '';
    const p1Owner = document.getElementById('webP1Owner') ? document.getElementById('webP1Owner').value : '';

    const p2Type = document.getElementById('webP2Type') ? document.getElementById('webP2Type').value : '';
    const p2Serial = document.getElementById('webP2Serial') ? document.getElementById('webP2Serial').value : '';
    const p2Model = document.getElementById('webP2Model') ? document.getElementById('webP2Model').value : '';
    const p2Impeller = document.getElementById('webP2Impeller') ? document.getElementById('webP2Impeller').value : '';
    const p2Owner = document.getElementById('webP2Owner') ? document.getElementById('webP2Owner').value : '';

    const pNote = document.getElementById('webPNote') ? document.getElementById('webPNote').value : '';

    if (shouldReRender) {
        renderVisualCardDOM(p1Type, p1Serial, p1Model, p1Impeller, p1Owner, p2Type, p2Serial, p2Model, p2Impeller, p2Owner, pNote);
    }

    const docId = `${currentVisualTown}_${currentVisualStreet}`.replace(/\s+/g, '_').replace(/\./g, '_').replace(/\//g, '_');
    const dateStr = new Date().toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '. ');

    const payload = {
        settlementName: currentVisualTown,
        streetName: currentVisualStreet,
        pump1State: currentP1State,
        pump1Type: p1Type,
        pump1Serial: p1Serial,
        pump1Model: p1Model,
        pump1Impeller: p1Impeller,
        pump1Owner: p1Owner,
        pump1RemoveDate: "",
        pump1Pos: 1,
        pump2State: currentP2State,
        pump2Type: p2Type,
        pump2Serial: p2Serial,
        pump2Model: p2Model,
        pump2Impeller: p2Impeller,
        pump2Owner: p2Owner,
        pump2RemoveDate: "",
        pump2Pos: 2,
        note: pNote,
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

function renderVisualCardDOM(p1Type, p1Serial, p1Model, p1Impeller, p1Owner, p2Type, p2Serial, p2Model, p2Impeller, p2Owner, pNote) {
    const visualContainer = document.getElementById('pumpVisualContainer');
    if (!visualContainer) return;

    const p1ChipBg = currentP1State === 1 ? '#15803d' : (currentP1State === 2 ? '#dc2626' : '#475569');
    const p1ChipText = currentP1State === 1 ? '● Üzemel' : (currentP1State === 2 ? '● Hibás' : 'Nincs szivattyú');
    const p1ChipColor = '#ffffff';

    const p2ChipBg = currentP2State === 1 ? '#15803d' : (currentP2State === 2 ? '#dc2626' : '#475569');
    const p2ChipText = currentP2State === 1 ? '● Üzemel' : (currentP2State === 2 ? '● Hibás' : 'Nincs szivattyú');
    const p2ChipColor = '#ffffff';

    const defaultTowns = ["Apaj", "Kunszentmiklós", "Apostag", "Dunavecse", "Szabadszállás", "Kunadacs", "Szalkszentmárton", "Tass", "Kunpeszér"];
    const allTownOptions = [...new Set([...defaultTowns, ...Object.keys(streetMapData)])].sort();

    const p1OwnerOptionsHTML = ['<option value="">-- Válassz települést --</option>', ...allTownOptions.map(t => `<option value="${t}" ${t === p1Owner ? 'selected' : ''}>${t}</option>`)].join('');
    const p2OwnerOptionsHTML = ['<option value="">-- Válassz települést --</option>', ...allTownOptions.map(t => `<option value="${t}" ${t === p2Owner ? 'selected' : ''}>${t}</option>`)].join('');

    visualContainer.innerHTML = `
        <div class="visual-modal-card" style="border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); max-width: 600px; margin: 0 auto; overflow: hidden; border: 1px solid #cbd5e1;">
            <div style="background: #0077b6; padding: 16px 20px; color: white; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h3 style="font-size: 20px; font-weight: bold; margin: 0; color: #ffffff;">${currentVisualStreet}</h3>
                    <p style="font-size: 13px; color: #e0f7fa; margin-top: 2px;">${currentVisualTown} • Szivattyú nyilvántartás</p>
                </div>
                <button onclick="document.getElementById('pumpVisualContainer').style.display='none'" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 6px 14px; border-radius: 20px; font-weight: bold; cursor: pointer; font-size: 13px;">✕ Bezárás</button>
            </div>

            <div style="padding: 20px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <!-- 1. KOCKA (1. sz. Szivattyú) -->
                    <div class="pump-card-box" style="border-radius: 14px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); text-align: center;">
                        <h4 class="pump-card-title" style="font-size: 15px; font-weight: 600; margin-bottom: 8px;">1. sz. Szivattyú</h4>
                        <div onclick="cycleWebCube(1)" title="Kattints a státusz váltásához!" style="background: ${p1ChipBg}; color: ${p1ChipColor}; padding: 6px 14px; border-radius: 20px; font-weight: bold; font-size: 12px; cursor: pointer; display: inline-block; margin-bottom: 14px; user-select: none;">
                            ${p1ChipText}
                        </div>
                        <div style="text-align: left; margin-bottom: 12px;">
                            <label class="pump-field-label">Fajtája</label>
                            <div style="position: relative;">
                                <input type="text" id="webP1Type" value="${p1Type}" list="pumpTypeOptions" oninput="saveCurrentVisualPump(false)" placeholder="" style="width: 100%; padding: 10px 32px 10px 12px; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 14px; outline: none; box-sizing: border-box;">
                                ${p1Type ? '<span onclick="clearWebInput(\'webP1Type\')" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-weight: bold; cursor: pointer; font-size: 14px;">✕</span>' : ''}
                            </div>
                        </div>
                        <div style="text-align: left; margin-bottom: 12px;">
                            <label class="pump-field-label">Gyári száma</label>
                            <div style="position: relative;">
                                <input type="text" id="webP1Serial" value="${p1Serial}" oninput="saveCurrentVisualPump(false)" placeholder="" style="width: 100%; padding: 10px 32px 10px 12px; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 14px; outline: none; box-sizing: border-box;">
                                ${p1Serial ? '<span onclick="clearWebInput(\'webP1Serial\')" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-weight: bold; cursor: pointer; font-size: 14px;">✕</span>' : ''}
                            </div>
                        </div>
                        <div style="text-align: left; margin-bottom: 12px;">
                            <label class="pump-field-label">Típus</label>
                            <div style="position: relative;">
                                <input type="text" id="webP1Model" value="${p1Model}" oninput="saveCurrentVisualPump(false)" placeholder="" style="width: 100%; padding: 10px 32px 10px 12px; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 14px; outline: none; box-sizing: border-box;">
                                ${p1Model ? '<span onclick="clearWebInput(\'webP1Model\')" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-weight: bold; cursor: pointer; font-size: 14px;">✕</span>' : ''}
                            </div>
                        </div>
                        <div style="text-align: left; margin-bottom: 12px;">
                            <label class="pump-field-label">Járókerék száma</label>
                            <div style="position: relative;">
                                <input type="text" id="webP1Impeller" value="${p1Impeller}" oninput="saveCurrentVisualPump(false)" placeholder="" style="width: 100%; padding: 10px 32px 10px 12px; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 14px; outline: none; box-sizing: border-box;">
                                ${p1Impeller ? '<span onclick="clearWebInput(\'webP1Impeller\')" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-weight: bold; cursor: pointer; font-size: 14px;">✕</span>' : ''}
                            </div>
                        </div>
                        <div style="text-align: left;">
                            <label class="pump-field-label">Tulajdonos</label>
                            <select id="webP1Owner" onchange="saveCurrentVisualPump(false)" style="width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 14px; outline: none; box-sizing: border-box; font-weight: 600;">
                                ${p1OwnerOptionsHTML}
                            </select>
                        </div>
                    </div>

                    <!-- 2. KOCKA (2. sz. Szivattyú) -->
                    <div class="pump-card-box" style="border-radius: 14px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); text-align: center;">
                        <h4 class="pump-card-title" style="font-size: 15px; font-weight: 600; margin-bottom: 8px;">2. sz. Szivattyú</h4>
                        <div onclick="cycleWebCube(2)" title="Kattints a státusz váltásához!" style="background: ${p2ChipBg}; color: ${p2ChipColor}; padding: 6px 14px; border-radius: 20px; font-weight: bold; font-size: 12px; cursor: pointer; display: inline-block; margin-bottom: 14px; user-select: none;">
                            ${p2ChipText}
                        </div>
                        <div style="text-align: left; margin-bottom: 12px;">
                            <label class="pump-field-label">Fajtája</label>
                            <div style="position: relative;">
                                <input type="text" id="webP2Type" value="${p2Type}" list="pumpTypeOptions" oninput="saveCurrentVisualPump(false)" placeholder="" style="width: 100%; padding: 10px 32px 10px 12px; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 14px; outline: none; box-sizing: border-box;">
                                ${p2Type ? '<span onclick="clearWebInput(\'webP2Type\')" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-weight: bold; cursor: pointer; font-size: 14px;">✕</span>' : ''}
                            </div>
                        </div>
                        <div style="text-align: left; margin-bottom: 12px;">
                            <label class="pump-field-label">Gyári száma</label>
                            <div style="position: relative;">
                                <input type="text" id="webP2Serial" value="${p2Serial}" oninput="saveCurrentVisualPump(false)" placeholder="" style="width: 100%; padding: 10px 32px 10px 12px; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 14px; outline: none; box-sizing: border-box;">
                                ${p2Serial ? '<span onclick="clearWebInput(\'webP2Serial\')" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-weight: bold; cursor: pointer; font-size: 14px;">✕</span>' : ''}
                            </div>
                        </div>
                        <div style="text-align: left; margin-bottom: 12px;">
                            <label class="pump-field-label">Típus</label>
                            <div style="position: relative;">
                                <input type="text" id="webP2Model" value="${p2Model}" oninput="saveCurrentVisualPump(false)" placeholder="" style="width: 100%; padding: 10px 32px 10px 12px; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 14px; outline: none; box-sizing: border-box;">
                                ${p2Model ? '<span onclick="clearWebInput(\'webP2Model\')" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-weight: bold; cursor: pointer; font-size: 14px;">✕</span>' : ''}
                            </div>
                        </div>
                        <div style="text-align: left; margin-bottom: 12px;">
                            <label class="pump-field-label">Járókerék száma</label>
                            <div style="position: relative;">
                                <input type="text" id="webP2Impeller" value="${p2Impeller}" oninput="saveCurrentVisualPump(false)" placeholder="" style="width: 100%; padding: 10px 32px 10px 12px; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 14px; outline: none; box-sizing: border-box;">
                                ${p2Impeller ? '<span onclick="clearWebInput(\'webP2Impeller\')" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-weight: bold; cursor: pointer; font-size: 14px;">✕</span>' : ''}
                            </div>
                        </div>
                        <div style="text-align: left;">
                            <label class="pump-field-label">Tulajdonos</label>
                            <select id="webP2Owner" onchange="saveCurrentVisualPump(false)" style="width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 14px; outline: none; box-sizing: border-box; font-weight: 600;">
                                ${p2OwnerOptionsHTML}
                            </select>
                        </div>
                    </div>
                </div>

                <!-- 3. KOCKA (Megjegyzés) -->
                <div class="pump-note-box" style="margin-top: 16px; border-radius: 14px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                    <label class="pump-card-title" style="display: block; font-size: 13px; font-weight: bold; margin-bottom: 6px;">📝 Megjegyzés / Észrevételek</label>
                    <div style="position: relative;">
                        <textarea id="webPNote" oninput="saveCurrentVisualPump(false)" placeholder="Írj megjegyzést a szivattyúk állapotáról..." style="width: 100%; padding: 10px 32px 10px 12px; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 14px; outline: none; box-sizing: border-box; resize: vertical; min-height: 60px;">${pNote || ''}</textarea>
                        ${pNote ? '<span onclick="clearWebInput(\'webPNote\')" style="position: absolute; right: 10px; top: 12px; color: #94a3b8; font-weight: bold; cursor: pointer; font-size: 14px;">✕</span>' : ''}
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
    const statusFilter = document.getElementById('cleaningStatusFilter') ? document.getElementById('cleaningStatusFilter').value : 'ALL';

    let filtered = plantFilter === 'ALL' ? cleaningRecords : cleaningRecords.filter(r => normalizeStreetName(r.settlementName) === normalizeStreetName(plantFilter));

    if (statusFilter !== 'ALL') {
        filtered = filtered.filter(r => {
            const days = calculateCleaningDaysAgo(r.timestamp, r.dateString);
            let status = 'OK';
            if (days > 60) status = 'OVERDUE';
            else if (days >= 31) status = 'WARNING';
            return status === statusFilter;
        });
    }

    if (filtered.length === 0) {
        alert("Nincs letölthető takarítási adat!");
        return;
    }

    const sortedDesc = [...filtered].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    let csvContent = "\uFEFF";
    csvContent += "Takarítás Dátuma;Állapot;Város / Település;Utca / Helyszín;Rögzítő Neve;Megjegyzés\n";

    sortedDesc.forEach((item) => {
        const days = calculateCleaningDaysAgo(item.timestamp, item.dateString);
        let statusText = days <= 30 ? `Rendben (${days} napja)` : (days <= 60 ? `Közeleg (${days} napja)` : `Esedékes (${days} napja)`);

        const line = [
            `"${item.dateString}"`,
            `"${statusText}"`,
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

let selectedPumpStatusValue = 'ALL';

function togglePumpStatusDropdown(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('pumpCustomStatusMenu');
    if (menu) {
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    }
}

function selectPumpStatusOption(val) {
    selectedPumpStatusValue = val;
    const selectedSpan = document.getElementById('pumpCustomStatusSelected');
    const menu = document.getElementById('pumpCustomStatusMenu');

    if (selectedSpan) {
        if (val === 'ALL') {
            selectedSpan.innerHTML = 'Minden állapot';
        } else if (val === '1') {
            selectedSpan.innerHTML = '<span class="pump-pill-badge badge-working">● Üzemel</span>';
        } else if (val === '2') {
            selectedSpan.innerHTML = '<span class="pump-pill-badge badge-faulty">● Hibás</span>';
        } else if (val === '0') {
            selectedSpan.innerHTML = '<span class="pump-pill-badge badge-none">Nincs szivattyú</span>';
        }
    }

    if (menu) menu.style.display = 'none';

    currentPumpPage = 1;
    renderPumpTable();
}

document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('pumpCustomStatusDropdown');
    const menu = document.getElementById('pumpCustomStatusMenu');
    if (dropdown && menu && !dropdown.contains(e.target)) {
        menu.style.display = 'none';
    }
});

function exportPumpToExcel() {
    const townsToInclude = Object.keys(streetMapData).sort((a, b) => a.localeCompare(b, 'hu'));
    let csvRows = [];

    townsToInclude.forEach(town => {
        const streets = (streetMapData[town] || []).slice().sort((a, b) => a.localeCompare(b, 'hu'));
        streets.forEach(street => {
            const existing = pumpRecords.find(r =>
                normalizeStreetName(r.settlementName) === normalizeStreetName(town) &&
                normalizeStreetName(r.streetName) === normalizeStreetName(street)
            );

            const dateStr = existing && existing.dateString ? existing.dateString : '2026. 11. 11.';
            const noteText = existing && existing.note ? existing.note : '-';
            const uploaderName = existing && existing.userName ? existing.userName : 'Rendszer';

            const p1Type = existing && existing.pump1Type ? existing.pump1Type : '';
            const p1Serial = existing && existing.pump1Serial ? existing.pump1Serial : '';
            const p2Type = existing && existing.pump2Type ? existing.pump2Type : '';
            const p2Serial = existing && existing.pump2Serial ? existing.pump2Serial : '';

            const hasP1 = p1Type !== '' || p1Serial !== '' || (existing && existing.pump1State > 0);
            const hasP2 = p2Type !== '' || p2Serial !== '' || (existing && existing.pump2State > 0);

            if (hasP1 || hasP2) {
                if (hasP1) {
                    csvRows.push({
                        town: town,
                        street: street,
                        type: p1Type || '-',
                        serial: p1Serial || '-',
                        dateStr: dateStr,
                        note: noteText,
                        uploader: uploaderName
                    });
                }
                if (hasP2) {
                    csvRows.push({
                        town: town,
                        street: street,
                        type: p2Type || '-',
                        serial: p2Serial || '-',
                        dateStr: dateStr,
                        note: noteText,
                        uploader: uploaderName
                    });
                }
            } else {
                csvRows.push({
                    town: town,
                    street: street,
                    type: '-',
                    serial: '-',
                    dateStr: dateStr,
                    note: noteText,
                    uploader: uploaderName
                });
            }
        });
    });

    if (csvRows.length === 0) {
        alert("Nincs letölthető szivattyú adat!");
        return;
    }

    let csvContent = "\uFEFF";
    csvContent += "Település;Utca / Átemelő;Szivattyú fajtája;Szivattyú gyári száma;Karbantartás dátuma;Megjegyzés;Rögzítő neve\n";

    csvRows.forEach((item) => {
        const line = [
            `"${(item.town || '').replace(/"/g, '""')}"`,
            `"${(item.street || '').replace(/"/g, '""')}"`,
            `"${(item.type || '-').replace(/"/g, '""')}"`,
            `"${(item.serial || '-').replace(/"/g, '""')}"`,
            `"${(item.dateStr || '-').replace(/"/g, '""')}"`,
            `"${(item.note || '-').replace(/"/g, '""')}"`,
            `"${(item.uploader || '-').replace(/"/g, '""')}"`
        ].join(";");

        csvContent += line + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `Szivattyu_Nyilvantartas_Teljes_${dateStr}.csv`;

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
    const statusFilter = selectedPumpStatusValue || 'ALL';
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

    if (statusFilter !== 'ALL') {
        const targetState = parseInt(statusFilter, 10);
        allStreetRows = allStreetRows.filter(r => (r.pump1State === targetState || r.pump2State === targetState));
    }

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
    const { startIndex, endIndex, validPage } = buildPaginationControls(
        'pumpPaginationControls',
        'pumpSummaryCount',
        currentPumpPage,
        totalCount,
        pageSizeVal,
        (newPage) => {
            currentPumpPage = newPage;
            renderPumpTable();
        },
        'bejegyzés'
    );
    currentPumpPage = validPage;

    const displayList = allStreetRows.slice(startIndex, endIndex);

    if (displayList.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="7" style="text-align: center; color: #64748b; padding: 24px; font-size: 14px;">Még nincs rögzített szivattyú adat ehhez a szűréshez.</td>`;
        tbody.appendChild(row);
        return;
    }

    displayList.forEach((item) => {
        const p1StatusBadge = item.pump1State === 1
            ? '<span style="background: #15803d; color: #ffffff; font-weight: 800; padding: 5px 12px; border-radius: 20px; font-size: 12px; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.15);">● Üzemel</span>'
            : (item.pump1State === 2
                ? '<span style="background: #dc2626; color: #ffffff; font-weight: 800; padding: 5px 12px; border-radius: 20px; font-size: 12px; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.15);">● Hibás</span>'
                : '<span style="background: #475569; color: #ffffff; font-weight: 600; padding: 5px 12px; border-radius: 20px; font-size: 12px; display: inline-block;">Nincs szivattyú</span>');

        const p2StatusBadge = item.pump2State === 1
            ? '<span style="background: #15803d; color: #ffffff; font-weight: 800; padding: 5px 12px; border-radius: 20px; font-size: 12px; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.15);">● Üzemel</span>'
            : (item.pump2State === 2
                ? '<span style="background: #dc2626; color: #ffffff; font-weight: 800; padding: 5px 12px; border-radius: 20px; font-size: 12px; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.15);">● Hibás</span>'
                : '<span style="background: #475569; color: #ffffff; font-weight: 600; padding: 5px 12px; border-radius: 20px; font-size: 12px; display: inline-block;">Nincs szivattyú</span>');

        const p1Details = [item.pump1Type, item.pump1Serial].filter(Boolean).join(' - ');
        const p2Details = [item.pump2Type, item.pump2Serial].filter(Boolean).join(' - ');

        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        row.title = 'Dupla kattintással szerkesztheted az adatokat | Nyomvatartással húzhatod fel-le a sorrend megváltoztatásához!';
        row.onclick = () => {
            openPumpVisualView(item.settlementName || '', item.streetName || '');
        };
        row.innerHTML = `
            <td><strong>${item.dateString || '2026. 11. 11.'}</strong></td>
            <td><span style="background: #e0f2fe; padding: 4px 8px; border-radius: 4px; font-weight: bold; color: #0077b6;">🛠️ ${item.settlementName || 'Apaj'}</span></td>
            <td><strong>${item.streetName || 'Helyszín'}</strong></td>
            <td>${p1StatusBadge} ${p1Details ? '<span style="color: #334155; font-size: 13px; font-weight: 500; margin-left: 6px;">(' + p1Details + ')</span>' : ''}</td>
            <td>${p2StatusBadge} ${p2Details ? '<span style="color: #334155; font-size: 13px; font-weight: 500; margin-left: 6px;">(' + p2Details + ')</span>' : ''}</td>
            <td style="color: #334155; font-size: 13px; font-weight: 500;">${item.note || '-'}</td>
            <td style="white-space: nowrap;"><strong style="color: #0077b6;">${item.userName || 'Rendszer'}</strong></td>
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
                updateMonthlyProgressSummaryWeb();
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
                        pump1Model: data.pump1Model || "",
                        pump1Impeller: data.pump1Impeller || "",
                        pump1Owner: data.pump1Owner || "",
                        pump2State: Number(data.pump2State || 0),
                        pump2Type: data.pump2Type || "",
                        pump2Serial: data.pump2Serial || "",
                        pump2Model: data.pump2Model || "",
                        pump2Impeller: data.pump2Impeller || "",
                        pump2Owner: data.pump2Owner || "",
                        note: data.note || "",
                        userEmail: rawEmail,
                        userName: resolveDisplayName(rawName, rawEmail)
                    });
                });
                pumpRecords = list;
                renderPumpTable();
            }, (error) => {
                console.warn("Firestore pump_records snapshot error:", error);
            });

            db.collection("pump_warehouse").onSnapshot((snapshot) => {
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
                        pumps: Array.isArray(data.pumps) ? data.pumps : [],
                        note: data.note || "",
                        userEmail: rawEmail,
                        userName: resolveDisplayName(rawName, rawEmail)
                    });
                });
                pumpWarehouseRecords = list;
                renderPumpWarehouseTable();
            }, (error) => {
                console.warn("Firestore pump_warehouse snapshot error:", error);
            });

        } catch (e) {
            console.warn("Firebase initialization warning:", e);
        }
    }
}

let pumpWarehouseRecords = [];
let currentPumpWarehousePage = 1;
let currentWarehouseVisualTown = '';
let currentWarehouseVisualStreet = '';
let currentWarehousePumps = [];
let webWarehouseSaveTimeout = null;

function openWarehouseVisualView(town, street) {
    const visualContainer = document.getElementById('pumpWarehouseVisualContainer');
    if (!visualContainer) return;

    currentWarehouseVisualTown = (town || '').replace(/_/g, ' ');
    currentWarehouseVisualStreet = (street || '').replace(/_/g, ' ');

    const normTown = normalizeStreetName(town);
    const normStreet = normalizeStreetName(street);

    let record = pumpWarehouseRecords.find(r =>
        normalizeStreetName(r.settlementName) === normTown &&
        normalizeStreetName(r.streetName) === normStreet
    );

    function populateFromRecord(rec) {
        if (rec && Array.isArray(rec.pumps) && rec.pumps.length > 0) {
            currentWarehousePumps = rec.pumps.map(p => {
                const isActive = p.active !== undefined ? Boolean(p.active) : (Number(p.state) === 1);
                return {
                    state: isActive ? 1 : 0,
                    active: isActive,
                    type: p.fajta || p.type || '',
                    fajta: p.fajta || p.type || '',
                    serial: p.gyariSzam || p.serial || '',
                    gyariSzam: p.gyariSzam || p.serial || '',
                    model: p.tipus || p.model || '',
                    tipus: p.tipus || p.model || '',
                    impeller: p.jarokerekSzam || p.impeller || '',
                    jarokerekSzam: p.jarokerekSzam || p.impeller || '',
                    owner: p.tulajdonos || p.owner || '',
                    tulajdonos: p.tulajdonos || p.owner || ''
                };
            });
        } else {
            currentWarehousePumps = [{
                state: 0,
                active: false,
                type: '',
                fajta: '',
                serial: '',
                gyariSzam: '',
                model: '',
                tipus: '',
                impeller: '',
                jarokerekSzam: '',
                owner: '',
                tulajdonos: ''
            }];
        }

        const pNote = rec ? (rec.megjegyzes || rec.note || '') : '';
        renderWarehouseCardDOM(pNote);
    }

    populateFromRecord(record);

    visualContainer.style.display = 'block';
    visualContainer.scrollIntoView({ behavior: 'smooth' });

    // Live fetch from Firestore to ensure 100% fresh data on open
    const docId = `${currentWarehouseVisualTown}_${currentWarehouseVisualStreet}`.replace(/\s+/g, '_').replace(/\./g, '_').replace(/\//g, '_');
    if (typeof firebase !== 'undefined') {
        try {
            firebase.firestore().collection("pump_warehouse").doc(docId).get()
                .then(doc => {
                    if (doc.exists) {
                        const data = doc.data();
                        const freshRecord = { id: doc.id, ...data };
                        const existingIdx = pumpWarehouseRecords.findIndex(r => r.id === doc.id || (normalizeStreetName(r.settlementName) === normTown && normalizeStreetName(r.streetName) === normStreet));
                        if (existingIdx >= 0) {
                            pumpWarehouseRecords[existingIdx] = freshRecord;
                        } else {
                            pumpWarehouseRecords.unshift(freshRecord);
                        }
                        populateFromRecord(freshRecord);
                    }
                })
                .catch(err => {
                    console.error("Firestore get error for warehouse doc:", err);
                });
        } catch (e) {
            console.error("Firebase fetch error:", e);
        }
    }
}

function cycleWarehouseCube(index) {
    if (currentWarehousePumps[index]) {
        const nextState = currentWarehousePumps[index].state === 1 ? 0 : 1;
        currentWarehousePumps[index].state = nextState;
        currentWarehousePumps[index].active = nextState === 1;
    }
    saveCurrentWarehousePump(true);
}

function addWarehousePumpCard() {
    currentWarehousePumps.push({
        state: 0,
        active: false,
        type: '',
        fajta: '',
        serial: '',
        gyariSzam: '',
        model: '',
        tipus: '',
        impeller: '',
        jarokerekSzam: '',
        owner: '',
        tulajdonos: ''
    });
    saveCurrentWarehousePump(true);
}

function removeWarehousePumpCard(index) {
    if (currentWarehousePumps.length > 1) {
        currentWarehousePumps.splice(index, 1);
    } else {
        currentWarehousePumps[0] = { state: 0, active: false, type: '', fajta: '', serial: '', gyariSzam: '', model: '', tipus: '', impeller: '', jarokerekSzam: '', owner: '', tulajdonos: '' };
    }
    saveCurrentWarehousePump(true);
}

function saveCurrentWarehousePump(shouldReRender = false) {
    currentWarehousePumps.forEach((p, idx) => {
        const typeEl = document.getElementById(`webWhType_${idx}`);
        const serialEl = document.getElementById(`webWhSerial_${idx}`);
        const modelEl = document.getElementById(`webWhModel_${idx}`);
        const impellerEl = document.getElementById(`webWhImpeller_${idx}`);
        const ownerEl = document.getElementById(`webWhOwner_${idx}`);

        if (typeEl) { p.type = typeEl.value; p.fajta = typeEl.value; }
        if (serialEl) { p.serial = serialEl.value; p.gyariSzam = serialEl.value; }
        if (modelEl) { p.model = modelEl.value; p.tipus = modelEl.value; }
        if (impellerEl) { p.impeller = impellerEl.value; p.jarokerekSzam = impellerEl.value; }
        if (ownerEl) { p.owner = ownerEl.value; p.tulajdonos = ownerEl.value; }
        p.active = Number(p.state) === 1;
    });

    const pNoteEl = document.getElementById('webWhPNote');
    const pNote = pNoteEl ? pNoteEl.value : '';

    if (shouldReRender) {
        renderWarehouseCardDOM(pNote);
    }

    const docId = `${currentWarehouseVisualTown}_${currentWarehouseVisualStreet}`.replace(/\s+/g, '_').replace(/\./g, '_').replace(/\//g, '_');
    const dateStr = new Date().toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '. ');
    const nowTs = Date.now();

    const normalizedPumpsPayload = currentWarehousePumps.map(p => {
        const isActive = Number(p.state) === 1 || Boolean(p.active);
        return {
            active: isActive,
            state: isActive ? 1 : 0,
            fajta: p.fajta || p.type || '',
            type: p.fajta || p.type || '',
            gyariSzam: p.gyariSzam || p.serial || '',
            serial: p.gyariSzam || p.serial || '',
            tipus: p.tipus || p.model || '',
            model: p.tipus || p.model || '',
            jarokerekSzam: p.jarokerekSzam || p.impeller || '',
            impeller: p.jarokerekSzam || p.impeller || '',
            tulajdonos: p.tulajdonos || p.owner || '',
            owner: p.tulajdonos || p.owner || ''
        };
    });

    const payload = {
        telepules: currentWarehouseVisualTown,
        utca: currentWarehouseVisualStreet,
        settlementName: currentWarehouseVisualTown,
        streetName: currentWarehouseVisualStreet,
        pumps: normalizedPumpsPayload,
        megjegyzes: pNote,
        note: pNote,
        dateString: dateStr,
        userEmail: getLoggedInAdminEmail(),
        userName: getLoggedInAdminName(),
        updatedAt: nowTs,
        timestamp: nowTs
    };

    const existingIdx = pumpWarehouseRecords.findIndex(r => r.id === docId || (normalizeStreetName(r.settlementName) === normalizeStreetName(currentWarehouseVisualTown) && normalizeStreetName(r.streetName) === normalizeStreetName(currentWarehouseVisualStreet)));
    if (existingIdx >= 0) {
        pumpWarehouseRecords[existingIdx] = { ...pumpWarehouseRecords[existingIdx], ...payload, id: docId };
    } else {
        pumpWarehouseRecords.unshift({ id: docId, ...payload });
    }

    renderPumpWarehouseTable();

    // 400ms Debounced Automatic Auto-Save to Firestore
    if (webWarehouseSaveTimeout) clearTimeout(webWarehouseSaveTimeout);
    webWarehouseSaveTimeout = setTimeout(async () => {
        if (typeof firebase !== 'undefined') {
            try {
                const db = firebase.firestore();
                await db.collection("pump_warehouse").doc(docId).set(payload, { merge: true });
                console.log("✔ Auto-saved to Firestore (pump_warehouse):", docId);
            } catch (err) {
                console.error("❌ Firestore auto-save error (pump_warehouse):", err);
                alert("Mentési hiba: " + (err.message || err));
            }
        }
    }, 400);
}

function renderWarehouseCardDOM(pNote) {
    const visualContainer = document.getElementById('pumpWarehouseVisualContainer');
    if (!visualContainer) return;

    const defaultTowns = ["Apaj", "Kunszentmiklós", "Apostag", "Dunavecse", "Szabadszállás", "Kunadacs", "Szalkszentmárton", "Tass", "Kunpeszér"];
    const allTownOptions = [...new Set([...defaultTowns, ...Object.keys(streetMapData)])].sort();

    let cardsHTML = '';

    currentWarehousePumps.forEach((p, idx) => {
        const chipClass = Number(p.state) === 1 || Boolean(p.active) ? 'chip-van' : 'chip-nincs';
        const chipText = Number(p.state) === 1 || Boolean(p.active) ? '● Van' : '● Nincs';
        const pOwnerVal = p.tulajdonos || p.owner || '';

        const ownerOptionsHTML = ['<option value="">-- Válassz települést --</option>', ...allTownOptions.map(t => `<option value="${t}" ${t === pOwnerVal ? 'selected' : ''}>${t}</option>`)].join('');

        cardsHTML += `
            <div class="warehouse-card-box" style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 14px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); text-align: center; position: relative;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <h4 style="font-size: 15px; font-weight: 600; color: #1e293b; margin: 0;">${idx + 1}. sz. Tartalék szivattyú</h4>
                    ${currentWarehousePumps.length > 1 ? `<button onclick="removeWarehousePumpCard(${idx})" title="Törlés" style="background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; border-radius: 6px; padding: 2px 8px; font-size: 12px; font-weight: bold; cursor: pointer;">🗑 Törlés</button>` : ''}
                </div>
                <div onclick="cycleWarehouseCube(${idx})" title="Kattints a státusz váltásához (Van / Nincs)!" class="wh-status-chip ${chipClass}">
                    ${chipText}
                </div>
                <div style="text-align: left; margin-bottom: 12px;">
                    <label class="pump-field-label">Fajtája</label>
                    <input type="text" id="webWhType_${idx}" value="${p.fajta || p.type || ''}" list="pumpTypeOptions" oninput="saveCurrentWarehousePump(false)" placeholder="" style="width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 14px; outline: none; box-sizing: border-box;">
                </div>
                <div style="text-align: left; margin-bottom: 12px;">
                    <label class="pump-field-label">Gyári száma</label>
                    <input type="text" id="webWhSerial_${idx}" value="${p.gyariSzam || p.serial || ''}" oninput="saveCurrentWarehousePump(false)" placeholder="" style="width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 14px; outline: none; box-sizing: border-box;">
                </div>
                <div style="text-align: left; margin-bottom: 12px;">
                    <label class="pump-field-label">Típus</label>
                    <input type="text" id="webWhModel_${idx}" value="${p.tipus || p.model || ''}" oninput="saveCurrentWarehousePump(false)" placeholder="" style="width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 14px; outline: none; box-sizing: border-box;">
                </div>
                <div style="text-align: left; margin-bottom: 12px;">
                    <label class="pump-field-label">Járókerék száma</label>
                    <input type="text" id="webWhImpeller_${idx}" value="${p.jarokerekSzam || p.impeller || ''}" oninput="saveCurrentWarehousePump(false)" placeholder="" style="width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 14px; outline: none; box-sizing: border-box;">
                </div>
                <div style="text-align: left;">
                    <label class="pump-field-label">Tulajdonos</label>
                    <select id="webWhOwner_${idx}" onchange="saveCurrentWarehousePump(false)" style="width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 14px; outline: none; box-sizing: border-box; background: #ffffff; color: #0f172a; font-weight: 600;">
                        ${ownerOptionsHTML}
                    </select>
                </div>
            </div>
        `;
    });

    visualContainer.innerHTML = `
        <div class="visual-modal-card" style="border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); max-width: 680px; margin: 0 auto; overflow: hidden; border: 1px solid #cbd5e1;">
            <div style="background: #0077b6; padding: 16px 20px; color: white; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h3 style="font-size: 20px; font-weight: bold; margin: 0; color: #ffffff;">${currentWarehouseVisualStreet}</h3>
                    <p style="font-size: 13px; color: #e0f7fa; margin-top: 2px;">${currentWarehouseVisualTown} • Szivattyú Raktár (Tartalék szivattyúk)</p>
                </div>
                <button onclick="document.getElementById('pumpWarehouseVisualContainer').style.display='none'" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 6px 14px; border-radius: 20px; font-weight: bold; cursor: pointer; font-size: 13px;">✕ Bezárás</button>
            </div>

            <div style="padding: 20px;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px;">
                    ${cardsHTML}
                </div>

                <div style="margin-top: 16px; text-align: center;">
                    <button onclick="addWarehousePumpCard()" style="background: #0284c7; color: white; border: none; padding: 10px 20px; border-radius: 10px; font-weight: bold; font-size: 14px; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.15); display: inline-flex; align-items: center; gap: 6px;">
                        ➕ Új tartalék szivattyú hozzáadása
                    </button>
                </div>

                <div class="pump-note-box" style="margin-top: 16px; border-radius: 14px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                    <label class="pump-card-title" style="display: block; font-size: 13px; font-weight: bold; margin-bottom: 6px;">📝 Megjegyzés / Észrevételek</label>
                    <textarea id="webWhPNote" oninput="saveCurrentWarehousePump(false)" placeholder="Írj megjegyzést a raktári szivattyúkról..." style="width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 14px; outline: none; box-sizing: border-box; resize: vertical; min-height: 60px;">${pNote || ''}</textarea>
                </div>
            </div>
        </div>
    `;
}

function renderPumpWarehouseTable() {
    const tbody = document.getElementById('pumpWarehouseTableBody');
    const plantFilter = document.getElementById('pumpWarehousePlantFilter') ? document.getElementById('pumpWarehousePlantFilter').value : 'ALL';
    const statusFilter = document.getElementById('pumpWarehouseStatusFilter') ? document.getElementById('pumpWarehouseStatusFilter').value : 'ALL';
    const searchQuery = document.getElementById('pumpWarehouseSearch') ? document.getElementById('pumpWarehouseSearch').value.trim().toLowerCase() : '';
    const pageSizeVal = document.getElementById('pumpWarehousePageSize') ? document.getElementById('pumpWarehousePageSize').value : '25';

    if (!tbody) return;
    tbody.innerHTML = '';

    const townsToInclude = (plantFilter === 'ALL' ? Object.keys(streetMapData) : [plantFilter])
        .sort((a, b) => a.localeCompare(b, 'hu'));

    let allRows = [];

    townsToInclude.forEach(town => {
        const streets = (streetMapData[town] || []).slice().sort((a, b) => a.localeCompare(b, 'hu'));
        streets.forEach(street => {
            const normTown = normalizeStreetName(town);
            const normStreet = normalizeStreetName(street);

            const record = pumpWarehouseRecords.find(r =>
                normalizeStreetName(r.settlementName) === normTown &&
                normalizeStreetName(r.streetName) === normStreet
            );

            const pumps = record && Array.isArray(record.pumps) ? record.pumps : [];
            const hasVan = pumps.some(p => Number(p.state) === 1);
            const statusKey = hasVan ? 'VAN' : 'NINCS';
            const statusBadge = hasVan
                ? '<span style="background: #15803d; color: #ffffff; font-weight: 800; padding: 5px 12px; border-radius: 20px; font-size: 12px; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.15);">● Van</span>'
                : '<span style="background: #dc2626; color: #ffffff; font-weight: 800; padding: 5px 12px; border-radius: 20px; font-size: 12px; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.15);">● Nincs</span>';

            let pumpsSummary = '-';
            if (pumps.length > 0) {
                const activePumps = pumps.filter(p => p.type || p.serial || p.model || p.owner);
                if (activePumps.length > 0) {
                    pumpsSummary = activePumps.map((p, i) => {
                        const parts = [p.type, p.model, p.serial, p.impeller ? `j.k: ${p.impeller}` : '', p.owner ? `tul: ${p.owner}` : ''].filter(Boolean).join(' | ');
                        return `<div><strong>${i + 1}.</strong> ${parts || 'Tartalék szivattyú'}</div>`;
                    }).join('');
                }
            }

            allRows.push({
                town: town,
                street: street,
                statusKey: statusKey,
                statusBadge: statusBadge,
                pumpsSummary: pumpsSummary,
                note: record ? (record.note || '-') : '-',
                dateString: record ? (record.dateString || '-') : '-',
                userName: record ? (record.userName || '-') : '-'
            });
        });
    });

    if (statusFilter !== 'ALL') {
        allRows = allRows.filter(r => r.statusKey === statusFilter);
    }

    if (searchQuery) {
        allRows = allRows.filter(r =>
            (r.town || '').toLowerCase().includes(searchQuery) ||
            (r.street || '').toLowerCase().includes(searchQuery) ||
            (r.statusKey || '').toLowerCase().includes(searchQuery) ||
            (r.pumpsSummary || '').toLowerCase().includes(searchQuery) ||
            (r.note || '').toLowerCase().includes(searchQuery) ||
            (r.userName || '').toLowerCase().includes(searchQuery)
        );
    }

    const totalCount = allRows.length;
    const { startIndex, endIndex, validPage } = buildPaginationControls(
        'pumpWarehousePaginationControls',
        'pumpWarehouseSummaryCount',
        currentPumpWarehousePage,
        totalCount,
        pageSizeVal,
        (newPage) => {
            currentPumpWarehousePage = newPage;
            renderPumpWarehouseTable();
        },
        'raktári helyszín'
    );
    currentPumpWarehousePage = validPage;

    const displayList = allRows.slice(startIndex, endIndex);

    if (displayList.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="7" style="text-align: center; color: #64748b; padding: 24px; font-size: 14px;">Nincs a szűrésnek megfelelő raktári szivattyú adat.</td>`;
        tbody.appendChild(row);
        return;
    }

    displayList.forEach(item => {
        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        row.title = 'Kattints a sorra a raktári szivattyúk szerkesztéséhez!';
        row.onclick = () => {
            openWarehouseVisualView(item.town, item.street);
        };
        row.innerHTML = `
            <td><strong>${item.dateString}</strong></td>
            <td><span style="background: #e0f2fe; padding: 4px 8px; border-radius: 4px; font-weight: bold; color: #0077b6;">📦 ${item.town}</span></td>
            <td><strong>${item.street}</strong></td>
            <td>${item.statusBadge}</td>
            <td style="font-size: 13px; font-weight: 500;">${item.pumpsSummary}</td>
            <td style="color: #334155; font-size: 13px; font-weight: 500;">${item.note}</td>
            <td style="white-space: nowrap;"><strong style="color: #0077b6;">${item.userName}</strong></td>
        `;
        tbody.appendChild(row);
    });
}

function exportWarehouseToExcel() {
    const plantFilter = document.getElementById('pumpWarehousePlantFilter') ? document.getElementById('pumpWarehousePlantFilter').value : 'ALL';
    const statusFilter = document.getElementById('pumpWarehouseStatusFilter') ? document.getElementById('pumpWarehouseStatusFilter').value : 'ALL';
    const searchQuery = document.getElementById('pumpWarehouseSearch') ? document.getElementById('pumpWarehouseSearch').value.trim().toLowerCase() : '';

    const townsToInclude = (plantFilter === 'ALL' ? Object.keys(streetMapData) : [plantFilter])
        .sort((a, b) => a.localeCompare(b, 'hu'));

    let exportRows = [];

    townsToInclude.forEach(town => {
        const streets = (streetMapData[town] || []).slice().sort((a, b) => a.localeCompare(b, 'hu'));
        streets.forEach(street => {
            const normTown = normalizeStreetName(town);
            const normStreet = normalizeStreetName(street);

            const record = pumpWarehouseRecords.find(r =>
                normalizeStreetName(r.settlementName) === normTown &&
                normalizeStreetName(r.streetName) === normStreet
            );

            const pumps = record && Array.isArray(record.pumps) ? record.pumps : [];

            pumps.forEach((p, idx) => {
                exportRows.push({
                    town: town,
                    street: street,
                    status: Number(p.state) === 1 ? 'Van' : 'Nincs',
                    pumpNum: `${idx + 1}. sz. Tartalék`,
                    type: p.type || '',
                    serial: p.serial || '',
                    model: p.model || '',
                    impeller: p.impeller || '',
                    owner: p.owner || '',
                    note: record ? (record.note || '') : ''
                });
            });

            if (pumps.length === 0) {
                exportRows.push({
                    town: town,
                    street: street,
                    status: 'Nincs',
                    pumpNum: '1. sz. Tartalék',
                    type: '',
                    serial: '',
                    model: '',
                    impeller: '',
                    owner: '',
                    note: record ? (record.note || '') : ''
                });
            }
        });
    });

    if (statusFilter !== 'ALL') {
        exportRows = exportRows.filter(r => (statusFilter === 'VAN' && r.status === 'Van') || (statusFilter === 'NINCS' && r.status === 'Nincs'));
    }

    if (searchQuery) {
        exportRows = exportRows.filter(r =>
            (r.town || '').toLowerCase().includes(searchQuery) ||
            (r.street || '').toLowerCase().includes(searchQuery) ||
            (r.status || '').toLowerCase().includes(searchQuery) ||
            (r.type || '').toLowerCase().includes(searchQuery) ||
            (r.serial || '').toLowerCase().includes(searchQuery) ||
            (r.model || '').toLowerCase().includes(searchQuery) ||
            (r.owner || '').toLowerCase().includes(searchQuery) ||
            (r.note || '').toLowerCase().includes(searchQuery)
        );
    }

    if (exportRows.length === 0) {
        alert("Nincs letölthető raktári szivattyú adat!");
        return;
    }

    if (typeof XLSX === 'undefined') {
        alert("Hiba: Az Excel (SheetJS) könyvtár nincs betöltve!");
        return;
    }

    const dataForSheet = [
        ["Település", "Utca", "Állapot", "Szivattyú", "Fajtája", "Gyári száma", "Típus", "Járókerék száma", "Tulajdonos", "Megjegyzés"]
    ];

    exportRows.forEach(item => {
        dataForSheet.push([
            item.town,
            item.street,
            item.status,
            item.pumpNum,
            item.type,
            item.serial,
            item.model,
            item.impeller,
            item.owner,
            item.note
        ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(dataForSheet);
    ws['!cols'] = [
        { wch: 20 }, { wch: 30 }, { wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 30 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Szivattyú Raktár");

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Szivattyu_raktar_${dateStr}.xlsx`);
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

function updateMonthlyProgressSummaryWeb() {
    const leolvasottEl = document.getElementById('leolvasott-count');
    const osszesEl = document.getElementById('osszes-count');
    const hatralevoContainer = document.getElementById('hatralevo-container');
    const progressBar = document.getElementById('haviProgressBar');

    if (!leolvasottEl || !osszesEl || !hatralevoContainer) return;

    let totalMeters = 0;
    let recordedMeters = 0;

    const towns = Object.keys(streetMapData);
    towns.forEach(town => {
        const streets = streetMapData[town] || [];
        const normTown = normalizeStreetName(town);

        streets.forEach(street => {
            const normStreet = normalizeStreetName(street);
            totalMeters++;

            const sameMeterReadings = electricityReadings.filter(r =>
                normalizeStreetName(r.settlementName) === normTown &&
                normalizeStreetName(r.meterName) === normStreet
            ).sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));

            const latestReading = sameMeterReadings.length > 0 ? sameMeterReadings[0] : null;

            if (latestReading && latestReading.dayKwh > 0) {
                recordedMeters++;
            }
        });
    });

    const remainingMeters = Math.max(0, totalMeters - recordedMeters);
    const progressPercent = totalMeters > 0 ? Math.min(100, Math.round((recordedMeters / totalMeters) * 100)) : 0;

    leolvasottEl.textContent = recordedMeters;
    osszesEl.textContent = totalMeters;

    if (remainingMeters === 0 && totalMeters > 0) {
        hatralevoContainer.innerHTML = '<span style="background: #15803d; color: #ffffff; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: bold;">Kész!</span>';
    } else {
        hatralevoContainer.innerHTML = `Még <span id="hatralevo-count" style="color: #80deea; font-weight: bold;">${remainingMeters}</span> db`;
    }

    if (progressBar) {
        progressBar.style.width = `${progressPercent}%`;
    }
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
            ).sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));

            const fixedDocId = `elec_${town}_${street}`.replace(/\s+/g, '_').replace(/\./g, '_').replace(/\//g, '_');
            const primaryReading = sameMeterReadings.find(r => r.id === fixedDocId || !r.id.startsWith("hist_")) || sameMeterReadings[0] || null;

            let prevKwhText = '-';
            let currKwhText = '-';
            let diffBadge = '<span style="color:#94a3b8;">-</span>';
            let dateStr = '2026. 11. 11.';
            let uploaderName = 'Rendszer';
            let noteText = '-';
            let docId = fixedDocId;

            if (primaryReading) {
                dateStr = primaryReading.dateString || '2026. 11. 11.';
                noteText = primaryReading.note || noteText;
                docId = primaryReading.id;

                if (primaryReading.userName && primaryReading.userName.trim() !== '') {
                    uploaderName = primaryReading.userName;
                }

                // Baseline previous reading (Explicit prevDayKwh only)
                const baselinePrev = (primaryReading.prevDayKwh && primaryReading.prevDayKwh > 0)
                    ? primaryReading.prevDayKwh
                    : null;

                if (baselinePrev !== null && baselinePrev > 0) {
                    prevKwhText = `${Math.round(baselinePrev)} kWh`;
                } else {
                    prevKwhText = '-';
                }

                if (primaryReading.dayKwh > 0) {
                    currKwhText = `${Math.round(primaryReading.dayKwh)} kWh`;

                    if (baselinePrev !== null && baselinePrev > 0) {
                        const diff = primaryReading.dayKwh - baselinePrev;
                        if (diff >= 0) {
                            diffBadge = `<span style="background: #dcfce7; color: #15803d; font-weight: bold; padding: 3px 8px; border-radius: 6px; font-size: 12px; display: inline-block;">▲ +${Math.round(diff)} kWh</span>`;
                        } else {
                            diffBadge = `<span style="background: #fee2e2; color: #b91c1c; font-weight: bold; padding: 3px 8px; border-radius: 6px; font-size: 12px; display: inline-block;">▼ ${Math.round(diff)} kWh</span>`;
                        }
                    } else {
                        diffBadge = '<span style="color:#94a3b8;">-</span>';
                    }
                } else {
                    currKwhText = '-';
                    diffBadge = '<span style="color:#94a3b8;">-</span>';
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
    const { startIndex, endIndex, validPage } = buildPaginationControls(
        'electricityPaginationControls',
        'electricitySummaryCount',
        currentElectricityPage,
        totalCount,
        pageSizeVal,
        (newPage) => {
            currentElectricityPage = newPage;
            renderTable();
        },
        'bejegyzés'
    );
    currentElectricityPage = validPage;

    const displayList = allElecRows.slice(startIndex, endIndex);

    if (displayList.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="9" style="text-align: center; color: #64748b; padding: 24px; font-size: 14px;">Még nincs rögzített leolvasási adat ehhez a szűréshez.</td>`;
        tbody.appendChild(row);
        return;
    }

    displayList.forEach((item) => {
        const row = document.createElement('tr');
        row.style.cursor = 'grab';
        row.title = 'Dupla kattintással szerkesztheted az adatokat | Nyomvatartással húzhatod fel-le a sorrend megváltoztatásához!';
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
            <td style="color: #334155; font-size: 13px; font-weight: 500;">${item.note}</td>
            <td style="white-space: nowrap;"><strong style="color: #0077b6;">${item.userName}</strong></td>
            <td style="text-align: center; white-space: nowrap;">
                <button onclick="event.stopPropagation(); openHistoryModal('${escapedTown}', '${escapedStreet}')" class="btn-icon-history" title="Előzmények megtekintése" style="background: #e0f2fe; color: #0284c7; border: 1.5px solid #0284c7; border-radius: 8px; padding: 6px 14px; font-size: 16px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; min-width: 42px; min-height: 42px; box-shadow: 0 2px 6px rgba(0,0,0,0.15); transition: all 0.2s ease;">📜</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    updateMonthlyProgressSummaryWeb();
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
    const allStreets = streetMapData[settlement] || ["1. sz. Helyszín", "2. sz. Helyszín"];

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

    const fixedDocId = `elec_${settlement}_${street}`.replace(/\s+/g, '_').replace(/\./g, '_').replace(/\//g, '_');
    const newRecord = {
        id: fixedDocId,
        settlementName: settlement,
        meterName: street,
        dayKwh: dayKwh,
        dateString: dateString,
        userEmail: getLoggedInAdminEmail(),
        userName: userName,
        note: '',
        timestamp: Date.now()
    };

    const existingIdx = electricityReadings.findIndex(r => r.id === fixedDocId);
    if (existingIdx >= 0) {
        newRecord.prevDayKwh = electricityReadings[existingIdx].prevDayKwh;
        electricityReadings[existingIdx] = newRecord;
    } else {
        electricityReadings.unshift(newRecord);
    }
    renderTable();

    if (typeof firebase !== 'undefined') {
        try {
            const db = firebase.firestore();
            db.collection("electricity_readings").doc(fixedDocId).set(newRecord, { merge: true })
                .then(() => console.log("Új villanyóra leolvasás elmentve Firestore-ba!"))
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

let currentHistoryTown = '';
let currentHistoryStreet = '';

function populateHistoryYearDropdown() {
    const yearSelect = document.getElementById('historyYearFilter');
    if (!yearSelect) return;

    const currentYear = new Date().getFullYear();
    const yearsSet = new Set();

    // Default range around current year (e.g. 2020..2035)
    for (let y = currentYear + 5; y >= 2020; y--) {
        yearsSet.add(y.toString());
    }

    // Add any year found in history records
    electricityReadings.forEach(item => {
        if (item.dateString && item.dateString.includes('.')) {
            const yr = item.dateString.split('.')[0].trim();
            if (yr && yr.length === 4) yearsSet.add(yr);
        } else if (item.timestamp) {
            const yr = new Date(item.timestamp).getFullYear().toString();
            if (yr && yr.length === 4) yearsSet.add(yr);
        }
    });

    const sortedYears = Array.from(yearsSet).sort((a, b) => Number(b) - Number(a));

    const selectedVal = yearSelect.value || 'ALL';
    yearSelect.innerHTML = '<option value="ALL">Minden Év</option>';

    sortedYears.forEach(yr => {
        const opt = document.createElement('option');
        opt.value = yr;
        opt.textContent = yr;
        if (yr === selectedVal) opt.selected = true;
        yearSelect.appendChild(opt);
    });
}

function triggerCalendarPicker() {
    const picker = document.getElementById('historyCalendarPicker');
    if (picker) {
        if (typeof picker.showPicker === 'function') {
            picker.showPicker();
        } else {
            picker.click();
        }
    }
}

function onCalendarDatePicked(val) {
    if (!val) return;
    const parts = val.split('-');
    if (parts.length >= 1) {
        const pickedYear = parts[0];
        const yearSelect = document.getElementById('historyYearFilter');
        if (yearSelect) {
            let exists = Array.from(yearSelect.options).some(opt => opt.value === pickedYear);
            if (!exists) {
                const opt = document.createElement('option');
                opt.value = pickedYear;
                opt.textContent = pickedYear;
                yearSelect.appendChild(opt);
            }
            yearSelect.value = pickedYear;
        }
    }
    if (parts.length >= 2) {
        const pickedMonth = parts[1].padStart(2, '0');
        const monthSelect = document.getElementById('historyMonthFilter');
        if (monthSelect) {
            monthSelect.value = pickedMonth;
        }
    }
    filterHistoryModalByDate();
}

function openHistoryModal(town, street) {
    currentHistoryTown = town;
    currentHistoryStreet = street;
    const subtitleEl = document.getElementById('historyModalSubtitle');
    if (subtitleEl) subtitleEl.textContent = `${town} • ${street}`;

    populateHistoryYearDropdown();

    // Reset date filter dropdowns to ALL on opening
    const yearSelect = document.getElementById('historyYearFilter');
    const monthSelect = document.getElementById('historyMonthFilter');
    if (yearSelect) yearSelect.value = 'ALL';
    if (monthSelect) monthSelect.value = 'ALL';

    filterHistoryModalByDate();

    const modal = document.getElementById('historyModal');
    if (modal) modal.style.display = 'flex';
}

function filterHistoryModalByDate() {
    const town = currentHistoryTown;
    const street = currentHistoryStreet;
    const tbody = document.getElementById('historyModalTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const yearFilter = document.getElementById('historyYearFilter') ? document.getElementById('historyYearFilter').value : 'ALL';
    const monthFilter = document.getElementById('historyMonthFilter') ? document.getElementById('historyMonthFilter').value : 'ALL';

    const normTown = normalizeStreetName(town);
    const normStreet = normalizeStreetName(street);

    // ONLY fetch archived rolled-over documents starting with hist_
    const rawList = electricityReadings.filter(r =>
        r.id.startsWith("hist_") &&
        normalizeStreetName(r.settlementName) === normTown &&
        normalizeStreetName(r.meterName) === normStreet &&
        ((r.dayKwh && r.dayKwh > 0) || (r.prevDayKwh && r.prevDayKwh > 0))
    ).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    const historyList = [];

    rawList.forEach(item => {
        const displayKwhVal = (item.dayKwh && item.dayKwh > 0) ? item.dayKwh : item.prevDayKwh;
        historyList.push({ ...item, displayKwh: displayKwhVal });
    });

    // Apply Year and Month filtering based on submission date
    const filteredList = historyList.filter(item => {
        const dateStr = item.dateString || '';
        let itemYear = '';
        let itemMonth = '';

        if (dateStr.includes('.')) {
            const parts = dateStr.split('.').map(p => p.trim()).filter(p => p.length > 0);
            if (parts.length >= 1) itemYear = parts[0];
            if (parts.length >= 2) itemMonth = parts[1].padStart(2, '0');
        } else if (item.timestamp) {
            const d = new Date(item.timestamp);
            itemYear = d.getFullYear().toString();
            itemMonth = (d.getMonth() + 1).toString().padStart(2, '0');
        }

        const matchYear = (yearFilter === 'ALL') || (itemYear === yearFilter);
        const matchMonth = (monthFilter === 'ALL') || (itemMonth === monthFilter);

        return matchYear && matchMonth;
    });

    if (filteredList.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="5" style="text-align: center; color: #64748b; padding: 16px;">Még nincs elmentett előzmény adat a kiválasztott év/hónap szűrésre ehhez az utcához.</td>`;
        tbody.appendChild(tr);
    } else {
        filteredList.forEach(item => {
            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            tr.style.borderBottom = '1px solid #1e293b';
            tr.title = 'Dupla kattintással szerkesztheted az adatokat | Nyomvatartással húzhatod fel-le a sorrend megváltoztatásához!';
            tr.ondblclick = () => {
                openEditHistoryRecordModal(item.id, item.dateString, item.displayKwh, item.userName, item.note, town, street);
            };
            const escapedTown = (town || '').replace(/'/g, "\\'");
            const escapedStreet = (street || '').replace(/'/g, "\\'");
            tr.innerHTML = `
                <td style="padding: 12px; font-weight: bold; color: #f8fafc;">${item.dateString || '2026. 11. 11.'}</td>
                <td style="padding: 12px; font-weight: bold; color: #38bdf8;">${item.displayKwh > 0 ? Math.round(item.displayKwh) + ' kWh' : '-'}</td>
                <td style="padding: 12px; font-weight: 600; color: #e2e8f0;">${item.userName || 'Rendszer'}</td>
                <td style="padding: 12px; color: #94a3b8;">${item.note || '-'}</td>
                <td style="padding: 12px; text-align: center;">
                    <button onclick="event.stopPropagation(); deleteSingleHistoryRecord('${item.id}', '${escapedTown}', '${escapedStreet}')" class="btn-delete-hist" title="Törlés" style="background: rgba(239, 68, 68, 0.15); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 6px; padding: 4px 10px; font-size: 12px; cursor: pointer; font-weight: bold;">🗑 Törlés</button>
                </td>
            `;

            tbody.appendChild(tr);
        });
    }
}

function deleteSingleHistoryRecord(recordId, town, street) {
    // 1. Immediately remove ONLY the selected record by recordId from local memory (0ms delay!)
    electricityReadings = electricityReadings.filter(r => r.id !== recordId);

    // 2. Instantly update open history modal and main table
    openHistoryModal(town, street);
    renderTable();

    // 3. Delete ONLY the selected document ID from Cloud Firestore in background
    if (typeof firebase !== 'undefined') {
        try {
            const db = firebase.firestore();
            db.collection("electricity_readings").doc(recordId).delete()
                .then(() => console.log("Sikeresen törölve a Firestore-ból:", recordId))
                .catch(e => console.error("Hiba a törlésnél:", e));
        } catch (e) {
            console.error("Firebase error:", e);
        }
    }
}

function openAddHistoricalRecordModal() {
    if (!currentHistoryTown || !currentHistoryStreet) return;

    const subEl = document.getElementById('addHistoryRecordSubtitle');
    if (subEl) subEl.textContent = `${currentHistoryTown} • ${currentHistoryStreet}`;

    const kwhEl = document.getElementById('addHistoryKwh');
    const dateEl = document.getElementById('addHistoryDateString');
    const userEl = document.getElementById('addHistoryUserName');
    const noteEl = document.getElementById('addHistoryNote');

    if (kwhEl) kwhEl.value = '';
    if (dateEl) dateEl.value = new Date().toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '. ');
    if (userEl) userEl.value = getLoggedInAdminName();
    if (noteEl) noteEl.value = '';

    const modal = document.getElementById('addHistoryRecordModal');
    if (modal) modal.style.display = 'flex';
}

function closeAddHistoryRecordModal() {
    const modal = document.getElementById('addHistoryRecordModal');
    if (modal) modal.style.display = 'none';
}

function saveNewHistoricalRecordFromWeb() {
    if (!currentHistoryTown || !currentHistoryStreet) return;

    const kwhVal = document.getElementById('addHistoryKwh') ? document.getElementById('addHistoryKwh').value.trim() : '';
    const dateStr = document.getElementById('addHistoryDateString') ? document.getElementById('addHistoryDateString').value.trim() : '';
    const userName = document.getElementById('addHistoryUserName') ? document.getElementById('addHistoryUserName').value.trim() : getLoggedInAdminName();
    const noteText = document.getElementById('addHistoryNote') ? document.getElementById('addHistoryNote').value.trim() : '';

    const numKwh = kwhVal !== '' ? Number(kwhVal) : 0;
    if (isNaN(numKwh) || numKwh <= 0) {
        alert("Kérjük adj meg egy érvényes leolvasott óraállást!");
        return;
    }

    const timestampNow = Date.now();
    const archiveId = `hist_${currentHistoryTown}_${currentHistoryStreet}_${timestampNow}`.replace(/\s+/g, '_').replace(/\./g, '_').replace(/\//g, '_');

    const archivePayload = {
        id: archiveId,
        settlementName: currentHistoryTown,
        meterName: currentHistoryStreet,
        dayKwh: 0,
        prevDayKwh: numKwh,
        dateString: dateStr,
        userName: userName,
        userEmail: getLoggedInAdminEmail(),
        note: noteText,
        timestamp: timestampNow
    };

    electricityReadings.unshift(archivePayload);

    if (typeof firebase !== 'undefined') {
        try {
            const db = firebase.firestore();
            db.collection("electricity_readings").doc(archiveId).set(archivePayload, { merge: true });
        } catch (e) {}
    }

    closeAddHistoryRecordModal();
    openHistoryModal(currentHistoryTown, currentHistoryStreet);
    renderTable();
    alert("➕ Sikeresen hozzáadva az új korábbi előzmény leolvasás!");
}

function deleteAllHistoryForCurrentStreet() {
    if (!currentHistoryTown || !currentHistoryStreet) return;
    if (!confirm(`Biztosan törölni szeretnéd a(z) ${currentHistoryTown} • ${currentHistoryStreet} ÖSSZES elmentett előzményét 1 kattintással?`)) return;

    const normTown = normalizeStreetName(currentHistoryTown);
    const normStreet = normalizeStreetName(currentHistoryStreet);

    const historyDocs = electricityReadings.filter(r =>
        normalizeStreetName(r.settlementName) === normTown &&
        normalizeStreetName(r.meterName) === normStreet &&
        (r.id.startsWith("hist_") || (r.id !== `elec_${currentHistoryTown}_${currentHistoryStreet}`.replace(/\s+/g, '_').replace(/\./g, '_').replace(/\//g, '_') && !r.id.startsWith("elec_")))
    );

    const idsToDelete = historyDocs.map(r => r.id);

    electricityReadings = electricityReadings.filter(r => !idsToDelete.includes(r.id));

    if (typeof firebase !== 'undefined') {
        try {
            const db = firebase.firestore();
            idsToDelete.forEach(id => {
                db.collection("electricity_readings").doc(id).delete();
            });
        } catch (e) {}
    }

    openHistoryModal(currentHistoryTown, currentHistoryStreet);
    renderTable();
    alert(`🗑 Sikeresen 1 kattintással törölve ${idsToDelete.length} előzmény rekord!`);
}

function deleteAllHistoryRecordsFromAllTowns() {
    if (!confirm("⚠️ Döntő lépés! Biztosan törölni szeretnéd az ÖSSZES TELEPÜLÉS ÖSSZES UTCÁJÁNAK elmentett előzményeit egyetlen kattintással? (Az aktuális havi aktív leolvasás érintetlen marad!)")) return;

    const historyDocs = electricityReadings.filter(r => r.id.startsWith("hist_") || !r.id.startsWith("elec_"));
    const idsToDelete = historyDocs.map(r => r.id);

    electricityReadings = electricityReadings.filter(r => r.id.startsWith("elec_"));

    if (typeof firebase !== 'undefined') {
        try {
            const db = firebase.firestore();
            let batch = db.batch();
            let count = 0;

            idsToDelete.forEach(id => {
                const ref = db.collection("electricity_readings").doc(id);
                batch.delete(ref);
                count++;
                if (count >= 400) {
                    batch.commit();
                    batch = db.batch();
                    count = 0;
                }
            });

            if (count > 0) {
                batch.commit();
            }
        } catch (e) {}
    }

    renderTable();
    if (document.getElementById('historyModal')) {
        document.getElementById('historyModal').style.display = 'none';
    }
    alert(`🗑 Sikeresen törölve az ÖSSZES TELEPÜLÉS ÖSSZES UTCÁJÁNAK előzménye (${idsToDelete.length} rekord)!`);
}

function resetAllMeterReadingsToZero() {
    if (!confirm("⚠️ Tiszta Indulás! Biztosan ki szeretnéd törölni az ÖSSZES tesztadatot és nullázni szeretnéd az összes utcát a felhőben?")) return;

    if (typeof firebase !== 'undefined') {
        try {
            const db = firebase.firestore();
            db.collection("electricity_readings").get().then((snapshot) => {
                let batch = db.batch();
                let count = 0;
                snapshot.forEach((doc) => {
                    batch.delete(doc.ref);
                    count++;
                    if (count >= 400) {
                        batch.commit();
                        batch = db.batch();
                        count = 0;
                    }
                });
                if (count > 0) {
                    batch.commit();
                }
                electricityReadings = [];
                renderTable();
                alert("🧹 Sikeresen 100%-ban kitakarítva az összes tesztadat a Firebase adatbázisból!");
            });
        } catch (e) {
            console.error(e);
        }
    }
}

function generateRandomReadingsForAllStreets() {
    const dateStr = new Date().toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '. ');
    const timestampNow = Date.now();

    Object.keys(streetMapData).forEach(town => {
        const streets = streetMapData[town] || [];
        streets.forEach(street => {
            const normTown = normalizeStreetName(town);
            const normStreet = normalizeStreetName(street);
            const random4Digit = Math.floor(1000 + Math.random() * 9000);
            const fixedDocId = `elec_${town}_${street}`.replace(/\s+/g, '_').replace(/\./g, '_').replace(/\//g, '_');

            const existing = electricityReadings.find(r => r.id === fixedDocId || (normalizeStreetName(r.settlementName) === normTown && normalizeStreetName(r.meterName) === normStreet));
            const basePrev = (existing && existing.prevDayKwh && existing.prevDayKwh > 0) ? existing.prevDayKwh : 0;

            const payload = {
                id: fixedDocId,
                settlementName: town,
                meterName: street,
                dayKwh: random4Digit,
                prevDayKwh: basePrev,
                dateString: dateStr,
                userName: getLoggedInAdminName(),
                userEmail: getLoggedInAdminEmail(),
                timestamp: timestampNow
            };

            const idx = electricityReadings.findIndex(r => r.id === fixedDocId);
            if (idx >= 0) {
                electricityReadings[idx].dayKwh = random4Digit;
                electricityReadings[idx].prevDayKwh = basePrev;
                electricityReadings[idx].dateString = dateStr;
                electricityReadings[idx].timestamp = timestampNow;
            } else {
                electricityReadings.unshift(payload);
            }

            if (typeof firebase !== 'undefined') {
                try {
                    const db = firebase.firestore();
                    db.collection("electricity_readings").doc(fixedDocId).set(payload, { merge: true });
                } catch (e) {}
            }
        });
    });

    renderTable();
    alert("🎲 Sikeresen feltöltve véletlenszerű 4-jegyű leolvasási adatokkal minden település összes utcája!");
}

function simulate5thRollover() {
    if (!confirm("Biztosan végrehajtod a havi zárást? Az aktuális óraállások átkerülnek az Előző Óraállás oszlopba és az előzményekbe, majd megkezdődik az új leolvasási ciklus.")) {
        return;
    }

    const dateStr = new Date().toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '. ');
    let rolledCount = 0;

    Object.keys(streetMapData).forEach(town => {
        const streets = streetMapData[town] || [];
        streets.forEach(street => {
            const normTown = normalizeStreetName(town);
            const normStreet = normalizeStreetName(street);

            const fixedDocId = `elec_${town}_${street}`.replace(/\s+/g, '_').replace(/\./g, '_').replace(/\//g, '_');
            const sameMeterReadings = electricityReadings.filter(r =>
                normalizeStreetName(r.settlementName) === normTown &&
                normalizeStreetName(r.meterName) === normStreet
            ).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

            const primaryReading = sameMeterReadings.find(r => r.id === fixedDocId || !r.id.startsWith("hist_")) || sameMeterReadings.find(r => r.dayKwh && r.dayKwh > 0) || null;
            const dayVal = primaryReading ? primaryReading.dayKwh : null;

            // Strict check: ONLY process meters that have a valid positive current reading (dayKwh > 0)
            if (primaryReading && dayVal !== null && dayVal !== undefined && !isNaN(Number(dayVal)) && Number(dayVal) > 0) {
                rolledCount++;
                const currentReadingVal = Number(dayVal);
                const currentPrevVal = (primaryReading.prevDayKwh && primaryReading.prevDayKwh > 0) ? primaryReading.prevDayKwh : null;
                const timestampNow = Date.now();
                const archiveId = `hist_${town}_${street}_${timestampNow}`.replace(/\s+/g, '_').replace(/\./g, '_').replace(/\//g, '_');

                const archivePayload = {
                    id: archiveId,
                    settlementName: town,
                    meterName: street,
                    dayKwh: currentReadingVal,
                    prevDayKwh: currentPrevVal,
                    dateString: primaryReading.dateString || dateStr,
                    userName: primaryReading.userName || getLoggedInAdminName(),
                    userEmail: primaryReading.userEmail || getLoggedInAdminEmail(),
                    note: primaryReading.note || '',
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
    alert(`Sikeresen lefutott a havi zárás ${rolledCount} átemelőnél! Az értékek átkerültek az 'Előző Óraállás' oszlopba, bekerültek az Előzményekbe, és megkezdődött az új leolvasási ciklus!`);
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

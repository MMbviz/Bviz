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
    const secElec = document.getElementById('electricitySection');
    const secClean = document.getElementById('cleaningSection');

    if (tabName === 'cleaning') {
        if (tabElec) tabElec.classList.remove('active');
        if (tabClean) tabClean.classList.add('active');
        if (secElec) secElec.style.display = 'none';
        if (secClean) secClean.style.display = 'block';
        renderCleaningTable();
    } else {
        if (tabElec) tabElec.classList.add('active');
        if (tabClean) tabClean.classList.remove('active');
        if (secElec) secElec.style.display = 'block';
        if (secClean) secClean.style.display = 'none';
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

function renderCleaningTable() {
    const tbody = document.getElementById('cleaningTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const sortedDesc = [...cleaningRecords].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    if (sortedDesc.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="6" style="text-align: center; color: #666; padding: 24px; font-size: 14px;">Még nincs rögzített takarítási adat. Hozz létre egyet az applikáció 🚛 Takarítás fülén!</td>`;
        tbody.appendChild(row);
        return;
    }

    sortedDesc.forEach((item) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${item.dateString}</strong></td>
            <td><span style="background: #e8f5e9; padding: 4px 8px; border-radius: 4px; font-weight: bold; color: #1b5e20;">🚛 ${item.settlementName || 'Apaj'}</span></td>
            <td><strong>${item.streetName || 'Helyszín'}</strong></td>
            <td><strong style="color: #1b5e20;">👤 ${item.userName || 'Mizsei Márk'}</strong></td>
            <td>${item.note || '-'}</td>
            <td style="text-align: center;">
                <button onclick="deleteCleaningRecordFromWeb('${item.id}')" style="background: #ffebee; border: 1px solid #ef5350; color: #c62828; padding: 5px 10px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: bold;" title="Törlés">
                    🗑 Törlés
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
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

function exportCleaningToExcel() {
    if (cleaningRecords.length === 0) {
        alert("Nincs letölthető takarítási adat!");
        return;
    }

    const sortedDesc = [...cleaningRecords].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

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
    const fileName = `Bviz_Takaritasi_Nyilvantartas_${dateStr}.csv`;

    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function initDashboard() {
    renderTable();
    renderCleaningTable();

    // Connect to Firebase Web SDK onSnapshot for real-time live WebSockets updates
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

        } catch (e) {
            console.warn("Firebase initialization warning:", e);
            fetchElectricityReadingsFromRest();
            fetchCleaningRecordsFromRest();
        }
    } else {
        fetchElectricityReadingsFromRest();
        fetchCleaningRecordsFromRest();
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

    // Sort chronologically ascending by date and timestamp, then reverse for newest at top
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
                <button onclick="openEditModal('${item.id}')" style="background: #e3f2fd; border: 1px solid #64b5f6; color: #1565c0; padding: 5px 10px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: bold; margin-right: 4px;" title="Szerkesztés">
                    ✏️ Szerkesztés
                </button>
                <button onclick="deleteReadingFromWeb('${item.id}')" style="background: #ffebee; border: 1px solid #ef5350; color: #c62828; padding: 5px 10px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: bold;" title="Adat törlése">
                    🗑 Törlés
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

document.addEventListener('DOMContentLoaded', checkWebSession);

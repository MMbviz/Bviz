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
    { id: '1', settlementName: 'Apaj', meterName: 'I. számú Dobó I. u. vezérlőszekrény', dayKwh: 9085, dateString: '2026. 11. 08.', timestamp: 1000, userEmail: 'mizsei92@freemail.hu', userName: 'Mizsei Márk', note: '' },
    { id: '2', settlementName: 'Apaj', meterName: 'II. számú Dobó I. u. vezérlőszekrény', dayKwh: 46184, dateString: '2026. 11. 08.', timestamp: 1001, userEmail: 'mizsei92@freemail.hu', userName: 'Mizsei Márk', note: '' },
    { id: '3', settlementName: 'Apaj', meterName: 'III. számú Tópart u. vezérlőszekrény', dayKwh: 5761, dateString: '2026. 11. 08.', timestamp: 1002, userEmail: 'mizsei92@freemail.hu', userName: 'Mizsei Márk', note: '' }
];

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
    const filtered = plantFilter === 'ALL' ? electricityReadings : electricityReadings.filter(r => r.settlementName === plantFilter);

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
    csvContent += "Leolvasás Dátuma;Város / Település;Utca / Vezérlőszekrény;Óraállás (kWh);Fogyasztási Különbség (kWh);Rögzítő Neve;Megjegyzés\n";

    sortedDesc.forEach((item) => {
        const sameMeterReadings = sortedAsc.filter(r => r.settlementName === item.settlementName && r.meterName === item.meterName);
        const itemIdx = sameMeterReadings.findIndex(r => r.id === item.id);
        const prev = itemIdx > 0 ? sameMeterReadings[itemIdx - 1] : null;

        const diffKwh = prev ? (item.dayKwh - prev.dayKwh) : null;
        const diffText = diffKwh !== null ? (diffKwh >= 0 ? '+' + diffKwh.toFixed(0) : diffKwh.toFixed(0)) : '0';

        const line = [
            `"${item.dateString}"`,
            `"${item.settlementName || 'Apaj'}"`,
            `"${item.meterName || 'Vezérlőszekrény'}"`,
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

function initDashboard() {
    renderTable();

    // Connect to Google Firebase Cloud Firestore for real-time live data sync
    if (typeof firebase !== 'undefined') {
        try {
            firebase.initializeApp(firebaseConfig);
            const db = firebase.firestore();

            db.collection("electricity_readings").onSnapshot((snapshot) => {
                const cloudList = [];
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    const rawEmail = (data.userEmail || "").trim().lowercase();
                    const rawName = (data.userName || "").trim();

                    let displayName = "";

                    if (rawName && !rawName.includes("@") && rawName.includes(" ")) {
                        displayName = rawName;
                    } else if (rawEmail.includes("mizsei") || rawName.toLowerCase().includes("mizse")) {
                        displayName = "Mizsei Márk";
                    } else if (rawEmail.includes("ori") || rawName.toLowerCase().includes("őri") || rawName.toLowerCase().includes("ori")) {
                        displayName = "Őri Csaba";
                    } else if (rawEmail.includes("peter") || rawName.toLowerCase().includes("kovács")) {
                        displayName = "Kovács Péter";
                    } else if (rawName && !rawName.includes("@") && !rawName.includes("mizse") && !rawName.includes("kiskukac")) {
                        displayName = rawName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                    } else {
                        displayName = "Mizsei Márk";
                    }

                    cloudList.push({
                        id: doc.id,
                        settlementName: data.settlementName || "Apaj",
                        meterName: data.meterName || "I. számú Dobó I. u.",
                        dateString: data.dateString || "",
                        timestamp: Number(data.timestamp) || 0,
                        dayKwh: Number(data.dayKwh) || 0,
                        userEmail: rawEmail,
                        userName: displayName,
                        note: data.note || ""
                    });
                });
                if (cloudList.length > 0) {
                    electricityReadings = cloudList;
                    renderTable();
                }
            }, (error) => {
                console.warn("Firestore electricity_readings snapshot warning:", error);
            });
        } catch (e) {
            console.warn("Firebase initialization warning:", e);
        }
    }
}

function renderTable() {
    const tbody = document.getElementById('readingsTableBody');
    const plantFilter = document.getElementById('plantFilter') ? document.getElementById('plantFilter').value : 'ALL';
    if (!tbody) return;
    tbody.innerHTML = '';

    const filtered = plantFilter === 'ALL' ? electricityReadings : electricityReadings.filter(r => r.settlementName === plantFilter);

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
        const sameMeterReadings = sortedAsc.filter(r => r.settlementName === item.settlementName && r.meterName === item.meterName);
        const itemIdx = sameMeterReadings.findIndex(r => r.id === item.id);
        const prev = itemIdx > 0 ? sameMeterReadings[itemIdx - 1] : null;

        const diffKwh = prev ? (item.dayKwh - prev.dayKwh) : null;
        const diffText = diffKwh !== null ? (diffKwh >= 0 ? '+' + diffKwh.toFixed(0) + ' kWh' : diffKwh.toFixed(0) + ' kWh') : '-';
        const isPos = diffKwh === null || diffKwh >= 0;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${item.dateString}</strong></td>
            <td><span style="background: #e8f5e9; padding: 4px 8px; border-radius: 4px; font-weight: bold; color: #1b5e20;">⚡ ${item.settlementName || 'Apaj'}</span></td>
            <td><strong>${item.meterName || 'Vezérlőszekrény'}</strong></td>
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

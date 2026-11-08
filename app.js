// Firebase Configuration for Bviz
const firebaseConfig = {
    apiKey: "AIzaSyB-EGb76xU3GK68ZTDE-Mw7nw1iA6uB4DA",
    authDomain: "bviz-1cf84.firebaseapp.com",
    projectId: "bviz-1cf84",
    storageBucket: "bviz-1cf84.firebasestorage.app",
    messagingSenderId: "1076211077079",
    appId: "1:1076211077079:web:bviz"
};

let readings = [
    { id: '1', plantName: 'Kunszentmiklós', dateString: '2026. 11. 08.', coldWaterM3: 152898.0, hotWaterM3: 6065689.0, dailyTempC: 14.0, sewageTempC: 18.5, weatherCondition: 'Napos ☀️', userEmail: 'mizsei92@freemail.hu', userName: 'Mizsei Márk', note: 'Napi leolvasás' },
    { id: '2', plantName: 'Kunszentmiklós', dateString: '2026. 11. 08.', coldWaterM3: 123.0, hotWaterM3: 456.0, dailyTempC: 10.0, sewageTempC: 30.0, weatherCondition: 'Napos ☀️', userEmail: 'mizsei92@freemail.hu', userName: 'Mizsei Márk', note: 'Napi leolvasás' },
    { id: '3', plantName: 'Szabadszállás', dateString: '2026. 11. 08.', coldWaterM3: 89400.0, hotWaterM3: 341200.0, dailyTempC: 13.5, sewageTempC: 17.8, weatherCondition: 'Borús ☁️', userEmail: 'mizsei92@freemail.hu', userName: 'Mizsei Márk', note: 'Napi leolvasás' }
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

function initDashboard() {
    renderTable();

    // Connect to Google Firebase Cloud Firestore for real-time live data sync
    if (typeof firebase !== 'undefined') {
        try {
            firebase.initializeApp(firebaseConfig);
            const db = firebase.firestore();

            db.collection("readings").onSnapshot((snapshot) => {
                const cloudList = [];
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    const rawEmail = (data.userEmail || "").trim().toLowerCase();
                    const rawName = (data.userName || "").trim();

                    let displayName = "";

                    // Clean full name resolution (Vezetéknév + Keresztnév)
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
                        plantName: data.plantName || "Kunszentmiklós",
                        dateString: data.dateString || "",
                        coldWaterM3: Number(data.coldWaterM3) || 0,
                        hotWaterM3: Number(data.hotWaterM3) || 0,
                        dailyTempC: Number(data.dailyTempC) || 0,
                        sewageTempC: Number(data.sewageTempC) || 0,
                        weatherCondition: data.weatherCondition || "",
                        userEmail: rawEmail,
                        userName: displayName,
                        note: data.note || ""
                    });
                });
                if (cloudList.length > 0) {
                    readings = cloudList;
                    renderTable();
                }
            }, (error) => {
                console.warn("Firestore snapshot warning:", error);
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

    const filtered = plantFilter === 'ALL' ? readings : readings.filter(r => r.plantName === plantFilter);

    const sortedAsc = [...filtered].sort((a, b) => a.dateString.localeCompare(b.dateString));
    const sortedDesc = [...sortedAsc].reverse();

    if (sortedDesc.length > 0) {
        const latest = sortedDesc[0];
        const totalColdElem = document.getElementById('totalCold');
        const totalHotElem = document.getElementById('totalHot');
        if (totalColdElem) totalColdElem.innerText = `${latest.coldWaterM3.toFixed(1)} m³`;
        if (totalHotElem) totalHotElem.innerText = `${latest.hotWaterM3.toFixed(1)} kW`;
    }

    sortedDesc.forEach((item) => {
        const itemIdx = sortedAsc.findIndex(r => r.id === item.id);
        const prev = itemIdx > 0 ? sortedAsc[itemIdx - 1] : null;

        const diffCold = prev ? (item.coldWaterM3 - prev.coldWaterM3).toFixed(1) : '-';
        const diffHot = prev ? (item.hotWaterM3 - prev.hotWaterM3).toFixed(1) : '-';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${item.dateString}</strong></td>
            <td><span style="background: #e8f5e9; padding: 4px 8px; border-radius: 4px; font-weight: bold; color: #2e7d32;">${item.plantName || 'Kunszentmiklós'}</span></td>
            <td>${item.coldWaterM3.toFixed(1)} m³</td>
            <td class="${diffCold !== '-' && diffCold >= 0 ? 'badge-plus' : ''}">${diffCold !== '-' ? '+' + diffCold + ' m³' : '-'}</td>
            <td>${item.hotWaterM3.toFixed(1)} kW</td>
            <td class="${diffHot !== '-' && diffHot >= 0 ? 'badge-plus' : ''}">${diffHot !== '-' ? '+' + diffHot + ' kW' : '-'}</td>
            <td>${item.weatherCondition || ''} | Napi: ${item.dailyTempC || 14}°C / Szennyvíz: ${item.sewageTempC || 18}°C</td>
            <td><strong style="color: #1b5e20;">👤 ${item.userName || 'Mizsei Márk'}</strong></td>
            <td>${item.note || '-'}</td>
        `;
        tbody.appendChild(row);
    });
}

document.addEventListener('DOMContentLoaded', checkWebSession);

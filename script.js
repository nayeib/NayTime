// State Management
let appData = {
    months: {},
    activeMonth: "" // Formato: "YYYY-MM"
};

// Default Services Template by Day of Week (0 = Domingo, 1 = Lunes, etc.)
const defaultServicesByDay = {
    0: [{ start: "12:00", end: "16:30" }, { start: "19:30", end: "24:00" }], // Domingo
    1: [], // Lunes
    2: [{ start: "19:00", end: "24:00" }], // Martes
    3: [{ start: "12:00", end: "16:00" }, { start: "19:30", end: "24:00" }], // Miércoles
    4: [{ start: "12:00", end: "16:00" }, { start: "19:30", end: "24:00" }], // Jueves
    5: [{ start: "12:00", end: "16:00" }, { start: "19:30", end: "24:00" }], // Viernes
    6: [{ start: "12:00", end: "16:30" }, { start: "19:00", end: "24:00" }]  // Sábado
};

const weekDaysNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const fullMonthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

// Active state for Picker
let pickerState = {
    rowId: null,
    serviceIndex: null,
    activeTab: 'entrada', // 'entrada' | 'salida'
    originalStart: "",
    originalEnd: "",
    currentStart: "",
    currentEnd: ""
};

let dayPickerState = {
    rowId: null,
    originalDate: null,
    currentDate: null
};

// Initialize App
window.addEventListener('DOMContentLoaded', () => {
    loadData();
    initDOMEvents();
    renderTabs();
    renderSchedule();
    scrollToTodayOrClosest();
});

// Load / Save Data
function loadData() {
    const saved = localStorage.getItem('horarios_pro_data');
    if (saved) {
        try {
            appData = JSON.parse(saved);
        } catch (e) {
            console.error("Error loading localStorage", e);
        }
    }
    
    // Set active month if empty
    if (!appData.activeMonth || !appData.months[appData.activeMonth]) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        appData.activeMonth = `${year}-${month}`;
        
        // If active month doesn't exist, create it with default values
        if (!appData.months[appData.activeMonth]) {
            generateDefaultMonth(appData.activeMonth);
        }
    }
}

function saveLocalStorage() {
    localStorage.setItem('horarios_pro_data', JSON.stringify(appData));
}

// Generate Default Month based on template
function generateDefaultMonth(monthKey) {
    const [year, month] = monthKey.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const rows = [];

    // Let's populate some initial days (e.g. from current date - 7 days to +7 days, or first few days)
    // To avoid cluttering but show content, let's prefill days 17 to 23 of August 2026 as example:
    const daysToPrefill = [18, 19, 20, 21, 22, 23];
    daysToPrefill.forEach((d, idx) => {
        const dateObj = new Date(year, month - 1, d);
        const dayOfWeek = dateObj.getDay();
        
        // Clone default services
        const services = JSON.parse(JSON.stringify(defaultServicesByDay[dayOfWeek]));
        
        rows.push({
            id: generateId(),
            date: d,
            services: services
        });
    });

    appData.months[monthKey] = rows;
    saveLocalStorage();
}

function generateId() {
    return '_' + Math.random().toString(36).substr(2, 9);
}

// Get Weekday Name
function getWeekdayName(year, month, date) {
    const dateObj = new Date(year, month - 1, date);
    return weekDaysNames[dateObj.getDay()];
}

// DOM Events binding
function initDOMEvents() {
    document.getElementById('add-month-btn').addEventListener('click', createNewMonth);
    document.getElementById('add-day-btn').addEventListener('click', addNewDay);
    
    // Month Dropdown Toggle logic
    const selectorBtn = document.getElementById('month-selector-btn');
    const dropdown = document.getElementById('month-dropdown');
    selectorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('active');
        selectorBtn.parentElement.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!selectorBtn.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('active');
            selectorBtn.parentElement.classList.remove('active');
        }
    });

    // Day Picker Confirm Action
    document.getElementById('day-picker-confirm-btn').addEventListener('click', saveDayPicker);
    
    // Time Picker Confirm and Undo Actions
    document.getElementById('picker-confirm-btn').addEventListener('click', saveTimePicker);
    document.getElementById('picker-undo-btn').addEventListener('click', undoTimePickerChanges);

    // Close on click overlay
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                if (overlay.id === 'time-picker-modal') closeTimePicker();
                if (overlay.id === 'day-picker-modal') closeDayPicker();
            }
        });
    });
}

// Render Dropdown List of Months
function renderTabs() {
    const dropdown = document.getElementById('month-dropdown');
    dropdown.innerHTML = '';

    const keys = Object.keys(appData.months).sort();
    
    // Set active month label
    if (appData.activeMonth) {
        const [year, month] = appData.activeMonth.split('-');
        document.getElementById('active-month-label').innerText = `${fullMonthNames[parseInt(month) - 1]} ${year}`;
    }

    keys.forEach(key => {
        const [year, month] = key.split('-');
        const label = `${fullMonthNames[parseInt(month) - 1]} ${year}`;
        
        const item = document.createElement('button');
        item.className = `month-dropdown-item ${key === appData.activeMonth ? 'active' : ''}`;
        item.innerText = label;
        item.addEventListener('click', () => {
            appData.activeMonth = key;
            saveLocalStorage();
            dropdown.classList.remove('active');
            document.getElementById('month-selector-btn').parentElement.classList.remove('active');
            renderTabs();
            renderSchedule();
        });
        dropdown.appendChild(item);
    });
}

// Render Schedule List
function renderSchedule() {
    const container = document.getElementById('schedule-list');
    container.innerHTML = '';

    const currentRows = appData.months[appData.activeMonth] || [];
    
    // Sort rows by date number
    currentRows.sort((a, b) => a.date - b.date);

    let grandTotalMinutes = 0;
    const now = new Date();
    const todayDate = now.getDate();
    const todayMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const isCurrentMonth = todayMonthStr === appData.activeMonth;

    currentRows.forEach(row => {
        const [year, month] = appData.activeMonth.split('-').map(Number);
        const weekday = getWeekdayName(year, month, row.date);
        const isToday = isCurrentMonth && row.date === todayDate;
        
        let rowMinutes = 0;
        const servicesHtml = [];

        row.services.forEach((srv, index) => {
            const mins = calculateServiceMinutes(srv.start, srv.end);
            rowMinutes += mins;
            grandTotalMinutes += mins;
            
            servicesHtml.push(`
                <span class="service-badge" onclick="openTimePicker('${row.id}', ${index})">
                    <span>${srv.start}-${srv.end}</span>
                    <span class="remove-service-btn" onclick="deleteService(event, '${row.id}', ${index})">&times;</span>
                </span>
            `);
        });

        const rowEl = document.createElement('div');
        rowEl.className = `schedule-row ${isToday ? 'is-today' : ''}`;
        rowEl.setAttribute('data-id', row.id);
        rowEl.innerHTML = `
            <div class="day-column" onclick="openDayPicker('${row.id}')">
                <span class="day-label">${row.date} ${weekday.toUpperCase()}</span>
                <span class="day-sub">${isToday ? 'Hoy' : 'Editar fecha'}</span>
            </div>
            <div class="services-container">
                ${servicesHtml.join('')}
                <button class="btn-add-service" onclick="addServiceToRow('${row.id}')">+ Serv</button>
            </div>
            <div class="row-actions">
                <span class="row-hours">${formatMinutes(rowMinutes)}h</span>
                <button class="btn-delete-row" onclick="deleteDayRow('${row.id}')" title="Eliminar Día">🗑️</button>
            </div>
        `;
        container.appendChild(rowEl);
    });

    // Update Sticky totals
    document.getElementById('grand-total-hours').innerText = `${formatMinutes(grandTotalMinutes)}h`;
    document.getElementById('total-days-count').innerText = currentRows.length;
}

function scrollToTodayOrClosest() {
    const currentRows = appData.months[appData.activeMonth] || [];
    if (currentRows.length === 0) return;

    const now = new Date();
    const todayDate = now.getDate();
    const todayMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    // Only scroll if activeMonth matches current calendar month
    if (todayMonthStr !== appData.activeMonth) return;

    const sorted = [...currentRows].sort((a, b) => a.date - b.date);
    let targetRow = null;
    let closestDiff = -Infinity;

    sorted.forEach(row => {
        const diff = row.date - todayDate;
        if (diff === 0) {
            targetRow = row;
        } else if (diff < 0 && diff > closestDiff) {
            closestDiff = diff;
            targetRow = row;
        }
    });

    // Fallback: If no today and no past dates, select the first date
    if (!targetRow && sorted.length > 0) {
        targetRow = sorted[0];
    }

    if (targetRow) {
        setTimeout(() => {
            const el = document.querySelector(`[data-id="${targetRow.id}"]`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 150);
    }
}

// Helpers for calculations
function parseTimeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

function calculateServiceMinutes(start, end) {
    if (!start || !end) return 0;
    let startMin = parseTimeToMinutes(start);
    let endMin = parseTimeToMinutes(end);
    if (endMin < startMin) {
        // En caso de pasar de la medianoche
        endMin += 24 * 60;
    }
    return Math.max(0, endMin - startMin);
}

function formatMinutes(totalMins) {
    const hours = totalMins / 60;
    return hours.toFixed(1);
}

// Actions
function createNewMonth() {
    const keys = Object.keys(appData.months).sort();
    let nextMonthKey = "";
    
    if (keys.length > 0) {
        const latestKey = keys[keys.length - 1];
        let [year, month] = latestKey.split('-').map(Number);
        month++;
        if (month > 12) {
            month = 1;
            year++;
        }
        nextMonthKey = `${year}-${String(month).padStart(2, '0')}`;
    } else {
        const now = new Date();
        nextMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    if (!appData.months[nextMonthKey]) {
        appData.months[nextMonthKey] = [];
        generateDefaultMonth(nextMonthKey);
    }
    
    appData.activeMonth = nextMonthKey;
    saveLocalStorage();
    renderTabs();
    renderSchedule();
}

function addNewDay() {
    const currentRows = appData.months[appData.activeMonth];
    let newDate = 1;
    let newServices = [];

    if (currentRows.length > 0) {
        // Find max date currently
        const maxDate = Math.max(...currentRows.map(r => r.date));
        newDate = maxDate + 1;

        // Copy services from the last day ordered by date
        const sortedRows = [...currentRows].sort((a, b) => a.date - b.date);
        const lastRow = sortedRows[sortedRows.length - 1];
        newServices = JSON.parse(JSON.stringify(lastRow.services));
    }

    // Verify limit of days in month
    const [year, month] = appData.activeMonth.split('-').map(Number);
    const maxDays = new Date(year, month, 0).getDate();
    if (newDate > maxDays) {
        newDate = maxDays;
    }

    const newRow = {
        id: generateId(),
        date: newDate,
        services: newServices.length > 0 ? newServices : [{ start: "12:00", end: "16:00" }]
    };

    currentRows.push(newRow);
    saveLocalStorage();
    renderSchedule();
}

function deleteDayRow(id) {
    if (!confirm("¿Seguro que deseas borrar esta fecha?")) return;
    const currentRows = appData.months[appData.activeMonth];
    appData.months[appData.activeMonth] = currentRows.filter(r => r.id !== id);
    saveLocalStorage();
    renderSchedule();
}

function addServiceToRow(rowId) {
    const currentRows = appData.months[appData.activeMonth];
    const row = currentRows.find(r => r.id === rowId);
    if (!row) return;

    // Default service templates
    let newSrv = { start: "12:00", end: "16:00" };
    if (row.services.length > 0) {
        const lastSrv = row.services[row.services.length - 1];
        // Suggest a time later than the last service
        const endHour = parseInt(lastSrv.end.split(':')[0]);
        const newStartHour = (endHour + 1) % 24;
        const newEndHour = (newStartHour + 4) % 24;
        newSrv = {
            start: `${String(newStartHour).padStart(2, '0')}:00`,
            end: `${String(newEndHour).padStart(2, '0')}:00`
        };
    }
    
    row.services.push(newSrv);
    saveLocalStorage();
    renderSchedule();
}

function deleteService(event, rowId, index) {
    event.stopPropagation(); // Avoid opening picker when tapping delete
    if (!confirm("¿Seguro que deseas quitar este servicio de este día?")) return;
    const currentRows = appData.months[appData.activeMonth];
    const row = currentRows.find(r => r.id === rowId);
    if (!row) return;

    row.services.splice(index, 1);
    saveLocalStorage();
    renderSchedule();
}

// Custom Wheel/Drum UI Picker logic
function populateWheelElements(elementId, min, max, pad = true) {
    const wheel = document.getElementById(elementId);
    wheel.innerHTML = '';
    
    // Add empty space elements at top and bottom for smooth centering/alignment
    const padItem = () => {
        const item = document.createElement('div');
        item.className = 'wheel-item';
        item.style.pointerEvents = 'none';
        return item;
    };
    
    // Two empty padding items at top
    wheel.appendChild(padItem());
    wheel.appendChild(padItem());

    for (let i = min; i <= max; i++) {
        const item = document.createElement('div');
        item.className = 'wheel-item';
        const displayVal = pad ? String(i).padStart(2, '0') : String(i);
        item.innerText = displayVal;
        item.setAttribute('data-val', displayVal);
        wheel.appendChild(item);
    }

    // Two empty padding items at bottom
    wheel.appendChild(padItem());
    wheel.appendChild(padItem());
    
    // Scroll listener for detecting selection
    wheel.addEventListener('scroll', () => {
        clearTimeout(wheel.scrollTimeout);
        wheel.scrollTimeout = setTimeout(() => {
            updateWheelSelection(wheel);
        }, 100);
    });
}

function updateWheelSelection(wheel) {
    const items = wheel.querySelectorAll('.wheel-item:not([style*="pointer-events"])');
    const containerRect = wheel.getBoundingClientRect();
    const centerLine = containerRect.top + containerRect.height / 2;

    let closestItem = null;
    let minDiff = Infinity;

    items.forEach(item => {
        const rect = item.getBoundingClientRect();
        const itemCenter = rect.top + rect.height / 2;
        const diff = Math.abs(centerLine - itemCenter);
        if (diff < minDiff) {
            minDiff = diff;
            closestItem = item;
        }
    });

    if (closestItem) {
        items.forEach(i => i.classList.remove('selected'));
        closestItem.classList.add('selected');
        
        // Trigger event
        if (wheel.id === 'wheel-day-number') {
            onDayWheelChange(parseInt(closestItem.getAttribute('data-val')));
        }

        // Keep pickerState in sync immediately when scrolling
        if (['wheel-in-hours', 'wheel-in-minutes', 'wheel-out-hours', 'wheel-out-minutes'].includes(wheel.id)) {
            readWheelTimes();
        }
    }
}

function setWheelValue(elementId, value) {
    const wheel = document.getElementById(elementId);
    const items = wheel.querySelectorAll('.wheel-item');
    const targetVal = String(value).padStart(2, '0');
    
    let targetIndex = -1;
    let count = 0;
    
    items.forEach((item, index) => {
        if (item.getAttribute('data-val') === targetVal) {
            targetIndex = index;
        }
    });
    
    if (targetIndex !== -1) {
        // Height of each item is 46px
        // We calculate scroll position to center the targetIndex item:
        const wheelHeight = wheel.clientHeight || 180;
        const scrollPosition = (targetIndex * 46 + 23) - (wheelHeight / 2);
        
        wheel.scrollTo({
            top: scrollPosition,
            behavior: 'instant'
        });
        
        items.forEach(i => i.classList.remove('selected'));
        items[targetIndex].classList.add('selected');
    }
}

function getWheelValue(elementId) {
    const wheel = document.getElementById(elementId);
    const selected = wheel.querySelector('.wheel-item.selected');
    return selected ? selected.getAttribute('data-val') : '00';
}

// Day Picker Modal
function openDayPicker(rowId) {
    const currentRows = appData.months[appData.activeMonth];
    const row = currentRows.find(r => r.id === rowId);
    if (!row) return;

    dayPickerState = {
        rowId: rowId,
        originalDate: row.date,
        currentDate: row.date
    };

    const [year, month] = appData.activeMonth.split('-').map(Number);
    const maxDays = new Date(year, month, 0).getDate();

    populateWheelElements('wheel-day-number', 1, maxDays, true);
    document.getElementById('day-picker-modal').classList.add('active');
    
    // Set initial wheel value
    setTimeout(() => {
        setWheelValue('wheel-day-number', row.date);
        onDayWheelChange(row.date);
    }, 50);
}

function closeDayPicker() {
    document.getElementById('day-picker-modal').classList.remove('active');
}

function onDayWheelChange(dateVal) {
    const [year, month] = appData.activeMonth.split('-').map(Number);
    const weekday = getWeekdayName(year, month, dateVal);
    document.getElementById('day-picker-weekday-preview').innerText = `${dateVal} de ${fullMonthNames[month - 1]}, ${weekday}`;
}

function saveDayPicker() {
    const newDate = parseInt(getWheelValue('wheel-day-number'));
    const currentRows = appData.months[appData.activeMonth];
    const row = currentRows.find(r => r.id === dayPickerState.rowId);
    if (row) {
        row.date = newDate;
        saveLocalStorage();
        renderSchedule();
    }
    closeDayPicker();
}

// Time Picker Modal Tabs
function switchPickerTab(tab) {
    pickerState.activeTab = tab;
    
    document.getElementById('tab-entrada-btn').classList.toggle('active', tab === 'entrada');
    document.getElementById('tab-salida-btn').classList.toggle('active', tab === 'salida');
    
    document.getElementById('picker-view-entrada').classList.toggle('active', tab === 'entrada');
    document.getElementById('picker-view-salida').classList.toggle('active', tab === 'salida');

    // Force scroll centering on active wheels after display toggles
    setTimeout(() => {
        if (tab === 'entrada') {
            const [h, m] = pickerState.currentStart.split(':').map(Number);
            setWheelValue('wheel-in-hours', h);
            setWheelValue('wheel-in-minutes', m);
        } else {
            const [h, m] = pickerState.currentEnd.split(':').map(Number);
            setWheelValue('wheel-out-hours', h);
            setWheelValue('wheel-out-minutes', m);
        }
    }, 10);
}

// Time Picker Modal open/close/save
function openTimePicker(rowId, serviceIndex) {
    const currentRows = appData.months[appData.activeMonth];
    const row = currentRows.find(r => r.id === rowId);
    if (!row) return;

    const srv = row.services[serviceIndex];
    if (!srv) return;

    pickerState = {
        rowId: rowId,
        serviceIndex: serviceIndex,
        activeTab: 'entrada',
        originalStart: srv.start,
        originalEnd: srv.end,
        currentStart: srv.start,
        currentEnd: srv.end
    };

    // Populate Time wheels (0-24 hours and 0-59 minutes)
    populateWheelElements('wheel-in-hours', 0, 24, true);
    populateWheelElements('wheel-in-minutes', 0, 59, true);
    populateWheelElements('wheel-out-hours', 0, 24, true);
    populateWheelElements('wheel-out-minutes', 0, 59, true);

    // Open Modal and display tab
    switchPickerTab('entrada');
    document.getElementById('time-picker-modal').classList.add('active');

    // Set values for the wheels
    setTimeout(() => {
        const [inH, inM] = srv.start.split(':').map(Number);
        const [outH, outM] = srv.end.split(':').map(Number);

        setWheelValue('wheel-in-hours', inH);
        setWheelValue('wheel-in-minutes', inM);
        setWheelValue('wheel-out-hours', outH);
        setWheelValue('wheel-out-minutes', outM);
    }, 50);
}

function closeTimePicker() {
    document.getElementById('time-picker-modal').classList.remove('active');
}

function readWheelTimes() {
    // Only update values for the ACTIVE tab to avoid hidden wheels overwriting with (0,0)
    if (pickerState.activeTab === 'entrada') {
        const inH = getWheelValue('wheel-in-hours');
        const inM = getWheelValue('wheel-in-minutes');
        pickerState.currentStart = `${inH}:${inM}`;
    } else {
        const outH = getWheelValue('wheel-out-hours');
        const outM = getWheelValue('wheel-out-minutes');
        pickerState.currentEnd = `${outH}:${outM}`;
    }
}

function saveTimePicker() {
    readWheelTimes();
    const currentRows = appData.months[appData.activeMonth];
    const row = currentRows.find(r => r.id === pickerState.rowId);
    if (row && row.services[pickerState.serviceIndex]) {
        row.services[pickerState.serviceIndex].start = pickerState.currentStart;
        row.services[pickerState.serviceIndex].end = pickerState.currentEnd;
        saveLocalStorage();
        renderSchedule();
    }
    closeTimePicker();
}

function undoTimePickerChanges() {
    // Restore original values to dials and update state
    const [inH, inM] = pickerState.originalStart.split(':').map(Number);
    const [outH, outM] = pickerState.originalEnd.split(':').map(Number);

    pickerState.currentStart = pickerState.originalStart;
    pickerState.currentEnd = pickerState.originalEnd;

    if (pickerState.activeTab === 'entrada') {
        setWheelValue('wheel-in-hours', inH);
        setWheelValue('wheel-in-minutes', inM);
    } else {
        setWheelValue('wheel-out-hours', outH);
        setWheelValue('wheel-out-minutes', outM);
    }
}

function adjustActiveTime(amountMinutes) {
    // Prevent event bubblng or default behavior if triggered
    readWheelTimes(); // Make sure state matches current dials before modifying
    
    if (pickerState.activeTab === 'entrada') {
        const [currentH, currentM] = pickerState.currentStart.split(':').map(Number);
        let totalMins = currentH * 60 + currentM + amountMinutes;
        
        // Wrap around 24 hours
        if (totalMins < 0) totalMins += 24 * 60;
        if (totalMins >= 24 * 60) totalMins -= 24 * 60;
        
        const newH = Math.floor(totalMins / 60);
        const newM = totalMins % 60;
        
        pickerState.currentStart = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
        setWheelValue('wheel-in-hours', newH);
        setWheelValue('wheel-in-minutes', newM);
    } else {
        const [currentH, currentM] = pickerState.currentEnd.split(':').map(Number);
        let totalMins = currentH * 60 + currentM + amountMinutes;
        
        // Wrap around 24 hours (with 24:00 support)
        if (totalMins < 0) totalMins += 24 * 60;
        if (totalMins > 24 * 60) totalMins -= 24 * 60;
        
        const newH = Math.floor(totalMins / 60);
        const newM = totalMins % 60;
        
        pickerState.currentEnd = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
        setWheelValue('wheel-out-hours', newH);
        setWheelValue('wheel-out-minutes', newM);
    }
}

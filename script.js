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

// Get Adjusted Today with 5-hour margin (if before 5 AM, it is still yesterday)
function getAdjustedToday() {
    const now = new Date();
    if (now.getHours() < 5) {
        now.setDate(now.getDate() - 1);
    }
    return {
        date: now.getDate(),
        monthStr: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        hours: now.getHours(),
        minutes: now.getMinutes()
    };
}

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
        
        // If active month doesn't exist, create it EMPTY
        if (!appData.months[appData.activeMonth]) {
            generateDefaultMonth(appData.activeMonth);
        }
    }
}

function saveLocalStorage() {
    localStorage.setItem('horarios_pro_data', JSON.stringify(appData));
}

// Generate Default Month - Now returns EMPTY as requested
function generateDefaultMonth(monthKey) {
    appData.months[monthKey] = [];
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
    document.getElementById('add-day-btn').addEventListener('click', addNewDay);
    
    // Month Dropdown Toggle logic
    const selectorBtn = document.getElementById('month-selector-btn');
    const dropdown = document.getElementById('month-dropdown');
    selectorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('active');
        selectorBtn.parentElement.classList.toggle('active');
    });

    // Options Menu Toggle logic
    const menuBtn = document.getElementById('menu-btn');
    const menuDropdown = document.getElementById('menu-dropdown');
    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        menuDropdown.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!selectorBtn.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('active');
            selectorBtn.parentElement.classList.remove('active');
        }
        if (!menuBtn.contains(e.target) && !menuDropdown.contains(e.target)) {
            menuDropdown.classList.remove('active');
        }
    });

    document.getElementById('add-month-menu-btn').addEventListener('click', () => {
        menuDropdown.classList.remove('active');
        createNewMonth();
    });

    document.getElementById('print-month-menu-btn').addEventListener('click', () => {
        menuDropdown.classList.remove('active');
        printMonth();
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

// Find the row that should be highlighted as the active or most recent worked day
function findActiveHighlightRowId(currentRows, adjusted) {
    // Only highlight rows that have at least one service
    const rowsWithServices = currentRows.filter(r => r.services && r.services.length > 0);
    if (rowsWithServices.length === 0) return null;
    
    const [year, month] = appData.activeMonth.split('-').map(Number);
    const todayDateVal = new Date(adjusted.year, adjusted.month - 1, adjusted.date);
    
    // Look for exact match today
    const todayRow = rowsWithServices.find(r => {
        const dVal = new Date(year, month - 1, r.date);
        return dVal.getTime() === todayDateVal.getTime();
    });
    if (todayRow) return todayRow.id;
    
    // Look for closest in the past
    let closestRow = null;
    let closestDiff = -Infinity;
    
    rowsWithServices.forEach(r => {
        const dVal = new Date(year, month - 1, r.date);
        const diff = dVal - todayDateVal; // Negative if in the past
        if (diff < 0 && diff > closestDiff) {
            closestDiff = diff;
            closestRow = r;
        }
    });
    
    return closestRow ? closestRow.id : null;
}

// Render Schedule List
function renderSchedule() {
    const container = document.getElementById('schedule-list');
    container.innerHTML = '';

    const currentRows = appData.months[appData.activeMonth] || [];
    
    // Sort rows by date number
    currentRows.sort((a, b) => a.date - b.date);

    let grandTotalMinutes = 0;
    let completedMinutes = 0;
    
    const adjusted = getAdjustedToday();
    const activeHighlightId = findActiveHighlightRowId(currentRows, adjusted);

    currentRows.forEach(row => {
        const [year, month] = appData.activeMonth.split('-').map(Number);
        const weekday = getWeekdayName(year, month, row.date);
        const isHighlighted = row.id === activeHighlightId;
        
        // Calculate if this date is in the past
        const rowDateVal = new Date(year, month - 1, row.date);
        const todayDateVal = new Date(adjusted.year, adjusted.month - 1, adjusted.date);
        const isPast = rowDateVal < todayDateVal;
        
        let rowMinutes = 0;
        const servicesHtml = [];

        row.services.forEach((srv, index) => {
            const mins = calculateServiceMinutes(srv.start, srv.end);
            rowMinutes += mins;
            grandTotalMinutes += mins;
            
            if (isServiceCompleted(row.date, srv)) {
                completedMinutes += mins;
            }
            
            servicesHtml.push(`
                <span class="service-badge" onclick="openTimePicker('${row.id}', ${index})">
                    <span>${srv.start}-${srv.end}</span>
                    <span class="remove-service-btn" onclick="deleteService(event, '${row.id}', ${index})">&times;</span>
                </span>
            `);
        });

        // Determine sub-label text
        let subLabel = 'Editar fecha';
        if (row.id === activeHighlightId) {
            const rowDateVal = new Date(year, month - 1, row.date);
            const todayDateVal = new Date(adjusted.year, adjusted.month - 1, adjusted.date);
            if (rowDateVal.getTime() === todayDateVal.getTime()) {
                subLabel = 'Hoy';
            } else {
                subLabel = 'Último';
            }
        }
        
        const rowEl = document.createElement('div');
        rowEl.className = `schedule-row ${isHighlighted ? 'is-today' : ''}`;
        rowEl.setAttribute('data-id', row.id);
        rowEl.innerHTML = `
            <div class="day-column ${isPast ? 'is-past-day' : ''}" onclick="openDayPicker('${row.id}')">
                <span class="day-label">${row.date} ${weekday.toUpperCase()}</span>
                <span class="day-sub">${subLabel}</span>
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
    document.getElementById('completed-hours').innerText = `${formatMinutes(completedMinutes)}h`;
    document.getElementById('total-days-count').innerText = currentRows.length;
}

// Check if a service has ended based on adjusted current time
function isServiceCompleted(rowDate, srv) {
    const adjusted = getAdjustedToday();
    
    // If we're looking at a past month, all services are completed
    const [actYear, actMonth] = appData.activeMonth.split('-').map(Number);
    const actDateVal = new Date(actYear, actMonth - 1, rowDate);
    const todayDateVal = new Date(adjusted.year, adjusted.month - 1, adjusted.date);
    
    if (actDateVal < todayDateVal) return true;
    if (actDateVal > todayDateVal) return false;
    
    // If it is today:
    const currentMin = adjusted.hours * 60 + adjusted.minutes;
    
    let [startH, startM] = srv.start.split(':').map(Number);
    let [endH, endM] = srv.end.split(':').map(Number);
    
    let startMin = startH * 60 + startM;
    let endMin = endH * 60 + endM;
    
    // Midnight overlap adjustments (e.g. 19:00 to 02:00)
    if (endMin < startMin) {
        endMin += 24 * 60;
    }
    
    let currentMinAdjusted = currentMin;
    if (adjusted.hours < 5) {
        currentMinAdjusted += 24 * 60;
    }
    
    return currentMinAdjusted >= endMin;
}

// Print ranges within the active month
function printMonth() {
    const fromDay = prompt("Imprimir desde el día (ej: 1):", "1");
    if (fromDay === null) return;
    const toDay = prompt("Imprimir hasta el día (ej: 31):", "31");
    if (toDay === null) return;
    
    const from = parseInt(fromDay);
    const to = parseInt(toDay);
    if (isNaN(from) || isNaN(to)) {
        alert("Rango no válido.");
        return;
    }

    const rows = document.querySelectorAll('.schedule-row');
    rows.forEach(row => {
        const labelText = row.querySelector('.day-label').innerText;
        const dayNum = parseInt(labelText.split(' ')[0]);
        if (dayNum < from || dayNum > to) {
            row.classList.add('print-hidden');
        } else {
            row.classList.remove('print-hidden');
        }
    });

    window.print();

    // Reset layout after printing
    rows.forEach(row => row.classList.remove('print-hidden'));
}

function scrollToTodayOrClosest() {
    const currentRows = appData.months[appData.activeMonth] || [];
    if (currentRows.length === 0) return;

    const adjusted = getAdjustedToday();
    const activeHighlightId = findActiveHighlightRowId(currentRows, adjusted);

    let targetId = activeHighlightId;
    if (!targetId) {
        // Fallback to first row
        const sorted = [...currentRows].sort((a, b) => a.date - b.date);
        targetId = sorted[0].id;
    }

    if (targetId) {
        setTimeout(() => {
            const el = document.querySelector(`[data-id="${targetId}"]`);
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
    } else {
        // Default to today's adjusted date if active month matches today, otherwise 1st
        const adjusted = getAdjustedToday();
        const [year, month] = appData.activeMonth.split('-').map(Number);
        
        if (adjusted.year === year && adjusted.month === month) {
            newDate = adjusted.date;
        } else {
            newDate = 1;
        }
        // Default empty work service: 09:00 - 17:00
        newServices = [{ start: "09:00", end: "17:00" }];
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
        services: newServices
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

// Custom Wheel/Drum UI Picker logic with optional infinite loop support
function populateWheelElements(elementId, min, max, pad = true, loop = false) {
    const wheel = document.getElementById(elementId);
    wheel.innerHTML = '';
    
    const groupSize = max - min + 1;
    wheel.dataset.groupSize = String(groupSize);
    wheel.dataset.loop = String(loop);
    
    const padItem = () => {
        const item = document.createElement('div');
        item.className = 'wheel-item';
        item.style.pointerEvents = 'none';
        return item;
    };
    
    // Two empty padding items at top
    wheel.appendChild(padItem());
    wheel.appendChild(padItem());

    const repeats = loop ? 5 : 1;
    for (let r = 0; r < repeats; r++) {
        for (let i = min; i <= max; i++) {
            const item = document.createElement('div');
            item.className = 'wheel-item';
            const displayVal = pad ? String(i).padStart(2, '0') : String(i);
            item.innerText = displayVal;
            item.setAttribute('data-val', displayVal);
            wheel.appendChild(item);
        }
    }

    // Two empty padding items at bottom
    wheel.appendChild(padItem());
    wheel.appendChild(padItem());
    
    // Scroll listener for detecting selection and handling boundaries
    wheel.addEventListener('scroll', () => {
        handleWheelLoop(wheel);
        
        clearTimeout(wheel.scrollTimeout);
        wheel.scrollTimeout = setTimeout(() => {
            updateWheelSelection(wheel);
        }, 80);
    });
}

function handleWheelLoop(wheel) {
    const loop = wheel.dataset.loop === 'true';
    const groupSize = parseInt(wheel.dataset.groupSize || 0);
    if (!loop || groupSize <= 0) return;
    
    const scrollTop = wheel.scrollTop;
    const itemHeight = 46;
    const groupHeight = groupSize * itemHeight;
    const totalHeight = wheel.scrollHeight;
    const clientHeight = wheel.clientHeight;
    
    const upperThreshold = groupHeight * 1.5;
    const lowerThreshold = totalHeight - clientHeight - groupHeight * 1.5;
    
    if (scrollTop < upperThreshold) {
        wheel.scrollTop = scrollTop + groupHeight;
    } else if (scrollTop > lowerThreshold) {
        wheel.scrollTop = scrollTop - groupHeight;
    }
}

function updateWheelSelection(wheel) {
    const items = wheel.querySelectorAll('.wheel-item:not([style*="pointer-events"])');
    const allItems = wheel.querySelectorAll('.wheel-item');
    const containerRect = wheel.getBoundingClientRect();
    const centerLine = containerRect.top + containerRect.height / 2;

    let closestItem = null;
    let minDiff = Infinity;

    allItems.forEach(item => {
        if (item.style.pointerEvents === 'none') return;
        const rect = item.getBoundingClientRect();
        const itemCenter = rect.top + rect.height / 2;
        const diff = Math.abs(centerLine - itemCenter);
        if (diff < minDiff) {
            minDiff = diff;
            closestItem = item;
        }
    });

    if (closestItem) {
        allItems.forEach(i => i.classList.remove('selected'));
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
    const allItems = wheel.querySelectorAll('.wheel-item');
    const targetVal = String(value).padStart(2, '0');
    
    const matchingIndices = [];
    allItems.forEach((item, index) => {
        if (item.getAttribute('data-val') === targetVal && !item.style.pointerEvents) {
            matchingIndices.push(index);
        }
    });
    
    let targetIndex = -1;
    if (matchingIndices.length > 0) {
        // Pick the index closest to the middle of the matching indices
        const mid = Math.floor(matchingIndices.length / 2);
        targetIndex = matchingIndices[mid];
    }
    
    if (targetIndex !== -1) {
        const wheelHeight = wheel.clientHeight || 180;
        const scrollPosition = (targetIndex * 46 + 23) - (wheelHeight / 2);
        
        wheel.scrollTo({
            top: scrollPosition,
            behavior: 'instant'
        });
        
        allItems.forEach(i => i.classList.remove('selected'));
        allItems[targetIndex].classList.add('selected');
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

    // Populate Time wheels (0-23 hours and 0-59 minutes) with loop enabled
    populateWheelElements('wheel-in-hours', 0, 23, true, true);
    populateWheelElements('wheel-in-minutes', 0, 59, true, true);
    populateWheelElements('wheel-out-hours', 0, 23, true, true);
    populateWheelElements('wheel-out-minutes', 0, 59, true, true);

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

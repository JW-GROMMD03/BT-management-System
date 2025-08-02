// Employee data structure (will be stored in localStorage)
let employees = [];
let attendanceRecords = [];
let leaveRecords = [];
let deductions = [];
let salaryRecords = []; // Added for salary tracking
let settings = {
    enableNotifications: true,
    enableEmailNotifications: false,
    notificationEmail: '',
    darkMode: false,
    deductionRate: 0.5 // Ksh per minute for overstay deductions
};

// Helper function to replace getElement (fixes "getElement is not defined" error)
function getElement(id) {
    return document.getElementById(id);
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    loadData();
    setupEventListeners();
    updateStorageInfo();
    
    // Set default dates
    const today = new Date().toISOString().split('T')[0];
    const attendanceDate = getElement('attendanceDate');
    if (attendanceDate) attendanceDate.value = today;
    
    // Initialize UI
    updateLateEmployeesList();
    updateAbsentEmployeesList();
    updateLeaveDaysList();
    updateSalaryReports();
});

// Load data from localStorage
function loadData() {
    try {
        // Load employees
        const compressedEmployees = localStorage.getItem('employees');
        if (compressedEmployees) {
            const decompressed = LZString.decompress(compressedEmployees);
            employees = JSON.parse(decompressed) || [];
        }
        
        // Load attendance
        const compressedAttendance = localStorage.getItem('attendance');
        if (compressedAttendance) {
            const decompressed = LZString.decompress(compressedAttendance);
            attendanceRecords = JSON.parse(decompressed) || [];
        }
        
        // Load leave records
        const compressedLeaves = localStorage.getItem('leaveRecords');
        if (compressedLeaves) {
            const decompressed = LZString.decompress(compressedLeaves);
            leaveRecords = JSON.parse(decompressed) || [];
        }
        
        // Load deductions
        const compressedDeductions = localStorage.getItem('deductions');
        if (compressedDeductions) {
            const decompressed = LZString.decompress(compressedDeductions);
            deductions = JSON.parse(decompressed) || [];
        }
        
        // Load salary records
        const compressedSalaries = localStorage.getItem('salaryRecords');
        if (compressedSalaries) {
            const decompressed = LZString.decompress(compressedSalaries);
            salaryRecords = JSON.parse(decompressed) || [];
        }
        
        // Load settings
        const savedSettings = localStorage.getItem('settings');
        if (savedSettings) {
            settings = JSON.parse(savedSettings);
            applySettings();
        }
    } catch (error) {
        console.error('Error loading data:', error);
        showAlert('Error loading data. Some data may be lost.', 'error');
    }
}

// Save data to localStorage with compression
function saveData() {
    try {
        // Compress data before saving
        localStorage.setItem('employees', LZString.compress(JSON.stringify(employees)));
        localStorage.setItem('attendance', LZString.compress(JSON.stringify(attendanceRecords)));
        localStorage.setItem('leaveRecords', LZString.compress(JSON.stringify(leaveRecords)));
        localStorage.setItem('deductions', LZString.compress(JSON.stringify(deductions)));
        localStorage.setItem('salaryRecords', LZString.compress(JSON.stringify(salaryRecords)));
        localStorage.setItem('settings', JSON.stringify(settings));
        
        updateStorageInfo();
    } catch (error) {
        console.error('Error saving data:', error);
        showAlert('Failed to save data. Please check storage space.', 'error');
        
        // If localStorage is full, try to clear some space
        if (error.name === 'QuotaExceededError') {
            handleLocalStorageFull();
        }
    }
}

// Handle localStorage full error
function handleLocalStorageFull() {
    try {
        // Clear old attendance records (keep last 3 months)
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        
        attendanceRecords = attendanceRecords.filter(record => {
            const recordDate = new Date(record.date);
            return recordDate >= threeMonthsAgo;
        });
        
        // Try saving again
        saveData();
        showAlert('Cleared old records to free up space. Please try again.', 'warning');
    } catch (error) {
        console.error('Error handling full localStorage:', error);
        showAlert('Local storage is full and cleanup failed. Some data may not be saved.', 'error');
    }
}

// Update storage information in settings panel
function updateStorageInfo() {
    try {
        // Calculate total used space
        let totalUsed = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            totalUsed += key.length + value.length;
        }
        
        // Convert to KB
        const usedKB = (totalUsed / 1024).toFixed(2);
        const totalKB = (5 * 1024).toFixed(2); // Assuming 5MB limit
        const remainingKB = (5 * 1024 - totalUsed / 1024).toFixed(2);
        
        // Update UI
        const usagePercentage = (totalUsed / (5 * 1024 * 1024)) * 100;
        getElement('storageUsageBar').style.width = `${usagePercentage}%`;
        getElement('storageUsed').textContent = `${usedKB} KB used`;
        getElement('storageRemaining').textContent = `${remainingKB} KB remaining`;
        
        // Update progress bar color based on usage
        const progressBar = getElement('storageUsageBar');
        if (usagePercentage > 90) {
            progressBar.classList.add('bg-danger');
            progressBar.classList.remove('bg-warning', 'bg-success');
        } else if (usagePercentage > 70) {
            progressBar.classList.add('bg-warning');
            progressBar.classList.remove('bg-danger', 'bg-success');
        } else {
            progressBar.classList.add('bg-success');
            progressBar.classList.remove('bg-danger', 'bg-warning');
        }
    } catch (error) {
        console.error('Error updating storage info:', error);
    }
}

// Apply settings to the UI
function applySettings() {
    try {
        // Apply dark mode
        if (settings.darkMode) {
            document.body.classList.add('dark-mode');
            const darkModeBtn = getElement('toggleDarkMode');
            if (darkModeBtn) darkModeBtn.innerHTML = '<i class="bi bi-sun-fill"></i> Light Mode';
        } else {
            document.body.classList.remove('dark-mode');
            const darkModeBtn = getElement('toggleDarkMode');
            if (darkModeBtn) darkModeBtn.innerHTML = '<i class="bi bi-moon-fill"></i> Dark Mode';
        }
        
        // Apply notification settings
        const notificationsCheckbox = getElement('enableNotifications');
        const emailNotificationsCheckbox = getElement('enableEmailNotifications');
        const notificationEmailInput = getElement('notificationEmail');
        
        if (notificationsCheckbox) notificationsCheckbox.checked = settings.enableNotifications;
        if (emailNotificationsCheckbox) emailNotificationsCheckbox.checked = settings.enableEmailNotifications;
        if (notificationEmailInput) notificationEmailInput.value = settings.notificationEmail || '';
    } catch (error) {
        console.error('Error applying settings:', error);
    }
}

// Utility functions
function showAlert(message, type = 'success') {
    try {
        const alertTypes = {
            success: 'alert-success',
            error: 'alert-danger',
            warning: 'alert-warning',
            info: 'alert-info'
        };
        
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert ${alertTypes[type] || 'alert-info'} alert-dismissible fade show`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        const alertsContainer = getElement('alertsContainer') || document.body;
        alertsContainer.prepend(alertDiv);
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            try {
                const bsAlert = bootstrap.Alert.getOrCreateInstance(alertDiv);
                bsAlert.close();
            } catch (error) {
                console.error('Error dismissing alert:', error);
                alertDiv.remove();
            }
        }, 5000);
    } catch (error) {
        console.error('Error showing alert:', error);
    }
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    } catch (error) {
        console.error('Error formatting date:', error);
        return dateString; // Return raw string if formatting fails
    }
}

function formatDateShort(dateString) {
    if (!dateString) return 'N/A';
    try {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    } catch (error) {
        console.error('Error formatting date:', error);
        return dateString;
    }
}

// Set up event listeners
function setupEventListeners() {
    // Register new employee
    const employeeForm = getElement('employeeForm');
    if (employeeForm) {
        employeeForm.addEventListener('submit', handleEmployeeRegistration);
    }
    
    // Record attendance
    const attendanceForm = getElement('attendanceForm');
    if (attendanceForm) {
        attendanceForm.addEventListener('submit', handleAttendanceRecording);
        
        // Calculate overstay minutes when departure time changes
        const departureTime = getElement('departureTime');
        const approvedOvertime = getElement('approvedOvertime');
        const shiftTypeAttendance = getElement('shiftTypeAttendance');
        const attendanceDate = getElement('attendanceDate');
        
        if (departureTime && approvedOvertime && shiftTypeAttendance && attendanceDate) {
            departureTime.addEventListener('change', calculateOverstayMinutes);
            approvedOvertime.addEventListener('change', calculateOverstayMinutes);
            shiftTypeAttendance.addEventListener('change', calculateOverstayMinutes);
            attendanceDate.addEventListener('change', calculateOverstayMinutes);
        }
    }
    
    // Add leave/rest days
    const leaveForm = getElement('leaveForm');
    if (leaveForm) {
        leaveForm.addEventListener('submit', handleLeaveRecording);
    }
    
    // Calculate salary
    const salaryCalcBtn = getElement('calculateSalaryBtn');
    if (salaryCalcBtn) {
        salaryCalcBtn.addEventListener('click', handleSalaryCalculation);
    }
    
    // Generate salary report
    const generateReportBtn = getElement('generateReportBtn');
    if (generateReportBtn) {
        generateReportBtn.addEventListener('click', generateSalaryReport);
    }
    
    // Export salary report
    const exportFullReport = getElement('exportFullReport');
    if (exportFullReport) {
        exportFullReport.addEventListener('click', exportSalaryReport);
    }
    
    // Print salary report
    const printFullReport = getElement('printFullReport');
    if (printFullReport) {
        printFullReport.addEventListener('click', printSalaryReport);
    }
    
    // Search employees
    const searchBtn = getElement('searchBtn');
    if (searchBtn) {
        searchBtn.addEventListener('click', handleEmployeeSearch);
    }
    
    // Quick search functionality
    const quickSearchInput = getElement('quickSearchInput');
    if (quickSearchInput) {
        quickSearchInput.addEventListener('input', handleQuickSearch);
    }
    
    // Deregister employee
    const deregisterForm = getElement('deregisterForm');
    if (deregisterForm) {
        deregisterForm.addEventListener('submit', handleEmployeeDeregistration);
    }
    
    // Save employee changes
    const saveEmployeeChanges = getElement('saveEmployeeChanges');
    if (saveEmployeeChanges) {
        saveEmployeeChanges.addEventListener('click', handleEmployeeUpdate);
    }
    
    // Edit employee ID
    const editEmployeeIdBtn = getElement('editEmployeeIdBtn');
    if (editEmployeeIdBtn) {
        editEmployeeIdBtn.addEventListener('click', showEditIdModal);
    }
    
    // Save edited ID
    const editIdForm = getElement('editIdForm');
    if (editIdForm) {
        editIdForm.addEventListener('submit', handleEditId);
    }
    
    // Add deduction
    const deductionForm = getElement('deductionForm');
    if (deductionForm) {
        deductionForm.addEventListener('submit', handleDeductionAdd);
    }
    
    // Dark mode toggle
    const darkModeToggle = getElement('toggleDarkMode');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', function() {
            settings.darkMode = !settings.darkMode;
            applySettings();
            saveData();
        });
    }
    
    // Mark all present button
    const markAllPresentBtn = getElement('markAllPresent');
    if (markAllPresentBtn) {
        markAllPresentBtn.addEventListener('click', markAllEmployeesPresent);
    }
    
    // Save notification settings
    const saveNotificationSettingsBtn = getElement('saveNotificationSettings');
    if (saveNotificationSettingsBtn) {
        saveNotificationSettingsBtn.addEventListener('click', function() {
            settings.enableNotifications = getElement('enableNotifications').checked || false;
            settings.enableEmailNotifications = getElement('enableEmailNotifications').checked || false;
            settings.notificationEmail = getElement('notificationEmail').value || '';
            
            saveData();
            showAlert('Notification settings saved successfully!');
        });
    }
    
    // Clear storage button
    const clearStorageBtn = getElement('clearStorageBtn');
    if (clearStorageBtn) {
        clearStorageBtn.addEventListener('click', function() {
            if (confirm('This will delete ALL local data. Are you sure?')) {
                localStorage.clear();
                employees = [];
                attendanceRecords = [];
                leaveRecords = [];
                deductions = [];
                salaryRecords = [];
                showAlert('All local data has been cleared', 'warning');
                setTimeout(() => location.reload(), 1000);
            }
        });
    }
    
    // Export data button
    const exportDataBtn = getElement('exportDataBtn');
    if (exportDataBtn) {
        exportDataBtn.addEventListener('click', exportAllData);
    }
    
    // Import data button
    const importDataBtn = getElement('importDataBtn');
    if (importDataBtn) {
        importDataBtn.addEventListener('click', importData);
    }
    
    // Initialize search suggestions
    initSearchSuggestions();
    
    // Initialize chatbot if elements exist
    if (getElement('chatbotToggle') && getElement('chatbotWindow')) {
        initChatbot();
    }
    
    // Check for late employees every minute
    setInterval(checkLateEmployees, 60000);
    checkLateEmployees();
    
    // Export all employees button
    const exportAllEmployeesBtn = getElement('exportAllEmployees');
    if (exportAllEmployeesBtn) {
        exportAllEmployeesBtn.addEventListener('click', exportAllEmployees);
    }
    
    // Print directory button
    const printDirectoryBtn = getElement('printDirectory');
    if (printDirectoryBtn) {
        printDirectoryBtn.addEventListener('click', printEmployeeDirectory);
    }
    
    // Email payslip button
    const emailPayslipBtn = getElement('emailPayslipBtn');
    if (emailPayslipBtn) {
        emailPayslipBtn.addEventListener('click', emailPayslip);
    }
    
    // Export payslip button
    const exportPayslipBtn = getElement('exportPayslipBtn');
    if (exportPayslipBtn) {
        exportPayslipBtn.addEventListener('click', exportPayslip);
    }
    
    // Print payslip button
    const printPayslipBtn = getElement('printPayslipBtn');
    if (printPayslipBtn) {
        printPayslipBtn.addEventListener('click', printPayslip);
    }
}

// Quick search functionality
function handleQuickSearch() {
    const searchTerm = getElement('quickSearchInput').value.toLowerCase();
    if (!searchTerm) return;

    const results = employees.filter(emp => 
        emp.id.toLowerCase().includes(searchTerm) || 
        emp.name.toLowerCase().includes(searchTerm)
    );

    const quickResultsDiv = getElement('quickSearchResults');
    if (!quickResultsDiv) return;

    quickResultsDiv.innerHTML = '';

    if (results.length === 0) {
        quickResultsDiv.innerHTML = '<div class="alert alert-info">No employees found</div>';
        return;
    }

    results.forEach(emp => {
        const empCard = document.createElement('div');
        empCard.className = 'card mb-2';
        empCard.innerHTML = `
            <div class="card-body">
                <h5 class="card-title">${emp.name}</h5>
                <h6 class="card-subtitle mb-2 text-muted">${emp.id}</h6>
                <p class="card-text">${emp.department || 'No department'} - ${emp.shift === 'day' ? 'Day Shift' : 'Night Shift'}</p>
                <button class="btn btn-sm btn-primary view-employee-btn" data-id="${emp.id}">View Details</button>
            </div>
        `;
        quickResultsDiv.appendChild(empCard);
    });

    // Add event listeners to view buttons
    document.querySelectorAll('.view-employee-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const empId = this.getAttribute('data-id');
            showEmployeeDetails(empId);
        });
    });
}

// Calculate overstay minutes
function calculateOverstayMinutes() {
    const departureTime = getElement('departureTime').value;
    const approvedOvertime = parseInt(getElement('approvedOvertime').value) || 0;
    const shiftType = getElement('shiftTypeAttendance').value;
    const date = getElement('attendanceDate').value;
    
    if (!departureTime || !shiftType || !date) return;
    
    const departureDateTime = new Date(`${date}T${departureTime}`);
    let endDateTime;
    
    if (shiftType === 'day') {
        endDateTime = new Date(`${date}T17:30:00`); // 5:30 PM
    } else {
        endDateTime = new Date(`${date}T05:30:00`); // 5:30 AM next day
        endDateTime.setDate(endDateTime.getDate() + 1); // Add 1 day for night shift
    }
    
    const overtimeMinutes = Math.round((departureDateTime - endDateTime) / (1000 * 60));
    const overstayMinutes = Math.max(0, overtimeMinutes - approvedOvertime);
    
    getElement('overstayMinutes').value = overstayMinutes;
}

// Handle employee registration
function handleEmployeeRegistration(e) {
    e.preventDefault();
    
    try {
        const empId = getElement('empId').value.trim();
        const fullName = getElement('fullName').value.trim();
        const phoneNumber = getElement('phoneNumber').value;
        const shiftType = getElement('shiftType').value;
        const workingDays = parseInt(getElement('workingDays').value);
        const agreedSalary = parseFloat(getElement('agreedSalary').value);
        const paymentDay = parseInt(getElement('paymentDay').value);
        const department = getElement('department').value;
        const email = getElement('email').value;
        
        // Validate input
        if (!empId || !fullName) {
            throw new Error('Employee ID and Name are required');
        }
        
        if (employees.some(emp => emp.id === empId)) {
            throw new Error('Employee with this ID already exists!');
        }
        
        if (isNaN(workingDays) || workingDays < 1 || workingDays > 31) {
            throw new Error('Working days must be between 1 and 31');
        }
        
        if (isNaN(agreedSalary) || agreedSalary <= 0) {
            throw new Error('Salary must be a positive number');
        }
        
        if (isNaN(paymentDay) || paymentDay < 1 || paymentDay > 31) {
            throw new Error('Payment day must be between 1 and 31');
        }
        
        // Create new employee
        const newEmployee = {
            id: empId,
            name: fullName,
            phone: phoneNumber,
            shift: shiftType,
            workingDays: workingDays,
            salary: agreedSalary,
            paymentDay: paymentDay,
            department: department,
            email: email,
            status: 'active',
            deductions: [],
            createdAt: new Date().toISOString()
        };
        
        employees.push(newEmployee);
        saveData();
        
        showAlert('Employee registered successfully!');
        getElement('employeeForm').reset();
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Handle attendance recording
function handleAttendanceRecording(e) {
    e.preventDefault();
    
    try {
        const empId = getElement('attendanceEmpId').value;
        const date = getElement('attendanceDate').value;
        const arrivalTime = getElement('arrivalTime').value;
        const departureTime = getElement('departureTime').value;
        const approvedOvertime = parseInt(getElement('approvedOvertime').value) || 0;
        const shiftType = getElement('shiftTypeAttendance').value;
        const overstayMinutes = parseInt(getElement('overstayMinutes').value) || 0;
        
        if (!empId || !date || !arrivalTime || !shiftType) {
            throw new Error('All required fields must be filled');
        }
        
        // Check if employee exists
        const employee = employees.find(emp => emp.id === empId);
        if (!employee) {
            throw new Error('Employee not found!');
        }
        
        // Calculate if late
        const arrivalDateTime = new Date(`${date}T${arrivalTime}`);
        let expectedTime, minutesLate = 0;
        let status = 'on_time';
        
        if (shiftType === 'day') {
            expectedTime = new Date(`${date}T09:30:00`);
        } else {
            expectedTime = new Date(`${date}T21:30:00`);
        }
        
        if (arrivalDateTime > expectedTime) {
            minutesLate = Math.round((arrivalDateTime - expectedTime) / (1000 * 60));
            status = 'late';
        }
        
        // Create attendance record
        const attendanceRecord = {
            empId: empId,
            date: date,
            arrivalTime: arrivalTime,
            departureTime: departureTime || null,
            shiftType: shiftType,
            status: status,
            minutesLate: minutesLate,
            approvedOvertime: approvedOvertime,
            overstayMinutes: overstayMinutes,
            recordedAt: new Date().toISOString()
        };
        
        // Check if attendance already recorded for this date
        const existingIndex = attendanceRecords.findIndex(record => 
            record.empId === empId && record.date === date
        );
        
        if (existingIndex >= 0) {
            attendanceRecords[existingIndex] = attendanceRecord;
        } else {
            attendanceRecords.push(attendanceRecord);
        }
        
        saveData();
        
        // Show status
        const statusDiv = getElement('attendanceStatus');
        if (statusDiv) {
            statusDiv.innerHTML = `
                <div class="alert ${status === 'late' ? 'alert-warning' : 'alert-success'}">
                    <h4>Attendance Recorded</h4>
                    <p>Employee: ${employee.name}</p>
                    <p>Date: ${formatDate(date)}</p>
                    <p>Arrival Time: ${arrivalTime}</p>
                    <p>Status: ${status === 'late' ? 
                        `<span class="late-status">Late by ${minutesLate} minutes</span>` : 
                        `<span class="on-time-status">On Time</span>`}
                    </p>
                    ${overstayMinutes > 0 ? `<p>Overstay Minutes: ${overstayMinutes} (Deduction: Ksh ${(overstayMinutes * settings.deductionRate).toFixed(2)})</p>` : ''}
                </div>
            `;
        }
        
        showAlert('Attendance recorded successfully!');
        getElement('attendanceForm').reset();
        updateLateEmployeesList();
        updateAbsentEmployeesList();
        
        // If late, check if we should notify
        if (status === 'late' && settings.enableNotifications) {
            const today = new Date().toISOString().split('T')[0];
            if (date === today) {
                notifyLateEmployees([attendanceRecord]);
            }
        }
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Handle leave recording
function handleLeaveRecording(e) {
    e.preventDefault();
    
    try {
        const empId = getElement('leaveEmpId').value;
        const leaveType = getElement('leaveType').value;
        const startDate = getElement('leaveStartDate').value;
        const endDate = getElement('leaveEndDate').value;
        const reason = getElement('leaveReason').value;
        
        if (!empId || !leaveType || !startDate || !endDate) {
            throw new Error('Employee ID, leave type, and dates are required');
        }
        
        // Validate dates
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            throw new Error('Invalid date format');
        }
        
        if (start > end) {
            throw new Error('Start date cannot be after end date');
        }
        
        // Check if employee exists
        const employee = employees.find(emp => emp.id === empId);
        if (!employee) {
            throw new Error('Employee not found!');
        }
        
        const leaveRecord = {
            empId: empId,
            type: leaveType,
            startDate: startDate,
            endDate: endDate,
            reason: reason,
            recordedAt: new Date().toISOString()
        };
        
        leaveRecords.push(leaveRecord);
        saveData();
        
        showAlert('Leave/Rest days added successfully!');
        getElement('leaveForm').reset();
        updateLeaveDaysList();
        updateAbsentEmployeesList();
        
        // Send a copy to employee records and notify admin
        notifyAdminAboutLeave(employee, leaveRecord);
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Notify admin about leave
function notifyAdminAboutLeave(employee, leaveRecord) {
    if (settings.enableNotifications) {
        const notification = new Notification('New Leave Request', {
            body: `${employee.name} (${employee.id}) has been granted leave from ${formatDateShort(leaveRecord.startDate)} to ${formatDateShort(leaveRecord.endDate)}`,
            icon: 'https://cdn-icons-png.flaticon.com/512/3143/3143463.png'
        });
        
        playNotificationSound();
    }
    
    if (settings.enableEmailNotifications && settings.notificationEmail) {
        console.log(`Would send email to ${settings.notificationEmail} about leave for ${employee.name}`);
    }
}

// Show edit ID modal
function showEditIdModal() {
    const modal = new bootstrap.Modal(getElement('editIdModal'));
    const currentEmpId = getElement('modalEmpId').value;
    
    getElement('currentEmpId').value = currentEmpId;
    getElement('newEmpId').value = currentEmpId;
    
    modal.show();
}

// Handle edit ID
function handleEditId(e) {
    e.preventDefault();
    
    try {
        const currentId = getElement('currentEmpId').value;
        const newId = getElement('newEmpId').value.trim();
        
        if (!newId) {
            throw new Error('New Employee ID is required');
        }
        
        if (newId === currentId) {
            throw new Error('New ID is the same as current ID');
        }
        
        if (employees.some(emp => emp.id === newId)) {
            throw new Error('Employee with this ID already exists');
        }
        
        // Find employee
        const employeeIndex = employees.findIndex(emp => emp.id === currentId);
        if (employeeIndex === -1) {
            throw new Error('Employee not found');
        }
        
        // Update employee ID
        employees[employeeIndex].id = newId;
        
        // Update all references in attendance records
        attendanceRecords.forEach(record => {
            if (record.empId === currentId) {
                record.empId = newId;
            }
        });
        
        // Update all references in leave records
        leaveRecords.forEach(record => {
            if (record.empId === currentId) {
                record.empId = newId;
            }
        });
        
        // Update all references in deductions
        deductions.forEach(deduction => {
            if (deduction.empId === currentId) {
                deduction.empId = newId;
            }
        });
        
        // Update all references in salary records
        salaryRecords.forEach(record => {
            if (record.empId === currentId) {
                record.empId = newId;
            }
        });
        
        saveData();
        
        const modal = bootstrap.Modal.getInstance(getElement('editIdModal'));
        modal.hide();
        
        showAlert('Employee ID updated successfully!');
        
        // Refresh employee details view
        showEmployeeDetails(newId);
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Handle employee update
function handleEmployeeUpdate() {
    try {
        const empId = getElement('modalEmpId').value;
        const empName = getElement('modalEmpName').value;
        const empPhone = getElement('modalEmpPhone').value;
        const empShift = getElement('modalEmpShift').value;
        const empWorkingDays = getElement('modalEmpWorkingDays').value;
        const empSalary = getElement('modalEmpSalary').value;
        const empPaymentDay = getElement('modalEmpPaymentDay').value;
        
        if (!empId || !empName) {
            throw new Error('Employee ID and Name are required');
        }
        
        const employeeIndex = employees.findIndex(emp => emp.id === empId);
        
        if (employeeIndex === -1) {
            throw new Error('Employee not found!');
        }
        
        const updatedEmployee = {
            ...employees[employeeIndex],
            name: empName,
            phone: empPhone,
            shift: empShift,
            workingDays: parseInt(empWorkingDays),
            salary: parseFloat(empSalary),
            paymentDay: parseInt(empPaymentDay),
            updatedAt: new Date().toISOString()
        };
        
        employees[employeeIndex] = updatedEmployee;
        saveData();
        
        const modal = bootstrap.Modal.getInstance(getElement('employeeModal'));
        if (modal) {
            modal.hide();
        }
        
        showAlert('Employee details updated successfully!');
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Handle salary calculation
function handleSalaryCalculation() {
    try {
        const empId = getElement('salaryEmpId').value;
        const calcMonth = getElement('calcMonth').value;
        const emergencyCalc = getElement('emergencyCalc').checked || false;
        const includeBonus = getElement('includeBonus').checked || false;
        
        if (!empId && !calcMonth) {
            throw new Error('Please enter Employee ID or select a month to calculate salaries for all employees');
        }
        
        if (empId) {
            calculateEmployeeSalary(empId, calcMonth, emergencyCalc, includeBonus);
        } else {
            calculateAllSalaries(calcMonth, emergencyCalc, includeBonus);
        }
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Calculate salary for a single employee
function calculateEmployeeSalary(empId, month, emergencyCalc = false, includeBonus = false) {
    try {
        const employee = employees.find(emp => emp.id === empId);
        if (!employee) {
            throw new Error('Employee not found!');
        }
        
        // Check if it's payment day or emergency calculation
        const today = new Date();
        const currentDay = today.getDate();
        
        if (!emergencyCalc && currentDay !== employee.paymentDay) {
            throw new Error(`Today is not the payment day for this employee (Payment day: ${employee.paymentDay} of the month). Use emergency calculation if needed.`);
        }
        
        // Get the year and month for calculation
        let calcYear, calcMonth;
        if (month) {
            [calcYear, calcMonth] = month.split('-').map(Number);
        } else {
            calcYear = today.getFullYear();
            calcMonth = today.getMonth() + 1; // JavaScript months are 0-indexed
        }
        
        // Calculate days in month
        const daysInMonth = new Date(calcYear, calcMonth, 0).getDate();
        
        // Get all dates in the month
        const monthDates = [];
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${calcYear}-${String(calcMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            monthDates.push(dateStr);
        }
        
        // Filter attendance records for this employee and month
        const monthAttendance = attendanceRecords.filter(record => {
            try {
                const [year, month] = record.date.split('-').map(Number);
                return record.empId === empId && year === calcYear && month === calcMonth;
            } catch (error) {
                console.error('Error parsing attendance record date:', record.date, error);
                return false;
            }
        });
        
        // Filter leave records for this employee and month
        const monthLeaves = leaveRecords.filter(leave => {
            try {
                return leave.empId === empId && 
                    ((new Date(leave.startDate) <= new Date(calcYear, calcMonth - 1, daysInMonth)) && 
                    (new Date(leave.endDate) >= new Date(calcYear, calcMonth - 1, 1)));
            } catch (error) {
                console.error('Error parsing leave record dates:', leave.startDate, leave.endDate, error);
                return false;
            }
        });
        
        // Calculate working days, absent days, late minutes, etc.
        let workingDays = 0;
        let absentDays = 0;
        let lateMinutes = 0;
        let leaveDays = 0;
        
        monthDates.forEach(date => {
            // Check if on leave
            const onLeave = monthLeaves.some(leave => 
                date >= leave.startDate && date <= leave.endDate
            );
            
            if (onLeave) {
                leaveDays++;
                return;
            }
            
            // Check attendance
            const attendance = monthAttendance.find(record => record.date === date);
            
            if (attendance) {
                if (attendance.status === 'absent') {
                    absentDays++;
                } else {
                    workingDays++;
                    if (attendance.status === 'late') {
                        lateMinutes += attendance.minutesLate;
                    }
                }
            } else {
                // No attendance record - assume absent if it's a working day
                absentDays++;
            }
        });
        
        // Calculate salary deductions
        const dailySalary = employee.salary / employee.workingDays;
        const lateDeduction = (lateMinutes / 60) * (dailySalary / 8); // Assuming 8-hour work day
        const absentDeduction = absentDays * dailySalary;
        
        // Get employee's deductions
        const empDeductions = deductions.filter(ded => ded.empId === empId);
        const otherDeductions = empDeductions.reduce((sum, ded) => sum + ded.amount, 0);
        
        // Calculate bonus (if enabled)
        let bonus = 0;
        if (includeBonus) {
            // Simple bonus calculation based on attendance
            const attendancePercentage = (workingDays / employee.workingDays) * 100;
            if (attendancePercentage >= 95) {
                bonus = employee.salary * 0.1; // 10% bonus for excellent attendance
            } else if (attendancePercentage >= 90) {
                bonus = employee.salary * 0.05; // 5% bonus for good attendance
            }
        }
        
        // Calculate net salary
        const grossSalary = employee.salary;
        const totalDeductions = lateDeduction + absentDeduction + otherDeductions;
        const netSalary = grossSalary - totalDeductions + bonus;
        
        // Create salary record
        const salaryRecord = {
            empId: empId,
            month: `${calcYear}-${String(calcMonth).padStart(2, '0')}`,
            grossSalary: grossSalary,
            deductions: totalDeductions,
            bonus: bonus,
            netSalary: netSalary,
            status: 'calculated', // Will be updated to 'paid' when actually paid
            calculatedAt: new Date().toISOString(),
            workingDays: workingDays,
            absentDays: absentDays,
            lateMinutes: lateMinutes,
            leaveDays: leaveDays
        };
        
        // Check if salary already calculated for this month
        const existingIndex = salaryRecords.findIndex(record => 
            record.empId === empId && record.month === salaryRecord.month
        );
        
        if (existingIndex >= 0) {
            salaryRecords[existingIndex] = salaryRecord;
        } else {
            salaryRecords.push(salaryRecord);
        }
        
        saveData();
        
        // Display results
        const salaryResult = getElement('salaryResult');
        const salaryDetails = getElement('salaryDetails');
        
        if (!salaryResult || !salaryDetails) return;
        
        salaryDetails.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <p><strong>Employee:</strong> ${employee.name} (${employee.id})</p>
                    <p><strong>Month:</strong> ${calcYear}-${String(calcMonth).padStart(2, '0')}</p>
                    <p><strong>Shift:</strong> ${employee.shift === 'day' ? 'Day Shift' : 'Night Shift'}</p>
                    <p><strong>Department:</strong> ${employee.department ? employee.department.charAt(0).toUpperCase() + employee.department.slice(1) : 'N/A'}</p>
                </div>
                <div class="col-md-6">
                    <p><strong>Agreed Salary:</strong> Ksh ${employee.salary.toFixed(2)}</p>
                    <p><strong>Working Days:</strong> ${employee.workingDays}</p>
                    <p><strong>Payment Day:</strong> ${employee.paymentDay}</p>
                    <p><strong>Status:</strong> ${employee.status === 'active' ? 'Active' : 'Inactive'}</p>
                </div>
            </div>
            
            <hr>
            
            <div class="row">
                <div class="col-md-6">
                    <h5>Attendance Summary</h5>
                    <p>Working Days: ${workingDays}</p>
                    <p>Leave/Rest Days: ${leaveDays}</p>
                    <p>Absent Days: ${absentDays}</p>
                    <p>Late Minutes: ${lateMinutes} (${(lateMinutes/60).toFixed(1)} hours)</p>
                </div>
                <div class="col-md-6">
                    <h5>Deductions</h5>
                    <p>Late Arrivals: Ksh ${lateDeduction.toFixed(2)}</p>
                    <p>Absent Days: Ksh ${absentDeduction.toFixed(2)}</p>
                    <p>Other Deductions: Ksh ${otherDeductions.toFixed(2)}</p>
                    ${includeBonus ? `<p>Performance Bonus: Ksh ${bonus.toFixed(2)}</p>` : ''}
                    <p><strong>Total Deductions: Ksh ${totalDeductions.toFixed(2)}</strong></p>
                </div>
            </div>
            
            <hr>
            
            <div class="alert alert-success">
                <h4>Net Salary: Ksh ${netSalary.toFixed(2)}</h4>
                <p class="mb-0">Status: ${salaryRecord.status === 'calculated' ? 'Calculated (Pending Payment)' : 'Paid'}</p>
            </div>
            
            <div class="row">
                <div class="col-md-12">
                    <h5>Deduction Details</h5>
                    <div class="table-responsive">
                        <table class="table table-sm">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Description</th>
                                    <th>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
        `;
        
        if (empDeductions.length === 0) {
            salaryDetails.innerHTML += '<tr><td colspan="3" class="text-center">No deductions recorded</td></tr>';
        } else {
            empDeductions.forEach(ded => {
                salaryDetails.innerHTML += `
                    <tr>
                        <td>${formatDate(ded.date)}</td>
                        <td>${ded.description}</td>
                        <td>Ksh ${ded.amount.toFixed(2)}</td>
                    </tr>
                `;
            });
        }
        
        salaryDetails.innerHTML += `
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            
            <div class="d-flex justify-content-end mt-3">
                <button class="btn btn-primary me-2" id="markAsPaidBtn">Mark as Paid</button>
                <button class="btn btn-success me-2" id="emailPayslipBtn">Email Payslip</button>
                <button class="btn btn-info me-2" id="exportPayslipBtn">Export Payslip</button>
                <button class="btn btn-secondary" id="printPayslipBtn">Print Payslip</button>
            </div>
        `;
        
        salaryResult.classList.remove('d-none');
        showAlert('Salary calculated successfully!');
        
        // Add event listeners to the new buttons
        getElement('markAsPaidBtn')?.addEventListener('click', function() {
            markSalaryAsPaid(empId, `${calcYear}-${String(calcMonth).padStart(2, '0')}`);
        });
        
        getElement('emailPayslipBtn')?.addEventListener('click', function() {
            emailPayslip(empId, `${calcYear}-${String(calcMonth).padStart(2, '0')}`);
        });
        
        getElement('exportPayslipBtn')?.addEventListener('click', function() {
            exportPayslip(empId, `${calcYear}-${String(calcMonth).padStart(2, '0')}`);
        });
        
        getElement('printPayslipBtn')?.addEventListener('click', function() {
            printPayslip(empId, `${calcYear}-${String(calcMonth).padStart(2, '0')}`);
        });
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Mark salary as paid
function markSalaryAsPaid(empId, month) {
    try {
        const recordIndex = salaryRecords.findIndex(record => 
            record.empId === empId && record.month === month
        );
        
        if (recordIndex === -1) {
            throw new Error('Salary record not found');
        }
        
        salaryRecords[recordIndex].status = 'paid';
        salaryRecords[recordIndex].paidAt = new Date().toISOString();
        saveData();
        
        showAlert('Salary marked as paid successfully!');
        
        // Refresh the salary details view
        const salaryDetails = getElement('salaryDetails');
        if (salaryDetails) {
            const statusDiv = salaryDetails.querySelector('.alert-success p.mb-0');
            if (statusDiv) {
                statusDiv.textContent = 'Status: Paid';
            }
        }
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Email payslip
function emailPayslip(empId, month) {
    try {
        const employee = employees.find(emp => emp.id === empId);
        if (!employee) {
            throw new Error('Employee not found');
        }
        
        const salaryRecord = salaryRecords.find(record => 
            record.empId === empId && record.month === month
        );
        
        if (!salaryRecord) {
            throw new Error('Salary record not found');
        }
        
        if (!employee.email) {
            throw new Error('Employee does not have an email address');
        }
        
        // In a real application, this would send an actual email
        console.log(`Would send payslip to ${employee.email} for ${employee.name} (${employee.id}) for ${month}`);
        showAlert(`Payslip would be emailed to ${employee.email}`, 'info');
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Export payslip as PDF
function exportPayslip(empId, month) {
    try {
        const employee = employees.find(emp => emp.id === empId);
        if (!employee) {
            throw new Error('Employee not found');
        }
        
        const salaryRecord = salaryRecords.find(record => 
            record.empId === empId && record.month === month
        );
        
        if (!salaryRecord) {
            throw new Error('Salary record not found');
        }
        
        // Create a simple HTML payslip
        const payslipHTML = `
            <html>
                <head>
                    <title>Payslip - ${employee.name} - ${month}</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        .header { text-align: center; margin-bottom: 20px; }
                        .company-name { font-size: 24px; font-weight: bold; }
                        .payslip-title { font-size: 18px; margin: 10px 0; }
                        .details { margin-bottom: 20px; }
                        .detail-row { display: flex; margin-bottom: 5px; }
                        .detail-label { width: 150px; font-weight: bold; }
                        .table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                        .table th, .table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        .table th { background-color: #f2f2f2; }
                        .total-row { font-weight: bold; }
                        .footer { margin-top: 30px; text-align: center; font-size: 12px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="company-name">COMPANY NAME</div>
                        <div class="payslip-title">PAYSLIP FOR ${month}</div>
                    </div>
                    
                    <div class="details">
                        <div class="detail-row">
                            <div class="detail-label">Employee Name:</div>
                            <div>${employee.name}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Employee ID:</div>
                            <div>${employee.id}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Department:</div>
                            <div>${employee.department || 'N/A'}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Payment Date:</div>
                            <div>${formatDate(new Date().toISOString())}</div>
                        </div>
                    </div>
                    
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Description</th>
                                <th>Amount (Ksh)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Basic Salary</td>
                                <td>${salaryRecord.grossSalary.toFixed(2)}</td>
                            </tr>
                            <tr>
                                <td>Deductions</td>
                                <td>-${salaryRecord.deductions.toFixed(2)}</td>
                            </tr>
                            ${salaryRecord.bonus > 0 ? `
                            <tr>
                                <td>Bonus</td>
                                <td>${salaryRecord.bonus.toFixed(2)}</td>
                            </tr>
                            ` : ''}
                            <tr class="total-row">
                                <td>Net Salary</td>
                                <td>${salaryRecord.netSalary.toFixed(2)}</td>
                            </tr>
                        </tbody>
                    </table>
                    
                    <div class="footer">
                        <p>This is an automated payslip. Please contact HR for any discrepancies.</p>
                        <p>Generated on ${formatDate(new Date().toISOString())}</p>
                    </div>
                </body>
            </html>
        `;
        
        // In a real application, this would convert HTML to PDF and download
        // For demo purposes, we'll just show the HTML in a new window
        const printWindow = window.open('', '_blank');
        printWindow.document.write(payslipHTML);
        printWindow.document.close();
        
        showAlert('Payslip exported successfully!');
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Print payslip
function printPayslip(empId, month) {
    try {
        const employee = employees.find(emp => emp.id === empId);
        if (!employee) {
            throw new Error('Employee not found');
        }
        
        const salaryRecord = salaryRecords.find(record => 
            record.empId === empId && record.month === month
        );
        
        if (!salaryRecord) {
            throw new Error('Salary record not found');
        }
        
        // Create a simple HTML payslip
        const payslipHTML = `
            <html>
                <head>
                    <title>Payslip - ${employee.name} - ${month}</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        .header { text-align: center; margin-bottom: 20px; }
                        .company-name { font-size: 24px; font-weight: bold; }
                        .payslip-title { font-size: 18px; margin: 10px 0; }
                        .details { margin-bottom: 20px; }
                        .detail-row { display: flex; margin-bottom: 5px; }
                        .detail-label { width: 150px; font-weight: bold; }
                        .table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                        .table th, .table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        .table th { background-color: #f2f2f2; }
                        .total-row { font-weight: bold; }
                        .footer { margin-top: 30px; text-align: center; font-size: 12px; }
                        @media print {
                            body { padding: 0; margin: 0; }
                            .no-print { display: none !important; }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="company-name">COMPANY NAME</div>
                        <div class="payslip-title">PAYSLIP FOR ${month}</div>
                    </div>
                    
                    <div class="details">
                        <div class="detail-row">
                            <div class="detail-label">Employee Name:</div>
                            <div>${employee.name}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Employee ID:</div>
                            <div>${employee.id}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Department:</div>
                            <div>${employee.department || 'N/A'}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Payment Date:</div>
                            <div>${formatDate(new Date().toISOString())}</div>
                        </div>
                    </div>
                    
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Description</th>
                                <th>Amount (Ksh)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Basic Salary</td>
                                <td>${salaryRecord.grossSalary.toFixed(2)}</td>
                            </tr>
                            <tr>
                                <td>Deductions</td>
                                <td>-${salaryRecord.deductions.toFixed(2)}</td>
                            </tr>
                            ${salaryRecord.bonus > 0 ? `
                            <tr>
                                <td>Bonus</td>
                                <td>${salaryRecord.bonus.toFixed(2)}</td>
                            </tr>
                            ` : ''}
                            <tr class="total-row">
                                <td>Net Salary</td>
                                <td>${salaryRecord.netSalary.toFixed(2)}</td>
                            </tr>
                        </tbody>
                    </table>
                    
                    <div class="footer">
                        <p>This is an automated payslip. Please contact HR for any discrepancies.</p>
                        <p>Generated on ${formatDate(new Date().toISOString())}</p>
                    </div>
                    
                    <div class="no-print" style="text-align: center; margin-top: 20px;">
                        <button onclick="window.print()" class="btn btn-primary">Print Payslip</button>
                        <button onclick="window.close()" class="btn btn-secondary">Close</button>
                    </div>
                    
                    <script>
                        // Auto-print when window loads
                        window.onload = function() {
                            setTimeout(function() {
                                window.print();
                            }, 500);
                        };
                    </script>
                </body>
            </html>
        `;
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(payslipHTML);
        printWindow.document.close();
        
        showAlert('Payslip opened for printing!');
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Calculate salaries for all employees
function calculateAllSalaries(month, emergencyCalc = false, includeBonus = false) {
    try {
        const activeEmployees = employees.filter(emp => emp.status === 'active');
        if (activeEmployees.length === 0) {
            throw new Error('No active employees found');
        }
        
        // Get the year and month for calculation
        let calcYear, calcMonth;
        if (month) {
            [calcYear, calcMonth] = month.split('-').map(Number);
        } else {
            const today = new Date();
            calcYear = today.getFullYear();
            calcMonth = today.getMonth() + 1;
        }
        
        const salaryResults = [];
        
        activeEmployees.forEach(employee => {
            // Similar calculation logic as calculateEmployeeSalary
            // For brevity, we'll just show a summary here
            const monthAttendance = attendanceRecords.filter(record => {
                try {
                    const [year, month] = record.date.split('-').map(Number);
                    return record.empId === employee.id && year === calcYear && month === calcMonth;
                } catch (error) {
                    console.error('Error parsing attendance record date:', record.date, error);
                    return false;
                }
            });
            
            const workingDays = monthAttendance.filter(att => att.status === 'on_time').length;
            const absentDays = monthAttendance.filter(att => att.status === 'absent').length;
            const lateMinutes = monthAttendance.reduce((sum, att) => sum + (att.minutesLate || 0), 0);
            
            const dailySalary = employee.salary / employee.workingDays;
            const lateDeduction = (lateMinutes / 60) * (dailySalary / 8);
            const absentDeduction = absentDays * dailySalary;
            
            const empDeductions = deductions.filter(ded => ded.empId === employee.id);
            const otherDeductions = empDeductions.reduce((sum, ded) => sum + ded.amount, 0);
            
            let bonus = 0;
            if (includeBonus) {
                const attendancePercentage = (workingDays / employee.workingDays) * 100;
                if (attendancePercentage >= 95) {
                    bonus = employee.salary * 0.1;
                } else if (attendancePercentage >= 90) {
                    bonus = employee.salary * 0.05;
                }
            }
            
            const totalDeductions = lateDeduction + absentDeduction + otherDeductions;
            const netSalary = employee.salary - totalDeductions + bonus;
            
            // Create salary record
            const salaryRecord = {
                empId: employee.id,
                month: `${calcYear}-${String(calcMonth).padStart(2, '0')}`,
                grossSalary: employee.salary,
                deductions: totalDeductions,
                bonus: bonus,
                netSalary: netSalary,
                status: 'calculated', // Will be updated to 'paid' when actually paid
                calculatedAt: new Date().toISOString(),
                workingDays: workingDays,
                absentDays: absentDays,
                lateMinutes: lateMinutes
            };
            
            // Check if salary already calculated for this month
            const existingIndex = salaryRecords.findIndex(record => 
                record.empId === employee.id && record.month === salaryRecord.month
            );
            
            if (existingIndex >= 0) {
                salaryRecords[existingIndex] = salaryRecord;
            } else {
                salaryRecords.push(salaryRecord);
            }
            
            salaryResults.push({
                id: employee.id,
                name: employee.name,
                salary: employee.salary,
                deductions: totalDeductions,
                bonus: bonus,
                netSalary: netSalary,
                status: netSalary > 0 ? 'Pending' : 'Paid'
            });
        });
        
        saveData();
        
        // Show summary
        const salaryResult = getElement('salaryResult');
        const salaryDetails = getElement('salaryDetails');
        
        if (!salaryResult || !salaryDetails) return;
        
        let html = `
            <div class="alert alert-info">
                <h4>Bulk Salary Calculation for ${calcYear}-${String(calcMonth).padStart(2, '0')}</h4>
                <p>Calculated salaries for ${activeEmployees.length} employees</p>
            </div>
            
            <div class="table-responsive">
                <table class="table table-striped">
                    <thead>
                        <tr>
                            <th>Employee ID</th>
                            <th>Name</th>
                            <th>Base Salary</th>
                            <th>Deductions</th>
                            ${includeBonus ? '<th>Bonus</th>' : ''}
                            <th>Net Salary</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        salaryResults.forEach(result => {
            html += `
                <tr>
                    <td>${result.id}</td>
                    <td>${result.name}</td>
                    <td>Ksh ${result.salary.toFixed(2)}</td>
                    <td>Ksh ${result.deductions.toFixed(2)}</td>
                    ${includeBonus ? `<td>Ksh ${result.bonus.toFixed(2)}</td>` : ''}
                    <td>Ksh ${result.netSalary.toFixed(2)}</td>
                    <td>${result.status}</td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
            
            <div class="row mt-3">
                <div class="col-md-4">
                    <div class="summary-card total">
                        <h5>Total Salaries</h5>
                        <div class="amount">Ksh ${salaryResults.reduce((sum, emp) => sum + emp.salary, 0).toFixed(2)}</div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="summary-card pending">
                        <h5>Total Deductions</h5>
                        <div class="amount">Ksh ${salaryResults.reduce((sum, emp) => sum + emp.deductions, 0).toFixed(2)}</div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="summary-card paid">
                        <h5>Total Net Pay</h5>
                        <div class="amount">Ksh ${salaryResults.reduce((sum, emp) => sum + emp.netSalary, 0).toFixed(2)}</div>
                    </div>
                </div>
            </div>
            
            <div class="d-flex justify-content-end mt-3">
                <button class="btn btn-primary me-2" id="markAllAsPaidBtn">Mark All as Paid</button>
                <button class="btn btn-success me-2" id="exportAllPayslipsBtn">Export All Payslips</button>
                <button class="btn btn-secondary" id="printAllPayslipsBtn">Print All Payslips</button>
            </div>
        `;
        
        salaryDetails.innerHTML = html;
        salaryResult.classList.remove('d-none');
        showAlert(`Calculated salaries for ${activeEmployees.length} employees`);
        
        // Add event listeners to the new buttons
        getElement('markAllAsPaidBtn')?.addEventListener('click', function() {
            markAllSalariesAsPaid(`${calcYear}-${String(calcMonth).padStart(2, '0')}`);
        });
        
        getElement('exportAllPayslipsBtn')?.addEventListener('click', function() {
            exportAllPayslips(`${calcYear}-${String(calcMonth).padStart(2, '0')}`);
        });
        
        getElement('printAllPayslipsBtn')?.addEventListener('click', function() {
            printAllPayslips(`${calcYear}-${String(calcMonth).padStart(2, '0')}`);
        });
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Mark all salaries as paid for a month
function markAllSalariesAsPaid(month) {
    try {
        const monthRecords = salaryRecords.filter(record => 
            record.month === month && record.status === 'calculated'
        );
        
        if (monthRecords.length === 0) {
            throw new Error('No calculated salaries found for this month');
        }
        
        if (confirm(`Mark ${monthRecords.length} salaries as paid for ${month}?`)) {
            monthRecords.forEach(record => {
                record.status = 'paid';
                record.paidAt = new Date().toISOString();
            });
            
            saveData();
            showAlert(`Marked ${monthRecords.length} salaries as paid for ${month}`);
            
            // Refresh the view
            const salaryDetails = getElement('salaryDetails');
            if (salaryDetails) {
                const rows = salaryDetails.querySelectorAll('tbody tr');
                rows.forEach(row => {
                    const statusCell = row.querySelector('td:last-child');
                    if (statusCell) {
                        statusCell.textContent = 'Paid';
                    }
                });
            }
        }
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Export all payslips for a month
function exportAllPayslips(month) {
    try {
        const monthRecords = salaryRecords.filter(record => record.month === month);
        
        if (monthRecords.length === 0) {
            throw new Error('No salary records found for this month');
        }
        
        // In a real application, this would create a ZIP file with all payslips
        // For demo purposes, we'll just show an alert
        showAlert(`Would export ${monthRecords.length} payslips for ${month} as a ZIP file`, 'info');
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Print all payslips for a month
function printAllPayslips(month) {
    try {
        const monthRecords = salaryRecords.filter(record => record.month === month);
        
        if (monthRecords.length === 0) {
            throw new Error('No salary records found for this month');
        }
        
        // In a real application, this would print all payslips
        // For demo purposes, we'll just show an alert
        showAlert(`Would print ${monthRecords.length} payslips for ${month}`, 'info');
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Enhanced employee search with better results handling
async function handleEmployeeSearch() {
    try {
        const searchTerm = getElement('searchTerm')?.value.toLowerCase();
        if (!searchTerm) {
            showAlert('Please enter a search term', 'warning');
            return;
        }
        
        const results = employees.filter(emp => 
            emp.id.toLowerCase().includes(searchTerm) || 
            emp.name.toLowerCase().includes(searchTerm)
        );
        
        const resultsDiv = getElement('searchResults');
        if (!resultsDiv) return;
        
        if (results.length === 0) {
            resultsDiv.innerHTML = '<div class="alert alert-info">No employees found matching your search.</div>';
            return;
        }
        
        let html = '<div class="row">';
        
        results.forEach(emp => {
            html += `
                <div class="col-md-6 mb-3">
                    <div class="employee-panel">
                        <div class="d-flex align-items-center">
                            ${emp.photoUrl ? `
                                <img src="${emp.photoUrl}" alt="${emp.name}" class="rounded-circle me-3" width="60" height="60">
                            ` : `
                                <div class="rounded-circle bg-secondary me-3 d-flex align-items-center justify-content-center" style="width: 60px; height: 60px;">
                                    <i class="bi bi-person-fill text-white" style="font-size: 1.5rem;"></i>
                                </div>
                            `}
                            <div>
                                <h5>${emp.name} <small class="text-muted">${emp.id}</small></h5>
                                <p>${emp.department ? emp.department.charAt(0).toUpperCase() + emp.department.slice(1) : 'No Department'} • ${emp.shift === 'day' ? 'Day Shift' : 'Night Shift'}</p>
                            </div>
                        </div>
                        <div class="mt-2">
                            <button class="btn btn-sm btn-primary view-employee" data-id="${emp.id}">View Details</button>
                            ${emp.status === 'active' ? `<button class="btn btn-sm btn-warning add-deduction" data-id="${emp.id}">Add Deduction</button>` : ''}
                            ${emp.email ? `<a href="mailto:${emp.email}" class="btn btn-sm btn-info ms-1"><i class="bi bi-envelope"></i></a>` : ''}
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        resultsDiv.innerHTML = html;
        
        // Add event listeners to the buttons
        document.querySelectorAll('.view-employee').forEach(btn => {
            btn.addEventListener('click', function() {
                const empId = this.getAttribute('data-id');
                showEmployeeDetails(empId);
            });
        });
        
        document.querySelectorAll('.add-deduction').forEach(btn => {
            btn.addEventListener('click', function() {
                const empId = this.getAttribute('data-id');
                const deductionEmpId = getElement('deductionEmpId');
                if (deductionEmpId) {
                    deductionEmpId.value = empId;
                }
                const modal = new bootstrap.Modal(getElement('deductionModal'));
                modal.show();
            });
        });
        
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Enhanced employee deregistration
async function handleEmployeeDeregistration(e) {
    e.preventDefault();
    
    try {
        const empId = getElement('deregisterEmpId')?.value;
        const reason = getElement('deregisterReason')?.value;
        const notes = getElement('deregisterNotes')?.value;
        
        if (!empId || !reason) {
            throw new Error('Employee ID and reason are required');
        }
        
        const employeeIndex = employees.findIndex(emp => emp.id === empId);
        
        if (employeeIndex === -1) {
            throw new Error('Employee not found!');
        }
        
        if (confirm(`Are you sure you want to deregister ${employees[employeeIndex].name}? This action cannot be undone.`)) {
            employees[employeeIndex].status = 'inactive';
            employees[employeeIndex].deregisterReason = reason;
            employees[employeeIndex].deregisterNotes = notes;
            employees[employeeIndex].deregisteredAt = new Date().toISOString();
            
            saveData();
            
            showAlert('Employee has been deregistered.');
            const deregisterForm = getElement('deregisterForm');
            if (deregisterForm) deregisterForm.reset();
        }
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Enhanced employee update
async function handleEmployeeUpdate() {
    try {
        const empId = getElement('modalEmpId')?.value;
        const empName = getElement('modalEmpName')?.value;
        const empPhone = getElement('modalEmpPhone')?.value;
        const empShift = getElement('modalEmpShift')?.value;
        const empWorkingDays = getElement('modalEmpWorkingDays')?.value;
        const empSalary = getElement('modalEmpSalary')?.value;
        const empPaymentDay = getElement('modalEmpPaymentDay')?.value;
        
        if (!empId || !empName) {
            throw new Error('Employee ID and Name are required');
        }
        
        const employeeIndex = employees.findIndex(emp => emp.id === empId);
        
        if (employeeIndex === -1) {
            throw new Error('Employee not found!');
        }
        
        const updatedEmployee = {
            ...employees[employeeIndex],
            name: empName,
            phone: empPhone,
            shift: empShift,
            workingDays: parseInt(empWorkingDays),
            salary: parseFloat(empSalary),
            paymentDay: parseInt(empPaymentDay),
            updatedAt: new Date().toISOString()
        };
        
        employees[employeeIndex] = updatedEmployee;
        saveData();
        
        const modal = bootstrap.Modal.getInstance(getElement('employeeModal'));
        if (modal) {
            modal.hide();
        }
        
        showAlert('Employee details updated successfully!');
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Enhanced deduction add
async function handleDeductionAdd(e) {
    e.preventDefault();
    
    try {
        const empId = getElement('deductionEmpId')?.value;
        const description = getElement('deductionDescription')?.value;
        const amount = parseFloat(getElement('deductionAmount')?.value);
        const date = getElement('deductionDate')?.value || new Date().toISOString().split('T')[0];
        
        if (!empId || !description || isNaN(amount) || amount <= 0) {
            throw new Error('Please fill all fields with valid values');
        }
        
        // Check if employee exists
        const employee = employees.find(emp => emp.id === empId);
        if (!employee) {
            throw new Error('Employee not found!');
        }
        
        const deduction = {
            id: Date.now().toString(), // Simple ID generation
            empId: empId,
            description: description,
            amount: amount,
            date: date,
            recordedAt: new Date().toISOString()
        };
        
        deductions.push(deduction);
        saveData();
        
        showAlert('Deduction added successfully!');
        
        const modal = bootstrap.Modal.getInstance(getElement('deductionModal'));
        if (modal) {
            modal.hide();
        }
        
        const deductionForm = getElement('deductionForm');
        if (deductionForm) deductionForm.reset();
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Enhanced data management functions
function updateLateEmployeesList() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const lateEmployees = attendanceRecords.filter(record => 
            record.date === today && record.status === 'late'
        );
        
        const listElement = getElement('lateEmployeesList');
        if (!listElement) return;
        
        listElement.innerHTML = '';
        
        if (lateEmployees.length === 0) {
            listElement.innerHTML = '<tr><td colspan="6" class="text-center">No late employees today</td></tr>';
            return;
        }
        
        lateEmployees.forEach(record => {
            const employee = employees.find(emp => emp.id === record.empId);
            if (employee) {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${employee.id}</td>
                    <td>${employee.name}</td>
                    <td>${record.shiftType === 'day' ? 'Day Shift' : 'Night Shift'}</td>
                    <td>${record.arrivalTime}</td>
                    <td>${record.minutesLate}</td>
                    <td>
                        <button class="btn btn-sm btn-primary edit-attendance" data-id="${record.empId}" data-date="${record.date}">
                            <i class="bi bi-pencil"></i> Edit
                        </button>
                    </td>
                `;
                listElement.appendChild(row);
            }
        });
        
        // Add event listeners to edit buttons
        document.querySelectorAll('.edit-attendance').forEach(btn => {
            btn.addEventListener('click', function() {
                const empId = this.getAttribute('data-id');
                const date = this.getAttribute('data-date');
                editAttendanceRecord(empId, date);
            });
        });
    } catch (error) {
        console.error('Error updating late employees list:', error);
    }
}

// Enhanced edit attendance record
function editAttendanceRecord(empId, date) {
    try {
        const record = attendanceRecords.find(att => att.empId === empId && att.date === date);
        if (!record) {
            throw new Error('Attendance record not found');
        }
        
        // Populate edit form
        const editAttendanceId = getElement('editAttendanceId');
        const editAttendanceDate = getElement('editAttendanceDate');
        const editArrivalTime = getElement('editArrivalTime');
        const editShiftType = getElement('editShiftType');
        
        if (!editAttendanceId || !editAttendanceDate || !editArrivalTime || !editShiftType) return;
        
        editAttendanceId.value = `${empId}_${date}`;
        editAttendanceDate.value = record.date;
        editArrivalTime.value = record.arrivalTime;
        editShiftType.value = record.shiftType;
        
        // Set up form submission
        const form = getElement('editAttendanceForm');
        if (form) {
            form.onsubmit = function(e) {
                e.preventDefault();
                saveEditedAttendance();
            };
        }
        
        // Set up delete button
        const deleteAttendanceBtn = getElement('deleteAttendanceBtn');
        if (deleteAttendanceBtn) {
            deleteAttendanceBtn.onclick = function() {
                deleteAttendanceRecord(empId, date);
            };
        }
        
        // Show modal
        const modal = new bootstrap.Modal(getElement('editAttendanceModal'));
        modal.show();
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Enhanced save edited attendance
function saveEditedAttendance() {
    try {
        const editAttendanceId = getElement('editAttendanceId');
        const editAttendanceDate = getElement('editAttendanceDate');
        const editArrivalTime = getElement('editArrivalTime');
        const editShiftType = getElement('editShiftType');
        
        if (!editAttendanceId || !editAttendanceDate || !editArrivalTime || !editShiftType) return;
        
        const idParts = editAttendanceId.value.split('_');
        const empId = idParts[0];
        const oldDate = idParts[1];
        
        const newDate = editAttendanceDate.value;
        const arrivalTime = editArrivalTime.value;
        const shiftType = editShiftType.value;
        
        // Find the record
        const recordIndex = attendanceRecords.findIndex(att => 
            att.empId === empId && att.date === oldDate
        );
        
        if (recordIndex === -1) {
            throw new Error('Record not found');
        }
        
        // Calculate if late
        const arrivalDateTime = new Date(`${newDate}T${arrivalTime}`);
        if (isNaN(arrivalDateTime.getTime())) {
            throw new Error('Invalid time format');
        }
        
        let expectedTime, minutesLate = 0;
        let status = 'on_time';
        
        if (shiftType === 'day') {
            expectedTime = new Date(`${newDate}T09:30:00`);
        } else {
            expectedTime = new Date(`${newDate}T21:30:00`);
        }
        
        if (isNaN(expectedTime.getTime())) {
            throw new Error('Invalid shift time calculation');
        }
        
        if (arrivalDateTime > expectedTime) {
            minutesLate = Math.round((arrivalDateTime - expectedTime) / (1000 * 60));
            status = 'late';
        }
        
        // Update the record
        attendanceRecords[recordIndex] = {
            ...attendanceRecords[recordIndex],
            date: newDate,
            arrivalTime: arrivalTime,
            shiftType: shiftType,
            status: status,
            minutesLate: minutesLate,
            updatedAt: new Date().toISOString()
        };
        
        saveData();
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(getElement('editAttendanceModal'));
        if (modal) {
            modal.hide();
        }
        
        showAlert('Attendance record updated successfully!');
        updateLateEmployeesList();
        updateAbsentEmployeesList();
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Enhanced delete attendance record
function deleteAttendanceRecord(empId, date) {
    try {
        if (!confirm('Are you sure you want to delete this attendance record?')) {
            return;
        }
        
        const recordIndex = attendanceRecords.findIndex(att => 
            att.empId === empId && att.date === date
        );
        
        if (recordIndex === -1) {
            throw new Error('Record not found');
        }
        
        // Remove from local storage
        attendanceRecords.splice(recordIndex, 1);
        saveData();
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(getElement('editAttendanceModal'));
        if (modal) {
            modal.hide();
        }
        
        showAlert('Attendance record deleted successfully!');
        updateLateEmployeesList();
        updateAbsentEmployeesList();
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Enhanced update absent employees list
function updateAbsentEmployeesList() {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        // Get all active employees
        const activeEmployees = employees.filter(emp => emp.status === 'active');
        
        // Get employees who have attendance records today
        const presentEmployees = attendanceRecords
            .filter(record => record.date === today)
            .map(record => record.empId);
        
        // Get employees on leave today
        const onLeaveEmployees = leaveRecords
            .filter(record => record.startDate <= today && record.endDate >= today)
            .map(record => record.empId);
        
        // Absent employees are active, not present, and not on leave
        const absentEmployees = activeEmployees.filter(emp => 
            !presentEmployees.includes(emp.id) && !onLeaveEmployees.includes(emp.id)
        );
        
        const listElement = getElement('absentEmployeesList');
        if (!listElement) return;
        
        listElement.innerHTML = '';
        
        if (absentEmployees.length === 0) {
            listElement.innerHTML = '<tr><td colspan="4" class="text-center">No absent employees today</td></tr>';
            return;
        }
        
        absentEmployees.forEach(employee => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${employee.id}</td>
                <td>${employee.name}</td>
                <td>${employee.shift === 'day' ? 'Day Shift' : 'Night Shift'}</td>
                <td>
                    <button class="btn btn-sm btn-danger mark-absent" data-id="${employee.id}">
                        <i class="bi bi-x-circle"></i> Mark Absent
                    </button>
                </td>
            `;
            listElement.appendChild(row);
        });
        
        // Add event listeners to mark absent buttons
        document.querySelectorAll('.mark-absent').forEach(btn => {
            btn.addEventListener('click', function() {
                const empId = this.getAttribute('data-id');
                markEmployeeAbsent(empId, today);
            });
        });
    } catch (error) {
        console.error('Error updating absent employees list:', error);
    }
}

// Enhanced mark employee absent
function markEmployeeAbsent(empId, date) {
    try {
        if (confirm('Mark this employee as absent for the whole day?')) {
            // Check if already marked
            const existingRecord = attendanceRecords.find(record => 
                record.empId === empId && record.date === date
            );
            
            if (existingRecord) {
                throw new Error('Attendance already recorded for this employee today!');
            }
            
            const attendanceRecord = {
                empId: empId,
                date: date,
                arrivalTime: null,
                shiftType: null,
                status: 'absent',
                minutesLate: 0,
                recordedAt: new Date().toISOString()
            };
            
            attendanceRecords.push(attendanceRecord);
            saveData();
            
            showAlert('Employee marked as absent.');
            updateAbsentEmployeesList();
        }
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Enhanced update leave days list
function updateLeaveDaysList() {
    try {
        const listElement = getElement('leaveDaysList');
        if (!listElement) return;
        
        listElement.innerHTML = '';
        
        if (leaveRecords.length === 0) {
            listElement.innerHTML = '<tr><td colspan="6" class="text-center">No leave/rest days recorded</td></tr>';
            return;
        }
        
        leaveRecords.forEach((record, index) => {
            const employee = employees.find(emp => emp.id === record.empId);
            if (employee) {
                const today = new Date().toISOString().split('T')[0];
                const isActive = record.startDate <= today && record.endDate >= today;
                const isOverdue = new Date(record.endDate) < new Date(today);
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${employee.id}</td>
                    <td>${employee.name}</td>
                    <td>${record.type === 'paid_leave' ? 'Paid Leave' : 
                          record.type === 'sick_leave' ? 'Sick Leave' :
                          record.type === 'maternity_leave' ? 'Maternity Leave' :
                          record.type === 'paternity_leave' ? 'Paternity Leave' : 'Rest Day'}</td>
                    <td>${formatDate(record.startDate)}</td>
                    <td>${formatDate(record.endDate)}</td>
                    <td>
                        <span class="badge ${isActive ? 'bg-success' : isOverdue ? 'bg-danger' : 'bg-info'}">
                            ${isActive ? 'Active' : isOverdue ? 'Overdue' : 'Upcoming'}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-primary edit-leave" data-index="${index}">
                            <i class="bi bi-pencil"></i> Edit
                        </button>
                    </td>
                `;
                listElement.appendChild(row);
            }
        });
        
        // Add event listeners to edit buttons
        document.querySelectorAll('.edit-leave').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.getAttribute('data-index'));
                editLeaveRecord(index);
            });
        });
    } catch (error) {
        console.error('Error updating leave days list:', error);
    }
}

// Enhanced edit leave record
function editLeaveRecord(index) {
    try {
        const record = leaveRecords[index];
        if (!record) {
            throw new Error('Leave record not found');
        }
        
        // Populate edit form
        const editLeaveId = getElement('editLeaveId');
        const editLeaveType = getElement('editLeaveType');
        const editLeaveStartDate = getElement('editLeaveStartDate');
        const editLeaveEndDate = getElement('editLeaveEndDate');
        const editLeaveReason = getElement('editLeaveReason');
        
        if (!editLeaveId || !editLeaveType || !editLeaveStartDate || !editLeaveEndDate) return;
        
        editLeaveId.value = index;
        editLeaveType.value = record.type;
        editLeaveStartDate.value = record.startDate;
        editLeaveEndDate.value = record.endDate;
        if (editLeaveReason) editLeaveReason.value = record.reason || '';
        
        // Set up form submission
        const form = getElement('editLeaveForm');
        if (form) {
            form.onsubmit = function(e) {
                e.preventDefault();
                saveEditedLeave();
            };
        }
        
        // Set up delete button
        const deleteLeaveBtn = getElement('deleteLeaveBtn');
        if (deleteLeaveBtn) {
            deleteLeaveBtn.onclick = function() {
                deleteLeaveRecord(index);
            };
        }
        
        // Show modal
        const modal = new bootstrap.Modal(getElement('editLeaveModal'));
        modal.show();
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Enhanced save edited leave
function saveEditedLeave() {
    try {
        const editLeaveId = getElement('editLeaveId');
        const editLeaveType = getElement('editLeaveType');
        const editLeaveStartDate = getElement('editLeaveStartDate');
        const editLeaveEndDate = getElement('editLeaveEndDate');
        const editLeaveReason = getElement('editLeaveReason');
        
        if (!editLeaveId || !editLeaveType || !editLeaveStartDate || !editLeaveEndDate) return;
        
        const index = parseInt(editLeaveId.value);
        const type = editLeaveType.value;
        const startDate = editLeaveStartDate.value;
        const endDate = editLeaveEndDate.value;
        const reason = editLeaveReason ? editLeaveReason.value : '';
        
        if (index < 0 || index >= leaveRecords.length) {
            throw new Error('Invalid record index');
        }
        
        if (new Date(startDate) > new Date(endDate)) {
            throw new Error('Start date cannot be after end date');
        }
        
        // Update the record
        leaveRecords[index] = {
            ...leaveRecords[index],
            type: type,
            startDate: startDate,
            endDate: endDate,
            reason: reason,
            updatedAt: new Date().toISOString()
        };
        
        saveData();
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(getElement('editLeaveModal'));
        if (modal) {
            modal.hide();
        }
        
        showAlert('Leave record updated successfully!');
        updateLeaveDaysList();
        updateAbsentEmployeesList();
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Enhanced delete leave record
function deleteLeaveRecord(index) {
    try {
        if (!confirm('Are you sure you want to delete this leave record?')) {
            return;
        }
        
        if (index < 0 || index >= leaveRecords.length) {
            throw new Error('Invalid record index');
        }
        
        // Remove from local storage
        leaveRecords.splice(index, 1);
        saveData();
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(getElement('editLeaveModal'));
        if (modal) {
            modal.hide();
        }
        
        showAlert('Leave record deleted successfully!');
        updateLeaveDaysList();
        updateAbsentEmployeesList();
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Enhanced show employee details
function showEmployeeDetails(empId) {
    try {
        const employee = employees.find(emp => emp.id === empId);
        if (!employee) {
            throw new Error('Employee not found');
        }
        
        const modalTitle = getElement('employeeModalTitle');
        const modalBody = getElement('employeeModalBody');
        
        if (!modalTitle || !modalBody) return;
        
        modalTitle.textContent = `Employee Details - ${employee.name}`;
        
        // Get employee's records
        const empAttendance = attendanceRecords.filter(record => record.empId === empId);
        const empDeductions = deductions.filter(ded => ded.empId === empId);
        const empLeaves = leaveRecords.filter(leave => leave.empId === empId);
        const empSalaries = salaryRecords.filter(salary => salary.empId === empId);
        
        // Calculate total deductions
        const totalDeductions = empDeductions.reduce((sum, ded) => sum + ded.amount, 0);
        
        // Create HTML for modal
        let html = `
            <div class="row mb-4">
                <div class="col-md-3">
                    ${employee.photoUrl ? `
                        <img src="${employee.photoUrl}" alt="${employee.name}" class="img-fluid rounded">
                    ` : `
                        <div class="bg-secondary rounded d-flex align-items-center justify-content-center" style="height: 200px;">
                            <i class="bi bi-person-fill text-white" style="font-size: 3rem;"></i>
                        </div>
                    `}
                </div>
                <div class="col-md-9">
                    <form id="editEmployeeForm">
                        <input type="hidden" id="modalEmpId" value="${employee.id}">
                        <div class="row mb-3">
                            <div class="col-md-6">
                                <label for="modalEmpName" class="form-label">Full Name</label>
                                <input type="text" class="form-control" id="modalEmpName" value="${employee.name}" required>
                            </div>
                            <div class="col-md-6">
                                <label for="modalEmpPhone" class="form-label">Phone Number</label>
                                <input type="tel" class="form-control" id="modalEmpPhone" value="${employee.phone}" required>
                            </div>
                        </div>
                        <div class="row mb-3">
                            <div class="col-md-6">
                                <label for="modalEmpShift" class="form-label">Shift Type</label>
                                <select class="form-select" id="modalEmpShift" required>
                                    <option value="day" ${employee.shift === 'day' ? 'selected' : ''}>Day Shift</option>
                                    <option value="night" ${employee.shift === 'night' ? 'selected' : ''}>Night Shift</option>
                                </select>
                            </div>
                            <div class="col-md-6">
                                <label for="modalEmpWorkingDays" class="form-label">Working Days</label>
                                <input type="number" class="form-control" id="modalEmpWorkingDays" value="${employee.workingDays}" min="1" max="31" required>
                            </div>
                        </div>
                        <div class="row mb-3">
                            <div class="col-md-6">
                                <label for="modalEmpSalary" class="form-label">Salary (Ksh)</label>
                                <input type="number" class="form-control" id="modalEmpSalary" value="${employee.salary}" min="0" step="0.01" required>
                            </div>
                            <div class="col-md-6">
                                <label for="modalEmpPaymentDay" class="form-label">Payment Day</label>
                                <input type="number" class="form-control" id="modalEmpPaymentDay" value="${employee.paymentDay}" min="1" max="31" required>
                            </div>
                        </div>
                        <div class="row mb-3">
                            <div class="col-md-6">
                                <label for="modalEmpDepartment" class="form-label">Department</label>
                                <select class="form-select" id="modalEmpDepartment">
                                    <option value="kitchen" ${employee.department === 'kitchen' ? 'selected' : ''}>Kitchen</option>
                                    <option value="service" ${employee.department === 'service' ? 'selected' : ''}>Service</option>
                                    <option value="management" ${employee.department === 'management' ? 'selected' : ''}>Management</option>
                                    <option value="housekeeping" ${employee.department === 'housekeeping' ? 'selected' : ''}>Housekeeping</option>
                                    <option value="other" ${!employee.department || employee.department === 'other' ? 'selected' : ''}>Other</option>
                                </select>
                            </div>
                            <div class="col-md-6">
                                <label for="modalEmpEmail" class="form-label">Email</label>
                                <input type="email" class="form-control" id="modalEmpEmail" value="${employee.email || ''}">
                            </div>
                        </div>
                    </form>
                </div>
            </div>
            
            <ul class="nav nav-tabs" id="employeeTabs" role="tablist">
                <li class="nav-item" role="presentation">
                    <button class="nav-link active" id="attendance-tab" data-bs-toggle="tab" data-bs-target="#attendance-tab-pane" type="button" role="tab">Attendance</button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" id="leave-tab" data-bs-toggle="tab" data-bs-target="#leave-tab-pane" type="button" role="tab">Leave</button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" id="deductions-tab" data-bs-toggle="tab" data-bs-target="#deductions-tab-pane" type="button" role="tab">Deductions</td>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" id="salary-tab" data-bs-toggle="tab" data-bs-target="#salary-tab-pane" type="button" role="tab">Salary History</td>
                </li>
            </ul>
            
            <div class="tab-content p-3 border border-top-0 rounded-bottom" id="employeeTabsContent">
                <div class="tab-pane fade show active" id="attendance-tab-pane" role="tabpanel">
                    <h5>Attendance Records</h5>
                    <div class="table-responsive">
                        <table class="table table-sm">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Shift</th>
                                    <th>Arrival Time</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
        `;
        
        if (empAttendance.length === 0) {
            html += '<tr><td colspan="5" class="text-center">No attendance records</td></tr>';
        } else {
            empAttendance.forEach(record => {
                html += `
                    <tr>
                        <td>${formatDate(record.date)}</td>
                        <td>${record.shiftType === 'day' ? 'Day' : 'Night'}</td>
                        <td>${record.arrivalTime || 'N/A'}</td>
                        <td>
                            ${record.status === 'on_time' ? 
                                '<span class="on-time-status">On Time</span>' : 
                              record.status === 'late' ? 
                                `<span class="late-status">Late (${record.minutesLate} mins)</span>` : 
                                '<span class="absent-status">Absent</span>'}
                        </td>
                        <td>
                            <button class="btn btn-sm btn-primary edit-attendance" data-id="${record.empId}" data-date="${record.date}">
                                <i class="bi bi-pencil"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
        }
        
        html += `
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <div class="tab-pane fade" id="leave-tab-pane" role="tabpanel">
                    <h5>Leave/Rest Days</h5>
                    <div class="table-responsive">
                        <table class="table table-sm">
                            <thead>
                                <tr>
                                    <th>Type</th>
                                    <th>Start Date</th>
                                    <th>End Date</th>
                                    <th>Reason</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
        `;
        
        if (empLeaves.length === 0) {
            html += '<tr><td colspan="6" class="text-center">No leave/rest days</td></tr>';
        } else {
            empLeaves.forEach((leave, index) => {
                const today = new Date().toISOString().split('T')[0];
                const isActive = leave.startDate <= today && leave.endDate >= today;
                const isOverdue = new Date(leave.endDate) < new Date(today);
                
                html += `
                    <tr>
                        <td>${leave.type === 'paid_leave' ? 'Paid Leave' : 
                              leave.type === 'sick_leave' ? 'Sick Leave' :
                              leave.type === 'maternity_leave' ? 'Maternity Leave' :
                              leave.type === 'paternity_leave' ? 'Paternity Leave' : 'Rest Day'}</td>
                        <td>${formatDate(leave.startDate)}</td>
                        <td>${formatDate(leave.endDate)}</td>
                        <td>${leave.reason || 'N/A'}</td>
                        <td>
                            <span class="badge ${isActive ? 'bg-success' : isOverdue ? 'bg-danger' : 'bg-info'}">
                                ${isActive ? 'Active' : isOverdue ? 'Overdue' : 'Upcoming'}
                            </span>
                        </td>
                        <td>
                            <button class="btn btn-sm btn-primary edit-leave" data-index="${index}">
                                <i class="bi bi-pencil"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
        }
        
        html += `
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <div class="tab-pane fade" id="deductions-tab-pane" role="tabpanel">
                    <h5>Deductions</h5>
                    <div class="mb-3">
                        <strong>Total Deductions: Ksh ${totalDeductions.toFixed(2)}</strong>
                    </div>
                    <div class="deductions-list">
        `;
        
        if (empDeductions.length === 0) {
            html += '<div class="alert alert-info">No deductions recorded</div>';
        } else {
            empDeductions.forEach((ded, index) => {
                html += `
                    <div class="deduction-item mb-2 p-2 border rounded">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <strong>${ded.description}</strong>
                                <div class="text-muted small">${formatDate(ded.date)}</div>
                            </div>
                            <div class="d-flex align-items-center">
                                <span class="me-3">Ksh ${ded.amount.toFixed(2)}</span>
                                <button class="btn btn-sm btn-primary edit-deduction" data-index="${index}">
                                    <i class="bi bi-pencil"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
        }
        
        html += `
                    </div>
                </div>
                
                <div class="tab-pane fade" id="salary-tab-pane" role="tabpanel">
                    <h5>Salary History</h5>
                    <div class="table-responsive">
                        <table class="table table-sm">
                            <thead>
                                <tr>
                                    <th>Month</th>
                                    <th>Gross Salary</th>
                                    <th>Deductions</th>
                                    <th>Bonus</th>
                                    <th>Net Salary</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
        `;
        
        if (empSalaries.length === 0) {
            html += '<tr><td colspan="7" class="text-center">No salary records</td></tr>';
        } else {
            empSalaries.forEach((salary, index) => {
                html += `
                    <tr>
                        <td>${salary.month}</td>
                        <td>Ksh ${salary.grossSalary.toFixed(2)}</td>
                        <td>Ksh ${salary.deductions.toFixed(2)}</td>
                        <td>Ksh ${salary.bonus.toFixed(2)}</td>
                        <td>Ksh ${salary.netSalary.toFixed(2)}</td>
                        <td>
                            <span class="badge ${salary.status === 'paid' ? 'bg-success' : 'bg-warning'}">
                                ${salary.status === 'paid' ? 'Paid' : 'Pending'}
                            </span>
                        </td>
                        <td>
                            <button class="btn btn-sm btn-primary view-salary" data-index="${index}">
                                <i class="bi bi-eye"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
        }
        
        html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        
        modalBody.innerHTML = html;
        
        // Add event listeners to edit buttons
        document.querySelectorAll('.edit-attendance').forEach(btn => {
            btn.addEventListener('click', function() {
                const empId = this.getAttribute('data-id');
                const date = this.getAttribute('data-date');
                editAttendanceRecord(empId, date);
            });
        });
        
        document.querySelectorAll('.edit-leave').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.getAttribute('data-index'));
                editLeaveRecord(index);
            });
        });
        
        document.querySelectorAll('.edit-deduction').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.getAttribute('data-index'));
                editDeductionRecord(index);
            });
        });
        
        document.querySelectorAll('.view-salary').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.getAttribute('data-index'));
                viewSalaryRecord(index);
            });
        });
        
        const modal = new bootstrap.Modal(getElement('employeeModal'));
        modal.show();
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// View salary record
function viewSalaryRecord(index) {
    try {
        const salaryRecord = salaryRecords[index];
        if (!salaryRecord) {
            throw new Error('Salary record not found');
        }
        
        const employee = employees.find(emp => emp.id === salaryRecord.empId);
        if (!employee) {
            throw new Error('Employee not found');
        }
        
        const modalTitle = getElement('salaryModalTitle');
        const modalBody = getElement('salaryModalBody');
        
        if (!modalTitle || !modalBody) return;
        
        modalTitle.textContent = `Salary Details - ${employee.name} - ${salaryRecord.month}`;
        
        modalBody.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <p><strong>Employee:</strong> ${employee.name} (${employee.id})</p>
                    <p><strong>Month:</strong> ${salaryRecord.month}</p>
                    <p><strong>Shift:</strong> ${employee.shift === 'day' ? 'Day Shift' : 'Night Shift'}</p>
                    <p><strong>Department:</strong> ${employee.department || 'N/A'}</p>
                </div>
                <div class="col-md-6">
                    <p><strong>Agreed Salary:</strong> Ksh ${employee.salary.toFixed(2)}</p>
                    <p><strong>Working Days:</strong> ${employee.workingDays}</p>
                    <p><strong>Payment Day:</strong> ${employee.paymentDay}</p>
                    <p><strong>Status:</strong> ${employee.status === 'active' ? 'Active' : 'Inactive'}</p>
                </div>
            </div>
            
            <hr>
            
            <div class="row">
                <div class="col-md-6">
                    <h5>Attendance Summary</h5>
                    <p>Working Days: ${salaryRecord.workingDays}</p>
                    <p>Absent Days: ${salaryRecord.absentDays}</p>
                    <p>Late Minutes: ${salaryRecord.lateMinutes} (${(salaryRecord.lateMinutes/60).toFixed(1)} hours)</p>
                </div>
                <div class="col-md-6">
                    <h5>Salary Breakdown</h5>
                    <p>Gross Salary: Ksh ${salaryRecord.grossSalary.toFixed(2)}</p>
                    <p>Deductions: Ksh ${salaryRecord.deductions.toFixed(2)}</p>
                    <p>Bonus: Ksh ${salaryRecord.bonus.toFixed(2)}</p>
                </div>
            </div>
            
            <hr>
            
            <div class="alert alert-success">
                <h4>Net Salary: Ksh ${salaryRecord.netSalary.toFixed(2)}</h4>
                <p class="mb-0">Status: ${salaryRecord.status === 'paid' ? 'Paid' : 'Pending'}</p>
            </div>
            
            <div class="d-flex justify-content-end">
                <button class="btn btn-primary me-2" id="emailSalaryBtn">Email Payslip</button>
                <button class="btn btn-info me-2" id="exportSalaryBtn">Export Payslip</button>
                <button class="btn btn-secondary" id="printSalaryBtn">Print Payslip</button>
            </div>
        `;
        
        // Add event listeners to buttons
        getElement('emailSalaryBtn')?.addEventListener('click', function() {
            emailPayslip(salaryRecord.empId, salaryRecord.month);
        });
        
        getElement('exportSalaryBtn')?.addEventListener('click', function() {
            exportPayslip(salaryRecord.empId, salaryRecord.month);
        });
        
        getElement('printSalaryBtn')?.addEventListener('click', function() {
            printPayslip(salaryRecord.empId, salaryRecord.month);
        });
        
        const modal = new bootstrap.Modal(getElement('salaryModal'));
        modal.show();
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Enhanced edit deduction record
function editDeductionRecord(index) {
    try {
        const deduction = deductions[index];
        if (!deduction) {
            throw new Error('Deduction record not found');
        }
        
        // Populate edit form
        const editDeductionId = getElement('editDeductionId');
        const editDeductionDescription = getElement('editDeductionDescription');
        const editDeductionAmount = getElement('editDeductionAmount');
        const editDeductionDate = getElement('editDeductionDate');
        
        if (!editDeductionId || !editDeductionDescription || !editDeductionAmount || !editDeductionDate) return;
        
        editDeductionId.value = index;
        editDeductionDescription.value = deduction.description;
        editDeductionAmount.value = deduction.amount;
        editDeductionDate.value = deduction.date;
        
        // Set up form submission
        const form = getElement('editDeductionForm');
        if (form) {
            form.onsubmit = function(e) {
                e.preventDefault();
                saveEditedDeduction();
            };
        }
        
        // Set up delete button
        const deleteDeductionBtn = getElement('deleteDeductionBtn');
        if (deleteDeductionBtn) {
            deleteDeductionBtn.onclick = function() {
                deleteDeductionRecord(index);
            };
        }
        
        // Show modal
        const modal = new bootstrap.Modal(getElement('editDeductionModal'));
        modal.show();
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Enhanced save edited deduction
function saveEditedDeduction() {
    try {
        const editDeductionId = getElement('editDeductionId');
        const editDeductionDescription = getElement('editDeductionDescription');
        const editDeductionAmount = getElement('editDeductionAmount');
        const editDeductionDate = getElement('editDeductionDate');
        
        if (!editDeductionId || !editDeductionDescription || !editDeductionAmount || !editDeductionDate) return;
        
        const index = parseInt(editDeductionId.value);
        const description = editDeductionDescription.value;
        const amount = parseFloat(editDeductionAmount.value);
        const date = editDeductionDate.value;
        
        if (index < 0 || index >= deductions.length) {
            throw new Error('Invalid deduction index');
        }
        
        if (!description || isNaN(amount) || amount <= 0) {
            throw new Error('Please fill all fields with valid values');
        }
        
        // Update the deduction
        deductions[index] = {
            ...deductions[index],
            description: description,
            amount: amount,
            date: date,
            updatedAt: new Date().toISOString()
        };
        
        saveData();
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(getElement('editDeductionModal'));
        if (modal) {
            modal.hide();
        }
        
        showAlert('Deduction updated successfully!');
        
        // If showing employee details, refresh the view
        const modalTitle = getElement('employeeModalTitle');
        if (modalTitle && modalTitle.textContent.includes('Employee Details')) {
            const empId = getElement('modalEmpId').value;
            showEmployeeDetails(empId);
        }
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Enhanced delete deduction record
function deleteDeductionRecord(index) {
    try {
        if (!confirm('Are you sure you want to delete this deduction?')) {
            return;
        }
        
        if (index < 0 || index >= deductions.length) {
            throw new Error('Invalid deduction index');
        }
        
        // Remove from local storage
        deductions.splice(index, 1);
        saveData();
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(getElement('editDeductionModal'));
        if (modal) {
            modal.hide();
        }
        
        showAlert('Deduction deleted successfully!');
        
        // If showing employee details, refresh the view
        const modalTitle = getElement('employeeModalTitle');
        if (modalTitle && modalTitle.textContent.includes('Employee Details')) {
            const empId = getElement('modalEmpId').value;
            showEmployeeDetails(empId);
        }
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Enhanced export functions
function exportToCSV(data, filename) {
    try {
        if (!data || data.length === 0) {
            throw new Error('No data to export!');
        }
        
        // Extract headers
        const headers = Object.keys(data[0]);
        
        // Create CSV content
        let csvContent = headers.join(',') + '\n';
        
        data.forEach(item => {
            const row = headers.map(header => {
                // Escape quotes and wrap in quotes if contains comma
                let value = item[header] !== undefined ? item[header] : '';
                value = String(value).replace(/"/g, '""');
                if (String(value).includes(',')) {
                    value = `"${value}"`;
                }
                return value;
            });
            csvContent += row.join(',') + '\n';
        });
        
        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showAlert(`Exported data to ${filename}`);
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Enhanced search suggestions with better performance
function initSearchSuggestions() {
    const suggestionMappings = [
        { inputId: 'attendanceEmpId', dropdownId: 'employeeSuggestions' },
        { inputId: 'leaveEmpId', dropdownId: 'leaveEmployeeSuggestions' },
        { inputId: 'salaryEmpId', dropdownId: 'salaryEmployeeSuggestions' },
        { inputId: 'deregisterEmpId', dropdownId: 'deregisterEmployeeSuggestions' },
        { inputId: 'searchTerm', dropdownId: 'searchSuggestions' },
        { inputId: 'recordEmpId', dropdownId: 'recordEmployeeSuggestions' }
    ];
    
    suggestionMappings.forEach(mapping => {
        setupSuggestions(mapping.inputId, mapping.dropdownId);
    });
}

function setupSuggestions(inputId, dropdownId) {
    const input = getElement(inputId);
    const dropdown = getElement(dropdownId);
    
    if (!input || !dropdown) return;
    
    // Debounce the input event to improve performance
    let debounceTimer;
    input.addEventListener('input', function() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const searchTerm = this.value.trim().toLowerCase();
            if (searchTerm.length === 0) {
                dropdown.style.display = 'none';
                return;
            }
            
            const suggestions = employees.filter(emp => 
                emp.id.toLowerCase().includes(searchTerm) || 
                emp.name.toLowerCase().includes(searchTerm)
            ).slice(0, 5);
            
            renderSuggestions(suggestions, dropdown, input);
        }, 300);
    });
    
    // Hide dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (e.target !== input) {
            dropdown.style.display = 'none';
        }
    });
}

function renderSuggestions(suggestions, dropdown, input) {
    if (!dropdown) return;
    
    if (suggestions.length === 0) {
        dropdown.style.display = 'none';
        return;
    }
    
    dropdown.innerHTML = '';
    suggestions.forEach(emp => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.textContent = `${emp.id} - ${emp.name}`;
        div.addEventListener('click', function() {
            input.value = emp.id;
            dropdown.style.display = 'none';
        });
        dropdown.appendChild(div);
    });
    
    dropdown.style.display = 'block';
}

// Enhanced chatbot functions
function initChatbot() {
    const chatbotToggle = getElement('chatbotToggle');
    const chatbotWindow = getElement('chatbotWindow');
    const chatbotClose = getElement('chatbotClose');
    const sendChatbotQuery = getElement('sendChatbotQuery');
    const chatbotQuery = getElement('chatbotQuery');
    const chatbotMessages = getElement('chatbotMessages');
    
    if (!chatbotToggle || !chatbotWindow) return;
    
    // Toggle chatbot window
    chatbotToggle.addEventListener('click', function() {
        chatbotWindow.classList.toggle('show');
    });
    
    if (chatbotClose) {
        chatbotClose.addEventListener('click', function() {
            chatbotWindow.classList.remove('show');
        });
    }
    
    // Send message
    if (sendChatbotQuery) {
        sendChatbotQuery.addEventListener('click', sendChatMessage);
    }
    
    if (chatbotQuery) {
        chatbotQuery.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendChatMessage();
            }
        });
    }
    
    // Sample questions
    if (chatbotMessages) {
        addSampleQuestions();
    }
}

function addSampleQuestions() {
    const chatbotMessages = getElement('chatbotMessages');
    if (!chatbotMessages) return;
    
    const sampleQuestions = [
        "List all employees",
        "Who is late today?",
        "Show absent employees",
        "How many employees do we have?",
        "Show employees in the kitchen department"
    ];
    
    const container = document.createElement('div');
    container.className = 'sample-questions';
    
    sampleQuestions.forEach(question => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-sm btn-outline-primary me-2 mb-2';
        btn.textContent = question;
        btn.addEventListener('click', function() {
            const chatbotQuery = getElement('chatbotQuery');
            if (chatbotQuery) {
                chatbotQuery.value = question;
                sendChatMessage();
            }
        });
        container.appendChild(btn);
    });
    
    chatbotMessages.appendChild(container);
}

function sendChatMessage() {
    const chatbotQuery = getElement('chatbotQuery');
    const chatbotMessages = getElement('chatbotMessages');
    
    if (!chatbotQuery || !chatbotMessages) return;
    
    const query = chatbotQuery.value.trim();
    if (query === '') return;
    
    // Add user message
    addChatMessage(query, 'user');
    chatbotQuery.value = '';
    
    // Process query
    processChatQuery(query);
}

function addChatMessage(message, sender) {
    const chatbotMessages = getElement('chatbotMessages');
    if (!chatbotMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chatbot-message ${sender}-message`;
    messageDiv.textContent = message;
    chatbotMessages.appendChild(messageDiv);
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
}

function processChatQuery(query) {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('list all employees') || lowerQuery.includes('show all employees')) {
        const activeEmployees = employees.filter(emp => emp.status === 'active');
        if (activeEmployees.length === 0) {
            addChatMessage('There are no active employees in the system.', 'bot');
            return;
        }
        
        let response = 'Active Employees:\n';
        activeEmployees.forEach(emp => {
            response += `- ${emp.name} (${emp.id}), ${emp.shift === 'day' ? 'Day Shift' : 'Night Shift'}\n`;
        });
        addChatMessage(response, 'bot');
    } 
    else if (lowerQuery.includes('late today') || lowerQuery.includes('who is late')) {
        const today = new Date().toISOString().split('T')[0];
        const lateEmployees = attendanceRecords.filter(record => 
            record.date === today && record.status === 'late'
        );
        
        if (lateEmployees.length === 0) {
            addChatMessage('No employees are late today.', 'bot');
            return;
        }
        
        let response = 'Late Employees Today:\n';
        lateEmployees.forEach(record => {
            const employee = employees.find(emp => emp.id === record.empId);
            if (employee) {
                response += `- ${employee.name} (${record.minutesLate} minutes late)\n`;
            }
        });
        addChatMessage(response, 'bot');
    }
    else if (lowerQuery.includes('absent') || lowerQuery.includes('who is absent')) {
        const today = new Date().toISOString().split('T')[0];
        const activeEmployees = employees.filter(emp => emp.status === 'active');
        const presentEmployees = attendanceRecords
            .filter(record => record.date === today)
            .map(record => record.empId);
        const onLeaveEmployees = leaveRecords
            .filter(record => record.startDate <= today && record.endDate >= today)
            .map(record => record.empId);
        const absentEmployees = activeEmployees.filter(emp => 
            !presentEmployees.includes(emp.id) && !onLeaveEmployees.includes(emp.id)
        );
        
        if (absentEmployees.length === 0) {
            addChatMessage('No employees are absent today.', 'bot');
            return;
        }
        
        let response = 'Absent Employees Today:\n';
        absentEmployees.forEach(emp => {
            response += `- ${emp.name} (${emp.id})\n`;
        });
        addChatMessage(response, 'bot');
    }
    else if (lowerQuery.includes('how many employees') || lowerQuery.includes('number of employees')) {
        const activeCount = employees.filter(emp => emp.status === 'active').length;
        const inactiveCount = employees.filter(emp => emp.status !== 'active').length;
        addChatMessage(`There are ${activeCount} active employees and ${inactiveCount} inactive employees in the system.`, 'bot');
    }
    else if (lowerQuery.includes('department') || lowerQuery.includes('show employees in')) {
        const departmentMatch = query.match(/department\s+(\w+)|in\s+the\s+(\w+)\s+department|in\s+(\w+)/i);
        const department = departmentMatch ? 
            (departmentMatch[1] || departmentMatch[2] || departmentMatch[3]).toLowerCase() : 
            null;
        
        if (!department) {
            addChatMessage("Please specify which department you're interested in.", 'bot');
            return;
        }
        
        const deptEmployees = employees.filter(emp => 
            emp.status === 'active' && 
            emp.department && 
            emp.department.toLowerCase() === department
        );
        
        if (deptEmployees.length === 0) {
            addChatMessage(`No active employees found in the ${department} department.`, 'bot');
            return;
        }
        
        let response = `Employees in ${department} department:\n`;
        deptEmployees.forEach(emp => {
            response += `- ${emp.name} (${emp.id}), ${emp.shift === 'day' ? 'Day Shift' : 'Night Shift'}\n`;
        });
        addChatMessage(response, 'bot');
    }
    else if (lowerQuery.includes('help') || lowerQuery.includes('what can you do')) {
        const helpText = `I can help you with:
- Listing all employees
- Showing late employees
- Showing absent employees
- Telling you how many employees we have
- Showing employees by department
- Answering questions about employee data`;
        addChatMessage(helpText, 'bot');
    }
    else {
        addChatMessage("I'm sorry, I didn't understand that. Try asking about employees, late arrivals, absences, or departments.", 'bot');
    }
}

// Enhanced check for late employees and notify
function checkLateEmployees() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();
        const currentHour = now.getHours();
        
        // Only check during working hours (8AM-6PM)
        if (currentHour < 8 || currentHour > 18) return;
        
        const lateEmployees = attendanceRecords.filter(record => 
            record.date === today && record.status === 'late'
        );
        
        if (lateEmployees.length > 0 && settings.enableNotifications) {
            notifyLateEmployees(lateEmployees);
        }
    } catch (error) {
        console.error('Error checking late employees:', error);
    }
}

// Enhanced notify late employees
function notifyLateEmployees(lateEmployees) {
    if (!('Notification' in window)) {
        console.log('This browser does not support notifications');
        return;
    }
    
    if (Notification.permission === 'granted') {
        showLateNotification(lateEmployees);
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                showLateNotification(lateEmployees);
            }
        }).catch(error => {
            console.error('Notification permission error:', error);
        });
    }
}

// Enhanced show late notification
function showLateNotification(lateEmployees) {
    const employeeNames = lateEmployees.map(record => {
        const employee = employees.find(emp => emp.id === record.empId);
        return employee ? employee.name : '';
    }).filter(name => name !== '');
    
    if (employeeNames.length === 0) return;
    
    try {
        const notification = new Notification('Late Employees', {
            body: `The following employees are late today: ${employeeNames.join(', ')}`,
            icon: 'https://cdn-icons-png.flaticon.com/512/3143/3143463.png'
        });
        
        // Play sound
        playNotificationSound();
        
        // If email notifications are enabled, send email
        if (settings.enableEmailNotifications && settings.notificationEmail) {
            sendLateEmailNotification(employeeNames);
        }
    } catch (error) {
        console.error('Error showing notification:', error);
    }
}

// Enhanced play notification sound
function playNotificationSound() {
    try {
        const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-alarm-digital-clock-beep-989.mp3');
        audio.play().catch(e => console.log('Audio play failed:', e));
    } catch (error) {
        console.error('Error playing notification sound:', error);
    }
}

// Enhanced send late email notification
function sendLateEmailNotification(employeeNames) {
    // In a real application, you would send this to your backend
    // which would then send the actual email
    console.log(`Would send email to ${settings.notificationEmail} about late employees: ${employeeNames.join(', ')}`);
    
    // For demo purposes, we'll just show an alert
    showAlert(`Email notification sent to ${settings.notificationEmail} about late employees`, 'info');
}

// Salary Reports Functions
function generateSalaryReport() {
    try {
        const month = getElement('reportMonth')?.value;
        if (!month) {
            throw new Error('Please select a month first');
        }

        const [year, monthNum] = month.split('-');
        const monthName = new Date(year, monthNum - 1, 1).toLocaleString('default', { month: 'long' });
        
        const activeEmployees = employees.filter(emp => emp.status === 'active');
        if (activeEmployees.length === 0) {
            throw new Error('No active employees found');
        }

        // Get salary records for the selected month
        const reportData = salaryRecords.filter(record => 
            record.month === month && employees.some(emp => emp.id === record.empId && emp.status === 'active')
        );

        // If no salary records found, calculate them
        if (reportData.length === 0) {
            showAlert('No salary records found for this month. Calculating salaries now...', 'info');
            calculateAllSalaries(month, false, false);
            return;
        }

        // Update summary
        updateSalarySummary(reportData, monthName, year);
        
        // Update pending payments
        updatePendingPayments(reportData);
        
        // Update detailed report
        updateDetailedReport(reportData);

        showAlert(`Salary report generated for ${monthName} ${year}`);
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

function updateSalarySummary(reportData, monthName, year) {
    const summaryDiv = getElement('salarySummary');
    if (!summaryDiv) return;
    
    const totalSalaries = reportData.reduce((sum, emp) => sum + emp.grossSalary, 0);
    const totalDeductions = reportData.reduce((sum, emp) => sum + emp.deductions, 0);
    const totalNetPay = reportData.reduce((sum, emp) => sum + emp.netSalary, 0);
    const pendingCount = reportData.filter(emp => emp.status === 'calculated').length;
    const paidCount = reportData.filter(emp => emp.status === 'paid').length;
    
    summaryDiv.innerHTML = `
        <h5>${monthName} ${year} Summary</h5>
        <p>Total Employees: ${reportData.length}</p>
        <p>Total Salaries: Ksh ${totalSalaries.toFixed(2)}</p>
        <p>Total Deductions: Ksh ${totalDeductions.toFixed(2)}</p>
        <p>Total Net Pay: Ksh ${totalNetPay.toFixed(2)}</p>
        <p>Pending Payments: ${pendingCount}</p>
        <p>Completed Payments: ${paidCount}</p>
    `;
}

function updatePendingPayments(reportData) {
    const pendingDiv = getElement('pendingPayments');
    if (!pendingDiv) return;
    
    const pendingEmployees = reportData.filter(emp => emp.status === 'calculated');
    
    if (pendingEmployees.length === 0) {
        pendingDiv.innerHTML = '<p>No pending payments</p>';
        return;
    }
    
    let html = '<ul class="list-group">';
    pendingEmployees.forEach(emp => {
        const employee = employees.find(e => e.id === emp.empId);
        if (employee) {
            html += `
                <li class="list-group-item d-flex justify-content-between align-items-center">
                    ${employee.name} (${employee.id})
                    <span class="badge bg-primary rounded-pill">Ksh ${emp.netSalary.toFixed(2)}</span>
                </li>
            `;
        }
    });
    html += '</ul>';
    
    pendingDiv.innerHTML = html;
}

function updateDetailedReport(reportData) {
    const tbody = getElement('detailedReportBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    reportData.forEach(record => {
        const employee = employees.find(emp => emp.id === record.empId);
        if (employee) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${employee.id}</td>
                <td>${employee.name}</td>
                <td>Ksh ${record.grossSalary.toFixed(2)}</td>
                <td>Ksh ${record.deductions.toFixed(2)}</td>
                <td>Ksh ${record.netSalary.toFixed(2)}</td>
                <td class="${record.status === 'calculated' ? 'text-warning' : 'text-success'}">${record.status === 'calculated' ? 'Pending' : 'Paid'}</td>
            `;
            tbody.appendChild(row);
        }
    });
}

function exportSalaryReport() {
    try {
        const month = getElement('reportMonth')?.value;
        if (!month) {
            throw new Error('Please generate a report first');
        }
        
        const [year, monthNum] = month.split('-');
        const monthName = new Date(year, monthNum - 1, 1).toLocaleString('default', { month: 'long' });
        
        const table = getElement('detailedReportTable');
        if (!table) {
            throw new Error('Report table not found');
        }
        
        // Create CSV content
        let csvContent = 'Employee ID,Name,Base Salary,Deductions,Net Salary,Status\n';
        
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const cols = row.querySelectorAll('td');
            const rowData = Array.from(cols).map(col => {
                // Remove Ksh and commas for proper CSV formatting
                let text = col.textContent.replace('Ksh ', '').replace(/,/g, '');
                // Wrap in quotes if contains comma
                if (text.includes(',')) {
                    text = `"${text}"`;
                }
                return text;
            });
            csvContent += rowData.join(',') + '\n';
        });
        
        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `salary_report_${monthName}_${year}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showAlert('Salary report exported successfully!');
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

function printSalaryReport() {
    try {
        const reportDiv = getElement('salaryReports');
        if (!reportDiv) {
            throw new Error('Report section not found');
        }
        
        // Create a clone of the report section for printing
        const printContent = reportDiv.cloneNode(true);
        
        // Remove buttons from print view
        const buttons = printContent.querySelectorAll('button');
        buttons.forEach(btn => btn.remove());
        
        // Create a new window for printing
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Salary Report</title>
                    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                    <style>
                        @media print {
                            body { padding: 20px; }
                            .no-print { display: none !important; }
                        }
                    </style>
                </head>
                <body>
                    <h2>Salary Report</h2>
                    ${printContent.innerHTML}
                    <script>
                        window.onload = function() {
                            window.print();
                            setTimeout(function() {
                                window.close();
                            }, 1000);
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Mark all employees as present for today
function markAllEmployeesPresent() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const activeEmployees = employees.filter(emp => emp.status === 'active');
        
        if (activeEmployees.length === 0) {
            showAlert('No active employees found', 'warning');
            return;
        }
        
        if (!confirm(`Mark all ${activeEmployees.length} active employees as present for today?`)) {
            return;
        }
        
        activeEmployees.forEach(employee => {
            // Check if attendance already recorded for today
            const existingRecord = attendanceRecords.find(record => 
                record.empId === employee.id && record.date === today
            );
            
            if (!existingRecord) {
                const attendanceRecord = {
                    empId: employee.id,
                    date: today,
                    arrivalTime: '09:00', // Default arrival time
                    shiftType: employee.shift,
                    status: 'on_time',
                    minutesLate: 0,
                    recordedAt: new Date().toISOString()
                };
                
                attendanceRecords.push(attendanceRecord);
            }
        });
        
        saveData();
        showAlert(`Marked all ${activeEmployees.length} employees as present for today`);
        updateLateEmployeesList();
        updateAbsentEmployeesList();
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Export all employees
function exportAllEmployees() {
    try {
        if (employees.length === 0) {
            throw new Error('No employees to export');
        }
        
        // Prepare data for export
        const exportData = employees.map(emp => ({
            id: emp.id,
            name: emp.name,
            phone: emp.phone,
            email: emp.email || '',
            shift: emp.shift === 'day' ? 'Day Shift' : 'Night Shift',
            workingDays: emp.workingDays,
            salary: emp.salary,
            paymentDay: emp.paymentDay,
            department: emp.department || '',
            status: emp.status === 'active' ? 'Active' : 'Inactive',
            registered: formatDate(emp.createdAt),
            lastUpdated: emp.updatedAt ? formatDate(emp.updatedAt) : 'N/A'
        }));
        
        exportToCSV(exportData, 'employee_directory.csv');
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Print employee directory
function printEmployeeDirectory() {
    try {
        if (employees.length === 0) {
            throw new Error('No employees to print');
        }
        
        // Create HTML for directory
        let html = `
            <html>
                <head>
                    <title>Employee Directory</title>
                    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                    <style>
                        @media print {
                            body { padding: 20px; }
                            .no-print { display: none !important; }
                        }
                    </style>
                </head>
                <body>
                    <h2 class="text-center mb-4">Employee Directory</h2>
                    <p class="text-end mb-4">Generated on: ${formatDate(new Date().toISOString())}</p>
                    <table class="table table-striped">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Phone</th>
                                <th>Email</th>
                                <th>Shift</th>
                                <th>Department</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        employees.forEach(emp => {
            html += `
                <tr>
                    <td>${emp.id}</td>
                    <td>${emp.name}</td>
                    <td>${emp.phone}</td>
                    <td>${emp.email || 'N/A'}</td>
                    <td>${emp.shift === 'day' ? 'Day' : 'Night'}</td>
                    <td>${emp.department || 'N/A'}</td>
                    <td>${emp.status === 'active' ? 'Active' : 'Inactive'}</td>
                </tr>
            `;
        });
        
        html += `
                        </tbody>
                    </table>
                    <div class="no-print text-center mt-4">
                        <button onclick="window.print()" class="btn btn-primary">Print Directory</button>
                        <button onclick="window.close()" class="btn btn-secondary ms-2">Close</button>
                    </div>
                    <script>
                        // Auto-print when window loads
                        window.onload = function() {
                            setTimeout(function() {
                                window.print();
                            }, 500);
                        };
                    </script>
                </body>
            </html>
        `;
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(html);
        printWindow.document.close();
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Export all data
function exportAllData() {
    try {
        const data = {
            employees: employees,
            attendanceRecords: attendanceRecords,
            leaveRecords: leaveRecords,
            deductions: deductions,
            salaryRecords: salaryRecords,
            settings: settings,
            exportedAt: new Date().toISOString()
        };
        
        const dataStr = JSON.stringify(data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `employee_management_system_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showAlert('All data exported successfully!');
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Import data
function importData() {
    try {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        
        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const data = JSON.parse(e.target.result);
                    
                    if (!data.employees || !data.attendanceRecords || !data.leaveRecords || !data.deductions || !data.settings) {
                        throw new Error('Invalid data format');
                    }
                    
                    if (confirm('This will overwrite all current data. Are you sure?')) {
                        employees = data.employees;
                        attendanceRecords = data.attendanceRecords;
                        leaveRecords = data.leaveRecords;
                        deductions = data.deductions;
                        salaryRecords = data.salaryRecords || [];
                        settings = data.settings;
                        
                        saveData();
                        showAlert('Data imported successfully! The page will now refresh.');
                        setTimeout(() => location.reload(), 1000);
                    }
                } catch (error) {
                    showAlert('Error importing data: ' + error.message, 'error');
                }
            };
            reader.readAsText(file);
        });
        
        fileInput.click();
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Update salary reports panel
function updateSalaryReports() {
    try {
        const reportsBody = getElement('salaryReportsBody');
        if (!reportsBody) return;
        
        reportsBody.innerHTML = '';
        
        if (salaryRecords.length === 0) {
            reportsBody.innerHTML = '<tr><td colspan="6" class="text-center">No salary records found</td></tr>';
            return;
        }
        
        // Group by month
        const monthlyReports = {};
        salaryRecords.forEach(record => {
            if (!monthlyReports[record.month]) {
                monthlyReports[record.month] = [];
            }
            monthlyReports[record.month].push(record);
        });
        
        // Display each month's records
        Object.keys(monthlyReports).sort().reverse().forEach(month => {
            const monthRecords = monthlyReports[month];
            const [year, monthNum] = month.split('-');
            const monthName = new Date(year, monthNum - 1, 1).toLocaleString('default', { month: 'long' });
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${monthName} ${year}</td>
                <td>${monthRecords.length}</td>
                <td>Ksh ${monthRecords.reduce((sum, r) => sum + r.grossSalary, 0).toFixed(2)}</td>
                <td>Ksh ${monthRecords.reduce((sum, r) => sum + r.deductions, 0).toFixed(2)}</td>
                <td>Ksh ${monthRecords.reduce((sum, r) => sum + r.netSalary, 0).toFixed(2)}</td>
                <td>
                    <span class="badge ${monthRecords.every(r => r.status === 'paid') ? 'bg-success' : 'bg-warning'}">
                        ${monthRecords.every(r => r.status === 'paid') ? 'Paid' : 'Pending'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-primary view-monthly-report" data-month="${month}">
                        <i class="bi bi-eye"></i> View
                    </button>
                </td>
            `;
            reportsBody.appendChild(row);
        });
        
        // Add event listeners to view buttons
        document.querySelectorAll('.view-monthly-report').forEach(btn => {
            btn.addEventListener('click', function() {
                const month = this.getAttribute('data-month');
                viewMonthlyReport(month);
            });
        });
    } catch (error) {
        console.error('Error updating salary reports:', error);
    }
}

// View monthly report
function viewMonthlyReport(month) {
    try {
        const [year, monthNum] = month.split('-');
        const monthName = new Date(year, monthNum - 1, 1).toLocaleString('default', { month: 'long' });
        
        const monthRecords = salaryRecords.filter(record => record.month === month);
        if (monthRecords.length === 0) {
            throw new Error('No records found for this month');
        }
        
        // Set the report month dropdown
        const reportMonth = getElement('reportMonth');
        if (reportMonth) {
            reportMonth.value = month;
        }
        
        // Generate the report
        generateSalaryReport();
        
        // Scroll to the reports section
        const reportsSection = getElement('salaryReportsSection');
        if (reportsSection) {
            reportsSection.scrollIntoView({ behavior: 'smooth' });
        }
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

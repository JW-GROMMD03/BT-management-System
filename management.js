// Initialize Supabase client with better error handling
let MySQL;
// API Configuration
const API_BASE_URL = 'http://your-api-domain.com/api';
let authToken = localStorage.getItem('authToken') || '';

// Employee data structure (will be populated from API)
let employees = [];
let attendanceRecords = [];
let leaveRecords = [];
let deductions = [];
let settings = {
    enableNotifications: true,
    enableEmailNotifications: false,
    notificationEmail: '',
    darkMode: false,
    deductionRate: 0.5 // Ksh per minute for overstay deductions
};

// Queue for pending sync operations
let syncQueue = [];
let isSyncing = false;

async function initializeData() {
    try {
        // Load settings from localStorage
        const savedSettings = localStorage.getItem('settings');
        if (savedSettings) {
            settings = JSON.parse(savedSettings);
            applySettings();
        }

        // Fetch all data from API if authenticated
        if (authToken) {
            await Promise.all([
                fetchEmployees(),
                fetchAttendanceRecords(),
                fetchLeaveRecords(),
                fetchDeductions()
            ]);
        }
    } catch (error) {
        console.error('Error initializing data:', error);
        showAlert('Error loading data', 'error');
    }
}

// API Helper Functions
async function apiRequest(endpoint, method = 'GET', body = null) {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
    };

    const config = {
        method,
        headers,
        body: body ? JSON.stringify(body) : null
    };

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'API request failed');
        }

        return await response.json();
    } catch (error) {
        console.error(`API request error (${endpoint}):`, error);
        throw error;
    }
}

// Test database connection
async function testMySQLConnection() {
    const host = getElement('dbHost')?.value || 'localhost';
    const port = getElement('dbPort')?.value || 3306;
    const user = getElement('dbUser')?.value;
    const password = getElement('dbPassword')?.value;
    const database = getElement('dbName')?.value || 'employee_db';
    
    if (!user || !password) {
        showAlert('Please enter both username and password', 'error');
        return;
    }
    
    const statusDiv = getElement('dbConnectionStatus');
    if (!statusDiv) return;
    
    try {
        statusDiv.className = 'alert alert-info mt-3';
        statusDiv.innerHTML = '<i class="bi bi-hourglass"></i> Testing connection...';
        statusDiv.classList.remove('d-none');
        
        const dbConfig = { host, port, user, password, database };
        const result = await apiRequest('/database/connect', 'POST', dbConfig);
        
        if (result.connected) {
            statusDiv.className = 'alert alert-success mt-3';
            statusDiv.innerHTML = '<i class="bi bi-check-circle"></i> Connection successful!';
            
            // Save the credentials
            localStorage.setItem('dbHost', host);
            localStorage.setItem('dbPort', port);
            localStorage.setItem('dbUser', user);
            localStorage.setItem('dbPassword', password);
            localStorage.setItem('dbName', database);
            
            // Store the auth token if provided
            if (result.token) {
                authToken = result.token;
                localStorage.setItem('authToken', authToken);
            }
        } else {
            throw new Error(result.message || 'Connection failed');
        }
    } catch (error) {
        console.error('Connection test failed:', error);
        statusDiv.className = 'alert alert-danger mt-3';
        statusDiv.innerHTML = `<i class="bi bi-x-circle"></i> Connection failed: ${error.message || 'Unknown error'}`;
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeData();
    setupEventListeners();
    
    // Set default dates
    const today = new Date().toISOString().split('T')[0];
    const attendanceDate = getElement('attendanceDate');
    if (attendanceDate) attendanceDate.value = today;
    
    // Initialize UI
    updateLateEmployeesList();
    updateAbsentEmployeesList();
    updateLeaveDaysList();
});



// Database Connection Functions
async function testDatabaseConnection(dbConfig) {
    try {
        const response = await apiRequest('/database/test-connection', 'POST', dbConfig);
        return response.connected;
    } catch (error) {
        console.error('Database connection test failed:', error);
        throw error;
    }
}

// Data Fetching Functions
async function fetchEmployees() {
    try {
        const data = await apiRequest('/employees');
        employees = data;
        return employees;
    } catch (error) {
        console.error('Error fetching employees:', error);
        throw error;
    }
}

async function fetchAttendanceRecords() {
    try {
        const data = await apiRequest('/attendance');
        attendanceRecords = data;
        return attendanceRecords;
    } catch (error) {
        console.error('Error fetching attendance records:', error);
        throw error;
    }
}

async function fetchLeaveRecords() {
    try {
        const data = await apiRequest('/leaves');
        leaveRecords = data;
        return leaveRecords;
    } catch (error) {
        console.error('Error fetching leave records:', error);
        throw error;
    }
}

async function fetchDeductions() {
    try {
        const data = await apiRequest('/deductions');
        deductions = data;
        return deductions;
    } catch (error) {
        console.error('Error fetching deductions:', error);
        throw error;
    }
}

// Data Saving Functions
async function saveEmployee(employee) {
    try {
        const endpoint = employee.id ? `/employees/${employee.id}` : '/employees';
        const method = employee.id ? 'PUT' : 'POST';
        
        const savedEmployee = await apiRequest(endpoint, method, employee);
        
        // Update local cache
        const index = employees.findIndex(e => e.id === savedEmployee.id);
        if (index >= 0) {
            employees[index] = savedEmployee;
        } else {
            employees.push(savedEmployee);
        }
        
        return savedEmployee;
    } catch (error) {
        console.error('Error saving employee:', error);
        throw error;
    }
}

async function saveAttendanceRecord(record) {
    try {
        const endpoint = record.id ? `/attendance/${record.id}` : '/attendance';
        const method = record.id ? 'PUT' : 'POST';
        
        const savedRecord = await apiRequest(endpoint, method, record);
        
        // Update local cache
        const index = attendanceRecords.findIndex(a => a.id === savedRecord.id);
        if (index >= 0) {
            attendanceRecords[index] = savedRecord;
        } else {
            attendanceRecords.push(savedRecord);
        }
        
        return savedRecord;
    } catch (error) {
        console.error('Error saving attendance record:', error);
        throw error;
    }
}

async function saveLeaveRecord(record) {
    try {
        const endpoint = record.id ? `/leaves/${record.id}` : '/leaves';
        const method = record.id ? 'PUT' : 'POST';
        
        const savedRecord = await apiRequest(endpoint, method, record);
        
        // Update local cache
        const index = leaveRecords.findIndex(l => l.id === savedRecord.id);
        if (index >= 0) {
            leaveRecords[index] = savedRecord;
        } else {
            leaveRecords.push(savedRecord);
        }
        
        return savedRecord;
    } catch (error) {
        console.error('Error saving leave record:', error);
        throw error;
    }
}

async function saveDeduction(deduction) {
    try {
        const endpoint = deduction.id ? `/deductions/${deduction.id}` : '/deductions';
        const method = deduction.id ? 'PUT' : 'POST';
        
        const savedDeduction = await apiRequest(endpoint, method, deduction);
        
        // Update local cache
        const index = deductions.findIndex(d => d.id === savedDeduction.id);
        if (index >= 0) {
            deductions[index] = savedDeduction;
        } else {
            deductions.push(savedDeduction);
        }
        
        return savedDeduction;
    } catch (error) {
        console.error('Error saving deduction:', error);
        throw error;
    }
}


// Apply settings to the UI
function applySettings() {
    try {
        // Apply dark mode
        if (settings.darkMode) {
            document.body.classList.add('dark-mode');
            const darkModeBtn = document.getElementById('toggleDarkMode');
            if (darkModeBtn) darkModeBtn.innerHTML = '<i class="bi bi-sun-fill"></i> Light Mode';
        } else {
            document.body.classList.remove('dark-mode');
            const darkModeBtn = document.getElementById('toggleDarkMode');
            if (darkModeBtn) darkModeBtn.innerHTML = '<i class="bi bi-moon-fill"></i> Dark Mode';
        }
        
        // Apply notification settings
        const notificationsCheckbox = document.getElementById('enableNotifications');
        const emailNotificationsCheckbox = document.getElementById('enableEmailNotifications');
        const notificationEmailInput = document.getElementById('notificationEmail');
        
        if (notificationsCheckbox) notificationsCheckbox.checked = settings.enableNotifications;
        if (emailNotificationsCheckbox) emailNotificationsCheckbox.checked = settings.enableEmailNotifications;
        if (notificationEmailInput) notificationEmailInput.value = settings.notificationEmail || '';
    } catch (error) {
        console.error('Error applying settings:', error);
    }
}

// DOM Elements with null checks and memoization
const elementCache = {};
function getElement(id) {
    if (elementCache[id]) return elementCache[id];
    
    const element = document.getElementById(id);
    if (!element) {
        console.error(`Element with ID ${id} not found`);
        return null;
    }
    
    elementCache[id] = element;
    return element;
}

// Utility functions with improved error handling
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
        
        const alertsContainer = document.getElementById('alertsContainer') || document.body;
        alertsContainer.prepend(alertDiv);
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            try {
                const bsAlert = new bootstrap.Alert(alertDiv);
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

function validateEmployeeData(employee) {
    if (!employee.id || !employee.name) {
        throw new Error('Employee ID and Name are required');
    }
    
    // Updated ID validation to allow special characters and spaces
    if (!/^[A-Za-z0-9\-_@#$%&* ]+$/.test(employee.id)) {
        throw new Error('Employee ID can contain alphanumeric characters, spaces, and special characters (-_@#$%&*)');
    }
    
    if (employee.workingDays < 1 || employee.workingDays > 31) {
        throw new Error('Working days must be between 1 and 31');
    }
    
    if (employee.salary <= 0) {
        throw new Error('Salary must be a positive number');
    }
    
    if (employee.paymentDay < 1 || employee.paymentDay > 31) {
        throw new Error('Payment day must be between 1 and 31');
    }
    
    return true;
}

// Save data to localStorage with compression and better error handling
function saveToLocalStorage() {
    try {
        // Compress data before saving to localStorage
        localStorage.setItem('employees', LZString.compress(JSON.stringify(employees)));
        localStorage.setItem('attendance', LZString.compress(JSON.stringify(attendanceRecords)));
        localStorage.setItem('leaveRecords', LZString.compress(JSON.stringify(leaveRecords)));
        localStorage.setItem('deductions', LZString.compress(JSON.stringify(deductions)));
        localStorage.setItem('settings', JSON.stringify(settings));
        localStorage.setItem('syncQueue', JSON.stringify(syncQueue));
        
        // If online and Supabase is connected, try to sync
        if (navigator.onLine && supabase) {
            syncWithSupabase();
        }
    } catch (error) {
        console.error('Error saving to localStorage:', error);
        showAlert('Failed to save data. Please check console for details.', 'error');
        
        // If localStorage is full, try to clear some space
        if (error.name === 'QuotaExceededError') {
            handleLocalStorageFull();
        }
    }
}

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
        saveToLocalStorage();
        showAlert('Cleared old records to free up space. Please try again.', 'warning');
    } catch (error) {
        console.error('Error handling full localStorage:', error);
        showAlert('Local storage is full and cleanup failed. Some data may not be saved.', 'error');
    }
}

// Enhanced sync functions with better error recovery
async function syncWithSupabase() {
    if (!supabase || isSyncing) return;
    
    isSyncing = true;
    const syncStartTime = Date.now();
    showAlert('Starting data sync with database...', 'info');
    
    try {
        // Sync employees in batches to avoid timeouts
        const batchSize = 50;
        for (let i = 0; i < employees.length; i += batchSize) {
            const batch = employees.slice(i, i + batchSize);
            const { error: empError } = await supabase
                .from('employees')
                .upsert(batch, { onConflict: 'id' });
            
            if (empError) throw empError;
        }
        
        // Sync attendance in batches
        for (let i = 0; i < attendanceRecords.length; i += batchSize) {
            const batch = attendanceRecords.slice(i, i + batchSize);
            const { error: attError } = await supabase
                .from('attendance')
                .upsert(batch);
            
            if (attError) throw attError;
        }
        
        // Sync leave records
        for (let i = 0; i < leaveRecords.length; i += batchSize) {
            const batch = leaveRecords.slice(i, i + batchSize);
            const { error: leaveError } = await supabase
                .from('leave_records')
                .upsert(batch);
            
            if (leaveError) throw leaveError;
        }
        
        // Sync deductions
        for (let i = 0; i < deductions.length; i += batchSize) {
            const batch = deductions.slice(i, i + batchSize);
            const { error: dedError } = await supabase
                .from('deductions')
                .upsert(batch);
            
            if (dedError) throw dedError;
        }
        
        const syncTime = ((Date.now() - syncStartTime) / 1000).toFixed(1);
        console.log(`Data synced successfully with Supabase in ${syncTime} seconds`);
        showAlert(`Data synced successfully with database (${syncTime}s)`);
    } catch (error) {
        console.error('Error syncing with Supabase:', error);
        
        // Add to sync queue to retry later
        syncQueue.push({
            type: 'full_sync',
            timestamp: new Date().toISOString(),
            attempt: (syncQueue[0]?.attempt || 0) + 1
        });
        
        updateSyncQueueAlert();
        
        // If this is the first failure, retry immediately
        if (syncQueue.length === 1 && syncQueue[0].attempt === 1) {
            setTimeout(processSyncQueue, 5000); // Retry after 5 seconds
        } else {
            showAlert('Sync failed. Changes will be synced when back online.', 'error');
        }
    } finally {
        isSyncing = false;
    }
}

// Process sync queue with exponential backoff
async function processSyncQueue() {
    if (!navigator.onLine || !supabase || isSyncing || syncQueue.length === 0) return;
    
    isSyncing = true;
    showAlert('Processing pending sync operations...', 'info');
    
    try {
        // Process each item in the queue
        while (syncQueue.length > 0) {
            const operation = syncQueue[0];
            const lastAttempt = operation.lastAttempt || 0;
            const attempt = operation.attempt || 1;
            
            // If this operation failed recently, wait before retrying
            if (Date.now() - lastAttempt < Math.min(60000, 5000 * Math.pow(2, attempt - 1))) {
                break;
            }
            
            try {
                let result;
                
                switch (operation.type) {
                    case 'add_employee':
                        result = await supabase
                            .from('employees')
                            .insert(operation.data);
                        break;
                        
                    case 'update_employee':
                        result = await supabase
                            .from('employees')
                            .update(operation.data)
                            .eq('id', operation.employeeId);
                        break;
                        
                    case 'add_attendance':
                        result = await supabase
                            .from('attendance')
                            .insert(operation.data);
                        break;
                        
                    case 'update_attendance':
                        result = await supabase
                            .from('attendance')
                            .update(operation.data)
                            .eq('empId', operation.data.empId)
                            .eq('date', operation.data.date);
                        break;
                        
                    case 'delete_attendance':
                        result = await supabase
                            .from('attendance')
                            .delete()
                            .eq('empId', operation.data.empId)
                            .eq('date', operation.data.date);
                        break;
                        
                    case 'add_leave':
                        result = await supabase
                            .from('leave_records')
                            .insert(operation.data);
                        break;
                        
                    case 'update_leave':
                        result = await supabase
                            .from('leave_records')
                            .update(operation.data)
                            .eq('empId', operation.data.empId)
                            .eq('startDate', operation.data.startDate);
                        break;
                        
                    case 'delete_leave':
                        result = await supabase
                            .from('leave_records')
                            .delete()
                            .eq('empId', operation.data.empId)
                            .eq('startDate', operation.data.startDate);
                        break;
                        
                    case 'add_deduction':
                        result = await supabase
                            .from('deductions')
                            .insert(operation.data);
                        break;
                        
                    case 'update_deduction':
                        result = await supabase
                            .from('deductions')
                            .update(operation.data)
                            .eq('id', operation.data.id);
                        break;
                        
                    case 'delete_deduction':
                        result = await supabase
                            .from('deductions')
                            .delete()
                            .eq('id', operation.data.id);
                        break;
                        
                    case 'full_sync':
                        await syncWithSupabase();
                        result = { error: null };
                        break;
                }
                
                if (result && result.error) throw result.error;
                
                // Remove successfully processed operation from queue
                syncQueue.shift();
                localStorage.setItem('syncQueue', JSON.stringify(syncQueue));
                updateSyncQueueAlert();
            } catch (error) {
                console.error(`Failed to process sync operation: ${operation.type}`, error);
                
                // Update attempt count and last attempt time
                operation.attempt = (operation.attempt || 0) + 1;
                operation.lastAttempt = Date.now();
                operation.lastError = error.message;
                
                localStorage.setItem('syncQueue', JSON.stringify(syncQueue));
                updateSyncQueueAlert();
                
                // If we've tried this operation too many times, give up
                if (operation.attempt >= 5) {
                    syncQueue.shift();
                    localStorage.setItem('syncQueue', JSON.stringify(syncQueue));
                    updateSyncQueueAlert();
                    showAlert(`Failed to sync operation after 5 attempts: ${operation.type}`, 'error');
                }
                
                break;
            }
        }
    } finally {
        isSyncing = false;
    }
}

// Update sync queue alert with more detailed information
function updateSyncQueueAlert() {
    const alert = document.getElementById('syncQueueAlert');
    const countSpan = document.getElementById('syncQueueCount');
    const detailsBtn = document.getElementById('syncQueueDetails');
    
    if (!alert || !countSpan) return;
    
    if (syncQueue.length > 0) {
        alert.classList.remove('d-none');
        countSpan.textContent = syncQueue.length;
        
        if (detailsBtn) {
            detailsBtn.onclick = function() {
                showSyncQueueDetails();
            };
        }
    } else {
        alert.classList.add('d-none');
    }
}

function showSyncQueueDetails() {
    const modal = new bootstrap.Modal(getElement('syncQueueModal'));
    const modalBody = getElement('syncQueueModalBody');
    
    if (!modalBody) return;
    
    let html = '<div class="table-responsive"><table class="table table-sm">';
    html += `
        <thead>
            <tr>
                <th>Type</th>
                <th>Attempts</th>
                <th>Last Attempt</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
    `;
    
    syncQueue.forEach(op => {
        html += `
            <tr>
                <td>${op.type}</td>
                <td>${op.attempt || 1}</td>
                <td>${op.lastAttempt ? new Date(op.lastAttempt).toLocaleString() : 'Not attempted'}</td>
                <td>${op.lastError ? `<span class="text-danger">Failed: ${op.lastError}</span>` : 'Pending'}</td>
            </tr>
        `;
    });
    
    html += '</tbody></table></div>';
    modalBody.innerHTML = html;
    modal.show();
}

// Initialize the application with better error handling
document.addEventListener('DOMContentLoaded', function() {
    try {
        initializeData();
        
        // Set up event listeners
        setupEventListeners();
        
        // Initialize UI components
        updateLateEmployeesList();
        updateAbsentEmployeesList();
        updateLeaveDaysList();
        
        // Set default date to today for attendance
        const attendanceDate = getElement('attendanceDate');
        if (attendanceDate) {
            attendanceDate.valueAsDate = new Date();
        }
        
        // Initialize search suggestions with debounce
        initSearchSuggestions();
        
        // Initialize chatbot if elements exist
        if (getElement('chatbotToggle') && getElement('chatbotWindow')) {
            initChatbot();
        }
        
        // Check for late employees every minute
        setInterval(checkLateEmployees, 60000);
        checkLateEmployees();
        
        // Set up keyboard shortcuts
        setupKeyboardShortcuts();
        
        // Check if we need to show any pending sync alerts
        updateSyncQueueAlert();
        
        // Initialize tooltips
        $('[data-bs-toggle="tooltip"]').tooltip();
        
    } catch (error) {
        console.error('Initialization error:', error);
        showAlert('Failed to initialize application. Please check console for details.', 'error');
    }
});

// Set up keyboard shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Ctrl+F to focus search
        if (e.ctrlKey && e.key === 'f') {
            e.preventDefault();
            const searchInput = getElement('searchTerm');
            if (searchInput) {
                searchInput.focus();
            }
        }
        
        // Ctrl+S to sync data
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            const syncBtn = getElement('syncData');
            if (syncBtn) syncBtn.click();
        }
        
        // Ctrl+D to toggle dark mode
        if (e.ctrlKey && e.key === 'd') {
            e.preventDefault();
            const darkModeBtn = getElement('toggleDarkMode');
            if (darkModeBtn) darkModeBtn.click();
        }
    });
}

// Enhanced event listeners setup
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
    }
    
    // Add leave/rest days
    const leaveForm = getElement('leaveForm');
    if (leaveForm) {
        leaveForm.addEventListener('submit', handleLeaveRecording);
    }
    
    // Calculate salary - FIXED: Added proper event listener for salary calculation
    const salaryCalcBtn = getElement('salaryCalcBtn');
    if (salaryCalcBtn) {
        salaryCalcBtn.addEventListener('click', function(e) {
            e.preventDefault();
            handleSalaryCalculation();
        });
    }
    
    // Search employees
    const searchBtn = getElement('searchBtn');
    if (searchBtn) {
        searchBtn.addEventListener('click', handleEmployeeSearch);
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
            saveToLocalStorage();
        });
    }
    
    // Sync data button
    const syncDataBtn = getElement('syncData');
    if (syncDataBtn) {
        syncDataBtn.addEventListener('click', function() {
            if (navigator.onLine) {
                if (syncQueue.length > 0) {
                    processSyncQueue();
                } else {
                    syncWithSupabase();
                }
            } else {
                showAlert('You are currently offline. Sync will happen automatically when connection is restored.', 'warning');
            }
        });
    }
    
    // Retry sync button
    const retrySyncBtn = getElement('retrySyncBtn');
    if (retrySyncBtn) {
        retrySyncBtn.addEventListener('click', function() {
            if (navigator.onLine) {
                processSyncQueue();
            } else {
                showAlert('You are currently offline. Please connect to the internet to sync data.', 'warning');
            }
        });
    }
    
    // Mark all present button
    const markAllPresentBtn = getElement('markAllPresent');
    if (markAllPresentBtn) {
        markAllPresentBtn.addEventListener('click', function() {
            markAllEmployeesPresent();
        });
    }
    
    // Save database settings
    const saveDbSettingsBtn = getElement('saveDbSettings');
    if (saveDbSettingsBtn) {
        saveDbSettingsBtn.addEventListener('click', function() {
            const url = getElement('supabaseUrl')?.value;
            const key = getElement('supabaseKey')?.value;
            
            if (url && key) {
                localStorage.setItem('supabaseUrl', url);
                localStorage.setItem('supabaseKey', key);
                showAlert('Database settings saved successfully!');
                
                // Reload the page to initialize new Supabase client
                setTimeout(() => location.reload(), 1000);
            } else {
                showAlert('Please enter both Supabase URL and Key', 'error');
            }
        });
    }
    
    // Test database connection
    const testDbConnectionBtn = getElement('testDbConnection');
    if (testDbConnectionBtn) {
        testDbConnectionBtn.addEventListener('click', async function() {
            const url = getElement('supabaseUrl')?.value;
            const key = getElement('supabaseKey')?.value;
            
            if (!url || !key) {
                showAlert('Please enter both Supabase URL and Key', 'error');
                return;
            }
            
            const testClient = createClient(url, key);
            const statusDiv = getElement('dbConnectionStatus');
            
            if (!statusDiv) return;
            
            try {
                statusDiv.className = 'alert alert-info mt-3';
                statusDiv.innerHTML = '<i class="bi bi-hourglass"></i> Testing connection...';
                statusDiv.classList.remove('d-none');
                
                // Test connection by fetching a single employee
                const { data, error } = await testClient
                    .from('employees')
                    .select('*')
                    .limit(1);
                
                if (error) throw error;
                
                statusDiv.className = 'alert alert-success mt-3';
                statusDiv.innerHTML = '<i class="bi bi-check-circle"></i> Connection successful!';
            } catch (error) {
                console.error('Connection test failed:', error);
                statusDiv.className = 'alert alert-danger mt-3';
                statusDiv.innerHTML = `<i class="bi bi-x-circle"></i> Connection failed: ${error.message}`;
            }
        });
    }
    
    // Save notification settings
    const saveNotificationSettingsBtn = getElement('saveNotificationSettings');
    if (saveNotificationSettingsBtn) {
        saveNotificationSettingsBtn.addEventListener('click', function() {
            settings.enableNotifications = getElement('enableNotifications')?.checked || false;
            settings.enableEmailNotifications = getElement('enableEmailNotifications')?.checked || false;
            settings.notificationEmail = getElement('notificationEmail')?.value || '';
            
            saveToLocalStorage();
            showAlert('Notification settings saved successfully!');
        });
    }
    
    // Backup data to cloud
    const backupDataBtn = getElement('backupDataBtn');
    if (backupDataBtn) {
        backupDataBtn.addEventListener('click', async function() {
            if (!navigator.onLine) {
                showAlert('You need to be online to backup data to the cloud', 'error');
                return;
            }
            
            if (!supabase) {
                showAlert('Please configure database settings first', 'error');
                return;
            }
            
            try {
                const backupData = {
                    employees: employees,
                    attendance: attendanceRecords,
                    leaveRecords: leaveRecords,
                    deductions: deductions,
                    settings: settings,
                    timestamp: new Date().toISOString()
                };
                
                const { data, error } = await supabase
                    .from('backups')
                    .insert([{
                        backup_data: backupData,
                        timestamp: new Date().toISOString()
                    }]);
                
                if (error) throw error;
                
                showAlert('Data backed up to cloud successfully!');
            } catch (error) {
                console.error('Backup failed:', error);
                showAlert(`Backup failed: ${error.message}`, 'error');
            }
        });
    }
    
    // Restore data from cloud
    const restoreDataBtn = getElement('restoreDataBtn');
    if (restoreDataBtn) {
        restoreDataBtn.addEventListener('click', async function() {
            if (!navigator.onLine) {
                showAlert('You need to be online to restore data from the cloud', 'error');
                return;
            }
            
            if (!supabase) {
                showAlert('Please configure database settings first', 'error');
                return;
            }
            
            if (!confirm('This will overwrite all local data. Are you sure?')) {
                return;
            }
            
            try {
                const { data, error } = await supabase
                    .from('backups')
                    .select('*')
                    .order('timestamp', { ascending: false })
                    .limit(1);
                
                if (error) throw error;
                
                if (data.length === 0) {
                    showAlert('No backup found in the cloud', 'warning');
                    return;
                }
                
                const backup = data[0].backup_data;
                
                // Restore data
                employees = backup.employees || [];
                attendanceRecords = backup.attendance || [];
                leaveRecords = backup.leaveRecords || [];
                deductions = backup.deductions || [];
                settings = backup.settings || {};
                
                // Save to localStorage
                saveToLocalStorage();
                applySettings();
                
                showAlert('Data restored from cloud successfully!');
                setTimeout(() => location.reload(), 1000);
            } catch (error) {
                console.error('Restore failed:', error);
                showAlert(`Restore failed: ${error.message}`, 'error');
            }
        });
    }
    
    // Clear local data
    const clearDataBtn = getElement('clearDataBtn');
    if (clearDataBtn) {
        clearDataBtn.addEventListener('click', function() {
            if (!confirm('This will delete ALL local data. Are you sure?')) {
                return;
            }
            
            localStorage.clear();
            showAlert('All local data has been cleared', 'warning');
            setTimeout(() => location.reload(), 1000);
        });
    }
    
    // Export all data
    const exportAllDataBtn = getElement('exportAllDataBtn');
    if (exportAllDataBtn) {
        exportAllDataBtn.addEventListener('click', function() {
            const data = {
                employees: employees,
                attendance: attendanceRecords,
                leaveRecords: leaveRecords,
                deductions: deductions,
                settings: settings,
                timestamp: new Date().toISOString()
            };
            
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `employee_data_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showAlert('Data exported successfully!');
        });
    }
    
    // Import all data
    const importAllDataBtn = getElement('importAllDataBtn');
    if (importAllDataBtn) {
        importAllDataBtn.addEventListener('click', function() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            
            input.onchange = e => {
                const file = e.target.files[0];
                const reader = new FileReader();
                
                reader.onload = event => {
                    try {
                        const data = JSON.parse(event.target.result);
                        
                        if (!confirm('This will overwrite all current data. Are you sure?')) {
                            return;
                        }
                        
                        employees = data.employees || [];
                        attendanceRecords = data.attendance || [];
                        leaveRecords = data.leaveRecords || [];
                        deductions = data.deductions || [];
                        settings = data.settings || {};
                        
                        saveToLocalStorage();
                        applySettings();
                        
                        showAlert('Data imported successfully!');
                        setTimeout(() => location.reload(), 1000);
                    } catch (error) {
                        console.error('Import failed:', error);
                        showAlert('Failed to import data. The file may be corrupted.', 'error');
                    }
                };
                
                reader.readAsText(file);
            };
            
            input.click();
        });
    }
    
    // Import employees from CSV
    const importEmployeesBtn = getElement('importEmployeesBtn');
    if (importEmployeesBtn) {
        importEmployeesBtn.addEventListener('click', function() {
            const fileInput = getElement('importFile');
            if (!fileInput) return;
            
            const file = fileInput.files[0];
            if (!file) {
                showAlert('Please select a CSV file first', 'error');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const csvData = e.target.result;
                    const lines = csvData.split('\n');
                    const headers = lines[0].split(',').map(h => h.trim());
                    
                    // Required fields
                    const requiredFields = ['id', 'name', 'shift', 'workingDays', 'salary', 'paymentDay'];
                    const missingFields = requiredFields.filter(f => !headers.includes(f));
                    
                    if (missingFields.length > 0) {
                        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
                    }
                    
                    const statusDiv = getElement('importStatus');
                    if (statusDiv) {
                        statusDiv.classList.remove('d-none');
                        statusDiv.className = 'alert alert-info';
                        statusDiv.innerHTML = 'Processing CSV file...';
                    }
                    
                    let importedCount = 0;
                    let skippedCount = 0;
                    
                    // Process each line
                    for (let i = 1; i < lines.length; i++) {
                        if (!lines[i].trim()) continue;
                        
                        const values = lines[i].split(',');
                        const employee = {};
                        
                        headers.forEach((header, index) => {
                            employee[header] = values[index] ? values[index].trim() : '';
                        });
                        
                        // Convert numeric fields
                        employee.workingDays = parseInt(employee.workingDays) || 22;
                        employee.salary = parseFloat(employee.salary) || 0;
                        employee.paymentDay = parseInt(employee.paymentDay) || 1;
                        
                        // Set default status if not provided
                        employee.status = employee.status || 'active';
                        
                        try {
                            validateEmployeeData(employee);
                            
                            // Check if employee already exists
                            const existingIndex = employees.findIndex(emp => emp.id === employee.id);
                            if (existingIndex >= 0) {
                                employees[existingIndex] = employee;
                            } else {
                                employees.push(employee);
                            }
                            
                            importedCount++;
                        } catch (error) {
                            console.error(`Skipping row ${i + 1}: ${error.message}`);
                            skippedCount++;
                        }
                    }
                    
                    saveToLocalStorage();
                    
                    if (statusDiv) {
                        statusDiv.className = 'alert alert-success';
                        statusDiv.innerHTML = `Successfully imported ${importedCount} employees. ${skippedCount} rows skipped.`;
                    }
                    
                    showAlert(`Imported ${importedCount} employees from CSV`);
                } catch (error) {
                    console.error('CSV import failed:', error);
                    showAlert(`CSV import failed: ${error.message}`, 'error');
                    
                    const statusDiv = getElement('importStatus');
                    if (statusDiv) {
                        statusDiv.className = 'alert alert-danger';
                        statusDiv.innerHTML = `Import failed: ${error.message}`;
                        statusDiv.classList.remove('d-none');
                    }
                }
            };
            
            reader.readAsText(file);
        });
    }
    
    // Download CSV template
    const downloadTemplateBtn = getElement('downloadTemplate');
    if (downloadTemplateBtn) {
        downloadTemplateBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            const headers = ['id', 'name', 'phone', 'email', 'shift', 'workingDays', 'salary', 'paymentDay', 'department', 'status'];
            const csvContent = headers.join(',') + '\n' +
                'EMP001,John Doe,0712345678,john@example.com,day,22,25000,5,kitchen,active\n' +
                'EMP002,Jane Smith,0723456789,jane@example.com,night,22,28000,5,service,active';
            
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'employee_import_template.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showAlert('Template downloaded successfully!');
        });
    }
    
    // Process bulk attendance
    const processBulkAttendanceBtn = getElement('processBulkAttendanceBtn');
    if (processBulkAttendanceBtn) {
        processBulkAttendanceBtn.addEventListener('click', function() {
            const fileInput = getElement('bulkAttendanceFile');
            const dateInput = getElement('bulkAttendanceDate');
            if (!fileInput || !dateInput) return;
            
            const file = fileInput.files[0];
            const date = dateInput.value;
            
            if (!file) {
                showAlert('Please select a CSV file first', 'error');
                return;
            }
            
            if (!date) {
                showAlert('Please select a date first', 'error');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const csvData = e.target.result;
                    const lines = csvData.split('\n');
                    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
                    
                    // Required fields
                    const requiredFields = ['employeeid', 'arrivaltime', 'shifttype'];
                    const missingFields = requiredFields.filter(f => !headers.includes(f));
                    
                    if (missingFields.length > 0) {
                        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
                    }
                    
                    const statusDiv = getElement('bulkAttendanceStatus');
                    if (statusDiv) {
                        statusDiv.classList.remove('d-none');
                        statusDiv.className = 'alert alert-info';
                        statusDiv.innerHTML = 'Processing bulk attendance...';
                    }
                    
                    let processedCount = 0;
                    let skippedCount = 0;
                    
                    // Process each line
                    for (let i = 1; i < lines.length; i++) {
                        if (!lines[i].trim()) continue;
                        
                        const values = lines[i].split(',');
                        const record = { date: date };
                        
                        headers.forEach((header, index) => {
                            record[header] = values[index] ? values[index].trim() : '';
                        });
                        
                        // Rename fields to match our data structure
                        record.empId = record.employeeid;
                        record.arrivalTime = record.arrivaltime;
                        record.shiftType = record.shifttype;
                        
                        // Calculate if late
                        const arrivalDateTime = new Date(`${date}T${record.arrivalTime}`);
                        let expectedTime, minutesLate = 0;
                        let status = 'on_time';
                        
                        if (record.shiftType === 'day') {
                            expectedTime = new Date(`${date}T09:30:00`);
                        } else {
                            expectedTime = new Date(`${date}T21:30:00`);
                        }
                        
                        if (arrivalDateTime > expectedTime) {
                            minutesLate = Math.round((arrivalDateTime - expectedTime) / (1000 * 60));
                            status = 'late';
                        }
                        
                        record.status = status;
                        record.minutesLate = minutesLate;
                        
                        try {
                            // Check if employee exists
                            const employee = employees.find(emp => emp.id === record.empId);
                            if (!employee) {
                                throw new Error(`Employee ${record.empId} not found`);
                            }
                            
                            // Check if attendance already recorded for this date
                            const existingIndex = attendanceRecords.findIndex(att => 
                                att.empId === record.empId && att.date === date
                            );
                            
                            if (existingIndex >= 0) {
                                attendanceRecords[existingIndex] = record;
                            } else {
                                attendanceRecords.push(record);
                            }
                            
                            processedCount++;
                        } catch (error) {
                            console.error(`Skipping row ${i + 1}: ${error.message}`);
                            skippedCount++;
                        }
                    }
                    
                    saveToLocalStorage();
                    
                    if (statusDiv) {
                        statusDiv.className = 'alert alert-success';
                        statusDiv.innerHTML = `Processed ${processedCount} attendance records. ${skippedCount} rows skipped.`;
                    }
                    
                    showAlert(`Processed ${processedCount} attendance records from CSV`);
                    updateLateEmployeesList();
                    updateAbsentEmployeesList();
                } catch (error) {
                    console.error('Bulk attendance processing failed:', error);
                    showAlert(`Bulk attendance processing failed: ${error.message}`, 'error');
                    
                    const statusDiv = getElement('bulkAttendanceStatus');
                    if (statusDiv) {
                        statusDiv.className = 'alert alert-danger';
                        statusDiv.innerHTML = `Processing failed: ${error.message}`;
                        statusDiv.classList.remove('d-none');
                    }
                }
            };
            
            reader.readAsText(file);
        });
    }
    
    // View late trends
    const viewLateTrendsBtn = getElement('viewLateTrends');
    if (viewLateTrendsBtn) {
        viewLateTrendsBtn.addEventListener('click', function() {
            showTrendChart('late');
        });
    }
    
    // View absent trends
    const viewAbsentTrendsBtn = getElement('viewAbsentTrends');
    if (viewAbsentTrendsBtn) {
        viewAbsentTrendsBtn.addEventListener('click', function() {
            showTrendChart('absent');
        });
    }
}

// Enhanced show trend chart function
function showTrendChart(type) {
    const modal = new bootstrap.Modal(getElement('trendModal'));
    const title = getElement('trendModalTitle');
    const ctx = getElement('trendChart')?.getContext('2d');
    
    if (!title || !ctx) return;
    
    // Set title based on type
    if (type === 'late') {
        title.textContent = 'Late Arrivals Trend';
    } else {
        title.textContent = 'Absenteeism Trend';
    }
    
    // Set default dates (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);
    
    const trendStartDate = getElement('trendStartDate');
    const trendEndDate = getElement('trendEndDate');
    if (trendStartDate && trendEndDate) {
        trendStartDate.valueAsDate = startDate;
        trendEndDate.valueAsDate = endDate;
    }
    
    // Generate initial chart
    generateTrendChart(ctx, type, startDate, endDate);
    
    // Set up generate button
    const generateTrendBtn = getElement('generateTrendBtn');
    if (generateTrendBtn) {
        generateTrendBtn.onclick = function() {
            const start = new Date(getElement('trendStartDate')?.value);
            const end = new Date(getElement('trendEndDate')?.value);
            
            if (!start || !end) return;
            
            if (start > end) {
                showAlert('Start date cannot be after end date', 'error');
                return;
            }
            
            generateTrendChart(ctx, type, start, end);
        };
    }
    
    // Set up export button
    const exportTrendBtn = getElement('exportTrendBtn');
    if (exportTrendBtn) {
        exportTrendBtn.onclick = function() {
            const canvas = getElement('trendChart');
            if (!canvas) return;
            
            const link = document.createElement('a');
            link.download = `${type}_trend_${new Date().toISOString().split('T')[0]}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        };
    }
    
    modal.show();
}

// Enhanced generate trend chart function
function generateTrendChart(ctx, type, startDate, endDate) {
    if (!ctx) return;
    
    // Filter records for the date range
    const filteredRecords = attendanceRecords.filter(record => {
        try {
            const recordDate = new Date(record.date);
            return recordDate >= startDate && recordDate <= endDate;
        } catch (error) {
            console.error('Error parsing date:', record.date, error);
            return false;
        }
    });
    
    // Group by date and count late/absent employees
    const dateMap = {};
    const currentDate = new Date(startDate);
    
    // Initialize date map
    while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        dateMap[dateStr] = 0;
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Count records
    filteredRecords.forEach(record => {
        if (record.status === type) {
            dateMap[record.date] = (dateMap[record.date] || 0) + 1;
        }
    });
    
    // Prepare chart data
    const labels = Object.keys(dateMap).sort();
    const data = labels.map(date => dateMap[date]);
    
    // Destroy previous chart if it exists
    if (ctx.chart) {
        ctx.chart.destroy();
    }
    
    // Create new chart
    ctx.chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: type === 'late' ? 'Late Employees' : 'Absent Employees',
                data: data,
                backgroundColor: type === 'late' ? 'rgba(255, 159, 64, 0.2)' : 'rgba(255, 99, 132, 0.2)',
                borderColor: type === 'late' ? 'rgba(255, 159, 64, 1)' : 'rgba(255, 99, 132, 1)',
                borderWidth: 2,
                tension: 0.1,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: type === 'late' ? 'Late Arrivals Trend' : 'Absenteeism Trend'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.raw}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Employees'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Date'
                    }
                }
            }
        }
    });
}

// Enhanced mark all employees as present function
function markAllEmployeesPresent() {
    const today = new Date().toISOString().split('T')[0];
    const activeEmployees = employees.filter(emp => emp.status === 'active');
    
    if (activeEmployees.length === 0) {
        showAlert('No active employees found', 'warning');
        return;
    }
    
    if (!confirm(`Mark all ${activeEmployees.length} active employees as present today?`)) {
        return;
    }
    
    let processed = 0;
    
    activeEmployees.forEach(employee => {
        // Check if attendance already recorded for today
        const existingRecord = attendanceRecords.find(record => 
            record.empId === employee.id && record.date === today
        );
        
        if (!existingRecord) {
            const arrivalTime = employee.shift === 'day' ? '09:30' : '21:30';
            
            attendanceRecords.push({
                empId: employee.id,
                date: today,
                arrivalTime: arrivalTime,
                shiftType: employee.shift,
                status: 'on_time',
                minutesLate: 0
            });
            
            processed++;
        }
    });
    
    saveToLocalStorage();
    updateLateEmployeesList();
    updateAbsentEmployeesList();
    
    showAlert(`Marked ${processed} employees as present today`);
}

// Enhanced form handlers with better validation
async function handleEmployeeRegistration(e) {
    e.preventDefault();
    
    try {
        const empId = getElement('empId')?.value.trim();
        const fullName = getElement('fullName')?.value.trim();
        const phoneNumber = getElement('phoneNumber')?.value;
        const shiftType = getElement('shiftType')?.value;
        const workingDays = parseInt(getElement('workingDays')?.value);
        const agreedSalary = parseFloat(getElement('agreedSalary')?.value);
        const paymentDay = parseInt(getElement('paymentDay')?.value);
        const department = getElement('department')?.value;
        const email = getElement('email')?.value;
        const photoFile = getElement('photo')?.files[0];
        
        // Validate input
        if (!empId || !fullName) {
            throw new Error('Employee ID and Name are required');
        }
        
        // Check if employee already exists
        if (employees.some(emp => emp.id === empId)) {
            throw new Error('Employee with this ID already exists!');
        }
        
         // Validate Employee ID (allowing alphanumeric and special chars)
        if (!empId || !/^[A-Za-z0-9\-_@#$%&*!?+=() ]+$/.test(empId)) {
            throw new Error('Employee ID can only contain letters, numbers, and special characters (-_@#$%&*!?+=() )');
        }

        let photoUrl = '';
        
        // Upload photo if provided
        if (photoFile && supabase) {
            try {
                const fileExt = photoFile.name.split('.').pop();
                const fileName = `${empId}.${fileExt}`;
                const filePath = `employee_photos/${fileName}`;
                
                const { error: uploadError } = await supabase
                    .storage
                    .from('employee-photos')
                    .upload(filePath, photoFile);
                
                if (uploadError) throw uploadError;
                
                // Get public URL
                const { data: { publicUrl } } = supabase
                    .storage
                    .from('employee-photos')
                    .getPublicUrl(filePath);
                
                photoUrl = publicUrl;
            } catch (error) {
                console.error('Error uploading photo:', error);
                // Don't fail the whole operation if photo upload fails
            }
        }
        //create new employees
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
            photoUrl: photoUrl,
            status: 'active',
            deductions: [],
            createdAt: new Date().toISOString()
        };
        
        // Validate employee data
        validateEmployeeData(newEmployee);
        
        employees.push(newEmployee);
        saveToLocalStorage();
        
        // Add to sync queue
        syncQueue.push({
            type: 'add_employee',
            data: newEmployee,
            timestamp: new Date().toISOString()
        });
        updateSyncQueueAlert();
        
        showAlert('Employee registered successfully!');
        const employeeForm = getElement('employeeForm');
        if (employeeForm) employeeForm.reset();
        
        // If online, try to sync immediately
        if (navigator.onLine) {
            processSyncQueue();
        }
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Enhanced attendance recording with better time validation
async function handleAttendanceRecording(e) {
    e.preventDefault();
    
    try {
        const empId = getElement('attendanceEmpId')?.value;
        const date = getElement('attendanceDate')?.value;
        const arrivalTime = getElement('arrivalTime')?.value;
        const departureTime = getElement('departureTime')?.value;
        const approvedOvertime = parseInt(getElement('approvedOvertime')?.value) || 0;
        const shiftType = getElement('shiftTypeAttendance')?.value;
        
        if (!empId || !date || !arrivalTime || !shiftType) {
            throw new Error('All fields are required');
        }
        
        // Validate time format
        if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(arrivalTime)) {
            throw new Error('Invalid time format. Use HH:MM (24-hour format)');
        }
        
                
        // Calculate overstay minutes if departure time is provided
        let overstayMinutes = 0;
        if (departureTime) {
            const shiftEndTime = shiftType === 'day' ? '17:30' : '05:30';
            const departureDateTime = new Date(`${date}T${departureTime}`);
            let endDateTime = new Date(`${date}T${shiftEndTime}`);
            
            // For night shift ending next day
            if (shiftType === 'night') {
                endDateTime.setDate(endDateTime.getDate() + 1);
            }
            
            const overtimeMinutes = Math.round((departureDateTime - endDateTime) / (1000 * 60));
            overstayMinutes = Math.max(0, overtimeMinutes - approvedOvertime);
        }



        // Check if employee exists
        const employee = employees.find(emp => emp.id === empId);
        if (!employee) {
            throw new Error('Employee not found!');
        }
        
        // Check if attendance already recorded for this date
        const existingRecordIndex = attendanceRecords.findIndex(record => 
            record.empId === empId && record.date === date
        );
        
        // Calculate if late
        const arrivalDateTime = new Date(`${date}T${arrivalTime}`);
        if (isNaN(arrivalDateTime.getTime())) {
            throw new Error('Invalid date or time');
        }
        
        let expectedTime, minutesLate = 0;
        let status = 'on_time';
        
        if (shiftType === 'day') {
            expectedTime = new Date(`${date}T09:30:00`);
        } else {
            expectedTime = new Date(`${date}T21:30:00`);
        }
        
        if (isNaN(expectedTime.getTime())) {
            throw new Error('Invalid shift time calculation');
        }
        
        if (arrivalDateTime > expectedTime) {
            minutesLate = Math.round((arrivalDateTime - expectedTime) / (1000 * 60));
            status = 'late';
        }
        
        const attendanceRecord = {
            empId: empId,
            date: date,
            arrivalTime: arrivalTime,
            departureTime: departureTime || null,
            shiftType: shiftType,
            status: status,
            minutesLate: minutesLate,
            recordedAt: new Date().toISOString()
        };

        

        if (existingRecordIndex >= 0) {
            attendanceRecords[existingRecordIndex] = attendanceRecord;
        } else {
            attendanceRecords.push(attendanceRecord);
        }
        
        saveToLocalStorage();
        
        // Add to sync queue
        syncQueue.push({
            type: 'add_attendance',
            data: attendanceRecord,
            timestamp: new Date().toISOString()
        });
        updateSyncQueueAlert();
        
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
                </div>
            `;
        }
        
        const attendanceForm = getElement('attendanceForm');
         
        await saveAttendanceRecord(attendanceRecord);
        
        // Update the overstay minutes display
        getElement('overstayMinutes').value = overstayMinutes;
        
        showAlert('Attendance recorded successfully!');
        if (attendanceForm) attendanceForm.reset();
        updateLateEmployeesList();
        updateAbsentEmployeesList();
        
        // If late, check if we should notify
        if (status === 'late' && settings.enableNotifications) {
            const today = new Date().toISOString().split('T')[0];
            if (date === today) {
                notifyLateEmployees([attendanceRecord]);
            }
        }
        
        showAlert('Attendance recorded successfully!');
        
        // If online, try to sync immediately
        if (navigator.onLine) {
            processSyncQueue();
        }
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Enhanced leave recording with date validation
async function handleLeaveRecording(e) {
    e.preventDefault();
    
    try {
        const empId = getElement('leaveEmpId')?.value;
        const leaveType = getElement('leaveType')?.value;
        const startDate = getElement('leaveStartDate')?.value;
        const endDate = getElement('leaveEndDate')?.value;
        const reason = getElement('leaveReason')?.value;
        
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
        saveToLocalStorage();
        
        // Add to sync queue
        syncQueue.push({
            type: 'add_leave',
            data: leaveRecord,
            timestamp: new Date().toISOString()
        });
        updateSyncQueueAlert();
        
        showAlert('Leave/Rest days added successfully!');
        const leaveForm = getElement('leaveForm');
        if (leaveForm) leaveForm.reset();
        updateLeaveDaysList();
        updateAbsentEmployeesList();
        
        // If online, try to sync immediately
        if (navigator.onLine) {
            processSyncQueue();
        }
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Edit employee ID
async function editEmployeeId(oldId, newId) {
    try {
        // Validate new ID
        if (!newId || !/^[A-Za-z0-9\-_@#$%&*!?+=() ]+$/.test(newId)) {
            throw new Error('Invalid Employee ID format');
        }
        
        // Find employee
        const employee = employees.find(e => e.id === oldId);
        if (!employee) {
            throw new Error('Employee not found');
        }
        
        // Check if new ID already exists
        const idExists = await apiRequest(`/employees/check-id/${newId}`);
        if (idExists.exists) {
            throw new Error('Employee ID already in use');
        }
        
        // Update employee ID via API
        await apiRequest(`/employees/${oldId}/update-id`, 'PUT', { newId });
        
        // Update local cache
        employee.id = newId;
        attendanceRecords.forEach(r => { if (r.empId === oldId) r.empId = newId; });
        leaveRecords.forEach(r => { if (r.empId === oldId) r.empId = newId; });
        deductions.forEach(d => { if (d.empId === oldId) d.empId = newId; });
        
        showAlert('Employee ID updated successfully!');
        return true;
    } catch (error) {
        showAlert(error.message, 'error');
        return false;
    }
}

// Enhanced salary calculation with better validation - FIXED: Added proper salary calculation function
async function handleSalaryCalculation() {
    try {
        const empId = getElement('salaryEmpId')?.value;
        const calcMonth = getElement('calcMonth')?.value;
        const emergencyCalc = getElement('emergencyCalc')?.checked || false;
        const includeBonus = getElement('includeBonus')?.checked || false;
        
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
        `;
        
        salaryResult.classList.remove('d-none');
        showAlert('Salary calculated successfully!');
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
        `;
        
        salaryDetails.innerHTML = html;
        salaryResult.classList.remove('d-none');
        showAlert(`Calculated salaries for ${activeEmployees.length} employees`);
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
            
            saveToLocalStorage();
            
            // Add to sync queue
            syncQueue.push({
                type: 'update_employee',
                employeeId: empId,
                data: employees[employeeIndex],
                timestamp: new Date().toISOString()
            });
            updateSyncQueueAlert();
            
            showAlert('Employee has been deregistered.');
            const deregisterForm = getElement('deregisterForm');
            if (deregisterForm) deregisterForm.reset();
            
            // If online, try to sync immediately
            if (navigator.onLine) {
                processSyncQueue();
            }
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
        
        validateEmployeeData(updatedEmployee);
        
        employees[employeeIndex] = updatedEmployee;
        saveToLocalStorage();
        
        // Add to sync queue
        syncQueue.push({
            type: 'update_employee',
            employeeId: empId,
            data: updatedEmployee,
            timestamp: new Date().toISOString()
        });
        updateSyncQueueAlert();
        
        const modal = bootstrap.Modal.getInstance(getElement('employeeModal'));
        if (modal) {
            modal.hide();
        }
        
        showAlert('Employee details updated successfully!');
        
        // If online, try to sync immediately
        if (navigator.onLine) {
            processSyncQueue();
        }
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
        saveToLocalStorage();
        
        // Add to sync queue
        syncQueue.push({
            type: 'add_deduction',
            data: deduction,
            timestamp: new Date().toISOString()
        });
        updateSyncQueueAlert();
        
        showAlert('Deduction added successfully!');
        
        const modal = bootstrap.Modal.getInstance(getElement('deductionModal'));
        if (modal) {
            modal.hide();
        }
        
        const deductionForm = getElement('deductionForm');
        if (deductionForm) deductionForm.reset();
        
        // If online, try to sync immediately
        if (navigator.onLine) {
            processSyncQueue();
        }
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
        
        saveToLocalStorage();
        
        // Add to sync queue
        syncQueue.push({
            type: 'update_attendance',
            data: attendanceRecords[recordIndex],
            timestamp: new Date().toISOString()
        });
        updateSyncQueueAlert();
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(getElement('editAttendanceModal'));
        if (modal) {
            modal.hide();
        }
        
        showAlert('Attendance record updated successfully!');
        updateLateEmployeesList();
        updateAbsentEmployeesList();
        
        // If online, try to sync immediately
        if (navigator.onLine) {
            processSyncQueue();
        }
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
        
        // Add to sync queue before deleting (for sync purposes)
        syncQueue.push({
            type: 'delete_attendance',
            data: attendanceRecords[recordIndex],
            timestamp: new Date().toISOString()
        });
        updateSyncQueueAlert();
        
        // Remove from local storage
        attendanceRecords.splice(recordIndex, 1);
        saveToLocalStorage();
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(getElement('editAttendanceModal'));
        if (modal) {
            modal.hide();
        }
        
        showAlert('Attendance record deleted successfully!');
        updateLateEmployeesList();
        updateAbsentEmployeesList();
        
        // If online, try to sync immediately
        if (navigator.onLine) {
            processSyncQueue();
        }
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
            saveToLocalStorage();
            
            // Add to sync queue
            syncQueue.push({
                type: 'add_attendance',
                data: attendanceRecord,
                timestamp: new Date().toISOString()
            });
            updateSyncQueueAlert();
            
            showAlert('Employee marked as absent.');
            updateAbsentEmployeesList();
            
            // If online, try to sync immediately
            if (navigator.onLine) {
                processSyncQueue();
            }
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
        
        saveToLocalStorage();
        
        // Add to sync queue
        syncQueue.push({
            type: 'update_leave',
            data: leaveRecords[index],
            timestamp: new Date().toISOString()
        });
        updateSyncQueueAlert();
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(getElement('editLeaveModal'));
        if (modal) {
            modal.hide();
        }
        
        showAlert('Leave record updated successfully!');
        updateLeaveDaysList();
        updateAbsentEmployeesList();
        
        // If online, try to sync immediately
        if (navigator.onLine) {
            processSyncQueue();
        }
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
        
        // Add to sync queue before deleting (for sync purposes)
        syncQueue.push({
            type: 'delete_leave',
            data: leaveRecords[index],
            timestamp: new Date().toISOString()
        });
        updateSyncQueueAlert();
        
        // Remove from local storage
        leaveRecords.splice(index, 1);
        saveToLocalStorage();
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(getElement('editLeaveModal'));
        if (modal) {
            modal.hide();
        }
        
        showAlert('Leave record deleted successfully!');
        updateLeaveDaysList();
        updateAbsentEmployeesList();
        
        // If online, try to sync immediately
        if (navigator.onLine) {
            processSyncQueue();
        }
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
                    <button class="nav-link" id="deductions-tab" data-bs-toggle="tab" data-bs-target="#deductions-tab-pane" type="button" role="tab">Deductions</button>
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
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
        `;
        
        if (empLeaves.length === 0) {
            html += '<tr><td colspan="5" class="text-center">No leave/rest days</td></tr>';
        } else {
            empLeaves.forEach((leave, index) => {
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
        
        html += `</div></div></div>`;
        
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
        
        const modal = new bootstrap.Modal(getElement('employeeModal'));
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
        
        saveToLocalStorage();
        
        // Add to sync queue
        syncQueue.push({
            type: 'update_deduction',
            data: deductions[index],
            timestamp: new Date().toISOString()
        });
        updateSyncQueueAlert();
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(getElement('editDeductionModal'));
        if (modal) {
            modal.hide();
        }
        
        showAlert('Deduction updated successfully!');
        
        // If showing employee details, refresh the view
        const modalTitle = getElement('employeeModalTitle');
        if (modalTitle && modalTitle.textContent.includes('Employee Details')) {
            const empId = document.getElementById('modalEmpId').value;
            showEmployeeDetails(empId);
        }
        
        // If online, try to sync immediately
        if (navigator.onLine) {
            processSyncQueue();
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
        
        // Add to sync queue before deleting (for sync purposes)
        syncQueue.push({
            type: 'delete_deduction',
            data: deductions[index],
            timestamp: new Date().toISOString()
        });
        updateSyncQueueAlert();
        
        // Remove from local storage
        deductions.splice(index, 1);
        saveToLocalStorage();
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(getElement('editDeductionModal'));
        if (modal) {
            modal.hide();
        }
        
        showAlert('Deduction deleted successfully!');
        
        // If showing employee details, refresh the view
        const modalTitle = getElement('employeeModalTitle');
        if (modalTitle && modalTitle.textContent.includes('Employee Details')) {
            const empId = document.getElementById('modalEmpId').value;
            showEmployeeDetails(empId);
        }
        
        // If online, try to sync immediately
        if (navigator.onLine) {
            processSyncQueue();
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

        // Calculate salaries for all employees
        const reportData = activeEmployees.map(employee => {
            return calculateEmployeeSalaryForReport(employee, month);
        });

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

function calculateEmployeeSalaryForReport(employee, month) {
    const [year, monthNum] = month.split('-').map(Number);
    
    // Filter attendance records for this employee and month
    const monthAttendance = attendanceRecords.filter(record => {
        try {
            const [recordYear, recordMonth] = record.date.split('-').map(Number);
            return record.empId === employee.id && recordYear === year && recordMonth === monthNum;
        } catch (error) {
            console.error('Error parsing attendance record date:', record.date, error);
            return false;
        }
    });
    
    // Filter leave records for this employee and month
    const monthLeaves = leaveRecords.filter(leave => {
        try {
            return leave.empId === employee.id && 
                ((new Date(leave.startDate) <= new Date(year, monthNum - 1, 31)) && 
                (new Date(leave.endDate) >= new Date(year, monthNum - 1, 1)));
        } catch (error) {
            console.error('Error parsing leave record dates:', leave.startDate, leave.endDate, error);
            return false;
        }
    });
    
    // Calculate working days, absent days, late minutes
    let workingDays = 0;
    let absentDays = 0;
    let lateMinutes = 0;
    let leaveDays = 0;
    
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        // Check if on leave
        const onLeave = monthLeaves.some(leave => 
            dateStr >= leave.startDate && dateStr <= leave.endDate
        );
        
        if (onLeave) {
            leaveDays++;
            continue;
        }
        
        // Check attendance
        const attendance = monthAttendance.find(record => record.date === dateStr);
        
        if (attendance) {
            if (attendance.status === 'absent') {
                absentDays++;
            } else {
                workingDays++;
                if (attendance.status === 'late') {
                    lateMinutes += attendance.minutesLate || 0;
                }
            }
        } else {
            absentDays++;
        }
    }
    
    // Calculate salary components
    const dailySalary = employee.salary / employee.workingDays;
    const lateDeduction = (lateMinutes / 60) * (dailySalary / 8); // Assuming 8-hour work day
    const absentDeduction = absentDays * dailySalary;
    
    // Get employee's deductions
    const empDeductions = deductions.filter(ded => ded.empId === employee.id);
    const otherDeductions = empDeductions.reduce((sum, ded) => sum + ded.amount, 0);
    
    const totalDeductions = lateDeduction + absentDeduction + otherDeductions;
    const netSalary = employee.salary - totalDeductions;
    
    return {
        id: employee.id,
        name: employee.name,
        baseSalary: employee.salary,
        deductions: totalDeductions,
        netSalary: netSalary,
        status: netSalary > 0 ? 'Pending' : 'Paid',
        workingDays: workingDays,
        absentDays: absentDays,
        lateMinutes: lateMinutes,
        leaveDays: leaveDays
    };
}

function updateSalarySummary(reportData, monthName, year) {
    const summaryDiv = getElement('salarySummary');
    if (!summaryDiv) return;
    
    const totalSalaries = reportData.reduce((sum, emp) => sum + emp.baseSalary, 0);
    const totalDeductions = reportData.reduce((sum, emp) => sum + emp.deductions, 0);
    const totalNetPay = reportData.reduce((sum, emp) => sum + emp.netSalary, 0);
    const pendingCount = reportData.filter(emp => emp.status === 'Pending').length;
    const paidCount = reportData.filter(emp => emp.status === 'Paid').length;
    
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
    
    const pendingEmployees = reportData.filter(emp => emp.status === 'Pending');
    
    if (pendingEmployees.length === 0) {
        pendingDiv.innerHTML = '<p>No pending payments</p>';
        return;
    }
    
    let html = '<ul class="list-group">';
    pendingEmployees.forEach(emp => {
        html += `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                ${emp.name} (${emp.id})
                <span class="badge bg-primary rounded-pill">Ksh ${emp.netSalary.toFixed(2)}</span>
            </li>
        `;
    });
    html += '</ul>';
    
    pendingDiv.innerHTML = html;
}

function updateDetailedReport(reportData) {
    const tbody = getElement('detailedReportBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    reportData.forEach(emp => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${emp.id}</td>
            <td>${emp.name}</td>
            <td>Ksh ${emp.baseSalary.toFixed(2)}</td>
            <td>Ksh ${emp.deductions.toFixed(2)}</td>
            <td>Ksh ${emp.netSalary.toFixed(2)}</td>
            <td class="${emp.status === 'Pending' ? 'text-warning' : 'text-success'}">${emp.status}</td>
        `;
        tbody.appendChild(row);
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

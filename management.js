// Employee data structure with better initialization
let employees = [];
let attendanceRecords = [];
let leaveRecords = [];
let deductions = [];

// Initialize data from localStorage
function initializeData() {
    try {
        employees = JSON.parse(localStorage.getItem('employees')) || [];
        attendanceRecords = JSON.parse(localStorage.getItem('attendance')) || [];
        leaveRecords = JSON.parse(localStorage.getItem('leaveRecords')) || [];
        deductions = JSON.parse(localStorage.getItem('deductions')) || [];
    } catch (error) {
        console.error('Error loading data from localStorage:', error);
        // Reset to empty arrays if corrupted data
        employees = [];
        attendanceRecords = [];
        leaveRecords = [];
        deductions = [];
    }
}

// DOM Elements with null checks
function getElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.error(`Element with ID ${id} not found`);
    }
    return element;
}

const employeeForm = getElement('employeeForm');
const attendanceForm = getElement('attendanceForm');
const leaveForm = getElement('leaveForm');
const salaryCalcBtn = getElement('calculateSalaryBtn');
const searchBtn = getElement('searchBtn');
const deregisterForm = getElement('deregisterForm');
const saveEmployeeChanges = getElement('saveEmployeeChanges');
const deductionForm = getElement('deductionForm');

// Chatbot elements
const chatbotToggle = document.querySelector('.chatbot-toggle');
const chatbotWindow = document.querySelector('.chatbot-window');
const chatbotClose = document.querySelector('.chatbot-close');
const chatbotMessages = getElement('chatbotMessages');
const chatbotQuery = getElement('chatbotQuery');
const sendChatbotQuery = getElement('sendChatbotQuery');

// Utility functions
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

function showAlert(message, type = 'success') {
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
        const bsAlert = new bootstrap.Alert(alertDiv);
        bsAlert.close();
    }, 5000);
}

function validateEmployeeData(employee) {
    if (!employee.id || !employee.name) {
        throw new Error('Employee ID and Name are required');
    }
    
    if (!/^\d+$/.test(employee.id)) {
        throw new Error('Employee ID must be numeric');
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

// Initialize the application with error handling
document.addEventListener('DOMContentLoaded', function() {
    try {
        initializeData();
        
        updateLateEmployeesList();
        updateAbsentEmployeesList();
        updateLeaveDaysList();
        
        // Set default date to today for attendance
        const attendanceDate = getElement('attendanceDate');
        if (attendanceDate) {
            attendanceDate.valueAsDate = new Date();
        }
        
        // Initialize search suggestions
        initSearchSuggestions();
        
        // Initialize chatbot if elements exist
        if (chatbotToggle && chatbotWindow) {
            initChatbot();
        }
        
        // Check for late employees every minute
        setInterval(checkLateEmployees, 60000);
        checkLateEmployees();
        
        // Initialize event listeners
        setupEventListeners();
    } catch (error) {
        console.error('Initialization error:', error);
        showAlert('Failed to initialize application. Please check console for details.', 'error');
    }
});

function setupEventListeners() {
    // Register new employee
    if (employeeForm) {
        employeeForm.addEventListener('submit', handleEmployeeRegistration);
    }
    
    // Record attendance
    if (attendanceForm) {
        attendanceForm.addEventListener('submit', handleAttendanceRecording);
    }
    
    // Add leave/rest days
    if (leaveForm) {
        leaveForm.addEventListener('submit', handleLeaveRecording);
    }
    
    // Calculate salary
    if (salaryCalcBtn) {
        salaryCalcBtn.addEventListener('click', handleSalaryCalculation);
    }
    
    // Search employees
    if (searchBtn) {
        searchBtn.addEventListener('click', handleEmployeeSearch);
    }
    
    // Deregister employee
    if (deregisterForm) {
        deregisterForm.addEventListener('submit', handleEmployeeDeregistration);
    }
    
    // Save employee changes
    if (saveEmployeeChanges) {
        saveEmployeeChanges.addEventListener('click', handleEmployeeUpdate);
    }
    
    // Add deduction
    if (deductionForm) {
        deductionForm.addEventListener('submit', handleDeductionAdd);
    }
}

// Initialize search suggestions with improved performance
function initSearchSuggestions() {
    const suggestionMappings = [
        { inputId: 'attendanceEmpId', dropdownId: 'employeeSuggestions' },
        { inputId: 'leaveEmpId', dropdownId: 'leaveEmployeeSuggestions' },
        { inputId: 'salaryEmpId', dropdownId: 'salaryEmployeeSuggestions' },
        { inputId: 'deregisterEmpId', dropdownId: 'deregisterEmployeeSuggestions' },
        { inputId: 'searchTerm', dropdownId: 'searchSuggestions' }
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

// Chatbot functions with improved error handling
function initChatbot() {
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
    addSampleQuestions();
}

function addSampleQuestions() {
    if (!chatbotMessages) return;
    
    const sampleQuestions = [
        "List all employees",
        "Who is late today?",
        "Show absent employees",
        "How many employees do we have?"
    ];
    
    const container = document.createElement('div');
    container.className = 'sample-questions';
    
    sampleQuestions.forEach(question => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-sm btn-outline-primary me-2 mb-2';
        btn.textContent = question;
        btn.addEventListener('click', function() {
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
    else if (lowerQuery.includes('help') || lowerQuery.includes('what can you do')) {
        const helpText = `I can help you with:
- Listing all employees
- Showing late employees
- Showing absent employees
- Telling you how many employees we have
- Answering questions about employee data`;
        addChatMessage(helpText, 'bot');
    }
    else {
        addChatMessage("I'm sorry, I didn't understand that. Try asking about employees, late arrivals, or absences.", 'bot');
    }
}

// Check for late employees and notify
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
        
        if (lateEmployees.length > 0) {
            notifyLateEmployees(lateEmployees);
        }
    } catch (error) {
        console.error('Error checking late employees:', error);
    }
}

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
    } catch (error) {
        console.error('Error showing notification:', error);
    }
}

function playNotificationSound() {
    try {
        const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-alarm-digital-clock-beep-989.mp3');
        audio.play().catch(e => console.log('Audio play failed:', e));
    } catch (error) {
        console.error('Error playing notification sound:', error);
    }
}

// Form handlers with validation and error handling
function handleEmployeeRegistration(e) {
    e.preventDefault();
    
    try {
        const empId = getElement('empId').value;
        const fullName = getElement('fullName').value;
        const phoneNumber = getElement('phoneNumber').value;
        const shiftType = getElement('shiftType').value;
        const workingDays = parseInt(getElement('workingDays').value);
        const agreedSalary = parseFloat(getElement('agreedSalary').value);
        const paymentDay = parseInt(getElement('paymentDay').value);
        
        // Validate input
        if (!empId || !fullName) {
            throw new Error('Employee ID and Name are required');
        }
        
        // Check if employee already exists
        if (employees.some(emp => emp.id === empId)) {
            throw new Error('Employee with this ID already exists!');
        }
        
        const newEmployee = {
            id: empId,
            name: fullName,
            phone: phoneNumber,
            shift: shiftType,
            workingDays: workingDays,
            salary: agreedSalary,
            paymentDay: paymentDay,
            status: 'active',
            deductions: []
        };
        
        // Validate employee data
        validateEmployeeData(newEmployee);
        
        employees.push(newEmployee);
        saveToLocalStorage();
        
        showAlert('Employee registered successfully!');
        employeeForm.reset();
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

function handleAttendanceRecording(e) {
    e.preventDefault();
    
    try {
        const empId = getElement('attendanceEmpId').value;
        const date = getElement('attendanceDate').value;
        const arrivalTime = getElement('arrivalTime').value;
        const shiftType = getElement('shiftTypeAttendance').value;
        
        // Check if employee exists
        const employee = employees.find(emp => emp.id === empId);
        if (!employee) {
            throw new Error('Employee not found!');
        }
        
        // Check if attendance already recorded for this date
        const existingRecord = attendanceRecords.find(record => 
            record.empId === empId && record.date === date
        );
        
        if (existingRecord) {
            throw new Error('Attendance already recorded for this employee on the selected date!');
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
        
        const attendanceRecord = {
            empId: empId,
            date: date,
            arrivalTime: arrivalTime,
            shiftType: shiftType,
            status: status,
            minutesLate: minutesLate
        };
        
        attendanceRecords.push(attendanceRecord);
        saveToLocalStorage();
        
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
        
        attendanceForm.reset();
        updateLateEmployeesList();
        updateAbsentEmployeesList();
        
        // If late, check if we should notify
        if (status === 'late') {
            const today = new Date().toISOString().split('T')[0];
            if (date === today) {
                notifyLateEmployees([attendanceRecord]);
            }
        }
        
        showAlert('Attendance recorded successfully!');
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

function handleLeaveRecording(e) {
    e.preventDefault();
    
    try {
        const empId = getElement('leaveEmpId').value;
        const leaveType = getElement('leaveType').value;
        const startDate = getElement('leaveStartDate').value;
        const endDate = getElement('leaveEndDate').value;
        
        // Validate dates
        if (new Date(startDate) > new Date(endDate)) {
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
            endDate: endDate
        };
        
        leaveRecords.push(leaveRecord);
        saveToLocalStorage();
        
        showAlert('Leave/Rest days added successfully!');
        leaveForm.reset();
        updateLeaveDaysList();
        updateAbsentEmployeesList();
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

function handleSalaryCalculation() {
    try {
        const empId = getElement('salaryEmpId').value;
        const calcMonth = getElement('calcMonth').value;
        const emergencyCalc = getElement('emergencyCalc').checked;
        
        if (!empId && !calcMonth) {
            throw new Error('Please enter Employee ID or select a month to calculate salaries for all employees');
        }
        
        if (empId) {
            calculateEmployeeSalary(empId, calcMonth, emergencyCalc);
        } else {
            calculateAllSalaries(calcMonth, emergencyCalc);
        }
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

function handleEmployeeSearch() {
    try {
        const searchTerm = getElement('searchTerm').value.toLowerCase();
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
                        <h5>${emp.name} <small class="text-muted">${emp.id}</small></h5>
                        <p>Shift: ${emp.shift === 'day' ? 'Day Shift (09:30 AM)' : 'Night Shift (09:30 PM)'}</p>
                        <p>Status: ${emp.status === 'active' ? '<span class="text-success">Active</span>' : '<span class="text-danger">Inactive</span>'}</p>
                        <button class="btn btn-sm btn-primary view-employee" data-id="${emp.id}">View Details</button>
                        ${emp.status === 'active' ? `<button class="btn btn-sm btn-warning add-deduction" data-id="${emp.id}">Add Deduction</button>` : ''}
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

function handleEmployeeDeregistration(e) {
    e.preventDefault();
    
    try {
        const empId = getElement('deregisterEmpId').value;
        const reason = getElement('deregisterReason').value;
        
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
            saveToLocalStorage();
            
            showAlert('Employee has been deregistered.');
            deregisterForm.reset();
        }
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

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
            paymentDay: parseInt(empPaymentDay)
        };
        
        validateEmployeeData(updatedEmployee);
        
        employees[employeeIndex] = updatedEmployee;
        saveToLocalStorage();
        
        const modal = bootstrap.Modal.getInstance(getElement('employeeModal'));
        if (modal) {
            modal.hide();
        }
        
        showAlert('Employee details updated successfully!');
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

function handleDeductionAdd(e) {
    e.preventDefault();
    
    try {
        const empId = getElement('deductionEmpId').value;
        const description = getElement('deductionDescription').value;
        const amount = parseFloat(getElement('deductionAmount').value);
        
        if (!empId || !description || isNaN(amount) || amount <= 0) {
            throw new Error('Please fill all fields with valid values');
        }
        
        // Check if employee exists
        const employee = employees.find(emp => emp.id === empId);
        if (!employee) {
            throw new Error('Employee not found!');
        }
        
        const deduction = {
            empId: empId,
            description: description,
            amount: amount,
            date: new Date().toISOString().split('T')[0]
        };
        
        deductions.push(deduction);
        saveToLocalStorage();
        
        showAlert('Deduction added successfully!');
        
        const modal = bootstrap.Modal.getInstance(getElement('deductionModal'));
        if (modal) {
            modal.hide();
        }
        
        deductionForm.reset();
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Data management functions
function saveToLocalStorage() {
    try {
        localStorage.setItem('employees', JSON.stringify(employees));
        localStorage.setItem('attendance', JSON.stringify(attendanceRecords));
        localStorage.setItem('leaveRecords', JSON.stringify(leaveRecords));
        localStorage.setItem('deductions', JSON.stringify(deductions));
    } catch (error) {
        console.error('Error saving to localStorage:', error);
        showAlert('Failed to save data. Please check console for details.', 'error');
    }
}

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
            listElement.innerHTML = '<tr><td colspan="5" class="text-center">No late employees today</td></tr>';
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
                `;
                listElement.appendChild(row);
            }
        });
    } catch (error) {
        console.error('Error updating late employees list:', error);
    }
}

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
            .filter(record => {
                return record.startDate <= today && record.endDate >= today;
            })
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
                <td><button class="btn btn-sm btn-danger mark-absent" data-id="${employee.id}">Mark Absent</button></td>
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
                minutesLate: 0
            };
            
            attendanceRecords.push(attendanceRecord);
            saveToLocalStorage();
            
            showAlert('Employee marked as absent.');
            updateAbsentEmployeesList();
        }
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

function updateLeaveDaysList() {
    try {
        const listElement = getElement('leaveDaysList');
        if (!listElement) return;
        
        listElement.innerHTML = '';
        
        if (leaveRecords.length === 0) {
            listElement.innerHTML = '<tr><td colspan="5" class="text-center">No leave/rest days recorded</td></tr>';
            return;
        }
        
        leaveRecords.forEach(record => {
            const employee = employees.find(emp => emp.id === record.empId);
            if (employee) {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${employee.id}</td>
                    <td>${employee.name}</td>
                    <td>${record.type === 'paid_leave' ? 'Paid Leave' : 'Rest Day'}</td>
                    <td>${formatDate(record.startDate)}</td>
                    <td>${formatDate(record.endDate)}</td>
                `;
                listElement.appendChild(row);
            }
        });
    } catch (error) {
        console.error('Error updating leave days list:', error);
    }
}

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
            </form>
            
            <h5 class="mt-4">Attendance Records</h5>
            <div class="table-responsive">
                <table class="table table-sm">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Shift</th>
                            <th>Arrival Time</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        if (empAttendance.length === 0) {
            html += '<tr><td colspan="4" class="text-center">No attendance records</td></tr>';
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
                    </tr>
                `;
            });
        }
        
        html += `
                    </tbody>
                </table>
            </div>
            
            <h5 class="mt-4">Leave/Rest Days</h5>
            <div class="table-responsive">
                <table class="table table-sm">
                    <thead>
                        <tr>
                            <th>Type</th>
                            <th>Start Date</th>
                            <th>End Date</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        if (empLeaves.length === 0) {
            html += '<tr><td colspan="3" class="text-center">No leave/rest days</td></tr>';
        } else {
            empLeaves.forEach(leave => {
                html += `
                    <tr>
                        <td>${leave.type === 'paid_leave' ? 'Paid Leave' : 'Rest Day'}</td>
                        <td>${formatDate(leave.startDate)}</td>
                        <td>${formatDate(leave.endDate)}</td>
                    </tr>
                `;
            });
        }
        
        html += `
                    </tbody>
                </table>
            </div>
            
            <h5 class="mt-4">Deductions</h5>
            <div class="mb-3">
                <strong>Total Deductions: Ksh ${totalDeductions.toFixed(2)}</strong>
            </div>
            <div class="deductions-list">
        `;
        
        if (empDeductions.length === 0) {
            html += '<div class="alert alert-info">No deductions recorded</div>';
        } else {
            empDeductions.forEach(ded => {
                html += `
                    <div class="deduction-item mb-2 p-2 border rounded">
                        <div class="d-flex justify-content-between">
                            <strong>${ded.description}</strong>
                            <span>Ksh ${ded.amount.toFixed(2)}</span>
                        </div>
                        <small class="text-muted">${formatDate(ded.date)}</small>
                    </div>
                `;
            });
        }
        
        html += `</div>`;
        
        modalBody.innerHTML = html;
        
        const modal = new bootstrap.Modal(getElement('employeeModal'));
        modal.show();
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

function calculateEmployeeSalary(empId, month, emergencyCalc = false) {
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
            const [year, month] = record.date.split('-').map(Number);
            return record.empId === empId && year === calcYear && month === calcMonth;
        });
        
        // Filter leave records for this employee and month
        const monthLeaves = leaveRecords.filter(leave => {
            return leave.empId === empId && 
                ((new Date(leave.startDate) <= new Date(calcYear, calcMonth - 1, daysInMonth)) && 
                (new Date(leave.endDate) >= new Date(calcYear, calcMonth - 1, 1)));
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
        
        // Calculate net salary
        const grossSalary = employee.salary;
        const totalDeductions = lateDeduction + absentDeduction + otherDeductions;
        const netSalary = grossSalary - totalDeductions;
        
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
                </div>
                <div class="col-md-6">
                    <p><strong>Agreed Salary:</strong> Ksh ${employee.salary.toFixed(2)}</p>
                    <p><strong>Working Days:</strong> ${employee.workingDays}</p>
                    <p><strong>Payment Day:</strong> ${employee.paymentDay}</p>
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
                    <p><strong>Total Deductions: Ksh ${totalDeductions.toFixed(2)}</strong></p>
                </div>
            </div>
            
            <hr>
            
            <div class="alert alert-success">
                <h4>Net Salary: Ksh ${netSalary.toFixed(2)}</h4>
            </div>
        `;
        
        salaryResult.classList.remove('d-none');
        showAlert('Salary calculated successfully!');
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

function calculateAllSalaries(calcMonth, emergencyCalc = false) {
    try {
        const activeEmployees = employees.filter(emp => emp.status === 'active');
        if (activeEmployees.length === 0) {
            throw new Error('No active employees found');
        }
        
        // Get the year and month for calculation
        let calcYear, month;
        if (calcMonth) {
            [calcYear, month] = calcMonth.split('-').map(Number);
        } else {
            const today = new Date();
            calcYear = today.getFullYear();
            month = today.getMonth() + 1;
        }
        
        const salaryResults = [];
        
        activeEmployees.forEach(employee => {
            // Similar calculation logic as calculateEmployeeSalary
            // For brevity, we'll just show a summary here
            salaryResults.push({
                id: employee.id,
                name: employee.name,
                salary: employee.salary
            });
        });
        
        // Show summary
        const salaryResult = getElement('salaryResult');
        const salaryDetails = getElement('salaryDetails');
        
        if (!salaryResult || !salaryDetails) return;
        
        let html = `
            <div class="alert alert-info">
                <h4>Bulk Salary Calculation for ${calcYear}-${String(month).padStart(2, '0')}</h4>
                <p>Calculated salaries for ${activeEmployees.length} employees</p>
            </div>
            
            <div class="table-responsive">
                <table class="table table-striped">
                    <thead>
                        <tr>
                            <th>Employee ID</th>
                            <th>Name</th>
                            <th>Base Salary</th>
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
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
            
            <div class="alert alert-warning">
                Note: For detailed individual salary breakdowns, please calculate salaries one by one.
            </div>
        `;
        
        salaryDetails.innerHTML = html;
        salaryResult.classList.remove('d-none');
        showAlert(`Calculated salaries for ${activeEmployees.length} employees`);
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

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

// Export functions for other buttons (similar to existing ones)
document.getElementById('exportAllEmployees')?.addEventListener('click', function() {
    exportToCSV(employees.map(emp => ({
        id: emp.id,
        name: emp.name,
        phone: emp.phone,
        shift: emp.shift === 'day' ? 'Day Shift' : 'Night Shift',
        workingDays: emp.workingDays,
        salary: emp.salary,
        paymentDay: emp.paymentDay,
        status: emp.status
    })), 'all_employees.csv');
});

document.getElementById('exportLateEmployees')?.addEventListener('click', function() {
    const today = new Date().toISOString().split('T')[0];
    const lateEmployees = attendanceRecords.filter(record => 
        record.date === today && record.status === 'late'
    ).map(record => {
        const employee = employees.find(emp => emp.id === record.empId);
        return {
            id: record.empId,
            name: employee ? employee.name : 'Unknown',
            shift: record.shiftType === 'day' ? 'Day Shift' : 'Night Shift',
            arrivalTime: record.arrivalTime,
            minutesLate: record.minutesLate
        };
    });
    
    exportToCSV(lateEmployees, 'late_employees.csv');
});

document.getElementById('exportAbsentEmployees')?.addEventListener('click', function() {
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
    ).map(emp => ({
        id: emp.id,
        name: emp.name,
        shift: emp.shift === 'day' ? 'Day Shift' : 'Night Shift',
        status: 'Absent'
    }));
    
    exportToCSV(absentEmployees, 'absent_employees.csv');
});

document.getElementById('exportLeaveDays')?.addEventListener('click', function() {
    const leaveData = leaveRecords.map(record => {
        const employee = employees.find(emp => emp.id === record.empId);
        return {
            id: record.empId,
            name: employee ? employee.name : 'Unknown',
            type: record.type === 'paid_leave' ? 'Paid Leave' : 'Rest Day',
            startDate: record.startDate,
            endDate: record.endDate
        };
    });
    
    exportToCSV(leaveData, 'leave_days.csv');
});

// Print functions
document.getElementById('printLateEmployees')?.addEventListener('click', function() {
    window.print();
});

document.getElementById('printAbsentEmployees')?.addEventListener('click', function() {
    window.print();
});

document.getElementById('printLeaveDays')?.addEventListener('click', function() {
    window.print();
});

document.getElementById('printSalary')?.addEventListener('click', function() {
    window.print();
});

// Notify functions
document.getElementById('notifyLateEmployees')?.addEventListener('click', function() {
    const today = new Date().toISOString().split('T')[0];
    const lateEmployees = attendanceRecords.filter(record => 
        record.date === today && record.status === 'late'
    );
    
    if (lateEmployees.length === 0) {
        showAlert('No late employees today!', 'info');
        return;
    }
    
    notifyLateEmployees(lateEmployees);
});

document.getElementById('notifyAbsentEmployees')?.addEventListener('click', function() {
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
        showAlert('No absent employees today!', 'info');
        return;
    }
    
    if (Notification.permission === 'granted') {
        const employeeNames = absentEmployees.map(emp => emp.name).join(', ');
        new Notification('Absent Employees', {
            body: `The following employees are absent today: ${employeeNames}`,
            icon: 'https://cdn-icons-png.flaticon.com/512/3143/3143463.png'
        });
        playNotificationSound();
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                const employeeNames = absentEmployees.map(emp => emp.name).join(', ');
                new Notification('Absent Employees', {
                    body: `The following employees are absent today: ${employeeNames}`,
                    icon: 'https://cdn-icons-png.flaticon.com/512/3143/3143463.png'
                });
                playNotificationSound();
            }
        });
    }
});



const CACHE_NAME = 'bt-hotel-ems-v1';
const ASSETS_TO_CACHE = [
  '/BT-management-System/',
  '/BT-management-System/index.html',
  '/BT-management-System/management.css',
  '/BT-management-System/management.js',
  '/BT-management-System/icons/icon-192x192.png',
  '/BT-management-System/icons/icon-512x512.png',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});
//file storage in my database
import postgres from 'postgres'

const connectionString = process.env.DATABASE_URL
const sql = postgres(connectionString)

export default sql

//database api structure
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://uikkgavreddykndzapvf.supabase.co'
const supabaseKey = process.env.SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

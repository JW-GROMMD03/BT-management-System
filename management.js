// Employee data structure (will be stored in localStorage)
let employees = [];
let attendanceRecords = [];
let leaveRecords = [];
let temporaryLeaves = [];
let salaryReminders = [];
let deductions = [];
let comments = [];
let salaryRecords = []; 
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
     updateSalaryReminders();
     updateEmployeeLeaveStatus();
    checkOverstayedLeaves();

     // Update every 6 hours
setInterval(updateSalaryReminders, 6 * 60 * 60 * 1000);

// Also update when the salary reminders tab is shown
document.querySelector('[data-bs-target="#salaryReminders"]')?.addEventListener('click', updateSalaryReminders);
    

    // Set default dates
    const today = new Date().toISOString().split('T')[0];
    const attendanceDate = getElement('attendanceDate');
    if (attendanceDate) attendanceDate.value = today;
    
    // Initialize UI
    updateLateEmployeesList();
    updateAbsentEmployeesList();
    updateLeaveDaysList();
    updateSalaryReports();
     // Update leave statuses
    updateEmployeeLeaveStatus();
    
    // Check for overstayed leaves
    checkOverstayedLeaves();
    
    // Calculate salary reminders
    calculateSalaryReminders();

     setInterval(checkOverstayedLeaves, 60000); // Check every minute
    setInterval(updateSalaryReminders, 86400000)
    // Initialize quick search functionality
    initQuickSearch();
});

// Initialize quick search functionality
function initQuickSearch() {
    const searchInput = getElement('quickSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', handleQuickSearch);
    }
    
    // Add event listeners for the new buttons
    document.getElementById('updateProjectionBtn')?.addEventListener('click', updateSalaryReminders);
    document.getElementById('viewTrendsBtn')?.addEventListener('click', viewSalaryTrends);
    document.getElementById('printRemindersBtn')?.addEventListener('click', printSalaryReminders);
    document.getElementById('exportRemindersBtn')?.addEventListener('click', exportSalaryRemindersCSV);
    document.getElementById('notifyLateBtn')?.addEventListener('click', notifyLateEmployeesFromReminders);
    document.getElementById('notifyAbsentBtn')?.addEventListener('click', notifyAbsentEmployeesFromReminders);
}


// Load data from localStorage
function loadData() {
    try {

        // Load all data with compression
        const keys = [
            'employees', 'attendance', 'temporaryLeaves', 'salaryReminders',
            'leaveRecords', 'deductions', 'salaryRecords', 'comments'
        ];
        
        keys.forEach(key => {
            const compressed = localStorage.getItem(key);
            if (compressed) {
                const decompressed = LZString.decompress(compressed);
                window[key] = JSON.parse(decompressed) || [];
            }
        });

         const compressedTempLeaves = localStorage.getItem('temporaryLeaves');
        if (compressedTempLeaves) {
            const decompressed = LZString.decompress(compressedTempLeaves);
            temporaryLeaves = JSON.parse(decompressed) || [];
        }
        
        // Load salary reminders
        const compressedReminders = localStorage.getItem('salaryReminders');
        if (compressedReminders) {
            const decompressed = LZString.decompress(compressedReminders);
            salaryReminders = JSON.parse(decompressed) || [];
        }
        
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

function updateEmployeeLeaveStatus() {
    const today = new Date().toISOString().split('T')[0];
    
    leaveRecords.forEach(leave => {
        // Update leave status
        if (leave.endDate < today) {
            leave.status = 'completed';
            
            // Check if employee has returned (marked in attendance)
            const hasReturned = attendanceRecords.some(att => 
                att.empId === leave.empId && 
                att.date > leave.endDate &&
                att.status !== 'absent'
            );
            
            if (!hasReturned) {
                leave.status = 'overdue';
                // Calculate overdue days
                const endDate = new Date(leave.endDate);
                const todayDate = new Date(today);
                const diffTime = Math.abs(todayDate - endDate);
                leave.overdueDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            }
        } else if (leave.startDate <= today && leave.endDate >= today) {
            leave.status = 'active';
        } else {
            leave.status = 'inactive';
        }
    });
    
    saveData();
}

// Handle temporary leave recording
function handleTemporaryLeaveRecording(e) {
    e.preventDefault();
    
    try {
        const empId = getElement('tempLeaveEmpId').value;
        const date = getElement('tempLeaveDate').value;
        const startTime = getElement('tempLeaveStartTime').value;
        const expectedReturn = getElement('tempLeaveExpectedReturn').value;
        const reason = getElement('tempLeaveReason').value;
        
        if (!empId || !date || !startTime || !expectedReturn || !reason) {
            throw new Error('All fields are required');
        }
        
        const employee = employees.find(emp => emp.id === empId);
        if (!employee) {
            throw new Error('Employee not found');
        }
        
        const tempLeave = {
            empId: empId,
            date: date,
            startTime: startTime,
            expectedReturn: expectedReturn,
            actualReturn: null,
            reason: reason,
            status: 'permitted',
            recordedAt: new Date().toISOString()
        };
        
        temporaryLeaves.push(tempLeave);
        saveData();
        
        showAlert('Temporary leave recorded successfully!');
        
        const modal = bootstrap.Modal.getInstance(getElement('temporaryLeaveModal'));
        if (modal) {
            modal.hide();
        }
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Check for overstayed temporary leaves
function checkOverstayedLeaves() {
    const now = new Date();
    const currentTime = now.toTimeString().substring(0, 5);
    const today = now.toISOString().split('T')[0];
    
    temporaryLeaves.forEach(leave => {
        if (leave.date === today && leave.status === 'permitted' && leave.expectedReturn < currentTime) {
            leave.status = 'overstayed';
            leave.overstayedMinutes = calculateMinutesDifference(leave.expectedReturn, currentTime);
            saveData();
        }
    });
}

function markTemporaryLeaveReturn(empId, date) {
    const now = new Date();
    const returnTime = now.toTimeString().substring(0, 5);
    
    const leaveIndex = temporaryLeaves.findIndex(l => 
        l.empId === empId && l.date === date && l.status !== 'returned'
    );
    
    if (leaveIndex !== -1) {
        temporaryLeaves[leaveIndex].actualReturn = returnTime;
        temporaryLeaves[leaveIndex].status = 'returned';
        
        if (temporaryLeaves[leaveIndex].expectedReturn < returnTime) {
            temporaryLeaves[leaveIndex].status = 'overstayed';
            temporaryLeaves[leaveIndex].overstayedMinutes = calculateMinutesDifference(
                temporaryLeaves[leaveIndex].expectedReturn, 
                returnTime
            );
        }
        
        saveData();
        showAlert('Employee return recorded successfully!');
    } else {
        showAlert('No matching temporary leave record found', 'warning');
    }
}

// Calculate salary reminders
function calculateSalaryReminders() {
    salaryReminders = [];
    
    // Group employees by payment frequency
    const weeklyEmployees = employees.filter(emp => emp.paymentFrequency === 'weekly');
    const biweeklyEmployees = employees.filter(emp => emp.paymentFrequency === 'biweekly');
    const monthlyEmployees = employees.filter(emp => emp.paymentFrequency === 'monthly');
    
    // Calculate next payment dates
    const today = new Date();
    const currentDay = today.getDate();
    
    // Weekly payments (every Friday)
    const nextFriday = new Date(today);
    nextFriday.setDate(today.getDate() + (5 + 7 - today.getDay()) % 7);
    if (weeklyEmployees.length > 0) {
        salaryReminders.push({
            frequency: 'weekly',
            paymentDate: nextFriday.toISOString().split('T')[0],
            employeeCount: weeklyEmployees.length,
            totalAmount: weeklyEmployees.reduce((sum, emp) => sum + emp.salary, 0)
        });
    }
    
    // Biweekly payments (every other Friday)
    const nextBiweeklyFriday = new Date(nextFriday);
    if (today.getDay() >= 5) { // If today is Friday or later
        nextBiweeklyFriday.setDate(nextFriday.getDate() + 7);
    }
    if (biweeklyEmployees.length > 0) {
        salaryReminders.push({
            frequency: 'biweekly',
            paymentDate: nextBiweeklyFriday.toISOString().split('T')[0],
            employeeCount: biweeklyEmployees.length,
            totalAmount: biweeklyEmployees.reduce((sum, emp) => sum + emp.salary, 0)
        });
    }
    
    // Monthly payments
    monthlyEmployees.forEach(emp => {
        let paymentDate = new Date(today.getFullYear(), today.getMonth(), emp.paymentDay);
        if (currentDay > emp.paymentDay) {
            paymentDate = new Date(today.getFullYear(), today.getMonth() + 1, emp.paymentDay);
        }
        
        salaryReminders.push({
            frequency: 'monthly',
            paymentDate: paymentDate.toISOString().split('T')[0],
            employeeCount: 1,
            totalAmount: emp.salary,
            employeeId: emp.id
        });
    });
    
    saveData();
    updateSalaryRemindersDisplay();
}

function updateSalaryRemindersDisplay() {
    const remindersList = getElement('salaryRemindersList');
    if (!remindersList) return;
    
    remindersList.innerHTML = '';
    
    
    if (salaryReminders.length === 0) {
        remindersList.innerHTML = '<p>No upcoming salary payments</p>';
        return;
    }
    
    const today = new Date();
    
    salaryReminders.sort((a, b) => new Date(a.paymentDate) - new Date(b.paymentDate));
    
    salaryReminders.forEach(reminder => {
        const paymentDate = new Date(reminder.paymentDate);
        const daysUntil = Math.ceil((paymentDate - today) / (1000 * 60 * 60 * 24));
        const isUrgent = daysUntil <= 2;
        
        const reminderDiv = document.createElement('div');
        reminderDiv.className = `salary-reminder ${isUrgent ? 'urgent' : ''}`;
        
        let employeeInfo = '';
        if (reminder.employeeId) {
            const emp = employees.find(e => e.id === reminder.employeeId);
            if (emp) {
                employeeInfo = `<p class="mb-1"><strong>Employee:</strong> ${emp.name} (${emp.id})</p>`;
            }
        } else {
            employeeInfo = `<p class="mb-1"><strong>Employees:</strong> ${reminder.employeeCount}</p>`;
        }
        
        reminderDiv.innerHTML = `
            <h5>${reminder.frequency === 'weekly' ? 'Weekly' : 
                  reminder.frequency === 'biweekly' ? 'Biweekly' : 'Monthly'} Payment</h5>
            ${employeeInfo}
            <p class="mb-1"><strong>Date:</strong> ${formatDate(reminder.paymentDate)}</p>
            <p class="mb-1"><strong>Amount:</strong> Ksh ${reminder.totalAmount.toFixed(2)}</p>
            <p class="mb-0"><strong>Days until payment:</strong> ${daysUntil} ${isUrgent ? '(Urgent!)' : ''}</p>
        `;
        
        remindersList.appendChild(reminderDiv);
    });
    
    updateSalarySavingsInfo();
}

// Update salary savings information
function updateSalarySavingsInfo() {

    const savingsInfo = getElement('salarySavingsInfo');
    if (!savingsInfo) return;
    
    const monthlyPayments = salaryReminders.filter(r => r.frequency === 'monthly');
    const totalMonthly = monthlyPayments.reduce((sum, r) => sum + r.totalAmount, 0);
    
    if (totalMonthly === 0) {
        savingsInfo.innerHTML = '<p>No monthly salary payments scheduled</p>';
        return;
    }
    
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysRemaining = daysInMonth - today.getDate();
    
    const dailySavingsNeeded = totalMonthly / daysInMonth;
    const remainingDailySavings = totalMonthly / daysRemaining;
    
    savingsInfo.innerHTML = `
        <div class="alert alert-info">
            <h5>Monthly Salary Savings Plan</h5>
            <p><strong>Total monthly salaries:</strong> Ksh ${totalMonthly.toFixed(2)}</p>
            <p><strong>Recommended daily savings:</strong> Ksh ${dailySavingsNeeded.toFixed(2)}</p>
            <p><strong>Current daily savings needed:</strong> Ksh ${remainingDailySavings.toFixed(2)}</p>
        </div>
    `;
    
    renderSalarySavingsChart(totalMonthly, dailySavingsNeeded, remainingDailySavings);
}

// View salary trends
function viewSalaryTrends() {
    try {
        // Get data for the chart
        const monthlyData = {};
        salaryRecords.forEach(record => {
            if (!monthlyData[record.month]) {
                monthlyData[record.month] = 0;
            }
            monthlyData[record.month] += record.netSalary;
        });
        
        const months = Object.keys(monthlyData).sort();
        const amounts = months.map(month => monthlyData[month]);
        
        // Create chart
        const ctx = document.getElementById('salaryTrendsChart').getContext('2d');
        
        // Destroy previous chart if it exists
        if (window.salaryTrendsChart) {
            window.salaryTrendsChart.destroy();
        }
        
        window.salaryTrendsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: months,
                datasets: [{
                    label: 'Total Salary Payments (Ksh)',
                    data: amounts,
                    borderColor: 'rgba(54, 162, 235, 1)',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    fill: true,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Amount (Ksh)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Month'
                        }
                    }
                }
            }
        });
        
        // Show the trends modal
        const trendsModal = new bootstrap.Modal(getElement('salaryTrendsModal'));
        trendsModal.show();
        
    } catch (error) {
        showAlert('Error displaying salary trends: ' + error.message, 'error');
    }
}

// Late Employees Panel Functions
function printLateEmployees() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const lateEmployees = attendanceRecords.filter(record => 
            record.date === today && record.status === 'late'
        );
        
        if (lateEmployees.length === 0) {
            showAlert('No late employees to print', 'info');
            return;
        }

        let printContent = '<h2>Late Employees - ' + formatDate(today) + '</h2><table class="table"><thead><tr><th>Employee ID</th><th>Name</th><th>Shift</th><th>Arrival Time</th><th>Minutes Late</th></tr></thead><tbody>';
        
        lateEmployees.forEach(record => {
            const employee = employees.find(emp => emp.id === record.empId);
            if (employee) {
                printContent += `
                    <tr>
                        <td>${employee.id}</td>
                        <td>${employee.name}</td>
                        <td>${record.shiftType === 'day' ? 'Day Shift' : 'Night Shift'}</td>
                        <td>${record.arrivalTime}</td>
                        <td>${record.minutesLate}</td>
                    </tr>
                `;
            }
        });
        
        printContent += '</tbody></table>';
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Late Employees Report</title>
                    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                    <style>
                        @media print {
                            body { padding: 20px; }
                        }
                    </style>
                </head>
                <body>
                    ${printContent}
                    <script>
                        window.onload = function() {
                            setTimeout(function() {
                                window.print();
                                window.close();
                            }, 500);
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    } catch (error) {
        showAlert('Error printing late employees: ' + error.message, 'error');
    }
}

function exportLateEmployeesCSV() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const lateEmployees = attendanceRecords.filter(record => 
            record.date === today && record.status === 'late'
        );
        
        if (lateEmployees.length === 0) {
            showAlert('No late employees to export', 'info');
            return;
        }

        let csvContent = 'Employee ID,Name,Shift,Arrival Time,Minutes Late\n';
        
        lateEmployees.forEach(record => {
            const employee = employees.find(emp => emp.id === record.empId);
            if (employee) {
                csvContent += `"${employee.id}","${employee.name}","${record.shiftType === 'day' ? 'Day Shift' : 'Night Shift'}","${record.arrivalTime}",${record.minutesLate}\n`;
            }
        });
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `late_employees_${today}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showAlert('Late employees exported as CSV successfully!');
    } catch (error) {
        showAlert('Error exporting late employees: ' + error.message, 'error');
    }
}


// Absent Employees Panel Functions
function printAbsentEmployees() {
    try {
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
            showAlert('No absent employees to print', 'info');
            return;
        }

        let printContent = '<h2>Absent Employees - ' + formatDate(today) + '</h2><table class="table"><thead><tr><th>Employee ID</th><th>Name</th><th>Shift</th><th>Department</th></tr></thead><tbody>';
        
        absentEmployees.forEach(employee => {
            printContent += `
                <tr>
                    <td>${employee.id}</td>
                    <td>${employee.name}</td>
                    <td>${employee.shift === 'day' ? 'Day Shift' : 'Night Shift'}</td>
                    <td>${employee.department || 'N/A'}</td>
                </tr>
            `;
        });
        
        printContent += '</tbody></table>';
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Absent Employees Report</title>
                    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                    <style>
                        @media print {
                            body { padding: 20px; }
                        }
                    </style>
                </head>
                <body>
                    ${printContent}
                    <script>
                        window.onload = function() {
                            setTimeout(function() {
                                window.print();
                                window.close();
                            }, 500);
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    } catch (error) {
        showAlert('Error printing absent employees: ' + error.message, 'error');
    }
}


function exportAbsentEmployeesCSV() {
    try {
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
            showAlert('No absent employees to export', 'info');
            return;
        }

        let csvContent = 'Employee ID,Name,Shift,Department\n';
        
        absentEmployees.forEach(employee => {
            csvContent += `"${employee.id}","${employee.name}","${employee.shift === 'day' ? 'Day Shift' : 'Night Shift'}","${employee.department || 'N/A'}"\n`;
        });
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `absent_employees_${today}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showAlert('Absent employees exported as CSV successfully!');
    } catch (error) {
        showAlert('Error exporting absent employees: ' + error.message, 'error');
    }
}

// Print salary reminders
function printSalaryReminders() {
    try {
        const printContent = document.getElementById('salaryRemindersList').cloneNode(true);
        const printWindow = window.open('', '_blank');
        
        printWindow.document.write(`
            <html>
                <head>
                    <title>Salary Reminders</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        .salary-reminder { 
                            border: 1px solid #ddd; 
                            padding: 15px; 
                            margin-bottom: 15px; 
                            border-radius: 5px;
                        }
                        .urgent { 
                            border-left: 5px solid #dc3545;
                            background-color: #fff8f8;
                        }
                        h5 { margin-top: 0; }
                        @media print {
                            body { padding: 0; }
                        }
                    </style>
                </head>
                <body>
                    <h2>Salary Reminders - ${formatDate(new Date().toISOString())}</h2>
                    ${printContent.innerHTML}
                    <script>
                        window.onload = function() {
                            setTimeout(function() {
                                window.print();
                                window.close();
                            }, 500);
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
        
    } catch (error) {
        showAlert('Error printing salary reminders: ' + error.message, 'error');
    }
}

function exportSalaryRemindersCSV() {
    try {
        const today = new Date();
        const csvContent = [
            ['Payment Date', 'Frequency', 'Employee Count', 'Total Amount', 'Days Until Payment', 'Status'],
            ...salaryReminders.map(reminder => {
                const paymentDate = new Date(reminder.paymentDate);
                const daysUntil = Math.ceil((paymentDate - today) / (1000 * 60 * 60 * 24));
                const status = daysUntil <= 2 ? 'Urgent' : daysUntil <= 7 ? 'Upcoming' : 'Future';
                
                return [
                    formatDate(reminder.paymentDate),
                    reminder.frequency,
                    reminder.employeeCount || 1,
                    `Ksh ${reminder.totalAmount.toFixed(2)}`,
                    daysUntil,
                    status
                ];
            })
        ].map(row => row.join(',')).join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `salary_reminders_${today.toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showAlert('Salary reminders exported as CSV successfully!');
    } catch (error) {
        showAlert('Error exporting salary reminders: ' + error.message, 'error');
    }
}

// Notify late employees from reminders panel
function notifyLateEmployeesFromReminders() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const lateEmployees = attendanceRecords.filter(record => 
            record.date === today && record.status === 'late'
        );
        
        if (lateEmployees.length === 0) {
            showAlert('No late employees today', 'info');
            return;
        }
        
        notifyLateEmployees(lateEmployees);
    } catch (error) {
        showAlert('Error notifying late employees: ' + error.message, 'error');
    }
}

// Notify absent employees from reminders panel
function notifyAbsentEmployeesFromReminders() {
    try {
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
            showAlert('No absent employees today', 'info');
            return;
        }
        
        // Create notification
        if (Notification.permission === 'granted') {
            const notification = new Notification('Absent Employees Today', {
                body: `The following employees are absent today: ${absentEmployees.map(emp => emp.name).join(', ')}`,
                icon: 'https://cdn-icons-png.flaticon.com/512/3143/3143463.png'
            });
            
            playNotificationSound();
            
            // If email notifications are enabled, send email
            if (settings.enableEmailNotifications && settings.notificationEmail) {
                console.log(`Would send email to ${settings.notificationEmail} about absent employees`);
            }
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    notifyAbsentEmployeesFromReminders();
                }
            });
        }
        
        showAlert(`Notified about ${absentEmployees.length} absent employees`);
    } catch (error) {
        showAlert('Error notifying absent employees: ' + error.message, 'error');
    }
}

// Update comments display with optional filtering
function updateCommentsDisplay(filteredComments = null) {
    const commentsToDisplay = filteredComments || comments;
    const commentsList = getElement('commentsList');
    if (!commentsList) return;
    
    commentsList.innerHTML = '';
    
    if (commentsToDisplay.length === 0) {
        commentsList.innerHTML = '<p>No comments found</p>';
        return;
    }
    
    commentsToDisplay.forEach(comment => {
        const emp = employees.find(e => e.id === comment.empId);
        if (!emp) return;
        
        const commentDiv = document.createElement('div');
        commentDiv.className = `comment ${comment.type}`;
        commentDiv.innerHTML = `
            <div class="comment-header">
                <strong>${emp.name} (${emp.id})</strong>
                <span class="badge ${comment.type === 'positive' ? 'bg-success' : 'bg-warning'}">
                    ${comment.type === 'positive' ? 'Positive' : 'Negative'}
                </span>
                <span class="text-muted small">${formatDate(comment.date)}</span>
            </div>
            <div class="comment-rating">
                Rating: ${'★'.repeat(comment.rating)}${'☆'.repeat(5 - comment.rating)}
            </div>
            <div class="comment-text">${comment.comment}</div>
        `;
        
        commentsList.appendChild(commentDiv);
    });
}


// Render salary savings chart
function renderSalarySavingsChart(totalMonthly, dailyNeeded, remainingDaily) {
    const ctx = document.getElementById('salarySavingsChart').getContext('2d');
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Total Monthly', 'Daily Needed', 'Remaining Daily'],
            datasets: [{
                label: 'Salary Savings (Ksh)',
                data: [totalMonthly, dailyNeeded, remainingDaily],
                backgroundColor: [
                    'rgba(54, 162, 235, 0.5)',
                    'rgba(75, 192, 192, 0.5)',
                    'rgba(255, 99, 132, 0.5)'
                ],
                borderColor: [
                    'rgba(54, 162, 235, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(255, 99, 132, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Amount (Ksh)'
                    }
                }
            }
        }
    });
}

// Handle photo upload preview
function setupPhotoPreview() {
    const photoInput = getElement('photo');
    if (!photoInput) return;
    
    photoInput.addEventListener('change', function() {
        const file = this.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = getElement('photoPreview');
            preview.src = e.target.result;
            preview.classList.remove('d-none');
        };
        reader.readAsDataURL(file);
    });
}

// Update attendance recording to include shift comments



// Render performance analytics charts
function renderEmployeeAnalytics(empId) {
    // Attendance trend chart
    const attendanceCtx = document.getElementById('attendanceTrendChart').getContext('2d');
    const performanceCtx = document.getElementById('performanceTrendChart').getContext('2d');
    
    // Get employee's attendance records
    const empAttendance = attendanceRecords.filter(att => att.empId === empId);
    
    // Prepare data for charts
    const labels = empAttendance.map(att => formatDateShort(att.date));
    const lateMinutes = empAttendance.map(att => att.minutesLate || 0);
    const comments = empAttendance.filter(att => att.shiftComments).map(att => att.shiftComments);
    
    // Attendance trend chart
    new Chart(attendanceCtx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Minutes Late',
                data: lateMinutes,
                borderColor: 'rgba(255, 99, 132, 1)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Minutes Late'
                    }
                }
            }
        }
    });
    
    // Performance trend chart (simple example - would be enhanced with actual metrics)
    new Chart(performanceCtx, {
        type: 'bar',
        data: {
            labels: labels.slice(-10), // Last 10 records
            datasets: [{
                label: 'Performance Rating',
                data: Array(10).fill(0).map((_, i) => 5 - Math.min(4, lateMinutes[i] / 30)), // Simple rating based on lateness
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 5,
                    title: {
                        display: true,
                        text: 'Rating (1-5)'
                    }
                }
            }
        }
    });
}


// Save data to localStorage with compression
function saveData() {
    try {
        // Compress data before saving
        localStorage.setItem('employees', LZString.compress(JSON.stringify(employees)));
        localStorage.setItem('attendance', LZString.compress(JSON.stringify(attendanceRecords)));
        localStorage.setItem('temporaryLeaves', LZString.compress(JSON.stringify(temporaryLeaves)));
        localStorage.setItem('salaryReminders', LZString.compress(JSON.stringify(salaryReminders)));
        localStorage.setItem('leaveRecords', LZString.compress(JSON.stringify(leaveRecords)));
        localStorage.setItem('deductions', LZString.compress(JSON.stringify(deductions)));
        localStorage.setItem('deductions', LZString.compress(JSON.stringify(comments)));
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

    // Salary Reminders Panel
    document.getElementById('updateProjectionBtn')?.addEventListener('click', updateSalaryReminders);
    document.getElementById('viewTrendsBtn')?.addEventListener('click', viewSalaryTrends);
    document.getElementById('printRemindersBtn')?.addEventListener('click', printSalaryReminders);
    document.getElementById('exportRemindersBtn')?.addEventListener('click', exportSalaryRemindersCSV);

    // Late Employees Panel
    document.getElementById('printLateEmployeesBtn')?.addEventListener('click', printLateEmployees);
    document.getElementById('exportLateEmployeesBtn')?.addEventListener('click', exportLateEmployeesCSV);
    document.getElementById('notifyLateBtn')?.addEventListener('click', notifyLateEmployeesFromReminders);

    // Absent Employees Panel
    document.getElementById('printAbsentEmployeesBtn')?.addEventListener('click', printAbsentEmployees);
    document.getElementById('exportAbsentEmployeesBtn')?.addEventListener('click', exportAbsentEmployeesCSV);
    document.getElementById('notifyAbsentBtn')?.addEventListener('click', notifyAbsentEmployeesFromReminders);



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

         // Photo preview
    setupPhotoPreview();
    
    // Check for overstayed leaves every minute
    setInterval(checkOverstayedLeaves, 60000);
    
    // Calculate salary reminders daily
    calculateSalaryReminders();
    setInterval(calculateSalaryReminders, 86400000); // Once per day

         // Temporary leave form
    const tempLeaveForm = getElement('temporaryLeaveForm');
    if (tempLeaveForm) {
        tempLeaveForm.addEventListener('submit', handleTemporaryLeaveRecording);
        
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

     if (!searchTerm) {
        // Reset views if search is empty
        updateSalaryRemindersDisplay();
        return;
    }
    
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
        const paymentFrequency = getElement('paymentFrequency').value;
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
            paymentFrequency: paymentFrequency,
            paymentDay: paymentDay,
            department: department,
            email: email,
            status: 'active',
            deductions: [],
            createdAt: new Date().toISOString()
        };
        
        newEmployee.paymentFrequency = paymentFrequency;
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

                // Check if employee is on leave
        const today = new Date().toISOString().split('T')[0];
        const onLeave = leaveRecords.some(leave => 
            leave.empId === empId && 
            leave.startDate <= today && 
            leave.endDate >= today
        );
        
        if (onLeave) {
            throw new Error('This employee is currently on leave and cannot be marked present');
        }
        
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

document.getElementById('fetchRecordsBtn')?.addEventListener('click', fetchEmployeeRecords);
document.getElementById('exportEmployeeRecords')?.addEventListener('click', exportEmployeeRecords);
document.getElementById('printEmployeeRecord')?.addEventListener('click', printEmployeeRecord);

// Fetch Employee Records
function fetchEmployeeRecords() {
    try {
        const empId = getElement('recordEmpId').value;
        if (!empId) {
            throw new Error('Please enter an Employee ID');
        }
        
        const employee = employees.find(emp => emp.id === empId);
        if (!employee) {
            throw new Error('Employee not found');
        }
        
        // Get all related records
        const empAttendance = attendanceRecords.filter(att => att.empId === empId);
        const empLeaves = leaveRecords.filter(leave => leave.empId === empId);
        const empDeductions = deductions.filter(ded => ded.empId === empId);
        const empSalaries = salaryRecords.filter(sal => sal.empId === empId);
        
        // Display the records
        const recordsBody = getElement('employeeRecordsBody');
        if (recordsBody) {
            recordsBody.innerHTML = `
                <div class="card mb-3">
                    <div class="card-header bg-primary text-white">
                        <h5 class="mb-0">Employee Details</h5>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-6">
                                <p><strong>ID:</strong> ${employee.id}</p>
                                <p><strong>Name:</strong> ${employee.name}</p>
                                <p><strong>Phone:</strong> ${employee.phone}</p>
                            </div>
                            <div class="col-md-6">
                                <p><strong>Department:</strong> ${employee.department || 'N/A'}</p>
                                <p><strong>Shift:</strong> ${employee.shift === 'day' ? 'Day Shift' : 'Night Shift'}</p>
                                <p><strong>Status:</strong> ${employee.status === 'active' ? 'Active' : 'Inactive'}</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="card mb-3">
                    <div class="card-header bg-primary text-white">
                        <h5 class="mb-0">Attendance Records (Last 10)</h5>
                    </div>
                    <div class="card-body">
                        ${empAttendance.length > 0 ? `
                            <div class="table-responsive">
                                <table class="table table-sm">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Status</th>
                                            <th>Arrival Time</th>
                                            <th>Late Minutes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${empAttendance.slice(-10).reverse().map(att => `
                                            <tr>
                                                <td>${formatDate(att.date)}</td>
                                                <td>
                                                    ${att.status === 'on_time' ? 
                                                        '<span class="badge bg-success">On Time</span>' : 
                                                     att.status === 'late' ? 
                                                        '<span class="badge bg-warning">Late</span>' : 
                                                        '<span class="badge bg-danger">Absent</span>'}
                                                </td>
                                                <td>${att.arrivalTime || 'N/A'}</td>
                                                <td>${att.minutesLate || '0'}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : '<p>No attendance records found</p>'}
                    </div>
                </div>
                
                <div class="card mb-3">
                    <div class="card-header bg-primary text-white">
                        <h5 class="mb-0">Salary Records</h5>
                    </div>
                    <div class="card-body">
                        ${empSalaries.length > 0 ? `
                            <div class="table-responsive">
                                <table class="table table-sm">
                                    <thead>
                                        <tr>
                                            <th>Month</th>
                                            <th>Gross Salary</th>
                                            <th>Deductions</th>
                                            <th>Net Salary</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${empSalaries.slice().reverse().map(sal => `
                                            <tr>
                                                <td>${sal.month}</td>
                                                <td>Ksh ${sal.grossSalary.toFixed(2)}</td>
                                                <td>Ksh ${sal.deductions.toFixed(2)}</td>
                                                <td>Ksh ${sal.netSalary.toFixed(2)}</td>
                                                <td>
                                                    <span class="badge ${sal.status === 'paid' ? 'bg-success' : 'bg-warning'}">
                                                        ${sal.status === 'paid' ? 'Paid' : 'Pending'}
                                                    </span>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : '<p>No salary records found</p>'}
                    </div>
                </div>
            `;
        }
        
        showAlert('Employee records fetched successfully');
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Export Employee Records as PDF
function exportEmployeeRecords() {
    try {
        const empId = getElement('recordEmpId').value;
        if (!empId) {
            throw new Error('Please enter an Employee ID first');
        }
        
        const employee = employees.find(emp => emp.id === empId);
        if (!employee) {
            throw new Error('Employee not found');
        }
        
        // Get all related records
        const empAttendance = attendanceRecords.filter(att => att.empId === empId);
        const empLeaves = leaveRecords.filter(leave => leave.empId === empId);
        const empDeductions = deductions.filter(ded => ded.empId === empId);
        const empSalaries = salaryRecords.filter(sal => sal.empId === empId);
        
        // Create a comprehensive PDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Add company header
        doc.setFontSize(18);
        doc.text('Bamburi Tilapia Hotel', 105, 15, { align: 'center' });
        doc.setFontSize(14);
        doc.text('Employee Records', 105, 25, { align: 'center' });
        
        // Add employee details
        doc.setFontSize(12);
        doc.text(`Employee: ${employee.name} (${employee.id})`, 15, 40);
        doc.text(`Department: ${employee.department || 'N/A'}`, 15, 50);
        doc.text(`Shift: ${employee.shift === 'day' ? 'Day Shift' : 'Night Shift'}`, 15, 60);
        doc.text(`Salary: Ksh ${employee.salary.toFixed(2)}`, 15, 70);
        doc.text(`Status: ${employee.status === 'active' ? 'Active' : 'Inactive'}`, 15, 80);
        
        // Add attendance records
        if (empAttendance.length > 0) {
            doc.addPage();
            doc.setFontSize(14);
            doc.text('Attendance Records', 15, 20);
            doc.setFontSize(10);
            
            let yPos = 30;
            empAttendance.slice().reverse().forEach((att, i) => {
                if (yPos > 280) {
                    doc.addPage();
                    yPos = 20;
                }
                
                doc.text(
                    `${formatDate(att.date)}: ${att.status === 'on_time' ? 'On Time' : 
                     att.status === 'late' ? `Late (${att.minutesLate} mins)` : 'Absent'}`,
                    15, yPos
                );
                yPos += 10;
            });
        }
        
        // Add salary records
        if (empSalaries.length > 0) {
            doc.addPage();
            doc.setFontSize(14);
            doc.text('Salary Records', 15, 20);
            doc.setFontSize(10);
            
            yPos = 30;
            empSalaries.slice().reverse().forEach((sal, i) => {
                if (yPos > 280) {
                    doc.addPage();
                    yPos = 20;
                }
                
                doc.text(
                    `${sal.month}: Gross Ksh ${sal.grossSalary.toFixed(2)}, ` +
                    `Deductions Ksh ${sal.deductions.toFixed(2)}, ` +
                    `Net Ksh ${sal.netSalary.toFixed(2)} (${sal.status})`,
                    15, yPos
                );
                yPos += 10;
            });
        }
        
        // Save the PDF
        doc.save(`Employee_Records_${employee.id}.pdf`);
        
        showAlert('Employee records exported successfully!');
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Print Employee Record
function printEmployeeRecord() {
    try {
        const empId = getElement('recordEmpId').value;
        if (!empId) {
            throw new Error('Please enter an Employee ID first');
        }
        
        const employee = employees.find(emp => emp.id === empId);
        if (!employee) {
            throw new Error('Employee not found');
        }
        
        // Get the records body content
        const recordsBody = getElement('employeeRecordsBody');
        if (!recordsBody) return;
        
        // Create a print window
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Employee Record - ${employee.name}</title>
                    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                    <style>
                        @media print {
                            body { padding: 20px; }
                            .no-print { display: none !important; }
                        }
                    </style>
                </head>
                <body>
                    <h2 class="text-center">Employee Record - ${employee.name}</h2>
                    <p class="text-end">Printed on: ${formatDate(new Date().toISOString())}</p>
                    ${recordsBody.innerHTML}
                    <div class="no-print text-center mt-4">
                        <button onclick="window.print()" class="btn btn-primary">Print</button>
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
        `);
        printWindow.document.close();
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

                // analytics section
        html += `
            <div class="row mt-3">
                <div class="col-md-12">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="mb-0">Performance Analytics</h5>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="chart-container">
                                        <canvas id="attendanceTrendChart"></canvas>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="chart-container">
                                        <canvas id="performanceTrendChart"></canvas>
                                    </div>
                                </div>
                            </div>
                        </div>
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

         setTimeout(() => {
            renderEmployeeAnalytics(empId);
        }, 500);

    } catch (error) {
        showAlert(error.message, 'error');
    }
}




// Helper function to calculate time difference in minutes
function calculateMinutesDifference(startTime, endTime) {
    const [startHours, startMins] = startTime.split(':').map(Number);
    const [endHours, endMins] = endTime.split(':').map(Number);
    
    const startTotal = startHours * 60 + startMins;
    const endTotal = endHours * 60 + endMins;
    
    return Math.max(0, endTotal - startTotal);
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

                // Ask for shift type
        const shiftType = prompt('Are these employees on day or night shift? (Enter "day" or "night")');
        if (!shiftType || (shiftType !== 'day' && shiftType !== 'night')) {
            throw new Error('Please specify shift type (day or night)');
        }
        
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
        
        // Add shift type to attendance record
        attendanceRecord.shiftType = shiftType;
        saveData();
        showAlert(`Marked all ${activeEmployees.length} employees as present for today`);
        updateLateEmployeesList();
        updateAbsentEmployeesList();
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Update notification system to use real APIs
async function notifyLateEmployees(lateEmployees) {
    try {
        // Prepare message for admin
        const adminMessage = `Late Employees Report:\n\n${
            lateEmployees.map(record => {
                const emp = employees.find(e => e.id === record.empId);
                return `${emp ? emp.name : 'Unknown'} (${record.empId}): ${record.minutesLate} minutes late`;
            }).join('\n')
        }`;
        
        // Send to admin (simulated API call)
        await sendNotification(settings.notificationEmail, 'Late Employees Report', adminMessage);
        
        // Send individual messages
        for (const record of lateEmployees) {
            const emp = employees.find(e => e.id === record.empId);
            if (emp && (emp.phone || emp.email)) {
                const message = `Dear ${emp.name}, you were ${record.minutesLate} minutes late on ${formatDate(record.date)}. Please ensure punctuality.`;
                
                if (emp.phone) {
                    await sendSMS(emp.phone, message);
                }
                
                if (emp.email) {
                    await sendEmail(emp.email, 'Late Arrival Notification', message);
                }
            }
        }
        
        showAlert('Late employees have been notified');
    } catch (error) {
        showAlert(`Failed to send notifications: ${error.message}`, 'error');
    }
}

// Simulated API functions
async function sendSMS(phone, message) {
    // In a real implementation, this would call your SMS gateway API
    console.log(`Would send SMS to ${phone}: ${message}`);
    return new Promise(resolve => setTimeout(resolve, 500));
}

async function sendEmail(email, subject, message) {
    // In a real implementation, this would call your email service API
    console.log(`Would send email to ${email} with subject "${subject}": ${message}`);
    return new Promise(resolve => setTimeout(resolve, 500));
}

async function sendNotification(email, subject, message) {
    // In a real implementation, this would call your notification service
    console.log(`Would send notification to ${email} with subject "${subject}": ${message}`);
    return new Promise(resolve => setTimeout(resolve, 500));
}

// Update export functions to include all employee details
function exportEmployeeRecords(empId) {
    try {
        const employee = employees.find(emp => emp.id === empId);
        if (!employee) {
            throw new Error('Employee not found');
        }
        
        // Get all related records
        const empAttendance = attendanceRecords.filter(att => att.empId === empId);
        const empLeaves = leaveRecords.filter(leave => leave.empId === empId);
        const empDeductions = deductions.filter(ded => ded.empId === empId);
        const empSalaries = salaryRecords.filter(sal => sal.empId === empId);
        
        // Create a comprehensive PDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Add company header
        doc.setFontSize(18);
        doc.text('BAMBURI TILAPIA HOTEL', 105, 15, { align: 'center' });
        doc.setFontSize(14);
        doc.text('Employee Records', 105, 25, { align: 'center' });
        
        // Add employee details
        doc.setFontSize(12);
        doc.text(`Employee: ${employee.name} (${employee.id})`, 15, 40);
        doc.text(`Department: ${employee.department || 'N/A'}`, 15, 50);
        doc.text(`Shift: ${employee.shift === 'day' ? 'Day Shift' : 'Night Shift'}`, 15, 60);
        doc.text(`Salary: Ksh ${employee.salary.toFixed(2)}`, 15, 70);
        
        // Add attendance records
        doc.addPage();
        doc.setFontSize(14);
        doc.text('Attendance Records', 15, 20);
        doc.setFontSize(10);
        
        let yPos = 30;
        empAttendance.forEach((att, i) => {
            if (yPos > 280) {
                doc.addPage();
                yPos = 20;
            }
            
            doc.text(
                `${formatDate(att.date)}: ${att.status === 'on_time' ? 'On Time' : 
                 att.status === 'late' ? `Late (${att.minutesLate} mins)` : 'Absent'}`,
                15, yPos
            );
            yPos += 10;
        });

        // Save the PDF
        doc.save(`Employee_Records_${employee.id}.pdf`);
        
        showAlert('Employee records exported successfully!');
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

// Salary Reminders Functions
function updateSalaryReminders() {
    try {
        // Calculate upcoming payment dates
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
         // Calculate daily savings amount
        const dailySavingsAmount = parseFloat(getElement('dailySavingsAmount').value) || 0;
        // Group employees by payment frequency
        const weeklyEmployees = employees.filter(emp => emp.paymentFrequency === 'weekly');
        const biweeklyEmployees = employees.filter(emp => emp.paymentFrequency === 'biweekly');
        const monthlyEmployees = employees.filter(emp => emp.paymentFrequency === 'monthly');
        
        // Calculate upcoming payment dates for each group
        const upcomingPayments = [];
        
        // Weekly payments (every Friday)
        const nextFriday = getNextDayOfWeek(today, 5); // 5 = Friday
        if (weeklyEmployees.length > 0) {
            upcomingPayments.push({
                date: nextFriday,
                frequency: 'Weekly',
                employees: weeklyEmployees,
                amount: weeklyAmount,
                daysUntil: daysUntil,
                dailyNeeded: weeklyAmount / daysUntil,
                projectedSavings: dailySavingsAmount * daysUntil
            });
        }
        
        // Biweekly payments (every other Friday)
        const fridayAfterNext = new Date(nextFriday);
        fridayAfterNext.setDate(fridayAfterNext.getDate() + 7);
        if (biweeklyEmployees.length > 0) {
            upcomingPayments.push({
                date: biweeklyFriday,
                frequency: 'Biweekly',
                employees: biweeklyEmployees,
                amount: biweeklyAmount,
                daysUntil: daysUntil,
                dailyNeeded: biweeklyAmount / daysUntil,
                projectedSavings: dailySavingsAmount * daysUntil
            });
        }
        
        // Monthly payments
        monthlyEmployees.forEach(emp => {
            const paymentDate = new Date(currentYear, currentMonth, emp.paymentDay);
            if (paymentDate < today) {
                paymentDate.setMonth(paymentDate.getMonth() + 1);
            }
            
            upcomingPayments.push({
                date: paymentDate,
                frequency: 'Monthly',
                employees: [emp],
                amount: emp.salary,
                daysUntil: daysUntil,
                dailyNeeded: emp.salary / daysUntil,
                projectedSavings: dailySavingsAmount * daysUntil
            });
        });
        
        // Sort by date
        upcomingPayments.sort((a, b) => a.date - b.date);
        
        // Update UI
                updateUpcomingPaymentsTable(upcomingPayments);
        updateSavingsAnalytics(upcomingPayments, dailySavingsAmount);
        
        showAlert('Salary reminders updated successfully');
    } catch (error) {
        console.error('Error updating salary reminders:', error);
        showAlert('Error updating salary reminders: ' + error.message, 'error');
    }


        const paymentsList = document.getElementById('upcomingPaymentsList');
        if (paymentsList) {
            paymentsList.innerHTML = '';
            
            if (upcomingPayments.length === 0) {
                paymentsList.innerHTML = '<tr><td colspan="5" class="text-center">No upcoming payments</td></tr>';
                return;
            }
            
            upcomingPayments.forEach(payment => {
                const daysLeft = Math.ceil((payment.date - today) / (1000 * 60 * 60 * 24));
                let statusClass = 'upcoming';
                if (daysLeft <= 2) statusClass = 'urgent';
                else if (daysLeft <= 7) statusClass = 'due-soon';
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${formatDate(payment.date.toISOString())}</td>
                    <td>${payment.frequency}</td>
                    <td>${payment.employees.length}</td>
                    <td>Ksh ${payment.amount.toFixed(2)}</td>
                    <td><span class="payment-status ${statusClass}">${daysLeft} days</span></td>
                `;
                paymentsList.appendChild(row);
            });
        }
        
        
        // Update analytics
        updateSavingsAnalytics();
        updateSavingsAnalytics(upcomingPayments, dailySavingsAmount);
}


function updateUpcomingPaymentsTable(payments) {
    const paymentsList = document.getElementById('upcomingPaymentsList');
    if (!paymentsList) return;
    
    paymentsList.innerHTML = '';
    
    if (payments.length === 0) {
        paymentsList.innerHTML = '<tr><td colspan="6" class="text-center">No upcoming payments</td></tr>';
        return;
    }
    
    payments.forEach(payment => {
        const row = document.createElement('tr');
        
        // Determine status class
        let statusClass = '';
        if (payment.daysUntil <= 2) {
            statusClass = 'urgent';
        } else if (payment.daysUntil <= 7) {
            statusClass = 'due-soon';
        }
        
        row.innerHTML = `
            <td>${formatDate(payment.date.toISOString())}</td>
            <td>${payment.frequency}</td>
            <td>${payment.employees.length}</td>
            <td>Ksh ${payment.amount.toFixed(2)}</td>
            <td>${payment.daysUntil}</td>
            <td class="${statusClass}">
                ${payment.projectedSavings >= payment.amount ? 
                    '<i class="bi bi-check-circle-fill text-success"></i> On track' : 
                    '<i class="bi bi-exclamation-triangle-fill text-warning"></i> Needs attention'}
            </td>
        `;
        paymentsList.appendChild(row);
    });
}



function getNextDayOfWeek(date, dayOfWeek) {
    const result = new Date(date);
    result.setDate(date.getDate() + ((dayOfWeek + 7 - date.getDay()) % 7));
    return result;
}


function updateSavingsAnalytics() {
    try {
        const monthlyEmployees = employees.filter(emp => emp.paymentFrequency === 'monthly');
        const totalMonthly = monthlyEmployees.reduce((sum, emp) => sum + emp.salary, 0);
        
        // Get payment dates for this month
        const today = new Date();
        const paymentDates = [];
        
        monthlyEmployees.forEach(emp => {
            const paymentDate = new Date(today.getFullYear(), today.getMonth(), emp.paymentDay);
            if (paymentDate < today) {
                paymentDate.setMonth(paymentDate.getMonth() + 1);
            }
            paymentDates.push(paymentDate);
        });
        
        // Find the earliest payment date
        if (paymentDates.length === 0) return;
        
        const earliestPayment = new Date(Math.min(...paymentDates.map(d => d.getTime())));
        const daysUntilPayment = Math.ceil((earliestPayment - today) / (1000 * 60 * 60 * 24));
        
        // Calculate required daily savings
        const dailySavingsNeeded = totalMonthly / daysUntilPayment;
        
        // Update UI
        document.getElementById('totalMonthlySalaries').textContent = `Ksh ${totalMonthly.toFixed(2)}`;
        document.getElementById('dailySavingsNeeded').textContent = `Ksh ${dailySavingsNeeded.toFixed(2)}`;
          getElement('currentSavings').textContent = `Ksh ${currentSavings.toFixed(2)}`;
        
        // Initialize savings chart
        updateSavingsChart(totalMonthly, daysUntilPayment);
    } catch (error) {
        console.error('Error updating savings analytics:', error);
    }
}

function updateSavingsAnalytics(payments, dailySavings) {
    // Calculate totals
    const totalMonthly = payments
        .filter(p => p.frequency === 'Monthly')
        .reduce((sum, p) => sum + p.amount, 0);
    
    const totalWeekly = payments
        .filter(p => p.frequency === 'Weekly')
        .reduce((sum, p) => sum + p.amount, 0);
    
    const totalBiweekly = payments
        .filter(p => p.frequency === 'Biweekly')
        .reduce((sum, p) => sum + p.amount, 0);
    
    const totalAmount = totalMonthly + totalWeekly + totalBiweekly;
    
    // Find the nearest payment date
    const nearestPayment = payments.length > 0 ? payments[0] : null;
    const daysUntilNearest = nearestPayment ? nearestPayment.daysUntil : 0;
    
    // Update summary cards
    document.getElementById('totalMonthlySalaries').textContent = `Ksh ${totalAmount.toFixed(2)}`;
    
    if (nearestPayment) {
        document.getElementById('dailySavingsNeeded').textContent = 
            `Ksh ${(nearestPayment.amount / daysUntilNearest).toFixed(2)}`;
    }
    
    document.getElementById('currentSavings').textContent = 
        `Ksh ${(dailySavings * (daysUntilNearest - Math.floor(daysUntilNearest * 0.7))).toFixed(2)}`;
    
    // Update savings chart
    updateSavingsChart(totalAmount, dailySavings, daysUntilNearest);
}

function updateSavingsChart(totalNeeded, dailySavings, daysLeft) {
    const ctx = document.getElementById('savingsChart').getContext('2d');
    
    // Destroy previous chart if it exists
    if (window.savingsChart) {
        window.savingsChart.destroy();
    }
    
    const projectedSavings = dailySavings * daysLeft;
    const percentage = Math.min(100, (projectedSavings / totalNeeded) * 100);
    
    // Update status message
    const savingsStatus = document.getElementById('savingsStatus');
    if (savingsStatus) {
        if (dailySavings === 0) {
            savingsStatus.className = 'alert alert-info';
            savingsStatus.innerHTML = 'Enter daily savings amount to see projections';
        } else if (percentage >= 100) {
            savingsStatus.className = 'alert alert-success';
            savingsStatus.innerHTML = `Projected savings cover ${percentage.toFixed(1)}% of needs`;
        } else {
            savingsStatus.className = 'alert alert-warning';
            savingsStatus.innerHTML = `Projected savings cover ${percentage.toFixed(1)}% of needs - increase daily savings`;
        }
    }
    
     renderSalarySavingsChart(totalMonthlySalaries, dailySavingsNeeded, remainingDailySavings);
    
      // Destroy existing chart if it exists
    if (window.savingsChartInstance) {
        window.savingsChartInstance.destroy();
    }
    
    window.savingsChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Total Monthly', 'Daily Needed', 'Remaining Daily'],
            datasets: [{
                label: 'Salary Savings (Ksh)',
                data: [totalMonthly, dailyNeeded, remainingDaily],
                backgroundColor: [
                    'rgba(54, 162, 235, 0.5)',
                    'rgba(75, 192, 192, 0.5)',
                    'rgba(255, 99, 132, 0.5)'
                ],
                borderColor: [
                    'rgba(54, 162, 235, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(255, 99, 132, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Amount (Ksh)'
                    }
                }
            }
        }
    });


    // Create new chart
    window.savingsChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Projected Savings', 'Remaining Need'],
            datasets: [{
                data: [projectedSavings, Math.max(0, totalNeeded - projectedSavings)],
                backgroundColor: [
                    percentage >= 100 ? '#28a745' : '#ffc107',
                    '#dc3545'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: Ksh ${context.raw.toFixed(2)} (${Math.round((context.raw / totalNeeded) * 100)}%)`;
                        }
                    }
                }
            }
        }
    });
}

function handleEmployeeComment(e) {
    e.preventDefault();
    
    try {
        const empId = getElement('commentEmpId').value;
        const commentType = getElement('commentType').value;
        const rating = parseInt(getElement('commentRating').value);
        const commentText = getElement('commentText').value;
        
        if (!empId || !commentType || isNaN(rating) || !commentText) {
            throw new Error('All fields are required');
        }
        
        const employee = employees.find(emp => emp.id === empId);
        if (!employee) {
            throw new Error('Employee not found');
        }
        
        const newComment = {
            empId: empId,
            date: new Date().toISOString(),
            type: commentType,
            rating: rating,
            comment: commentText,
            recordedAt: new Date().toISOString()
        };
        
        comments.push(newComment);
        saveData();
        
        showAlert('Comment added successfully!');
        getElement('commentForm').reset();
        
        // Update employee records
        fetchEmployeeRecords(empId);
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Render employee comments chart
function renderEmployeeCommentsChart(empId) {
    const ctx = document.getElementById('commentsChart').getContext('2d');
    const empComments = comments.filter(c => c.empId === empId);
    
    if (empComments.length === 0) {
        return;
    }
    
    // Group comments by month
    const commentData = {};
    empComments.forEach(comment => {
        const month = comment.date.substring(0, 7);
        if (!commentData[month]) {
            commentData[month] = { positive: 0, negative: 0, count: 0, sum: 0 };
        }
        
        if (comment.type === 'positive') {
            commentData[month].positive++;
        } else {
            commentData[month].negative++;
        }
        
        commentData[month].count++;
        commentData[month].sum += comment.rating;
    });
    
    const months = Object.keys(commentData).sort();
    const positiveData = months.map(month => commentData[month].positive);
    const negativeData = months.map(month => commentData[month].negative);
    const avgRatingData = months.map(month => commentData[month].sum / commentData[month].count);
    
    // Destroy existing chart if it exists
    if (window.commentsChartInstance) {
        window.commentsChartInstance.destroy();
    }
    
    window.commentsChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [
                {
                    label: 'Positive Comments',
                    data: positiveData,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    fill: false
                },
                {
                    label: 'Negative Comments',
                    data: negativeData,
                    borderColor: 'rgba(255, 99, 132, 1)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    fill: false
                },
                {
                    label: 'Average Rating',
                    data: avgRatingData,
                    borderColor: 'rgba(153, 102, 255, 1)',
                    backgroundColor: 'rgba(153, 102, 255, 0.2)',
                    fill: false,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Comment Count'
                    }
                },
                y1: {
                    position: 'right',
                    beginAtZero: true,
                    max: 5,
                    title: {
                        display: true,
                        text: 'Average Rating'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
}

// Generate insight based on comments
function generateEmployeeInsight(empId) {
    const empComments = comments.filter(c => c.empId === empId);
    if (empComments.length === 0) return null;
    
    const positiveComments = empComments.filter(c => c.type === 'positive');
    const negativeComments = empComments.filter(c => c.type === 'negative');
    
    const positivePercentage = (positiveComments.length / empComments.length) * 100;
    const negativePercentage = (negativeComments.length / empComments.length) * 100;
    
    const avgRating = empComments.reduce((sum, c) => sum + c.rating, 0) / empComments.length;
    
    let insight = '';
    let action = '';
    
    if (negativePercentage > 40 && avgRating < 2.5) {
        insight = 'Consistent negative feedback and low ratings';
        action = 'Consider termination or performance improvement plan';
    } else if (negativePercentage > 30 && avgRating < 3.0) {
        insight = 'Frequent negative feedback with below average ratings';
        action = 'Requires immediate coaching and performance review';
    } else if (positivePercentage > 70 && avgRating > 4.0) {
        insight = 'Excellent performance with consistently high ratings';
        action = 'Consider for promotion or bonus';
    } else if (positivePercentage > 60 && avgRating > 3.5) {
        insight = 'Good performance with positive feedback';
        action = 'Suitable for additional responsibilities';
    } else {
        insight = 'Satisfactory performance with mixed feedback';
        action = 'Regular monitoring and development opportunities';
    }
    
    return {
        insight: insight,
        action: action,
        positivePercentage: positivePercentage,
        negativePercentage: negativePercentage,
        avgRating: avgRating
    };
}

// Export all employee data
function exportAllEmployeeData() {
    try {
        if (employees.length === 0) {
            throw new Error('No employees to export');
        }
        
        // Prepare data for export
        const exportData = employees.map(emp => {
            const empData = {
                id: emp.id,
                name: emp.name,
                phone: emp.phone,
                email: emp.email || '',
                shift: emp.shift,
                workingDays: emp.workingDays,
                salary: emp.salary,
                paymentFrequency: emp.paymentFrequency,
                paymentDay: emp.paymentDay,
                department: emp.department || '',
                status: emp.status,
                photoUrl: emp.photoUrl || '',
                registered: formatDate(emp.createdAt),
                lastUpdated: emp.updatedAt ? formatDate(emp.updatedAt) : 'N/A'
            };
            
            // Add related records
            empData.attendance = attendanceRecords.filter(att => att.empId === emp.id);
            empData.leaveRecords = leaveRecords.filter(leave => leave.empId === emp.id);
            empData.deductions = deductions.filter(ded => ded.empId === emp.id);
            empData.salaryRecords = salaryRecords.filter(sal => sal.empId === emp.id);
            empData.comments = comments.filter(com => com.empId === emp.id);
            
            return empData;
        });
        
        // Create a blob and download
        const dataStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bamburi_tilapia_employees_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showAlert('All employee data exported successfully!');
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Export single employee data
function exportSingleEmployeeData(empId) {
    try {
        const employee = employees.find(emp => emp.id === empId);
        if (!employee) {
            throw new Error('Employee not found');
        }
        
        // Prepare data for export
        const exportData = {
            id: employee.id,
            name: employee.name,
            phone: employee.phone,
            email: employee.email || '',
            shift: employee.shift,
            workingDays: employee.workingDays,
            salary: employee.salary,
            paymentFrequency: employee.paymentFrequency,
            paymentDay: employee.paymentDay,
            department: employee.department || '',
            status: employee.status,
            photoUrl: employee.photoUrl || '',
            registered: formatDate(employee.createdAt),
            lastUpdated: employee.updatedAt ? formatDate(employee.updatedAt) : 'N/A',
            attendance: attendanceRecords.filter(att => att.empId === empId),
            leaveRecords: leaveRecords.filter(leave => leave.empId === empId),
            deductions: deductions.filter(ded => ded.empId === empId),
            salaryRecords: salaryRecords.filter(sal => sal.empId === empId),
            comments: comments.filter(com => com.empId === empId)
        };
        
        // Create a blob and download
        const dataStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bamburi_tilapia_employee_${empId}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showAlert('Employee data exported successfully!');
    } catch (error) {
        showAlert(error.message, 'error');
    }
}



// Helper function to get next specific day of week
function getNextDayOfWeek(date, dayOfWeek) {
    const result = new Date(date);
    result.setDate(date.getDate() + ((dayOfWeek + 7 - date.getDay()) % 7));
    return result;
}

function updateSavingsChart(totalNeeded, daysLeft) {
    try {
        const ctx = document.getElementById('savingsChart').getContext('2d');
        const dailyAmount = parseFloat(document.getElementById('dailySavingsAmount').value) || 0;
        
        // Calculate projection
        const projectedSavings = dailyAmount * daysLeft;
        const percentage = Math.min(100, (projectedSavings / totalNeeded) * 100);
        
        // Update savings status
        const savingsStatus = document.getElementById('savingsStatus');
        if (savingsStatus) {
            if (dailyAmount === 0) {
                savingsStatus.className = 'alert alert-info';
                savingsStatus.innerHTML = 'Enter daily savings amount to see projections';
            } else if (projectedSavings >= totalNeeded) {
                savingsStatus.className = 'alert alert-success';
                savingsStatus.innerHTML = `Projected savings: Ksh ${projectedSavings.toFixed(2)} (100%) - You're on track!`;
            } else {
                savingsStatus.className = 'alert alert-warning';
                savingsStatus.innerHTML = `Projected savings: Ksh ${projectedSavings.toFixed(2)} (${percentage.toFixed(1)}%) - Increase daily amount to meet target`;
            }
        }
        
        // Update current savings display
        document.getElementById('currentSavings').textContent = `Ksh ${(dailyAmount * (daysLeft - Math.floor(daysLeft * 0.7))).toFixed(2)}`;
        
        // Destroy existing chart if it exists
        if (window.savingsChart) {
            window.savingsChart.destroy();
        }
        
        // Create new chart
        window.savingsChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Saved', 'Remaining'],
                datasets: [{
                    data: [projectedSavings, Math.max(0, totalNeeded - projectedSavings)],
                    backgroundColor: [
                        projectedSavings >= totalNeeded ? '#28a745' : '#ffc107',
                        '#dc3545'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const percentage = Math.round((value / totalNeeded) * 100);
                                return `${label}: Ksh ${value.toFixed(2)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error updating savings chart:', error);
    }
}

// Add this to your setupEventListeners function
document.getElementById('updateSavingsBtn')?.addEventListener('click', function() {
    updateSavingsAnalytics();
});

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
}

// Check salary status for current month
function checkSalaryStatus(employeeId) {
  const currentMonth = new Date().getMonth();
  const salary = salaryRecords.find(
    s => s.empId === employeeId && s.month === currentMonth
  );

  if (!salary) return "Pending";
  if (salary.paidDate) return "Processed";
  if (new Date() > new Date(salary.dueDate)) return "Delayed";
  return "Pending";
}

// Send reminders to HR if salaries are delayed
function sendSalaryReminders() {
  const delayedSalaries = salaryRecords.filter(
    s => !s.paidDate && new Date() > new Date(s.dueDate)
  );

  delayedSalaries.forEach(salary => {
    sendAlert(
      `Salary delayed for ${getEmployee(salary.empId).name}`,
      "HR"
    );
  });
}

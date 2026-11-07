// State Management
let loans = [
  { id: 1, name: "Subsidized Direct Loan", balance: 5500, rate: 4.99, minPayment: 60 },
  { id: 2, name: "Unsubsidized Direct Loan", balance: 7500, rate: 6.54, minPayment: 85 }
];

let generatedSchedule = [];

// DOM Elements
const loansContainer = document.getElementById("loans-container");
const addLoanBtn = document.getElementById("add-loan-btn");
const seedDataBtn = document.getElementById("seed-data-btn");
const calculateBtn = document.getElementById("calculate-btn");
const resultsSection = document.getElementById("results-section");
const exportCsvBtn = document.getElementById("export-csv-btn");

// Initialize App
document.addEventListener("DOMContentLoaded", () => {
  renderLoanInputs();

  addLoanBtn.addEventListener("click", addLoanRow);
  seedDataBtn.addEventListener("click", loadSampleData);
  calculateBtn.addEventListener("click", runPayoffCalculation);
  exportCsvBtn.addEventListener("click", exportScheduleToCSV);
});

// Render dynamic input rows based on loans state
function renderLoanInputs() {
  loansContainer.innerHTML = "";
  
  loans.forEach((loan, index) => {
    const row = document.createElement("div");
    row.className = "loan-row";
    row.innerHTML = `
      <input type="text" placeholder="Loan Name" value="${loan.name}" onchange="updateLoan(${index}, 'name', this.value)">
      <input type="number" placeholder="Balance ($)" value="${loan.balance}" onchange="updateLoan(${index}, 'balance', parseFloat(this.value) || 0)">
      <input type="number" step="0.01" placeholder="Rate (%)" value="${loan.rate}" onchange="updateLoan(${index}, 'rate', parseFloat(this.value) || 0)">
      <input type="number" placeholder="Min Pay ($)" value="${loan.minPayment}" onchange="updateLoan(${index}, 'minPayment', parseFloat(this.value) || 0)">
      <button type="button" class="btn icon-delete" onclick="removeLoanRow(${index})" title="Delete Loan">✕</button>
    `;
    loansContainer.appendChild(row);
  });
}

function updateLoan(index, field, value) {
  loans[index][field] = value;
}

function addLoanRow() {
  const newId = loans.length > 0 ? Math.max(...loans.map(l => l.id)) + 1 : 1;
  loans.push({ id: newId, name: `Loan ${newId}`, balance: 4000, rate: 5.0, minPayment: 45 });
  renderLoanInputs();
}

function removeLoanRow(index) {
  if (loans.length === 1) {
    alert("You must keep at least one loan in your portfolio.");
    return;
  }
  loans.splice(index, 1);
  renderLoanInputs();
}

function loadSampleData() {
  loans = [
    { id: 1, name: "Federal Direct Subsidized", balance: 5500, rate: 4.99, minPayment: 60 },
    { id: 2, name: "Federal Direct Unsubsidized", balance: 7500, rate: 6.54, minPayment: 85 },
    { id: 3, name: "Private Student Loan", balance: 12000, rate: 8.25, minPayment: 155 }
  ];
  renderLoanInputs();
}

// Core Calculation Engine
function runPayoffCalculation() {
  const extraBudget = parseFloat(document.getElementById("extra-budget").value) || 0;
  const strategy = document.querySelector('input[name="strategy"]:checked').value;

  // Run calculation for chosen strategy
  const currentRun = simulatePayoff(loans, extraBudget, strategy);
  
  // Run calculation for alternate strategy to calculate exact savings difference
  const altStrategy = strategy === "avalanche" ? "snowball" : "avalanche";
  const altRun = simulatePayoff(loans, extraBudget, altStrategy);

  generatedSchedule = currentRun.schedule;

  // Update UI Metrics
  document.getElementById("metric-total-balance").innerText = `$${currentRun.initialBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  document.getElementById("metric-min-payment").innerText = `$${currentRun.totalMinPayment.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  document.getElementById("metric-payoff-time").innerText = `${currentRun.totalMonths} mos (${(currentRun.totalMonths / 12).toFixed(1)} yrs)`;
  document.getElementById("metric-total-interest").innerText = `$${currentRun.totalInterestPaid.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

  // Strategy comparison message
  const interestSaved = altRun.totalInterestPaid - currentRun.totalInterestPaid;
  const banner = document.getElementById("comparison-banner");

  if (strategy === "avalanche" && interestSaved > 0) {
    banner.innerText = `👍 Avalanche strategy saves you $${interestSaved.toFixed(2)} in interest compared to Snowball!`;
  } else if (strategy === "snowball" && interestSaved < 0) {
    banner.innerText = `ℹ️ Snowball strategy costs $${Math.abs(interestSaved).toFixed(2)} more in interest than Avalanche, but pays off small loans fastest.`;
  } else {
    banner.innerText = `Both strategies yield equivalent results for this portfolio setup.`;
  }

  renderScheduleTable(currentRun.schedule);
  resultsSection.style.display = "block";
}

// Payoff Simulation Function
function simulatePayoff(inputLoans, extraPayment, strategy) {
  // Deep copy loans
  let activeLoans = JSON.parse(JSON.stringify(inputLoans));
  
  let month = 0;
  let totalInterestPaid = 0;
  let schedule = [];
  
  const initialBalance = activeLoans.reduce((sum, l) => sum + l.balance, 0);
  const totalMinPayment = activeLoans.reduce((sum, l) => sum + l.minPayment, 0);

  // Simulation Loop
  while (activeLoans.some(l => l.balance > 0) && month < 600) { // Max 50 yrs safety cap
    month++;
    let monthlyTotalPaid = 0;
    let monthlyInterestPaid = 0;
    let monthlyPrincipalPaid = 0;

    // 1. Accrue Interest & Pay Minimums
    activeLoans.forEach(loan => {
      if (loan.balance > 0) {
        let monthlyRate = (loan.rate / 100) / 12;
        let interest = loan.balance * monthlyRate;
        loan.balance += interest;
        monthlyInterestPaid += interest;

        let payment = Math.min(loan.balance, loan.minPayment);
        loan.balance -= payment;
        monthlyTotalPaid += payment;
      }
    });

    // 2. Sort remaining active loans based on selected strategy
    let targetLoans = activeLoans.filter(l => l.balance > 0);
    if (strategy === "avalanche") {
      targetLoans.sort((a, b) => b.rate - a.rate); // Highest interest rate first
    } else {
      targetLoans.sort((a, b) => a.balance - b.balance); // Lowest balance first
    }

    // 3. Apply Extra Budget to Target Loan
    let remainingExtra = extraPayment;
    for (let loan of targetLoans) {
      if (remainingExtra <= 0) break;
      let extraApplied = Math.min(loan.balance, remainingExtra);
      loan.balance -= extraApplied;
      remainingExtra -= extraApplied;
      monthlyTotalPaid += extraApplied;
    }

    totalInterestPaid += monthlyInterestPaid;
    monthlyPrincipalPaid = monthlyTotalPaid - monthlyInterestPaid;
    
    let remainingPortfolioBalance = activeLoans.reduce((sum, l) => Math.max(0, sum + l.balance), 0);

    schedule.push({
      month,
      totalPaid: monthlyTotalPaid,
      principalPaid: monthlyPrincipalPaid,
      interestPaid: monthlyInterestPaid,
      remainingBalance: remainingPortfolioBalance
    });
  }

  return {
    initialBalance,
    totalMinPayment,
    totalMonths: month,
    totalInterestPaid,
    schedule
  };
}

// Render Table
function renderScheduleTable(schedule) {
  const tbody = document.querySelector("#schedule-table tbody");
  tbody.innerHTML = "";

  schedule.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>Month ${row.month}</td>
      <td>$${row.totalPaid.toFixed(2)}</td>
      <td>$${row.principalPaid.toFixed(2)}</td>
      <td>$${row.interestPaid.toFixed(2)}</td>
      <td>$${row.remainingBalance.toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Export CSV Function
function exportScheduleToCSV() {
  if (!generatedSchedule || generatedSchedule.length === 0) return;

  let csvContent = "data:text/csv;charset=utf-8,Month,Total Paid,Principal Paid,Interest Paid,Remaining Balance\n";
  
  generatedSchedule.forEach(r => {
    csvContent += `${r.month},${r.totalPaid.toFixed(2)},${r.principalPaid.toFixed(2)},${r.interestPaid.toFixed(2)},${r.remainingBalance.toFixed(2)}\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "student_loan_amortization_schedule.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

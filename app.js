// State Management
let loans = [
  { id: 1, name: "Subsidized Direct Loan", balance: 5500, rate: 4.99, minPayment: 60 },
  { id: 2, name: "Unsubsidized Direct Loan", balance: 7500, rate: 6.54, minPayment: 85 }
]; 

let generatedSchedule = [];
let burndownChartInstance = null;

// DOM Elements
const loansContainer = document.getElementById("loans-container");
const addLoanBtn = document.getElementById("add-loan-btn");
const seedDataBtn = document.getElementById("seed-data-btn");
const calculateBtn = document.getElementById("calculate-btn");
const resultsSection = document.getElementById("results-section");
const validationErrorBanner = document.getElementById("validation-error");

// Initialize App
document.addEventListener("DOMContentLoaded", () => {
  renderLoanInputs();

  addLoanBtn.addEventListener("click", addLoanRow);
  seedDataBtn.addEventListener("click", loadSampleData);
  calculateBtn.addEventListener("click", runPayoffCalculation);
});

// Render dynamic input rows based on loans state
function renderLoanInputs() {
  loansContainer.innerHTML = "";
  
  loans.forEach((loan, index) => {
    const row = document.createElement("div");
    row.className = "loan-row";
    row.innerHTML = `
      <div class="input-field-group">
        <span class="mobile-label">Loan Name</span>
        <input type="text" aria-label="Loan Name" placeholder="e.g. Federal Direct" value="${loan.name}" onchange="updateLoan(${index}, 'name', this.value)">
      </div>
      <div class="input-field-group">
        <span class="mobile-label">Balance ($)</span>
        <input type="number" aria-label="Balance ($)" min="0" step="100" placeholder="5000" value="${loan.balance}" onchange="updateLoan(${index}, 'balance', parseFloat(this.value))">
      </div>
      <div class="input-field-group">
        <span class="mobile-label">Interest Rate (%)</span>
        <input type="number" aria-label="Interest Rate (%)" min="0" max="100" step="0.01" placeholder="5.50" value="${loan.rate}" onchange="updateLoan(${index}, 'rate', parseFloat(this.value))">
      </div>
      <div class="input-field-group">
        <span class="mobile-label">Min. Payment ($)</span>
        <input type="number" aria-label="Minimum Monthly Payment ($)" min="0" step="5" placeholder="60" value="${loan.minPayment}" onchange="updateLoan(${index}, 'minPayment', parseFloat(this.value))">
      </div>
      <button type="button" class="btn icon-delete" onclick="removeLoanRow(${index})" title="Delete Loan" aria-label="Delete ${loan.name}">✕</button>
    `;
    loansContainer.appendChild(row);
  });
}

function updateLoan(index, field, value) {
  loans[index][field] = value;
  clearValidationError();
}

function addLoanRow() {
  const newId = loans.length > 0 ? Math.max(...loans.map(l => l.id)) + 1 : 1;
  loans.push({ id: newId, name: `Loan ${newId}`, balance: 4000, rate: 5.0, minPayment: 45 });
  clearValidationError();
  renderLoanInputs();
}

function removeLoanRow(index) {
  if (loans.length === 1) {
    showValidationError(["You must keep at least one loan in your portfolio."]);
    return;
  }
  loans.splice(index, 1);
  clearValidationError();
  renderLoanInputs();
}

function loadSampleData() {
  loans = [
    { id: 1, name: "Federal Direct Subsidized", balance: 5500, rate: 4.99, minPayment: 60 },
    { id: 2, name: "Federal Direct Unsubsidized", balance: 7500, rate: 6.54, minPayment: 85 },
    { id: 3, name: "Private Student Loan", balance: 12000, rate: 8.25, minPayment: 155 }
  ];
  clearValidationError();
  renderLoanInputs();
}

// Input Validation Helper
function validateInputs(extraBudget) {
  const errors = [];

  if (isNaN(extraBudget) || extraBudget < 0) {
    errors.push("Additional monthly budget must be $0 or greater.");
  }

  loans.forEach((loan, index) => {
    const label = loan.name && loan.name.trim() !== "" ? `"${loan.name.trim()}"` : `Loan #${index + 1}`;

    if (isNaN(loan.balance) || loan.balance <= 0) {
      errors.push(`${label}: Balance must be greater than $0.`);
    }
    if (isNaN(loan.rate) || loan.rate < 0 || loan.rate > 100) {
      errors.push(`${label}: Interest rate must be between 0% and 100%.`);
    }
    if (isNaN(loan.minPayment) || loan.minPayment <= 0) {
      errors.push(`${label}: Minimum monthly payment must be greater than $0.`);
    } else if (!isNaN(loan.balance) && !isNaN(loan.rate) && loan.balance > 0) {
      const firstMonthInterest = loan.balance * ((loan.rate / 100) / 12);
      if (loan.minPayment <= firstMonthInterest) {
        errors.push(`${label}: Minimum payment ($${loan.minPayment.toFixed(2)}) must exceed first-month interest ($${firstMonthInterest.toFixed(2)}) so the balance can decrease.`);
      }
    }
  });

  return errors;
}

function showValidationError(errors) {
  validationErrorBanner.innerHTML = `
    <strong>Please fix the following before calculating:</strong>
    <ul>${errors.map(err => `<li>${err}</li>`).join("")}</ul>
  `;
  validationErrorBanner.style.display = "block";
  resultsSection.style.display = "none";
}

function clearValidationError() {
  validationErrorBanner.style.display = "none";
  validationErrorBanner.innerHTML = "";
}

// Core Calculation Engine
function runPayoffCalculation() {
  const extraBudgetInput = document.getElementById("extra-budget").value;
  const extraBudget = extraBudgetInput === "" ? 0 : parseFloat(extraBudgetInput);

  const errors = validateInputs(extraBudget);
  if (errors.length > 0) {
    showValidationError(errors);
    return;
  }

  clearValidationError();
  const strategy = document.querySelector('input[name="strategy"]:checked').value;

  // Run calculation for chosen strategy
  const currentRun = simulatePayoff(loans, extraBudget, strategy);
  
  // Run calculation for alternate strategy (Avalanche vs Snowball)
  const altStrategy = strategy === "avalanche" ? "snowball" : "avalanche";
  const altRun = simulatePayoff(loans, extraBudget, altStrategy);

  // Run baseline calculation ($0 extra budget) for the visual chart comparison
  const baselineRun = simulatePayoff(loans, 0, strategy);

  generatedSchedule = currentRun.schedule;

  // Update UI Metrics
  document.getElementById("metric-total-balance").innerText = `$${currentRun.initialBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  document.getElementById("metric-min-payment").innerText = `$${currentRun.totalMinPayment.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  document.getElementById("metric-payoff-time").innerText = `${currentRun.totalMonths} mos (${(currentRun.totalMonths / 12).toFixed(1)} yrs)`;
  document.getElementById("metric-total-interest").innerText = `$${currentRun.totalInterestPaid.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

  // Strategy comparison message
  const interestSaved = altRun.totalInterestPaid - currentRun.totalInterestPaid;
  const banner = document.getElementById("comparison-banner");

  if (strategy === "avalanche" && interestSaved > 0.01) {
    banner.innerText = `Avalanche strategy saves you $${interestSaved.toFixed(2)} in interest compared to Snowball!`;
  } else if (strategy === "snowball" && interestSaved < -0.01) {
    banner.innerText = `Snowball strategy costs $${Math.abs(interestSaved).toFixed(2)} more in interest than Avalanche, but pays off small loans fastest.`;
  } else {
    banner.innerText = `Both strategies yield equivalent results for this portfolio setup.`;
  }

  renderBurndownChart(currentRun, baselineRun, strategy, extraBudget);
  renderScheduleTable(currentRun.schedule);
  resultsSection.style.display = "block";
}

// Payoff Simulation Function
function simulatePayoff(inputLoans, extraPayment, strategy) {
  let activeLoans = JSON.parse(JSON.stringify(inputLoans));
  
  let month = 0;
  let totalInterestPaid = 0;
  let schedule = [];
  
  const initialBalance = activeLoans.reduce((sum, l) => sum + l.balance, 0);
  const totalMinPayment = activeLoans.reduce((sum, l) => sum + l.minPayment, 0);

  while (activeLoans.some(l => l.balance > 0) && month < 600) {
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
      targetLoans.sort((a, b) => b.rate - a.rate);
    } else {
      targetLoans.sort((a, b) => a.balance - b.balance);
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

// Render Visual Balance Burn-Down Chart
function renderBurndownChart(currentRun, baselineRun, strategy, extraBudget) {
  const ctx = document.getElementById("burndown-chart").getContext("2d");

  if (burndownChartInstance) {
    burndownChartInstance.destroy();
  }

  const maxMonths = Math.max(currentRun.totalMonths, baselineRun.totalMonths);
  const labels = ["Start"];
  const strategyData = [currentRun.initialBalance];
  const baselineData = [baselineRun.initialBalance];

  for (let m = 1; m <= maxMonths; m++) {
    labels.push(`Mo ${m}`);

    const currentEntry = currentRun.schedule[m - 1];
    strategyData.push(currentEntry ? Number(currentEntry.remainingBalance.toFixed(2)) : 0);

    const baseEntry = baselineRun.schedule[m - 1];
    baselineData.push(baseEntry ? Number(baseEntry.remainingBalance.toFixed(2)) : 0);
  }

  const strategyLabel = strategy === "avalanche" ? "Avalanche Plan" : "Snowball Plan";

  const datasets = [
    {
      label: `${strategyLabel} (+$${extraBudget}/mo)`,
      data: strategyData,
      borderColor: "#2563eb",
      backgroundColor: "rgba(37, 99, 235, 0.12)",
      borderWidth: 3,
      fill: true,
      tension: 0.25,
      pointRadius: maxMonths > 60 ? 0 : 2,
      pointHoverRadius: 5
    }
  ];

  // Show baseline dashed line when user adds extra monthly budget
  if (extraBudget > 0) {
    datasets.push({
      label: "Minimum Payments Only ($0 extra)",
      data: baselineData,
      borderColor: "#94a3b8",
      backgroundColor: "transparent",
      borderWidth: 2,
      borderDash: [6, 6],
      fill: false,
      tension: 0.25,
      pointRadius: 0,
      pointHoverRadius: 4
    });
  }

  burndownChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false
      },
      plugins: {
        legend: {
          position: "top",
          labels: {
            usePointStyle: true,
            padding: 16
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const val = context.parsed.y || 0;
              return `${context.dataset.label}: $${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            maxTicksLimit: 10
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return "$" + value.toLocaleString();
            }
          }
        }
      }
    }
  });
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

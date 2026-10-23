/**
 * MGIS130 Three-Layer Architecture Implementation
 * 1. Data Layer: Form inputs + LocalStorage state persistence
 * 2. Processing Layer: Financial calculations (PMT formula, interest calculation)
 * 3. Presentation Layer: Dynamic HTML rendering & DOM updating
 */

document.addEventListener("DOMContentLoaded", () => {
  // UI Element Selection
  const loanForm = document.getElementById("loan-form");
  const amountInput = document.getElementById("loan-amount");
  const rateInput = document.getElementById("interest-rate");
  const termSelect = document.getElementById("loan-term");
  const resetBtn = document.getElementById("reset-btn");
  const errorMessage = document.getElementById("error-message");

  const monthlyPaymentEl = document.getElementById("monthly-payment");
  const totalInterestEl = document.getElementById("total-interest");
  const totalPaymentEl = document.getElementById("total-payment");
  const principalBar = document.getElementById("principal-bar");
  const interestBar = document.getElementById("interest-bar");

  const toggleTableBtn = document.getElementById("toggle-table-btn");
  const tableWrapper = document.getElementById("table-wrapper");
  const scheduleBody = document.getElementById("schedule-body");

  // ==========================================
  // 1. DATA LAYER (Information Storage & State)
  // ==========================================
  const STORAGE_KEY = "mgis130_loan_data";

  function loadSavedData() {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        amountInput.value = parsed.amount || 25000;
        rateInput.value = parsed.rate || 5.5;
        termSelect.value = parsed.term || 5;
      } catch (e) {
        console.error("Data Layer Error: Failed to parse saved local state", e);
      }
    }
  }

  function saveDataToStorage(amount, rate, term) {
    const dataObj = { amount, rate, term };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataObj));
  }

  // ==========================================
  // 2. PROCESSING LAYER (Business Logic & Math)
  // ==========================================
  
  /**
   * Calculates monthly payment using standard amortization formula:
   * M = P * [ r(1 + r)^n ] / [ (1 + r)^n – 1 ]
   */
  function calculateLoan(principal, annualRate, years) {
    if (principal <= 0 || annualRate <= 0 || years <= 0) {
      throw new Error("Invalid Input: Values must be greater than zero.");
    }

    const monthlyRate = annualRate / 100 / 12;
    const totalPayments = years * 12;

    // Monthly Payment Calculation
    const x = Math.pow(1 + monthlyRate, totalPayments);
    const monthlyPayment = (principal * x * monthlyRate) / (x - 1);

    const totalPayment = monthlyPayment * totalPayments;
    const totalInterest = totalPayment - principal;

    // Generate 12-month amortization schedule summary
    const schedule = [];
    let balance = principal;

    for (let month = 1; month <= Math.min(12, totalPayments); month++) {
      const monthInterest = balance * monthlyRate;
      const monthPrincipal = monthlyPayment - monthInterest;
      balance -= monthPrincipal;

      schedule.push({
        month,
        payment: monthlyPayment,
        principalPaid: monthPrincipal,
        interestPaid: monthInterest,
        remainingBalance: Math.max(0, balance),
      });
    }

    return {
      monthlyPayment,
      totalPayment,
      totalInterest,
      schedule,
      principal,
    };
  }

  // Helper formatting function
  function formatCurrency(val) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(val);
  }

  // ==========================================
  // 3. PRESENTATION LAYER (UI Interaction & DOM)
  // ==========================================

  function renderResults(results) {
    // Hide any previous errors
    errorMessage.classList.add("hidden");

    // Update Text Metrics
    monthlyPaymentEl.textContent = formatCurrency(results.monthlyPayment);
    totalInterestEl.textContent = formatCurrency(results.totalInterest);
    totalPaymentEl.textContent = formatCurrency(results.totalPayment);

    // Update Visual Progress Bar
    const principalPct = (results.principal / results.totalPayment) * 100;
    const interestPct = (results.totalInterest / results.totalPayment) * 100;

    principalBar.style.width = `${principalPct.toFixed(1)}%`;
    principalBar.textContent = `Principal (${principalPct.toFixed(0)}%)`;

    interestBar.style.width = `${interestPct.toFixed(1)}%`;
    interestBar.textContent = `Interest (${interestPct.toFixed(0)}%)`;

    // Render Amortization Schedule Table
    scheduleBody.innerHTML = "";
    results.schedule.forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>Month ${row.month}</td>
        <td>${formatCurrency(row.payment)}</td>
        <td>${formatCurrency(row.principalPaid)}</td>
        <td>${formatCurrency(row.interestPaid)}</td>
        <td>${formatCurrency(row.remainingBalance)}</td>
      `;
      scheduleBody.appendChild(tr);
    });
  }

  function handleCalculate(e) {
    if (e) e.preventDefault();

    const principal = parseFloat(amountInput.value);
    const annualRate = parseFloat(rateInput.value);
    const years = parseInt(termSelect.value);

    try {
      // Execute Processing Layer Logic
      const results = calculateLoan(principal, annualRate, years);
      
      // Execute Presentation Layer Updates
      renderResults(results);

      // Execute Data Layer Persistence
      saveDataToStorage(principal, annualRate, years);
    } catch (err) {
      errorMessage.textContent = err.message;
      errorMessage.classList.remove("hidden");
    }
  }

  // Event Listeners
  loanForm.addEventListener("submit", handleCalculate);

  resetBtn.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    amountInput.value = 25000;
    rateInput.value = 5.5;
    termSelect.value = 5;
    handleCalculate();
  });

  toggleTableBtn.addEventListener("click", () => {
    tableWrapper.classList.toggle("hidden");
    toggleTableBtn.textContent = tableWrapper.classList.contains("hidden")
      ? "Show Schedule"
      : "Hide Schedule";
  });

  // Initial Execution on Load
  loadSavedData();
  handleCalculate();
});
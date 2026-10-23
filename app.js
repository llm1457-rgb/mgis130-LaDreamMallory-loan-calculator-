document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const loanForm = document.getElementById("loan-form");
  const amountInput = document.getElementById("loan-amount");
  const downPaymentInput = document.getElementById("down-payment");
  const rateInput = document.getElementById("interest-rate");
  const termSelect = document.getElementById("loan-term");
  const frequencySelect = document.getElementById("payment-frequency");
  const resetBtn = document.getElementById("reset-btn");
  const errorMessage = document.getElementById("error-message");

  const paymentLabelEl = document.getElementById("payment-frequency-label");
  const periodicPaymentEl = document.getElementById("periodic-payment");
  const netPrincipalEl = document.getElementById("net-principal");
  const totalInterestEl = document.getElementById("total-interest");
  const totalCostEl = document.getElementById("total-cost");
  const principalBar = document.getElementById("principal-bar");
  const interestBar = document.getElementById("interest-bar");

  const toggleTableBtn = document.getElementById("toggle-table-btn");
  const tableWrapper = document.getElementById("table-wrapper");
  const scheduleBody = document.getElementById("schedule-body");

  // 1. DATA LAYER (Storage & Retrieval)
  const STORAGE_KEY = "mgis130_loan_v2_data";

  function loadSavedData() {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        amountInput.value = parsed.amount || 30000;
        downPaymentInput.value = parsed.downPayment ?? 5000;
        rateInput.value = parsed.rate || 5.5;
        termSelect.value = parsed.term || 5;
        frequencySelect.value = parsed.frequency || 12;
      } catch (e) {
        console.error("Data Layer Error: Parsing error", e);
      }
    }
  }

  function saveDataToStorage(amount, downPayment, rate, term, frequency) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ amount, downPayment, rate, term, frequency })
    );
  }

  // 2. PROCESSING LAYER (Business Logic & Mathematics)
  function calculateLoan(price, downPayment, annualRate, years, frequency) {
    const netPrincipal = price - downPayment;

    if (netPrincipal <= 0) {
      throw new Error("Down payment cannot be greater than or equal to the price.");
    }
    if (annualRate <= 0 || years <= 0) {
      throw new Error("Interest rate and term must be greater than zero.");
    }

    // Rate & Periods adjusted by frequency (12 = monthly, 26 = bi-weekly, 52 = weekly)
    const ratePerPeriod = annualRate / 100 / frequency;
    const totalPeriods = years * frequency;

    // PMT Formula: M = P * [ r(1 + r)^n ] / [ (1 + r)^n – 1 ]
    const x = Math.pow(1 + ratePerPeriod, totalPeriods);
    const paymentPerPeriod = (netPrincipal * x * ratePerPeriod) / (x - 1);

    const totalRepayment = paymentPerPeriod * totalPeriods;
    const totalInterest = totalRepayment - netPrincipal;
    const totalCost = totalRepayment + downPayment;

    // Build schedule for the first year (12, 26, or 52 rows)
    const schedule = [];
    let balance = netPrincipal;
    const firstYearPeriods = Math.min(frequency, totalPeriods);

    for (let period = 1; period <= firstYearPeriods; period++) {
      const periodInterest = balance * ratePerPeriod;
      const periodPrincipal = paymentPerPeriod - periodInterest;
      balance -= periodPrincipal;

      schedule.push({
        period,
        payment: paymentPerPeriod,
        principalPaid: periodPrincipal,
        interestPaid: periodInterest,
        remainingBalance: Math.max(0, balance),
      });
    }

    return {
      netPrincipal,
      paymentPerPeriod,
      totalInterest,
      totalCost,
      schedule,
      frequency,
    };
  }

  function formatCurrency(val) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);
  }

  // 3. PRESENTATION LAYER (UI Rendering & DOM)
  function renderResults(results) {
    errorMessage.classList.add("hidden");

    // Dynamic label for payment frequency
    const freqText =
      results.frequency == 52 ? "Weekly" : results.frequency == 26 ? "Bi-Weekly" : "Monthly";
    paymentLabelEl.textContent = `${freqText} Payment`;

    // Render Metrics
    periodicPaymentEl.textContent = formatCurrency(results.paymentPerPeriod);
    netPrincipalEl.textContent = formatCurrency(results.netPrincipal);
    totalInterestEl.textContent = formatCurrency(results.totalInterest);
    totalCostEl.textContent = formatCurrency(results.totalCost);

    // Visual Bar Updates
    const totalFinancedCost = results.netPrincipal + results.totalInterest;
    const principalPct = (results.netPrincipal / totalFinancedCost) * 100;
    const interestPct = (results.totalInterest / totalFinancedCost) * 100;

    principalBar.style.width = `${principalPct.toFixed(1)}%`;
    principalBar.textContent = `Principal (${principalPct.toFixed(0)}%)`;

    interestBar.style.width = `${interestPct.toFixed(1)}%`;
    interestBar.textContent = `Interest (${interestPct.toFixed(0)}%)`;

    // Amortization Table Update
    scheduleBody.innerHTML = "";
    results.schedule.forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>Period ${row.period}</td>
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

    const price = parseFloat(amountInput.value) || 0;
    const downPayment = parseFloat(downPaymentInput.value) || 0;
    const annualRate = parseFloat(rateInput.value) || 0;
    const years = parseInt(termSelect.value) || 1;
    const frequency = parseInt(frequencySelect.value) || 12;

    try {
      const results = calculateLoan(price, downPayment, annualRate, years, frequency);
      renderResults(results);
      saveDataToStorage(price, downPayment, annualRate, years, frequency);
    } catch (err) {
      errorMessage.textContent = err.message;
      errorMessage.classList.remove("hidden");
    }
  }

  // Real-time Event Listeners
  loanForm.addEventListener("submit", handleCalculate);
  amountInput.addEventListener("input", handleCalculate);
  downPaymentInput.addEventListener("input", handleCalculate);
  rateInput.addEventListener("input", handleCalculate);
  termSelect.addEventListener("change", handleCalculate);
  frequencySelect.addEventListener("change", handleCalculate);

  resetBtn.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    amountInput.value = 30000;
    downPaymentInput.value = 5000;
    rateInput.value = 5.5;
    termSelect.value = 5;
    frequencySelect.value = 12;
    handleCalculate();
  });

  toggleTableBtn.addEventListener("click", () => {
    tableWrapper.classList.toggle("hidden");
    toggleTableBtn.textContent = tableWrapper.classList.contains("hidden")
      ? "Show Schedule"
      : "Hide Schedule";
  });

  // Initial Run
  loadSavedData();
  handleCalculate();
});

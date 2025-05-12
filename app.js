document.addEventListener("DOMContentLoaded", () => {
    const formSection = document.getElementById("form-section");
    const resultsSection = document.getElementById("results-section");
    const calculatorForm = document.getElementById("calculator-form");
    const startOverButton = document.getElementById("start-over");
    const printButton = document.getElementById("print-results");

    // --- CONFIGURATION FOR GOOGLE SHEETS ---
    const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwLI2pBlMFN93bqz-Xvb6Cx76BXN23SXfou-4OWBpPXtakp3k2lzShxOaJXyqK6OaRaLQ/exec"; 

    // --- Core Calculation Logic --- 

    function formatCurrency(amount) {
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount)) {
            return "$0.00"; 
        }
        return numAmount.toLocaleString("en-US", { style: "currency", currency: "USD" });
    }

    function calculateInflationProjection(initialFee, inflationRateDecimal, years) {
        let projection = [];
        let annualCost = parseFloat(initialFee) || 0;
        let cumulativeCost = 0;
        let prevYearCost = annualCost * (1 + inflationRateDecimal);

        for (let i = 1; i <= years; i++) {
            if (i === 1) {
                annualCost = prevYearCost;
                cumulativeCost = 0;
            } else {
                annualCost = prevYearCost * (1 + inflationRateDecimal);
                cumulativeCost += prevYearCost;
            }
            projection.push({
                year: i,
                annualCost: annualCost,
                cumulativeCost: cumulativeCost
            });
            prevYearCost = annualCost;
        }
        return projection;
    }

    // calculateTerminationCosts function remains as it might be used for other purposes or future enhancements
    // but its results are no longer directly displayed in the removed option boxes.
    function calculateTerminationCosts(resortIndex, annualFee, inflationRateDecimal) {
        let liquidationCost = 0;
        let transferFees = 1800;
        let processingFee = 449;
        let mra = 0; 
        const currentAnnualFee = parseFloat(annualFee) || 0;

        if (resortIndex === 0) { 
            liquidationCost = 84569.5065; 
            mra = 27464.67;
        } else if (resortIndex === 1) { 
            liquidationCost = 0; 
            mra = 37552.27;
        } 

        const projection = calculateInflationProjection(currentAnnualFee, inflationRateDecimal, 30);
        const totalCostOfOwnership = projection.length > 0 ? projection[projection.length - 1].cumulativeCost : 0;
        const grossLiquidationPrice = liquidationCost + transferFees + processingFee;
        const netTermination = grossLiquidationPrice - mra; 

        return {
            resortIndex: resortIndex,
            annualFee: currentAnnualFee,
            inflationRate: inflationRateDecimal, 
            totalCostOfOwnership: totalCostOfOwnership,
            liquidationCost: liquidationCost,
            transferFees: transferFees,
            processingFee: processingFee,
            grossLiquidationPrice: grossLiquidationPrice,
            mra: mra,
            netTermination: netTermination
        };
    }

    // --- Google Sheets Integration (Hidden Form Submission Method) --- 
    function sendDataToGoogleSheet(data) {
        if (!GOOGLE_APPS_SCRIPT_URL || GOOGLE_APPS_SCRIPT_URL === "YOUR_DEPLOYED_APPS_SCRIPT_URL_HERE") {
            console.log("Google Apps Script URL not configured. Skipping data submission.");
            return;
        }
        console.log("Submitting data to Google Sheets via hidden form...");
        try {
            const iframeName = "hiddenSheetSubmitFrame";
            let iframe = document.getElementById(iframeName);
            if (!iframe) {
                iframe = document.createElement("iframe");
                iframe.id = iframeName;
                iframe.name = iframeName;
                iframe.style.display = "none";
                document.body.appendChild(iframe);
            }
            const form = document.createElement("form");
            form.method = "POST";
            form.action = GOOGLE_APPS_SCRIPT_URL;
            form.target = iframeName;
            form.style.display = "none";
            const addHiddenInput = (name, value) => {
                const input = document.createElement("input");
                input.type = "hidden";
                input.name = name;
                input.value = value || "";
                form.appendChild(input);
            };
            addHiddenInput("owner1Name", data.owner1Name);
            addHiddenInput("owner2Name", data.owner2Name);
            if (data.resorts[0]) {
                addHiddenInput("resort1Name", data.resorts[0].name);
                addHiddenInput("resort1Fee", data.resorts[0].fee);
                addHiddenInput("resort1Inflation", data.resorts[0].inflation !== null ? (data.resorts[0].inflation * 100).toFixed(1) : "");
            }
            if (data.resorts[1]) {
                addHiddenInput("resort2Name", data.resorts[1].name);
                addHiddenInput("resort2Fee", data.resorts[1].fee);
                addHiddenInput("resort2Inflation", data.resorts[1].inflation !== null ? (data.resorts[1].inflation * 100).toFixed(1) : "");
            }
            document.body.appendChild(form);
            form.submit();
            setTimeout(() => {
                document.body.removeChild(form);
                console.log("Hidden form submitted to Google Sheets.");
            }, 1000); 
        } catch (error) {
            console.error("Error creating/submitting hidden form for Google Sheets: ", error);
        }
    }

    // --- Display Logic --- 
    function displayPage1(data) {
        let ownerNames = [data.owner1Name, data.owner2Name].filter(Boolean).join(", ");
        document.getElementById("ownerName").textContent = ownerNames || "N/A";
        let totalInitialFee = (parseFloat(data.resorts[0]?.fee) || 0) + (parseFloat(data.resorts[1]?.fee) || 0);
        document.getElementById("totalInitialFee").textContent = formatCurrency(totalInitialFee);
        let numResortsWithInflation = 0;
        let sumInflationRates = 0;
        if (data.resorts[0]?.inflation !== null && data.resorts[0]?.inflation !== undefined) {
            sumInflationRates += data.resorts[0].inflation;
            numResortsWithInflation++;
        }
        if (data.resorts[1]?.inflation !== null && data.resorts[1]?.inflation !== undefined) {
            sumInflationRates += data.resorts[1].inflation;
            numResortsWithInflation++;
        }
        const averageInflationRateDecimal = numResortsWithInflation > 0 ? sumInflationRates / numResortsWithInflation : 0.092; 
        const averageInflationRatePercent = (averageInflationRateDecimal * 100).toFixed(1);
        document.getElementById("averageInflationRate").textContent = averageInflationRatePercent;
        const projection = calculateInflationProjection(totalInitialFee, averageInflationRateDecimal, 30);
        const tableBody = document.getElementById("projectionTableBody");
        tableBody.innerHTML = ""; 
        projection.forEach(item => {
            const row = tableBody.insertRow();
            row.insertCell().textContent = item.year;
            row.insertCell().textContent = formatCurrency(item.annualCost);
            row.insertCell().textContent = item.year === 1 ? formatCurrency(0) : formatCurrency(item.cumulativeCost);
        });
    }

    function displayResortComparisonPage(data, resortIndex, pageId) {
        const resort = data.resorts[resortIndex];
        if (!resort || !resort.name || !resort.fee || resort.inflation === null || resort.inflation === undefined) {
             const pageElement = document.getElementById(`${pageId}Content`);
             if(pageElement) pageElement.style.display = 'none';
             console.log(`Hiding ${pageId} because data is incomplete.`);
             return; 
        }
        const pageElement = document.getElementById(`${pageId}Content`);
        if(pageElement) pageElement.style.display = 'block';
        const annualFee = parseFloat(resort.fee) || 0;
        const inflationRateDecimal = resort.inflation;
        const inflationRatePercent = (inflationRateDecimal * 100).toFixed(1);
        let ownerNames = [data.owner1Name, data.owner2Name].filter(Boolean).join(", ");
        document.getElementById(`${pageId}OwnerName`).textContent = ownerNames || "N/A";
        document.getElementById(`${pageId}ResortName`).textContent = resort.name || "N/A";
        document.getElementById(`${pageId}ResortFee`).textContent = formatCurrency(annualFee);
        document.getElementById(`${pageId}InflationRate`).textContent = inflationRatePercent;
        
        // Lines for populating removed option boxes are now removed.
    }

    // --- Event Handlers --- 
    calculatorForm.addEventListener('submit', (event) => {
        event.preventDefault(); 
        const formData = new FormData(calculatorForm);
        const getInflationDecimal = (value) => {
            const rate = parseFloat(value);
            return !isNaN(rate) ? rate / 100 : null;
        };
        const data = {
            owner1Name: formData.get('owner1Name'),
            owner2Name: formData.get('owner2Name'),
            resorts: [
                { 
                    name: formData.get('resort1Name'), 
                    fee: formData.get('resort1Fee'),
                    inflation: getInflationDecimal(formData.get('resort1Inflation'))
                },
                {
                    name: formData.get('resort2Name'),
                    fee: formData.get('resort2Fee'),
                    inflation: getInflationDecimal(formData.get('resort2Inflation'))
                }
            ].filter(r => r.name && r.name.trim() !== '')
        };
        if (data.resorts[1]) {
            if (!data.resorts[1].fee || data.resorts[1].inflation === null) {
                data.resorts.pop(); 
            }
        }
        if (!data.resorts[0] || !data.resorts[0].name || !data.resorts[0].fee || data.resorts[0].inflation === null) {
            alert("Please fill in all required fields for Resort 1 (Name, Fee, Inflation Rate).");
            return; 
        }
        console.log("Captured Data:", data);
        displayPage1(data);
        displayResortComparisonPage(data, 0, 'page2');
        displayResortComparisonPage(data, 1, 'page3');
        formSection.style.display = 'none';
        resultsSection.style.display = 'block';
        sendDataToGoogleSheet(data);
    });

    startOverButton.addEventListener('click', () => {
        calculatorForm.reset();
        document.getElementById("ownerName").textContent = '';
        document.getElementById("totalInitialFee").textContent = '';
        document.getElementById("averageInflationRate").textContent = '';
        document.getElementById("projectionTableBody").innerHTML = '';
        resultsSection.style.display = 'none';
        formSection.style.display = 'block';
    });

    printButton.addEventListener('click', () => {
        window.print();
    });

    console.log("Iframe Calculator App Initialized (v6 - Option Boxes Removed)");
});

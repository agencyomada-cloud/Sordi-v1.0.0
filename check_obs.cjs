
const XLSX = require('xlsx');
const file = '/Users/mac/Desktop/OmadaInvoice/ETAT DES SUIVI FACT CLIENTS 2025.xlsx';
const wb = XLSX.readFile(file);
const sheet = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

// Find Observation column index
const headerRow = data.find(row => row && row.some(c => c && c.toString().includes('CLIENTS')));
if (headerRow) {
    const obsIndex = headerRow.findIndex(c => c && c.toString().includes('OBSERVATION'));
    console.log(`Observation index: ${obsIndex}`);
    if (obsIndex !== -1) {
        data.slice(data.indexOf(headerRow) + 1).forEach(row => {
            if (row[obsIndex]) console.log(`Client: ${row[1]}, Obs: ${row[obsIndex]}`);
        });
    }
}

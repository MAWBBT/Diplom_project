const ExcelJS = require('exceljs');
const { formatPeriodMeta } = require('./reportLabels');

function styleHeaderRow(ws, rowNumber) {
  const row = ws.getRow(rowNumber);
  row.font = { bold: true };
  row.alignment = { vertical: 'middle', wrapText: true };
  row.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' }
    };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF94A3B8' } }
    };
  });
}

function autoFitColumns(ws, fromRow = 1) {
  ws.columns.forEach((col, i) => {
    let max = 10;
    ws.eachRow((row, rowNumber) => {
      if (rowNumber < fromRow) return;
      const cell = row.getCell(i + 1);
      const len = cell.value != null ? String(cell.value).length : 0;
      if (len > max) max = len;
    });
    col.width = Math.min(52, Math.max(12, max + 2));
  });
}

/**
 * @param {import('exceljs').Workbook} wb
 * @param {string} title
 * @param {{ dateFrom?: string|null, dateTo?: string|null, academicYear?: string|null }} filterParams
 * @param {{ header: string, key: string }[]} columns
 * @param {Record<string, unknown>[]} dataRows
 */
function addReportSheet(wb, title, filterParams, columns, dataRows) {
  const ws = wb.addWorksheet(title, {
    views: [{ state: 'frozen', ySplit: 4 }]
  });

  ws.addRow([`Отчёт: ${title}`]);
  ws.addRow([formatPeriodMeta(filterParams || {})]);
  ws.addRow([`Сформировано: ${new Date().toLocaleString('ru-RU')}`]);
  ws.addRow([]);

  const headerRowNum = 5;
  ws.addRow(columns.map((c) => c.header));
  styleHeaderRow(ws, headerRowNum);

  for (const data of dataRows) {
    const values = columns.map((c) => data[c.key] ?? '');
    ws.addRow(values);
  }

  autoFitColumns(ws, headerRowNum);
  return ws;
}

function createWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Digital Campus';
  wb.created = new Date();
  return wb;
}

module.exports = { addReportSheet, createWorkbook, styleHeaderRow };

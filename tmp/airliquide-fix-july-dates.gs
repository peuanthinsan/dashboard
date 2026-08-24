/**
 * AirliquideTH sheet — fix day/month-swapped Alert Date Time values.
 *
 * Context: 29 rows for vehicle 71-7689 were stored as e.g. 2026-11-07
 * when they meant 11/07/2026 (11 Jul). Pattern: day === 7, month !== 7
 * → swap to month=7, day=oldMonth.
 *
 * How to run:
 * 1. Open https://docs.google.com/spreadsheets/d/1lpV3WHzQxWDi9CiF5v38rKULc6THdImKsxgjOSTKQHw
 * 2. Extensions → Apps Script
 * 3. Paste this file, save
 * 4. Run fixSwappedJulyDates
 * 5. Approve permissions when prompted
 * 6. Check View → Logs for the before/after summary
 *
 * Safe: only rewrites datetime cells that match the exact swap pattern
 * (stored day is 7, stored month is not 7, year is 2026). Leaves Track Time alone
 * when blank; does not touch correctly-dated July rows (day > 12).
 */
function fixSwappedJulyDates() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheets()[0]; // gid 0
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    Logger.log('No data rows');
    return;
  }

  const headers = data[0].map(function (h) {
    return String(h || '').trim().toLowerCase();
  });
  const dateCol = headers.indexOf('alert date time');
  if (dateCol < 0) {
    throw new Error('Column "Alert Date Time" not found. Headers: ' + headers.join(', '));
  }

  let fixed = 0;
  const changes = [];

  for (let r = 1; r < data.length; r++) {
    const cell = data[r][dateCol];
    if (!(cell instanceof Date) || isNaN(cell.getTime())) continue;

    // Sheets stores local calendar components; read them directly.
    const year = cell.getFullYear();
    const month = cell.getMonth() + 1; // 1-12
    const day = cell.getDate();
    const hours = cell.getHours();
    const minutes = cell.getMinutes();
    const seconds = cell.getSeconds();

    // Swap pattern: meant DD/07/YYYY but written as YYYY-DD-07
    if (year !== 2026 || day !== 7 || month === 7) continue;

    const newDate = new Date(year, 7 - 1, month, hours, minutes, seconds);
    sheet.getRange(r + 1, dateCol + 1).setValue(newDate);
    fixed++;
    changes.push({
      row: r + 1,
      old: Utilities.formatDate(cell, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      neu: Utilities.formatDate(newDate, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
    });
  }

  Logger.log('Fixed ' + fixed + ' rows');
  changes.forEach(function (c) {
    Logger.log('R' + c.row + ': ' + c.old + ' → ' + c.neu);
  });
}

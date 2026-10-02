// Paste into Extensions > Apps Script for the source spreadsheet.
const SPREADSHEET_ID = '1aTyJN0KQRLuGt96aPSGGGV8I8-KVqQmhut07MVEvook';
const DEFAULT_FIELDS = ['Page','Meta Title','Meta Description','Meta keywords'];
const DEFAULT_PAGES = ['Main Page','Overview','Programs & Fees','Admission process','Placement & Career Support','Student Support','FAQs'];

function doPost(e) {
  let lock;
  try {
    const input = JSON.parse(e.postData.contents);
    const key = PropertiesService.getScriptProperties().getProperty('EDITOR_KEY');
    if (!key || key.length < 32 || input.key !== key) throw new Error('Invalid editor key.');
    if (!['list','read','save','addUniversity','addPage','addField'].includes(input.action)) throw new Error('Unknown action.');
    lock = LockService.getScriptLock();
    lock.waitLock(20000);
    const book = SpreadsheetApp.openById(SPREADSHEET_ID);
    let result;
    if (input.action === 'list') result = { universities: book.getSheets().map(s => s.getName()) };
    else if (input.action === 'addUniversity') {
      const name = nameText(input.name, 100);
      if (/[\[\]*?:\/\\]/.test(name)) throw new Error('University names cannot contain [ ] * ? : / or backslash.');
      if (book.getSheets().some(s => s.getName().toLowerCase() === name.toLowerCase())) throw new Error('That university already exists.');
      const sheet = book.insertSheet(name);
      DEFAULT_FIELDS.forEach((value,index) => putText(sheet.getRange(1,index+1),value));
      DEFAULT_PAGES.forEach((value,index) => putText(sheet.getRange(index+2,1),value));
      sheet.setFrozenRows(1);
      result = snapshot(sheet);
    } else {
      const sheet = book.getSheetByName(input.university);
      if (!sheet) throw new Error('University not found. Refresh the university list.');
      let before = snapshot(sheet);
      if (input.action !== 'read' && input.version !== before.version) throw new Error('The sheet changed since you loaded it. Refresh data before saving; your draft has been kept.');
      if (input.action === 'save') {
        const row = before.rows.find(r => r.row === input.row && r.page === input.page);
        if (!row) throw new Error('Page row no longer matches. Refresh data.');
        if (!input.values || typeof input.values !== 'object' || Array.isArray(input.values)) throw new Error('Invalid field values.');
        const changes = Object.entries(input.values).map(([column,value]) => {
          const field = before.fields.find(f => String(f.column) === column);
          if (!field || typeof value !== 'string' || value.length > 50000) throw new Error('Invalid field or value.');
          if (sheet.getRange(row.row,field.column).getFormula()) throw new Error('A selected field contains a formula. Edit it directly in Google Sheets.');
          return [field.column,value];
        });
        changes.forEach(([column,value]) => putText(sheet.getRange(row.row,column),value));
      } else if (input.action === 'addPage') {
        const name = nameText(input.name,200);
        if (before.rows.some(r => r.page.toLowerCase() === name.toLowerCase())) throw new Error('That page already exists.');
        const row = Math.max(2,sheet.getLastRow()+1);
        if(row > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(),row-sheet.getMaxRows());
        putText(sheet.getRange(row,1),name);
      } else if (input.action === 'addField') {
        const name = nameText(input.name,200);
        const headers=sheet.getRange(1,1,1,Math.max(1,sheet.getLastColumn())).getDisplayValues()[0];
        if (headers.some(h => h.trim().toLowerCase() === name.toLowerCase())) throw new Error('That field already exists.');
        const column=Math.max(2,sheet.getLastColumn()+1);
        if(column > sheet.getMaxColumns()) sheet.insertColumnsAfter(sheet.getMaxColumns(),column-sheet.getMaxColumns());
        putText(sheet.getRange(1,column),name);
      }
      result = snapshot(sheet);
    }
    SpreadsheetApp.flush();
    return json({ok:true,spreadsheetId:SPREADSHEET_ID,...result});
  } catch (error) { return json({ok:false,error:error.message}); }
  finally { if(lock && lock.hasLock()) lock.releaseLock(); }
}
function nameText(value,max) {
  if(typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new Error('Enter a valid name (maximum '+max+' characters).');
  return value.trim();
}
function putText(range,value) {
  if(value==='') range.clearContent();
  else range.setRichTextValue(SpreadsheetApp.newRichTextValue().setText(value).build());
}
function snapshot(sheet) {
  SpreadsheetApp.flush();
  const range=sheet.getDataRange(),grid=range.getDisplayValues(),formulas=range.getFormulas();
  const fields=[];
  (grid[0]||[]).forEach((label,index)=>{if(index>0 && label.trim()) fields.push({column:index+1,label:label.trim()});});
  const rows=[];
  grid.slice(1).forEach((cells,index)=>{if(!cells[0] || !cells[0].trim())return;const values={};fields.forEach(f=>values[f.column]=cells[f.column-1]||'');rows.push({row:index+2,page:cells[0].trim(),values});});
  const version=Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify([grid,formulas])));
  return {university:sheet.getName(),fields,rows,version};
}
function json(value) {return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}

const SPREADSHEET_ID = "1kLoG0APbKUdr4eOaomWgSAPOIq8soQpMv597v4zbxdU";
const SHEET_NAME = "Sheet1";

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error("Feedback sheet not found.");

    const clean = (value, max) => String(value || "").trim().slice(0, max);

    sheet.appendRow([
      new Date(),
      clean(body.app, 200),
      clean(body.type, 50),
      clean(body.rating, 10),
      clean(body.message, 3000),
      clean(body.contact, 200),
      clean(body.storeVersion, 50),
      clean(body.source, 500)
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(error) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

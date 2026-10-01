# Oqerun Store Feedback

Oqerun Store includes a feedback form with a free-form Custom Message field.

## Google Sheets

Feedback is stored in the private spreadsheet:

- Oqerun Store Feedback

The spreadsheet columns are:

1. Timestamp
2. App
3. Feedback Type
4. Rating
5. Custom Message
6. Contact
7. Store Version
8. Source

## Secure submission bridge

The file scripts/feedback-web-app.gs is a Google Apps Script web-app bridge. It writes POSTed feedback into the spreadsheet without placing Google credentials in the Store frontend.

### One-time setup

1. Open Google Apps Script.
2. Create a new project.
3. Copy scripts/feedback-web-app.gs into the project.
4. Deploy it as a Web app.
5. Set Execute as the spreadsheet owner.
6. Set access to allow the Store's public users to submit.
7. Copy the deployed /exec URL.
8. Put that URL into feedbackEndpoint in src/core/Store.ts.
9. Build and deploy Oqerun Store.

Do not put Google OAuth credentials, service-account keys, or the spreadsheet owner's password into the Store repository.

The feedback form accepts an optional contact value. Users should not submit passwords, payment details, or other sensitive information.

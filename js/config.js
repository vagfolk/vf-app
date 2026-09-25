// VF-APP Configuration
// -------------------------------------------------------
// GOOGLE OAUTH
const CLIENT_ID = '650474529830-ma1k89q5mltcg9t3gtr8qmr0ij8km6h2.apps.googleusercontent.com';

// GOOGLE DRIVE – Root folder ID
// Replace this with the actual ID of your VF-APP folder on Google Drive.
// To find it: open the VF-APP folder in Drive, copy the ID from the URL:
// https://drive.google.com/drive/folders/FOLDER_ID_IS_HERE
const DRIVE_ROOT_ID = '17RTTR1YH3l7XVL9kThmWCcvRDB3mxjax';

// GOOGLE CALENDAR IDs
const CALENDAR_ALL_ID   = 'f3c9066ffd95a5cd561f5e99a97897271fa624ffc6a6f00afc1a7ebee42a6129@group.calendar.google.com';
const CALENDAR_BOARD_ID = '3fee693fbd4e02810122287900de1ce92ef977c74785b0ecc436a5a50160e55b@group.calendar.google.com';

// SHEETS – VF-EKO Spreadsheet ID
// To find: open VF-EKO in Google Sheets, copy the ID from the URL:
// https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_IS_HERE/edit
const SHEETS_VFEKO_ID = '1cXFFjChwMKhT8gNIamFjcsb8MAQPEgElXXWKWhukkmM';

// MEMBERS SHEET NAME (the tab in VF-EKO)
const SHEET_MEMBERS_TAB = 'Medlemmar';

// ANSLAGSTAVLA – log file name in Drive (anslagstavla/ folder)
const ANSLAGSTAVLA_FILE = 'anslagstavla.txt';
const ANSLAGSTAVLA_POLL_INTERVAL = 8000; // milliseconds

// API SCOPES
const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'openid',
  'email',
  'profile'
].join(' ');

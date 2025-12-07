# Accounts Folder

This folder contains appstate files for multi-account login support.

## How to Add Accounts

1. Create a JSON file with any name (e.g., `account1.json`, `main.json`, `bot1.json`)
2. The file should contain a valid appstate cookie array

## Appstate Format

Each appstate file should contain a JSON array of cookies:

```json
[
    {
        "key": "c_user",
        "value": "100000000000000",
        "domain": "facebook.com",
        "path": "/",
        "hostOnly": false,
        "creation": "2024-01-01T00:00:00.000Z",
        "lastAccessed": "2024-01-01T00:00:00.000Z"
    },
    {
        "key": "xs",
        "value": "...",
        "domain": "facebook.com",
        "path": "/",
        "hostOnly": false,
        "creation": "2024-01-01T00:00:00.000Z",
        "lastAccessed": "2024-01-01T00:00:00.000Z"
    }
    // ... more cookies
]
```

## Example Structure

```
accounts/
├── main.json           # Main bot account
├── backup.json         # Backup account
├── helper1.json        # Helper bot 1
├── helper2.json        # Helper bot 2
└── README.md           # This file
```

## Notes

- All `.json` files in this folder will be loaded automatically
- Each account will have its own API instance
- Failed logins will be logged but won't stop other accounts from loading
- The `accountManager.js` handles all multi-account logic

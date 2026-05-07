# AGS-ERP User Guide

## 🗂️ Database Location

After installing the desktop app, your `erp.db` database file is saved in:

**Windows Location:**
```
C:\Users\[Your Username]\AppData\Roaming\AGS‑ERP\erp.db
```

**For your system specifically:**
```
C:\Users\Vansh Agrawal\AppData\Roaming\AGS‑ERP\erp.db
```

### How to Access Your Database:
1. **Via File Explorer:** Press `Win + R`, type `%APPDATA%\AGS‑ERP` and press Enter
2. **Via Command Line:** Navigate to `%APPDATA%\AGS‑ERP\`
3. **Direct Path:** Copy the path above and paste in File Explorer address bar

You can open this `.db` file with:
- SQLite Browser (DB Browser for SQLite)
- SQLite command line tools
- Any SQLite-compatible database viewer

## 🔄 Future Updates & Data Safety

### Automatic Updates
Your app is now configured with **automatic update checking**:
- App checks for updates on startup
- Downloads updates in background
- Prompts you when ready to install
- **Your data is completely safe** during updates

### Data Safety Guarantee
✅ **Your database (`erp.db`) is stored separately from the app**
✅ **Updates only replace app files, never your data**
✅ **Database location remains the same across all updates**
✅ **All your products, customers, invoices, and accounts are preserved**

### Manual Backup (Recommended)
For extra safety, periodically copy your database:
```
From: C:\Users\Vansh Agrawal\AppData\Roaming\ags-erp
To: Your backup location (e.g., OneDrive, external drive)
```

## 🚀 Development & Updates Workflow

### For Adding New Features:
1. **Develop** new features in your codebase
2. **Test** thoroughly in development mode (`npm start`)
3. **Update version** in `package.json`
4. **Build** new version (`npm run build`)
5. **Publish** to GitHub releases (for auto-updates)

### Version Management:
```json
// In package.json
"version": "1.0.0"  // Increment for each release
```

### Publishing Updates:
1. Create GitHub release with new version tag
2. Upload the built installer to the release
3. Users will be automatically notified of the update

## 📁 File Structure Overview

```
AGS-ERP/
├── User Data (Persistent across updates)
│   └── C:\Users\[Username]\AppData\Roaming\AGS‑ERP\
│       └── erp.db (Your database - NEVER deleted)
│
└── App Installation (Updated with new versions)
    └── C:\Users\[Username]\AppData\Local\Programs\AGS‑ERP\
        ├── AGS-ERP.exe
        ├── resources\
        └── Other app files
```

## 🛠️ Troubleshooting

### Database Issues:
- **Can't find database:** Check the AppData path above
- **Database locked:** Close all instances of the app
- **Corrupted database:** Restore from your backup

### Update Issues:
- **Update fails:** Check internet connection
- **Manual update:** Download latest installer from GitHub releases
- **Rollback:** Reinstall previous version (data remains safe)

### Icon Issues:
- **Icon not showing:** Restart Windows to refresh icon cache
- **Wrong icon:** Rebuild app with `npm run build`

## 📞 Support

For issues or questions:
1. Check this guide first
2. Look for error messages in the app
3. Check GitHub issues for similar problems
4. Create new GitHub issue if needed

---

**Remember:** Your data is always safe in the AppData folder, regardless of app updates or reinstalls!

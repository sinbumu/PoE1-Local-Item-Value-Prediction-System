# Desktop Vendor Runtime

This directory is reserved for local packaging-only runtime files.

For Windows installer builds, create the embedded Python runtime with:

```powershell
powershell -ExecutionPolicy Bypass -File desktop\scripts\prepare-embedded-python.ps1
```

The generated `desktop/vendor/python-win/` directory is intentionally ignored by Git because it contains Python binaries and installed ML packages.

; Custom NSIS include for the Lumixa installer.
;
; The app .exe icon is not stamped (rcedit/winCodeSign can't run in every build
; environment), so we point the Desktop and Start-Menu shortcuts explicitly at
; the Lumixa icon that ships inside the installed app at
; $INSTDIR\resources\icon.ico (bundled via electron-builder `extraResources`).
;
; `customInstall` runs at the end of electron-builder's install section — after
; its own shortcut creation — so re-creating the shortcuts here overwrites them
; with the correct icon. The paths are all install-relative ($INSTDIR / $DESKTOP
; / $SMPROGRAMS); no development-only absolute path is referenced.

!macro customInstall
  CreateShortCut "$DESKTOP\${PRODUCT_FILENAME}.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\resources\icon.ico" 0
  CreateShortCut "$SMPROGRAMS\${PRODUCT_FILENAME}.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\resources\icon.ico" 0
!macroend

(vl-load-com)
(princ "\n=== Starting extract-layers.lsp ===")

(princ (strcat "\n[LISP] DWG Path: " (getvar "DWGPREFIX")))
(princ (strcat "\n[LISP] ACAD Support Path: " (getenv "ACAD")))

(setq output (open "layers.json" "w"))
(princ "\nFile handle: ")
(princ output)

(if output
  (progn
    (princ "\nWriting to file...")
    (princ "[\"TEST-1\",\"TEST-2\"]" output)
    (close output)
    (princ "\nSuccess: layers.json created")
  )
  (princ "\nError: Could not create layers.json")
)

(princ "\nQuitting AutoCAD...")
(command "_.QUIT" "N")
(princ "\n")
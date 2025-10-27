(vl-load-com)
(setq output (open "layers.json" "w"))
(if output
  (progn
    (princ "[\"TEST-1\",\"TEST-2\"]" output)
    (close output)
    (princ "\nSuccess: layers.json created")
  )
  (princ "\nError: Could not create layers.json")
)
(command "_.QUIT" "N")
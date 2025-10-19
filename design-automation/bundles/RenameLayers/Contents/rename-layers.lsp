; Rename layers based on mapping.csv
(defun c:RenameLayers ( / doc layers input line mappings oldName newName layer)
  (setq doc (vla-get-activedocument (vlax-get-acad-object)))
  (setq layers (vla-get-layers doc))
  
  ; Read mapping file (simple format: "oldName,newName" per line)
  (setq input (open "mapping.csv" "r"))
  (setq mappings '())
  
  (while (setq line (read-line input))
    (setq parts (LM:str->lst line ","))
    (if (= (length parts) 2)
      (setq mappings (cons parts mappings))
    )
  )
  (close input)
  
  ; Apply renames
  (foreach mapping mappings
    (setq oldName (car mapping))
    (setq newName (cadr mapping))
    
    ; Find and rename layer
    (setq layer (vl-catch-all-apply 'vla-item (list layers oldName)))
    (if (not (vl-catch-all-error-p layer))
      (progn
        (vla-put-name layer newName)
        (princ (strcat "\nRenamed: " oldName " -> " newName))
      )
      (princ (strcat "\nLayer not found: " oldName))
    )
  )
  
  (command "QSAVE")
  (princ (strcat "\nRenamed " (itoa (length mappings)) " layers"))
  (princ)
)

; Helper: Split string by delimiter
(defun LM:str->lst ( str del / pos )
  (if (setq pos (vl-string-search del str))
    (cons (substr str 1 pos) (LM:str->lst (substr str (+ pos 1 (strlen del))) del))
    (list str)
  )
)

; Auto-execute
(c:RenameLayers)

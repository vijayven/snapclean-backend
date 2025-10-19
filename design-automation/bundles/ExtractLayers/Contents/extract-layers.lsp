; Extract all layer names from DWG and save as JSON
(defun c:ExtractLayers ( / doc layers output layerList first)
  (setq doc (vla-get-activedocument (vlax-get-acad-object)))
  (setq layers (vla-get-layers doc))
  (setq output (open "layers.json" "w"))
  (setq layerList '())
  
  ; Collect all layer names
  (vlax-for layer layers
    (setq layerName (vla-get-name layer))
    (setq layerList (cons layerName layerList))
  )
  
  ; Write JSON array
  (princ "[" output)
  (setq first T)
  (foreach layerName (reverse layerList)
    (if (not first) (princ "," output))
    (princ (strcat "\"" layerName "\"") output)
    (setq first nil)
  )
  (princ "]" output)
  (close output)
  
  (command "QSAVE")
  (princ (strcat "\nExtracted " (itoa (length layerList)) " layers"))
  (princ)
)

; Auto-execute
(c:ExtractLayers)

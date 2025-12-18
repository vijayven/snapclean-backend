(defun c:extract-layers-to-json (/ file lay lst)
  (vl-load-com)
  (setq lst '())
  
  ;; 1. Iterate through all layers in the DWG
  (vlax-for lay (vla-get-layers (vla-get-activedocument (vlax-get-acad-object)))
    (setq lst (cons (vla-get-name lay) lst))
  )
  
  ;; 2. Open the file matching "localName" for writing
  (setq file (open "layers.json" "w"))
  
  ;; 3. Write JSON format manually
  (write-line "[" file)
  (setq count 0)
  (foreach name lst
    (if (> count 0) (write-line "," file))
    (write-line (strcat "\"" name "\"") file)
    (setq count (1+ count))
  )
  (write-line "]" file)
  
  ;; 4. Close file so DA can read it
  (close file)
  (princ "\nLayers extracted to layers.json")
  (princ)
)

(defun extract-layers-to-json () (c:extract-layers-to-json))
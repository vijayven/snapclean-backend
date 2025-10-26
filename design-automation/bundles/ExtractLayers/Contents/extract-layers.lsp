; Simplest possible test - just write a file
(setq output (open "layers.json" "w"))
(princ "[\"TEST-LAYER-1\",\"TEST-LAYER-2\"]" output)
(close output)
(princ "\nTest script completed\n")
(princ)
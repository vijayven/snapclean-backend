using Autodesk.AutoCAD.DatabaseServices;
using Autodesk.AutoCAD.Runtime;
using System.Text.Json; 
using System.Collections.Generic;
using System.IO;

[assembly: CommandClass(typeof(ExtractLayers.Commands))]

namespace ExtractLayers
{
    public class Commands
    {
        [CommandMethod("ExtractLayers")]
        public void ExtractLayersCommand()
        {
            // In Design Automation, use WorkingDatabase instead of Document
            Database db = HostApplicationServices.WorkingDatabase;
            
            List<string> layers = new List<string>();
            
            using (Transaction tr = db.TransactionManager.StartTransaction())
            {
                LayerTable lt = (LayerTable)tr.GetObject(db.LayerTableId, OpenMode.ForRead);
                
                foreach (ObjectId layerId in lt)
                {
                    LayerTableRecord ltr = (LayerTableRecord)tr.GetObject(layerId, OpenMode.ForRead);
                    layers.Add(ltr.Name);
                }
                
                tr.Commit();
            }
            
            // Write to layers.json in current directory
            string json = JsonSerializer.Serialize(layers, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText("layers.json", json);
        }
    }
}
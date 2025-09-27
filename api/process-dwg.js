export default async function handler(req, res) {
  try {
    const { file } = req.body;
    console.log("Received base64 DWG input");

    // Send the file right back
    const buffer = Buffer.from(file, 'base64');
    res.setHeader('Content-Disposition', 'attachment; filename="cleaned_output.dwg"');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.status(200).send(buffer);
  } catch (err) {
    console.error("Error handling DWG:", err);
    res.status(500).send("Server error");
  }
}
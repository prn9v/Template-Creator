const { MongoClient } = require('mongodb');

async function addPdfTemplate() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/template-creator');
  
  try {
    await client.connect();
    const db = client.db();
    const templates = db.collection('templates');
    
    // Create a test PDF template
    const pdfTemplate = {
      name: "Test PDF Certificate",
      description: "A multi-page PDF certificate template for testing",
      category: "certificates",
      backgroundImage: "/uploads/template-1755326108530.pdf",
      width: 800,
      height: 600,
      placeholders: [
        {
          id: "name",
          type: "text",
          x: 200,
          y: 250,
          width: 400,
          height: 50,
          fontSize: 24,
          fontFamily: "Arial",
          color: "#000000",
          placeholder: "Recipient Name",
          required: true,
          pageIndex: 0
        },
        {
          id: "date",
          type: "text",
          x: 200,
          y: 350,
          width: 200,
          height: 30,
          fontSize: 16,
          fontFamily: "Arial",
          color: "#666666",
          placeholder: "Date",
          required: true,
          pageIndex: 0
        },
        {
          id: "signature",
          type: "text",
          x: 200,
          y: 450,
          width: 300,
          height: 40,
          fontSize: 18,
          fontFamily: "Arial",
          color: "#000000",
          placeholder: "Signature",
          required: false,
          pageIndex: 1
        }
      ],
      isPdf: true,
      totalPages: 2,
      pdfFilePath: "/uploads/template-1755326108530.pdf",
      isActive: true,
      createdBy: "admin",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await templates.insertOne(pdfTemplate);
    console.log('PDF template added successfully:', result.insertedId);
    
  } catch (error) {
    console.error('Error adding PDF template:', error);
  } finally {
    await client.close();
  }
}

addPdfTemplate();

require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { rgb } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const iconv = require('iconv-lite');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { fromBuffer } = require('pdf2pic');
const os = require('os');
const { OpenAIClient, AzureKeyCredential } = require("@azure/openai");
const PDFKit = require('pdfkit');
const { getPrompts } = require('./resumePrompt');
const puppeteer = require('puppeteer');

// Azure OpenAI Configuration
const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
const azureApiKey = process.env.AZURE_OPENAI_KEY;
const deploymentId = process.env.AZURE_OPENAI_DEPLOYMENT_ID;

const client = new OpenAIClient(endpoint, new AzureKeyCredential(azureApiKey));

const app = express();
app.use(express.json()); // Add this line to parse JSON request bodies

// Set up Multer configuration
const upload = multer({
  dest: 'uploads/',
  limits: {
    fieldSize: 50 * 1024 * 1024, // Increase field size limit to 50MB
  }
});

// Ensure the 'generated' directory exists
const generatedDir = path.join(__dirname, '../../generated');
if (!fs.existsSync(generatedDir)) {
    fs.mkdirSync(generatedDir, { recursive: true });
}

app.use(express.static(path.join(__dirname, '../client')));

function wrapSVGInHTML(svgString) {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {
                    margin: 0;
                    padding: 0;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                }
                svg {
                    width: 210mm;
                    height: 297mm;
                }
            </style>
        </head>
        <body>
            ${svgString}
        </body>
        </html>
    `;
}

async function convertSVGToPDF(svgString) {
    const htmlContent = wrapSVGInHTML(svgString);
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4' });
    await browser.close();
    return pdfBuffer;
}

async function polishResume(resumeContent, jobDescription) {
    console.log('Starting resume polishing process');
    try {
        const messages = getPrompts(resumeContent, jobDescription);

        console.log('Sending request to Azure OpenAI');
        const result = await client.getChatCompletions(deploymentId, messages, {
            temperature: 0.7,
            max_tokens: 4000,  // Increase token limit
            top_p: 0.95,
            frequency_penalty: 0,
            presence_penalty: 0,
        });
        console.log('Received response from Azure OpenAI');

        let polishedContent = result.choices[0].message.content;
        console.log('Polished content:', polishedContent);

        // Ensure polishedContent is a string
        if (typeof polishedContent !== 'string') {
            polishedContent = String(polishedContent);
        }

        return polishedContent;
    } catch (error) {
        console.error('Error during resume polishing process:', error);
        throw error;
    }
}

// Use in Express route
app.post('/polish-resume', async (req, res) => {
    try {
        const { resumeContent, jobDescription } = req.body;
        const polishedContent = await polishResume(resumeContent, jobDescription);
        
        const pdfBuffer = await convertSVGToPDF(polishedContent);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=polished_resume.pdf');
        res.send(pdfBuffer);
    } catch (error) {
        res.status(500).json({ error: 'Resume processing failed' });
    }
});

app.post('/generate-resume', upload.single('resumeFile'), async (req, res) => {
    try {
        console.log('Starting resume generation request processing');
        let resumeContent;
        if (req.file) {
            console.log(`Reading uploaded file: ${req.file.originalname}`);
            const fileExtension = path.extname(req.file.originalname).toLowerCase();
            const fileContent = fs.readFileSync(req.file.path);

            if (fileExtension === '.pdf') {
                const pdfData = await pdfParse(fileContent);
                resumeContent = pdfData.text;
            } else if (fileExtension === '.docx' || fileExtension === '.doc') {
                const result = await mammoth.convertToHtml({ buffer: fileContent });
                resumeContent = result.value;
            } else {
                resumeContent = iconv.decode(fileContent, 'utf-8');
            }
        } else if (req.body.resumeContent) {
            console.log('Using content from text area');
            resumeContent = req.body.resumeContent;
        } else {
            console.log('No resume content provided');
            return res.status(400).json({ error: 'No resume content provided' });
        }

        // Call resume polishing function
        console.log('Starting resume polishing');
        let polishedResumeContent;
        try {
            polishedResumeContent = await polishResume(resumeContent, req.body.jobDescription);
            console.log('Resume polishing completed');
        } catch (error) {
            console.error('Resume polishing failed:', error);
            return res.status(500).json({ error: 'Resume polishing failed: ' + error.message });
        }

        // Ensure that SVG content is passed to generatePDF
        const svgContent = extractSVGContent(polishedResumeContent);
        console.log('Extracted SVG content:', svgContent);

        console.log('Starting PDF generation');
        const fileName = `resume_${Date.now()}.pdf`;
        const filePath = path.join(generatedDir, fileName);
        const pdfBuffer = await convertSVGToPDF(svgContent);
        fs.writeFileSync(filePath, pdfBuffer);

        console.log('PDF file generation completed');
        res.json({ downloadUrl: `/download/${fileName}` });
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).json({ error: 'Internal server error: ' + error.message });
    }
});

app.get('/download/:fileName', (req, res) => {
    const filePath = path.join(generatedDir, req.params.fileName);
    res.download(filePath, (err) => {
        if (err) {
            console.error('Error downloading file:', err);
            res.status(500).send('Error downloading file');
        }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

function extractSVGContent(content) {
    const svgStart = content.indexOf('<svg');
    const svgEnd = content.lastIndexOf('</svg>') + 6;
    if (svgStart !== -1 && svgEnd !== -1) {
        const svgContent = content.slice(svgStart, svgEnd);
        // Remove unnecessary parts
        return svgContent.replace(/```svg|```/g, '').trim();
    }
    return null;
}




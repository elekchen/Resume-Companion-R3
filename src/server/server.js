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

// Azure OpenAI 配置
const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
const azureApiKey = process.env.AZURE_OPENAI_KEY;
const deploymentId = process.env.AZURE_OPENAI_DEPLOYMENT_ID;

const client = new OpenAIClient(endpoint, new AzureKeyCredential(azureApiKey));

const app = express();
app.use(express.json()); // Add this line to parse JSON request bodies

// 设置 Multer 配置
const upload = multer({
  dest: 'uploads/',
  limits: {
    fieldSize: 50 * 1024 * 1024, // 增加字段大小限制到 50MB
  }
});

// 确保 generated 文件夹存在
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
    console.log('开始简历润色过程');
    try {
        const messages = getPrompts(resumeContent, jobDescription);

        console.log('发送请求到 Azure OpenAI');
        const result = await client.getChatCompletions(deploymentId, messages, {
            temperature: 0.7,
            max_tokens: 4000,  // 增加 token 限制
            top_p: 0.95,
            frequency_penalty: 0,
            presence_penalty: 0,
        });
        console.log('收到 Azure OpenAI 的响应');

        let polishedContent = result.choices[0].message.content;
        console.log('润色后的内容:', polishedContent);

        // 确保 polishedContent 是字符串类型
        if (typeof polishedContent !== 'string') {
            polishedContent = String(polishedContent);
        }

        return polishedContent;
    } catch (error) {
        console.error('简历润色过程中出错:', error);
        throw error;
    }
}

// 在 Express 路由中使用
app.post('/polish-resume', async (req, res) => {
    try {
        const { resumeContent, jobDescription } = req.body;
        const polishedContent = await polishResume(resumeContent, jobDescription);
        
        const pdfBuffer = await convertSVGToPDF(polishedContent);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=polished_resume.pdf');
        res.send(pdfBuffer);
    } catch (error) {
        res.status(500).json({ error: '简历处理失败' });
    }
});

app.post('/generate-resume', upload.single('resumeFile'), async (req, res) => {
    try {
        console.log('开始处理简历生成请求');
        let resumeContent;
        if (req.file) {
            console.log(`读取上传的文件: ${req.file.originalname}`);
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
            console.log('使用文本区域的内容');
            resumeContent = req.body.resumeContent;
        } else {
            console.log('未提供简历内容');
            return res.status(400).json({ error: 'No resume content provided' });
        }

        // 调用简历润色功能
        console.log('开始简历润色');
        let polishedResumeContent;
        try {
            polishedResumeContent = await polishResume(resumeContent, req.body.jobDescription);
            console.log('简历润色完成');
        } catch (error) {
            console.error('简历润色失败:', error);
            return res.status(500).json({ error: '简历润色失败: ' + error.message });
        }

        // 确保传递给 generatePDF 的是 SVG 内容
        const svgContent = extractSVGContent(polishedResumeContent);
        console.log('提取的 SVG 内容:', svgContent);

        console.log('开始生成 PDF');
        const fileName = `resume_${Date.now()}.pdf`;
        const filePath = path.join(generatedDir, fileName);
        const pdfBuffer = await convertSVGToPDF(svgContent);
        fs.writeFileSync(filePath, pdfBuffer);

        console.log('PDF 文件生成完成');
        res.json({ downloadUrl: `/download/${fileName}` });
    } catch (error) {
        console.error('处理请求时发生错误:', error);
        res.status(500).json({ error: '内部服务器错误: ' + error.message });
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
        // 移除不必要的部分
        return svgContent.replace(/```svg|```/g, '').trim();
    }
    return null;
}
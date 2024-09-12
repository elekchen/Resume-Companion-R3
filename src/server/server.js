require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PDFDocument, rgb } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const iconv = require('iconv-lite');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { fromBuffer } = require('pdf2pic');
const os = require('os');
const { OpenAIClient, AzureKeyCredential } = require("@azure/openai");

// Azure OpenAI 配置
const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
const azureApiKey = process.env.AZURE_OPENAI_KEY;
const deploymentId = process.env.AZURE_OPENAI_DEPLOYMENT_ID;

const client = new OpenAIClient(endpoint, new AzureKeyCredential(azureApiKey));

const app = express();

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

async function extractImagesFromPdf(pdfBuffer) {
    const tempDir = os.tmpdir();
    const options = {
        density: 100,
        saveFilename: "page",
        savePath: tempDir,
        format: "png",
        width: 600,
        height: 600
    };

    const convert = fromBuffer(pdfBuffer, options);
    try {
        const images = await convert(1);  // 只转换第一页，如需所有页面请修改这里
        const imageData = fs.readFileSync(images.path);
        fs.unlinkSync(images.path); // 删除临时文件
        return [{
            data: imageData,
            contentType: 'image/png'
        }];
    } catch (error) {
        console.error('Error converting PDF to image:', error);
        return []; // 如果转换失败，返回空数组
    }
}

async function polishResume(resumeContent) {
    console.log('开始简历润色过程');
    try {
        const messages = [
            { role: "system", content: "你是一个专业的简历优化助手。你的任务是改进用户的简历，使其更加专业、有吸引力，并突出用户的优势。" },
            { role: "user", content: `请优化以下简历内容：\n\n${resumeContent}` }
        ];

        console.log('发送请求到 Azure OpenAI');
        const result = await client.getChatCompletions(deploymentId, messages, {
            temperature: 0.7,
            max_tokens: 2000,
            top_p: 0.95,
            frequency_penalty: 0,
            presence_penalty: 0,
        });
        console.log('收到 Azure OpenAI 的响应');

        if (result.choices && result.choices.length > 0) {
            console.log('简历润色成功完成');
            return result.choices[0].message.content;
        } else {
            throw new Error('Azure OpenAI 返回的结果中没有内容');
        }
    } catch (error) {
        console.error('简历润色过程中发生错误:', error);
        throw error;
    }
}

app.post('/generate-resume', upload.single('resumeFile'), async (req, res) => {
    try {
        console.log('开始处理简历生成请求');
        let resumeContent;
        let images = [];
        if (req.file) {
            console.log(`读取上传的文件: ${req.file.originalname}`);
            const fileExtension = path.extname(req.file.originalname).toLowerCase();
            const fileContent = fs.readFileSync(req.file.path);

            if (fileExtension === '.pdf') {
                const pdfData = await pdfParse(fileContent);
                resumeContent = pdfData.text;
                try {
                    images = await extractImagesFromPdf(fileContent);
                } catch (error) {
                    console.error('Error extracting images from PDF:', error);
                    // 继续处理，即使图片提取失败
                }
            } else if (fileExtension === '.docx' || fileExtension === '.doc') {
                const result = await mammoth.convertToHtml({buffer: fileContent});
                resumeContent = result.value;
                // 提取图片
                const imageBuffers = await mammoth.images.extractAll({buffer: fileContent});
                images = await Promise.all(imageBuffers.map(async (image) => {
                    return {
                        data: await image.toBuffer(),
                        contentType: image.contentType
                    };
                }));
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
            polishedResumeContent = await polishResume(resumeContent);
            console.log('简历润色完成');
        } catch (error) {
            console.error('简历润色失败:', error);
            return res.status(500).json({ error: '简历润色失败: ' + error.message });
        }

        console.log('开始生成 PDF');
        const fileName = `resume_${Date.now()}.pdf`;
        const filePath = path.join(generatedDir, fileName);

        const pdfDoc = await PDFDocument.create();
        pdfDoc.registerFontkit(fontkit);

        const fontPath = path.join(__dirname, '../../fonts/SourceHanSansSC-Regular.otf');
        const fontBytes = fs.readFileSync(fontPath);
        const customFont = await pdfDoc.embedFont(fontBytes);

        let page = pdfDoc.addPage();
        const { width, height } = page.getSize();
        const fontSize = 12;
        const lineHeight = 1.5;
        const margin = 50;

        const lines = splitTextIntoLines(polishedResumeContent, customFont, fontSize, width - 2 * margin);

        let y = height - margin;
        for (const line of lines) {
            if (y < margin + fontSize) {
                page = pdfDoc.addPage();
                y = height - margin;
            }
            page.drawText(line, {
                x: margin,
                y: y,
                size: fontSize,
                font: customFont,
                color: rgb(0, 0, 0),
            });
            y -= fontSize * lineHeight;
        }

        // 添加图片
        for (const image of images) {
            let img;
            if (image.contentType === 'image/jpeg') {
                img = await pdfDoc.embedJpg(image.data);
            } else if (image.contentType === 'image/png') {
                img = await pdfDoc.embedPng(image.data);
            } else {
                console.warn(`Unsupported image type: ${image.contentType}`);
                continue;
            }
            const imgDims = img.scale(0.5); // 缩放图片
            page = pdfDoc.addPage();
            page.drawImage(img, {
                x: page.getWidth() / 2 - imgDims.width / 2,
                y: page.getHeight() / 2 - imgDims.height / 2,
                width: imgDims.width,
                height: imgDims.height,
            });
        }

        const pdfBytes = await pdfDoc.save();
        fs.writeFileSync(filePath, pdfBytes);

        console.log('PDF 文件生成完成');
        res.json({ downloadUrl: `/download/${fileName}` });
    } catch (error) {
        console.error('处理请求时发生错误:', error);
        res.status(500).json({ error: '内部服务器错误: ' + error.message });
    }
});

function splitTextIntoLines(text, font, fontSize, maxWidth) {
    const lines = [];
    const paragraphs = text.split('\n');

    for (const paragraph of paragraphs) {
        const words = paragraph.split(' ');
        let currentLine = '';

        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const width = font.widthOfTextAtSize(testLine, fontSize);

            if (width <= maxWidth) {
                currentLine = testLine;
            } else {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
            }
        }

        if (currentLine) {
            lines.push(currentLine);
        }

        // 添加空行来分隔段落
        lines.push('');
    }

    return lines;
}

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
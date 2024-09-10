const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

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

app.post('/generate-resume', upload.single('resumeFile'), (req, res) => {
    console.log('开始处理简历生成请求');
    let resumeContent;
    if (req.file) {
        console.log(`读取上传的文件: ${req.file.originalname}`);
        resumeContent = fs.readFileSync(req.file.path, 'utf8');
    } else if (req.body.resumeContent) {
        console.log('使用文本区域的内容');
        resumeContent = req.body.resumeContent;
    } else {
        console.log('未提供简历内容');
        return res.status(400).json({ error: 'No resume content provided' });
    }

    console.log('开始生成 PDF');
    const fileName = `resume_${Date.now()}.pdf`;
    const filePath = path.join(generatedDir, fileName);

    const doc = new PDFDocument();
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    // 使用支持中文的字体
    const fontPath = path.join(__dirname, '../../fonts/SourceHanSansSC-Regular.otf');
    if (!fs.existsSync(fontPath)) {
        console.error('Font file not found:', fontPath);
        return res.status(500).json({ error: 'Font file not found' });
    }
    doc.font(fontPath);

    // 设置字体大小和行高
    const fontSize = 12;
    const lineHeight = 1.5;
    doc.fontSize(fontSize);

    console.log('开始写入内容到 PDF');
    // 分段处理文本，避免超出页面边界
    const pageWidth = doc.page.width - 2 * 100; // 左右各留 100 的边距
    const pageHeight = doc.page.height - 2 * 100; // 上下各留 100 的边距

    let y = 100;
    const paragraphs = resumeContent.split('\n');

    paragraphs.forEach((paragraph, index) => {
        const words = paragraph.split('');
        let line = '';

        words.forEach(char => {
            const testLine = line + char;
            const testWidth = doc.widthOfString(testLine);

            if (testWidth > pageWidth) {
                if (y > pageHeight - fontSize) {
                    doc.addPage();
                    y = 100;
                }
                doc.text(line.trim(), 100, y);
                y += fontSize * lineHeight;
                line = char;
            } else {
                line = testLine;
            }
        });

        // 添加段落的最后一行
        if (line.trim().length > 0) {
            if (y > pageHeight - fontSize) {
                doc.addPage();
                y = 100;
            }
            doc.text(line.trim(), 100, y);
            y += fontSize * lineHeight;
        }

        // 段落之间添加额外的空行
        y += fontSize * lineHeight;

        console.log(`处理进度: ${Math.round((index + 1) / paragraphs.length * 100)}%`);
    });

    console.log('PDF 内容写入完成');
    doc.end();

    stream.on('finish', () => {
        console.log('PDF 文件生成完成');
        res.json({ downloadUrl: `/download/${fileName}` });
    });

    stream.on('error', (err) => {
        console.error('Error writing PDF:', err);
        res.status(500).json({ error: 'Failed to generate PDF' });
    });
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
# Resume Companion

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An AI-powered resume optimization tool that automatically enhances and tailors resumes to match specific job descriptions.

## Key Features

- 🤖 AI-powered resume content optimization
- 📝 Smart content adaptation based on job descriptions
- 📄 Single A4 page output with professional formatting
- 🎨 Automatic resume beautification
- 💾 Multiple input formats support (PDF, DOCX, TXT)
- ⬇️ Export to professional PDF format

## Technology Stack

### Backend
- Node.js (v20.0.0+)
- Express.js
- Grok AI API (x.ai)

### File Processing
- puppeteer (PDF generation)
- pdf-parse (PDF parsing)
- mammoth (DOCX parsing)

### Frontend
- HTML5
- CSS3
- Vanilla JavaScript

## Getting Started

### Prerequisites
1. Node.js (v20.0.0 or higher)
2. x.ai account with Grok AI API access
3. npm or yarn package manager

### Installation

1. Clone the repository
```bash
git clone https://github.com/elekchen/Resume-Companion-R3.git
cd Resume-Companion-R3
```

2. Install dependencies
```bash
npm install
```

3. Configure environment variables
```bash
# Create .env file in project root
cp .env.example .env

# Add your Grok AI API key to .env
GROK_API_KEY=your_grok_api_key_here
```

### Development

Start the development server:
```bash
npm run dev
```

### Production

Start the production server:
```bash
npm start
```

## API Documentation

### Endpoints

#### POST /polish-resume
Optimizes resume content based on job description.
```javascript
{
  "resumeContent": "string",
  "jobDescription": "string"
}
```

#### POST /generate-resume
Generates PDF resume from optimized content.
```javascript
{
  "resumeContent": "string",
  "jobDescription": "string"
}
```

#### GET /download/:fileName
Downloads generated PDF resume.

## Project Structure
```
Resume-Companion-R3/
├── src/
│   ├── client/          # Frontend files
│   ├── server/          # Backend files
│   └── utils/           # Utility functions
├── generated/           # Generated PDF files
├── uploads/            # Temporary upload directory
└── tests/              # Test files
```

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please:
- Open an [issue](https://github.com/elekchen/Resume-Companion-R3/issues)
- Contact: elek@starm.ai

## Acknowledgements

- [Grok AI](https://x.ai/) - AI model provider
- [Express.js](https://expressjs.com/) - Web framework
- [puppeteer](https://pptr.dev/) - PDF generation
- [pdf-parse](https://www.npmjs.com/package/pdf-parse) - PDF parsing
- [mammoth](https://www.npmjs.com/package/mammoth) - DOCX parsing

---
Made with ❤️ by [starm.ai](https://starm.ai/)

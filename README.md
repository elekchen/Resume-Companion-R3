# Resume Companion

Resume Companion is a GPT-powered resume optimization tool that enhances and beautifies resumes to match job descriptions.

## Features

1. Upload resume or input personal information
2. AI-powered resume enhancement and beautification
3. Generate and download optimized resume in PDF format
4. Tailored resume content based on job descriptions
5. Single A4 page output for concise presentation

## Tech Stack

- Backend: Node.js with Express
- Frontend: HTML, CSS, JavaScript
- AI: Azure OpenAI API
- PDF Generation: pdf-lib, puppeteer
- File Parsing: pdf-parse, mammoth

## Prerequisites

- Node.js (version 20.0.0 or higher)
- Azure OpenAI API access

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/resume-companion.git
   cd resume-companion
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the root directory and add your Azure OpenAI credentials:
   ```
   AZURE_OPENAI_ENDPOINT=your_endpoint_here
   AZURE_OPENAI_KEY=your_api_key_here
   AZURE_OPENAI_DEPLOYMENT_ID=your_deployment_id_here
   ```

## Usage

1. Start the server:
   ```
   npm start
   ```

2. Open a web browser and navigate to `http://localhost:3000`

3. Upload your resume file or input your resume content in the text area

4. Provide the job description for the position you're applying for

5. Click "Generate PDF Resume" to create your optimized resume

6. Download the generated PDF resume

## API Endpoints

- `POST /polish-resume`: Polishes the resume content based on the job description
- `POST /generate-resume`: Generates a PDF resume from the polished content
- `GET /download/:fileName`: Downloads the generated PDF resume

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the ISC License.

## Acknowledgements

- [Azure OpenAI](https://azure.microsoft.com/en-us/products/cognitive-services/openai-service/)
- [Express.js](https://expressjs.com/)
- [pdf-lib](https://pdf-lib.js.org/)
- [puppeteer](https://pptr.dev/)

## Contact

If you have any questions, feel free to reach out to [Your Name] at [your.email@example.com].
